"use client";

import { useState } from "react";
import { updateContractAction } from "@/app/actions/contractActions";
import Link from "next/link";
import { Briefcase, Save, ArrowLeft, Loader2, Truck, Bus } from "lucide-react";
import { formatWIBDateTimeLocal } from "@/lib/utils";
import { showAlert } from "@/lib/dialog";
import CityMultiSelect from "@/components/contracts/CityMultiSelect";

export default function EditContractForm({ contract }: { contract: any }) {
  const [loading, setLoading] = useState(false);

  const initialDate = formatWIBDateTimeLocal(contract.endAt);
  const initialStartDate = formatWIBDateTimeLocal(contract.startDate);

  const [formData, setFormData] = useState({
    contractName: contract.contractName || "",
    contractCategory: (contract.contractCategory === "coach" ? "coach" : "truck") as
      | "truck"
      | "coach",
    companyName: contract.companyName || "",
    targetCities: Array.isArray(contract.targetCities) ? contract.targetCities : ([] as string[]),
    coachMarketFilter: (
      contract.coachMarketFilter === "company" || contract.coachMarketFilter === "tourist"
        ? contract.coachMarketFilter
        : "all"
    ) as "all" | "company" | "tourist",
    minPassengers: Number(contract.minPassengers || 0),
    imageUrl: contract.imageUrl || "",
    gameId: contract.gameId || "1",
    endAt: initialDate,
    isScheduled: contract.isScheduled === true,
    startDate: initialStartDate,
  });

  const isCoach = formData.contractCategory === "coach";

  return (
    <div className="glass-panel p-6 md:p-10 rounded-3xl border-border/50 shadow-2xl relative">
      <div className="absolute top-0 right-0 p-10 opacity-5 rotate-12 pointer-events-none">
        <Briefcase size={180} className="text-primary" />
      </div>

      <form
        action={async (data) => {
          if (isCoach && formData.targetCities.length === 0) {
            await showAlert("Pilih minimal 1 kota target untuk Special Contract Coaches.");
            return;
          }
          setLoading(true);
          try {
            data.set("contractCategory", formData.contractCategory);
            data.set("targetCities", JSON.stringify(formData.targetCities));
            data.set("coachMarketFilter", formData.coachMarketFilter);
            data.set("minPassengers", String(formData.minPassengers));
            await updateContractAction(contract._id, data);
          } catch (err: any) {
            await showAlert(err.message || "Gagal memperbarui data kontrak.");
            setLoading(false);
          }
        }}
        className="relative z-10 space-y-6"
      >
        {/* Kategori Kontrak */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground block">
            Kategori Kontrak
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, contractCategory: "truck" })}
              className={`min-h-[56px] p-3.5 rounded-xl border text-left transition-all flex items-center gap-3 cursor-pointer ${
                !isCoach
                  ? "bg-sky-500/15 border-sky-500 text-sky-400"
                  : "bg-background/60 border-border text-muted-foreground hover:border-foreground/30"
              }`}
            >
              <Truck size={18} />
              <div>
                <p className="text-sm font-semibold">Truck (Logistik)</p>
                <p className="text-xs opacity-75">Berdasarkan perusahaan</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setFormData({ ...formData, contractCategory: "coach" })}
              className={`min-h-[56px] p-3.5 rounded-xl border text-left transition-all flex items-center gap-3 cursor-pointer ${
                isCoach
                  ? "bg-emerald-500/15 border-emerald-500 text-emerald-400"
                  : "bg-background/60 border-border text-muted-foreground hover:border-foreground/30"
              }`}
            >
              <Bus size={18} />
              <div>
                <p className="text-sm font-semibold">Coaches (Bus)</p>
                <p className="text-xs opacity-75">Berdasarkan kota & layanan</p>
              </div>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground block">
              Target Game
            </label>
            <select
              name="gameId"
              value={formData.gameId}
              onChange={(e) =>
                setFormData({ ...formData, gameId: e.target.value })
              }
              className="w-full min-h-[44px] bg-background border border-input rounded-xl px-3.5 py-2.5 text-foreground font-medium text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="1" className="bg-card">
                Euro Truck Simulator 2
              </option>
              <option value="2" className="bg-card">
                American Truck Simulator
              </option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground block">
              Deadline Kontrak (WIB)
            </label>
            <input
              type="datetime-local"
              name="endAt"
              required
              value={formData.endAt}
              onChange={(e) =>
                setFormData({ ...formData, endAt: e.target.value })
              }
              className="w-full min-h-[44px] bg-background border border-input rounded-xl px-3.5 py-2.5 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring [color-scheme:dark]"
            />
          </div>
        </div>

        <div className="space-y-5 bg-muted/30 p-5 rounded-2xl border border-border">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground block">
              Nama Kontrak
            </label>
            <input
              name="contractName"
              required
              value={formData.contractName}
              onChange={(e) =>
                setFormData({ ...formData, contractName: e.target.value })
              }
              className="w-full min-h-[44px] bg-background border border-input rounded-xl px-3.5 py-2.5 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="Contoh: Mudik Lebaran 2026"
            />
          </div>

          {!isCoach ? (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground block">
                Perusahaan Klien
              </label>
              <input
                name="companyName"
                required={!isCoach}
                value={formData.companyName}
                onChange={(e) =>
                  setFormData({ ...formData, companyName: e.target.value })
                }
                className="w-full min-h-[44px] bg-background border border-input rounded-xl px-3.5 py-2.5 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring"
                placeholder="Nama Perusahaan (Client)"
              />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground block">
                  Kota Target (Asal / Tujuan / Transit)
                </label>
                <CityMultiSelect
                  gameId={formData.gameId}
                  value={formData.targetCities}
                  onChange={(cities) =>
                    setFormData({ ...formData, targetCities: cities })
                  }
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground block">
                    Filter Jenis Layanan Bus
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        ["all", "Semua"],
                        ["company", "Company"],
                        ["tourist", "Tourist"],
                      ] as const
                    ).map(([val, lbl]) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() =>
                          setFormData({ ...formData, coachMarketFilter: val })
                        }
                        className={`min-h-[42px] rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                          formData.coachMarketFilter === val
                            ? "bg-emerald-500/15 border-emerald-500 text-emerald-400"
                            : "bg-background border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground block">
                    Minimal Penumpang (Opsional)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={200}
                    value={formData.minPassengers}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        minPassengers: Math.max(0, Number(e.target.value || 0)),
                      })
                    }
                    className="w-full min-h-[42px] bg-background border border-input rounded-xl px-3.5 py-2 text-foreground text-sm font-mono tabular-nums outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <div className="space-y-3 bg-muted/30 p-5 rounded-2xl border border-border">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="isScheduled"
              value="true"
              className="w-5 h-5 accent-primary rounded-md"
              checked={formData.isScheduled}
              onChange={(e) =>
                setFormData({ ...formData, isScheduled: e.target.checked })
              }
            />
            <span className="text-sm font-medium text-foreground">
              Jadwalkan Kontrak (Scheduled Contract)
            </span>
          </label>

          {formData.isScheduled && (
            <div className="space-y-2 mt-3">
              <label className="text-sm font-medium text-foreground block">
                Waktu Mulai (WIB)
              </label>
              <input
                type="datetime-local"
                name="startDate"
                required={formData.isScheduled}
                value={formData.startDate}
                onChange={(e) =>
                  setFormData({ ...formData, startDate: e.target.value })
                }
                className="w-full min-h-[44px] bg-background border border-input rounded-xl px-3.5 py-2.5 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring [color-scheme:dark]"
              />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground block">
            Cover Image URL
          </label>
          <input
            name="imageUrl"
            value={formData.imageUrl}
            onChange={(e) =>
              setFormData({ ...formData, imageUrl: e.target.value })
            }
            className="w-full min-h-[44px] bg-background border border-input rounded-xl px-3.5 py-2.5 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring"
            placeholder="Link gambar (opsional)"
          />
          {formData.imageUrl && (
            <div className="mt-3 w-full h-40 rounded-xl overflow-hidden border border-border">
              <img
                src={formData.imageUrl}
                alt="Preview"
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 pt-4 border-t border-border">
          <Link
            href="/dashboard/manage/events/contracts"
            className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 bg-background border border-border hover:bg-accent text-foreground rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2"
          >
            <ArrowLeft size={16} /> Batal
          </Link>
          <button
            disabled={loading}
            type="submit"
            className="w-full sm:flex-1 min-h-[44px] bg-primary text-primary-foreground py-2.5 px-6 rounded-xl font-medium text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            {loading ? "Menyimpan perubahan..." : "Simpan perubahan"}
          </button>
        </div>
      </form>
    </div>
  );
}
