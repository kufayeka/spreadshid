// app/penjualan/[id]/page.js  (Next.js App Router, server component)
// Workbook dibaca dari database di server, lalu diberikan ke client component sebagai props. Halaman langsung tampil berisi, tanpa "Memuat…".
import { db } from '@/lib/db';                         // koneksi database milik aplikasimu
import { LembarPenjualan } from './LembarPenjualan';

export default async function Page({ params }) {
    const { id } = await params;
    const doc = await db.workbooks.findJson(id);       // JSON hasil wb.toJSON() yang dulu disimpan (bab 12)
    if (!doc) return <p>Workbook tidak ada</p>;
    return (
        <main style={{ height: '100vh' }}>
            <LembarPenjualan id={id} doc={doc} />
        </main>
    );
}
