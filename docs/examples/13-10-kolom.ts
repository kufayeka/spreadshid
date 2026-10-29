import type { AccessRow } from '@kufayeka/sheet/core';
import { buatStok, peta } from './data/stok-akses.js';

// Langkah 10: kolom ditulis dengan judulnya. Hasilnya sama dengan langkah 9, tapi tetap benar walaupun kolom Stok nanti dipindah.
const rows: AccessRow[] = [
    { who: 'role:kasir', effect: 'allow', action: 'read', where: 'Produk!A1:I13' },
    { who: 'role:kasir', effect: 'allow', action: 'edit', where: 'Produk!col:Stok' }  // baru: judul kolom, bukan G2:G13
];

const wb = buatStok();
peta(wb, rows, { user: 'rina', roles: ['kasir'] }, 'rina (kasir):');

// kolom Stok dipindah ke depan (disisipkan kolom baru di A): aturannya ikut, tanpa diubah
wb.sheet('Produk').insertCols('A');
peta(wb, rows, { user: 'rina', roles: ['kasir'] }, 'setelah kolom baru disisipkan di A (Stok kini di H):');
