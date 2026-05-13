// app/api/webhooks/midtrans/route.ts
import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { revalidatePath } from "next/cache";

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const client = await clientPromise;
    const db = client.db();

    // Log data untuk memantau apakah webhook masuk
    console.log("Webhook Received:", data.order_id, data.transaction_status);

    if (data.transaction_status === "settlement") {
      const [_, discordId] = data.order_id.split("-");
      const grossAmount = parseInt(data.gross_amount);

      // Hitung ulang poin berdasarkan harga yang kamu tetapkan
      // Sesuai log kamu: (34000 - 4000 biaya admin) / 3000 harga per poin = 10 poin
      const pointsReduced = Math.floor((grossAmount - 4000) / 3000);

      if (pointsReduced > 0) {
        await Promise.all([
          db.collection("points").updateOne(
            { userId: discordId },
            { $inc: { totalPoints: -pointsReduced } }
          ),
          db.collection("pointhistories").insertOne({
            userId: discordId,
            points: pointsReduced,
            reason: `Pembayaran IDR: ${data.order_id}`,
            type: "remove",
            createdAt: new Date(),
          })
        ]);
        
        console.log(`Poin untuk ${discordId} berhasil dikurangi: ${pointsReduced}`);
      }
    }

    return NextResponse.json({ status: "OK" });
  } catch (error) {
    console.error("Webhook Error:", error);
    return NextResponse.json({ status: "Error" }, { status: 500 });
  }
}