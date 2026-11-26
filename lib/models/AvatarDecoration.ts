import mongoose, { Schema, Document } from "mongoose";
import type {
  AvatarDecorationAccess,
  AvatarDecorationCategory,
  AvatarDecorationRarity,
} from "@/lib/avatarDecorations";

export interface IAvatarDecoration extends Document {
  slug: string;
  name: string;
  description: string;
  category: AvatarDecorationCategory;
  rarity: AvatarDecorationRarity;
  access: AvatarDecorationAccess;
  renderType: "svg" | "image";
  svgPresetKey?: string | null;
  assetUrl?: string | null;
  scale: number;
  accentColor: string;
  isActive: boolean;
  sortOrder: number;
  availableFrom?: Date | null;
  availableUntil?: Date | null;
  authorDiscordId?: string | null;
  updatedByDiscordId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const avatarDecorationSchema = new Schema<IAvatarDecoration>(
  {
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 80,
    },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, default: "", trim: true, maxlength: 300 },
    category: {
      type: String,
      enum: ["signature", "automotive", "aesthetic", "cosmic", "event", "staff"],
      default: "signature",
    },
    rarity: {
      type: String,
      enum: ["common", "exclusive", "epic", "legendary", "seasonal"],
      default: "exclusive",
    },
    access: {
      type: String,
      enum: ["free", "nismara_plus", "event", "staff", "top_manager"],
      default: "nismara_plus",
    },
    renderType: {
      type: String,
      enum: ["svg", "image"],
      default: "image",
    },
    svgPresetKey: { type: String, default: null, trim: true },
    assetUrl: { type: String, default: null, trim: true },
    scale: { type: Number, default: 1.28, min: 1.0, max: 1.6 },
    accentColor: { type: String, default: "#8b5cf6", trim: true, maxlength: 32 },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 100, min: 0 },
    availableFrom: { type: Date, default: null },
    availableUntil: { type: Date, default: null },
    authorDiscordId: { type: String, default: null },
    updatedByDiscordId: { type: String, default: null },
  },
  {
    timestamps: true,
    collection: "avatardecorations",
  },
);

avatarDecorationSchema.index({ slug: 1 }, { unique: true });
avatarDecorationSchema.index({ isActive: 1, sortOrder: 1 });

if (process.env.NODE_ENV !== "production") {
  delete mongoose.models.AvatarDecoration;
}

export default (mongoose.models.AvatarDecoration as mongoose.Model<IAvatarDecoration>) ||
  mongoose.model<IAvatarDecoration>("AvatarDecoration", avatarDecorationSchema);
