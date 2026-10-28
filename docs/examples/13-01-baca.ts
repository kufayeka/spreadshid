import type { AccessRow } from '@kufayeka/sheet/core';
import { buatStok, peta } from './data/stok-akses.js';

// Langkah 1: satu baris aturan. Kasir boleh MEMBACA tabel produk. Yang tidak disebut tidak didapat sama sekali.
const rows: AccessRow[] = [
    { who: 'role:kasir', effect: 'allow', action: 'read', where: 'Produk!A1:I13' }
];

const wb = buatStok();
peta(wb, rows, { user: 'rina', roles: ['kasir'] }, 'rina (kasir):');

// rina mencoba mengubah stok: ditolak, karena dia hanya boleh membaca
wb.on('reject', (e) => console.log('ditolak:', e.reason));
wb.setValues('Produk', 'G2', 999, { source: 'user' });
console.log('G2 tetap:', wb.value('Produk', 'G2'));

// tamu tidak punya satu baris pun: semuanya kosong
peta(wb, rows, { user: 'tamu' }, 'tamu (tanpa aturan):');
