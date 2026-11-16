import { createWorkbook } from '@kufayeka/sheet/core';
import { tabelSheet } from './data/cetak.js';

// 14.5 Wali kelas. Data: nilai ujian, satu baris per siswa per mata pelajaran.
// Pertanyaan: "Berapa nilai rata-rata tiap kelas di tiap mata pelajaran?" Jawabannya tabel dua arah: kelas ke bawah, mapel ke samping.
const wb = createWorkbook();
wb.setSettings({ locale: 'id-ID' });                  // 80,7 dengan koma, cara Indonesia
const nilai = wb.sheet('Sheet1');
nilai.setSheetProps({ name: 'Nilai' });
nilai.setValues('A1', [
    ['Siswa',  'Kelas', 'Mapel',       'Nilai'],
    ['Ayu',    '8A',    'Matematika',   88],
    ['Ayu',    '8A',    'IPA',          92],
    ['Ayu',    '8A',    'B. Inggris',   79],
    ['Bima',   '8A',    'Matematika',   72],
    ['Bima',   '8A',    'IPA',          68],
    ['Bima',   '8A',    'B. Inggris',   85],
    ['Candra', '8B',    'Matematika',   95],
    ['Candra', '8B',    'IPA',          90],
    ['Candra', '8B',    'B. Inggris',   70],
    ['Dewi',   '8B',    'Matematika',   64],
    ['Dewi',   '8B',    'IPA',          77],
    ['Dewi',   '8B',    'B. Inggris',   93]
]);

const rekap = wb.sheet(wb.addSheet('Rata-rata'));
rekap.addPivot('A1', 'Nilai!A1:D13', {
    rows: ['Kelas'],                                  // ke bawah
    columns: ['Mapel'],                               // ke samping
    values: [{ field: 'Nilai', fn: 'AVERAGE' }]
});
// pivot menulis angka apa adanya (80,6666...): tampilannya diatur lewat format kolom, satu angka di belakang koma
rekap.setColProps('B:E', { format: { type: 'number', decimals: 1 } });

console.log(tabelSheet(rekap, 'A1:E4'));
