import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import { createWorkbook, populate } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';

// 4.5 Mengisi dari data API: daftar objek ditulis sebagai tabel, satu baris per objek, dengan judul kolom sendiri.
// Di aplikasimu, PESANAN datang dari fetch('/api/pesanan').
const PESANAN = [
    { id: 'PO-2611', tanggal: '28/10/2026', produk: 'Semen Portland 50 kg', qty: 40, status: 'Dikirim' },
    { id: 'PO-2612', tanggal: '28/10/2026', produk: 'Besi beton 10 mm', qty: 120, status: 'Diproses' },
    { id: 'PO-2613', tanggal: '29/10/2026', produk: 'Cat tembok 5 kg', qty: 15, status: { value: 'Terlambat', fill: '#f4c7c3', bold: true } }
];

function buat() {
    const wb = createWorkbook();
    wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
    // baru: populate menulis daftar objek mulai dari A1
    populate(wb, 'Sheet1', {
        at: 'A1',
        fields: ['id', 'tanggal', 'produk', 'qty', 'status'],                          // kolom yang diambil, dan urutannya
        header: { id: 'No. PO', tanggal: 'Tanggal', produk: 'Produk', qty: 'Qty', status: 'Status' }
    }, PESANAN);
    wb.sheet('Sheet1').setStyle('A1:E1', { bold: true, fill: '#eef2f7' });
    wb.sheet('Sheet1').setColProps('C', { width: 180 });
    return wb;
}

export default function Halaman() {
    const [wb] = useState(buat);
    return (
        <div style={{ height: 300 }}>
            <Sheet workbook={wb} />
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
const root = document.getElementById('root');
if (root) createRoot(root).render(<Halaman />);
