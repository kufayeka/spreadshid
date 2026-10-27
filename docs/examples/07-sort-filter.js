import { createWorkbook, sortRange } from '@kufayeka/sheet/core';

const wb = createWorkbook();
const sh = wb.sheet('Sheet1');
sh.setValues('A1', [
    ['Pekerjaan', 'Volume', 'Status'],
    ['Galian', 120, 'Approved'],
    ['Urugan', 40, 'Draft'],
    ['Beton', 18.5, 'Draft'],
    ['Besi', 2400, 'Approved']
]);
const kolomA = () => [1, 2, 3, 4].map((r) => sh.value(r, 0)).join(', ');

// sort: range tanpa header, kolom acuan, arah
sortRange(wb, 'Sheet1', 'A2:C5', 'B', 'desc');
console.log('urut volume turun :', kolomA());

// filter: range dengan header di baris pertamanya
sh.createFilter('A1:C5');
console.log('nilai kolom C     :', JSON.stringify(sh.filterValues('C')));
sh.setFilterColumn('C', { hidden: ['Draft'] });                    // berdasarkan nilai
const tampil = () => [1, 2, 3, 4].filter((r) => !sh.filteredOut(r)).map((r) => sh.value(r, 0)).join(', ');
console.log('hanya Approved    :', tampil());
sh.setFilterColumn('C', null);
sh.setFilterColumn('B', { op: 'between', a: 30, b: 200 });          // berdasarkan kondisi
console.log('volume 30..200    :', tampil());
console.log('filter            :', JSON.stringify(sh.filterOf().columns));
sh.removeFilter();
console.log('filter dihapus    :', tampil());
