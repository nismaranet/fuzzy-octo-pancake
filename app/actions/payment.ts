// actions/payment.ts
"use server";

import midtransClient from "midtrans-client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function createPenaltyPayment(points: number) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.discordId) throw new Error("Unauthorized");

  const snap = new midtransClient.Snap({
    isProduction: false, // Set ke true jika sudah live
    serverKey: process.env.MIDTRANS_SERVER_KEY,
    clientKey: process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY,
  });

  const PRICE_PER_POINT = 3000; // Contoh: 1 Poin = Rp 5.000
  const ADMIN_FEE = 4000; // Biaya admin tetap (Flat Fee)
  const baseAmount = points * PRICE_PER_POINT;
  const totalAmount = baseAmount + ADMIN_FEE;

  const orderId = `PENALTY-${session.user.discordId}-${Date.now()}`;

  const parameter = {
    transaction_details: {
      order_id: orderId,
      gross_amount: totalAmount,
    },
    item_details: [
      {
        id: "PENALTY_POINTS",
        price: PRICE_PER_POINT,
        quantity: points,
        name: `Tebus ${points} Poin Penalti`,
      },
      {
        id: "ADMIN_FEE",
        price: ADMIN_FEE,
        quantity: 1,
        name: "Biaya Admin (Payment Gateway)",
      },
    ],
    customer_details: {
      first_name: session.user.name,
      email: session.user.email,
    },
    // Meta data untuk memudahkan pencarian di Webhook nanti
    metadata: {
      discordId: session.user.discordId,
      pointsToReduce: points,
    }
  };

  const transaction = await snap.createTransaction(parameter);
  return { token: transaction.token, orderId };
}