# Panduan Driving Score & Safety Rating Nismara Transport

**Driving Score** adalah sistem penilaian kualitas dan keselamatan mengemudi resmi di **Nismara Transport** yang dihitung secara otomatis dari data telematika pengiriman (_Job History_) kamu di **Euro Truck Simulator 2 (ETS2)**, **DLC Coaches (Bus)**, maupun **American Truck Simulator (ATS)**.

Sistem ini dirancang agar **adil untuk driver santai maupun hardcore**, **setara antara Divisi Logistik (Truck) dan Divisi Coaches (Bus)**, serta bebas dari penalti yang disebabkan oleh bug atau kendala teknis.

---

## 1. Skala Nilai & Tingkatan Grade

Driving Score memiliki rentang nilai **0 hingga 100** yang dikelompokkan ke dalam 5 Grade:

|  Grade  |  Rentang Skor   | Predikat          | Keterangan                                                                                                   |
| :-----: | :-------------: | :---------------- | :----------------------------------------------------------------------------------------------------------- |
|  **S**  | **97,0 – 100**  | _Elite Driver_    | Pengemudi teladan: nyaris 0% kerusakan, konsisten _Real Miles_, sangat minim tilang, dan selalu tepat waktu. |
|  **A**  | **88,0 – 96,9** | _Safe Driver_     | Pengemudi aman dan andal dengan kedisiplinan lalu lintas yang sangat baik.                                   |
|  **B**  | **76,0 – 87,9** | _Standard Driver_ | Performa mengemudi cukup baik, namun masih ada ruang peningkatan di kecepatan, kerusakan, atau tilang.       |
|  **C**  | **60,0 – 75,9** | _Needs Attention_ | Perlu perhatian ekstra pada keselamatan mengemudi, batas kecepatan, atau kepatuhan rambu lalu lintas.        |
|  **D**  |   **< 60,0**    | _High Risk_       | Tingkat risiko tinggi (kerusakan besar, sering _Race Miles_, atau sering melanggar lalu lintas).             |
| **N/A** |   _Unranked_    | _Kalibrasi Data_  | Driver belum menyelesaikan minimal **5 pengiriman** sehingga skor belum dapat dihitung.                      |

---

## 2. Status Driving Score (Sistem Hybrid 30 Hari)

Karena komunitas Nismara Transport mayoritas adalah pemain dewasa dengan kesibukan masing-masing, kami menggunakan **Sistem Hybrid** agar driver yang sedang cuti atau sibuk tidak langsung mendapatkan nilai `0`:

1. **Aktif (Ranked)**
   - Berlaku jika kamu menyelesaikan **minimal 5 pengiriman (`COMPLETED`) dalam 30 hari terakhir**.
   - Skor dihitung dari maksimal **30 pengiriman terbaru** dalam rentang 30 hari tersebut.
   - Hanya driver berstatus **Aktif (Ranked)** yang berhak masuk papan peringkat keselamatan dan menikmati **promo / voucher eksklusif berbasis Grade** (seperti _Voucher Tebus Murah Grade S_ atau program khusus lainnya).

2. **Historis (Inactive)**
   - Berlaku jika dalam 30 hari terakhir kamu menyelesaikan **kurang dari 5 pengiriman**, tetapi secara keseluruhan sudah memiliki **≥ 5 pengiriman**.
   - Skor **tidak jatuh menjadi 0** — profilmu tetap menampilkan skor dari **25 pengiriman terakhir** dengan label _Historis (Inactive)_.
   - Selesaikan hingga cukup **5 pengiriman dalam 30 hari** agar status otomatis kembali menjadi **Aktif (Ranked)**.

3. **Kalibrasi (`N/A`)**
   - Berlaku bagi driver baru yang total pengiriman selesainya masih **kurang dari 5 job**.
   - Setelah job ke-5 selesai, Driving Score & Grade akan langsung terbuka otomatis.

> **Catatan Penting:** Pengiriman yang dibatalkan (**`CANCELED`**) **TIDAK memotong Driving Score**. Hal ini diterapkan agar driver tidak dirugikan oleh kendala teknis seperti game crash, koneksi terputus, atau bug _double Job ID_ dari Trucky.

---

## 3. Rincian 4 Pilar Perhitungan (Total 100%) + Bonus

Driving Score dihitung dari **4 pilar utama** dengan bobot total 100%, ditambah **Bonus Hardcore** opsional (skor akhir dibatasi maksimal **100,0**):

### 1. Safety & Damage Control — Bobot 40%

Mengukur seberapa aman kamu menjaga kondisi kendaraan, trailer, dan muatan/penumpang hingga tiba di tujuan.

- **Divisi Logistik (Truck):**
  - Menghitung kerusakan kendaraan (`damage.vehicle`), trailer (`damage.trailer`), dan kargo (`damage.cargo`).
  - Kerusakan **kargo** memiliki pengaruh **3× lebih sensitif** dibanding lecet kendaraan/trailer karena menjaga keutuhan barang pelanggan adalah prioritas utama logistik.
- **Divisi Coaches (Bus):**
  - Karena bus tidak membawa kargo/trailer, penilaian **100% berfokus pada kerusakan badan bus (`damage.vehicle`)** sebagai cerminan keselamatan dan kenyamanan penumpang.
- **Keadilan Mode Bermain (SP vs Multiplayer):**
  - Di **Singleplayer (SP)**, toleransi kerusakan lebih ketat (standar 10%).
  - Di **TruckersMP (TMP) & HaulMP**, bobot pengurangan skor akibat kerusakan **diringankan 35%** (mengikuti toleransi 20%) untuk mengkompensasi risiko tersenggol atau ditabrak pemain lain.

---

### 2. Speed Discipline — Bobot 30%

Mengukur kedisiplinan kecepatan mengemudi berdasarkan klasifikasi resmi **Trucky** (sudah mencakup toleransi _cooldown_ 10 detik jika kecepatan sempat melewati batas sebentar lalu segera turun kembali):

| Divisi & Game     |     Batas _Real Miles_      | _Race Miles_ |      _Invalid_       |
| :---------------- | :-------------------------: | :----------: | :------------------: |
| **Truck — ETS2**  | Maks. **100 km/h** (62 mph) |  > 100 km/h  | > 180 km/h (112 mph) |
| **Truck — ATS**   | Maks. **130 km/h** (80 mph) |  > 130 km/h  | > 180 km/h (112 mph) |
| **Coaches — Bus** | Maks. **110 km/h** (69 mph) |  > 110 km/h  | > 180 km/h (112 mph) |

Nilai per pengiriman pada pilar ini:

- **Real Miles (tanpa penalti kecepatan):** `100`
- **Real Miles (terkena penalti kecepatan sistem):** `65`
- **Race Miles:** `35`
- **Invalid (> 180 km/h):** `0`

---

### 3. Clean & On-Time Delivery — Bobot 25%

Mengukur persentase pengiriman yang tuntas **bersih tanpa penalti sistem dan tepat waktu** (tidak bisa diakali lewat pengaturan gameplay):

- Setiap job dimulai dari nilai **100**, lalu dikurangi jika terjadi:
  - Terkena **penalti poin sistem** (`penalty.total > 0`): **-60**
  - Terjadi **kerusakan kargo** (Truck `> 0%`) atau **kerusakan bus signifikan** (Coaches `> 6%` di SP / `> 12%` di MP): **-40**
  - **Terlambat tiba** di tujuan (_Late Delivery_): **-30**

---

### 4. Traffic Compliance — Bobot 5%

Mengukur kepatuhan terhadap peraturan lalu lintas in-game berdasarkan catatan tilang (**`fines_events`** seperti menerobos lampu merah, kamera batas kecepatan, tabrakan, atau melanggar rambu).

- **Kenapa bobotnya hanya 5%?** Karena pengaturan _Traffic Offence_ di ETS2/ATS dapat dimatikan oleh pemain, bobot pilar ini sengaja dibuat ringan agar tidak dapat dimanfaatkan untuk mencurangi skor—sekaligus tetap adil bagi driver yang menyalakan _Traffic Offence_ secara realistis.
- Jumlah tilang **dinormalisasi per 1.000 km** agar adil antara driver rute pendek (200 km) dan rute jarak jauh (3.000 km):
  - `0` tilang / 1.000 km → **100**
  - `1` tilang / 1.000 km → **78**
  - `2` tilang / 1.000 km → **56**
  - `4,5+` tilang / 1.000 km → **0**

---

### Bonus Opsional: Hardcore Simulation (+0 s/d +2,5 Poin)

Driver yang menyalakan mode **Hardcore Simulation** berhak mendapatkan bonus tambahan hingga **+2,5 poin** (berdasarkan persentase job Hardcore yang diselesaikan dan rata-rata _Hardcore Rating_).

- Fitur ini **100% bersifat bonus, bukan kewajiban**. Driver yang bermain mode reguler tetap bisa mencapai **Grade S (97–100)** tanpa harus mengaktifkan Hardcore.

---

## 4. Ringkasan Rumus Total

```text
Driving Score = (Safety × 40%) + (Speed × 30%) + (Clean & On-Time × 25%) + (Traffic × 5%) + Bonus Hardcore
```

_(Nilai akhir dibulatkan 1 angka di belakang koma dan dibatasi antara `0,0` hingga `100,0`.)_

---

## 5. Kapan Driving Score Diperbarui?

- **Otomatis Real-Time:** Setiap kali kamu menyelesaikan 1 pengiriman (Truck maupun Coaches) dan diproses oleh sistem Nismara, `Driving Score` di akunmu langsung dihitung ulang dan tampil di **Dashboard** serta **Profil Publik**.
- **Sinkronisasi Harian:** Sistem juga memeriksa setiap hari apakah jumlah pengiriman dalam 30 hari terakhir masih memenuhi minimal 5 job. Jika tidak, status akan beralih otomatis dari **Aktif (Ranked)** menjadi **Historis (Inactive)**.

---

## 6. Tips Cepat Mencapai & Mempertahankan Grade S

1. **Utamakan 0% Damage Kargo & Bus:** Pilar _Safety & Damage_ memegang bobot terbesar (**40%**). Jaga jarak aman dan kurangi kecepatan saat tikungan tajam atau gerbang tol.
2. **Aktifkan Speed Limiter / Cruise Control:** Jaga kecepatan di bawah batas **Real Miles** (`100 km/h` ETS2 Truck, `130 km/h` ATS Truck, `110 km/h` Coaches) agar pilar _Speed Discipline_ tetap **100**.
3. **Patuhi Rambu & Lampu Merah:** Hindari tilang kamera kecepatan dan lampu merah supaya rasio _Tilang / 1.000 km_ mendekati `0`.
4. **Selesaikan Minimal 5 Job per 30 Hari:** Agar statusmu tetap **Aktif (Ranked)** dan selalu memenuhi syarat untuk benefit atau promo eksklusif berbasis Grade.
5. **Cek Tips Otomatis di Dashboard:** Kartu Driving Score di halaman `/dashboard` secara otomatis menyorot pilar terendahmu beserta saran perbaikan tercepat.

---

## 7. Pertanyaan Umum (FAQ)

**Q: Apakah skor saya langsung rusak selamanya kalau suatu hari kena kecelakaan parah?**
Tidak. Driving Score menggunakan **jendela bergulir (30 hari / maks. 30 job terbaru)**. Seiring kamu menyelesaikan pengiriman baru yang aman dan bersih, job lama yang bermasalah akan otomatis tergeser keluar dari perhitungan.

**Q: Saya sedang cuti 1 bulan, apakah Driving Score saya jadi 0?**
Tidak. Skor kamu tidak menjadi 0, melainkan berubah status menjadi **Historis (Inactive)** dengan menampilkan skor dari 25 pengiriman terakhir. Begitu kamu aktif kembali dan menyelesaikan 5 job dalam 30 hari, status **Aktif (Ranked)** otomatis menyala lagi.

**Q: Kenapa sistem istirahat (_fatigue/rest_) tidak ikut dinilai?**
Karena saat ini DLC Coaches belum memiliki mekanik istirahat di dalam game, parameter istirahat sengaja tidak dimasukkan agar penilaian antara driver Truck dan driver Coaches tetap adil dan setara.

**Q: Apa kegunaan Grade Driving Score ke depannya?**
Selain menjadi kebanggaan di Profil Publik & bahan evaluasi objektif bagi Intern, Grade Driving Score (terutama status **Aktif**) dirancang sebagai syarat akses berbagai program apresiasi komunitas seperti promo khusus, maupun papan peringkat keselamatan.
