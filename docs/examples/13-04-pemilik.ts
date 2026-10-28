import type { AccessRow } from '@kufayeka/sheet/core';
import { buatStok } from './data/stok-akses.js';

// Pemilik = satu baris "user:<nama> allow *". Baris untuk role dan untuk semua orang tidak bisa mengalahkannya, karena baris akun paling spesifik.
const rows: AccessRow[] = [
    { who: 'user:yeka', effect: 'allow', action: '*' },                                       // pemilik
    { who: '*', effect: 'deny', action: 'edit', where: 'Produk!col:Harga beli' },             // semua orang: harga beli dikunci
    { who: 'role:kasir', effect: 'deny', action: 'ui.toolbar' }                               // kasir: tanpa toolbar
];

const wb = buatStok();
const yeka = { user: 'yeka', roles: ['kasir'] };    // yeka juga kasir

wb.setAccess(rows, yeka);
console.log('pemilik?', wb.access().owner, '| E2:', wb.modeAt('Produk', 'E2')?.mode ?? 'edit', '| toolbar:', wb.access().ui.toolbar, '| boleh mengubah aturan:', wb.can('access'));

// HATI-HATI: satu baris deny untuk akun pemilik sendiri mencabut status pemiliknya
wb.setAccess([...rows, { who: 'user:yeka', effect: 'deny', action: 'download' }], yeka);
console.log('dengan deny untuk yeka -> pemilik?', wb.access().owner, '| E2:', wb.modeAt('Produk', 'E2')?.mode ?? 'edit', '| download:', wb.can('download'));

// HATI-HATI: tanpa baris pemilik, yeka hanya orang biasa (di sini tidak dapat apa-apa)
wb.setAccess(rows.slice(1), yeka);
console.log('tanpa baris pemilik -> pemilik?', wb.access().owner, '| E2:', wb.modeAt('Produk', 'E2')?.mode);
