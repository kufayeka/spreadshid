import type { AccessRow } from '@kufayeka/sheet/core';
import { buatStok } from './data/stok-akses.js';

// Langkah 6: aksi selain mengisi sel: format, sort, filter, baris, kolom, sheet, salin, unduh, komentar.
// Satu aksi (format.bold), satu kelompok (format = semua format.*), atau * (semuanya). Tanpa where: berlaku di mana saja.
const rows: AccessRow[] = [
    { who: 'role:kasir', effect: 'allow', action: 'edit', where: 'Produk!A1:I13' },
    { who: 'role:kasir', effect: 'allow', action: 'format' },          // semua format...
    { who: 'role:kasir', effect: 'deny', action: 'format.bold' },      // ...kecuali tebal
    { who: 'role:kasir', effect: 'allow', action: 'sort' },
    { who: 'role:kasir', effect: 'allow', action: 'filter' },
    { who: 'role:kasir', effect: 'allow', action: 'comment.read' }
];

const wb = buatStok();
wb.setAccess(rows, { user: 'rina', roles: ['kasir'] });
for (const a of ['format.italic', 'format.fill', 'format.bold', 'sort', 'filter', 'rows.insert', 'download', 'comment.read', 'comment.create']) {
    console.log(a.padEnd(15), wb.can(a) ? 'boleh' : 'tidak');
}

wb.on('reject', (e) => console.log('ditolak:', e.reason));
const p = wb.sheet('Produk');
p.setStyle('B2', { italic: true }, { source: 'user' });
p.setStyle('B2', { bold: true }, { source: 'user' });
console.log('gaya B2:', JSON.stringify(p.style('B2')));
