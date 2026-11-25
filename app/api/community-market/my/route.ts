import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import clientPromise from "@/lib/mongodb";
import dbConnect from "@/lib/mongoose";
import { jsonNoCache } from "@/lib/antiCache";
import CommunityMarketListing from "@/lib/models/CommunityMarketListing";
import CommunityMarketBuyOrder from "@/lib/models/CommunityMarketBuyOrder";
import CommunityMarketTrade from "@/lib/models/CommunityMarketTrade";
import UserVoucher from "@/lib/models/UserVoucher";
import { isVoucherTradable } from "@/lib/voucher";
import {
  getCommunityMarketConfig,
  calculateSafeboxCapacity,
  isUserFreeListingEligible,
  getMaxAllowedVoucherListingDuration,
} from "@/lib/communityMarketConfig";
import {
  GUILD_ID,
  sweepExpiredCommunityMarketItems,
  getEnrichedMarketUsersMap,
  getMarketPriceGuideMap,
  getUserListedSafeboxTickets,
  getUserPendingBuyOrderTickets,
} from "@/lib/communityMarket";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.discordId) {
      return jsonNoCache({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const discordId = String(session.user.discordId);
    await dbConnect();
    await sweepExpiredCommunityMarketItems();

    const client = await clientPromise;
    const db = client.db();

    // Auto-expire user's own vouchers
    await UserVoucher.updateMany(
      {
        discordId,
        status: "ACTIVE",
        expiresAt: { $ne: null, $lt: new Date() },
      },
      { $set: { status: "EXPIRED" } }
    );

    const [
      config,
      userDoc,
      currencyDoc,
      garageDoc,
      activeVouchersRaw,
      myListingsRaw,
      myBuyOrdersRaw,
      myTradesRaw,
      listedSafeboxTickets,
      pendingBuyOrderTickets,
      priceGuide,
    ] = await Promise.all([
      getCommunityMarketConfig(),
      db.collection("users").findOne({ discordId }),
      db.collection("currencies").findOne({ userId: discordId, guildId: GUILD_ID }),
      db.collection("garages").findOne({ discordId }),
      UserVoucher.find({ discordId, status: "ACTIVE" }).sort({ expiresAt: 1, createdAt: -1 }).lean(),
      CommunityMarketListing.find({ sellerDiscordId: discordId }).sort({ createdAt: -1 }).limit(50).lean(),
      CommunityMarketBuyOrder.find({ buyerDiscordId: discordId }).sort({ createdAt: -1 }).limit(50).lean(),
      CommunityMarketTrade.find({
        $or: [{ sellerDiscordId: discordId }, { buyerDiscordId: discordId }],
      })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      getUserListedSafeboxTickets(discordId),
      getUserPendingBuyOrderTickets(discordId),
      getMarketPriceGuideMap(),
    ]);

    const counterpartyIds = myTradesRaw.flatMap((t) => [
      String(t.sellerDiscordId),
      String(t.buyerDiscordId),
    ]);
    const usersMap = await getEnrichedMarketUsersMap(counterpartyIds);

    const nowMs = Date.now();
    const tradableVouchers = activeVouchersRaw
      .filter((v) => isVoucherTradable(v))
      .map((v) => {
        const durCheck = getMaxAllowedVoucherListingDuration(
          v.expiresAt,
          config.minVoucherRemainingHours,
          nowMs
        );
        return {
          ...v,
          _id: String(v._id),
          userId: String(v.userId),
          canListNow: durCheck.canList,
          availableDurations: durCheck.availableDurations,
        };
      });

    const freeListing = isUserFreeListingEligible(config, userDoc as any);

    const safeboxLevel = Number(garageDoc?.safeboxLevel || 1);
    const safeboxCapacity = calculateSafeboxCapacity(safeboxLevel);
    const safeboxStock = Number(garageDoc?.safeboxStock || 0);

    return jsonNoCache({
      success: true,
      balance: Number(currencyDoc?.totalNC || 0),
      freeListing,
      garage: {
        exists: Boolean(garageDoc),
        status: garageDoc?.status || "missing",
        safeboxLevel,
        safeboxStock,
        safeboxCapacity,
        listedSafeboxTickets,
        pendingBuyOrderTickets,
      },
      tradableVouchers,
      myListings: myListingsRaw.map((l) => ({
        ...l,
        _id: String(l._id),
        sellerId: String(l.sellerId),
        itemRefId: l.itemRefId ? String(l.itemRefId) : null,
      })),
      myBuyOrders: myBuyOrdersRaw.map((o) => ({
        ...o,
        _id: String(o._id),
        buyerId: String(o.buyerId),
      })),
      myTrades: myTradesRaw.map((t) => ({
        ...t,
        _id: String(t._id),
        listingId: t.listingId ? String(t.listingId) : null,
        buyOrderId: t.buyOrderId ? String(t.buyOrderId) : null,
        direction: String(t.buyerDiscordId) === discordId ? "BUY" : "SELL",
        seller: usersMap[String(t.sellerDiscordId)] || null,
        buyer: usersMap[String(t.buyerDiscordId)] || null,
      })),
      priceGuide,
      config,
    });
  } catch (err: any) {
    console.error("[CM GET My] Error:", err);
    return jsonNoCache(
      { success: false, error: err?.message || "Gagal memuat data Community Market Anda." },
      { status: 500 }
    );
  }
}
