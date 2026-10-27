import { createWorkbook } from '@kufayeka/sheet/core';
import { penjualan, KOLOM_PENJUALAN, barisPenjualan, CABANG } from './data/toko.js';

// Laporan bulanan dari 300 transaksi: ringkasan per cabang, per kategori, dan per minggu, hanya dengan rumus.
const wb = createWorkbook();
wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
const jual = wb.sheet('Sheet1');
jual.setSheetProps({ name: 'Penjualan' });
jual.setValues('A1', [KOLOM_PENJUALAN]);
jual.setValues('A2', barisPenjualan(penjualan(300), 2));      // A2:K301, kolom K = Qty x Harga x (1 - Diskon)

const lap = wb.sheet(wb.addSheet('Laporan'));
// ---- per cabang: omzet, transaksi, rata-rata, transaksi terbesar, pangsa, peringkat
lap.setValues('A1', [['Cabang', 'Omzet', 'Transaksi', 'Rata-rata', 'Terbesar', 'Pangsa', 'Peringkat', 'Nilai']]);
lap.setValues('A2', CABANG.map((c, i) => {
    const r = i + 2;
    return [c,
        `=SUMIFS(Penjualan!$K$2:$K$301, Penjualan!$C$2:$C$301, A${r})`,
        `=COUNTIFS(Penjualan!$C$2:$C$301, A${r})`,
        `=ROUND(AVERAGEIFS(Penjualan!$K$2:$K$301, Penjualan!$C$2:$C$301, A${r}), 0)`,
        `=MAXIFS(Penjualan!$K$2:$K$301, Penjualan!$C$2:$C$301, A${r})`,
        `=B${r}/SUM($B$2:$B$4)`,
        `=RANK(B${r}, $B$2:$B$4)`,
        `=IFS(F${r}>=0.4, "A", F${r}>=0.25, "B", TRUE, "C")`];
}));
lap.setValues('A5', [['Total', '=SUM(B2:B4)', '=SUM(C2:C4)', '=ROUND(B5/C5, 0)', '=MAX(E2:E4)', '=SUM(F2:F4)']]);
for (let r = 2; r <= 5; r++) {
    const v = (c) => lap.value(c + r);
    console.log(String(v('A')).padEnd(9), 'omzet', String(v('B')).padStart(9), '| trx', v('C'), '| rata2', v('D'), '| max', v('E'),
        '| pangsa', (v('F') * 100).toFixed(1) + '%', r < 5 ? '| #' + v('G') + ' ' + v('H') : '');
}

// ---- jawaban satu sel: INDEX + MATCH, XLOOKUP + LARGE, teks yang digabung
lap.setValues('A7', [
    ['Cabang terbaik', '=INDEX(A2:A4, MATCH(MAX(B2:B4), B2:B4, 0))'],
    ['Omzet kedua', '=XLOOKUP(LARGE(B2:B4, 2), B2:B4, A2:A4)'],
    ['Diskon diberikan', '=COUNTIF(Penjualan!J2:J301, ">0") & " transaksi"'],
    ['Qty terbanyak', '=MAX(Penjualan!H2:H301) & " x " & INDEX(Penjualan!F2:F301, MATCH(MAX(Penjualan!H2:H301), Penjualan!H2:H301, 0))'],
    ['Semua cabang', '=TEXTJOIN(", ", TRUE, A2:A4)']
]);
for (let r = 7; r <= 11; r++) console.log(String(lap.value('A' + r)).padEnd(17), ':', lap.value('B' + r).code || lap.value('B' + r));

// ---- per minggu: tanggal dihitung dari nomor hari, WEEKDAY dan selisih tanggal
lap.setValues('D7', [['Minggu', 'Dari', 'Sampai', 'Omzet']]);
lap.setValues('D8', [1, 2, 3, 4, 5].map((w, i) => [w, `=DATE(2026, 10, 1) + ${i * 7}`, `=MIN(E${i + 8} + 6, DATE(2026, 10, 31))`,
    `=SUMIFS(Penjualan!$K$2:$K$301, Penjualan!$B$2:$B$301, ">=" & E${i + 8}, Penjualan!$B$2:$B$301, "<=" & F${i + 8})`]));
lap.setColProps('E:F', { format: { type: 'date' } });
lap.setValues('D13', [['Cek', '=SUM(G8:G12)=B5', 'Hari pertama', '=WEEKDAY(E8, 2)']]);
for (let r = 8; r <= 12; r++) console.log('minggu', lap.value('D' + r), lap.display('E' + r).text, '-', lap.display('F' + r).text, ':', lap.value('G' + r));
console.log('jumlah 5 minggu = total omzet:', lap.value('E13'), '| 1 Oktober 2026 hari ke', lap.value('G13'), '(Senin = 1, jadi Kamis)');
