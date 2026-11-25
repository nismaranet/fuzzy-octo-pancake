import { NextResponse } from "next/server";
import mongoose from "mongoose";
import clientPromise from "@/lib/mongodb";
import Garage from "@/lib/models/Garage";
import Notification from "@/lib/models/Notification";
import { calculateVoucherDiscount } from "@/lib/voucher";

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

    // Ambil daftar user yang sedang dalam masa Hold 90 Hari agar garasi mereka dibekukan (tidak ditagih/disita)
    const heldUsers = await db
      .collection("users")
      .find({ "accountHold.status": true }, { projection: { discordId: 1 } })
      .toArray();
    const heldDiscordIds = new Set(heldUsers.map((u: any) => String(u.discordId)));

    // Cari garasi operational yang waktu bayarnya sudah lewat atau sama dengan sekarang
    // Menghindari infinite loop & spam DM Discord pada garasi yang sudah berstatus suspended
    const dueGarages = await Garage.find({
      status: "operational",
      next_payment_date: { $lte: now }
    });

    let processedCount = 0;
    let failedCount = 0;

    for (const garage of dueGarages) {
      if (garage.discordId && heldDiscordIds.has(String(garage.discordId))) {
        continue;
      }
      const baseCost = Number(garage.operational_cost || 0);
      // Jika cost 0, langsung perpanjang saja 30 hari tanpa potong saldo (misal slot 1 gratis)
      if (baseCost <= 0) {
        garage.next_payment_date = calculateNextPaymentDate(garage.next_payment_date);
        await garage.save();
        processedCount++;
        continue;
      }

      // Cek apakah driver sudah memasang voucher diskon operasional garasi (pendingRentVoucher)
      const pendingVoucher = garage.pendingRentVoucher?.voucherId
        ? garage.pendingRentVoucher
        : null;
      const voucherDiscount = pendingVoucher
        ? calculateVoucherDiscount(baseCost, pendingVoucher)
        : 0;
      const finalCost = Math.max(0, baseCost - voucherDiscount);

      // Kasus khusus: Voucher diskon 100% sehingga tagihan jadi 0 NC (Gratis)
      if (finalCost === 0 && pendingVoucher) {
        garage.next_payment_date = calculateNextPaymentDate(garage.next_payment_date);
        garage.pendingRentVoucher = {
          voucherId: null,
          code: null,
          title: null,
          discountType: null,
          discountValue: 0,
          maxDiscount: 0,
          minSpend: 0,
          appliedAt: null,
        };
        await garage.save();
        processedCount++;

        await sendDiscordDM(
          garage.discordId,
          `✅ **Pembayaran Garasi Gratis 100%!**\nVoucher **${pendingVoucher.title || pendingVoucher.code}** telah diterapkan otomatis pada tagihan operasional garasi Anda (Hemat **${voucherDiscount.toLocaleString("id-ID")} NC**). Garasi diperpanjang untuk 30 hari ke depan!`
        );
        try {
          await Notification.create({
            recipient: String(garage.discordId),
            title: "Operasional Garasi Gratis via Voucher!",
            message: `Voucher "${pendingVoucher.title || pendingVoucher.code}" menghemat ${voucherDiscount.toLocaleString("id-ID")} NC penuh. Garasi Anda diperpanjang 30 hari.`,
            type: "success",
            link: "/dashboard/garage",
          });
        } catch {
          // Non-fatal
        }
        continue;
      }

      // 🛡️ ATOMIC DEDUCTION: Coba potong saldo secara atomik sebesar finalCost
      const deductRes = await db.collection("currencies").updateOne(
        { userId: garage.discordId, guildId: GUILD_ID, totalNC: { $gte: finalCost } },
        { $inc: { totalNC: -finalCost } }
      );
      
      if (deductRes.modifiedCount === 0) {
        // Gagal bayar karena saldo kurang
        failedCount++;
        
        // Ubah status jadi suspended (disita)
        garage.status = "suspended";
        await garage.save();
        
        // Kirim notifikasi peringatan (hanya terkirim 1 kali karena status berubah jadi suspended)
        const discountNote = pendingVoucher
          ? ` (setelah diskon voucher -${voucherDiscount.toLocaleString("id-ID")} NC dari ${baseCost.toLocaleString("id-ID")} NC)`
          : "";
        await sendDiscordDM(
          garage.discordId,
          `🚨 **GARASI DISITA!** 🚨\nSaldo NC Anda tidak mencukupi untuk membayar biaya operasional garasi bulanan sebesar **${finalCost.toLocaleString("id-ID")} NC**${discountNote}. Seluruh akses ke garasi Anda dan Fuel Tank telah **DIKUNCI**. Silakan buat tiket (Ticket) di Discord Nismara untuk berdiskusi dengan Manajer agar tunggakan Anda dapat diselesaikan (misalnya: dengan menjual aset truk Anda).`
        );
        
      } else {
        // Berhasil bayar
        const historyReason = pendingVoucher
          ? `Biaya Operasional Garasi Bulanan (Voucher ${pendingVoucher.code}: Hemat ${voucherDiscount.toLocaleString("id-ID")} NC)`
          : `Biaya Operasional Garasi Bulanan`;

        await db.collection("currencyhistories").insertOne({
          userId: garage.discordId,
          guildId: GUILD_ID,
          amount: finalCost,
          type: "spend",
          reason: historyReason,
          createdAt: new Date(),
        });

        // Perpanjang 30 hari ke depan & bersihkan voucher yang sudah terpakai
        garage.next_payment_date = calculateNextPaymentDate(garage.next_payment_date);
        if (pendingVoucher) {
          garage.pendingRentVoucher = {
            voucherId: null,
            code: null,
            title: null,
            discountType: null,
            discountValue: 0,
            maxDiscount: 0,
            minSpend: 0,
            appliedAt: null,
          };
        }
        await garage.save();

        processedCount++;

        // Kirim notifikasi sukses
        const dmMsg = pendingVoucher
          ? `✅ **Pembayaran Garasi Sukses!**\nBiaya operasional garasi sebesar **${finalCost.toLocaleString("id-ID")} NC** *(hemat **${voucherDiscount.toLocaleString("id-ID")} NC** berkat voucher ${pendingVoucher.title || pendingVoucher.code})* telah dipotong untuk 30 hari ke depan.`
          : `✅ **Pembayaran Garasi Sukses!**\nBiaya operasional garasi sebesar **${finalCost.toLocaleString("id-ID")} NC** telah dipotong dari saldo Anda untuk 30 hari ke depan.`;

        await sendDiscordDM(garage.discordId, dmMsg);
        if (pendingVoucher) {
          try {
            await Notification.create({
              recipient: String(garage.discordId),
              title: "Voucher Operasional Garasi Terpakai",
              message: `Tagihan garasi terpotong ${finalCost.toLocaleString("id-ID")} NC (hemat ${voucherDiscount.toLocaleString("id-ID")} NC dari voucher ${pendingVoucher.code}).`,
              type: "success",
              link: "/dashboard/garage",
            });
          } catch {
            // Non-fatal
          }
        }
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
