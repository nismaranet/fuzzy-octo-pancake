import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function fixATS() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set");
    process.exit(1);
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  if (!db) throw new Error("DB connection failed");

  console.log("Connected to MongoDB.");

  const orderId = new mongoose.Types.ObjectId("6a93c2fbb44c786de8f5b6d3");
  const fleetId = new mongoose.Types.ObjectId("6a856cdd81b1a0eb321cd15f");

  const startAt = new Date("2026-08-30T05:43:37.411Z");
  const endAt = new Date(startAt.getTime() + 0.65 * 24 * 60 * 60 * 1000); // 31 Aug 2026 04:19 WIB

  // 1. Fix order: move to ats-reg-1
  await db.collection("fleetmaintenanceorders").updateOne(
    { _id: orderId },
    {
      $set: {
        status: "in_service",
        slotNumber: "ats-reg-1",
        maintenanceStartAt: startAt,
        maintenanceEndAt: endAt,
      },
    }
  );
  console.log("Updated order 6a93c2fbb44c786de8f5b6d3 to in_service in ats-reg-1");

  // 2. Free ets2-vip-1, assign ats-reg-1
  await db.collection("garageslots").updateOne(
    { slotId: "ets2-vip-1" },
    { $set: { status: "available", currentOrderId: null, fleetId: null } }
  );
  await db.collection("garageslots").updateOne(
    { slotId: "ats-reg-1" },
    { $set: { status: "in_use", currentOrderId: orderId, fleetId: fleetId } }
  );
  console.log("Fixed garage slots: ets2-vip-1 is now available, ats-reg-1 is in_use");

  console.log("ATS slot reassignment finished successfully!");
  await mongoose.connection.close();
}

fixATS().catch((err) => {
  console.error(err);
  process.exit(1);
});
