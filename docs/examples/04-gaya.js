import { createWorkbook } from '@kufayeka/sheet/core';

// Kepala invoice: merge, gaya yang digabung, menghapus satu bagian gaya, gaya per sel lewat fungsi.
const wb = createWorkbook();
const inv = wb.sheet('Sheet1');
inv.setValues('A1', [['TB Sinar Jaya'], ['Jl. Raya Bogor 12, Jakarta Timur'], [], ['Kode', 'Barang', 'Qty', 'Harga', 'Total']]);

inv.mergeCells('A1:E1, A2:E2');                         // dua merge sekaligus
inv.setStyle('A1', { bold: true, fontSize: 16, align: 'center', color: '#1a73e8' });
inv.setStyle('A2', { italic: true, align: 'center', color: '#5f6368' });
inv.setStyle('A4:E4', { bold: true, fill: '#e8f0fe', align: 'center' });
inv.setStyle('A4:E4', { underline: true });              // digabung: yang tadi tetap
console.log('A4                 :', JSON.stringify(inv.style('A4')));

inv.setStyle('A4:E4', { underline: null });              // null menghapus satu bagian
console.log('A4 tanpa underline :', JSON.stringify(inv.style('A4')));

// border luar saja: tiap sel dapat sisi yang ada di pinggir kotak
const garis = { style: 'solid', width: 2, color: '#1a73e8' };
inv.setStyle('A4:E8', (r, c) => ({ borders: {
    ...(r === 3 ? { top: garis } : {}), ...(r === 7 ? { bottom: garis } : {}),
    ...(c === 0 ? { left: garis } : {}), ...(c === 4 ? { right: garis } : {})
} }));
console.log('pojok A4           :', JSON.stringify(inv.style('A4').borders));
console.log('tengah C6          :', inv.style('C6') || 'tanpa gaya (fungsi memberi {} untuk sel tengah)');

// border digabung per sisi: garis bawah tipis di judul kolom, garis atas dan kiri A4 tetap ada
inv.setStyle('A4:E4', { borders: { bottom: { style: 'solid', width: 1, color: '#9aa0a6' } } });
console.log('A4 tambah bawah    :', Object.keys(inv.style('A4').borders).join(', '));
inv.setStyle('A4', { borders: { left: null } });          // satu sisi saja yang dibuang
console.log('A4 tanpa kiri      :', Object.keys(inv.style('A4').borders).join(', '));
console.log('merge              :', JSON.stringify(inv.merges()));
inv.unmergeCells('A2');
console.log('setelah unmerge A2 :', JSON.stringify(inv.merges()));
