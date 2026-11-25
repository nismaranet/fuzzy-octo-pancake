import type { Metadata } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongoose";
import CommunityMarketListing from "@/lib/models/CommunityMarketListing";
import CommunityMarketBuyOrder from "@/lib/models/CommunityMarketBuyOrder";
import { getCommunityMarketConfig } from "@/lib/communityMarketConfig";
import {
  sweepExpiredCommunityMarketItems,
  getEnrichedMarketUsersMap,
  getMarketPriceGuideMap,
} from "@/lib/communityMarket";
import CommunityMarketClient from "@/components/community-market/CommunityMarketClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
  title: "Community Market — Bursa P2P Voucher & Tiket",
  description:
    "Jual beli Voucher Driver, Tiket Penghapus Penalti, dan pasang Buy Order dengan jaminan Escrow NC antar-driver Nismara Transport.",
  openGraph: {
    title: "Community Market — Bursa P2P Voucher & Tiket",
    description:
      "Jual beli Voucher Driver, Tiket Penghapus Penalti, dan pasang Buy Order dengan jaminan Escrow NC antar-driver Nismara Transport.",
    url: "https://transport.nismara.web.id/community-market",
    siteName: "Nismara Transport",
    locale: "id_ID",
    type: "website",
    images: [
      {
        url: "https://images.nismara.my.id/227300_188.jpg",
        width: 1200,
        height: 630,
        alt: "Community Market Nismara Transport",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Community Market — Bursa P2P Voucher & Tiket",
    description:
      "Bursa P2P antar-driver untuk Voucher, Tiket Penghapus Penalti, Flash Deal, dan Buy Order dengan Escrow NC.",
    images: ["https://images.nismara.my.id/227300_188.jpg"],
  },
  keywords: [
    "Nismara Transport",
    "Community Market",
    "Voucher",
    "Tiket Penghapus Penalti",
    "Buy Order",
    "VTC Indonesia",
  ],
};

export default async function CommunityMarketPage() {
  const session = await getServerSession(authOptions);
  await dbConnect();
  await sweepExpiredCommunityMarketItems();

  const config = await getCommunityMarketConfig();
  const now = new Date();
  const flashCutoff = new Date(
    now.getTime() + config.flashDealThresholdHours * 3600 * 1000
  );

  const [
    listingsRaw,
    buyOrdersRaw,
    activeListingsCount,
    activeBuyOrdersCount,
    flashDealCount,
    priceGuide,
  ] = await Promise.all([
    CommunityMarketListing.find({
      status: "active",
      remainingQuantity: { $gt: 0 },
      expiresAt: { $gt: now },
    })
      .sort({ createdAt: -1 })
      .limit(24)
      .lean(),
    CommunityMarketBuyOrder.find({
      status: "active",
      remainingQuantity: { $gt: 0 },
      expiresAt: { $gt: now },
    })
      .sort({ offerPrice: -1, createdAt: -1 })
      .limit(24)
      .lean(),
    CommunityMarketListing.countDocuments({
      status: "active",
      remainingQuantity: { $gt: 0 },
      expiresAt: { $gt: now },
    }),
    CommunityMarketBuyOrder.countDocuments({
      status: "active",
      remainingQuantity: { $gt: 0 },
      expiresAt: { $gt: now },
    }),
    CommunityMarketListing.countDocuments({
      status: "active",
      itemType: "VOUCHER",
      remainingQuantity: { $gt: 0 },
      expiresAt: { $gt: now },
      "itemSnapshot.expiresAt": { $ne: null, $gt: now, $lte: flashCutoff },
    }),
    getMarketPriceGuideMap(),
  ]);

  const userIds = [
    ...listingsRaw.map((l) => String(l.sellerDiscordId)),
    ...buyOrdersRaw.map((o) => String(o.buyerDiscordId)),
  ];
  const usersMap = await getEnrichedMarketUsersMap(userIds);

  const flashThresholdMs = config.flashDealThresholdHours * 3600 * 1000;
  const listings = JSON.parse(
    JSON.stringify(
      listingsRaw.map((l) => {
        const vExp = l.itemSnapshot?.expiresAt
          ? new Date(l.itemSnapshot.expiresAt).getTime()
          : null;
        return {
          ...l,
          _id: String(l._id),
          sellerId: String(l.sellerId),
          itemRefId: l.itemRefId ? String(l.itemRefId) : null,
          isFlashDeal: Boolean(
            l.itemType === "VOUCHER" &&
              vExp &&
              vExp > now.getTime() &&
              vExp - now.getTime() <= flashThresholdMs
          ),
          seller: usersMap[String(l.sellerDiscordId)] || null,
        };
      })
    )
  );

  const buyOrders = JSON.parse(
    JSON.stringify(
      buyOrdersRaw.map((o) => ({
        ...o,
        _id: String(o._id),
        buyerId: String(o.buyerId),
        buyer: usersMap[String(o.buyerDiscordId)] || null,
      }))
    )
  );

  return (
    <CommunityMarketClient
      initialListings={listings}
      initialBuyOrders={buyOrders}
      initialPriceGuide={priceGuide}
      initialConfig={config}
      initialStats={{
        activeListings: activeListingsCount,
        activeBuyOrders: activeBuyOrdersCount,
        flashDealCount,
      }}
      currentUser={
        session?.user?.discordId
          ? {
              discordId: String(session.user.discordId),
              isDriver: Boolean(session.user.isDriver),
              role: session.user.role,
            }
          : null
      }
    />
  );
}
