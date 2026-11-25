import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import clientPromise from "@/lib/mongodb";
import dbConnect from "@/lib/mongoose";
import { jsonNoCache } from "@/lib/antiCache";
import { checkRateLimit } from "@/lib/rateLimit";
import CommunityMarketBuyOrder from "@/lib/models/CommunityMarketBuyOrder";
import { getCommunityMarketConfig } from "@/lib/communityMarketConfig";
import {
  GUILD_ID,
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

    const order = await CommunityMarketBuyOrder.findOne(query).lean();
    if (!order) {
      return jsonNoCache({ success: false, error: "Buy Order tidak ditemukan." }, { status: 404 });
    }

    const [config, priceGuide, usersMap] = await Promise.all([
      getCommunityMarketConfig(),
      getMarketPriceGuideMap(),
      getEnrichedMarketUsersMap([String(order.buyerDiscordId)]),
    ]);

    const guideKey =
      order.itemType === "PENALTY_TICKET"
        ? "PENALTY_TICKET"
        : order.criteria?.category || "FLEET_MAINTENANCE";

    return jsonNoCache({
      success: true,
      buyOrder: {
        ...order,
        _id: String(order._id),
        buyerId: String(order.buyerId),
        buyer: usersMap[String(order.buyerDiscordId)] || null,
      },
      priceGuide: priceGuide[guideKey] || null,
      config,
    });
  } catch (err: any) {
    console.error("[CM GET BuyOrder Detail] Error:", err);
    return jsonNoCache(
      { success: false, error: err?.message || "Gagal memuat detail Buy Order." },
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

    const buyerDiscordId = String(session.user.discordId);
    if (!checkRateLimit(buyerDiscordId, "cm-cancel-buy-order", 1500)) {
      return jsonNoCache(
        { success: false, error: "Terlalu banyak permintaan. Tunggu sebentar." },
        { status: 429 }
      );
    }

    const { id } = await params;
    await dbConnect();

    const filter: any = {
      status: "active",
      buyerDiscordId,
    };
    if (mongoose.Types.ObjectId.isValid(id)) {
      filter._id = id;
    } else {
      filter.slug = id;
    }

    // Atomic Lock: active -> cancelled
    const locked = await CommunityMarketBuyOrder.findOneAndUpdate(
      filter,
      { $set: { status: "cancelled", cancelledAt: new Date(), escrowRemaining: 0 } },
      { returnDocument: "before" }
    );

    if (!locked) {
      return jsonNoCache(
        {
          success: false,
          error: "Buy Order tidak ditemukan, sudah terpenuhi, atau sudah dibatalkan.",
        },
        { status: 404 }
      );
    }

    const refundAmount = Number(locked.escrowRemaining || 0);
    if (refundAmount > 0) {
      const client = await clientPromise;
      const db = client.db();
      const now = new Date();

      await db.collection("currencies").updateOne(
        { userId: buyerDiscordId, guildId: locked.guildId || GUILD_ID },
        {
          $inc: { totalNC: refundAmount },
          $setOnInsert: { createdAt: now },
        },
        { upsert: true }
      );

      await db.collection("currencyhistories").insertOne({
        userId: buyerDiscordId,
        guildId: locked.guildId || GUILD_ID,
        amount: refundAmount,
        type: "earn",
        reason: `Pengembalian Escrow Pembatalan Buy Order: ${locked.title}`,
        createdAt: now,
      });
    }

    try {
      revalidatePath("/community-market");
      revalidatePath(`/community-market/${locked.slug}`);
      revalidatePath("/dashboard/currency");
    } catch {
      // Non-fatal
    }

    return jsonNoCache({
      success: true,
      message: `Buy Order dibatalkan. Dana escrow sebesar ${refundAmount.toLocaleString("id-ID")} NC telah dikembalikan 100% ke dompet Anda. (Biaya jasa pasang iklan tidak dikembalikan).`,
      refundAmount,
    });
  } catch (err: any) {
    console.error("[CM DELETE BuyOrder] Error:", err);
    return jsonNoCache(
      { success: false, error: err?.message || "Gagal membatalkan Buy Order." },
      { status: 500 }
    );
  }
}
