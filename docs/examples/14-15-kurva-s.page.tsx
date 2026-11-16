import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import { createWorkbook } from '@kufayeka/sheet/core';
import type { Workbook } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';

// 14.15 Studi kasus: Kurva S proyek konstruksi, rencana dan realisasi.
// Data: laporan progress dari site manager (SM). Setiap laporan menyebut pekerjaan, bobotnya terhadap seluruh proyek (%), dan statusnya;
// hanya laporan yang sudah Disetujui yang dihitung. Jadwal rencana per minggu ditulis oleh perencana.
// Hasil: tabel Kurva S (rencana, realisasi, kumulatif, deviasi) dan grafik dua garis.
const RENCANA = [10, 15, 20, 20, 15, 10, 10];                          // % rencana minggu 45..51, total 100

function buatProyek(): Workbook {
    const wb = createWorkbook();
    wb.setSettings({ locale: 'id-ID' });

    // 1. laporan SM: sumber pivot. Laporan baru cukup ditambahkan di bawahnya.
    const laporan = wb.sheet('Sheet1');
    laporan.setSheetProps({ name: 'Laporan SM', freezeRows: 1 });
    laporan.setValues('A1', [
        ['Tanggal',    'Pekerjaan', 'Bobot', 'Status'],
        ['2026-11-02', 'Galian',     8,      'Disetujui'],
        ['2026-11-04', 'Galian',     7,      'Disetujui'],
        ['2026-11-10', 'Pondasi',    10,     'Disetujui'],
        ['2026-11-12', 'Pondasi',    12,     'Disetujui'],
        ['2026-11-17', 'Sloof',      15,     'Disetujui'],
        ['2026-11-19', 'Kolom',      18,     'Draft'],
        ['2026-11-24', 'Kolom',      20,     'Disetujui']
    ]);

    const kurva = wb.sheet(wb.addSheet('Kurva S'));
    // 2. pivot realisasi per minggu, jauh di kolom P:Q sebagai "gudang" angka; hanya yang Disetujui
    kurva.addPivot('P1', "'Laporan SM'!A1:D500", {
        rows: ['Tanggal'], group: { Tanggal: 'week' },
        values: [{ field: 'Bobot', fn: 'SUM', as: 'Realisasi' }],
        filters: { Status: { hidden: ['Draft', 'Ditolak'] } },
        totals: false
    });

    // 3. tabel Kurva S: daftar minggu dari JADWAL (tetap), realisasi dicari di pivot dengan SUMIF
    const tabel: (string | number)[][] = [['Minggu', 'Rencana', 'Rencana kum.', 'Realisasi', 'Realisasi kum.', 'Deviasi']];
    RENCANA.forEach((rencana, i) => {
        const r = i + 2;
        tabel.push([
            '2026-W' + (45 + i),
            rencana,
            `=SUM(B$2:B${r})`,
            `=SUMIF(P:P, A${r}, Q:Q)`,
            `=IF(D${r}=0, "", SUM(D$2:D${r}))`,
            `=IF(E${r}="", "", E${r}-C${r})`
        ]);
    });
    kurva.setValues('A1', tabel);
    kurva.setStyle('A1:F1', { bold: true, fill: '#eef2f7' });
    kurva.setColProps('A:F', { width: 105 });

    // 4. grafik dua garis kumulatif, rencana putus-putus
    kurva.addChart({
        at: 'H1:N17', type: 'line', categories: 'A2:A8', markers: true, title: 'Kurva S: rencana vs realisasi', legend: 'bottom',
        series: [{ name: 'Rencana', values: 'C2:C8', dash: true }, { name: 'Realisasi', values: 'E2:E8' }]
    });
    wb.moveSheet('Kurva S', 0);
    return wb;
}

export default function Halaman() {
    const [wb] = useState(buatProyek);
    return (
        <div style={{ height: 560 }}>
            <Sheet workbook={wb} />
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
const root = document.getElementById('root');
if (root) createRoot(root).render(<Halaman />);
