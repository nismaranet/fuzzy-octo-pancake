import { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongoose";
import { isWebOwner } from "@/lib/webConfig";
import { jsonNoCache } from "@/lib/antiCache";
import { checkRateLimit } from "@/lib/rateLimit";
import { slugify } from "@/lib/utils";
import PayrollRewardTemplate, {
  PAYROLL_VOUCHER_CATEGORIES,
  type IPayrollTierItem,
  type PayrollVoucherCategory,
} from "@/lib/models/PayrollRewardTemplate";
import PayrollMonthlySnapshot from "@/lib/models/PayrollMonthlySnapshot";
import {
  getCurrentAndPreviousMonthWib,
  getOrCreateMonthlyPayrollSnapshot,
} from "@/lib/managerSalary";
import {
  buildTierLabel,
  getNextMonthString,
  pickRotationTemplate,
} from "@/lib/payrollTemplates";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

async function requireOwner() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.discordId) {
    return { error: jsonNoCache({ success: false, error: "Unauthorized" }, { status: 401 }) };
  }
  const allowed = await isWebOwner(session.user.discordId);
  if (!allowed) {
    return {
      error: jsonNoCache(
        { success: false, error: "Akses ditolak. Fitur ini khusus Web Owner." },
        { status: 403 }
      ),
    };
  }
  return { discordId: String(session.user.discordId) };
}

export function sanitizeTiersPayload(rawTiers: unknown): IPayrollTierItem[] {
  if (!Array.isArray(rawTiers) || rawTiers.length === 0) {
    throw new Error("Daftar tier milestone tidak boleh kosong.");
  }
  if (rawTiers.length > 15) {
    throw new Error("Maksimal 15 tier milestone per template.");
  }

  const seenTiers = new Set<number>();
  const cleaned: IPayrollTierItem[] = rawTiers.map((raw: any) => {
    const tierNum = Math.floor(Number(raw?.tier));
    if (!Number.isFinite(tierNum) || tierNum < 1 || tierNum > 1000) {
      throw new Error("Nilai poin tier harus antara 1 sampai 1000.");
    }
    if (seenTiers.has(tierNum)) {
      throw new Error(`Terdapat duplikasi angka Tier ${tierNum}.`);
    }
    seenTiers.add(tierNum);

    const bonusNc = Math.max(0, Math.floor(Number(raw?.bonusNc || 0)));
    const penaltyTickets = Math.max(0, Math.floor(Number(raw?.penaltyTickets || 0)));
    const fuelLiters = Math.max(0, Math.floor(Number(raw?.fuelLiters || 0)));

    const rawVouchers = Array.isArray(raw?.vouchers) ? raw.vouchers : [];
    const vouchers = rawVouchers.slice(0, 5).map((v: any) => {
      const cat = String(v?.category || "") as PayrollVoucherCategory;
      if (!PAYROLL_VOUCHER_CATEGORIES.includes(cat)) {
        throw new Error(`Kategori voucher tidak valid pada Tier ${tierNum}.`);
      }
      const title = String(v?.title || "").trim();
      if (!title) {
        throw new Error(`Judul voucher pada Tier ${tierNum} wajib diisi.`);
      }
      const discountType = v?.discountType === "fixed" ? "fixed" : "percentage";
      const discountValue = Math.max(1, Number(v?.discountValue || 0));
      const isBooster = cat === "NC_BOOSTER";
      return {
        title: title.slice(0, 140),
        category: cat,
        discountType,
        discountValue,
        maxDiscount: isBooster ? 0 : Math.max(0, Math.floor(Number(v?.maxDiscount || 0))),
        durationHours: isBooster ? Math.max(1, Math.floor(Number(v?.durationHours || 6))) : 0,
        expireDays: Math.max(1, Math.floor(Number(v?.expireDays || 60))),
      };
    });

    const customLabel = String(raw?.label || "").trim();
    const label =
      customLabel ||
      buildTierLabel({
        tier: tierNum,
        bonusNc,
        penaltyTickets,
        fuelLiters,
        vouchers,
      });

    return {
      tier: tierNum,
      label: label.slice(0, 220),
      bonusNc,
      penaltyTickets,
      fuelLiters,
      vouchers,
    };
  });

  return cleaned.sort((a, b) => a.tier - b.tier);
}

export async function GET() {
  try {
    const auth = await requireOwner();
    if ("error" in auth) return auth.error;

    await dbConnect();
    const { currentMonth } = getCurrentAndPreviousMonthWib();
    const nextMonth = getNextMonthString(currentMonth);

    const [templatesRaw, currentSnapshot, nextSnapshotRaw, recentSnapshotsRaw] =
      await Promise.all([
        PayrollRewardTemplate.find({}).sort({ rotationOrder: 1, createdAt: 1 }).lean(),
        getOrCreateMonthlyPayrollSnapshot(currentMonth),
        PayrollMonthlySnapshot.findOne({ month: nextMonth }).lean(),
        PayrollMonthlySnapshot.find({}).sort({ month: -1 }).limit(12).lean(),
      ]);

    const templates = templatesRaw.map((t) => ({
      ...t,
      _id: String(t._id),
      createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : undefined,
      updatedAt: t.updatedAt ? new Date(t.updatedAt).toISOString() : undefined,
    }));

    const nextAutoPicked = pickRotationTemplate(templates, nextMonth);
    const nextMonthSchedule = nextSnapshotRaw
      ? {
          month: nextMonth,
          templateId: nextSnapshotRaw.templateId ? String(nextSnapshotRaw.templateId) : null,
          templateSlug: nextSnapshotRaw.templateSlug,
          templateName: nextSnapshotRaw.templateName,
          isManualOverride: Boolean(nextSnapshotRaw.isManualOverride),
          isLocked: true,
        }
      : {
          month: nextMonth,
          templateId: nextAutoPicked ? nextAutoPicked._id : null,
          templateSlug: nextAutoPicked ? nextAutoPicked.slug : "legacy-default",
          templateName: nextAutoPicked ? nextAutoPicked.name : "Paket Standar (Legacy)",
          isManualOverride: false,
          isLocked: false,
        };

    const recentSnapshots = recentSnapshotsRaw.map((s) => ({
      _id: String(s._id),
      month: s.month,
      templateId: s.templateId ? String(s.templateId) : null,
      templateSlug: s.templateSlug,
      templateName: s.templateName,
      isManualOverride: Boolean(s.isManualOverride),
      lockedAt: s.lockedAt ? new Date(s.lockedAt).toISOString() : null,
    }));

    return jsonNoCache({
      success: true,
      currentMonth,
      nextMonth,
      templates,
      currentSnapshot,
      nextMonthSchedule,
      recentSnapshots,
    });
  } catch (err: any) {
    console.error("[GET /api/manage/payroll/templates] Error:", err);
    return jsonNoCache(
      { success: false, error: err?.message || "Gagal memuat template payroll." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireOwner();
    if ("error" in auth) return auth.error;

    if (!checkRateLimit(auth.discordId, "manage-payroll-template-create", 1200)) {
      return jsonNoCache(
        { success: false, error: "Terlalu cepat. Mohon tunggu sebentar." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const name = String(body?.name || "").trim();
    if (!name || name.length > 120) {
      return jsonNoCache(
        { success: false, error: "Nama template wajib diisi (maksimal 120 karakter)." },
        { status: 400 }
      );
    }

    const rawSlug = String(body?.slug || "").trim() || slugify(name);
    const slug = slugify(rawSlug).slice(0, 80);
    if (!slug) {
      return jsonNoCache(
        { success: false, error: "Slug template tidak valid." },
        { status: 400 }
      );
    }

    let tiers: IPayrollTierItem[];
    try {
      tiers = sanitizeTiersPayload(body?.tiers);
    } catch (e: any) {
      return jsonNoCache({ success: false, error: e.message }, { status: 400 });
    }

    await dbConnect();
    const count = await PayrollRewardTemplate.countDocuments();

    const created = await PayrollRewardTemplate.create({
      slug,
      name,
      description: String(body?.description || "").trim().slice(0, 400),
      baseSalary: Math.max(0, Math.floor(Number(body?.baseSalary ?? 10000))),
      infiniteLoopStep: Math.max(1, Math.floor(Number(body?.infiniteLoopStep ?? 10))),
      infiniteLoopBonusNc: Math.max(0, Math.floor(Number(body?.infiniteLoopBonusNc ?? 5000))),
      infiniteLoopPenaltyTickets: Math.max(
        0,
        Math.floor(Number(body?.infiniteLoopPenaltyTickets ?? 1))
      ),
      tiers,
      isActive: body?.isActive !== false,
      rotationOrder: Math.max(1, Math.floor(Number(body?.rotationOrder ?? count + 1))),
      authorDiscordId: auth.discordId,
      updatedByDiscordId: auth.discordId,
    });

    try {
      revalidatePath("/dashboard/manage/payroll/templates");
      revalidatePath("/dashboard/manage/payroll");
    } catch {
      // Non-fatal
    }

    return jsonNoCache(
      {
        success: true,
        message: `Template "${created.name}" berhasil dibuat.`,
        template: { ...created.toObject(), _id: String(created._id) },
      },
      { status: 201 }
    );
  } catch (err: any) {
    if (err?.code === 11000) {
      return jsonNoCache(
        { success: false, error: "Slug template sudah digunakan. Gunakan nama/slug lain." },
        { status: 409 }
      );
    }
    console.error("[POST /api/manage/payroll/templates] Error:", err);
    return jsonNoCache(
      { success: false, error: err?.message || "Gagal membuat template payroll." },
      { status: 500 }
    );
  }
}
