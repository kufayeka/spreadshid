import { useRef, useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import '@kufayeka/sheet/style.css';
import { buatProyek } from './proyek/index.js';

// Workbook proyek di layar: sepuluh sheet yang saling terhubung, bisa diedit seperti Google Sheets.
export default function HalamanProyek() {
    const [wb] = useState(() => buatProyek());
    return (
        <div style={{ height: '100%' }}>
            <Sheet workbook={wb} fileName="Proyek Gedung A" />
        </div>
    );
}
// ----- tampilkan -----
// untuk gambar dan test: halaman yang sama, dengan workbook dan handle-nya terbuka di window
import { createRoot } from 'react-dom/client';
function UntukGambar() {
    const [wb] = useState(() => buatProyek());
    const sheet = useRef(null);
    window.__workbook = wb;
    window.__sheet = sheet;
    return <div style={{ height: '100%' }}><Sheet ref={sheet} workbook={wb} fileName="Proyek Gedung A" /></div>;
}
createRoot(document.getElementById('root')).render(<UntukGambar />);
