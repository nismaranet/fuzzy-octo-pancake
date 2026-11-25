import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import clientPromise from "@/lib/mongodb";
import dbConnect from "@/lib/mongoose";
import { jsonNoCache } from "@/lib/antiCache";
import { checkRateLimit } from "@/lib/rateLimit";
import CommunityMarketListing from "@/lib/models/CommunityMarketListing";
import UserVoucher from "@/lib/models/UserVoucher";
import Transaction from "@/lib/models/Transaction";
import { isVoucherTradable } from "@/lib/voucher";
import {
  getCommunityMarketConfig,
  calculateFairPriceRange,
  isUserFreeListingEligible,
  resolveListingDurationFee,
  getMaxAllowedVoucherListingDuration,
} from "@/lib/communityMarketConfig";
import {
  GUILD_ID,
  generateMarketSlug,
  generateTradeTrxId,
  sweepExpiredCommunityMarketItems,
  getEnrichedMarketUsersMap,
  getMarketPriceGuideMap,
} from "@/lib/communityMarket";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(request: Request) {
  try {
    await dbConnect();
    await sweepExpiredCommunityMarketItems();

    const { searchParams } = new URL(request.url);
    const itemType = searchParams.get("itemType");
    const category = searchParams.get("category");
    const flashDeal = searchParams.get("flashDeal") === "true";
    const search = (searchParams.get("search") || "").trim();
    const minPrice = Number(searchParams.get("minPrice") || 0);
    const maxPrice = Number(searchParams.get("maxPrice") || 0);
    const sort = searchParams.get("sort") || "newest";
    const sellerDiscordId = searchParams.get("sellerDiscordId");
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(48, Math.max(1, Number(searchParams.get("limit") || 24)));

    const config = await getCommunityMarketConfig();
    const now = new Date();

    const filter: any = {
      status: "active",
      remainingQuantity: { $gt: 0 },
      expiresAt: { $gt: now },
    };

    if (itemType === "VOUCHER" || itemType === "PENALTY_TICKET") {
      filter.itemType = itemType;
    }
    if (category && category !== "ALL") {
      if (category === "GARAGE_RENT" || category === "GARAGE_UPGRADE") {
        filter["itemSnapshot.category"] = { $in: ["GARAGE_RENT", "GARAGE_UPGRADE"] };
      } else {
        filter["itemSnapshot.category"] = category;
      }
    }
    if (sellerDiscordId) {
      filter.sellerDiscordId = sellerDiscordId;
    }
    if (flashDeal) {
      const flashCutoff = new Date(
        now.getTime() + config.flashDealThresholdHours * 3600 * 1000
      );
      filter.itemType = "VOUCHER";
      filter["itemSnapshot.expiresAt"] = { $ne: null, $gt: now, $lte: flashCutoff };
    }
    if (minPrice > 0 || maxPrice > 0) {
      filter.unitPrice = {};
      if (minPrice > 0) filter.unitPrice.$gte = minPrice;
      if (maxPrice > 0) filter.unitPrice.$lte = maxPrice;
    }
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { "itemSnapshot.title": regex },
        { "itemSnapshot.description": regex },
        { "itemSnapshot.category": regex },
      ];
    }

    let sortObj: any = { createdAt: -1 };
    if (sort === "price_asc") sortObj = { unitPrice: 1, createdAt: -1 };
    else if (sort === "price_desc") sortObj = { unitPrice: -1, createdAt: -1 };
    else if (sort === "expiring_soon") sortObj = { expiresAt: 1 };
    else if (sort === "most_viewed") sortObj = { views: -1, createdAt: -1 };

    const [listingsRaw, total, priceGuide] = await Promise.all([
      CommunityMarketListing.find(filter)
        .sort(sortObj)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      CommunityMarketListing.countDocuments(filter),
      getMarketPriceGuideMap(),
    ]);

    const sellerIds = listingsRaw.map((l) => String(l.sellerDiscordId));
    const usersMap = await getEnrichedMarketUsersMap(sellerIds);

    const flashThresholdMs = config.flashDealThresholdHours * 3600 * 1000;
    const listings = listingsRaw.map((l) => {
      const vExp = l.itemSnapshot?.expiresAt
        ? new Date(l.itemSnapshot.expiresAt).getTime()
        : null;
      const isFlashDeal = Boolean(
        l.itemType === "VOUCHER" &&
          vExp &&
          vExp > now.getTime() &&
          vExp - now.getTime() <= flashThresholdMs
      );
      return {
        ...l,
        _id: String(l._id),
        sellerId: String(l.sellerId),
        itemRefId: l.itemRefId ? String(l.itemRefId) : null,
        isFlashDeal,
        seller: usersMap[String(l.sellerDiscordId)] || null,
      };
    });

    return jsonNoCache({
      success: true,
      listings,
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      priceGuide,
      config,
    });
  } catch (err: any) {
    console.error("[CM GET Listings] Error:", err);
    return jsonNoCache(
      { success: false, error: err?.message || "Gagal memuat Community Market" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  let lockedVoucherId: mongoose.Types.ObjectId | null = null;
  let lockedSafeboxQty = 0;
  let deductedFeeAmount = 0;
  let sellerDiscordIdForRollback = "";

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.discordId) {
      return jsonNoCache({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!session.user.isDriver) {
      return jsonNoCache(
        { success: false, error: "Hanya driver resmi Nismara yang dapat menjual item." },
        { status: 403 }
      );
    }

    const discordId = String(session.user.discordId);
    sellerDiscordIdForRollback = discordId;

    if (!checkRateLimit(discordId, "cm-create-listing", 2000)) {
      return jsonNoCache(
        { success: false, error: "Terlalu cepat. Tunggu sebentar sebelum memasang iklan baru." },
        { status: 429 }
      );
    }

    await dbConnect();
    const config = await getCommunityMarketConfig();
    if (!config.enabled) {
      return jsonNoCache(
        { success: false, error: "Community Market sedang dalam pemeliharaan." },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const itemType = body.itemType as "VOUCHER" | "PENALTY_TICKET";
    const unitPrice = Math.round(Number(body.unitPrice));
    const durationDays = Number(body.durationDays || 7) as 7 | 14 | 30;

    if (itemType !== "VOUCHER" && itemType !== "PENALTY_TICKET") {
      return jsonNoCache({ success: false, error: "Jenis item tidak valid." }, { status: 400 });
    }
    if (![7, 14, 30].includes(durationDays)) {
      return jsonNoCache(
        { success: false, error: "Durasi iklan harus 7, 14, atau 30 hari." },
        { status: 400 }
      );
    }
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      return jsonNoCache({ success: false, error: "Harga jual tidak valid." }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();

    const [userDoc, garageDoc] = await Promise.all([
      db.collection("users").findOne({ discordId }),
      db.collection("garages").findOne({ discordId }),
    ]);

    if (!userDoc) {
      return jsonNoCache({ success: false, error: "Data akun tidak ditemukan." }, { status: 404 });
    }
    if (garageDoc?.status === "suspended") {
      return jsonNoCache(
        {
          success: false,
          error: "Garasi Anda sedang dibekukan karena tunggakan biaya operasional.",
        },
        { status: 403 }
      );
    }

    const freeCheck = isUserFreeListingEligible(config, userDoc as any);
    const listingFee = resolveListingDurationFee(
      config,
      "SELL_LISTING",
      durationDays,
      freeCheck.eligible
    );

    const now = new Date();
    let expiresAt = new Date(now.getTime() + durationDays * 24 * 3600 * 1000);
    let quantity = 1;
    let itemRefId: mongoose.Types.ObjectId | null = null;
    let itemSnapshot: any = null;

    if (itemType === "VOUCHER") {
      const voucherId = String(body.voucherId || "");
      if (!mongoose.Types.ObjectId.isValid(voucherId)) {
        return jsonNoCache({ success: false, error: "ID Voucher tidak valid." }, { status: 400 });
      }

      const voucher = await UserVoucher.findById(voucherId);
      if (!voucher || String(voucher.discordId) !== discordId) {
        return jsonNoCache(
          { success: false, error: "Voucher tidak ditemukan di inventaris Anda." },
          { status: 404 }
        );
      }
      if (voucher.status !== "ACTIVE") {
        return jsonNoCache(
          { success: false, error: `Voucher tidak dapat dijual (Status: ${voucher.status}).` },
          { status: 400 }
        );
      }
      if (!isVoucherTradable(voucher)) {
        return jsonNoCache(
          {
            success: false,
            error: "Voucher eksklusif gaji staff/manager tidak dapat diperdagangkan.",
          },
          { status: 403 }
        );
      }

      const durCheck = getMaxAllowedVoucherListingDuration(
        voucher.expiresAt,
        config.minVoucherRemainingHours,
        now.getTime()
      );
      if (!durCheck.canList) {
        return jsonNoCache(
          {
            success: false,
            error: `Voucher dengan sisa masa berlaku kurang dari ${config.minVoucherRemainingHours} jam tidak dapat dijual.`,
          },
          { status: 400 }
        );
      }
      if (!durCheck.availableDurations.includes(durationDays)) {
        return jsonNoCache(
          {
            success: false,
            error: `Durasi ${durationDays} hari melebihi sisa masa berlaku voucher Anda. Pilih durasi yang lebih singkat.`,
          },
          { status: 400 }
        );
      }

      // Clamp expiresAt agar selalu minimal minVoucherRemainingHours sebelum voucher hangus
      if (voucher.expiresAt) {
        const safeCutoff = new Date(
          new Date(voucher.expiresAt).getTime() - config.minVoucherRemainingHours * 3600 * 1000
        );
        if (safeCutoff < expiresAt) {
          expiresAt = safeCutoff;
        }
      }

      const fairRange = calculateFairPriceRange(config, {
        itemType: "VOUCHER",
        category: voucher.category,
        discountType: voucher.discountType,
        discountValue: voucher.discountValue,
        durationHours: voucher.durationHours,
        maxDiscount: voucher.maxDiscount,
      });

      if (unitPrice < fairRange.minPrice || unitPrice > fairRange.maxPrice) {
        return jsonNoCache(
          {
            success: false,
            error: `Harga jual harus berada di rentang wajar ${fairRange.minPrice.toLocaleString("id-ID")} – ${fairRange.maxPrice.toLocaleString("id-ID")} NC.`,
          },
          { status: 400 }
        );
      }

      // Atomic Gate 1: Kunci Voucher ACTIVE -> LISTED
      const lockedVoucher = await UserVoucher.findOneAndUpdate(
        {
          _id: voucher._id,
          discordId,
          status: "ACTIVE",
          tradable: { $ne: false },
          source: { $not: /^MANAGER_SALARY/i },
        },
        { $set: { status: "LISTED" } },
        { returnDocument: "after" }
      );

      if (!lockedVoucher) {
        return jsonNoCache(
          {
            success: false,
            error: "Voucher sudah digunakan, sedang dijual, atau tidak memenuhi syarat.",
          },
          { status: 409 }
        );
      }
      lockedVoucherId = lockedVoucher._id as mongoose.Types.ObjectId;
      itemRefId = lockedVoucherId;
      itemSnapshot = {
        title: lockedVoucher.title,
        description: lockedVoucher.description || "",
        category: lockedVoucher.category,
        discountType: lockedVoucher.discountType,
        discountValue: lockedVoucher.discountValue,
        durationHours: lockedVoucher.durationHours || 0,
        maxDiscount: lockedVoucher.maxDiscount || 0,
        minSpend: lockedVoucher.minSpend || 0,
        expiresAt: lockedVoucher.expiresAt || null,
        source: lockedVoucher.source || "",
      };
    } else {
      // PENALTY_TICKET
      quantity = Math.floor(Number(body.quantity || 1));
      if (!Number.isFinite(quantity) || quantity < 1 || quantity > 50) {
        return jsonNoCache(
          { success: false, error: "Jumlah tiket harus antara 1 sampai 50." },
          { status: 400 }
        );
      }

      const fairRange = calculateFairPriceRange(config, { itemType: "PENALTY_TICKET" });
      if (unitPrice < fairRange.minPrice || unitPrice > fairRange.maxPrice) {
        return jsonNoCache(
          {
            success: false,
            error: `Harga per tiket harus berada di rentang wajar ${fairRange.minPrice.toLocaleString("id-ID")} – ${fairRange.maxPrice.toLocaleString("id-ID")} NC.`,
          },
          { status: 400 }
        );
      }

      // Atomic Gate 1: Kunci & kurangi stok Safebox
      const garageUpdate = await db.collection("garages").updateOne(
        {
          discordId,
          status: { $ne: "suspended" },
          safeboxStock: { $gte: quantity },
        },
        { $inc: { safeboxStock: -quantity } }
      );

      if (garageUpdate.modifiedCount === 0) {
        return jsonNoCache(
          { success: false, error: "Stok Tiket Penghapus Penalti di Safebox tidak mencukupi." },
          { status: 400 }
        );
      }
      lockedSafeboxQty = quantity;
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

    // Atomic Gate 2: Potong Biaya Pasang Iklan jika > 0 (Non-Refundable)
    if (listingFee > 0) {
      const feeRes = await db.collection("currencies").updateOne(
        { userId: discordId, guildId: GUILD_ID, totalNC: { $gte: listingFee } },
        { $inc: { totalNC: -listingFee } }
      );
      if (feeRes.modifiedCount === 0) {
        // Rollback item lock
        if (lockedVoucherId) {
          await UserVoucher.updateOne(
            { _id: lockedVoucherId, status: "LISTED" },
            { $set: { status: "ACTIVE" } }
          );
          lockedVoucherId = null;
        }
        if (lockedSafeboxQty > 0) {
          await db.collection("garages").updateOne(
            { discordId },
            { $inc: { safeboxStock: lockedSafeboxQty } }
          );
          lockedSafeboxQty = 0;
        }
        return jsonNoCache(
          {
            success: false,
            error: `Saldo NC tidak mencukupi untuk biaya pasang iklan (${listingFee.toLocaleString("id-ID")} NC).`,
          },
          { status: 400 }
        );
      }
      deductedFeeAmount = listingFee;

      await db.collection("currencyhistories").insertOne({
        userId: discordId,
        guildId: GUILD_ID,
        amount: listingFee,
        type: "spend",
        reason: `Biaya Pasang Iklan Community Market (${durationDays} Hari): ${itemSnapshot.title}`,
        createdAt: now,
      });

      await Transaction.create({
        trxId: generateTradeTrxId(),
        discordId,
        userId: userDoc._id,
        title: `Biaya Iklan Community Market (${durationDays} Hari)`,
        category: "market",
        amount: listingFee,
        currency: "NC",
        status: "success",
        metadata: {
          subCategory: "community_market_listing_fee",
          itemType,
          itemTitle: itemSnapshot.title,
          durationDays,
        },
      });
    }

    const slug = generateMarketSlug(itemSnapshot.title);
    const created = await CommunityMarketListing.create({
      slug,
      sellerId: new mongoose.Types.ObjectId(String(userDoc._id)),
      sellerDiscordId: discordId,
      guildId: GUILD_ID,
      itemType,
      itemRefId,
      quantity,
      remainingQuantity: quantity,
      unitPrice,
      itemSnapshot,
      durationDays,
      listingFeePaid: listingFee,
      expiresAt,
      views: 0,
      status: "active",
    });

    // Clear rollback flags because creation succeeded
    lockedVoucherId = null;
    lockedSafeboxQty = 0;
    deductedFeeAmount = 0;

    try {
      revalidatePath("/community-market");
      revalidatePath("/dashboard/vouchers");
      revalidatePath("/dashboard/garage");
      revalidatePath("/dashboard/currency");
      revalidatePath("/dashboard/transactions");
    } catch {
      // Non-fatal
    }

    return jsonNoCache({
      success: true,
      message: "Item berhasil dipajang di Community Market!",
      listing: {
        ...created.toObject(),
        _id: String(created._id),
      },
    });
  } catch (err: any) {
    console.error("[CM POST Listing] Error:", err);
    // Comprehensive Rollback
    try {
      const client = await clientPromise;
      const db = client.db();
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
      if (deductedFeeAmount > 0 && sellerDiscordIdForRollback) {
        await db.collection("currencies").updateOne(
          { userId: sellerDiscordIdForRollback, guildId: GUILD_ID },
          { $inc: { totalNC: deductedFeeAmount } }
        );
      }
    } catch (rbErr) {
      console.error("[CM POST Listing] Rollback error:", rbErr);
    }

    return jsonNoCache(
      { success: false, error: err?.message || "Gagal memasang iklan." },
      { status: 500 }
    );
  }
}
