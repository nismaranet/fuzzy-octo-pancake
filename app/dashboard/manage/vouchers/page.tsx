import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import clientPromise from "@/lib/mongodb";
import dbConnect from "@/lib/mongoose";
import { isWebOwner } from "@/lib/webConfig";
import VoucherGrantLog from "@/lib/models/VoucherGrantLog";
import UserVoucher from "@/lib/models/UserVoucher";
import ManualVoucherClient from "./ManualVoucherClient";

export const metadata = {
  title: "Owner Voucher Lab (Manual Grant)",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function ManageManualVouchersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.discordId) {
    redirect("/login");
  }

  const ownerAllowed = await isWebOwner(session.user.discordId);
  if (!ownerAllowed) {
    redirect("/dashboard/manage");
  }

  await dbConnect();
  const client = await clientPromise;
  const db = client.db();

  const [usersRaw, logsRaw] = await Promise.all([
    db
      .collection("users")
      .find(
        { discordId: { $exists: true, $ne: "" } },
        {
          projection: {
            discordId: 1,
            name: 1,
            truckyId: 1,
            image: 1,
            role: 1,
            isDriver: 1,
          },
        }
      )
      .sort({ name: 1 })
      .toArray(),
    VoucherGrantLog.find({}).sort({ createdAt: -1 }).limit(50).lean(),
  ]);

  const allVoucherIds = logsRaw.flatMap((l) => l.voucherIds || []);
  const voucherDocs = allVoucherIds.length
    ? await UserVoucher.find(
        { _id: { $in: allVoucherIds } },
        { _id: 1, status: 1 }
      ).lean()
    : [];
  const statusById = new Map<string, string>();
  for (const vd of voucherDocs) {
    statusById.set(String(vd._id), vd.status);
  }

  const users = usersRaw.map((u) => ({
    discordId: String(u.discordId),
    name: u.name || "Driver Nismara",
    truckyId: u.truckyId ? String(u.truckyId) : null,
    image: u.image || null,
    role: u.role || "driver",
    isDriver: Boolean(u.isDriver),
  }));

  const logs = JSON.parse(
    JSON.stringify(
      logsRaw.map((l) => ({
        ...l,
        _id: String(l._id),
        recipientUserId: l.recipientUserId ? String(l.recipientUserId) : null,
        voucherIds: (l.voucherIds || []).map(String),
        voucherStatuses: (l.voucherIds || []).map((vid) => ({
          id: String(vid),
          status: statusById.get(String(vid)) || "DELETED",
        })),
      }))
    )
  );

  return (
    <ManualVoucherClient
      users={users}
      initialLogs={logs}
      currentOwner={{
        discordId: String(session.user.discordId),
        name: session.user.name || "Owner",
      }}
    />
  );
}
