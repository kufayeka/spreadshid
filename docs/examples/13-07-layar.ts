import type { AccessRow } from '@kufayeka/sheet/core';
import { buatStok } from './data/stok-akses.js';

// Langkah 7: tampilan. Bagian layar (ui.*) selalu tampil kecuali di-deny. view.area = hanya range ini yang tampil, view.sheet = hanya sheet ini.
// Ingat: ini soal TAMPILAN. Yang menjaga data tetap read / edit / format di atas (dan dicek lagi di server).
const rows: AccessRow[] = [
    { who: 'role:kasir', effect: 'allow', action: 'read', where: 'Produk!A1:I13' },
    { who: 'role:kasir', effect: 'deny', action: 'ui.toolbar' },
    { who: 'role:kasir', effect: 'deny', action: 'ui.menu.Insert' },       // satu menu
    { who: 'role:kasir', effect: 'deny', action: 'ui.tool.paint' },        // satu tombol
    { who: 'role:kasir', effect: 'deny', action: 'ui.disallowed' },        // yang tidak boleh: disembunyikan, bukan digelapkan
    { who: 'role:kasir', effect: 'allow', action: 'view.area', where: 'Produk!A1:G13' },
    { who: 'role:kasir', effect: 'allow', action: 'view.sheet', where: 'Produk' }
];

const wb = buatStok();
wb.setAccess(rows, { user: 'rina', roles: ['kasir'] });
const ui = wb.access().ui;
console.log('menubar', ui.menubar, '| toolbar', ui.toolbar, '| formulaBar', ui.formulaBar, '| tabs', ui.tabs);
console.log('disembunyikan:', ui.hide.join(', '), '| yang tidak boleh:', ui.disallowed);
console.log('area:', JSON.stringify(ui.area), '| sheet:', JSON.stringify(ui.sheets));
console.log('menu Insert tampil?', wb.shows('menu.Insert'), '| menu Format tampil?', wb.shows('menu.Format'));
