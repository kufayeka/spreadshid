import type { AccessRow } from '@kufayeka/sheet/core';
import { buatStok, peta } from './data/stok-akses.js';

// Langkah 6: aturan pertama. Kasir boleh MEMBACA tabel produk.
const rows: AccessRow[] = [
    { who: 'role:kasir', effect: 'allow', action: 'read', where: 'Produk!A1:I13' }   // baru
];

const wb = buatStok();
const rina = { user: 'rina', roles: ['kasir'] };
peta(wb, rows, rina, 'rina (kasir):');

// rina mencoba mengubah stok di G2
wb.on('reject', (e) => console.log('ditolak:', e.reason));
wb.setValues('Produk', 'G2', 999, { source: 'user' });
console.log('G2 tetap:', wb.value('Produk', 'G2'));
