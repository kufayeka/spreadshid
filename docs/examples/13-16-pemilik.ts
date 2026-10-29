import type { AccessRow } from '@kufayeka/sheet/core';
import { buatStok, peta } from './data/stok-akses.js';

// Langkah 16: pemilik. Satu baris: user:<nama> allow * tanpa where.
const rows: AccessRow[] = [
    { who: 'user:yeka', effect: 'allow', action: '*' },                                    // baru
    { who: 'role:kasir', effect: 'allow', action: 'read', where: 'Produk!A1:I13' },
    { who: '*', effect: 'deny', action: 'edit', where: 'Produk!col:Harga beli' }
];

const wb = buatStok();
peta(wb, rows, { user: 'yeka', roles: ['kasir'] }, 'yeka (pemilik, juga kasir):');
console.log('pemilik?', wb.access().owner, '| boleh mengubah aturan?', wb.can('access'));

// satu baris deny untuk akun pemilik sendiri mencabut status pemiliknya
wb.setAccess([...rows, { who: 'user:yeka', effect: 'deny', action: 'download' }], { user: 'yeka' });
console.log('dengan deny untuk yeka -> pemilik?', wb.access().owner);
