import type { Db } from "mongodb";

export type DrivingGrade = "S" | "A" | "B" | "C" | "D" | "UNRANKED";
export type DrivingScoreStatus = "active" | "inactive" | "calibrating";

export interface DrivingScoreBreakdown {
  safety: number;
  speed: number;
  traffic: number;
  clean: number;
  hardcoreBonus: number;
  avgDamageVehicle: number;
  avgDamageCargo: number;
  realMilesRate: number;
  finesPer1000Km: number;
  onTimeRate: number;
}

export interface DrivingScoreData {
  score: number | null;
  grade: DrivingGrade;
  status: DrivingScoreStatus;
  sampleSize: number;
  recent30dJobs: number;
  breakdown: DrivingScoreBreakdown;
  updatedAt: string | Date | null;
}

export const MIN_JOBS_FOR_RANK = 5;
export const ROLLING_WINDOW_DAYS = 30;
export const ACTIVE_SAMPLE_LIMIT = 30;
export const FALLBACK_SAMPLE_LIMIT = 25;

export const GRADE_RANK: Record<DrivingGrade, number> = {
  S: 5,
  A: 4,
  B: 3,
  C: 2,
  D: 1,
  UNRANKED: 0,
};

/**
 * Helper siap pakai untuk memvalidasi kelayakan promo / Voucher Tebus Murah / diskon asuransi
 * berdasarkan Grade Driving Score user.
 */
export function meetsDrivingGrade(
  drivingScore: Partial<DrivingScoreData> | null | undefined,
  minGrade: Exclude<DrivingGrade, "UNRANKED">,
  requireActive = true
): boolean {
  if (!drivingScore || !drivingScore.grade) return false;
  if (requireActive && drivingScore.status !== "active") return false;
  return (GRADE_RANK[drivingScore.grade] ?? 0) >= GRADE_RANK[minGrade];
}

export function getDrivingGradeMeta(grade: DrivingGrade) {
  switch (grade) {
    case "S":
      return {
        label: "Elite Driver",
        shortLabel: "Grade S",
        textClass: "text-amber-400",
        bgClass: "bg-amber-500/15",
        borderClass: "border-amber-500/40",
        ringColor: "#fbbf24",
        gradientClass: "from-amber-400 via-yellow-300 to-amber-500",
      };
    case "A":
      return {
        label: "Safe Driver",
        shortLabel: "Grade A",
        textClass: "text-emerald-400",
        bgClass: "bg-emerald-500/15",
        borderClass: "border-emerald-500/40",
        ringColor: "#34d399",
        gradientClass: "from-emerald-400 to-teal-500",
      };
    case "B":
      return {
        label: "Standard Driver",
        shortLabel: "Grade B",
        textClass: "text-sky-400",
        bgClass: "bg-sky-500/15",
        borderClass: "border-sky-500/40",
        ringColor: "#38bdf8",
        gradientClass: "from-sky-400 to-blue-500",
      };
    case "C":
      return {
        label: "Needs Attention",
        shortLabel: "Grade C",
        textClass: "text-orange-400",
        bgClass: "bg-orange-500/15",
        borderClass: "border-orange-500/40",
        ringColor: "#fb923c",
        gradientClass: "from-orange-400 to-amber-600",
      };
    case "D":
      return {
        label: "High Risk",
        shortLabel: "Grade D",
        textClass: "text-rose-400",
        bgClass: "bg-rose-500/15",
        borderClass: "border-rose-500/40",
        ringColor: "#fb7185",
        gradientClass: "from-rose-400 to-red-600",
      };
    default:
      return {
        label: "Kalibrasi Data",
        shortLabel: "Unranked",
        textClass: "text-muted-foreground",
        bgClass: "bg-muted/40",
        borderClass: "border-border/60",
        ringColor: "#94a3b8",
        gradientClass: "from-slate-400 to-slate-500",
      };
  }
}

function round1(n: number): number {
  return Math.round((Number(n) || 0) * 10) / 10;
}

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function scoreToGrade(score: number): Exclude<DrivingGrade, "UNRANKED"> {
  if (score >= 97) return "S";
  if (score >= 88) return "A";
  if (score >= 76) return "B";
  if (score >= 60) return "C";
  return "D";
}

export function computeDrivingScoreFromJobs(jobs: any[]) {
  const n = Array.isArray(jobs) ? jobs.length : 0;
  if (n === 0) return null;

  let safetySum = 0;
  let speedSum = 0;
  let cleanSum = 0;
  let totalFines = 0;
  let totalKm = 0;
  let hcCount = 0;
  let hcRatingSum = 0;
  let dmgVehSum = 0;
  let dmgCargoSum = 0;
  let truckJobsCount = 0;
  let realMilesCount = 0;
  let onTimeTracked = 0;
  let onTimePassed = 0;

  for (const j of jobs) {
    const isCoach =
      j.jobCategory === "coach" ||
      String(j.marketType || "").toLowerCase().startsWith("bus") ||
      String(j.statsType || "").toLowerCase().startsWith("coaches");
    const isMp = /tmp|truckersmp|haulmp/i.test(String(j.gameMode || ""));
    const tolFactor = isMp ? 0.65 : 1.0;

    const dmgV = Number(j.damage?.vehicle || 0);
    const dmgT = Number(j.damage?.trailer || 0);
    const dmgC = Number(j.damage?.cargo || 0);

    dmgVehSum += dmgV;
    if (!isCoach) {
      dmgCargoSum += dmgC;
      truckJobsCount++;
    }

    // 1. Safety & Damage Control (40%)
    const jobDmgPenalty = isCoach
      ? dmgV * 3.5 * tolFactor
      : (dmgV * 2.0 + dmgT * 2.0 + dmgC * 6.0) * tolFactor;
    safetySum += Math.max(0, 100 - jobDmgPenalty);

    // 2. Speed Discipline (25%)
    const st = String(j.statsType || "").toLowerCase();
    let jobSpeed = 100;
    if (st.includes("invalid")) {
      jobSpeed = 0;
    } else if (st.includes("race")) {
      jobSpeed = 35;
    } else {
      realMilesCount++;
      if (Number(j.penalty?.speed || 0) > 0) {
        jobSpeed = 65;
      }
    }
    speedSum += jobSpeed;

    // 3. Traffic Compliance (20%)
    totalFines += Array.isArray(j.fines_events) ? j.fines_events.length : 0;
    totalKm += Math.max(50, Number(j.distanceKm || 0));

    // 4. Clean & On-Time Delivery (15%)
    let jobClean = 100;
    if (Number(j.penalty?.total || 0) > 0) jobClean -= 60;
    if (!isCoach && dmgC > 0) jobClean -= 40;
    if (isCoach && dmgV > (isMp ? 12 : 6)) jobClean -= 40;
    if (typeof j.lateDelivery === "boolean") {
      onTimeTracked++;
      if (j.lateDelivery) {
        jobClean -= 30;
      } else {
        onTimePassed++;
      }
    }
    cleanSum += Math.max(0, jobClean);

    if (j.isHardcore === true) {
      hcCount++;
      hcRatingSum += Number(j.hardcoreRating || 0);
    }
  }

  const safety = safetySum / n;
  const speed = speedSum / n;
  const finesPer1000Km = (totalFines / Math.max(1000, totalKm)) * 1000;
  const traffic = Math.max(0, Math.min(100, 100 - finesPer1000Km * 22));
  const clean = cleanSum / n;

  const hcRatio = hcCount / n;
  const avgHcRating = hcCount > 0 ? hcRatingSum / hcCount : 0;
  const hardcoreBonus = Math.min(
    2.5,
    hcRatio * 1.5 + (avgHcRating / 5) * 1.0 * Math.min(1, hcRatio * 2)
  );

  const rawScore =
    safety * 0.4 + speed * 0.3 + clean * 0.25 + traffic * 0.05 + hardcoreBonus;
  const score = round1(Math.max(0, Math.min(100, rawScore)));
  const grade = scoreToGrade(score);

  return {
    score,
    grade,
    sampleSize: n,
    breakdown: {
      safety: round1(safety),
      speed: round1(speed),
      traffic: round1(traffic),
      clean: round1(clean),
      hardcoreBonus: round1(hardcoreBonus),
      avgDamageVehicle: round2(dmgVehSum / n),
      avgDamageCargo: truckJobsCount > 0 ? round2(dmgCargoSum / truckJobsCount) : 0,
      realMilesRate: round1((realMilesCount / n) * 100),
      finesPer1000Km: round2(finesPer1000Km),
      onTimeRate: onTimeTracked > 0 ? round1((onTimePassed / onTimeTracked) * 100) : 100,
    } satisfies DrivingScoreBreakdown,
  };
}

export async function recalculateUserDrivingScore(
  db: Db,
  discordId: string
): Promise<DrivingScoreData> {
  const idStr = String(discordId);
  const cutoff30d = new Date(Date.now() - ROLLING_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const completedJobs = await db
    .collection("jobhistories")
    .find({ driverId: idStr, jobStatus: "COMPLETED" })
    .sort({ completedAt: -1, createdAt: -1 })
    .limit(ACTIVE_SAMPLE_LIMIT)
    .toArray();

  const recent30dJobs = completedJobs.filter(
    (j: any) => new Date(j.completedAt || j.createdAt) >= cutoff30d
  );

  let doc: DrivingScoreData;

  if (recent30dJobs.length >= MIN_JOBS_FOR_RANK) {
    const res = computeDrivingScoreFromJobs(recent30dJobs.slice(0, ACTIVE_SAMPLE_LIMIT))!;
    doc = {
      score: res.score,
      grade: res.grade,
      status: "active",
      sampleSize: res.sampleSize,
      recent30dJobs: recent30dJobs.length,
      breakdown: res.breakdown,
      updatedAt: new Date(),
    };
  } else if (completedJobs.length >= MIN_JOBS_FOR_RANK) {
    const res = computeDrivingScoreFromJobs(completedJobs.slice(0, FALLBACK_SAMPLE_LIMIT))!;
    doc = {
      score: res.score,
      grade: res.grade,
      status: "inactive",
      sampleSize: res.sampleSize,
      recent30dJobs: recent30dJobs.length,
      breakdown: res.breakdown,
      updatedAt: new Date(),
    };
  } else {
    doc = {
      score: null,
      grade: "UNRANKED",
      status: "calibrating",
      sampleSize: completedJobs.length,
      recent30dJobs: recent30dJobs.length,
      breakdown: {
        safety: 0,
        speed: 0,
        traffic: 0,
        clean: 0,
        hardcoreBonus: 0,
        avgDamageVehicle: 0,
        avgDamageCargo: 0,
        realMilesRate: 0,
        finesPer1000Km: 0,
        onTimeRate: 100,
      },
      updatedAt: new Date(),
    };
  }

  await db
    .collection("users")
    .updateOne({ discordId: idStr }, { $set: { drivingScore: doc } });

  return doc;
}

/**
 * Dipanggil dari cron users agar status driver `active` yang sudah lewat 30 hari dengan <5 job
 * otomatis berpindah ke `inactive` (fallback 25 job terakhir), maksimal 24 jam sekali per user.
 */
export async function refreshStaleActiveDrivingScores(db: Db, batchLimit = 25): Promise<number> {
  const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const staleUsers = await db
    .collection("users")
    .find(
      {
        "accountHold.status": { $ne: true },
        "drivingScore.status": "active",
        $or: [
          { "drivingScore.updatedAt": { $lte: staleThreshold } },
          { "drivingScore.updatedAt": null },
        ],
      },
      { projection: { discordId: 1 } }
    )
    .limit(batchLimit)
    .toArray();

  let updated = 0;
  for (const u of staleUsers) {
    if (!u.discordId) continue;
    await recalculateUserDrivingScore(db, String(u.discordId));
    updated++;
  }
  return updated;
}
