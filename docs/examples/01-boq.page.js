import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import { createWorkbook } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';

// Isi workbook disiapkan oleh kode, lalu workbook-nya dikasih ke <Sheet>.
function buatBoq() {
    const wb = createWorkbook();
    wb.setSettings({ locale: 'id-ID', currency: 'IDR' });

    const boq = wb.sheet('Sheet1');
    boq.setSheetProps({ name: 'BOQ', freezeRows: 1 });
    boq.setValues('A1', [
        ['No', 'Pekerjaan', 'Volume', 'Satuan', 'Harga satuan', 'Jumlah'],
        [1, 'Galian tanah', 120, 'm3', 85000, '=C2*E2'],
        [2, 'Urugan pasir', 40, 'm3', 210000, '=C3*E3'],
        [3, 'Beton K-300', 18.5, 'm3', 1250000, '=C4*E4'],
        [4, 'Besi tulangan', 2400, 'kg', 14500, '=C5*E5'],
        ['', 'Total', '', '', '', '=SUM(F2:F5)']
    ]);
    boq.setStyle('A1:F1', { bold: true, fill: '#e8f0fe' });
    boq.setStyle('E2:F6', { format: { type: 'money', decimals: 0 } });
    boq.setStyle('A6:F6', { bold: true });
    boq.setColProps('B', { width: 160 });
    boq.setColProps('E:F', { width: 130 });
    return wb;
}

export default function HalamanBoq() {
    // useState dengan fungsi: workbook dibuat sekali, bukan tiap render
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
