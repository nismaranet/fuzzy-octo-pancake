import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";
import dbConnect from "@/lib/mongoose";
import { jsonNoCache } from "@/lib/antiCache";
import { checkRateLimit } from "@/lib/rateLimit";
import { applyGarageRentVoucher } from "@/lib/voucher";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.discordId) {
      return jsonNoCache({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const discordId = String(session.user.discordId);
    if (!checkRateLimit(discordId, "apply-garage-rent-voucher", 2000)) {
      return jsonNoCache(
        { success: false, error: "Terlalu banyak permintaan. Mohon tunggu sebentar." },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const voucherId = String(body.voucherId || "");
    if (!voucherId) {
      return jsonNoCache(
        { success: false, error: "voucherId wajib disertakan." },
        { status: 400 }
      );
    }

    await dbConnect();
    const result = await applyGarageRentVoucher(voucherId, discordId);
    if (!result.success) {
      return jsonNoCache(
        { success: false, error: result.error || "Gagal memasang voucher." },
        { status: 400 }
      );
    }

    try {
      revalidatePath("/dashboard/garage");
      revalidatePath("/dashboard/vouchers");
    } catch {
      // Non-fatal
    }

    return jsonNoCache({
      success: true,
      message: `Voucher berhasil dipasang! Estimasi tagihan operasional garasi berikutnya turun dari ${result.operationalCost!.toLocaleString("id-ID")} NC menjadi ${result.estimatedFinalCost!.toLocaleString("id-ID")} NC (Hemat ${result.discountPreview!.toLocaleString("id-ID")} NC).`,
      pendingRentVoucher: result.pendingRentVoucher,
      operationalCost: result.operationalCost,
      discountPreview: result.discountPreview,
      estimatedFinalCost: result.estimatedFinalCost,
      nextPaymentDate: result.nextPaymentDate,
    });
  } catch (error: any) {
    console.error("[Garage Apply Rent Voucher] Error:", error);
    return jsonNoCache(
      { success: false, error: error?.message || "Gagal memasang voucher operasional garasi." },
      { status: 500 }
    );
  }
}
