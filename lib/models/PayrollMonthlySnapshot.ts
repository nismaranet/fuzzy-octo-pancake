import mongoose, { Schema, Document } from "mongoose";
import {
  payrollTierItemSchema,
  type IPayrollTierItem,
} from "@/lib/models/PayrollRewardTemplate";

export interface IPayrollMonthlySnapshot extends Document {
  month: string; // Format "YYYY-MM"
  templateId?: mongoose.Types.ObjectId | null;
  templateSlug: string;
  templateName: string;
  isManualOverride: boolean;
  baseSalary: number;
  infiniteLoopStep: number;
  infiniteLoopBonusNc: number;
  infiniteLoopPenaltyTickets: number;
  tiers: IPayrollTierItem[];
  lockedAt: Date;
  authorDiscordId?: string | null;
  updatedByDiscordId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const payrollMonthlySnapshotSchema = new Schema<IPayrollMonthlySnapshot>(
  {
    month: { type: String, required: true, trim: true },
    templateId: {
      type: Schema.Types.ObjectId,
      ref: "PayrollRewardTemplate",
      default: null,
    },
    templateSlug: { type: String, required: true, trim: true },
    templateName: { type: String, required: true, trim: true, maxlength: 140 },
    isManualOverride: { type: Boolean, default: false },
    baseSalary: { type: Number, default: 10000, min: 0 },
    infiniteLoopStep: { type: Number, default: 10, min: 1 },
    infiniteLoopBonusNc: { type: Number, default: 5000, min: 0 },
    infiniteLoopPenaltyTickets: { type: Number, default: 1, min: 0 },
    tiers: { type: [payrollTierItemSchema], required: true },
    lockedAt: { type: Date, default: () => new Date() },
    authorDiscordId: { type: String, default: null },
    updatedByDiscordId: { type: String, default: null },
  },
  {
    timestamps: true,
    collection: "payrollmonthlysnapshots",
  }
);

payrollMonthlySnapshotSchema.index({ month: 1 }, { unique: true });

if (process.env.NODE_ENV !== "production") {
  delete mongoose.models.PayrollMonthlySnapshot;
}

export default (mongoose.models.PayrollMonthlySnapshot as mongoose.Model<IPayrollMonthlySnapshot>) ||
  mongoose.model<IPayrollMonthlySnapshot>(
    "PayrollMonthlySnapshot",
    payrollMonthlySnapshotSchema
  );
