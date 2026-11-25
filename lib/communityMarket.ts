import crypto from "crypto";
import clientPromise from "@/lib/mongodb";
import dbConnect from "@/lib/mongoose";
import { redis } from "@/lib/redis";
import CommunityMarketListing from "@/lib/models/CommunityMarketListing";
import CommunityMarketBuyOrder from "@/lib/models/CommunityMarketBuyOrder";
import CommunityMarketTrade from "@/lib/models/CommunityMarketTrade";
import CommunityMarketReview from "@/lib/models/CommunityMarketReview";
import UserVoucher from "@/lib/models/UserVoucher";
import Notification from "@/lib/models/Notification";
import {
  getCommunityMarketConfig,
  type CommunityMarketItemType,
} from "@/lib/communityMarketConfig";

export const GUILD_ID =
  process.env.DISCORD_GUILD_ID || process.env.GUILD_ID || "863959415702028318";

export function generateMarketSlug(baseTitle: string): string {
  const clean = (baseTitle || "item")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48);
  const suffix = crypto.randomBytes(3).toString("hex");
  return `${clean || "item"}-${suffix}`;
}

export function generateTradeTrxId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `CMT-${ts}-${rnd}`;
}

/**
 * Lazy Auto-Expiry Sweeper (Idempoten + Atomic Lock + Redis Throttle 60 detik).
 * Mengembalikan aset penjual (Voucher / Safebox Tiket) dan Escrow NC pembeli untuk iklan yang kedaluwarsa.
 */
export async function sweepExpiredCommunityMarketItems(force = false): Promise<void> {
  if (!force) {
    try {
      const acquired = await redis.set("cm:sweep:lock", "1", "EX", 60, "NX");
      if (!acquired) return;
    } catch {
      // Lanjutkan jika Redis sementara tidak tersedia
    }
  }

  try {
    await dbConnect();
    const client = await clientPromise;
    const db = client.db();
    const config = await getCommunityMarketConfig();
    const now = new Date();
    const voucherCutoff = new Date(
      now.getTime() + config.minVoucherRemainingHours * 3600 * 1000
    );

    // 1. Cari Sell Listings yang sudah melewati expiresAt ATAU vouchernya sudah mendekati kadaluarsa
    const expiredListings = await CommunityMarketListing.find({
      status: "active",
      $or: [
        { expiresAt: { $lte: now } },
        {
          itemType: "VOUCHER",
          "itemSnapshot.expiresAt": { $ne: null, $lte: voucherCutoff },
        },
      ],
    })
      .limit(50)
      .lean();

    for (const listing of expiredListings) {
      // Atomic Lock: hanya proses sekali
      const locked = await CommunityMarketListing.findOneAndUpdate(
        { _id: listing._id, status: "active" },
        { $set: { status: "expired" } },
        { returnDocument: "after" }
      );
      if (!locked) continue;

      if (locked.itemType === "VOUCHER" && locked.itemRefId) {
        const voucher = await UserVoucher.findById(locked.itemRefId);
        if (voucher && voucher.status === "LISTED") {
          const isPastVoucherExp =
            voucher.expiresAt && new Date(voucher.expiresAt).getTime() <= now.getTime();
          voucher.status = isPastVoucherExp ? "EXPIRED" : "ACTIVE";
          await voucher.save();
        }
      } else if (locked.itemType === "PENALTY_TICKET" && locked.remainingQuantity > 0) {
        await db.collection("garages").updateOne(
          { discordId: locked.sellerDiscordId },
          { $inc: { safeboxStock: locked.remainingQuantity } }
        );
      }

      try {
        await Notification.create({
          recipient: locked.sellerDiscordId,
          title: "Iklan Community Market Berakhir",
          message: `Iklan "${locked.itemSnapshot.title}" telah berakhir otomatis dan sisa aset Anda sudah dikembalikan ke inventaris.`,
          type: "info",
          link: "/community-market",
        });
      } catch (notifErr) {
        console.error("[CM Sweep] Failed creating listing expiry notification:", notifErr);
      }
    }

    // 2. Cari Buy Orders yang sudah melewati expiresAt
    const expiredBuyOrders = await CommunityMarketBuyOrder.find({
      status: "active",
      expiresAt: { $lte: now },
    })
      .limit(50)
      .lean();

    for (const order of expiredBuyOrders) {
      const locked = await CommunityMarketBuyOrder.findOneAndUpdate(
        { _id: order._id, status: "active" },
        { $set: { status: "expired" } },
        { returnDocument: "after" }
      );
      if (!locked) continue;

      if (locked.escrowRemaining > 0) {
        await db.collection("currencies").updateOne(
          { userId: locked.buyerDiscordId, guildId: locked.guildId || GUILD_ID },
          {
            $inc: { totalNC: locked.escrowRemaining },
            $setOnInsert: { createdAt: now },
          },
          { upsert: true }
        );
        await db.collection("currencyhistories").insertOne({
          userId: locked.buyerDiscordId,
          guildId: locked.guildId || GUILD_ID,
          amount: locked.escrowRemaining,
          type: "earn",
          reason: `Pengembalian Escrow Buy Order Kedaluwarsa: ${locked.title}`,
          createdAt: now,
        });
      }

      try {
        await Notification.create({
          recipient: locked.buyerDiscordId,
          title: "Buy Order Berakhir — Escrow Dikembalikan",
          message: `Buy Order "${locked.title}" telah berakhir. Sisa dana escrow ${locked.escrowRemaining.toLocaleString("id-ID")} NC dikembalikan 100% ke dompet Anda.`,
          type: "info",
          link: "/community-market",
        });
      } catch (notifErr) {
        console.error("[CM Sweep] Failed creating buy order expiry notification:", notifErr);
      }
    }
  } catch (err) {
    console.error("[CM Sweep] Error sweeping expired items:", err);
  }
}

export interface EnrichedMarketUser {
  discordId: string;
  name: string;
  image: string | null;
  truckyId: string | null;
  role: string;
  truckyRank: string;
  isBooster: boolean;
  isNismaraPlus: boolean;
  nismaraPlusStartedAt: string | null;
  topManager: { status?: boolean; month?: string | null; expiredAt?: string | null } | null;
  sellerRating: number;
  reviewCount: number;
  totalSold: number;
}

export async function getEnrichedMarketUsersMap(
  discordIds: string[]
): Promise<Record<string, EnrichedMarketUser>> {
  const uniqueIds = Array.from(new Set(discordIds.filter(Boolean).map(String)));
  if (uniqueIds.length === 0) return {};

  await dbConnect();
  const client = await clientPromise;
  const db = client.db();

  const [users, driverLinks, reviewAgg, tradeAgg] = await Promise.all([
    db
      .collection("users")
      .find(
        { discordId: { $in: uniqueIds } },
        {
          projection: {
            discordId: 1,
            name: 1,
            image: 1,
            truckyId: 1,
            role: 1,
            truckyRank: 1,
            isBooster: 1,
            nismaraplus: 1,
            topManager: 1,
          },
        }
      )
      .toArray(),
    db
      .collection("driverlinks")
      .find(
        { userId: { $in: uniqueIds } },
        { projection: { userId: 1, truckyId: 1, truckyName: 1, truckyRank: 1 } }
      )
      .toArray(),
    CommunityMarketReview.aggregate([
      { $match: { sellerDiscordId: { $in: uniqueIds } } },
      {
        $group: {
          _id: "$sellerDiscordId",
          avgRating: { $avg: "$rating" },
          reviewCount: { $sum: 1 },
        },
      },
    ]),
    CommunityMarketTrade.aggregate([
      { $match: { sellerDiscordId: { $in: uniqueIds } } },
      {
        $group: {
          _id: "$sellerDiscordId",
          totalSold: { $sum: 1 },
        },
      },
    ]),
  ]);

  const linkByDiscord = new Map<string, any>();
  for (const dl of driverLinks) {
    linkByDiscord.set(String(dl.userId), dl);
  }
  const reviewByDiscord = new Map<string, { avgRating: number; reviewCount: number }>();
  for (const r of reviewAgg) {
    reviewByDiscord.set(String(r._id), {
      avgRating: Number((r.avgRating || 0).toFixed(1)),
      reviewCount: r.reviewCount || 0,
    });
  }
  const soldByDiscord = new Map<string, number>();
  for (const t of tradeAgg) {
    soldByDiscord.set(String(t._id), t.totalSold || 0);
  }

  const now = Date.now();
  const map: Record<string, EnrichedMarketUser> = {};

  for (const id of uniqueIds) {
    const u = users.find((x) => String(x.discordId) === id);
    const dl = linkByDiscord.get(id);
    const rev = reviewByDiscord.get(id);
    const isNplus = Boolean(
      u?.nismaraplus?.status === true &&
        (!u?.nismaraplus?.expiredAt || new Date(u.nismaraplus.expiredAt).getTime() > now)
    );

    map[id] = {
      discordId: id,
      name: u?.name || dl?.truckyName || "Driver Nismara",
      image: u?.image || null,
      truckyId: u?.truckyId ? String(u.truckyId) : dl?.truckyId ? String(dl.truckyId) : null,
      role: u?.role || "driver",
      truckyRank: u?.truckyRank || dl?.truckyRank || "",
      isBooster: Boolean(u?.isBooster),
      isNismaraPlus: isNplus,
      nismaraPlusStartedAt: u?.nismaraplus?.startedAt
        ? new Date(u.nismaraplus.startedAt).toISOString()
        : null,
      topManager: u?.topManager
        ? {
            status: Boolean(u.topManager.status),
            month: u.topManager.month || null,
            expiredAt: u.topManager.expiredAt
              ? new Date(u.topManager.expiredAt).toISOString()
              : null,
          }
        : null,
      sellerRating: rev?.avgRating || 0,
      reviewCount: rev?.reviewCount || 0,
      totalSold: soldByDiscord.get(id) || 0,
    };
  }

  return map;
}

export interface MarketPriceGuideItem {
  key: string; // "PENALTY_TICKET" or voucher category
  avgPrice: number;
  minSoldPrice: number;
  maxSoldPrice: number;
  tradeCount: number;
}

export async function getMarketPriceGuideMap(): Promise<Record<string, MarketPriceGuideItem>> {
  await dbConnect();
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);

  const agg = await CommunityMarketTrade.aggregate([
    { $match: { createdAt: { $gte: since } } },
    {
      $group: {
        _id: "$itemCategory",
        avgPrice: { $avg: "$unitPrice" },
        minSoldPrice: { $min: "$unitPrice" },
        maxSoldPrice: { $max: "$unitPrice" },
        tradeCount: { $sum: 1 },
      },
    },
  ]);

  const map: Record<string, MarketPriceGuideItem> = {};
  for (const row of agg) {
    map[String(row._id)] = {
      key: String(row._id),
      avgPrice: Math.round(row.avgPrice || 0),
      minSoldPrice: Math.round(row.minSoldPrice || 0),
      maxSoldPrice: Math.round(row.maxSoldPrice || 0),
      tradeCount: row.tradeCount || 0,
    };
  }
  return map;
}

/**
 * Menghitung total tiket Safebox yang sedang aktif di Sell Listings milik user.
 */
export async function getUserListedSafeboxTickets(discordId: string): Promise<number> {
  await dbConnect();
  const agg = await CommunityMarketListing.aggregate([
    {
      $match: {
        sellerDiscordId: String(discordId),
        itemType: "PENALTY_TICKET",
        status: "active",
      },
    },
    { $group: { _id: null, total: { $sum: "$remainingQuantity" } } },
  ]);
  return agg[0]?.total || 0;
}

/**
 * Menghitung total tiket Safebox yang sedang dipesan melalui Buy Orders aktif milik user.
 */
export async function getUserPendingBuyOrderTickets(discordId: string): Promise<number> {
  await dbConnect();
  const agg = await CommunityMarketBuyOrder.aggregate([
    {
      $match: {
        buyerDiscordId: String(discordId),
        itemType: "PENALTY_TICKET",
        status: "active",
      },
    },
    { $group: { _id: null, total: { $sum: "$remainingQuantity" } } },
  ]);
  return agg[0]?.total || 0;
}

/**
 * Mengecek apakah sebuah voucher milik seller memenuhi kriteria sebuah Buy Order.
 */
export function doesVoucherMatchBuyOrder(
  voucher: any,
  buyOrder: {
    criteria?: {
      category?: string;
      discountType?: "percentage" | "fixed" | "any";
      minDiscountValue?: number;
      minDurationHours?: number;
      minRemainingDays?: number;
      requireUnlimitedMaxDiscount?: boolean;
    };
  },
  minVoucherRemainingHours: number
): { match: boolean; reason?: string } {
  const c = buyOrder.criteria || {};
  const normalizeCat = (v?: string) => (v === "GARAGE_UPGRADE" ? "GARAGE_RENT" : v || "");
  if (c.category && normalizeCat(voucher.category) !== normalizeCat(c.category)) {
    return { match: false, reason: "Kategori voucher tidak sesuai permintaan." };
  }

  if (c.discountType && c.discountType !== "any" && voucher.category !== "NC_BOOSTER") {
    if (voucher.discountType !== c.discountType) {
      return { match: false, reason: "Tipe diskon voucher tidak sesuai." };
    }
  }

  if (c.minDiscountValue && Number(voucher.discountValue || 0) < Number(c.minDiscountValue)) {
    return {
      match: false,
      reason: `Nilai diskon/boost minimal ${c.minDiscountValue}${voucher.discountType === "fixed" ? " NC" : "%"}.`,
    };
  }

  if (
    voucher.category === "NC_BOOSTER" &&
    c.minDurationHours &&
    Number(voucher.durationHours || 0) < Number(c.minDurationHours)
  ) {
    return {
      match: false,
      reason: `Durasi booster minimal ${c.minDurationHours} jam.`,
    };
  }

  if (c.requireUnlimitedMaxDiscount && Number(voucher.maxDiscount || 0) > 0) {
    return {
      match: false,
      reason: "Pembeli meminta voucher Tanpa Batas Potongan (Unlimited).",
    };
  }

  const requiredHours = Math.max(
    minVoucherRemainingHours,
    (Number(c.minRemainingDays) || 1) * 24
  );

  if (voucher.expiresAt) {
    const remainingMs = new Date(voucher.expiresAt).getTime() - Date.now();
    if (remainingMs < requiredHours * 3600 * 1000) {
      return {
        match: false,
        reason: `Sisa masa aktif voucher kurang dari minimal ${Math.ceil(requiredHours / 24)} hari.`,
      };
    }
  }

  return { match: true };
}

export function buildBuyOrderTitle(
  itemType: CommunityMarketItemType,
  criteria?: {
    category?: string;
    discountType?: string;
    minDiscountValue?: number;
    minDurationHours?: number;
    requireUnlimitedMaxDiscount?: boolean;
  }
): string {
  if (itemType === "PENALTY_TICKET") {
    return "Dicari: Tiket Penghapus Penalti";
  }

  const catNames: Record<string, string> = {
    FLEET_BUY: "Voucher Dealer Armada",
    FLEET_MAINTENANCE: "Voucher Servis Armada",
    GARAGE_RENT: "Voucher Operasional Garasi",
    GARAGE_UPGRADE: "Voucher Operasional Garasi",
    MARKET_MOD: "Voucher Mod Workshop",
    NC_BOOSTER: "Voucher NC Booster",
  };
  const label = catNames[criteria?.category || ""] || "Voucher Driver";

  if (criteria?.category === "NC_BOOSTER") {
    const pct = criteria.minDiscountValue || 50;
    const hrs = criteria.minDurationHours || 2;
    return `Dicari: ${label} min. +${pct}% (${hrs}+ Jam)`;
  }

  const val = criteria?.minDiscountValue || 10;
  const valStr =
    criteria?.discountType === "fixed"
      ? `min. ${Number(val).toLocaleString("id-ID")} NC`
      : `min. ${val}%`;
  const unlimStr = criteria?.requireUnlimitedMaxDiscount ? " Unlimited" : "";
  return `Dicari: ${label} ${valStr}${unlimStr}`;
}
