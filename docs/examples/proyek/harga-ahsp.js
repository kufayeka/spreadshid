// Daftar Harga dan AHSP (Analisa Harga Satuan Pekerjaan).
// Harga: satu baris per bahan, upah, alat. AHSP: satu baris per komponen sebuah pekerjaan, harganya diambil dari Harga lewat XLOOKUP,
// jadi kalau harga semen naik, semua analisa, RAB, kurva S dan termin ikut berubah.

export const HARGA = [
    ['Kode', 'Uraian', 'Satuan', 'Harga', 'Jenis'],
    ['L.01', 'Pekerja', 'OH', 120000, 'Upah'],
    ['L.02', 'Tukang batu', 'OH', 150000, 'Upah'],
    ['L.03', 'Kepala tukang', 'OH', 170000, 'Upah'],
    ['L.04', 'Mandor', 'OH', 180000, 'Upah'],
    ['L.05', 'Tukang besi', 'OH', 150000, 'Upah'],
    ['L.06', 'Tukang kayu', 'OH', 150000, 'Upah'],
    ['M.01', 'Semen Portland 50 kg', 'zak', 72000, 'Bahan'],
    ['M.04', 'Besi beton polos', 'kg', 14500, 'Bahan'],
    ['M.05', 'Kawat beton', 'kg', 25000, 'Bahan'],
    ['M.06', 'Kayu bekisting kelas III', 'm3', 3200000, 'Bahan'],
    ['M.07', 'Paku 5-12 cm', 'kg', 22000, 'Bahan'],
    ['M.08', 'Bata merah', 'bh', 900, 'Bahan'],
    ['M.09', 'Pasir pasang', 'm3', 260000, 'Bahan'],
    ['M.10', 'Beton ready mix K-300', 'm3', 1150000, 'Bahan'],
    ['E.01', 'Excavator 0,8 m3', 'jam', 450000, 'Alat'],
    ['E.02', 'Concrete vibrator', 'jam', 60000, 'Alat']
];

// [kode AHSP, uraian pekerjaan, satuan, [[komponen, koefisien], ...]]
export const ANALISA = [
    ['A.1', 'Galian tanah biasa sedalam 1 m', 'm3', [['L.01', 0.75], ['L.04', 0.025]]],
    ['A.2', 'Urugan pasir', 'm3', [['M.09', 1.2], ['L.01', 0.3], ['L.04', 0.01]]],
    ['A.3', 'Beton ready mix K-300', 'm3', [['M.10', 1.02], ['L.01', 1], ['L.02', 0.25], ['L.03', 0.025], ['L.04', 0.1], ['E.02', 0.25]]],
    ['A.4', 'Pembesian 10 kg besi polos', '10 kg', [['M.04', 10.5], ['M.05', 0.15], ['L.01', 0.07], ['L.05', 0.07], ['L.03', 0.007], ['L.04', 0.004]]],
    ['A.5', 'Bekisting kolom', 'm2', [['M.06', 0.04], ['M.07', 0.3], ['L.01', 0.52], ['L.06', 0.26], ['L.03', 0.026], ['L.04', 0.026]]],
    ['A.6', 'Pasangan dinding bata merah 1:4', 'm2', [['M.08', 70], ['M.01', 0.22], ['M.09', 0.043], ['L.01', 0.3], ['L.02', 0.1], ['L.03', 0.01], ['L.04', 0.015]]],
    ['A.7', 'Galian tanah dengan excavator', 'm3', [['E.01', 0.05], ['L.01', 0.05]]]
];

/** Sheet "Harga": daftar harga dasar. */
export function buatHarga(wb) {
    const sh = wb.sheet(wb.addSheet('Harga'));
    sh.setValues('A1', HARGA);
    sh.setStyle('A1:E1', { bold: true, fill: '#e8f0fe', align: 'center' });
    sh.setColProps('B', { width: 210 });
    sh.setColProps('D', { width: 120, format: { type: 'money', decimals: 0 } });
    sh.setSheetProps({ freezeRows: 1 });
    // jenis hanya boleh tiga ini, dan bisa disaring
    sh.addValidation('E2:E200', { kind: 'list', values: ['Upah', 'Bahan', 'Alat'] });
    sh.createFilter('A1:E' + HARGA.length);
    wb.addName('DaftarHarga', 'Harga', 'A1:E' + HARGA.length);
    return sh;
}

/** Sheet "AHSP": komponen tiap pekerjaan; uraian, satuan dan harga diambil dari Harga. */
export function buatAhsp(wb) {
    const sh = wb.sheet(wb.addSheet('AHSP'));
    const rows = [['Kode AHSP', 'Pekerjaan', 'Komponen', 'Uraian komponen', 'Satuan', 'Koefisien', 'Harga', 'Jumlah']];
    for (const [kode, uraian, , komponen] of ANALISA) {
        komponen.forEach(([k, koef]) => {
            const r = rows.length + 1;
            rows.push([kode, uraian, k,
                `=XLOOKUP(C${r}, Harga!A:A, Harga!B:B, "?")`,
                `=XLOOKUP(C${r}, Harga!A:A, Harga!C:C, "")`,
                koef,
                `=XLOOKUP(C${r}, Harga!A:A, Harga!D:D, 0)`,
                `=F${r}*G${r}`]);
        });
    }
    sh.setValues('A1', rows);
    sh.setStyle('A1:H1', { bold: true, fill: '#e8f0fe', align: 'center' });
    sh.setColProps('B', { width: 220 });
    sh.setColProps('D', { width: 190 });
    sh.setColProps('G:H', { width: 115, format: { type: 'money', decimals: 0 } });
    sh.setColProps('F', { format: { type: 'number', decimals: 3 } });
    sh.setSheetProps({ freezeRows: 1 });
    // satu grup per pekerjaan, supaya analisa yang panjang bisa dilipat
    let start = 2;
    for (const [, , , komponen] of ANALISA) { sh.groupRows(`${start + 1}:${start + komponen.length - 1}`); start += komponen.length; }
    // komponen yang kodenya tidak ada di daftar harga langsung kelihatan
    sh.addConditional('D2:D500', { op: 'textIs', a: '?', style: { fill: '#f4c7c3', color: '#a50e0e', bold: true } });
    return sh;
}
