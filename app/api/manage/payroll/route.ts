import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongoose";
import { jsonNoCache } from "@/lib/antiCache";
import ManagerSalaryRecord from "@/lib/models/ManagerSalaryRecord";
import {
  calculateManagerPerformance,
  getCurrentAndPreviousMonthWib,
} from "@/lib/managerSalary";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || (session.user.role !== "manager" && session.user.role !== "admin")) {
      return jsonNoCache(
        { error: "Unauthorized. Akses khusus Manager & Admin." },
        { status: 401 }
      );
    }

    await dbConnect();
    const discordId = String(session.user.discordId);
    const { currentMonth, previousMonth } = getCurrentAndPreviousMonthWib();

    // 1. Live KPI Performance untuk bulan berjalan (Real-time Tracker + Snapshot Bulan Ini)
    const currentMonthPerf = await calculateManagerPerformance(discordId, currentMonth);

    // 2. Status Gaji Bulan Lalu (Siap Klaim atau Sudah Diklaim)
    const prevClaimRecord = await ManagerSalaryRecord.findOne({
      month: previousMonth,
      managerId: discordId,
    }).lean();

    let previousMonthData: any = null;
    if (prevClaimRecord && prevClaimRecord.status === "CLAIMED") {
      previousMonthData = {
        month: previousMonth,
        isClaimed: true,
        record: prevClaimRecord,
      };
    } else {
      const prevPerf = await calculateManagerPerformance(discordId, previousMonth);
      previousMonthData = {
        month: previousMonth,
        isClaimed: false,
        performance: prevPerf,
      };
    }

    // 3. Riwayat Slip Gaji Masa Lalu
    const historyRecords = await ManagerSalaryRecord.find({
      managerId: discordId,
      status: "CLAIMED",
    })
      .sort({ month: -1 })
      .lean();

    return jsonNoCache({
      success: true,
      currentMonth,
      previousMonth,
      currentMonthPerf,
      previousMonthData,
      historyRecords,
      currentTemplate: currentMonthPerf.templateInfo,
      milestoneTiers: currentMonthPerf.tiers,
    });
  } catch (error: any) {
    console.error("GET /api/manage/payroll Error:", error);
    return jsonNoCache(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
