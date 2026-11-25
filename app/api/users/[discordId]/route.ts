import clientPromise from "@/lib/mongodb";
import { getUserAggregatedStats } from "@/lib/userStats";
import { jsonNoCache } from "@/lib/antiCache";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ discordId: string }> }
) {
  try {
    const { discordId } = await params;
    const expectedToken = process.env.NISMARA_SECRET_API;
    const authHeader = request.headers.get("authorization");

    if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
      return jsonNoCache({ error: "Unauthorized" }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db();
    const guildId = process.env.DISCORD_GUILD_ID;

    // 1. Ambil data user berdasarkan discordId
    const user = await db.collection("users").findOne({ discordId });
    if (!user) {
      return jsonNoCache({ error: "User not found" }, { status: 404 });
    }

    // 2. Buat query yang menyertakan userId milik si target user
    const fullTargetQuery: any = {
      $or: [
        { userId: user.discordId },
        { userId: Number(user.discordId) },
      ],
    };

    if (user.truckyId) {
      fullTargetQuery.$or.push(
        { truckyId: user.truckyId },
        { truckyId: Number(user.truckyId) }
      );
    }

    const [
      recentJobs,
      userNc,
      userPoint,
      leaveHistory,
      driverLink,
      jobDistanceSummary,
      userStats,
    ] = await Promise.all([
      db
        .collection("jobhistories")
        .find({ ...fullTargetQuery, guildId })
        .sort({ updatedAt: -1 })
        .limit(5)
        .toArray(),
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
              (24 * 60 * 60 * 1000)
          )
        )
      : null;

    const memberData = user.truckyId
      ? {
          rank: {
            name: user.truckyRank || "Driver",
            color: user.truckyRankColor || "#b39ddb",
          },
          role: {
            name: user.truckyRole || user.discordRole || "Member",
          },
          total_driven_distance_km: Math.round(jobAgg?.totalKm || 0),
          last_job_days: lastJobDays,
        }
      : null;

    return jsonNoCache({
      user,
      userStats,
      jobs: recentJobs,
      userNc: userNc || { totalNC: 0 },
      userPoint: userPoint || { totalPoints: 0 },
      leaveHistory,
      memberData,
      driverLink,
    });
  } catch (error) {
    console.error("Error fetching user detail API:", error);
    return jsonNoCache(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
