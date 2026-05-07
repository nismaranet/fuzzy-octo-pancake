"use server";

import clientPromise from "@/lib/mongodb";
import { revalidatePath } from "next/cache";

export async function dropCurrencyDataAction(
  truckyId: number | null,
  discordId: string,
) {
  const client = await clientPromise;
  const db = client.db();

  // Menghapus record saldo dan link driver jika masih ada
  const tasks = [db.collection("currencies").deleteOne({ userId: discordId })];

  if (truckyId) {
    tasks.push(db.collection("driverlinks").deleteOne({ truckyId: truckyId }));
  }

  await Promise.all(tasks);

  revalidatePath("/dashboard/manage/currency-data");
  return { success: true };
}
