import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function adjustFee() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set");
    process.exit(1);
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  if (!db) throw new Error("DB connection failed");

  console.log("Connected to MongoDB.");

  const discordId = "377833394131697674";
  const guildId = process.env.DISCORD_GUILD_ID || "863959415702028318";
  const orderId = "6a93c2fbb44c786de8f5b6d3";

  // Deduct 500 NC admin fee from self-service
  await db.collection("currencies").updateOne(
    { userId: discordId, guildId: guildId },
    { $inc: { totalNC: -500 } }
  );

  await db.collection("currencyhistories").insertOne({
    userId: discordId,
    guildId: guildId,
    amount: 500,
    type: "spend",
    reason: `Penyesuaian admin fee self-service armada (Order ID: ${orderId})`,
    createdAt: new Date(),
  });

  console.log("Adjusted self-service admin fee (-500 NC) successfully.");
  await mongoose.connection.close();
}

adjustFee().catch((err) => {
  console.error(err);
  process.exit(1);
});
