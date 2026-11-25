import mongoose, { Schema, Document } from "mongoose";
import type {
  CommunityMarketItemType,
  ICommunityMarketItemSnapshot,
} from "./CommunityMarketListing";

export interface ICommunityMarketTrade extends Document {
  trxId: string;
  tradeType: "SELL_LISTING" | "BUY_ORDER";
  listingId?: mongoose.Types.ObjectId | null;
  buyOrderId?: mongoose.Types.ObjectId | null;
  sellerDiscordId: string;
  buyerDiscordId: string;
  guildId: string;
  itemType: CommunityMarketItemType;
  itemCategory: string;
  itemSnapshot: ICommunityMarketItemSnapshot;
  quantity: number;
  unitPrice: number;
  grossAmount: number;
  feePercent: number;
  feeAmount: number;
  netSellerPayout: number;
  isRated: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const communityMarketTradeSchema = new Schema<ICommunityMarketTrade>(
  {
    trxId: { type: String, required: true, unique: true, index: true },
    tradeType: {
      type: String,
      enum: ["SELL_LISTING", "BUY_ORDER"],
      required: true,
    },
    listingId: { type: Schema.Types.ObjectId, ref: "CommunityMarketListing", default: null },
    buyOrderId: { type: Schema.Types.ObjectId, ref: "CommunityMarketBuyOrder", default: null },
    sellerDiscordId: { type: String, required: true, index: true },
    buyerDiscordId: { type: String, required: true, index: true },
    guildId: {
      type: String,
      required: true,
      default: process.env.DISCORD_GUILD_ID || process.env.GUILD_ID || "863959415702028318",
    },
    itemType: {
      type: String,
      enum: ["VOUCHER", "PENALTY_TICKET"],
      required: true,
      index: true,
    },
    itemCategory: { type: String, required: true, index: true },
    itemSnapshot: {
      title: { type: String, required: true },
      description: { type: String, default: "" },
      category: { type: String, required: true },
      discountType: { type: String, enum: ["percentage", "fixed", null], default: null },
      discountValue: { type: Number, default: 0 },
      durationHours: { type: Number, default: 0 },
      maxDiscount: { type: Number, default: 0 },
      minSpend: { type: Number, default: 0 },
      expiresAt: { type: Date, default: null },
      source: { type: String, default: "" },
    },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 1 },
    grossAmount: { type: Number, required: true, min: 1 },
    feePercent: { type: Number, required: true, min: 0 },
    feeAmount: { type: Number, required: true, min: 0 },
    netSellerPayout: { type: Number, required: true, min: 0 },
    isRated: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

communityMarketTradeSchema.index({ itemType: 1, itemCategory: 1, createdAt: -1 });
communityMarketTradeSchema.index({ sellerDiscordId: 1, createdAt: -1 });
communityMarketTradeSchema.index({ buyerDiscordId: 1, createdAt: -1 });

if (process.env.NODE_ENV !== "production") {
  delete mongoose.models.CommunityMarketTrade;
}

export default (mongoose.models.CommunityMarketTrade as mongoose.Model<ICommunityMarketTrade>) ||
  mongoose.model<ICommunityMarketTrade>("CommunityMarketTrade", communityMarketTradeSchema);
