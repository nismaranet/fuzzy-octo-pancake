"use client";

import React, { useState } from "react";
import {
  HelpCircle,
  ChevronDown,
  Truck,
  Coins,
  ShieldAlert,
  UserPlus,
  MessageSquare,
  Zap,
} from "lucide-react";

interface FaqItemProps {
  question: string;
  answer: string;
  icon: React.ReactNode;
}

const FaqItem = ({ question, answer, icon }: FaqItemProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className={`glass-panel rounded-[2rem] border transition-all duration-500 overflow-hidden ${
        isOpen
          ? "border-primary/50 bg-primary/5 shadow-[0_0_30px_rgba(109,40,217,0.1)]"
          : "border-border bg-card/20"
      }`}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-6 md:p-8 flex items-center justify-between text-left group"
      >
        <div className="flex items-center gap-6">
          <div
            className={`p-3 rounded-xl transition-all duration-300 ${
              isOpen
                ? "bg-primary text-white scale-110"
                : "bg-white/5 text-foreground/40 group-hover:text-primary"
            }`}
          >
            {icon}
          </div>
          <h3
            className={`text-lg md:text-xl font-black uppercase italic tracking-tight transition-colors ${
              isOpen
                ? "text-(-primary-foreground)"
                : "text-(-primary-foreground)/80"
            }`}
          >
            {question}
          </h3>
        </div>
        <ChevronDown
          className={`transition-transform duration-500 text-foreground/20 ${isOpen ? "rotate-180 text-primary" : ""}`}
          size={24}
        />
      </button>

      <div
        className={`transition-all duration-500 ease-in-out ${
          isOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-8 pb-8 md:pl-24">
          <div className="h-px bg-border/50 w-full mb-6" />
          <p className="text-foreground/50 font-medium leading-relaxed max-w-3xl">
            {answer}
          </p>
        </div>
      </div>
    </div>
  );
};

export default function FaqPage() {
  const faqs = [
    {
      icon: <UserPlus size={20} />,
      question: "Bagaimana cara bergabung dengan Nismara?",
      answer:
        "Sangat mudah! Anda hanya perlu login menggunakan akun Discord melalui halaman pendaftaran, pastikan Anda sudah menginstal Trucky Client, dan hubungkan profil Trucky Anda di dashboard. Setelah itu, Anda bisa langsung mengambil kontrak kerja pertama Anda.",
    },
    {
      icon: <Coins size={20} />,
      question: "Apa kegunaan Nismara Coin (N¢)?",
      answer:
        "Nismara Coin adalah mata uang virtual internal kami. Anda mendapatkannya dengan menyelesaikan pengiriman kargo. Di masa depan, N¢ dapat digunakan untuk kustomisasi profil, 'membeli' peran khusus di Discord, hingga berpartisipasi dalam event eksklusif berhadiah.",
    },
    {
      icon: <Truck size={20} />,
      question: "Apakah saya harus selalu online saat hauling?",
      answer:
        "Sistem pelacakan kami terintegrasi dengan Trucky API. Selama Trucky Client Anda aktif dan merekam perjalanan, data akan otomatis masuk ke database Nismara setelah Anda menyelesaikan pekerjaan (Job Completed). Anda tidak wajib membuka website Nismara saat sedang menyetir.",
    },
    {
      icon: <ShieldAlert size={20} />,
      question: "Kenapa saya mendapatkan Poin Penalti?",
      answer:
        "Poin Penalti diberikan secara otomatis atau manual jika terjadi pelanggaran seperti: kerusakan kargo di atas ambang batas (damage), pembatalan kontrak tanpa alasan, atau perilaku tidak sopan di komunitas. Pastikan Anda selalu menjaga kualitas pengemudian Anda.",
    },
    {
      icon: <Zap size={20} />,
      question: "Apa itu Special Contract & Event?",
      answer:
        "Special Contract adalah muatan khusus dengan rute spesifik yang memberikan reward N¢ lebih tinggi. Event adalah kegiatan komunitas dalam periode tertentu yang biasanya memiliki multiplier (pengganda) NC. Anda bisa melihat daftar aktifnya di halaman utama atau dashboard.",
    },
    {
      icon: <MessageSquare size={20} />,
      question: "Di mana saya bisa melaporkan masalah teknis?",
      answer:
        "Jika Anda menemukan bug pada dashboard atau masalah sinkronisasi data, silakan buat 'Support Ticket' di server Discord resmi Nismara. Tim manajemen kami siap membantu Anda 24/7.",
    },
  ];

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-12 pb-24 animate-in fade-in duration-700">
      {/* HEADER */}
      <div className="text-center space-y-4 pt-16">
        <div className="p-3 bg-primary/10 rounded-2xl text-primary inline-block mb-2">
          <HelpCircle size={32} />
        </div>
        <h1 className="text-6xl font-black text-(-primary-foreground) tracking-tighter uppercase italic leading-none">
          Common <span className="text-primary">Questions</span>
        </h1>
        <p className="text-foreground/40 font-bold uppercase text-xs tracking-[0.3em]">
          Operational Support & Driver Inquiries
        </p>
      </div>

      {/* SEARCH TEASER (AESTHETIC ONLY) */}
      <div className="relative max-w-2xl mx-auto">
        <div className="p-6 rounded-[2rem] bg-card border border-border text-center">
          <p className="text-sm font-medium text-foreground/40 italic">
            "Punya pertanyaan yang tidak ada di sini? Langsung tanyakan di kanal
            Discord kami untuk respon lebih cepat."
          </p>
        </div>
      </div>

      {/* FAQ LIST */}
      <div className="space-y-4">
        {faqs.map((faq, index) => (
          <FaqItem key={index} {...faq} />
        ))}
      </div>

      {/* FOOTER CTA */}
      <div className="text-center pt-10 border-t border-border/30">
        <p className="text-[10px] font-black text-foreground/20 uppercase tracking-[0.4em]">
          Nismara Transport • Intelligence Division • 2026
        </p>
      </div>
    </div>
  );
}
