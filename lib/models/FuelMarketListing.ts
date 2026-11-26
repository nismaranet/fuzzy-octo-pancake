import mongoose from "mongoose";

const fuelMarketListingSchema = new mongoose.Schema(
  {
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    sellerDiscordId: { type: String, required: true },
    amount: { type: Number, required: true }, // Liter
    pricePerLiter: { type: Number, required: true }, // NC per liter
    status: {
      type: String,
      enum: ["active", "sold", "cancelled"],
      default: "active",
    },
    discordChannelId: { type: String, default: null },
    discordMessageId: { type: String, default: null },
  },
  { timestamps: true }
);

if (process.env.NODE_ENV !== "production") {
  delete mongoose.models.FuelMarketListing;
}

export default mongoose.models.FuelMarketListing || mongoose.model("FuelMarketListing", fuelMarketListingSchema);
