"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Ticket,
  ShieldCheck,
  Search,
  UserCheck,
  Send,
  History,
  Trash2,
  Loader2,
  Infinity as InfinityIcon,
  Lock,
  Check,
  ChevronDown,
  RefreshCw,
} from "lucide-react";
import { NO_CACHE_FETCH_OPTIONS } from "@/lib/antiCache";
import { showAlert, showConfirm } from "@/lib/dialog";
import {
  buildAutoVoucherTitle,
  formatWIBShort,
  VOUCHER_CATEGORY_SHORT_LABELS,
  normalizeVoucherCategoryKey,
} from "@/lib/communityMarketShared";

interface UserOption {
  discordId: string;
  name: string;
  truckyId: string | null;
  image: string | null;
  role: string;
  isDriver: boolean;
}

interface LogRecord {
  _id: string;
  actorDiscordId: string;
  actorName: string;
  recipientDiscordId: string;
  recipientName: string;
  recipientTruckyId?: string | null;
  reason: string;
  quantity: number;
  voucherIds: string[];
  voucherCodes: string[];
  voucherStatuses: Array<{ id: string; status: string }>;
  voucherSnapshot: {
    title: string;
    category: string;
    discountType: "percentage" | "fixed";
    discountValue: number;
    maxDiscount: number;
    minSpend: number;
    durationHours: number;
    expiresInDays: number;
    tradable: boolean;
  };
  revokedAt?: string | null;
  revokedByName?: string | null;
  createdAt: string;
}

export default function ManualVoucherClient({
  users,
  initialLogs,
  currentOwner,
}: {
  users: UserOption[];
  initialLogs: LogRecord[];
  currentOwner: { discordId: string; name: string };
}) {
  const router = useRouter();
  const [logs, setLogs] = useState<LogRecord[]>(initialLogs);
  const [logSearch, setLogSearch] = useState("");
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Searchable driver picker state
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [driverQuery, setDriverQuery] = useState("");
  const [selectedDiscordId, setSelectedDiscordId] = useState<string>(
    currentOwner.discordId
  );
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Voucher form state
  const [category, setCategory] = useState<string>("GARAGE_RENT");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [discountValue, setDiscountValue] = useState<number>(25);
  const [maxDiscount, setMaxDiscount] = useState<number>(0);
  const [minSpend, setMinSpend] = useState<number>(0);
  const [durationHours, setDurationHours] = useState<number>(2);
  const [expiresInDays, setExpiresInDays] = useState<number>(30);
  const [quantity, setQuantity] = useState<number>(1);
  const [tradable, setTradable] = useState<boolean>(true);
  const [notifyRecipient, setNotifyRecipient] = useState<boolean>(true);
  const [title, setTitle] = useState<string>(
    buildAutoVoucherTitle({ category: "GARAGE_RENT", discountValue: 25 })
  );
  const [reason, setReason] = useState<string>("");

  const [submitting, setSubmitting] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const selectedUser = useMemo(
    () => users.find((u) => u.discordId === selectedDiscordId) || null,
    [users, selectedDiscordId]
  );

  const filteredUsers = useMemo(() => {
    const q = driverQuery.trim().toLowerCase();
    if (!q) return users.slice(0, 40);
    return users
      .filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.discordId.includes(q) ||
          (u.truckyId && u.truckyId.includes(q))
      )
      .slice(0, 40);
  }, [users, driverQuery]);

  const isBooster = category === "NC_BOOSTER";

  const syncTitle = (
    nextCat: string,
    nextType: "percentage" | "fixed",
    nextVal: number,
    nextHrs: number,
    nextMax: number
  ) => {
    if (nextType === "fixed" && nextCat !== "NC_BOOSTER") {
      const catLabel =
        VOUCHER_CATEGORY_SHORT_LABELS[normalizeVoucherCategoryKey(nextCat)];
      setTitle(`Potongan ${catLabel} ${nextVal.toLocaleString("id-ID")} NC`);
    } else {
      setTitle(
        buildAutoVoucherTitle({
          category: nextCat,
          discountValue: nextVal,
          durationHours: nextHrs,
          maxDiscount: nextMax,
        })
      );
    }
  };

  const refreshLogs = async (q = logSearch) => {
    setLoadingLogs(true);
    try {
      const qs = q.trim() ? `?search=${encodeURIComponent(q.trim())}` : "";
      const res = await fetch(`/api/manage/vouchers${qs}`, {
        ...NO_CACHE_FETCH_OPTIONS,
      });
      const data = await res.json();
      if (data.success) setLogs(data.logs || []);
    } catch (err) {
      console.error("Failed loading voucher grant logs:", err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) {
      await showAlert("Pilih akun penerima terlebih dahulu.");
      return;
    }
    if (reason.trim().length < 5) {
      await showAlert("Alasan pembuatan voucher wajib diisi (minimal 5 karakter).");
      return;
    }

    const ok = await showConfirm(
      `Terbitkan ${quantity}x "${title}" untuk ${selectedUser.name} (${selectedUser.discordId})?\n\nAlasan: ${reason.trim()}`
    );
    if (!ok) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/manage/vouchers", {
        method: "POST",
        ...NO_CACHE_FETCH_OPTIONS,
        headers: {
          ...NO_CACHE_FETCH_OPTIONS.headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipientDiscordId: selectedUser.discordId,
          category,
          discountType: isBooster ? "percentage" : discountType,
          discountValue,
          maxDiscount: isBooster || discountType === "fixed" ? 0 : maxDiscount,
          minSpend: isBooster ? 0 : minSpend,
          durationHours: isBooster ? durationHours : 0,
          expiresInDays,
          quantity,
          tradable,
          notifyRecipient,
          title: title.trim(),
          reason: reason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal menerbitkan voucher manual.");
      }

      await showAlert(
        `${data.message}\n\nKode: ${(data.codes || []).join(", ")}`
      );
      setReason("");
      await refreshLogs();
      router.refresh();
    } catch (err: any) {
      await showAlert(err.message || "Gagal menerbitkan voucher.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (log: LogRecord) => {
    const activeCount = log.voucherStatuses.filter((v) => v.status === "ACTIVE").length;
    if (activeCount === 0) return;

    const ok = await showConfirm(
      `Cabut ${activeCount} voucher berstatus ACTIVE milik ${log.recipientName} dari log ini? (Catatan audit log tetap tersimpan).`
    );
    if (!ok) return;

    setRevokingId(log._id);
    try {
      const res = await fetch("/api/manage/vouchers", {
        method: "DELETE",
        ...NO_CACHE_FETCH_OPTIONS,
        headers: {
          ...NO_CACHE_FETCH_OPTIONS.headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ logId: log._id }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal mencabut voucher.");
      }
      await showAlert(data.message || "Voucher dicabut.");
      await refreshLogs();
      router.refresh();
    } catch (err: any) {
      await showAlert(err.message || "Gagal mencabut voucher.");
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8 pb-20">
      {/* Header */}
      <div className="rounded-3xl bg-gradient-to-br from-card via-card to-amber-500/10 border border-amber-500/30 p-6 md:p-8 shadow-xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[11px] font-black uppercase tracking-widest mb-2">
          <ShieldCheck className="w-3.5 h-3.5" /> Exclusive Access · Developer &amp; Owner Only
        </div>
        <h1 className="text-2xl md:text-3xl font-black text-foreground flex items-center gap-2.5">
          <Ticket className="w-7 h-7 text-amber-400" />
          Owner Voucher Lab (Manual Grant)
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Buat voucher secara manual untuk keperluan testing fitur (Community Market, Sewa Garasi, Dealer Armada, Booster) maupun kompensasi khusus. Seluruh penerbitan dicatat permanen dalam Audit Log.
        </p>
      </div>

      {/* Form Pembuatan Voucher Manual */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl bg-card border border-border/70 p-6 space-y-6 shadow-lg"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-border/60">
          <h2 className="text-base font-black text-foreground">
            Terbitkan Voucher Manual
          </h2>
          <button
            type="button"
            onClick={() => {
              setSelectedDiscordId(currentOwner.discordId);
              setDropdownOpen(false);
            }}
            className="self-start sm:self-auto px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30 text-xs font-bold hover:bg-amber-500/25 inline-flex items-center gap-1.5"
          >
            <UserCheck className="w-3.5 h-3.5" />
            Pilih Diri Sendiri ({currentOwner.name})
          </button>
        </div>

        {/* Searchable Driver Picker */}
        <div className="space-y-1.5" ref={dropdownRef}>
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Penerima Voucher (Cari Nama / Discord ID / Trucky ID) *
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setDropdownOpen((o) => !o)}
              className="w-full px-4 py-3 rounded-xl bg-background border border-border text-left flex items-center justify-between gap-3 hover:border-primary/50 transition-colors"
            >
              {selectedUser ? (
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-primary/15 overflow-hidden shrink-0 flex items-center justify-center text-xs font-bold text-primary">
                    {selectedUser.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={selectedUser.image}
                        alt={selectedUser.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      selectedUser.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">
                      {selectedUser.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground font-mono truncate">
                      Discord: {selectedUser.discordId}
                      {selectedUser.truckyId ? ` · Trucky #${selectedUser.truckyId}` : ""}
                    </p>
                  </div>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Pilih driver penerima...</span>
              )}
              <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>

            {dropdownOpen && (
              <div className="absolute left-0 right-0 mt-2 z-40 rounded-xl bg-card border border-border shadow-2xl overflow-hidden">
                <div className="p-2.5 border-b border-border/60">
                  <div className="relative">
                    <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      autoFocus
                      value={driverQuery}
                      onChange={(e) => setDriverQuery(e.target.value)}
                      placeholder="Ketik nama, Discord ID, atau Trucky ID..."
                      className="w-full pl-9 pr-3 py-2 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                </div>
                <div className="max-h-60 overflow-y-auto divide-y divide-border/40">
                  {filteredUsers.length === 0 ? (
                    <p className="p-4 text-xs text-center text-muted-foreground">
                      Tidak ada user ditemukan.
                    </p>
                  ) : (
                    filteredUsers.map((u) => {
                      const active = u.discordId === selectedDiscordId;
                      return (
                        <button
                          key={u.discordId}
                          type="button"
                          onClick={() => {
                            setSelectedDiscordId(u.discordId);
                            setDropdownOpen(false);
                          }}
                          className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2 hover:bg-muted/60 transition-colors ${
                            active ? "bg-primary/10" : ""
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-foreground truncate">
                              {u.name}
                            </p>
                            <p className="text-[10px] text-muted-foreground font-mono truncate">
                              {u.discordId}
                              {u.truckyId ? ` · #${u.truckyId}` : ""}
                            </p>
                          </div>
                          {active && <Check className="w-4 h-4 text-primary shrink-0" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Spesifikasi Voucher */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Jenis Voucher
            </label>
            <select
              value={category}
              onChange={(e) => {
                const nextCat = e.target.value;
                const nextType = nextCat === "NC_BOOSTER" ? "percentage" : discountType;
                const nextVal = nextCat === "NC_BOOSTER" ? 50 : nextCat === "FLEET_BUY" ? 25 : 25;
                const nextHrs = nextCat === "NC_BOOSTER" ? 2 : 0;
                setCategory(nextCat);
                setDiscountType(nextType);
                setDiscountValue(nextVal);
                setDurationHours(nextHrs);
                setMaxDiscount(0);
                syncTitle(nextCat, nextType, nextVal, nextHrs, 0);
              }}
              className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm font-bold"
            >
              <option value="GARAGE_RENT">Diskon Operasional Garasi</option>
              <option value="FLEET_BUY">Diskon Beli Armada</option>
              <option value="FLEET_MAINTENANCE">Diskon Servis Armada</option>
              <option value="MARKET_MOD">Diskon Mod Workshop</option>
              <option value="NC_BOOSTER">Booster NC (Bonus Pendapatan)</option>
            </select>
          </div>

          {!isBooster && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Tipe Potongan
              </label>
              <select
                value={discountType}
                onChange={(e) => {
                  const nextType = e.target.value as "percentage" | "fixed";
                  const nextVal = nextType === "fixed" ? 5000 : 25;
                  setDiscountType(nextType);
                  setDiscountValue(nextVal);
                  setMaxDiscount(0);
                  syncTitle(category, nextType, nextVal, 0, 0);
                }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm font-bold"
              >
                <option value="percentage">Persentase (%)</option>
                <option value="fixed">Nominal Tetap (NC)</option>
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {isBooster
                ? "Bonus NC (%)"
                : discountType === "fixed"
                  ? "Nominal Potongan (NC)"
                  : "Diskon (%)"}
            </label>
            <input
              type="number"
              min={1}
              max={isBooster ? 200 : discountType === "fixed" ? 500000 : 100}
              value={discountValue}
              onChange={(e) => {
                const v = Math.max(1, Number(e.target.value) || 1);
                setDiscountValue(v);
                syncTitle(category, discountType, v, durationHours, maxDiscount);
              }}
              className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm font-bold"
            />
          </div>

          {isBooster ? (
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Durasi Aktif Booster (Jam)
              </label>
              <input
                type="number"
                min={1}
                max={168}
                value={durationHours}
                onChange={(e) => {
                  const h = Math.max(1, Number(e.target.value) || 1);
                  setDurationHours(h);
                  syncTitle(category, "percentage", discountValue, h, 0);
                }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm font-bold"
              />
            </div>
          ) : discountType === "percentage" ? (
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Maks. Potongan (NC · 0 = Unlimited)
              </label>
              <input
                type="number"
                min={0}
                step={500}
                value={maxDiscount}
                onChange={(e) => {
                  const m = Math.max(0, Number(e.target.value) || 0);
                  setMaxDiscount(m);
                  syncTitle(category, discountType, discountValue, 0, m);
                }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm font-bold"
              />
            </div>
          ) : null}

          {!isBooster && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Min. Belanja (NC · 0 = Tanpa Min.)
              </label>
              <input
                type="number"
                min={0}
                step={500}
                value={minSpend}
                onChange={(e) => setMinSpend(Math.max(0, Number(e.target.value) || 0))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm font-bold"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Masa Berlaku (Hari · 0 = Permanen)
            </label>
            <input
              type="number"
              min={0}
              max={365}
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(Math.max(0, Number(e.target.value) || 0))}
              className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm font-bold"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Jumlah Voucher (1–10)
            </label>
            <input
              type="number"
              min={1}
              max={10}
              value={quantity}
              onChange={(e) =>
                setQuantity(Math.min(10, Math.max(1, Math.floor(Number(e.target.value) || 1))))
              }
              className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm font-bold"
            />
          </div>
        </div>

        {/* Judul & Alasan Wajib */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Judul Voucher
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm font-bold"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Alasan Pembuatan (Wajib untuk Audit Log) *
            </label>
            <input
              type="text"
              required
              minLength={5}
              maxLength={400}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: Testing jual beli & Buy Order Community Market"
              className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-amber-500/40 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            />
          </div>
        </div>

        {/* Flags & Live Preview */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-border/50">
          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 text-xs font-bold text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={tradable}
                onChange={(e) => setTradable(e.target.checked)}
                className="w-4 h-4 accent-primary"
              />
              Boleh dijual di Community Market (Tradable)
            </label>

            <label className="inline-flex items-center gap-2 text-xs font-bold text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={notifyRecipient}
                onChange={(e) => setNotifyRecipient(e.target.checked)}
                className="w-4 h-4 accent-primary"
              />
              Kirim notifikasi web ke penerima
            </label>
          </div>

          <button
            type="submit"
            disabled={submitting || reason.trim().length < 5 || !selectedUser}
            className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-black disabled:opacity-40 inline-flex items-center gap-2 shadow-lg shadow-amber-500/20"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Terbitkan {quantity > 1 ? `${quantity}x ` : ""}Voucher
          </button>
        </div>
      </form>

      {/* Audit Log Section */}
      <div className="rounded-2xl bg-card border border-border/70 p-6 space-y-5 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-foreground flex items-center gap-2">
              <History className="w-4 h-4 text-primary" />
              Audit Log Penerbitan Voucher Manual ({logs.length})
            </h2>
            <p className="text-xs text-muted-foreground">
              Rekam jejak permanen siapa pembuatnya, penerima, detail voucher, kode, dan alasannya.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    refreshLogs(logSearch);
                  }
                }}
                placeholder="Cari penerima, alasan, kode..."
                className="pl-8 pr-3 py-1.5 rounded-xl bg-background border border-border text-xs w-56"
              />
            </div>
            <button
              type="button"
              onClick={() => refreshLogs(logSearch)}
              className="p-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground"
              title="Muat ulang log"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {logs.length === 0 ? (
          <p className="text-xs text-muted-foreground py-8 text-center">
            Belum ada catatan penerbitan voucher manual.
          </p>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => {
              const activeCount = (log.voucherStatuses || []).filter(
                (v) => v.status === "ACTIVE"
              ).length;
              const snap = log.voucherSnapshot;
              const isPctNonBoost =
                snap.category !== "NC_BOOSTER" && snap.discountType === "percentage";

              return (
                <div
                  key={log._id}
                  className="p-4 rounded-xl bg-background/60 border border-border/60 space-y-2.5"
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-black text-foreground">
                          {log.quantity}x {snap.title}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          {
                            VOUCHER_CATEGORY_SHORT_LABELS[
                              normalizeVoucherCategoryKey(snap.category)
                            ]
                          }
                        </span>
                        {isPctNonBoost && (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                              snap.maxDiscount === 0
                                ? "bg-emerald-500/15 text-emerald-400"
                                : "bg-amber-500/15 text-amber-400"
                            }`}
                          >
                            {snap.maxDiscount === 0 && <InfinityIcon className="w-3 h-3" />}
                            {snap.maxDiscount === 0
                              ? "Unlimited"
                              : `Maks. ${snap.maxDiscount.toLocaleString("id-ID")} NC`}
                          </span>
                        )}
                        {!snap.tradable && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground inline-flex items-center gap-1">
                            <Lock className="w-3 h-3" /> Non-Tradable
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>
                          Dibuat oleh:{" "}
                          <strong className="text-amber-400">{log.actorName}</strong>{" "}
                          <span className="font-mono text-[10px]">({log.actorDiscordId})</span>
                        </span>
                        <span>→</span>
                        <span>
                          Untuk:{" "}
                          {log.recipientTruckyId ? (
                            <Link
                              href={`/profile/${log.recipientTruckyId}`}
                              className="font-bold text-foreground hover:underline"
                            >
                              {log.recipientName}
                            </Link>
                          ) : (
                            <strong className="text-foreground">{log.recipientName}</strong>
                          )}{" "}
                          <span className="font-mono text-[10px]">({log.recipientDiscordId})</span>
                        </span>
                      </div>

                      <p className="text-xs text-foreground/90 bg-muted/40 px-3 py-1.5 rounded-lg border border-border/40">
                        <strong className="text-muted-foreground">Alasan:</strong> {log.reason}
                      </p>

                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        {log.voucherCodes.map((code, idx) => {
                          const st = log.voucherStatuses?.[idx]?.status || "UNKNOWN";
                          return (
                            <span
                              key={code}
                              className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-muted/60 border border-border/60 text-foreground"
                            >
                              {code}{" "}
                              <span
                                className={
                                  st === "ACTIVE"
                                    ? "text-emerald-400"
                                    : st === "LISTED"
                                      ? "text-sky-400"
                                      : st === "USED"
                                        ? "text-amber-400"
                                        : "text-rose-400"
                                }
                              >
                                ({st})
                              </span>
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex flex-row md:flex-col items-center md:items-end justify-between gap-2 shrink-0">
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {formatWIBShort(log.createdAt)}
                      </span>
                      {activeCount > 0 ? (
                        <button
                          type="button"
                          disabled={revokingId === log._id}
                          onClick={() => handleRevoke(log)}
                          className="px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/30 text-[11px] font-bold hover:bg-rose-500/20 disabled:opacity-50 inline-flex items-center gap-1"
                        >
                          {revokingId === log._id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                          Cabut Active ({activeCount})
                        </button>
                      ) : log.revokedAt ? (
                        <span className="text-[10px] font-bold text-rose-400">
                          Dicabut oleh {log.revokedByName} ({formatWIBShort(log.revokedAt)})
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
