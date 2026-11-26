import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import clientPromise from "@/lib/mongodb";
import dbConnect from "@/lib/mongoose";
import { jsonNoCache } from "@/lib/antiCache";
import { checkRateLimit } from "@/lib/rateLimit";
import CommunityMarketBuyOrder from "@/lib/models/CommunityMarketBuyOrder";
import Transaction from "@/lib/models/Transaction";
import { notifyCommunityBuyOrderCreated } from "@/lib/discordMarketNotifier";
import {
  getCommunityMarketConfig,
  calculateFairPriceRange,
  calculateSafeboxCapacity,
  isUserFreeListingEligible,
  resolveListingDurationFee,
} from "@/lib/communityMarketConfig";
import {
  GUILD_ID,
  generateMarketSlug,
  generateTradeTrxId,
  sweepExpiredCommunityMarketItems,
  getEnrichedMarketUsersMap,
  getMarketPriceGuideMap,
  getUserPendingBuyOrderTickets,
  buildBuyOrderTitle,
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
    const search = (searchParams.get("search") || "").trim();
    const sort = searchParams.get("sort") || "price_desc";
    const buyerDiscordId = searchParams.get("buyerDiscordId");
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(48, Math.max(1, Number(searchParams.get("limit") || 24)));

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
      if (category === "PENALTY_TICKET") {
        filter.itemType = "PENALTY_TICKET";
      } else {
        filter["criteria.category"] = category;
      }
    }
    if (buyerDiscordId) {
      filter.buyerDiscordId = buyerDiscordId;
    }
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ title: regex }, { notes: regex }, { "criteria.category": regex }];
    }

    let sortObj: any = { offerPrice: -1, createdAt: -1 };
    if (sort === "newest") sortObj = { createdAt: -1 };
    else if (sort === "price_asc") sortObj = { offerPrice: 1, createdAt: -1 };
    else if (sort === "expiring_soon") sortObj = { expiresAt: 1 };
    else if (sort === "most_viewed") sortObj = { views: -1, createdAt: -1 };

    const [ordersRaw, total, priceGuide, config] = await Promise.all([
      CommunityMarketBuyOrder.find(filter)
        .sort(sortObj)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      CommunityMarketBuyOrder.countDocuments(filter),
      getMarketPriceGuideMap(),
      getCommunityMarketConfig(),
    ]);

    const buyerIds = ordersRaw.map((o) => String(o.buyerDiscordId));
    const usersMap = await getEnrichedMarketUsersMap(buyerIds);

    const buyOrders = ordersRaw.map((o) => ({
      ...o,
      _id: String(o._id),
      buyerId: String(o.buyerId),
      buyer: usersMap[String(o.buyerDiscordId)] || null,
    }));

    return jsonNoCache({
      success: true,
      buyOrders,
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      priceGuide,
      config,
    });
  } catch (err: any) {
    console.error("[CM GET BuyOrders] Error:", err);
    return jsonNoCache(
      { success: false, error: err?.message || "Gagal memuat Buy Orders." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  let deductedTotalAmount = 0;
  let buyerDiscordIdForRollback = "";

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.discordId) {
      return jsonNoCache({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!session.user.isDriver) {
      return jsonNoCache(
        { success: false, error: "Hanya driver resmi Nismara yang dapat membuat Buy Order." },
        { status: 403 }
      );
    }

    const buyerDiscordId = String(session.user.discordId);
    buyerDiscordIdForRollback = buyerDiscordId;

    if (!checkRateLimit(buyerDiscordId, "cm-create-buy-order", 2000)) {
      return jsonNoCache(
        { success: false, error: "Terlalu cepat. Tunggu sebentar sebelum membuat Buy Order baru." },
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
    const offerPrice = Math.round(Number(body.offerPrice));
    const quantity = Math.floor(Number(body.quantity || 1));
    const durationDays = Number(body.durationDays || 7) as 7 | 14 | 30;
    const notes = String(body.notes || "").trim().slice(0, 240);

    if (itemType !== "VOUCHER" && itemType !== "PENALTY_TICKET") {
      return jsonNoCache({ success: false, error: "Jenis item tidak valid." }, { status: 400 });
    }
    if (![7, 14, 30].includes(durationDays)) {
      return jsonNoCache(
        { success: false, error: "Durasi Buy Order harus 7, 14, atau 30 hari." },
        { status: 400 }
      );
    }
    if (!Number.isFinite(offerPrice) || offerPrice <= 0) {
      return jsonNoCache({ success: false, error: "Harga tawaran tidak valid." }, { status: 400 });
    }
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > 20) {
      return jsonNoCache(
        { success: false, error: "Jumlah pesanan harus antara 1 hingga 20." },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db();

    const [userDoc, garageDoc] = await Promise.all([
      db.collection("users").findOne({ discordId: buyerDiscordId }),
      db.collection("garages").findOne({ discordId: buyerDiscordId }),
    ]);

    if (!userDoc) {
      return jsonNoCache({ success: false, error: "Data akun tidak ditemukan." }, { status: 404 });
    }

    const criteria: any = {};

    if (itemType === "PENALTY_TICKET") {
      if (!garageDoc) {
        return jsonNoCache(
          {
            success: false,
            error: "Buka halaman Garasi terlebih dahulu untuk mengaktifkan Safebox sebelum memesan tiket penalti.",
          },
          { status: 400 }
        );
      }
      if (garageDoc.status === "suspended") {
        return jsonNoCache(
          { success: false, error: "Garasi Anda sedang dibekukan karena tunggakan biaya operasional." },
          { status: 403 }
        );
      }

      const maxCap = calculateSafeboxCapacity(garageDoc.safeboxLevel);
      const currentStock = Number(garageDoc.safeboxStock || 0);
      const pendingOrdered = await getUserPendingBuyOrderTickets(buyerDiscordId);
      if (currentStock + pendingOrdered + quantity > maxCap) {
        const availableSlots = Math.max(0, maxCap - currentStock - pendingOrdered);
        return jsonNoCache(
          {
            success: false,
            error: `Kapasitas Safebox tidak cukup untuk menampung pesanan ini (Stok: ${currentStock}, Buy Order aktif: ${pendingOrdered}, Kapasitas: ${maxCap}). Sisa slot tersedia: ${availableSlots} tiket.`,
          },
          { status: 400 }
        );
      }

      const fairRange = calculateFairPriceRange(config, { itemType: "PENALTY_TICKET" });
      if (offerPrice < fairRange.minPrice || offerPrice > fairRange.maxPrice) {
        return jsonNoCache(
          {
            success: false,
            error: `Harga tawaran per tiket harus berada di rentang wajar ${fairRange.minPrice.toLocaleString("id-ID")} – ${fairRange.maxPrice.toLocaleString("id-ID")} NC.`,
          },
          { status: 400 }
        );
      }
    } else {
      const validCats = [
        "FLEET_BUY",
        "FLEET_MAINTENANCE",
        "GARAGE_RENT",
        "MARKET_MOD",
        "NC_BOOSTER",
      ];
      const category = String(body.criteria?.category || "");
      if (!validCats.includes(category)) {
        return jsonNoCache(
          { success: false, error: "Kategori voucher tidak valid." },
          { status: 400 }
        );
      }

      const discountType =
        category === "NC_BOOSTER"
          ? "percentage"
          : body.criteria?.discountType === "fixed"
            ? "fixed"
            : "percentage";
      const minDiscountValue = Math.max(1, Math.round(Number(body.criteria?.minDiscountValue || 10)));
      const minDurationHours =
        category === "NC_BOOSTER"
          ? Math.max(1, Math.round(Number(body.criteria?.minDurationHours || 2)))
          : 0;
      const minRemainingDays = Math.max(
        1,
        Math.min(60, Math.round(Number(body.criteria?.minRemainingDays || 2)))
      );
      const requireUnlimitedMaxDiscount =
        category !== "NC_BOOSTER" &&
        discountType === "percentage" &&
        Boolean(body.criteria?.requireUnlimitedMaxDiscount);

      criteria.category = category;
      criteria.discountType = discountType;
      criteria.minDiscountValue = minDiscountValue;
      criteria.minDurationHours = minDurationHours;
      criteria.minRemainingDays = minRemainingDays;
      criteria.requireUnlimitedMaxDiscount = requireUnlimitedMaxDiscount;

      const fairRange = calculateFairPriceRange(config, {
        itemType: "VOUCHER",
        category,
        discountType,
        discountValue: minDiscountValue,
        durationHours: minDurationHours,
      });

      if (offerPrice < fairRange.minPrice || offerPrice > fairRange.maxPrice) {
        return jsonNoCache(
          {
            success: false,
            error: `Harga tawaran harus berada di rentang wajar ${fairRange.minPrice.toLocaleString("id-ID")} – ${fairRange.maxPrice.toLocaleString("id-ID")} NC.`,
          },
          { status: 400 }
        );
      }
    }

    const freeCheck = isUserFreeListingEligible(config, userDoc as any);
    const listingFee = resolveListingDurationFee(
      config,
      "BUY_ORDER",
      durationDays,
      freeCheck.eligible
    );
    const escrowTotal = offerPrice * quantity;
    const totalRequired = escrowTotal + listingFee;

    // Atomic Gate: Potong Escrow + Biaya Pasang Iklan sekaligus
    const deductRes = await db.collection("currencies").updateOne(
      { userId: buyerDiscordId, guildId: GUILD_ID, totalNC: { $gte: totalRequired } },
      { $inc: { totalNC: -totalRequired } }
    );

    if (deductRes.modifiedCount === 0) {
      return jsonNoCache(
        {
          success: false,
          error: `Saldo NC tidak mencukupi. Dibutuhkan total ${totalRequired.toLocaleString("id-ID")} NC (Escrow ${escrowTotal.toLocaleString("id-ID")} NC${listingFee > 0 ? ` + Biaya Iklan ${listingFee.toLocaleString("id-ID")} NC` : ""}).`,
        },
        { status: 400 }
      );
    }
    deductedTotalAmount = totalRequired;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationDays * 24 * 3600 * 1000);
    const title = buildBuyOrderTitle(itemType, criteria);
    const slug = generateMarketSlug(title);

    const historyDocs: any[] = [
      {
        userId: buyerDiscordId,
        guildId: GUILD_ID,
        amount: escrowTotal,
        type: "spend",
        reason: `Escrow Buy Order Community Market (${quantity}x): ${title}`,
        createdAt: now,
      },
    ];
    if (listingFee > 0) {
      historyDocs.push({
        userId: buyerDiscordId,
        guildId: GUILD_ID,
        amount: listingFee,
        type: "spend",
        reason: `Biaya Pasang Buy Order (${durationDays} Hari): ${title}`,
        createdAt: now,
      });
    }
    await db.collection("currencyhistories").insertMany(historyDocs);

    if (listingFee > 0) {
      await Transaction.create({
        trxId: generateTradeTrxId(),
        discordId: buyerDiscordId,
        userId: userDoc._id,
        title: `Biaya Iklan Buy Order (${durationDays} Hari)`,
        category: "market",
        amount: listingFee,
        currency: "NC",
        status: "success",
        metadata: {
          subCategory: "community_market_buy_order_fee",
          itemType,
          title,
          durationDays,
        },
      });
    }

    const created = await CommunityMarketBuyOrder.create({
      slug,
      buyerId: new mongoose.Types.ObjectId(String(userDoc._id)),
      buyerDiscordId,
      guildId: GUILD_ID,
      itemType,
      title,
      notes,
      criteria,
      quantity,
      remainingQuantity: quantity,
      offerPrice,
      escrowTotal,
      escrowRemaining: escrowTotal,
      durationDays,
      listingFeePaid: listingFee,
      expiresAt,
      views: 0,
      status: "active",
    });

    deductedTotalAmount = 0;

    // Kirim notifikasi Buy Order ke Channel Market Discord (non-blocking)
    try {
      const discordRef = await notifyCommunityBuyOrderCreated({
        slug: created.slug,
        buyerDiscordId,
        buyerName: userDoc.name || session.user.name || "Driver",
        itemType,
        title,
        criteria,
        notes,
        quantity,
        remainingQuantity: quantity,
        offerPrice,
        escrowTotal,
        expiresAt,
      });
      if (discordRef) {
        await CommunityMarketBuyOrder.updateOne(
          { _id: created._id },
          {
            $set: {
              discordChannelId: discordRef.channelId,
              discordMessageId: discordRef.messageId,
            },
          }
        );
      }
    } catch (discordErr) {
      console.error("[CM POST BuyOrder] Discord notify error:", discordErr);
    }

    try {
      revalidatePath("/community-market");
      revalidatePath("/dashboard/currency");
      revalidatePath("/dashboard/transactions");
    } catch {
      // Non-fatal
    }

    return jsonNoCache({
      success: true,
      message: "Buy Order berhasil diterbitkan dan dana escrow telah diamankan!",
      buyOrder: {
        ...created.toObject(),
        _id: String(created._id),
      },
    });
  } catch (err: any) {
    console.error("[CM POST BuyOrder] Error:", err);
    if (deductedTotalAmount > 0 && buyerDiscordIdForRollback) {
      try {
        const client = await clientPromise;
        const db = client.db();
        await db.collection("currencies").updateOne(
          { userId: buyerDiscordIdForRollback, guildId: GUILD_ID },
          { $inc: { totalNC: deductedTotalAmount } }
        );
      } catch (rbErr) {
        console.error("[CM POST BuyOrder] Rollback error:", rbErr);
      }
    }
    return jsonNoCache(
      { success: false, error: err?.message || "Gagal membuat Buy Order." },
      { status: 500 }
    );
  }
}
