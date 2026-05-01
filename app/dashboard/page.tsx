import { getServerSession } from "next-auth/next";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getDriverStats, getCompanyMemberStats } from "@/lib/trucky";
import {
  Truck,
  MapPin,
  Gauge,
  Route,
  Shield,
  Trophy,
  Star,
  Coins,
  TriangleAlert,
  Clock,
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown,
  ArrowRight,
} from "lucide-react";

function formatWIB(dateInput: string | Date | undefined) {
  if (!dateInput) return "-";
  const d = new Date(dateInput);
  return d.toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export default async function DashboardPage() {
  // 1. Cek Sesi User
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  if (!session.user.isDriver || !session.user.driverData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
        <div className="glass-panel p-8 rounded-2xl max-w-md border-red-500/30">
          <h2 className="text-2xl font-bold text-red-400 mb-2">
            Akses Ditolak
          </h2>
          <p className="text-gray-400 mb-6">
            Kamu belum terdaftar sebagai pengemudi Nismara Logistics. Silakan
            daftar melalui Discord kami.
          </p>
          <a
            href="/"
            className="px-6 py-2 bg-card hover:bg-card/80 border border-border rounded-lg text-white transition-colors"
          >
            Kembali ke Beranda
          </a>
        </div>
      </div>
    );
  }

  const client = await clientPromise;
  const db = client.db();

  // 2. Ambil Data dari Trucky API
  const truckyId = session.user.driverData.truckyId;
  const truckyData = await getDriverStats(truckyId);
  const discordId = session.user.discordId;

  // 3. Ambil Data Points & NC User
  const userPoint = await db.collection("points").findOne({
    $or: [{ userId: discordId }, { userId: Number(discordId) }],
  });

  const userNC = await db.collection("currencies").findOne({
    $or: [{ userId: discordId }, { userId: Number(discordId) }],
  });

  const NISMARA_COMPANY_ID = 35643;
  const memberData = await getCompanyMemberStats(NISMARA_COMPANY_ID, truckyId);

  // 4. Ambil Data Insights Job (Ongoing, Completed, Canceled)
  // Ganti "jobs" dengan nama collection job Anda yang sebenarnya
  const ongoingJobs = await db
    .collection("jobhistories")
    .find({ driverId: discordId, jobStatus: "ONGOING" })
    .sort({ createdAt: -1 })
    .limit(3)
    .toArray();

  const completedJobs = await db
    .collection("jobhistories")
    .find({ driverId: discordId, jobStatus: "COMPLETED" })
    .sort({ createdAt: -1 })
    .limit(3)
    .toArray();

  const canceledJobs = await db
    .collection("jobhistories")
    .find({ driverId: discordId, jobStatus: "CANCELED" })
    .sort({ createdAt: -1 })
    .limit(3)
    .toArray();

  // 5. Ambil Data Insights Riwayat NC (Earn) & Poin Penalty
  // Ganti "histories" dengan nama collection riwayat Anda
  const ncIncomes = await db
    .collection("currencyhistories") // Sesuaikan collection
    .find({ userId: discordId, type: "earn" })
    .sort({ createdAt: -1 })
    .limit(5)
    .toArray();

  const pointPenalties = await db
    .collection("pointhistories") // Sesuaikan collection
    .find({
      userId: discordId,
      $or: [{ type: "add" }, { amount: { $lt: 0 } }], // Logika untuk mengambil data penalti/minus
    })
    .sort({ createdAt: -1 })
    .limit(5)
    .toArray();

  const stats = {
    rankName: memberData?.rank?.name || "Driver",
    rankColor: memberData?.rank?.color || "#b39ddb",
    distance: Math.round(
      memberData?.total_driven_distance_km || 0,
    ).toLocaleString(),
    points:
      userPoint?.totalPoints?.toLocaleString() ||
      memberData?.points?.toLocaleString() ||
      "0",
    userNc: userNC?.totalNC?.toLocaleString() || "0",
    joinDate: memberData?.created_at
      ? new Date(memberData.created_at).toLocaleDateString("id-ID")
      : "-",
  };

  return (
    <main className="max-w-7xl mx-auto px-4 py-12">
      {/* Header Profile Dashboard */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-12">
        <div className="flex items-center gap-6">
          <div
            className="w-20 h-20 rounded-full border-4 overflow-hidden shadow-lg"
            style={{ borderColor: stats.rankColor }}
          >
            <img
              src={session.user.image!}
              alt="Avatar"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-(-primary-foreground) mb-1">
              {session.user.name}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span
                className="px-3 py-1 rounded-full text-xs font-bold border"
                style={{
                  backgroundColor: `${stats.rankColor}20`,
                  color: stats.rankColor,
                  borderColor: `${stats.rankColor}50`,
                }}
              >
                {stats.rankName}
              </span>
              <span className="text-sm text-gray-400 font-mono">
                ID: {truckyId}
              </span>
            </div>
          </div>
        </div>

        <div className="glass-panel px-6 py-3 rounded-xl border-primary/30 text-right">
          <p className="text-xs text-gray-400 mb-1 uppercase tracking-wider font-bold">
            Bergabung Sejak
          </p>
          <p className="text-lg font-medium text-(-primary-foreground)">
            {stats.joinDate}
          </p>
        </div>
      </div>

      {/* Grid Statistik VTC */}
      <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-white">
        <Shield className="text-accent-lilac" /> Statistik Nismara
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
          <Coins className="absolute top-4 right-4 w-12 h-12 text-yellow-500/20 group-hover:text-yellow-500/40 transition-colors" />
          <p className="text-sm text-gray-400 mb-1">Total Nismara Coins</p>
          <p className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600">
            {stats.userNc}
          </p>
        </div>

        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
          <Route className="absolute top-4 right-4 w-12 h-12 text-blue-500/20 group-hover:text-blue-500/40 transition-colors" />
          <p className="text-sm text-gray-400 mb-1">Total Jarak Tempuh</p>
          <p className="text-4xl font-bold text-(-primary-foreground)">
            {stats.distance} Km
          </p>
        </div>

        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
          <Trophy className="absolute top-4 right-4 w-12 h-12 text-green-500/20 group-hover:text-green-500/40 transition-colors" />
          <p className="text-sm text-gray-400 mb-1">Total Poin</p>
          <p className="text-4xl font-bold text-(-primary-foreground)">
            {stats.points} Pts
          </p>
        </div>
      </div>

      {/* --- SECTION: Insights Pekerjaan (Jobs) --- */}
      <div className="flex items-center justify-between mb-6 mt-12">
        <h2 className="text-xl font-bold flex items-center gap-2 text-white">
          <Truck className="text-accent-lilac" /> Status Pekerjaan Terakhir
        </h2>
        <Link
          href="/dashboard/jobhistories"
          className="text-sm text-accent-lilac hover:text-white flex items-center gap-1 transition-colors"
        >
          Lihat Semua Jobs <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {/* Ongoing Jobs */}
        <div className="glass-panel p-6 rounded-2xl border-blue-500/20">
          <h3 className="text-md font-bold mb-4 flex items-center gap-2 text-blue-400">
            <Clock className="w-5 h-5" /> Sedang Berjalan
          </h3>
          <div className="space-y-3">
            {ongoingJobs.length > 0 ? (
              ongoingJobs.map((job) => (
                // Key cukup diletakkan di elemen paling luar (Link)
                <Link
                  href={`/jobs/${job.jobId}`}
                  key={job.jobId}
                  className="block"
                >
                  <div
                    className="p-3 bg-card/50 rounded-lg border border-border/50 
                       transition-all duration-300 ease-in-out
                       hover:bg-blue-500/10 hover:border-blue-500/40 
                       hover:-translate-y-1 hover:shadow-lg hover:shadow-blue-500/10"
                  >
                    <p className="font-medium text-sm text-white truncate">
                      {`Job #${job.jobId}` || "Kargo Tidak Diketahui"}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatWIB(job.createdAt) || "-"}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {job.game || "-"}
                    </p>
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-sm text-gray-500 italic">
                Tidak ada pekerjaan aktif.
              </p>
            )}
          </div>
        </div>

        {/* Completed Jobs */}
        <div className="glass-panel p-6 rounded-2xl border-green-500/20">
          <h3 className="text-md font-bold mb-4 flex items-center gap-2 text-green-400">
            <CheckCircle2 className="w-5 h-5" /> Selesai Terakhir
          </h3>
          <div className="space-y-3">
            {completedJobs.length > 0 ? (
              completedJobs.map((job) => (
                <Link
                  href={`/jobs/${job.jobId}`}
                  key={job.jobId}
                  className="block"
                >
                  <div
                    key={job._id.toString()}
                    className="p-3 bg-card/50 rounded-lg border border-border/50 
                       transition-all duration-300 ease-in-out
                       hover:bg-green-500/10 hover:border-green-500/40 
                       hover:-translate-y-1 hover:shadow-lg hover:shadow-green-500/10"
                  >
                    <p className="font-medium text-sm text-white truncate">
                      {`Job #${job?.jobId}` || "Kargo Selesai"}
                    </p>
                    <p className="text-xs text-green-500/80 mt-1">
                      +{job?.nc?.total || 0} NC
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {job?.game || 0}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatWIB(job.updatedAt) || "-"}
                    </p>
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-sm text-gray-500 italic">
                Belum ada pekerjaan selesai.
              </p>
            )}
          </div>
        </div>

        {/* Canceled Jobs */}
        <div className="glass-panel p-6 rounded-2xl border-red-500/20">
          <h3 className="text-md font-bold mb-4 flex items-center gap-2 text-red-400">
            <XCircle className="w-5 h-5" /> Dibatalkan
          </h3>
          <div className="space-y-3">
            {canceledJobs.length > 0 ? (
              canceledJobs.map((job) => (
                <Link
                  href={`/jobs/${job.jobId}`}
                  key={job.jobId}
                  className="block"
                >
                  <div
                    key={job._id.toString()}
                    className="p-3 bg-card/50 rounded-lg border border-border/50 
                       transition-all duration-300 ease-in-out
                       hover:bg-red-500/10 hover:border-red-500/40 
                       hover:-translate-y-1 hover:shadow-lg hover:shadow-red-500/10"
                  >
                    <p className="font-medium text-sm text-white truncate">
                      Job #{job.jobId || "Kargo Dibatalkan"}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {job?.game || 0}
                    </p>
                    <p className="text-xs text-red-400/80 mt-1">
                      {formatWIB(job.createdAt) || "-"}
                    </p>
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-sm text-gray-500 italic">
                Tidak ada riwayat pembatalan.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* --- SECTION: Insights Histori Transaksi & Poin --- */}
      <div className="flex items-center justify-between mb-6 mt-12">
        <h2 className="text-xl font-bold flex items-center gap-2 text-white">
          <TrendingUp className="text-accent-lilac" /> Riwayat NC & Penalti
        </h2>
        <Link
          href="/dashboard/histories"
          className="text-sm text-accent-lilac hover:text-white flex items-center gap-1 transition-colors"
        >
          Lihat Semua Histori <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        {/* Income NC History */}
        <div className="glass-panel p-6 rounded-2xl">
          <h3 className="text-md font-bold mb-4 flex items-center gap-2 text-yellow-400">
            <Coins className="w-5 h-5" /> Pendapatan NC Terakhir
          </h3>
          <div className="space-y-3">
            {ncIncomes.length > 0 ? (
              ncIncomes.map((history) => (
                <div
                  key={history._id.toString()}
                  className="flex justify-between items-center p-3 bg-card/50 rounded-lg border border-border/50"
                >
                  <div className="overflow-hidden pr-3">
                    <p className="text-sm text-white font-medium truncate">
                      {history.reason || "Pemasukan"}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(history.createdAt).toLocaleDateString("id-ID")}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-green-400 shrink-0">
                    +{history.amount} NC
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 italic">
                Belum ada riwayat pendapatan.
              </p>
            )}
          </div>
        </div>

        {/* Penalty Point History */}
        <div className="glass-panel p-6 rounded-2xl">
          <h3 className="text-md font-bold mb-4 flex items-center gap-2 text-red-400">
            <TriangleAlert className="w-5 h-5" /> Poin Penalti Terakhir
          </h3>
          <div className="space-y-3">
            {pointPenalties.length > 0 ? (
              pointPenalties.map((penalty) => (
                <div
                  key={penalty._id.toString()}
                  className="flex justify-between items-center p-3 bg-card/50 rounded-lg border border-border/50"
                >
                  <div className="overflow-hidden pr-3">
                    <p className="text-sm text-white font-medium truncate">
                      {penalty.reason || "Pengurangan Poin"}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(penalty.createdAt).toLocaleDateString("id-ID")}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-red-400 shrink-0">
                    {penalty.points} Pts
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 italic">
                Bersih! Tidak ada riwayat penalti.
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
