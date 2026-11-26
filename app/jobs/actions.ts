"use server";

import clientPromise from "@/lib/mongodb";
import { getCompanyMembersMap } from "@/lib/trucky";

export async function fetchJobs(
  tab: "ongoing" | "completed" | "canceled",
  skip: number,
  limit: number = 12,
  category: "all" | "truck" | "coach" = "all",
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

  if (category === "coach") {
    queryFilter.jobCategory = "coach";
  } else if (category === "truck") {
    queryFilter.jobCategory = { $ne: "coach" };
  }

  const rawJobs = await db
    .collection("jobhistories")
    .find(queryFilter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();

  const NISMARA_COMPANY_ID = 35643;

  // 1. Kumpulkan seluruh identifier pengemudi (driverId / discordId dan truckyId) dari batch jobs
  const discordIds = [
    ...new Set(rawJobs.map((j) => j.driverId).filter(Boolean).map(String)),
  ];
  const truckyIds = [
    ...new Set(rawJobs.map((j) => Number(j.truckyId)).filter((n) => !isNaN(n) && n > 0)),
  ];

  // 2. Query data users dan driverlinks dari MongoDB lokal secara paralel dengan Trucky API
  const userFilters: any[] = [];
  if (discordIds.length > 0) userFilters.push({ discordId: { $in: discordIds } });
  if (truckyIds.length > 0) {
    userFilters.push({ truckyId: { $in: truckyIds } });
    userFilters.push({ truckyId: { $in: truckyIds.map(String) } });
  }

  const [dbUsers, dbDriverLinks, membersMap] = await Promise.all([
    userFilters.length > 0
      ? db.collection("users").find({ $or: userFilters }).toArray()
      : Promise.resolve([]),
    discordIds.length > 0 || truckyIds.length > 0
      ? db.collection("driverlinks").find({
          $or: [
            ...(discordIds.length > 0 ? [{ userId: { $in: discordIds } }] : []),
            ...(truckyIds.length > 0 ? [{ truckyId: { $in: truckyIds } }, { truckyId: { $in: truckyIds.map(String) } }] : []),
          ],
        }).toArray()
      : Promise.resolve([]),
    getCompanyMembersMap(NISMARA_COMPANY_ID).catch(() => ({})),
  ]);

  // Buat lookup maps untuk akses O(1)
  const userByDiscordId = new Map<string, any>();
  const userByTruckyId = new Map<number, any>();
  for (const u of dbUsers) {
    if (u.discordId) userByDiscordId.set(String(u.discordId), u);
    if (u.truckyId) userByTruckyId.set(Number(u.truckyId), u);
  }

  const linkByDiscordId = new Map<string, any>();
  const linkByTruckyId = new Map<number, any>();
  for (const dl of dbDriverLinks) {
    if (dl.userId) linkByDiscordId.set(String(dl.userId), dl);
    if (dl.truckyId) linkByTruckyId.set(Number(dl.truckyId), dl);
  }

  const jobs = rawJobs.map((job) => {
    const tId = Number(job.truckyId);
    const dId = job.driverId ? String(job.driverId) : "";
    const member = !isNaN(tId) ? membersMap[tId] : null;
    const dbUser = (dId ? userByDiscordId.get(dId) : null) || (!isNaN(tId) ? userByTruckyId.get(tId) : null);
    const driverLink = (dId ? linkByDiscordId.get(dId) : null) || (!isNaN(tId) ? linkByTruckyId.get(tId) : null);

    // Resolusi Nama Pengemudi (Prioritas: Akun Web User -> Member VTC Trucky -> DriverLink -> Snapshot Job -> Fallback ID)
    const driverName =
      dbUser?.name ||
      member?.name ||
      member?.username ||
      driverLink?.truckyName ||
      job.truckyName ||
      (!isNaN(tId) && tId > 0 ? `Driver #${tId}` : "Unknown Driver");

    // Resolusi Avatar Pengemudi (Prioritas: Avatar Web User -> Avatar Trucky -> null)
    const avatarUrl =
      dbUser?.image ||
      dbUser?.avatarUrl ||
      member?.avatar_url ||
      null;

    const isCoachJob =
      job.jobCategory === "coach" ||
      job.cargoId === "Passengers" ||
      job.cargoId === "bus_company_job" ||
      job.cargoId === "bus_tourist_job" ||
      String(job.marketType || "").toLowerCase().startsWith("bus") ||
      String(job.statsType || "").toLowerCase().startsWith("coaches");

    return {
      _id: job._id.toString(),
      jobStatus: job.jobStatus,
      jobId: job.jobId,
      game: job.game,
      jobCategory: isCoachJob ? "coach" : "truck",
      marketType: job.marketType || "",
      sourceCity: job.sourceCity || "",
      destinationCity: job.destinationCity || "",
      cargoName: job.cargoName || "",
      totalPassengers: job.totalPassengers || 0,
      stopsCount: Array.isArray(job.stops) ? job.stops.length : 0,
      driverName,
      avatarUrl,
      avatarDecoration: dbUser?.avatarDecoration || null,
      isNismaraPlus: dbUser?.nismaraplus?.status === true,
      userRole: dbUser?.discordRole || dbUser?.role || null,
      topManager: dbUser?.topManager || null,
      truckyId: job.truckyId,
      distanceKm: job.distanceKm || job.plannedDistanceKm || 0,
      durationSeconds: job.durationSeconds || 0,
      createdAt: job.createdAt, // Untuk tab ongoing
      completedAt: job.completedAt || job.updatedAt,
      damage: job.damage || { vehicle: 0, trailer: 0, cargo: 0 },
      revenue:
        typeof job.revenue === "number"
          ? job.revenue
          : (job.nc?.total || 0) - (job.ncCost?.total || 0),
      nc:
        typeof job.nc === "object" && job.nc !== null
          ? job.nc
          : { total: Number(job.nc) || 0 },
      ncCost: job.ncCost || { total: 0 },
      // Flag tambahan untuk UI
      isOngoing: !job.completedAt && job.jobStatus !== "CANCELED",
    };
  });

  return jobs;
}
