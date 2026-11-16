import { createWorkbook } from '@kufayeka/sheet/core';
import { tabelSheet } from './data/cetak.js';

// 14.19 Klinik gigi. Data: janji temu dua minggu, satu baris per pasien.
// Pertanyaan admin: "Hari apa yang paling ramai, supaya dokter tambahan dijadwalkan di hari itu?"
// Tanggal dikelompokkan menurut NAMA HARI (Senin pertama, seperti minggu ISO); namanya mengikuti bahasa workbook.
const wb = createWorkbook();
wb.setSettings({ locale: 'id-ID' });

const janji = wb.sheet('Sheet1');
janji.setSheetProps({ name: 'Janji temu' });
janji.setValues('A1', [
    ['Tanggal',    'Pasien', 'Tindakan'],
    ['2026-11-02', 'Ani',    'Scaling'],
    ['2026-11-02', 'Budi',   'Tambal'],
    ['2026-11-03', 'Cici',   'Kontrol'],
    ['2026-11-05', 'Dedi',   'Cabut'],
    ['2026-11-07', 'Eka',    'Scaling'],
    ['2026-11-07', 'Fani',   'Tambal'],
    ['2026-11-07', 'Gita',   'Kontrol'],
    ['2026-11-09', 'Hadi',   'Tambal'],
    ['2026-11-09', 'Iwan',   'Scaling'],
    ['2026-11-12', 'Joko',   'Kontrol'],
    ['2026-11-14', 'Kiki',   'Cabut'],
    ['2026-11-14', 'Lina',   'Scaling'],
    ['2026-11-14', 'Mira',   'Tambal']
]);

const ramai = wb.sheet(wb.addSheet('Per hari'));
ramai.addPivot('A1', "'Janji temu'!A1:C14", {
    rows: ['Tanggal'],
    group: { Tanggal: 'weekday' },                                             // Senin, Selasa, ... Minggu
    values: [
        { field: 'Pasien', fn: 'COUNTA', as: 'Pasien' },
        { field: 'Pasien', fn: 'COUNTA', as: 'Porsi', show: 'percentOfTotal' }
    ]
});

console.log(tabelSheet(ramai, 'A1:C6'));
