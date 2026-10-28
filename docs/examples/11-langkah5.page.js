import { useEffect, useState } from 'react';
import { Sheet, useWorkbook } from '@kufayeka/sheet';
import { createWorkbook } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';
import { ambilWorkbook, simpanContent } from './data/api.js';

// Langkah 5: tombol Simpan. Seluruh isi workbook dikirim sebagai satu JSON, dan disimpan sebagai satu baris di database.
export default function Halaman() {
    const [wb, setWb] = useState(null);
    useEffect(() => { ambilWorkbook('penjualan').then((doc) => setWb(createWorkbook(doc))); }, []);
    // true kalau ada yang diubah sejak simpan terakhir
    const adaPerubahan = useWorkbook(wb, (w) => w.unsaved());
    if (!wb) return <p>Memuat…</p>;

    async function simpan() {
        await simpanContent('penjualan', wb.toJSON());   // di aplikasimu: fetch(..., { method: 'PUT', body: JSON.stringify(wb.toJSON()) })
        wb.saved();                                      // workbook mencatat: semua sudah tersimpan
    }
    return (
        <div>
            <button className="simpan" disabled={!adaPerubahan} onClick={simpan}>{adaPerubahan ? 'Simpan' : 'Tersimpan'}</button>
            <div style={{ height: 400 }}><Sheet workbook={wb} /></div>
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
createRoot(document.getElementById('root')).render(<Halaman />);
