import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import clientPromise from "@/lib/mongodb";
import mongoose from "mongoose";
import FleetOrder from "@/lib/models/FleetOrder";

import dbConnect from "@/lib/mongoose";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.discordId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isManager =
      session.user.role === "manager" ||
      session.user.role === "admin";

    if (!isManager) {
      return NextResponse.json(
        { error: "Hanya Manager atau Admin yang memiliki akses untuk mengambil order armada" },
        { status: 403 }
      );
    }

    await dbConnect();

    // 🛡️ ATOMIC CLAIM: Kunci order hanya jika status masih pending
    const order = await FleetOrder.findOneAndUpdate(
      { _id: params.id, status: "pending" },
      { $set: { status: "claimed", managerId: String(session.user.discordId) } },
      { new: true }
    );

    if (!order) {
      return NextResponse.json(
        { error: "Order tidak ditemukan atau sudah diambil oleh staff lain" },
        { status: 400 }
      );
    }

    // Optionally notify in discord - Non-blocking
    const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
    if (DISCORD_BOT_TOKEN && order.discordChannelId) {
      fetch(`https://discord.com/api/v10/channels/${order.discordChannelId}/messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bot ${DISCORD_BOT_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          content: `Tiket ini telah diambil oleh <@${session.user.discordId}>. Pemesanan sedang diproses.`
        })
      }).catch(console.error);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Fleet Order Claim Error:", error);
    return NextResponse.json({ error: "Terjadi kesalahan internal saat mengambil order" }, { status: 500 });
  }
}
