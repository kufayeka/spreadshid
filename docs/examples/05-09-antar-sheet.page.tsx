import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import { createWorkbook } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';

// 5.9 Rumus yang membaca sheet lain: nama dan harga diambil dari sheet Produk, tarif PPN dari sheet Pengaturan.
function buat() {
    const wb = createWorkbook();
    wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
    const produk = wb.sheet(wb.addSheet('Produk'));
    produk.setValues('A1', [['Kode', 'Produk', 'Harga'], ['SMN-01', 'Semen Portland 50 kg', 72000], ['BSI-10', 'Besi beton 10 mm', 79500], ['CAT-05', 'Cat tembok 5 kg', 145000]]);
    const atur = wb.sheet(wb.addSheet('Pengaturan'));
    atur.setValues('A1', [['PPN', 0.11]]);

    const nota = wb.sheet('Sheet1');
    nota.setSheetProps({ name: 'Nota' });
    nota.setValues('A1', [
        ['Kode', 'Produk', 'Qty', 'Harga', 'Jumlah', 'PPN'],
        // baru: XLOOKUP mencari kode di kolom A sheet Produk, lalu memberi nilai dari kolom B atau C
        ['SMN-01', '=XLOOKUP(A2, Produk!$A$2:$A$4, Produk!$B$2:$B$4)', 40, '=XLOOKUP(A2, Produk!$A$2:$A$4, Produk!$C$2:$C$4)', '=C2*D2', '=E2*Pengaturan!$B$1'],
        ['CAT-05', '=XLOOKUP(A3, Produk!$A$2:$A$4, Produk!$B$2:$B$4)', 6, '=XLOOKUP(A3, Produk!$A$2:$A$4, Produk!$C$2:$C$4)', '=C3*D3', '=E3*Pengaturan!$B$1']
    ]);
    nota.setStyle('A1:F1', { bold: true, fill: '#eef2f7' });
    nota.setStyle('D2:F3', { format: { type: 'money', decimals: 0 } });
    nota.setColProps('B', { width: 180 });
    return wb;
}

export default function Halaman() {
    const [wb] = useState(buat);
    return (
        <div style={{ height: 260 }}>
            <Sheet workbook={wb} sheet={wb.sheetIdByName('Nota') ?? undefined} />
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
const root = document.getElementById('root');
if (root) createRoot(root).render(<Halaman />);
