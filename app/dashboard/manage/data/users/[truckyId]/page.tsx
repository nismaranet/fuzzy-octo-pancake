// app/dashboard/manage/users/[truckyId]/page.tsx
import clientPromise from "@/lib/mongodb";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import ManageUserUI from "./ManageUserUI";
import { getUserAggregatedStats } from "@/lib/userStats";

export const metadata = {
  title: "Manage Users Detail",
};

export const dynamic = "force-dynamic";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ truckyId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "manager") redirect("/dashboard");

  const { truckyId } = await params;
  const client = await clientPromise;
  const db = client.db();
  const guildId = process.env.DISCORD_GUILD_ID;

  // Query hanya untuk target user berdasarkan truckyId dari URL
  const targetQuery = {
    $or: [{ truckyId: Number(truckyId) }, { truckyId: truckyId }],
  };

  // 1. Ambil data user dulu untuk mendapatkan userId (Discord ID) jika diperlukan
  const user = await db.collection("users").findOne(targetQuery);
  if (!user) return notFound();

  // 2. Buat query yang menyertakan userId milik si target user (bukan manager)
  const fullTargetQuery = {
    $or: [
      ...targetQuery.$or,
      { userId: user.discordId },
      { userId: Number(user.discordId) },
      { truckyId: user.truckyId },
      { truckyId: Number(user.truckyId) },
    ],
  };

  const [
    ncHistory,
    pointHistory,
    recentJobs,
    userNc,
    userPoint,
    leaveHistory,
    driverLink,
    jobDistanceSummary,
    userStats,
  ] = await Promise.all([
    db
      .collection("currencyhistories")
      .find({ ...fullTargetQuery, guildId })
      .sort({ createdAt: -1 })
      .limit(30)
      .toArray(),
    db
      .collection("pointhistories")
      .find({ ...fullTargetQuery, guildId })
      .sort({ createdAt: -1 })
      .limit(30)
      .toArray(),
    db
      .collection("jobhistories")
      .find({ ...fullTargetQuery, guildId })
      .sort({ updatedAt: -1 })
      .limit(5)
      .toArray(),
    // Gunakan findOne agar mendapatkan object, bukan array
    db.collection("currencies").findOne({ ...fullTargetQuery, guildId }),
    db.collection("points").findOne({ ...fullTargetQuery, guildId }),
    db
      .collection("leavehistories")
      .find({ ...fullTargetQuery })
      .sort({ startDate: -1 })
      .toArray(),
    db.collection("driverlinks").findOne({ ...fullTargetQuery, guildId }),
    db
      .collection("jobhistories")
      .aggregate([
        {
          $match: {
            driverId: String(user.discordId),
            jobStatus: "COMPLETED",
          },
        },
        {
          $group: {
            _id: null,
            totalKm: { $sum: { $ifNull: ["$distanceKm", 0] } },
            lastJobAt: { $max: { $ifNull: ["$completedAt", "$createdAt"] } },
          },
        },
      ])
      .toArray(),
    getUserAggregatedStats(user.discordId, user._id),
  ]);

  const jobAgg = jobDistanceSummary[0];
  const lastJobDays = jobAgg?.lastJobAt
    ? Math.max(
        0,
        Math.floor(
          (Date.now() - new Date(jobAgg.lastJobAt).getTime()) /
            (24 * 60 * 60 * 1000),
        ),
      )
    : null;

  const memberData = {
    rank: {
      name: user.truckyRank || "Driver",
      color: user.truckyRankColor || "#b39ddb",
    },
    role: {
      name: user.truckyRole || user.discordRole || "Member",
    },
    total_driven_distance_km: Math.round(jobAgg?.totalKm || 0),
    last_job_days: lastJobDays,
  };

  const serialize = (data: any) => JSON.parse(JSON.stringify(data));

  return (
    <ManageUserUI
      user={serialize(user)}
      userStats={serialize(userStats)}
      ncHistory={serialize(ncHistory)}
      pointHistory={serialize(pointHistory)}
      jobs={serialize(recentJobs)}
      userNc={serialize(userNc || { totalNC: 0 })} // Fallback jika data null
      userPoint={serialize(userPoint || { totalPoints: 0 })}
      leaveHistory={serialize(leaveHistory)}
      managerSession={session.user}
      memberData={serialize(memberData)}
      driverLink={serialize(driverLink)} // Kirim data manager untuk logging
    />
  );
}
