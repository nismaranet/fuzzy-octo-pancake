"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import clientPromise from "@/lib/mongodb"; // Import Promise native MongoDB
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const GUILD_ID = "863959415702028318";

export async function getUserPointsData(userId: string) {
  try {
    const client = await clientPromise;
    // Menggunakan default database dari URI (atau isi nama db di dalam kurung jika diperlukan)
    const db = client.db();

    const [pointData, currencyData, historyData, guildSettings] =
      await Promise.all([
        db.collection("points").findOne({ userId, guildId: GUILD_ID }),
        db.collection("currencies").findOne({ userId, guildId: GUILD_ID }),
        db
          .collection("pointhistories")
          .find({ userId, guildId: GUILD_ID })
          .sort({ createdAt: -1 })
          .limit(20)
          .toArray(),
        db.collection("guildsettings").findOne({ guildId: GUILD_ID }),
      ]);

    return {
      totalPoints: pointData?.totalPoints || 0,
      totalNC: currencyData?.totalNC || 0,
      pointPrice: guildSettings?.pointPrice || 1000,
      // Mapping untuk merubah ObjectId MongoDB menjadi string agar aman dikirim ke Client Component
      history: historyData.map((item) => ({
        ...item,
        _id: item._id.toString(),
      })),
    };
  } catch (error) {
    console.error("Gagal mengambil data poin:", error);
    throw new Error("Gagal mengambil data dari database.");
  }
}

export async function payPenaltyPoints(pointsToPay: number) {
  try {
    const session = await getServerSession(authOptions);

    // UBAH BARIS INI: Cek discordId, bukan id
    if (!session?.user?.discordId) throw new Error("Unauthorized");

    const userId = session.user.discordId;
    const client = await clientPromise;
    const db = client.db();

    // Ambil data terbaru untuk validasi
    const [pointData, currencyData, guildSettings] = await Promise.all([
      db.collection("points").findOne({ userId, guildId: GUILD_ID }),
      db.collection("currencies").findOne({ userId, guildId: GUILD_ID }),
      db.collection("guildsettings").findOne({ guildId: GUILD_ID }),
    ]);

    const currentPoints = pointData?.totalPoints || 0;
    const currentNC = currencyData?.totalNC || 0;
    const pointPrice = guildSettings?.pointPrice || 1000;
    const totalCost = pointsToPay * pointPrice;

    if (pointsToPay <= 0) throw new Error("Jumlah poin tidak valid.");
    if (pointsToPay > currentPoints)
      throw new Error(
        "Anda tidak bisa membayar lebih dari poin penalti yang dimiliki.",
      );
    if (currentNC < totalCost)
      throw new Error("Nismara Coin (NC) Anda tidak mencukupi.");

    // Lakukan pembaruan data secara paralel ke koleksi MongoDB
    await Promise.all([
      db
        .collection("currencies")
        .updateOne(
          { userId, guildId: GUILD_ID },
          { $inc: { totalNC: -totalCost } },
        ),
      db
        .collection("points")
        .updateOne(
          { userId, guildId: GUILD_ID },
          { $inc: { totalPoints: -pointsToPay } },
        ),
      db.collection("pointhistories").insertOne({
        userId,
        guildId: GUILD_ID,
        managerId: userId,
        points: pointsToPay,
        reason: `Membayar penalti menggunakan ${totalCost} NC`,
        type: "remove",
        createdAt: new Date(),
      }),
      db.collection("currencyhistories").insertOne({
        userId,
        guildId: GUILD_ID,
        managerId: userId,
        amount: `-${totalCost}`,
        type: "spend",
        reason: `Tebus ${pointsToPay} penalty point`,
        createdAt: new Date(),
      }),
    ]);

    revalidatePath("/dashboard/points");
    return { success: true, message: "Berhasil membayar poin penalti!" };
  } catch (error: any) {
    console.error("Gagal membayar penalti:", error);
    return {
      success: false,
      message: error.message || "Terjadi kesalahan sistem.",
    };
  }
}
