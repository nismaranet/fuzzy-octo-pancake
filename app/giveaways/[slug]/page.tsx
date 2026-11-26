import React from "react";
import clientPromise from "@/lib/mongodb";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import GiveawayPublicDetailClient from "./GiveawayPublicDetailClient";
import { resolveQuestDescription } from "@/lib/giveawayUtils";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const client = await clientPromise;
  const db = client.db();

  const giveaway = await db.collection("giveaways").findOne({ slug });
  if (!giveaway) {
    return { title: "Giveaway Tidak Ditemukan" };
  }

  const title = `${giveaway.title}`;
  const description = giveaway.description || "Event giveaway resmi Nismara Transport.";
  const banner = giveaway.bannerUrl || "https://images.nismara.my.id/227300_188.jpg";
  const pageUrl = `https://transport.nismara.web.id/giveaways/${slug}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: pageUrl,
      siteName: "Nismara Transport",
      locale: "id_ID",
      type: "website",
      images: [
        {
          url: banner,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [banner],
    },
  };
}

export default async function GiveawayPublicDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const client = await clientPromise;
  const db = client.db();

  const giveawayDoc = await db.collection("giveaways").findOne({ slug });
  if (!giveawayDoc) {
    notFound();
  }

  const rawWinners = Array.isArray(giveawayDoc.winners) ? giveawayDoc.winners : [];
  const winnerDiscordIds = Array.from(
    new Set(rawWinners.map((w: any) => w?.discordId).filter(Boolean).map(String)),
  );
  const winnerUsers =
    winnerDiscordIds.length > 0
      ? await db
          .collection("users")
          .find(
            { discordId: { $in: winnerDiscordIds } },
            {
              projection: {
                discordId: 1,
                truckyId: 1,
                image: 1,
                avatarDecoration: 1,
                nismaraplus: 1,
                discordRole: 1,
                role: 1,
                topManager: 1,
              },
            },
          )
          .toArray()
      : [];
  const winnerUserMap = new Map(
    winnerUsers.map((u: any) => [String(u.discordId), u]),
  );

  const enrichedWinners = rawWinners.map((w: any) => {
    const u = w?.discordId ? winnerUserMap.get(String(w.discordId)) : null;
    return {
      ...w,
      avatarUrl: u?.image || w.avatarUrl || null,
      truckyId: u?.truckyId || w.truckyId || null,
      avatarDecoration: u?.avatarDecoration || null,
      isNismaraPlus: u?.nismaraplus?.status === true,
      userRole: u?.discordRole || u?.role || null,
      topManager: u?.topManager || null,
    };
  });

  const serialized = {
    _id: giveawayDoc._id.toString(),
    title: giveawayDoc.title,
    slug: giveawayDoc.slug,
    description: giveawayDoc.description,
    bannerUrl: giveawayDoc.bannerUrl,
    startDate: giveawayDoc.startDate ? new Date(giveawayDoc.startDate).toISOString() : null,
    endDate: giveawayDoc.endDate ? new Date(giveawayDoc.endDate).toISOString() : null,
    drawDate: giveawayDoc.drawDate ? new Date(giveawayDoc.drawDate).toISOString() : null,
    status: giveawayDoc.status,
    allowMultipleWins: Boolean(giveawayDoc.allowMultipleWins),
    enableQuests: Boolean(giveawayDoc.enableQuests),
    quests: (giveawayDoc.quests || []).map((q: any) => ({
      ...q,
      description: resolveQuestDescription(q),
    })),
    enableNcPurchase: Boolean(giveawayDoc.enableNcPurchase),
    ticketPriceNC: giveawayDoc.ticketPriceNC || 1000,
    maxPurchasableTickets: giveawayDoc.maxPurchasableTickets ?? 5,
    prizes: giveawayDoc.prizes || [],
    winners: enrichedWinners,
    stats: giveawayDoc.stats || { totalTickets: 0, totalParticipants: 0, totalNcBurned: 0 },
  };

  return <GiveawayPublicDetailClient giveaway={serialized} />;
}
