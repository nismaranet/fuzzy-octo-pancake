"use server";

import clientPromise from "@/lib/mongodb";
import { getCompanyMembersMap } from "@/lib/trucky";

export async function fetchJobs(
  tab: "ongoing" | "completed" | "canceled",
  skip: number,
  limit: number = 12,
) {
  const client = await clientPromise;
  const db = client.db();

  let queryFilter: any = {};

  if (tab === "canceled") {
    queryFilter = { jobStatus: "CANCELED" };
  } else if (tab === "ongoing") {
    // Ongoing: Tidak batal dan belum selesai (completedAt tidak ada/null)
    queryFilter = {
      jobStatus: { $ne: "CANCELED" },
      completedAt: { $exists: false },
    };
  } else {
    // Completed: Tidak batal dan sudah ada data completedAt
    queryFilter = {
      jobStatus: { $ne: "CANCELED" },
      completedAt: { $exists: true },
    };
  }

  const rawJobs = await db
    .collection("jobhistories")
    .find(queryFilter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();

  const NISMARA_COMPANY_ID = 35643;
  const membersMap = await getCompanyMembersMap(NISMARA_COMPANY_ID);

  const jobs = rawJobs.map((job) => {
    const tId = Number(job.truckyId);
    const member = membersMap[tId];

    return {
      _id: job._id.toString(),
      jobStatus: job.jobStatus,
      jobId: job.jobId,
      game: job.game,
      driverName: member?.name || job.truckyName || "Unknown Driver",
      // Mengambil avatar_url dari Trucky member data
      avatarUrl: member?.avatar_url || null,
      truckyId: job.truckyId,
      distanceKm: job.distanceKm || 0,
      durationSeconds: job.durationSeconds || 0,
      createdAt: job.createdAt, // Untuk tab ongoing
      completedAt: job.completedAt || job.updatedAt,
      damage: job.damage || { vehicle: 0, trailer: 0, cargo: 0 },
      revenue: job.revenue || 0,
      nc: job.nc || { total: 0 },
      // Flag tambahan untuk UI
      isOngoing: !job.completedAt && job.jobStatus !== "CANCELED",
    };
  });

  return jobs;
}
