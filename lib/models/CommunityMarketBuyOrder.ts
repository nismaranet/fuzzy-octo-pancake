import mongoose, { Schema, Document } from "mongoose";
import type { CommunityMarketItemType } from "./CommunityMarketListing";

export interface ICommunityMarketBuyOrderCriteria {
  category?: string; // e.g. FLEET_MAINTENANCE | FLEET_BUY | MARKET_MOD | GARAGE_UPGRADE | NC_BOOSTER
  discountType?: "percentage" | "fixed" | "any";
  minDiscountValue?: number;
  minDurationHours?: number;
  minRemainingDays?: number;
  requireUnlimitedMaxDiscount?: boolean;
}

export interface ICommunityMarketBuyOrder extends Document {
  slug: string;
  buyerId: mongoose.Types.ObjectId;
  buyerDiscordId: string;
  guildId: string;
  itemType: CommunityMarketItemType;
  title: string;
  notes?: string;
  criteria: ICommunityMarketBuyOrderCriteria;
  quantity: number;
  remainingQuantity: number;
  offerPrice: number;
  escrowTotal: number;
  escrowRemaining: number;
  durationDays: 7 | 14 | 30;
  listingFeePaid: number;
  expiresAt: Date;
  views: number;
  status: "active" | "fulfilled" | "cancelled" | "expired";
  cancelledAt?: Date | null;
  fulfilledAt?: Date | null;
  discordChannelId?: string | null;
  discordMessageId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const communityMarketBuyOrderSchema = new Schema<ICommunityMarketBuyOrder>(
  {
    slug: { type: String, required: true, unique: true, index: true },
    buyerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
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
    title: { type: String, required: true },
    notes: { type: String, default: "", maxlength: 240 },
    criteria: {
      category: { type: String, default: "" },
      discountType: { type: String, enum: ["percentage", "fixed", "any"], default: "percentage" },
      minDiscountValue: { type: Number, default: 0, min: 0 },
      minDurationHours: { type: Number, default: 0, min: 0 },
      minRemainingDays: { type: Number, default: 2, min: 1 },
      requireUnlimitedMaxDiscount: { type: Boolean, default: false },
    },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    remainingQuantity: { type: Number, required: true, min: 0, default: 1 },
    offerPrice: { type: Number, required: true, min: 1 },
    escrowTotal: { type: Number, required: true, min: 1 },
    escrowRemaining: { type: Number, required: true, min: 0 },
    durationDays: { type: Number, enum: [7, 14, 30], required: true, default: 7 },
    listingFeePaid: { type: Number, required: true, min: 0, default: 0 },
    expiresAt: { type: Date, required: true, index: true },
    views: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["active", "fulfilled", "cancelled", "expired"],
      default: "active",
      index: true,
    },
    cancelledAt: { type: Date, default: null },
    fulfilledAt: { type: Date, default: null },
    discordChannelId: { type: String, default: null },
    discordMessageId: { type: String, default: null },
  },
  { timestamps: true }
);

communityMarketBuyOrderSchema.index({ status: 1, itemType: 1, offerPrice: -1 });
communityMarketBuyOrderSchema.index({ status: 1, "criteria.category": 1, createdAt: -1 });
communityMarketBuyOrderSchema.index({ buyerDiscordId: 1, status: 1, createdAt: -1 });

if (process.env.NODE_ENV !== "production") {
  delete mongoose.models.CommunityMarketBuyOrder;
}

export default (mongoose.models.CommunityMarketBuyOrder as mongoose.Model<ICommunityMarketBuyOrder>) ||
  mongoose.model<ICommunityMarketBuyOrder>("CommunityMarketBuyOrder", communityMarketBuyOrderSchema);
