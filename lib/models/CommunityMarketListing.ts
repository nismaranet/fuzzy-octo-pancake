import mongoose, { Schema, Document } from "mongoose";

export type CommunityMarketItemType = "VOUCHER" | "PENALTY_TICKET";

export interface ICommunityMarketItemSnapshot {
  title: string;
  description?: string;
  category: string; // e.g. PENALTY_TICKET | FLEET_MAINTENANCE | FLEET_BUY | MARKET_MOD | GARAGE_UPGRADE | NC_BOOSTER
  discountType?: "percentage" | "fixed" | null;
  discountValue?: number;
  durationHours?: number;
  maxDiscount?: number;
  minSpend?: number;
  expiresAt?: Date | null;
  source?: string;
}

export interface ICommunityMarketListing extends Document {
  slug: string;
  sellerId: mongoose.Types.ObjectId;
  sellerDiscordId: string;
  guildId: string;
  itemType: CommunityMarketItemType;
  itemRefId?: mongoose.Types.ObjectId | null;
  quantity: number;
  remainingQuantity: number;
  unitPrice: number;
  itemSnapshot: ICommunityMarketItemSnapshot;
  durationDays: 7 | 14 | 30;
  listingFeePaid: number;
  expiresAt: Date;
  views: number;
  status: "active" | "sold" | "cancelled" | "expired";
  cancelledAt?: Date | null;
  soldAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const communityMarketListingSchema = new Schema<ICommunityMarketListing>(
  {
    slug: { type: String, required: true, unique: true, index: true },
    sellerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    sellerDiscordId: { type: String, required: true, index: true },
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
    itemRefId: { type: Schema.Types.ObjectId, default: null, index: true },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    remainingQuantity: { type: Number, required: true, min: 0, default: 1 },
    unitPrice: { type: Number, required: true, min: 1 },
    itemSnapshot: {
      title: { type: String, required: true },
      description: { type: String, default: "" },
      category: { type: String, required: true, index: true },
      discountType: { type: String, enum: ["percentage", "fixed", null], default: null },
      discountValue: { type: Number, default: 0 },
      durationHours: { type: Number, default: 0 },
      maxDiscount: { type: Number, default: 0 },
      minSpend: { type: Number, default: 0 },
      expiresAt: { type: Date, default: null },
      source: { type: String, default: "" },
    },
    durationDays: { type: Number, enum: [7, 14, 30], required: true, default: 7 },
    listingFeePaid: { type: Number, required: true, min: 0, default: 0 },
    expiresAt: { type: Date, required: true, index: true },
    views: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["active", "sold", "cancelled", "expired"],
      default: "active",
      index: true,
    },
    cancelledAt: { type: Date, default: null },
    soldAt: { type: Date, default: null },
  },
  { timestamps: true }
);

communityMarketListingSchema.index({ status: 1, itemType: 1, unitPrice: 1 });
communityMarketListingSchema.index({ status: 1, "itemSnapshot.category": 1, createdAt: -1 });
communityMarketListingSchema.index({ status: 1, "itemSnapshot.expiresAt": 1 });
communityMarketListingSchema.index({ sellerDiscordId: 1, status: 1, createdAt: -1 });

if (process.env.NODE_ENV !== "production") {
  delete mongoose.models.CommunityMarketListing;
}

export default (mongoose.models.CommunityMarketListing as mongoose.Model<ICommunityMarketListing>) ||
  mongoose.model<ICommunityMarketListing>("CommunityMarketListing", communityMarketListingSchema);
