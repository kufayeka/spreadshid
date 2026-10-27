// Sheet-sheet lapangan dan administrasi: Laporan Harian (formulir), CCO (register perubahan pekerjaan), Cash Flow, dan NCR (register temuan mutu).

const LINE = { style: 'solid', width: 1, color: '#c0c0c0' };
const kotak = { top: LINE, right: LINE, bottom: LINE, left: LINE };

/** Sheet "Harian 27-10": formulir laporan harian yang diisi mandor. */
export function buatHarian(wb) {
    const sh = wb.sheet(wb.addSheet('Harian 27-10'));
    sh.setValues('A1', [['LAPORAN HARIAN PROYEK'], ['Pembangunan Gedung Kantor A']]);
    sh.mergeCells('A1:F1');
    sh.mergeCells('A2:F2');
    sh.setStyle('A1', { bold: true, fontSize: 14, align: 'center' });
    sh.setStyle('A2', { align: 'center', color: '#5f6368' });
    sh.setValues('A4', [['Tanggal', '27/10/2026', '', 'Hari ke-', '=B4-DATE(2026, 9, 1)+1']]);
    sh.setValues('A5', [['Cuaca pagi', 'Cerah', '', 'Cuaca siang', 'Hujan ringan']]);
    sh.setStyle('B4', { format: { type: 'date', pattern: 'dddd, d MMMM yyyy' } });
    sh.addValidation('B5', { kind: 'list', values: ['Cerah', 'Berawan', 'Hujan ringan', 'Hujan lebat'] });
    sh.addValidation('E5', { kind: 'list', values: ['Cerah', 'Berawan', 'Hujan ringan', 'Hujan lebat'] });

    // tenaga kerja dan alat berdampingan
    sh.setValues('A7', [['Tenaga kerja', 'Orang', '', 'Alat', 'Jam']]);
    sh.setValues('A8', [['Mandor', 2, '', 'Excavator 0,8 m3', 6], ['Tukang besi', 8, '', 'Concrete vibrator', 4], ['Tukang kayu', 6, '', 'Concrete pump', 3], ['Tukang batu', 4], ['Pekerja', 24]]);
    sh.setValues('A13', [['Jumlah', '=SUM(B8:B12)', '', 'Jumlah jam', '=SUM(E8:E12)']]);
    // material masuk
    sh.setValues('A15', [['Material masuk', 'Volume', 'Satuan', 'Pemasok', 'Diterima']]);
    sh.setValues('A16', [['Besi beton D13', 2.4, 'ton', 'PT Baja Prima', true], ['Beton ready mix K-300', 14, 'm3', 'PT Beton Kita', true], ['Bata merah', 6000, 'bh', 'UD Sumber Tanah', false]]);
    sh.addValidation('E16:E18', { kind: 'checkbox' });
    // pekerjaan hari ini dan kendala
    sh.setValues('A20', [['Pekerjaan hari ini'], ['Pengecoran kolom K1-K14 lantai 1 (14 m3), pembesian kolom K15-K28, pemasangan bekisting balok as A-C.'], [''], ['Kendala'], ['Hujan ringan 13.00-14.30, pengecoran ditunda 1,5 jam. Bata merah 6.000 bh ditolak: ukuran tidak seragam.']]);
    sh.mergeCells('A21:F22');
    sh.mergeCells('A24:F25');
    sh.setStyle('A21:F25', { wrap: 'wrap', valign: 'top' });
    // K3
    sh.setValues('A27', [['Pemeriksaan K3', 'OK'], ['APD lengkap', true], ['Rambu terpasang', true], ['Perancah diperiksa', false]]);
    sh.addValidation('B28:B30', { kind: 'checkbox' });

    for (const r of ['A4:A5', 'D4:D5', 'A7:E7', 'A15:E15', 'A20', 'A23', 'A27:B27']) sh.setStyle(r, { bold: true });
    for (const r of ['A7:B13', 'D7:E13', 'A15:E18', 'A27:B30']) sh.setStyle(r, { borders: kotak });
    for (const r of ['A7:E7', 'A15:E15', 'A27:B27']) sh.setStyle(r, { fill: '#e8f0fe' });
    sh.setStyle('A13:E13', { bold: true });
    sh.setColProps('A', { width: 170 });
    sh.setColProps('B', { width: 130 });
    sh.setColProps('C', { width: 50 });
    sh.setColProps('D', { width: 150 });
    sh.setColProps('E', { width: 115 });
    sh.setRowProps('21:22', { height: 26 });
    sh.setRowProps('24:25', { height: 26 });
    // material yang belum diterima kelihatan
    sh.addConditional('A16:E18', { op: 'formula', formula: '=$E16=FALSE', style: { fill: '#fce8e6' } });
    return sh;
}

/** Sheet "CCO": register perubahan pekerjaan (tambah / kurang), dengan nilai yang disetujui. */
export function buatCco(wb) {
    const sh = wb.sheet(wb.addSheet('CCO'));
    sh.setValues('A1', [['No', 'Tanggal', 'Uraian perubahan', 'Jenis', 'Nilai diajukan', 'Status', 'Nilai disetujui']]);
    const data = [
        ['05/09/2026', 'Tambahan sloof S2 akibat perubahan denah', 'Tambah', 38500000, 'Disetujui'],
        ['18/09/2026', 'Penggantian bata merah ke bata ringan lantai 1', 'Kurang', 12750000, 'Disetujui'],
        ['02/10/2026', 'Tambahan dinding penahan tanah sisi timur', 'Tambah', 96400000, 'Diajukan'],
        ['14/10/2026', 'Pekerjaan dewatering basement', 'Tambah', 54200000, 'Ditolak'],
        ['21/10/2026', 'Pengurangan finishing cat lantai basement', 'Kurang', 8300000, 'Diajukan']
    ];
    sh.setValues('A2', data.map((d, i) => [i + 1, ...d, `=IF(F${i + 2}<>"Disetujui", 0, IF(D${i + 2}="Kurang", -E${i + 2}, E${i + 2}))`]));
    const end = data.length + 1;
    sh.setValues(`C${end + 2}`, [
        ['Total tambah disetujui', '', `=SUMIFS(E2:E${end}, D2:D${end}, "Tambah", F2:F${end}, "Disetujui")`],
        ['Total kurang disetujui', '', `=SUMIFS(E2:E${end}, D2:D${end}, "Kurang", F2:F${end}, "Disetujui")`],
        ['Masih diajukan', '', `=SUMIFS(E2:E${end}, F2:F${end}, "Diajukan")`],
        ['Perubahan nilai kontrak', '', `=SUM(G2:G${end})`],
        ['Nilai kontrak setelah CCO', '', '=TotalRAB+E' + (end + 5)]
    ]);
    sh.setStyle('A1:G1', { bold: true, fill: '#1a73e8', color: '#ffffff', align: 'center' });
    sh.setStyle(`B2:B${end}`, { format: { type: 'date', pattern: 'dd MMM yyyy' } });
    sh.setStyle(`E2:G${end + 6}`, { format: { type: 'money', decimals: 0, negative: 'parens' } });
    sh.setStyle(`C${end + 2}:E${end + 6}`, { bold: true });
    sh.setColProps('C', { width: 300 });
    sh.setColProps('E:G', { width: 140 });
    sh.setSheetProps({ freezeRows: 1 });
    sh.addValidation(`D2:D${end}`, { kind: 'list', values: ['Tambah', 'Kurang'] });
    sh.addValidation(`F2:F${end}`, { kind: 'list', values: ['Diajukan', 'Disetujui', 'Ditolak'] });
    sh.addConditional(`F2:F200`, { op: 'textIs', a: 'Disetujui', style: { fill: '#e6f4ea', color: '#137333' } });
    sh.addConditional(`F2:F200`, { op: 'textIs', a: 'Ditolak', style: { fill: '#fce8e6', color: '#a50e0e' } });
    sh.addConditional(`F2:F200`, { op: 'textIs', a: 'Diajukan', style: { fill: '#fef7e0', color: '#b06000' } });
    sh.addConditional(`A2:E200`, { op: 'formula', formula: '=$F2="Ditolak"', style: { strike: true, color: '#80868b' } });
    sh.createFilter(`A1:G${end}`);
    return sh;
}

/** Sheet "Cash Flow": rencana dan realisasi uang masuk dan keluar per bulan, saldo kumulatif. */
export function buatCashFlow(wb) {
    const sh = wb.sheet(wb.addSheet('Cash Flow'));
    const bulan = ['Agu 2026', 'Sep 2026', 'Okt 2026', 'Nov 2026', 'Des 2026', 'Jan 2027'];
    sh.setValues('A1', [['Uraian', ...bulan, 'Total']]);
    const rows = [
        ['Uang muka', 184350800, 0, 0, 0, 0, 0],
        ['Penerimaan termin', 0, 95500000, 0, 210000000, 260000000, 251000000],
        ['Pengeluaran material', -38000000, -152000000, -186000000, -140000000, -98000000, -45000000],
        ['Pengeluaran upah', -21000000, -48000000, -56000000, -52000000, -44000000, -30000000],
        ['Pengeluaran alat', -12000000, -26000000, -18000000, -9000000, -6000000, -3000000],
        ['Overhead lapangan', -9000000, -9000000, -9000000, -9000000, -9000000, -9000000]
    ];
    sh.setValues('A2', rows.map((row, i) => [...row, `=SUM(B${i + 2}:G${i + 2})`]));
    const n = rows.length + 1;
    const arus = ['Arus kas bersih'], saldo = ['Saldo kumulatif'];
    for (let c = 0; c < bulan.length + 1; c++) {
        const L = String.fromCharCode(66 + c);
        arus.push(`=SUM(${L}2:${L}${n})`);
        saldo.push(c === bulan.length ? '' : c ? `=${String.fromCharCode(65 + c)}${n + 2}+${L}${n + 1}` : `=${L}${n + 1}`);
    }
    sh.setValues(`A${n + 1}`, [arus, saldo]);
    sh.setStyle('A1:H1', { bold: true, fill: '#1a73e8', color: '#ffffff', align: 'center' });
    sh.setStyle(`B2:H${n + 2}`, { format: { type: 'money', decimals: 0, negative: 'parens' } });
    sh.setStyle(`A${n + 1}:H${n + 2}`, { bold: true, fill: '#f1f3f4' });
    sh.setStyle(`H1:H${n + 1}`, { bold: true });
    sh.setColProps('A', { width: 170 });
    sh.setColProps('B:H', { width: 125 });
    sh.setSheetProps({ freezeCols: 1, freezeRows: 1 });
    // saldo negatif (perlu dana talangan) merah
    sh.addConditional(`B${n + 1}:G${n + 2}`, { op: 'lt', a: 0, style: { fill: '#fce8e6', color: '#a50e0e' } });
    return sh;
}

/** Sheet "NCR": register ketidaksesuaian mutu, umur temuan yang masih terbuka, tenggat lewat ditandai. */
export function buatNcr(wb) {
    const sh = wb.sheet(wb.addSheet('NCR'));
    sh.setValues('A1', [['No', 'Tanggal', 'Lokasi', 'Temuan', 'PIC', 'Tenggat', 'Status', 'Umur (hari)']]);
    const data = [
        ['02/10/2026', 'Pondasi F12', 'Selimut beton kurang dari 5 cm', 'Andi', '09/10/2026', 'Closed'],
        ['10/10/2026', 'Kolom K7 lt.1', 'Keropos pada sambungan cor', 'Budi', '17/10/2026', 'Open'],
        ['15/10/2026', 'Gudang material', 'Besi D13 berkarat, tidak ditutup terpal', 'Sari', '18/10/2026', 'Open'],
        ['22/10/2026', 'Bekisting balok B3', 'Penyangga tidak tegak lurus', 'Budi', '30/10/2026', 'Open']
    ];
    sh.setValues('A2', data.map((d, i) => [`NCR-${String(i + 1).padStart(3, '0')}`, ...d, `=IF(G${i + 2}="Closed", "", TODAY()-B${i + 2})`]));
    const end = data.length + 1;
    sh.setValues(`D${end + 2}`, [['Masih terbuka', `=COUNTIF(G2:G${end}, "Open")`], ['Lewat tenggat', `=COUNTIFS(G2:G${end}, "Open", F2:F${end}, "<"&TODAY())`]]);
    sh.setStyle('A1:H1', { bold: true, fill: '#1a73e8', color: '#ffffff', align: 'center' });
    sh.setStyle(`B2:B${end}`, { format: { type: 'date', pattern: 'dd/MM/yyyy' } });
    sh.setStyle(`F2:F${end}`, { format: { type: 'date', pattern: 'dd/MM/yyyy' } });
    sh.setStyle(`D${end + 2}:E${end + 3}`, { bold: true });
    sh.setColProps('C', { width: 140 });
    sh.setColProps('D', { width: 280 });
    sh.setSheetProps({ freezeRows: 1 });
    sh.addValidation(`G2:G${end}`, { kind: 'list', values: ['Open', 'Closed'] });
    // tenggat sudah lewat dan masih terbuka: satu baris merah
    sh.addConditional('A2:H200', { op: 'formula', formula: '=AND($G2="Open", $F2<TODAY())', style: { fill: '#fce8e6', color: '#a50e0e' } });
    sh.addConditional('G2:G200', { op: 'textIs', a: 'Closed', style: { color: '#188038' } });
    sh.createFilter(`A1:H${end}`);
    return sh;
}
