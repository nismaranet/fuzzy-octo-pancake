import crypto from "crypto";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import mongoose from "mongoose";
import dbConnect from "@/lib/mongoose";
import { redis } from "@/lib/redis";
import { jsonNoCache } from "@/lib/antiCache";
import CommunityMarketListing from "@/lib/models/CommunityMarketListing";
import CommunityMarketBuyOrder from "@/lib/models/CommunityMarketBuyOrder";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const type = body.type === "buy_order" ? "buy_order" : "listing";
    const id = String(body.id || "");

    if (!id) {
      return jsonNoCache({ success: false, error: "ID diperlukan." }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    const forwarded = request.headers.get("x-forwarded-for") || "anon";
    const ip = forwarded.split(",")[0].trim();
    const viewerRaw = session?.user?.discordId
      ? `u:${session.user.discordId}`
      : `ip:${ip}`;
    const viewerHash = crypto.createHash("sha256").update(viewerRaw).digest("hex").slice(0, 16);

    const dedupKey = `cm:view:${type}:${id}:${viewerHash}`;
    let shouldIncrement = true;

    try {
      const acquired = await redis.set(dedupKey, "1", "EX", 6 * 3600, "NX");
      if (!acquired) {
        shouldIncrement = false;
      }
    } catch {
      // Fallback if Redis unavailable
    }

    await dbConnect();
    const query = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id }
      : { slug: id };

    if (shouldIncrement) {
      if (type === "buy_order") {
        const updated = await CommunityMarketBuyOrder.findOneAndUpdate(
          query,
          { $inc: { views: 1 } },
          { returnDocument: "after", projection: { views: 1 } }
        ).lean();
        return jsonNoCache({ success: true, incremented: true, views: updated?.views ?? 0 });
      } else {
        const updated = await CommunityMarketListing.findOneAndUpdate(
          query,
          { $inc: { views: 1 } },
          { returnDocument: "after", projection: { views: 1 } }
        ).lean();
        return jsonNoCache({ success: true, incremented: true, views: updated?.views ?? 0 });
      }
    }

    const current =
      type === "buy_order"
        ? await CommunityMarketBuyOrder.findOne(query, { views: 1 }).lean()
        : await CommunityMarketListing.findOne(query, { views: 1 }).lean();

    return jsonNoCache({
      success: true,
      incremented: false,
      views: current?.views ?? 0,
    });
  } catch (err: any) {
    console.error("[CM View] Error:", err);
    return jsonNoCache({ success: false, error: "Gagal mencatat view." }, { status: 500 });
  }
}
