import mongoose, { Schema, Document } from "mongoose";

export type ChangelogProduct = "web" | "natasya" | "tracker";
export type ChangelogStatus = "draft" | "published";

export interface IChangelogSections {
  added: string[];
  improved: string[];
  fixed: string[];
}

export interface IChangelogEntry extends Document {
  product: ChangelogProduct;
  version: string;
  title: string;
  summary: string;
  releaseDate: Date;
  status: ChangelogStatus;
  sections: IChangelogSections;
  articleUrl?: string | null;
  highlightFeatureUrl?: string | null;
  highlightFeatureLabel?: string | null;
  authorDiscordId?: string | null;
  updatedByDiscordId?: string | null;
  publishedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const changelogEntrySchema = new Schema<IChangelogEntry>(
  {
    product: {
      type: String,
      enum: ["web", "natasya", "tracker"],
      required: true,
      index: true,
    },
    version: {
      type: String,
      required: true,
      trim: true,
      maxlength: 32,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    summary: {
      type: String,
      required: true,
      trim: true,
      maxlength: 800,
    },
    releaseDate: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
      index: true,
    },
    sections: {
      added: { type: [String], default: [] },
      improved: { type: [String], default: [] },
      fixed: { type: [String], default: [] },
    },
    articleUrl: { type: String, trim: true, default: null, maxlength: 500 },
    highlightFeatureUrl: { type: String, trim: true, default: null, maxlength: 500 },
    highlightFeatureLabel: { type: String, trim: true, default: null, maxlength: 80 },
    authorDiscordId: { type: String, default: null, index: true },
    updatedByDiscordId: { type: String, default: null },
    publishedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: "changelogs",
  }
);

changelogEntrySchema.index({ product: 1, version: 1 }, { unique: true });
changelogEntrySchema.index({ product: 1, status: 1, releaseDate: -1 });

if (process.env.NODE_ENV !== "production") {
  delete mongoose.models.ChangelogEntry;
}

export default (mongoose.models.ChangelogEntry as mongoose.Model<IChangelogEntry>) ||
  mongoose.model<IChangelogEntry>("ChangelogEntry", changelogEntrySchema);
