import { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import clientPromise from "@/lib/mongodb";
import { jsonNoCache } from "@/lib/antiCache";
import { checkRateLimit } from "@/lib/rateLimit";
import { isWebOwner } from "@/lib/webConfig";
import {
  revokeUserSessions,
  recordSessionSecurityAlert,
  notifySessionAnomaly,
} from "@/lib/sessionSecurity";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ discordId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.discordId) {
      return jsonNoCache({ error: "Unauthorized" }, { status: 401 });
    }

    const isOwner = await isWebOwner(session.user.discordId);
    const isStaff =
      session.user.role === "manager" ||
      session.user.role === "admin" ||
      isOwner;

    if (!isStaff) {
      return jsonNoCache(
        { error: "Forbidden - Hanya Manager, Admin, atau Owner yang berhak." },
        { status: 403 },
      );
    }

    if (!checkRateLimit(session.user.discordId, "manage-revoke-sessions", 2000)) {
      return jsonNoCache(
        { error: "Terlalu banyak permintaan. Mohon tunggu beberapa detik." },
        { status: 429 },
      );
    }

    const { discordId } = await context.params;
    const cleanDiscordId = String(discordId || "").trim();
    if (!cleanDiscordId) {
      return jsonNoCache({ error: "discordId wajib diisi." }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();

    const targetUser = await db.collection("users").findOne({
      $or: [{ discordId: cleanDiscordId }, { id: cleanDiscordId }],
    });

    if (!targetUser) {
      return jsonNoCache({ error: "User tidak ditemukan." }, { status: 404 });
    }

    const { deletedCount } = await revokeUserSessions(
      db,
      targetUser._id.toString(),
    );

    const staffName = session.user.name || session.user.discordId;
    await Promise.allSettled([
      recordSessionSecurityAlert({
        db,
        discordId: cleanDiscordId,
        action: "SESSION_REVOKED_BY_STAFF",
        details: `Seluruh sesi login (${deletedCount} sesi) milik ${targetUser.name || cleanDiscordId} dicabut secara paksa oleh staff ${staffName} (${session.user.discordId}).`,
      }),
      notifySessionAnomaly({
        db,
        discordId: cleanDiscordId,
        title: "🔒 Sesi Login Direset oleh Staff",
        message:
          `Seluruh sesi login website Anda baru saja diputus oleh **${staffName}** demi keamanan akun. ` +
          `Silakan login kembali di website Nismara Transport.`,
        dedupKey: `sec:staff-revoke:${cleanDiscordId}`,
      }),
    ]);

    return jsonNoCache({
      success: true,
      revokedCount: deletedCount,
      message: `Berhasil mencabut ${deletedCount} sesi aktif milik ${targetUser.name || cleanDiscordId}.`,
    });
  } catch (error) {
    console.error("POST /api/manage/users/[discordId]/revoke-sessions Error:", error);
    return jsonNoCache(
      { error: "Terjadi kesalahan saat mencabut sesi user." },
      { status: 500 },
    );
  }
}
