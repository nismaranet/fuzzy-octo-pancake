import React from "react";
import clientPromise from "@/lib/mongodb";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import GiveawayPublicDetailClient from "./GiveawayPublicDetailClient";

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
    return { title: "Giveaway Not Found - Nismara Transport" };
  }

  return {
    title: `${giveaway.title} - Nismara Transport`,
    description: giveaway.description || "Event giveaway resmi Nismara Logistics.",
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
    quests: giveawayDoc.quests || [],
    enableNcPurchase: Boolean(giveawayDoc.enableNcPurchase),
    ticketPriceNC: giveawayDoc.ticketPriceNC || 1000,
    maxPurchasableTickets: giveawayDoc.maxPurchasableTickets ?? 5,
    prizes: giveawayDoc.prizes || [],
    winners: giveawayDoc.winners || [],
    stats: giveawayDoc.stats || { totalTickets: 0, totalParticipants: 0, totalNcBurned: 0 },
  };

  return <GiveawayPublicDetailClient giveaway={serialized} />;
}
