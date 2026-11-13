import { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import clientPromise from "@/lib/mongodb";
import { jsonNoCache } from "@/lib/antiCache";
import {
  DISCORD_ID_REGEX,
  executeDiscordAccountMigration,
  isOwnerDiscordId,
  MigrationConflictStrategy,
} from "@/lib/accountMigration";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.discordId) {
      return jsonNoCache({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isOwnerDiscordId(session.user.discordId)) {
      return jsonNoCache({ error: "Forbidden" }, { status: 403 });
    }

    const client = await clientPromise;
    const db = client.db();
    const history = await db
      .collection("accountmigrations")
      .find({})
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();

    return jsonNoCache({ success: true, history });
  } catch (error: unknown) {
    console.error("Account Migration History Error:", error);
    const message =
      error instanceof Error ? error.message : "Gagal mengambil riwayat migrasi.";
    return jsonNoCache({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.discordId) {
      return jsonNoCache({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isOwnerDiscordId(session.user.discordId)) {
      return jsonNoCache(
        { error: "Forbidden: Fitur Migrasi Akun khusus untuk Owner." },
        { status: 403 },
      );
    }

    const body = await req.json();
    const oldDiscordId = String(body?.oldDiscordId || "").trim();
    const newDiscordId = String(body?.newDiscordId || "").trim();
    const confirmTargetDiscordId = String(body?.confirmTargetDiscordId || "").trim();
    const rawStrategy = String(body?.conflictStrategy || "override");

    if (!DISCORD_ID_REGEX.test(oldDiscordId) || !DISCORD_ID_REGEX.test(newDiscordId)) {
      return jsonNoCache(
        { error: "Format Discord ID tidak valid (harus 17-22 digit angka)." },
        { status: 400 },
      );
    }

    if (oldDiscordId === newDiscordId) {
      return jsonNoCache(
        { error: "Discord ID lama dan Discord ID baru tidak boleh sama." },
        { status: 400 },
      );
    }

    if (confirmTargetDiscordId !== newDiscordId) {
      return jsonNoCache(
        { error: "Konfirmasi Discord ID baru tidak cocok." },
        { status: 400 },
      );
    }

    if (rawStrategy !== "override" && rawStrategy !== "merge") {
      return jsonNoCache(
        { error: "Strategi konflik harus berupa 'override' atau 'merge'." },
        { status: 400 },
      );
    }

    const conflictStrategy: MigrationConflictStrategy = rawStrategy;

    const result = await executeDiscordAccountMigration({
      oldDiscordId,
      newDiscordId,
      conflictStrategy,
      executedByDiscordId: String(session.user.discordId),
      executedByName: session.user.name || "Owner",
    });

    const pathsToRevalidate = [
      "/dashboard",
      "/dashboard/manage/data",
      "/dashboard/manage/data/users",
      "/dashboard/manage/data/migrate-account",
      "/dashboard/manage/data/nismaraplus",
      "/dashboard/garage",
      "/dashboard/fleet",
      "/dashboard/transactions",
      "/drivers",
      "/gallery",
      "/feeds",
      "/leaderboard",
    ];
    for (const p of pathsToRevalidate) {
      try {
        revalidatePath(p);
      } catch {
        // Ignore individual path revalidation errors
      }
    }

    return jsonNoCache({ success: true, result });
  } catch (error: unknown) {
    console.error("Account Migration Execute Error:", error);
    const message =
      error instanceof Error ? error.message : "Gagal mengeksekusi migrasi akun.";
    const status = message.includes("sedang berjalan") ? 409 : 400;
    return jsonNoCache({ error: message }, { status });
  }
}
