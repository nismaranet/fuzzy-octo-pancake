"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Coins,
  History,
  ShieldAlert,
  CheckCircle2,
} from "lucide-react";
import { payPenaltyPoints } from "./actions";

interface HistoryItem {
  _id: string;
  points: number;
  reason: string;
  type: "add" | "remove";
  createdAt: string | Date;
}

interface PenaltyClientUIProps {
  initialPoints: number;
  totalNC: number;
  pointPrice: number;
  history: HistoryItem[];
}

export default function PenaltyClientUI({
  initialPoints,
  totalNC,
  pointPrice,
  history,
}: PenaltyClientUIProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pointsToPay, setPointsToPay] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  const totalCost = pointsToPay * pointPrice;
  const MAX_POINTS = 50;

  // Kalkulasi persentase bar
  const progressPercentage = Math.min((initialPoints / MAX_POINTS) * 100, 100);

  // Tentukan status bahaya
  let statusColor = "bg-green-500";
  let statusText = "Aman";
  if (initialPoints >= 50) {
    statusColor = "bg-red-600";
    statusText = "Penalty 3 (Kritis)";
  } else if (initialPoints >= 25) {
    statusColor = "bg-orange-500";
    statusText = "Penalty 2 (Peringatan Keras)";
  } else if (initialPoints >= 10) {
    statusColor = "bg-yellow-500";
    statusText = "Penalty 1 (Peringatan)";
  }

  const handlePayment = async () => {
    setIsLoading(true);
    setMessage(null);

    const result = await payPenaltyPoints(pointsToPay);

    if (result.success) {
      setMessage({ text: result.message, type: "success" });
      setTimeout(() => setIsModalOpen(false), 2000);
    } else {
      setMessage({ text: result.message, type: "error" });
    }

    setIsLoading(false);
  };

  return (
    <div className="space-y-8">
      {/* Kartu Status Utama */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
          <div className="flex flex-row items-center justify-between pb-2 space-y-0">
            <h3 className="tracking-tight text-sm font-medium">
              Total Poin Penalti
            </h3>
            <ShieldAlert
              className={`h-4 w-4 ${initialPoints >= 25 ? "text-red-500" : "text-muted-foreground"}`}
            />
          </div>
          <div className="text-4xl font-bold">
            {initialPoints}{" "}
            <span className="text-lg text-muted-foreground font-normal">
              / 50
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Status saat ini:{" "}
            <strong className={statusColor.replace("bg-", "text-")}>
              {statusText}
            </strong>
          </p>
        </div>

        <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
          <div className="flex flex-row items-center justify-between pb-2 space-y-0">
            <h3 className="tracking-tight text-sm font-medium">
              Saldo Nismara Coin (NC)
            </h3>
            <Coins className="h-4 w-4 text-yellow-500" />
          </div>
          <div className="text-4xl font-bold">
            {totalNC.toLocaleString("id-ID")}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Harga penebusan: {pointPrice.toLocaleString("id-ID")} NC / Poin
          </p>
        </div>

        <div className="rounded-xl border bg-card text-card-foreground shadow p-6 flex flex-col justify-center items-center">
          <button
            onClick={() => setIsModalOpen(true)}
            disabled={initialPoints === 0}
            className="w-full h-full min-h-[80px] bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Coins className="h-5 w-5" />
            {initialPoints === 0 ? "Poin Penalti Bersih" : "Bayar Penalti"}
          </button>
        </div>
      </div>

      {/* Progress Bar Batas Penalty */}
      <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
        <h3 className="font-semibold mb-4">Batas Maksimal Penalti</h3>
        <div className="relative w-full h-6 bg-secondary rounded-full overflow-hidden">
          <div
            className={`absolute top-0 left-0 h-full transition-all duration-500 ease-in-out ${statusColor}`}
            style={{ width: `${progressPercentage}%` }}
          />
          {/* Markers */}
          <div className="absolute top-0 left-[20%] h-full border-l-2 border-background/50 z-10"></div>{" "}
          {/* 10 Poin */}
          <div className="absolute top-0 left-[50%] h-full border-l-2 border-background/50 z-10"></div>{" "}
          {/* 25 Poin */}
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-2 relative">
          <span>0</span>
          <span className="absolute left-[20%] -translate-x-1/2">
            10 (Pen. 1)
          </span>
          <span className="absolute left-[50%] -translate-x-1/2">
            25 (Pen. 2)
          </span>
          <span>50 (Pen. 3)</span>
        </div>
      </div>

      {/* Tabel Riwayat */}
      <div className="rounded-xl border bg-card text-card-foreground shadow">
        <div className="p-6 pb-4 border-b flex items-center gap-2">
          <History className="w-5 h-5" />
          <h3 className="font-semibold text-lg">Riwayat Poin</h3>
        </div>
        <div className="p-0">
          {history.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Belum ada riwayat poin.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground bg-secondary/50 uppercase">
                  <tr>
                    <th className="px-6 py-3">Tanggal</th>
                    <th className="px-6 py-3">Tipe</th>
                    <th className="px-6 py-3">Jumlah</th>
                    <th className="px-6 py-3">Alasan</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item) => (
                    <tr
                      key={item._id}
                      className="border-b last:border-0 hover:bg-muted/50"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        {new Date(item.createdAt).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-6 py-4">
                        {item.type === "add" ? (
                          <span className="inline-flex items-center gap-1 text-red-500 bg-red-500/10 px-2 py-1 rounded text-xs font-medium">
                            <AlertTriangle className="w-3 h-3" /> Penalti
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-green-500 bg-green-500/10 px-2 py-1 rounded text-xs font-medium">
                            <CheckCircle2 className="w-3 h-3" /> Pengurangan
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-bold">
                        {item.type === "add" ? "+" : "-"}
                        {item.points}
                      </td>
                      <td
                        className="px-6 py-4 max-w-md truncate"
                        title={item.reason}
                      >
                        {item.reason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal Pembayaran */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-card border shadow-xl rounded-xl w-full max-w-md p-6 animate-in fade-in zoom-in-95">
            <h2 className="text-xl font-bold mb-4">Bayar Poin Penalti</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Pilih jumlah poin yang ingin dibayar. Pembayaran akan langsung
              memotong Nismara Coin (NC) Anda.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Jumlah Poin
                </label>
                <input
                  type="number"
                  min="1"
                  max={initialPoints}
                  value={pointsToPay}
                  onChange={(e) =>
                    setPointsToPay(
                      Math.min(
                        initialPoints,
                        Math.max(1, parseInt(e.target.value) || 1),
                      ),
                    )
                  }
                  className="w-full border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="bg-secondary/50 rounded-lg p-4 flex justify-between items-center">
                <span className="text-sm font-medium">Total Biaya:</span>
                <span
                  className={`text-lg font-bold flex items-center gap-1 ${totalNC < totalCost ? "text-red-500" : "text-primary"}`}
                >
                  {totalCost.toLocaleString("id-ID")}{" "}
                  <Coins className="w-4 h-4" />
                </span>
              </div>

              {totalNC < totalCost && (
                <p className="text-xs text-red-500 font-medium">
                  * Saldo NC Anda tidak mencukupi.
                </p>
              )}

              {message && (
                <div
                  className={`p-3 rounded-md text-sm ${message.type === "success" ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"}`}
                >
                  {message.text}
                </div>
              )}

              <div className="flex gap-2 justify-end mt-6">
                <button
                  onClick={() => setIsModalOpen(false)}
                  disabled={isLoading}
                  className="px-4 py-2 rounded-md hover:bg-secondary text-sm font-medium transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handlePayment}
                  disabled={
                    totalNC < totalCost || isLoading || pointsToPay <= 0
                  }
                  className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? "Memproses..." : "Konfirmasi Bayar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
