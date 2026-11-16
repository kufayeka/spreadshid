import { createWorkbook } from '@kufayeka/sheet/core';
import { tabelSheet } from './data/cetak.js';

// 14.7 Toko online. Data: pesanan bulan ini, satu baris per barang di sebuah pesanan.
// Pertanyaan: "Tiga produk apa yang paling laku (paling banyak terjual), dan berapa pembelinya?"
// Pivot diurutkan menurut NILAINYA (Terjual, terbesar di atas), bukan menurut nama produk, lalu tiga teratas dibaca dengan rumus biasa.
const wb = createWorkbook();
wb.setSettings({ locale: 'id-ID', currency: 'IDR' });

const pesanan = wb.sheet('Sheet1');
pesanan.setSheetProps({ name: 'Pesanan' });
pesanan.setValues('A1', [
    ['Pesanan', 'Pembeli', 'Produk',          'Qty'],
    ['P-5001',  'rani',    'Kaos polos',        3],
    ['P-5001',  'rani',    'Topi',              1],
    ['P-5002',  'budi',    'Kaos polos',        2],
    ['P-5003',  'sinta',   'Celana chino',      1],
    ['P-5004',  'agus',    'Kaos polos',        5],
    ['P-5004',  'agus',    'Kaus kaki (3 psg)', 2],
    ['P-5005',  'rani',    'Kaus kaki (3 psg)', 4],
    ['P-5006',  'dewi',    'Topi',              2],
    ['P-5007',  'budi',    'Celana chino',      2],
    ['P-5008',  'tono',    'Kaus kaki (3 psg)', 3],
    ['P-5009',  'sinta',   'Jaket',             1]
]);

const laris = wb.sheet(wb.addSheet('Terlaris'));
laris.addPivot('A1', 'Pesanan!A1:D12', {
    rows: ['Produk'],
    values: [
        { field: 'Qty', fn: 'SUM', as: 'Terjual' },
        { field: 'Pembeli', fn: 'COUNTUNIQUE', as: 'Pembeli' }
    ],
    sort: { Produk: { by: 'Terjual', dir: 'desc' } },  // urut menurut Terjual, terbesar dulu
    totals: false                                       // tanpa Grand total: baris 2-4 pasti tiga teratas
});

// Hasil pivot adalah nilai biasa di sel, jadi rumus bisa membacanya: ringkasan "tiga teratas" untuk dashboard
laris.setValues('E1', [
    ['Peringkat', 'Produk', 'Terjual'],
    [1, '=A2', '=B2'],
    [2, '=A3', '=B3'],
    [3, '=A4', '=B4']
]);

console.log(tabelSheet(laris, 'A1:C6'));
console.log();
console.log(tabelSheet(laris, 'E1:G4'));
