import { createWorkbook } from '@kufayeka/sheet/core';
import { tabelSheet } from './data/cetak.js';

// 14.16 Jasa laundry kiloan. Data: nota setengah tahun, satu baris per nota.
// Pertanyaan pemilik: "Bulan mana menyumbang paling banyak, berapa omzet sejak Januari, naik atau turun dibanding bulan sebelumnya,
// dan bulan ke berapa yang terbaik?" Satu field Total, ditampilkan lima cara (Excel: Show Values As).
const wb = createWorkbook();
wb.setSettings({ locale: 'id-ID', currency: 'IDR' });

const nota = wb.sheet('Sheet1');
nota.setSheetProps({ name: 'Nota' });
nota.setValues('A1', [
    ['Tanggal',    'Layanan',    'Total'],
    ['2026-01-08', 'Cuci kering', 1850000],
    ['2026-01-22', 'Setrika',      950000],
    ['2026-02-05', 'Cuci kering', 2100000],
    ['2026-02-19', 'Setrika',      700000],
    ['2026-03-04', 'Cuci kering', 1600000],
    ['2026-03-18', 'Setrika',      800000],
    ['2026-04-09', 'Cuci kering', 2600000],
    ['2026-04-23', 'Setrika',     1100000],
    ['2026-05-07', 'Cuci kering', 2900000],
    ['2026-05-21', 'Setrika',     1300000],
    ['2026-06-11', 'Cuci kering', 2500000],
    ['2026-06-25', 'Setrika',     1200000]
]);

const tren = wb.sheet(wb.addSheet('Tren'));
tren.addPivot('A1', 'Nota!A1:C13', {
    rows: ['Tanggal'], group: { Tanggal: 'month' },
    values: [
        { field: 'Total', as: 'Omzet' },
        { field: 'Total', as: 'Porsi', show: 'percentOfTotal' },              // bagian dari omzet semua bulan
        { field: 'Total', as: 'Sejak Januari', show: 'runningTotal' },        // kumulatif, bulan demi bulan
        { field: 'Total', as: 'Naik/turun', show: 'percentDifference' },      // dibanding bulan sebelumnya
        { field: 'Total', as: 'Peringkat', show: 'rank' }                     // 1 = bulan dengan omzet terbesar
    ]
});
// kolom persen (Porsi, Naik/turun) diberi format persen oleh pivot sendiri; yang lain diberi format Rupiah di sini
tren.setColProps('B', { format: { type: 'money', decimals: 0 } });
tren.setColProps('D', { format: { type: 'money', decimals: 0 } });

console.log(tabelSheet(tren, 'A1:F8'));
