import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import { createWorkbook } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';

// Workbook dibuat oleh kode Anda, lalu diberikan ke <Sheet>.
function buatBoq() {
    const wb = createWorkbook();
    const [s] = wb.sheetIds();
    wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
    wb.setSheetProps(s, { name: 'BOQ', freezeRows: 1 });
    wb.setValues(s, 0, 0, [
        ['No', 'Pekerjaan', 'Volume', 'Satuan', 'Harga satuan', 'Jumlah'],
        [1, 'Galian tanah', 120, 'm3', 85000, '=C2*E2'],
        [2, 'Urugan pasir', 40, 'm3', 210000, '=C3*E3'],
        [3, 'Beton K-300', 18.5, 'm3', 1250000, '=C4*E4'],
        [4, 'Besi tulangan', 2400, 'kg', 14500, '=C5*E5'],
        ['', 'Total', '', '', '', '=SUM(F2:F5)']
    ]);
    wb.setStyle(s, { r1: 0, c1: 0, r2: 0, c2: 5 }, { bold: true, fill: '#e8f0fe' });
    wb.setStyle(s, { r1: 1, c1: 4, r2: 5, c2: 5 }, { format: { type: 'money', decimals: 0 } });
    wb.setStyle(s, { r1: 5, c1: 0, r2: 5, c2: 5 }, { bold: true });
    wb.setColProps(s, [1], { width: 160 });
    wb.setColProps(s, [4, 5], { width: 130 });
    return wb;
}

export default function HalamanBoq() {
    // useState dengan fungsi: workbook dibuat sekali saja, tidak setiap render
    const [wb] = useState(buatBoq);
    return (
        <div style={{ height: 600 }}>
            <Sheet workbook={wb} fileName="BOQ Gedung A" />
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
createRoot(document.getElementById('root')).render(<HalamanBoq />);
