import { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { revalidatePath } from "next/cache";
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
  sortChangelogEntriesDesc,
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

export async function GET(req: NextRequest) {
  try {
    const auth = await requireOwner();
    if ("error" in auth) return auth.error;

    await dbConnect();
    const { searchParams } = new URL(req.url);
    const product = searchParams.get("product") || "all";
    const status = searchParams.get("status") || "all";
    const q = (searchParams.get("q") || "").trim();

    const filter: Record<string, any> = {};
    if (product !== "all" && isValidChangelogProduct(product)) {
      filter.product = product;
    }
    if (status === "draft" || status === "published") {
      filter.status = status;
    }
    if (q) {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");
      filter.$or = [{ version: regex }, { title: regex }, { summary: regex }];
    }

    const docs = await ChangelogEntry.find(filter)
      .sort({ releaseDate: -1, createdAt: -1 })
      .lean();

    const entries = sortChangelogEntriesDesc(
      docs.map((doc) => ({
        _id: String(doc._id),
        product: doc.product,
        version: doc.version,
        title: doc.title,
        summary: doc.summary,
        releaseDate: new Date(doc.releaseDate).toISOString(),
        status: doc.status,
        sections: {
          added: Array.isArray(doc.sections?.added) ? doc.sections.added : [],
          improved: Array.isArray(doc.sections?.improved) ? doc.sections.improved : [],
          fixed: Array.isArray(doc.sections?.fixed) ? doc.sections.fixed : [],
        },
        articleUrl: doc.articleUrl || null,
        highlightFeatureUrl: doc.highlightFeatureUrl || null,
        highlightFeatureLabel: doc.highlightFeatureLabel || null,
        publishedAt: doc.publishedAt ? new Date(doc.publishedAt).toISOString() : null,
        createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : undefined,
        updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : undefined,
      }))
    );

    return jsonNoCache({ success: true, entries });
  } catch (err: any) {
    console.error("[GET /api/manage/changelog] Error:", err);
    return jsonNoCache(
      { success: false, error: err?.message || "Gagal memuat data changelog." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireOwner();
    if ("error" in auth) return auth.error;

    if (!checkRateLimit(auth.discordId, "manage-changelog-create", 1200)) {
      return jsonNoCache(
        { success: false, error: "Terlalu cepat. Mohon tunggu sebentar." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const product = body?.product;
    if (!isValidChangelogProduct(product)) {
      return jsonNoCache(
        { success: false, error: "Produk wajib dipilih (Web Transport, Bot Natasya, atau Nismara Tracker)." },
        { status: 400 }
      );
    }

    const version = normalizeVersion(body?.version);
    if (!isValidVersionFormat(version)) {
      return jsonNoCache(
        { success: false, error: "Format versi tidak valid. Gunakan format seperti 1.5.2 atau 1.6.0-beta.1." },
        { status: 400 }
      );
    }

    const title = String(body?.title || "").trim();
    const summary = String(body?.summary || "").trim();
    if (!title || title.length > 160) {
      return jsonNoCache(
        { success: false, error: "Judul rilis wajib diisi (maksimal 160 karakter)." },
        { status: 400 }
      );
    }
    if (!summary || summary.length > 800) {
      return jsonNoCache(
        { success: false, error: "Ringkasan rilis wajib diisi (maksimal 800 karakter)." },
        { status: 400 }
      );
    }

    const added = sanitizeStringArray(body?.sections?.added);
    const improved = sanitizeStringArray(body?.sections?.improved);
    const fixed = sanitizeStringArray(body?.sections?.fixed);
    if (added.length + improved.length + fixed.length === 0) {
      return jsonNoCache(
        { success: false, error: "Tambahkan minimal 1 poin pada Fitur Baru, Peningkatan, atau Perbaikan." },
        { status: 400 }
      );
    }

    let releaseDate: Date;
    try {
      releaseDate = body?.releaseDate ? parseWIBDate(body.releaseDate) : new Date();
    } catch (e: any) {
      return jsonNoCache(
        { success: false, error: e?.message || "Format tanggal rilis tidak valid." },
        { status: 400 }
      );
    }

    let articleUrl: string | null = null;
    let highlightFeatureUrl: string | null = null;
    try {
      articleUrl = sanitizeOptionalUrl(body?.articleUrl);
      highlightFeatureUrl = sanitizeOptionalUrl(body?.highlightFeatureUrl);
    } catch (e: any) {
      return jsonNoCache({ success: false, error: e.message }, { status: 400 });
    }
    const highlightFeatureLabel =
      highlightFeatureUrl && typeof body?.highlightFeatureLabel === "string"
        ? body.highlightFeatureLabel.trim().slice(0, 80) || null
        : null;

    const status = body?.status === "published" ? "published" : "draft";

    await dbConnect();

    const created = await ChangelogEntry.create({
      product,
      version,
      title,
      summary,
      releaseDate,
      status,
      sections: { added, improved, fixed },
      articleUrl,
      highlightFeatureUrl,
      highlightFeatureLabel,
      authorDiscordId: auth.discordId,
      updatedByDiscordId: auth.discordId,
      publishedAt: status === "published" ? new Date() : null,
    });

    try {
      revalidatePath("/changelog");
      revalidatePath("/");
    } catch {
      // Non-fatal
    }

    return jsonNoCache(
      {
        success: true,
        message: `Catatan perubahan v${version} berhasil disimpan.`,
        entry: {
          _id: String(created._id),
          product: created.product,
          version: created.version,
          title: created.title,
          summary: created.summary,
          releaseDate: created.releaseDate.toISOString(),
          status: created.status,
          sections: created.sections,
          articleUrl: created.articleUrl || null,
          highlightFeatureUrl: created.highlightFeatureUrl || null,
          highlightFeatureLabel: created.highlightFeatureLabel || null,
          publishedAt: created.publishedAt ? created.publishedAt.toISOString() : null,
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    if (err?.code === 11000) {
      return jsonNoCache(
        { success: false, error: "Nomor versi tersebut sudah terdaftar untuk produk ini." },
        { status: 409 }
      );
    }
    console.error("[POST /api/manage/changelog] Error:", err);
    return jsonNoCache(
      { success: false, error: err?.message || "Gagal menyimpan catatan perubahan." },
      { status: 500 }
    );
  }
}
