import { createWorkbook } from '@kufayeka/sheet/core';
import { tabelSheet } from './data/cetak.js';

// 14.3 Toko kelontong. Data: daftar penjualan satu minggu, satu baris per nota.
// Pertanyaan pemilik: "Kategori mana yang paling banyak menghasilkan uang minggu ini?"
const wb = createWorkbook();
wb.setSettings({ locale: 'id-ID', currency: 'IDR' });

const jual = wb.sheet('Sheet1');
jual.setSheetProps({ name: 'Penjualan' });
jual.setValues('A1', [
    ['Tanggal',    'Barang',            'Kategori',  'Qty', 'Total'],
    ['2026-11-02', 'Beras 5 kg',        'Sembako',    3,     225000],
    ['2026-11-02', 'Minyak goreng 2 L', 'Sembako',    4,     148000],
    ['2026-11-02', 'Sabun mandi',       'Kebersihan', 6,      27000],
    ['2026-11-03', 'Kopi sachet',       'Minuman',   20,      30000],
    ['2026-11-03', 'Beras 5 kg',        'Sembako',    2,     150000],
    ['2026-11-04', 'Teh botol',         'Minuman',   12,      60000],
    ['2026-11-04', 'Deterjen 800 g',    'Kebersihan', 3,      66000],
    ['2026-11-05', 'Gula 1 kg',         'Sembako',    5,      90000],
    ['2026-11-06', 'Air mineral 600 ml','Minuman',   24,      72000],
    ['2026-11-07', 'Sabun mandi',       'Kebersihan', 4,      18000]
]);

// Pivot di sheet baru: satu baris per Kategori, isinya jumlah Total
const ringkas = wb.sheet(wb.addSheet('Ringkasan'));
ringkas.addPivot('A1', 'Penjualan!A1:E11', {
    rows: ['Kategori'],
    values: [{ field: 'Total', fn: 'SUM', as: 'Omzet' }]
});
ringkas.setColProps('B', { format: { type: 'money', decimals: 0 } });

console.log(tabelSheet(ringkas, 'A1:B5'));
