import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import { createWorkbook } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';

function buat() {
    const wb = createWorkbook();
    wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
    wb.setSheetProps('Sheet1', { name: 'BOQ' });
    const boq = wb.sheet('BOQ');
    boq.setValues('A1', [
        ['Pekerjaan', 'Volume', 'Harga', 'Status', 'Biaya internal'],
        ['Galian', 120, 85000, 'Draft', 70000],
        ['Urugan', 40, 210000, 'Approved', 180000],
        ['Beton', 18.5, 1250000, 'Draft', 1100000]
    ]);
    boq.setStyle('A1:E1', { bold: true, fill: '#e8f0fe' });
    boq.setStyle('C2:C4', { format: { type: 'money', decimals: 0 } });
    boq.setColProps('E', { width: 130 });
    wb.setRules([
        { sheet: 'BOQ', columns: ['Harga'], mode: 'readonly', message: 'Harga diatur estimator' },
        { sheet: 'BOQ', range: 'A2:E500', when: '=$D2="Approved"', mode: 'readonly', message: 'Baris yang sudah approved terkunci' },
        { sheet: 'BOQ', columns: ['Biaya internal'], mode: 'hidden' }
    ]);
    return wb;
}

export default function HalamanAturan() {
    const [wb] = useState(buat);
    // showProtected: sel yang dilindungi digambar bergaris, enak waktu menyusun aturan
    return <div style={{ height: 600 }}><Sheet workbook={wb} showProtected /></div>;
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
createRoot(document.getElementById('root')).render(<HalamanAturan />);
