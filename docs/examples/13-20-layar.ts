import type { AccessRow } from '@kufayeka/sheet/core';
import { buatStok } from './data/stok-akses.js';

// Langkah 20: bagian layar. Tampil kecuali di-deny.
const rows: AccessRow[] = [
    { who: 'role:kasir', effect: 'allow', action: 'read', where: 'Produk!A1:I13' },
    { who: 'role:kasir', effect: 'deny', action: 'ui.toolbar' },        // baru: satu bagian besar
    { who: 'role:kasir', effect: 'deny', action: 'ui.menu.Insert' }     // baru: satu menu
];

const wb = buatStok();
wb.setAccess(rows, { user: 'rina', roles: ['kasir'] });
const ui = wb.access().ui;
console.log('menubar:', ui.menubar, '| toolbar:', ui.toolbar, '| formula bar:', ui.formulaBar);
console.log('menu Insert tampil?', wb.shows('menu.Insert'), '| menu Format tampil?', wb.shows('menu.Format'));
