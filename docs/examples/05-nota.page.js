import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import { createWorkbook } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';

// Nota belanja: semua yang dibahas di bagian dasar bab rumus ada di sini.
export function buatNota() {
    const wb = createWorkbook();
    wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
    const s = wb.sheet('Sheet1');
    s.setSheetProps({ name: 'Nota' });
    s.setValues('A1', [
        ['Produk', 'Harga', 'Qty', 'Jumlah'],
        ['Semen 50 kg', 72000, 10, '=B2*C2'],
        ['Besi 10 mm', 79500, 5, '=B3*C3'],
        ['Cat 5 kg', 145000, 2, '=B4*C4'],
        ['Subtotal', null, null, '=SUM(D2:D4)'],
        ['PPN', 0.11, null, '=D5*$B$6'],
        ['Total', null, null, '=D5+D6'],
        ['Terbilang', '=PROPER(TERBILANG(D7)) & " Rupiah"']
    ]);
    s.setValues('F1', [['Coba sendiri'], ['=2+3']]);
    s.setStyle('A1:D1', { bold: true, fill: '#e8f0fe' });
    s.setStyle('A5:D7', { bold: true });
    s.setStyle('B6', { format: { type: 'percent', decimals: 0 } });
    s.setStyle('F1', { bold: true, color: '#5f6368' });
    s.setColProps('B', { format: { type: 'money', decimals: 0 } });
    s.setColProps('D', { format: { type: 'money', decimals: 0 }, width: 130 });
    s.setColProps('A', { width: 120 });
    return wb;
}

export default function Nota() {
    const [wb] = useState(buatNota);
    return <div style={{ height: 380 }}><Sheet workbook={wb} /></div>;
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
createRoot(document.getElementById('root')).render(<Nota />);
