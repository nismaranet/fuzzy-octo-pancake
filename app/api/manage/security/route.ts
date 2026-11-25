import { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import SecurityAlert from "@/lib/models/SecurityAlert";
import dbConnect from "@/lib/mongoose";
import { jsonNoCache } from "@/lib/antiCache";
import { isWebOwner } from "@/lib/webConfig";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return jsonNoCache({ error: "Unauthorized" }, { status: 401 });
    }

    const isOwner = await isWebOwner(session.user.discordId);
    if (
      session.user.role !== "admin" &&
      session.user.role !== "manager" &&
      !isOwner
    ) {
      return jsonNoCache({ error: "Forbidden - Manager or Admin only" }, { status: 403 });
    }

    await dbConnect();

    const alerts = await SecurityAlert.find({})
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return jsonNoCache({ alerts });
  } catch (error: any) {
    console.error("Fetch Security Alerts Error:", error);
    return jsonNoCache(
      { error: "Failed to fetch security alerts" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return jsonNoCache({ error: "Unauthorized" }, { status: 401 });
    }

    const isOwner = await isWebOwner(session.user.discordId);
    if (
      session.user.role !== "admin" &&
      session.user.role !== "manager" &&
      !isOwner
    ) {
      return jsonNoCache({ error: "Forbidden - Manager or Admin only" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const alertId = String(body?.alertId || "").trim();
    if (!alertId) {
      return jsonNoCache({ error: "alertId is required" }, { status: 400 });
    }

    await dbConnect();
    const updated = await SecurityAlert.findByIdAndUpdate(
      alertId,
      { $set: { isResolved: true } },
      { returnDocument: "after" },
    ).lean();

    if (!updated) {
      return jsonNoCache({ error: "Alert not found" }, { status: 404 });
    }

    return jsonNoCache({ success: true, alert: updated });
  } catch (error: any) {
    console.error("Resolve Security Alert Error:", error);
    return jsonNoCache(
      { error: "Failed to resolve security alert" },
      { status: 500 }
    );
  }
}
