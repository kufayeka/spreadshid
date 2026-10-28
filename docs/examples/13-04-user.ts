import type { AccessRow } from '@kufayeka/sheet/core';
import { buatStok, peta } from './data/stok-akses.js';

// Langkah 4: role dan akun. Aturan untuk satu akun (user:) mengalahkan aturan untuk role, dan role mengalahkan * (semua orang).
const rows: AccessRow[] = [
    { who: '*', effect: 'allow', action: 'read', where: 'Produk!A1:D13' },                   // semua orang: kolom A-D
    { who: 'role:kasir', effect: 'allow', action: 'read', where: 'Produk!A1:I13' },          // kasir: semua kolom
    { who: 'role:kasir', effect: 'deny', action: 'read', where: 'Produk!col:Harga beli' },   // tapi harga beli disembunyikan
    { who: 'user:budi', effect: 'allow', action: 'edit', where: 'Produk!col:Harga beli' },   // budi (kasir senior) boleh mengubahnya
    { who: 'user:yeka', effect: 'allow', action: '*' }                                       // pemilik: semuanya
];

const wb = buatStok();
peta(wb, rows, { user: 'tamu' }, 'tamu (hanya *):');
peta(wb, rows, { user: 'rina', roles: ['kasir'] }, 'rina (kasir):');
peta(wb, rows, { user: 'budi', roles: ['kasir'] }, 'budi (kasir + aturan akunnya):');
peta(wb, rows, { user: 'yeka' }, 'yeka (pemilik):');
console.log('yeka pemilik?', wb.access().owner);
