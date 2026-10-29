import { CHART_FIELDS, SPARKLINE_FIELDS, CHART_NODES } from '@kufayeka/sheet/core';

// Semua pengaturan chart dan sparkline, dicetak dari daftar yang sama yang dipakai panel Chart. Tabel ini tidak ditulis tangan:
// kalau ada pengaturan baru di kode, ia muncul di sini dan di panel sekaligus.
const JENIS = { text: 'teks', number: 'angka', range: 'range (⊞ dari grid)', color: 'warna', toggle: 'saklar', segment: 'pilihan', type: 'kartu jenis', colors: 'warna per potongan', totals: 'nomor kategori' };
const nodeOf = (id) => (CHART_NODES.find((n) => n.id === id) || { label: id }).label;
const baris = (f) => '| ' + [
    f.node === 'series' ? 'Series → (satu seri)' : nodeOf(f.node) + (f.group ? ' → ' + f.group : ''),
    f.label,
    '`' + f.key + '`',
    JENIS[f.kind] + (f.options ? ': ' + f.options.map((o) => o[1]).join(', ') : '') + (f.unit ? ' (' + f.unit + ')' : ''),
    f.for ? f.for.join(', ') : 'semua',
    (f.help || '').replace(/\|/g, '/')
].join(' | ') + ' |';

console.log('**Chart** (`addChart`, `setChart`; di panel: node pohon → isian)\n');
console.log('| Node | Isian | Kunci | Jenis isian | Untuk chart | Keterangan |\n|---|---|---|---|---|---|');
for (const f of CHART_FIELDS) console.log(baris(f));
console.log('\n**Sparkline** (`addSparkline`, `setSparkline`; panelnya terbuka saat sel sparkline dipilih)\n');
console.log('| Node | Isian | Kunci | Jenis isian | Untuk | Keterangan |\n|---|---|---|---|---|---|');
for (const f of SPARKLINE_FIELDS) console.log(baris({ ...f, node: 'sparkline' }).replace('| sparkline |', '| Sparklines |'));
