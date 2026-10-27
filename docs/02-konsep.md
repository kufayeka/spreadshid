# 2. Konsep dasar

[Daftar isi](../README.md#daftar-isi) · Sebelumnya: [1. Mulai cepat](01-mulai-cepat.md) · Berikutnya: [3. Komponen `<Sheet>`](03-komponen-sheet.md)

Cara library ini berpikir. Kalau enam hal di bawah sudah jelas, bab-bab berikutnya tinggal pakai.

- [2.1 Workbook dan sheet](#21-workbook-dan-sheet)
- [2.2 Alamat sel](#22-alamat-sel)
- [2.3 Isi sel: value, input, display, raw](#23-isi-sel-value-input-display-raw)
- [2.4 Id baris dan kolom](#24-id-baris-dan-kolom)
- [2.5 Perubahan, event, dan undo](#25-perubahan-event-dan-undo)
- [2.6 Menyimpan](#26-menyimpan)

## 2.1 Workbook dan sheet

**Workbook** itu satu file spreadsheet: isinya satu atau lebih **sheet** (tab), pengaturan (locale, mata uang, named range), dan riwayat undo.
Dibikin dengan `createWorkbook()` dari `@kufayeka/sheet/core` dan **tidak butuh React**. Workbook yang sama bisa diisi kode, ditampilkan `<Sheet>`,
dan dicek di server.

`<Sheet>` cuma **tampilan** dari workbook. Kalau tidak dikasih workbook, dia bikin yang kosong sendiri. Kalau dikasih (`<Sheet workbook={wb} />`),
semua yang dilakukan orang di layar terjadi di workbook itu, dan kodemu bisa baca, ubah, dengarkan tiap perubahan, dan simpan.

Tiap sheet punya **id** (string acak, tetap sama walau namanya diganti) dan **props** (nama, baris beku, filter, dan lain-lain):

<!-- contoh: 02-workbook.js -->
```js
import { createWorkbook } from '@kufayeka/sheet/core';

const wb = createWorkbook();
wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
const sh = wb.sheet('Sheet1');

sh.setValues('A1', [
    ['Volume', 'Harga', 'Jumlah'],
    [12.5, 85000, '=A2*B2']
]);
sh.setStyle('B2:C2', { format: { type: 'money', decimals: 0 } });

console.log('ukuran      :', sh.size());
console.log('value(C2)   :', sh.value('C2'));          // nilai sebenarnya
console.log('input(C2)   :', sh.input('C2'));          // yang muncul saat sel diedit
console.log('display(C2) :', sh.display('C2').text);   // yang tampil di sel

// teks dibaca seperti diketik orang, pakai locale workbook (id-ID)
sh.setValues('A2', '1.250,5');
console.log('A2 sekarang :', sh.value('A2'), '->', sh.display('C2').text);

// cara yang sama dengan angka (baris dan kolom mulai dari 0)
const [s] = wb.sheetIds();
console.log('pakai angka :', wb.value(s, 1, 2));
```
<!-- /contoh -->

Hasilnya:

<!-- hasil: 02-workbook.js -->
```text
ukuran      : { rows: 1000, cols: 26 }
value(C2)   : 1062500
input(C2)   : =A2*B2
display(C2) : Rp 1.062.500
A2 sekarang : 1250.5 -> Rp 106.292.500
pakai angka : 106292500
```
<!-- /hasil -->

## 2.2 Alamat sel

Ada dua cara menyebut sel, dan dua-duanya diterima di semua fungsi.

**Pakai alamat**, seperti di layar. Biasanya ini yang paling enak:

| Tulis | Artinya |
|---|---|
| `'C2'` | satu sel |
| `'A1:F1'` | range |
| `'A1:F1, A6:F6'` | beberapa range sekaligus (untuk `setStyle`, `clear`, `mergeCells`, dan sejenisnya) |
| `'B'`, `'B:D'` | kolom (untuk `setColProps`, `insertCols`, `groupCols`, kolom filter) |
| `'2'`, `'2:5'` | baris, nomor seperti di layar (untuk `setRowProps`, `insertRows`, `groupRows`) |

**Pakai nomor**, mulai dari 0 seperti indeks array. Enak dipakai waktu looping:

| Di layar | Nomor |
|---|---|
| sel `A1` | baris `0`, kolom `0` → `wb.value(s, 0, 0)` |
| sel `C2` | baris `1`, kolom `2` → `wb.value(s, 1, 2)` |
| range `B2:C4` | `{ r1: 1, c1: 1, r2: 3, c2: 2 }` |
| kolom `E:F` | `[4, 5]` |

Parameter pertama hampir semua fungsi workbook adalah **sheet** (id atau namanya). Kalau capek nulis itu terus, ambil sheet-nya sekali pakai
`wb.sheet('BOQ')`. Hasilnya punya fungsi yang sama, tanpa parameter sheet:

```js
wb.setStyle(s, 'A1:F1', { bold: true });   // sama dengan
const boq = wb.sheet('BOQ');
boq.setStyle('A1:F1', { bold: true });
```

`boq.id` adalah id sheet-nya, dan `boq.name` namanya yang sekarang.

## 2.3 Isi sel: value, input, display, raw

Satu sel punya empat sisi. Contohnya sel berisi rumus `=A2*B2` yang hasilnya 1.062.500 dengan format Rupiah:

| Fungsi | Hasil | Artinya |
|---|---|---|
| `value('C2')` | `1062500` | nilai sebenarnya: angka, teks, `true`/`false`, `null` (kosong), atau error `{ code: '#DIV/0!' }`. Rumus sudah dihitung. Ini yang dipakai buat logika aplikasi |
| `input('C2')` | `'=A2*B2'` | yang muncul waktu sel diedit: rumus apa adanya, angka sesuai locale |
| `display('C2')` | `{ text: 'Rp 1.062.500', align: 'right', kind: 'number' }` | yang tampil di sel, sudah diformat |
| `raw('C2')` | `{ f: '=⟦0⟧*⟦1⟧', refs: [...] }` | yang disimpan: nilai, atau rumus dengan referensi berupa id (lihat 2.4). Jarang perlu |

`setValues` menerima nilai seperti orang ngetik: angka tetap angka, teks diawali `=` jadi rumus, `'TRUE'` jadi boolean, dan teks seperti `'1.250,5'`
atau `'26/10/2026'` dibaca sesuai locale workbook. Mau menyimpan teks apa adanya (misalnya kode `'007'`)? Awali dengan petik satu: `"'007"`, sama
seperti di Excel.

## 2.4 Id baris dan kolom

Tiap baris dan kolom punya **id tetap** (UUID), bukan cuma nomor. Nomor baris bisa geser, misalnya kalau ada baris disisipkan di atasnya. Id-nya
tidak:

<!-- contoh: 02-id.js -->
```js
import { createWorkbook } from '@kufayeka/sheet/core';

const wb = createWorkbook();
const sh = wb.sheet('Sheet1');
sh.setValues('A1', [[10], [20], ['=SUM(A1:A2)']]);

// tiap baris dan kolom punya id tetap; nomor barisnya bisa berubah
const idBaris = sh.rowId(0);
console.log('id baris pertama :', typeof idBaris, idBaris.length, 'karakter');

sh.insertRows('1', 2); // dua baris baru di atas baris 1
console.log('baris tadi sekarang nomor', sh.rowIndex(idBaris) + 1);
console.log('rumus ikut pindah:', sh.input('A5'), '=', sh.value('A5'));

sh.insertRows('4');    // satu baris di tengah range SUM
sh.setValues('A4', 70);
console.log('range ikut lebar :', sh.input('A6'), '=', sh.value('A6'));
```
<!-- /contoh -->

Hasilnya:

<!-- hasil: 02-id.js -->
```text
id baris pertama : string 36 karakter
baris tadi sekarang nomor 3
rumus ikut pindah: =SUM(A3:A4) = 30
range ikut lebar : =SUM(A3:A5) = 100
```
<!-- /hasil -->

Id ini yang bikin semuanya stabil:

- **Rumus** menyimpan referensinya sebagai id, jadi `=SUM(A1:A2)` otomatis jadi `=SUM(A3:A4)` kalau dua baris disisipkan di atasnya.
- **Penyimpanan** ke database per baris berdasarkan id. Menyisipkan satu baris di tengah 100.000 baris cuma mengirim satu baris baru, tidak menggeser
  semuanya (bab 9).
- **Aturan, komentar, validasi, conditional formatting, dan named range** menempel ke sel lewat id, jadi ikut pindah bersama selnya.

Fungsi untuk bolak-balik nomor dan id: `rowId(s, r)`, `colId(s, c)`, `rowIndex(s, id)`, `colIndex(s, id)`. Nomor `-1` artinya baris atau kolom itu
sudah dihapus.

## 2.5 Perubahan, event, dan undo

Tiap perubahan, dari orang di layar, dari kode, atau dari undo, bentuknya daftar **op** (operasi kecil). Satu ketikan = satu op `cells`. Menyisipkan
baris = op `insertRows`. Paste bisa beberapa op sekaligus. Satu perubahan selalu utuh: diterapkan semua, atau tidak sama sekali.

<!-- contoh: 02-op.js -->
```js
import { createWorkbook } from '@kufayeka/sheet/core';

const wb = createWorkbook(null, {
    user: { id: 'u1', name: 'Rina' },
    // lihat tiap perubahan sebelum diterapkan: kembalikan op, null (abaikan), atau { reject: 'alasan' }
    beforeOp(op, ctx) {
        if (op.t === 'deleteRows' && ctx.source === 'user') return { reject: 'Baris BOQ tidak boleh dihapus' };
        return op;
    }
});
const sh = wb.sheet('Sheet1');

wb.on('op', (e) => console.log('op     :', e.source, '->', e.ops.map((o) => o.t).join(', ')));
wb.on('reject', (e) => console.log('tolak  :', e.reason));

sh.setValues('A1', 5, { source: 'user' }); // seolah diketik orang
sh.setValues('A1', 7);                     // dari kode
wb.undo();
console.log('undo   :', sh.value('A1'));
wb.redo();
console.log('redo   :', sh.value('A1'));

sh.deleteRows('1', { source: 'user' }); // ditolak beforeOp
console.log('baris  :', sh.size().rows);
```
<!-- /contoh -->

Hasilnya:

<!-- hasil: 02-op.js -->
```text
op     : user -> cells
op     : code -> cells
op     : undo -> cells
undo   : 5
op     : redo -> cells
redo   : 7
tolak  : Baris BOQ tidak boleh dihapus
baris  : 1000
```
<!-- /hasil -->

### Siapa yang mengubah: `source`

Fungsi yang mengubah workbook menerima parameter terakhir `how`, misalnya `{ source: 'user' }`:

| `source` | Artinya | Dicek aturan dan access control? | Masuk undo? |
|---|---|---|---|
| `'user'` | orang di layar. Semua yang lewat `<Sheet>` pakai ini | ya | ya |
| `'code'` | kodemu (bawaan kalau `how` tidak dikasih) | tidak, kodemu dipercaya | ya |
| `'undo'`, `'redo'` | dari `wb.undo()` / `wb.redo()` | | |
| `'remote'` | dari komputer lain atau server (misalnya edit bareng) | tidak | tidak |

### Opsi `createWorkbook(doc, options)`

| Opsi | Tipe | Artinya |
|---|---|---|
| `user` | `{ id, name }` atau string | siapa yang sedang kerja: dicatat di tiap op, dan jadi nama penulis komentar |
| `beforeOp(op, ctx)` | fungsi | lihat tiap op sebelum diterapkan. Kembalikan `op` (atau salinannya yang sudah diubah) untuk lanjut, `null`/`false` untuk diam-diam diabaikan, atau `{ reject: 'alasan' }` untuk menolak seluruh perubahan. `ctx` berisi `source`, `user`, `workbook` |
| `now` | `() => Date` | jam untuk `NOW()` dan `TODAY()` (berguna di test) |
| `undoLimit` | angka | berapa perubahan yang diingat undo (bawaan 200) |

### Event

`wb.on(nama, fungsi)` mendaftarkan pendengar, dan mengembalikan fungsi untuk berhenti.

| Event | Isi | Kapan |
|---|---|---|
| `op` | `{ ops, source }` | tiap perubahan yang berhasil diterapkan |
| `reject` | `{ reason, op, source }` | perubahan ditolak (oleh `beforeOp`, aturan, tipe kolom, validasi, atau access control) |
| `cellError` | `{ address, field, value, expected }` | nilai tidak cocok dengan tipe kolomnya (bab 10) |
| `saved` | | setelah `wb.saved(...)` |
| `layout` | | ukuran baris/kolom atau aturan berubah (dipakai tampilan) |
| `access` | `{ owner, roles, ui, message }` | access policy diganti (bab 11) |

## 2.6 Menyimpan

Workbook mencatat apa saja yang berubah sejak terakhir disimpan. `wb.pendingPatch()` kasih **bagian yang berubah saja**: sheet, kolom, dan baris
yang ditulis utuh berdasarkan id, plus yang dihapus. Setelah server menyimpannya, panggil `wb.saved(patch)`.

<!-- contoh: 02-simpan.js -->
```js
import { createWorkbook } from '@kufayeka/sheet/core';

const wb = createWorkbook();
const sh = wb.sheet('Sheet1');
sh.setValues('A1', [['Pekerjaan', 'Volume'], ['Galian', 120]]);

// yang belum tersimpan, siap dikirim ke server
let patch = wb.pendingPatch();
console.log('simpan pertama :', patch.sheets.upsert.length, 'sheet,', patch.columns.upsert.length, 'kolom,', patch.rows.upsert.length, 'baris');
wb.saved(patch); // anggap server sudah menyimpannya

sh.setValues('B2', 125);
patch = wb.pendingPatch();
console.log('satu perubahan :', patch.rows.upsert.length, 'baris dikirim');

// seluruh workbook jadi objek biasa, lalu dibuka lagi
const doc = wb.toJSON();
const dibukaLagi = createWorkbook(doc);
console.log('dibuka lagi    :', dibukaLagi.sheet('Sheet1').value('B2'));
```
<!-- /contoh -->

Hasilnya:

<!-- hasil: 02-simpan.js -->
```text
simpan pertama : 1 sheet, 26 kolom, 1000 baris
satu perubahan : 1 baris dikirim
dibuka lagi    : 125
```
<!-- /hasil -->

Workbook baru dikirim semua di simpanan pertama. Setelah itu satu ketikan cuma mengirim satu baris. `wb.toJSON()` kasih seluruh workbook sebagai
objek biasa, dan `createWorkbook(doc)` membukanya lagi. Bentuk tabel database, cara menggabungkan patch di server (`mergePatch`), dan cara
mengeceknya (`checkPatch`) ada di bab 9.

[Daftar isi](../README.md#daftar-isi) · Sebelumnya: [1. Mulai cepat](01-mulai-cepat.md) · Berikutnya: [3. Komponen `<Sheet>`](03-komponen-sheet.md)
