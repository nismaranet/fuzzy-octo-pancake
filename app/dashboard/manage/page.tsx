import clientPromise from "@/lib/mongodb";
import { Users, Truck, Package, TrendingUp } from "lucide-react";

export default async function ManageOverview() {
  const client = await clientPromise;
  const db = client.db();

  // Ambil beberapa statistik cepat
  const totalDrivers = await db.collection("driverlinks").countDocuments();
  const totalContracts = await db.collection("contracts").countDocuments();

  return (
    <div className="space-y-12">
      <div>
        <h1 className="text-4xl font-black text-white mb-2">
          Manager Overview
        </h1>
        <p className="text-gray-400 font-medium">
          Pantau performa operasional Nismara Transport secara real-time.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-panel p-8 rounded-3xl border-primary/20">
          <Users className="text-primary w-8 h-8 mb-4" />
          <p className="text-3xl font-black text-white">{totalDrivers}</p>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">
            Total Driver Terdaftar
          </p>
        </div>
        <div className="glass-panel p-8 rounded-3xl border-accent-sky/20">
          <Truck className="text-accent-sky w-8 h-8 mb-4" />
          <p className="text-3xl font-black text-white">{totalContracts}</p>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">
            Kontrak Aktif
          </p>
        </div>
        {/* Kamu bisa tambah statistik lainnya dari API Trucky di sini */}
      </div>

      {/* Rencana fitur selanjutnya: Log aktivitas manager */}
      <div className="glass-panel p-8 rounded-3xl border-border/50 bg-white/[0.02]">
        <h3 className="text-white font-bold mb-4">Aktivitas Terakhir</h3>
        <p className="text-sm text-gray-600">
          Belum ada aktivitas manajemen tercatat hari ini.
        </p>
      </div>
    </div>
  );
}
