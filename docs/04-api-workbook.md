# 4. API workbook

[Daftar isi](../README.md#daftar-isi) · Sebelumnya: [3. Komponen `<Sheet>`](03-komponen-sheet.md) · Berikutnya: [5. Rumus](05-rumus.md)

Bab ini membahas semua yang bisa kodemu lakukan ke isi workbook: mengisi dan membaca sel, memberi gaya, mengatur baris, kolom, dan sheet, serta undo dan
op. Contohnya diambil dari sebuah toko bangunan dengan daftar stok, invoice, daftar harga, omzet per cabang, dan catatan penjualan. Data contohnya ada di
[`examples/data/toko.js`](examples/data/toko.js) dan dipakai lagi di bab-bab berikutnya.

Dua hal berlaku di seluruh bab:

- **Alamat.** Contoh di sini memakai `const s = wb.sheet('Stok')`, jadi parameter sheet tidak ditulis: `s.setValues('A1', ...)`. Kalau kamu memanggil
  `wb` langsung, sheet (nama atau id) jadi parameter pertama: `wb.setValues('Stok', 'A1', ...)`. Alamat boleh berupa teks (`'B2'`, `'A1:C9'`,
  `'2:5'`, `'B:D'`, `'A1:E1, A2:E2'`) atau nomor yang dihitung dari 0 (`s.value(1, 0)` sama dengan `s.value('A2')`). Penjelasannya ada di
  [2.2](02-konsep.md#22-alamat-sel).
- **Satu panggilan = satu perubahan.** Semua fungsi yang mengubah isi menerima `how` sebagai parameter terakhir (`{ source: 'user' }` dan seterusnya,
  lihat [2.5](02-konsep.md#25-perubahan-event-dan-undo)). Satu panggilan juga dibatalkan oleh satu kali undo, sebanyak apa pun sel yang disentuhnya.

- [4.1 Menulis isi](#41-menulis-isi)
- [4.2 Membaca isi](#42-membaca-isi)
- [4.3 Gaya dan merge](#43-gaya-dan-merge)
- [4.4 Baris dan kolom](#44-baris-dan-kolom)
- [4.5 Sheet](#45-sheet)
- [4.6 Pengaturan workbook](#46-pengaturan-workbook)
- [4.7 Undo, redo, dan apply](#47-undo-redo-dan-apply)
- [4.8 Jenis op](#48-jenis-op)

## 4.1 Menulis isi

Daftar stok berisi 12 produk. Kolom Nilai stok dan Margin dihitung dengan rumus per baris, dan di bawahnya ada dua angka ringkasan:

<!-- contoh: 04-isi.js -->
```js
import { createWorkbook } from '@kufayeka/sheet/core';
import { PRODUK, KOLOM_PRODUK } from './data/toko.js';

// Daftar stok toko bangunan: isi sel, rumus per baris, membaca kembali.
const wb = createWorkbook();
wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
const stok = wb.sheet('Sheet1');
stok.setSheetProps({ name: 'Stok' });

// judul kolom + satu baris per produk; kolom I dan J dihitung
stok.setValues('A1', [[...KOLOM_PRODUK, 'Nilai stok', 'Margin']]);
stok.setValues('A2', PRODUK.map((p, i) => [...p, `=E${i + 2}*G${i + 2}`, `=(F${i + 2}-E${i + 2})/F${i + 2}`]));
const akhir = PRODUK.length + 1;
stok.setColProps('E:F', { format: { type: 'money', decimals: 0 } });   // harga beli dan jual
stok.setColProps('I', { format: { type: 'money', decimals: 0 } });     // nilai stok
stok.setColProps('J', { format: { type: 'percent', decimals: 1 } });   // margin

// banyak sel sekaligus, isi dan gaya, sebagai satu perubahan
stok.setBlock([
    { at: `H${akhir + 2}`, value: 'Total nilai stok', style: { bold: true } },
    { at: `I${akhir + 2}`, value: `=SUM(I2:I${akhir})`, style: { bold: true, format: { type: 'money', decimals: 0 } } },
    { at: `H${akhir + 3}`, value: 'Produk habis', style: { bold: true } },
    { at: `I${akhir + 3}`, value: `=COUNTIF(G2:G${akhir}, 0)`, style: { bold: true } }
]);

console.log('nilai stok semen :', stok.value('I2'), '| tampil:', stok.display('I2').text);
console.log('total nilai stok :', stok.display(`I${akhir + 2}`).text);
console.log('produk habis     :', stok.value(`I${akhir + 3}`));
console.log('isi I2 (rumus)   :', stok.input('I2'), '| margin:', stok.display('J2').text);
console.log('terisi sampai    :', stok.lastFilled(), '=', wb.address(stok.lastFilled().r, stok.lastFilled().c));

// membaca baris demi baris: produk yang stoknya di bawah minimum
const kurang = [];
stok.forEachFilledRow((r) => {
    if (r === 0 || r >= akhir) return;
    if (stok.value(r, 6) < stok.value(r, 7)) kurang.push(stok.value(r, 1) + ' (' + stok.value(r, 6) + '/' + stok.value(r, 7) + ')');
});
console.log('perlu dipesan    :', kurang.join(', '));

// mengosongkan isi (gaya tetap), lalu undo
stok.clear('G9');
console.log('setelah clear G9 :', stok.value('G9'), '| produk habis:', stok.value(`I${akhir + 3}`));
wb.undo();
console.log('setelah undo     :', stok.value('G9'), '| produk habis:', stok.value(`I${akhir + 3}`));
```
<!-- /contoh -->

<!-- hasil: 04-isi.js -->
```text
nilai stok semen : 26880000 | tampil: Rp 26.880.000
total nilai stok : Rp 146.701.000
produk habis     : 1
isi I2 (rumus)   : =E2*G2 | margin: 11,1%
terisi sampai    : { r: 15, c: 9 } = J16
perlu dipesan    : Semen putih 40 kg (35/40), Cat tembok 25 kg putih (12/15), Keramik 40x40 putih (0/50)
setelah clear G9 : null | produk habis: 0
setelah undo     : 0 | produk habis: 1
```
<!-- /hasil -->

Yang perlu dicatat:

- `setValues(alamat, isi)` menerima satu nilai (`'Kategori'`), satu baris (`[['a', 'b']]`), atau tabel (`[[...], [...]]`). Tabel ditulis mulai dari
  sel di alamat itu ke kanan dan ke bawah. Teks yang diawali `=` menjadi rumus.
- `setBlock([...])` menulis sel-sel yang letaknya terpisah, masing-masing dengan isi dan gayanya, sebagai **satu** perubahan. Satu undo membatalkan
  semuanya. Cocok untuk baris total, kepala laporan, atau apa pun yang kalau dibatalkan harus hilang bersama.
- `clear` mengosongkan isi tetapi membiarkan gaya, sama seperti tombol Delete di Google Sheets. Rumus yang membaca sel itu langsung dihitung ulang.
- Format kolom (`setColProps('E:F', { format })`) berlaku untuk setiap sel di kolom itu yang tidak punya format sendiri. Format dibahas lengkap di
  [bab 6](06-format.md).

| Fungsi | Artinya |
|---|---|
| `setValues(alamat, isi)` | tulis satu nilai, satu baris, atau tabel mulai dari alamat. `null` mengosongkan sel |
| `setValues(alamat, (r, c, sebelum) => isi)` | isi tiap sel di range dari fungsi. `undefined` berarti sel itu tidak diubah |
| `setBlock([{ at, value, style }])` | banyak sel di mana saja dalam satu perubahan. `at` adalah alamat teks, atau tulis `r` dan `c`. `value` dan `style` boleh salah satu saja |
| `clear(range)` | kosongkan isi range (bisa beberapa: `'A2:A9, C2:C9'`), gaya tetap |

## 4.2 Membaca isi

Satu sel bisa dibaca dengan lima cara, dan masing-masing menjawab pertanyaan yang berbeda. Contohnya memakai 20 baris penjualan:

<!-- contoh: 04-baca.js -->
```js
import { createWorkbook } from '@kufayeka/sheet/core';
import { penjualan, KOLOM_PENJUALAN, barisPenjualan } from './data/toko.js';

// Penjualan seminggu: semua cara membaca satu sel, dan mencari tabel di sekitar sebuah sel.
const wb = createWorkbook();
wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
const jual = wb.sheet('Sheet1');
jual.setSheetProps({ name: 'Penjualan' });
jual.setValues('A1', [KOLOM_PENJUALAN]);
jual.setValues('A2', barisPenjualan(penjualan(20), 2));
jual.setColProps('B', { format: { type: 'date' } });
jual.setColProps('I', { format: { type: 'money', decimals: 0 } });
jual.setColProps('J', { format: { type: 'percent', decimals: 0 } });
jual.setColProps('K', { format: { type: 'money', decimals: 0 } });

// satu sel, lima cara membacanya
const disimpan = jual.raw('K2');                         // { f, refs }: referensinya disimpan sebagai id baris dan kolom
console.log('raw K2     :', disimpan.f, '+', disimpan.refs.length, 'referensi', disimpan.refs.map((x) => x.k).join(', '));
console.log('input K2   :', jual.input('K2'));
console.log('value K2   :', jual.value('K2'));
console.log('display K2 :', JSON.stringify(jual.display('K2')));
console.log('format K2  :', JSON.stringify(jual.cellFormat('K2')), '(dari kolom K)');
console.log('tanggal B2 :', jual.value('B2'), '->', jual.display('B2').text);

// ukuran sheet dan tabel yang berisi data
console.log('ukuran     :', JSON.stringify(jual.size()), '| terisi sampai', wb.address(jual.lastFilled().r, jual.lastFilled().c));
const t = jual.dataRegion(5, 3);                         // tabel yang memuat sel D6, seperti Ctrl+A di Excel
console.log('tabel D6   :', wb.address(t.r1, t.c1) + ':' + wb.address(t.r2, t.c2));

// nomor dan id: nomor berubah saat baris disisipkan, id tidak
const id = jual.rowId(4);
jual.insertRows('2', 3);
console.log('baris 5 kini nomor', jual.rowIndex(id) + 1, '| kolom Qty nomor', jual.colIndex(jual.colId(7)) + 1);
```
<!-- /contoh -->

<!-- hasil: 04-baca.js -->
```text
raw K2     : =⟦0⟧*⟦1⟧*(1-⟦2⟧) + 3 referensi cell, cell, cell
input K2   : =H2*I2*(1-J2)
value K2   : 752400
display K2 : {"text":"Rp 752.400","align":"right","kind":"number"}
format K2  : {"type":"money","decimals":0} (dari kolom K)
tanggal B2 : 46296 -> 01/10/2026
ukuran     : {"rows":1000,"cols":26} | terisi sampai K21
tabel D6   : A1:K21
baris 5 kini nomor 8 | kolom Qty nomor 8
```
<!-- /hasil -->

| Fungsi | Hasilnya | Dipakai untuk |
|---|---|---|
| `value(alamat)` | nilai jadi: hasil rumus, atau isi sel apa adanya. Kosong: `null`. Error: objek `{ code: '#DIV/0!' }` (cek dengan `isError`) | menghitung, membandingkan, mengirim ke API |
| `input(alamat)` | teks yang diketik orang: rumus sebagaimana terbaca sekarang (`'=H2*I2*(1-J2)'`), atau nilai sebagai teks | kotak rumus, ekspor ke teks |
| `display(alamat)` | `{ text, align, kind, color }`: yang tampil di layar setelah format dan locale | laporan, PDF, email |
| `raw(alamat)` | yang disimpan: nilai, atau rumus `{ f, refs }` dengan referensi berupa id | menyalin sel apa adanya, alat sendiri |
| `cellFormat(alamat)` | format sel, atau format kolomnya kalau sel tidak punya. `null` kalau tidak ada | mengetahui sebuah angka itu uang, persen, atau tanggal |
| `style(alamat)` | gaya yang disimpan di sel itu (tanpa conditional formatting) | menyalin gaya |
| `shownStyle(alamat)` | gaya yang digambar: gaya sel ditambah hasil conditional formatting ([bab 6](06-format.md)) | menggambar sendiri |
| `size()` | `{ rows, cols }`: jumlah baris dan kolom sheet | |
| `lastFilled()` | `{ r, c }`: baris dan kolom terakhir yang berisi, seperti Ctrl+End. `{ r: -1, c: -1 }` kalau sheet kosong | mencari ujung data |
| `dataRegion(r, c)` | kotak tabel yang memuat sel itu (dibatasi baris dan kolom kosong), seperti Ctrl+A di Excel | menemukan tabel tanpa tahu ukurannya |
| `forEachFilledRow((r, cells, styles) => ...)` | panggil fungsi untuk setiap baris yang berisi, urut dari atas. Baris kosong dilewati, jadi tetap cepat di sheet 100.000 baris | membaca seluruh data |
| `rowContent(r)` | `{ cells, style }` sebuah baris, menurut id kolom | |
| `wb.address(r, c)` | `'K21'` dari nomor | |

`cells` dan `styles` yang diberikan `forEachFilledRow` dan `rowContent` adalah objek milik workbook sendiri, tidak disalin, supaya cepat. Bacalah saja, jangan
diubah. Untuk mengubah, panggil `setValues`.

**Nomor dan id.** Nomor baris berubah saat baris disisipkan di atasnya, sedangkan id-nya tetap. Kalau kodemu perlu mengingat "baris pesanan ini" selama
beberapa waktu, simpan id-nya (`rowId(r)`), lalu cari nomornya lagi saat dibutuhkan (`rowIndex(id)`). Rumus juga bekerja dengan cara ini
([2.3](02-konsep.md)).

| Fungsi | Artinya |
|---|---|
| `rowId(r)`, `colId(c)` | id baris atau kolom di nomor itu |
| `rowIndex(id)`, `colIndex(id)` | nomor sekarang dari id itu, atau `-1` kalau sudah dihapus |

## 4.3 Gaya dan merge

Kepala invoice: nama toko dan alamat di-merge selebar tabel, judul kolom berwarna, dan kotak tabel diberi garis luar:

<!-- contoh: 04-gaya.js -->
```js
import { createWorkbook } from '@kufayeka/sheet/core';

// Kepala invoice: merge, gaya yang digabung, menghapus satu bagian gaya, gaya per sel lewat fungsi.
const wb = createWorkbook();
const inv = wb.sheet('Sheet1');
inv.setValues('A1', [['TB Sinar Jaya'], ['Jl. Raya Bogor 12, Jakarta Timur'], [], ['Kode', 'Barang', 'Qty', 'Harga', 'Total']]);

inv.mergeCells('A1:E1, A2:E2');                         // dua merge sekaligus
inv.setStyle('A1', { bold: true, fontSize: 16, align: 'center', color: '#1a73e8' });
inv.setStyle('A2', { italic: true, align: 'center', color: '#5f6368' });
inv.setStyle('A4:E4', { bold: true, fill: '#e8f0fe', align: 'center' });
inv.setStyle('A4:E4', { underline: true });              // digabung: yang tadi tetap
console.log('A4                 :', JSON.stringify(inv.style('A4')));

inv.setStyle('A4:E4', { underline: null });              // null menghapus satu bagian
console.log('A4 tanpa underline :', JSON.stringify(inv.style('A4')));

// border luar saja: tiap sel dapat sisi yang ada di pinggir kotak
const garis = { style: 'solid', width: 2, color: '#1a73e8' };
inv.setStyle('A4:E8', (r, c) => ({ borders: {
    ...(r === 3 ? { top: garis } : {}), ...(r === 7 ? { bottom: garis } : {}),
    ...(c === 0 ? { left: garis } : {}), ...(c === 4 ? { right: garis } : {})
} }));
console.log('pojok A4           :', JSON.stringify(inv.style('A4').borders));
console.log('tengah C6          :', inv.style('C6') || 'tanpa gaya (fungsi memberi {} untuk sel tengah)');

// border digabung per sisi: garis bawah tipis di judul kolom, garis atas dan kiri A4 tetap ada
inv.setStyle('A4:E4', { borders: { bottom: { style: 'solid', width: 1, color: '#9aa0a6' } } });
console.log('A4 tambah bawah    :', Object.keys(inv.style('A4').borders).join(', '));
inv.setStyle('A4', { borders: { left: null } });          // satu sisi saja yang dibuang
console.log('A4 tanpa kiri      :', Object.keys(inv.style('A4').borders).join(', '));
console.log('merge              :', JSON.stringify(inv.merges()));
inv.unmergeCells('A2');
console.log('setelah unmerge A2 :', JSON.stringify(inv.merges()));
```
<!-- /contoh -->

<!-- hasil: 04-gaya.js -->
```text
A4                 : {"bold":true,"fill":"#e8f0fe","align":"center","underline":true}
A4 tanpa underline : {"bold":true,"fill":"#e8f0fe","align":"center"}
pojok A4           : {"top":{"style":"solid","width":2,"color":"#1a73e8"},"left":{"style":"solid","width":2,"color":"#1a73e8"}}
tengah C6          : tanpa gaya (fungsi memberi {} untuk sel tengah)
A4 tambah bawah    : top, left, bottom
A4 tanpa kiri      : top, bottom
merge              : [{"r1":0,"c1":0,"r2":0,"c2":4},{"r1":1,"c1":0,"r2":1,"c2":4}]
setelah unmerge A2 : [{"r1":0,"c1":0,"r2":0,"c2":4}]
```
<!-- /hasil -->

Cara kerja `setStyle`:

- **Gaya digabung, bukan diganti.** `setStyle('A4:E4', { underline: true })` menambahkan garis bawah. Tebal dan warna latar yang sudah ada tetap.
- **`null` membuang satu bagian.** `{ underline: null }` hanya membuang garis bawah.
- **Border digabung per sisi.** `{ borders: { bottom } }` menambah sisi bawah tanpa membuang sisi atas dan kiri yang sudah ada. `{ borders: { left: null } }`
  membuang satu sisi, dan `{ borders: null }` membuang semua.
- **Fungsi untuk gaya per sel.** `setStyle(range, (r, c, sebelum) => gaya)` dipanggil untuk tiap sel. Kembalikan `null` atau `undefined` supaya sel itu
  tidak diubah. Contoh di atas memakainya untuk garis luar, karena tiap sel butuh sisi yang berbeda.

Invoice lengkap sebagai halaman React, dengan merge, warna, border ganda di total, format rupiah, teks yang turun di baris 6, dan sheet tanpa garis sel:

<!-- contoh: 04-gaya.page.js -->
```jsx
import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import { createWorkbook } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';

// Invoice toko: merge, warna, border, format uang dan persen, teks yang turun, lebar kolom, tanpa garis sel.
function buatInvoice() {
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
    const tipis = { style: 'solid', width: 1, color: '#dadce0' };
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
| `wrap` | `'wrap'`: teks panjang turun ke baris berikutnya di dalam sel. `'clip'`: dipotong di tepi sel. Tidak diisi: teks meluber ke sel kosong di sebelahnya |
| `rotate` | derajat (-90 sampai 90), atau `'vertical'` untuk huruf yang tersusun ke bawah |
| `borders` | `{ top, right, bottom, left }`, tiap sisi `{ style: 'solid' \| 'dashed' \| 'dotted' \| 'double', width, color }` |
| `format` | format angka ([bab 6](06-format.md)) |
| `link` | URL: sel menjadi tautan |

| Fungsi | Artinya |
|---|---|
| `setStyle(range, gaya)` | gabungkan gaya ke setiap sel di range (atau beberapa range) |
| `mergeCells(range)` | gabung tiap range menjadi satu sel. Isinya diambil dari sel kiri atas |
| `unmergeCells(alamat)` | lepas merge yang memuat sel itu |
| `merges()` | daftar merge di sheet `[{ r1, c1, r2, c2 }]` |

## 4.4 Baris dan kolom

Daftar harga lima produk dengan jumlah produk di bawahnya. Baris disisipkan, dihapus, dan dipindah. Setelah itu ditambah kolom kategori yang disembunyikan
dulu, dan baris judul dibekukan:

<!-- contoh: 04-baris-kolom.js -->
```js
import { createWorkbook } from '@kufayeka/sheet/core';
import { PRODUK } from './data/toko.js';

// Daftar harga: menyisipkan, menghapus, memindahkan, menyembunyikan, mengatur lebar, membekukan.
const wb = createWorkbook();
wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
const sh = wb.sheet('Sheet1');
sh.setValues('A1', [['Kode', 'Nama produk', 'Harga jual']]);
sh.setValues('A2', PRODUK.slice(0, 5).map((p) => [p[0], p[1], p[5]]));
sh.setValues('A8', [['Jumlah produk', '=COUNTA(A2:A6)']]);
const kode = () => [1, 2, 3, 4, 5, 6].map((r) => sh.value(r, 0)).filter(Boolean).join(', ');

sh.insertRows('4', 1);                                  // baris baru di baris 4
sh.setValues('A4', [['CAT-01', 'Cat kayu 1 kg', 65000]]);
console.log('disisipkan    :', kode(), '| COUNTA:', sh.value('B9'), sh.input('B9'));

sh.deleteRows('2');                                     // hapus satu baris
console.log('dihapus       :', kode(), '| COUNTA:', sh.value('B8'));

sh.moveRows(3, 1, 1);                                   // 1 baris dari nomor 3 (baris 4) pindah ke depan nomor 1 (baris 2)
console.log('dipindah      :', kode());

sh.insertCols('C');                                     // kolom baru untuk kategori
sh.setValues('C1', 'Kategori');
console.log('kolom harga   :', sh.value('D1'));

sh.setColProps('B', { width: 200 });
sh.setColProps('D', { format: { type: 'money', decimals: 0 }, width: 120 });
sh.setColProps('C', { hidden: true });
sh.setRowProps('1', { height: 32 });
sh.setSheetProps({ freezeRows: 1, freezeCols: 1, hideGridlines: true });
console.log('kolom B, C, D :', JSON.stringify(sh.colProps(1)), JSON.stringify(sh.colProps(2)), JSON.stringify(sh.colProps(3)));
console.log('harga baris 2 :', sh.display('D2').text);
console.log('sheet         :', JSON.stringify(sh.sheetProps()));
console.log('lebar kolom   :', sh.colAxis().size(1), 'px, kolom C', sh.colAxis().size(2), 'px (tersembunyi)');
```
<!-- /contoh -->

<!-- hasil: 04-baris-kolom.js -->
```text
disisipkan    : SMN-01, SMN-02, CAT-01, BSI-10, BSI-13, CAT-05 | COUNTA: 6 =COUNTA(A2:A7)
dihapus       : SMN-02, CAT-01, BSI-10, BSI-13, CAT-05 | COUNTA: 5
dipindah      : BSI-10, SMN-02, CAT-01, BSI-13, CAT-05
kolom harga   : Harga jual
kolom B, C, D : {"width":200} {"hidden":true} {"format":{"type":"money","decimals":0},"width":120}
harga baris 2 : Rp 79.500
sheet         : {"name":"Sheet1","freezeRows":1,"freezeCols":1,"hideGridlines":true}
lebar kolom   : 200 px, kolom C 0 px (tersembunyi)
```
<!-- /hasil -->

Perhatikan `=COUNTA(A2:A6)`:

- Saat baris disisipkan di dalam range, range ikut membesar (`A2:A7`) dan baris baru langsung terhitung.
- Saat baris pertama range dihapus, range **menyusut** menjadi baris yang tersisa, sama seperti Excel. Hasilnya tidak berubah jadi `#REF!`. Satu undo
  mengembalikan baris dan range seperti semula.
- `#REF!` hanya muncul kalau sel yang dibaca rumus benar-benar hilang: sebuah sel tunggal (`=B5`), atau range yang semua barisnya dihapus.

| Fungsi | Artinya |
|---|---|
| `insertRows(di, jumlah = 1)` | sisipkan baris kosong di baris itu. Yang lama bergeser ke bawah. `di` boleh `'4'` atau nomor `3` |
| `deleteRows(baris)` | hapus baris: `'2'`, `'2:5'`, atau `(nomor, jumlah)` |
| `moveRows(dari, jumlah, ke)` | pindahkan `jumlah` baris mulai dari nomor `dari` supaya berdiri sebelum nomor `ke` (dihitung sebelum dipindah). Rumus ikut barisnya |
| `insertCols(di, jumlah = 1)`, `deleteCols(kolom)`, `moveCols(dari, jumlah, ke)` | sama untuk kolom: `'C'`, `'B:D'` |
| `setRowProps(baris, props)`, `setColProps(kolom, props)` | props baris atau kolom, digabung seperti gaya. `null` membuang satu kunci |
| `rowProps(r)`, `colProps(c)` | props baris atau kolom |
| `rowAxis()`, `colAxis()` | ukuran dan posisi dalam piksel: `size(i)`, `offset(i)`, `indexAt(px)`, `total()`. Baris atau kolom yang tersembunyi berukuran 0 |
| `setAutoHeights(tinggi)` | tinggi baris otomatis dari teks yang turun (`wrap: 'wrap'`). Dipanggil oleh grid; jarang perlu dari kode |

| Props baris / kolom | Artinya |
|---|---|
| `height` (baris), `width` (kolom) | piksel. Tidak diisi: ukuran bawaan |
| `hidden` | `true`: disembunyikan. Tetap dihitung oleh rumus |
| `format` | format untuk setiap sel di kolom itu yang tidak punya format sendiri |

## 4.5 Sheet

Satu workbook untuk satu bulan, dengan satu sheet per cabang dan sheet Rekap yang membaca semua cabang:

<!-- contoh: 04-sheet.js -->
```js
import { createWorkbook } from '@kufayeka/sheet/core';

// Satu workbook per bulan, satu sheet per cabang, plus rekap yang membaca semua cabang.
const wb = createWorkbook();
const nama = () => wb.sheetIds().map((s) => wb.sheetProps(s).name + (wb.sheetProps(s).hidden ? ' (tersembunyi)' : '')).join(', ');

wb.setSheetProps('Sheet1', { name: 'Jakarta' });
wb.setValues('Jakarta', 'A1', [['Omzet'], [125000000]]);
const bandung = wb.duplicateSheet('Jakarta');          // salinan: "Copy of Jakarta"
wb.setSheetProps(bandung, { name: 'Bandung' });
wb.setValues('Bandung', 'A2', 98000000);
const rekap = wb.addSheet('Rekap');
wb.setValues(rekap, 'A1', [['Total omzet', '=Jakarta!A2+Bandung!A2']]);
wb.moveSheet(rekap, 0);                                 // rekap di depan
console.log('sheet         :', nama());
console.log('total omzet   :', wb.value('Rekap', 'B1'));

wb.setSheetProps('Bandung', { name: 'Bandung Kota' }); // ganti nama: rumus ikut
console.log('rumus rekap   :', wb.input('Rekap', 'B1'));

wb.hideSheet('Jakarta', true);                          // disembunyikan, tetap dihitung
console.log('sembunyikan   :', nama(), '| total masih', wb.value('Rekap', 'B1'));

wb.removeSheet('Bandung Kota');                         // dihapus: rumus yang membacanya #REF!
console.log('hapus Bandung :', nama(), '| rumus', wb.input('Rekap', 'B1'), '=', wb.value('Rekap', 'B1').code);
wb.undo();
console.log('undo          :', nama(), '| total', wb.value('Rekap', 'B1'));
console.log('id dari nama  :', wb.sheetIdByName('rekap') === rekap);
```
<!-- /contoh -->

<!-- hasil: 04-sheet.js -->
```text
sheet         : Rekap, Jakarta, Bandung
total omzet   : 223000000
rumus rekap   : =Jakarta!A2+'Bandung Kota'!A2
sembunyikan   : Rekap, Jakarta (tersembunyi), Bandung Kota | total masih 223000000
hapus Bandung : Rekap, Jakarta (tersembunyi) | rumus =Jakarta!A2+#REF! = #REF!
undo          : Rekap, Jakarta (tersembunyi), Bandung Kota | total 223000000
id dari nama  : true
```
<!-- /hasil -->

- Mengganti nama sheet tidak merusak rumus, karena rumus menyimpan id sheet. Yang berubah hanya cara rumus itu ditulis (`'Bandung Kota'!A2`, dengan tanda
  kutip karena ada spasi).
- Sheet tersembunyi tetap dihitung, sedangkan sheet yang dihapus membuat rumus yang membacanya menjadi `#REF!`. Undo mengembalikan sheet beserta isinya,
  dan rumusnya hidup lagi.
- `duplicateSheet` membuat salinan yang berdiri sendiri. Rumus di dalamnya membaca baris salinan itu sendiri, bukan baris sheet asal.

| Fungsi | Artinya |
|---|---|
| `wb.sheet(nama atau id)` | handle sheet: semua fungsi bab ini tanpa parameter sheet, ditambah `id` dan `name` |
| `wb.sheetIds()` | id semua sheet, urut seperti tab |
| `wb.sheetIdByName(nama)` | id dari nama (huruf besar dan kecil tidak dibedakan), atau `null` |
| `wb.addSheet(nama?)` | sheet baru di paling belakang. Tanpa nama: `Sheet2`, `Sheet3`, ... Mengembalikan id |
| `wb.duplicateSheet(sheet)` | salinan di sebelah kanan, bernama `Copy of ...`. Mengembalikan id |
| `wb.removeSheet(sheet)` | hapus sheet. Sheet terakhir tidak bisa dihapus |
| `wb.hideSheet(sheet, true/false)` | sembunyikan atau tampilkan tab. Sheet terakhir yang tampil tidak bisa disembunyikan |
| `wb.moveSheet(sheet, ke)` | pindahkan supaya berdiri sebelum sheet nomor `ke` |
| `setSheetProps(props)`, `sheetProps()` | props sheet, digabung seperti gaya |
| `wb.sheetShown(sheet)` | apakah sheet ini terlihat oleh orang yang membuka, menurut access policy ([bab 13](13-hak-akses.md)) |

| Props sheet | Artinya |
|---|---|
| `name` | nama di tab dan di rumus |
| `hidden` | tab disembunyikan (pakai `hideSheet`) |
| `freezeRows`, `freezeCols` | jumlah baris atau kolom yang dibekukan di atas atau kiri |
| `hideGridlines` | `true`: tanpa garis sel |

Tipe data kolom (angka, tanggal, pilihan) diatur lewat `setTypes` ([bab 7](07-data.md)), bukan lewat props kolom. Props lain di sheet (`filter`, `conditionals`, `validations`, `pivots`, `rules`, dan seterusnya) diisi oleh fungsinya masing-masing di bab 6 sampai 15.
Jangan menulisnya langsung lewat `setSheetProps`.

## 4.6 Pengaturan workbook

`wb.settings()` membaca pengaturan dan `wb.setSettings(patch)` mengubahnya. Isinya digabung, dan perubahannya bisa di-undo.

| Kunci | Artinya | Bawaan |
|---|---|---|
| `locale` | cara angka dan tanggal ditulis dan dibaca: `'id-ID'` menulis `Rp 1.250.000` dan `26/10/2026`, `'en-US'` menulis `$1,250,000.00` dan `10/26/2026` | `'en-US'` |
| `currency` | mata uang format uang: `'IDR'`, `'USD'`, `'EUR'`, ... | `'USD'` |
| `names` | named range, diisi lewat `addName` ([bab 5](05-rumus.md)) | |

Locale juga mengatur yang **diketik** orang. Dengan `id-ID`, mengetik `1.250.000` menghasilkan angka satu juta dua ratus lima puluh ribu, dan
`26/10/2026` menghasilkan tanggal.

## 4.7 Undo, redo, dan apply

Setiap perubahan adalah daftar op. Daftar itu bisa dicatat, dikirim, lalu diterapkan di workbook lain. Di sini kasir mencatat transaksi, kemudian
perubahan yang sama diterapkan di salinan milik server:

<!-- contoh: 04-undo.js -->
```js
import { createWorkbook } from '@kufayeka/sheet/core';

// Undo, redo, dan apply: perubahan sebagai daftar op yang bisa disimpan, dikirim, dan diterapkan lagi di workbook lain.
const kasir = createWorkbook(null, { user: { id: 'k1', name: 'Kasir 1' } });
const log = [];
kasir.on('op', (e) => log.push(e));
kasir.setValues('Sheet1', 'A1', [['Barang', 'Qty'], ['Semen', 10]]);
kasir.setStyle('Sheet1', 'A1:B1', { bold: true });
kasir.insertRows('Sheet1', '2');
console.log('perubahan     :', log.map((e) => e.ops.map((o) => o.t).join('+')).join(', '));
console.log('bisa undo     :', kasir.canUndo(), '| bisa redo:', kasir.canRedo());

kasir.undo();
kasir.undo();
console.log('dua kali undo :', kasir.value('Sheet1', 'A1'), '| gaya A1:', kasir.style('Sheet1', 'A1') || 'tidak ada', '| bisa redo:', kasir.canRedo());
kasir.redo();
console.log('redo          :', JSON.stringify(kasir.style('Sheet1', 'A1')));

// op yang sama diterapkan di workbook lain yang isinya sama (misalnya di server, atau di komputer lain)
const server = createWorkbook(kasir.toJSON());
const sebelum = server.revision;
server.apply([{ t: 'cells', sheet: server.sheetIds()[0], changes: [{ row: server.rowId('Sheet1', 1), col: server.colId('Sheet1', 1), before: 10, after: 25 }] }], { source: 'remote' });
console.log('apply di server:', server.value('Sheet1', 'B2'), '| revision naik:', server.revision > sebelum, '| masuk undo:', server.canUndo());
console.log('op dicatat siapa:', log[0].ops[0].user.name, 'pada', typeof log[0].ops[0].at);
```
<!-- /contoh -->

<!-- hasil: 04-undo.js -->
```text
perubahan     : cells, styles, insertRows
bisa undo     : true | bisa redo: false
dua kali undo : Barang | gaya A1: tidak ada | bisa redo: true
redo          : {"bold":true}
apply di server: 25 | revision naik: true | masuk undo: false
op dicatat siapa: Kasir 1 pada string
```
<!-- /hasil -->

| Fungsi | Artinya |
|---|---|
| `wb.undo()`, `wb.redo()` | mundur atau maju satu perubahan. Mengembalikan `false` kalau tidak ada |
| `wb.canUndo()`, `wb.canRedo()` | apakah ada yang bisa di-undo atau di-redo |
| `wb.apply(ops, how)` | terapkan daftar op sebagai satu perubahan. Mengembalikan op yang diterapkan, atau `null` kalau ditolak `beforeOp`. Semua fungsi bab ini pada akhirnya memanggil fungsi ini |
| `wb.on('op', fn)` | dengarkan setiap perubahan: `fn({ ops, source })`. Mengembalikan fungsi untuk berhenti mendengarkan |
| `wb.revision` | angka yang naik setiap ada perubahan. Bandingkan dua angka untuk tahu ada yang berubah atau tidak |
| `wb.tick()` | hitung ulang `NOW()` dan `TODAY()`. Panggil dengan timer kalau butuh jam yang berjalan |

Perubahan dengan `source: 'remote'` (dari orang lain atau dari server) tidak diperiksa `beforeOp` dan tidak masuk undo. Undo tetap hanya membatalkan
perubahan milik sendiri. Siapa yang mengubah dan kapan tercatat di setiap op (`op.user`, `op.at`) kalau workbook dibuat dengan `user`.

## 4.8 Jenis op

Ini yang dilihat `beforeOp`, `on('op')`, dan `onOp`. `sheet` adalah id sheet. Baris dan kolom selalu ditulis sebagai id, bukan nomor, jadi op yang
sama tetap benar walaupun diterapkan di workbook yang barisnya sudah bergeser.

| `op.t` | Isinya |
|---|---|
| `cells` | `changes: [{ row, col, before, after }]`: isi sel. Rumus berbentuk `{ f, refs }` |
| `styles` | `changes: [{ row, col, before, after }]`: gaya sel |
| `insertRows`, `deleteRows` | `rows: [{ id, key, cells, style, props }]`. `key` menentukan urutan |
| `insertCols`, `deleteCols` | `cols: [{ id, key, props }]` |
| `moveRows`, `moveCols` | `moves: [{ id, before, after }]`: kunci urutan lama dan baru |
| `rowProps`, `colProps` | `changes: [{ id, before, after }]` |
| `sheetProps` | `before`, `after`: props sheet |
| `addSheet`, `removeSheet` | `sheet`: isi sheet lengkap |
| `moveSheet` | `before`, `after`: kunci urutan sheet |
| `settings` | `before`, `after`: pengaturan workbook |

Menghapus baris di pojok sebuah range menghasilkan **dua** op dalam satu perubahan: `cells` (rumus yang range-nya menyusut) lalu `deleteRows`. Server
atau komputer lain yang menerapkan perubahan itu akan sampai pada hasil yang sama persis.

[Daftar isi](../README.md#daftar-isi) · Sebelumnya: [3. Komponen `<Sheet>`](03-komponen-sheet.md) · Berikutnya: [5. Rumus](05-rumus.md)
