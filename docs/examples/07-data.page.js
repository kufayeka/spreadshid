import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import { createWorkbook } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';

function buat() {
    const wb = createWorkbook();
    wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
    const sh = wb.sheet('Sheet1');
    sh.setValues('A1', [
        ['Pekerjaan', 'Volume', 'Progres', 'Status', 'Selesai'],
        ['1. Tanah', '', '', '', ''],
        ['Galian', 120, 1, 'Selesai', true],
        ['Urugan', 40, 0.4, 'Terlambat', false],
        ['2. Beton', '', '', '', ''],
        ['Pondasi', 18.5, 0.75, 'Jalan', false],
        ['Kolom', 12, 0.1, 'Terlambat', false]
    ]);
    sh.setStyle('A1:E1', { bold: true, fill: '#e8f0fe' });
    sh.setStyle('A2, A5', { bold: true });
    sh.setStyle('C2:C7', { format: { type: 'percent', decimals: 0 } });
    sh.setColProps('A', { width: 140 });
    sh.groupRows('3:4');
    sh.groupRows('6:7');
    sh.addValidation('D2:D20', { kind: 'list', values: ['Jalan', 'Selesai', 'Terlambat'] });
    sh.addValidation('E2:E20', { kind: 'checkbox' });
    sh.addConditional('D2:D20', { op: 'textIs', a: 'terlambat', style: { fill: '#f4c7c3', color: '#a50e0e' } });
    sh.addConditional('C2:C20', { kind: 'scale', min: { type: 'number', value: 0, color: '#ffffff' }, max: { type: 'number', value: 1, color: '#57bb8a' } });
    sh.createFilter('A1:E7');
    return wb;
}

export default function HalamanData() {
    const [wb] = useState(buat);
    return <div style={{ height: 600 }}><Sheet workbook={wb} /></div>;
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
createRoot(document.getElementById('root')).render(<HalamanData />);
