"use server";

import clientPromise from "@/lib/mongodb";
import { revalidatePath } from "next/cache";

export async function dropDriverDataAction(
  truckyId: number,
  discordId: string,
) {
  const client = await clientPromise;
  const db = client.db();

  // Menghapus dari koleksi points dan driverlinks
  // Kita tidak menghapus dari 'users' agar akun web mereka tetap ada,
  // tapi datanya di sistem logistik (poin & link) dibersihkan.
  await Promise.all([
    db.collection("points").deleteOne({ userId: discordId }),
    db.collection("driverlinks").deleteOne({ truckyId: truckyId }),
  ]);

  revalidatePath("/dashboard/manage/point-data");
  return { success: true };
}
