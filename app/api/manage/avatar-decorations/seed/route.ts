import { getServerSession } from "next-auth/next";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongoose";
import AvatarDecoration from "@/lib/models/AvatarDecoration";
import { jsonNoCache } from "@/lib/antiCache";
import { checkRateLimit } from "@/lib/rateLimit";
import { STARTER_AVATAR_DECORATIONS } from "@/lib/avatarDecorations";
import { invalidateAvatarDecorationsCache } from "@/lib/avatarDecorationsServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    const isManager =
      session?.user?.role === "manager" || session?.user?.role === "admin";
    if (!session?.user?.discordId || !isManager) {
      return jsonNoCache(
        { success: false, error: "Akses ditolak. Khusus Manager & Admin." },
        { status: 403 },
      );
    }

    const discordId = String(session.user.discordId);
    if (!checkRateLimit(discordId, "manage-avatar-deco-seed", 3000)) {
      return jsonNoCache(
        { success: false, error: "Mohon tunggu sebentar sebelum mengimpor lagi." },
        { status: 429 },
      );
    }

    await dbConnect();

    // Mongoose 9: jangan sertakan createdAt/updatedAt di $setOnInsert pada schema timestamps: true
    const ops = STARTER_AVATAR_DECORATIONS.map((seed) => ({
      updateOne: {
        filter: { slug: seed.id },
        update: {
          $setOnInsert: {
            slug: seed.id,
            name: seed.name,
            description: seed.description,
            category: seed.category,
            rarity: seed.rarity,
            access: seed.access,
            renderType: seed.renderType,
            svgPresetKey: seed.svgPresetKey || seed.id,
            assetUrl: seed.assetUrl || null,
            scale: seed.scale,
            accentColor: seed.accentColor,
            isActive: seed.isActive,
            sortOrder: seed.sortOrder,
            availableFrom: null,
            availableUntil: null,
            authorDiscordId: discordId,
            updatedByDiscordId: discordId,
          },
        },
        upsert: true,
      },
    }));

    const bulkRes = await AvatarDecoration.bulkWrite(ops, { ordered: false });
    const insertedCount = bulkRes.upsertedCount || 0;
    const skippedCount = STARTER_AVATAR_DECORATIONS.length - insertedCount;

    await invalidateAvatarDecorationsCache();
    try {
      revalidatePath("/dashboard/manage/data/avatar-decorations");
      revalidatePath("/dashboard/settings");
      revalidatePath("/profile/[truckyId]", "page");
    } catch {
      // non-fatal
    }

    return jsonNoCache({
      success: true,
      insertedCount,
      skippedCount,
      message:
        insertedCount > 0
          ? `Berhasil mengimpor ${insertedCount} dekorasi bawaan (${skippedCount} sudah ada).`
          : "Seluruh 6 dekorasi bawaan sudah tersedia di database.",
    });
  } catch (err: any) {
    console.error("[POST /api/manage/avatar-decorations/seed] Error:", err);
    return jsonNoCache(
      { success: false, error: err?.message || "Gagal mengimpor dekorasi bawaan." },
      { status: 500 },
    );
  }
}
