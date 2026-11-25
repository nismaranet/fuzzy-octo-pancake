import React from "react";
import type { Metadata } from "next";
import { getPublicStatistics } from "@/lib/publicStatistics";
import StatisticsClient from "./StatisticsClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Statistik & Performa Operasional",
  description:
    "Pantau statistik operasional resmi Nismara Transport secara real-time: perbandingan MoM, QoQ, dan YoY untuk Divisi Logistik (Truck ETS2/ATS) dan Divisi Coaches (Bus DLC), event komunitas, pasar BBM, dan ekonomi virtual Nismara Coin (NC).",
  openGraph: {
    title: "Statistik & Performa Operasional",
    description:
      "Statistik operasional resmi Nismara Transport (MoM, QoQ, YoY) terpisah antara Divisi Logistik (Truck) dan Divisi Coaches (Bus), dilengkapi data event komunitas dan Public JSON API.",
    url: "https://transport.nismara.web.id/statistics",
    siteName: "Nismara Transport",
    locale: "id_ID",
    type: "website",
    images: [
      {
        url: "https://images.nismara.my.id/227300_188.jpg",
        width: 1200,
        height: 630,
        alt: "Statistik & Performa Operasional Nismara Transport",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Statistik & Performa Operasional",
    description:
      "Statistik operasional resmi Nismara Transport (MoM, QoQ, YoY) untuk Divisi Logistik (Truck) dan Divisi Coaches (Bus).",
    images: ["https://images.nismara.my.id/227300_188.jpg"],
  },
  keywords: [
    "Statistik Nismara Transport",
    "Performa VTC Indonesia",
    "ETS2 Indonesia Statistics",
    "ETS2 Coaches DLC Indonesia",
    "ATS Indonesia VTC",
    "Nismara Transport MoM QoQ YoY",
  ],
};

function fmtInt(n: number) {
  return Math.round(n || 0).toLocaleString("id-ID");
}

function fmtKm(n: number) {
  return (n || 0).toLocaleString("id-ID", { maximumFractionDigits: 1 });
}

export default async function StatisticsPage() {
  const stats = await getPublicStatistics(false);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "Statistik Operasional & Komunitas Nismara Transport",
    description:
      "Data agregat bulanan (MoM), kuartalan (QoQ), dan tahunan (YoY) komunitas Virtual Trucking Company (VTC) Nismara Transport untuk Euro Truck Simulator 2 (ETS2), DLC Coaches, dan American Truck Simulator (ATS).",
    url: "https://transport.nismara.web.id/statistics",
    dateModified: stats.generatedAt,
    inLanguage: "id-ID",
    creator: {
      "@type": "Organization",
      name: "Nismara Transport",
      url: "https://transport.nismara.web.id",
    },
    temporalCoverage: `${stats.overview.dataRange.firstMonth}/${stats.overview.dataRange.latestMonth}`,
    distribution: [
      {
        "@type": "DataDownload",
        encodingFormat: "application/json",
        contentUrl: "https://transport.nismara.web.id/api/public/statistics",
      },
    ],
    variableMeasured: [
      `Total Pengiriman Logistik (Truck): ${fmtInt(stats.overview.totalLogisticsJobs)} jobs (${fmtKm(stats.overview.totalLogisticsDistanceKm)} km)`,
      `Total Trip Coaches (Bus): ${fmtInt(stats.overview.totalCoachesTrips)} trips (${fmtInt(stats.overview.totalCoachesPassengers)} penumpang, ${fmtKm(stats.overview.totalCoachesDistanceKm)} km)`,
      `Driver Terdaftar: ${fmtInt(stats.overview.totalRegisteredDrivers)} driver di ${fmtInt(stats.overview.activeTeamsCount)} tim`,
      `Total Convoy: ${fmtInt(stats.overview.totalConvoys)}, Special Contracts: ${fmtInt(stats.overview.totalSpecialContracts)}, Giveaway: ${fmtInt(stats.overview.totalGiveaways)}`,
    ],
  };

  const { mom, qoq, yoy } = stats.defaultComparisons;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <StatisticsClient data={stats} />

      {/* Ringkasan Terstruktur Server-Side untuk SEO, Mesin Pencari & AI Crawler */}
      <section
        aria-label="Ringkasan Data MoM QoQ YoY Nismara Transport"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16"
      >
        <div className="rounded-2xl border border-border/50 bg-card/40 p-6 space-y-4">
          <h2 className="text-sm font-black uppercase tracking-wider text-foreground">
            Ringkasan Perbandingan Resmi (MoM • QoQ • YoY)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-muted-foreground leading-relaxed">
            {mom && (
              <div className="rounded-xl bg-background/60 border border-border/40 p-4 space-y-1.5">
                <h3 className="font-bold text-foreground">
                  MoM: {mom.periodA.label} vs {mom.periodB.label}
                </h3>
                <p>
                  Logistik (Truck): <strong>{fmtInt(mom.logistics.completedJobs.periodA)}</strong> →{" "}
                  <strong>{fmtInt(mom.logistics.completedJobs.periodB)} jobs</strong> (
                  {fmtKm(mom.logistics.totalDistanceKm.periodB)} km • Hardcore:{" "}
                  {fmtInt(mom.logistics.hardcoreJobs.periodB)}, Real Miles:{" "}
                  {fmtInt(mom.logistics.realMilesJobs.periodB)}, Race Miles:{" "}
                  {fmtInt(mom.logistics.raceMilesJobs.periodB)}).
                </p>
                <p>
                  Coaches (Bus): <strong>{fmtInt(mom.coaches.completedJobs.periodA)}</strong> →{" "}
                  <strong>{fmtInt(mom.coaches.completedJobs.periodB)} trip</strong> (
                  {fmtInt(mom.coaches.totalPassengers.periodB)} penumpang).
                </p>
                <p>
                  Komunitas: {fmtInt(mom.community.convoysCount.periodB)} convoy,{" "}
                  {fmtInt(mom.community.giveawaysCount.periodB)} giveaway,{" "}
                  {fmtInt(mom.economyAndGames.fuelTotalLiters.periodB)} L BBM.
                </p>
              </div>
            )}
            {qoq && (
              <div className="rounded-xl bg-background/60 border border-border/40 p-4 space-y-1.5">
                <h3 className="font-bold text-foreground">
                  QoQ: {qoq.periodA.label} vs {qoq.periodB.label}
                </h3>
                <p>
                  Logistik (Truck): <strong>{fmtInt(qoq.logistics.completedJobs.periodA)}</strong> →{" "}
                  <strong>{fmtInt(qoq.logistics.completedJobs.periodB)} jobs</strong> (
                  {fmtKm(qoq.logistics.totalDistanceKm.periodB)} km).
                </p>
                <p>
                  Coaches (Bus): <strong>{fmtInt(qoq.coaches.completedJobs.periodA)}</strong> →{" "}
                  <strong>{fmtInt(qoq.coaches.completedJobs.periodB)} trip</strong> (
                  {fmtInt(qoq.coaches.totalPassengers.periodB)} penumpang).
                </p>
                <p>
                  Komunitas: {fmtInt(qoq.community.convoysCount.periodB)} convoy,{" "}
                  {fmtInt(qoq.community.giveawaysCount.periodB)} giveaway,{" "}
                  {fmtInt(qoq.economyAndGames.fuelTotalLiters.periodB)} L BBM.
                </p>
              </div>
            )}
            {yoy && (
              <div className="rounded-xl bg-background/60 border border-border/40 p-4 space-y-1.5">
                <h3 className="font-bold text-foreground">
                  YoY: {yoy.periodA.label} vs {yoy.periodB.label}
                </h3>
                <p>
                  Logistik (Truck): <strong>{fmtInt(yoy.logistics.completedJobs.periodA)}</strong> →{" "}
                  <strong>{fmtInt(yoy.logistics.completedJobs.periodB)} jobs</strong> (
                  {fmtKm(yoy.logistics.totalDistanceKm.periodB)} km).
                </p>
                <p>
                  Coaches (Bus): <strong>{fmtInt(yoy.coaches.completedJobs.periodA)}</strong> →{" "}
                  <strong>{fmtInt(yoy.coaches.completedJobs.periodB)} trip</strong> (
                  {fmtInt(yoy.coaches.totalPassengers.periodB)} penumpang).
                </p>
                <p>
                  Komunitas: {fmtInt(yoy.community.convoysCount.periodB)} convoy,{" "}
                  {fmtInt(yoy.community.giveawaysCount.periodB)} giveaway,{" "}
                  {fmtInt(yoy.economyAndGames.fuelTotalLiters.periodB)} L BBM.
                </p>
              </div>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Catatan AI &amp; Publik: Data ini diperbarui otomatis pada {stats.generatedAtWIB} (zona
            waktu Asia/Jakarta). Endpoint terstruktur JSON tersedia di{" "}
            <a
              href="/api/public/statistics"
              className="underline text-primary hover:opacity-80"
            >
              https://transport.nismara.web.id/api/public/statistics
            </a>
            . {stats.currencyDisclaimer}
          </p>
        </div>
      </section>
    </>
  );
}
