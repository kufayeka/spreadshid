import { createWorkbook, populate } from '@kufayeka/sheet/core';

const wb = createWorkbook();
const sh = wb.sheet('Sheet1');
const baris = (range) => {
    const out = [];
    for (let r = range.r1; r <= range.r2; r++) {
        const row = [];
        for (let c = range.c1; c <= range.c2; c++) row.push(sh.display(r, c).text);
        out.push(row.join(' | '));
    }
    return out.join('\n                ');
};

// tabel: satu baris per objek, satu kolom per field, dengan baris judul
const data = [
    { pekerjaan: 'Galian', volume: 120, satuan: 'm3' },
    { pekerjaan: 'Urugan', volume: 40, satuan: 'm3' },
    { pekerjaan: 'Rumus?', volume: '=1+1', satuan: 'teks' }
];
let range = populate(wb, 'Sheet1', { at: 'A1', header: true }, data);
console.log('tabel         :', baris(range));
console.log('"=1+1" tetap teks:', JSON.stringify(sh.value('B4')));

// daftar ke kanan, mulai E1
range = populate(wb, 'Sheet1', { at: 'E1', direction: 'right' }, ['Sen', 'Sel', 'Rab']);
console.log('ke kanan      :', baris(range));

// pilih field dan urutannya
range = populate(wb, 'Sheet1', { at: 'A7', header: true, fields: ['satuan', 'pekerjaan'] }, data.slice(0, 2));
console.log('field tertentu:', baris(range));

// cell object: nilai plus gayanya
range = populate(wb, 'Sheet1', { at: 'E3' }, [{ value: 'Terlambat', fill: '#f4c7c3', bold: true }, { value: 'Tepat', fill: '#b7e1cd' }]);
console.log('cell object   :', baris(range), '| gaya E3:', JSON.stringify(sh.style('E3')));
