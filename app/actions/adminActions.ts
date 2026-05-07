// app/actions/adminActions.ts
"use server";

import clientPromise from "@/lib/mongodb";
import { revalidatePath } from "next/cache";

export async function updateDriverStatus(truckyId: string, isOnLeave: boolean) {
  const client = await clientPromise;
  const db = client.db();

  await db.collection("users").updateOne(
    { truckyId: truckyId },
    {
      $set: {
        isOnLeave: isOnLeave,
        updatedAt: new Date(),
      },
    },
  );

  revalidatePath(`/dashboard/manage/user/${truckyId}`);
}

export async function submitLeaveRequest(formData: any) {
  const client = await clientPromise;
  const db = client.db();

  const {
    truckyId,
    userId,
    startDate,
    endDate,
    reason,
    managerId,
    managerName,
  } = formData;

  // 1. Simpan ke History Izin
  await db.collection("leavehistories").insertOne({
    truckyId,
    userId,
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    reason,
    managerId,
    managerName,
    createdAt: new Date(),
    status: "active",
  });

  // 2. Update status di tabel Users
  await db
    .collection("users")
    .updateOne({ truckyId: truckyId }, { $set: { isOnLeave: true } });

  revalidatePath(`/dashboard/manage/users/${truckyId}`);
}
