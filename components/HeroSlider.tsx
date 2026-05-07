"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

const slides = [
  {
    id: 1,
    // Kita gunakan placeholder gambar HD, nantinya bisa diganti dengan aset dari https://img.nismara.my.id/
    image:
      "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?q=80&w=2070&auto=format&fit=crop",
    title: "Menghubungkan Benua",
    subtitle:
      "Bergabunglah dengan armada Nismara Transport. Taklukkan rute lintas benua di ETS2 dan ATS dengan sistem logistik virtual terdepan.",
  },
  {
    id: 2,
    image:
      "https://images.unsplash.com/photo-1519003722824-194d4455a60c?q=80&w=2075&auto=format&fit=crop",
    title: "Sistem Telemetri Real-Time",
    subtitle:
      "Pantau performa, konsumsi bahan bakar, dan rute secara presisi langsung dari dashboard Anda.",
  },
  {
    id: 3,
    image:
      "https://images.unsplash.com/photo-1586864387967-d02ef85d93e8?q=80&w=2070&auto=format&fit=crop",
    title: "Komunitas Tersolid",
    subtitle:
      "Satu identitas Discord untuk seluruh ekosistem simulasi. Berkendara, berkompetisi, dan berkembang bersama.",
  },
];

export default function HeroSlider({ isDriver }: { isDriver: boolean }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
    }, 5000); // Ganti slide setiap 5 detik
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative w-full h-[80vh] min-h-[600px] overflow-hidden">
      {/* Gambar Slider */}
      {slides.map((slide, index) => (
        <div
          key={slide.id}
          className={`absolute top-0 left-0 w-full h-full transition-opacity duration-1000 ease-in-out ${
            index === current ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="absolute inset-0 bg-background/70 z-10"></div>{" "}
          {/* Overlay gelap */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/30 z-10"></div>
          <img
            src={slide.image}
            alt={slide.title}
            className="w-full h-full object-cover object-center transform scale-105 transition-transform duration-[10000ms] ease-linear"
            style={{
              transform: index === current ? "scale(1)" : "scale(1.05)",
            }}
          />
        </div>
      ))}

      {/* Konten Hero */}
      <div className="relative z-20 w-full h-full flex flex-col items-center justify-center text-center px-4 max-w-5xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/40 bg-card/40 backdrop-blur-md text-primary text-sm font-medium mb-8">
          <span className="w-2 h-2 rounded-full bg-accent-sky animate-pulse"></span>
          Musim Logistik 2026 Telah Dimulai
        </div>

        <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight mb-6 text-(-foreground) drop-shadow-lg transition-all duration-500">
          {slides[current].title}
        </h1>

        <p className="max-w-2xl text-lg sm:text-xl text-(-foreground)-300 mb-10 leading-relaxed transition-all duration-500">
          {slides[current].subtitle}
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full justify-center max-w-md">
          {isDriver ? (
            <Link
              href="/dashboard"
              className="flex items-center justify-center gap-2 w-full py-3 px-6 bg-primary hover:bg-primary/80 text-primary-foreground font-semibold rounded-lg transition-all shadow-[0_0_20px_rgba(126,87,194,0.4)]"
            >
              Masuk Dashboard <ArrowRight className="w-5 h-5" />
            </Link>
          ) : (
            <Link
              href="/login"
              className="flex items-center justify-center gap-2 w-full py-3 px-6 bg-primary hover:bg-primary/80 text-primary-foreground font-semibold rounded-lg transition-all shadow-[0_0_20px_rgba(126,87,194,0.4)]"
            >
              Gabung Nismara <ArrowRight className="w-5 h-5" />
            </Link>
          )}
          <a
            href="#features"
            className="flex items-center justify-center w-full py-3 px-6 glass-panel hover:bg-card/60 text-(-foreground) font-medium rounded-lg transition-all"
          >
            Pelajari Fitur
          </a>
        </div>

        {/* Indikator Slider */}
        <div className="absolute bottom-10 flex gap-3">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrent(index)}
              className={`w-3 h-3 rounded-full transition-all ${
                index === current
                  ? "bg-primary w-8"
                  : "bg-white/30 hover:bg-white/50"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
