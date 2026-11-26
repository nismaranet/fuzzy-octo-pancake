import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import clientPromise from "@/lib/mongodb";
import dbConnect from "@/lib/mongoose";
import { jsonNoCache } from "@/lib/antiCache";
import { checkRateLimit } from "@/lib/rateLimit";
import CommunityMarketListing from "@/lib/models/CommunityMarketListing";
import CommunityMarketTrade from "@/lib/models/CommunityMarketTrade";
import UserVoucher from "@/lib/models/UserVoucher";
import Transaction from "@/lib/models/Transaction";
import Notification from "@/lib/models/Notification";
import {
  getCommunityMarketConfig,
  calculateSafeboxCapacity,
} from "@/lib/communityMarketConfig";
import {
  GUILD_ID,
  generateTradeTrxId,
  sweepExpiredCommunityMarketItems,
} from "@/lib/communityMarket";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let listingIdToRollback: mongoose.Types.ObjectId | null = null;
  let qtyToRollback = 0;
  let buyerChargedAmount = 0;
  let buyerDiscordIdForRollback = "";

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.discordId) {
      return jsonNoCache({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!session.user.isDriver) {
      return jsonNoCache(
        { success: false, error: "Hanya driver resmi Nismara yang dapat bertransaksi." },
        { status: 403 }
      );
    }

    const buyerDiscordId = String(session.user.discordId);
    buyerDiscordIdForRollback = buyerDiscordId;

    if (!checkRateLimit(buyerDiscordId, "cm-buy-listing", 2000)) {
      return jsonNoCache(
        { success: false, error: "Mohon tunggu sebentar sebelum melakukan pembelian lagi." },
        { status: 429 }
      );
    }

    await dbConnect();
    await sweepExpiredCommunityMarketItems();

    const config = await getCommunityMarketConfig();
    if (!config.enabled) {
      return jsonNoCache(
        { success: false, error: "Community Market sedang dalam pemeliharaan." },
        { status: 503 }
      );
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const requestedQty = Math.max(1, Math.floor(Number(body.quantity || 1)));

    const lookupQuery = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id }
      : { slug: id };

    const preview = await CommunityMarketListing.findOne(lookupQuery).lean();
    if (!preview) {
      return jsonNoCache({ success: false, error: "Iklan tidak ditemukan." }, { status: 404 });
    }
    if (String(preview.sellerDiscordId) === buyerDiscordId) {
      return jsonNoCache(
        { success: false, error: "Anda tidak dapat membeli barang dari iklan milik sendiri." },
        { status: 400 }
      );
    }
    if (preview.status !== "active" || preview.remainingQuantity < 1) {
      return jsonNoCache(
        { success: false, error: "Iklan ini sudah terjual, dibatalkan, atau berakhir." },
        { status: 400 }
      );
    }

    const now = new Date();
    if (new Date(preview.expiresAt) <= now) {
      return jsonNoCache(
        { success: false, error: "Iklan ini sudah kedaluwarsa." },
        { status: 400 }
      );
    }

    const qty = preview.itemType === "VOUCHER" ? 1 : requestedQty;
    if (qty > preview.remainingQuantity) {
      return jsonNoCache(
        {
          success: false,
          error: `Stok tersisa hanya ${preview.remainingQuantity} unit.`,
        },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db();

    const [buyerUser, sellerUser, buyerGarage] = await Promise.all([
      db.collection("users").findOne({ discordId: buyerDiscordId }),
      db.collection("users").findOne({ discordId: String(preview.sellerDiscordId) }),
      db.collection("garages").findOne({ discordId: buyerDiscordId }),
    ]);

    if (!buyerUser) {
      return jsonNoCache({ success: false, error: "Data akun pembeli tidak ditemukan." }, { status: 404 });
    }

    if (preview.itemType === "PENALTY_TICKET") {
      if (!buyerGarage) {
        return jsonNoCache(
          {
            success: false,
            error: "Buka halaman Garasi Anda terlebih dahulu untuk mengaktifkan Safebox sebelum membeli tiket.",
          },
          { status: 400 }
        );
      }
      if (buyerGarage.status === "suspended") {
        return jsonNoCache(
          { success: false, error: "Garasi Anda sedang dibekukan karena tunggakan biaya operasional." },
          { status: 403 }
        );
      }
      const maxCap = calculateSafeboxCapacity(buyerGarage.safeboxLevel);
      const currentStock = Number(buyerGarage.safeboxStock || 0);
      if (currentStock + qty > maxCap) {
        return jsonNoCache(
          {
            success: false,
            error: `Kapasitas Safebox tidak cukup (${currentStock}/${maxCap} tiket). Upgrade Safebox Anda di Garasi atau beli maksimal ${Math.max(0, maxCap - currentStock)} tiket.`,
          },
          { status: 400 }
        );
      }
    }

    const grossAmount = preview.unitPrice * qty;
    const feePercent = config.transactionFeePercent;
    const feeAmount = Math.round(grossAmount * (feePercent / 100));
    const netSellerPayout = Math.max(0, grossAmount - feeAmount);

    // Atomic Gate 1: Kurangi stok listing secara atomik
    const lockedListing = await CommunityMarketListing.findOneAndUpdate(
      {
        _id: preview._id,
        status: "active",
        sellerDiscordId: { $ne: buyerDiscordId },
        remainingQuantity: { $gte: qty },
        expiresAt: { $gt: now },
      },
      [
        {
          $set: {
            remainingQuantity: { $subtract: ["$remainingQuantity", qty] },
          },
        },
        {
          $set: {
            status: {
              $cond: [{ $lte: ["$remainingQuantity", 0] }, "sold", "active"],
            },
            soldAt: {
              $cond: [{ $lte: ["$remainingQuantity", 0] }, now, "$soldAt"],
            },
          },
        },
      ],
      { returnDocument: "after", updatePipeline: true }
    );

    if (!lockedListing) {
      return jsonNoCache(
        {
          success: false,
          error: "Stok item baru saja dibeli driver lain atau iklan telah berakhir.",
        },
        { status: 409 }
      );
    }
    listingIdToRollback = lockedListing._id as mongoose.Types.ObjectId;
    qtyToRollback = qty;

    // Atomic Gate 2: Potong saldo NC pembeli secara atomik
    const deductBuyer = await db.collection("currencies").updateOne(
      { userId: buyerDiscordId, guildId: GUILD_ID, totalNC: { $gte: grossAmount } },
      { $inc: { totalNC: -grossAmount } }
    );

    if (deductBuyer.modifiedCount === 0) {
      // Rollback listing
      await CommunityMarketListing.updateOne(
        { _id: listingIdToRollback },
        {
          $inc: { remainingQuantity: qtyToRollback },
          $set: { status: "active", soldAt: null },
        }
      );
      listingIdToRollback = null;
      qtyToRollback = 0;

      return jsonNoCache(
        {
          success: false,
          error: `Saldo NC tidak mencukupi. Diperlukan ${grossAmount.toLocaleString("id-ID")} NC.`,
        },
        { status: 400 }
      );
    }
    buyerChargedAmount = grossAmount;

    // Step 3: Transfer Aset ke Pembeli (100% utuh, tidak mengubah nilai diskon/maxDiscount voucher)
    if (lockedListing.itemType === "VOUCHER" && lockedListing.itemRefId) {
      const transferRes = await UserVoucher.findOneAndUpdate(
        {
          _id: lockedListing.itemRefId,
          discordId: String(lockedListing.sellerDiscordId),
          status: "LISTED",
        },
        {
          $set: {
            discordId: buyerDiscordId,
            userId: buyerUser._id,
            status: "ACTIVE",
          },
        },
        { returnDocument: "after" }
      );
      if (!transferRes) {
        throw new Error("Voucher tidak ditemukan atau statusnya tidak sinkron saat transfer.");
      }
    } else if (lockedListing.itemType === "PENALTY_TICKET") {
      const maxCap = calculateSafeboxCapacity(buyerGarage?.safeboxLevel);
      const safeboxCredit = await db.collection("garages").updateOne(
        {
          discordId: buyerDiscordId,
          status: { $ne: "suspended" },
          safeboxStock: { $lte: maxCap - qty },
        },
        { $inc: { safeboxStock: qty } }
      );
      if (safeboxCredit.modifiedCount === 0) {
        throw new Error("Kapasitas Safebox pembeli penuh saat proses transfer tiket.");
      }
    }

    // Step 4: Kredit Penjual (netSellerPayout setelah pajak 11%)
    await db.collection("currencies").updateOne(
      { userId: String(lockedListing.sellerDiscordId), guildId: GUILD_ID },
      {
        $inc: { totalNC: netSellerPayout },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true }
    );

    const trxId = generateTradeTrxId();
    const itemLabel =
      qty > 1 ? `${qty}x ${lockedListing.itemSnapshot.title}` : lockedListing.itemSnapshot.title;

    // Step 5: Catat Currency History, Transactions (2 sisi), CommunityMarketTrade & Notifikasi
    await Promise.all([
      db.collection("currencyhistories").insertMany([
        {
          userId: buyerDiscordId,
          guildId: GUILD_ID,
          amount: grossAmount,
          type: "spend",
          reason: `Membeli di Community Market: ${itemLabel}`,
          createdAt: now,
        },
        {
          userId: String(lockedListing.sellerDiscordId),
          guildId: GUILD_ID,
          amount: netSellerPayout,
          type: "earn",
          reason: `Penjualan Community Market: ${itemLabel} (Potongan pajak ${feePercent}%: ${feeAmount.toLocaleString("id-ID")} NC)`,
          createdAt: now,
        },
      ]),
      Transaction.create({
        trxId,
        discordId: buyerDiscordId,
        userId: buyerUser._id,
        title: `Beli Community Market: ${itemLabel}`,
        category: "market",
        amount: grossAmount,
        currency: "NC",
        status: "success",
        metadata: {
          subCategory: "community_market_buy",
          listingId: String(lockedListing._id),
          slug: lockedListing.slug,
          itemType: lockedListing.itemType,
          quantity: qty,
          unitPrice: lockedListing.unitPrice,
          sellerDiscordId: String(lockedListing.sellerDiscordId),
        },
      }),
      ...(sellerUser
        ? [
            Transaction.create({
              trxId: `${trxId}-SELL`,
              discordId: String(lockedListing.sellerDiscordId),
              userId: sellerUser._id,
              title: `Terjual di Community Market: ${itemLabel}`,
              category: "market",
              amount: netSellerPayout,
              currency: "NC",
              status: "success",
              metadata: {
                subCategory: "community_market_sell",
                listingId: String(lockedListing._id),
                slug: lockedListing.slug,
                itemType: lockedListing.itemType,
                quantity: qty,
                grossAmount,
                feePercent,
                feeAmount,
                buyerDiscordId,
              },
            }),
          ]
        : []),
    ]);

    const trade = await CommunityMarketTrade.create({
      trxId,
      tradeType: "SELL_LISTING",
      listingId: lockedListing._id,
      sellerDiscordId: String(lockedListing.sellerDiscordId),
      buyerDiscordId,
      guildId: GUILD_ID,
      itemType: lockedListing.itemType,
      itemCategory: lockedListing.itemSnapshot.category,
      itemSnapshot: lockedListing.itemSnapshot,
      quantity: qty,
      unitPrice: lockedListing.unitPrice,
      grossAmount,
      feePercent,
      feeAmount,
      netSellerPayout,
      isRated: false,
    });

    // Transaksi selesai, matikan rollback flags
    listingIdToRollback = null;
    qtyToRollback = 0;
    buyerChargedAmount = 0;

    try {
      await Notification.create({
        recipient: String(lockedListing.sellerDiscordId),
        title: "Item Terjual di Community Market!",
        message: `${itemLabel} telah dibeli seharga ${grossAmount.toLocaleString("id-ID")} NC. Dana bersih ${netSellerPayout.toLocaleString("id-ID")} NC (setelah pajak ${feePercent}%) telah masuk ke dompet Anda.`,
        type: "success",
        link: "/community-market",
      });
    } catch (notifErr) {
      console.error("[CM Buy] Notification error:", notifErr);
    }

    try {
      revalidatePath("/community-market");
      revalidatePath(`/community-market/${lockedListing.slug}`);
      revalidatePath("/dashboard/vouchers");
      revalidatePath("/dashboard/garage");
      revalidatePath("/dashboard/currency");
      revalidatePath("/dashboard/transactions");
    } catch {
      // Non-fatal
    }

    return jsonNoCache({
      success: true,
      message: `Pembelian ${itemLabel} berhasil! Aset telah masuk ke inventaris Anda.`,
      tradeId: String(trade._id),
      trxId,
      sellerDiscordId: String(lockedListing.sellerDiscordId),
    });
  } catch (err: any) {
    console.error("[CM Buy Listing] Error:", err);
    try {
      const client = await clientPromise;
      const db = client.db();
      if (listingIdToRollback && qtyToRollback > 0) {
        await CommunityMarketListing.updateOne(
          { _id: listingIdToRollback },
          {
            $inc: { remainingQuantity: qtyToRollback },
            $set: { status: "active", soldAt: null },
          }
        );
      }
      if (buyerChargedAmount > 0 && buyerDiscordIdForRollback) {
        await db.collection("currencies").updateOne(
          { userId: buyerDiscordIdForRollback, guildId: GUILD_ID },
          { $inc: { totalNC: buyerChargedAmount } }
        );
      }
    } catch (rbErr) {
      console.error("[CM Buy Listing] Critical Rollback Error:", rbErr);
    }

    return jsonNoCache(
      { success: false, error: err?.message || "Gagal memproses pembelian." },
      { status: 500 }
    );
  }
}
