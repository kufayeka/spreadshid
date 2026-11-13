import { createWorkbook, populate, tableOf } from '@kufayeka/sheet/core';

// Pola 1: Template (styling + pre-rumus) diisi data dari API via populate()
const template = createWorkbook();
template.setSettings({ locale: 'id-ID', currency: 'IDR' });
const sh = template.sheet('Sheet1');
sh.setSheetProps({ name: 'Order' });
sh.setValues('A1', [['Kode', 'Barang', 'Qty', 'Harga', 'Subtotal']]);
sh.setStyle('A1:E1', { bold: true, fill: '#1a73e8', color: '#ffffff' });
// Pre-rumus di baris 2..4 dan baris total di baris 6
sh.setValues('E2', [['=C2*D2'], ['=C3*D3'], ['=C4*D4']]);
sh.setValues('D6', [['Total', '=SUM(E2:E4)']]);
sh.setStyle('D6:E6', { bold: true, fill: '#f1f3f4' });
sh.setStyle('D2:E6', { format: { type: 'money', decimals: 0 } });
template.addName('ItemsOrder', 'Order', 'A1:E4');

// Simulasi payload REST API dari backend: ditulis hanya ke kolom A:D tanpa menimpa rumus di kolom E
const apiItems = [
    { Kode: 'SMN-01', Barang: 'Semen 50kg', Qty: 10, Harga: 72000 },
    { Kode: 'BSI-10', Barang: 'Besi 10mm', Qty: 5, Harga: 79500 },
    { Kode: 'CAT-05', Barang: 'Cat 5kg', Qty: 2, Harga: 145000 },
];
populate(template, 'Order', { at: 'A2', fields: ['Kode', 'Barang', 'Qty', 'Harga'], header: false }, apiItems);
console.log('Total Order setelah populate:', template.value('Order', 'E6'));
console.log('Isi tabel (tableOf):', JSON.stringify(tableOf(template, null, 'ItemsOrder').records));

// Pola 2: One-to-Many (1 Master Harga disebar ke banyak workbook cabang)
const master = createWorkbook();
master.sheet('Sheet1').setSheetProps({ name: 'Katalog' });
master.sheet('Katalog').setValues('A1', [
    ['Kode', 'Harga'],
    ['SMN-01', 75000],
    ['BSI-10', 82000],
]);
master.addName('HargaResmi', 'Katalog', 'A1:B3');

const katalogRecords = tableOf(master, null, 'HargaResmi').records;
const cabangA = createWorkbook();
cabangA.sheet('Sheet1').setSheetProps({ name: 'ReferensiHarga' });
populate(cabangA, 'ReferensiHarga', { at: 'A1', header: true }, katalogRecords);
console.log('Cabang A menerima SMN-01:', cabangA.value('ReferensiHarga', 'B2'));
