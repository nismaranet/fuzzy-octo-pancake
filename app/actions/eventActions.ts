"use server";

import clientPromise from "@/lib/mongodb";
import { revalidatePath } from "next/cache";

export async function createNCEventAction(formData: any) {
  const client = await clientPromise;
  const db = client.db();

  const { nameEvent, multiplier, imageUrl, endAt, setBy, guildId } = formData;

  await db.collection("ncevents").insertOne({
    guildId,
    nameEvent,
    multiplier: Number(multiplier),
    imageUrl: imageUrl || null,
    setBy, // Discord ID Manager
    setAt: new Date(),
    endAt: new Date(endAt),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  revalidatePath("/dashboard/manage/events");
}
