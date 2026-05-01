import NextAuth, { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      discordId?: string;
      role: "user" | "manager" | "admin";
      isDriver: boolean;
      truckyId?: string | number | null;
      driverData?: {
        truckyId: number;
        truckyName: string;
      } | null;
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
    truckyId?: string | number | null;
  }
}
