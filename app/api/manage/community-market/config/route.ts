import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";
import dbConnect from "@/lib/mongoose";
import { jsonNoCache } from "@/lib/antiCache";
import CommunityMarketListing from "@/lib/models/CommunityMarketListing";
import CommunityMarketBuyOrder from "@/lib/models/CommunityMarketBuyOrder";
import CommunityMarketTrade from "@/lib/models/CommunityMarketTrade";
import {
  getCommunityMarketConfig,
  saveCommunityMarketConfig,
} from "@/lib/communityMarketConfig";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

function isAuthorizedManager(session: any): boolean {
  const role = session?.user?.role;
  return Boolean(session?.user?.discordId && (role === "manager" || role === "admin"));
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!isAuthorizedManager(session)) {
      return jsonNoCache({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const [config, activeListings, activeBuyOrders, tradeStats, listingFeesAgg, buyOrderFeesAgg] =
      await Promise.all([
        getCommunityMarketConfig(true),
        CommunityMarketListing.countDocuments({ status: "active" }),
        CommunityMarketBuyOrder.countDocuments({ status: "active" }),
        CommunityMarketTrade.aggregate([
          {
            $group: {
              _id: null,
              totalTrades: { $sum: 1 },
              totalVolumeNC: { $sum: "$grossAmount" },
              totalTaxBurnNC: { $sum: "$feeAmount" },
            },
          },
        ]),
        CommunityMarketListing.aggregate([
          { $group: { _id: null, totalFee: { $sum: "$listingFeePaid" } } },
        ]),
        CommunityMarketBuyOrder.aggregate([
          { $group: { _id: null, totalFee: { $sum: "$listingFeePaid" } } },
        ]),
      ]);

    const t = tradeStats[0] || { totalTrades: 0, totalVolumeNC: 0, totalTaxBurnNC: 0 };
    const listingFeeBurnNC =
      (listingFeesAgg[0]?.totalFee || 0) + (buyOrderFeesAgg[0]?.totalFee || 0);

    return jsonNoCache({
      success: true,
      config,
      stats: {
        activeListings,
        activeBuyOrders,
        totalTrades: t.totalTrades || 0,
        totalVolumeNC: t.totalVolumeNC || 0,
        totalTaxBurnNC: t.totalTaxBurnNC || 0,
        listingFeeBurnNC,
        totalNCBurned: (t.totalTaxBurnNC || 0) + listingFeeBurnNC,
      },
    });
  } catch (err: any) {
    console.error("[Manage CM Config GET] Error:", err);
    return jsonNoCache(
      { success: false, error: err?.message || "Gagal memuat konfigurasi Community Market." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!isAuthorizedManager(session)) {
      return jsonNoCache({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const saved = await saveCommunityMarketConfig(
      body.config ?? body,
      String(session!.user.discordId)
    );

    try {
      revalidatePath("/community-market");
      revalidatePath("/dashboard/manage/community-market");
    } catch {
      // Non-fatal
    }

    return jsonNoCache({
      success: true,
      message: "Konfigurasi Community Market berhasil disimpan!",
      config: saved,
    });
  } catch (err: any) {
    console.error("[Manage CM Config PUT] Error:", err);
    return jsonNoCache(
      { success: false, error: err?.message || "Gagal menyimpan konfigurasi." },
      { status: 500 }
    );
  }
}
