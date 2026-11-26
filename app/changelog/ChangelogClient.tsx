"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  ChevronDown,
  ChevronsUpDown,
  ChevronsDownUp,
  Info,
  Copy,
  Check,
  ExternalLink,
  ArrowUpRight,
  Settings2,
  Sparkles,
  Wrench,
  TrendingUp,
} from "lucide-react";
import type { ChangelogProduct } from "@/lib/models/ChangelogEntry";
import {
  CHANGELOG_PRODUCTS,
  CHANGELOG_PRODUCT_MAP,
  buildReleaseCountSentence,
  formatChangelogDateWIB,
  formatChangelogToMarkdown,
  type SerializedChangelogEntry,
} from "@/lib/changelog";

type SectionKey = "added" | "improved" | "fixed";

const SECTION_META: Record<
  SectionKey,
  { label: string; dotClass: string; icon: typeof Sparkles }
> = {
  added: {
    label: "Fitur Baru",
    dotClass: "bg-emerald-400",
    icon: Sparkles,
  },
  improved: {
    label: "Peningkatan",
    dotClass: "bg-sky-400",
    icon: TrendingUp,
  },
  fixed: {
    label: "Perbaikan",
    dotClass: "bg-amber-400",
    icon: Wrench,
  },
};

export default function ChangelogClient({
  initialTab,
  entriesByProduct,
  isOwner,
}: {
  initialTab: ChangelogProduct;
  entriesByProduct: Record<ChangelogProduct, SerializedChangelogEntry[]>;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ChangelogProduct>(initialTab);
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [activeAnchor, setActiveAnchor] = useState<string>("");

  // Sync state ketika searchParams berubah lewat navigasi URL
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const entries = useMemo(
    () => entriesByProduct[activeTab] || [],
    [entriesByProduct, activeTab]
  );

  // Buka kategori pada rilis terbaru secara default tiap ganti tab
  useEffect(() => {
    const defaults: Record<string, boolean> = {};
    if (entries[0]) {
      const latest = entries[0];
      defaults[`${latest._id}:added`] = true;
      defaults[`${latest._id}:improved`] = true;
      defaults[`${latest._id}:fixed`] = true;
      setActiveAnchor(`v${latest.version}`);
    } else {
      setActiveAnchor("");
    }
    setOpenSections(defaults);
  }, [activeTab, entries]);

  // Scroll spy untuk panel kanan "Di halaman ini"
  useEffect(() => {
    if (entries.length === 0) return;

    const elements = entries
      .map((e) => document.getElementById(`v${e.version}`))
      .filter((el): el is HTMLElement => Boolean(el));

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (observed) => {
        const visible = observed
          .filter((item) => item.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target?.id) {
          setActiveAnchor(visible[0].target.id);
        }
      },
      {
        rootMargin: "-110px 0px -65% 0px",
        threshold: 0,
      }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [entries]);

  const allSectionKeys = useMemo(() => {
    const keys: string[] = [];
    for (const entry of entries) {
      (["added", "improved", "fixed"] as SectionKey[]).forEach((sec) => {
        if (entry.sections[sec].length > 0) {
          keys.push(`${entry._id}:${sec}`);
        }
      });
    }
    return keys;
  }, [entries]);

  const isAllExpanded =
    allSectionKeys.length > 0 && allSectionKeys.every((k) => Boolean(openSections[k]));

  const handleToggleAll = () => {
    if (isAllExpanded) {
      setOpenSections({});
    } else {
      const next: Record<string, boolean> = {};
      for (const k of allSectionKeys) {
        next[k] = true;
      }
      setOpenSections(next);
    }
  };

  const handleToggleSection = (entryId: string, sec: SectionKey) => {
    const key = `${entryId}:${sec}`;
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSwitchTab = (product: ChangelogProduct) => {
    setActiveTab(product);
    router.replace(`/changelog?tab=${product}`, { scroll: false });
  };

  const handleCopyMarkdown = async () => {
    try {
      const md = formatChangelogToMarkdown(activeTab, entries);
      await navigator.clipboard.writeText(md);
      setCopiedMarkdown(true);
      setTimeout(() => setCopiedMarkdown(false), 2000);
    } catch {
      // Clipboard fallback tidak fatal
    }
  };

  const handleJumpToVersion = (anchorId: string) => {
    setActiveAnchor(anchorId);
    const el = document.getElementById(anchorId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", `#${anchorId}`);
      }
    }
  };

  const activeProductMeta = CHANGELOG_PRODUCT_MAP[activeTab];

  return (
    <div className="min-h-screen bg-background pt-28 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col xl:flex-row gap-10 xl:gap-12">
          {/* KOLOM UTAMA (HEADER + TABS + TIMELINE) */}
          <div className="flex-1 min-w-0">
            {/* Breadcrumb & Quick Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <nav
                aria-label="Breadcrumb"
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
              >
                <Link href="/" className="hover:text-foreground transition-colors">
                  Beranda
                </Link>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                <span className="text-foreground">Catatan Perubahan</span>
              </nav>

              <div className="flex items-center gap-2">
                {entries.length > 0 && (
                  <button
                    type="button"
                    onClick={handleCopyMarkdown}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card/70 hover:bg-card text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    {copiedMarkdown ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Markdown Tersalin</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Salin Markdown</span>
                      </>
                    )}
                  </button>
                )}

                {isOwner && (
                  <Link
                    href="/dashboard/manage/changelog"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/20 text-xs font-semibold text-primary transition-colors"
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                    <span>Kelola Changelog</span>
                  </Link>
                )}
              </div>
            </div>

            {/* Heading */}
            <div className="space-y-3 mb-8">
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
                Catatan Perubahan
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-2xl">
                Lacak fitur baru, peningkatan, dan perbaikan di seluruh layanan Nismara
                Transport, termasuk Web Transport, Bot Natasya, dan Nismara Tracker.
              </p>
            </div>

            {/* Underline Product Tabs (Antigravity Style) */}
            <div
              role="tablist"
              aria-label="Produk Nismara Transport"
              className="flex items-center gap-6 border-b border-border overflow-x-auto no-scrollbar mb-6"
            >
              {CHANGELOG_PRODUCTS.map((prod) => {
                const isSelected = activeTab === prod.id;
                const count = (entriesByProduct[prod.id] || []).length;
                return (
                  <button
                    key={prod.id}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => handleSwitchTab(prod.id)}
                    className={`relative pb-3 text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-2 ${
                      isSelected
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground/80"
                    }`}
                  >
                    <span>{prod.label}</span>
                    {count > 0 && (
                      <span
                        className={`text-[11px] px-1.5 py-0.5 rounded-md tabular-nums ${
                          isSelected
                            ? "bg-primary/15 text-primary"
                            : "bg-muted/60 text-muted-foreground"
                        }`}
                      >
                        {count}
                      </span>
                    )}
                    {isSelected && (
                      <span className="absolute left-0 right-0 bottom-0 h-0.5 bg-primary rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Notice Bar + Expand All Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-10">
              <div className="flex items-start sm:items-center gap-2 text-xs text-muted-foreground">
                <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5 sm:mt-0" />
                <span>{activeProductMeta.notice}</span>
              </div>

              {allSectionKeys.length > 0 && (
                <button
                  type="button"
                  onClick={handleToggleAll}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card/60 hover:bg-card text-xs font-medium text-muted-foreground hover:text-foreground transition-colors shrink-0 self-start sm:self-auto cursor-pointer"
                >
                  {isAllExpanded ? (
                    <>
                      <ChevronsDownUp className="w-3.5 h-3.5" />
                      <span>Ciutkan semua</span>
                    </>
                  ) : (
                    <>
                      <ChevronsUpDown className="w-3.5 h-3.5" />
                      <span>Luaskan semua</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Empty State */}
            {entries.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card/50 p-10 text-center space-y-3">
                <p className="text-base font-semibold text-foreground">
                  Belum ada catatan perubahan untuk {activeProductMeta.label}
                </p>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Pembaruan terbaru untuk produk ini akan segera ditampilkan di sini begitu
                  rilis berikutnya diterbitkan.
                </p>
                {isOwner && (
                  <div className="pt-2">
                    <Link
                      href="/dashboard/manage/changelog"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
                    >
                      <Settings2 className="w-3.5 h-3.5" />
                      <span>Tambah atau Impor Riwayat di Dashboard</span>
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              /* Release Timeline List */
              <div className="space-y-10">
                {entries.map((entry, idx) => {
                  const anchorId = `v${entry.version}`;
                  const isLatest = idx === 0;
                  const countSentence = buildReleaseCountSentence(entry.sections);
                  const availableSections = (["added", "improved", "fixed"] as SectionKey[]).filter(
                    (sec) => entry.sections[sec].length > 0
                  );

                  return (
                    <article
                      key={entry._id}
                      id={anchorId}
                      className="scroll-mt-28 flex flex-col md:flex-row gap-4 md:gap-8"
                    >
                      {/* Kolom Kiri: Versi + TERBARU + Tanggal WIB */}
                      <div className="md:w-40 shrink-0 md:pt-1">
                        <div className="md:sticky md:top-28 flex md:flex-col items-center md:items-start gap-2.5 md:gap-1.5">
                          <div className="flex items-center gap-2">
                            <a
                              href={`#${anchorId}`}
                              onClick={(e) => {
                                e.preventDefault();
                                handleJumpToVersion(anchorId);
                              }}
                              className="text-sm font-bold text-foreground hover:text-primary transition-colors tabular-nums"
                            >
                              v{entry.version}
                            </a>
                            {isLatest && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-sky-500/15 border border-sky-500/30 text-[10px] font-bold tracking-wider text-sky-400 uppercase">
                                TERBARU
                              </span>
                            )}
                          </div>
                          <time
                            dateTime={entry.releaseDate}
                            className="text-xs text-muted-foreground"
                          >
                            {formatChangelogDateWIB(entry.releaseDate)}
                          </time>
                        </div>
                      </div>

                      {/* Kolom Tengah: Kartu Rilis */}
                      <div className="flex-1 min-w-0 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-sm p-5 sm:p-6 space-y-5 shadow-sm">
                        <div className="space-y-2.5">
                          <h2 className="text-lg sm:text-xl font-bold text-foreground tracking-tight leading-snug">
                            {entry.title}
                          </h2>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {entry.summary}
                            {countSentence ? ` ${countSentence}` : ""}
                          </p>

                          {(entry.highlightFeatureUrl || entry.articleUrl) && (
                            <div className="flex flex-wrap items-center gap-2.5 pt-1">
                              {entry.highlightFeatureUrl && (
                                <Link
                                  href={entry.highlightFeatureUrl}
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                                >
                                  <span>
                                    {entry.highlightFeatureLabel || "Lihat Fitur Terkait"}
                                  </span>
                                  <ArrowUpRight className="w-3.5 h-3.5" />
                                </Link>
                              )}
                              {entry.articleUrl && (
                                <a
                                  href={entry.articleUrl}
                                  target={
                                    entry.articleUrl.startsWith("http") ? "_blank" : undefined
                                  }
                                  rel={
                                    entry.articleUrl.startsWith("http")
                                      ? "noopener noreferrer"
                                      : undefined
                                  }
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  <span>Baca artikel lengkap</span>
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Collapsible Accordions per Kategori */}
                        {availableSections.length > 0 && (
                          <div className="space-y-2.5">
                            {availableSections.map((sec) => {
                              const items = entry.sections[sec];
                              const meta = SECTION_META[sec];
                              const key = `${entry._id}:${sec}`;
                              const isOpen = Boolean(openSections[key]);

                              return (
                                <div
                                  key={sec}
                                  className="rounded-xl border border-border/70 bg-background/50 overflow-hidden transition-colors"
                                >
                                  <button
                                    type="button"
                                    onClick={() => handleToggleSection(entry._id, sec)}
                                    aria-expanded={isOpen}
                                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors cursor-pointer"
                                  >
                                    <span className="flex items-center gap-2.5 text-sm font-semibold text-foreground">
                                      <span
                                        className={`w-2 h-2 rounded-full ${meta.dotClass}`}
                                      />
                                      <span>{meta.label}</span>
                                      <span className="text-xs font-normal text-muted-foreground tabular-nums">
                                        ({items.length})
                                      </span>
                                    </span>
                                    <ChevronDown
                                      className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
                                        isOpen ? "rotate-180" : ""
                                      }`}
                                    />
                                  </button>

                                  {isOpen && (
                                    <div className="px-4 pb-4 pt-1 border-t border-border/50">
                                      <ul className="space-y-2.5 pt-2">
                                        {items.map((text, itemIdx) => (
                                          <li
                                            key={itemIdx}
                                            className="flex items-start gap-2.5 text-sm text-foreground/85 leading-relaxed"
                                          >
                                            <span className="mt-2 w-1.5 h-1.5 rounded-full bg-muted-foreground/60 shrink-0" />
                                            <span>{text}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          {/* KOLOM KANAN STICKY: DI HALAMAN INI */}
          {entries.length > 0 && (
            <aside className="hidden xl:block w-52 shrink-0">
              <div className="sticky top-28">
                <p className="text-xs font-semibold text-foreground mb-3">Di halaman ini</p>
                <nav
                  aria-label="Daftar versi di halaman ini"
                  className="border-l border-border space-y-0.5 max-h-[calc(100vh-11rem)] overflow-y-auto pr-2"
                >
                  {entries.map((entry) => {
                    const anchorId = `v${entry.version}`;
                    const isCurrent = activeAnchor === anchorId;
                    return (
                      <button
                        key={entry._id}
                        type="button"
                        onClick={() => handleJumpToVersion(anchorId)}
                        className={`block w-full text-left pl-3.5 py-1.5 -ml-px border-l-2 text-xs transition-colors tabular-nums cursor-pointer ${
                          isCurrent
                            ? "border-primary text-primary font-semibold"
                            : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                        }`}
                      >
                        v{entry.version}
                      </button>
                    );
                  })}
                </nav>
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
