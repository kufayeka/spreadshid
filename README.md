# @kufayeka/sheet

Spreadsheet untuk React yang rasanya seperti Google Sheets. Orang bisa bikin dan merapikan sheet sendiri lewat toolbar dan menu: rumus, format
Rupiah, merge, filter, grup baris, komentar, import dan download Excel. Kode aplikasimu tetap pegang kendali: tiap perubahan bisa diizinkan, diubah,
atau ditolak, dan tiap orang cuma bisa melakukan apa yang dikasih perannya.

![Sheet BOQ dengan rumus dan format Rupiah](docs/img/boq.png)

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

<!-- contoh: 01-halaman.page.js -->
```jsx
import { Sheet } from '@kufayeka/sheet';
import '@kufayeka/sheet/style.css';

// Halaman paling sederhana: sheet kosong seperti Google Sheets.
// Sheet mengisi tinggi pembungkusnya, jadi pembungkus harus punya tinggi.
export default function Halaman() {
    return (
        <div style={{ height: 600 }}>
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

1. [Mulai cepat](docs/01-mulai-cepat.md): pasang, halaman pertama, workbook buatan sendiri, Next.js
2. [Konsep dasar](docs/02-konsep.md): workbook, sheet, alamat sel, id baris dan kolom, perubahan (op), undo, menyimpan
3. [Komponen `<Sheet>`](docs/03-komponen-sheet.md): semua props, event, handle (`ref`), keyboard, tema
- [Galeri: satu proyek konstruksi](docs/galeri.md)
4. API workbook *(menyusul)*
5. Rumus *(menyusul)*
6. Format dan locale *(menyusul)*
7. Data: sort, filter, grup, validasi, conditional formatting *(menyusul)*
8. Mengisi sheet dari data (populate) *(menyusul)*
9. Menyimpan ke database *(menyusul)*
10. Aturan dan tipe kolom *(menyusul)*
11. Access control *(menyusul)*
12. Komentar *(menyusul)*
13. Excel dan CSV *(menyusul)*
14. Performa *(menyusul)*
15. Referensi lengkap *(menyusul)*

## Soal dokumentasi ini

Semua contoh kode di sini adalah file di [`docs/examples/`](docs/examples/). Kode dan hasil cetaknya dimasukkan ke halaman oleh `npm run docs`, dan
gambarnya diambil dari contoh yang sama di Chrome oleh `npm run docs:shots`. `test/docs.test.js` gagal kalau ada contoh yang sudah tidak jalan atau
halaman yang beda dengan hasil terbaru.
