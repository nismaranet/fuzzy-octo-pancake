import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import clientPromise from "@/lib/mongodb";
import dbConnect from "@/lib/mongoose";
import { jsonNoCache } from "@/lib/antiCache";
import { checkRateLimit } from "@/lib/rateLimit";
import CommunityMarketListing from "@/lib/models/CommunityMarketListing";
import CommunityMarketReview from "@/lib/models/CommunityMarketReview";
import UserVoucher from "@/lib/models/UserVoucher";
import { getCommunityMarketConfig } from "@/lib/communityMarketConfig";
import {
  sweepExpiredCommunityMarketItems,
  getEnrichedMarketUsersMap,
  getMarketPriceGuideMap,
} from "@/lib/communityMarket";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await dbConnect();
    await sweepExpiredCommunityMarketItems();

    const query = mongoose.Types.ObjectId.isValid(id)
      ? { $or: [{ _id: id }, { slug: id }] }
      : { slug: id };

    const listing = await CommunityMarketListing.findOne(query).lean();
    if (!listing) {
      return jsonNoCache({ success: false, error: "Listing tidak ditemukan." }, { status: 404 });
    }

    const [config, priceGuide, reviewsRaw] = await Promise.all([
      getCommunityMarketConfig(),
      getMarketPriceGuideMap(),
      CommunityMarketReview.find({ sellerDiscordId: listing.sellerDiscordId })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
    ]);

    const userIds = [
      String(listing.sellerDiscordId),
      ...reviewsRaw.map((r) => String(r.buyerDiscordId)),
    ];
    const usersMap = await getEnrichedMarketUsersMap(userIds);

    const reviews = reviewsRaw.map((r) => ({
      ...r,
      _id: String(r._id),
      tradeId: String(r.tradeId),
      buyer: usersMap[String(r.buyerDiscordId)] || null,
    }));

    return jsonNoCache({
      success: true,
      listing: {
        ...listing,
        _id: String(listing._id),
        sellerId: String(listing.sellerId),
        itemRefId: listing.itemRefId ? String(listing.itemRefId) : null,
        seller: usersMap[String(listing.sellerDiscordId)] || null,
      },
      sellerReviews: reviews,
      priceGuide: priceGuide[listing.itemSnapshot.category] || null,
      config,
    });
  } catch (err: any) {
    console.error("[CM GET Listing Detail] Error:", err);
    return jsonNoCache(
      { success: false, error: err?.message || "Gagal memuat detail listing." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.discordId) {
      return jsonNoCache({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const discordId = String(session.user.discordId);
    if (!checkRateLimit(discordId, "cm-cancel-listing", 1500)) {
      return jsonNoCache(
        { success: false, error: "Terlalu banyak permintaan. Tunggu sebentar." },
        { status: 429 }
      );
    }

    const { id } = await params;
    await dbConnect();

    const filter: any = {
      status: "active",
      sellerDiscordId: discordId,
    };
    if (mongoose.Types.ObjectId.isValid(id)) {
      filter._id = id;
    } else {
      filter.slug = id;
    }

    // Atomic Lock: active -> cancelled
    const locked = await CommunityMarketListing.findOneAndUpdate(
      filter,
      { $set: { status: "cancelled", cancelledAt: new Date() } },
      { returnDocument: "after" }
    );

    if (!locked) {
      return jsonNoCache(
        {
          success: false,
          error: "Iklan tidak ditemukan, sudah terjual, atau sudah dibatalkan.",
        },
        { status: 404 }
      );
    }

    const client = await clientPromise;
    const db = client.db();

    if (locked.itemType === "VOUCHER" && locked.itemRefId) {
      const voucher = await UserVoucher.findById(locked.itemRefId);
      if (voucher && voucher.status === "LISTED") {
        const isPast =
          voucher.expiresAt && new Date(voucher.expiresAt).getTime() <= Date.now();
        voucher.status = isPast ? "EXPIRED" : "ACTIVE";
        await voucher.save();
      }
    } else if (locked.itemType === "PENALTY_TICKET" && locked.remainingQuantity > 0) {
      await db.collection("garages").updateOne(
        { discordId },
        { $inc: { safeboxStock: locked.remainingQuantity } }
      );
    }

    try {
      revalidatePath("/community-market");
      revalidatePath(`/community-market/${locked.slug}`);
      revalidatePath("/dashboard/vouchers");
      revalidatePath("/dashboard/garage");
    } catch {
      // Non-fatal
    }

    return jsonNoCache({
      success: true,
      message:
        "Iklan berhasil dibatalkan dan sisa item dikembalikan ke inventaris Anda. (Biaya jasa pasang iklan tidak dikembalikan).",
    });
  } catch (err: any) {
    console.error("[CM DELETE Listing] Error:", err);
    return jsonNoCache(
      { success: false, error: err?.message || "Gagal membatalkan iklan." },
      { status: 500 }
    );
  }
}
