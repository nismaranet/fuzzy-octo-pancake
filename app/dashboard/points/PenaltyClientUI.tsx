// app/dashboard/points/PenaltyClientUI.tsx
"use client"; // Wajib di baris pertama

import React, { useState } from "react";

// Interfaces disesuaikan dengan struktur datamu
interface PointLog {
  _id: string;
  points: number;
  reason: string;
  type: "add" | "remove";
  createdAt: string;
}

interface PenaltyDashboardProps {
  totalPoints: number;
  ncBalance: number;
  pointPrice: number;
  logs: PointLog[];
}

export default function PenaltyClientUI({
  totalPoints,
  ncBalance,
  pointPrice,
  logs,
}: PenaltyDashboardProps) {
  const [isPaymentModalOpen, setPaymentModalOpen] = useState(false);
  const [pointsToPay, setPointsToPay] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);

  // Logika batas Limit SP
  const maxLimit = 50;
  const progressPercent = Math.min((totalPoints / maxLimit) * 100, 100);

  let spLevel = "Aman";
  let statusColor = "text-emerald-400";
  let barColor = "bg-emerald-500";

  if (totalPoints >= 50) {
    spLevel = "SP 3 (Banned/Max Penalty)";
    statusColor = "text-red-500";
    barColor = "bg-red-500";
  } else if (totalPoints >= 25) {
    spLevel = "SP 2";
    statusColor = "text-orange-500";
    barColor = "bg-orange-500";
  } else if (totalPoints >= 10) {
    spLevel = "SP 1";
    statusColor = "text-yellow-500";
    barColor = "bg-yellow-500";
  } else if (totalPoints > 0) {
    spLevel = "Warning";
    statusColor = "text-blue-400";
    barColor = "bg-blue-500";
  }

  const ncCost = pointsToPay * pointPrice;
  const canAfford = ncBalance >= ncCost;

  const handlePayment = async () => {
    setIsProcessing(true);
    // Panggil fungsi API/Backend kamu di sini untuk memproses pembayaran
    // Misalnya: await executePayment(pointsToPay);

    // Simulasi loading
    setTimeout(() => {
      setIsProcessing(false);
      setPaymentModalOpen(false);
    }, 1000);
  };

  return (
    <div className="p-6 bg-slate-950 min-h-screen text-slate-200 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">
              Penalty Points Dashboard
            </h1>
            <p className="text-slate-400 mt-1">
              Pantau dan kelola poin penalti dari aktivitas simulasi Anda.
            </p>
          </div>
          <button
            onClick={() => setPaymentModalOpen(true)}
            disabled={totalPoints === 0}
            className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-lg font-medium transition-colors shadow-[0_0_15px_rgba(147,51,234,0.3)]"
          >
            Tebus Penalti (NC)
          </button>
        </div>

        {/* Status Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex justify-between items-end mb-4">
            <div>
              <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                Total Poin Penalti
              </p>
              <div className="flex items-baseline gap-3 mt-1">
                <span className="text-5xl font-black text-white">
                  {totalPoints}
                </span>
                <span className={`text-lg font-bold ${statusColor}`}>
                  {spLevel}
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-400">Limit Maksimal</p>
              <p className="text-xl font-bold text-slate-300">50 Poin</p>
            </div>
          </div>

          {/* Progress Bar Limits */}
          <div className="relative pt-6 pb-2">
            <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${barColor}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            {/* Markers */}
            <div className="absolute top-0 w-full flex justify-between text-xs font-bold text-slate-500 px-1">
              <span className="translate-x-0">0</span>
              <span className="absolute left-[20%] -translate-x-1/2 text-yellow-500/70">
                SP1 (10)
              </span>
              <span className="absolute left-[50%] -translate-x-1/2 text-orange-500/70">
                SP2 (25)
              </span>
              <span className="absolute left-[100%] -translate-x-full text-red-500/70">
                SP3 (50)
              </span>
            </div>
          </div>
        </div>

        {/* History Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="px-6 py-4 border-b border-slate-800">
            <h2 className="text-xl font-semibold text-white">Riwayat Poin</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/50 text-slate-400 text-sm border-b border-slate-800">
                  <th className="px-6 py-4 font-medium">Tanggal</th>
                  <th className="px-6 py-4 font-medium">Keterangan</th>
                  <th className="px-6 py-4 font-medium text-right">Poin</th>
                  <th className="px-6 py-4 font-medium text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {logs.map((log) => (
                  <tr
                    key={log._id}
                    className="hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="px-6 py-4 text-sm text-slate-300">
                      {new Date(log.createdAt).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300">
                      {log.reason}
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-bold">
                      <span
                        className={
                          log.type === "add"
                            ? "text-red-400"
                            : "text-emerald-400"
                        }
                      >
                        {log.type === "add" ? "+" : "-"}
                        {Math.abs(log.points)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          log.type === "add"
                            ? "bg-red-500/10 text-red-400 border-red-500/20"
                            : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        }`}
                      >
                        {log.type === "add" ? "Penalty" : "Cleared"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4">
              Tebus Poin Penalti
            </h3>
            <p className="text-slate-400 text-sm mb-6">
              Gunakan Nismara Coin (NC) untuk mengurangi poin penalti Anda.
              Harga per poin saat ini adalah{" "}
              <strong className="text-purple-400">{pointPrice} NC</strong>.
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Jumlah Poin yang Ditebus
                </label>
                <input
                  type="number"
                  min="1"
                  max={totalPoints}
                  value={pointsToPay}
                  onChange={(e) => setPointsToPay(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                />
              </div>

              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-400">Total Biaya:</span>
                  <span className="font-bold text-white">
                    {ncCost.toLocaleString("id-ID")} NC
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Saldo NC Anda:</span>
                  <span
                    className={`font-bold ${canAfford ? "text-emerald-400" : "text-red-400"}`}
                  >
                    {ncBalance.toLocaleString("id-ID")} NC
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setPaymentModalOpen(false)}
                disabled={isProcessing}
                className="px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors font-medium disabled:opacity-50"
              >
                Batal
              </button>
              <button
                disabled={
                  !canAfford ||
                  pointsToPay < 1 ||
                  pointsToPay > totalPoints ||
                  isProcessing
                }
                onClick={handlePayment}
                className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center min-w-[160px]"
              >
                {isProcessing ? "Memproses..." : "Konfirmasi Pembayaran"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
