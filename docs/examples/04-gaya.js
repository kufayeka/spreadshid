import { createWorkbook } from '@kufayeka/sheet/core';

const wb = createWorkbook();
const sh = wb.sheet('Sheet1');
sh.setValues('A1', [['Pekerjaan', 'Jumlah'], ['Galian', 10200000], ['Urugan', 8400000]]);

// patch: hanya kunci yang ditulis yang berubah, sisanya tetap
sh.setStyle('A1:B1', { bold: true, fill: '#e8f0fe', align: 'center' });
sh.setStyle('A1:B1', { italic: true });
console.log('A1             :', sh.style('A1'));

// null menghapus satu bagian gaya
sh.setStyle('A1:B1', { fill: null });
console.log('tanpa fill     :', sh.style('A1'));

// fungsi: tiap sel dapat gayanya sendiri (r, c, gaya sekarang); null = biarkan sel itu
const garis = { style: 'solid', width: 1, color: '#000000' };
sh.setStyle('A1:B3', (r, c) => (r === 2 ? { borders: { bottom: garis } } : null));
console.log('B3 border      :', sh.style('B3').borders);
console.log('B2 tidak kena  :', sh.style('B2'));

// merge
sh.setValues('A5', 'Catatan lapangan');
sh.mergeCells('A5:B5');
console.log('merge          :', sh.merges());
