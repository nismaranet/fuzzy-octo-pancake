import mongoose, { Schema, Document } from "mongoose";

export interface IVoucherGrantLog extends Document {
  actorDiscordId: string;
  actorName: string;
  recipientDiscordId: string;
  recipientUserId?: mongoose.Types.ObjectId | null;
  recipientName: string;
  recipientTruckyId?: string | null;
  reason: string;
  quantity: number;
  voucherIds: mongoose.Types.ObjectId[];
  voucherCodes: string[];
  voucherSnapshot: {
    title: string;
    category: string;
    discountType: "percentage" | "fixed";
    discountValue: number;
    maxDiscount: number;
    minSpend: number;
    durationHours: number;
    expiresInDays: number;
    tradable: boolean;
  };
  revokedAt?: Date | null;
  revokedByDiscordId?: string | null;
  revokedByName?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const voucherGrantLogSchema = new Schema<IVoucherGrantLog>(
  {
    actorDiscordId: { type: String, required: true, index: true },
    actorName: { type: String, required: true },
    recipientDiscordId: { type: String, required: true, index: true },
    recipientUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    recipientName: { type: String, required: true },
    recipientTruckyId: { type: String, default: null },
    reason: { type: String, required: true, maxlength: 400 },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    voucherIds: [{ type: Schema.Types.ObjectId, ref: "UserVoucher" }],
    voucherCodes: [{ type: String }],
    voucherSnapshot: {
      title: { type: String, required: true },
      category: { type: String, required: true },
      discountType: { type: String, enum: ["percentage", "fixed"], required: true },
      discountValue: { type: Number, required: true },
      maxDiscount: { type: Number, default: 0 },
      minSpend: { type: Number, default: 0 },
      durationHours: { type: Number, default: 0 },
      expiresInDays: { type: Number, default: 30 },
      tradable: { type: Boolean, default: true },
    },
    revokedAt: { type: Date, default: null },
    revokedByDiscordId: { type: String, default: null },
    revokedByName: { type: String, default: null },
  },
  { timestamps: true }
);

voucherGrantLogSchema.index({ createdAt: -1 });

if (process.env.NODE_ENV !== "production") {
  delete mongoose.models.VoucherGrantLog;
}

export default (mongoose.models.VoucherGrantLog as mongoose.Model<IVoucherGrantLog>) ||
  mongoose.model<IVoucherGrantLog>("VoucherGrantLog", voucherGrantLogSchema);
