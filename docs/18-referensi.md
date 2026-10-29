# 18. Referensi

[Daftar isi](../README.md#daftar-isi) · Sebelumnya: [17. Performa](17-performa.md)

Semua yang bisa dipakai dari library ini, satu baris per nama, dengan tautan ke bab yang membahasnya. Daftar ini diperiksa oleh `test/reference.test.js`:
test gagal kalau ada ekspor atau fungsi yang tidak tercantum di sini.

## 18.1 `@kufayeka/sheet` (React)

| Nama | Artinya | Bab |
|---|---|---|
| `Sheet` | komponen spreadsheet: props, event, handle `ref`, keyboard, tema | [3](03-komponen-sheet.md) |
| `useWorkbook` | hook untuk membaca workbook dari komponen lain | [11.7](11-react.md#117-membaca-workbook-dari-komponen-lain-useworkbook) |
| `VERSION` | versi paket | |

CSS: `import '@kufayeka/sheet/style.css'` sekali di aplikasi.

## 18.2 `@kufayeka/sheet/core`

Tanpa React dan tanpa browser: berjalan di browser, Node.js, Deno, Bun, dan worker.

| Nama | Artinya | Bab |
|---|---|---|
| `createWorkbook` | workbook baru, atau dibuka dari `toJSON()`: `createWorkbook(doc, { user, now, beforeOp, undoLimit })` | [2](02-konsep.md), [11.2](11-react.md#112-sheet-yang-sudah-berisi) |
| `VERSION` | versi paket | |
| `isError`, `ERR` | memeriksa hasil rumus yang error, dan daftar kode error | [5.7](05-rumus.md#57-error-dan-artinya) |
| `FUNCTION_NAMES` | nama semua fungsi rumus | [5.13](05-rumus.md#513-semua-fungsi-buat-apa-cara-pakai-hasilnya) |
| `formatValue`, `FORMAT_PRESETS`, `localeInfo` | menampilkan nilai dengan format dan locale, format siap pakai, info pemisah locale | [6](06-format.md) |
| `displayOf` | yang tampil dari sebuah nilai dan format: `{ text, align, kind, color }` | [6](06-format.md) |
| `dateToSerial`, `serialToDate` | `Date` menjadi nomor hari dan sebaliknya | [4.5](04-api-workbook.md#45-mengisi-dari-data-api) |
| `parseInput` | teks ketikan menjadi nilai menurut locale: `'1.250,5'` → 1250.5 | [6.5](06-format.md#65-locale) |
| `roundTo` | pembulatan yang dipakai format uang | [5.8](05-rumus.md#58-menulis-rumus-dari-kode) |
| `colName`, `colIndex` | `2` ↔ `'C'` | [2.2](02-konsep.md#22-alamat-sel) |
| `storeFormula`, `formulaText`, `resolveRef`, `isStoredFormula` | rumus teks ↔ rumus tersimpan `{ f, refs }`, dan ke mana sebuah referensi menunjuk | [2.3](02-konsep.md), [12.1](12-server.md#123-isi-content) |
| `newId`, `keyBetween`, `keysBetween`, `compareKeys` | id baru, key urutan di antara dua key, dan perbandingannya | [12.1](12-server.md#123-isi-content) |
| `fillBlock`, `copyBlock`, `pasteClip`, `pasteText` | fill handle, copy, dan paste dari kode | [5.8](05-rumus.md#58-menulis-rumus-dari-kode) |
| `sortRange` | urutkan range menurut satu kolom | [7.3](07-data.md#73-mengurutkan) |
| `findAll`, `replaceIn` | cari dan ganti | [7.7](07-data.md#77-mencari-dan-mengganti) |
| `pivot`, `tableOf`, `PIVOT_FUNCTIONS` | ringkasan per kelompok tanpa sheet, dan range sebagai daftar record | [7.6](07-data.md#76-pivot-table) |
| `populate` | data dari luar ke sheet, tetap sebagai data | [4.5](04-api-workbook.md#45-mengisi-dari-data-api) |
| `fromApiMakerType`, `fieldType`, `checkValue` | tipe kolom dari Type Nexa API Maker, tipe satu field, dan pemeriksaan satu nilai | [8.5](10-aturan.md#85-tipe-kolom) |
| `mergePatch`, `checkPatch`, `viewFor` | menggabungkan patch, memeriksanya, dan menyiapkan workbook untuk satu orang | [12](12-server.md) |
| `resolveAccess`, `validateAccess`, `parseWhere`, `ACTIONS`, `ACTION_INFO`, `UI_ITEMS` | access control | [13](13-hak-akses.md) |
| `exportXlsx`, `importXlsx`, `importXlsxInto` | file `.xlsx` | [15](15-excel.md) |
| `exportCsv`, `importCsvInto`, `parseCsv`, `codeOfFormat` | CSV, dan kode format Excel | [15](15-excel.md) |

## 18.3 Workbook

Fungsi yang hanya ada di `wb`, bukan di handle sheet:

| Nama | Artinya | Bab |
|---|---|---|
| `sheet` | handle sebuah sheet (nama atau id) | [2.2](02-konsep.md#22-alamat-sel) |
| `sheetIds`, `sheetIdByName`, `addSheet` | daftar sheet, id dari nama, sheet baru | [4.10](04-api-workbook.md#410-referensi) |
| `address` | `'K21'` dari nomor | [4.10](04-api-workbook.md#410-referensi) |
| `setAutoHeights` | tinggi baris otomatis, dipakai grid | [4.10](04-api-workbook.md#410-referensi) |
| `settings`, `setSettings` | locale, mata uang, named range | [4.10](04-api-workbook.md#410-referensi) |
| `names`, `addName`, `setName`, `removeName`, `nameRange`, `nameProblem` | named range | [5.11](05-rumus.md#511-named-range) |
| `undo`, `redo`, `canUndo`, `canRedo`, `apply`, `on`, `revision`, `tick` | perubahan, event, undo | [12.6](12-server.md#126-undo-redo-source-dan-apply) |
| `toJSON`, `pendingPatch`, `saved`, `unsaved`, `version` | menyimpan | [11.5](11-react.md#115-tombol-simpan), [12](12-server.md) |
| `setRules` | aturan per sel untuk orang yang membuka | [8.6](10-aturan.md#86-sel-yang-tidak-boleh-diubah) |
| `setAccess`, `access`, `can`, `shows` | access control | [13](13-hak-akses.md) |
| `setUser` | ganti orang yang membuka (penulis komentar dan op) | [14](14-komentar.md) |
| `id` | id workbook | [12.1](12-server.md#123-isi-content) |

## 18.4 Handle sheet

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
| validasi | `addValidation`, `setValidation`, `removeValidation`, `validationAt`, `choicesAt`, `invalidAt` | [8.3](10-aturan.md#83-pilihan-dari-daftar-dropdown) |
| pivot | `addPivot`, `setPivot`, `removePivot`, `pivots`, `pivotAt` | [7.6](07-data.md#76-pivot-table) |
| aturan dan tipe | `modeAt`, `setTypes`, `typeAt` | [10](10-aturan.md) |
| komentar | `addComment`, `replyComment`, `editComment`, `deleteComment`, `resolveComment`, `comments`, `commentAt`, `hasComment` | [14](14-komentar.md) |

## 18.5 Daftar lain

| Daftar | Di mana |
|---|---|
| props, event, dan handle `ref` `<Sheet>` | [3.12](03-komponen-sheet.md#312-referensi) |
| tombol keyboard | [3.12](03-komponen-sheet.md#312-referensi) |
| opsi `createWorkbook` dan event workbook | [2.14](02-konsep.md#214-referensi) |
| jenis op | [12.7](12-server.md#127-jenis-op) |
| kunci gaya, props baris, kolom, dan sheet | [4.10](04-api-workbook.md#410-referensi), [4.10](04-api-workbook.md#410-referensi), [4.10](04-api-workbook.md#410-referensi) |
| fungsi rumus | [5.13](05-rumus.md#513-semua-fungsi-buat-apa-cara-pakai-hasilnya) |
| jenis format dan huruf pola | [6.9](06-format.md#69-referensi) |
| syarat conditional formatting | [6.6](06-format.md#66-conditional-formatting) |
| jenis validasi | [8.3](10-aturan.md#83-pilihan-dari-daftar-dropdown) |
| spesifikasi pivot | [7.6](07-data.md#76-pivot-table) |
| semua isi `action` aturan akses | [13.35](13-hak-akses.md#1335-referensi) |
| yang ikut dan tidak ke Excel | [15](15-excel.md) |
| menu dan toolbar | [3.12](03-komponen-sheet.md#312-referensi) |

## 18.6 TypeScript

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
| `AccessRow`, `Who`, `AccessInfo`, `AccessUi` | hak akses ([bab 13](13-hak-akses.md)) |
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

[Daftar isi](../README.md#daftar-isi) · Sebelumnya: [17. Performa](17-performa.md)
