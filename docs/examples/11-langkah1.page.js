import { Sheet } from '@kufayeka/sheet';
import '@kufayeka/sheet/style.css';

// Langkah 1: sheet kosong. Satu komponen, satu tinggi. Orang sudah bisa mengetik, menghitung, dan mengunduh Excel.
export default function Halaman() {
    return <div style={{ height: 400 }}><Sheet /></div>;
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
createRoot(document.getElementById('root')).render(<Halaman />);
