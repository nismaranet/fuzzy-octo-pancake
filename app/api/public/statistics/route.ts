import { NextRequest, NextResponse } from "next/server";
import {
  getPublicStatistics,
  comparePeriodStats,
  type PeriodStats,
} from "@/lib/publicStatistics";

export const dynamic = "force-dynamic";

const PUBLIC_STATS_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "X-Robots-Tag": "index, follow",
} as const;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: PUBLIC_STATS_HEADERS });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = (searchParams.get("mode") || "").toLowerCase();
    const keyA = searchParams.get("a") || "";
    const keyB = searchParams.get("b") || "";

    const data = await getPublicStatistics(false);

    // Optional targeted comparison: /api/public/statistics?mode=mom&a=2026-10&b=2026-11
    if (mode && ["mom", "qoq", "yoy"].includes(mode)) {
      const series: PeriodStats[] =
        mode === "mom" ? data.monthly : mode === "qoq" ? data.quarterly : data.yearly;

      let periodA = keyA ? series.find((p) => p.key === keyA) : series[series.length - 2];
      let periodB = keyB ? series.find((p) => p.key === keyB) : series[series.length - 1];

      if (!periodA || !periodB) {
        return NextResponse.json(
          {
            error: "Periode perbandingan tidak ditemukan.",
            availableKeys: series.map((s) => s.key),
          },
          { status: 400, headers: PUBLIC_STATS_HEADERS }
        );
      }

      return NextResponse.json(
        {
          organization: "Nismara Transport",
          website: "https://transport.nismara.web.id/statistics",
          generatedAt: data.generatedAt,
          generatedAtWIB: data.generatedAtWIB,
          currencyDisclaimer: data.currencyDisclaimer,
          mode: mode.toUpperCase(),
          comparison: comparePeriodStats(periodA, periodB),
          periodADetails: periodA,
          periodBDetails: periodB,
        },
        { headers: PUBLIC_STATS_HEADERS }
      );
    }

    return NextResponse.json(
      {
        organization: "Nismara Transport",
        website: "https://transport.nismara.web.id/statistics",
        apiUsage: {
          fullPayload: "GET /api/public/statistics",
          compareMoM: "GET /api/public/statistics?mode=mom&a=2026-10&b=2026-11",
          compareQoQ: "GET /api/public/statistics?mode=qoq&a=2026-Q3&b=2026-Q4",
          compareYoY: "GET /api/public/statistics?mode=yoy&a=2025&b=2026",
        },
        ...data,
      },
      { headers: PUBLIC_STATS_HEADERS }
    );
  } catch (error) {
    console.error("[GET /api/public/statistics] Error:", error);
    return NextResponse.json(
      { error: "Gagal memuat statistik publik Nismara Transport." },
      { status: 500 }
    );
  }
}
