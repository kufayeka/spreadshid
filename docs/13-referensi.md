# 13. Optimasi Performa & Referensi API Lengkap

[Daftar Isi](../README.md#daftar-isi) · Sebelumnya: [12. Visualisasi Data & Dashboard Interaktif](12-dashboard.md)

Bab penutup ini menguraikan karakteristik performa `@kufayeka/sheet` saat menangani dataset masif (100.000+ baris dan ratusan ribu formula), panduan optimasi arsitektur untuk meminimalkan latensi dan konsumsi memori, serta katalog referensi lengkap untuk seluruh API core engine, komponen React, dan definisi tipe TypeScript.

---

## Daftar Subbab
- [13.1 Benchmarking & Skalabilitas Data Masif (100.000+ Baris & Formula DAG)](#131-benchmarking--skalabilitas-data-masif-100000-baris--formula-dag)
- [13.2 Karakteristik Performa & Metrik Latensi](#132-karakteristik-performa--metrik-latensi)
- [13.3 Best Practices & Panduan Optimasi Performa](#133-best-practices--panduan-optimasi-performa)
- [13.4 Referensi Paket React: `@kufayeka/sheet`](#134-referensi-paket-react-kufayekasheet)
- [13.5 Referensi Paket Core: `@kufayeka/sheet/core`](#135-referensi-paket-core-kufayekasheetcore)
- [13.6 Referensi Method Instansi `Workbook`](#136-referensi-method-instansi-workbook)
- [13.7 Referensi Method `SheetApi` (Sheet Handle)](#137-referensi-method-sheetapi-sheet-handle)
- [13.8 Indeks Spesifikasi Teknis Lintas Bab](#138-indeks-spesifikasi-teknis-lintas-bab)
- [13.9 Integrasi TypeScript & Type Definitions](#139-integrasi-typescript--type-definitions)

---

## 13.1 Benchmarking & Skalabilitas Data Masif (100.000+ Baris & Formula DAG)

Arsitektur `@kufayeka/sheet` dirancang khusus untuk memproses volume data level enterprise secara efisien tanpa mengalami degradasi responsivitas antarmuka:
1. **DAG Dependency Graph**: Engine kalkulasi hanya mengevaluasi sel yang secara langsung atau transitif bergantung pada sel yang dimodifikasi. Mengubah 1 sel di tengah 100.000 baris tidak memicu kalkulasi ulang 100.000 baris lainnya.
2. **Delta Patch Serialization**: Persistensi state hanya memproses baris yang dimutasi (`pendingPatch()`), bukan men-serialize jutaan sel ke dalam payload JSON masif.
3. **Fractional Indexing & ID-Based Coordinate**: Penyisipan baris di tengah spreadsheet masif tidak menulis ulang formula baris di bawahnya karena formula mengikat ID baris permanen (`rowId`), bukan indeks numerik volatile.

Skrip di bawah ini mensimulasikan dataset transaksi 1 tahun berisi **100.000 baris** transaksi (1,1 juta sel data dan 100.000 formula total) dengan agregasi `SUMIFS` lintas cabang:

<!-- contoh: 17-performa.js -->
```js
import { createWorkbook } from '@kufayeka/sheet/core';
import { penjualan, KOLOM_PENJUALAN, barisPenjualan } from './data/toko.js';

// Setahun penjualan: 100.000 transaksi dengan rumus Total per baris dan ringkasan per cabang.
// Yang dicetak di sini adalah hal yang tidak bergantung pada kecepatan komputer: berapa yang dihitung ulang dan berapa yang dikirim saat menyimpan.
const N = 100000;
const wb = createWorkbook(null, { undoLimit: 50 });
const jual = wb.sheet('Sheet1');
jual.setSheetProps({ name: 'Penjualan' });
jual.insertRows(1000, N + 1 - 1000);
jual.setValues('A1', [KOLOM_PENJUALAN]);
jual.setValues('A2', barisPenjualan(penjualan(N), 2));          // 1.100.000 sel, 100.000 rumus, satu perubahan
wb.setValues('Penjualan', 'M1', [['Jakarta', `=SUMIFS(K2:K${N + 1}, C2:C${N + 1}, M1)`], ['Bandung', `=SUMIFS(K2:K${N + 1}, C2:C${N + 1}, M2)`]]);
const sebelum = jual.value('N2');
console.log('ukuran         :', jual.size().rows, 'baris |', N, 'rumus Total | omzet Bandung', sebelum);

// satu ketikan: hanya rumus Total baris itu dan dua SUMIFS yang dihitung ulang, bukan 100.000 rumus
let dihitung = 0;
const off = wb.on('op', () => { dihitung++; });
wb.saved(wb.pendingPatch());
jual.setValues('H50001', 1000, { source: 'user' });            // transaksi ke-50.000, cabang Bandung
console.log('satu ketikan   :', dihitung, 'perubahan | omzet Bandung', sebelum, '->', jual.value('N2'));
off();

// yang dikirim saat menyimpan: satu baris, bukan seluruh workbook
const patch = wb.pendingPatch();
console.log('patch          :', patch.rows.upsert.length, 'baris,', Math.round(JSON.stringify(patch).length / 100) / 10, 'KB');

// menyisipkan baris di tengah tidak menulis ulang 50.000 rumus di bawahnya: rumus menyimpan id baris, bukan nomornya
wb.saved(patch);
jual.insertRows('50001', 1);
console.log('sisip baris    :', wb.pendingPatch().rows.upsert.length, 'baris di patch | rumus K50002 kini', jual.input('K50002'));
```
<!-- /contoh -->

<!-- hasil: 17-performa.js -->
```text
ukuran         : 100001 baris | 100000 rumus Total | omzet Bandung 59160874325
satu ketikan   : 1 perubahan | omzet Bandung 59160874325 -> 59888524325
patch          : 1 baris, 1.3 KB
sisip baris    : 1 baris di patch | rumus K50002 kini =H50002*I50002*(1-J50002)
```
<!-- /hasil -->

> [!NOTE]
> Pada contoh di atas, saat baris ke-50.001 disunting, engine hanya mengeksekusi 1 mutasi atomik dan mengevaluasi formula yang terdampak (`Total` baris tersebut dan agregasi `SUMIFS` Bandung). Ukuran payload sinkronisasi yang dihasilkan hanya berkisar **1,3 KB**, bukan puluhan megabyte.

---

## 13.2 Karakteristik Performa & Metrik Latensi

Hasil pengujian benchmarking otomatis yang dijalankan secara konsisten oleh `test/core-scale.test.js` pada sheet berukuran **100.000 baris dengan 200.000 formula** (termasuk skenario terburuk kalkulasi berantai *running total*):

| Operasi / Skenario Eksekusi | Profil Beban | Estimasi Latensi |
|---|---|---|
| **Input Interaktif Sel Biasa** | Mutasi 1 sel pada RAB standar + Virtual DOM Canvas render | **~50 ms** |
| **Penyisipan Baris di Tengah** | `insertRows(50000, 1)` di antara 100.000 baris data | **50 – 130 ms** |
| **Worst-Case Mutation Cascade** | Edit sel baris ke-10 yang memicu kalkulasi ulang 99.990 *running totals* berantai | **150 – 250 ms** |
| **Input Sel pada Baris Akhir** | Mutasi sel independen di baris terakhir dataset | **< 1 ms** |
| **Bulk Batch Write** | Injeksi 500.000 sel (termasuk 200.000 formula) via `setValues` matriks | **~2 – 3 detik** *(eksekusi awal)* |
| **Full Serialization (`toJSON`)** | Serialisasi snapshot komprehensif 100.000 baris ke JSON | **~0,4 detik** |
| **Cold Initialization (`createWorkbook`)** | Parsing & parsing kompilasi formula 100.000 baris (200.000 formula) | **~2,5 detik** |

---

## 13.3 Best Practices & Panduan Optimasi Performa

Untuk menjaga aplikasi tetap cepat pada dataset berskala besar, terapkan prinsip arsitektur berikut:

### 1. Hindari Kalkulasi Berantai (*Chained Running Totals*)
Formula seperti `=E1+D2` membentuk rantai ketergantungan linear sepanjang baris spreadsheet. Mengubah baris paling atas akan memaksa engine mengevaluasi seluruh baris di bawahnya ($O(N)$ cascade). Gunakan formula agregasi terisolasi seperti `SUMIFS` atau kalkulasikan agregasi menggunakan pivot table engine (`tableOf` + `pivot`).

### 2. Gunakan Batch Write Alih-Alih Looping Singular
Jangan pernah memanggil `setValues` di dalam perulangan ribuan kali:
```ts
// ❌ ANTI-PATTERN: Memantik 10.000 transaksi mutasi dan 10.000 kali reevaluasi DAG
for (let r = 0; r < 10000; r++) {
    sheet.setValues(`A${r + 1}`, [[data[r]]]);
}

// ✅ RECOMMENDED: 1 mutasi atomik, 1 evaluasi DAG, 1 entri undo stack
sheet.setValues('A1', data.map(item => [item]));
```

### 3. Batasi Ukuran Undo Stack (`undoLimit`)
Secara default, engine menyimpan riwayat undo hingga 200 langkah. Pada workbook berukuran 100.000+ baris, snapshot reversibilitas dapat menghabiskan memori heap V8/Node.js. Batasi kapasitas undo saat inisialisasi:
```ts
const wb = createWorkbook(doc, { undoLimit: 50 });
```

### 4. Simpan Patch Delta, Bukan Full Snapshot `toJSON()`
Menyimpan snapshot penuh `toJSON()` pada setiap ketikan adalah pemborosan CPU dan bandwidth (mengirim puluhan MB per mutasi). Ambil hanya delta perubahan menggunakan `wb.pendingPatch()`, kirimkan ke REST endpoint server, dan tandai tersimpan dengan `wb.saved(patch)`. Payload delta umumnya berkisar antara **500 byte hingga 2 KB**.

### 5. Gunakan Selektor Granular pada `useWorkbook`
Pastikan fungsi selektor pada hook `useWorkbook` hanya mengekstrak nilai primitif spesifik yang dibutuhkan komponen host:
```tsx
// ✅ Hanya merender ulang komponen ketika nilai total berubah
const grandTotal = useWorkbook(wb, (w) => w.value('RAB', 'G17'));
```

### 6. Instansiasi Singleton Workbook
Instansiasi workbook (`createWorkbook(doc)`) adalah operasi sinkronisasi kompilasi graph. Jangan pernah menginisialisasi ulang instansi workbook di dalam siklus render biasa React. Gunakan `useState(() => createWorkbook(doc))` atau `useRef`.

---

## 13.4 Referensi Paket React: `@kufayeka/sheet`

Modul entry-point utama untuk integrasi antarmuka spreadsheet pada aplikasi React:

| Simbol / Ekspor | Kategori | Deskripsi & Fungsi | Rujukan |
|---|---|---|---|
| `<Sheet />` | React Component | Komponen spreadsheet lengkap (virtualized grid canvas, formula bar, toolbar, sheet tabs, keyboard shortcuts, themes). | [Bab 03](03-komponen-sheet.md) |
| `useWorkbook<T>` | React Hook | Custom hook reaktif tersinkronisasi event `tick` workbook dengan selektor komputasi. | [Bab 02](02-konsep.md), [Bab 09](09-menyimpan.md) |
| `VERSION` | Konstanta | Versi rilis pustaka `@kufayeka/sheet`. | - |

**Integrasi Stylesheet Global**:
```tsx
import '@kufayeka/sheet/style.css'; // Wajib diimpor sekali di root aplikasi
```

---

## 13.5 Referensi Paket Core: `@kufayeka/sheet/core`

Engine headless tanpa dependensi DOM browser. Berjalan pada Node.js, Deno, Bun, Cloudflare Workers, dan Web Worker:

| Simbol / Fungsi | Kategori | Deskripsi Teknis | Rujukan |
|---|---|---|---|
| `createWorkbook` | Lifecycle | Menginisialisasi instansi spreadsheet baru atau me-restore dari `WorkbookDoc`. | [Bab 02](02-konsep.md), [Bab 09](09-menyimpan.md) |
| `VERSION` | Metadata | Versi rilis modul core engine. | - |
| `isError`, `ERR` | Formula Engine | Type guard validasi error evaluasi formula dan katalog kode error standar (`#DIV/0!`, dll). | [Bab 05](05-rumus.md#57-taksonomi-dan-penanganan-error-formula) |
| `FUNCTION_NAMES` | Formula Engine | Array nama seluruh fungsi formula yang didukung (180+ formula built-in). | [Bab 05](05-rumus.md#513-katalog-lengkap-formula-built-in) |
| `formatValue`, `FORMAT_PRESETS` | Formatting | Utilitas pemformatan nilai sel ke representasi teks terformat berdasarkan konfigurasi preset. | [Bab 06](06-format.md) |
| `localeInfo` | Lokalisasi | Metadata pemisah desimal, ribuan, dan mata uang untuk locale target (`id-ID`, dll). | [Bab 06](06-format.md#65-konfigurasi-dan-manajemen-locale) |
| `displayOf` | Formatting | Menghasilkan objek kalkulasi visual sel: `{ text, align, kind, color }`. | [Bab 06](06-format.md) |
| `dateToSerial`, `serialToDate` | Datetime | Konversi objek `Date` ke format serial numerik standar spreadsheet dan sebaliknya. | [Bab 04](04-api-workbook.md#45-ingestion-data-dinamis-populate), [Bab 06](06-format.md) |
| `parseInput` | Ingestion | Parsing teks input pengguna menjadi tipe primitif terstruktur sesuai locale aktif. | [Bab 06](06-format.md#65-konfigurasi-dan-manajemen-locale) |
| `roundTo` | Matematika | Pembulatan presisi desimal matematika standar akuntansi finansial. | [Bab 05](05-rumus.md) |
| `colName`, `colIndex` | Koordinat | Konversi indeks kolom numerik 0-based ke label huruf alfabetis (`2` ↔ `'C'`). | [Bab 02](02-konsep.md#22-sistem-koordinat-alamat-dan-resolusi-sel) |
| `storeFormula`, `formulaText` | AST Formula | Serialisasi formula teks ke format dependensi terstruktur `{ f, refs }` dan sebaliknya. | [Bab 02](02-konsep.md), [Bab 09](09-menyimpan.md) |
| `resolveRef`, `isStoredFormula` | AST Formula | Resolusi referensi koordinat internal formula dan validasi token stored formula. | [Bab 09](09-menyimpan.md) |
| `newId`, `keyBetween`, `keysBetween` | Data Storage | Generator ID acak stabil dan algoritma fractional indexing string untuk pengurutan baris. | [Bab 09](09-menyimpan.md#911-struktur-internal-workbookdoc) |
| `compareKeys` | Data Storage | Fungsi komparator leksikografis untuk mengurutkan array baris fractional keys. | [Bab 09](09-menyimpan.md#911-struktur-internal-workbookdoc) |
| `fillBlock`, `copyBlock`, `pasteClip`, `pasteText` | Manipulasi | Utilitas programatis untuk emulasi drag fill-handle, copy-paste matriks berformat. | [Bab 05](05-rumus.md) |
| `sortRange` | Pengurutan | Mengurutkan range sel berdasarkan spesifikasi kolom, arah urut, dan opsi header. | [Bab 07](07-data.md#73-pengurutan-data-multi-kolom-sort) |
| `findAll`, `replaceIn` | Search | Utilitas pencarian teks/regex pada sheet dan operasi find-and-replace terisolasi. | [Bab 07](07-data.md#77-pencarian-dan-penggantian-teks-find--replace) |
| `tableOf` | Ingestion/Ekstraksi | Mengekstrak range sel tabular menjadi array of records JavaScript `{ headers, records }`. | [Bab 04](04-api-workbook.md#44-ekstraksi-data-terstruktur-tableof), [Bab 07](07-data.md) |
| `pivot`, `PIVOT_FUNCTIONS` | Analisis Data | Engine agregasi pivot table multidimensi headless murni berbasis memori. | [Bab 07](07-data.md#76-analisis-multidimensi-pivot-table) |
| `chartSeries`, `CHART_TYPES`, `CHART_DEFAULTS` | Visualisasi | Parser struktur range ke seri chart dan metadata spesifikasi konfigurasi visual grafis. | [Bab 12](12-dashboard.md) |
| `CHART_FIELDS`, `SPARKLINE_FIELDS`, `CHART_NODES` | Visualisasi | Skema properti konfigurasi visual chart terapung dan mini sparkline in-cell. | [Bab 12](12-dashboard.md) |
| `populate` | Ingestion | Menuliskan array of objects JSON ke dalam sheet secara terstruktur dan efisien. | [Bab 04](04-api-workbook.md#45-ingestion-data-dinamis-populate) |
| `fromApiMakerType`, `fieldType`, `checkValue` | Validasi Skema | Adaptor skema basis data Type Nexa dan verifikasi kepatuhan tipe sel. | [Bab 08](08-menjaga-isi.md#85-validasi-skema-kolom-dan-tipe-data) |
| `mergePatch`, `checkPatch`, `viewFor` | Sinkronisasi & ACL | Utilitas server-side untuk penggabungan delta patch, audit validasi mutasi, dan reduksi sel aman. | [Bab 09](09-menyimpan.md), [Bab 10](10-hak-akses.md) |
| `resolveAccess`, `validateAccess`, `parseWhere` | Keamanan ACL | Engine evaluasi aturan izin granular (RBAC/ABAC) dan parser ekspresi sel `where`. | [Bab 10](10-hak-akses.md) |
| `ACTIONS`, `ACTION_INFO`, `UI_ITEMS` | Keamanan ACL | Katalog hak akses operasional (read, write, delete) dan elemen antarmuka yang dapat dikontrol. | [Bab 10](10-hak-akses.md) |
| `accessColor`, `accessPlaces` | Keamanan ACL | Visualizer palet warna kepemilikan aturan dan detektor sebaran cakupan area ACL. | [Bab 10](10-hak-akses.md) |
| `exportXlsx`, `importXlsx`, `importXlsxInto` | Interoperabilitas | Mesin kompilasi biner file Microsoft Excel OpenXML `.xlsx` native bidirectional. | [Bab 11](11-komentar-excel.md) |
| `exportCsv`, `importCsvInto`, `parseCsv`, `codeOfFormat` | Interoperabilitas | Serializer dan streaming parser berkas CSV/TSV dengan auto-detection delimiter. | [Bab 11](11-komentar-excel.md) |

---

## 13.6 Referensi Method Instansi `Workbook`

Method global yang diekspos langsung pada instansi root `Workbook` (`wb`):

| Method | Signature Singkat | Deskripsi & Fungsi |
|---|---|---|
| `sheet(nameOrId)` | `(nameOrId: string) => SheetApi` | Mengambil handle controller spesifik untuk lembar kerja yang dipilih. |
| `sheetIds()` | `() => string[]` | Mengembalikan array ID internal seluruh sheet yang terdaftar. |
| `sheetIdByName(name)` | `(name: string) => string \| undefined` | Resolusi nama lembar kerja ke ID internal uniknya. |
| `addSheet(name?)` | `(name?: string) => string` | Membuat lembar kerja baru dan mengembalikan sheet ID yang dihasilkan. |
| `address(r, c)` | `(r: number, c: number) => string` | Konversi indeks koordinat numerik 0-based ke notasi alamat Excel (misal: `'K21'`). |
| `setAutoHeights(flag)` | `(flag: boolean) => void` | Mengaktifkan/menonaktifkan kalkulasi tinggi baris otomatis saat wrap teks. |
| `settings()` / `setSettings(cfg)` | `(cfg?: Partial<Settings>) => Settings` | Membaca atau memodifikasi konfigurasi regional (locale, currency, named ranges). |
| `names()` | `() => Record<string, NamedRange>` | Mengambil katalog seluruh named range yang terdaftar dalam workbook. |
| `addName(name, sheet, ref)` | `(name: string, sheet: string, ref: string) => void` | Mendaftarkan named range baru dengan cakupan workbook-wide. |
| `setName(name, newRef)` | `(name: string, newRef: string) => void` | Memperbarui referensi range untuk named range yang sudah ada. |
| `removeName(name)` | `(name: string) => void` | Menghapus named range dari katalog. |
| `nameRange(name)` | `(name: string) => { sheet: string, range: string } \| null` | Resolusi named range ke sheet dan alamat koordinat aktualnya. |
| `undo()` / `redo()` | `() => void` | Melakukan pembatalan transaksi terakhir atau mengulang kembali mutasi. |
| `canUndo()` / `canRedo()` | `() => boolean` | Memeriksa ketersediaan histori pada undo/redo stack. |
| `apply(op, source?)` | `(op: Op, source?: Source) => void` | Mengaplikasikan mutasi op level rendah secara langsung ke state workbook. |
| `on(event, handler)` | `(event: keyof WorkbookEvents, fn: Function) => () => void` | Mendaftarkan listener event reaktif (`op`, `tick`, `reject`, `error`) dan mengembalikan fungsi unsubscribe. |
| `revision()` / `tick()` | `() => number` | Mengambil nomor revisi sekuensial mutasi workbook saat ini. |
| `toJSON()` | `() => WorkbookDoc` | Melakukan serialisasi menyeluruh state workbook ke objek JSON murni. |
| `pendingPatch()` | `() => Patch` | Mengambil delta mutasi yang belum disimpan sejak pemanggilan `saved()` terakhir. |
| `saved(patch?)` | `(patch?: Patch) => void` | Menandai bahwa mutasi delta tertentu telah berhasil di-commit ke server. |
| `unsaved()` | `() => boolean` | Memeriksa apakah terdapat mutasi pending yang belum tersinkronisasi. |
| `version()` | `() => number` | Mengambil nomor versi skema dokumen internal workbook. |
| `setRules(rules)` | `(rules: CellRule[]) => void` | Mengonfigurasi proteksi sel statis untuk pengguna saat ini. |
| `setAccess(acl)` | `(acl: AccessRow[]) => void` | Memasang tabel Access Control List (ACL) dinamis untuk tata kelola RBAC/ABAC. |
| `access()` | `() => AccessInfo` | Mengambil evaluasi izin efektif pengguna yang sedang aktif pada workbook. |
| `can(action, target?)` | `(action: Action, target?: string) => boolean` | Evaluasi boolean apakah pengguna aktif memiliki izin melakukan aksi tertentu. |
| `shows(uiItem)` | `(uiItem: UiItem) => boolean` | Evaluasi boolean apakah komponen antarmuka tertentu diizinkan tampil. |
| `setUser(user)` / `user()` | `(user?: User) => User` | Mengatur atau membaca identitas konteks pengguna aktif saat ini. |
| `id()` | `() => string` | Mengambil identitas ID unik dokumen workbook. |

---

## 13.7 Referensi Method `SheetApi` (Sheet Handle)

Method yang dieksekusi melalui controller sheet spesifik (`const sh = wb.sheet('NamaSheet')`):

### 1. Manipulasi Data & Penulisan Blok
- `setValues(startAddr, values, options?)`: Injeksi nilai primitif atau matriks 2D ke dalam spreadsheet.
- `setBlock(range, value, options?)`: Mengisi seluruh sel dalam range dengan nilai atau formula seragam.
- `clear(range, kind?)`: Menghapus data, format, atau style pada range tertentu (`'all' | 'contents' | 'formats'`).

### 2. Inspeksi & Pembacaan State Sel
- `value(addr)`: Mengambil hasil evaluasi primitif sel (angka, boolean, teks, atau objek error).
- `input(addr)`: Mengambil teks mentah formula atau input pengguna (`=SUM(A1:A5)`).
- `display(addr)`: Mengambil objek representasi visual terformat (`{ text, align, kind, color }`).
- `raw(addr)`: Mengambil objek internal struktur data sel mentah.
- `cellFormat(addr)`: Membaca aturan format angka yang berlaku pada sel.
- `style(addr)`: Membaca objek styling eksplisit pada sel.
- `shownStyle(addr)`: Membaca gaya komputasi efektif (gabungan style, conditional format, dan tema).
- `size()`: Mengambil dimensi ukuran grid aktif (`{ rows, cols }`).
- `lastFilled()`: Mengambil koordinat sel terakhir yang terisi konten (`{ row, col }`).
- `dataRegion(addr)`: Deteksi otomatis area tabular kontigu di sekitar sel acuan.
- `forEachFilledRow(fn)`: Iterasi efisien hanya pada baris yang memiliki data aktual.
- `rowContent(rowIdx)`: Mengambil array nilai seluruh sel pada satu baris data.

### 3. Resolusi Koordinat & Identitas
- `rowId(rowIndex)` / `colId(colIndex)`: Konversi indeks numerik 0-based ke ID string stabil.
- `rowIndex(rowId)` / `colIndex(colId)`: Resolusi ID stabil ke indeks baris/kolom visual terkini.

### 4. Styling & Cell Merging
- `setStyle(range, style)`: Menerapkan properti visual (font, warna latar, borders, align, wrap).
- `mergeCells(range)`: Menggabungkan rentang sel menjadi satu unit sel gabungan.
- `unmergeCells(range)`: Memisahkan sel gabungan kembali ke sel-sel individual.
- `merges()`: Mengambil daftar seluruh koordinat sel gabungan pada sheet aktif.

### 5. Struktur Baris & Kolom
- `insertRows(at, count)` / `deleteRows(at, count)`: Menambah atau menghapus baris pada posisi tertentu.
- `moveRows(from, to, count)`: Memindahkan posisi baris secara aman dengan menjaga integritas formula.
- `insertCols(at, count)` / `deleteCols(at, count)`: Menambah atau menghapus kolom spreadsheet.
- `moveCols(from, to, count)`: Memindahkan urutan kolom secara programatis.
- `setRowProps(row, props)` / `rowProps(row)`: Konfigurasi tinggi (`height`) atau status sembunyi (`hidden`) baris.
- `setColProps(col, props)` / `colProps(col)`: Konfigurasi lebar (`width`), format default, atau status sembunyi kolom.

### 6. Manajemen Lembar Kerja
- `sheetProps()` / `setSheetProps(props)`: Pengaturan properti sheet (nama, warna tab, freeze rows/cols).
- `duplicateSheet(newName?)`: Menduplikasi sheet beserta seluruh data, gaya, dan formulanya.
- `removeSheet()`: Menghapus sheet dari workbook.
- `hideSheet()`: Menyembunyikan sheet dari tab navigasi.
- `moveSheet(newIndex)`: Mengubah urutan indeks sheet dalam workbook.

### 7. Fitur Lanjutan (Data, Validasi, Analisis & Interaksi)
- **Conditional Formatting**: `addConditional`, `setConditional`, `removeConditional`, `conditionals`, `conditionalStyleAt`.
- **Filtering**: `createFilter`, `setFilterColumn`, `removeFilter`, `filterOf`, `filterValues`, `filteredOut`.
- **Row & Column Grouping**: `groupRows`, `ungroupRows`, `foldRowGroup`, `showRowLevel`, `rowGroups`.
- **Data Validation**: `addValidation`, `setValidation`, `removeValidation`, `validationAt`, `choicesAt`, `invalidAt`.
- **Pivot Table**: `addPivot`, `setPivot`, `removePivot`, `pivots`, `pivotAt`.
- **Charts & Sparklines**: `addChart`, `setChart`, `removeChart`, `charts`, `addSparkline`, `sparklines`.
- **Komentar Sel**: `addComment`, `replyComment`, `editComment`, `deleteComment`, `comments`, `commentAt`.

---

## 13.8 Indeks Spesifikasi Teknis Lintas Bab

Tabel panduan cepat untuk menelusuri spesifikasi teknis mendalam pada bab-bab sebelumnya:

| Kategori Spesifikasi | Penjelasan & Cakupan | Rujukan Bab |
|---|---|---|
| **Props & Event `<Sheet>`** | Antarmuka React, imperative ref handles, dan konfigurasi tema CSS. | [Bab 03.12](03-komponen-sheet.md#312-referensi-lengkap-props-event--ref) |
| **Keyboard Shortcuts** | Navigasi grid, selection range, clipboard, dan pintasan editing. | [Bab 03.12](03-komponen-sheet.md#312-referensi-lengkap-props-event--ref) |
| **Opsi `createWorkbook`** | Konfigurasi instance root, interceptor `beforeOp`, dan sinkronisasi clock. | [Bab 02.14](02-konsep.md#214-referensi-lengkap-opsi-dan-event-workbook) |
| **Taksonomi Tipe Mutasi `Op`** | Struktur payload mutasi atomik untuk audit log dan sinkronisasi server. | [Bab 09.15](09-menyimpan.md#915-taksonomi-tipe-mutasi-op) |
| **Katalog Formula (180+)** | Dokumentasi lengkap formula matematika, finansial, teks, logika, dan lookup. | [Bab 05.13](05-rumus.md#513-katalog-lengkap-formula-built-in) |
| **Pola Format Angka & Locale** | Token format Excel (`#,##0.00`, tanggal, mata uang, persen) dan konfigurasi locale. | [Bab 06.9](06-format.md#69-referensi-token-pola-format) |
| **Operator Validasi Data** | Spesifikasi aturan list dropdown, rentang numerik, tanggal, dan formula custom. | [Bab 08.3](08-menjaga-isi.md#83-aturan-validasi-daftar-pilihan-dropdown) |
| **Katalog Izin ACL** | Aksi operasional (`read`, `write`, `delete`) dan hak UI (`ui.toolbar`, dll). | [Bab 10.35](10-hak-akses.md#1035-referensi-lengkap-tindakan-action-dan-ui) |
| **Matriks Fitur OpenXML** | Parameter yang didukung penuh, diabaikan, atau disesuaikan saat import/export Excel. | [Bab 11.8](11-komentar-excel.md#118-matriks-kompatibilitas-dan-keterbatasan-fitur-excel) |

---

## 13.9 Integrasi TypeScript & Type Definitions

`@kufayeka/sheet` didistribusikan dengan definisi tipe TypeScript komprehensif tanpa memerlukan instalasi paket `@types/*` terpisah. Seluruh tipe diverifikasi oleh suite pengujian `test/types.test.js` di bawah mode kompilasi `strict: true`.

### Tipe Utama yang Diekspor:

| Tipe TypeScript | Deskripsi Struktur Data |
|---|---|
| `Workbook` | Instansi root workbook hasil inisialisasi `createWorkbook()`. |
| `SheetApi` | Antarmuka controller lembar kerja aktif hasil `wb.sheet('Nama')`. |
| `SheetHandle` | Antarmuka imperatif yang diekspos melalui `ref` komponen `<Sheet />`. |
| `SheetSelection` | Struktur data koordinat seleksi aktif (`{ address, start, end }`). |
| `SheetProps` | Antarmuka props komponen React `<Sheet />`. |
| `CellValue`, `CellResult`, `CellError` | Tipe data primitif input sel, hasil evaluasi formula, dan objek error runtime. |
| `Style`, `Format`, `Borders` | Antarmuka skema visual styling, format angka, dan dekorasi garis batas sel. |
| `Op`, `Source`, `WorkbookEvents` | Objek mutasi transaksi atomik, origin mutasi, dan kontrak event dispatcher. |
| `WorkbookDoc`, `Patch` | Skema serialisasi penuh dokumen (`toJSON`) dan delta patch sinkronisasi. |
| `AccessRow`, `Who`, `AccessInfo` | Kontrak definisi aturan keamanan ACL, subjek perizinan, dan status evaluasi. |
| `ValidationSpec`, `ConditionalSpec` | Skema deklarasi aturan validasi input dan aturan pewarnaan kondisional. |

### Contoh Implementasi Lengkap (Strict Mode):

Komponen React di bawah ini mendemonstrasikan pola penulisan TypeScript standar industri: type narrowing hasil evaluasi sel menggunakan `isError`, penanganan lifecycle async, dan akses imperatif melalui `SheetHandle`:

<!-- contoh: 04-14-typescript.tsx -->
```tsx
import { useEffect, useRef, useState } from 'react';
import { Sheet, useWorkbook } from '@kufayeka/sheet';
import type { SheetHandle, SheetSelection } from '@kufayeka/sheet';
import { createWorkbook, isError } from '@kufayeka/sheet/core';
import type { Workbook, WorkbookDoc, CellResult, Style, WorkbookEvents } from '@kufayeka/sheet/core';

// Pelajaran 14: pola TypeScript yang dipakai di aplikasi React. Setiap baris di sini dicek tsc dengan strict.

// 1. workbook di state: null selama memuat
export function Lembar({ id }: { id: string }) {
    const [wb, setWb] = useState<Workbook | null>(null);
    const ref = useRef<SheetHandle>(null);
    const [range, setRange] = useState<string>('');

    useEffect(() => {
        fetch('/api/spreadsheet/' + id)
            .then((r) => (r.ok ? (r.json() as Promise<WorkbookDoc>) : null))
            .then((doc) => setWb(createWorkbook(doc)));
    }, [id]);

    // 2. useWorkbook: tipe hasilnya mengikuti fungsi baca, ditambah undefined selama wb masih null
    const belum: boolean | undefined = useWorkbook(wb, (w) => w.unsaved());
    const total: CellResult | undefined = useWorkbook(wb, (w) => w.value('Sheet1', 'D7'));

    // 3. hasil sel bisa berupa error: persempit dengan isError, baru dipakai sebagai angka
    const totalTeks = total === undefined ? '-' : isError(total) ? total.code : typeof total === 'number' ? total.toLocaleString('id-ID') : String(total);

    // 4. event dengan tipe isi datanya
    useEffect(() => {
        if (!wb) return;
        const padaReject = (e: WorkbookEvents['reject']) => alert(e.reason);
        return wb.on('reject', padaReject);
    }, [wb]);

    // 5. seleksi dan handle
    const pilih = (sel: SheetSelection) => setRange(sel.address);
    const keTotal = () => ref.current?.select('D7');

    // 6. objek gaya dengan tipe: salah ketik nama atau nilai langsung ketahuan
    const judul: Style = { bold: true, fill: '#e8f0fe', align: 'center' };

    if (!wb) return <p>Memuat…</p>;
    return (
        <div style={{ height: 500, display: 'flex', flexDirection: 'column' }}>
            <p>
                Total {totalTeks} · pilihan {range || '-'} · {belum ? 'belum tersimpan' : 'tersimpan'}{' '}
                <button onClick={keTotal}>ke total</button>{' '}
                <button onClick={() => wb.sheet('Sheet1').setStyle('A1:D1', judul)}>tebalkan judul</button>
            </p>
            <Sheet ref={ref} workbook={wb} onSelectionChange={pilih} style={{ flex: 1 }} />
        </div>
    );
}
```
<!-- /contoh -->

---

[Daftar Isi](../README.md#daftar-isi) · Sebelumnya: [12. Visualisasi Data & Dashboard Interaktif](12-dashboard.md)
