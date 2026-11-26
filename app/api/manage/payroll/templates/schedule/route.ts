import { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongoose";
import { isWebOwner } from "@/lib/webConfig";
import { jsonNoCache } from "@/lib/antiCache";
import { checkRateLimit } from "@/lib/rateLimit";
import PayrollRewardTemplate from "@/lib/models/PayrollRewardTemplate";
import PayrollMonthlySnapshot from "@/lib/models/PayrollMonthlySnapshot";
import ManagerSalaryRecord from "@/lib/models/ManagerSalaryRecord";
import { getCurrentAndPreviousMonthWib } from "@/lib/managerSalary";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.discordId) {
      return jsonNoCache({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const discordId = String(session.user.discordId);
    const allowed = await isWebOwner(discordId);
    if (!allowed) {
      return jsonNoCache(
        { success: false, error: "Akses ditolak. Fitur ini khusus Web Owner." },
        { status: 403 }
      );
    }

    if (!checkRateLimit(discordId, "manage-payroll-template-schedule", 1200)) {
      return jsonNoCache(
        { success: false, error: "Terlalu cepat. Mohon tunggu sebentar." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const month = String(body?.month || "").trim();
    const templateId = String(body?.templateId || "").trim();

    if (!/^\d{4}-\d{2}$/.test(month)) {
      return jsonNoCache(
        { success: false, error: "Format bulan harus YYYY-MM." },
        { status: 400 }
      );
    }

    const { currentMonth } = getCurrentAndPreviousMonthWib();
    if (month < currentMonth) {
      return jsonNoCache(
        {
          success: false,
          error: "Tidak dapat mengubah template untuk bulan yang sudah berakhir.",
        },
        { status: 400 }
      );
    }

    await dbConnect();

    // Proteksi keadilan: jangan ganti snapshot bila sudah ada Manager yang sedang/sudah klaim bulan ini
    const claimedCount = await ManagerSalaryRecord.countDocuments({
      month,
      status: { $in: ["CLAIMED", "PROCESSING"] },
    });
    if (claimedCount > 0) {
      return jsonNoCache(
        {
          success: false,
          error: `Periode ${month} sudah memiliki ${claimedCount} klaim gaji, sehingga template tidak dapat diganti.`,
        },
        { status: 409 }
      );
    }

    // Jika templateId === "AUTO", hapus manual override (hanya untuk bulan mendatang agar kembali auto-rotate)
    if (templateId === "AUTO") {
      if (month <= currentMonth) {
        return jsonNoCache(
          {
            success: false,
            error: "Reset ke auto-rotasi hanya berlaku untuk bulan mendatang.",
          },
          { status: 400 }
        );
      }
      await PayrollMonthlySnapshot.deleteOne({ month });
      revalidatePath("/dashboard/manage/payroll/templates");
      revalidatePath("/dashboard/manage/payroll");
      return jsonNoCache({
        success: true,
        message: `Jadwal periode ${month} dikembalikan ke rotasi otomatis.`,
      });
    }

    if (!mongoose.Types.ObjectId.isValid(templateId)) {
      return jsonNoCache(
        { success: false, error: "ID template tidak valid." },
        { status: 400 }
      );
    }

    const template = await PayrollRewardTemplate.findById(templateId).lean();
    if (!template) {
      return jsonNoCache(
        { success: false, error: "Template payroll tidak ditemukan." },
        { status: 404 }
      );
    }

    const snapshot = await PayrollMonthlySnapshot.findOneAndUpdate(
      { month },
      {
        $set: {
          templateId: template._id,
          templateSlug: template.slug,
          templateName: template.name,
          isManualOverride: true,
          baseSalary: template.baseSalary,
          infiniteLoopStep: template.infiniteLoopStep,
          infiniteLoopBonusNc: template.infiniteLoopBonusNc,
          infiniteLoopPenaltyTickets: template.infiniteLoopPenaltyTickets,
          tiers: template.tiers,
          lockedAt: new Date(),
          updatedByDiscordId: discordId,
        },
        $setOnInsert: {
          month,
          authorDiscordId: discordId,
        },
      },
      { upsert: true, returnDocument: "after" }
    ).lean();

    try {
      revalidatePath("/dashboard/manage/payroll/templates");
      revalidatePath("/dashboard/manage/payroll");
    } catch {
      // Non-fatal
    }

    return jsonNoCache({
      success: true,
      message: `Template "${template.name}" berhasil ditetapkan untuk periode ${month}.`,
      snapshot: snapshot ? { ...snapshot, _id: String(snapshot._id) } : null,
    });
  } catch (err: any) {
    console.error("[POST /api/manage/payroll/templates/schedule] Error:", err);
    return jsonNoCache(
      { success: false, error: err?.message || "Gagal menjadwalkan template bulan ini." },
      { status: 500 }
    );
  }
}
