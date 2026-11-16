import { createWorkbook } from '@kufayeka/sheet/core';
import { tabelSheet } from './data/cetak.js';

// 14.9 Pemilik restoran dengan tiga cabang. Data: struk kasir satu minggu, satu baris per struk.
// Pertanyaan: "Untuk tiap cabang: berapa omzetnya, berapa struk, berapa rata-rata dan nilai tengah (median) belanja per struk,
// dan berapa struk terbesar?" Satu pivot, lima angka sekaligus.
// Rata-rata gampang tertarik oleh satu-dua struk besar (pesta, rombongan); median tidak, jadi keduanya dilihat bersama.
const wb = createWorkbook();
wb.setSettings({ locale: 'id-ID', currency: 'IDR' });

const struk = wb.sheet('Sheet1');
struk.setSheetProps({ name: 'Struk' });
struk.setValues('A1', [
    ['No',   'Cabang',  'Total'],
    ['1001', 'Kemang',   185000],
    ['1002', 'Kemang',   92000],
    ['1003', 'Kemang',   2450000],
    ['1004', 'Kemang',   134000],
    ['1005', 'Depok',    78000],
    ['1006', 'Depok',    101000],
    ['1007', 'Depok',    66000],
    ['1008', 'Depok',    120000],
    ['1009', 'Depok',    88000],
    ['1010', 'Bekasi',   156000],
    ['1011', 'Bekasi',   143000],
    ['1012', 'Bekasi',   171000]
]);

const kinerja = wb.sheet(wb.addSheet('Kinerja'));
kinerja.addPivot('A1', 'Struk!A1:C13', {
    rows: ['Cabang'],
    values: [
        { field: 'Total', fn: 'SUM', as: 'Omzet' },
        { field: 'No', fn: 'COUNTA', as: 'Struk' },
        { field: 'Total', fn: 'AVERAGE', as: 'Rata-rata' },
        { field: 'Total', fn: 'MEDIAN', as: 'Median' },
        { field: 'Total', fn: 'MAX', as: 'Terbesar' }
    ],
    sort: { Cabang: { by: 'Omzet', dir: 'desc' } }
});
kinerja.setColProps('B', { format: { type: 'money', decimals: 0 } });
kinerja.setColProps('D:F', { format: { type: 'money', decimals: 0 } });

console.log(tabelSheet(kinerja, 'A1:F5'));
