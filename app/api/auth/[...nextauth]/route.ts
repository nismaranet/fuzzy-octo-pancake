import NextAuth, { NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export const authOptions: NextAuthOptions = {
  adapter: MongoDBAdapter(clientPromise),
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      authorization: { params: { scope: "identify email" } },
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      const client = await clientPromise;
      const db = client.db();

      // 1. Ambil ID Discord dari koleksi 'accounts'
      const account = await db.collection("accounts").findOne({
        userId: new ObjectId(user.id),
        provider: "discord",
      });

      let isDriver = false;
      let driverData = null;
      let userRole: "user" | "manager" | "admin" = "user";

      if (account) {
        const discordId = account.providerAccountId;
        const guildId = "863959415702028318"; // ID Server Nismara
        const managerRoleId = "1406574228794507354"; // ID Role Transport Manager

        // --- VERIFIKASI ROLE DISCORD (Manager Check) ---
        try {
          const response = await fetch(
            `https://discord.com/api/v10/guilds/${guildId}/members/${discordId}`,
            {
              headers: {
                Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
              },
              next: { revalidate: 600 },
            },
          );

          if (response.ok) {
            const memberData = await response.json();
            if (memberData.roles.includes(managerRoleId)) {
              userRole = "manager";
            }
          }
        } catch (error) {
          console.error("Gagal verifikasi role Discord:", error);
        }

        // --- SYNC TRUCKY ID KE TABLE USERS ---
        const driverLink = await db.collection("driverlinks").findOne({
          userId: discordId,
        });

        if (driverLink) {
          isDriver = true;
          driverData = {
            truckyId: driverLink.truckyId,
            truckyName: driverLink.truckyName,
          };

          // Update/Sync truckyId ke dokumen user agar bisa dibuat profile public
          await db
            .collection("users")
            .updateOne(
              { _id: new ObjectId(user.id) },
              { $set: { truckyId: driverLink.truckyId } },
            );
        }

        session.user.discordId = discordId;
      }

      // Masukkan semua data ke session NextAuth
      session.user.isDriver = isDriver;
      session.user.driverData = driverData;
      session.user.role = userRole;

      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
  debug: process.env.NODE_ENV === "development",
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
