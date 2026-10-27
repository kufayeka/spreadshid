import { createWorkbook } from '@kufayeka/sheet/core';

const wb = createWorkbook();
const sh = wb.sheet('Sheet1');
sh.setValues('A1', [['Pekerjaan', 'Progres', 'Status'], ['Galian', 1, 'Selesai'], ['Urugan', 0.4, 'Terlambat'], ['Beton', 0.75, 'Jalan']]);

// satu warna: kondisi + gaya
sh.addConditional('C2:C4', { op: 'textIs', a: 'terlambat', style: { fill: '#f4c7c3', color: '#a50e0e', bold: true } });
// rumus sendiri, ditulis untuk sel kiri atas range; $C tetap kolom C, baris ikut geser
sh.addConditional('A2:A4', { op: 'formula', formula: '=$C2="Selesai"', style: { strike: true } });
// skala warna: merah ke hijau
sh.addConditional('B2:B4', { kind: 'scale', min: { type: 'number', value: 0, color: '#e67c73' }, max: { type: 'number', value: 1, color: '#57bb8a' } });

for (const a of ['C3', 'C4', 'A2', 'A3', 'B2', 'B3', 'B4']) console.log(a, JSON.stringify(sh.conditionalStyleAt(a)));

// isi sel berubah: gaya ikut berubah, tanpa menulis apa pun ke sel
sh.setValues('C3', 'Selesai');
console.log('C3 sesudah:', JSON.stringify(sh.conditionalStyleAt('C3')), '| A3 sesudah:', JSON.stringify(sh.conditionalStyleAt('A3')));
console.log('aturan    :', sh.conditionals().map((r) => r.op || r.kind).join(', '));
