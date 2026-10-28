# 12. Menyimpan ke server

[Daftar isi](../README.md#daftar-isi) · Sebelumnya: [11. Memakai di React](11-react.md) · Berikutnya: [13. Access control](13-hak-akses.md)

Browser mengirim **patch**, yaitu bagian yang berubah saja. Server memeriksanya dengan aturan yang sama seperti di browser, menggabungkannya ke workbook
yang tersimpan, lalu menjawab versi barunya. Semua fungsi di bab ini murni JavaScript tanpa browser, dan berjalan di Node.js, Deno, Bun, atau worker.

- [12.1 Dari sheet ke tabel database, langkah demi langkah](#121-dari-sheet-ke-tabel-database-langkah-demi-langkah)
- [12.2 Alur simpan dengan pemeriksaan](#122-alur-simpan-dengan-pemeriksaan)
- [12.3 `viewFor`: hanya kirim yang boleh dilihat](#123-viewfor-hanya-kirim-yang-boleh-dilihat)
- [12.4 Dua orang menyimpan bersamaan](#124-dua-orang-menyimpan-bersamaan)

## 12.1 Dari sheet ke tabel database, langkah demi langkah

Sebelum masuk ke kode server, lihat dulu **apa yang disimpan dan bentuknya di database**. Contoh ini memakai daftar harga tiga produk, lalu menjalankan
langkah-langkah yang biasa dilakukan orang: mengubah satu angka, menyisipkan baris, dan menghapus baris. Setiap langkah memperlihatkan apa yang dikirim
ke database. Id aslinya UUID yang panjang, jadi di sini diganti nama pendek (`r1`, `k2`, …) supaya mudah dibaca:

<!-- contoh: 12-simulasi.js -->
```js
import { createWorkbook } from '@kufayeka/sheet/core';

// Simulasi penyimpanan: sheet kecil seperti di Excel, lalu bentuk JSON-nya, lalu isi tabel-tabel database-nya,
// lalu apa yang berubah di tabel saat orang mengedit. Id asli berupa UUID panjang; di sini diganti nama pendek supaya mudah dibaca.

// ---- alat cetak: nama pendek untuk id, dan tabel bergaris seperti di layar database
const pendek = new Map();
const nama = (id, awalan) => { if (!pendek.has(id)) pendek.set(id, awalan + ([...pendek.values()].filter((x) => x.startsWith(awalan)).length + 1)); return pendek.get(id); };
const isiSel = (cells) => JSON.stringify(Object.fromEntries(Object.entries(cells).map(([k, v]) => [pendek.get(k) || k, v && v.f ? v.f.replace(/⟦\d+⟧/g, '…') : v])));
function tabel(judul, kolom, baris) {
    const lebar = kolom.map((k, i) => Math.max(k.length, ...baris.map((b) => String(b[i]).length)));
    const garis = '+' + lebar.map((l) => '-'.repeat(l + 2)).join('+') + '+';
    const satu = (b) => '| ' + b.map((x, i) => String(x).padEnd(lebar[i])).join(' | ') + ' |';
    console.log(judul);
    console.log([garis, satu(kolom), garis, ...baris.map(satu), garis].join('\n'));
}
function seperExcel(wb) {
    const s = wb.sheetIds()[0];
    const akhir = wb.lastFilled(s);
    const baris = [];
    for (let r = 0; r <= akhir.r; r++) baris.push([r + 1, ...Array.from({ length: akhir.c + 1 }, (_, c) => wb.display(s, r, c).text)]);
    tabel('', ['', ...Array.from({ length: akhir.c + 1 }, (_, c) => String.fromCharCode(65 + c))], baris);
}
function isiDatabase(doc) {
    const sh = doc.sheets[0];
    sh.columns.slice(0, 4).forEach((c) => nama(c.id, 'k'));
    tabel('tabel rows   (urut menurut key; kolom yang dipakai saja)', ['id', 'sheet_id', 'key', 'cells'],
        sh.rows.filter((r) => Object.keys(r.cells).length).sort((a, b) => (a.key < b.key ? -1 : 1)).map((r) => [nama(r.id, 'r'), 's1', r.key, isiSel(r.cells)]));
}

// ---- 1. di layar: daftar harga tiga produk
const wb = createWorkbook();
wb.setSheetProps('Sheet1', { name: 'Harga' });
wb.setValues('Harga', 'A1', [['Kode', 'Produk', 'Harga', 'Stok'], ['SMN-01', 'Semen 50 kg', 72000, 420], ['BSI-10', 'Besi 10 mm', 79500, 260], ['CAT-05', 'Cat 5 kg', 145000, 64]]);
wb.setValues('Harga', 'E1', [['Nilai'], ['=C2*D2'], ['=C3*D3'], ['=C4*D4']]);
console.log('1. YANG TAMPIL DI LAYAR (seperti Excel)');
seperExcel(wb);

// ---- 2. yang disimpan: toJSON(). Satu objek berisi sheet, kolom, dan baris; setiap sel disimpan di barisnya
const doc = wb.toJSON();
const sh = doc.sheets[0];
nama(doc.id, 'wb'); nama(sh.id, 's');
sh.columns.slice(0, 5).forEach((c) => nama(c.id, 'k'));
sh.rows.slice(0, 4).forEach((r) => nama(r.id, 'r'));
console.log('\n2. YANG DISIMPAN: wb.toJSON() (dipendekkan)');
console.log(JSON.stringify({ id: 'wb1', version: 0, sheets: [{ id: 's1', props: sh.props, columns: sh.columns.slice(0, 2).map((c) => ({ id: pendek.get(c.id), key: c.key })).concat(['…']),
    rows: sh.rows.slice(0, 2).map((r) => ({ id: pendek.get(r.id), key: r.key, cells: JSON.parse(isiSel(r.cells)) })).concat(['…']) }] }, null, 1).replace(/\n\s*/g, ' '));

// ---- 3. di database: empat tabel. Satu baris sheet = satu baris di tabel rows
console.log('\n3. DI DATABASE');
tabel('tabel workbooks', ['id', 'version'], [['wb1', 0]]);
tabel('tabel sheets', ['id', 'workbook_id', 'key', 'props'], [['s1', 'wb1', sh.key, JSON.stringify(sh.props)]]);
tabel('tabel columns (5 yang dipakai, dari 26)', ['id', 'sheet_id', 'key'], sh.columns.slice(0, 5).map((c) => [pendek.get(c.id), 's1', c.key]));
isiDatabase(doc);
console.log('Rumus disimpan dengan id kolom dan baris, bukan "C2": rumus tetap benar walau baris disisipkan. Ditulis … di sini.');

// ---- 4. orang mengubah stok besi menjadi 300: patch hanya berisi baris r3
wb.saved(wb.pendingPatch());
wb.setValues('Harga', 'D3', 300, { source: 'user' });
let patch = wb.pendingPatch();
console.log('\n4. STOK BESI DIUBAH JADI 300');
console.log('patch:', patch.rows.upsert.length, 'baris diubah (' + patch.rows.upsert.map((r) => pendek.get(r.id)).join(', ') + '),', patch.rows.delete.length, 'dihapus');
console.log('perintah ke database: UPDATE rows SET cells = ' + isiSel(patch.rows.upsert[0].cells) + ' WHERE id = \'' + pendek.get(patch.rows.upsert[0].id) + '\'');
console.log('Baris lain tidak disentuh. Nilai E3 (rumus) tidak dikirim: dihitung ulang saat dibuka.');

// ---- 5. baris baru disisipkan di antara semen dan besi: hanya SATU baris baru, dengan key di antara key kedua tetangganya
wb.saved(patch);
wb.insertRows('Harga', '3');
wb.setValues('Harga', 'A3', [['SMN-02', 'Semen putih', 112000, 35, '=C3*D3']], { source: 'user' });
patch = wb.pendingPatch();
console.log('\n5. BARIS BARU DISISIPKAN DI BARIS 3');
seperExcel(wb);
const baru = patch.rows.upsert.find((r) => !pendek.has(r.id));
console.log('patch:', patch.rows.upsert.length, 'baris -> INSERT INTO rows (id, key, cells) VALUES (\'' + nama(baru.id, 'r') + '\', \'' + baru.key + '\', ' + isiSel(baru.cells) + ')');
console.log('Baris besi dan cat TIDAK ditulis ulang walau nomornya bergeser: urutan ditentukan key, dan', baru.key, 'ada di antara',
    sh.rows[1].key, 'dan', sh.rows[2].key + '.');
wb.saved(patch);
isiDatabase(wb.toJSON());

// ---- 6. baris cat dihapus
wb.deleteRows('Harga', '5');
patch = wb.pendingPatch();
console.log('\n6. BARIS CAT DIHAPUS');
console.log('patch: DELETE FROM rows WHERE id IN (' + patch.rows.delete.map((id) => '\'' + pendek.get(id) + '\'').join(', ') + ')');

// ---- 7. dibuka lagi: baca keempat tabel, susun jadi bentuk toJSON(), createWorkbook
const dibuka = createWorkbook(wb.toJSON());
console.log('\n7. DIBUKA LAGI: E3 dihitung ulang dari rumusnya =', dibuka.input('Harga', 'E3'), '=', dibuka.value('Harga', 'E3'));
```
<!-- /contoh -->

<!-- hasil: 12-simulasi.js -->
```text
1. YANG TAMPIL DI LAYAR (seperti Excel)

+---+--------+-------------+--------+------+----------+
|   | A      | B           | C      | D    | E        |
+---+--------+-------------+--------+------+----------+
| 1 | Kode   | Produk      | Harga  | Stok | Nilai    |
| 2 | SMN-01 | Semen 50 kg | 72000  | 420  | 30240000 |
| 3 | BSI-10 | Besi 10 mm  | 79500  | 260  | 20670000 |
| 4 | CAT-05 | Cat 5 kg    | 145000 | 64   | 9280000  |
+---+--------+-------------+--------+------+----------+

2. YANG DISIMPAN: wb.toJSON() (dipendekkan)
{ "id": "wb1", "version": 0, "sheets": [ { "id": "s1", "props": { "name": "Harga" }, "columns": [ { "id": "k1", "key": "2" }, { "id": "k2", "key": "4" }, "…" ], "rows": [ { "id": "r1", "key": "04", "cells": { "k1": "Kode", "k2": "Produk", "k3": "Harga", "k4": "Stok", "k5": "Nilai" } }, { "id": "r2", "key": "08", "cells": { "k1": "SMN-01", "k2": "Semen 50 kg", "k3": 72000, "k4": 420, "k5": "=…*…" } }, "…" ] } ] }

3. DI DATABASE
tabel workbooks
+-----+---------+
| id  | version |
+-----+---------+
| wb1 | 0       |
+-----+---------+
tabel sheets
+----+-------------+-----+------------------+
| id | workbook_id | key | props            |
+----+-------------+-----+------------------+
| s1 | wb1         | V   | {"name":"Harga"} |
+----+-------------+-----+------------------+
tabel columns (5 yang dipakai, dari 26)
+----+----------+-----+
| id | sheet_id | key |
+----+----------+-----+
| k1 | s1       | 2   |
| k2 | s1       | 4   |
| k3 | s1       | 6   |
| k4 | s1       | 8   |
| k5 | s1       | A   |
+----+----------+-----+
tabel rows   (urut menurut key; kolom yang dipakai saja)
+----+----------+-----+--------------------------------------------------------------------+
| id | sheet_id | key | cells                                                              |
+----+----------+-----+--------------------------------------------------------------------+
| r1 | s1       | 04  | {"k1":"Kode","k2":"Produk","k3":"Harga","k4":"Stok","k5":"Nilai"}  |
| r2 | s1       | 08  | {"k1":"SMN-01","k2":"Semen 50 kg","k3":72000,"k4":420,"k5":"=…*…"} |
| r3 | s1       | 0C  | {"k1":"BSI-10","k2":"Besi 10 mm","k3":79500,"k4":260,"k5":"=…*…"}  |
| r4 | s1       | 0G  | {"k1":"CAT-05","k2":"Cat 5 kg","k3":145000,"k4":64,"k5":"=…*…"}    |
+----+----------+-----+--------------------------------------------------------------------+
Rumus disimpan dengan id kolom dan baris, bukan "C2": rumus tetap benar walau baris disisipkan. Ditulis … di sini.

4. STOK BESI DIUBAH JADI 300
patch: 1 baris diubah (r3), 0 dihapus
perintah ke database: UPDATE rows SET cells = {"k1":"BSI-10","k2":"Besi 10 mm","k3":79500,"k4":300,"k5":"=…*…"} WHERE id = 'r3'
Baris lain tidak disentuh. Nilai E3 (rumus) tidak dikirim: dihitung ulang saat dibuka.

5. BARIS BARU DISISIPKAN DI BARIS 3

+---+--------+-------------+--------+------+----------+
|   | A      | B           | C      | D    | E        |
+---+--------+-------------+--------+------+----------+
| 1 | Kode   | Produk      | Harga  | Stok | Nilai    |
| 2 | SMN-01 | Semen 50 kg | 72000  | 420  | 30240000 |
| 3 | SMN-02 | Semen putih | 112000 | 35   | 3920000  |
| 4 | BSI-10 | Besi 10 mm  | 79500  | 300  | 23850000 |
| 5 | CAT-05 | Cat 5 kg    | 145000 | 64   | 9280000  |
+---+--------+-------------+--------+------+----------+
patch: 1 baris -> INSERT INTO rows (id, key, cells) VALUES ('r5', '0A', {"k1":"SMN-02","k2":"Semen putih","k3":112000,"k4":35,"k5":"=…*…"})
Baris besi dan cat TIDAK ditulis ulang walau nomornya bergeser: urutan ditentukan key, dan 0A ada di antara 08 dan 0C.
tabel rows   (urut menurut key; kolom yang dipakai saja)
+----+----------+-----+--------------------------------------------------------------------+
| id | sheet_id | key | cells                                                              |
+----+----------+-----+--------------------------------------------------------------------+
| r1 | s1       | 04  | {"k1":"Kode","k2":"Produk","k3":"Harga","k4":"Stok","k5":"Nilai"}  |
| r2 | s1       | 08  | {"k1":"SMN-01","k2":"Semen 50 kg","k3":72000,"k4":420,"k5":"=…*…"} |
| r5 | s1       | 0A  | {"k1":"SMN-02","k2":"Semen putih","k3":112000,"k4":35,"k5":"=…*…"} |
| r3 | s1       | 0C  | {"k1":"BSI-10","k2":"Besi 10 mm","k3":79500,"k4":300,"k5":"=…*…"}  |
| r4 | s1       | 0G  | {"k1":"CAT-05","k2":"Cat 5 kg","k3":145000,"k4":64,"k5":"=…*…"}    |
+----+----------+-----+--------------------------------------------------------------------+

6. BARIS CAT DIHAPUS
patch: DELETE FROM rows WHERE id IN ('r4')

7. DIBUKA LAGI: E3 dihitung ulang dari rumusnya = =C3*D3 = 3920000
```
<!-- /hasil -->

Yang perlu ditangkap dari simulasi ini:

1. **Satu baris sheet = satu baris di tabel `rows`.** Isi semua sel di baris itu disimpan bersama dalam satu kolom JSON `cells`, dengan id kolom sebagai
   kuncinya (`k3` adalah kolom C, Harga). Sel kosong tidak disimpan.
2. **Baris dan kolom punya id yang tidak pernah berubah**, dan **key** yang menentukan urutannya. Nomor baris yang tampil di layar (1, 2, 3, …) tidak
   disimpan, tetapi dihitung dari urutan key.
3. **Menyisipkan baris hanya menulis satu baris baru.** Key barunya (`0A`) dipilih di antara key kedua tetangganya (`08` dan `0C`). Baris besi dan cat
   tidak disentuh walaupun nomornya di layar bergeser. Inilah yang membuat menyisipkan baris di sheet 100.000 baris tetap cepat.
4. **Rumus disimpan sebagai rumus**, dengan referensi berupa id baris dan kolom, dan hasilnya tidak disimpan. Saat dibuka lagi, hasilnya dihitung ulang.
   Karena referensinya id, `=C3*D3` tetap menunjuk baris yang benar setelah baris lain disisipkan.
5. **Satu ketikan = satu baris di patch.** `UPDATE` satu baris, `INSERT` satu baris, atau `DELETE` beberapa id. Workbook tidak pernah dikirim utuh
   kecuali saat pertama kali disimpan.

**Tabelnya**, dalam SQL PostgreSQL:

```sql
create table workbooks (id uuid primary key, version int not null, settings jsonb);
create table sheets    (id uuid primary key, workbook_id uuid not null references workbooks on delete cascade,
                        key text not null, props jsonb);                              -- props: nama sheet, freeze, filter, aturan conditional, ...
create table columns   (id uuid primary key, sheet_id uuid not null references sheets on delete cascade,
                        key text not null, props jsonb);                              -- props: lebar, format kolom, ...
create table rows      (id uuid primary key, sheet_id uuid not null references sheets on delete cascade,
                        key text not null, cells jsonb, style jsonb, props jsonb);    -- cells: { idKolom: nilai atau rumus }
create index on rows (sheet_id, key);
```

Urutkan dengan `order by key collate "C"`, yaitu perbandingan teks byte demi byte. Collation bahasa mengurutkan huruf besar dan kecil dengan cara lain.

**Cara yang lebih sederhana:** untuk workbook kecil sampai menengah, simpan `toJSON()` utuh di satu kolom `jsonb` (`workbooks.doc`), lalu gabungkan patch
dengan `mergePatch` (12.2) sebelum menulisnya kembali. Empat tabel di atas baru perlu kalau workbook-nya besar, atau kalau banyak orang menyimpan
bersamaan.

## 12.2 Alur simpan dengan pemeriksaan

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

1. **Server mengirim workbook** (`toJSON()` yang tersimpan, atau `viewFor` di 12.3). Browser membukanya dengan `createWorkbook(doc)` dan memasang aturan
   yang sama dengan server (`setRules`, `setAccess`, `setTypes`).
2. **Browser mengirim `wb.pendingPatch()`** (lihat autosave di [11.9](11-react.md#119-menyimpan-otomatis)).
3. **Server memanggil `checkPatch(tersimpan, patch, { rules, types, policy, who })`.** Semua yang tidak boleh dilakukan orang itu menjadi `problems`:
   sel terlindung yang diubah, baris berisi sel terlindung yang dihapus, nilai yang salah tipe, tindakan yang tidak diizinkan policy, sheet yang tidak
   boleh dilihatnya, dan patch yang dibuat dengan tangan (baris tanpa sheet, atau baris yang dipindah ke sheet lain).
4. **Kalau `ok`, server memanggil `mergePatch(tersimpan, patch, { rules, policy, who })`**, menyimpan hasilnya, lalu menaikkan `version`. Sel yang
   tidak pernah dikirim ke orang itu (12.3) dipertahankan dari yang tersimpan, apa pun isi patch-nya.
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

## 12.3 `viewFor`: hanya kirim yang boleh dilihat

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

## 12.4 Dua orang menyimpan bersamaan

`mergePatch` menulis setiap baris dalam patch **utuh**. Kalau dua orang mengubah baris yang sama dan menyimpan bergantian, yang menyimpan belakangan menang
untuk baris itu. Perubahan di baris yang berbeda tidak saling menimpa. `patch.workbook.version` adalah versi yang dimiliki browser saat patch dibuat.
Server bisa menolak patch dengan versi lama (`409 Conflict`) lalu meminta browser memuat ulang. Ini aman, tetapi kurang enak untuk orang yang sedang
bekerja.

Untuk banyak orang yang mengedit bersamaan dan saling melihat perubahannya secara langsung, op dikirim satu per satu (`wb.on('op')`) dan diterapkan di
browser lain dengan `wb.apply(ops, { source: 'remote' })` ([4.7](04-api-workbook.md#47-undo-redo-dan-apply)).

[Daftar isi](../README.md#daftar-isi) · Sebelumnya: [11. Memakai di React](11-react.md) · Berikutnya: [13. Access control](13-hak-akses.md)
