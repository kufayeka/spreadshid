import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import { createWorkbook } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';

function buat() {
    const wb = createWorkbook();
    wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
    const sh = wb.sheet('Sheet1');
    sh.setValues('A1', [
        ['Laporan Progres Mingguan'],
        ['Pekerjaan', 'Bobot', 'Rencana', 'Realisasi', 'Catatan'],
        ['Galian tanah', 0.15, 1, 1, 'Selesai sesuai jadwal'],
        ['Pondasi', 0.25, 0.8, 0.55, 'Hujan 3 hari, alat berat terlambat datang ke lokasi'],
        ['Struktur lantai 1', 0.35, 0.3, 0.1, '']
    ]);
    sh.mergeCells('A1:E1');
    sh.setStyle('A1', { bold: true, fontSize: 14, align: 'center', fill: '#1a73e8', color: '#ffffff' });
    sh.setStyle('A2:E2', { bold: true, fill: '#e8f0fe', align: 'center', valign: 'middle' });
    sh.setStyle('B3:D5', { format: { type: 'percent', decimals: 0 } });
    sh.setStyle('D4', { color: '#d93025', bold: true });
    sh.setStyle('E3:E5', { wrap: 'wrap', valign: 'top', italic: true });
    const garis = { style: 'solid', width: 1, color: '#5f6368' };
    sh.setStyle('A2:E5', { borders: { top: garis, right: garis, bottom: garis, left: garis } });
    sh.setRowProps('1', { height: 36 });
    sh.setRowProps('2', { height: 30 });
    sh.setColProps('A', { width: 150 });
    sh.setColProps('E', { width: 220 });
    return wb;
}

export default function HalamanGaya() {
    const [wb] = useState(buat);
    return <div style={{ height: 600 }}><Sheet workbook={wb} /></div>;
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
createRoot(document.getElementById('root')).render(<HalamanGaya />);
