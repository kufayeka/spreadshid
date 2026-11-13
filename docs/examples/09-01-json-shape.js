import { createWorkbook } from '@kufayeka/sheet/core';

// Membedah bentuk JSON mentah dari wb.toJSON() dan wb.pendingPatch()
const wb = createWorkbook();
wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
const sh = wb.sheet('Sheet1');
sh.setSheetProps({ name: 'Order' });
sh.setValues('A1', [
    ['Item', 'Qty', 'Harga', 'Total'],
    ['Semen', 10, 72000, '=B2*C2'],
]);
sh.setStyle('A1:D1', { bold: true, fill: '#eef2f7' });

// 1. Struktur wb.toJSON() (ID diganti pendek agar mudah dibaca)
const doc = wb.toJSON();
const shortMap = new Map();
const sid = (id, p) => { if (!shortMap.has(id)) shortMap.set(id, p + (shortMap.size + 1)); return shortMap.get(id); };
const maskId = (obj) => JSON.parse(JSON.stringify(obj).replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, (m) => sid(m, 'id_')));

console.log('=== 1. STRUKTUR wb.toJSON() ===');
console.log(JSON.stringify(maskId(doc), null, 2));

// 2. Tandai tersimpan, lalu ubah satu sel dan lihat bentuk wb.pendingPatch()
wb.saved();
sh.setValues('B2', 15, { source: 'user' });
const patch = wb.pendingPatch();
console.log('\n=== 2. STRUKTUR wb.pendingPatch() ===');
console.log(JSON.stringify(maskId(patch), null, 2));
