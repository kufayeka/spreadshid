import type { AccessRow } from '@kufayeka/sheet/core';
import { buatStok } from './data/stok-akses.js';

// Langkah 21: hanya sebagian sheet yang tampil (view.area), dan hanya sheet tertentu (view.sheet).
const rows: AccessRow[] = [
    { who: 'role:kasir', effect: 'allow', action: 'read', where: 'Produk!A1:I13' },
    { who: 'role:kasir', effect: 'allow', action: 'view.area', where: 'Produk!A1:D13' },  // baru
    { who: 'role:kasir', effect: 'allow', action: 'view.sheet', where: 'Produk' }         // baru
];

const wb = buatStok();
wb.addSheet('Rekap');
wb.setAccess(rows, { user: 'rina', roles: ['kasir'] });
console.log('area yang tampil :', JSON.stringify(wb.access().ui.area));
console.log('sheet yang tampil:', JSON.stringify(wb.access().ui.sheets), '| Rekap tampil?', wb.sheetShown('Rekap'));
