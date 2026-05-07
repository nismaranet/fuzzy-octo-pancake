import mongoose, { Schema, models, Document } from "mongoose";

export interface ITeam extends Document {
  name: string;
  uri: string;
  tag: string;
  description?: string;
  logoUrl?: string;
  bannerUrl?: string;
  owner: mongoose.Types.ObjectId;
  members: mongoose.Types.ObjectId[];
  pendingRequests: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const TeamSchema = new Schema<ITeam>(
  {
    name: {
      type: String,
      required: [true, "Nama tim harus diisi"],
      unique: true,
      trim: true,
      maxLength: [50, "Nama tim tidak boleh lebih dari 50 karakter"],
    },
    uri: {
      type: String,
      required: [true, "Uri tim harus diisi"],
      unique: true,
      trim: true,
      maxLength: [50, "Uri tim tidak boleh lebih dari 50 karakter"],
    },
    tag: {
      type: String,
      required: [true, "Tag tim harus diisi"],
      unique: true,
      trim: true,
      uppercase: true,
      maxLength: [4, "Tag tim maksimal 5 karakter (contoh: NISM)"],
    },
    description: {
      type: String,
      maxLength: [500, "Deskripsi tidak boleh lebih dari 500 karakter"],
      default: "",
    },
    logoUrl: {
      type: String,
      default: "",
    },
    bannerUrl: {
      type: String,
      default: "",
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    members: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    pendingRequests: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true },
);

const Team = models.Team || mongoose.model<ITeam>("Team", TeamSchema);

export default Team;
