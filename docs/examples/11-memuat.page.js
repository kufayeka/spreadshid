import { Sheet } from '@kufayeka/sheet';
import '@kufayeka/sheet/style.css';
import { useWorkbookDariApi } from './11-hooks.js';

// Workbook dimuat dari API saat halaman dibuka. Selama memuat tampil teks, kalau gagal tampil pesan dan tombol coba lagi.
export default function HalamanPenjualan() {
    const { wb, error, cobaLagi } = useWorkbookDariApi('penjualan-oktober');
    if (error) return <p>Gagal memuat: {error} <button onClick={cobaLagi}>Coba lagi</button></p>;
    if (!wb) return <p>Memuat penjualan…</p>;
    return <div style={{ height: 520 }}><Sheet workbook={wb} fileName="Penjualan Oktober" /></div>;
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
createRoot(document.getElementById('root')).render(<HalamanPenjualan />);
