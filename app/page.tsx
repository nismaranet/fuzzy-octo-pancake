import { getServerSession } from "next-auth/next";
import { authOptions } from "./api/auth/[...nextauth]/route";
import HeroSlider from "@/components/HeroSlider";
// Menggunakan Named Import (dengan kurung kurawal {})
import { ScrollReveal } from "@/components/ScrollReveal";
import Link from "next/link";
import {
  ShieldCheck,
  TrendingUp,
  Trophy,
  Globe,
  Truck,
  Plane,
  CarFront,
  ArrowRight,
  Radio,
  Map,
  CheckCircle, // <-- Pastikan ini ada
} from "lucide-react";

export default async function Home() {
  const session = await getServerSession(authOptions);
  const isDriver = session?.user?.isDriver || false;

  return (
    <main className="flex flex-col w-full bg-background overflow-hidden">
      {/* 1. HERO SECTION */}
      <HeroSlider isDriver={isDriver} />

      {/* 2. STATISTIK */}
      <section className="border-y border-border/50 bg-card/30 backdrop-blur-sm relative z-20 -mt-1">
        <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-center divide-x divide-border/50">
          <ScrollReveal delay={0.1}>
            <p className="text-4xl font-black text-gradient mb-2">2,500+</p>
            <p className="text-sm text-gray-400 font-medium uppercase tracking-widest">
              Pengiriman Sukses
            </p>
          </ScrollReveal>
          <ScrollReveal delay={0.2}>
            <p className="text-4xl font-black text-gradient mb-2">1.2M</p>
            <p className="text-sm text-gray-400 font-medium uppercase tracking-widest">
              Kilometer Ditempuh
            </p>
          </ScrollReveal>
          <ScrollReveal delay={0.3}>
            <p className="text-4xl font-black text-gradient mb-2">150+</p>
            <p className="text-sm text-gray-400 font-medium uppercase tracking-widest">
              Driver Aktif
            </p>
          </ScrollReveal>
          <ScrollReveal delay={0.4}>
            <p className="text-4xl font-black text-gradient mb-2">99.8%</p>
            <p className="text-sm text-gray-400 font-medium uppercase tracking-widest">
              Zero Damage
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* 3. SHOWCASE FEATURES */}
      <section className="py-32 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-32">
        {/* Fitur 1 */}
        <div className="flex flex-col lg:flex-row items-center gap-16">
          <ScrollReveal direction="right" className="w-full lg:w-1/2">
            <div className="relative rounded-[3rem] overflow-hidden shadow-2xl border border-primary/20 group">
              <div className="absolute inset-0 bg-primary/10 group-hover:bg-transparent transition-colors z-10" />
              <img
                src="https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?q=80&w=2070&auto=format&fit=crop"
                alt="Trucking Operation"
                className="w-full h-[500px] object-cover group-hover:scale-105 transition-transform duration-1000"
              />
            </div>
          </ScrollReveal>
          <ScrollReveal direction="left" className="w-full lg:w-1/2 space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-bold border border-primary/20">
              <Radio className="w-4 h-4 animate-pulse" /> Telemetri Real-Time
            </div>
            <h2 className="text-4xl md:text-5xl font-extrabold text-white leading-tight">
              Sistem pencatatan <br />
              otomatis tanpa ribet.
            </h2>
            <p className="text-lg text-gray-400 leading-relaxed">
              Fokus pada jalanan, biarkan sistem kami yang mencatat pekerjaanmu.
              Terintegrasi penuh dengan Trucky API, setiap kilometer, konsumsi
              bahan bakar, dan kargo yang Anda bawa akan tersinkronisasi
              langsung ke dalam profil logbook Anda begitu mesin dimatikan.
            </p>
            <ul className="space-y-4 pt-4">
              <li className="flex items-center gap-3 text-gray-300 font-medium">
                <CheckCircle className="w-5 h-5 text-green-400" /> Sinkronisasi
                Otomatis ETS2 & ATS
              </li>
              <li className="flex items-center gap-3 text-gray-300 font-medium">
                <CheckCircle className="w-5 h-5 text-green-400" /> Kalkulasi
                Nismara Coins (NC) Instan
              </li>
            </ul>
          </ScrollReveal>
        </div>

        {/* Fitur 2 */}
        <div className="flex flex-col lg:flex-row-reverse items-center gap-16">
          <ScrollReveal direction="left" className="w-full lg:w-1/2">
            <div className="relative rounded-[3rem] overflow-hidden shadow-2xl border border-accent-sky/20 group">
              <div className="absolute inset-0 bg-accent-sky/10 group-hover:bg-transparent transition-colors z-10" />
              <img
                src="https://images.unsplash.com/photo-1519003722824-194d4455a60c?q=80&w=2075&auto=format&fit=crop"
                alt="Global Logistics"
                className="w-full h-[500px] object-cover group-hover:scale-105 transition-transform duration-1000"
              />
            </div>
          </ScrollReveal>
          <ScrollReveal direction="right" className="w-full lg:w-1/2 space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-sky/10 text-accent-sky text-sm font-bold border border-accent-sky/20">
              <Map className="w-4 h-4" /> Global Assignment
            </div>
            <h2 className="text-4xl md:text-5xl font-extrabold text-white leading-tight">
              Special Contracts & <br />
              Papan Peringkat Adil.
            </h2>
            <p className="text-lg text-gray-400 leading-relaxed">
              Bergabunglah dengan ratusan pengemudi lain untuk menyelesaikan
              misi komunitas global. Kami menerapkan aturan ketat yang
              memisahkan statistik Ranked (Real Miles) dan Unranked, memastikan
              kompetisi yang adil bagi seluruh member Nismara.
            </p>
            <div className="flex items-center gap-4 pt-4">
              <Link
                href="/special-contracts"
                className="flex items-center gap-2 text-white font-bold hover:text-accent-sky transition-colors group"
              >
                Lihat Kontrak Aktif{" "}
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* 4. EKOSISTEM SECTION */}
      <section className="py-32 bg-card/20 border-y border-border/50 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <ScrollReveal
            direction="up"
            className="text-center max-w-3xl mx-auto mb-20"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Satu Identitas. <br />
              Membuka Seluruh <span className="text-primary">Ekosistem</span>.
            </h2>
            <p className="text-xl text-gray-400">
              Cukup menggunakan satu akun Discord, kredensial Nismara Logistics
              Anda berlaku untuk seluruh divisi simulasi kami.
            </p>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <ScrollReveal delay={0.1}>
              <div className="glass-panel p-10 rounded-[2.5rem] border-primary/20 hover:border-primary/50 transition-colors text-center group">
                <div className="w-20 h-20 mx-auto bg-primary/10 rounded-2xl flex items-center justify-center mb-8 group-hover:-translate-y-2 transition-transform">
                  <Truck className="w-10 h-10 text-primary" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">
                  Nismara Transport
                </h3>
                <p className="text-gray-400">
                  Divisi logistik darat utama kami untuk Euro Truck Simulator 2
                  dan American Truck Simulator.
                </p>
              </div>
            </ScrollReveal>
            <ScrollReveal delay={0.2}>
              <div className="glass-panel p-10 rounded-[2.5rem] border-accent-sky/20 hover:border-accent-sky/50 transition-colors text-center group">
                <div className="w-20 h-20 mx-auto bg-accent-sky/10 rounded-2xl flex items-center justify-center mb-8 group-hover:-translate-y-2 transition-transform">
                  <Plane className="w-10 h-10 text-accent-sky" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">
                  Nismara Airlines
                </h3>
                <p className="text-gray-400">
                  Menguasai ruang udara virtual melalui Microsoft Flight
                  Simulator dengan rute komersial global.
                </p>
              </div>
            </ScrollReveal>
            <ScrollReveal delay={0.3}>
              <div className="glass-panel p-10 rounded-[2.5rem] border-accent-lilac/20 hover:border-accent-lilac/50 transition-colors text-center group">
                <div className="w-20 h-20 mx-auto bg-accent-lilac/10 rounded-2xl flex items-center justify-center mb-8 group-hover:-translate-y-2 transition-transform">
                  <CarFront className="w-10 h-10 text-accent-lilac" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">
                  Nismara Racing
                </h3>
                <p className="text-gray-400">
                  Divisi motorsport kompetitif. Berpacu di sirkuit kelas dunia
                  melalui Assetto Corsa.
                </p>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* 5. CALL TO ACTION */}
      <section className="py-32 relative overflow-hidden">
        <ScrollReveal
          direction="up"
          className="max-w-4xl mx-auto px-4 text-center relative z-10"
        >
          <ShieldCheck className="w-20 h-20 text-primary mx-auto mb-8" />
          <h2 className="text-5xl font-black text-white mb-8">
            Siap Menghidupkan Mesin?
          </h2>
          <p className="text-xl text-gray-400 mb-12 max-w-2xl mx-auto">
            Tidak ada syarat rumit. Cukup hubungkan Discord Anda, instal Trucky,
            dan mulai karir logistik virtual Anda bersama komunitas simulasi
            terbesar.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-6">
            {isDriver ? (
              <Link
                href="/dashboard"
                className="px-10 py-5 bg-primary text-white font-bold text-lg rounded-2xl hover:bg-primary/80 transition-colors shadow-[0_0_30px_rgba(126,87,194,0.4)]"
              >
                Buka Dashboard Utama
              </Link>
            ) : (
              <Link
                href="/login"
                className="px-10 py-5 bg-primary text-white font-bold text-lg rounded-2xl hover:bg-primary/80 transition-colors shadow-[0_0_30px_rgba(126,87,194,0.4)]"
              >
                Daftar & Login via Discord
              </Link>
            )}
          </div>
        </ScrollReveal>
      </section>
    </main>
  );
}
