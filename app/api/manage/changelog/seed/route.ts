import { getServerSession } from "next-auth/next";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongoose";
import { isWebOwner } from "@/lib/webConfig";
import { jsonNoCache } from "@/lib/antiCache";
import { checkRateLimit } from "@/lib/rateLimit";
import ChangelogEntry from "@/lib/models/ChangelogEntry";
import { INITIAL_CHANGELOG_SEEDS } from "@/lib/changelog";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.discordId) {
      return jsonNoCache({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const discordId = String(session.user.discordId);
    const allowed = await isWebOwner(discordId);
    if (!allowed) {
      return jsonNoCache(
        { success: false, error: "Akses ditolak. Fitur ini khusus Web Owner." },
        { status: 403 }
      );
    }

    if (!checkRateLimit(discordId, "manage-changelog-seed", 3000)) {
      return jsonNoCache(
        { success: false, error: "Mohon tunggu sebentar sebelum menjalankan impor lagi." },
        { status: 429 }
      );
    }

    await dbConnect();

    const ops = INITIAL_CHANGELOG_SEEDS.map((seed) => {
      const releaseDate = new Date(seed.releaseDate);
      return {
        updateOne: {
          filter: { product: seed.product, version: seed.version },
          update: {
            $setOnInsert: {
              product: seed.product,
              version: seed.version,
              title: seed.title,
              summary: seed.summary,
              releaseDate,
              status: seed.status,
              sections: seed.sections,
              articleUrl: null,
              highlightFeatureUrl: seed.highlightFeatureUrl || null,
              highlightFeatureLabel: seed.highlightFeatureLabel || null,
              authorDiscordId: discordId,
              updatedByDiscordId: discordId,
              publishedAt: seed.status === "published" ? releaseDate : null,
            },
          },
          upsert: true,
        },
      };
    });

    const bulkRes = await ChangelogEntry.bulkWrite(ops, { ordered: false });
    const insertedCount = bulkRes.upsertedCount || 0;
    const skippedCount = INITIAL_CHANGELOG_SEEDS.length - insertedCount;

    try {
      revalidatePath("/changelog");
      revalidatePath("/");
    } catch {
      // Non-fatal
    }

    return jsonNoCache({
      success: true,
      insertedCount,
      skippedCount,
      totalSeeds: INITIAL_CHANGELOG_SEEDS.length,
      message:
        insertedCount > 0
          ? `Berhasil mengimpor ${insertedCount} riwayat versi awal (${skippedCount} versi sudah ada dan tidak ditimpa).`
          : "Seluruh riwayat awal sudah ada di database (tidak ada data yang ditimpa).",
    });
  } catch (err: any) {
    console.error("[POST /api/manage/changelog/seed] Error:", err);
    return jsonNoCache(
      { success: false, error: err?.message || "Gagal mengimpor riwayat changelog awal." },
      { status: 500 }
    );
  }
}
