import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { action, guildId, editData } = await req.json();

    const client = await clientPromise;
    const db = client.db();
    const regId = new ObjectId(id);

    // ACTION 1: HANYA UPDATE DATA (Tanpa Approve)
    if (action === "update") {
      await db.collection("registrations").updateOne(
        { _id: regId },
        {
          $set: {
            truckyId: editData.truckyId,
            reason: editData.reason,
            experience: editData.experience,
            updatedAt: new Date(),
          },
        },
      );
      return NextResponse.json({ success: true, message: "Data updated" });
    }

    // ACTION 2: APPROVE & REGISTER DRIVER
    if (action === "approve") {
      const truckyId = parseInt(editData.truckyId);
      const discordId = editData.userId;

      // Masukkan ke driverlinks (Sistem Utama Silvia)
      await db.collection("driverlinks").updateOne(
        { userId: editData.userId },
        {
          $set: {
            guildId: guildId,
            userId: discordId,
            truckyId: truckyId,
            truckyName: editData.username,
            updatedAt: new Date(),
          },
        },
        { upsert: true },
      );

      await db.collection("users").updateOne(
        { $or: [{ discordId: discordId }, { id: discordId }] },
        {
          $set: {
            truckyId: truckyId,
            isDriver: true,
            updatedAt: new Date(),
          },
        },
      );

      // Tandai registrasi selesai
      await db
        .collection("registrations")
        .updateOne(
          { _id: regId },
          { $set: { status: "approved", updatedAt: new Date() } },
        );
      return NextResponse.json({ success: true, message: "Driver approved" });
    }

    // ACTION 3: REJECT
    if (action === "reject") {
      await db
        .collection("registrations")
        .updateOne(
          { _id: regId },
          { $set: { status: "rejected", updatedAt: new Date() } },
        );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
