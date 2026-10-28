import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import { createWorkbook } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';

// Langkah 2: sheet yang sudah berisi. Isinya dibuat oleh kode, di dalam sebuah workbook.
function buatDaftarHarga() {
    const wb = createWorkbook();
    wb.setValues('Sheet1', 'A1', [
        ['Produk', 'Harga', 'Qty', 'Jumlah'],
        ['Semen 50 kg', 72000, 10, '=B2*C2'],
        ['Besi 10 mm', 79500, 5, '=B3*C3'],
        ['Total', null, null, '=SUM(D2:D3)']
    ]);
    return wb;
}

export default function Halaman() {
    // useState(fungsi): workbook dibuat sekali saja, saat halaman pertama tampil
    const [wb] = useState(buatDaftarHarga);
    return <div style={{ height: 400 }}><Sheet workbook={wb} /></div>;
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
createRoot(document.getElementById('root')).render(<Halaman />);
