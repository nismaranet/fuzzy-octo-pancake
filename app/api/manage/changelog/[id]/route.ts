import { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongoose";
import { isWebOwner } from "@/lib/webConfig";
import { jsonNoCache } from "@/lib/antiCache";
import { checkRateLimit } from "@/lib/rateLimit";
import { parseWIBDate } from "@/lib/utils";
import ChangelogEntry from "@/lib/models/ChangelogEntry";
import {
  isValidChangelogProduct,
  isValidVersionFormat,
  normalizeVersion,
} from "@/lib/changelog";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

function sanitizeOptionalUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (
    trimmed.startsWith("/") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("http://")
  ) {
    return trimmed.slice(0, 500);
  }
  throw new Error("Tautan harus diawali dengan /, https://, atau http://");
}

function sanitizeStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => String(item ?? "").trim())
    .filter((item) => item.length > 0)
    .slice(0, 60);
}

async function requireOwner() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.discordId) {
    return { error: jsonNoCache({ success: false, error: "Unauthorized" }, { status: 401 }) };
  }
  const allowed = await isWebOwner(session.user.discordId);
  if (!allowed) {
    return {
      error: jsonNoCache(
        { success: false, error: "Akses ditolak. Fitur ini khusus Web Owner." },
        { status: 403 }
      ),
    };
  }
  return { discordId: String(session.user.discordId) };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireOwner();
    if ("error" in auth) return auth.error;

    if (!checkRateLimit(auth.discordId, "manage-changelog-update", 800)) {
      return jsonNoCache(
        { success: false, error: "Terlalu cepat. Mohon tunggu sebentar." },
        { status: 429 }
      );
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return jsonNoCache({ success: false, error: "ID changelog tidak valid." }, { status: 400 });
    }

    await dbConnect();
    const existing = await ChangelogEntry.findById(id);
    if (!existing) {
      return jsonNoCache(
        { success: false, error: "Catatan perubahan tidak ditemukan." },
        { status: 404 }
      );
    }

    const body = await req.json();
    const update: Record<string, any> = {
      updatedByDiscordId: auth.discordId,
    };

    if (body?.product !== undefined) {
      if (!isValidChangelogProduct(body.product)) {
        return jsonNoCache({ success: false, error: "Produk tidak valid." }, { status: 400 });
      }
      update.product = body.product;
    }

    if (body?.version !== undefined) {
      const version = normalizeVersion(body.version);
      if (!isValidVersionFormat(version)) {
        return jsonNoCache(
          { success: false, error: "Format versi tidak valid. Contoh: 1.5.2" },
          { status: 400 }
        );
      }
      update.version = version;
    }

    if (body?.title !== undefined) {
      const title = String(body.title || "").trim();
      if (!title || title.length > 160) {
        return jsonNoCache(
          { success: false, error: "Judul rilis wajib diisi (maksimal 160 karakter)." },
          { status: 400 }
        );
      }
      update.title = title;
    }

    if (body?.summary !== undefined) {
      const summary = String(body.summary || "").trim();
      if (!summary || summary.length > 800) {
        return jsonNoCache(
          { success: false, error: "Ringkasan rilis wajib diisi (maksimal 800 karakter)." },
          { status: 400 }
        );
      }
      update.summary = summary;
    }

    if (body?.releaseDate !== undefined) {
      try {
        update.releaseDate = parseWIBDate(body.releaseDate);
      } catch (e: any) {
        return jsonNoCache(
          { success: false, error: e?.message || "Format tanggal rilis tidak valid." },
          { status: 400 }
        );
      }
    }

    if (body?.sections !== undefined) {
      const added = sanitizeStringArray(body.sections?.added);
      const improved = sanitizeStringArray(body.sections?.improved);
      const fixed = sanitizeStringArray(body.sections?.fixed);
      if (added.length + improved.length + fixed.length === 0) {
        return jsonNoCache(
          { success: false, error: "Minimal harus ada 1 poin perubahan." },
          { status: 400 }
        );
      }
      update.sections = { added, improved, fixed };
    }

    if (body?.articleUrl !== undefined) {
      try {
        update.articleUrl = sanitizeOptionalUrl(body.articleUrl);
      } catch (e: any) {
        return jsonNoCache({ success: false, error: e.message }, { status: 400 });
      }
    }

    if (body?.highlightFeatureUrl !== undefined) {
      try {
        update.highlightFeatureUrl = sanitizeOptionalUrl(body.highlightFeatureUrl);
      } catch (e: any) {
        return jsonNoCache({ success: false, error: e.message }, { status: 400 });
      }
    }

    if (body?.highlightFeatureLabel !== undefined) {
      const effectiveUrl =
        update.highlightFeatureUrl !== undefined
          ? update.highlightFeatureUrl
          : existing.highlightFeatureUrl;
      update.highlightFeatureLabel =
        effectiveUrl && typeof body.highlightFeatureLabel === "string"
          ? body.highlightFeatureLabel.trim().slice(0, 80) || null
          : null;
    }

    if (body?.status === "draft" || body?.status === "published") {
      update.status = body.status;
      if (body.status === "published" && !existing.publishedAt) {
        update.publishedAt = new Date();
      }
    }

    const updated = await ChangelogEntry.findByIdAndUpdate(
      id,
      { $set: update },
      { returnDocument: "after" }
    ).lean();

    if (!updated) {
      return jsonNoCache(
        { success: false, error: "Catatan perubahan tidak ditemukan." },
        { status: 404 }
      );
    }

    try {
      revalidatePath("/changelog");
      revalidatePath("/");
    } catch {
      // Non-fatal
    }

    return jsonNoCache({
      success: true,
      message: `Catatan perubahan v${updated.version} berhasil diperbarui.`,
      entry: {
        _id: String(updated._id),
        product: updated.product,
        version: updated.version,
        title: updated.title,
        summary: updated.summary,
        releaseDate: new Date(updated.releaseDate).toISOString(),
        status: updated.status,
        sections: {
          added: Array.isArray(updated.sections?.added) ? updated.sections.added : [],
          improved: Array.isArray(updated.sections?.improved) ? updated.sections.improved : [],
          fixed: Array.isArray(updated.sections?.fixed) ? updated.sections.fixed : [],
        },
        articleUrl: updated.articleUrl || null,
        highlightFeatureUrl: updated.highlightFeatureUrl || null,
        highlightFeatureLabel: updated.highlightFeatureLabel || null,
        publishedAt: updated.publishedAt ? new Date(updated.publishedAt).toISOString() : null,
      },
    });
  } catch (err: any) {
    if (err?.code === 11000) {
      return jsonNoCache(
        { success: false, error: "Nomor versi tersebut sudah digunakan pada produk ini." },
        { status: 409 }
      );
    }
    console.error("[PATCH /api/manage/changelog/[id]] Error:", err);
    return jsonNoCache(
      { success: false, error: err?.message || "Gagal memperbarui catatan perubahan." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireOwner();
    if ("error" in auth) return auth.error;

    if (!checkRateLimit(auth.discordId, "manage-changelog-delete", 1000)) {
      return jsonNoCache(
        { success: false, error: "Terlalu cepat. Mohon tunggu sebentar." },
        { status: 429 }
      );
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return jsonNoCache({ success: false, error: "ID changelog tidak valid." }, { status: 400 });
    }

    await dbConnect();
    const deleted = await ChangelogEntry.findByIdAndDelete(id).lean();
    if (!deleted) {
      return jsonNoCache(
        { success: false, error: "Catatan perubahan tidak ditemukan." },
        { status: 404 }
      );
    }

    try {
      revalidatePath("/changelog");
      revalidatePath("/");
    } catch {
      // Non-fatal
    }

    return jsonNoCache({
      success: true,
      message: `Catatan perubahan v${deleted.version} telah dihapus.`,
    });
  } catch (err: any) {
    console.error("[DELETE /api/manage/changelog/[id]] Error:", err);
    return jsonNoCache(
      { success: false, error: err?.message || "Gagal menghapus catatan perubahan." },
      { status: 500 }
    );
  }
}
