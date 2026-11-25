const mongoose = require("mongoose");

const contributorSchema = new mongoose.Schema(
  {
    driverId: { type: String, required: true },
    jobs: { type: Number, default: 0 },
    totalNC: { type: Number, default: 0 },
    totalDistance: { type: Number, default: 0 },
    totalMass: { type: Number, default: 0 },
    totalPassengers: { type: Number, default: 0 },
  },
  { _id: false },
);

const contractSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true },
    contractName: { type: String, required: true },
    contractCategory: {
      type: String,
      enum: ["truck", "coach"],
      default: "truck",
      index: true,
    },
    companyName: { type: String, default: "" },
    targetCities: { type: [String], default: [] },
    coachMarketFilter: {
      type: String,
      enum: ["all", "company", "tourist"],
      default: "all",
    },
    minPassengers: { type: Number, default: 0 },
    channelId: { type: String }, // optional channel ID for contract announcements
    imageUrl: { type: String }, // optional image URL for the contract banner
    gameId: { type: String }, // '1' for ETS2, '2' for ATS
    completedContracts: { type: Number, default: 0 },
    totalNCEarned: { type: Number, default: 0 },
    totalDistance: { type: Number, default: 0 }, // in kilometers
    totalMass: { type: Number, default: 0 }, // in tons (truck)
    totalPassengers: { type: Number, default: 0 }, // in pax (coach)
    setBy: { type: String }, // siapa yang set
    setAt: { type: Date, default: Date.now },
    endAt: { type: Date }, // optional end date for the contract
    isActive: { type: Boolean, default: true },
    isScheduled: { type: Boolean, default: false },
    startDate: { type: Date, default: Date.now },

    // Leaderboard
    contributors: [contributorSchema],
  },
  { timestamps: true },
);

contractSchema.index(
  { guildId: 1, gameId: 1, contractCategory: 1 },
  { unique: true, partialFilterExpression: { isActive: true } },
);

contractSchema.index({ guildId: 1, isScheduled: 1, startDate: 1 });

module.exports =
  mongoose.models.Contract || mongoose.model("Contract", contractSchema);
