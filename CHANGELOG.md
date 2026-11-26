# Changelog

Semua perubahan penting pada proyek **Nismara Transport (nismara-logistics)** akan didokumentasikan dalam berkas ini.

Format berkas ini mengacu pada [Keep a Changelog](https://keepachangelog.com/id/1.0.0/) dan mematuhi [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.5.3] - 2026-11-26

### Added
- **Dynamic Multi-Product Changelog Hub (`/changelog` & `/dashboard/manage/changelog`):**
  - Halaman publik `/changelog` bergaya timeline dengan tab multi-produk (**Web Transport**, **Bot Natasya**, **Nismara Tracker**), tombol **Salin Markdown**, kontrol **Luaskan semua / Ciutkan semua**, accordion kategori (*Fitur Baru*, *Peningkatan*, *Perbaikan*), panel kanan sticky **Di halaman ini** (*scroll spy*), serta metadata SEO/OpenGraph dan entri `app/sitemap.ts`.
  - Panel CMS khusus **Web Owner** (`/dashboard/manage/changelog`) dengan tabel padat, pagination (`10 / 20 / 50`), slide-over drawer editor + pratinjau langsung, toggle Draft/Published, serta tombol **Impor Riwayat Awal** idempoten berbahasa non-teknis.
  - Integrasi tautan **Catatan Perubahan** dan pill versi (`v{pkg.version}`) pada `components/Footer.tsx`, shortcut khusus Owner di `app/dashboard/manage/page.tsx`, serta anonimisasi `authorDiscordId` / `updatedByDiscordId` pada endpoint purge user (`/api/manage/users/[discordId]/purge`).
- **Quest Mingguan Nismara+ Divisi Coaches / Bus (`/dashboard/manage/nismaraplus/quests`):**
  - Menambahkan 4 tipe quest baru: **`COACH_JOB`** (semua layanan bus), **`COACH_INTERCITY_JOB`** (Intercity Transit), **`COACH_TOURIST_JOB`** (Tourist Charter), dan **`COACH_PASSENGERS`** (total penumpang diangkut / Pax) lengkap dengan deteksi `JobHistory` selaras Bot Natasya, aturan anti-tumpang tindih rotasi mingguan, filter & form Manage Quests, serta tampilan progres di `/dashboard/nismaraplus`.

### Changed
- **Rework Navigasi Dashboard Sidebar (`components/DashboardSidebar.tsx`, `app/dashboard/layout.tsx`):**
  - Mengubah daftar flat panjang menjadi sistem **Parent & Child (expandable)** untuk **Driver Menu** (memisahkan jelas **Nismara+** dan **Season Pass**), **Management Portal** (mencakup akses langsung sub-menu `Manage Data`, `Manage Events`, dan `Manage Fleets`), serta grup **Owner Tools** khusus **Web Owner** dengan auto-expand grup aktif dan slide-over drawer untuk mobile.

---

## [1.5.2] - 2026-11-26

### Fixed
- **Community Market Update Pipeline Error Mongoose 9 (`listings/[id]/buy`, `buy-orders/[id]/fulfill`):**
  - Menambahkan opsi `{ updatePipeline: true }` pada `findOneAndUpdate()` dengan aggregation pipeline di endpoint pembelian listing dan pemenuhan Buy Order agar kompatibel dengan aturan strict Mongoose 9.

---

## [1.5.1] - 2026-11-26

### Added
- **Perlindungan Sesi Login & Anti-Stolen Session (`lib/sessionSecurity.ts`, `app/api/auth/[...nextauth]/route.ts`):**
  - Mengikat sesi database NextAuth dengan fingerprint perangkat dan browser (`OS`, `Browser Family`, `Device Type`, `Accept-Language`, dan `Sec-CH-UA-Platform`) yang tetap stabil saat browser melakukan auto-update versi minor.
  - Memutus sesi secara otomatis (*auto-revoke*), mencatat `SecurityAlert` (`STOLEN_SESSION_DETECTED`), dan mengirim peringatan via DM Discord serta notifikasi web (dengan dedup Redis 5 menit) apabila cookie sesi dipakai dari perangkat/browser yang berbeda.
  - Menerapkan batas masa aktif absolut **48 jam** (`STAFF_SESSION_MAX_AGE_MS`) serta *auto-revoke* saat terjadi perubahan negara Cloudflare (`cf-ipcountry`) khusus untuk akun **Manager, Admin, dan Owner**. Untuk driver reguler, perubahan negara diperbarui secara senyap agar ramah terhadap IP dinamis dan VPN/WARP tanpa spam DM.
- **Manajemen Sesi Aktif & Cabut Sesi Darurat (`/dashboard/settings?tab=security`, `/api/auth/sessions`, `/api/manage/users/[discordId]/revoke-sessions`):**
  - Menambahkan tab **Keamanan & Sesi** (`ActiveSessionsCard.tsx`) agar pengguna dapat melihat daftar perangkat yang sedang login (browser/OS, negara, IP tersamar, waktu aktif WIB) serta memutus sesi per perangkat, keluar dari semua perangkat lain, atau keluar dari seluruh perangkat.
  - Menambahkan tombol darurat **Cabut Sesi Login** pada halaman manajemen user (`/dashboard/manage/data/users/[truckyId]`) bagi Staff/Owner untuk memutus seluruh sesi aktif akun bermasalah beserta notifikasi DM ke pemilik akun.

### Changed
- **Hardening Autentikasi, Security Dashboard & HTTP Headers (`app/api/auth/[...nextauth]/route.ts`, `app/dashboard/settings/actions.ts`, `app/dashboard/manage/security`, `next.config.ts`):**
  - Menghapus penyimpanan `access_token`, `refresh_token`, dan `id_token` Discord di koleksi `accounts` serta menghapus `allowDangerousEmailAccountLinking` dan pencocokan akun berbasis email.
  - Memigrasikan seluruh query profil di `app/dashboard/settings/actions.ts` ke `discordId` dan menambahkan directive anti-cache di `app/dashboard/settings/page.tsx`.
  - Memperbarui `/api/manage/security` (menambahkan `dbConnect()`, anti-cache `jsonNoCache`, dan endpoint `PATCH` resolve alert) serta tampilan `/dashboard/manage/security` dengan label alert sesi dan waktu WIB.
  - Menambahkan global HTTP security headers di `next.config.ts` (`Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`).

### Fixed
- **Docker / GitHub Actions Build Hang (`lib/redis.ts`, `lib/webConfig.ts`, `app/page.tsx`):**
  - Mencegah `ioredis` melakukan retry koneksi tanpa batas ke `127.0.0.1:6379` saat `REDIS_URL` tidak tersedia di tahap `next build` Docker (`enableOfflineQueue: false`, `maxRetriesPerRequest: 0`, `retryStrategy: () => null`, dan error listener).
  - Menambahkan guard build-time di `getWebConfig()` agar langsung mengembalikan default env dalam `0ms` bila `REDIS_URL` dan `MONGODB_URI` belum diset.
  - Menandai `app/page.tsx` dengan `export const dynamic = "force-dynamic"` agar Next.js tidak mencoba static prerender halaman utama saat build Docker.

---

## [1.5.0] - 2026-11-25

### Added
- **Nismara Community Market (`/community-market` & `/dashboard/manage/community-market`):**
  - Bursa perdagangan P2P untuk **Voucher** (termasuk badge transparan *Unlimited* / *Maks. Potongan*) dan **Tiket Penghapus Penalti Safebox**, dilengkapi fitur **Sell Listing**, **Buy Order** dengan sistem escrow NC atomik (refund 100% jika dibatalkan/kedaluwarsa), pajak penjual 11%, sistem ulasan reputasi penjual, dan *auto-expiry sweeper*.
  - Tarif iklan gratis eksklusif untuk **Nismara+ aktif** & **Discord Server Booster**, proteksi kunci non-tradable pada voucher gaji manager (`MANAGER_SALARY_*`), *Safebox downgrade guard*, tombol **Jual 1-Klik** di halaman `/dashboard/vouchers` & `/dashboard/garage`, serta panel konfigurasi + **Live Price Range Simulator** di Dashboard Manage.
- **Voucher Operasional Garasi (`GARAGE_RENT`) & Owner Manual Voucher Lab (`/dashboard/manage/vouchers`):**
  - Mengganti kategori `GARAGE_UPGRADE` yang belum terpakai menjadi **`GARAGE_RENT`** dengan pemasangan atomik ke siklus tagihan berikutnya, dukungan perpanjangan **gratis 100%**, dan integrasi penuh pada cron `garage-rent`, Season Pass, Giveaway, dan N+ Weekly Quests.
  - Menambahkan halaman khusus Owner untuk pembuatan & pencabutan voucher uji coba manual lengkap dengan audit log wajib (`vouchergrantlogs`).
- **Servis / Replace Lebih Awal & Bundling Komponen Armada (`/dashboard/garage/fleet/[id]`):**
  - Driver kini dapat melakukan **Servis Rutin Lebih Awal** (`>= 50%` pemakaian interval), **Ganti Baru Lebih Awal** (`wear >= 50%`), serta menggabungkan beberapa komponen dalam 1 tiket servis sekaligus untuk menghemat biaya admin & memaksimalkan Voucher `FLEET_MAINTENANCE` (dengan perhitungan boost mekanik *live* via `lib/fleetMaintenance.ts`).
- **Nismara Rewind 2026, Tema Holiday, Driving Score & Statistik Publik:**
  - Halaman interaktif **Nismara Rewind 2026** (`/rewind`) lengkap dengan audio & ekspor kartu ringkasan, dekorasi tema *Holiday* + klaim hadiah musiman, kartu **Driving Score**, halaman **Statistik Publik** (`/statistics`), **Tiered NC Boost Events** (Grade A/S), serta peningkatan Special Contract divisi Truck & Coach.
- **Web Config Manager & Sistem Account Hold 90 Hari:**
  - Panel manajemen konfigurasi dinamis (`/dashboard/manage/data/web-config`), sistem pembekuan akun 90 hari (`accountHold`) yang membekukan tagihan garasi/akses sementara, serta sinkronisasi Steam ID Trucky di NextAuth.

### Changed
- **Rebalance Ekonomi Armada (Paket D1):**
  - Kenaikan harga beli **+55%** (dibulatkan kelipatan `500 NC`) untuk seluruh `Truck` dan `Car` di `fleetstores`, sementara `Bus / Coaches` tetap **+0%**.
  - Biaya *Replace* (`component_cost_unfix_wear`) disesuaikan menjadi `10.000 / 14.000 / 22.000 / 28.000 NC` (`74.000 NC` per set) untuk Truck & Bus, serta proporsional `3.500 / 5.000 / 8.000 / 10.000 NC` (`26.500 NC` per set) untuk Car dengan auto-preset di form Admin Fleet Store.
  - Menampilkan baris **Bagi Hasil Pemilik Armada (`25%` / `20%`)** pada rincian keuangan `/jobs/[jobId]`.
- **Navigasi Navbar:** Menu **Market** kini memayungi **Mod Workshop**, **Community Market**, dan **Fuel Market**.
- **Form Pembuatan Voucher Manage:** Menambahkan pengaturan `Maks. Potongan (NC)` dan `Masa Berlaku (Hari)` serta menyembunyikan input durasi jam untuk voucher non-booster di Season Pass, Giveaway, dan N+ Weekly Quests.

### Fixed
- **Bug Kritis Threshold Pembelian Armada (`order/[id]/complete`):** Memperbaiki kesalahan yang sebelumnya menyalin harga `component_cost_unfix_wear` ke threshold kilometer `fleet.maintenance` saat pembelian armada baru.
- **Validasi Server `wear >= 100%` & Cron Perawatan:** Memaksa mode `replace` di server bila komponen mencapai wear 100%, mendukung reset wear selektif per komponen (`replaceComponents`), menyinkronkan durasi Transmisi & default interval (`45k / 20k / 60k / 35k`), serta memicu `need_maintenance` saat wear mencapai 100%.
- **Resilience Auth NextAuth:** Menangani race condition `E11000` saat pembuatan akun paralel serta memperbaiki fallback `baseIntervals` pada halaman detail & daftar fleet.

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
