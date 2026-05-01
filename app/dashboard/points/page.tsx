import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import PenaltyClientUI from "./PenaltyClientUI";

export default async function PointsPage() {
  // CATATAN: Pertahankan backend logic Supabase kamu yang sudah ada di sini.
  // Kode di bawah ini hanya sebagai kerangka integrasi.
  const supabase = createServerComponentClient({ cookies });

  // Contoh pengambilan session user
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    // Handle redirect ke halaman login jika diperlukan
  }

  // Fetch data yang dibutuhkan untuk dashboard
  // Ganti dengan query database kamu yang sebenarnya
  const totalPoints = 30; // Contoh: await fetchTotalPoints(session.user.id);
  const ncBalance = 15000; // Contoh: await fetchUserBalance(session.user.id);
  const pointPrice = 3000; // Contoh: await fetchGuildSetting('pointPrice');
  const logs = [
    // Contoh: await fetchPenaltyLogs(session.user.id);
    {
      _id: "1",
      points: 10,
      reason: "Menabrak dinding di turn 1",
      type: "add",
      createdAt: new Date().toISOString(),
    },
    {
      _id: "2",
      points: 5,
      reason: "Tebus penalti",
      type: "remove",
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    },
  ];

  return (
    <PenaltyClientUI
      totalPoints={totalPoints}
      ncBalance={ncBalance}
      pointPrice={pointPrice}
      logs={logs}
    />
  );
}
