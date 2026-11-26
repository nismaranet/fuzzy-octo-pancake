import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongoose";
import { isWebOwner } from "@/lib/webConfig";
import PayrollRewardTemplate from "@/lib/models/PayrollRewardTemplate";
import PayrollMonthlySnapshot from "@/lib/models/PayrollMonthlySnapshot";
import {
  getCurrentAndPreviousMonthWib,
  getOrCreateMonthlyPayrollSnapshot,
} from "@/lib/managerSalary";
import {
  getNextMonthString,
  pickRotationTemplate,
  type SerializedPayrollTemplate,
} from "@/lib/payrollTemplates";
import PayrollTemplatesClient from "./PayrollTemplatesClient";

export const metadata = {
  title: "Payroll Templates",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function ManagePayrollTemplatesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.discordId) {
    redirect("/login");
  }

  const ownerAllowed = await isWebOwner(session.user.discordId);
  if (!ownerAllowed) {
    redirect("/dashboard/manage/payroll");
  }

  await dbConnect();
  const { currentMonth } = getCurrentAndPreviousMonthWib();
  const nextMonth = getNextMonthString(currentMonth);

  const [templatesRaw, currentSnapshot, nextSnapshotRaw] = await Promise.all([
    PayrollRewardTemplate.find({}).sort({ rotationOrder: 1, createdAt: 1 }).lean(),
    getOrCreateMonthlyPayrollSnapshot(currentMonth),
    PayrollMonthlySnapshot.findOne({ month: nextMonth }).lean(),
  ]);

  const templates: SerializedPayrollTemplate[] = JSON.parse(
    JSON.stringify(
      templatesRaw.map((t) => ({
        ...t,
        _id: String(t._id),
      }))
    )
  );

  const nextAuto = pickRotationTemplate(templates, nextMonth);
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
        templateId: nextAuto ? nextAuto._id : null,
        templateSlug: nextAuto ? nextAuto.slug : "legacy-default",
        templateName: nextAuto ? nextAuto.name : "Paket Standar (Legacy)",
        isManualOverride: false,
        isLocked: false,
      };

  return (
    <PayrollTemplatesClient
      initialData={{
        currentMonth,
        nextMonth,
        templates,
        currentSnapshot: JSON.parse(JSON.stringify(currentSnapshot)),
        nextMonthSchedule,
      }}
    />
  );
}
