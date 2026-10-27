import { createWorkbook, populate, dateToSerial } from '@kufayeka/sheet/core';

// Laporan pesanan harian: templatenya dibuat sekali (judul, gaya, rumus total), datanya diisi dari API setiap kali halaman dibuka.
const wb = createWorkbook();
wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
const lap = wb.sheet('Sheet1');
lap.setSheetProps({ name: 'Pesanan hari ini' });
lap.setValues('A1', 'Pesanan masuk, Jakarta');
lap.setStyle('A1', { bold: true, fontSize: 14 });
lap.setColProps('B', { format: { type: 'date' } });
lap.setColProps('E:F', { format: { type: 'money', decimals: 0 } });

// ---- yang dikembalikan API pesanan (JSON apa adanya)
const dariApi = [
    { id: 'PO-2611', tanggal: '2026-10-27', pelanggan: 'CV Bangun Karya', qty: 40, harga: 72000, catatan: 'Kirim pagi' },
    { id: 'PO-2612', tanggal: '2026-10-27', pelanggan: 'Toko Maju', qty: 25, harga: 128000, catatan: '=HYPERLINK("http://contoh.invalid","klik")' },
    { id: 'PO-2613', tanggal: '2026-10-27', pelanggan: 'Pak Darto', qty: 6, harga: 145000, catatan: '007' }
];

// tanggal dari API berupa teks: diubah ke nomor hari supaya jadi tanggal di sheet. Sisanya ditulis apa adanya
const baris = dariApi.map((p) => ({ ...p, tanggal: dateToSerial(new Date(p.tanggal)), jumlah: p.qty * p.harga }));
const area = populate(wb, 'Pesanan hari ini', {
    at: 'A3',
    fields: ['id', 'tanggal', 'pelanggan', 'qty', 'harga', 'jumlah', 'catatan'],
    header: ['No. PO', 'Tanggal', 'Pelanggan', 'Qty', 'Harga', 'Jumlah', 'Catatan']      // judul kolom, urut seperti fields
}, baris);
console.log('ditulis       :', wb.address(area.r1, area.c1) + ':' + wb.address(area.r2, area.c2));
for (let r = area.r1; r <= area.r2; r++) console.log('  ', [0, 1, 2, 3, 4, 5, 6].map((c) => lap.display(r, c).text).join(' | '));

// data tetap data: teks yang mirip rumus atau angka tidak berubah jadi rumus atau angka
console.log('catatan PO-2612 :', JSON.stringify(lap.value('G5')), '-> tetap teks, bukan rumus');
console.log('catatan PO-2613 :', JSON.stringify(lap.value('G6')), '-> nol di depan tetap ada');

// total di bawah tabel, ditulis dengan setValues (ini rumus milik template, bukan data)
const akhir = area.r2 + 1;                                 // nomor layar baris terakhir data
lap.setValues(`E${akhir + 1}`, [['Total', `=SUM(F4:F${akhir})`]]);
console.log('total         :', lap.display(`F${akhir + 1}`).text);

// ---- refresh: API sekarang mengembalikan 2 pesanan. Area lama dikosongkan dulu, lalu diisi lagi
lap.clear(`A3:G${akhir + 1}`);
const baru = populate(wb, 'Pesanan hari ini', { at: 'A3', header: { id: 'No. PO' }, fields: ['id', 'pelanggan', 'qty'] }, dariApi.slice(0, 2));
console.log('judul         :', ['A3', 'B3', 'C3'].map((a) => lap.value(a)).join(', '), '(field tanpa judul memakai namanya)');
console.log('setelah refresh:', baru.r2 - baru.r1 + 1, 'baris, sel A6 kini', JSON.stringify(lap.value('A6')));

// ---- bentuk-bentuk lain: daftar ke kanan, blok, cell object dengan gaya, batas baris
populate(wb, 'Pesanan hari ini', { at: 'I3', direction: 'right' }, ['Sen', 'Sel', 'Rab', 'Kam', 'Jum']);
populate(wb, 'Pesanan hari ini', { at: 'I4' }, [[12, 9, 15, 11, 18]]);
populate(wb, 'Pesanan hari ini', { at: 'I6', direction: 'right' }, [{ value: 'Terlambat', fill: '#f4c7c3', bold: true }, { value: 'Tepat', fill: '#b7e1cd' }]);
console.log('ke kanan      :', ['I3', 'J3', 'M3'].map((a) => lap.value(a)).join(', '), '| blok', lap.value('M4'), '| gaya I6', JSON.stringify(lap.style('I6')));
const sedikit = populate(wb, 'Pesanan hari ini', { at: 'I8', limit: 2 }, ['a', 'b', 'c', 'd']);
console.log('limit 2       :', sedikit.r2 - sedikit.r1 + 1, 'baris ditulis');

// satu panggilan = satu perubahan: satu undo membatalkan semuanya
wb.undo();
console.log('undo          :', JSON.stringify(lap.value('I8')));
