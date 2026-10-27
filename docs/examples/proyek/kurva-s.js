// Kurva S (time schedule). Tiap pekerjaan dari RAB: bobotnya, minggu mulai dan selesai. Bobot dibagi rata ke minggu-minggu pelaksanaannya; batang
// gantt digambar oleh conditional formatting (rumus), bukan diwarnai tangan, jadi kalau jadwal digeser batangnya ikut. Di bawahnya: rencana per
// minggu, rencana kumulatif, realisasi kumulatif (minggu terakhir dari sheet Opname), dan deviasi.

export const JADWAL = [[1, 2], [1, 3], [3, 4], [3, 5], [5, 7], [3, 7], [5, 8], [8, 12]];
export const MINGGU = 12;
// realisasi kumulatif minggu 1-7 (dari laporan-laporan sebelumnya); minggu 8 dari sheet Opname
export const REALISASI_LALU = [0.012, 0.035, 0.071, 0.118, 0.19, 0.27, 0.34];

const col = (i) => String.fromCharCode(70 + i); // F, G, H, ... untuk minggu 1, 2, 3, ...

/** Sheet "Kurva S". `items` adalah pekerjaan RAB ({ row }). */
export function buatKurvaS(wb, items) {
    const sh = wb.sheet(wb.addSheet('Kurva S'));
    const last = col(MINGGU - 1);
    const head = ['No', 'Pekerjaan', 'Bobot', 'Mulai', 'Selesai'];
    for (let m = 1; m <= MINGGU; m++) head.push(m);
    sh.setValues('A1', [head]);
    const rows = items.map((it, i) => {
        const r = i + 2;
        const row = [i + 1, `=RAB!C${it.row}`, `=RAB!H${it.row}`, JADWAL[i][0], JADWAL[i][1]];
        for (let m = 0; m < MINGGU; m++) {
            const c = col(m);
            row.push(`=IF(AND(${c}$1>=$D${r}, ${c}$1<=$E${r}), $C${r}/($E${r}-$D${r}+1), "")`);
        }
        return row;
    });
    sh.setValues('A2', rows);
    const end = items.length + 1;
    const sum = end + 1;
    const lines = [['', 'Rencana per minggu'], ['', 'Rencana kumulatif'], ['', 'Realisasi kumulatif'], ['', 'Deviasi']];
    for (let m = 0; m < MINGGU; m++) {
        const c = col(m), prev = m ? col(m - 1) : null;
        lines[0].push(`=SUM(${c}2:${c}${end})`);
        lines[1].push(prev ? `=${prev}${sum + 1}+${c}${sum}` : `=${c}${sum}`);
        lines[2].push(m < REALISASI_LALU.length ? REALISASI_LALU[m] : m === REALISASI_LALU.length ? '=ProgresOpname' : '');
        lines[3].push(`=IF(${c}${sum + 2}="", "", ${c}${sum + 2}-${c}${sum + 1})`);
    }
    for (const line of lines) line.splice(2, 0, '', '', '');
    sh.setValues(`A${sum}`, lines);
    wb.addName('KurvaS', 'Kurva S', `E1:${last}${sum + 2}`);

    // tampilan
    sh.setStyle(`A1:${last}1`, { bold: true, fill: '#1a73e8', color: '#ffffff', align: 'center' });
    sh.setStyle(`F1:${last}1`, { format: { type: 'number', decimals: 0, prefix: 'M' } });
    sh.setStyle(`C2:C${end}`, { format: { type: 'percent', decimals: 2 } });
    sh.setStyle(`F2:${last}${sum + 3}`, { format: { type: 'percent', decimals: 1 } });
    sh.setStyle(`A${sum}:${last}${sum + 3}`, { bold: true, fill: '#f1f3f4' });
    sh.setColProps('A', { width: 36 });
    sh.setColProps('B', { width: 230 });
    sh.setColProps('C:E', { width: 62 });
    sh.setColProps(`F:${last}`, { width: 58 });
    sh.setSheetProps({ freezeRows: 1, freezeCols: 2 });
    // batang gantt: sel di dalam jadwal diwarnai, dari rumus yang sama dengan isinya
    sh.addConditional(`F2:${last}${end}`, { op: 'formula', formula: '=AND(F$1>=$D2, F$1<=$E2)', style: { fill: '#a4c2f4', color: '#1c4587' } });
    // deviasi negatif (terlambat) merah, positif hijau
    sh.addConditional(`F${sum + 3}:${last}${sum + 3}`, { op: 'lt', a: 0, style: { color: '#d93025' } });
    sh.addConditional(`F${sum + 3}:${last}${sum + 3}`, { op: 'gt', a: 0, style: { color: '#188038' } });
    // jadwal: minggu 1 sampai 12, selesai tidak sebelum mulai
    sh.addValidation(`D2:E${end}`, { kind: 'number', op: 'between', a: 1, b: MINGGU, help: 'Minggu ke-1 sampai ke-' + MINGGU });
    return { sh, sumRow: sum };
}
