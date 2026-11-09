import { NextResponse } from "next/server";
import mongoose from "mongoose";
import clientPromise from "@/lib/mongodb";
import Garage from "@/lib/models/Garage";

import dbConnect from "@/lib/mongoose";

export const dynamic = "force-dynamic";

const GUILD_ID = "863959415702028318";
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

async function sendDiscordDM(discordId: string, message: string) {
  if (!DISCORD_BOT_TOKEN) return;

  try {
    const dmChannelRes = await fetch("https://discord.com/api/v10/users/@me/channels", {
      method: "POST",
      headers: {
        "Authorization": `Bot ${DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ recipient_id: discordId })
    });

    if (!dmChannelRes.ok) return;

    const dmChannel = await dmChannelRes.json();

    await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bot ${DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ content: message })
    });
  } catch (error) {
    console.error("Failed to send Discord DM:", error);
  }
}

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const client = await clientPromise;
    const db = client.db();
    const now = new Date();

    // Helper untuk menghitung jatuh tempo berikutnya (mempertahankan basis jam jatuh tempo asal)
    const calculateNextPaymentDate = (currentDueDate: Date | null): Date => {
      const base = currentDueDate ? new Date(currentDueDate) : new Date();
      const next = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000);
      // Jika server/cron tertunda lama sehingga tanggal berikutnya masih di masa lampau, loncat ke now + 30 hari
      if (next <= now) {
        return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      }
      return next;
    };

    // Cari garasi operational yang waktu bayarnya sudah lewat atau sama dengan sekarang
    // Menghindari infinite loop & spam DM Discord pada garasi yang sudah berstatus suspended
    const dueGarages = await Garage.find({
      status: "operational",
      next_payment_date: { $lte: now }
    });

    let processedCount = 0;
    let failedCount = 0;

    for (const garage of dueGarages) {
      // Jika cost 0, langsung perpanjang saja 30 hari tanpa potong saldo (misal slot 1 gratis)
      if (garage.operational_cost <= 0) {
        garage.next_payment_date = calculateNextPaymentDate(garage.next_payment_date);
        await garage.save();
        processedCount++;
        continue;
      }

      // 🛡️ ATOMIC DEDUCTION: Coba potong saldo secara atomik
      const deductRes = await db.collection("currencies").updateOne(
        { userId: garage.discordId, guildId: GUILD_ID, totalNC: { $gte: garage.operational_cost } },
        { $inc: { totalNC: -garage.operational_cost } }
      );
      
      if (deductRes.modifiedCount === 0) {
        // Gagal bayar karena saldo kurang
        failedCount++;
        
        // Ubah status jadi suspended (disita)
        garage.status = "suspended";
        await garage.save();
        
        // Kirim notifikasi peringatan (hanya terkirim 1 kali karena status berubah jadi suspended)
        await sendDiscordDM(
          garage.discordId,
          `🚨 **GARASI DISITA!** 🚨\nSaldo NC Anda tidak mencukupi untuk membayar biaya operasional garasi bulanan sebesar **${garage.operational_cost.toLocaleString('id-ID')} NC**. Seluruh akses ke garasi Anda dan Fuel Tank telah **DIKUNCI**. Silakan buat tiket (Ticket) di Discord Nismara untuk berdiskusi dengan Manajer agar tunggakan Anda dapat diselesaikan (misalnya: dengan menjual aset truk Anda).`
        );
        
      } else {
        // Berhasil bayar
        await db.collection("currencyhistories").insertOne({
          userId: garage.discordId,
          guildId: GUILD_ID,
          amount: garage.operational_cost,
          type: "spend",
          reason: `Biaya Operasional Garasi Bulanan`,
          createdAt: new Date(),
        });

        // Perpanjang 30 hari ke depan
        garage.next_payment_date = calculateNextPaymentDate(garage.next_payment_date);
        await garage.save();

        processedCount++;

        // Kirim notifikasi sukses
        await sendDiscordDM(
          garage.discordId,
          `✅ **Pembayaran Garasi Sukses!**\nBiaya operasional garasi sebesar **${garage.operational_cost.toLocaleString('id-ID')} NC** telah dipotong dari saldo Anda untuk 30 hari ke depan.`
        );
      }
    }

    return NextResponse.json({ 
      success: true, 
      processedPayments: processedCount,
      failedPayments: failedCount
    });

  } catch (error: any) {
    console.error("Cron Garage Rent Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
