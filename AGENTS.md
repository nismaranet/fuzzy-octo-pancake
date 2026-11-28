<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know
This version has breaking changes — APIs, conventions, and file structure may differ from training data. Read `node_modules/next/dist/docs/` before writing code and heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AGENTS.md — Nismara Transport (`nismara-logistics`)

Portal web resmi **Nismara Transport** (`https://transport.nismara.web.id`, beta: `https://beta.nismara.web.id`) untuk komunitas VTC ETS2 & ATS.

---

## 1. Tech Stack & Infrastruktur

- **Core**: TypeScript (strict), Next.js App Router (Server Components & Server Actions), Tailwind CSS, `lucide-react`, NextAuth (Discord).
- **Database**: MongoDB — dual layer: native `mongodb` driver (`clientPromise` via `@/lib/mongodb`, BSON 6.x) & `mongoose@^9.5.0` (`@/lib/mongoose`, BSON 7.x). **Selalu gunakan connection pool `clientPromise`**.
- **Cache**: Redis (`ioredis` via `@/lib/redis`) untuk fitur high-frequency & hybrid NextAuth session cache (`session:profile:${user.id}`, TTL 900s).
- **Storage & CDN**:
  - Media upload user: Cloudflare R2 + kompresi WebP (`@/lib/imageUtils`).
  - Rilis Companion: Cloudflare R2 (`https://releases.nismara.web.id/version.json`) untuk `/dashboard/tracker`.
  - Live Map HiDPI tiles: Cloudflare R2 (`https://tiles.nismara.my.id/{ets2,ats}/`), API telemetri dari `https://companion.nismara.web.id`.
- **Bot Protection**: Cloudflare Turnstile (`components/ui/TurnstileWidget.tsx` + `verifyTurnstileToken` di `lib/turnstile.ts`).
- **Deploy**: Vercel / PM2 (`ecosystem.config.js`).

---

## 2. Brand, Penamaan & Privasi Publik (WAJIB)

- **Brand Resmi**: Selalu gunakan **Nismara Transport**. **DILARANG** menulis **Nismara Logistics** di teks UI, metadata, notifikasi, alert, atau dokumen baru.
- **Bot Discord**: Selalu sebut **Bot Natasya** di seluruh tampilan publik, changelog, dan notifikasi. **DILARANG** memakai nama internal `Silvia` di teks publik.
- **Fitur Beta (`test_participation === true`)**: `/dashboard/tracker` dan `/livemap` (termasuk menu top-level **Live Map**) sementara hanya tampil dan dapat diakses oleh user dengan `test_participation === true`.
- **Profil Publik**: Jangan tampilkan saldo private (seperti NC) pada halaman `/profile/[truckyId]`.

---

## 3. Database, Ekonomi, BSON & Mongoose 9 (KRITIS!)

- **Verifikasi Skema Dulu**: Jangan pernah menebak nama field (`discordId` vs `userId` — mis. `gallery_posts`/`gallery_comments` memakai `userId` berisi `discordId`). Cek model di `lib/models/` atau dokumen aktual terlebih dahulu.
- **Kompatibilitas BSON 6.x vs 7.x (KRITIS)**: `ObjectId` dari Mongoose 9 bertipe BSON 7.x; mengirimkannya langsung ke native `db.collection(...)` (BSON 6.x) akan melempar `Unsupported BSON version, bson types must be from bson 6.x.x`.
  - **WAJIB** konversi eksplisit dengan `new ObjectId(String(doc._id))` menggunakan `ObjectId` dari `"mongodb"` saat mencampur Mongoose & native driver. Hindari `Model.collection.*` dengan ObjectId native.
- **Mongoose 9 (`mongoose@^9.5.0`)**:
  1. Setiap `findOneAndUpdate`/`updateOne`/`updateMany` dengan aggregation pipeline `[...]` **WAJIB** menyertakan `{ updatePipeline: true }`.
  2. Pada `Model.bulkWrite()` dengan `{ timestamps: true }`, jangan isi `createdAt`/`updatedAt` manual di `$setOnInsert` (konflik path `updatedAt`).
- **Ekonomi & Penalti**:
  - `currencies` & `points`: WAJIB filter `userId` (`discordId`) + `guildId` (`process.env.GUILD_ID || "863959415702028318"`).
  - Setiap mutasi `totalNC` WAJIB mencatat ke `currencyhistories` (`earn`/`spend`), dan setiap pembelian/order user WAJIB mencatat ke `transactions` (terpusat di `/dashboard/transactions`).
  - `points.totalPoints` adalah **poin penalti** (tidak boleh negatif, min 0); setiap perubahan WAJIB dicatat ke `pointhistories`.
- **Fleet Ownership**: Gunakan `owner` (bukan `driver` legacy) untuk kepemilikan. Pada query non-map `jobhistories`, kecualikan `{ projection: { routePath: 0 } }`.
- **Anti Race Condition**: Gabungkan syarat kelayakan langsung ke filter atomic `updateOne`/`findOneAndUpdate` (cek `modifiedCount === 0`), gunakan state locking + rollback di `catch`, selalu isi default lengkap pada `$setOnInsert` saat `upsert: true`, dan pasang `checkRateLimit` (`@/lib/rateLimit`). Rujuk `.agents/skills/anti-race-condition/SKILL.md`.
- **User Purge & Zero-Orphan**: Setiap koleksi/fitur baru yang menyimpan data/media user WAJIB didaftarkan di `app/api/manage/users/[discordId]/purge/route.ts` (bedakan aset milik sendiri vs sewa; gunakan `$pull` pada dokumen bersama). Rujuk `.agents/skills/user-purge-maintenance/SKILL.md`.
- **Session TTL**: Koleksi `sessions` menggunakan TTL index `{ expires: 1 }, { expireAfterSeconds: 0 }`.
- **Skill Database**: Gunakan skill MongoDB yang relevan (`mongodb-schema-design`, `mongodb-query-optimizer`, `mongodb-connection`, `mongodb-natural-language-querying`).

---

## 4. Upload Media (R2), Anti-Cache & Turnstile

- **Cloudflare R2 Upload**:
  - **Deferred Upload**: Jangan upload di `onChange`; simpan `File` di state + preview `URL.createObjectURL()`, baru kompres & upload saat submit.
  - Kompres semua gambar lewat `compressImageToWebP` (`@/lib/imageUtils`). Limit: standar **3 MB** (PNG/JPG/JPEG → WebP), **Nismara+** **5 MB** (+ **GIF**, jangan ubah GIF ke WebP).
  - Hapus file lama di R2 setiap kali user mengganti gambar agar tidak ada file orphan.
- **Anti-Cache (Vercel + Cloudflare + Browser)**:
  - Halaman dinamis/dashboard: ekspor `dynamic = "force-dynamic"`, `revalidate = 0`, `fetchCache = "force-no-store"`.
  - API dinamis/mutasi: gunakan `jsonNoCache(data)` / `NO_CACHE_HEADERS` dari `@/lib/antiCache`.
  - Fetch client: selalu sertakan `NO_CACHE_FETCH_OPTIONS` (`cache: "no-store"`).
  - Setelah mutasi: panggil `revalidatePath("/path")` di server (bukan path `/api/...`) dan `router.refresh()` di client. Pertahankan `experimental.staleTimes.dynamic: 0` di `next.config.ts`.
- **Cloudflare Turnstile**: Wajib pada form publik driver (bukan form admin/manager). Render `<TurnstileWidget />` tepat di atas tombol submit, **selalu** panggil `verifyTurnstileToken()` paling awal di server sebelum auth/DB, dan reset token (`setTurnstileToken(null)`) bila submit gagal karena token bersifat single-use.

---

## 5. Tanggal WIB (Anti-Bug 1970) & Format Data

- **Anti-Bug 1970**: **DILARANG** menggabungkan string `new Date(\`${inputDate}+07:00\`)` (date-only tanpa `T` menjadi `Invalid Date` → `1970-01-01`).
  - Wajib pakai `parseWIBDate(dateInput, isEndOfDayIfDateOnly)` untuk simpan ke DB dan `formatWIBDateTimeLocal(dateInput)` untuk form `<input type="datetime-local">`. Validasi `endDt > startDt` di client & server.
- **Format Tampilan**:
  - Waktu: `toLocaleString("id-ID", { timeZone: "Asia/Jakarta", ... })` + `" WIB"`.
  - NC: `.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })` (bukan `.toFixed(2)`).
  - BBM: `Math.floor(val).toLocaleString("id-ID") + " L"`.

---

## 6. UI/UX, Next.js 15+/16, SEO & Standar Penulisan

- **Next.js 15+/16 & CSS**:
  - `await searchParams` & `await params` di Server Components / `generateMetadata`.
  - Jangan pakai `overflow-x-hidden` pada `<html>`/`<body>`/wrapper jika ada `position: sticky` di dalamnya — gunakan `overflow-x-clip`.
  - Sinkronkan state client saat prop dari Server Component berubah via `useEffect`.
  - Untuk halaman full-bleed seperti `/livemap`, bungkus `<main className="isolate z-0">` agar Leaflet tidak menutupi dropdown Navbar.
- **Komponen Wajib**:
  - Badge user: selalu pakai `<UserBadges />` (`components/icons/UserBadges.tsx`).
  - Dialog/Konfirmasi: **DILARANG** `window.alert()`/`confirm()` — gunakan `showAlert`/`showConfirm` dari `@/lib/dialog`.
  - Dropdown pilih user: gunakan searchable dropdown (jangan `<select>` native).
  - Radix `SelectValue`: selalu berikan explicit children label mapping (`<SelectValue>{LABELS[val] || "Pilih..."}</SelectValue>`).
  - Tooltip di list/table: tambahkan `relative z-10 hover:z-50` pada row dan jangan taruh `overflow-hidden`/`line-clamp-1` pada wrapper tooltip.
  - Parity Modal vs Detail Page + Ticket auto-fill via query params (`?commentId=...`).
- **SEO & Metadata**: Root layout sudah memakai template `%s - Nismara Transport` — **DILARANG** menambah suffix `- Nismara Transport` secara manual di child page. Dashboard memakai `robots: { index: false, follow: false }` tanpa OG/Twitter card. Fallback OG image: `https://images.nismara.my.id/227300_188.jpg`. Rujuk `.agents/skills/seo-metadata/SKILL.md`.
- **Changelog & Anti-Slop (WAJIB)**:
  - Setiap rilis versi (`Web Transport`, `Bot Natasya`, `Nismara Tracker`), siapkan paket isian `/dashboard/manage/changelog` dengan bahasa **non-teknis untuk driver** (tanpa istilah kode/database/server, tanpa em/en dash, tanpa emoji hiasan, tanpa buzzword AI).
  - Untuk pekerjaan UI, copy, & mobile, baca `.agents/skills/antislop/SKILL.md` serta skill relevan (`antislop-ui`, `antislop-layoutmobile`, `antislop-human`, `antislop-copywriting`, `antislop-code`, `ui-design`, `ui-radar`, `ui-styling`, `ui-ux-pro-max`).
