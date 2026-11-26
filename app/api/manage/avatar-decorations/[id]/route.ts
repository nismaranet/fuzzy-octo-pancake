import { getServerSession } from "next-auth/next";
import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongoose";
import AvatarDecoration from "@/lib/models/AvatarDecoration";
import { jsonNoCache } from "@/lib/antiCache";
import { checkRateLimit } from "@/lib/rateLimit";
import { deleteFileFromR2 } from "@/lib/r2";
import { parseDecorationPayload } from "../route";
import {
  invalidateAvatarDecorationsCache,
  serializeAvatarDecoration,
} from "@/lib/avatarDecorationsServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
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
    if (!checkRateLimit(discordId, "manage-avatar-deco-update", 1000)) {
      return jsonNoCache(
        { success: false, error: "Terlalu banyak permintaan. Coba sebentar lagi." },
        { status: 429 },
      );
    }

    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return jsonNoCache(
        { success: false, error: "ID dekorasi tidak valid." },
        { status: 400 },
      );
    }

    await dbConnect();
    const existing = await AvatarDecoration.findById(id);
    if (!existing) {
      return jsonNoCache(
        { success: false, error: "Dekorasi tidak ditemukan." },
        { status: 404 },
      );
    }

    const body = await request.json();

    // Quick toggle aktif/nonaktif saja
    if (
      Object.keys(body).length === 1 &&
      typeof body.isActive === "boolean"
    ) {
      existing.isActive = body.isActive;
      existing.updatedByDiscordId = discordId;
      await existing.save();

      await invalidateAvatarDecorationsCache();
      try {
        revalidatePath("/dashboard/manage/data/avatar-decorations");
        revalidatePath("/dashboard/settings");
        revalidatePath("/profile/[truckyId]", "page");
        revalidatePath("/currency-boost/[slug]", "page");
      } catch {
        // non-fatal
      }

      return jsonNoCache({
        success: true,
        item: serializeAvatarDecoration(existing.toObject()),
        message: existing.isActive
          ? "Dekorasi diaktifkan."
          : "Dekorasi dinonaktifkan.",
      });
    }

    const parsed = parseDecorationPayload(body);

    // Cek duplikasi slug bila berubah
    if (parsed.slug !== existing.slug) {
      const dup = await AvatarDecoration.findOne({
        slug: parsed.slug,
        _id: { $ne: existing._id },
      }).lean();
      if (dup) {
        return jsonNoCache(
          { success: false, error: `Slug "${parsed.slug}" sudah digunakan.` },
          { status: 409 },
        );
      }
    }

    const oldAssetUrl = existing.assetUrl;

    existing.slug = parsed.slug;
    existing.name = parsed.name;
    existing.description = parsed.description;
    existing.category = parsed.category;
    existing.rarity = parsed.rarity;
    existing.access = parsed.access;
    existing.renderType = parsed.renderType;
    existing.svgPresetKey = parsed.svgPresetKey;
    existing.assetUrl = parsed.assetUrl;
    existing.scale = parsed.scale;
    existing.accentColor = parsed.accentColor;
    existing.isActive = parsed.isActive;
    existing.sortOrder = parsed.sortOrder;
    existing.availableFrom = parsed.availableFrom;
    existing.availableUntil = parsed.availableUntil;
    existing.updatedByDiscordId = discordId;

    await existing.save();

    // Hapus file R2 lama bila asset diganti atau berubah ke SVG (zero orphan files)
    if (oldAssetUrl && oldAssetUrl !== parsed.assetUrl) {
      await deleteFileFromR2(oldAssetUrl).catch((e) =>
        console.error("[AvatarDecoration PATCH] Failed to delete old R2 asset:", e),
      );
    }

    await invalidateAvatarDecorationsCache();
    try {
      revalidatePath("/dashboard/manage/data/avatar-decorations");
      revalidatePath("/dashboard/settings");
      revalidatePath("/profile/[truckyId]", "page");
      revalidatePath("/currency-boost/[slug]", "page");
    } catch {
      // non-fatal
    }

    return jsonNoCache({
      success: true,
      item: serializeAvatarDecoration(existing.toObject()),
      message: "Dekorasi avatar berhasil diperbarui.",
    });
  } catch (err: any) {
    console.error("[PATCH /api/manage/avatar-decorations/[id]] Error:", err);
    return jsonNoCache(
      { success: false, error: err?.message || "Gagal memperbarui dekorasi." },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
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
    if (!checkRateLimit(discordId, "manage-avatar-deco-delete", 1500)) {
      return jsonNoCache(
        { success: false, error: "Terlalu banyak permintaan. Coba sebentar lagi." },
        { status: 429 },
      );
    }

    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return jsonNoCache(
        { success: false, error: "ID dekorasi tidak valid." },
        { status: 400 },
      );
    }

    await dbConnect();
    const deleted = await AvatarDecoration.findByIdAndDelete(id).lean();
    if (!deleted) {
      return jsonNoCache(
        { success: false, error: "Dekorasi tidak ditemukan." },
        { status: 404 },
      );
    }

    // Bersihkan file di R2 jika ada
    if (deleted.assetUrl) {
      await deleteFileFromR2(deleted.assetUrl).catch((e) =>
        console.error("[AvatarDecoration DELETE] Failed to delete R2 asset:", e),
      );
    }

    await invalidateAvatarDecorationsCache();
    try {
      revalidatePath("/dashboard/manage/data/avatar-decorations");
      revalidatePath("/dashboard/settings");
      revalidatePath("/profile/[truckyId]", "page");
      revalidatePath("/currency-boost/[slug]", "page");
    } catch {
      // non-fatal
    }

    return jsonNoCache({
      success: true,
      message: `Dekorasi "${deleted.name}" berhasil dihapus.`,
    });
  } catch (err: any) {
    console.error("[DELETE /api/manage/avatar-decorations/[id]] Error:", err);
    return jsonNoCache(
      { success: false, error: err?.message || "Gagal menghapus dekorasi." },
      { status: 500 },
    );
  }
}
