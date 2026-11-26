import mongoose, { Schema, Document } from "mongoose";

export type PayrollVoucherCategory =
  | "FLEET_MAINTENANCE"
  | "FLEET_BUY"
  | "MARKET_MOD"
  | "GARAGE_RENT"
  | "NC_BOOSTER";

export interface IPayrollVoucherItem {
  title: string;
  category: PayrollVoucherCategory;
  discountType: "percentage" | "fixed";
  discountValue: number;
  maxDiscount?: number;
  durationHours?: number;
  expireDays?: number;
}

export interface IPayrollTierItem {
  tier: number;
  label: string;
  bonusNc: number;
  penaltyTickets: number;
  fuelLiters: number;
  vouchers: IPayrollVoucherItem[];
}

export interface IPayrollRewardTemplate extends Document {
  slug: string;
  name: string;
  description: string;
  baseSalary: number;
  infiniteLoopStep: number;
  infiniteLoopBonusNc: number;
  infiniteLoopPenaltyTickets: number;
  tiers: IPayrollTierItem[];
  isActive: boolean;
  rotationOrder: number;
  authorDiscordId?: string | null;
  updatedByDiscordId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const PAYROLL_VOUCHER_CATEGORIES: PayrollVoucherCategory[] = [
  "FLEET_MAINTENANCE",
  "FLEET_BUY",
  "MARKET_MOD",
  "GARAGE_RENT",
  "NC_BOOSTER",
];

export const payrollVoucherItemSchema = new Schema<IPayrollVoucherItem>(
  {
    title: { type: String, required: true, trim: true, maxlength: 140 },
    category: {
      type: String,
      enum: PAYROLL_VOUCHER_CATEGORIES,
      required: true,
    },
    discountType: {
      type: String,
      enum: ["percentage", "fixed"],
      default: "percentage",
    },
    discountValue: { type: Number, required: true, min: 1 },
    maxDiscount: { type: Number, default: 0, min: 0 },
    durationHours: { type: Number, default: 0, min: 0 },
    expireDays: { type: Number, default: 60, min: 1 },
  },
  { _id: false }
);

export const payrollTierItemSchema = new Schema<IPayrollTierItem>(
  {
    tier: { type: Number, required: true, min: 1 },
    label: { type: String, required: true, trim: true, maxlength: 220 },
    bonusNc: { type: Number, default: 0, min: 0 },
    penaltyTickets: { type: Number, default: 0, min: 0 },
    fuelLiters: { type: Number, default: 0, min: 0 },
    vouchers: { type: [payrollVoucherItemSchema], default: [] },
  },
  { _id: false }
);

const payrollRewardTemplateSchema = new Schema<IPayrollRewardTemplate>(
  {
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 80 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: "", trim: true, maxlength: 400 },
    baseSalary: { type: Number, default: 10000, min: 0 },
    infiniteLoopStep: { type: Number, default: 10, min: 1 },
    infiniteLoopBonusNc: { type: Number, default: 5000, min: 0 },
    infiniteLoopPenaltyTickets: { type: Number, default: 1, min: 0 },
    tiers: { type: [payrollTierItemSchema], required: true },
    isActive: { type: Boolean, default: true },
    rotationOrder: { type: Number, default: 1, min: 1 },
    authorDiscordId: { type: String, default: null },
    updatedByDiscordId: { type: String, default: null },
  },
  {
    timestamps: true,
    collection: "payrollrewardtemplates",
  }
);

payrollRewardTemplateSchema.index({ slug: 1 }, { unique: true });
payrollRewardTemplateSchema.index({ isActive: 1, rotationOrder: 1 });

if (process.env.NODE_ENV !== "production") {
  delete mongoose.models.PayrollRewardTemplate;
}

export default (mongoose.models.PayrollRewardTemplate as mongoose.Model<IPayrollRewardTemplate>) ||
  mongoose.model<IPayrollRewardTemplate>("PayrollRewardTemplate", payrollRewardTemplateSchema);
