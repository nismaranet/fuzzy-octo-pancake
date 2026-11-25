import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import clientPromise from "@/lib/mongodb";
import dbConnect from "@/lib/mongoose";
import { jsonNoCache } from "@/lib/antiCache";
import { checkRateLimit } from "@/lib/rateLimit";
import { isWebOwner } from "@/lib/webConfig";
import { grantVoucher, type VoucherCategory } from "@/lib/voucher";
import VoucherGrantLog from "@/lib/models/VoucherGrantLog";
import UserVoucher from "@/lib/models/UserVoucher";
import Notification from "@/lib/models/Notification";
import { buildAutoVoucherTitle } from "@/lib/communityMarketShared";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const GUILD_ID =
  process.env.DISCORD_GUILD_ID || process.env.GUILD_ID || "863959415702028318";

const VALID_CATEGORIES: VoucherCategory[] = [
  "NC_BOOSTER",
  "FLEET_MAINTENANCE",
  "FLEET_BUY",
  "GARAGE_RENT",
  "MARKET_MOD",
];

async function requireWebOwnerSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.discordId) {
    return { authorized: false as const, status: 401, error: "Unauthorized" };
  }
  const ownerOk = await isWebOwner(session.user.discordId);
  if (!ownerOk) {
    return {
      authorized: false as const,
      status: 403,
      error: "Akses ditolak. Fitur ini khusus untuk Developer & Owner Nismara Transport.",
    };
  }
  return { authorized: true as const, session };
}

export async function GET(request: Request) {
  try {
    const auth = await requireWebOwnerSession();
    if (!auth.authorized) {
      return jsonNoCache({ success: false, error: auth.error }, { status: auth.status });
    }

    await dbConnect();
    const { searchParams } = new URL(request.url);
    const search = (searchParams.get("search") || "").trim();
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 50)));

    const filter: any = {};
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { actorName: regex },
        { actorDiscordId: regex },
        { recipientName: regex },
        { recipientDiscordId: regex },
        { recipientTruckyId: regex },
        { reason: regex },
        { voucherCodes: regex },
        { "voucherSnapshot.title": regex },
      ];
    }

    const logsRaw = await VoucherGrantLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    // Ambil status terkini voucher-voucher dari log untuk melihat apakah masih ACTIVE / USED / LISTED / EXPIRED
    const allVoucherIds = logsRaw.flatMap((l) => l.voucherIds || []);
    const voucherDocs = allVoucherIds.length
      ? await UserVoucher.find(
          { _id: { $in: allVoucherIds } },
          { _id: 1, code: 1, status: 1 }
        ).lean()
      : [];
    const statusById = new Map<string, string>();
    for (const vd of voucherDocs) {
      statusById.set(String(vd._id), vd.status);
    }

    const logs = logsRaw.map((l) => ({
      ...l,
      _id: String(l._id),
      recipientUserId: l.recipientUserId ? String(l.recipientUserId) : null,
      voucherIds: (l.voucherIds || []).map(String),
      voucherStatuses: (l.voucherIds || []).map((vid) => ({
        id: String(vid),
        status: statusById.get(String(vid)) || "DELETED",
      })),
    }));

    return jsonNoCache({ success: true, logs });
  } catch (err: any) {
    console.error("[Owner Manual Voucher GET] Error:", err);
    return jsonNoCache(
      { success: false, error: err?.message || "Gagal memuat log voucher manual." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireWebOwnerSession();
    if (!auth.authorized) {
      return jsonNoCache({ success: false, error: auth.error }, { status: auth.status });
    }

    const actorDiscordId = String(auth.session.user.discordId);
    const actorName = auth.session.user.name || "Owner";

    if (!checkRateLimit(actorDiscordId, "owner-grant-voucher", 1500)) {
      return jsonNoCache(
        { success: false, error: "Terlalu cepat. Mohon tunggu sebentar." },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const recipientDiscordId = String(body.recipientDiscordId || "").trim();
    const category = String(body.category || "") as VoucherCategory;
    const discountType =
      category === "NC_BOOSTER"
        ? "percentage"
        : body.discountType === "fixed"
          ? "fixed"
          : "percentage";
    const discountValue = Math.round(Number(body.discountValue || 0));
    const maxDiscount =
      category === "NC_BOOSTER" || discountType === "fixed"
        ? 0
        : Math.max(0, Math.round(Number(body.maxDiscount || 0)));
    const minSpend =
      category === "NC_BOOSTER" ? 0 : Math.max(0, Math.round(Number(body.minSpend || 0)));
    const durationHours =
      category === "NC_BOOSTER"
        ? Math.max(1, Math.min(168, Math.round(Number(body.durationHours || 2))))
        : 0;
    const expiresInDays = Math.max(0, Math.min(365, Math.round(Number(body.expiresInDays ?? 30))));
    const quantity = Math.max(1, Math.min(10, Math.floor(Number(body.quantity || 1))));
    const tradable = typeof body.tradable === "boolean" ? body.tradable : true;
    const notifyRecipient =
      typeof body.notifyRecipient === "boolean" ? body.notifyRecipient : true;
    const reason = String(body.reason || "").trim().slice(0, 400);

    if (!recipientDiscordId) {
      return jsonNoCache(
        { success: false, error: "Pilih driver penerima terlebih dahulu." },
        { status: 400 }
      );
    }
    if (!VALID_CATEGORIES.includes(category)) {
      return jsonNoCache(
        { success: false, error: "Kategori voucher tidak valid." },
        { status: 400 }
      );
    }
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      return jsonNoCache(
        { success: false, error: "Nilai diskon/boost harus lebih dari 0." },
        { status: 400 }
      );
    }
    if (discountType === "percentage" && category !== "NC_BOOSTER" && discountValue > 100) {
      return jsonNoCache(
        { success: false, error: "Persentase diskon maksimal 100%." },
        { status: 400 }
      );
    }
    if (reason.length < 5) {
      return jsonNoCache(
        { success: false, error: "Alasan pembuatan voucher wajib diisi (minimal 5 karakter)." },
        { status: 400 }
      );
    }

    await dbConnect();
    const client = await clientPromise;
    const db = client.db();

    const recipientUser = await db
      .collection("users")
      .findOne({ discordId: recipientDiscordId });
    if (!recipientUser) {
      return jsonNoCache(
        { success: false, error: "Akun penerima tidak ditemukan di database users." },
        { status: 404 }
      );
    }

    const customTitle = String(body.title || "").trim();
    const title =
      customTitle ||
      (discountType === "fixed"
        ? `Voucher Potongan ${discountValue.toLocaleString("id-ID")} NC`
        : buildAutoVoucherTitle({
            category,
            discountValue,
            durationHours,
            maxDiscount,
          }));
    const description =
      String(body.description || "").trim() ||
      `Diterbitkan manual oleh ${actorName} (${reason})`;

    const createdVoucherIds: mongoose.Types.ObjectId[] = [];
    const createdVoucherCodes: string[] = [];

    for (let i = 0; i < quantity; i++) {
      const v = await grantVoucher({
        userId: new mongoose.Types.ObjectId(String(recipientUser._id)),
        discordId: recipientDiscordId,
        guildId: GUILD_ID,
        title,
        description,
        category,
        discountType,
        discountValue,
        maxDiscount,
        minSpend,
        durationHours,
        source: "OWNER_MANUAL_GRANT",
        tradable,
        expiresInDays: expiresInDays > 0 ? expiresInDays : undefined,
      });
      createdVoucherIds.push(v._id as mongoose.Types.ObjectId);
      createdVoucherCodes.push(v.code);
    }

    const logDoc = await VoucherGrantLog.create({
      actorDiscordId,
      actorName,
      recipientDiscordId,
      recipientUserId: new mongoose.Types.ObjectId(String(recipientUser._id)),
      recipientName: recipientUser.name || "Driver Nismara",
      recipientTruckyId: recipientUser.truckyId ? String(recipientUser.truckyId) : null,
      reason,
      quantity,
      voucherIds: createdVoucherIds,
      voucherCodes: createdVoucherCodes,
      voucherSnapshot: {
        title,
        category,
        discountType,
        discountValue,
        maxDiscount,
        minSpend,
        durationHours,
        expiresInDays,
        tradable,
      },
    });

    if (notifyRecipient) {
      try {
        await Notification.create({
          recipient: recipientDiscordId,
          title:
            quantity > 1
              ? `Anda Menerima ${quantity}x Voucher Baru!`
              : "Anda Menerima Voucher Baru!",
          message: `Voucher "${title}" telah ditambahkan ke Dompet Voucher Anda (${reason}).`,
          type: "success",
          link: "/dashboard/vouchers",
        });
      } catch (notifErr) {
        console.error("[Owner Manual Voucher] Notification error:", notifErr);
      }
    }

    try {
      revalidatePath("/dashboard/manage/vouchers");
      revalidatePath("/dashboard/vouchers");
      revalidatePath("/dashboard/garage");
    } catch {
      // Non-fatal
    }

    return jsonNoCache({
      success: true,
      message: `Berhasil menerbitkan ${quantity}x "${title}" untuk ${recipientUser.name || recipientDiscordId}!`,
      codes: createdVoucherCodes,
      logId: String(logDoc._id),
    });
  } catch (err: any) {
    console.error("[Owner Manual Voucher POST] Error:", err);
    return jsonNoCache(
      { success: false, error: err?.message || "Gagal menerbitkan voucher manual." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireWebOwnerSession();
    if (!auth.authorized) {
      return jsonNoCache({ success: false, error: auth.error }, { status: auth.status });
    }

    const body = await request.json().catch(() => ({}));
    const logId = String(body.logId || "");
    if (!mongoose.Types.ObjectId.isValid(logId)) {
      return jsonNoCache({ success: false, error: "ID Log tidak valid." }, { status: 400 });
    }

    await dbConnect();
    const log = await VoucherGrantLog.findById(logId);
    if (!log) {
      return jsonNoCache({ success: false, error: "Log tidak ditemukan." }, { status: 404 });
    }

    // Hanya hapus voucher yang masih berstatus ACTIVE (tidak mengganggu yang sudah dipakai/terjual)
    const delRes = await UserVoucher.deleteMany({
      _id: { $in: log.voucherIds },
      status: "ACTIVE",
    });

    if (delRes.deletedCount === 0) {
      return jsonNoCache(
        {
          success: false,
          error:
            "Tidak ada voucher berstatus ACTIVE yang bisa dicabut (mungkin sudah dipakai, sedang dijual di Community Market, atau sudah dihapus).",
        },
        { status: 400 }
      );
    }

    log.revokedAt = new Date();
    log.revokedByDiscordId = String(auth.session.user.discordId);
    log.revokedByName = auth.session.user.name || "Owner";
    await log.save();

    try {
      revalidatePath("/dashboard/manage/vouchers");
      revalidatePath("/dashboard/vouchers");
      revalidatePath("/dashboard/garage");
    } catch {
      // Non-fatal
    }

    return jsonNoCache({
      success: true,
      message: `${delRes.deletedCount} voucher berstatus ACTIVE berhasil dicabut (riwayat log audit tetap tersimpan).`,
      deletedCount: delRes.deletedCount,
    });
  } catch (err: any) {
    console.error("[Owner Manual Voucher DELETE] Error:", err);
    return jsonNoCache(
      { success: false, error: err?.message || "Gagal mencabut voucher." },
      { status: 500 }
    );
  }
}
