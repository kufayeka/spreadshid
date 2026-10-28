import { createWorkbook, viewFor, checkPatch, validateAccess } from '@kufayeka/sheet/core';
import type { AccessRow } from '@kufayeka/sheet/core';
import { buatStok } from './data/stok-akses.js';

// Langkah 9: di server. Browser bisa diakali, jadi server memakai baris aturan YANG SAMA:
//   viewFor    = isi workbook yang boleh dikirim ke orang ini (yang tersembunyi tidak ikut terkirim)
//   checkPatch = perubahan yang dikirim orang ini, diperiksa sebelum disimpan
const rows: AccessRow[] = [
    { who: 'role:kasir', effect: 'allow', action: 'read', where: 'Produk!A1:I13' },
    { who: 'role:kasir', effect: 'allow', action: 'edit', where: 'Produk!col:Stok' },
    { who: 'role:kasir', effect: 'deny', action: 'read', where: 'Produk!col:Harga beli' }
];
const rina = { user: 'rina', roles: ['kasir'] };

// 0. sebelum disimpan ke tabel: aturannya benar?
console.log('aturan benar?', validateAccess(rows).length === 0);
console.log('aturan salah :', JSON.stringify(validateAccess([{ who: 'kasir', effect: 'allow', action: 'format.blod' }])));

// 1. GET: yang dikirim ke rina. Harga beli Semen (64000) tidak ikut
const doc = buatStok().toJSON();
const dikirim = JSON.stringify(viewFor(doc, { access: rows, who: rina }));
console.log('harga beli ikut terkirim?', dikirim.includes('64000'), '| nama produk ikut?', dikirim.includes('Semen Portland'));

// 2. PUT: perubahan dari browser rina, diperiksa lagi
const browser = createWorkbook(doc);
browser.sheet('Produk').setValues('G2', 400);          // stok: boleh
console.log('ubah stok   :', checkPatch(doc, browser.pendingPatch(), { access: rows, who: rina }).ok ? 'diterima' : 'ditolak');
browser.sheet('Produk').setValues('B2', 'Semen murah'); // nama produk: tidak boleh (browser yang diakali bisa mengirimnya)
const hasil = checkPatch(doc, browser.pendingPatch(), { access: rows, who: rina });
console.log('ubah nama   :', hasil.ok ? 'diterima' : 'ditolak', '|', hasil.problems.map((p) => p.address + ': ' + p.reason).join(', '));
