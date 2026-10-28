# 12. Menyimpan ke server

[Daftar isi](../README.md#daftar-isi) · Sebelumnya: [11. Memakai di React](11-react.md) · Berikutnya: [13. Access control](13-hak-akses.md)

Browser mengirim **patch**, yaitu bagian yang berubah saja. Server memeriksanya dengan aturan yang sama seperti di browser, menggabungkannya ke workbook
yang tersimpan, lalu menjawab versi barunya. Semua fungsi di bab ini murni JavaScript tanpa browser, dan berjalan di Node.js, Deno, Bun, atau worker.

- [12.1 Alur simpan](#121-alur-simpan)
- [12.2 `viewFor`: hanya kirim yang boleh dilihat](#122-viewfor-hanya-kirim-yang-boleh-dilihat)
- [12.3 Bentuk tabel database](#123-bentuk-tabel-database)
- [12.4 Dua orang menyimpan bersamaan](#124-dua-orang-menyimpan-bersamaan)

## 12.1 Alur simpan

<!-- contoh: 12-alur.js -->
```js
import { createWorkbook, mergePatch, checkPatch } from '@kufayeka/sheet/core';
import { PRODUK, KOLOM_PRODUK } from './data/toko.js';

// Alur simpan dari awal sampai akhir: server punya workbook tersimpan, kasir membukanya, mengubah stok, browser mengirim patch,
// server memeriksa lalu menggabungkan. Kode server dan browser ada di satu file supaya bisa dijalankan; di aplikasi, keduanya terpisah.

// ---- SERVER: workbook yang tersimpan, dan aturan untuk peran kasir (sama dengan yang dipasang di browser, bab 10)
let tersimpan = (() => {
    const wb = createWorkbook();
    wb.setSheetProps('Sheet1', { name: 'Produk' });
    wb.setValues('Produk', 'A1', [KOLOM_PRODUK, ...PRODUK]);
    return { ...wb.toJSON(), version: 1 };
})();
const aturanKasir = [
    { sheet: 'Produk', columns: ['Harga beli'], mode: 'hidden' },
    { sheet: 'Produk', columns: ['Kode', 'Nama produk', 'Kategori', 'Satuan', 'Harga jual', 'Stok min.'], mode: 'readonly' }
];
const tipe = { Produk: { headerRow: 1, fields: { Stok: { kind: 'int' } } } };

// ---- BROWSER: buka, pasang aturan, kasir mengubah dua stok
const wb = createWorkbook(tersimpan);
wb.setRules(aturanKasir);
wb.setValues('Produk', 'G2', 400, { source: 'user' });
wb.setValues('Produk', 'G5', 140, { source: 'user' });
const patch = wb.pendingPatch();
console.log('patch dikirim   :', patch.rows.upsert.length, 'baris diubah,', patch.rows.delete.length, 'dihapus, dari versi', patch.workbook.version);

// ---- SERVER: periksa dengan aturan dan tipe yang sama, lalu gabungkan dan naikkan versinya
const cek = checkPatch(tersimpan, patch, { rules: aturanKasir, types: tipe });
console.log('checkPatch      :', JSON.stringify(cek));
if (cek.ok) {
    tersimpan = { ...mergePatch(tersimpan, patch, { rules: aturanKasir }), version: tersimpan.version + 1 };
}
console.log('tersimpan G2,G5 :', createWorkbook(tersimpan).value('Produk', 'G2'), createWorkbook(tersimpan).value('Produk', 'G5'), '| versi', tersimpan.version);

// ---- BROWSER: server menjawab versi baru. Yang sudah terkirim dilupakan
wb.saved(patch, { version: tersimpan.version });
console.log('belum tersimpan :', wb.unsaved(), '| versi di browser', wb.version);

// ---- patch yang dibuat tanpa lewat sheet (misalnya lewat devtools) untuk mengubah harga jual dan menulis stok pecahan: ditolak
const palsu = JSON.parse(JSON.stringify(wb.pendingPatch()));
const baris2 = tersimpan.sheets[0].rows[1];
const kolom = (judul) => tersimpan.sheets[0].columns[KOLOM_PRODUK.indexOf(judul)].id;
palsu.rows.upsert.push({ ...baris2, sheetId: tersimpan.sheets[0].id, cells: { ...baris2.cells, [kolom('Harga jual')]: 1, [kolom('Stok')]: 2.5 } });
const tolak = checkPatch(tersimpan, palsu, { rules: aturanKasir, types: tipe });
console.log('patch palsu     :', tolak.ok);
for (const p of tolak.problems) console.log('  -', p.address, p.reason);
```
<!-- /contoh -->

<!-- hasil: 12-alur.js -->
```text
patch dikirim   : 2 baris diubah, 0 dihapus, dari versi 1
checkPatch      : {"ok":true,"problems":[]}
tersimpan G2,G5 : 400 140 | versi 2
belum tersimpan : false | versi di browser 2
patch palsu     : false
  - F2 a protected cell was changed
  - G2 expected a whole number (Stok)
```
<!-- /hasil -->

Urutannya:

1. **Server mengirim workbook** (`toJSON()` yang tersimpan, atau `viewFor` di 12.2). Browser membukanya dengan `createWorkbook(doc)` dan memasang aturan
   yang sama dengan server (`setRules`, `setAccess`, `setTypes`).
2. **Browser mengirim `wb.pendingPatch()`** (lihat autosave di [11.4](11-react.md#114-menyimpan-otomatis)).
3. **Server memanggil `checkPatch(tersimpan, patch, { rules, types, policy, who })`.** Semua yang tidak boleh dilakukan orang itu menjadi `problems`:
   sel terlindung yang diubah, baris berisi sel terlindung yang dihapus, nilai yang salah tipe, tindakan yang tidak diizinkan policy, sheet yang tidak
   boleh dilihatnya, dan patch yang dibuat dengan tangan (baris tanpa sheet, atau baris yang dipindah ke sheet lain).
4. **Kalau `ok`, server memanggil `mergePatch(tersimpan, patch, { rules, policy, who })`**, menyimpan hasilnya, lalu menaikkan `version`. Sel yang
   tidak pernah dikirim ke orang itu (12.2) dipertahankan dari yang tersimpan, apa pun isi patch-nya.
5. **Server menjawab `{ version }`**, dan browser memanggil `wb.saved(patch, jawaban)`.

Kenapa memeriksa lagi di server padahal browser sudah menolak? Karena browser milik penggunanya. Patch bisa dibuat sendiri lewat devtools, seperti
`palsu` di contoh, dan hanya server yang bisa dipercaya.

| Fungsi | Artinya |
|---|---|
| `wb.pendingPatch()` | `{ workbook, upTo, sheets, columns, rows }`: yang berubah sejak simpan terakhir, masing-masing `upsert` (ditulis utuh) dan `delete` (id) |
| `wb.saved(patch, { version })` | patch itu sudah tersimpan. Yang berubah setelah patch dibuat tetap tercatat |
| `wb.unsaved()` | ada yang belum tersimpan atau tidak |
| `checkPatch(doc, patch, what)` | `{ ok, problems: [{ sheet, address, reason }] }` |
| `mergePatch(doc, patch, what?)` | workbook tersimpan setelah patch digabungkan (objek baru, `doc` tidak diubah) |
| `viewFor(doc, what)` | workbook seperti yang boleh dimiliki orang itu |

`what` berisi `rules` (seperti `setRules`), `types` (per nama sheet, seperti `setTypes`), serta `policy` dan `who` (bab 13).

## 12.2 `viewFor`: hanya kirim yang boleh dilihat

Aturan `hidden` di browser menampilkan `•••`, tetapi nilainya tetap ada di memori browser. Untuk data yang benar-benar tidak boleh sampai ke orang itu,
misalnya harga beli untuk kasir, kirim hasil `viewFor`:

<!-- contoh: 12-viewfor.js -->
```js
import { createWorkbook, viewFor } from '@kufayeka/sheet/core';
import { PRODUK, KOLOM_PRODUK } from './data/toko.js';

// viewFor: workbook seperti yang boleh dimiliki kasir. Harga beli tidak dikirim sama sekali, dan rumus yang membacanya dikirim sebagai hasilnya.
const wb = createWorkbook();
wb.setSheetProps('Sheet1', { name: 'Produk' });
wb.setValues('Produk', 'A1', [[...KOLOM_PRODUK, 'Margin'], ...PRODUK.map((p, i) => [...p, `=(F${i + 2}-E${i + 2})/F${i + 2}`])]);
const tersimpan = wb.toJSON();
const aturanKasir = [{ sheet: 'Produk', columns: ['Harga beli'], mode: 'hidden' }];

const untukKasir = viewFor(tersimpan, { rules: aturanKasir });
const dibuka = createWorkbook(untukKasir);
console.log('harga beli E2   :', JSON.stringify(dibuka.value('Produk', 'E2')), '(tidak ada di JSON yang dikirim)');
console.log('margin I2       :', dibuka.input('Produk', 'I2'), '-> nilai jadi, bukan rumus yang bisa dibongkar');
console.log('harga jual F2   :', dibuka.value('Produk', 'F2'));
console.log('angka 64000 ada di JSON kasir:', JSON.stringify(untukKasir).includes('64000'), '| di JSON asli:', JSON.stringify(tersimpan).includes('64000'));
```
<!-- /contoh -->

<!-- hasil: 12-viewfor.js -->
```text
harga beli E2   : null (tidak ada di JSON yang dikirim)
margin I2       : 0.111111111111111 -> nilai jadi, bukan rumus yang bisa dibongkar
harga jual F2   : 72000
angka 64000 ada di JSON kasir: false | di JSON asli: true
```
<!-- /hasil -->

- Isi sel `hidden` dan `invisible` dibuang. Sheet yang tidak boleh dilihat tidak dikirim. Komentar tidak dikirim tanpa hak `comment.read` (bab 14).
- Rumus yang membaca sel tersembunyi dikirim sebagai **hasilnya**, supaya rumusnya tidak bisa dipakai untuk membaca sel itu.
- Hasil itu sendiri tetap terlihat. Margin 11,1% bersama harga jual 72.000 masih membuka harga beli. Kalau margin juga rahasia, sembunyikan kolom margin
  juga.
- Saat orang itu menyimpan, `mergePatch` dengan `what` yang sama mempertahankan sel yang tidak pernah ia terima. Kosongnya sel di browser tidak menghapus
  isi aslinya.

## 12.3 Bentuk tabel database

`toJSON()` boleh disimpan apa adanya sebagai satu kolom JSON. Itu cara paling sederhana dan cukup untuk workbook kecil sampai menengah. Untuk workbook
besar, atau kalau baris ingin disimpan satu per satu supaya patch kecil hanya menyentuh baris yang berubah, patch cocok dengan empat tabel:

```sql
create table workbooks (id uuid primary key, version int not null, settings jsonb);
create table sheets    (id uuid primary key, workbook_id uuid references workbooks, key text not null, props jsonb);
create table columns   (id uuid primary key, sheet_id uuid references sheets, key text not null, props jsonb);
create table rows      (id uuid primary key, sheet_id uuid references sheets, key text not null,
                        cells jsonb, style jsonb, props jsonb);    -- cells: { idKolom: nilai atau rumus }
```

Urutan baris dan kolom ditentukan oleh `key` (diurutkan sebagai teks), bukan oleh nomor. Karena itu menyisipkan baris hanya menulis satu baris baru, tanpa
menggeser nomor baris-baris di bawahnya. Patch diterjemahkan langsung menjadi perintah untuk keempat tabel itu:

<!-- contoh: 12-tabel.js -->
```js
import { createWorkbook } from '@kufayeka/sheet/core';

// Patch diterjemahkan ke perintah untuk empat tabel (lihat skema di 12.3). Bentuk perintahnya terserah database-mu;
// di sini cuma dicetak supaya kelihatan apa yang dikirim.
function keTabel(wb, patch) {
    // id diganti alamat supaya enak dibaca di sini; di database yang disimpan tetap id-nya
    const kolom = (cid) => wb.address(0, wb.colIndex('Sheet1', cid)).replace(/\d+$/, '');
    const sel = (obj) => JSON.stringify(Object.fromEntries(Object.entries(obj).map(([cid, v]) => [kolom(cid), v])));
    const baris = (rid) => 'baris ' + (wb.rowIndex('Sheet1', rid) + 1);
    const perintah = [];
    if (patch.workbook.settings) perintah.push(['UPDATE workbooks SET settings']);
    for (const s of patch.sheets.upsert) perintah.push(['UPSERT sheets', s.props.name, 'key=' + s.key]);
    for (const id of patch.sheets.delete) perintah.push(['DELETE sheets']);
    for (const c of patch.columns.upsert) perintah.push(['UPSERT columns', 'kolom ' + kolom(c.id), 'key=' + c.key, 'props=' + JSON.stringify(c.props)]);
    for (const id of patch.columns.delete) perintah.push(['DELETE columns']);
    for (const r of patch.rows.upsert) perintah.push(['UPSERT rows', baris(r.id), 'key=' + r.key, 'cells=' + sel(r.cells), 'style=' + sel(r.style)]);
    for (const id of patch.rows.delete) perintah.push(['DELETE rows']);
    return perintah;
}

const wb = createWorkbook();
wb.saved(wb.pendingPatch());           // anggap workbook kosong ini sudah tersimpan
wb.setValues('Sheet1', 'A1', [['SMN-01', 'Semen Portland 50 kg', 420]]);
wb.setStyle('Sheet1', 'A1', { bold: true });
wb.insertRows('Sheet1', '2');
wb.setColProps('Sheet1', 'B', { width: 180 });
for (const p of keTabel(wb, wb.pendingPatch())) console.log(p.join('  '));
```
<!-- /contoh -->

<!-- hasil: 12-tabel.js -->
```text
UPSERT columns  kolom B  key=4  props={"width":180}
UPSERT rows  baris 1  key=04  cells={"A":"SMN-01","B":"Semen Portland 50 kg","C":420}  style={"A":{"bold":true}}
UPSERT rows  baris 2  key=06  cells={}  style={}
```
<!-- /hasil -->

Untuk membuka lagi, baca keempat tabel dan susun menjadi bentuk `toJSON()`: `{ id, version, settings, sheets: [{ id, key, props, columns, rows }] }`.

## 12.4 Dua orang menyimpan bersamaan

`mergePatch` menulis setiap baris dalam patch **utuh**. Kalau dua orang mengubah baris yang sama dan menyimpan bergantian, yang menyimpan belakangan menang
untuk baris itu. Perubahan di baris yang berbeda tidak saling menimpa. `patch.workbook.version` adalah versi yang dimiliki browser saat patch dibuat.
Server bisa menolak patch dengan versi lama (`409 Conflict`) lalu meminta browser memuat ulang. Ini aman, tetapi kurang enak untuk orang yang sedang
bekerja.

Untuk banyak orang yang mengedit bersamaan dan saling melihat perubahannya secara langsung, op dikirim satu per satu (`wb.on('op')`) dan diterapkan di
browser lain dengan `wb.apply(ops, { source: 'remote' })` ([4.7](04-api-workbook.md#47-undo-redo-dan-apply)).

[Daftar isi](../README.md#daftar-isi) · Sebelumnya: [11. Memakai di React](11-react.md) · Berikutnya: [13. Access control](13-hak-akses.md)
