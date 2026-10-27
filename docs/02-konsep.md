# 2. Konsep dasar

[Daftar isi](../README.md#daftar-isi) · Sebelumnya: [1. Mulai cepat](01-mulai-cepat.md) · Berikutnya: [3. Komponen `<Sheet>`](03-komponen-sheet.md)

Bab ini menjelaskan cara library berpikir. Kalau enam hal di bawah ini sudah jelas, bab-bab berikutnya tinggal memakainya.

- [2.1 Workbook dan sheet](#21-workbook-dan-sheet)
- [2.2 Baris, kolom, dan kotak sel](#22-baris-kolom-dan-kotak-sel)
- [2.3 Isi sel: value, input, display, raw](#23-isi-sel-value-input-display-raw)
- [2.4 Id baris dan kolom](#24-id-baris-dan-kolom)
- [2.5 Perubahan, event, dan undo](#25-perubahan-event-dan-undo)
- [2.6 Menyimpan](#26-menyimpan)

## 2.1 Workbook dan sheet

**Workbook** adalah satu file spreadsheet: berisi satu atau lebih **sheet** (tab), pengaturan (locale, mata uang, named range), dan riwayat undo.
Workbook dibuat dengan `createWorkbook()` dari `@kufayeka/sheet/core` dan **tidak bergantung pada React**. Workbook yang sama bisa diisi oleh kode
Anda, ditampilkan oleh `<Sheet>`, dan diperiksa di server.

`<Sheet>` hanyalah **tampilan** dari sebuah workbook. Kalau Anda tidak memberinya workbook, ia membuat workbook kosong sendiri. Kalau Anda memberinya
(`<Sheet workbook={wb} />`), semua yang dilakukan orang di layar terjadi pada workbook itu, dan kode Anda bisa membacanya, mengubahnya, mendengarkan
setiap perubahannya, dan menyimpannya.

Setiap sheet punya **id** (string acak, tidak berubah walau sheet diganti namanya) dan **props** (nama, baris beku, filter, dan lain-lain):

<!-- contoh: 02-workbook.js -->
```js
import { createWorkbook } from '@kufayeka/sheet/core';

const wb = createWorkbook();
const [s] = wb.sheetIds(); // id sheet pertama
wb.setSettings({ locale: 'id-ID', currency: 'IDR' });

// baris 0, kolom 0 = sel A1; satu array per baris
wb.setValues(s, 0, 0, [
    ['Volume', 'Harga', 'Jumlah'],
    [12.5, 85000, '=A2*B2']
]);
wb.setStyle(s, { r1: 1, c1: 1, r2: 1, c2: 2 }, { format: { type: 'money', decimals: 0 } });

console.log('nama sheet  :', wb.sheetProps(s).name);
console.log('ukuran      :', wb.size(s));
console.log('value(C2)   :', wb.value(s, 1, 2));          // nilai sebenarnya (angka)
console.log('input(C2)   :', wb.input(s, 1, 2));          // yang terlihat saat sel diedit
console.log('display(C2) :', wb.display(s, 1, 2).text);   // yang tampil di sel

// teks diketik seperti orang mengetik, dibaca dengan locale workbook (id-ID)
wb.setValues(s, 1, 0, '1.250,5');
console.log('A2 sekarang :', wb.value(s, 1, 0), '->', wb.display(s, 1, 2).text);
```
<!-- /contoh -->

Hasilnya:

<!-- hasil: 02-workbook.js -->
```text
nama sheet  : Sheet1
ukuran      : { rows: 1000, cols: 26 }
value(C2)   : 1062500
input(C2)   : =A2*B2
display(C2) : Rp 1.062.500
A2 sekarang : 1250.5 -> Rp 106.292.500
```
<!-- /hasil -->

Parameter pertama hampir semua fungsi adalah **sheet**. Boleh berupa id sheet atau namanya (`'Sheet1'`), tapi id lebih aman karena nama bisa diganti
orang.

## 2.2 Baris, kolom, dan kotak sel

Di kode, baris dan kolom adalah **nomor yang dimulai dari 0**:

| Di layar | Di kode |
|---|---|
| sel `A1` | baris `0`, kolom `0` |
| sel `C2` | baris `1`, kolom `2` |
| kolom `AA` | kolom `26` |

Sekumpulan sel (range) ditulis sebagai **kotak**: `{ r1, c1, r2, c2 }`, yaitu baris dan kolom pojok kiri atas sampai pojok kanan bawah, termasuk
keduanya. `B2:C4` di layar adalah `{ r1: 1, c1: 1, r2: 3, c2: 2 }`.

Yang ditulis sebagai **teks** tetap memakai cara layar: rumus (`=SUM(A1:A10)`), `select('B2:C4')`, range di aturan (`range: 'A2:F500'`), dan named
range.

## 2.3 Isi sel: value, input, display, raw

Satu sel punya empat sisi. Ambil contoh sel berisi rumus `=A2*B2` yang hasilnya 1.062.500 dengan format Rupiah:

| Fungsi | Hasil | Artinya |
|---|---|---|
| `wb.value(s, r, c)` | `1062500` | nilai sebenarnya: angka, teks, `true`/`false`, `null` (kosong), atau objek error `{ code: '#DIV/0!' }`. Rumus sudah dihitung. Pakai ini untuk logika aplikasi |
| `wb.input(s, r, c)` | `'=A2*B2'` | yang terlihat saat sel diedit: rumus apa adanya, angka dalam format locale |
| `wb.display(s, r, c)` | `{ text: 'Rp 1.062.500', align: 'right', kind: 'number', ... }` | yang tampil di sel, sudah diformat |
| `wb.raw(s, r, c)` | `{ f: '=⟦0⟧*⟦1⟧', refs: [...] }` | yang disimpan: nilai, atau rumus dengan referensi berupa id (lihat 2.4). Jarang dibutuhkan |

`setValues` menerima nilai seperti orang mengetik: angka tetap angka, teks diawali `=` menjadi rumus, `'TRUE'` menjadi boolean, dan teks seperti
`'1.250,5'` atau `'26/10/2026'` dibaca sesuai locale workbook. Untuk menyimpan teks apa adanya (misalnya kode `'007'`), awali dengan petik
satu: `"'007"`, sama seperti di Excel.

## 2.4 Id baris dan kolom

Setiap baris dan setiap kolom punya **id tetap** (UUID), tidak hanya nomor. Nomor baris bisa berubah, misalnya saat baris disisipkan di atasnya, tapi
id-nya tidak:

<!-- contoh: 02-id.js -->
```js
import { createWorkbook } from '@kufayeka/sheet/core';

const wb = createWorkbook();
const [s] = wb.sheetIds();
wb.setValues(s, 0, 0, [[10], [20], ['=SUM(A1:A2)']]);

// setiap baris dan kolom punya id tetap; nomor barisnya bisa berubah
const idBaris = wb.rowId(s, 0);
console.log('id baris pertama :', typeof idBaris, idBaris.length, 'karakter');

wb.insertRows(s, 0, 2); // dua baris baru di atas
console.log('baris tadi sekarang nomor', wb.rowIndex(s, idBaris));
console.log('formula ikut pindah:', wb.input(s, 4, 0), '=', wb.value(s, 4, 0));

wb.setValues(s, 0, 0, 5); // sel di baris baru, di luar range SUM
wb.insertRows(s, 3, 1);   // satu baris di tengah range SUM
wb.setValues(s, 3, 0, 70);
console.log('range ikut melebar  :', wb.input(s, 5, 0), '=', wb.value(s, 5, 0));
```
<!-- /contoh -->

Hasilnya:

<!-- hasil: 02-id.js -->
```text
id baris pertama : string 36 karakter
baris tadi sekarang nomor 2
formula ikut pindah: =SUM(A3:A4) = 30
range ikut melebar  : =SUM(A3:A5) = 100
```
<!-- /hasil -->

Id inilah yang membuat semuanya stabil:

- **Rumus** menyimpan referensinya sebagai id, jadi `=SUM(A1:A2)` otomatis menjadi `=SUM(A3:A4)` saat dua baris disisipkan di atasnya.
- **Penyimpanan** ke database terjadi per baris berdasarkan id, jadi menyisipkan satu baris di tengah 100.000 baris hanya mengirim satu baris baru,
  bukan menggeser semua (bab 9).
- **Aturan, komentar, validasi, conditional formatting, dan named range** menempel pada sel lewat id, jadi semuanya ikut pindah bersama selnya.

Fungsi untuk berpindah antara nomor dan id: `rowId(s, r)`, `colId(s, c)`, `rowIndex(s, id)`, `colIndex(s, id)`. Nomor `-1` berarti baris atau
kolom itu sudah dihapus.

## 2.5 Perubahan, event, dan undo

Setiap perubahan pada workbook, dari orang di layar, dari kode Anda, atau dari undo, berbentuk daftar **op** (operasi kecil). Satu ketikan adalah satu
op `cells`; menyisipkan baris adalah op `insertRows`; paste bisa beberapa op sekaligus. Satu perubahan selalu utuh: diterapkan semuanya, atau tidak
sama sekali.

<!-- contoh: 02-op.js -->
```js
import { createWorkbook } from '@kufayeka/sheet/core';

const wb = createWorkbook(null, {
    user: { id: 'u1', name: 'Rina' },
    // melihat setiap perubahan sebelum diterapkan: kembalikan op, null (abaikan), atau { reject: 'alasan' }
    beforeOp(op, ctx) {
        if (op.t === 'deleteRows' && ctx.source === 'user') return { reject: 'Baris BOQ tidak boleh dihapus' };
        return op;
    }
});
const [s] = wb.sheetIds();

wb.on('op', (e) => console.log('op     :', e.source, '->', e.ops.map((o) => o.t).join(', ')));
wb.on('reject', (e) => console.log('tolak  :', e.reason));

wb.setValues(s, 0, 0, 5, { source: 'user' }); // seperti diketik orang
wb.setValues(s, 0, 0, 7);                     // dari kode Anda
wb.undo();
console.log('undo   :', wb.value(s, 0, 0));
wb.redo();
console.log('redo   :', wb.value(s, 0, 0));

wb.deleteRows(s, 0, 1, { source: 'user' }); // ditolak oleh beforeOp
console.log('baris  :', wb.size(s).rows);
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

Setiap fungsi yang mengubah workbook menerima parameter terakhir `how`, misalnya `{ source: 'user' }`. Nilainya:

| `source` | Artinya | Diperiksa aturan dan access control? | Masuk undo? |
|---|---|---|---|
| `'user'` | orang di layar. Semua yang dilakukan lewat `<Sheet>` memakai ini | ya | ya |
| `'code'` | kode Anda (bawaan kalau `how` tidak diberikan) | tidak: kode Anda dipercaya | ya |
| `'undo'`, `'redo'` | dari `wb.undo()` / `wb.redo()` | | |
| `'remote'` | dari komputer lain atau server (misalnya edit bersama) | tidak | tidak |

### Opsi `createWorkbook(doc, options)`

| Opsi | Tipe | Artinya |
|---|---|---|
| `user` | `{ id, name }` atau string | siapa yang sedang bekerja: dicatat di setiap op dan dipakai sebagai penulis komentar |
| `beforeOp(op, ctx)` | fungsi | melihat setiap op sebelum diterapkan. Kembalikan `op` (atau salinannya yang sudah diubah) untuk menerapkan, `null`/`false` untuk mengabaikan diam-diam, atau `{ reject: 'alasan' }` untuk menolak seluruh perubahan. `ctx` berisi `source`, `user`, dan `workbook` |
| `now` | fungsi `() => Date` | jam untuk `NOW()` dan `TODAY()` (berguna untuk test) |
| `undoLimit` | angka | berapa perubahan yang diingat undo (bawaan 200) |

### Event

`wb.on(nama, fungsi)` mendaftarkan pendengar dan mengembalikan fungsi untuk berhenti mendengarkan.

| Event | Isi | Kapan |
|---|---|---|
| `op` | `{ ops, source }` | setiap perubahan yang berhasil diterapkan |
| `reject` | `{ reason, op, source }` | sebuah perubahan ditolak (oleh `beforeOp`, aturan, tipe kolom, validasi, atau access control) |
| `cellError` | `{ address, field, value, expected }` | nilai tidak sesuai tipe kolomnya (bab 10) |
| `saved` | | setelah `wb.saved(...)` |
| `layout` | | ukuran baris/kolom atau aturan berubah (dipakai tampilan) |
| `access` | `{ owner, roles, ui, message }` | access policy diganti (bab 11) |

## 2.6 Menyimpan

Workbook mencatat apa saja yang berubah sejak terakhir disimpan. `wb.pendingPatch()` memberikan **hanya bagian yang berubah**: sheet, kolom, dan baris
yang ditulis utuh berdasarkan id, plus yang dihapus. Setelah server Anda menyimpannya, panggil `wb.saved(patch)`.

<!-- contoh: 02-simpan.js -->
```js
import { createWorkbook } from '@kufayeka/sheet/core';

const wb = createWorkbook();
const [s] = wb.sheetIds();
wb.setValues(s, 0, 0, [['Pekerjaan', 'Volume'], ['Galian', 120]]);

// yang belum tersimpan, siap dikirim ke server
let patch = wb.pendingPatch();
console.log('simpan pertama :', patch.sheets.upsert.length, 'sheet,', patch.columns.upsert.length, 'kolom,', patch.rows.upsert.length, 'baris');
wb.saved(patch); // server sudah menyimpannya

wb.setValues(s, 1, 1, 125);
patch = wb.pendingPatch();
console.log('satu perubahan :', patch.rows.upsert.length, 'baris dikirim');

// seluruh workbook sebagai objek biasa, dan dibuka lagi darinya
const doc = wb.toJSON();
const dibukaLagi = createWorkbook(doc);
console.log('dibuka lagi    :', dibukaLagi.value(dibukaLagi.sheetIds()[0], 1, 1));
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

Workbook baru dikirim seluruhnya pada simpanan pertama. Sesudah itu, satu ketikan hanya mengirim satu baris. `wb.toJSON()` memberikan seluruh workbook
sebagai objek biasa, dan `createWorkbook(doc)` membukanya lagi. Bentuk tabel database, cara menggabungkan patch di server (`mergePatch`), dan cara
memeriksanya (`checkPatch`) ada di bab 9.

[Daftar isi](../README.md#daftar-isi) · Sebelumnya: [1. Mulai cepat](01-mulai-cepat.md) · Berikutnya: [3. Komponen `<Sheet>`](03-komponen-sheet.md)
