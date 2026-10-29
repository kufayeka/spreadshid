# 13. Performa dan referensi

[Daftar isi](../README.md#daftar-isi) · Sebelumnya: [12. Chart dan dashboard](12-dashboard.md)

Bab ini membahas seberapa cepat sheet untuk data besar, lalu daftar semua nama yang bisa dipakai, satu baris masing-masing.

- [13.1 Contoh: setahun penjualan](#131-contoh-setahun-penjualan)
- [13.2 Angka ukur](#132-angka-ukur)
- [13.3 Saran](#133-saran)
- [13.4 `@kufayeka/sheet` (React)](#134-kufayekasheet-react)
- [13.5 `@kufayeka/sheet/core`](#135-kufayekasheetcore)
- [13.6 Workbook](#136-workbook)
- [13.7 Handle sheet](#137-handle-sheet)
- [13.8 Daftar lain](#138-daftar-lain)
- [13.9 TypeScript](#139-typescript)

## 13.1 Contoh: setahun penjualan

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

## 13.2 Angka ukur

Diukur oleh `test/core-scale.test.js` di laptop pengembangan (Windows, Node 24), pada sheet 100.000 baris berisi 200.000 rumus, dua di setiap baris.
Salah satunya adalah running total yang membaca baris di atasnya, kasus terburuk untuk perhitungan ulang. Angka berubah sedikit setiap kali diukur, dan
test-nya menjaga batas atasnya.

| Kejadian | Waktu |
|---|---|
| satu ketikan di RAB biasa, termasuk menggambar layar | sekitar 50 ms |
| menyisipkan satu baris di tengah 100.000 baris | 50–130 ms |
| satu ketikan di baris 10, di atas 99.990 running total yang semuanya berubah | 150–250 ms |
| satu ketikan di baris terakhir | di bawah 1 ms |
| menulis 500.000 sel (200.000 rumus) sekaligus | beberapa detik, sekali saja |
| `toJSON` 100.000 baris | sekitar 0,4 detik |
| membuka lagi 100.000 baris dan 200.000 rumus | sekitar 2,5 detik |

## 13.3 Saran

- **Ringkasan dengan `SUMIFS` dan pivot, bukan running total.** Running total (`=E1+D2`) adalah rantai: mengubah baris atas mengubah semua baris di
  bawahnya. `SUMIFS` atas sebuah kolom dihitung sekali per perubahan.
- **Satu panggilan untuk banyak sel.** `setValues` dengan tabel, `setBlock`, atau `populate` adalah satu perubahan dan satu kali hitung ulang. Memanggil
  `setValues` 10.000 kali dalam loop berarti 10.000 perubahan dan 10.000 langkah undo.
- **`undoLimit`.** Bawaannya 200 langkah. Untuk sheet sangat besar, `createWorkbook(doc, { undoLimit: 50 })` menghemat memori.
- **Simpan patch, bukan `toJSON`, setiap kali ada perubahan** ([9.5](09-menyimpan.md#95-menyimpan-otomatis)). Satu ketikan menghasilkan patch sekitar
  1 KB, sedangkan workbook 100.000 baris berukuran puluhan MB.
- **`useWorkbook` dengan nilai sederhana** ([bab 9](09-menyimpan.md)), supaya komponen di luar sheet tidak
  digambar ulang di setiap ketikan.
- **Membuka workbook besar sekali, lalu memakainya terus.** `createWorkbook(doc)` untuk 100.000 baris butuh beberapa detik. Jangan membuatnya ulang
  saat props lain berubah ([9.3](09-menyimpan.md#93-workbook-bukan-state-react)).

## 13.4 `@kufayeka/sheet` (React)

| Nama | Artinya | Bab |
|---|---|---|
| `Sheet` | komponen spreadsheet: props, event, handle `ref`, keyboard, tema | [3](03-komponen-sheet.md) |
| `useWorkbook` | hook untuk membaca workbook dari komponen lain | [bab 9](09-menyimpan.md) |
| `VERSION` | versi paket | |

CSS: `import '@kufayeka/sheet/style.css'` sekali di aplikasi.

## 13.5 `@kufayeka/sheet/core`

Tanpa React dan tanpa browser: berjalan di browser, Node.js, Deno, Bun, dan worker.

| Nama | Artinya | Bab |
|---|---|---|
| `createWorkbook` | workbook baru, atau dibuka dari `toJSON()`: `createWorkbook(doc, { user, now, beforeOp, undoLimit })` | [2](02-konsep.md), [bab 9](09-menyimpan.md) |
| `VERSION` | versi paket | |
| `isError`, `ERR` | memeriksa hasil rumus yang error, dan daftar kode error | [5.7](05-rumus.md#57-error-dan-artinya) |
| `FUNCTION_NAMES` | nama semua fungsi rumus | [5.13](05-rumus.md#513-semua-fungsi-buat-apa-cara-pakai-hasilnya) |
| `formatValue`, `FORMAT_PRESETS`, `localeInfo` | menampilkan nilai dengan format dan locale, format siap pakai, info pemisah locale | [6](06-format.md) |
| `displayOf` | yang tampil dari sebuah nilai dan format: `{ text, align, kind, color }` | [6](06-format.md) |
| `dateToSerial`, `serialToDate` | `Date` menjadi nomor hari dan sebaliknya | [4.5](04-api-workbook.md#45-mengisi-dari-data-api) |
| `parseInput` | teks ketikan menjadi nilai menurut locale: `'1.250,5'` → 1250.5 | [6.5](06-format.md#65-locale) |
| `roundTo` | pembulatan yang dipakai format uang | [5.8](05-rumus.md#58-menulis-rumus-dari-kode) |
| `colName`, `colIndex` | `2` ↔ `'C'` | [2.2](02-konsep.md#22-alamat-sel) |
| `storeFormula`, `formulaText`, `resolveRef`, `isStoredFormula` | rumus teks ↔ rumus tersimpan `{ f, refs }`, dan ke mana sebuah referensi menunjuk | [2.3](02-konsep.md), [9.11](09-menyimpan.md#911-isi-content) |
| `newId`, `keyBetween`, `keysBetween`, `compareKeys` | id baru, key urutan di antara dua key, dan perbandingannya | [9.11](09-menyimpan.md#911-isi-content) |
| `fillBlock`, `copyBlock`, `pasteClip`, `pasteText` | fill handle, copy, dan paste dari kode | [5.8](05-rumus.md#58-menulis-rumus-dari-kode) |
| `sortRange` | urutkan range menurut satu kolom | [7.3](07-data.md#73-mengurutkan) |
| `findAll`, `replaceIn` | cari dan ganti | [7.7](07-data.md#77-mencari-dan-mengganti) |
| `pivot`, `tableOf`, `PIVOT_FUNCTIONS` | ringkasan per kelompok tanpa sheet, dan range sebagai daftar record | [7.6](07-data.md#76-pivot-table) |
| `chartSeries`, `CHART_TYPES`, `CHART_DEFAULTS` | membaca range menjadi kategori dan seri seperti Excel, jenis-jenis chart, dan pengaturan awal chart baru | [12](12-dashboard.md) |
| `populate` | data dari luar ke sheet, tetap sebagai data | [4.5](04-api-workbook.md#45-mengisi-dari-data-api) |
| `fromApiMakerType`, `fieldType`, `checkValue` | tipe kolom dari Type Nexa API Maker, tipe satu field, dan pemeriksaan satu nilai | [8.5](08-menjaga-isi.md#85-tipe-kolom) |
| `mergePatch`, `checkPatch`, `viewFor` | menggabungkan patch, memeriksanya, dan menyiapkan workbook untuk satu orang | [9](09-menyimpan.md) |
| `resolveAccess`, `validateAccess`, `parseWhere`, `ACTIONS`, `ACTION_INFO`, `UI_ITEMS` | access control | [10](10-hak-akses.md) |
| `accessColor`, `accessPlaces` | warna untuk sebuah `who`, dan sel mana saja yang disentuh setiap baris akses (editor aturan, `access.view: 'setup'`) | [10](10-hak-akses.md) |
| `exportXlsx`, `importXlsx`, `importXlsxInto` | file `.xlsx` | [11](11-komentar-excel.md) |
| `exportCsv`, `importCsvInto`, `parseCsv`, `codeOfFormat` | CSV, dan kode format Excel | [11](11-komentar-excel.md) |

## 13.6 Workbook

Fungsi yang hanya ada di `wb`, bukan di handle sheet:

| Nama | Artinya | Bab |
|---|---|---|
| `sheet` | handle sebuah sheet (nama atau id) | [2.2](02-konsep.md#22-alamat-sel) |
| `sheetIds`, `sheetIdByName`, `addSheet` | daftar sheet, id dari nama, sheet baru | [4.10](04-api-workbook.md#410-referensi) |
| `address` | `'K21'` dari nomor | [4.10](04-api-workbook.md#410-referensi) |
| `setAutoHeights` | tinggi baris otomatis, dipakai grid | [4.10](04-api-workbook.md#410-referensi) |
| `settings`, `setSettings` | locale, mata uang, named range | [4.10](04-api-workbook.md#410-referensi) |
| `names`, `addName`, `setName`, `removeName`, `nameRange`, `nameProblem` | named range | [5.11](05-rumus.md#511-named-range) |
| `undo`, `redo`, `canUndo`, `canRedo`, `apply`, `on`, `revision`, `tick` | perubahan, event, undo | [9.14](09-menyimpan.md#914-undo-redo-source-dan-apply) |
| `toJSON`, `pendingPatch`, `saved`, `unsaved`, `version` | menyimpan | [9.2](09-menyimpan.md#92-tombol-simpan), [9](09-menyimpan.md) |
| `setRules` | aturan per sel untuk orang yang membuka | [8.6](08-menjaga-isi.md#86-sel-yang-tidak-boleh-diubah) |
| `setAccess`, `access`, `can`, `shows` | access control | [10](10-hak-akses.md) |
| `setUser`, `user` | ganti orang yang membuka (penulis komentar dan op), dan baca siapa dia sekarang `{ id, name }` | [11](11-komentar-excel.md) |
| `id` | id workbook | [9.11](09-menyimpan.md#911-isi-content) |

## 13.7 Handle sheet

`wb.sheet('Nama')` memberi fungsi-fungsi di bawah tanpa parameter sheet. Semuanya juga ada di `wb` dengan nama sheet sebagai parameter pertama.
Handle juga punya `id` dan `name`.

| Kelompok | Nama | Bab |
|---|---|---|
| menulis | `setValues`, `setBlock`, `clear` | [4.10](04-api-workbook.md#410-referensi) |
| membaca | `value`, `input`, `display`, `raw`, `cellFormat`, `style`, `shownStyle`, `size`, `lastFilled`, `dataRegion`, `forEachFilledRow`, `rowContent` | [4.10](04-api-workbook.md#410-referensi) |
| nomor dan id | `rowId`, `colId`, `rowIndex`, `colIndex` | [4.10](04-api-workbook.md#410-referensi) |
| gaya | `setStyle`, `mergeCells`, `unmergeCells`, `merges` | [4.10](04-api-workbook.md#410-referensi) |
| baris dan kolom | `insertRows`, `deleteRows`, `moveRows`, `insertCols`, `moveCols`, `deleteCols`, `setRowProps`, `setColProps`, `rowProps`, `colProps`, `rowAxis`, `colAxis` | [4.10](04-api-workbook.md#410-referensi) |
| sheet | `sheetProps`, `setSheetProps`, `duplicateSheet`, `removeSheet`, `hideSheet`, `moveSheet`, `sheetShown` | [4.10](04-api-workbook.md#410-referensi) |
| conditional formatting | `addConditional`, `setConditional`, `moveConditional`, `removeConditional`, `conditionals`, `conditionalStyleAt` | [6.6](06-format.md#66-conditional-formatting) |
| filter | `createFilter`, `setFilterColumn`, `removeFilter`, `filterOf`, `filterValues`, `filteredOut` | [7.4](07-data.md#74-menyaring) |
| grup | `groupRows`, `ungroupRows`, `groupCols`, `ungroupCols`, `foldRowGroup`, `foldColGroup`, `showRowLevel`, `showColLevel`, `rowGroups`, `colGroups` | [7.5](07-data.md#75-melipat-kelompok-baris) |
| validasi | `addValidation`, `setValidation`, `removeValidation`, `validationAt`, `choicesAt`, `invalidAt` | [8.3](08-menjaga-isi.md#83-pilihan-dari-daftar-dropdown) |
| pivot | `addPivot`, `setPivot`, `removePivot`, `pivots`, `pivotAt` | [7.6](07-data.md#76-pivot-table) |
| chart | `addChart`, `setChart`, `removeChart`, `charts`, `chartData`, `addSparkline`, `setSparkline`, `removeSparkline`, `sparklines` | [12](12-dashboard.md) |
| aturan dan tipe | `modeAt`, `setTypes`, `typeAt` | [8](08-menjaga-isi.md) |
| komentar | `addComment`, `replyComment`, `editComment`, `deleteComment`, `mayChangeComment`, `comments`, `commentAt`, `hasComment` | [11](11-komentar-excel.md) |

## 13.8 Daftar lain

| Daftar | Di mana |
|---|---|
| props, event, dan handle `ref` `<Sheet>` | [3.12](03-komponen-sheet.md#312-referensi) |
| tombol keyboard | [3.12](03-komponen-sheet.md#312-referensi) |
| opsi `createWorkbook` dan event workbook | [2.14](02-konsep.md#214-referensi) |
| jenis op | [9.15](09-menyimpan.md#915-jenis-op) |
| kunci gaya, props baris, kolom, dan sheet | [4.10](04-api-workbook.md#410-referensi), [4.10](04-api-workbook.md#410-referensi), [4.10](04-api-workbook.md#410-referensi) |
| fungsi rumus | [5.13](05-rumus.md#513-semua-fungsi-buat-apa-cara-pakai-hasilnya) |
| jenis format dan huruf pola | [6.9](06-format.md#69-referensi) |
| syarat conditional formatting | [6.6](06-format.md#66-conditional-formatting) |
| jenis validasi | [8.3](08-menjaga-isi.md#83-pilihan-dari-daftar-dropdown) |
| spesifikasi pivot | [7.6](07-data.md#76-pivot-table) |
| semua isi `action` aturan akses | [10.35](10-hak-akses.md#1035-referensi) |
| yang ikut dan tidak ke Excel | [11](11-komentar-excel.md) |
| menu dan toolbar | [3.12](03-komponen-sheet.md#312-referensi) |

## 13.9 TypeScript

Paket ini membawa tipe TypeScript untuk semua fungsinya. Import tipenya dengan `import type`:

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
| `AccessRow`, `Who`, `AccessInfo`, `AccessUi` | hak akses ([bab 10](10-hak-akses.md)) |
| `ValidationSpec`, `ConditionalSpec`, `PivotSpec`, `TypesSpec` | aturan validasi, conditional formatting, pivot, tipe kolom |

Tipe ini ditulis tangan dan diuji: `test/types.test.js` mengompilasi kode host contoh dengan `strict`, termasuk kesalahan yang **harus** ditolak
(salah ketik nama gaya, `source` yang tidak ada, nama event yang salah, prop yang salah ketik). Kalau tipe menjadi terlalu longgar, test itu gagal.

Pola-pola TypeScript yang dipakai di aplikasi React, dalam satu komponen yang dicek `tsc` dengan mode strict:

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

[Daftar isi](../README.md#daftar-isi) · Sebelumnya: [11. Komentar dan Excel](11-komentar-excel.md)
