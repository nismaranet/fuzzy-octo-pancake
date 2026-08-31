import mongoose, { Schema, Document } from "mongoose";

export interface ISeasonPassOrder extends Document {
  discordId: string;
  userId: mongoose.Types.ObjectId;
  seasonNumber: number;
  amountIDR: number;
  channelId?: string;
  status: "pending" | "success" | "rejected";
  processedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SeasonPassOrderSchema = new Schema<ISeasonPassOrder>(
  {
    discordId: { type: String, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    seasonNumber: { type: Number, required: true, index: true },
    amountIDR: { type: Number, required: true, default: 35000 },
    channelId: { type: String },
    status: {
      type: String,
      enum: ["pending", "success", "rejected"],
      default: "pending",
      index: true,
    },
    processedBy: { type: String },
  },
  { timestamps: true }
);

if (process.env.NODE_ENV !== "production") {
  delete mongoose.models.SeasonPassOrder;
}

export default mongoose.models.SeasonPassOrder ||
  mongoose.model<ISeasonPassOrder>("SeasonPassOrder", SeasonPassOrderSchema);
