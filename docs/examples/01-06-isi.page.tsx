import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import { createWorkbook } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';

// 1.6 Isi dari kode: workbook dibuat sekali, diisi, lalu diberikan ke <Sheet>.
function buatProduk() {                                                  // baru
    const wb = createWorkbook();
    const s = wb.sheet('Sheet1');
    s.setValues('A1', [
        ['Kode', 'Produk', 'Harga', 'Stok', 'Nilai stok'],
        ['SMN-01', 'Semen Portland 50 kg', 72000, 420, '=C2*D2'],
        ['BSI-10', 'Besi beton 10 mm', 79500, 260, '=C3*D3'],
        ['CAT-05', 'Cat tembok 5 kg', 145000, 64, '=C4*D4'],
        ['', 'Total', '', '=SUM(D2:D4)', '=SUM(E2:E4)']
    ]);
    return wb;
}

export default function Halaman() {
    const [wb] = useState(buatProduk);                                  // baru: dibuat sekali saja
    return (
        <div style={{ height: 300 }}>
            <Sheet workbook={wb} />                                     {/* baru */}
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
const root = document.getElementById('root');
if (root) createRoot(root).render(<Halaman />);
