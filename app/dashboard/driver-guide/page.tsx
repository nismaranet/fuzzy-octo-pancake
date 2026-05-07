import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import DriverGuideClient from "./DriverGuideClient";
import { ShieldAlert, ArrowRight, Lock } from "lucide-react";
import Link from "next/link";

export default async function DriverGuidePage() {
  const session = await getServerSession(authOptions);

  // 1. Proteksi Login
  if (!session) {
    redirect("/login");
  }

  // 2. Proteksi Akses Driver
  if (!session.user?.isDriver || !session.user.driverData) {
    return (
      <main className="min-h-[80vh] w-full flex items-center justify-center p-6 bg-(-background)">
        <div className="max-w-md w-full text-center space-y-8 animate-in fade-in zoom-in duration-700">
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
            <div className="relative w-24 h-24 bg-card border border-primary/30 text-primary rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl">
              <Lock size={48} />
            </div>
          </div>
          <div className="space-y-3">
            <h2 className="text-4xl font-black text-(-primary-foreground) uppercase tracking-tighter">
              Dokumen <span className="text-primary">Rahasia</span>
            </h2>
            <p className="text-foreground/50 font-medium leading-relaxed px-4">
              Halaman ini berisi panduan operasional internal Nismara Transport.
              Hanya pengemudi resmi yang diizinkan untuk mengakses dokumen ini.
            </p>
          </div>
          <div className="flex flex-col gap-4 items-center">
            <Link
              href="/register"
              className="inline-flex items-center gap-3 px-10 py-4 bg-primary text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-primary/80 transition-all shadow-lg shadow-primary/20"
            >
              Daftar Jadi Driver <ArrowRight size={14} />
            </Link>
            <Link
              href="/dashboard"
              className="text-[10px] font-black text-foreground/20 uppercase tracking-widest hover:text-primary transition-colors"
            >
              Kembali ke Dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // 3. Jika Driver, tampilkan panduan
  return <DriverGuideClient />;
}
