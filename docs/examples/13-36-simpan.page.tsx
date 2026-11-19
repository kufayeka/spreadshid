import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import type { SheetSave } from '@kufayeka/sheet';
import type { AccessRow } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';
import { buatStok } from './data/stok-akses.js';

// 13.36 Tombol Save di menu File, diatur per role. Admin boleh ketiganya, supervisor tidak boleh menimpa file (hanya versi baru atau salinan),
// viewer tidak boleh menyimpan sama sekali dan tidak boleh membaca harga beli.
const ORANG_GRUP = { users: [{ id: 'yeka', name: 'Yeka Kufa' }, { id: 'sari', name: 'Sari Utami' }, { id: 'budi', name: 'Budi Santoso' }], groups: { admin: ['yeka'], spv: ['sari'], viewer: ['budi'] } };

const ATURAN: AccessRow[] = [
    { who: '*', effect: 'allow', action: '*' },
    { who: 'group:spv', effect: 'deny', action: 'file.save', message: 'Supervisor tidak menimpa file. Pakai Save as new version.' },
    { who: 'group:viewer', effect: 'deny', action: 'file.*', message: 'Kamu hanya bisa melihat file ini.' },
    { who: 'group:viewer', effect: 'deny', action: 'edit' },
    { who: 'group:viewer', effect: 'deny', action: 'read', where: 'Produk!col:Harga beli' }
];

const ORANG: Record<string, string> = {
    admin: 'yeka',
    spv: 'sari',
    viewer: 'budi'
};

export default function TombolSimpan() {
    const [wb] = useState(buatStok);
    const [siapa, setSiapa] = useState('viewer');
    const [catatan, setCatatan] = useState('Belum ada yang disimpan.');

    // satu fungsi untuk ketiga tombol; di aplikasi sungguhan di sinilah API dipanggil (lihat bab 9 bagian 7.8)
    async function simpan({ mode, doc }: SheetSave) {
        const kata = { save: 'menimpa file', saveAsNewVersion: 'membuat versi baru', saveAsACopy: 'membuat salinan' }[mode];
        setCatatan(ORANG[siapa] + ' ' + kata + ' (workbook ' + String(doc.id).slice(0, 8) + '…)');
    }

    return (
        <div style={{ height: 420, display: 'flex', flexDirection: 'column', font: '13px system-ui' }}>
            <div style={{ padding: '8px 12px', display: 'flex', gap: 12, alignItems: 'center', background: '#f1f3f4' }}>
                Lihat sebagai
                <select className="lihat-sebagai" value={siapa} onChange={(e) => setSiapa(e.target.value)}>
                    <option value="admin">admin (yeka)</option>
                    <option value="spv">supervisor (sari)</option>
                    <option value="viewer">viewer (budi)</option>
                </select>
                <span>{catatan}</span>
            </div>
            <Sheet workbook={wb} style={{ flex: 1 }} onSave={simpan} people={ORANG_GRUP} access={{ rows: ATURAN, who: ORANG[siapa] }} />
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
const root = document.getElementById('root');
if (root) createRoot(root).render(<TombolSimpan />);
