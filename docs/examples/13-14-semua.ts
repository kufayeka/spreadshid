import type { AccessRow } from '@kufayeka/sheet/core';
import { buatStok, peta } from './data/stok-akses.js';

// Langkah 14: semua orang (*). Siapa pun yang membuka boleh membaca kolom A-D, termasuk yang tidak punya role apa pun.
const rows: AccessRow[] = [
    { who: '*', effect: 'allow', action: 'read', where: 'Produk!A1:D13' },                  // baru
    { who: 'role:kasir', effect: 'allow', action: 'read', where: 'Produk!A1:I13' }
];

const wb = buatStok();
peta(wb, rows, { user: 'tamu' }, 'tamu (tanpa role):');
peta(wb, rows, { user: 'rina', roles: ['kasir'] }, 'rina (kasir):');
