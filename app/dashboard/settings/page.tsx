// app/dashboard/settings/page.tsx
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import SettingsClient from "./SettingsClient"; // Kita pindahkan logic form ke sini
import { ShieldAlert, ArrowRight } from "lucide-react";
import Link from "next/link";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);

  // 1. Cek apakah sudah login
  if (!session) {
    redirect("/login");
  }

  // 2. Cek apakah sudah jadi Driver (isDriver)
  // Kita gunakan isDriver sebagai gate utama
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
              Fitur pengaturan profil hanya tersedia untuk anggota aktif.
            </p>
          </div>
          <div className="flex flex-col gap-4 items-center">
            <Link
              href="/register"
              className="inline-flex items-center gap-3 px-10 py-4 bg-primary text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-primary/80 transition-all shadow-lg shadow-primary/20"
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

  // 3. Jika lolos validasi, tampilkan Client Component (Form)
  return <SettingsClient />;
}
