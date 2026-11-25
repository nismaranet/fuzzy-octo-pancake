import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import dbConnect from "@/lib/mongoose";
import CommunityMarketListing from "@/lib/models/CommunityMarketListing";
import CommunityMarketBuyOrder from "@/lib/models/CommunityMarketBuyOrder";
import CommunityMarketTrade from "@/lib/models/CommunityMarketTrade";
import { getCommunityMarketConfig } from "@/lib/communityMarketConfig";
import CommunityMarketConfigClient from "./CommunityMarketConfigClient";

export const metadata = {
  title: "Pengaturan Community Market",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function ManageCommunityMarketPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.discordId) {
    redirect("/login");
  }
  if (session.user.role !== "manager" && session.user.role !== "admin") {
    redirect("/dashboard");
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

  return (
    <CommunityMarketConfigClient
      initialConfig={config}
      initialStats={{
        activeListings,
        activeBuyOrders,
        totalTrades: t.totalTrades || 0,
        totalVolumeNC: t.totalVolumeNC || 0,
        totalTaxBurnNC: t.totalTaxBurnNC || 0,
        listingFeeBurnNC,
        totalNCBurned: (t.totalTaxBurnNC || 0) + listingFeeBurnNC,
      }}
    />
  );
}
