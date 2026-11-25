import fs from "fs";
import path from "path";
import { MongoClient } from "mongodb";

// Load .env.local / .env
for (const envFile of [".env.local", ".env"]) {
  const p = path.resolve(process.cwd(), envFile);
  if (fs.existsSync(p)) {
    for (const line of fs.readFileSync(p, "utf-8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
    }
  }
}

const MIN_JOBS_FOR_RANK = 5;
const ROLLING_WINDOW_DAYS = 30;
const ACTIVE_SAMPLE_LIMIT = 30;
const FALLBACK_SAMPLE_LIMIT = 25;

const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function scoreToGrade(score) {
  if (score >= 97) return "S";
  if (score >= 88) return "A";
  if (score >= 76) return "B";
  if (score >= 60) return "C";
  return "D";
}

function computeDrivingScoreFromJobs(jobs) {
  const n = jobs.length;
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

    const jobDmgPenalty = isCoach
      ? dmgV * 3.5 * tolFactor
      : (dmgV * 2.0 + dmgT * 2.0 + dmgC * 6.0) * tolFactor;
    safetySum += Math.max(0, 100 - jobDmgPenalty);

    const st = String(j.statsType || "").toLowerCase();
    let jobSpeed = 100;
    if (st.includes("invalid")) jobSpeed = 0;
    else if (st.includes("race")) jobSpeed = 35;
    else {
      realMilesCount++;
      if (Number(j.penalty?.speed || 0) > 0) jobSpeed = 65;
    }
    speedSum += jobSpeed;

    totalFines += Array.isArray(j.fines_events) ? j.fines_events.length : 0;
    totalKm += Math.max(50, Number(j.distanceKm || 0));

    let jobClean = 100;
    if (Number(j.penalty?.total || 0) > 0) jobClean -= 60;
    if (!isCoach && dmgC > 0) jobClean -= 40;
    if (isCoach && dmgV > (isMp ? 12 : 6)) jobClean -= 40;
    if (typeof j.lateDelivery === "boolean") {
      onTimeTracked++;
      if (j.lateDelivery) jobClean -= 30;
      else onTimePassed++;
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

  const raw = safety * 0.4 + speed * 0.3 + clean * 0.25 + traffic * 0.05 + hardcoreBonus;
  const score = round1(Math.max(0, Math.min(100, raw)));

  return {
    score,
    grade: scoreToGrade(score),
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
    },
  };
}

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not defined");
  }
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db();

  const users = await db
    .collection("users")
    .find({}, { projection: { _id: 1, discordId: 1, name: 1 } })
    .toArray();

  const allJobs = await db
    .collection("jobhistories")
    .find({ jobStatus: "COMPLETED" })
    .sort({ completedAt: -1, createdAt: -1 })
    .toArray();

  const jobsByDriver = new Map();
  for (const j of allJobs) {
    if (!j.driverId) continue;
    const id = String(j.driverId);
    if (!jobsByDriver.has(id)) jobsByDriver.set(id, []);
    jobsByDriver.get(id).push(j);
  }

  const cutoff30d = new Date(Date.now() - ROLLING_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const now = new Date();
  const ops = [];
  const summary = { total: 0, active: 0, inactive: 0, calibrating: 0, grades: { S: 0, A: 0, B: 0, C: 0, D: 0, UNRANKED: 0 } };

  for (const u of users) {
    if (!u.discordId) continue;
    const dJobs = jobsByDriver.get(String(u.discordId)) || [];
    const recent30d = dJobs.filter((j) => new Date(j.completedAt || j.createdAt) >= cutoff30d);

    let drivingScore;
    if (recent30d.length >= MIN_JOBS_FOR_RANK) {
      const res = computeDrivingScoreFromJobs(recent30d.slice(0, ACTIVE_SAMPLE_LIMIT));
      drivingScore = {
        score: res.score,
        grade: res.grade,
        status: "active",
        sampleSize: res.sampleSize,
        recent30dJobs: recent30d.length,
        breakdown: res.breakdown,
        updatedAt: now,
      };
    } else if (dJobs.length >= MIN_JOBS_FOR_RANK) {
      const res = computeDrivingScoreFromJobs(dJobs.slice(0, FALLBACK_SAMPLE_LIMIT));
      drivingScore = {
        score: res.score,
        grade: res.grade,
        status: "inactive",
        sampleSize: res.sampleSize,
        recent30dJobs: recent30d.length,
        breakdown: res.breakdown,
        updatedAt: now,
      };
    } else {
      drivingScore = {
        score: null,
        grade: "UNRANKED",
        status: "calibrating",
        sampleSize: dJobs.length,
        recent30dJobs: recent30d.length,
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
        updatedAt: now,
      };
    }

    summary.total++;
    summary[drivingScore.status]++;
    summary.grades[drivingScore.grade]++;

    ops.push({
      updateOne: {
        filter: { _id: u._id },
        update: { $set: { drivingScore } },
      },
    });
  }

  if (ops.length > 0) {
    const bulkRes = await db.collection("users").bulkWrite(ops);
    console.log("Backfill complete:", {
      matched: bulkRes.matchedCount,
      modified: bulkRes.modifiedCount,
      summary,
    });
  }

  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
