import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import '@kufayeka/sheet/style.css';
import { POLICY, buatStok } from './13-hak-akses.js';

// Workbook yang sama, dibuka oleh kasir: tanpa toolbar, tanpa menu Insert dan Format, kolom harga beli kosong, hanya Status yang bisa diubah.
export default function StokUntukKasir() {
    const [wb] = useState(buatStok);
    // access: policy dari database dan orang yang login (dari sesi login aplikasimu)
    return <div style={{ height: 480 }}><Sheet workbook={wb} access={{ policy: POLICY, who: 'user:rina' }} user={{ id: 'user:rina', name: 'Rina' }} /></div>;
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
createRoot(document.getElementById('root')).render(<StokUntukKasir />);
