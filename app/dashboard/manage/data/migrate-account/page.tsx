import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import clientPromise from "@/lib/mongodb";
import { DEFAULT_GUILD_ID, isOwnerDiscordId } from "@/lib/accountMigration";
import MigrateAccountClient, {
  type MigrationHistoryItem,
  type SelectableAccountOption,
} from "./MigrateAccountClient";

export const metadata: Metadata = {
  title: "Migrasi Akun Discord",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function MigrateAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ oldDiscordId?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.discordId || !isOwnerDiscordId(session.user.discordId)) {
    redirect("/dashboard/manage/data");
  }

  const resolvedParams = await searchParams;
  const initialOldDiscordId = String(resolvedParams?.oldDiscordId || "").trim();

  const client = await clientPromise;
  const db = client.db();

  const [users, driverLinks, historyRaw] = await Promise.all([
    db
      .collection("users")
      .find(
        { discordId: { $exists: true, $ne: null } },
        {
          projection: {
            discordId: 1,
            name: 1,
            truckyId: 1,
            truckyRank: 1,
            truckyRole: 1,
            image: 1,
            isDriver: 1,
            nismaraplus: 1,
          },
        },
      )
      .toArray(),
    db
      .collection("driverlinks")
      .find(
        { guildId: DEFAULT_GUILD_ID, userId: { $exists: true, $ne: null } },
        { projection: { userId: 1, name: 1, truckyId: 1, role: 1 } },
      )
      .toArray(),
    db
      .collection("accountmigrations")
      .find({})
      .sort({ createdAt: -1 })
      .limit(15)
      .toArray(),
  ]);

  const map = new Map<string, SelectableAccountOption>();

  for (const dl of driverLinks) {
    const id = String(dl.userId || "").trim();
    if (!id) continue;
    map.set(id, {
      discordId: id,
      name: dl.name || `Driver (${id})`,
      truckyId: dl.truckyId ? String(dl.truckyId) : null,
      truckyRank: null,
      truckyRole: dl.role || null,
      image: null,
      isDriver: dl.role !== "Magang",
      nismaraPlus: false,
    });
  }

  for (const u of users) {
    const id = String(u.discordId || "").trim();
    if (!id) continue;
    const prev = map.get(id);
    map.set(id, {
      discordId: id,
      name: u.name || prev?.name || `User (${id})`,
      truckyId: u.truckyId ? String(u.truckyId) : prev?.truckyId || null,
      truckyRank: u.truckyRank || prev?.truckyRank || null,
      truckyRole: u.truckyRole || prev?.truckyRole || null,
      image: u.image || prev?.image || null,
      isDriver: Boolean(u.isDriver || prev?.isDriver),
      nismaraPlus: Boolean(u.nismaraplus?.status === true),
    });
  }

  const initialDrivers = Array.from(map.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "id"),
  );

  interface MigrationAuditDoc {
    _id: unknown;
    migrationId?: string;
    oldDiscordId?: string;
    newDiscordId?: string;
    strategy?: string;
    executedByDiscordId?: string;
    executedByName?: string;
    totalDocumentsTouched?: number;
    sourceTruckyId?: string | number | null;
    createdAt?: Date | string;
    roleSync?: {
      assigned?: Array<{ label: string; roleId: string }>;
      revoked?: Array<{ label: string; roleId: string }>;
    };
  }

  const initialHistory: MigrationHistoryItem[] = (historyRaw as unknown as MigrationAuditDoc[]).map((h) => ({
    _id: String(h._id),
    migrationId: String(h.migrationId || ""),
    oldDiscordId: String(h.oldDiscordId || ""),
    newDiscordId: String(h.newDiscordId || ""),
    strategy: h.strategy === "merge" ? "merge" : "override",
    executedByDiscordId: String(h.executedByDiscordId || ""),
    executedByName: String(h.executedByName || "Owner"),
    totalDocumentsTouched: Number(h.totalDocumentsTouched || 0),
    sourceTruckyId: h.sourceTruckyId ? String(h.sourceTruckyId) : null,
    createdAt: h.createdAt ? new Date(h.createdAt).toISOString() : new Date().toISOString(),
    roleSync: {
      assigned: Array.isArray(h.roleSync?.assigned) ? h.roleSync.assigned : [],
      revoked: Array.isArray(h.roleSync?.revoked) ? h.roleSync.revoked : [],
    },
  }));

  return (
    <MigrateAccountClient
      key={initialOldDiscordId || "default"}
      initialDrivers={initialDrivers}
      initialHistory={initialHistory}
      initialOldDiscordId={initialOldDiscordId}
    />
  );
}

