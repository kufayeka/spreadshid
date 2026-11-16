import { createWorkbook, tableOf, pivot } from '@kufayeka/sheet/core';

// 14.11 Pivot di server (Node.js, tanpa browser dan tanpa React). Tiga pola yang paling sering dipakai.

// ---- Pola A: data langsung dari database --------------------------------------------------------------------------------------------------
// Contoh: hasil `SELECT tanggal, kota, total FROM pesanan` (di sini ditulis sebagai array). Tidak ada sheet sama sekali:
// pivot() menerima daftar record dan mengembalikan tabel jadi. Cocok untuk API laporan atau email laporan harian.
const dariDatabase = [
    { tanggal: '2026-09-03', kota: 'Medan',    total: 420000 },
    { tanggal: '2026-09-17', kota: 'Makassar', total: 310000 },
    { tanggal: '2026-10-01', kota: 'Medan',    total: 275000 },
    { tanggal: '2026-10-08', kota: 'Medan',    total: 510000 },
    { tanggal: '2026-10-21', kota: 'Makassar', total: 190000 },
    { tanggal: '2026-11-04', kota: 'Makassar', total: 640000 }
];
const perBulan = pivot(dariDatabase, {
    rows: ['tanggal'], group: { tanggal: 'month' },
    columns: ['kota'],
    values: [{ field: 'total', fn: 'SUM' }]
});
console.log('A. tabel jadi (cells):');
for (const baris of perBulan.cells) console.log('   ' + baris.map((x) => String(x ?? '').padEnd(12)).join(''));
// satu angka bisa diambil langsung: value(kunci baris, kunci kolom, nomor value)
console.log('   Medan Oktober    :', perBulan.value(['2026-10'], ['Medan'], 0));
console.log('   semua kota, semua bulan:', perBulan.value([], [], 0));

// ---- Pola B: dari workbook yang tersimpan --------------------------------------------------------------------------------------------------
// Workbook disimpan sebagai JSON (bab 9). Server membukanya, membaca satu sheet sebagai record dengan tableOf, lalu meringkasnya.
// Di sini JSON-nya dibuat dulu supaya contoh bisa berdiri sendiri; di aplikasi nyata JSON ini datang dari database.
function workbookCabang(kota, angka) {
    const wb = createWorkbook();
    const s = wb.sheet('Sheet1');
    s.setSheetProps({ name: 'Penjualan' });
    s.setValues('A1', [['Produk', 'Qty'], ...angka]);
    return { kota, json: wb.toJSON() };
}
const tersimpan = [
    workbookCabang('Medan',    [['Kopi', 40], ['Teh', 25]]),
    workbookCabang('Makassar', [['Kopi', 18], ['Teh', 31], ['Coklat', 12]])
];
// semua file cabang dibaca, setiap record diberi tahu asal kotanya, lalu digabung jadi satu daftar
const gabungan = tersimpan.flatMap(({ kota, json }) =>
    tableOf(createWorkbook(json), 'Penjualan', 'A:B').records.map((r) => ({ ...r, Kota: kota })));
const nasional = pivot(gabungan, { rows: ['Produk'], columns: ['Kota'], values: [{ field: 'Qty', fn: 'SUM' }] });
console.log('B. gabungan dua file cabang:');
for (const baris of nasional.cells) console.log('   ' + baris.map((x) => String(x ?? '').padEnd(12)).join(''));

// ---- Pola C: server membuat workbook laporan yang berisi pivot hidup --------------------------------------------------------------------------
// Server menulis data dan pivot ke workbook baru, lalu menyimpannya. Orang yang membukanya nanti mendapat pivot yang masih bisa diatur.
const laporan = createWorkbook();
const data = laporan.sheet('Sheet1');
data.setSheetProps({ name: 'Data' });
data.setValues('A1', [['Produk', 'Kota', 'Qty'], ...gabungan.map((r) => [r.Produk, r.Kota, r.Qty])]);
const ringkas = laporan.sheet(laporan.addSheet('Ringkasan'));
ringkas.addPivot('A1', 'Data!A1:C200', { rows: ['Kota'], values: [{ field: 'Qty', fn: 'SUM', as: 'Qty' }] });
const json = laporan.toJSON();                                       // inilah yang disimpan ke database
const dibukaLagi = createWorkbook(json);
console.log('C. disimpan lalu dibuka lagi:', dibukaLagi.sheet('Ringkasan').pivots().length, 'pivot,',
    'Grand total =', dibukaLagi.sheet('Ringkasan').value('B4'));
