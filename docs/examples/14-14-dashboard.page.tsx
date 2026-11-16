import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import { createWorkbook } from '@kufayeka/sheet/core';
import type { Workbook } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';

// 14.14 Pivot + grafik: dashboard kecil di dalam sheet. Data: penjualan roti dari tiga outlet, satu baris per hari per outlet.
// Pemilik ingin melihat omzet tiap bulan per outlet sebagai grafik kolom, dan satu angka besar: outlet terbaik bulan terakhir.
function buatToko(): Workbook {
    const wb = createWorkbook();
    wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
    const data = wb.sheet('Sheet1');
    data.setSheetProps({ name: 'Harian' });
    const outlet = ['Cibubur', 'Depok', 'Bogor'];
    const baris: (string | number)[][] = [['Tanggal', 'Outlet', 'Omzet']];
    // tiga bulan, setiap hari Senin, setiap outlet: angka dibuat dari rumus tetap supaya hasilnya selalu sama
    for (let minggu = 0; minggu < 13; minggu++) {
        const hari = new Date(Date.UTC(2026, 7, 3 + minggu * 7));
        const tanggal = hari.toISOString().slice(0, 10);
        outlet.forEach((o, i) => baris.push([tanggal, o, 2_000_000 + i * 450_000 + minggu * 120_000 + ((minggu * 7 + i * 3) % 5) * 90_000]));
    }
    data.setValues('A1', baris);

    const dasbor = wb.sheet(wb.addSheet('Dashboard'));
    dasbor.setValues('A1', 'Omzet per bulan per outlet');
    dasbor.setStyle('A1', { bold: true, fontSize: 14 });
    // a. pivot di A3 (di bawah judul): bulan ke bawah, outlet ke samping, tanpa total (grafik hanya menggambar bulan-bulannya)
    dasbor.addPivot('A3', 'Harian!A1:C500', {
        rows: ['Tanggal'], group: { Tanggal: 'month' },
        columns: ['Outlet'],
        values: [{ field: 'Omzet', fn: 'SUM' }],
        totals: false
    });
    dasbor.setColProps('A', { width: 190 });
    dasbor.setColProps('B:D', { format: { type: 'money', decimals: 0 }, width: 130 });
    // b. grafik kolom dari tabel pivot (A3:D6), digambar di kotak F1:J16
    dasbor.addChart({ at: 'F1:J16', type: 'column', data: 'A3:D6', title: 'Omzet per bulan', legend: 'bottom' });
    // c. angka ringkas dari pivot dengan rumus biasa: outlet dengan omzet terbesar di bulan terakhir (baris 6)
    dasbor.setValues('A9', [
        ['Outlet terbaik bulan terakhir', '=INDEX(B3:D3, MATCH(MAX(B6:D6), B6:D6, 0))'],
        ['Omzetnya', '=MAX(B6:D6)']
    ]);
    dasbor.setStyle('A9:B10', { bold: true });
    dasbor.setStyle('B10', { format: { type: 'money', decimals: 0 } });
    wb.moveSheet('Dashboard', 0);
    return wb;
}

export default function Halaman() {
    const [wb] = useState(buatToko);
    return (
        <div style={{ height: 520 }}>
            <Sheet workbook={wb} />
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
const root = document.getElementById('root');
if (root) createRoot(root).render(<Halaman />);
