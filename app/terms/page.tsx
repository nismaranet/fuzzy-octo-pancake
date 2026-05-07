"use client";

import React from "react";
import {
  ShieldCheck,
  Scale,
  UserCheck,
  Coins,
  AlertTriangle,
  Lock,
  ChevronRight,
  FileText,
} from "lucide-react";

export default function TermsOfService() {
  const lastUpdated = "07 Mei 2026";

  const sections = [
    {
      icon: <UserCheck size={20} />,
      title: "1. Penerimaan Ketentuan",
      content:
        "Dengan mendaftar dan menggunakan platform Nismara Transport, Anda menyatakan bahwa Anda telah membaca, memahami, dan setuju untuk terikat oleh Ketentuan Layanan ini. Jika Anda tidak setuju, Anda tidak diperkenankan menggunakan layanan kami.",
    },
    {
      icon: <ShieldCheck size={20} />,
      title: "2. Kelayakan Driver",
      content:
        "Layanan ini ditujukan untuk komunitas simulasi (ETS2 dan ATS). Setiap driver wajib memiliki akun Discord dan Trucky yang valid. Kami berhak menolak pendaftaran tanpa memberikan alasan spesifik demi menjaga kualitas komunitas.",
    },
    {
      icon: <Scale size={20} />,
      title: "3. Perilaku & Kode Etik",
      content:
        "Semua driver wajib mematuhi peraturan lalu lintas virtual dan etika berkomunitas. Tindakan rasisme, pelecehan, atau penggunaan cheat/exploit akan mengakibatkan pemutusan akses akun secara permanen tanpa peringatan.",
    },
    {
      icon: <Coins size={20} />,
      title: "4. Ekonomi Virtual (Nismara Coin)",
      content:
        "Nismara Coin (N¢) adalah mata uang virtual internal dan tidak memiliki nilai mata uang nyata. N¢ tidak dapat diuangkan atau diperdagangkan di luar ekosistem Nismara. Kami berhak menyesuaikan saldo jika ditemukan kesalahan sistem atau manipulasi data.",
    },
    {
      icon: <AlertTriangle size={20} />,
      title: "5. Sistem Poin Penalti",
      content:
        "Nismara menggunakan sistem Poin Penalti untuk mengaudit kualitas mengemudi. Akumulasi poin tertentu (seperti SP1, SP2, SP3) dapat mengakibatkan penangguhan akun sementara hingga pemecatan driver dari VTC.",
    },
    {
      icon: <Lock size={20} />,
      title: "6. Hak Intelektual",
      content:
        "Semua logo, aset grafis, dan infrastruktur perangkat lunak Nismara adalah hak milik Nismara Group. Penggunaan aset kami untuk kepentingan komersial pihak ketiga tanpa izin tertulis adalah pelanggaran hukum.",
    },
  ];

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-12 pb-24 animate-in fade-in duration-700">
      {/* HEADER SECTION */}
      <div className="text-center space-y-4 pt-10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-2">
          <FileText size={14} /> Legal Documentation
        </div>
        <h1 className="text-6xl font-black text-(-primary-foreground) tracking-tighter uppercase leading-none">
          Terms of <span className="text-accent-sky">Service</span>
        </h1>
        <p className="text-foreground/40 font-bold uppercase text-xs tracking-widest">
          Terakhir Diperbarui: {lastUpdated}
        </p>
      </div>

      {/* CONTENT INTRODUCTION */}
      <div className="glass-panel p-8 rounded-[2.5rem] border border-border bg-card/30 backdrop-blur-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <Scale size={120} />
        </div>
        <p className="text-lg font-medium text-foreground/60 leading-relaxed relative z-10 italic">
          "Peraturan ini dibuat untuk memastikan pengalaman simulasi yang adil,
          kompetitif, dan profesional bagi seluruh anggota Nismara Transport
          Group."
        </p>
      </div>

      {/* DETAILED SECTIONS */}
      <div className="space-y-6">
        {sections.map((section, index) => (
          <div
            key={index}
            className="group p-8 rounded-[2rem] border border-border bg-card/20 hover:bg-card/50 hover:border-primary/30 transition-all duration-300"
          >
            <div className="flex items-start gap-6">
              <div className="p-3 bg-primary/10 rounded-xl text-primary group-hover:scale-110 transition-transform">
                {section.icon}
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-(-primary-foreground) uppercase tracking-tight">
                  {section.title}
                </h3>
                <p className="text-sm font-medium text-foreground/50 leading-relaxed">
                  {section.content}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* FOOTER NOTE */}
      <div className="p-10 text-center space-y-6 border-t border-border/50">
        <p className="text-sm text-foreground/30 font-medium max-w-2xl mx-auto">
          Nismara Transport berhak untuk mengubah ketentuan ini sewaktu-waktu.
          Perubahan akan diinformasikan melalui kanal Discord resmi kami.
          Penggunaan layanan secara berkelanjutan setelah perubahan dianggap
          sebagai persetujuan terhadap ketentuan baru.
        </p>
      </div>
    </div>
  );
}
