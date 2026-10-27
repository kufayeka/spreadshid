import { buatProyek } from './proyek/index.js';

// Satu angka diubah di sheet Harga; semua yang bergantung padanya, di sheet mana pun, ikut berubah.
const wb = buatProyek();
const d = (sheet, at) => wb.display(sheet, at).text;
const lihat = (keterangan) => console.log(keterangan.padEnd(22), '| HSP beton', d('RAB', 'F10').padEnd(13), '| RAB', d('RAB', 'G17').padEnd(16),
    '| bobot bab beton', d('RAB', 'H9').padEnd(7), '| tagihan termin', d('Termin 2', 'D12').padEnd(16), '| kontrak + CCO', d('CCO', 'E12'));

lihat('awal');
const t0 = performance.now();
wb.setValues('Harga', 'D15', 1250000); // beton ready mix K-300 naik dari 1.150.000 ke 1.250.000 per m3
const ms = performance.now() - t0;
lihat('ready mix naik 100rb');
wb.undo();
lihat('undo');
console.log('hitung ulang semua sheet:', ms < 50 ? 'kurang dari 50 ms' : 'lebih dari 50 ms');
