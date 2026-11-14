import mongoose from "mongoose";
import clientPromise from "@/lib/mongodb";
import Notification from "@/lib/models/Notification";
import { redis } from "@/lib/redis";

/**
 * Invalidate cached notifications for a specific user (or global version bump)
 */
export async function invalidateUserNotificationsCache(discordId: string) {
  try {
    const globalVer = (await redis.get("notifications:global_ver").catch(() => "0")) || "0";
    await Promise.all([
      redis.del(`notifications:v1:${discordId}:g${globalVer}:p1:l5`),
      redis.del(`notifications:v1:${discordId}:g${globalVer}:p1:l10`),
    ]);
  } catch (err) {
    console.error("Failed to invalidate user notifications cache:", err);
  }
}

/**
 * Send a notification to a specific user via their Discord ID.
 */
export async function sendPersonalNotification(
  discordId: string,
  title: string,
  message: string,
  type: "info" | "warning" | "success" | "error" | "system" = "info",
  link?: string
) {
  try {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI!);
    }
    
    // Automatically expire personal notifications after 30 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const notification = await Notification.create({
      recipient: discordId,
      title,
      message,
      type,
      link,
      expiresAt
    });

    await invalidateUserNotificationsCache(discordId);

    return { success: true, data: notification };
  } catch (error: any) {
    console.error("Failed to send personal notification:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Send a global broadcast notification to ALL users.
 */
export async function sendGlobalNotification(
  title: string,
  message: string,
  type: "info" | "warning" | "success" | "error" | "system" = "system",
  link?: string
) {
  try {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI!);
    }

    // Automatically expire global notifications after 14 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14);

    const notification = await Notification.create({
      recipient: "global",
      title,
      message,
      type,
      link,
      expiresAt
    });

    // Bump global notifications cache version so all users see the new broadcast
    await redis.incr("notifications:global_ver").catch(() => null);

    return { success: true, data: notification };
  } catch (error: any) {
    console.error("Failed to send global notification:", error);
    return { success: false, error: error.message };
  }
}
