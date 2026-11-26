import { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongoose";
import { isWebOwner } from "@/lib/webConfig";
import { jsonNoCache } from "@/lib/antiCache";
import { checkRateLimit } from "@/lib/rateLimit";
import { slugify } from "@/lib/utils";
import PayrollRewardTemplate from "@/lib/models/PayrollRewardTemplate";
import { sanitizeTiersPayload } from "../route";

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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireOwner();
    if ("error" in auth) return auth.error;

    if (!checkRateLimit(auth.discordId, "manage-payroll-template-update", 800)) {
      return jsonNoCache(
        { success: false, error: "Terlalu cepat. Mohon tunggu sebentar." },
        { status: 429 }
      );
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return jsonNoCache({ success: false, error: "ID template tidak valid." }, { status: 400 });
    }

    await dbConnect();
    const existing = await PayrollRewardTemplate.findById(id);
    if (!existing) {
      return jsonNoCache(
        { success: false, error: "Template payroll tidak ditemukan." },
        { status: 404 }
      );
    }

    const body = await req.json();
    const update: Record<string, any> = {
      updatedByDiscordId: auth.discordId,
    };

    if (body?.name !== undefined) {
      const name = String(body.name || "").trim();
      if (!name || name.length > 120) {
        return jsonNoCache(
          { success: false, error: "Nama template wajib diisi (maksimal 120 karakter)." },
          { status: 400 }
        );
      }
      update.name = name;
    }

    if (body?.slug !== undefined) {
      const slug = slugify(String(body.slug || "")).slice(0, 80);
      if (!slug) {
        return jsonNoCache({ success: false, error: "Slug tidak valid." }, { status: 400 });
      }
      update.slug = slug;
    }

    if (body?.description !== undefined) {
      update.description = String(body.description || "").trim().slice(0, 400);
    }

    if (body?.baseSalary !== undefined) {
      update.baseSalary = Math.max(0, Math.floor(Number(body.baseSalary || 0)));
    }
    if (body?.infiniteLoopStep !== undefined) {
      update.infiniteLoopStep = Math.max(1, Math.floor(Number(body.infiniteLoopStep || 10)));
    }
    if (body?.infiniteLoopBonusNc !== undefined) {
      update.infiniteLoopBonusNc = Math.max(
        0,
        Math.floor(Number(body.infiniteLoopBonusNc || 0))
      );
    }
    if (body?.infiniteLoopPenaltyTickets !== undefined) {
      update.infiniteLoopPenaltyTickets = Math.max(
        0,
        Math.floor(Number(body.infiniteLoopPenaltyTickets || 0))
      );
    }
    if (body?.rotationOrder !== undefined) {
      update.rotationOrder = Math.max(1, Math.floor(Number(body.rotationOrder || 1)));
    }

    if (body?.isActive !== undefined) {
      const nextActive = Boolean(body.isActive);
      if (!nextActive && existing.isActive) {
        const activeCount = await PayrollRewardTemplate.countDocuments({ isActive: true });
        if (activeCount <= 1) {
          return jsonNoCache(
            {
              success: false,
              error: "Minimal harus ada 1 template aktif untuk rotasi bulanan.",
            },
            { status: 400 }
          );
        }
      }
      update.isActive = nextActive;
    }

    if (body?.tiers !== undefined) {
      try {
        update.tiers = sanitizeTiersPayload(body.tiers);
      } catch (e: any) {
        return jsonNoCache({ success: false, error: e.message }, { status: 400 });
      }
    }

    const updated = await PayrollRewardTemplate.findByIdAndUpdate(
      id,
      { $set: update },
      { returnDocument: "after" }
    ).lean();

    try {
      revalidatePath("/dashboard/manage/payroll/templates");
      revalidatePath("/dashboard/manage/payroll");
    } catch {
      // Non-fatal
    }

    return jsonNoCache({
      success: true,
      message: `Template "${updated?.name}" berhasil diperbarui.`,
      template: updated ? { ...updated, _id: String(updated._id) } : null,
    });
  } catch (err: any) {
    if (err?.code === 11000) {
      return jsonNoCache(
        { success: false, error: "Slug template sudah digunakan." },
        { status: 409 }
      );
    }
    console.error("[PATCH /api/manage/payroll/templates/[id]] Error:", err);
    return jsonNoCache(
      { success: false, error: err?.message || "Gagal memperbarui template." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireOwner();
    if ("error" in auth) return auth.error;

    if (!checkRateLimit(auth.discordId, "manage-payroll-template-delete", 1000)) {
      return jsonNoCache(
        { success: false, error: "Terlalu cepat. Mohon tunggu sebentar." },
        { status: 429 }
      );
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return jsonNoCache({ success: false, error: "ID template tidak valid." }, { status: 400 });
    }

    await dbConnect();
    const target = await PayrollRewardTemplate.findById(id).lean();
    if (!target) {
      return jsonNoCache(
        { success: false, error: "Template payroll tidak ditemukan." },
        { status: 404 }
      );
    }

    if (target.isActive) {
      const activeCount = await PayrollRewardTemplate.countDocuments({ isActive: true });
      if (activeCount <= 1) {
        return jsonNoCache(
          {
            success: false,
            error: "Tidak dapat menghapus satu-satunya template aktif yang tersisa.",
          },
          { status: 400 }
        );
      }
    }

    await PayrollRewardTemplate.findByIdAndDelete(id);

    try {
      revalidatePath("/dashboard/manage/payroll/templates");
      revalidatePath("/dashboard/manage/payroll");
    } catch {
      // Non-fatal
    }

    return jsonNoCache({
      success: true,
      message: `Template "${target.name}" telah dihapus. Snapshot bulan sebelumnya tetap aman.`,
    });
  } catch (err: any) {
    console.error("[DELETE /api/manage/payroll/templates/[id]] Error:", err);
    return jsonNoCache(
      { success: false, error: err?.message || "Gagal menghapus template." },
      { status: 500 }
    );
  }
}
