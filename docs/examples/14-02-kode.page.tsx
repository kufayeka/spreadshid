import { useState } from 'react';
import { Sheet, useWorkbook } from '@kufayeka/sheet';
import { createWorkbook } from '@kufayeka/sheet/core';
import type { PivotSpec, Workbook } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';

// 14.2 Pivot lewat kode React: aplikasi yang membuat pivot, dan tombol aplikasi yang mengganti cara meringkasnya.
// Data: peminjaman buku di perpustakaan kampus, satu baris per peminjaman. Pustakawan ingin melihat jumlah pinjaman
// menurut tiga sudut pandang tanpa harus mengerti pengaturan pivot: per fakultas, per kategori buku, atau per bulan.
const SUDUT: Record<string, PivotSpec> = {
    fakultas: { rows: ['Fakultas'], values: [{ field: 'Judul', fn: 'COUNTA', as: 'Pinjaman' }], sort: { Fakultas: { by: 'Pinjaman', dir: 'desc' } } },
    kategori: { rows: ['Kategori'], columns: ['Fakultas'], values: [{ field: 'Judul', fn: 'COUNTA', as: 'Pinjaman' }] },
    bulan: { rows: ['Tanggal'], group: { Tanggal: 'month' }, values: [{ field: 'Judul', fn: 'COUNTA', as: 'Pinjaman' }, { field: 'Peminjam', fn: 'COUNTUNIQUE', as: 'Mahasiswa' }] }
};

function buatPerpustakaan(): Workbook {
    const wb = createWorkbook();
    const s = wb.sheet('Sheet1');
    s.setSheetProps({ name: 'Peminjaman' });
    s.setValues('A1', [
        ['Tanggal',    'Peminjam', 'Fakultas', 'Kategori',  'Judul'],
        ['2026-09-02', 'Nadia',    'Teknik',   'Komputer',  'Algoritma dan Struktur Data'],
        ['2026-09-05', 'Raka',     'Ekonomi',  'Bisnis',    'Pengantar Akuntansi'],
        ['2026-09-18', 'Nadia',    'Teknik',   'Matematika','Kalkulus Jilid 1'],
        ['2026-10-01', 'Laras',    'Hukum',    'Hukum',     'Hukum Perdata'],
        ['2026-10-07', 'Bayu',     'Teknik',   'Komputer',  'Basis Data'],
        ['2026-10-15', 'Raka',     'Ekonomi',  'Matematika','Statistika Bisnis'],
        ['2026-10-22', 'Sekar',    'Teknik',   'Komputer',  'Jaringan Komputer'],
        ['2026-11-03', 'Laras',    'Hukum',    'Hukum',     'Hukum Pidana'],
        ['2026-11-04', 'Bayu',     'Teknik',   'Matematika','Aljabar Linear']
    ]);
    // pivot dibuat oleh aplikasi, di sheet Ringkasan, dengan sudut pandang pertama
    const r = wb.sheet(wb.addSheet('Ringkasan'));
    r.addPivot('A1', 'Peminjaman!A1:E500', SUDUT.fakultas);
    wb.moveSheet('Ringkasan', 0);                                         // Ringkasan tampil lebih dulu
    return wb;
}

export default function Halaman() {
    const [wb] = useState(buatPerpustakaan);
    const [sudut, setSudut] = useState('fakultas');
    // id pivot dibaca dari workbook, dan ikut diperbarui saat workbook berubah
    const idPivot = useWorkbook(wb, (w) => w.sheet('Ringkasan').pivots()[0]?.id);

    function ganti(nama: string) {
        if (!idPivot) return;
        wb.sheet('Ringkasan').setPivot(idPivot, { spec: SUDUT[nama] });   // pengaturan diganti; tabelnya ditulis ulang
        setSudut(nama);
    }

    return (
        <div>
            <p style={{ font: '14px system-ui', display: 'flex', gap: 8 }}>
                {Object.keys(SUDUT).map((nama) => (
                    <button key={nama} className={'sudut-' + nama} onClick={() => ganti(nama)} disabled={sudut === nama}>Per {nama}</button>
                ))}
            </p>
            <div style={{ height: 300 }}>
                <Sheet workbook={wb} />
            </div>
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
const root = document.getElementById('root');
if (root) createRoot(root).render(<Halaman />);
