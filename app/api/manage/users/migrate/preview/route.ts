import { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { jsonNoCache } from "@/lib/antiCache";
import {
  DISCORD_ID_REGEX,
  isOwnerDiscordId,
  previewDiscordAccountMigration,
} from "@/lib/accountMigration";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

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

    const preview = await previewDiscordAccountMigration(oldDiscordId, newDiscordId);
    return jsonNoCache({ success: true, preview });
  } catch (error: unknown) {
    console.error("Account Migration Preview Error:", error);
    const message =
      error instanceof Error ? error.message : "Gagal memuat preview migrasi akun.";
    return jsonNoCache({ error: message }, { status: 500 });
  }
}

