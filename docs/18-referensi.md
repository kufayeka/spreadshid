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
| `FUNCTION_NAMES` | nama semua fungsi rumus | [5.8](05-rumus.md#58-semua-fungsi-buat-apa-cara-pakai-hasilnya) |
| `formatValue`, `FORMAT_PRESETS`, `localeInfo` | menampilkan nilai dengan format dan locale, format siap pakai, info pemisah locale | [6](06-format.md) |
| `displayOf` | yang tampil dari sebuah nilai dan format: `{ text, align, kind, color }` | [6](06-format.md) |
| `dateToSerial`, `serialToDate` | `Date` menjadi nomor hari dan sebaliknya | [9](09-populate.md) |
| `parseInput` | teks ketikan menjadi nilai menurut locale: `'1.250,5'` → 1250.5 | [6.3](06-format.md#63-locale) |
| `roundTo` | pembulatan yang dipakai format uang | [5.9](05-rumus.md#59-rumus-dari-kode) |
| `colName`, `colIndex` | `2` ↔ `'C'` | [2.2](02-konsep.md#22-alamat-sel) |
| `storeFormula`, `formulaText`, `resolveRef`, `isStoredFormula` | rumus teks ↔ rumus tersimpan `{ f, refs }`, dan ke mana sebuah referensi menunjuk | [2.3](02-konsep.md), [12.1](12-server.md#123-isi-content) |
| `newId`, `keyBetween`, `keysBetween`, `compareKeys` | id baru, key urutan di antara dua key, dan perbandingannya | [12.1](12-server.md#123-isi-content) |
| `fillBlock`, `copyBlock`, `pasteClip`, `pasteText` | fill handle, copy, dan paste dari kode | [5.9](05-rumus.md#59-rumus-dari-kode) |
| `sortRange` | urutkan range menurut satu kolom | [7.1](07-data.md#71-sort) |
| `findAll`, `replaceIn` | cari dan ganti | [7.5](07-data.md#75-cari-dan-ganti) |
| `pivot`, `tableOf`, `PIVOT_FUNCTIONS` | ringkasan per kelompok tanpa sheet, dan range sebagai daftar record | [8.3](08-pivot.md#83-tanpa-sheet-pivot-dan-tableof) |
| `populate` | data dari luar ke sheet, tetap sebagai data | [9](09-populate.md) |
| `fromApiMakerType`, `fieldType`, `checkValue` | tipe kolom dari Type Nexa API Maker, tipe satu field, dan pemeriksaan satu nilai | [10.2](10-aturan.md#102-tipe-kolom) |
| `mergePatch`, `checkPatch`, `viewFor` | menggabungkan patch, memeriksanya, dan menyiapkan workbook untuk satu orang | [12](12-server.md) |
| `resolveAccess`, `validatePolicy`, `ACTIONS`, `ACTION_INFO`, `UI_ITEMS` | access control | [13](13-hak-akses.md) |
| `exportXlsx`, `importXlsx`, `importXlsxInto` | file `.xlsx` | [15](15-excel.md) |
| `exportCsv`, `importCsvInto`, `parseCsv`, `codeOfFormat` | CSV, dan kode format Excel | [15](15-excel.md) |

## 18.3 Workbook

Fungsi yang hanya ada di `wb`, bukan di handle sheet:

| Nama | Artinya | Bab |
|---|---|---|
| `sheet` | handle sebuah sheet (nama atau id) | [2.2](02-konsep.md#22-alamat-sel) |
| `sheetIds`, `sheetIdByName`, `addSheet` | daftar sheet, id dari nama, sheet baru | [4.5](04-api-workbook.md#45-sheet) |
| `address` | `'K21'` dari nomor | [4.2](04-api-workbook.md#42-membaca-isi) |
| `setAutoHeights` | tinggi baris otomatis, dipakai grid | [4.4](04-api-workbook.md#44-baris-dan-kolom) |
| `settings`, `setSettings` | locale, mata uang, named range | [4.6](04-api-workbook.md#46-pengaturan-workbook) |
| `names`, `addName`, `setName`, `removeName`, `nameRange`, `nameProblem` | named range | [5.11](05-rumus.md#511-named-range-dan-subtotal) |
| `undo`, `redo`, `canUndo`, `canRedo`, `apply`, `on`, `revision`, `tick` | perubahan, event, undo | [4.7](04-api-workbook.md#47-undo-redo-dan-apply) |
| `toJSON`, `pendingPatch`, `saved`, `unsaved`, `version` | menyimpan | [11.5](11-react.md#115-tombol-simpan), [12](12-server.md) |
| `setRules` | aturan per sel untuk orang yang membuka | [10.1](10-aturan.md#101-aturan-hanya-baca-dan-tersembunyi) |
| `setAccess`, `access`, `can`, `shows` | access control | [13](13-hak-akses.md) |
| `setUser` | ganti orang yang membuka (penulis komentar dan op) | [14](14-komentar.md) |
| `id` | id workbook | [12.1](12-server.md#123-isi-content) |

## 18.4 Handle sheet

`wb.sheet('Nama')` memberi fungsi-fungsi di bawah tanpa parameter sheet. Semuanya juga ada di `wb` dengan nama sheet sebagai parameter pertama.
Handle juga punya `id` dan `name`.

| Kelompok | Nama | Bab |
|---|---|---|
| menulis | `setValues`, `setBlock`, `clear` | [4.1](04-api-workbook.md#41-menulis-isi) |
| membaca | `value`, `input`, `display`, `raw`, `cellFormat`, `style`, `shownStyle`, `size`, `lastFilled`, `dataRegion`, `forEachFilledRow`, `rowContent` | [4.2](04-api-workbook.md#42-membaca-isi) |
| nomor dan id | `rowId`, `colId`, `rowIndex`, `colIndex` | [4.2](04-api-workbook.md#42-membaca-isi) |
| gaya | `setStyle`, `mergeCells`, `unmergeCells`, `merges` | [4.3](04-api-workbook.md#43-gaya-dan-merge) |
| baris dan kolom | `insertRows`, `deleteRows`, `moveRows`, `insertCols`, `moveCols`, `deleteCols`, `setRowProps`, `setColProps`, `rowProps`, `colProps`, `rowAxis`, `colAxis` | [4.4](04-api-workbook.md#44-baris-dan-kolom) |
| sheet | `sheetProps`, `setSheetProps`, `duplicateSheet`, `removeSheet`, `hideSheet`, `moveSheet`, `sheetShown` | [4.5](04-api-workbook.md#45-sheet) |
| conditional formatting | `addConditional`, `setConditional`, `moveConditional`, `removeConditional`, `conditionals`, `conditionalStyleAt` | [6.4](06-format.md#64-conditional-formatting) |
| filter | `createFilter`, `setFilterColumn`, `removeFilter`, `filterOf`, `filterValues`, `filteredOut` | [7.2](07-data.md#72-filter) |
| grup | `groupRows`, `ungroupRows`, `groupCols`, `ungroupCols`, `foldRowGroup`, `foldColGroup`, `showRowLevel`, `showColLevel`, `rowGroups`, `colGroups` | [7.3](07-data.md#73-grup-baris-dan-kolom) |
| validasi | `addValidation`, `setValidation`, `removeValidation`, `validationAt`, `choicesAt`, `invalidAt` | [7.4](07-data.md#74-validasi-data) |
| pivot | `addPivot`, `setPivot`, `removePivot`, `pivots`, `pivotAt` | [8](08-pivot.md) |
| aturan dan tipe | `modeAt`, `setTypes`, `typeAt` | [10](10-aturan.md) |
| komentar | `addComment`, `replyComment`, `editComment`, `deleteComment`, `resolveComment`, `comments`, `commentAt`, `hasComment` | [14](14-komentar.md) |

## 18.5 Daftar lain

| Daftar | Di mana |
|---|---|
| props, event, dan handle `ref` `<Sheet>` | [3.1](03-komponen-sheet.md#31-props), [3.2](03-komponen-sheet.md#32-event), [3.3](03-komponen-sheet.md#33-handle-ref) |
| tombol keyboard | [3.4](03-komponen-sheet.md#34-keyboard) |
| opsi `createWorkbook` dan event workbook | [2.5](02-konsep.md#25-perubahan-event-dan-undo) |
| jenis op | [4.8](04-api-workbook.md#48-jenis-op) |
| kunci gaya, props baris, kolom, dan sheet | [4.3](04-api-workbook.md#43-gaya-dan-merge), [4.4](04-api-workbook.md#44-baris-dan-kolom), [4.5](04-api-workbook.md#45-sheet) |
| fungsi rumus | [5.8](05-rumus.md#58-semua-fungsi-buat-apa-cara-pakai-hasilnya) |
| jenis format dan huruf pola | [6.1](06-format.md#61-jenis-format) |
| syarat conditional formatting | [6.4](06-format.md#64-conditional-formatting) |
| jenis validasi | [7.4](07-data.md#74-validasi-data) |
| spesifikasi pivot | [8.2](08-pivot.md#82-spesifikasi) |
| tindakan dan bagian layar access control | [13.2](13-hak-akses.md#132-bentuk-policy) |
| yang ikut dan tidak ke Excel | [15](15-excel.md) |
| menu dan toolbar | [16](16-layar.md) |

[Daftar isi](../README.md#daftar-isi) · Sebelumnya: [17. Performa](17-performa.md)
