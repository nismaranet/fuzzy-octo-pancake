"use server";

import clientPromise from "@/lib/mongodb";
import { revalidatePath } from "next/cache";

export async function createContractAction(formData: any) {
  const client = await clientPromise;
  const db = client.db();

  const { contractName, companyName, imageUrl, gameId, endAt, setBy, guildId } =
    formData;

  await db.collection("contracts").insertOne({
    guildId,
    contractName,
    companyName,
    imageUrl,
    gameId: String(gameId), // "1" untuk ETS2, "2" untuk ATS
    completedContracts: 0,
    totalNCEarned: 0,
    totalDistance: 0,
    totalMass: 0,
    setBy, // Discord ID Manager
    setAt: new Date(),
    endAt: new Date(endAt),
    contributors: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  revalidatePath("/dashboard/manage/contract");
}
