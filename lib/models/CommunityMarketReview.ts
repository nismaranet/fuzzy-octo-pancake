import mongoose, { Schema, Document } from "mongoose";

export const COMMUNITY_MARKET_REVIEW_TAGS = [
  "Harga Bersahabat",
  "Flash Deal Mantap",
  "Penjual Rekomendasi",
  "Item Sesuai Deskripsi",
  "Transaksi Lancar",
] as const;

export interface ICommunityMarketReview extends Document {
  tradeId: mongoose.Types.ObjectId;
  sellerDiscordId: string;
  buyerDiscordId: string;
  rating: number;
  tags: string[];
  comment: string;
  createdAt: Date;
  updatedAt: Date;
}

const communityMarketReviewSchema = new Schema<ICommunityMarketReview>(
  {
    tradeId: {
      type: Schema.Types.ObjectId,
      ref: "CommunityMarketTrade",
      required: true,
      unique: true,
      index: true,
    },
    sellerDiscordId: { type: String, required: true, index: true },
    buyerDiscordId: { type: String, required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    tags: [{ type: String }],
    comment: { type: String, default: "", maxlength: 200 },
  },
  { timestamps: true }
);

communityMarketReviewSchema.index({ sellerDiscordId: 1, createdAt: -1 });

if (process.env.NODE_ENV !== "production") {
  delete mongoose.models.CommunityMarketReview;
}

export default (mongoose.models.CommunityMarketReview as mongoose.Model<ICommunityMarketReview>) ||
  mongoose.model<ICommunityMarketReview>("CommunityMarketReview", communityMarketReviewSchema);
