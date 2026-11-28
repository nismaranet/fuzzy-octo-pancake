"use server";

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import clientPromise from "@/lib/mongodb";
import { revalidatePath } from "next/cache";

function serializeDevices(rawDevices: unknown) {
  if (!Array.isArray(rawDevices)) return [];
  return rawDevices
    .filter((d): d is Record<string, unknown> => Boolean(d && typeof d === "object"))
    .map((d) => ({
      deviceId: String(d.deviceId || ""),
      deviceName: String(d.deviceName || "Unknown PC"),
      platform: String(d.platform || "Windows"),
      clientType: d.clientType === "plugin" ? ("plugin" as const) : ("companion" as const),
      clientVersion: d.clientVersion ? String(d.clientVersion) : null,
      lastGame: d.lastGame ? String(d.lastGame) : null,
      activeGame: d.activeGame ? String(d.activeGame) : null,
      lastInGameSyncAt: d.lastInGameSyncAt
        ? new Date(d.lastInGameSyncAt as string | Date).toISOString()
        : null,
      firstSeenAt: d.firstSeenAt
        ? new Date(d.firstSeenAt as string | Date).toISOString()
        : null,
      lastSyncAt: d.lastSyncAt
        ? new Date(d.lastSyncAt as string | Date).toISOString()
        : null,
      revoked: Boolean(d.revoked),
      revokedAt: d.revokedAt
        ? new Date(d.revokedAt as string | Date).toISOString()
        : null,
    }));
}

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

    if (!user.test_participation) {
      return {
        success: false,
        message: "Fitur Tracker saat ini hanya tersedia untuk peserta uji coba (tester).",
      };
    }

    return {
      success: true,
      trackerToken: user.trackerToken || null,
      trackerLastSync: user.trackerLastSync ? new Date(user.trackerLastSync).toISOString() : null,
      trackerVersion: user.trackerVersion || null,
      trackerLastGame: user.trackerLastGame || null,
      trackerDevices: serializeDevices(user.trackerDevices),
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

    if (!user.test_participation) {
      return {
        success: false,
        message: "Fitur Tracker saat ini hanya tersedia untuk peserta uji coba (tester).",
        token: null,
      };
    }

    if (!user.isDriver) {
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
          trackerDevices: [],
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

    const user = await usersCol.findOne({ email: session.user.email });
    if (!user) {
      return { success: false, message: "User tidak ditemukan." };
    }

    if (!user.test_participation) {
      return {
        success: false,
        message: "Fitur Tracker saat ini hanya tersedia untuk peserta uji coba (tester).",
      };
    }

    await usersCol.updateOne(
      { _id: user._id },
      {
        $set: {
          trackerToken: null,
          trackerDevices: [],
          updatedAt: new Date(),
        },
      }
    );

    revalidatePath("/dashboard/tracker");
    revalidatePath("/dashboard/settings");

    return {
      success: true,
      message: "Semua sesi perangkat berhasil diputuskan. Silakan Login with Discord ulang di perangkat Anda.",
    };
  } catch (error) {
    console.error("Revoke Tracker Token Error:", error);
    return { success: false, message: "Gagal menonaktifkan token tracker." };
  }
}

export async function revokeTrackerDevice(deviceId: string) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.email) {
    return { success: false, message: "Unauthorized. Silakan login kembali." };
  }

  const cleanId = String(deviceId || "").trim();
  if (!cleanId) {
    return { success: false, message: "ID perangkat tidak valid." };
  }

  try {
    const client = await clientPromise;
    const db = client.db();
    const usersCol = db.collection("users");
    const user = await usersCol.findOne({ email: session.user.email });

    if (!user || !user.test_participation) {
      return { success: false, message: "Akses ditolak." };
    }

    const now = new Date();
    const devices = Array.isArray(user.trackerDevices) ? user.trackerDevices : [];
    const updated = devices.map((d: Record<string, unknown>) =>
      d && d.deviceId === cleanId
        ? { ...d, revoked: true, revokedAt: now, activeGame: null }
        : d
    );

    await usersCol.updateOne(
      { _id: user._id },
      { $set: { trackerDevices: updated, updatedAt: now } }
    );

    revalidatePath("/dashboard/tracker");
    return {
      success: true,
      message: "Akses perangkat berhasil dicabut.",
      trackerDevices: serializeDevices(updated),
    };
  } catch (error) {
    console.error("Revoke Tracker Device Error:", error);
    return { success: false, message: "Gagal mencabut akses perangkat." };
  }
}

export async function restoreTrackerDevice(deviceId: string) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.email) {
    return { success: false, message: "Unauthorized. Silakan login kembali." };
  }

  const cleanId = String(deviceId || "").trim();
  if (!cleanId) {
    return { success: false, message: "ID perangkat tidak valid." };
  }

  try {
    const client = await clientPromise;
    const db = client.db();
    const usersCol = db.collection("users");
    const user = await usersCol.findOne({ email: session.user.email });

    if (!user || !user.test_participation) {
      return { success: false, message: "Akses ditolak." };
    }

    const now = new Date();
    const devices = Array.isArray(user.trackerDevices) ? user.trackerDevices : [];
    const updated = devices.map((d: Record<string, unknown>) =>
      d && d.deviceId === cleanId
        ? { ...d, revoked: false, revokedAt: null }
        : d
    );

    await usersCol.updateOne(
      { _id: user._id },
      { $set: { trackerDevices: updated, updatedAt: now } }
    );

    revalidatePath("/dashboard/tracker");
    return {
      success: true,
      message: "Akses perangkat berhasil diizinkan kembali.",
      trackerDevices: serializeDevices(updated),
    };
  } catch (error) {
    console.error("Restore Tracker Device Error:", error);
    return { success: false, message: "Gagal memulihkan akses perangkat." };
  }
}

export async function removeTrackerDevice(deviceId: string) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.email) {
    return { success: false, message: "Unauthorized. Silakan login kembali." };
  }

  const cleanId = String(deviceId || "").trim();
  if (!cleanId) {
    return { success: false, message: "ID perangkat tidak valid." };
  }

  try {
    const client = await clientPromise;
    const db = client.db();
    const usersCol = db.collection("users");
    const user = await usersCol.findOne({ email: session.user.email });

    if (!user || !user.test_participation) {
      return { success: false, message: "Akses ditolak." };
    }

    const now = new Date();
    const devices = Array.isArray(user.trackerDevices) ? user.trackerDevices : [];
    const updated = devices.filter(
      (d: Record<string, unknown>) => d && d.deviceId !== cleanId
    );

    await usersCol.updateOne(
      { _id: user._id },
      { $set: { trackerDevices: updated, updatedAt: now } }
    );

    revalidatePath("/dashboard/tracker");
    return {
      success: true,
      message: "Perangkat dihapus dari riwayat sesi.",
      trackerDevices: serializeDevices(updated),
    };
  } catch (error) {
    console.error("Remove Tracker Device Error:", error);
    return { success: false, message: "Gagal menghapus perangkat." };
  }
}

