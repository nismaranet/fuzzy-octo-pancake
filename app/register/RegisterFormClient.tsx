"use client";

import React, { useState } from "react";
import {
  Send,
  Truck,
  Info,
  CheckCircle2,
  UserPlus,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";

export default function RegisterFormClient({ session }: { session: any }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const payload = {
      userId: session?.user?.discordId,
      username: session?.user?.name,
      truckyId: formData.get("truckyId"),
      reason: formData.get("reason"),
      experience: formData.get("experience"),
      game: formData.get("game"),
      sumber: formData.get("sumber"),
    };

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Gagal mengirim data.");
      setIsSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-(-background) text-center">
        <div className="space-y-6 animate-in zoom-in duration-500">
          <CheckCircle2 size={64} className="text-emerald-500 mx-auto" />
          <h2 className="text-4xl font-black text-(-primary-foreground) italic uppercase">
            Submitted!
          </h2>
          <p className="text-foreground/40 max-w-sm">
            Cek Discord Nismara Group, Natasya telah membuatkan ticket untuk
            Anda. Harap respon pesan dari Manajer Nismara secepatnya agar proses
            pendaftaran anda cepat.
          </p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen py-20 px-6 bg-(-background)">
      <div className="max-w-4xl mx-auto space-y-12">
        <div className="text-center space-y-4">
          <h1 className="text-6xl font-black text-(-primary-foreground) tracking-tighter uppercase italic">
            Driver <span className="text-accent-sky">Application</span>
          </h1>
          <p className="text-foreground/40 font-bold uppercase text-[10px]">
            Logged in as {session.user.name}
          </p>
        </div>

        <div className="bg-card/40 backdrop-blur-2xl border border-border rounded-[3.5rem] p-12 shadow-2xl">
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 md:grid-cols-2 gap-10"
          >
            <div className="space-y-8">
              <div className="space-y-4">
                <label className="flex items-center gap-2 text-[10px] font-black uppercase text-primary">
                  <Truck size={14} /> Trucky ID Integration
                </label>
                <input
                  name="truckyId"
                  required
                  className="w-full bg-white/5 border border-border p-4 rounded-2xl text-white outline-none focus:border-primary transition-all"
                  placeholder="181458"
                />
              </div>
              <div className="flex items-start gap-2 p-4 bg-primary/5 rounded-2xl border border-primary/10">
                <Info size={16} className="text-primary mt-0.5 shrink-0" />
                <p className="text-[10px] text-foreground/40 font-medium leading-relaxed">
                  ID Trucky ini diperlukan untuk sinkronisasi telemetri otomatis
                  dari aplikasi Trucky ke dashboard Nismara. Apabila kamu belum
                  mempunyai trucky silahkan daftar terlebih dahulu di{" "}
                  <a
                    href="https://hub.truckyapp.com/"
                    className="text-primary hover:underline font-bold"
                  >
                    Trucky Hub
                  </a>
                  . Lalu kamu bisa ambil trucky ID kamu di profile kamu semisal{" "}
                  <span className="font-mono">
                    https://hub.truckyapp.com/user/
                    <span className="font-bold">181458</span>
                  </span>{" "}
                  Apabila kamu frustasi, kamu bisa isi saja terlebih dahulu kode
                  asal lalu nanti di ticket pendaftaran kamu bisa meminta
                  bantuan oleh Manajer Nismara Transport untuk bantuan pembuatan
                  akun TruckyHub
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-primary">
                  Pengalaman anda bermain ETS2/ATS
                </label>
                <select
                  name="experience"
                  className="w-full bg-white/5 border border-border p-4 rounded-2xl text-white outline-none"
                >
                  <option className="bg-card">Baru Memulai</option>
                  <option className="bg-card">1 - 2 Tahun</option>
                  <option className="bg-card">Di atas 3 Tahun</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-primary">
                  Darimana kamu mengetahui tentang Nismara Transport?
                </label>
                <select
                  name="sumber"
                  className="w-full bg-white/5 border border-border p-4 rounded-2xl text-white outline-none"
                >
                  <option className="bg-card">Google / Search Engine</option>
                  <option className="bg-card">Facebook</option>
                  <option className="bg-card">Instagram</option>
                  <option className="bg-card">Discord</option>
                  <option className="bg-card">Social Media Lainnya</option>
                  <option className="bg-card">Teman</option>
                </select>
              </div>
            </div>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-primary">
                  Game yang lebih sering dimainkan
                </label>
                <select
                  name="game"
                  className="w-full bg-white/5 border border-border p-4 rounded-2xl text-white outline-none"
                >
                  <option className="bg-card">Euro Truck Simulator 2</option>
                  <option className="bg-card">American Truck Simulator</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-primary">
                  Motivation
                </label>
                <textarea
                  name="reason"
                  required
                  rows={5}
                  className="w-full bg-white/5 border border-border p-4 rounded-2xl text-white outline-none resize-none"
                  placeholder="Kenapa ingin bergabung?"
                />
              </div>
              <div className="space-y-4">
                <p className="text-[10px] font-medium text-foreground/30 leading-relaxed">
                  Dengan menekan tombol Kirim Pendaftaran berarti Anda telah
                  menyetujui{" "}
                  <a
                    href="/terms"
                    className="text-primary hover:underline font-bold"
                  >
                    Terms of Service
                  </a>{" "}
                  dan{" "}
                  <a
                    href="/privacy"
                    className="text-primary hover:underline font-bold"
                  >
                    Privacy Policy
                  </a>{" "}
                  Nismara Transport.
                </p>
              </div>
              <button
                disabled={isSubmitting}
                className="w-full py-5 bg-primary text-white font-black uppercase rounded-2xl hover:opacity-80 transition-all"
              >
                {isSubmitting ? "Processing..." : "Kirim Pendaftaran"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
