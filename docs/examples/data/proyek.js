import { createWorkbook } from '@kufayeka/sheet/core';

// Data proyek untuk bab Dashboard: time schedule gudang 10 minggu (bobot, rencana per minggu, kumulatif, realisasi), progres beberapa proyek,
// tagihan termin, dan daftar pekerjaan tambah (PEKTAM). Angkanya contoh, bentuknya seperti laporan proyek sungguhan.

export const PEKERJAAN = [
    ['Pekerjaan persiapan', 45000000, 1, 2],
    ['Galian dan urugan', 120000000, 2, 3],
    ['Pondasi footplat', 310000000, 3, 5],
    ['Struktur kolom dan balok', 520000000, 4, 7],
    ['Pelat lantai', 380000000, 6, 8],
    ['Dinding bata ringan', 260000000, 7, 9],
    ['Atap baja ringan', 190000000, 8, 9],
    ['Finishing dan MEP', 175000000, 9, 10]
];
export const REALISASI = [1.2, 5.1, 13.0, 24.5, 37.0, 49.5];

/**
 * Sheet "Jadwal": A1:N1 judul kolom (No, Pekerjaan, Biaya, Bobot, M1 ... M10), satu baris per pekerjaan dengan bobot dibagi rata ke minggu-minggunya,
 * lalu baris "Bobot mingguan", "Kumulatif rencana", dan "Kumulatif realisasi". Semua angka bobot dan kumulatif adalah rumus.
 */
export function buatJadwal(wb = createWorkbook()) {
    wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
    const s = wb.sheet(wb.sheetIds()[0]);
    s.setSheetProps({ name: 'Jadwal' });
    const minggu = Array.from({ length: 10 }, (_, i) => 'M' + (i + 1));
    s.setValues('A1', [['No', 'Pekerjaan', 'Biaya', 'Bobot', ...minggu]]);
    const n = PEKERJAAN.length, akhir = n + 1;
    PEKERJAAN.forEach(([nama, biaya, dari, sampai], i) => {
        const r = i + 2;
        const baris = [i + 1, nama, biaya, '=C' + r + '/SUM($C$2:$C$' + akhir + ')'];
        // bobot pekerjaan dibagi rata ke minggu-minggu pelaksanaannya
        for (let m = 1; m <= 10; m++) baris.push(m >= dari && m <= sampai ? '=$D' + r + '/' + (sampai - dari + 1) : null);
        s.setValues('A' + r, [baris]);
    });
    const kol = (m) => String.fromCharCode(68 + m); // M1 di kolom E
    const rb = akhir + 1, rk = akhir + 2, rr = akhir + 3;
    s.setValues('B' + rb, [['Bobot mingguan', null, null, ...minggu.map((_, i) => '=SUM(' + kol(i + 1) + '2:' + kol(i + 1) + akhir + ')')]]);
    s.setValues('B' + rk, [['Kumulatif rencana', null, null, ...minggu.map((_, i) => '=SUM($E' + rb + ':' + kol(i + 1) + rb + ')')]]);
    s.setValues('B' + rr, [['Kumulatif realisasi', null, null, ...REALISASI.map((x) => x / 100)]]);
    s.setColProps('A', { width: 40 });
    s.setColProps('B', { width: 190 });
    s.setColProps('C', { width: 120, format: { type: 'money', decimals: 0 } });
    s.setColProps('D', { width: 70, format: { type: 'percent', decimals: 2 } });
    s.setColProps('E:N', { width: 64, format: { type: 'percent', decimals: 1 } });
    s.setStyle('A1:N1', { bold: true, fill: '#eef2f7', align: 'center' });
    s.setStyle('B' + rb + ':N' + rr, { bold: true });
    // bar jadwal: sel minggu yang terisi diberi warna, seperti time schedule di kertas
    s.addConditional('E2:N' + akhir, { op: 'formula', formula: '=E2<>""', style: { fill: '#d0e2ff' } });
    return wb;
}

// progres mingguan per proyek, seperti laporan yang dikirim ke grup: minggu ke berapa, aktual, rencana
export const PROGRES = [
    ['Jababeka', 25, 0.5147, 0.7177], ['Legundi 2', 3, 0.0912, 0.0906], ['Avian Pemalang', 47, 0.99573, 1], ['Avian Muko Muko', 14, 0.1088, 0.13536],
    ['Avian Jakarta', 30, 0.7698, 0.781], ['Sorini New 2', 6, 0.0545, 0.062], ['Padel', 18, 0.643, 0.61]
];
// tagihan termin satu proyek (juta rupiah): bulan, nilai tagihan, progres kumulatif
export const TERMIN = [['Agu', 200, 0], ['Sep', 38, 0.038], ['Okt', 63, 0.101], ['Nov', 259, 0.26], ['Des', 145, 0.405], ['Jan', 117, 0.522], ['Feb', 124, 0.647],
    ['Mar', 154, 0.8], ['Apr', 74, 0.874], ['Mei', 39, 0.913], ['Jun', 75, 0.988], ['Jul', 12, 1]];
// pekerjaan tambah: nama, status, nilai, terbayar (rupiah)
export const PEKTAM = [
    ['Kontrak Utama - Pondasi Mesin', 'Retensi blm nagih', 1000000, 950000], ['Tambahan Kolom WF Area Genset', 'Lunas', 1000000, 1000000],
    ['GWT Panel', 'Lunas', 1000000, 1000000], ['Kabel TM', 'Lunas', 1000000, 1000000], ['Tarikan Kabel FO dan CPU', 'Submit', 1500000, 0],
    ['Ramp Ruang Genset', 'Lunas', 1000000, 1000000], ['Sand Filter dan Carbon Filter', 'Lunas', 1000000, 1000000], ['SPC', 'Cancel', 0, 0],
    ['Kanopi Office', 'Cancel', 0, 0], ['Pekkur Plat Leuvel', 'Submit', 750000, 0], ['Kabel Tray', 'Lunas', 19801689, 19801689],
    ['Kontrak Utama - MEP', 'Retensi blm nagih', 1000000, 950000]
];

/**
 * Workbook dashboard: tiga sheet tabel (Progres, Termin, PEKTAM) sebagai sumber data, lalu sheet Dashboard yang hanya berisi rumus dan chart.
 * Sheet Jadwal (kurva S) ikut di dalamnya.
 */
export function buatDashboard() {
    const wb = buatJadwal();
    const progres = wb.sheet(wb.addSheet('Progres'));
    progres.setValues('A1', [['Proyek', 'Minggu', 'Aktual', 'Rencana', 'Deviasi'], ...PROGRES.map((p, i) => [...p, '=C' + (i + 2) + '-D' + (i + 2)])]);
    progres.setColProps('A', { width: 150 });
    progres.setColProps('C:E', { format: { type: 'percent', decimals: 2 } });
    progres.setStyle('A1:E1', { bold: true, fill: '#eef2f7' });
    // tren 8 minggu terakhir (aktual kumulatif per minggu) untuk sparkline: kolom G sampai N
    progres.setValues('G1', [['M-7', 'M-6', 'M-5', 'M-4', 'M-3', 'M-2', 'M-1', 'M0'],
        ...PROGRES.map(([, , aktual], i) => Array.from({ length: 8 }, (_, k) => Math.round(Math.max(0, aktual * (0.55 + k * 0.0643) + Math.sin(k + i) * 0.006) * 10000) / 10000))]);
    progres.setColProps('G:N', { width: 56, format: { type: 'percent', decimals: 1 } });

    const termin = wb.sheet(wb.addSheet('Termin'));
    termin.setValues('A1', [['Bulan', 'Tagihan (juta)', 'Progres kumulatif'], ...TERMIN]);
    termin.setColProps('C', { format: { type: 'percent', decimals: 1 } });
    termin.setStyle('A1:C1', { bold: true, fill: '#eef2f7' });

    const pektam = wb.sheet(wb.addSheet('PEKTAM'));
    pektam.setValues('A1', [['Pekerjaan', 'Status', 'Nilai', 'Terbayar', 'Outstanding'], ...PEKTAM.map((p, i) => [...p, '=C' + (i + 2) + '-D' + (i + 2)])]);
    pektam.setColProps('A', { width: 220 });
    pektam.setColProps('C:E', { width: 120, format: { type: 'money', decimals: 0 } });
    pektam.setStyle('A1:E1', { bold: true, fill: '#eef2f7' });
    // rekap status untuk donut: dihitung dengan COUNTIF dari tabel, bukan diketik
    pektam.setValues('G1', [['Status', 'Jumlah'], ...['Lunas', 'Retensi blm nagih', 'Submit', 'Cancel'].map((st, i) => [st, '=COUNTIF($B$2:$B$13,G' + (i + 2) + ')'])]);

    const dash = wb.sheet(wb.addSheet('Dashboard'));
    dash.setColProps('A:L', { width: 100 });
    dash.setValues('A1', [['Dashboard Proyek']]);
    dash.setStyle('A1', { bold: true, fontSize: 16 });
    // kartu angka: rumus dari tabel
    dash.setValues('A3', [['Proyek berjalan', null, 'Terlambat > 5%', null, 'Tagihan terbesar', null, 'PEKTAM outstanding'],
        ['=COUNTA(Progres!A2:A8)', null, '=COUNTIF(Progres!E2:E8,"<-0.05")', null, '=MAX(Termin!B2:B13)', null, '=SUM(PEKTAM!E2:E13)/1000000']]);
    dash.setStyle('A3:H3', { color: '#6f6f6f' });
    dash.setStyle('A4:H4', { bold: true, fontSize: 18 });
    dash.setStyle('E4', { format: { type: 'number', decimals: 0, suffix: ' jt' } });
    dash.setStyle('G4', { format: { type: 'number', decimals: 1, suffix: ' jt' } });
    dash.setRowProps('4', { height: 34 });
    // bullet: kategori di kolom A, seri pertama Minggu (disembunyikan), lalu Aktual (bar) dan Rencana (garis target)
    dash.addChart({ at: 'A6:F21', data: 'Progres!A1:D8', type: 'bullet', title: 'Progres per proyek', subtitle: 'aktual (bar) terhadap rencana (garis hitam), warna = deviasi',
        series: [{ hidden: true }] });
    // column + line dengan dua sumbu: tagihan per bulan (kiri) dan progres kumulatif (kanan)
    dash.addChart({ at: 'G6:L21', data: 'Termin!A1:C13', type: 'combo', title: 'Termin Legundi', subtitle: 'tagihan per bulan (juta) dan progres kumulatif',
        smooth: true, series: [{ color: '#1192e8' }, { type: 'line', axis: 'right', color: '#6929c4' }] });
    // donut status PEKTAM dari rekap COUNTIF
    dash.addChart({ at: 'A23:D37', data: 'PEKTAM!G1:H5', type: 'donut', title: 'PEKTAM', subtitle: 'item menurut status', legend: 'right', centerLabel: 'item',
        colors: ['#198038', '#f1c21b', '#1192e8', '#a8a8a8'] });
    // waterfall: dari nilai kontrak ke sisa tagih
    dash.setValues('N1', [['Langkah', 'Juta'], ['Kontrak', 1110], ['Uang muka', -300], ['Termin 1-11', -520], ['Retensi', -55], ['Sisa tagih', null]]);
    dash.addChart({ at: 'E23:L37', data: 'N1:O6', type: 'waterfall', title: 'Dari nilai kontrak ke sisa tagih', subtitle: 'juta rupiah', totals: [0] });
    // tabel ringkas di bawah chart: rumus dari sheet Progres, data bar di kolom Aktual, sparkline tren, dan status berwarna
    dash.setValues('A39', [['Proyek', 'Minggu', 'Aktual', 'Rencana', 'Deviasi', 'Tren 8 minggu', 'Status']]);
    for (let i = 0; i < PROGRES.length; i++) {
        const r = 40 + i, p = i + 2;
        dash.setValues('A' + r, [['=Progres!A' + p, '=Progres!B' + p, '=Progres!C' + p, '=Progres!D' + p, '=Progres!E' + p, null,
            '=IF(E' + r + '<-0.05,"Terlambat",IF(E' + r + '<-0.01,"Waspada","Sesuai"))']]);
    }
    dash.setStyle('A39:G39', { bold: true, fill: '#f4f4f4' });
    dash.setStyle('C40:E46', { format: { type: 'percent', decimals: 2 } });
    dash.setColProps('F', { width: 150 });
    dash.addConditional('C40:C46', { kind: 'bar', color: '#1192e8' });
    dash.addConditional('E40:E46', { op: 'lt', a: -0.05, style: { color: '#da1e28', bold: true } });
    dash.addConditional('E40:E46', { op: 'gte', a: -0.01, style: { color: '#198038', bold: true } });
    dash.addConditional('G40:G46', { op: 'textIs', a: 'Terlambat', style: { color: '#da1e28', fill: '#fff1f1' } });
    dash.addConditional('G40:G46', { op: 'textIs', a: 'Waspada', style: { color: '#8e6a00', fill: '#fcf4d6' } });
    dash.addConditional('G40:G46', { op: 'textIs', a: 'Sesuai', style: { color: '#198038', fill: '#defbe6' } });
    dash.addSparkline({ at: 'F40:F46', data: 'Progres!G2:N8', type: 'line', color: '#6929c4' });
    return wb;
}
