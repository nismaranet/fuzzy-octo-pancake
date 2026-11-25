import crypto from "crypto";
import { getServerSession } from "next-auth/next";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import clientPromise from "@/lib/mongodb";
import { jsonNoCache } from "@/lib/antiCache";
import { checkRateLimit } from "@/lib/rateLimit";
import { getWebConfig } from "@/lib/webConfig";
import { grantVoucher } from "@/lib/voucher";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type RewardTier = "common" | "uncommon" | "rare" | "epic" | "jackpot";

interface SantaRewardDef {
  id: string;
  weight: number; // Total across all items = 1000 (100.0%)
  tier: RewardTier;
  kind: "NC" | "FUEL" | "VOUCHER";
  label: string;
  detail: string;
  amount?: number;
  voucher?: {
    title: string;
    description: string;
    category: "FLEET_MAINTENANCE" | "FLEET_BUY" | "NC_BOOSTER";
    discountValue: number;
    durationHours?: number;
    expiresInDays: number;
  };
}

// Total weight = 1000 (100.0%)
// Hadiah umum kecil (500-1.000 NC & 150 L Fuel = 71%), menengah = 25%, epic 5.000 NC = 2%, jackpot = 2% (0.8% + 0.7% + 0.5%)
const SANTA_LOOT_TABLE: SantaRewardDef[] = [
  {
    id: "nc_500",
    weight: 260,
    tier: "common",
    kind: "NC",
    amount: 500,
    label: "500,00 NC",
    detail: "Bonus Nismara Coin harian langsung masuk ke dompetmu.",
  },
  {
    id: "nc_750",
    weight: 180,
    tier: "common",
    kind: "NC",
    amount: 750,
    label: "750,00 NC",
    detail: "Tambahan saldo Nismara Coin dari kantong kado Santa.",
  },
  {
    id: "nc_1000",
    weight: 140,
    tier: "common",
    kind: "NC",
    amount: 1000,
    label: "1.000,00 NC",
    detail: "Saldo Nismara Coin ekstra untuk menemani perjalanan akhir tahun.",
  },
  {
    id: "fuel_150",
    weight: 130,
    tier: "common",
    kind: "FUEL",
    amount: 150,
    label: "150 L Bahan Bakar",
    detail: "Stok solar tambahan langsung diisi ke tangki garasimu.",
  },
  {
    id: "fuel_300",
    weight: 75,
    tier: "uncommon",
    kind: "FUEL",
    amount: 300,
    label: "300 L Bahan Bakar",
    detail: "Pasokan bahan bakar garasi untuk rute jarak jauh akhir tahun.",
  },
  {
    id: "nc_2000",
    weight: 65,
    tier: "uncommon",
    kind: "NC",
    amount: 2000,
    label: "2.000,00 NC",
    detail: "Bonus Nismara Coin spesial musim liburan dari Santa.",
  },
  {
    id: "vch_service_25",
    weight: 50,
    tier: "uncommon",
    kind: "VOUCHER",
    label: "Voucher Diskon Servis 25%",
    detail: "Potongan biaya perawatan armada sebesar 25% di garasi.",
    voucher: {
      title: "Santa Gift: Diskon Servis 25%",
      description: "Hadiah harian Santa Natal & Tahun Baru: potongan 25% untuk servis armada.",
      category: "FLEET_MAINTENANCE",
      discountValue: 25,
      expiresInDays: 30,
    },
  },
  {
    id: "vch_booster_50_2h",
    weight: 35,
    tier: "rare",
    kind: "VOUCHER",
    label: "Voucher Booster NC +50% (2 Jam)",
    detail: "Aktifkan dari menu My Vouchers untuk bonus +50% pendapatan NC selama 2 jam.",
    voucher: {
      title: "Santa Gift: NC Booster +50% (2 Jam)",
      description: "Hadiah harian Santa: tambahan +50% pendapatan NC selama 2 jam setelah diaktifkan.",
      category: "NC_BOOSTER",
      discountValue: 50,
      durationHours: 2,
      expiresInDays: 30,
    },
  },
  {
    id: "vch_fleet_15",
    weight: 25,
    tier: "rare",
    kind: "VOUCHER",
    label: "Voucher Diskon Beli Fleet 15%",
    detail: "Potongan harga 15% saat memesan armada baru di Fleet Store.",
    voucher: {
      title: "Santa Gift: Diskon Beli Fleet 15%",
      description: "Hadiah harian Santa: potongan 15% pembelian armada baru.",
      category: "FLEET_BUY",
      discountValue: 15,
      expiresInDays: 30,
    },
  },
  {
    id: "nc_5000",
    weight: 20,
    tier: "epic",
    kind: "NC",
    amount: 5000,
    label: "5.000,00 NC",
    detail: "Kado Nismara Coin terbesar dari kereta Santa hari ini.",
  },
  {
    id: "vch_service_100",
    weight: 8,
    tier: "jackpot",
    kind: "VOUCHER",
    label: "Jackpot: Diskon Servis Armada 100%",
    detail: "Hadiah langka! Gratis biaya servis armada penuh 100% di garasi.",
    voucher: {
      title: "Santa Jackpot: Gratis Servis 100%",
      description: "Hadiah langka Santa Natal & Tahun Baru: diskon 100% servis armada.",
      category: "FLEET_MAINTENANCE",
      discountValue: 100,
      expiresInDays: 45,
    },
  },
  {
    id: "vch_booster_100_4h",
    weight: 7,
    tier: "jackpot",
    kind: "VOUCHER",
    label: "Jackpot: Double NC +100% (4 Jam)",
    detail: "Hadiah langka! Gandakan pendapatan NC (+100%) selama 4 jam penuh.",
    voucher: {
      title: "Santa Jackpot: Double NC 2x (4 Jam)",
      description: "Hadiah langka Santa: gandakan pendapatan NC (+100%) selama 4 jam setelah diaktifkan.",
      category: "NC_BOOSTER",
      discountValue: 100,
      durationHours: 4,
      expiresInDays: 45,
    },
  },
  {
    id: "vch_fleet_50",
    weight: 5,
    tier: "jackpot",
    kind: "VOUCHER",
    label: "Jackpot: Diskon Beli Fleet 50%",
    detail: "Hadiah super langka! Potongan setengah harga (50%) untuk beli armada baru.",
    voucher: {
      title: "Santa Jackpot: Diskon Beli Fleet 50%",
      description: "Hadiah super langka Santa Natal & Tahun Baru: diskon 50% pembelian armada baru.",
      category: "FLEET_BUY",
      discountValue: 50,
      expiresInDays: 45,
    },
  },
];

function getWibDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = Number(parts.find((p) => p.type === "year")?.value || date.getUTCFullYear());
  const month = Number(parts.find((p) => p.type === "month")?.value || 1);
  const day = Number(parts.find((p) => p.type === "day")?.value || 1);
  const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { year, month, day, key };
}

/**
 * Periode klaim Santa aktif: 20 Desember s/d 2 Januari (WIB).
 */
function isWithinSantaWindow(date = new Date()): boolean {
  const { month, day } = getWibDateParts(date);
  return (month === 12 && day >= 20) || (month === 1 && day <= 2);
}

function rollSantaReward(): SantaRewardDef {
  const totalWeight = SANTA_LOOT_TABLE.reduce((acc, item) => acc + item.weight, 0);
  let cursor = crypto.randomInt(0, totalWeight);
  for (const item of SANTA_LOOT_TABLE) {
    if (cursor < item.weight) return item;
    cursor -= item.weight;
  }
  return SANTA_LOOT_TABLE[0];
}

export async function GET() {
  try {
    const webConfig = await getWebConfig();
    const isHolidayActive = webConfig.features.seasonTheme === "christmas_new_year";
    const now = new Date();
    const todayWib = getWibDateParts(now).key;
    const inClaimWindow = isWithinSantaWindow(now);

    if (!isHolidayActive) {
      return jsonNoCache({
        active: false,
        inClaimWindow: false,
        isLoggedIn: false,
        isDriver: false,
        eligible: false,
        claimedToday: false,
        todayWib,
      });
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.discordId) {
      return jsonNoCache({
        active: true,
        inClaimWindow,
        isLoggedIn: false,
        isDriver: false,
        eligible: false,
        claimedToday: false,
        todayWib,
      });
    }

    const discordId = String(session.user.discordId);
    const client = await clientPromise;
    const db = client.db();
    const user = await db.collection("users").findOne(
      { discordId },
      { projection: { isDriver: 1, santaGift: 1, accountHold: 1 } }
    );

    const isDriver = Boolean(user?.isDriver && user?.accountHold?.status !== true);
    const claimedToday = user?.santaGift?.lastClaimDateWib === todayWib;

    return jsonNoCache({
      active: true,
      inClaimWindow,
      isLoggedIn: true,
      isDriver,
      eligible: isDriver && inClaimWindow && !claimedToday,
      claimedToday,
      todayWib,
      lastRewardLabel: claimedToday ? user?.santaGift?.lastRewardLabel || null : null,
      totalClaims: Number(user?.santaGift?.totalClaims || 0),
    });
  } catch (error) {
    console.error("[GET /api/holiday/santa-claim] Error:", error);
    return jsonNoCache({ error: "Gagal memeriksa status hadiah Santa." }, { status: 500 });
  }
}

export async function POST() {
  let isGateLocked = false;
  let lockedDiscordId = "";
  let prevLastDate: string | null = null;
  let prevLastAt: Date | null = null;

  try {
    const webConfig = await getWebConfig();
    if (webConfig.features.seasonTheme !== "christmas_new_year") {
      return jsonNoCache(
        { error: "Event Natal & Tahun Baru sedang tidak aktif." },
        { status: 403 }
      );
    }

    const now = new Date();
    if (!isWithinSantaWindow(now)) {
      return jsonNoCache(
        { error: "Klaim hadiah harian Santa hanya dibuka pada 20 Desember sampai 2 Januari (WIB)." },
        { status: 403 }
      );
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.discordId) {
      return jsonNoCache(
        { error: "Silakan login terlebih dahulu untuk mengambil hadiah Santa." },
        { status: 401 }
      );
    }

    const discordId = String(session.user.discordId);
    if (!checkRateLimit(discordId, "santa-gift-claim", 3000)) {
      return jsonNoCache(
        { error: "Terlalu cepat. Tunggu sebentar sebelum mencoba lagi." },
        { status: 429 }
      );
    }

    const client = await clientPromise;
    const db = client.db();
    const guildId = process.env.DISCORD_GUILD_ID || process.env.GUILD_ID || "863959415702028318";
    const todayWib = getWibDateParts(now).key;

    const user = await db.collection("users").findOne(
      { discordId },
      { projection: { _id: 1, isDriver: 1, accountHold: 1, santaGift: 1 } }
    );

    if (!user) {
      return jsonNoCache({ error: "Akun tidak ditemukan." }, { status: 404 });
    }

    if (!user.isDriver || user.accountHold?.status === true) {
      return jsonNoCache(
        { error: "Hadiah harian Santa hanya dapat diklaim oleh driver resmi Nismara Transport." },
        { status: 403 }
      );
    }

    prevLastDate = user.santaGift?.lastClaimDateWib || null;
    prevLastAt = user.santaGift?.lastClaimAt ? new Date(user.santaGift.lastClaimAt) : null;

    // Atomic gate: kunci 1 klaim per hari WIB & pastikan status isDriver tetap true
    const gateRes = await db.collection("users").updateOne(
      {
        discordId,
        isDriver: true,
        "accountHold.status": { $ne: true },
        "santaGift.lastClaimDateWib": { $ne: todayWib },
      },
      {
        $set: {
          "santaGift.lastClaimDateWib": todayWib,
          "santaGift.lastClaimAt": now,
        },
        $inc: {
          "santaGift.totalClaims": 1,
        },
      }
    );

    if (gateRes.modifiedCount === 0) {
      return jsonNoCache(
        {
          error: "Kamu sudah mengambil hadiah Santa hari ini. Kembali lagi besok setelah 00:00 WIB.",
          claimedToday: true,
          lastRewardLabel: user.santaGift?.lastRewardLabel || null,
        },
        { status: 400 }
      );
    }

    isGateLocked = true;
    lockedDiscordId = discordId;

    const reward = rollSantaReward();
    let voucherCode: string | null = null;
    let destinationHref = "/dashboard";
    let destinationLabel = "Buka Dashboard";

    if (reward.kind === "NC" && reward.amount) {
      await db.collection("currencies").updateOne(
        { userId: discordId, guildId },
        {
          $inc: { totalNC: reward.amount },
          $setOnInsert: {
            userId: discordId,
            guildId,
            createdAt: now,
          },
        },
        { upsert: true }
      );

      await db.collection("currencyhistories").insertOne({
        userId: discordId,
        guildId,
        amount: reward.amount,
        type: "earn",
        reason: `Hadiah Harian Santa Natal & Tahun Baru (${reward.label})`,
        createdAt: now,
      });

      destinationHref = "/dashboard/currency";
      destinationLabel = "Lihat Dompet NC";
    } else if (reward.kind === "FUEL" && reward.amount) {
      const nextPaymentDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      await db.collection("garages").updateOne(
        { discordId },
        {
          $inc: { fuelStock: reward.amount },
          $setOnInsert: {
            userId: user._id,
            discordId,
            fleetSlot: 1,
            fleetSlotUsed: 0,
            fleetSlotLevel: 1,
            safeboxLevel: 1,
            safeboxStock: 0,
            fuelCapacity: 2000,
            fuelTankLevel: 1,
            operational_cost: 0,
            fleet_operational_cost: 0,
            fuel_operational_cost: 0,
            safebox_operational_cost: 0,
            next_payment_date: nextPaymentDate,
            mechanics: { umum: null, ban: null, mesin: null },
            status: "operational",
            createdAt: now,
          },
        },
        { upsert: true }
      );

      destinationHref = "/dashboard/garage";
      destinationLabel = "Lihat Garasi";
    } else if (reward.kind === "VOUCHER" && reward.voucher) {
      const created = await grantVoucher({
        userId: user._id.toString(),
        discordId,
        guildId,
        title: reward.voucher.title,
        description: reward.voucher.description,
        category: reward.voucher.category,
        discountType: "percentage",
        discountValue: reward.voucher.discountValue,
        durationHours: reward.voucher.durationHours || 0,
        source: "SANTA_DAILY_GIFT",
        expiresInDays: reward.voucher.expiresInDays,
        customCodePrefix: "SNT",
      });
      voucherCode = created?.code ? String(created.code) : null;
      destinationHref = "/dashboard/vouchers";
      destinationLabel = "Buka My Vouchers";
    }

    // Simpan label hadiah terakhir untuk status hari ini
    await db.collection("users").updateOne(
      { discordId },
      { $set: { "santaGift.lastRewardLabel": reward.label } }
    );

    try {
      revalidatePath("/dashboard");
      revalidatePath("/dashboard/currency");
      revalidatePath("/dashboard/garage");
      revalidatePath("/dashboard/vouchers");
    } catch {
      // Non-fatal
    }

    return jsonNoCache({
      success: true,
      todayWib,
      reward: {
        id: reward.id,
        tier: reward.tier,
        kind: reward.kind,
        label: reward.label,
        detail: reward.detail,
        amount: reward.amount || null,
        voucherCode,
        destinationHref,
        destinationLabel,
      },
    });
  } catch (error) {
    console.error("[POST /api/holiday/santa-claim] Error:", error);

    if (isGateLocked && lockedDiscordId) {
      try {
        const client = await clientPromise;
        await client.db().collection("users").updateOne(
          { discordId: lockedDiscordId },
          {
            $set: {
              "santaGift.lastClaimDateWib": prevLastDate,
              "santaGift.lastClaimAt": prevLastAt,
            },
            $inc: {
              "santaGift.totalClaims": -1,
            },
          }
        );
      } catch (rollbackErr) {
        console.error("[POST /api/holiday/santa-claim] Rollback failed:", rollbackErr);
      }
    }

    return jsonNoCache(
      { error: "Terjadi kesalahan saat memproses hadiah Santa. Silakan coba lagi." },
      { status: 500 }
    );
  }
}
