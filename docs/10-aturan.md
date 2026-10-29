# 10. Aturan dan tipe kolom

[Daftar isi](../README.md#daftar-isi) · Sebelumnya: [9. Mengisi sheet dari data](09-populate.md) · Berikutnya: [11. Memakai di React](11-react.md)

Dua cara aplikasimu menjaga isi sheet:

- **Aturan** (`setRules`): sel mana yang hanya boleh dibaca dan isi mana yang disembunyikan, untuk orang yang sedang membuka sheet. Misalnya kasir tidak
  boleh melihat harga beli dan tidak boleh mengubah harga jual.
- **Tipe kolom** (`setTypes`): jenis nilai yang boleh masuk ke setiap kolom, sama dengan kolom tabel di database. Stok harus bilangan bulat, kategori harus
  salah satu dari daftar.

Keduanya datang dari kode aplikasimu, bukan dari isi file. Aturan dan tipe tidak ikut disimpan dan tidak masuk undo, karena aturan yang sama dipasang lagi
setiap kali sheet dibuka, menurut siapa yang membukanya. Pemeriksaan yang sama juga berjalan di server ([bab 12](12-server.md)), jadi orang yang mengakali
browser tetap ditolak saat menyimpan.

Untuk mengatur **siapa boleh melakukan apa** secara lengkap (menghapus baris, memakai menu tertentu, melihat sheet tertentu), lihat access control di
[bab 13](13-hak-akses.md). Aturan di bab ini adalah bagian per sel dari access control itu.

- [10.1 Aturan: hanya baca dan tersembunyi](#101-aturan-hanya-baca-dan-tersembunyi)
- [10.2 Tipe kolom](#102-tipe-kolom)

## 10.1 Aturan: hanya baca dan tersembunyi

Daftar produk yang dibuka kasir:

<!-- contoh: 10-aturan.js -->
```js
import { createWorkbook } from '@kufayeka/sheet/core';
import { PRODUK, KOLOM_PRODUK } from './data/toko.js';

// Daftar produk yang dibuka kasir: harga beli tidak boleh terlihat, harga jual hanya boleh dibaca, produk yang dihentikan terkunci seluruhnya.
// Kasir hanya boleh mengubah stok dan status.
export function buatProdukKasir() {
    const wb = createWorkbook();
    wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
    const p = wb.sheet('Sheet1');
    p.setSheetProps({ name: 'Produk', freezeRows: 1 });
    p.setValues('A1', [[...KOLOM_PRODUK, 'Status'], ...PRODUK.map((x, i) => [...x, i === 7 ? 'Dihentikan' : 'Aktif'])]);
    p.setStyle('A1:I1', { bold: true, fill: '#e8f0fe' });
    p.setColProps('E:F', { format: { type: 'money', decimals: 0 } });
    p.setColProps('B', { width: 180 });

    // aturan dari backend untuk peran "kasir". Kolom disebut menurut judulnya, jadi tetap benar walau kolom dipindah
    wb.setRules([
        { sheet: 'Produk', columns: ['Harga beli'], mode: 'hidden' },
        { sheet: 'Produk', columns: ['Kode', 'Nama produk', 'Kategori', 'Satuan', 'Harga jual', 'Stok min.'], mode: 'readonly',
            message: 'Data produk diatur bagian pembelian' },
        { sheet: 'Produk', range: 'A2:I1000', when: '=$I2="Dihentikan"', mode: 'readonly', message: 'Produk ini sudah dihentikan' }
    ]);
    return wb;
}

const wb = buatProdukKasir();
const p = wb.sheet('Produk');
const ditolak = [];
wb.on('reject', (e) => ditolak.push(e.reason));
const kasir = { source: 'user' };                            // yang diketik kasir di layar

p.setValues('G2', 400, kasir);                               // stok: boleh
p.setValues('F2', 1, kasir);                                 // harga jual: ditolak
p.setValues('G9', 30, kasir);                                // stok produk yang dihentikan: ditolak
p.setValues('I3', 'Dihentikan', kasir);                      // status: boleh, dan baris itu langsung terkunci
p.setValues('G3', 50, kasir);
console.log('stok G2, G3   :', p.value('G2'), p.value('G3'));
console.log('ditolak       :');
for (const alasan of ditolak) console.log('  -', alasan);

console.log('mode sel      :', ['E2', 'F2', 'G2', 'G9'].map((a) => a + ' ' + ((p.modeAt(a) || {}).mode || 'bebas')).join(' | '));
console.log('harga beli E2 :', p.display('E2').text, '| input', JSON.stringify(p.input('E2')), '| judul E1 tetap:', p.display('E1').text);

// kode aplikasi sendiri tidak dihalangi aturan: misalnya sinkron harga dari sistem pembelian
p.setValues('F2', 75000);
console.log('dari kode     :', p.display('F2').text);

// aturan bukan bagian workbook: tidak disimpan, tidak masuk undo, diganti utuh oleh setRules berikutnya
console.log('isi toJSON    :', Object.keys(wb.toJSON()).join(', '), '(aturan tidak ikut)');
wb.setRules([]);                                             // peran manajer: tanpa aturan
console.log('manajer       :', p.display('E2').text, '| mode F2', p.modeAt('F2'));
```
<!-- /contoh -->

<!-- hasil: 10-aturan.js -->
```text
stok G2, G3   : 400 35
ditolak       :
  - Data produk diatur bagian pembelian
  - Produk ini sudah dihentikan
  - Produk ini sudah dihentikan
mode sel      : E2 hidden | F2 readonly | G2 bebas | G9 readonly
harga beli E2 : ••• | input "" | judul E1 tetap: Harga beli
dari kode     : Rp 75.000
isi toJSON    : id, version, settings, sheets (aturan tidak ikut)
manajer       : Rp 64.000 | mode F2 null
```
<!-- /hasil -->

Di layar, kasir yang mengetik di kolom Harga jual mendapat pesan dari aturannya. Sel yang dilindungi diberi gembok kecil di pojok kanan atas (bawaan, bisa diganti dengan prop `marks`, lihat [13.9](13-hak-akses.md#139-langkah-8-di-react)):

![Kolom terlindung dan pesan penolakan](img/aturan.png)

<!-- contoh: 10-aturan.page.js -->
```jsx
import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import '@kufayeka/sheet/style.css';
import { buatProdukKasir } from './10-aturan.js';

export default function HalamanKasir() {
    const [wb] = useState(buatProdukKasir);
    // sel yang dilindungi aturan diberi gembok kecil di pojok (bawaan); marks={{ stripes: true }} menambah garis-garis
    return <div style={{ height: 520 }}><Sheet workbook={wb} /></div>;
}
```
<!-- /contoh -->

| Kunci aturan | Artinya | Bawaan |
|---|---|---|
| `sheet` | nama atau id sheet | semua sheet |
| `range` | sel yang diatur, misalnya `'A2:I1000'`. Mengikuti baris yang disisipkan | seluruh sheet |
| `columns` | hanya kolom tertentu, menurut judulnya (`'Harga beli'`) atau hurufnya (`'E'`) | semua kolom |
| `headerRow` | baris tempat judul kolom, dihitung dari 1 | `1` |
| `when` | hanya di baris yang rumusnya `TRUE`. Ditulis untuk baris pertama range (atau baris di bawah judul), lalu bergeser ke baris lain | selalu |
| `mode` | `'readonly'`: boleh dilihat, tidak boleh diubah. `'hidden'`: isinya tampil `•••` dan tidak bisa dibaca, disalin, atau dicari | |
| `message` | pesan untuk orang yang perubahannya ditolak | pesan bawaan dalam bahasa Inggris |

Yang perlu diketahui:

- **Hanya untuk orang.** Perubahan dari orang (diketik, di-paste, di-fill, dihapus, atau ditulis kode dengan `{ source: 'user' }`) diperiksa. Kode
  aplikasimu sendiri tidak dihalangi.
- **`when` dihitung terus.** Begitu status sebuah produk diubah menjadi "Dihentikan", barisnya langsung terkunci, seperti G3 di contoh.
- **`hidden` hanya di layar.** Nilai asli tetap ada di workbook dan rumus tetap menghitungnya. Kalau nilainya sama sekali tidak boleh sampai ke browser,
  jangan kirim nilainya. `viewFor` di server membuang nilai itu sebelum dikirim ([bab 12](12-server.md)).
- **Judul kolom tetap tampil.** Baris judul (`headerRow`) tidak ikut disembunyikan atau dikunci oleh aturan `columns`.
- **Menghapus baris yang memuat sel terlindung** ditolak, begitu juga menghapus kolomnya.
- `setRules(daftar)` mengganti seluruh aturan. `setRules([])` membuang semuanya.

| Fungsi | Artinya |
|---|---|
| `wb.setRules(daftar)` | pasang aturan untuk orang yang membuka sheet |
| `modeAt(alamat)` | `{ mode, message }` untuk sel itu, atau `null` kalau bebas |

## 10.2 Tipe kolom

Master produk yang nanti disimpan ke tabel database:

<!-- contoh: 10-tipe.js -->
```js
import { createWorkbook, fromApiMakerType, checkValue } from '@kufayeka/sheet/core';

// Master produk yang nanti disimpan ke database: setiap kolom punya tipe, jadi yang masuk ke sheet sudah pasti cocok dengan tabelnya.
// Tipe ditulis seperti Type di Nexa API Maker (types/Produk.type.json), atau langsung dalam bentuk kind.
const Produk = {
    name: 'Produk',
    fields: {
        Kode: { type: 'string' },
        Nama: { type: 'string' },
        Kategori: { type: 'KategoriProduk' },
        Harga: { type: 'decimal', scale: 0 },
        Stok: { type: 'int' },
        Aktif: { type: 'boolean' },
        'Mulai dijual': { type: 'date' }
    }
};
const library = { KategoriProduk: { name: 'KategoriProduk', enum: ['Semen', 'Besi', 'Cat', 'Keramik', 'Pipa'] } };

const wb = createWorkbook();
wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
const p = wb.sheet('Sheet1');
p.setValues('A1', [['Kode', 'Nama', 'Kategori', 'Harga', 'Stok', 'Aktif', 'Mulai dijual']]);
// judul di baris 1 menyebut nama field: kolom dengan judul itu mendapat tipenya
p.setTypes({ headerRow: 1, fields: fromApiMakerType(Produk, library).fields });
console.log('tipe kolom    :', ['A2', 'C2', 'D2', 'E2', 'F2', 'G2'].map((a) => { const t = p.typeAt(a); return a[0] + ' ' + t.kind + (t.enum ? ' (pilihan ' + t.enum.length + ')' : ''); }).join(', '));

const salah = [];
wb.on('cellError', (e) => salah.push(e.address + ' ' + e.field + ': ' + JSON.stringify(e.value) + ' bukan ' + e.expected));
const orang = { source: 'user' };
p.setValues('A2', '0081', orang);                          // string: angka yang diketik tetap teks
p.setValues('B2', 'Semen Portland 50 kg', orang);
p.setValues('C2', 'Semen', orang);
p.setValues('C3', 'Pasir', orang);                         // bukan nilai enum
p.setValues('D2', '72.000', orang);
p.setValues('D3', '72.000,5', orang);                      // decimal dengan scale 0: tidak boleh ada desimal
p.setValues('E2', 420, orang);
p.setValues('E3', 12.5, orang);                            // int
p.setValues('F2', 'TRUE', orang);
p.setValues('F3', 'ya', orang);                            // boolean
p.setValues('G2', '01/10/2026', orang);
p.setValues('G3', 'minggu depan', orang);                  // date

console.log('baris 2       :', ['A2', 'B2', 'C2', 'D2', 'E2', 'F2', 'G2'].map((a) => JSON.stringify(p.value(a))).join(', '));
console.log('ditolak       :');
for (const s of salah) console.log('  -', s);
console.log('baris 3 tetap :', ['C3', 'D3', 'E3', 'F3', 'G3'].map((a) => JSON.stringify(p.value(a))).join(', '));

// tipe per huruf kolom, tanpa judul, untuk sheet lain
const w2 = createWorkbook();
w2.sheet('Sheet1').setTypes({ columns: { B: { kind: 'int' }, C: { kind: 'string', enum: ['Grosir', 'Eceran'] } } });
w2.setValues('Sheet1', 'B1', 3.5, orang);
w2.setValues('Sheet1', 'C1', 'Eceran', orang);
console.log('per huruf     :', JSON.stringify(w2.value('Sheet1', 'B1')), JSON.stringify(w2.value('Sheet1', 'C1')), JSON.stringify(w2.sheet('Sheet1').typeAt('C1')));

// checkValue: pemeriksaan yang sama tanpa sheet, misalnya di server sebelum menyimpan
console.log('checkValue    :', JSON.stringify(checkValue({ kind: 'int' }, 4)), JSON.stringify(checkValue({ kind: 'int' }, 4.5)), JSON.stringify(checkValue({ kind: 'decimal', scale: 2 }, 1.234)));
```
<!-- /contoh -->

<!-- hasil: 10-tipe.js -->
```text
tipe kolom    : A string, C string (pilihan 5), D decimal, E int, F boolean, G date
baris 2       : "0081", "Semen Portland 50 kg", "Semen", 72000, 420, true, 46296
ditolak       :
  - C3 Kategori: "Pasir" bukan one of: Semen, Besi, Cat, Keramik, Pipa
  - D3 Harga: 72000.5 bukan a number with at most 0 digits after the point
  - E3 Stok: 12.5 bukan a whole number
  - F3 Aktif: "ya" bukan TRUE or FALSE
  - G3 Mulai dijual: "minggu depan" bukan a date
baris 3 tetap : null, null, null, null, null
per huruf     : null "Eceran" {"kind":"string","enum":["Grosir","Eceran"],"field":"C"}
checkValue    : null "a whole number" "a number with at most 2 digits after the point"
```
<!-- /hasil -->

Tipe dipasang per sheet dengan salah satu dari dua cara:

- **Menurut judul kolom**: `setTypes({ headerRow: 1, fields: { Stok: { kind: 'int' }, ... } })`. Kolom yang judulnya sama dengan nama field mendapat
  tipe itu, jadi tetap benar walaupun kolomnya dipindah. `fromApiMakerType(Type, library)` membuat `fields` dari sebuah Type Nexa API Maker.
- **Menurut huruf kolom**: `setTypes({ columns: { B: { kind: 'int' } } })`.

`setTypes(null)` membuang tipe sheet itu.

| `kind` | Sel menerima | Contoh salah |
|---|---|---|
| `string` | teks apa saja. Angka yang diketik tetap teks, jadi `0081` tetap `0081` | |
| `string` dengan `enum: [...]` | salah satu nilai di daftar | `Pasir` kalau tidak ada di daftar |
| `int` | bilangan bulat | `12,5` |
| `number` | angka | `banyak` |
| `decimal` dengan `scale` | angka dengan desimal paling banyak `scale` digit | `72.000,5` dengan `scale: 0` |
| `boolean` | `TRUE` atau `FALSE` | `ya` |
| `date` | tanggal (satu hari penuh) | `minggu depan` |
| `datetime` | tanggal dan jam | |
| `json` | apa saja, tidak diperiksa | |

Yang perlu diketahui:

- **Sel kosong selalu boleh.** Apakah sebuah kolom wajib diisi ditentukan saat data disimpan, bukan di sheet.
- **Yang salah ditolak**, nilainya tidak masuk, dan event `cellError` (prop `onCellError` di `<Sheet>`) menerima `{ address, field, value, expected }`
  untuk ditampilkan dengan caramu sendiri. Pesan `expected` dalam bahasa Inggris.
- **Ketikan dibaca menurut locale dulu**, baru diperiksa. Dengan `id-ID`, `72.000` di kolom `decimal` adalah 72000.
- `typeAt(alamat)` memberi tipe sebuah sel, termasuk nama field-nya.
- `checkValue(tipe, nilai)` menjalankan pemeriksaan yang sama tanpa sheet, misalnya di server. Hasilnya `null` kalau cocok, atau teks yang diharapkan.

[Daftar isi](../README.md#daftar-isi) · Sebelumnya: [9. Mengisi sheet dari data](09-populate.md) · Berikutnya: [11. Memakai di React](11-react.md)
