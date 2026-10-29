import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import { createWorkbook } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';

// 7.5 Grup baris: rincian per kategori bisa dilipat, sehingga yang tampil hanya baris ringkasannya.
function buat() {
    const wb = createWorkbook();
    wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
    const s = wb.sheet('Sheet1');
    s.setValues('A1', [
        ['Kategori / produk', 'Nilai stok'],
        ['Semen', '=SUM(B3:B4)'],
        ['  Semen Portland 50 kg', 30240000],
        ['  Semen putih 40 kg', 3920000],
        ['Besi', '=SUM(B6:B7)'],
        ['  Besi beton 10 mm', 20670000],
        ['  Besi beton 13 mm', 19200000],
        ['Total', '=B2+B5']
    ]);
    s.setStyle('A1:B1', { bold: true, fill: '#eef2f7' });
    s.setStyle('A2:B2, A5:B5, A8:B8', { bold: true });
    s.setColProps('A', { width: 200 });
    s.setColProps('B', { format: { type: 'money', decimals: 0 }, width: 150 });
    s.groupRows('3:4');                                       // baru: rincian semen jadi satu grup
    s.groupRows('6:7');                                       // baru: rincian besi
    return wb;
}

export default function Halaman() {
    const [wb] = useState(buat);
    return (
        <div>
            <p>
                <button className="lipat" onClick={() => wb.sheet('Sheet1').showRowLevel(0)}>Lipat semua</button>{' '}
                <button className="buka" onClick={() => wb.sheet('Sheet1').showRowLevel(99)}>Buka semua</button>
            </p>
            <div style={{ height: 300 }}><Sheet workbook={wb} /></div>
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
const root = document.getElementById('root');
if (root) createRoot(root).render(<Halaman />);
