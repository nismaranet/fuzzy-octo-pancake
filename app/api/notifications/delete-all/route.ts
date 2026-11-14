import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import Notification from "@/lib/models/Notification";
import { invalidateUserNotificationsCache } from "@/lib/services/NotificationService";
import dbConnect from "@/lib/mongoose";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.discordId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const discordId = String(session.user.discordId);

    await Promise.all([
      // 1. Delete all personal notifications for this user
      Notification.deleteMany({ recipient: discordId }),
      // 2. Hide (soft-delete) all global notifications for this user
      Notification.updateMany(
        { recipient: "global", deletedBy: { $ne: discordId } },
        { $addToSet: { deletedBy: discordId } },
        { strict: false }
      ),
    ]);

    await invalidateUserNotificationsCache(discordId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Notifications Delete-All Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
