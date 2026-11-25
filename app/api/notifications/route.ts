import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import clientPromise from "@/lib/mongodb";
import { redis } from "@/lib/redis";
import { jsonNoCache } from "@/lib/antiCache";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(20, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)));
    const skipCount = searchParams.get("skipCount") === "1";
    const skip = (page - 1) * limit;

    const session = await getServerSession(authOptions);
    if (!session?.user?.discordId) {
      return jsonNoCache({ error: "Unauthorized" }, { status: 401 });
    }

    const discordId = String(session.user.discordId);
    const globalVer = (await redis.get("notifications:global_ver").catch(() => "0")) || "0";
    const cacheKey = `notifications:v1:${discordId}:g${globalVer}:p${page}:l${limit}${skipCount ? ":sc" : ""}`;

    if (page === 1) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          return jsonNoCache(JSON.parse(cached));
        }
      } catch (err) {
        console.error("Redis read error in notifications GET:", err);
      }
    }

    const client = await clientPromise;
    const col = client.db().collection("notifications");

    const query = {
      recipient: { $in: [discordId, "global"] },
      deletedBy: { $ne: discordId },
    };

    const [notifications, total] = await Promise.all([
      col
        .find(query, {
          projection: {
            _id: 1,
            title: 1,
            message: 1,
            type: 1,
            link: 1,
            readBy: 1,
            createdAt: 1,
          },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      skipCount ? Promise.resolve(null) : col.countDocuments(query),
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

    const resolvedTotal = total ?? mapped.length;
    const payload = {
      success: true,
      data: mapped,
      pagination: {
        page,
        limit,
        total: resolvedTotal,
        totalPages: Math.ceil(resolvedTotal / limit),
      },
    };

    if (page === 1) {
      await redis.setex(cacheKey, 180, JSON.stringify(payload)).catch(() => null);
    }

    return jsonNoCache(payload);
  } catch (error: any) {
    console.error("Notifications GET Error:", error);
    return jsonNoCache({ error: "Internal Server Error" }, { status: 500 });
  }
}
