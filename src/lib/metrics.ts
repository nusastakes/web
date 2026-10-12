/**
 * Kriteria B16: "taps and seconds from landing page to confirmed Monad transaction". Modul ini mencatat dua angka itu
 * di sisi klien dan menampilkannya setelah transaksi pertama terkonfirmasi. Tidak ada yang dikirim ke server.
 */
const KEY = "nusastakes.firsttx.v1";

interface Marks { startedAt: number; ceremonies: number; done?: { seconds: number; ceremonies: number; hash: string } }

function read(): Marks | null {
  try { const r = sessionStorage.getItem(KEY); return r ? (JSON.parse(r) as Marks) : null; } catch { return null; }
}
function write(m: Marks) { try { sessionStorage.setItem(KEY, JSON.stringify(m)); } catch { /* abaikan */ } }

/** Dipanggil saat pengguna menekan "buat akun". Mengulang dari nol bila belum pernah selesai. */
export function markStart() {
  const m = read();
  if (m?.done) return;
  write({ startedAt: Date.now(), ceremonies: 0 });
}
export function markCeremony() {
  const m = read();
  if (m && !m.done) write({ ...m, ceremonies: m.ceremonies + 1 });
}
/** Mengembalikan angka bila ini transaksi pertama setelah `markStart`. */
export function markFirstTx(hash: string): { seconds: number; ceremonies: number } | null {
  const m = read();
  if (!m || m.done) return m?.done ?? null;
  const done = { seconds: (Date.now() - m.startedAt) / 1000, ceremonies: m.ceremonies, hash };
  write({ ...m, done });
  return done;
}
export function readFirstTx() { return read()?.done ?? null; }
