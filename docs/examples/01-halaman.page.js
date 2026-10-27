import { Sheet } from '@kufayeka/sheet';
import '@kufayeka/sheet/style.css';

// Halaman paling sederhana: sheet kosong seperti Google Sheets.
// Sheet mengisi tinggi pembungkusnya, jadi pembungkus harus punya tinggi.
export default function Halaman() {
    return (
        <div style={{ height: 600 }}>
            <Sheet />
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
createRoot(document.getElementById('root')).render(<Halaman />);
