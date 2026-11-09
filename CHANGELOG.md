# Changelog

Semua perubahan penting pada proyek **Nismara Transport (nismara-logistics)** akan didokumentasikan dalam berkas ini.

Format berkas ini mengacu pada [Keep a Changelog](https://keepachangelog.com/id/1.0.0/) dan mematuhi [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.3.4] - 2026-11-09

### Added
- **Nismara Tracker Companion Hub:** Menambahkan halaman `/dashboard/tracker` untuk download launcher/plugin (Windows `.exe`, `.msi`, `.dll`, Linux `.AppImage`) serta manajemen token in-game telemetry.
- **Closed Beta Tester Flag (`test_participation`):** Proteksi akses khusus peserta uji coba pada halaman `/dashboard/tracker`, navigasi sidebar, settings, dan API telemetry (`/api/tracker/me`).
- **Skema Pengguna:** Menambahkan field `test_participation` pada model pengguna Mongoose dan NextAuth session cache.

### Fixed
- **Dashboard Garasi Crash:** Memperbaiki Server Component crash (*"Kerusakan Mesin!"*) saat membuka `/dashboard/garage` pada akun driver tertentu akibat inkonsistensi skema Mongoose.
- **Skema `$setOnInsert`:** Memperbaiki operasi upsert MongoDB di berbagai fitur (Nismara+, Poin Penalti, Kupon, Survei, Giveaway, dan Gaji Manajer) agar tidak meninggalkan dokumen parsial.
- **Mekanisme Auto-Healing Garasi:** Menambahkan sinkronisasi otomatis field `userId`, status operasional, dan array mekanik jika ditemukan dokumen garasi lama yang belum lengkap.
- **Sistem Sewa Garasi (Billing & Cron):**
  - Menghentikan pengiriman pesan tagihan berulang (infinite loop DM Discord) pada akun dengan garasi berstatus `suspended`.
  - Memperbaiki perhitungan tanggal jatuh tempo sewa berikutnya (`next_payment_date`) agar tidak mengalami pergeseran waktu (*drift*).
- **Integrasi API Trucky (HTTP 403 Forbidden):** Mengganti User-Agent pada koneksi Trucky API dengan identitas resmi Nismara Transport guna mencegah pemblokiran Cloudflare WAF.
- **Detail User Manajemen Driver:** Menambahkan safe fallbacks pada halaman `/dashboard/manage/data/users/[truckyId]` untuk mencegah error *"Cannot read properties of null (reading 'rank')"* di layar mobile ketika data rank belum terisi.
- **Driver Access Gate:** Memperketat akses halaman tracker agar hanya dapat diakses oleh akun pengemudi resmi yang memiliki `driverData` aktif (`DriverAccessBlocker`).

---

## [1.3.3] - 2026-10-31

### Added
- **Seasonal Theme:** Penambahan aset dan tema musiman Halloween pada antarmuka dashboard.
- **Integrasi HaulMP:** Penambahan formulir pendaftaran dan sinkronisasi driver HaulMP.
- **Armada Mobil (Cars Type):** Dukungan kategori tipe mobil pada katalog dan manajemen armada (*fleets*).

### Changed
- Optimalisasi skrip prebuild untuk pembersihan cache dev types Next.js.

---

## [1.3.2] - 2026-10-16

### Added
- **Season Pass System:** Fitur Season Pass berjenjang dengan sistem klaim reward mingguan/bulanan.
- **Fleet Store & Maintenance:** Peningkatan alur transaksi pembelian armada dan sistem perbaikan truk.

### Fixed
- Penanganan race condition pada mutasi saldo Nismara Coin (NC).

---

## [1.3.1] - 2026-09-20

### Added
- Integrasi bot protection Cloudflare Turnstile pada formulir publik.
- Dukungan kompresi gambar WebP dan pembersihan otomatis file di Cloudflare R2.

---

## [1.3.0] - 2026-08-30

### Added
- Peluncuran sistem Ekonomi Nismara: Fuel Market, Cargo Market, dan integrasi Discord bot.
- Sistem Penalti Poin terpusat beserta histori transaksi pengemudi.
