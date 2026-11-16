import { createWorkbook, importCsvInto, exportXlsx, importXlsx } from '@kufayeka/sheet/core';

// 14.12 Pivot dari file. Data: ekspor CSV dari aplikasi kasir lain (atau file .xlsx kiriman orang), dan yang diinginkan hanyalah ringkasannya.
// Langkahnya selalu sama: file dimasukkan sebagai sheet, lalu pivot dibuat di atas sheet itu, lalu hasilnya bisa diunduh lagi sebagai .xlsx.

// 1. isi file CSV, seperti yang dibaca dari <input type="file"> (file.text()) atau dari disk di server (fs.readFile)
const csv = [
    'tanggal,gudang,barang,keluar',
    '2026-11-03,Cikarang,Palet kayu,40',
    '2026-11-03,Cikarang,Stretch film,12',
    '2026-11-04,Surabaya,Palet kayu,25',
    '2026-11-05,Cikarang,Palet kayu,18',
    '2026-11-05,Surabaya,Kardus besar,60',
    '2026-11-06,Surabaya,Stretch film,9'
].join('\n');

const wb = createWorkbook();
const { sheetIds } = importCsvInto(wb, csv, 'Barang keluar');          // file menjadi sheet "Barang keluar"
const sumber = wb.sheet(sheetIds[0]);
console.log('1. CSV masuk          :', sumber.lastFilled().r + 1, 'baris, angka terbaca sebagai angka:', typeof sumber.value('D2'));

// 2. pivot di sheet baru, di atas data dari file
const rekap = wb.sheet(wb.addSheet('Per gudang'));
rekap.addPivot('A1', "'Barang keluar'!A1:D100", {                   // nama sheet berspasi ditulis di antara tanda kutip satu
    rows: ['gudang'], columns: ['barang'],
    values: [{ field: 'keluar', fn: 'SUM' }]
});
const baris = [];
for (let r = 0; r < 4; r++) baris.push([0, 1, 2, 3, 4].map((c) => String(rekap.display(r, c).text).padEnd(14)).join(''));
console.log('2. pivot:\n   ' + baris.join('\n   '));

// 3. diunduh sebagai .xlsx: di browser lewat menu File > Download atau tombol aplikasi; di server bytes ini dikirim sebagai lampiran
const bytes = exportXlsx(wb);
console.log('3. file .xlsx         :', bytes.length > 1000 ? 'jadi' : 'kosong', '(' + Math.round(bytes.length / 1024) + ' KB)');

// 4. yang perlu diketahui: di dalam file .xlsx pivot ditulis sebagai ANGKA, bukan sebagai pivot Excel.
//    Orang yang membukanya di Excel melihat ringkasannya, tetapi tidak bisa mengatur ulang pivotnya.
//    Simpan workbook sebagai JSON (bab 9) bila pivot harus tetap bisa diatur.
const { workbook: dibuka } = await importXlsx(bytes);
const kembali = dibuka.sheet('Per gudang');
console.log('4. dibuka lagi        : pivot', kembali.pivots().length, '| C2 tetap', kembali.value('C2'), '(angka biasa)');
