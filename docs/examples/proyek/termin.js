// Termin (tagihan) ke-2. Bentuk formulir, bukan tabel: label di kiri, nilai di kanan, semuanya rumus dari RAB (nilai kontrak) dan Opname (progres).
// Pengembalian uang muka dan retensi dipotong dari nilai pekerjaan, termin yang sudah dibayar dikurangkan, lalu PPN. Rumus di sel uang dibulatkan
// ke rupiah oleh formatnya, jadi tidak ada sen yang tercecer.

/** Sheet "Termin 2". */
export function buatTermin(wb) {
    const sh = wb.sheet(wb.addSheet('Termin 2'));
    sh.setValues('A1', [['TAGIHAN TERMIN KE-2'], ['Pembangunan Gedung Kantor A, periode s.d. 25 Oktober 2026']]);
    sh.mergeCells('A1:D1');
    sh.mergeCells('A2:D2');
    sh.setStyle('A1', { bold: true, fontSize: 14, align: 'center' });
    sh.setStyle('A2', { align: 'center', color: '#5f6368' });
    sh.setValues('A4', [
        ['1', 'Nilai kontrak (sebelum PPN)', '', '=TotalRAB'],
        ['2', 'Progres fisik s.d. periode ini', '', '=ProgresOpname'],
        ['3', 'Nilai pekerjaan s.d. periode ini', '(1 x 2)', '=D4*D5'],
        ['4', 'Pengembalian uang muka', '20% x (3)', '=-D6*UangMuka'],
        ['5', 'Retensi', '5% x (3)', '=-D6*Retensi'],
        ['6', 'Dibayar s.d. termin lalu', '', -95500000],
        ['7', 'Tagihan termin ini', '(3 + 4 + 5 + 6)', '=SUM(D6:D9)'],
        ['8', 'PPN 11%', '11% x (7)', '=D10*11%'],
        ['9', 'Total tagihan', '(7 + 8)', '=D10+D11']
    ]);
    // tarif di sel sendiri, diberi nama: diubah di satu tempat, semua rumus ikut
    sh.setValues('F4', [['Uang muka', 0.2], ['Retensi', 0.05]]);
    wb.addName('UangMuka', 'Termin 2', 'G4');
    wb.addName('Retensi', 'Termin 2', 'G5');
    sh.setStyle('F4:G5', { fill: '#fff8e1' });
    sh.setStyle('G4:G5', { format: { type: 'percent', decimals: 0 } });

    sh.setStyle('D4:D12', { format: { type: 'money', decimals: 0, negative: 'parens' } });
    sh.setStyle('D5', { format: { type: 'percent', decimals: 2 } });
    sh.setStyle('C4:C12', { italic: true, color: '#5f6368' });
    sh.setStyle('A10:D10', { bold: true });
    sh.setStyle('A12:D12', { bold: true, fill: '#e8f0fe', fontSize: 12 });
    const LINE = { style: 'solid', width: 1, color: '#c0c0c0' };
    sh.setStyle('A4:D12', { borders: { bottom: LINE } });
    sh.setColProps('A', { width: 32 });
    sh.setColProps('B', { width: 250 });
    sh.setColProps('C', { width: 120 });
    sh.setColProps('D', { width: 160 });
    sh.setRowProps('12', { height: 30 });
    sh.setStyle('A12:D12', { valign: 'middle' });
    return sh;
}
