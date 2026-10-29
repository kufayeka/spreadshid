import type { AccessRow } from '@kufayeka/sheet/core';
import { buatStok } from './data/stok-akses.js';

// Langkah 18: format. Kasir boleh memiringkan teks, tapi tidak boleh menebalkan.
const rows: AccessRow[] = [
    { who: 'role:kasir', effect: 'allow', action: 'edit', where: 'Produk!A1:I13' },
    { who: 'role:kasir', effect: 'allow', action: 'format.italic' }                        // baru: tanpa where = di mana saja
];

const wb = buatStok();
wb.setAccess(rows, { user: 'rina', roles: ['kasir'] });
console.log('boleh miring?', wb.can('format.italic'), '| boleh tebal?', wb.can('format.bold'));

wb.on('reject', (e) => console.log('ditolak:', e.reason));
const p = wb.sheet('Produk');
p.setStyle('B2', { italic: true }, { source: 'user' });
p.setStyle('B2', { bold: true }, { source: 'user' });
console.log('gaya B2:', JSON.stringify(p.style('B2')));
