import { createWorkbook } from '@kufayeka/sheet/core';
import { tabelSheet } from './data/cetak.js';

// 14.6 Tim helpdesk. Data: tiket keluhan pelanggan, satu baris per tiket, dengan tanggal dibuka, prioritas, dan status.
// Pertanyaan kepala tim: "Berapa tiket masuk tiap bulan, per prioritas? Tiket yang dibatalkan pelanggan tidak usah dihitung."
const wb = createWorkbook();
const tiket = wb.sheet('Sheet1');
tiket.setSheetProps({ name: 'Tiket' });
tiket.setValues('A1', [
    ['No',    'Dibuka',     'Prioritas', 'Status'],
    ['T-101', '2026-08-04', 'Tinggi',    'Selesai'],
    ['T-102', '2026-08-11', 'Rendah',    'Selesai'],
    ['T-103', '2026-08-19', 'Sedang',    'Batal'],
    ['T-104', '2026-08-27', 'Sedang',    'Selesai'],
    ['T-105', '2026-09-02', 'Tinggi',    'Selesai'],
    ['T-106', '2026-09-09', 'Tinggi',    'Selesai'],
    ['T-107', '2026-09-15', 'Rendah',    'Batal'],
    ['T-108', '2026-09-30', 'Sedang',    'Selesai'],
    ['T-109', '2026-10-01', 'Tinggi',    'Terbuka'],
    ['T-110', '2026-10-06', 'Rendah',    'Terbuka'],
    ['T-111', '2026-10-14', 'Rendah',    'Selesai'],
    ['T-112', '2026-10-21', 'Sedang',    'Terbuka']
]);

const rekap = wb.sheet(wb.addSheet('Per bulan'));
rekap.addPivot('A1', 'Tiket!A1:D13', {
    rows: ['Dibuka'],
    group: { Dibuka: 'month' },                       // tanggal dikumpulkan per bulan: 2026-08, 2026-09, ...
    columns: ['Prioritas'],
    values: [{ field: 'No', fn: 'COUNTA', as: 'Tiket' }],
    filters: { Status: { hidden: ['Batal'] } }        // tiket berstatus Batal dibuang sebelum dihitung
});

console.log(tabelSheet(rekap, 'A1:E5'));
