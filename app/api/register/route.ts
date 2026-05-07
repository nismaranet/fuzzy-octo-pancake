import clientPromise from "@/lib/mongodb";

export async function POST(req: Request) {
  const data = await req.json();
  const client = await clientPromise;
  const db = client.db();

  // Pastikan koleksi namanya sama dengan yang di-watch oleh Silvia
  await db.collection("registrations").insertOne({
    guildId: process.env.DISCORD_GUILD_ID,
    userId: data.userId, // ID dari session Discord
    username: data.username,
    truckyId: data.truckyId,
    reason: data.reason,
    experience: data.experience,
    game: data.game,
    sumber: data.sumber,
    status: "pending",
    createdAt: new Date(),
  });

  return Response.json({ success: true });
}
