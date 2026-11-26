import type { ChangelogProduct, ChangelogStatus } from "@/lib/models/ChangelogEntry";

export interface ChangelogProductMeta {
  id: ChangelogProduct;
  label: string;
  shortLabel: string;
  description: string;
  notice: string;
}

export const CHANGELOG_PRODUCTS: ChangelogProductMeta[] = [
  {
    id: "web",
    label: "Web Transport",
    shortLabel: "Web Transport",
    description:
      "Pembaruan dashboard driver, garasi, armada, pasar komunitas, dan keamanan akun di transport.nismara.web.id.",
    notice:
      "Pembaruan website diterapkan langsung secara otomatis. Jika tampilan belum berubah, silakan muat ulang halaman browser Anda.",
  },
  {
    id: "natasya",
    label: "Bot Natasya",
    shortLabel: "Bot Natasya",
    description:
      "Pembaruan bot Discord resmi Nismara Transport untuk pelacakan job otomatis, perhitungan pendapatan, perintah Discord, dan notifikasi.",
    notice:
      "Pembaruan Bot Natasya aktif langsung di server Discord Nismara Transport tanpa perlu tindakan tambahan dari driver.",
  },
  {
    id: "tracker",
    label: "Nismara Tracker",
    shortLabel: "Nismara Tracker",
    description:
      "Pembaruan aplikasi desktop Nismara Companion dan plugin telemetri in-game untuk Euro Truck Simulator 2 serta American Truck Simulator.",
    notice:
      "Aplikasi Nismara Tracker saat ini tersedia untuk peserta uji coba tertutup melalui menu Nismara Tracker di dashboard.",
  },
];

export const CHANGELOG_PRODUCT_MAP: Record<ChangelogProduct, ChangelogProductMeta> = {
  web: CHANGELOG_PRODUCTS[0],
  natasya: CHANGELOG_PRODUCTS[1],
  tracker: CHANGELOG_PRODUCTS[2],
};

export interface SerializedChangelogEntry {
  _id: string;
  product: ChangelogProduct;
  version: string;
  title: string;
  summary: string;
  releaseDate: string;
  status: ChangelogStatus;
  sections: {
    added: string[];
    improved: string[];
    fixed: string[];
  };
  articleUrl?: string | null;
  highlightFeatureUrl?: string | null;
  highlightFeatureLabel?: string | null;
  publishedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export function isValidChangelogProduct(val: unknown): val is ChangelogProduct {
  return val === "web" || val === "natasya" || val === "tracker";
}

export function normalizeVersion(raw: string): string {
  return String(raw || "")
    .trim()
    .replace(/^v/i, "")
    .replace(/\s+/g, "");
}

export function isValidVersionFormat(raw: string): boolean {
  const clean = normalizeVersion(raw);
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(clean);
}

/**
 * Membandingkan dua string SemVer secara descending (versi lebih baru di atas).
 * Contoh: "1.10.0" > "1.9.0" > "1.5.2" > "1.5.1".
 */
export function compareSemverDesc(versionA: string, versionB: string): number {
  const parse = (v: string) => {
    const clean = normalizeVersion(v);
    const [core, pre = ""] = clean.split("-");
    const parts = core.split(".").map((n) => parseInt(n, 10) || 0);
    return {
      major: parts[0] || 0,
      minor: parts[1] || 0,
      patch: parts[2] || 0,
      pre,
    };
  };

  const a = parse(versionA);
  const b = parse(versionB);

  if (a.major !== b.major) return b.major - a.major;
  if (a.minor !== b.minor) return b.minor - a.minor;
  if (a.patch !== b.patch) return b.patch - a.patch;

  // Rilis stabil (tanpa pre-release) lebih tinggi dari pre-release pada nomor sama
  if (!a.pre && b.pre) return -1;
  if (a.pre && !b.pre) return 1;
  return b.pre.localeCompare(a.pre);
}

export function sortChangelogEntriesDesc<
  T extends { releaseDate: string | Date; version: string },
>(entries: T[]): T[] {
  return [...entries].sort((a, b) => {
    const verDiff = compareSemverDesc(a.version, b.version);
    if (verDiff !== 0) return verDiff;
    return new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime();
  });
}

export function formatChangelogDateWIB(dateInput: string | Date): string {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function buildReleaseCountSentence(sections: {
  added: string[];
  improved: string[];
  fixed: string[];
}): string {
  const parts: string[] = [];
  if (sections.added.length > 0) parts.push(`${sections.added.length} fitur baru`);
  if (sections.improved.length > 0) parts.push(`${sections.improved.length} peningkatan`);
  if (sections.fixed.length > 0) parts.push(`${sections.fixed.length} perbaikan`);
  if (parts.length === 0) return "";
  if (parts.length === 1) return `Rilis ini mencakup ${parts[0]}.`;
  if (parts.length === 2) return `Rilis ini mencakup ${parts[0]} dan ${parts[1]}.`;
  return `Rilis ini mencakup ${parts[0]}, ${parts[1]}, dan ${parts[2]}.`;
}

export function formatChangelogToMarkdown(
  product: ChangelogProduct,
  entries: SerializedChangelogEntry[]
): string {
  const meta = CHANGELOG_PRODUCT_MAP[product];
  const lines: string[] = [
    `# Catatan Perubahan ${meta.label} - Nismara Transport`,
    "",
    meta.description,
    "",
  ];

  for (const entry of entries) {
    lines.push(`## v${entry.version} (${formatChangelogDateWIB(entry.releaseDate)})`);
    lines.push(`**${entry.title}**`);
    lines.push("");
    lines.push(entry.summary);
    lines.push("");

    if (entry.sections.added.length > 0) {
      lines.push("### Fitur Baru");
      for (const item of entry.sections.added) lines.push(`- ${item}`);
      lines.push("");
    }
    if (entry.sections.improved.length > 0) {
      lines.push("### Peningkatan");
      for (const item of entry.sections.improved) lines.push(`- ${item}`);
      lines.push("");
    }
    if (entry.sections.fixed.length > 0) {
      lines.push("### Perbaikan");
      for (const item of entry.sections.fixed) lines.push(`- ${item}`);
      lines.push("");
    }

    lines.push("---");
    lines.push("");
  }

  return lines.join("\n").trim();
}

export interface ChangelogSeedItem {
  product: ChangelogProduct;
  version: string;
  title: string;
  summary: string;
  releaseDate: string;
  status: ChangelogStatus;
  sections: {
    added: string[];
    improved: string[];
    fixed: string[];
  };
  highlightFeatureUrl?: string | null;
  highlightFeatureLabel?: string | null;
}

/**
 * Riwayat awal dalam bahasa non-teknis untuk tombol "Impor Riwayat Awal" di panel Owner.
 */
export const INITIAL_CHANGELOG_SEEDS: ChangelogSeedItem[] = [
  // ======================== WEB TRANSPORT ========================
  {
    product: "web",
    version: "1.5.2",
    title: "Perbaikan Transaksi Pembelian di Community Market",
    summary:
      "Kami memperbaiki kendala yang sempat muncul ketika driver membeli tiket penghapus penalti atau voucher di Community Market agar transaksi kembali lancar.",
    releaseDate: "2026-11-26T14:30:00+07:00",
    status: "published",
    sections: {
      added: [],
      improved: [],
      fixed: [
        "Memperbaiki pesan galat saat driver membeli iklan voucher atau tiket penghapus penalti di Community Market.",
        "Memperbaiki proses pemenuhan Buy Order agar transaksi jual beli langsung terselesaikan dengan aman.",
      ],
    },
    highlightFeatureUrl: "/community-market",
    highlightFeatureLabel: "Buka Community Market",
  },
  {
    product: "web",
    version: "1.5.1",
    title: "Perlindungan Sesi Login dan Halaman Keamanan Akun",
    summary:
      "Pembaruan ini memperkuat keamanan login akun seluruh driver dan menambahkan menu baru di Pengaturan supaya kamu bisa memantau serta mengeluarkan perangkat yang sedang masuk.",
    releaseDate: "2026-11-26T06:50:00+07:00",
    status: "published",
    sections: {
      added: [
        "Tab baru Keamanan dan Sesi di menu Pengaturan untuk melihat perangkat yang sedang login lengkap dengan jenis browser, negara akses, IP tersamar, dan waktu aktif terakhir.",
        "Tombol keluar per perangkat, keluar semua perangkat lain, dan keluar semua perangkat sekaligus di halaman Pengaturan.",
        "Perlindungan otomatis yang memutus sesi login dan mengirim peringatan Discord apabila sesi akun terdeteksi dipakai dari perangkat atau browser berbeda.",
        "Bantuan cepat bagi pengurus untuk memutus seluruh sesi login akun yang dilaporkan bermasalah.",
      ],
      improved: [
        "Driver reguler yang memakai internet ber-IP dinamis maupun VPN tetap aman beraktivitas tanpa menerima spam pesan peringatan pindah lokasi.",
        "Akun pengurus memiliki perlindungan tambahan berupa pemeriksaan perpindahan negara otomatis dan batas login ulang setiap 48 jam.",
        "Sistem tidak lagi menyimpan data akses login yang tidak diperlukan serta menambah lapisan perlindungan browser.",
      ],
      fixed: [
        "Merapikan stabilitas pembaruan server website di balik layar agar rilis fitur ke depan berjalan lebih lancar.",
      ],
    },
    highlightFeatureUrl: "/dashboard/settings?tab=security",
    highlightFeatureLabel: "Buka Keamanan & Sesi",
  },
  {
    product: "web",
    version: "1.5.0",
    title: "Community Market P2P, Servis Armada Lebih Fleksibel, dan Rewind 2026",
    summary:
      "Rilis besar yang membuka bursa jual beli antar driver untuk voucher dan tiket penalti, mempermudah servis armada lebih awal, serta menghadirkan halaman Nismara Rewind 2026.",
    releaseDate: "2026-11-25T16:40:00+07:00",
    status: "published",
    sections: {
      added: [
        "Community Market P2P agar driver bisa menjual voucher maupun tiket penghapus penalti, membuat permintaan beli dengan jaminan saldo aman, serta memberi ulasan penjual.",
        "Tarif pasang iklan gratis di Community Market bagi anggota Nismara+ aktif dan Discord Server Booster, plus tombol Jual 1-Klik dari halaman Voucher dan Garasi.",
        "Voucher Operasional Garasi untuk potongan hingga bebas biaya sewa garasi bulanan berikutnya.",
        "Fitur Servis Rutin Lebih Awal dan Ganti Komponen Lebih Awal saat pemakaian mencapai 50 persen, sekaligus menggabungkan beberapa komponen dalam satu tiket servis.",
        "Halaman Nismara Rewind 2026 lengkap dengan kartu ringkasan perjalanan, tema musiman liburan, kartu Driving Score, dan halaman Statistik Publik.",
        "Fitur Pembekuan Akun 90 Hari untuk driver yang sedang berhalangan aktif agar tagihan garasi ikut terhenti sementara.",
      ],
      improved: [
        "Penyesuaian ekonomi armada untuk harga pembelian truk dan mobil serta tarif penggantian komponen agar lebih seimbang dengan pendapatan perjalanan.",
        "Rincian halaman detail pekerjaan kini menampilkan potongan bagi hasil pemilik armada secara transparan.",
        "Menu Market di navigasi utama kini merangkum Mod Workshop, Community Market, dan Fuel Market di satu tempat.",
      ],
      fixed: [
        "Memperbaiki perhitungan jarak batas servis pada pembelian armada baru.",
        "Memastikan komponen dengan keausan penuh otomatis masuk mode ganti baru serta menyelaraskan jadwal perawatan garasi.",
      ],
    },
    highlightFeatureUrl: "/community-market",
    highlightFeatureLabel: "Jelajahi Community Market",
  },
  {
    product: "web",
    version: "1.4.0",
    title: "Dukungan Divisi Bus Coach dan Filter Armada Garasi",
    summary:
      "Driver kini bisa memantau tarif tiket penumpang bus, melihat daftar halte perjalanan di halaman pekerjaan, dan menyaring kondisi armada langsung dari daftar garasi.",
    releaseDate: "2026-11-14T18:00:00+07:00",
    status: "published",
    sections: {
      added: [
        "Halaman Coach Terminal untuk melihat tren tarif tiket penumpang rute reguler dan pariwisata beserta panduan operasional divisi bus.",
        "Filter divisi Logistics dan Coach di halaman daftar pekerjaan, tabel rincian pemberhentian halte, serta papan peringkat khusus penumpang untuk divisi bus.",
        "Filter pencarian armada berdasarkan game ETS2 atau ATS, jenis kendaraan, dan status servis langsung di halaman Garasi.",
        "Indikator kesehatan mesin, ban, transmisi, dan rem langsung pada kartu kendaraan tanpa perlu membuka detail satu per satu.",
      ],
      improved: [
        "Halaman dashboard dan lonceng notifikasi kini dimuat lebih ringan serta lebih hemat kuota saat tab tidak sedang dibuka.",
      ],
      fixed: [
        "Memperbaiki tampilan lencana Nismara+ yang sebelumnya sempat terpotong di papan peringkat dan menampilkan tanggal berlangganan lebih akurat.",
      ],
    },
    highlightFeatureUrl: "/coach-terminal",
    highlightFeatureLabel: "Buka Coach Terminal",
  },
  {
    product: "web",
    version: "1.3.5",
    title: "Sistem Pemindahan Akun Discord Aman untuk Kasus Darurat",
    summary:
      "Menambahkan layanan resmi untuk memindahkan seluruh aset dan riwayat driver ke akun Discord baru apabila akun lama mengalami peretasan atau kendala akses.",
    releaseDate: "2026-11-13T15:00:00+07:00",
    status: "published",
    sections: {
      added: [
        "Layanan migrasi akun Discord menyeluruh yang dapat memindahkan saldo, garasi, armada, tim, langganan Nismara+, progres Season Pass, dan voucher ke akun baru dengan aman.",
      ],
      improved: [
        "Penyesuaian infrastruktur server website agar proses rilis pembaruan berjalan lebih cepat dan stabil.",
      ],
      fixed: [
        "Memperbaiki kendala pemuatan data di halaman Garasi, Giveaway, Pencapaian, dan Gaji Pengurus.",
      ],
    },
  },
  {
    product: "web",
    version: "1.3.4",
    title: "Peluncuran Nismara Tracker Hub dan Perbaikan Tagihan Garasi",
    summary:
      "Halaman khusus peserta uji coba Nismara Tracker resmi hadir, disertai perbaikan stabilitas garasi dan penghentian pesan tagihan berulang.",
    releaseDate: "2026-11-09T14:00:00+07:00",
    status: "published",
    sections: {
      added: [
        "Halaman Nismara Tracker untuk mengunduh aplikasi pendamping dan mengelola token telemetri khusus peserta uji coba tertutup.",
      ],
      improved: [
        "Tampilan detail data driver pada layar ponsel kini lebih rapi saat data peringkat belum terisi.",
      ],
      fixed: [
        "Memperbaiki kendala halaman Garasi yang sebelumnya sempat gagal dibuka pada sebagian akun driver.",
        "Menghentikan pesan pengingat sewa garasi berulang pada garasi yang berstatus dibekukan serta merapikan tanggal jatuh tempo sewa.",
      ],
    },
  },
  {
    product: "web",
    version: "1.3.3",
    title: "Tema Musiman Halloween, Pendaftaran HaulMP, dan Armada Mobil",
    summary:
      "Menyambut musim Halloween dengan tampilan spesial di dashboard serta membuka pendaftaran integrasi HaulMP dan kategori armada mobil.",
    releaseDate: "2026-10-31T12:00:00+07:00",
    status: "published",
    sections: {
      added: [
        "Dekorasi tema musiman Halloween pada tampilan dashboard.",
        "Formulir pendaftaran dan sinkronisasi driver untuk platform HaulMP.",
        "Dukungan kategori kendaraan mobil pada katalog dan daftar armada.",
      ],
      improved: [],
      fixed: [],
    },
  },

  // ======================== BOT NATASYA ========================
  {
    product: "natasya",
    version: "1.5.0",
    title: "Bagi Hasil Pemilik Armada, Driving Score, dan Laju Keausan Baru",
    summary:
      "Bot Natasya kini menghitung bagi hasil otomatis untuk pemilik armada sewa maupun perusahaan, menilai Driving Score setiap perjalanan, dan memakai laju keausan komponen yang lebih realistis.",
    releaseDate: "2026-11-25T16:30:00+07:00",
    status: "published",
    sections: {
      added: [
        "Perhitungan bagi hasil pemilik armada sebesar 25 persen untuk armada sewa dan 20 persen untuk armada perusahaan yang tercatat jelas di pesan Discord dan dokumen manifest PDF.",
        "Penilaian otomatis Driving Score di setiap perjalanan selesai serta dukungan event bonus bertingkat dan Special Contract divisi bus.",
        "Perintah khusus pengurus untuk menutup channel kategori tertentu dengan tombol konfirmasi aman.",
      ],
      improved: [
        "Laju keausan ban, rem, mesin, dan transmisi disesuaikan agar selaras dengan jadwal servis rutin armada.",
        "Penyelarasan otomatis status pembekuan akun 90 hari agar data driver tetap terjaga selama izin panjang.",
      ],
      fixed: [
        "Memperbaiki kendala pengiriman pesan DM laporan pemakaian BBM dari tangki garasi.",
        "Memastikan status butuh servis langsung aktif saat keausan komponen mencapai 100 persen.",
      ],
    },
  },
  {
    product: "natasya",
    version: "1.4.0",
    title: "Pelacakan Perjalanan Bus Coach dan Manifest Penumpang PDF",
    summary:
      "Bot Natasya sekarang mendukung penuh divisi bus beserta catatan jumlah penumpang di setiap halte dan dokumen manifest perjalanan khusus penumpang.",
    releaseDate: "2026-11-14T18:00:00+07:00",
    status: "published",
    sections: {
      added: [
        "Deteksi otomatis perjalanan bus reguler dan pariwisata lengkap dengan catatan jumlah penumpang naik dan turun di tiap halte.",
        "Pembaruan harga tiket penumpang berkala untuk rute reguler dan pariwisata.",
        "Dokumen PDF Manifest Penumpang dan surat tugas perjalanan khusus divisi bus saat perjalanan dimulai dan selesai.",
        "Tampilan jumlah penumpang dan halte pemberhentian pada pesan Discord serta perintah cek pekerjaan.",
      ],
      improved: [
        "Perhitungan pendapatan dan penalti divisi bus disesuaikan dengan tarif pasar tiket penumpang.",
      ],
      fixed: [],
    },
  },
  {
    product: "natasya",
    version: "1.3.3",
    title: "Integrasi Penuh Pencatatan Perjalanan HaulMP",
    summary:
      "Perjalanan yang diselesaikan melalui platform HaulMP kini otomatis divalidasi, dihitung pendapatannya, dan dicatat ke riwayat driver oleh Bot Natasya.",
    releaseDate: "2026-10-22T12:00:00+07:00",
    status: "published",
    sections: {
      added: [
        "Dukungan validasi perjalanan, perhitungan pendapatan dan biaya operasional, serta pencatatan riwayat pekerjaan dari platform HaulMP.",
      ],
      improved: [],
      fixed: [],
    },
  },

  // ======================== NISMARA TRACKER ========================
  {
    product: "tracker",
    version: "1.0.0",
    title: "Rilis Uji Coba Tertutup Nismara Companion dan Plugin Telemetri",
    summary:
      "Versi perdana aplikasi pendamping Nismara Companion untuk menghubungkan data perjalanan ETS2 dan ATS secara langsung dengan akun Nismara Transport.",
    releaseDate: "2026-11-09T14:00:00+07:00",
    status: "published",
    sections: {
      added: [
        "Aplikasi desktop Nismara Companion untuk Windows, Linux, dan macOS beserta plugin telemetri in-game.",
        "Penghubungan akun cepat menggunakan token pribadi dari halaman Nismara Tracker di dashboard.",
        "Pelaporan data perjalanan secara langsung ke sistem Nismara Transport selama masa uji coba tertutup.",
      ],
      improved: [],
      fixed: [],
    },
  },
];
