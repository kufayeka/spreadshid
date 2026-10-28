import { createWorkbook } from '@kufayeka/sheet/core';
import type { Style, BorderSide } from '@kufayeka/sheet/core';

// Pelajaran 5: gaya digabung, null membuang satu bagian, border per sisi, gaya dari fungsi, merge.
const wb = createWorkbook();
const inv = wb.sheet('Sheet1');
inv.setValues('A1', [['TB Sinar Jaya'], ['Jl. Raya Bogor 12'], [], ['Kode', 'Barang', 'Qty', 'Harga', 'Total']]);

inv.mergeCells('A1:E1, A2:E2');                             // dua merge sekaligus
inv.setStyle('A1', { bold: true, fontSize: 16, align: 'center', color: '#1a73e8' });
inv.setStyle('A4:E4', { bold: true, fill: '#e8f0fe' });
inv.setStyle('A4:E4', { underline: true });                 // digabung: bold dan fill tetap
console.log('digabung        :', JSON.stringify(inv.style('A4')));
inv.setStyle('A4:E4', { underline: null });                 // null: hanya underline yang dibuang
console.log('null            :', JSON.stringify(inv.style('A4')));

// garis luar: setiap sel mendapat sisi yang ada di pinggir kotak
const garis: BorderSide = { style: 'solid', width: 2, color: '#1a73e8' };
inv.setStyle('A4:E8', (r, c): Style => ({ borders: {
    ...(r === 3 ? { top: garis } : {}), ...(r === 7 ? { bottom: garis } : {}),
    ...(c === 0 ? { left: garis } : {}), ...(c === 4 ? { right: garis } : {})
} }));
console.log('pojok A4        :', Object.keys(inv.style('A4')?.borders ?? {}).join(', '));
inv.setStyle('A4', { borders: { left: null } });            // border juga per sisi
console.log('A4 tanpa kiri   :', Object.keys(inv.style('A4')?.borders ?? {}).join(', '));

console.log('merge           :', JSON.stringify(inv.merges()));
inv.unmergeCells('A2');
console.log('setelah unmerge :', inv.merges().length, 'merge');
