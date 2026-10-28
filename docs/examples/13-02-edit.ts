import type { AccessRow } from '@kufayeka/sheet/core';
import { buatStok, peta } from './data/stok-akses.js';

// Langkah 2: membuka lubang edit di dalam area baca. Kasir membaca semua, tapi kolom Stok (G) dan Status (I) boleh diubah.
// "edit" mengalahkan "read" di sel yang sama, jadi urutan baris tidak penting.
const rows: AccessRow[] = [
    { who: 'role:kasir', effect: 'allow', action: 'read', where: 'Produk!A1:I13' },
    { who: 'role:kasir', effect: 'allow', action: 'edit', where: 'Produk!col:Stok' },      // kolom ditulis dengan judulnya
    { who: 'role:kasir', effect: 'allow', action: 'edit', where: 'Produk!I2:I13' }         // atau dengan range biasa
];

const wb = buatStok();
peta(wb, rows, { user: 'rina', roles: ['kasir'] }, 'rina (kasir):');

wb.setValues('Produk', 'G2', 400, { source: 'user' });
console.log('G2 diubah rina:', wb.value('Produk', 'G2'));
