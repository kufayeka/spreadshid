import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import { createWorkbook } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';

// 14.1 Pivot lewat menu: kode hanya menyediakan data. Pivot-nya dibuat oleh orang yang memakai sheet, lewat Insert > Pivot table.
// Data: pesanan sebuah kafe, satu baris per minuman yang dipesan.
function buatKafe() {
    const wb = createWorkbook();
    wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
    const s = wb.sheet('Sheet1');
    s.setSheetProps({ name: 'Pesanan', freezeRows: 1 });
    s.setValues('A1', [
        ['Tanggal',    'Menu',          'Ukuran', 'Qty', 'Total'],
        ['2026-11-09', 'Es kopi susu',  'Besar',   2,    56000],
        ['2026-11-09', 'Americano',     'Sedang',  1,    22000],
        ['2026-11-09', 'Es kopi susu',  'Sedang',  3,    66000],
        ['2026-11-10', 'Matcha latte',  'Besar',   1,    32000],
        ['2026-11-10', 'Americano',     'Besar',   2,    52000],
        ['2026-11-11', 'Es kopi susu',  'Besar',   4,   112000],
        ['2026-11-11', 'Matcha latte',  'Sedang',  2,    54000],
        ['2026-11-12', 'Teh tarik',     'Sedang',  3,    45000]
    ]);
    s.setStyle('A1:E1', { bold: true, fill: '#eef2f7' });
    s.setColProps('B', { width: 140 });
    s.setColProps('E', { format: { type: 'money', decimals: 0 }, width: 120 });
    return wb;
}

export default function Halaman() {
    const [wb] = useState(buatKafe);
    return (
        <div style={{ height: 460 }}>
            <Sheet workbook={wb} fileName="Pesanan kafe" />
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
const root = document.getElementById('root');
if (root) createRoot(root).render(<Halaman />);
