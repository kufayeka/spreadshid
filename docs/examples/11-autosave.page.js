import { Sheet } from '@kufayeka/sheet';
import '@kufayeka/sheet/style.css';
import { useWorkbookDariApi, useAutosave } from './11-hooks.js';

const TEKS = { tersimpan: 'Semua perubahan tersimpan', menunggu: 'Belum tersimpan…', menyimpan: 'Menyimpan…', gagal: 'Gagal menyimpan, mencoba lagi' };

export default function HalamanAutosave() {
    const { wb } = useWorkbookDariApi('penjualan-oktober');
    const status = useAutosave(wb, 'penjualan-oktober');
    if (!wb) return <p>Memuat penjualan…</p>;
    return (
        <div style={{ height: 560, display: 'flex', flexDirection: 'column' }}>
            <p className="status-simpan" style={{ margin: '4px 8px', color: status === 'gagal' ? '#d93025' : '#5f6368' }}>{TEKS[status]}</p>
            <Sheet workbook={wb} style={{ flex: 1 }} />
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
createRoot(document.getElementById('root')).render(<HalamanAutosave />);
