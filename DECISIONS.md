# Keputusan teknis frontend

Satu baris per keputusan. Format: `tanggal | keputusan | alasan / bukti`.

- 2026-10-13 | three.js langsung, tanpa React Three Fiber; adegan satu kelas (`src/lib/scene/CityScene.ts`) yang menerima data dari React | Adegan berjalan tiap frame dengan ribuan instans; React hanya mengirim peta, distrik, gaya, dan kejadian.
- 2026-10-13 | Kota dibangun dari peta Overture yang disiapkan sekali (`scripts/prep-map.mjs`), bukan dipanggil saat runtime | Satu unduhan Overture butuh 80–167 detik.
- 2026-10-13 | Kota tumbuh dari tanah kosong: perkembangan distrik = `ln(1 + dana/40) / ln(1 + 60000/40)` | Permintaan user agar kota tidak langsung terbangun penuh. Skala log supaya setoran kecil pertama sudah terlihat.
- 2026-10-13 | Kendaraan dan orang mengikuti graf jalan dengan tingkat (arteri, jalan, gang, jalur pejalan) dan jadwal harian dari `src/lib/scene/clock.ts` | Pola jam sibuk kota Indonesia; lihat catatan riset di vault (TC55).
- 2026-10-13 | Gaya kartun: bahan toon tiga pita, fasad prosedural di shader (jendela dengan ruangan di baliknya, etalase, papan nama), tanpa tekstur gambar | Satu berkas peta cukup untuk kota mana pun; ukuran unduhan kecil.
- 2026-10-13 | Pasca-proses (bloom malam, vignette, MSAA) hanya di layar lebar (sekurangnya 820 px); mode hemat di ponsel | Belum diukur di ponsel sungguhan.
- 2026-10-13 | Akun Mera: satu ceremony membuat passkey dan membuka sesi; tarik dana, ubah kunci wakil, dan sewa staf selalu ceremony baru | Tabel sesi per peran di PRD (B16).
- 2026-10-13 | Kunci wakil diturunkan dari keluaran PRF akun yang sama, jalur BIP32 indeks 1 | Bisa dibuat ulang di perangkat baru tanpa menyimpan apa pun. Catatan: sesi halaman juga memegang kunci utama (untuk permit setor).
- 2026-10-13 | Buku strategi memakai salt PRF sendiri `sha256("nusastakes/buku-strategi/v1")`, kunci per entri HKDF-SHA256, AES-256-GCM dengan id entri sebagai data tambahan; `planHash` = `keccak256(ciphertext)` | Bounty B17: namespace terpisah dari akun, tidak ada yang sensitif disimpan. Reveal per entri lewat `revealPlanKey(planHash, kunci entri)`.
- 2026-10-13 | Gaya kota (tema dan karya sipil) disimpan di relayer lewat `POST /style` dengan tanda tangan EIP-712 walikota | Kontrak v2 tidak punya tempat untuknya. Gaya hanya tampilan.
- 2026-10-13 | Poller kejadian onchain meminta paling banyak 99 blok per `getLogs` | `testnet-rpc.monad.xyz` menolak rentang lebih dari 100 blok dengan HTTP 413 (diperiksa langsung).
- 2026-10-13 | Nama toko, gedung, dan iklan di kota adalah fiktif | Menghindari nama usaha sungguhan.
- 2026-10-13 | `/signin` memeriksa lingkungan sebelum ceremony (https, WebAuthn, browser dalam aplikasi lain) dan membedakan galat dibatalkan, PRF tidak didukung, dan galat lain | Perangkat tanpa PRF atau browser aplikasi chat adalah penyebab gagal masuk yang paling mungkin; pengguna awam perlu tahu apa yang harus dilakukan, bukan membaca galat mentah. Diuji dengan authenticator virtual (tanpa PRF, verifikasi gagal, sukses, terkunci).
- 2026-10-13 | Panduan mulai menentukan langkah dari keadaan chain (saldo AUSD, share di kota mana pun lewat satu `multicall`), bukan dari klik; hanya preferensi tampilan yang disimpan di browser | Tetap benar bila akun dibuka di perangkat lain, dan akun yang sudah lengkap tidak diganggu. Ucapan selamat hanya untuk yang menyelesaikannya di sesi ini.
- 2026-10-13 | Faucet AUSD diulang otomatis saat relayer membalas 429 dengan `retryAfterSeconds` ≤ 60 (maksimal 6 kali) | Kontrak faucet membatasi frekuensi untuk semua orang; terlihat langsung pada uji pertama ("the faucet was used a moment ago"). Batas per alamat yang lebih panjang tidak diulang.
- 2026-10-13 | Teks aplikasi (`/city`) dua bahasa lewat `lib/copy-app.ts`, kecuali teks buatan mesin kota 3D dan lembar walikota | Mengikuti halaman depan supaya pengguna tidak berpindah bahasa setelah masuk; sisanya menyusul.
- 2026-10-13 | Label langkah transaksi diterjemahkan di `StepList` lewat kamus (`stepText` di `lib/copy-mayor.ts`), bukan dengan mengubah `lib/actions.ts` | Kode aksi tetap satu sumber berbahasa Inggris yang diuji; terjemahan hanya di lapisan tampilan, dan label yang tidak dikenal tampil apa adanya.
