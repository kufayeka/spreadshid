'use client';
// app/stok/page.tsx  (Next.js App Router)
// 'use client' di baris pertama: halaman ini membuat workbook dan memakai state.
import { useEffect, useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import { createWorkbook } from '@kufayeka/sheet/core';
import type { Workbook } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';

function buatProduk(): Workbook {
    const wb = createWorkbook();
    wb.sheet('Sheet1').setValues('A1', [['Kode', 'Produk', 'Stok'], ['SMN-01', 'Semen Portland 50 kg', 420]]);
    return wb;
}

export default function Page() {
    // Next.js merender halaman sekali di server, lalu sekali lagi di browser. Workbook dibuat di useEffect (hanya di browser),
    // supaya id acak di dalamnya tidak berbeda antara keduanya (pesan "hydration mismatch").
    const [wb, setWb] = useState<Workbook | null>(null);
    useEffect(() => { setWb(buatProduk()); }, []);

    if (!wb) return <p>Memuat…</p>;
    return (
        <main style={{ height: '100vh' }}>
            <Sheet workbook={wb} />
        </main>
    );
}
