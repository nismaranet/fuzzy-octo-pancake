import { NextRequest } from "next/server";
import dbConnect from "@/lib/mongoose";
import { jsonNoCache } from "@/lib/antiCache";
import ChangelogEntry from "@/lib/models/ChangelogEntry";
import {
  isValidChangelogProduct,
  sortChangelogEntriesDesc,
  type SerializedChangelogEntry,
} from "@/lib/changelog";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const productParam = searchParams.get("product");

    const filter: Record<string, any> = { status: "published" };
    if (productParam && productParam !== "all") {
      if (!isValidChangelogProduct(productParam)) {
        return jsonNoCache(
          { success: false, error: "Kategori produk tidak valid." },
          { status: 400 }
        );
      }
      filter.product = productParam;
    }

    const docs = await ChangelogEntry.find(filter)
      .sort({ releaseDate: -1, createdAt: -1 })
      .lean();

    const entries: SerializedChangelogEntry[] = sortChangelogEntriesDesc(
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
      }))
    );

    return jsonNoCache({ success: true, entries });
  } catch (err: any) {
    console.error("[GET /api/changelog] Error:", err);
    return jsonNoCache(
      { success: false, error: "Gagal memuat catatan perubahan." },
      { status: 500 }
    );
  }
}
