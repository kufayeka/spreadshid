import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import type { SheetNotice } from '@kufayeka/sheet';
import type { AccessRow } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';
import { buatProduk } from './data/produk.js';

// 2.13 Notifikasi sendiri: popup bawaan sheet dimatikan (notices={false}), semua pesannya masuk ke onNotice
// dan ditampilkan sebagai toast milik aplikasi, di pojok kanan bawah, bertumpuk, lalu hilang sendiri.

// Kasir boleh mengubah stok, tetapi harga hanya boleh diubah manajer, dan kasir tidak boleh membuat sheet baru.
const ATURAN: AccessRow[] = [
    { who: '*', effect: 'allow', action: '*' },
    { who: 'role:kasir', effect: 'deny', action: 'edit', where: 'Produk!C2:C4', message: 'Harga hanya bisa diubah oleh manajer' },
    { who: 'role:kasir', effect: 'deny', action: 'sheets.add', message: 'Sheet baru hanya dibuat oleh manajer' }
];

type Toast = { id: number; kind: SheetNotice['kind']; text: string };

const WARNA: Record<SheetNotice['kind'], string> = { refused: '#da1e28', error: '#a2191f', info: '#0f62fe', warning: '#8e6a00' };

let nomor = 0;

export default function Halaman() {
    const [wb] = useState(buatProduk);
    const [toasts, setToasts] = useState<Toast[]>([]);

    function padaPesan(n: SheetNotice) {
        // warning = kesalahan developer (misalnya baris akses yang salah tulis): ke console, bukan ke kasir
        if (n.kind === 'warning') {
            console.error('Aturan akses baris', n.index, 'salah:', n.problems, n.row);
            return;
        }
        // setiap tombol yang ditekan di sel terkunci ditolak lagi: pesan yang sama tidak ditumpuk, hanya diperpanjang
        const id = ++nomor;
        setToasts((daftar) => [...daftar.filter((t) => t.text !== n.reason), { id, kind: n.kind, text: n.reason }]);
        setTimeout(() => setToasts((daftar) => daftar.filter((t) => t.id !== id)), 4000);
    }

    return (
        <div data-siap style={{ height: 300, position: 'relative' }}>
            <Sheet
                workbook={wb}
                access={{ rows: ATURAN, who: { user: 'rina', roles: ['kasir'] } }}
                notices={false}                                                     // baru: popup bawaan mati
                onNotice={padaPesan}                                                // baru: semua pesan ke sini
            />
            <div style={{ position: 'absolute', right: 16, bottom: 16, display: 'grid', gap: 8 }}>
                {toasts.map((t) => (
                    <div key={t.id} className="toast" role="alert" style={{
                        padding: '10px 14px', borderRadius: 4, color: '#fff', background: WARNA[t.kind],
                        font: '14px system-ui', boxShadow: '0 2px 8px rgba(0,0,0,.25)'
                    }}>
                        {t.text}
                    </div>
                ))}
            </div>
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
const root = document.getElementById('root');
if (root) createRoot(root).render(<Halaman />);
