import { createWorkbook } from '@kufayeka/sheet/core';

// Rumus yang sering dipakai di RAB, jadwal, dan pembayaran proyek.
const wb = createWorkbook(null, { now: () => new Date(2026, 9, 27) });
wb.setSettings({ locale: 'id-ID', currency: 'IDR' });

// ---- AHSP: harga satuan = jumlah (koefisien x harga dasar)
const ahsp = wb.sheet('Sheet1');
ahsp.setSheetProps({ name: 'AHSP' });
ahsp.setValues('A1', [
    ['1 m3 beton K-225', 'Koefisien', 'Satuan', 'Harga dasar'],
    ['Semen 50 kg', 7.4, 'zak', 72000],
    ['Pasir beton', 0.499, 'm3', 290000],
    ['Kerikil', 0.776, 'm3', 310000],
    ['Pekerja', 1.65, 'OH', 120000],
    ['Tukang batu', 0.275, 'OH', 150000],
    ['Harga satuan', '=SUMPRODUCT(B2:B6, D2:D6)'],
    ['Dibulatkan ke 1.000', '=MROUND(B7, 1000)'],
    ['Bahan saja', '=SUMPRODUCT((C2:C6<>"OH")*B2:B6*D2:D6)']
]);
console.log('harga satuan   :', ahsp.value('B7'), '-> dibulatkan', ahsp.value('B8'), '| bahan saja', ahsp.value('B9'));

// ---- jadwal: hari kerja (tanpa Sabtu, Minggu, dan tanggal merah)
const jadwal = wb.sheet(wb.addSheet('Jadwal'));
jadwal.setValues('A1', [
    ['Libur', '=DATE(2026,10,28)'],
    ['Mulai', '=DATE(2026,10,1)', 'Durasi (hari kerja)', 20],
    ['Selesai', '=WORKDAY(B2, D2 - 1, B1)'],
    ['Hari kerja Oktober', '=NETWORKDAYS(DATE(2026,10,1), EOMONTH(B2, 0), B1)'],
    ['Akhir bulan termin', '=EOMONTH(B2, 1)'],
    ['Minggu ke (ISO)', '=ISOWEEKNUM(TODAY())'],
    ['Sisa hari kalender', '=DAYS(B3, TODAY())']
]);
jadwal.setColProps('B', { format: { type: 'date', pattern: 'dddd, d MMM yyyy' } });
jadwal.setStyle('B4, B6:B7', { format: { type: 'number', decimals: 0 } });
for (let r = 3; r <= 7; r++) console.log(String(jadwal.value('A' + r)).padEnd(19), ':', jadwal.display('B' + r).text);

// ---- kwitansi termin: nominal dan terbilang
const kw = wb.sheet(wb.addSheet('Kwitansi'));
kw.setValues('A1', [
    ['Nilai kontrak', 1250000000],
    ['Progres termin 2', 0.35],
    ['Dibayar', '=ROUND(B1*B2, 0)'],
    ['Terbilang', '=PROPER(TERBILANG(B3)) & " Rupiah"']
]);
console.log('dibayar        :', kw.value('B3'));
console.log('terbilang      :', kw.value('B4'));

// ---- pembiayaan: cicilan alat berat dan kelayakan proyek
const uang = wb.sheet(wb.addSheet('Keuangan'));
uang.setValues('A1', [
    ['Harga excavator', 1500000000], ['Bunga per bulan', 0.009], ['Tenor (bulan)', 36], ['Cicilan', '=PMT(B2, B3, -B1)'],
    ['Arus kas proyek', -500000000], [null, 180000000], [null, 220000000], [null, 260000000],
    ['IRR', '=IRR(B5:B8)'], ['NPV 10%', '=NPV(10%, B6:B8) + B5']
]);
console.log('cicilan/bulan  :', Math.round(uang.value('B4')), '| IRR', (uang.value('B9') * 100).toFixed(2) + '%', '| NPV', Math.round(uang.value('B10')));

// ---- rekap dinamis: OFFSET dan INDIRECT
uang.setValues('D1', [['Bulan ke', 3], ['Arus kas bulan itu', '=OFFSET(B5, E1 - 1, 0)'], ['Dari sheet lain', '=INDIRECT("AHSP!B7")']]);
console.log('OFFSET         :', uang.value('E2'), '| INDIRECT', uang.value('E3'));
