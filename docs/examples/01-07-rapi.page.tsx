import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import { createWorkbook } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';

// 1.7 Dirapikan: angka Indonesia dan Rupiah, judul tebal, kolom lebih lebar, judul dibekukan.
function buatProduk() {
    const wb = createWorkbook();
    wb.setSettings({ locale: 'id-ID', currency: 'IDR' });               // baru: 1.250,5 dan Rp
    const s = wb.sheet('Sheet1');
    s.setSheetProps({ name: 'Produk', freezeRows: 1 });                 // baru: nama sheet, judul tetap di atas
    s.setValues('A1', [
        ['Kode', 'Produk', 'Harga', 'Stok', 'Nilai stok'],
        ['SMN-01', 'Semen Portland 50 kg', 72000, 420, '=C2*D2'],
        ['BSI-10', 'Besi beton 10 mm', 79500, 260, '=C3*D3'],
        ['CAT-05', 'Cat tembok 5 kg', 145000, 64, '=C4*D4'],
        ['', 'Total', '', '=SUM(D2:D4)', '=SUM(E2:E4)']
    ]);
    s.setStyle('A1:E1', { bold: true, fill: '#eef2f7' });              // baru: judul
    s.setStyle('A5:E5', { bold: true });                               // baru: baris total
    s.setColProps('C', { format: { type: 'money', decimals: 0 } });    // baru: Rupiah
    s.setColProps('E', { format: { type: 'money', decimals: 0 } });
    s.setColProps('B', { width: 180 });                                // baru: kolom nama lebih lebar
    s.setColProps('E', { width: 140 });
    return wb;
}

export default function Halaman() {
    const [wb] = useState(buatProduk);
    return (
        <div style={{ height: 300 }}>
            <Sheet workbook={wb} fileName="Stok toko" />                 {/* baru: nama file saat diunduh */}
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
const root = document.getElementById('root');
if (root) createRoot(root).render(<Halaman />);
