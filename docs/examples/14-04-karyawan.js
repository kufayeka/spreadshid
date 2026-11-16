import { createWorkbook } from '@kufayeka/sheet/core';
import { tabelSheet } from './data/cetak.js';

// 14.4 Bagian HR. Data: daftar karyawan, satu baris per orang.
// Pertanyaan HR: "Berapa orang di tiap departemen, di berapa kota mereka bekerja, dan berapa gaji rata-ratanya?"
const wb = createWorkbook();
wb.setSettings({ locale: 'id-ID', currency: 'IDR' });

const orang = wb.sheet('Sheet1');
orang.setSheetProps({ name: 'Karyawan' });
orang.setValues('A1', [
    ['NIK',   'Nama',           'Departemen', 'Kota',      'Gaji'],
    ['K-001', 'Andi Wijaya',    'Penjualan',  'Jakarta',   8500000],
    ['K-002', 'Bunga Lestari',  'Penjualan',  'Bandung',   7800000],
    ['K-003', 'Citra Ayu',      'Penjualan',  'Jakarta',   9200000],
    ['K-004', 'Dodi Saputra',   'Gudang',     'Bekasi',    5600000],
    ['K-005', 'Eka Pratama',    'Gudang',     'Bekasi',    5400000],
    ['K-006', 'Fajar Nugroho',  'Gudang',     'Bekasi',    5900000],
    ['K-007', 'Gita Maharani',  'Keuangan',   'Jakarta',  11000000],
    ['K-008', 'Hadi Santoso',   'Keuangan',   'Jakarta',   9800000],
    ['K-009', 'Indah Permata',  'IT',         'Jakarta',  12500000],
    ['K-010', 'Joko Susilo',    'IT',         'Yogyakarta', 10400000]
]);

const rekap = wb.sheet(wb.addSheet('Rekap'));
rekap.addPivot('A1', 'Karyawan!A1:E11', {
    rows: ['Departemen'],
    values: [
        { field: 'NIK', fn: 'COUNTA', as: 'Jumlah orang' },          // COUNTA menghitung sel yang terisi (NIK berupa teks)
        { field: 'Kota', fn: 'COUNTUNIQUE', as: 'Jumlah kota' },     // COUNTUNIQUE: berapa nilai yang BERBEDA
        { field: 'Gaji', fn: 'AVERAGE', as: 'Gaji rata-rata' }
    ]
});
rekap.setColProps('D', { format: { type: 'money', decimals: 0 } });

console.log(tabelSheet(rekap, 'A1:D6'));
