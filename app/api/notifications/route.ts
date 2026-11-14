import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import Notification from "@/lib/models/Notification";
import { redis } from "@/lib/redis";
import dbConnect from "@/lib/mongoose";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(20, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)));
    const skip = (page - 1) * limit;

    const session = await getServerSession(authOptions);
    if (!session?.user?.discordId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const discordId = String(session.user.discordId);
    const globalVer = (await redis.get("notifications:global_ver").catch(() => "0")) || "0";
    const cacheKey = `notifications:v1:${discordId}:g${globalVer}:p${page}:l${limit}`;

    if (page === 1) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          return NextResponse.json(JSON.parse(cached));
        }
      } catch (err) {
        console.error("Redis read error in notifications GET:", err);
      }
    }

    await dbConnect();

    const query = {
      $or: [{ recipient: discordId }, { recipient: "global" }],
      deletedBy: { $ne: discordId },
    };

    const [notifications, total] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("_id title message type link readBy createdAt")
        .lean(),
      Notification.countDocuments(query),
    ]);

    const mapped = notifications.map((n: any) => ({
      _id: n._id,
      title: n.title,
      message: n.message,
      type: n.type,
      link: n.link,
      createdAt: n.createdAt,
      isRead: Array.isArray(n.readBy) && n.readBy.includes(discordId),
    }));

    const payload = {
      success: true,
      data: mapped,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    if (page === 1) {
      await redis.setex(cacheKey, 180, JSON.stringify(payload)).catch(() => null);
    }

    return NextResponse.json(payload);
  } catch (error: any) {
    console.error("Notifications GET Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
