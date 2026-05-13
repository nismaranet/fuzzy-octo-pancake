import { getCurrencyData } from "./actions";
import CurrencyClient from "./CurrencyClient";
import { Coins, Wallet, ShieldAlert, ArrowRight } from "lucide-react";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import Link from "next/link";

export const metadata = {
  title: "Dompet Nismara | Nismara Logistics",
};

export default async function CurrencyPage() {
  const session = await getServerSession(authOptions);

  // 1. Proteksi Login
  if (!session) {
    redirect("/login");
  }

  if (!session.user?.isDriver || !session.user.driverData) {
    return (
      <main className="min-h-[80vh] w-full flex items-center justify-center p-6 bg-(-background)">
        <div className="max-w-md w-full text-center space-y-8 animate-in fade-in zoom-in duration-700">
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-red-500/20 blur-3xl rounded-full" />
            <div className="relative w-24 h-24 bg-card border border-red-500/30 text-red-500 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl">
              <ShieldAlert size={48} />
            </div>
          </div>
          <div className="space-y-3">
            <h2 className="text-4xl font-black text-(-primary-foreground) uppercase tracking-tighter">
              Akses <span className="text-red-500">Ditolak</span>
            </h2>
            <p className="text-foreground/50 font-medium leading-relaxed">
              Kamu belum terdaftar sebagai pengemudi resmi Nismara Logistics.
              Fitur manajemen keuangan hanya tersedia untuk anggota aktif.
            </p>
          </div>
          <div className="flex flex-col gap-4 items-center">
            <Link
              href="/register"
              className="inline-flex items-center gap-3 px-10 py-4 bg-primary text-foreground text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-primary/80 transition-all shadow-lg shadow-primary/20"
            >
              Daftar Sekarang <ArrowRight size={14} />
            </Link>
            <Link
              href="/"
              className="text-[10px] font-bold text-foreground/20 uppercase tracking-widest hover:text-foreground/50 transition-colors"
            >
              Kembali ke Beranda
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const data = await getCurrencyData();

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Wallet className="text-accent-lilac" /> Nismara Coin Histories
        </h2>
      </div>

      <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-1">
        <div className="glass-panel p-6 rounded-2xl border border-border/50 bg-card/30">
          <p className="text-sm font-medium text-gray-400">Total Saldo</p>
          <div className="flex items-center gap-2 mt-2">
            <Coins className="text-yellow-400 w-8 h-8" />
            <h3 className="text-4xl font-bold text-foreground">
              {data.balance.toLocaleString("id-ID")}{" "}
              <span className="text-lg font-normal text-gray-500">NC</span>
            </h3>
          </div>
        </div>
      </div>

      <CurrencyClient initialHistory={data.history} />
    </div>
  );
}
