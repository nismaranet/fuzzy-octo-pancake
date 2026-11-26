import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import clientPromise from "@/lib/mongodb";
import dbConnect from "@/lib/mongoose";
import { jsonNoCache } from "@/lib/antiCache";
import { checkRateLimit } from "@/lib/rateLimit";
import CommunityMarketBuyOrder from "@/lib/models/CommunityMarketBuyOrder";
import CommunityMarketTrade from "@/lib/models/CommunityMarketTrade";
import UserVoucher from "@/lib/models/UserVoucher";
import Transaction from "@/lib/models/Transaction";
import Notification from "@/lib/models/Notification";
import { isVoucherTradable } from "@/lib/voucher";
import {
  getCommunityMarketConfig,
  calculateSafeboxCapacity,
} from "@/lib/communityMarketConfig";
import {
  GUILD_ID,
  generateTradeTrxId,
  sweepExpiredCommunityMarketItems,
  doesVoucherMatchBuyOrder,
} from "@/lib/communityMarket";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let orderIdToRollback: mongoose.Types.ObjectId | null = null;
  let qtyToRollback = 0;
  let escrowToRollback = 0;
  let lockedVoucherId: mongoose.Types.ObjectId | null = null;
  let lockedSafeboxQty = 0;
  let sellerDiscordIdForRollback = "";

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.discordId) {
      return jsonNoCache({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!session.user.isDriver) {
      return jsonNoCache(
        { success: false, error: "Hanya driver resmi Nismara yang dapat memenuhi Buy Order." },
        { status: 403 }
      );
    }

    const sellerDiscordId = String(session.user.discordId);
    sellerDiscordIdForRollback = sellerDiscordId;

    if (!checkRateLimit(sellerDiscordId, "cm-fulfill-buy-order", 2000)) {
      return jsonNoCache(
        { success: false, error: "Mohon tunggu sebentar sebelum memenuhi Buy Order lain." },
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
    const lookupQuery = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { slug: id };

    const preview = await CommunityMarketBuyOrder.findOne(lookupQuery).lean();
    if (!preview) {
      return jsonNoCache({ success: false, error: "Buy Order tidak ditemukan." }, { status: 404 });
    }
    if (String(preview.buyerDiscordId) === sellerDiscordId) {
      return jsonNoCache(
        { success: false, error: "Anda tidak dapat memenuhi Buy Order milik sendiri." },
        { status: 400 }
      );
    }
    const now = new Date();
    if (
      preview.status !== "active" ||
      preview.remainingQuantity < 1 ||
      new Date(preview.expiresAt) <= now
    ) {
      return jsonNoCache(
        { success: false, error: "Buy Order ini sudah terpenuhi, dibatalkan, atau berakhir." },
        { status: 400 }
      );
    }

    const qty =
      preview.itemType === "VOUCHER"
        ? 1
        : Math.max(1, Math.floor(Number(body.quantity || 1)));

    if (qty > preview.remainingQuantity) {
      return jsonNoCache(
        {
          success: false,
          error: `Permintaan tersisa hanya ${preview.remainingQuantity} unit.`,
        },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db();

    const [sellerUser, buyerUser, buyerGarage] = await Promise.all([
      db.collection("users").findOne({ discordId: sellerDiscordId }),
      db.collection("users").findOne({ discordId: String(preview.buyerDiscordId) }),
      db.collection("garages").findOne({ discordId: String(preview.buyerDiscordId) }),
    ]);

    if (!sellerUser || !buyerUser) {
      return jsonNoCache(
        { success: false, error: "Data akun penjual/pembeli tidak ditemukan." },
        { status: 404 }
      );
    }

    let itemSnapshot: any = null;
    let itemCategory = "PENALTY_TICKET";

    // Step 1: Validasi & Atomic Lock aset milik penjual
    if (preview.itemType === "VOUCHER") {
      const voucherId = String(body.voucherId || "");
      if (!mongoose.Types.ObjectId.isValid(voucherId)) {
        return jsonNoCache({ success: false, error: "Pilih voucher yang ingin dijual." }, { status: 400 });
      }

      const voucher = await UserVoucher.findById(voucherId);
      if (!voucher || String(voucher.discordId) !== sellerDiscordId) {
        return jsonNoCache(
          { success: false, error: "Voucher tidak ditemukan di inventaris Anda." },
          { status: 404 }
        );
      }
      if (voucher.status !== "ACTIVE") {
        return jsonNoCache(
          { success: false, error: `Voucher tidak dapat digunakan (Status: ${voucher.status}).` },
          { status: 400 }
        );
      }
      if (!isVoucherTradable(voucher)) {
        return jsonNoCache(
          { success: false, error: "Voucher gaji staff/manager tidak dapat diperdagangkan." },
          { status: 403 }
        );
      }

      const matchCheck = doesVoucherMatchBuyOrder(
        voucher,
        preview,
        config.minVoucherRemainingHours
      );
      if (!matchCheck.match) {
        return jsonNoCache(
          { success: false, error: matchCheck.reason || "Voucher tidak cocok dengan kriteria Buy Order." },
          { status: 400 }
        );
      }

      const lockedV = await UserVoucher.findOneAndUpdate(
        {
          _id: voucher._id,
          discordId: sellerDiscordId,
          status: "ACTIVE",
          tradable: { $ne: false },
          source: { $not: /^MANAGER_SALARY/i },
        },
        { $set: { status: "LISTED" } },
        { returnDocument: "after" }
      );
      if (!lockedV) {
        return jsonNoCache(
          { success: false, error: "Voucher sudah terpakai atau sedang dalam transaksi lain." },
          { status: 409 }
        );
      }
      lockedVoucherId = lockedV._id as mongoose.Types.ObjectId;
      itemCategory = lockedV.category;
      itemSnapshot = {
        title: lockedV.title,
        description: lockedV.description || "",
        category: lockedV.category,
        discountType: lockedV.discountType,
        discountValue: lockedV.discountValue,
        durationHours: lockedV.durationHours || 0,
        maxDiscount: lockedV.maxDiscount || 0,
        minSpend: lockedV.minSpend || 0,
        expiresAt: lockedV.expiresAt || null,
        source: lockedV.source || "",
      };
    } else {
      // PENALTY_TICKET: Cek kapasitas Safebox pembeli
      if (!buyerGarage || buyerGarage.status === "suspended") {
        return jsonNoCache(
          { success: false, error: "Safebox pembeli sedang tidak tersedia/dibekukan." },
          { status: 400 }
        );
      }
      const buyerMaxCap = calculateSafeboxCapacity(buyerGarage.safeboxLevel);
      const buyerStock = Number(buyerGarage.safeboxStock || 0);
      if (buyerStock + qty > buyerMaxCap) {
        return jsonNoCache(
          {
            success: false,
            error: `Safebox pembeli saat ini penuh (${buyerStock}/${buyerMaxCap}). Coba penuhi jumlah lebih kecil.`,
          },
          { status: 400 }
        );
      }

      const sellerGarageRes = await db.collection("garages").updateOne(
        {
          discordId: sellerDiscordId,
          status: { $ne: "suspended" },
          safeboxStock: { $gte: qty },
        },
        { $inc: { safeboxStock: -qty } }
      );
      if (sellerGarageRes.modifiedCount === 0) {
        return jsonNoCache(
          { success: false, error: "Stok Tiket Penghapus Penalti di Safebox Anda tidak mencukupi." },
          { status: 400 }
        );
      }
      lockedSafeboxQty = qty;
      itemCategory = "PENALTY_TICKET";
      itemSnapshot = {
        title: "Tiket Penghapus Penalti",
        description:
          "Tiket Safebox untuk menghapus 1 poin penalti secara instan melalui menu Penalty Points.",
        category: "PENALTY_TICKET",
        discountType: null,
        discountValue: 1,
        durationHours: 0,
        maxDiscount: 0,
        minSpend: 0,
        expiresAt: null,
        source: "SAFEBOX",
      };
    }

    const grossAmount = preview.offerPrice * qty;
    const feePercent = config.transactionFeePercent;
    const feeAmount = Math.round(grossAmount * (feePercent / 100));
    const netSellerPayout = Math.max(0, grossAmount - feeAmount);

    // Step 2: Atomic decrement Buy Order remainingQuantity & escrowRemaining
    const lockedOrder = await CommunityMarketBuyOrder.findOneAndUpdate(
      {
        _id: preview._id,
        status: "active",
        buyerDiscordId: { $ne: sellerDiscordId },
        remainingQuantity: { $gte: qty },
        escrowRemaining: { $gte: grossAmount },
        expiresAt: { $gt: now },
      },
      [
        {
          $set: {
            remainingQuantity: { $subtract: ["$remainingQuantity", qty] },
            escrowRemaining: { $subtract: ["$escrowRemaining", grossAmount] },
          },
        },
        {
          $set: {
            status: {
              $cond: [{ $lte: ["$remainingQuantity", 0] }, "fulfilled", "active"],
            },
            fulfilledAt: {
              $cond: [{ $lte: ["$remainingQuantity", 0] }, now, "$fulfilledAt"],
            },
          },
        },
      ],
      { returnDocument: "after", updatePipeline: true }
    );

    if (!lockedOrder) {
      throw new Error("Buy Order baru saja dipenuhi oleh driver lain atau dibatalkan.");
    }
    orderIdToRollback = lockedOrder._id as mongoose.Types.ObjectId;
    qtyToRollback = qty;
    escrowToRollback = grossAmount;

    // Step 3: Transfer aset ke Pembeli
    if (preview.itemType === "VOUCHER" && lockedVoucherId) {
      await UserVoucher.updateOne(
        { _id: lockedVoucherId },
        {
          $set: {
            discordId: String(lockedOrder.buyerDiscordId),
            userId: buyerUser._id,
            status: "ACTIVE",
          },
        }
      );
      lockedVoucherId = null;
    } else if (preview.itemType === "PENALTY_TICKET") {
      const buyerMaxCap = calculateSafeboxCapacity(buyerGarage?.safeboxLevel);
      const creditBuyerGarage = await db.collection("garages").updateOne(
        {
          discordId: String(lockedOrder.buyerDiscordId),
          status: { $ne: "suspended" },
          safeboxStock: { $lte: buyerMaxCap - qty },
        },
        { $inc: { safeboxStock: qty } }
      );
      if (creditBuyerGarage.modifiedCount === 0) {
        throw new Error("Safebox pembeli penuh saat pengiriman tiket.");
      }
      lockedSafeboxQty = 0;
    }

    // Step 4: Cairkan NC dari escrow ke Penjual (setelah potongan pajak 11%)
    await db.collection("currencies").updateOne(
      { userId: sellerDiscordId, guildId: GUILD_ID },
      {
        $inc: { totalNC: netSellerPayout },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true }
    );

    const trxId = generateTradeTrxId();
    const itemLabel = qty > 1 ? `${qty}x ${itemSnapshot.title}` : itemSnapshot.title;

    await Promise.all([
      db.collection("currencyhistories").insertOne({
        userId: sellerDiscordId,
        guildId: GUILD_ID,
        amount: netSellerPayout,
        type: "earn",
        reason: `Memenuhi Buy Order Community Market: ${itemLabel} (Potongan pajak ${feePercent}%: ${feeAmount.toLocaleString("id-ID")} NC)`,
        createdAt: now,
      }),
      Transaction.create({
        trxId,
        discordId: String(lockedOrder.buyerDiscordId),
        userId: buyerUser._id,
        title: `Buy Order Terpenuhi: ${itemLabel}`,
        category: "market",
        amount: grossAmount,
        currency: "NC",
        status: "success",
        metadata: {
          subCategory: "community_market_buy_order_fulfilled",
          buyOrderId: String(lockedOrder._id),
          slug: lockedOrder.slug,
          itemType: lockedOrder.itemType,
          quantity: qty,
          unitPrice: lockedOrder.offerPrice,
          sellerDiscordId,
        },
      }),
      Transaction.create({
        trxId: `${trxId}-SELL`,
        discordId: sellerDiscordId,
        userId: sellerUser._id,
        title: `Jual via Buy Order: ${itemLabel}`,
        category: "market",
        amount: netSellerPayout,
        currency: "NC",
        status: "success",
        metadata: {
          subCategory: "community_market_sell_buy_order",
          buyOrderId: String(lockedOrder._id),
          slug: lockedOrder.slug,
          itemType: lockedOrder.itemType,
          quantity: qty,
          grossAmount,
          feePercent,
          feeAmount,
          buyerDiscordId: String(lockedOrder.buyerDiscordId),
        },
      }),
    ]);

    const trade = await CommunityMarketTrade.create({
      trxId,
      tradeType: "BUY_ORDER",
      buyOrderId: lockedOrder._id,
      sellerDiscordId,
      buyerDiscordId: String(lockedOrder.buyerDiscordId),
      guildId: GUILD_ID,
      itemType: lockedOrder.itemType,
      itemCategory,
      itemSnapshot,
      quantity: qty,
      unitPrice: lockedOrder.offerPrice,
      grossAmount,
      feePercent,
      feeAmount,
      netSellerPayout,
      isRated: false,
    });

    // Clear rollback flags
    orderIdToRollback = null;
    qtyToRollback = 0;
    escrowToRollback = 0;

    try {
      await Notification.create({
        recipient: String(lockedOrder.buyerDiscordId),
        title: "Buy Order Anda Terpenuhi!",
        message: `${itemLabel} telah dikirimkan oleh penjual dan masuk ke inventaris Anda (Escrow terpakai: ${grossAmount.toLocaleString("id-ID")} NC). Anda dapat memberi ulasan untuk penjual di tab Aktivitas Saya.`,
        type: "success",
        link: "/community-market",
      });
    } catch {
      // Non-fatal
    }

    try {
      revalidatePath("/community-market");
      revalidatePath(`/community-market/${lockedOrder.slug}`);
      revalidatePath("/dashboard/vouchers");
      revalidatePath("/dashboard/garage");
      revalidatePath("/dashboard/currency");
      revalidatePath("/dashboard/transactions");
    } catch {
      // Non-fatal
    }

    return jsonNoCache({
      success: true,
      message: `Buy Order berhasil dipenuhi! Dana bersih ${netSellerPayout.toLocaleString("id-ID")} NC telah masuk ke dompet Anda.`,
      tradeId: String(trade._id),
      trxId,
      netSellerPayout,
    });
  } catch (err: any) {
    console.error("[CM Fulfill BuyOrder] Error:", err);
    try {
      const client = await clientPromise;
      const db = client.db();
      if (orderIdToRollback && qtyToRollback > 0) {
        await CommunityMarketBuyOrder.updateOne(
          { _id: orderIdToRollback },
          {
            $inc: { remainingQuantity: qtyToRollback, escrowRemaining: escrowToRollback },
            $set: { status: "active", fulfilledAt: null },
          }
        );
      }
      if (lockedVoucherId) {
        await UserVoucher.updateOne(
          { _id: lockedVoucherId, status: "LISTED" },
          { $set: { status: "ACTIVE" } }
        );
      }
      if (lockedSafeboxQty > 0 && sellerDiscordIdForRollback) {
        await db.collection("garages").updateOne(
          { discordId: sellerDiscordIdForRollback },
          { $inc: { safeboxStock: lockedSafeboxQty } }
        );
      }
    } catch (rbErr) {
      console.error("[CM Fulfill BuyOrder] Rollback error:", rbErr);
    }

    return jsonNoCache(
      { success: false, error: err?.message || "Gagal memenuhi Buy Order." },
      { status: 500 }
    );
  }
}
