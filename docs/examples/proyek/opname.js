// Opname (laporan progres) minggu ke-8. Volume kontrak, satuan dan bobot diambil dari RAB; site manager mengisi volume minggu ini; sisanya rumus:
// volume s.d. minggu ini, persentase, progres tertimbang, dan total progres fisik (named range ProgresOpname, dipakai Kurva S dan Termin).
// Volume yang melebihi kontrak ditandai merah. Baris yang sudah disetujui PM dikunci lewat aturan (bab 10).

// volume s.d. minggu lalu dan minggu ini, per pekerjaan RAB
export const VOLUME = [[240, 0], [1800, 0], [62, 34], [85, 0], [18, 14], [690, 260], [210, 150], [0, 0]];

/** Sheet "Opname M8". `items` adalah pekerjaan RAB ({ row }). */
export function buatOpname(wb, items) {
    const sh = wb.sheet(wb.addSheet('Opname M8'));
    sh.setValues('A1', [['LAPORAN PROGRES MINGGUAN'], ['Minggu ke-8, 19 - 25 Oktober 2026']]);
    sh.mergeCells('A1:L1');
    sh.mergeCells('A2:L2');
    sh.setStyle('A1', { bold: true, fontSize: 13, align: 'center' });
    sh.setStyle('A2', { align: 'center', color: '#5f6368' });
    sh.setValues('A4', [['No', 'Pekerjaan', 'Satuan', 'Volume kontrak', 's.d. minggu lalu', 'Minggu ini', 's.d. minggu ini', 'Progres', 'Bobot', 'Progres tertimbang', 'Status', 'Diverifikasi']]);
    const rows = items.map((it, i) => {
        const r = i + 5;
        return [i + 1, `=RAB!C${it.row}`, `=RAB!E${it.row}`, `=RAB!D${it.row}`, VOLUME[i][0], VOLUME[i][1],
            `=E${r}+F${r}`, `=IF(D${r}=0, 0, G${r}/D${r})`, `=RAB!H${it.row}`, `=H${r}*I${r}`, i < 3 ? 'Disetujui' : 'Diajukan', i < 3];
    });
    sh.setValues('A5', rows);
    const end = items.length + 4, total = end + 1;
    sh.setValues(`B${total}`, [['Total progres fisik', '', '', '', '', '', '', `=SUM(I5:I${end})`, `=SUM(J5:J${end})`]]);
    wb.addName('ProgresOpname', 'Opname M8', `J${total}`);

    sh.setStyle('A4:L4', { bold: true, fill: '#1a73e8', color: '#ffffff', align: 'center', valign: 'middle', wrap: 'wrap' });
    sh.setStyle(`B${total}:L${total}`, { bold: true, fill: '#f1f3f4' });
    sh.setStyle(`D5:G${end}`, { format: { type: 'number', decimals: 2 } });
    sh.setStyle(`F5:F${end}`, { fill: '#fff8e1' }); // kolom yang diisi site manager
    sh.setStyle(`H5:J${total}`, { format: { type: 'percent', decimals: 2 } });
    sh.setRowProps('4', { height: 40 });
    sh.setColProps('B', { width: 230 });
    sh.setColProps('C', { width: 55 });
    sh.setColProps('D:J', { width: 92 });
    sh.setSheetProps({ freezeRows: 4 });

    sh.addValidation(`F5:F${end}`, { kind: 'number', op: 'gte', a: 0, help: 'Volume yang dikerjakan minggu ini' });
    sh.addValidation(`K5:K${end}`, { kind: 'list', values: ['Draft', 'Diajukan', 'Disetujui', 'Ditolak'] });
    sh.addValidation(`L5:L${end}`, { kind: 'checkbox' });
    // melebihi volume kontrak: merah
    sh.addConditional(`G5:G${end}`, { op: 'formula', formula: '=G5>D5', style: { fill: '#f4c7c3', color: '#a50e0e', bold: true } });
    // progres per pekerjaan sebagai skala warna
    sh.addConditional(`H5:H${end}`, { kind: 'scale', min: { type: 'number', value: 0, color: '#ffffff' }, max: { type: 'number', value: 1, color: '#57bb8a' } });
    sh.addConditional(`K5:K${end}`, { op: 'textIs', a: 'Disetujui', style: { color: '#188038', bold: true } });
    sh.addConditional(`K5:K${end}`, { op: 'textIs', a: 'Ditolak', style: { color: '#d93025', bold: true } });
    return { sh, end, totalRow: total };
}
