# 16. Panduan layar

[Daftar isi](../README.md#daftar-isi) · Sebelumnya: [15. Excel dan CSV](15-excel.md) · Berikutnya: [17. Performa](17-performa.md)

Bab ini untuk orang yang **memakai** sheet di aplikasimu: semua menu, tombol toolbar, dan panel, beserta fungsi kode yang setara untuk developer.
Tampilan dan tombolnya mengikuti spreadsheet pada umumnya, jadi orang yang sudah biasa memakai Excel langsung bisa bekerja. Teks di layar dalam
bahasa Inggris.

![Bagian-bagian layar](img/bagian-layar.png)

Dari atas ke bawah: **menubar**, **toolbar**, **kotak alamat** dan **formula bar**, **grid** dengan judul kolom dan nomor baris, dan **tab sheet** di
bawah. Setiap bagian bisa disembunyikan per role atau per akun lewat aturan `ui.*` ([13.22](13-hak-akses.md#1322-bagian-layar)).

## 16.1 Menu

| Menu | Isi | Di kode |
|---|---|---|
| **File** | Import… (`.xlsx`, `.csv`) · Download → Microsoft Excel (`.xlsx`) atau CSV sheet ini · Spreadsheet settings… (locale, mata uang) | `importXlsxInto`, `exportXlsx`, `exportCsv`, `setSettings` |
| **Edit** | Undo, Redo · Cut, Copy, Paste · Paste special → Values only, Format only · Find and replace · Delete → Values, baris, kolom | `undo`, `copyBlock`, `pasteClip`, `findAll`, `replaceIn`, `clear`, `deleteRows` |
| **View** | Freeze → baris dan kolom · Group → grup baris dan kolom, lipat dan buka semua · Comments · Show → Gridlines · Zoom | `setSheetProps`, `groupRows`, `showRowLevel`, `hideGridlines` |
| **Insert** | Rows (di atas, di bawah) · Columns (kiri, kanan) · Sheet · Checkbox · Dropdown · Function · Link · Comment · Pivot table | `insertRows`, `insertCols`, `addSheet`, `addValidation`, `addComment`, `addPivot` |
| **Format** | Number · Text (tebal, miring, garis bawah, coret) · Alignment · Wrapping · Rotation · Font size · Merge cells · Conditional formatting · Clear formatting | `setStyle`, `mergeCells`, `addConditional` |
| **Data** | Sort sheet · Sort range · Create a filter · Data validation · Named ranges | `sortRange`, `createFilter`, `setValidation`, `addName` |

**Klik kanan** pada sel, nomor baris, atau judul kolom membuka menu konteks: Cut, Copy, Paste, Paste values only, Insert dan Delete baris atau kolom,
Clear contents, Hide dan Unhide, Merge dan Unmerge, serta Sort.

## 16.2 Toolbar

| Tombol | Artinya |
|---|---|
| ↶ ↷ | undo, redo |
| kuas | salin format: pilih sel sumber, klik kuas, lalu klik sel tujuan |
| 100% | zoom |
| `Rp` `%` | format uang (mata uang workbook) dan persen |
| `.0←` `.00→` | kurangi atau tambah desimal |
| `123` | daftar format: angka, tanggal, jam, durasi, teks, dan pola sendiri |
| font, ukuran | jenis dan ukuran huruf |
| **B** *I* ~~S~~ U | tebal, miring, coret, garis bawah |
| A, ember | warna huruf, warna latar |
| kotak | border: semua, luar, dalam, atas, bawah, kiri, kanan, hapus |
| gabung | merge sel |
| perataan | kiri, tengah, kanan, dan atas, tengah, bawah |
| bungkus | Overflow (meluber ke sel kosong), Wrap (turun ke baris berikut), Clip (dipotong) |
| putar | kemiringan teks |
| rantai | link |
| Σ | fungsi cepat: SUM, AVERAGE, COUNT, MAX, MIN untuk seleksi |
| T× | hapus format |

Tombol yang tidak boleh dipakai seseorang tampil abu-abu, atau hilang kalau ada aturan `deny ui.disallowed`.

## 16.3 Panel samping

Panel muncul di kanan grid, satu panel pada satu waktu:

| Panel | Dibuka dari | Bab |
|---|---|---|
| Comments | View → Comments, Insert → Comment, Ctrl+Alt+M | [14](14-komentar.md) |
| Pivot table editor | memilih sel pivot, Insert → Pivot table | [8](08-pivot.md) |
| Conditional formatting | Format → Conditional formatting | [6.4](06-format.md#64-conditional-formatting) |
| Data validation | Data → Data validation, Insert → Dropdown | [7.4](07-data.md#74-validasi-data) |
| Named ranges | Data → Named ranges | [5.11](05-rumus.md#511-named-range-dan-subtotal) |
| Find and replace | Ctrl+F, Ctrl+H | [7.5](07-data.md#75-cari-dan-ganti) |

## 16.4 Di dalam grid

- **Fill handle**: kotak kecil di pojok kanan bawah seleksi. Tarik untuk melanjutkan deret (1, 2, 3 · Senin, Selasa · Item 1, Item 2) atau menyalin
  rumus. Tahan Ctrl untuk menyalin apa adanya.
- **Mengubah ukuran**: tarik garis di antara judul kolom atau nomor baris. Klik dua kali untuk menyesuaikan dengan isi.
- **Filter**: tombol di judul kolom membuka urut dan saring ([7.2](07-data.md#72-filter)).
- **Dropdown dan checkbox** dari validasi data: klik panahnya, atau tekan Alt+↓.
- **Tanda di pojok sel**: oranye berarti ada komentar terbuka, merah berarti nilainya melanggar validasi yang hanya menandai.
- **Grup**: tombol `[-]` dan `[+]` di samping nomor baris dan di atas judul kolom, dan tombol level di pojok kiri atas.
- **Tab sheet**: klik kanan untuk Rename, Duplicate, Delete, Hide, serta Move left dan Move right. Tombol `+` menambah sheet, dan tombol ☰ menampilkan semua sheet
  termasuk yang tersembunyi.

Tombol keyboard lengkap ada di [3.4](03-komponen-sheet.md#34-keyboard).

[Daftar isi](../README.md#daftar-isi) · Sebelumnya: [15. Excel dan CSV](15-excel.md) · Berikutnya: [17. Performa](17-performa.md)
