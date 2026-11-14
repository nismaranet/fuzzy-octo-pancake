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

    const res = await Notification.updateMany(
      {
        $or: [{ recipient: discordId }, { recipient: "global" }],
        readBy: { $ne: discordId },
      },
      { $addToSet: { readBy: discordId } }
    );

    await invalidateUserNotificationsCache(discordId);

    return NextResponse.json({ success: true, count: res.modifiedCount });
  } catch (error: any) {
    console.error("Notifications Read-All Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
