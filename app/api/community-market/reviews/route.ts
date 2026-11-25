import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import dbConnect from "@/lib/mongoose";
import { jsonNoCache } from "@/lib/antiCache";
import { checkRateLimit } from "@/lib/rateLimit";
import CommunityMarketTrade from "@/lib/models/CommunityMarketTrade";
import CommunityMarketReview, {
  COMMUNITY_MARKET_REVIEW_TAGS,
} from "@/lib/models/CommunityMarketReview";
import Notification from "@/lib/models/Notification";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.discordId) {
      return jsonNoCache({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const buyerDiscordId = String(session.user.discordId);
    if (!checkRateLimit(buyerDiscordId, "cm-submit-review", 2000)) {
      return jsonNoCache(
        { success: false, error: "Terlalu banyak permintaan. Tunggu sebentar." },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const tradeId = String(body.tradeId || "");
    const rating = Math.round(Number(body.rating));
    const rawTags = Array.isArray(body.tags) ? body.tags : [];
    const comment = String(body.comment || "").trim().slice(0, 200);

    if (!mongoose.Types.ObjectId.isValid(tradeId)) {
      return jsonNoCache({ success: false, error: "ID Transaksi tidak valid." }, { status: 400 });
    }
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return jsonNoCache(
        { success: false, error: "Rating harus antara 1 hingga 5 bintang." },
        { status: 400 }
      );
    }

    const allowedSet = new Set<string>(COMMUNITY_MARKET_REVIEW_TAGS);
    const validTags = rawTags
      .map((t: any) => String(t))
      .filter((t: string) => allowedSet.has(t))
      .slice(0, 4);

    await dbConnect();

    // Atomic Gate: pastikan transaksi valid milik pembeli & belum pernah diberi rating
    const lockedTrade = await CommunityMarketTrade.findOneAndUpdate(
      {
        _id: tradeId,
        buyerDiscordId,
        isRated: false,
      },
      { $set: { isRated: true } },
      { returnDocument: "after" }
    );

    if (!lockedTrade) {
      return jsonNoCache(
        {
          success: false,
          error: "Transaksi tidak ditemukan atau Anda sudah memberikan ulasan untuk transaksi ini.",
        },
        { status: 400 }
      );
    }

    const review = await CommunityMarketReview.create({
      tradeId: lockedTrade._id,
      sellerDiscordId: lockedTrade.sellerDiscordId,
      buyerDiscordId,
      rating,
      tags: validTags,
      comment,
    });

    try {
      await Notification.create({
        recipient: lockedTrade.sellerDiscordId,
        title: `Ulasan Baru Community Market (${rating}★)`,
        message: `Pembeli memberikan rating ${rating}/5 bintang untuk transaksi ${lockedTrade.itemSnapshot.title}.${comment ? ` "${comment}"` : ""}`,
        type: "info",
        link: "/community-market",
      });
    } catch {
      // Non-fatal
    }

    try {
      revalidatePath("/community-market");
    } catch {
      // Non-fatal
    }

    return jsonNoCache({
      success: true,
      message: "Terima kasih! Ulasan Anda berhasil disimpan.",
      review: {
        ...review.toObject(),
        _id: String(review._id),
      },
    });
  } catch (err: any) {
    console.error("[CM Review] Error:", err);
    return jsonNoCache(
      { success: false, error: err?.message || "Gagal menyimpan ulasan." },
      { status: 500 }
    );
  }
}
