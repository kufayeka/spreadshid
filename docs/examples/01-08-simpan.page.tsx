import { useEffect, useState } from 'react';
import { Sheet, useWorkbook } from '@kufayeka/sheet';
import { createWorkbook } from '@kufayeka/sheet/core';
import type { Workbook, WorkbookDoc } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';

// 1.8 Menyimpan: tahu kapan ada perubahan, lalu ambil isinya sebagai JSON. Di sini disimpan di browser (localStorage);
// menyimpan ke server dibahas di bab 9.
const KUNCI = 'stok-toko';

function buatProduk() {
    const wb = createWorkbook();
    wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
    const s = wb.sheet('Sheet1');
    s.setSheetProps({ name: 'Produk', freezeRows: 1 });
    s.setValues('A1', [
        ['Kode', 'Produk', 'Harga', 'Stok', 'Nilai stok'],
        ['SMN-01', 'Semen Portland 50 kg', 72000, 420, '=C2*D2'],
        ['BSI-10', 'Besi beton 10 mm', 79500, 260, '=C3*D3'],
        ['CAT-05', 'Cat tembok 5 kg', 145000, 64, '=C4*D4'],
        ['', 'Total', '', '=SUM(D2:D4)', '=SUM(E2:E4)']
    ]);
    s.setStyle('A1:E1', { bold: true, fill: '#eef2f7' });
    s.setStyle('A5:E5', { bold: true });
    s.setColProps('C', { format: { type: 'money', decimals: 0 } });
    s.setColProps('E', { format: { type: 'money', decimals: 0 }, width: 140 });
    s.setColProps('B', { width: 180 });
    return wb;
}

export default function Halaman() {
    // baru: workbook dibuat di useEffect, yaitu di browser saja (localStorage hanya ada di browser)
    const [wb, setWb] = useState<Workbook | null>(null);
    useEffect(() => {
        const tersimpan = localStorage.getItem(KUNCI);
        setWb(tersimpan ? createWorkbook(JSON.parse(tersimpan) as WorkbookDoc) : buatProduk());
    }, []);

    const adaPerubahan = useWorkbook(wb, (w) => w.unsaved());                            // baru: true setelah orang mengubah sesuatu

    function simpan() {                                                                 // baru
        if (!wb) return;
        localStorage.setItem(KUNCI, JSON.stringify(wb.toJSON()));                       // isi workbook sebagai JSON
        wb.saved();                                                                     // tandai: semua sudah tersimpan
    }

    if (!wb) return <p>Memuat…</p>;
    return (
        <div>
            <p>
                <button className="simpan" onClick={simpan} disabled={!adaPerubahan}>{adaPerubahan ? 'Simpan' : 'Tersimpan'}</button>
            </p>
            <div style={{ height: 300 }}>
                <Sheet workbook={wb} fileName="Stok toko" />
            </div>
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
const root = document.getElementById('root');
if (root) createRoot(root).render(<Halaman />);
