# 4. API workbook

[Daftar isi](../README.md#daftar-isi) · Sebelumnya: [3. Komponen `<Sheet>`](03-komponen-sheet.md) · Berikutnya: [5. Rumus](05-rumus.md)

Panduan untuk developer frontend: semua yang bisa dilakukan kodemu ke isi spreadsheet. Bab ini dimulai dari tiga baris kode, lalu bertambah sedikit demi
sedikit sampai event, `beforeOp`, undo, editor hak akses buatan sendiri, dan tipe TypeScript. Setiap contoh bisa dijalankan, dan hasilnya tertulis di
bawahnya.

Semua fungsi di bab ini milik **workbook** (`createWorkbook()` dari `@kufayeka/sheet/core`). Workbook bisa dipakai tanpa layar: di Node.js, di server,
atau di test. `<Sheet>` hanya menampilkannya ([bab 3](03-komponen-sheet.md), [bab 11](11-react.md)).

**Dasar**

- [4.1 Langkah pertama](#41-langkah-pertama)
- [4.2 Alamat sel](#42-alamat-sel)
- [4.3 Menulis isi](#43-menulis-isi)
- [4.4 Membaca isi](#44-membaca-isi)

**Mengatur tampilan dan struktur**

- [4.5 Gaya dan merge](#45-gaya-dan-merge)
- [4.6 Baris dan kolom](#46-baris-dan-kolom)
- [4.7 Sheet](#47-sheet)
- [4.8 Pengaturan workbook](#48-pengaturan-workbook)

**Mendengarkan dan mengendalikan perubahan**

- [4.9 Event](#49-event)
- [4.10 `beforeOp`: memeriksa setiap perubahan](#410-beforeop-memeriksa-setiap-perubahan)
- [4.11 Undo, redo, `source`, dan `apply`](#411-undo-redo-source-dan-apply)
- [4.12 Jenis op](#412-jenis-op)

**Studi kasus dan tipe**

- [4.13 Editor hak akses di luar sheet](#413-editor-hak-akses-di-luar-sheet)
- [4.14 TypeScript](#414-typescript)

## 4.1 Langkah pertama

<!-- contoh: 04-01-mulai.ts -->
```ts
import { createWorkbook } from '@kufayeka/sheet/core';
import type { Workbook, SheetApi, CellResult } from '@kufayeka/sheet/core';

// Pelajaran 1: buat workbook, tulis ke sel, baca kembali.
const wb: Workbook = createWorkbook();        // workbook baru: satu sheet "Sheet1", 1000 baris, 26 kolom
const s: SheetApi = wb.sheet('Sheet1');       // pegangan untuk sheet itu

s.setValues('A1', 'Semen');                   // teks
s.setValues('B1', 72000);                     // angka
s.setValues('C1', '=B1*10');                  // diawali "=": rumus

const nama: CellResult = s.value('A1');       // isi sel
const total: CellResult = s.value('C1');      // hasil rumus
const rumus: string = s.input('C1');          // rumusnya, seperti di formula bar

console.log(nama, total, rumus);
console.log('sheet:', wb.sheetIds().length, 'buah, ukuran', s.size());
```
<!-- /contoh -->

<!-- hasil: 04-01-mulai.ts -->
```text
Semen 720000 =B1*10
sheet: 1 buah, ukuran { rows: 1000, cols: 26 }
```
<!-- /hasil -->

Tiga hal yang perlu diingat dari contoh ini:

1. `createWorkbook()` membuat workbook baru dengan satu sheet bernama `Sheet1`.
2. `wb.sheet('Sheet1')` memberi **pegangan** untuk sheet itu. Semua fungsi di bab ini dipanggil lewat pegangan ini.
3. Menulis dengan `setValues`, membaca dengan `value` (hasil) atau `input` (yang diketik).

## 4.2 Alamat sel

Sel bisa ditunjuk dengan tiga cara. Ketiganya setara:

| Cara | Contoh | Kapan dipakai |
|---|---|---|
| teks lewat pegangan sheet | `s.value('B2')` | paling sering: mudah dibaca |
| teks lewat workbook, sheet di depan | `wb.value('Produk', 'B2')` | kalau tidak menyimpan pegangan sheet |
| nomor baris dan kolom, dihitung dari 0 | `s.value(1, 1)` (B2) | di dalam loop |

Bentuk teks yang diterima:

| Teks | Artinya |
|---|---|
| `'B2'` | satu sel |
| `'A1:C9'` | range: kotak dari A1 sampai C9 |
| `'2:5'` | baris 2 sampai 5, semua kolom |
| `'B:D'` | kolom B sampai D, semua baris |
| `'A1:E1, A3:E3'` | beberapa range sekaligus (untuk gaya, merge, clear) |

Sheet ditunjuk dengan **nama** (`'Produk'`) atau **id**. Nama lebih mudah dibaca, tetapi bisa diganti orang. Id tidak pernah berubah, jadi simpan id
kalau kodemu perlu mengingat sebuah sheet dalam waktu lama.

## 4.3 Menulis isi

Daftar stok 12 produk dengan rumus per baris dan ringkasan di bawahnya:

<!-- contoh: 04-03-menulis.ts -->
```ts
import { createWorkbook } from '@kufayeka/sheet/core';
import type { Op } from '@kufayeka/sheet/core';

// Pelajaran 3: semua bentuk isi yang diterima setValues, setBlock untuk sel yang berjauhan, clear, dan apa yang dikembalikan.
const wb = createWorkbook();
wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
const s = wb.sheet('Sheet1');
const lihat = (range: string) => {
    const [a, b] = range.split(':');
    const r1 = Number(a.slice(1)) - 1, r2 = Number(b.slice(1)) - 1, c1 = a.charCodeAt(0) - 65, c2 = b.charCodeAt(0) - 65;
    const out: string[] = [];
    for (let r = r1; r <= r2; r++) { const row: string[] = []; for (let c = c1; c <= c2; c++) row.push(s.display(r, c).text || '·'); out.push(row.join(' | ')); }
    return out.join('  /  ');
};

s.setValues('A1', 'Semen');                                     // satu nilai
s.setValues('A2', [['Kode', 'Produk', 'Harga']]);               // satu baris: ke kanan
s.setValues('A3', [['SMN-01'], ['BSI-10']]);                    // satu kolom: ke bawah
s.setValues('E1', ['Senin', 'Selasa', 'Rabu']);                 // array biasa: juga ke bawah
s.setValues('B3', [['Semen 50 kg', 72000], ['Besi 10 mm', 79500]]);   // tabel: satu array = satu baris
console.log('A1:C4 :', lihat('A1:C4'));
console.log('E1:E3 :', lihat('E1:E3'));

s.setValues('D2', [['Harga + PPN'], ['=C3*1.11'], ['=C4*1.11']]); // rumus
s.setValues('F1', "'=bukan rumus");                              // kutip satu di depan: teks apa adanya
s.setValues('A1', null);                                         // kosongkan
console.log('D3    :', s.value('D3'), '| F1:', s.value('F1'), '| A1:', s.value('A1'));

// setBlock: banyak sel di mana saja, isi dan gaya, sebagai SATU perubahan (satu undo)
s.setBlock([
    { at: 'B6', value: 'Total', style: { bold: true } },
    { at: 'C6', value: '=SUM(C3:C4)', style: { bold: true, format: { type: 'money', decimals: 0 } } }
]);
console.log('B6:C6 :', lihat('B6:C6'));

// setiap fungsi yang mengubah mengembalikan op yang diterapkan (atau null kalau ditolak)
const ops: Op[] | null = s.clear('E1:E3');
console.log('clear :', ops && ops.map((o) => o.t).join(', '), '| E1 sekarang', s.value('E1'));
wb.undo();
console.log('undo  :', s.value('E1'));
```
<!-- /contoh -->

<!-- hasil: 04-03-menulis.ts -->
```text
A1:C4 : Semen | · | ·  /  Kode | Produk | Harga  /  SMN-01 | Semen 50 kg | 72000  /  BSI-10 | Besi 10 mm | 79500
E1:E3 : Senin  /  Selasa  /  Rabu
D3    : 79920 | F1: =bukan rumus | A1: null
B6:C6 : Total | Rp 151.500
clear : cells | E1 sekarang null
undo  : Senin
```
<!-- /hasil -->

**`setValues(alamat, isi)`** menulis mulai dari alamat itu, ke kanan dan ke bawah:

| `isi` | Ditulis ke |
|---|---|
| `'Semen'`, `72000`, `true` | satu sel |
| `'=B2*C2'` | rumus (teks yang diawali `=`) |
| `"'=B2"` | teks apa adanya: tanda kutip satu di depan mencegahnya jadi rumus |
| `null` | mengosongkan sel |
| `[['a', 'b', 'c']]` | satu **baris**: ke kanan |
| `[['a'], ['b'], ['c']]` | satu **kolom**: ke bawah |
| `['a', 'b', 'c']` | array biasa juga ditulis **ke bawah**, satu nilai per baris |
| `[['a', 'b'], ['c', 'd']]` | tabel: setiap array di dalamnya adalah satu baris |
| `(r, c, sebelum) => isi` | dengan range sebagai alamat (`'A2:A9'`): isi setiap sel dari fungsi. `undefined` berarti sel itu tidak diubah |

Jadi `setValues('B2', ['Hello World', 'Ini baris kedua'])` menulis `Hello World` di B2 dan `Ini baris kedua` di B3. Untuk menulis ke kanan (B2 dan C2),
bungkus dengan satu array lagi: `setValues('B2', [['Hello World', 'Ini kolom kedua']])`.

**`setBlock([{ at, value, style }])`** menulis sel-sel yang letaknya terpisah, masing-masing dengan isi dan gayanya, sebagai **satu** perubahan. Satu
kali undo membatalkan semuanya. Cocok untuk baris total atau kepala laporan.

**`clear(range)`** mengosongkan isi tetapi membiarkan gaya, seperti tombol Delete.

Setiap fungsi yang mengubah isi menerima parameter terakhir `{ source }`. Tanpa itu, perubahan dianggap datang dari kode aplikasimu. Dengan
`{ source: 'user' }`, perubahan diperlakukan seperti diketik orang: validasi, tipe kolom, dan hak akses ikut memeriksanya (4.11).

## 4.4 Membaca isi

Satu sel bisa dibaca dengan beberapa cara, dan masing-masing menjawab pertanyaan yang berbeda:

<!-- contoh: 04-04-membaca.ts -->
```ts
import { createWorkbook, isError } from '@kufayeka/sheet/core';
import type { CellResult, CellValue } from '@kufayeka/sheet/core';
import { penjualan, KOLOM_PENJUALAN, barisPenjualan } from './data/toko.js';

// Pelajaran 4: satu sel dibaca dengan beberapa cara, error rumus, mencari ujung data, dan membaca semua baris.
const wb = createWorkbook();
wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
const jual = wb.sheet('Sheet1');
jual.setSheetProps({ name: 'Penjualan' });
jual.setValues('A1', [KOLOM_PENJUALAN]);
jual.setValues('A2', barisPenjualan(penjualan(20), 2));
jual.setColProps('B', { format: { type: 'date' } });
jual.setColProps('K', { format: { type: 'money', decimals: 0 } });

// satu sel, beberapa cara membacanya
console.log('value   :', jual.value('K2'));                         // angka untuk dihitung
console.log('input   :', jual.input('K2'));                         // rumus yang diketik
console.log('display :', JSON.stringify(jual.display('K2')));       // yang tampil di layar
console.log('format  :', JSON.stringify(jual.cellFormat('K2')));    // format sel (dari kolom K)
console.log('tanggal :', jual.value('B2'), '->', jual.display('B2').text);

// value() bisa berupa error rumus: periksa dengan isError sebelum dipakai sebagai angka
jual.setValues('M1', '=K2/0');
const hasil: CellResult = jual.value('M1');
if (isError(hasil)) console.log('error   :', hasil.code);
else { const angka: CellValue = hasil; console.log('angka   :', angka); }

// ujung data dan tabel di sekitar sebuah sel
const akhir = jual.lastFilled();
const tabel = jual.dataRegion(5, 3);
console.log('terisi  : sampai', wb.address(akhir.r, akhir.c), '| tabel di sekitar D6:', wb.address(tabel.r1, tabel.c1) + ':' + wb.address(tabel.r2, tabel.c2));

// semua baris yang berisi, cepat: baris kosong dilewati. cells memakai id kolom sebagai kunci
let jakarta = 0;
const kolomCabang = jual.colId(2);
jual.forEachFilledRow((r, cells) => { if (r > 0 && cells[kolomCabang] === 'Jakarta') jakarta++; });
console.log('Jakarta :', jakarta, 'transaksi');

// nomor berubah, id tetap: simpan id kalau perlu mengingat sebuah baris
const id = jual.rowId(4);
jual.insertRows('2', 3);
console.log('baris 5 sekarang di nomor', jual.rowIndex(id) + 1);
```
<!-- /contoh -->

<!-- hasil: 04-04-membaca.ts -->
```text
value   : 752400
input   : =H2*I2*(1-J2)
display : {"text":"Rp 752.400","align":"right","kind":"number"}
format  : {"type":"money","decimals":0}
tanggal : 46296 -> 01/10/2026
error   : #DIV/0!
terisi  : sampai M21 | tabel di sekitar D6: A1:K21
Jakarta : 9 transaksi
baris 5 sekarang di nomor 8
```
<!-- /hasil -->

| Fungsi | Hasilnya | Dipakai untuk |
|---|---|---|
| `value(alamat)` | nilai jadi: hasil rumus, atau isi apa adanya. Kosong: `null`. Error: `{ code: '#DIV/0!' }`, cek dengan `isError` | menghitung, mengirim ke API |
| `input(alamat)` | teks yang diketik: rumus (`'=H2*I2*(1-J2)'`) atau nilai sebagai teks | formula bar, ekspor teks |
| `display(alamat)` | `{ text, align, kind, color }`: yang tampil di layar setelah format dan locale | laporan, email, PDF |
| `raw(alamat)` | yang disimpan: nilai, atau rumus `{ f, refs, v }` | menyalin apa adanya |
| `cellFormat(alamat)` | format sel, atau format kolomnya. `null` kalau tidak ada | tahu sebuah angka itu uang atau tanggal |
| `style(alamat)` | gaya yang disimpan di sel (tanpa conditional formatting) | menyalin gaya |
| `shownStyle(alamat)` | gaya yang digambar, termasuk conditional formatting | menggambar sendiri |
| `size()` | `{ rows, cols }` | |
| `lastFilled()` | `{ r, c }`: baris dan kolom terakhir yang berisi. `{ r: -1, c: -1 }` kalau kosong | mencari ujung data |
| `dataRegion(r, c)` | kotak tabel yang memuat sel itu, seperti Ctrl+A di Excel | menemukan tabel tanpa tahu ukurannya |
| `forEachFilledRow((r, cells, styles) => …)` | dipanggil untuk setiap baris yang berisi, urut. Baris kosong dilewati | membaca seluruh data, cepat |
| `rowContent(r)` | `{ cells, style }` satu baris, per id kolom | |
| `wb.address(r, c)` | `'K21'` dari nomor | |

`cells` dan `styles` dari `forEachFilledRow` dan `rowContent` adalah objek milik workbook, tidak disalin supaya cepat. Bacalah saja, jangan diubah.

**Nomor berubah, id tetap.** Nomor baris bergeser saat baris disisipkan di atasnya, sedangkan id baris tidak pernah berubah. Kalau kodemu perlu mengingat
"baris pesanan ini" (misalnya di state React), simpan id-nya:

| Fungsi | Artinya |
|---|---|
| `rowId(r)`, `colId(c)` | id baris atau kolom di nomor itu |
| `rowIndex(id)`, `colIndex(id)` | nomor sekarang dari id itu, atau `-1` kalau sudah dihapus |

## 4.5 Gaya dan merge

<!-- contoh: 04-05-gaya.ts -->
```ts
import { createWorkbook } from '@kufayeka/sheet/core';
import type { Style, BorderSide } from '@kufayeka/sheet/core';

// Pelajaran 5: gaya digabung, null membuang satu bagian, border per sisi, gaya dari fungsi, merge.
const wb = createWorkbook();
const inv = wb.sheet('Sheet1');
inv.setValues('A1', [['TB Sinar Jaya'], ['Jl. Raya Bogor 12'], [], ['Kode', 'Barang', 'Qty', 'Harga', 'Total']]);

inv.mergeCells('A1:E1, A2:E2');                             // dua merge sekaligus
inv.setStyle('A1', { bold: true, fontSize: 16, align: 'center', color: '#1a73e8' });
inv.setStyle('A4:E4', { bold: true, fill: '#e8f0fe' });
inv.setStyle('A4:E4', { underline: true });                 // digabung: bold dan fill tetap
console.log('digabung        :', JSON.stringify(inv.style('A4')));
inv.setStyle('A4:E4', { underline: null });                 // null: hanya underline yang dibuang
console.log('null            :', JSON.stringify(inv.style('A4')));

// garis luar: setiap sel mendapat sisi yang ada di pinggir kotak
const garis: BorderSide = { style: 'solid', width: 2, color: '#1a73e8' };
inv.setStyle('A4:E8', (r, c): Style => ({ borders: {
    ...(r === 3 ? { top: garis } : {}), ...(r === 7 ? { bottom: garis } : {}),
    ...(c === 0 ? { left: garis } : {}), ...(c === 4 ? { right: garis } : {})
} }));
console.log('pojok A4        :', Object.keys(inv.style('A4')?.borders ?? {}).join(', '));
inv.setStyle('A4', { borders: { left: null } });            // border juga per sisi
console.log('A4 tanpa kiri   :', Object.keys(inv.style('A4')?.borders ?? {}).join(', '));

console.log('merge           :', JSON.stringify(inv.merges()));
inv.unmergeCells('A2');
console.log('setelah unmerge :', inv.merges().length, 'merge');
```
<!-- /contoh -->

<!-- hasil: 04-05-gaya.ts -->
```text
digabung        : {"bold":true,"fill":"#e8f0fe","underline":true}
null            : {"bold":true,"fill":"#e8f0fe"}
pojok A4        : top, left
A4 tanpa kiri   : top
merge           : [{"r1":0,"c1":0,"r2":0,"c2":4},{"r1":1,"c1":0,"r2":1,"c2":4}]
setelah unmerge : 1 merge
```
<!-- /hasil -->

Cara kerja `setStyle(range, gaya)`:

- **Digabung, bukan diganti.** `{ underline: true }` menambahkan garis bawah; tebal dan warna yang sudah ada tetap.
- **`null` membuang satu bagian.** `{ underline: null }` hanya membuang garis bawah.
- **Border digabung per sisi.** `{ borders: { bottom } }` menambah sisi bawah tanpa membuang sisi lain. `{ borders: null }` membuang semuanya.
- **Fungsi per sel.** `setStyle(range, (r, c, sebelum) => gaya)` untuk gaya yang berbeda di setiap sel, misalnya garis luar sebuah tabel.

Invoice lengkap sebagai halaman React:

<!-- contoh: 04-05-invoice.page.tsx -->
```tsx
import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import { createWorkbook } from '@kufayeka/sheet/core';
import type { Workbook, BorderSide } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';

// Invoice toko: merge, warna, border, format uang dan persen, teks yang turun, lebar kolom, tanpa garis sel.
function buatInvoice(): Workbook {
    const wb = createWorkbook();
    wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
    const inv = wb.sheet('Sheet1');
    inv.setSheetProps({ name: 'INV-2026-0412', hideGridlines: true });
    inv.setValues('A1', [
        ['TB Sinar Jaya'],
        ['Jl. Raya Bogor 12, Jakarta Timur · 021-8400 1234'],
        ['Kepada: CV Bangun Karya', null, null, 'No. INV-2026-0412'],
        ['Kode', 'Barang', 'Qty', 'Harga', 'Jumlah'],
        ['SMN-01', 'Semen Portland 50 kg', 40, 72000, '=C5*D5'],
        ['BSI-13', 'Besi beton 13 mm, potong 6 m sesuai gambar kerja', 25, 128000, '=C6*D6'],
        ['CAT-05', 'Cat tembok 5 kg putih', 6, 145000, '=C7*D7'],
        [null, null, null, 'Subtotal', '=SUM(E5:E7)'],
        [null, null, null, 'PPN 11%', '=E8*0.11'],
        [null, null, null, 'Total', '=E8+E9']
    ]);
    inv.mergeCells('A1:E1, A2:E2, A3:C3, D3:E3');
    inv.setStyle('A1', { bold: true, fontSize: 18, align: 'center', color: '#1a73e8' });
    inv.setStyle('A2', { italic: true, align: 'center', color: '#5f6368' });
    inv.setStyle('D3', { align: 'right', bold: true });
    inv.setStyle('A4:E4', { bold: true, fill: '#1a73e8', color: '#ffffff', align: 'center', valign: 'middle' });
    inv.setStyle('B6', { wrap: 'wrap' });
    inv.setStyle('D5:E10', { format: { type: 'money', decimals: 0 } });
    inv.setStyle('D8:D10', { align: 'right', bold: true });
    inv.setStyle('A10:E10', { fill: '#e8f0fe', bold: true, fontSize: 12 });
    const tipis: BorderSide = { style: 'solid', width: 1, color: '#dadce0' };
    inv.setStyle('A4:E7', { borders: { bottom: tipis } });
    inv.setStyle('D10:E10', { borders: { top: { style: 'double', width: 3, color: '#1a73e8' } } });
    inv.setRowProps('1', { height: 40 });
    inv.setRowProps('4', { height: 30 });
    inv.setRowProps('6', { height: 40 });
    inv.setColProps('A', { width: 80 });
    inv.setColProps('B', { width: 250 });
    inv.setColProps('C', { width: 60 });
    inv.setColProps('D:E', { width: 130 });
    return wb;
}

export default function Invoice() {
    const [wb] = useState(buatInvoice);
    return <div style={{ height: 480 }}><Sheet workbook={wb} fileName="INV-2026-0412" /></div>;
}
```
<!-- /contoh -->

![Invoice TB Sinar Jaya](img/invoice.png)

| Kunci gaya | Nilai |
|---|---|
| `bold`, `italic`, `underline`, `strike` | `true` |
| `color`, `fill` | warna CSS (`'#1a73e8'`): huruf, latar |
| `fontSize` | angka (pt) |
| `font` | nama font |
| `align` | `'left'`, `'center'`, `'right'` |
| `valign` | `'top'`, `'middle'`, `'bottom'` |
| `wrap` | `'wrap'` turun baris, `'clip'` dipotong, tidak diisi: meluber ke sel kosong di sebelahnya |
| `rotate` | derajat (-90 sampai 90), atau `'vertical'` |
| `borders` | `{ top, right, bottom, left }`, setiap sisi `{ style: 'solid' \| 'dashed' \| 'dotted' \| 'double', width, color }` |
| `format` | format angka ([bab 6](06-format.md)) |
| `link` | URL: sel menjadi tautan |

| Fungsi | Artinya |
|---|---|
| `setStyle(range, gaya)` | gabungkan gaya ke setiap sel di range |
| `mergeCells(range)` | gabung setiap range menjadi satu sel. Isinya dari sel kiri atas |
| `unmergeCells(alamat)` | lepas merge yang memuat sel itu |
| `merges()` | `[{ r1, c1, r2, c2 }]` |

## 4.6 Baris dan kolom

<!-- contoh: 04-06-baris-kolom.ts -->
```ts
import { createWorkbook } from '@kufayeka/sheet/core';
import { PRODUK } from './data/toko.js';

// Pelajaran 6: menyisipkan, menghapus, memindah, menyembunyikan, mengatur ukuran, membekukan.
const wb = createWorkbook();
wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
const s = wb.sheet('Sheet1');
s.setValues('A1', [['Kode', 'Produk', 'Harga']]);
s.setValues('A2', PRODUK.slice(0, 5).map((p) => [p[0], p[1], p[5]]));
s.setValues('A8', [['Jumlah produk', '=COUNTA(A2:A6)']]);
const kode = () => [1, 2, 3, 4, 5, 6].map((r) => s.value(r, 0)).filter((v) => v !== null).join(', ');

s.insertRows('4');                                     // satu baris kosong di baris 4
s.setValues('A4', [['CAT-01', 'Cat kayu 1 kg', 65000]]);
console.log('disisipkan :', kode(), '| rumus ikut membesar:', s.input('B9'), '=', s.value('B9'));

s.deleteRows('2');                                     // hapus baris pertama range: range menyusut, bukan #REF!
console.log('dihapus    :', kode(), '| rumus:', s.input('B8'), '=', s.value('B8'));

s.moveRows(3, 1, 1);                                   // 1 baris dari nomor 3 (baris 4) ke depan nomor 1 (baris 2)
console.log('dipindah   :', kode());

s.insertCols('C');                                     // kolom baru di C, Harga bergeser ke D
s.setValues('C1', 'Kategori');
s.setColProps('D', { format: { type: 'money', decimals: 0 }, width: 120 });
s.setColProps('C', { hidden: true });                  // disembunyikan, tetap dihitung
s.setRowProps('1', { height: 32 });
s.setSheetProps({ freezeRows: 1, freezeCols: 1 });     // bekukan judul dan kolom pertama
console.log('kolom D    :', s.value('D1'), '|', s.display('D2').text, '| lebar C', s.colAxis().size(2), 'px (tersembunyi)');
console.log('props      :', JSON.stringify(s.colProps(3)), JSON.stringify(s.rowProps(0)), JSON.stringify(s.sheetProps()));
```
<!-- /contoh -->

<!-- hasil: 04-06-baris-kolom.ts -->
```text
disisipkan : SMN-01, SMN-02, CAT-01, BSI-10, BSI-13, CAT-05 | rumus ikut membesar: =COUNTA(A2:A7) = 6
dihapus    : SMN-02, CAT-01, BSI-10, BSI-13, CAT-05 | rumus: =COUNTA(A2:A6) = 5
dipindah   : BSI-10, SMN-02, CAT-01, BSI-13, CAT-05
kolom D    : Harga | Rp 79.500 | lebar C 0 px (tersembunyi)
props      : {"format":{"type":"money","decimals":0},"width":120} {"height":32} {"name":"Sheet1","freezeRows":1,"freezeCols":1}
```
<!-- /hasil -->

- Baris disisipkan di dalam sebuah range, range itu ikut membesar (`A2:A7`).
- Baris di ujung range dihapus, range menyusut, sama seperti Excel. `#REF!` hanya muncul kalau sel yang dibaca benar-benar hilang semuanya.
- Rumus, nama, aturan, dan komentar ikut barisnya, karena semuanya menyimpan id baris.

| Fungsi | Artinya |
|---|---|
| `insertRows(di, jumlah = 1)` | sisipkan baris kosong: `'4'` atau nomor `3` |
| `deleteRows(baris)` | hapus: `'2'`, `'2:5'`, atau `(nomor, jumlah)` |
| `moveRows(dari, jumlah, ke)` | pindahkan baris supaya berdiri sebelum nomor `ke` |
| `insertCols`, `deleteCols`, `moveCols` | sama untuk kolom: `'C'`, `'B:D'` |
| `setRowProps(baris, props)`, `setColProps(kolom, props)` | props digabung seperti gaya |
| `rowProps(r)`, `colProps(c)` | props baris atau kolom |
| `rowAxis()`, `colAxis()` | ukuran dalam piksel: `count`, `total`, `size(i)`, `start(i)`, `indexAt(px)`. Yang tersembunyi berukuran 0 |
| `setAutoHeights(tinggi)` | tinggi baris otomatis dari teks yang turun. Dipakai grid |

| Props | Artinya |
|---|---|
| `height` (baris), `width` (kolom) | piksel |
| `hidden` | disembunyikan, tetap dihitung rumus |
| `format` (kolom) | format untuk setiap sel di kolom itu yang tidak punya format sendiri |

## 4.7 Sheet

<!-- contoh: 04-07-sheet.ts -->
```ts
import { createWorkbook, isError } from '@kufayeka/sheet/core';

// Pelajaran 7: banyak sheet. Satu sheet per cabang, dan sheet Rekap yang membaca keduanya.
const wb = createWorkbook();
const daftar = () => wb.sheetIds().map((id) => wb.sheetProps(id).name + (wb.sheetProps(id).hidden ? ' (tersembunyi)' : '')).join(', ');

wb.sheet('Sheet1').setSheetProps({ name: 'Jakarta' });
wb.setValues('Jakarta', 'A1', [['Omzet'], [125000000]]);
const bandung: string = wb.duplicateSheet('Jakarta');           // salinan: mengembalikan id sheet baru
wb.sheet(bandung).setSheetProps({ name: 'Bandung' });
wb.setValues('Bandung', 'A2', 98000000);
const rekap: string = wb.addSheet('Rekap');                     // sheet baru di belakang: mengembalikan id
wb.setValues(rekap, 'A1', [['Total omzet', '=Jakarta!A2+Bandung!A2']]);
wb.moveSheet(rekap, 0);                                         // Rekap jadi tab pertama
console.log('sheet         :', daftar());
console.log('total         :', wb.value('Rekap', 'B1'));

wb.setSheetProps('Bandung', { name: 'Bandung Kota' });           // ganti nama: rumus ikut, karena rumus menyimpan id
console.log('rumus Rekap   :', wb.input('Rekap', 'B1'));

wb.hideSheet('Jakarta', true);                                  // tab disembunyikan, tetap dihitung
console.log('sembunyikan   :', daftar(), '| total', wb.value('Rekap', 'B1'));

wb.removeSheet('Bandung Kota');                                 // dihapus: rumus yang membacanya #REF!
const total = wb.value('Rekap', 'B1');
console.log('hapus         :', daftar(), '|', isError(total) ? total.code : total);
wb.undo();                                                      // undo mengembalikan sheet beserta isinya
console.log('undo          :', daftar(), '| total', wb.value('Rekap', 'B1'));
```
<!-- /contoh -->

<!-- hasil: 04-07-sheet.ts -->
```text
sheet         : Rekap, Jakarta, Bandung
total         : 223000000
rumus Rekap   : =Jakarta!A2+'Bandung Kota'!A2
sembunyikan   : Rekap, Jakarta (tersembunyi), Bandung Kota | total 223000000
hapus         : Rekap, Jakarta (tersembunyi) | #REF!
undo          : Rekap, Jakarta (tersembunyi), Bandung Kota | total 223000000
```
<!-- /hasil -->

| Fungsi | Artinya |
|---|---|
| `wb.sheet(nama atau id)` | pegangan sheet: semua fungsi bab ini tanpa parameter sheet, ditambah `id` dan `name` |
| `wb.sheetIds()` | id semua sheet, urut seperti tab |
| `wb.sheetIdByName(nama)` | id dari nama (huruf besar dan kecil tidak dibedakan), atau `null` |
| `wb.addSheet(nama?)` | sheet baru di belakang. Mengembalikan id |
| `wb.duplicateSheet(sheet)` | salinan yang berdiri sendiri. Mengembalikan id |
| `wb.removeSheet(sheet)` | hapus. Rumus yang membacanya jadi `#REF!`, undo mengembalikannya |
| `wb.hideSheet(sheet, true/false)` | sembunyikan tab. Tetap dihitung |
| `wb.moveSheet(sheet, ke)` | pindahkan urutan tab |
| `setSheetProps(props)`, `sheetProps()` | `name`, `hidden`, `freezeRows`, `freezeCols`, `hideGridlines` |
| `wb.sheetShown(sheet)` | apakah sheet ini terlihat oleh orang yang membuka, menurut hak akses ([bab 13](13-hak-akses.md)) |

Mengganti nama sheet tidak merusak rumus: rumus menyimpan id sheet, jadi yang berubah hanya cara rumus itu ditulis.

## 4.8 Pengaturan workbook

`wb.settings()` membaca, `wb.setSettings(patch)` mengubah (digabung, bisa di-undo):

| Kunci | Artinya | Bawaan |
|---|---|---|
| `locale` | cara angka dan tanggal ditulis dan dibaca: `'id-ID'` menulis `Rp 1.250.000` dan `27/10/2026` | `'en-US'` |
| `currency` | mata uang format uang: `'IDR'`, `'USD'`, ... | `'USD'` |
| `names` | named range, diisi lewat `addName` ([5.11](05-rumus.md#511-named-range-dan-subtotal)) | |

## 4.9 Event

Workbook memberi tahu setiap kali sesuatu terjadi. `wb.on(nama, fungsi)` mendaftarkan pendengar dan **mengembalikan fungsi untuk berhenti
mendengarkan**:

<!-- contoh: 04-09-event.ts -->
```ts
import { createWorkbook } from '@kufayeka/sheet/core';
import type { WorkbookEvents } from '@kufayeka/sheet/core';

// Pelajaran 9: semua event workbook, kapan muncul, dan isi datanya. Tipe isi data setiap event ada di WorkbookEvents.
const wb = createWorkbook(null, { user: { id: 'user:rina', name: 'Rina' } });
const s = wb.sheet('Sheet1');
s.setValues('A1', [['Produk', 'Qty'], ['Semen', 10]]);
s.addValidation('B2:B50', { kind: 'number', op: 'gte', a: 0, reject: true, message: 'Qty di {cell} tidak boleh minus' });
s.setTypes({ columns: { C: { kind: 'int' } } });

// fungsi pendengar dengan tipe isi datanya sendiri
const padaOp = (e: WorkbookEvents['op']) => console.log('op       :', e.source, '|', e.ops.map((o) => o.t).join('+'));
const padaReject = (e: WorkbookEvents['reject']) => console.log('reject   :', e.source, '|', e.reason);

// wb.on(nama, fungsi) mengembalikan fungsi untuk berhenti mendengarkan
const off: Array<() => void> = [
    wb.on('op', padaOp),
    wb.on('reject', padaReject),
    wb.on('cellError', (e) => console.log('cellError:', e.address, JSON.stringify(e.value), 'bukan', e.expected)),
    wb.on('saved', (e) => console.log('saved    : versi', e.version)),
    wb.on('access', (e) => console.log('access   : peran', JSON.stringify(e.roles), '| pemilik', e.owner)),
    wb.on('layout', (e) => console.log('layout   : ukuran berubah', e.sheet ? '(satu sheet)' : '(semua sheet)'))
];

const orang = { source: 'user' } as const;
s.setValues('B2', 12, orang);                            // op
s.setValues('B2', -3, orang);                            // reject: validasi
s.setValues('C2', 2.5, orang);                           // cellError lalu reject: tipe kolom
s.setRowProps('2', { height: 40 });                      // op: props baris juga perubahan biasa
wb.undo();                                               // op dengan source undo
wb.saved(wb.pendingPatch(), { version: 7 });             // saved
wb.setAccess([{ who: 'role:kasir', effect: 'allow', action: 'read' }], { user: 'rina', roles: ['kasir'] });   // access, lalu layout
s.setValues('A2', 'Besi', orang);                        // reject: kasir hanya boleh membaca

off.forEach((stop) => stop());                           // berhenti mendengarkan
s.setValues('A3', 'Cat');
console.log('setelah berhenti: perubahan A3 tidak tercetak');
```
<!-- /contoh -->

<!-- hasil: 04-09-event.ts -->
```text
op       : user | cells
reject   : user | Qty di B2 tidak boleh minus
cellError: C2 2.5 bukan a whole number
reject   : user | Expected a whole number in C2 (C)
op       : code | rowProps
op       : undo | rowProps
saved    : versi 7
access   : peran ["kasir"] | pemilik false
layout   : ukuran berubah (semua sheet)
reject   : user | You can only view this here
setelah berhenti: perubahan A3 tidak tercetak
```
<!-- /hasil -->

| Event | Kapan | Isi datanya |
|---|---|---|
| `op` | setiap perubahan yang **diterapkan**: diketik, dari kode, undo, redo, dari komputer lain | `{ ops, source }`. `ops` adalah daftar op (4.12), masing-masing dengan `user` dan `at` (waktu). `source`: `'user'`, `'code'`, `'undo'`, `'redo'`, `'remote'` |
| `reject` | perubahan **ditolak**: validasi, tipe kolom, hak akses, aturan, atau `beforeOp` | `{ op, reason, source }`. `reason` adalah pesan yang tampil di layar |
| `cellError` | nilai tidak sesuai tipe kolomnya (selalu diikuti `reject`) | `{ address, field, value, expected }` |
| `saved` | `wb.saved()` dipanggil | `{ version }` |
| `access` | `wb.setAccess(...)` dipanggil | `{ owner, roles, ui, message }`: hasil hak akses untuk orang itu |
| `layout` | ukuran baris atau kolom berubah tanpa op: tinggi otomatis, atau hak akses yang menyembunyikan sesuatu | `{ sheet }` atau `{}` |

Pola di React:

```jsx
// cara paling mudah: useWorkbook membaca ulang setiap kali ada event
const total = useWorkbook(wb, (w) => w.value('Nota', 'D7'));

// kalau perlu bereaksi langsung pada event: daftarkan di useEffect, dan berhenti di cleanup
useEffect(() => {
    if (!wb) return;
    const off = wb.on('reject', (e) => toast.error(e.reason));
    return off;                      // React memanggilnya saat komponen dilepas
}, [wb]);
```

Fungsi yang diberikan ke `useWorkbook` dijalankan setiap kali ada perubahan, jadi buat seringan mungkin: membaca beberapa sel, bukan `toJSON()` atau
loop seluruh sheet. Prop `onOp`, `onReject`, dan `onCellError` di `<Sheet>` adalah event yang sama ([3.4](03-komponen-sheet.md#34-mendengar-perubahan)).

## 4.10 `beforeOp`: memeriksa setiap perubahan

`beforeOp` adalah pintu yang dilewati **setiap** op sebelum diterapkan. Dipasang sekali saat membuat workbook:

<!-- contoh: 04-10-beforeop.ts -->
```ts
import { createWorkbook } from '@kufayeka/sheet/core';
import type { Op, OpContext } from '@kufayeka/sheet/core';

// Pelajaran 10: beforeOp, pintu yang dilewati setiap perubahan. Bisa meloloskan, mengubah, membuang, atau menolak.
function periksa(op: Op, ctx: OpContext): Op | null | { reject: string } {
    // hanya perubahan isi sel dari orang yang diperiksa; kode aplikasi dibiarkan
    if (op.t !== 'cells' || ctx.source !== 'user') return op;
    const kolom = (col: string) => ctx.workbook.colIndex(op.sheet ?? '', col);
    // menolak: Qty (kolom B) lebih dari stok di D1
    const stok = ctx.workbook.value(op.sheet ?? '', 0, 3);
    if (op.changes.some((ch) => kolom(ch.col) === 1 && typeof ch.after === 'number' && typeof stok === 'number' && ch.after > stok)) {
        return { reject: 'Qty melebihi stok (' + stok + ')' };
    }
    // membuang diam-diam: isi kolom E (catatan internal) tidak boleh diubah orang
    const changes = op.changes.filter((ch) => kolom(ch.col) !== 4);
    if (!changes.length) return null;
    // mengubah: kode produk (kolom A) selalu huruf besar
    return { ...op, changes: changes.map((ch) => (kolom(ch.col) === 0 && typeof ch.after === 'string' ? { ...ch, after: ch.after.toUpperCase() } : ch)) };
}

const wb = createWorkbook(null, { beforeOp: periksa });
const s = wb.sheet('Sheet1');
s.setValues('C1', [['Stok', 50]]);
const ditolak: string[] = [];
wb.on('reject', (e) => ditolak.push(e.reason));

const orang = { source: 'user' } as const;
s.setValues('A2', 'smn-01', orang);
s.setValues('B2', 40, orang);
s.setValues('B2', 80, orang);
s.setValues('E2', 'catatan', orang);
console.log('A2 diubah jadi huruf besar :', s.value('A2'));
console.log('B2: 80 ditolak, 40 tetap   :', s.value('B2'));
console.log('E2 dibuang diam-diam       :', s.value('E2'));
console.log('ditolak                    :', ditolak.join(' / '));
s.setValues('B2', 999);                                  // kode aplikasi: source 'code', dibiarkan
console.log('dari kode                  :', s.value('B2'));
```
<!-- /contoh -->

<!-- hasil: 04-10-beforeop.ts -->
```text
A2 diubah jadi huruf besar : SMN-01
B2: 80 ditolak, 40 tetap   : 40
E2 dibuang diam-diam       : null
ditolak                    : Qty melebihi stok (50)
dari kode                  : 999
```
<!-- /hasil -->

`beforeOp(op, ctx)` menerima op (4.12) dan `ctx` berisi `{ source, user, workbook }`. Kembalikan salah satu dari empat:

| Dikembalikan | Akibatnya |
|---|---|
| `op` | diloloskan apa adanya |
| salinan op yang diubah | yang diterapkan adalah salinan itu (contoh: kode produk jadi huruf besar) |
| `null` atau `false` | op itu dibuang diam-diam, op lain di perubahan yang sama tetap jalan |
| `{ reject: 'alasan' }` | **seluruh** perubahan ditolak, event `reject` membawa alasannya, dan alasannya tampil di layar |

Kapan memakai `beforeOp` dan kapan memakai fitur bawaan:

| Kebutuhan | Pakai |
|---|---|
| angka harus di antara 1 dan 500, daftar pilihan | validasi data ([7.4](07-data.md#74-validasi-data)) |
| kolom harus bilangan bulat, tanggal | tipe kolom ([10.2](10-aturan.md#102-tipe-kolom)) |
| kolom tertentu hanya boleh dibaca, per orang | aturan dan hak akses ([bab 10](10-aturan.md), [bab 13](13-hak-akses.md)) |
| syarat yang membaca sel lain ("qty tidak boleh melebihi stok"), atau mengubah isi | `beforeOp` |

`beforeOp` hanya berjalan di browser itu. Pemeriksaan yang harus aman dari orang yang mengakali browser tetap dilakukan di server ([bab 12](12-server.md)).

## 4.11 Undo, redo, `source`, dan `apply`

Setiap perubahan adalah daftar op. Daftar itu bisa dicatat, dikirim, dan diterapkan di workbook lain:

<!-- contoh: 04-11-undo.ts -->
```ts
import { createWorkbook } from '@kufayeka/sheet/core';
import type { Op, WorkbookEvents } from '@kufayeka/sheet/core';

// Pelajaran 11: undo dan redo, source, dan apply: perubahan sebagai daftar op yang bisa dicatat, dikirim, dan diterapkan di workbook lain.
const kasir = createWorkbook(null, { user: { id: 'k1', name: 'Kasir 1' }, now: () => new Date(Date.UTC(2026, 9, 27, 9, 0)) });
const log: Array<WorkbookEvents['op']> = [];
kasir.on('op', (e) => log.push(e));
const s = kasir.sheet('Sheet1');

s.setValues('A1', [['Barang', 'Qty'], ['Semen', 10]]);   // perubahan 1
s.setStyle('A1:B1', { bold: true });                     // perubahan 2
s.insertRows('2');                                       // perubahan 3
console.log('perubahan  :', log.map((e) => e.ops.map((o) => o.t).join('+')).join(', '));
console.log('bisa undo  :', kasir.canUndo(), '| bisa redo:', kasir.canRedo(), '| revision', kasir.revision);

kasir.undo(); kasir.undo();
console.log('dua undo   :', s.value('A1'), '| gaya A1:', s.style('A1') ?? 'tidak ada', '| bisa redo:', kasir.canRedo());
kasir.redo();
console.log('redo       :', JSON.stringify(s.style('A1')));
console.log('op dicatat :', log[0].ops[0].at, 'oleh', JSON.stringify(log[0].ops[0].user));

// op yang sama diterapkan di workbook lain yang isinya sama (server, atau komputer lain)
const server = createWorkbook(kasir.toJSON());
const ops: Op[] = log[0].ops;
const sesudah: Op[] | null = server.apply([{ t: 'cells', sheet: server.sheetIds()[0], changes: [{ row: server.rowId('Sheet1', 1), col: server.colId('Sheet1', 1), before: 10, after: 25 }] }], { source: 'remote' });
console.log('apply      :', server.value('Sheet1', 'B2'), '| diterapkan', sesudah?.length, 'op | masuk undo server:', server.canUndo(), '| op kasir pertama:', ops[0].t);
```
<!-- /contoh -->

<!-- hasil: 04-11-undo.ts -->
```text
perubahan  : cells, styles, insertRows
bisa undo  : true | bisa redo: false | revision 3
dua undo   : Barang | gaya A1: tidak ada | bisa redo: true
redo       : {"bold":true}
op dicatat : 2026-10-27T09:00:00.000Z oleh {"id":"k1","name":"Kasir 1"}
apply      : 25 | diterapkan 1 op | masuk undo server: false | op kasir pertama: cells
```
<!-- /hasil -->

**`source`** mengatakan dari mana sebuah perubahan datang. Ini menentukan apa yang memeriksanya dan apakah perubahan itu masuk undo:

| `source` | Artinya | Diperiksa validasi, tipe, hak akses | `beforeOp` | Masuk undo |
|---|---|---|---|---|
| `'user'` | orang mengetik, paste, fill, atau kodemu menulis atas nama orang | ya | ya | ya |
| `'code'` (bawaan) | kode aplikasimu | tidak | ya | ya |
| `'undo'`, `'redo'` | undo dan redo | tidak | ya | (pindah tumpukan) |
| `'remote'` | perubahan dari komputer lain atau server | tidak | tidak | tidak |

| Fungsi | Artinya |
|---|---|
| `wb.undo()`, `wb.redo()` | mundur atau maju satu perubahan. `false` kalau tidak ada |
| `wb.canUndo()`, `wb.canRedo()` | apakah ada yang bisa di-undo atau di-redo |
| `wb.apply(ops, { source })` | terapkan daftar op sebagai satu perubahan. Mengembalikan op yang diterapkan, atau `null` kalau ditolak. Semua fungsi bab ini akhirnya memanggil ini |
| `wb.revision` | angka yang naik setiap ada perubahan |
| `wb.tick()` | hitung ulang `NOW()` dan `TODAY()` |

Opsi `createWorkbook(doc, opsi)`:

| Opsi | Artinya |
|---|---|
| `user` | `{ id, name }` orang yang sedang bekerja. Tercatat di setiap op dan di komentar |
| `beforeOp` | 4.10 |
| `now` | jam workbook: `() => new Date(...)`. Untuk `TODAY()`, `NOW()`, waktu op dan komentar. Berguna untuk test |
| `undoLimit` | berapa langkah undo diingat. Bawaan 200 |

## 4.12 Jenis op

Isi `ops` di event `op` dan yang dilihat `beforeOp`. `sheet` adalah id sheet; baris dan kolom selalu id, jadi op yang sama tetap benar walaupun
diterapkan di workbook yang barisnya sudah bergeser.

| `op.t` | Isinya |
|---|---|
| `cells` | `changes: [{ row, col, before, after }]`: isi sel. Rumus berbentuk `{ f, refs }` |
| `styles` | `changes: [{ row, col, before, after }]`: gaya sel |
| `insertRows`, `deleteRows` | `rows: [{ id, key, cells, style, props }]`. `key` menentukan urutan |
| `insertCols`, `deleteCols` | `cols: [{ id, key, props }]` |
| `moveRows`, `moveCols` | `moves: [{ id, before, after }]`: key lama dan baru |
| `rowProps`, `colProps` | `changes: [{ id, before, after }]` |
| `sheetProps` | `before`, `after`: props sheet |
| `addSheet`, `removeSheet` | `sheet`: isi sheet lengkap |
| `moveSheet` | `before`, `after`: key urutan sheet |
| `settings` | `before`, `after`: pengaturan workbook |

Setiap op juga membawa `user` (dari opsi `user`) dan `at` (waktu ISO). Menghapus baris di ujung sebuah range menghasilkan dua op dalam satu perubahan:
`cells` (rumus yang range-nya menyusut) lalu `deleteRows`.

## 4.13 Editor hak akses di luar sheet

Contoh yang menggabungkan isi bab ini dengan `<Sheet>`. Aplikasimu punya panel sendiri di samping sheet:

1. Orang **memilih range** di sheet. `onSelectionChange` memberi `{ sheet, active, ranges, address }`, dengan `address` seperti `'C2:C5'`. Event ini muncul sekali setelah mouse dilepas, jadi panel tidak berkedip selama drag.
2. Di panel, orang memilih **peran** dan **mode** (boleh diubah, hanya baca, tersembunyi, tidak terlihat), lalu menekan Tambah.
3. Aturan itu jadi **satu baris baru** (`who`, `effect`, `action`, `where`) yang nanti disimpan ke tabel database.
4. `<Sheet access={{ rows, who, view: 'setup', selected, onSelect }}>` menggambar kotak warna who di setiap sel yang kena aturan, dan memberi
   garis pada aturan yang dipilih. Mode "Lihat sebagai" mengganti `view` ke `'live'` dan `who` ke orang itu, supaya hasilnya bisa dicoba.

Semua bagian layar pengaturan ini dijelaskan langkah demi langkah di [bagian F bab 13](13-hak-akses.md#1327-menyalakan-mode-pengaturan).

![Editor hak akses: mode pengaturan](img/editor-akses.png)

<!-- contoh: 04-13-editor-akses.page.tsx -->
```tsx
import { useEffect, useRef, useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import type { SheetSelection, SheetHandle } from '@kufayeka/sheet';
import { createWorkbook, validateAccess, accessColor } from '@kufayeka/sheet/core';
import type { Workbook, AccessRow, Who } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';

// Layar pengaturan hak akses buatan aplikasimu sendiri, di luar sheet:
// 1. Mode "Pengaturan": setiap sel yang kena aturan diberi kotak warna kecil, satu per who
// 2. pilih range di sheet, pilih siapa dan aturannya, Tambah: satu baris baru
// 3. klik baris di daftar: range-nya bergaris dan terpilih di sheet. Klik kotak di sel: barisnya terpilih di daftar
// 4. Mode "Lihat sebagai ...": sheet seperti yang dilihat orang itu (gembok di sel hanya-baca, mata di sel tersembunyi)
// 5. baris-barisnya disimpan ke tabel database

function buatStok(): Workbook {
    const wb = createWorkbook();
    wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
    const s = wb.sheet('Sheet1');
    s.setSheetProps({ name: 'Produk', freezeRows: 1 });
    s.setValues('A1', [
        ['Kode', 'Produk', 'Harga beli', 'Harga jual', 'Stok'],
        ['SMN-01', 'Semen 50 kg', 64000, 72000, 420],
        ['BSI-10', 'Besi 10 mm', 68000, 79500, 260],
        ['CAT-05', 'Cat 5 kg', 118000, 145000, 64],
        ['PSR-01', 'Pasir m3', 245000, 290000, 31]
    ]);
    s.setStyle('A1:E1', { bold: true, fill: '#e8f0fe' });
    s.setColProps('C:D', { format: { type: 'money', decimals: 0 } });
    s.setColProps('B', { width: 130 });
    return wb;
}

// aturan awal: pemilik boleh semua, kasir dan gudang membaca tabelnya, gudang mengubah stok
const ATURAN_AWAL: AccessRow[] = [
    { who: 'user:yeka', effect: 'allow', action: '*' },
    { who: 'role:kasir', effect: 'allow', action: 'read', where: 'Produk!A1:E5' },
    { who: 'role:gudang', effect: 'allow', action: 'read', where: 'Produk!A1:E5' },
    { who: 'role:gudang', effect: 'allow', action: 'edit', where: 'Produk!col:Stok' }
];
// mode layar: pengaturan, atau sheet seperti dilihat seseorang (akun + role-nya, seperti dari sesi login aplikasimu)
const MODE: Record<string, { nama: string; who: Who }> = {
    setup: { nama: 'Pengaturan', who: { user: 'yeka' } },
    rina: { nama: 'Lihat sebagai Rina (kasir)', who: { user: 'rina', roles: ['kasir'] } },
    joko: { nama: 'Lihat sebagai Joko (gudang)', who: { user: 'joko', roles: ['gudang'] } }
};
// pilihan aturan untuk satu range: effect + action, dengan kata yang dimengerti orang
const ATURAN = {
    edit: { effect: 'allow', action: 'edit', label: 'boleh diubah' },
    read: { effect: 'allow', action: 'read', label: 'hanya baca' },
    hidden: { effect: 'deny', action: 'read', label: 'tersembunyi (•••)' },
    invisible: { effect: 'deny', action: 'see', label: 'tidak terlihat' }
} as const;
type Pilihan = keyof typeof ATURAN;

export default function EditorAkses() {
    const [wb] = useState(buatStok);
    const sheet = useRef<SheetHandle>(null);
    const [rows, setRows] = useState<AccessRow[]>(ATURAN_AWAL);
    const [pilihan, setPilihan] = useState<SheetSelection | null>(null);   // seleksi terakhir di sheet
    const [dipilih, setDipilih] = useState<number | null>(null);           // baris aturan yang dipilih
    const [siapa, setSiapa] = useState('role:kasir');
    const [aturan, setAturan] = useState<Pilihan>('read');
    const [mode, setMode] = useState('setup');

    // satu aturan baru = satu baris baru, langsung terpilih
    function tambah() {
        if (!pilihan) return;
        const { effect, action } = ATURAN[aturan];
        setRows([...rows, { who: siapa, effect, action, where: pilihan.sheet.name + '!' + pilihan.address }]);
        setDipilih(rows.length);
    }
    const hapus = (i: number) => { setRows(rows.filter((_, j) => j !== i)); setDipilih(null); };
    // memilih baris di daftar: range-nya juga terpilih di sheet
    function pilih(i: number) {
        setDipilih(i);
        const where = rows[i].where;
        if (where) sheet.current?.select(where.includes('!') ? where.slice(where.indexOf('!') + 1) : where);
    }
    // sheet yang dilihat sebagai orang lain: tidak ada yang dipilih
    useEffect(() => { if (mode !== 'setup') setDipilih(null); }, [mode]);
    const masalah = validateAccess(rows);

    return (
        <div style={{ display: 'flex', height: 520, font: '13px system-ui' }}>
            <Sheet ref={sheet} workbook={wb} style={{ flex: 1 }} onSelectionChange={setPilihan}
                access={{ rows, who: MODE[mode].who, view: mode === 'setup' ? 'setup' : 'live', selected: dipilih, onSelect: setDipilih }} />
            <aside className="editor-akses" style={{ width: 380, padding: 12, borderLeft: '1px solid #dadce0', overflow: 'auto' }}>
                <h3 style={{ margin: '0 0 8px' }}>Aturan akses</h3>
                <p>
                    Mode <select className="lihat-sebagai" value={mode} onChange={(e) => setMode(e.target.value)}>
                        {Object.entries(MODE).map(([id, m]) => <option key={id} value={id}>{m.nama}</option>)}
                    </select>
                </p>
                <p>Range terpilih: <b className="range-terpilih">{pilihan ? pilihan.sheet.name + '!' + pilihan.address : '-'}</b></p>
                <p>
                    <select className="pilih-peran" value={siapa} onChange={(e) => setSiapa(e.target.value)}>
                        <option value="role:kasir">role:kasir</option><option value="role:gudang">role:gudang</option>
                        <option value="user:rina">user:rina</option><option value="*">semua orang</option>
                    </select>{' '}
                    <select className="pilih-mode" value={aturan} onChange={(e) => setAturan(e.target.value as Pilihan)}>
                        {(Object.keys(ATURAN) as Pilihan[]).map((k) => <option key={k} value={k}>{ATURAN[k].label}</option>)}
                    </select>{' '}
                    <button className="tambah-aturan" onClick={tambah} disabled={!pilihan || mode !== 'setup'}>Tambah</button>
                </p>
                <table className="daftar-aturan" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr><th /><th align="left">who</th><th align="left">effect</th><th align="left">action</th><th align="left">where</th><th /></tr></thead>
                    <tbody>
                        {rows.map((r, i) => (
                            <tr key={i} onClick={() => pilih(i)} style={{ borderTop: '1px solid #eee', cursor: 'pointer', background: i === dipilih ? '#e8f0fe' : undefined }}>
                                {/* warna yang sama dengan kotak di sheet */}
                                <td><i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: accessColor(r.who) }} /></td>
                                <td>{r.who}</td><td>{r.effect}</td><td>{r.action}</td><td>{r.where ?? ''}</td>
                                <td><button onClick={(e) => { e.stopPropagation(); hapus(i); }}>✕</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <p style={{ color: masalah.length ? '#d93025' : '#188038' }}>{masalah.length ? masalah.map((m) => 'baris ' + (m.row + 1) + ': ' + m.problem).join('; ') : 'Aturan sah, siap disimpan'}</p>
            </aside>
        </div>
    );
}
```
<!-- /contoh -->

Isi seleksi yang diberikan `onSelectionChange` dan `ref.getSelection()`:

| Kunci | Contoh | Artinya |
|---|---|---|
| `sheet` | `{ id: '…', name: 'Produk' }` | sheet yang sedang tampil |
| `active` | `{ r: 1, c: 2, address: 'C2' }` | sel aktif |
| `ranges` | `[{ r1: 1, c1: 2, r2: 4, c2: 2, address: 'C2:C5' }]` | setiap kotak yang dipilih. Dengan Ctrl bisa lebih dari satu |
| `address` | `'C2:C5'` atau `'C2:C5, E2'` | semua kotak sebagai satu teks: langsung bisa dipakai sebagai `range` sebuah aturan |

Bentuk baris aturan, cara memutuskannya, dan cara server memakai baris yang sama dijelaskan di [bab 13](13-hak-akses.md). Semua yang ada di contoh ini, dari
memilih range sampai "Lihat sebagai", diuji di Chrome dengan input mouse sungguhan (`test/grid-access-editor.test.js`).

## 4.14 TypeScript

Paket ini membawa tipe TypeScript untuk semua yang ada di bab ini. Import tipenya dengan `import type`:

```tsx
import { Sheet, useWorkbook } from '@kufayeka/sheet';
import type { Workbook, SheetApi, SheetSelection, SheetHandle, AccessRow, Style } from '@kufayeka/sheet';
import { createWorkbook } from '@kufayeka/sheet/core';

const [wb, setWb] = useState<Workbook | null>(null);
const ref = useRef<SheetHandle>(null);
const onSelect = (sel: SheetSelection) => setRange(sel.address);    // "C2:C5"
```

| Tipe | Isinya |
|---|---|
| `Workbook` | hasil `createWorkbook()`: semua fungsi bab ini |
| `SheetApi` | hasil `wb.sheet('Produk')` |
| `SheetSelection` | isi `onSelectionChange` dan `ref.getSelection()` (4.13) |
| `SheetHandle` | yang bisa diminta lewat `ref` ([3.6](03-komponen-sheet.md#36-memberi-perintah-lewat-ref)) |
| `SheetProps` | props `<Sheet>` |
| `CellValue`, `CellResult`, `CellError` | isi sel, hasil `value()`, dan error rumus |
| `Style`, `Format`, `Borders` | gaya dan format (4.5, [bab 6](06-format.md)) |
| `Op`, `Source`, `WorkbookEvents`, `WorkbookOptions` | op, `source`, isi data setiap event, opsi `createWorkbook` |
| `WorkbookDoc`, `Patch` | yang disimpan (`toJSON()`) dan yang berubah (`pendingPatch()`) |
| `AccessRow`, `Who`, `AccessInfo`, `AccessUi` | hak akses ([bab 13](13-hak-akses.md)) |
| `ValidationSpec`, `ConditionalSpec`, `PivotSpec`, `TypesSpec` | aturan validasi, conditional formatting, pivot, tipe kolom |

Tipe ini ditulis tangan dan diuji: `test/types.test.js` mengompilasi kode host contoh dengan `strict`, termasuk kesalahan yang **harus** ditolak
(salah ketik nama gaya, `source` yang tidak ada, nama event yang salah, prop yang salah ketik). Kalau tipe menjadi terlalu longgar, test itu gagal.

[Daftar isi](../README.md#daftar-isi) · Sebelumnya: [3. Komponen `<Sheet>`](03-komponen-sheet.md) · Berikutnya: [5. Rumus](05-rumus.md)
