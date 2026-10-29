import type { AccessRow } from '@kufayeka/sheet/core';
import { buatStok, peta } from './data/stok-akses.js';

// Langkah 13: role. Aturan role:kasir berlaku untuk setiap orang yang punya role kasir. Ditambah satu role lagi: gudang.
const rows: AccessRow[] = [
    { who: 'role:kasir', effect: 'allow', action: 'read', where: 'Produk!A1:I13' },
    { who: 'role:gudang', effect: 'allow', action: 'read', where: 'Produk!A1:I13' },        // baru
    { who: 'role:gudang', effect: 'allow', action: 'edit', where: 'Produk!col:Stok' }       // baru
];

const wb = buatStok();
peta(wb, rows, { user: 'rina', roles: ['kasir'] }, 'rina (kasir):');
peta(wb, rows, { user: 'dewi', roles: ['kasir'] }, 'dewi (kasir juga): sama dengan rina');
peta(wb, rows, { user: 'joko', roles: ['gudang'] }, 'joko (gudang):');
peta(wb, rows, { user: 'sari', roles: ['kasir', 'gudang'] }, 'sari (kasir DAN gudang): gabungan keduanya');
