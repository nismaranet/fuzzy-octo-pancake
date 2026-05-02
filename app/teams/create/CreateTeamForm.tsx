"use client";

import { useState } from "react";
import { createTeamAction } from "./actions";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function CreateTeamForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [uriPreview, setUriPreview] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);

  const handleUriChange = (val: string) => {
    const slug = val
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^\w-]+/g, "");
    setUriPreview(slug);
  };

  const uploadToR2 = async (file: File, folder: string) => {
    const res = await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        fileType: file.type,
        folder,
      }),
    });
    const { signedUrl, publicUrl } = await res.json();
    await fetch(signedUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type },
    });
    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const formData = new FormData(e.currentTarget);
      let finalLogoUrl = "";
      let finalBannerUrl = "";

      if (logoFile) finalLogoUrl = await uploadToR2(logoFile, "teams/logos");
      if (bannerFile)
        finalBannerUrl = await uploadToR2(bannerFile, "teams/banners");

      const result = await createTeamAction({
        name: formData.get("name") as string,
        uri: uriPreview,
        tag: formData.get("tag") as string,
        description: formData.get("description") as string,
        logoUrl: finalLogoUrl,
        bannerUrl: finalBannerUrl,
      });

      if (result.success) {
        router.push(`/teams/${result.uri}`);
      } else {
        setError(result.message || "Gagal membuat tim.");
        setIsLoading(false);
      }
    } catch (err) {
      setError("Gagal memproses pembuatan tim.");
      setIsLoading(false);
    }
  };

  return (
    <div className="p-8 min-h-screen flex items-center justify-center">
      <div className="max-w-3xl w-full">
        <div className="glass-panel rounded-3xl p-8 md:p-10 relative overflow-hidden">
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-xl text-red-500 text-sm">
              ⚠️ {error}
            </div>
          )}

          <header className="mb-8">
            <h1 className="text-3xl font-extrabold text-gradient mb-2">
              Bentuk Tim Baru
            </h1>
            <p className="text-foreground/70">
              Tentukan identitas unik untuk tim kamu.
            </p>
          </header>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Nama Tim *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  onChange={(e) =>
                    !uriPreview && handleUriChange(e.target.value)
                  }
                  className="w-full bg-background/50 border border-border rounded-xl px-4 py-3 outline-none focus:border-primary transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Tag Tim *
                </label>
                <input
                  type="text"
                  name="tag"
                  required
                  maxLength={5}
                  className="w-full bg-background/50 border border-border rounded-xl px-4 py-3 uppercase outline-none focus:border-primary transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Tautan Tim (URI) *
              </label>
              <input
                type="text"
                required
                value={uriPreview}
                onChange={(e) => handleUriChange(e.target.value)}
                className="w-full bg-background/50 border border-border rounded-xl px-4 py-3 outline-none focus:border-primary transition-all text-sm font-mono"
              />
              <p className="mt-2 text-[10px] text-accent-sky font-bold uppercase tracking-widest">
                Preview: nismara.id/teams/{uriPreview || "tautan-kamu"}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-6 py-4 border-y border-border/50">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Logo Tim
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-foreground/50 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-primary/20 file:text-primary font-bold cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Banner Tim
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setBannerFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-foreground/50 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-accent-sky/20 file:text-accent-sky font-bold cursor-pointer"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Deskripsi (Markdown)
              </label>
              <textarea
                name="description"
                rows={4}
                placeholder="Gunakan **tebal**, *miring*, atau [Link](...)"
                className="w-full bg-background/50 border border-border rounded-xl px-4 py-3 outline-none focus:border-primary transition-all resize-none text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-bold py-4 rounded-xl shadow-lg transition-all"
            >
              {isLoading ? "Mengunggah & Menyimpan..." : "Buat Tim Sekarang"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
