import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongoose";
import FuelMarketListing from "@/lib/models/FuelMarketListing";
import FuelPrice from "@/lib/models/FuelPrice";
import clientPromise from "@/lib/mongodb";
import { revalidatePath } from "next/cache";
import { updateFuelP2PMessage } from "@/lib/discordMarketNotifier";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.discordId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { listingId, newPrice } = await request.json();
    if (!listingId || !newPrice || Number(newPrice) <= 0) {
      return NextResponse.json({ error: "Listing ID dan Harga Baru (lebih dari 0) diperlukan" }, { status: 400 });
    }

    if (Number(newPrice) > 1.5) {
      return NextResponse.json({ error: "Harga jual maksimal adalah 1.5 NC per liter" }, { status: 400 });
    }

    const discordId = session.user.discordId;

    await dbConnect();
    
    const client = await clientPromise;
    const db = client.db();
    const userGarage = await db.collection("garages").findOne({ discordId });
    if (userGarage?.status === "suspended") {
      return NextResponse.json({ error: "Akses ditolak! Garasi Anda sedang dibekukan (disita) karena tunggakan biaya operasional." }, { status: 403 });
    }

    // 🛡️ ATOMIC UPDATE: Hanya update jika listing status masih persis "active" dan dimiliki oleh seller
    const updatedListing = await FuelMarketListing.findOneAndUpdate(
      { _id: listingId, status: "active", sellerDiscordId: discordId },
      { $set: { pricePerLiter: Number(newPrice) } },
      { returnDocument: "after" }
    );

    if (!updatedListing) {
      return NextResponse.json({ 
        error: "Gagal mengubah harga. Listing BBM ini sudah terjual, ditarik, atau Anda bukan pemilik listing ini." 
      }, { status: 400 });
    }

    // Update pesan Discord secara otomatis agar harga selalu sinkron tanpa spam pesan baru
    if (updatedListing.discordChannelId && updatedListing.discordMessageId) {
      try {
        const latestFuelPrice = await FuelPrice.findOne()
          .sort({ timestamp: -1 })
          .select("price")
          .lean<{ price?: number }>();
        await updateFuelP2PMessage(
          updatedListing.discordChannelId,
          updatedListing.discordMessageId,
          {
            sellerDiscordId: String(discordId),
            sellerName: session.user.name || "Driver",
            amount: updatedListing.amount,
            pricePerLiter: Number(newPrice),
            systemPrice: latestFuelPrice?.price || null,
            status: "active",
            isEdited: true,
          }
        );
      } catch (discordErr) {
        console.error("[Fuel P2P Edit] Discord update error:", discordErr);
      }
    }

    // Revalidasi cache
    try {
      revalidatePath("/fuel-market");
    } catch (e) {
      console.error("Failed to revalidate fuel market paths:", e);
    }

    return NextResponse.json({ 
      success: true, 
      message: "Harga jualan BBM berhasil diperbarui!" 
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "CDN-Cache-Control": "no-store",
        "Vercel-CDN-Cache-Control": "no-store",
      }
    });

  } catch (error: any) {
    console.error("Error editing P2P fuel listing:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
