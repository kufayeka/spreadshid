import type { AccessRow } from '@kufayeka/sheet/core';
import { buatStok } from './data/stok-akses.js';

// Langkah 19: aksi lain. Satu aksi, satu kelompok (format = semua format.*), dan deny di dalam kelompok.
const rows: AccessRow[] = [
    { who: 'role:kasir', effect: 'allow', action: 'edit', where: 'Produk!A1:I13' },
    { who: 'role:kasir', effect: 'allow', action: 'sort' },             // baru: satu aksi
    { who: 'role:kasir', effect: 'allow', action: 'format' },           // baru: satu kelompok
    { who: 'role:kasir', effect: 'deny', action: 'format.bold' }        // baru: kecuali tebal
];

const wb = buatStok();
wb.setAccess(rows, { user: 'rina', roles: ['kasir'] });
for (const a of ['sort', 'format.italic', 'format.fill', 'format.bold', 'filter', 'rows.insert', 'copy', 'download']) {
    console.log(a.padEnd(14), wb.can(a) ? 'boleh' : 'tidak');
}
