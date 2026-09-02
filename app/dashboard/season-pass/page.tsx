import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import DriverAccessBlocker from "@/components/DriverAccessBlocker";
import dbConnect from "@/lib/mongoose";
import SeasonPassOrder from "@/lib/models/SeasonPassOrder";
import SeasonPassMerchClaim from "@/lib/models/SeasonPassMerchClaim";
import {
  getActiveSeason,
  getUserSeasonProgress,
  getSeasonWeekInfo,
} from "@/lib/seasonPass";
import SeasonPassClient from "./SeasonPassClient";

export const metadata = {
  title: "Nismara Seasonal Pass",
  description:
    "Progresi musim Nismara Pass 30 Level dengan hadiah Nismara Coin, Fuel, Voucher Servis, NC Booster, dan Mod Livery Eksklusif.",
};

export default async function SeasonPassPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.discordId) {
    redirect("/login");
  }

  if (!session.user?.isDriver || !session.user.driverData) {
    return <DriverAccessBlocker session={session} />;
  }

  await dbConnect();

  const seasonDoc = await getActiveSeason();
  const seasonNumber = seasonDoc?.seasonNumber || 1;
  const discordId = String(session.user.discordId);

  const progressDoc = await getUserSeasonProgress(discordId, seasonNumber);

  const pendingOrderDoc = await SeasonPassOrder.findOne({
    discordId,
    seasonNumber,
    status: "pending",
  }).lean();

  const merchClaimDoc = await SeasonPassMerchClaim.findOne({
    discordId,
    seasonNumber,
  }).lean();

  const season = seasonDoc ? JSON.parse(JSON.stringify(seasonDoc)) : null;
  const progress = progressDoc ? JSON.parse(JSON.stringify(progressDoc)) : null;
  const weekInfo = seasonDoc ? JSON.parse(JSON.stringify(getSeasonWeekInfo(seasonDoc, progressDoc?.isPremium || false))) : null;
  const pendingOrder = pendingOrderDoc ? JSON.parse(JSON.stringify(pendingOrderDoc)) : null;
  const merchClaim = merchClaimDoc ? JSON.parse(JSON.stringify(merchClaimDoc)) : null;
  const guildId = process.env.DISCORD_GUILD_ID || "863959415702028318";

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 max-w-7xl mx-auto">
      <SeasonPassClient
        initialSeason={season}
        initialProgress={progress}
        initialWeekInfo={weekInfo}
        initialPendingOrder={pendingOrder}
        initialMerchClaim={merchClaim}
        guildId={guildId}
      />
    </div>
  );
}
