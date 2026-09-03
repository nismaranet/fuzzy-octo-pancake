import React from "react";
import clientPromise from "@/lib/mongodb";
import { Metadata } from "next";
import GiveawaysIndexClient from "./GiveawaysIndexClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
  title: "Giveaways - Nismara Transport",
  description: "Event undian berhadiah resmi bagi seluruh pengemudi Nismara Logistics.",
};

export default async function GiveawaysPage() {
  const client = await clientPromise;
  const db = client.db();

  const giveaways = await db
    .collection("giveaways")
    .find({
      status: { $in: ["scheduled", "ongoing", "drawing", "completed"] },
    })
    .sort({ createdAt: -1 })
    .toArray();

  const serialized = giveaways.map((g) => ({
    _id: g._id.toString(),
    title: g.title,
    slug: g.slug,
    description: g.description,
    bannerUrl: g.bannerUrl,
    startDate: g.startDate ? new Date(g.startDate).toISOString() : null,
    endDate: g.endDate ? new Date(g.endDate).toISOString() : null,
    drawDate: g.drawDate ? new Date(g.drawDate).toISOString() : null,
    status: g.status,
    enableQuests: Boolean(g.enableQuests),
    enableNcPurchase: Boolean(g.enableNcPurchase),
    ticketPriceNC: g.ticketPriceNC || 1000,
    prizes: g.prizes || [],
    winners: g.winners || [],
    stats: g.stats || { totalTickets: 0, totalParticipants: 0, totalNcBurned: 0 },
  }));

  return <GiveawaysIndexClient giveaways={serialized} />;
}
