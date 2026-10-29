import type { AccessRow } from '@kufayeka/sheet/core';
import { buatStok } from './data/stok-akses.js';

// Langkah 17: aturan dengan syarat. Stok boleh diubah, KECUALI di baris produk yang sudah Dihentikan (kolom I).
const rows: AccessRow[] = [
    { who: 'role:gudang', effect: 'allow', action: 'read', where: 'Produk!A1:I13' },
    { who: 'role:gudang', effect: 'allow', action: 'edit', where: 'Produk!G2:G13' },
    { who: 'role:gudang', effect: 'deny', action: 'edit', where: 'Produk!G2:G13',
      when: '=$I2="Dihentikan"', message: 'Produk ini sudah dihentikan' }                  // baru
];

const wb = buatStok();
wb.setAccess(rows, { user: 'joko', roles: ['gudang'] });
wb.on('reject', (e) => console.log('ditolak:', e.reason));
const NAMA: Record<string, string> = { readonly: 'hanya baca', hidden: 'tersembunyi', invisible: 'tidak terlihat' };
const keadaan = (a: string) => { const m = wb.modeAt('Produk', a); return m ? NAMA[m.mode] : 'boleh diubah'; };
console.log('G2 (Semen, Aktif)        :', keadaan('G2'));
console.log('G9 (Keramik, Dihentikan) :', keadaan('G9'));
wb.setValues('Produk', 'G9', 10, { source: 'user' });

// pemilik mengaktifkan produknya lagi: syaratnya langsung tidak berlaku
wb.setValues('Produk', 'I9', 'Aktif');
console.log('setelah I9 = Aktif, G9   :', keadaan('G9'));
