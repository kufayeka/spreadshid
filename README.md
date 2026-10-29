# @kufayeka/sheet

Spreadsheet untuk React. Orang bisa bikin dan merapikan sheet sendiri lewat toolbar dan menu: rumus, format
Rupiah, merge, filter, grup baris, komentar, import dan download Excel. Kode aplikasimu tetap pegang kendali: tiap perubahan bisa diizinkan, diubah,
atau ditolak, dan tiap orang cuma bisa melakukan apa yang dikasih perannya.

![Sheet stok dengan rumus dan format Rupiah](docs/img/mulai-rapi.png)

Ditulis dalam JavaScript dengan JSDoc. File `.d.ts` untuk TypeScript dibuat dari situ waktu build, jadi editor tetap kasih saran nama fungsi dan
parameter.

**Lihat [Galeri](docs/galeri.md)**: satu proyek konstruksi lengkap (RAB, AHSP, kurva S, opname, termin, CCO, laporan harian, cash flow,
NCR, dan overview dari banyak file) yang saling terhubung lewat rumus, dibuat dengan library ini.

## Pasang

```bash
npm install @kufayeka/sheet
```

Butuh `react` dan `react-dom` versi 18 ke atas.

## Contoh terkecil

<!-- contoh: 01-05-kosong.page.tsx -->
```tsx
import { Sheet } from '@kufayeka/sheet';
import '@kufayeka/sheet/style.css';

// 1.5 Sheet pertama: satu komponen, satu tinggi. Belum ada isi.
export default function Halaman() {
    return (
        <div style={{ height: 420 }}>
            <Sheet />
        </div>
    );
}
```
<!-- /contoh -->

## Tiga pintu masuk

| Import | Isinya | Jalan di |
|---|---|---|
| `@kufayeka/sheet` | komponen `<Sheet>`: grid, toolbar, menu, panel | browser (sudah bertanda `"use client"` untuk Next.js) |
| `@kufayeka/sheet/core` | workbook, rumus, format, Excel, access control, tanpa React | browser dan server Node, kodenya sama |
| `@kufayeka/sheet/style.css` | tampilan; semua warna dan ukuran berupa variabel CSS | |

Server (misalnya Nexa API Maker) pakai `@kufayeka/sheet/core` untuk memeriksa tiap simpanan dengan aturan yang sama dengan di browser.

## Daftar isi

1. [Mulai dalam 5 menit](docs/01-mulai-cepat.md): pasang, sheet pertama, isi dari kode, dirapikan, disimpan, Next.js
2. [Konsep dasar](docs/02-konsep.md): workbook sebagai data, alamat, value/input/display, id, perubahan, undo
3. [Komponen `<Sheet>`](docs/03-komponen-sheet.md): event, seleksi, perintah lewat `ref`, sheet yang tampil, layar sederhana, warna, menu, toolbar, keyboard
4. [Mengisi dan membaca dari kode](docs/04-api-workbook.md): menulis, membaca sebagai data, mengisi dari API (populate), gaya, baris dan kolom, sheet
5. [Rumus](docs/05-rumus.md): rumus di layar, rumus dari kode, sheet lain, laporan, named range, 189 fungsi termasuk TERBILANG, XIRR, penyusutan, dan hari kerja 6 hari
6. [Format](docs/06-format.md): uang, persen, tanggal, satuan, locale, conditional formatting
7. [Data](docs/07-data.md): mengurutkan, menyaring, melipat grup, pivot table, cari dan ganti
8. [Menjaga isi yang diketik](docs/08-menjaga-isi.md): dropdown, batas angka, tipe kolom, sel terkunci, beforeOp
9. [Memuat dan menyimpan](docs/09-menyimpan.md): memuat dari API, tombol simpan, simpan otomatis, database, patch, viewFor
10. [Hak akses](docs/10-hak-akses.md): aturan per baris, role dan akun, tanda di sel, mode pengaturan, server
11. [Komentar dan Excel](docs/11-komentar-excel.md): komentar di sel, impor dan ekspor xlsx dan CSV
12. [Performa dan referensi](docs/12-referensi.md): data besar, semua nama, TypeScript

- [Galeri: satu proyek konstruksi](docs/galeri.md)

## Soal dokumentasi ini

Semua contoh kode di sini adalah file di [`docs/examples/`](docs/examples/). Kode dan hasil cetaknya dimasukkan ke halaman oleh `npm run docs`, dan
gambarnya diambil dari contoh yang sama di Chrome oleh `npm run docs:shots`. `test/docs.test.js` gagal kalau ada contoh yang sudah tidak jalan atau
halaman yang beda dengan hasil terbaru.
