import { useState } from 'react';
import { Sheet, useWorkbook } from '@kufayeka/sheet';
import { createWorkbook } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';

// Langkah 3: angka dari sheet tampil di luar sheet, dan tombol di luar sheet mengubah sheet.
function buatDaftarHarga() {
    const wb = createWorkbook();
    wb.setValues('Sheet1', 'A1', [['Produk', 'Harga', 'Qty', 'Jumlah'], ['Semen 50 kg', 72000, 10, '=B2*C2'], ['Besi 10 mm', 79500, 5, '=B3*C3'], ['Total', null, null, '=SUM(D2:D3)']]);
    return wb;
}

export default function Halaman() {
    const [wb] = useState(buatDaftarHarga);
    // dibaca ulang setiap kali sheet berubah: ketik Qty baru di sheet, angka di atas ikut berubah
    const total = useWorkbook(wb, (w) => w.value('Sheet1', 'D4'));
    return (
        <div>
            <p>Total belanja: <b className="total">{total}</b>
                {' '}<button className="tambah" onClick={() => wb.setValues('Sheet1', 'C2', wb.value('Sheet1', 'C2') + 1)}>+1 semen</button></p>
            <div style={{ height: 360 }}><Sheet workbook={wb} /></div>
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
createRoot(document.getElementById('root')).render(<Halaman />);
