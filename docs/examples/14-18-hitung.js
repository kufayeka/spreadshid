import { createWorkbook } from '@kufayeka/sheet/core';
import { tabelSheet } from './data/cetak.js';

// 14.18 Toko ponsel. Data: penjualan per unit, dengan harga jual dan harga modalnya.
// Pertanyaan pemilik: "Berapa laba dan margin tiap merek?" Laba dan margin tidak ada di data: dibuat sebagai calculated field
// (Excel: Calculated Field). Setiap nama field di rumus berarti JUMLAH field itu di kelompoknya, jadi margin per merek benar,
// termasuk di baris Grand total (bukan rata-rata dari margin per transaksi).
const wb = createWorkbook();
wb.setSettings({ locale: 'id-ID', currency: 'IDR' });

const jual = wb.sheet('Sheet1');
jual.setSheetProps({ name: 'Penjualan' });
jual.setValues('A1', [
    ['Merek',   'Tipe',          'Harga jual', 'Harga modal'],
    ['Samsung', 'Galaxy A16',     2600000,      2250000],
    ['Samsung', 'Galaxy A36',     4900000,      4300000],
    ['Samsung', 'Galaxy A16',     2600000,      2250000],
    ['Xiaomi',  'Redmi 14C',      1500000,      1320000],
    ['Xiaomi',  'Redmi Note 14',  3100000,      2700000],
    ['Xiaomi',  'Redmi 14C',      1500000,      1320000],
    ['Oppo',    'A60',            2400000,      2150000],
    ['Oppo',    'Reno 13',        6200000,      5300000]
]);

const laba = wb.sheet(wb.addSheet('Laba'));
laba.addPivot('A1', 'Penjualan!A1:D9', {
    rows: ['Merek'],
    calculated: [
        { name: 'Laba', formula: '[Harga jual] - [Harga modal]' },         // nama dengan spasi ditulis di dalam [ ]
        { name: 'Margin', formula: '([Harga jual] - [Harga modal]) / [Harga jual]' }
    ],
    values: [
        { field: 'Tipe', fn: 'COUNTA', as: 'Unit' },
        { field: 'Harga jual', as: 'Omzet' },
        { field: 'Laba' },
        { field: 'Margin' }
    ],
    sort: { Merek: { by: 'Laba', dir: 'desc' } }
});
laba.setColProps('C:D', { format: { type: 'money', decimals: 0 } });
laba.setColProps('E', { format: { type: 'percent', decimals: 1 } });

console.log(tabelSheet(laba, 'A1:E5'));
