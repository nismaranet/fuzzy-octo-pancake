import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import Notification from "@/lib/models/Notification";
import { invalidateUserNotificationsCache } from "@/lib/services/NotificationService";
import dbConnect from "@/lib/mongoose";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.discordId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = await context.params;
    const { id } = params;

    await dbConnect();

    const discordId = String(session.user.discordId);

    const res = await Notification.updateOne(
      { _id: id },
      { $addToSet: { readBy: discordId } }
    );

    if (res.matchedCount === 0) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    await invalidateUserNotificationsCache(discordId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Notifications Read Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
