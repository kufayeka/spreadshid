import { exportCsv, exportXlsx, importXlsx } from '@kufayeka/sheet/core';
import type { AccessRow } from '@kufayeka/sheet/core';
import { buatStok } from './data/stok-akses.js';

// 13.37 Isi file yang diunduh budi (viewer). Harga beli tidak boleh ia baca, kolom Status tidak boleh ia lihat sama sekali, dan kolom Margin
// adalah rumus yang membaca harga beli.
const wb = buatStok();
const p = wb.sheet('Produk');
p.setValues('J1', 'Margin');
p.setValues('J2', '=F2-E2');
p.setValues('J3', '=F3-E3');

const rows: AccessRow[] = [
    { who: '*', effect: 'allow', action: '*' },
    { who: 'role:viewer', effect: 'deny', action: 'read', where: 'Produk!col:Harga beli' },
    { who: 'role:viewer', effect: 'deny', action: 'see', where: 'Produk!col:Status' }
];
wb.setAccess(rows, { user: 'budi', roles: ['viewer'] });

// CSV: tiga baris pertama
console.log(exportCsv(wb, 'Produk').split('\r\n').slice(0, 3).join('\n'));

// Excel: file dibuka lagi untuk melihat isinya
const { workbook: file } = await importXlsx(exportXlsx(wb));
console.log('');
console.log('Harga beli E2 di file :', file.value('Produk', 'E2'));
console.log('Status I2 di file     :', file.value('Produk', 'I2'));
console.log('Margin J2 di file     :', file.value('Produk', 'J2'), '| isinya rumus?', String(file.input('Produk', 'J2')).startsWith('='));

// tanda lain, atau kosong
console.log('');
console.log('mask "***":', exportCsv(wb, 'Produk', { mask: '***' }).split('\r\n')[1]);
console.log('mask ""   :', exportCsv(wb, 'Produk', { mask: '' }).split('\r\n')[1]);
