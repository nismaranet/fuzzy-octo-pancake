import type { Metadata } from "next";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import clientPromise from "@/lib/mongodb";
import LiveMapClient from "@/components/livemap/LiveMapClient";

export const metadata: Metadata = {
  title: "Live Map",
  description:
    "Pantau posisi, rute pengiriman, kecepatan, dan status seluruh driver Nismara Transport secara real-time di Euro Truck Simulator 2 dan American Truck Simulator.",
  openGraph: {
    title: "Live Map - Nismara Transport",
    description:
      "Peta radar real-time armada Nismara Transport untuk ETS2 & ATS.",
  },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LiveMapPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const client = await clientPromise;
  const db = client.db();
  const userQuery = session.user.email
    ? { email: session.user.email }
    : session.user.discordId
      ? { discordId: session.user.discordId }
      : null;

  const user = userQuery
    ? await db
        .collection("users")
        .findOne(userQuery, { projection: { test_participation: 1 } })
    : null;

  // Sementara khusus Beta Tester (test_participation === true), sama seperti /dashboard/tracker
  if (!user?.test_participation) {
    redirect(session.user.isDriver ? "/dashboard" : "/");
  }

  return <LiveMapClient />;
}
