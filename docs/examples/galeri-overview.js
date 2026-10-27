import { createWorkbook, tableOf, pivot } from '@kufayeka/sheet/core';

// ---- storage file proyek (di aplikasi sungguhan: tabel atau file di server). Tiap tim mengisi file opname-nya sendiri tiap minggu, dan tiap file
// punya named range "Progres" berisi kolom Minggu, Tim, Rencana, Realisasi. Named range itu "kontrak" antar file: overview cuma bergantung padanya.
function fileOpname(tim, baris) {
    const wb = createWorkbook();
    wb.setValues('Sheet1', 'A1', [['Catatan internal tim ' + tim], [], ['Minggu', 'Tim', 'Rencana', 'Realisasi'], ...baris.map((b) => [b[0], tim, b[1], b[2]])]);
    wb.addName('Progres', 'Sheet1', 'A3:D' + (baris.length + 3));
    return wb.toJSON();
}
const storage = {
    'opname-sipil.sheet': fileOpname('Sipil', [[1, 0.020, 0.012], [2, 0.025, 0.023], [3, 0.090, 0.036], [4, 0.080, 0.047], [5, 0.110, 0.072], [6, 0.085, 0.080], [7, 0.085, 0.070], [8, 0.050, 0.240]]),
    'opname-mep.sheet': fileOpname('MEP', [[5, 0.005, 0.000], [6, 0.008, 0.004], [7, 0.010, 0.006], [8, 0.012, 0.004]])
};

// ---- di server, tiap kali halaman overview dibuka: baca semua file opname, jumlahkan per minggu, buat kumulatif
export function hitungOverview(files) {
    const records = Object.values(files).flatMap((doc) => tableOf(createWorkbook(doc), null, 'Progres').records);
    const perMinggu = pivot(records, {
        rows: ['Minggu'],
        values: [{ field: 'Rencana', fn: 'SUM', as: 'Rencana' }, { field: 'Realisasi', fn: 'SUM', as: 'Realisasi' }],
        totals: false
    });
    let rencana = 0, realisasi = 0;
    return perMinggu.rows.map((r) => {
        const [minggu, rc, rl] = r.cells;
        rencana += rc;
        realisasi += rl;
        return [minggu, rc, rl, Math.round(rencana * 1e4) / 1e4, Math.round(realisasi * 1e4) / 1e4];
    });
}

// dijalankan langsung (node docs/examples/galeri-overview.js): cetak tabelnya
if (typeof process !== 'undefined' && process.argv[1] && process.argv[1].endsWith('galeri-overview.js')) {
    console.log('Minggu | Rencana | Realisasi | Rencana kum. | Realisasi kum.');
    for (const row of hitungOverview(storage)) console.log(row.map((v, i) => (i ? (v * 100).toFixed(1) + '%' : String(v))).join(' | '));
}
export { storage };
