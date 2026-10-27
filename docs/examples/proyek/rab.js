// RAB (Rencana Anggaran Biaya). Harga satuan tiap pekerjaan dihitung dari AHSP (jumlah komponennya + 10% overhead dan keuntungan, dibulatkan ke
// ratusan), jumlah per baris = volume x harga satuan, subtotal per bab dengan SUBTOTAL (jadi rekap tidak menghitung bab dua kali), PPN 11%, total
// dibulatkan ke ribuan, dan bobot tiap pekerjaan terhadap total untuk kurva S.

import { ANALISA } from './harga-ahsp.js';

// [bab, [[kode AHSP, uraian di RAB, volume], ...]]
export const PEKERJAAN = [
    ['I. PEKERJAAN TANAH', [['A.1', 'Galian tanah pondasi', 240], ['A.7', 'Galian basement dengan excavator', 1800], ['A.2', 'Urugan pasir bawah lantai', 96]]],
    ['II. PEKERJAAN BETON', [['A.3', 'Beton pondasi footplat K-300', 85], ['A.3', 'Beton kolom lantai 1 K-300', 42], ['A.4', 'Pembesian pondasi dan kolom', 1250], ['A.5', 'Bekisting kolom lantai 1', 520]]],
    ['III. PEKERJAAN PASANGAN', [['A.6', 'Dinding bata merah lantai 1', 860]]]
];

/**
 * Sheet "RAB". Mengembalikan baris tiap pekerjaan (nomor baris layar), supaya sheet lain bisa merujuknya.
 * @returns {{ sh: any, items: { row: number, uraian: string }[], totalRow: number }}
 */
export function buatRab(wb) {
    const sh = wb.sheet(wb.addSheet('RAB'));
    sh.setValues('A1', [['RENCANA ANGGARAN BIAYA'], ['Pembangunan Gedung Kantor A, Jl. Merdeka 10']]);
    sh.mergeCells('A1:H1');
    sh.mergeCells('A2:H2');
    sh.setStyle('A1', { bold: true, fontSize: 14, align: 'center' });
    sh.setStyle('A2', { italic: true, align: 'center', color: '#5f6368' });
    sh.setValues('A4', [['No', 'Kode', 'Uraian pekerjaan', 'Volume', 'Satuan', 'Harga satuan', 'Jumlah', 'Bobot']]);

    let r = 5;
    const items = [], babRows = [];
    for (const [bab, list] of PEKERJAAN) {
        const babRow = r;
        babRows.push(babRow);
        const first = r + 1, last = r + list.length;
        sh.setValues(`A${r}`, [['', '', bab, '', '', '', `=SUBTOTAL(9, G${first}:G${last})`, `=G${r}/TotalRAB`]]);
        r++;
        list.forEach(([kode, uraian, volume], i) => {
            sh.setValues(`A${r}`, [[i + 1, kode, uraian, volume,
                ANALISA.find((a) => a[0] === kode)[2],
                `=ROUND(SUMIFS(AHSP!H:H, AHSP!A:A, B${r}) * 1.1, -2)`,
                `=D${r}*F${r}`,
                `=G${r}/TotalRAB`]]);
            items.push({ row: r, uraian });
            r++;
        });
        // pekerjaan satu bab dikelompokkan di bawah judulnya
        sh.groupRows(`${first}:${last}`);
    }
    const jumlahRow = r + 1;
    sh.setValues(`C${jumlahRow}`, [
        ['Jumlah', '', '', '', `=SUBTOTAL(9, G5:G${r - 1})`],
        ['PPN 11%', '', '', '', `=ROUND(G${jumlahRow}*11%, 0)`],
        ['Total', '', '', '', `=G${jumlahRow}+G${jumlahRow + 1}`],
        ['Dibulatkan', '', '', '', `=ROUNDDOWN(G${jumlahRow + 2}, -3)`]
    ]);
    wb.addName('TotalRAB', 'RAB', `G${jumlahRow}`);

    // tampilan
    sh.setStyle('A4:H4', { bold: true, fill: '#1a73e8', color: '#ffffff', align: 'center', valign: 'middle', wrap: 'wrap' });
    for (const b of babRows) sh.setStyle(`A${b}:H${b}`, { bold: true, fill: '#e8f0fe' });
    sh.setStyle(`C${jumlahRow}:H${jumlahRow + 3}`, { bold: true });
    sh.setStyle(`C${jumlahRow + 3}:H${jumlahRow + 3}`, { fill: '#fef7e0' });
    sh.setStyle(`F5:G${jumlahRow + 3}`, { format: { type: 'money', decimals: 0 } });
    sh.setStyle(`H5:H${r}`, { format: { type: 'percent', decimals: 2 } });
    sh.setStyle(`D5:D${r}`, { format: { type: 'number', decimals: 2 } });
    sh.setStyle(`A4:H${r - 1}`, { borders: { top: LINE, right: LINE, bottom: LINE, left: LINE } });
    sh.setRowProps('4', { height: 34 });
    sh.setColProps('A', { width: 40 });
    sh.setColProps('B', { width: 55 });
    sh.setColProps('C', { width: 250 });
    sh.setColProps('E', { width: 60 });
    sh.setColProps('F:G', { width: 130 });
    sh.setSheetProps({ freezeRows: 4 });

    // volume harus angka >= 0; jumlah yang besar ditandai
    sh.addValidation(`D5:D${r}`, { kind: 'number', op: 'gte', a: 0, help: 'Volume dari gambar kerja' });
    sh.addConditional(`H6:H${r}`, { kind: 'scale', min: { type: 'min', color: '#ffffff' }, max: { type: 'max', color: '#f6b26b' } });
    return { sh, items, totalRow: jumlahRow, lastItemRow: r - 1 };
}

const LINE = { style: 'solid', width: 1, color: '#c0c0c0' };
