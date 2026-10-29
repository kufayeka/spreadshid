import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import { createWorkbook } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';

// 6.5 Locale: isi yang sama, ditulis menurut kebiasaan negara lain. Tombol mengganti locale dan mata uang workbook.
function buat() {
    const wb = createWorkbook();
    wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
    const s = wb.sheet('Sheet1');
    s.setValues('A1', [['Harga', 'Tanggal', 'Diskon', 'Qty'], [1250000, 46323, 0.115, 1250.5]]);
    s.setStyle('A1:D1', { bold: true, fill: '#eef2f7' });
    s.setStyle('A2', { format: { type: 'money', decimals: 0 } });
    s.setStyle('B2', { format: { type: 'date' } });
    s.setStyle('C2', { format: { type: 'percent', decimals: 1 } });
    s.setStyle('D2', { format: { type: 'number', decimals: 1 } });
    s.setColProps('A:D', { width: 140 });
    return wb;
}

export default function Halaman() {
    const [wb] = useState(buat);
    return (
        <div>
            <p>
                {/* baru: setSettings mengganti locale dan mata uang; semua sel ikut ditampilkan ulang */}
                <button className="id" onClick={() => wb.setSettings({ locale: 'id-ID', currency: 'IDR' })}>Indonesia</button>{' '}
                <button className="us" onClick={() => wb.setSettings({ locale: 'en-US', currency: 'USD' })}>Amerika</button>{' '}
                <button className="de" onClick={() => wb.setSettings({ locale: 'de-DE', currency: 'EUR' })}>Jerman</button>
            </p>
            <div style={{ height: 230 }}><Sheet workbook={wb} /></div>
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
const root = document.getElementById('root');
if (root) createRoot(root).render(<Halaman />);
