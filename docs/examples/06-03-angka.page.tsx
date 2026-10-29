import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import { createWorkbook } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';

// 6.3 Format angka: nilai yang sama, ditampilkan sebagai uang, persen, tanggal, dan angka dengan desimal.
function buat() {
    const wb = createWorkbook();
    wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
    const s = wb.sheet('Sheet1');
    s.setValues('A1', [
        ['Format', 'Nilai yang disimpan', 'Yang tampil'],
        ['money', 1250000, 1250000],
        ['percent', 0.115, 0.115],
        ['date', 46323, 46323],
        ['number, 2 desimal', 1250.5, 1250.5],
        ['money, simbol sendiri', 1250000, 1250000]
    ]);
    s.setStyle('A1:C1', { bold: true, fill: '#eef2f7' });
    // baru: satu format per sel di kolom C; kolom B dibiarkan tanpa format, supaya terlihat nilai aslinya
    s.setStyle('C2', { format: { type: 'money', decimals: 0 } });
    s.setStyle('C3', { format: { type: 'percent', decimals: 1 } });
    s.setStyle('C4', { format: { type: 'date', pattern: 'dddd, d MMMM yyyy' } });
    s.setStyle('C5', { format: { type: 'number', decimals: 2 } });
    s.setStyle('C6', { format: { type: 'money', decimals: 0, symbol: 'IDR' } });
    s.setColProps('A', { width: 170 });
    s.setColProps('B:C', { width: 190 });
    return wb;
}

export default function Halaman() {
    const [wb] = useState(buat);
    return <div style={{ height: 320 }}><Sheet workbook={wb} /></div>;
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
const root = document.getElementById('root');
if (root) createRoot(root).render(<Halaman />);
