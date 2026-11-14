# Changelog

Semua perubahan penting pada proyek **Nismara Transport (nismara-logistics)** akan didokumentasikan dalam berkas ini.

Format berkas ini mengacu pada [Keep a Changelog](https://keepachangelog.com/id/1.0.0/) dan mematuhi [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.4.0] - 2026-11-14

### Added
- **Integrasi ETS2 Coaches DLC (Divisi Bus & Penumpang):**
  - **Coach Terminal (`/coach-terminal`):** Halaman bursa tarif tiket penumpang *real-time* untuk rute Reguler (`passengers`) dan Pariwisata (`tourist_passengers`) beserta grafik tren harga dan panduan operasional Coach.
  - **Passenger Manifest & Rute Halte (`/jobs` & `/jobs/[jobId]`):** Filter divisi (`Semua`, `Logistics`, `Coach / Bus`) pada halaman daftar pekerjaan, serta tabel rincian pemberhentian halte (*Stop-by-Stop Passenger Manifest*) di halaman detail job.
  - **Leaderboard Divisi Coach (`/leaderboard`):** Filter divisi yang secara dinamis mengalihkan kategori peringkat Tonase (`Ton`) menjadi Total Penumpang (`Pax`) saat divisi `Coach / Bus` dipilih.
  - **Statistik Penumpang & Perjalanan Bus (`/profile/[truckyId]` & `/dashboard`):** Kartu ringkasan perjalanan Coach, total penumpang terangkut (`Pax`), dan pemisahan analitik bulanan antara Divisi Truck Logistics dan Divisi Coach & Bus.
- **Sistem Pencarian, Filter & Pemantauan Servis Armada (`/dashboard/garage/fleet`):**
  - Menambahkan filter berbasis **Game** (`ETS2` vs `ATS` dengan logo resmi), **Jenis Kendaraan** (`Truck`, `Bus / Coach`, `Car / Scout`), dan **Status Servis/Penggunaan** (`Perlu Servis`, `Diservis`, `Kondisi Prima`, `Digunakan`, `Terparkir`) beserta fitur pencarian dan pengurutan prioritas servis.
  - Menampilkan *alert banner* otomatis, estimasi biaya servis, dan indikator kesehatan 4 komponen (`Mesin`, `Ban`, `Transmisi`, `Rem`) langsung pada setiap kartu kendaraan tanpa harus membuka halaman detail satu per satu.
  - Menambahkan filter Game & Jenis Kendaraan pada wizard pembelian armada baru (`/dashboard/garage/fleet/buy`) serta badge identitas di halaman detail armada (`/dashboard/garage/fleet/[id]`).

### Changed
- **Optimasi Performa `/api/notifications` & `/dashboard`:**
  - Mengubah interval polling `NotificationBell` menjadi 5 menit yang hanya aktif saat tab terlihat (*visibility-aware*) dan menambahkan sinkronisasi cache `localStorage` lintas tab.
  - Menambahkan Redis response caching (`TTL 180s`) dengan invalidasi otomatis pada `NotificationService`, compound index MongoDB `recipient_1_createdAt_-1`, serta operasi tunggal `updateMany` pada fitur *mark all as read*.
  - Mengoptimalkan halaman `/dashboard` dengan mengganti pemindaian koleksi penuh menjadi `.countDocuments()` paralel (`Promise.all`) dan membatasi auto-migration kepemilikan armada hanya untuk dokumen milik pengguna aktif.

### Fixed
- **Tooltip & Badge Nismara+ di Leaderboard:** Memperbaiki pemotongan (*clipping*) tooltip badge pada kartu podium & tabel peringkat serta menambahkan proyeksi `nismaraPlusStartedAt` agar tanggal berlangganan tampil akurat.

---

## [1.3.5] - 2026-11-13

### Added
- **Sistem Migrasi Akun Discord (Owner-Only):** Menambahkan fitur pemindahan menyeluruh data akun Discord lama (termasuk kasus akun ter-hack) ke akun Discord baru di `/dashboard/manage/data/migrate-account`, dilengkapi menu pada `/dashboard/manage/data` dan pintasan cepat per baris di `/dashboard/manage/data/users`.
  - **Live Preview & Deteksi Konflik (`/api/manage/users/migrate/preview`):** Verifikasi live profil serta status server membership melalui Discord Bot API, ringkasan data database kedua akun, dan pemblokiran otomatis jika akun target sudah tertaut di `driverlinks` ke Trucky ID berbeda.
  - **Strategi Resolusi Konflik (`override` / `merge`) (`/api/manage/users/migrate`):** Mendukung mode `override` (menimpa data awal/starter akun target) atau `merge` (menggabungkan saldo NC, poin penalti, garasi, armada, tim, Nismara+, progres Season Pass, voucher, serta riwayat).
  - **Keamanan Auth, Sync Role & Zero-Orphan Purge:** Mencabut seluruh sesi aktif (`sessions`), memindahkan binding NextAuth `accounts` dengan menjaga `users._id` kanonis, membersihkan cache Redis terkait, menyinkronkan role server Discord (Driver, Intern, Nismara+), mencatat audit trail ke `accountmigrations` & Discord `channelLog`, dan mendaftarkan `accountmigrations` ke sistem purge (`/api/manage/users/[discordId]/purge`).
- **Docker Standalone & CI/CD Coolify:** Menambahkan `Dockerfile` multi-stage berbasis Next.js standalone, `.dockerignore`, serta workflow GitHub Actions (`.github/workflows/deploy.yml`) untuk build & push image ke GHCR (`ghcr.io`) disertai pemicu webhook deploy ke Coolify.

### Changed
- **Build-Safe Database, Redis & Sitemap:** Memperbarui `lib/mongodb.ts` (lazy Proxy `clientPromise`), `lib/mongoose.ts` (validasi `MONGODB_URI` saat runtime), `lib/redis.ts` (`lazyConnect: true` saat `REDIS_URL` belum diset), dan `app/sitemap.ts` (`force-dynamic`) agar `next build` di Docker/CI berjalan aman tanpa koneksi DB/Redis build-time.
- **Dokumentasi Aturan Agent (`AGENTS.md`):** Menambahkan panduan pencegahan ketidaksesuaian tipe `ObjectId` antara BSON 6 (`mongodb`) dan BSON 7 (`mongoose`).

### Fixed
- **Kompatibilitas BSON `ObjectId` Native MongoDB:** Mengonversi `ObjectId` hasil Mongoose (BSON 7) menjadi `ObjectId` native driver `mongodb` (BSON 6) untuk mencegah error *"Unsupported BSON version, bson types must be from bson 6.x.x"* di `lib/managerSalary.ts`, `lib/giveaway.ts`, `app/dashboard/garage/page.tsx`, dan `lib/goalAchievements.ts`.
- **Workflow Deploy Coolify:** Memperbaiki pengecekan `COOLIFY_WEBHOOK_URL` dan mengembalikan metode request webhook menjadi `POST` pada `.github/workflows/deploy.yml`.

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
