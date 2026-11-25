import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongoose";
import CommunityMarketListing from "@/lib/models/CommunityMarketListing";
import CommunityMarketBuyOrder from "@/lib/models/CommunityMarketBuyOrder";
import CommunityMarketReview from "@/lib/models/CommunityMarketReview";
import {
  getCommunityMarketConfig,
  formatNCWhole,
} from "@/lib/communityMarketConfig";
import {
  sweepExpiredCommunityMarketItems,
  getEnrichedMarketUsersMap,
  getMarketPriceGuideMap,
} from "@/lib/communityMarket";
import CommunityMarketDetailClient from "@/components/community-market/CommunityMarketDetailClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  await dbConnect();

  const listing = await CommunityMarketListing.findOne({ slug }).lean();
  if (listing) {
    const title = `${listing.itemSnapshot.title} (${formatNCWhole(listing.unitPrice)})`;
    const description =
      listing.itemSnapshot.description ||
      `Dijual di Community Market Nismara Transport seharga ${formatNCWhole(listing.unitPrice)}.`;
    const url = `https://transport.nismara.web.id/community-market/${slug}`;
    const img = "https://images.nismara.my.id/227300_188.jpg";
    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url,
        siteName: "Nismara Transport",
        locale: "id_ID",
        type: "website",
        images: [{ url: img, width: 1200, height: 630, alt: title }],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [img],
      },
    };
  }

  const buyOrder = await CommunityMarketBuyOrder.findOne({ slug }).lean();
  if (buyOrder) {
    const title = `${buyOrder.title} — Tawaran ${formatNCWhole(buyOrder.offerPrice)}`;
    const description =
      buyOrder.notes ||
      `Buy Order aktif di Community Market dengan jaminan Escrow ${formatNCWhole(buyOrder.offerPrice)} per unit.`;
    const url = `https://transport.nismara.web.id/community-market/${slug}`;
    const img = "https://images.nismara.my.id/227300_188.jpg";
    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url,
        siteName: "Nismara Transport",
        locale: "id_ID",
        type: "website",
        images: [{ url: img, width: 1200, height: 630, alt: title }],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [img],
      },
    };
  }

  return {
    title: "Item Community Market Tidak Ditemukan",
  };
}

export default async function CommunityMarketDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const session = await getServerSession(authOptions);
  await dbConnect();
  await sweepExpiredCommunityMarketItems();

  const [config, priceGuideMap] = await Promise.all([
    getCommunityMarketConfig(),
    getMarketPriceGuideMap(),
  ]);

  const listing = await CommunityMarketListing.findOne({ slug }).lean();
  if (listing) {
    const reviewsRaw = await CommunityMarketReview.find({
      sellerDiscordId: listing.sellerDiscordId,
    })
      .sort({ createdAt: -1 })
      .limit(12)
      .lean();

    const userIds = [
      String(listing.sellerDiscordId),
      ...reviewsRaw.map((r) => String(r.buyerDiscordId)),
    ];
    const usersMap = await getEnrichedMarketUsersMap(userIds);
    const nowMs = Date.now();
    const vExp = listing.itemSnapshot?.expiresAt
      ? new Date(listing.itemSnapshot.expiresAt).getTime()
      : null;

    const record = JSON.parse(
      JSON.stringify({
        ...listing,
        _id: String(listing._id),
        sellerId: String(listing.sellerId),
        itemRefId: listing.itemRefId ? String(listing.itemRefId) : null,
        isFlashDeal: Boolean(
          listing.itemType === "VOUCHER" &&
            vExp &&
            vExp > nowMs &&
            vExp - nowMs <= config.flashDealThresholdHours * 3600 * 1000
        ),
        seller: usersMap[String(listing.sellerDiscordId)] || null,
      })
    );

    const sellerReviews = JSON.parse(
      JSON.stringify(
        reviewsRaw.map((r) => ({
          ...r,
          _id: String(r._id),
          tradeId: String(r.tradeId),
          buyer: usersMap[String(r.buyerDiscordId)] || null,
        }))
      )
    );

    return (
      <CommunityMarketDetailClient
        kind="listing"
        record={record}
        sellerReviews={sellerReviews}
        priceGuide={priceGuideMap[listing.itemSnapshot.category] || null}
        config={config}
        currentUser={
          session?.user?.discordId
            ? {
                discordId: String(session.user.discordId),
                isDriver: Boolean(session.user.isDriver),
              }
            : null
        }
      />
    );
  }

  const buyOrder = await CommunityMarketBuyOrder.findOne({ slug }).lean();
  if (buyOrder) {
    const usersMap = await getEnrichedMarketUsersMap([String(buyOrder.buyerDiscordId)]);
    const record = JSON.parse(
      JSON.stringify({
        ...buyOrder,
        _id: String(buyOrder._id),
        buyerId: String(buyOrder.buyerId),
        buyer: usersMap[String(buyOrder.buyerDiscordId)] || null,
      })
    );
    const guideKey =
      buyOrder.itemType === "PENALTY_TICKET"
        ? "PENALTY_TICKET"
        : buyOrder.criteria?.category || "FLEET_MAINTENANCE";

    return (
      <CommunityMarketDetailClient
        kind="buy_order"
        record={record}
        sellerReviews={[]}
        priceGuide={priceGuideMap[guideKey] || null}
        config={config}
        currentUser={
          session?.user?.discordId
            ? {
                discordId: String(session.user.discordId),
                isDriver: Boolean(session.user.isDriver),
              }
            : null
        }
      />
    );
  }

  notFound();
}
