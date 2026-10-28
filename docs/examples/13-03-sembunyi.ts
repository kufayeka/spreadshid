import type { AccessRow } from '@kufayeka/sheet/core';
import { buatStok, peta } from './data/stok-akses.js';

// Langkah 3: deny. Harga beli (E) tampil •••, Harga jual (F) tidak terlihat sama sekali. Deny selalu menang atas allow di tingkat yang sama.
const rows: AccessRow[] = [
    { who: 'role:kasir', effect: 'allow', action: 'edit', where: 'Produk!A1:I13' },
    { who: 'role:kasir', effect: 'deny', action: 'read', where: 'Produk!col:Harga beli' },   // ••• : orang tahu ada isinya
    { who: 'role:kasir', effect: 'deny', action: 'see', where: 'Produk!col:Harga jual' }     // kosong : tidak ada tanda apa pun
];

const wb = buatStok();
peta(wb, rows, { user: 'rina', roles: ['kasir'] }, 'rina (kasir):');
console.log('E2 terlihat sebagai:', JSON.stringify(wb.display('Produk', 'E2').text), '| F2 terlihat sebagai:', JSON.stringify(wb.display('Produk', 'F2').text));
