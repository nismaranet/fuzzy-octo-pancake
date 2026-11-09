import { MongoClient, ObjectId } from "mongodb";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const VALID_STATUSES = ["operational", "closed", "on_construction", "suspended"];

async function remediate(dryRun = true) {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("No MONGODB_URI in .env.local");

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  console.log(`--- Running Garage Remediation (${dryRun ? "DRY RUN" : "LIVE APPLY"}) ---`);

  const garages = await db.collection("garages").find({}).toArray();
  
  // Ambil user paling aktif / terbaru untuk setiap discordId
  const users = await db.collection("users").find({}).sort({ lastSeen: -1, updatedAt: -1, createdAt: -1 }).toArray();
  const userMap = new Map();
  for (const u of users) {
    if (!userMap.has(u.discordId)) {
      userMap.set(u.discordId, u);
    }
  }

  let affectedCount = 0;

  for (const garage of garages) {
    const user = userMap.get(garage.discordId);
    const updates: any = {};
    const reasons: string[] = [];

    // 1. userId check
    if (!garage.userId && user) {
      updates.userId = user._id;
      reasons.push("Set missing userId to " + user._id);
    } else if (garage.userId && user && garage.userId.toString() !== user._id.toString()) {
      updates.userId = user._id;
      reasons.push(`Synced userId mismatch from ${garage.userId} to ${user._id}`);
    }

    // 2. status check
    if (!VALID_STATUSES.includes(garage.status)) {
      updates.status = "operational";
      reasons.push(`Corrected status from '${garage.status}' to 'operational'`);
    }

    // 3. mechanics check
    if (!garage.mechanics) {
      updates.mechanics = {
        umum: { name: null, level: null, boostPercentage: null, salary: null, extendAt: null },
        ban: { name: null, level: null, boostPercentage: null, salary: null, extendAt: null },
        mesin: { name: null, level: null, boostPercentage: null, salary: null, extendAt: null }
      };
      reasons.push("Initialized missing mechanics object");
    }

    // 4. Default cost fields
    if (garage.fleet_operational_cost === undefined) {
      updates.fleet_operational_cost = 0;
      reasons.push("Set default fleet_operational_cost = 0");
    }
    if (garage.fuel_operational_cost === undefined) {
      updates.fuel_operational_cost = 0;
      reasons.push("Set default fuel_operational_cost = 0");
    }
    if (garage.safebox_operational_cost === undefined) {
      updates.safebox_operational_cost = 0;
      reasons.push("Set default safebox_operational_cost = 0");
    }
    if (garage.operational_cost === undefined) {
      updates.operational_cost = 0;
      reasons.push("Set default operational_cost = 0");
    }

    // 5. Default capacity fields
    if (garage.fleetSlot === undefined) {
      updates.fleetSlot = 1;
      reasons.push("Set default fleetSlot = 1");
    }
    if (garage.fleetSlotLevel === undefined) {
      updates.fleetSlotLevel = 1;
      reasons.push("Set default fleetSlotLevel = 1");
    }
    if (garage.fuelCapacity === undefined) {
      updates.fuelCapacity = 2000;
      reasons.push("Set default fuelCapacity = 2000");
    }
    if (garage.fuelTankLevel === undefined) {
      updates.fuelTankLevel = 1;
      reasons.push("Set default fuelTankLevel = 1");
    }
    if (garage.fuelStock === undefined) {
      updates.fuelStock = 0;
      reasons.push("Set default fuelStock = 0");
    }
    if (garage.safeboxLevel === undefined) {
      updates.safeboxLevel = 1;
      reasons.push("Set default safeboxLevel = 1");
    }
    if (garage.safeboxStock === undefined) {
      updates.safeboxStock = 0;
      reasons.push("Set default safeboxStock = 0");
    }

    // 6. next_payment_date check
    if (!garage.next_payment_date) {
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + 30);
      updates.next_payment_date = nextDate;
      reasons.push("Set default next_payment_date to +30 days");
    }

    // 7. fleetSlotUsed check
    if (user) {
      const actualFleets = await db.collection("fleets").countDocuments({ owner: user._id });
      if ((garage.fleetSlotUsed ?? 0) !== actualFleets) {
        updates.fleetSlotUsed = actualFleets;
        reasons.push(`Updated fleetSlotUsed from ${garage.fleetSlotUsed ?? 0} to actual ${actualFleets}`);
      }
    }

    if (Object.keys(updates).length > 0) {
      affectedCount++;
      console.log(`\n[Garage ID: ${garage._id}] User: ${user?.name || "UNKNOWN"} (Discord: ${garage.discordId})`);
      for (const r of reasons) {
        console.log(`  - ${r}`);
      }

      if (!dryRun) {
        await db.collection("garages").updateOne(
          { _id: garage._id },
          { $set: updates }
        );
        console.log(`  => Successfully applied updates.`);
      }
    }
  }

  console.log(`\n========================================`);
  console.log(`Total garages needing remediation: ${affectedCount}`);
  if (dryRun) {
    console.log(`Run with --live to apply changes.`);
  }

  await client.close();
}

const isLive = process.argv.includes("--live");
remediate(!isLive).catch(console.error);
