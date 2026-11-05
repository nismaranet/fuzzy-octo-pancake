"use server";

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import clientPromise from "@/lib/mongodb";
import { revalidatePath } from "next/cache";

export async function getTrackerInfo() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.email) {
    return { success: false, message: "Unauthorized. Silakan login kembali." };
  }

  try {
    const client = await clientPromise;
    const db = client.db();
    const user = await db.collection("users").findOne({ email: session.user.email });

    if (!user) {
      return { success: false, message: "Pengguna tidak ditemukan." };
    }

    return {
      success: true,
      trackerToken: user.trackerToken || null,
      trackerLastSync: user.trackerLastSync ? new Date(user.trackerLastSync).toISOString() : null,
      trackerVersion: user.trackerVersion || null,
      isDriver: Boolean(user.isDriver),
    };
  } catch (error) {
    console.error("Get Tracker Info Error:", error);
    return { success: false, message: "Gagal mengambil informasi tracker." };
  }
}

export async function generateTrackerToken() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.email) {
    return { success: false, message: "Unauthorized. Silakan login kembali.", token: null };
  }

  try {
    const client = await clientPromise;
    const db = client.db();
    const usersCol = db.collection("users");

    const user = await usersCol.findOne({ email: session.user.email });
    if (!user) {
      return { success: false, message: "User tidak ditemukan.", token: null };
    }

    if (!user.isDriver && user.role !== "manager" && user.role !== "admin") {
      return {
        success: false,
        message: "Hanya Driver resmi Nismara Transport yang dapat membuat Tracker Token.",
        token: null,
      };
    }

    const crypto = await import("crypto");
    const part1 = crypto.randomBytes(3).toString("hex").toUpperCase();
    const part2 = crypto.randomBytes(3).toString("hex").toUpperCase();
    const part3 = crypto.randomBytes(3).toString("hex").toUpperCase();
    const part4 = crypto.randomBytes(3).toString("hex").toUpperCase();
    const newToken = `NSM-${part1}-${part2}-${part3}-${part4}`;

    await usersCol.updateOne(
      { _id: user._id },
      {
        $set: {
          trackerToken: newToken,
          updatedAt: new Date(),
        },
      }
    );

    revalidatePath("/dashboard/tracker");
    revalidatePath("/dashboard/settings");

    return {
      success: true,
      message: "Nismara Tracker Token baru berhasil dibuat!",
      token: newToken,
    };
  } catch (error) {
    console.error("Generate Tracker Token Error:", error);
    return { success: false, message: "Terjadi kesalahan internal saat membuat token.", token: null };
  }
}

export async function revokeTrackerToken() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.email) {
    return { success: false, message: "Unauthorized. Silakan login kembali." };
  }

  try {
    const client = await clientPromise;
    const db = client.db();
    const usersCol = db.collection("users");

    await usersCol.updateOne(
      { email: session.user.email },
      {
        $set: {
          trackerToken: null,
          updatedAt: new Date(),
        },
      }
    );

    revalidatePath("/dashboard/tracker");
    revalidatePath("/dashboard/settings");

    return {
      success: true,
      message: "Nismara Tracker Token berhasil dinonaktifkan.",
    };
  } catch (error) {
    console.error("Revoke Tracker Token Error:", error);
    return { success: false, message: "Gagal menonaktifkan token tracker." };
  }
}

