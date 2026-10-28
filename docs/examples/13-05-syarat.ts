import type { AccessRow } from '@kufayeka/sheet/core';
import { buatStok, peta } from './data/stok-akses.js';

// Langkah 5: aturan dengan syarat (when). Stok boleh diubah, KECUALI di baris produk yang sudah dihentikan.
// Syaratnya rumus biasa, ditulis untuk baris pertama range (baris 2), lalu ikut bergeser ke setiap baris. Dihitung ulang setiap isi sel berubah.
const rows: AccessRow[] = [
    { who: 'role:gudang', effect: 'allow', action: 'read', where: 'Produk!A1:I13' },
    { who: 'role:gudang', effect: 'allow', action: 'edit', where: 'Produk!G2:G13' },
    { who: 'role:gudang', effect: 'deny', action: 'edit', where: 'Produk!G2:G13', when: '=$I2="Dihentikan"', message: 'Produk ini sudah dihentikan' }
];

const wb = buatStok();
wb.on('reject', (e) => console.log('ditolak:', e.reason));
const joko = { user: 'joko', roles: ['gudang'] };
peta(wb, rows, joko, 'joko (gudang), baris 9 = Keramik 40x40 yang Dihentikan:');
console.log('G9:', wb.modeAt('Produk', 'G9')?.mode, '| G2:', wb.modeAt('Produk', 'G2')?.mode ?? 'edit');
wb.setValues('Produk', 'G9', 10, { source: 'user' });

// pemilik mengaktifkan lagi produknya: syaratnya langsung tidak berlaku, joko boleh mengubah stoknya
wb.setValues('Produk', 'I9', 'Aktif');
console.log('setelah I9 = Aktif, G9:', wb.modeAt('Produk', 'G9')?.mode ?? 'edit');
