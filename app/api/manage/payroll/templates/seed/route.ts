import { getServerSession } from "next-auth/next";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongoose";
import { isWebOwner } from "@/lib/webConfig";
import { jsonNoCache } from "@/lib/antiCache";
import { checkRateLimit } from "@/lib/rateLimit";
import PayrollRewardTemplate from "@/lib/models/PayrollRewardTemplate";
import { STARTER_PAYROLL_TEMPLATES } from "@/lib/payrollTemplates";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function POST() {
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

    if (!checkRateLimit(discordId, "manage-payroll-template-seed", 3000)) {
      return jsonNoCache(
        { success: false, error: "Mohon tunggu sebentar sebelum menjalankan impor lagi." },
        { status: 429 }
      );
    }

    await dbConnect();

    // Mongoose 9: jangan sertakan createdAt/updatedAt di $setOnInsert saat schema memakai timestamps: true
    const ops = STARTER_PAYROLL_TEMPLATES.map((seed) => ({
      updateOne: {
        filter: { slug: seed.slug },
        update: {
          $setOnInsert: {
            slug: seed.slug,
            name: seed.name,
            description: seed.description,
            baseSalary: seed.baseSalary,
            infiniteLoopStep: seed.infiniteLoopStep,
            infiniteLoopBonusNc: seed.infiniteLoopBonusNc,
            infiniteLoopPenaltyTickets: seed.infiniteLoopPenaltyTickets,
            tiers: seed.tiers,
            isActive: seed.isActive,
            rotationOrder: seed.rotationOrder,
            authorDiscordId: discordId,
            updatedByDiscordId: discordId,
          },
        },
        upsert: true,
      },
    }));

    const bulkRes = await PayrollRewardTemplate.bulkWrite(ops, { ordered: false });
    const insertedCount = bulkRes.upsertedCount || 0;
    const skippedCount = STARTER_PAYROLL_TEMPLATES.length - insertedCount;

    try {
      revalidatePath("/dashboard/manage/payroll/templates");
      revalidatePath("/dashboard/manage/payroll");
    } catch {
      // Non-fatal
    }

    return jsonNoCache({
      success: true,
      insertedCount,
      skippedCount,
      message:
        insertedCount > 0
          ? `Berhasil mengimpor ${insertedCount} template seimbang (${skippedCount} template sudah ada dan tidak ditimpa).`
          : "Ketiga template seimbang sudah tersedia di database (tidak ada data yang ditimpa).",
    });
  } catch (err: any) {
    console.error("[POST /api/manage/payroll/templates/seed] Error:", err);
    return jsonNoCache(
      { success: false, error: err?.message || "Gagal mengimpor template awal." },
      { status: 500 }
    );
  }
}
