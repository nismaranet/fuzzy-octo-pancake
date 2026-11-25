import { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { ObjectId } from "mongodb";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import clientPromise from "@/lib/mongodb";
import { jsonNoCache } from "@/lib/antiCache";
import { checkRateLimit } from "@/lib/rateLimit";
import { redis } from "@/lib/redis";
import {
  getCurrentSessionTokenFromCookie,
  revokeUserSessions,
} from "@/lib/sessionSecurity";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?._id) {
      return jsonNoCache({ error: "Unauthorized" }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db();
    const userIdStr = String(session.user._id);
    const currentToken = await getCurrentSessionTokenFromCookie();
    const now = new Date();

    const userFilters: any[] = [{ userId: userIdStr }];
    if (ObjectId.isValid(userIdStr)) {
      userFilters.push({ userId: new ObjectId(userIdStr) });
    }

    const rawSessions = await db
      .collection("sessions")
      .find({
        $or: userFilters,
        expires: { $gt: now },
      })
      .sort({ "securityMeta.lastActiveAt": -1, expires: -1 })
      .toArray();

    // Jangan pernah mengirimkan sessionToken mentah ke client
    const sessions = rawSessions.map((doc: any) => ({
      id: doc._id.toString(),
      deviceLabel: doc.securityMeta?.deviceLabel || "Perangkat Web",
      deviceType: doc.securityMeta?.deviceType === "mobile" ? "mobile" : "desktop",
      country: doc.securityMeta?.country || null,
      ipMasked: doc.securityMeta?.ipMasked || null,
      createdAt: doc.securityMeta?.createdAt || doc.createdAt || null,
      lastActiveAt: doc.securityMeta?.lastActiveAt || doc.securityMeta?.createdAt || null,
      expires: doc.expires,
      isCurrent: Boolean(currentToken && doc.sessionToken === currentToken),
    }));

    return jsonNoCache({ success: true, sessions });
  } catch (error) {
    console.error("GET /api/auth/sessions Error:", error);
    return jsonNoCache({ error: "Gagal mengambil daftar sesi aktif." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?._id || !session?.user?.discordId) {
      return jsonNoCache({ error: "Unauthorized" }, { status: 401 });
    }

    if (!checkRateLimit(session.user.discordId, "auth-sessions-revoke", 2000)) {
      return jsonNoCache(
        { error: "Terlalu banyak permintaan. Tunggu beberapa detik." },
        { status: 429 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const mode = body?.mode as "single" | "others" | "all" | undefined;
    const sessionId = body?.sessionId ? String(body.sessionId) : null;

    if (!mode || !["single", "others", "all"].includes(mode)) {
      return jsonNoCache({ error: "Mode pencabutan sesi tidak valid." }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();
    const userIdStr = String(session.user._id);
    const currentToken = await getCurrentSessionTokenFromCookie();

    if (mode === "single") {
      if (!sessionId || !ObjectId.isValid(sessionId)) {
        return jsonNoCache({ error: "ID sesi tidak valid." }, { status: 400 });
      }

      const userFilters: any[] = [{ userId: userIdStr }];
      if (ObjectId.isValid(userIdStr)) {
        userFilters.push({ userId: new ObjectId(userIdStr) });
      }

      const targetDoc = await db.collection("sessions").findOne({
        _id: new ObjectId(sessionId),
        $or: userFilters,
      });

      if (!targetDoc) {
        return jsonNoCache({ error: "Sesi tidak ditemukan." }, { status: 404 });
      }

      const revokedCurrent = Boolean(
        currentToken && targetDoc.sessionToken === currentToken,
      );

      await db.collection("sessions").deleteOne({ _id: targetDoc._id });
      if (revokedCurrent && process.env.REDIS_URL?.trim()) {
        await redis.del(`session:profile:${userIdStr}`).catch(() => null);
      }

      return jsonNoCache({
        success: true,
        revokedCount: 1,
        revokedCurrent,
        message: "Sesi perangkat berhasil diputus.",
      });
    }

    if (mode === "others") {
      const { deletedCount } = await revokeUserSessions(db, userIdStr, {
        exceptSessionToken: currentToken,
      });
      return jsonNoCache({
        success: true,
        revokedCount: deletedCount,
        revokedCurrent: false,
        message:
          deletedCount > 0
            ? `${deletedCount} sesi perangkat lain berhasil diputus.`
            : "Tidak ada sesi perangkat lain yang aktif.",
      });
    }

    // mode === "all"
    const { deletedCount } = await revokeUserSessions(db, userIdStr);
    return jsonNoCache({
      success: true,
      revokedCount: deletedCount,
      revokedCurrent: true,
      message: "Seluruh sesi perangkat berhasil diputus.",
    });
  } catch (error) {
    console.error("DELETE /api/auth/sessions Error:", error);
    return jsonNoCache({ error: "Gagal mencabut sesi login." }, { status: 500 });
  }
}
