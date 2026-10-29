import { useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import { createWorkbook, type AccessRow } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';
import { PROGRES } from './data/proyek.js';

// 12.12 Form sebagai pintu input, tabel sebagai sumber data, dashboard read-only: orang lapangan mengisi progres lewat form biasa,
// angkanya masuk ke tabel Progres, dan chart di sheet Dashboard langsung ikut berubah. Dashboard tidak bisa diedit siapa pun.
function buat() {
    const wb = createWorkbook();
    wb.setSettings({ locale: 'id-ID' });
    const tabel = wb.sheet('Sheet1');
    tabel.setSheetProps({ name: 'Progres' });
    tabel.setValues('A1', [['Proyek', 'Minggu', 'Aktual', 'Rencana'], ...PROGRES]);
    tabel.setColProps('C:D', { format: { type: 'percent', decimals: 2 } });
    const dash = wb.sheet(wb.addSheet('Dashboard'));
    dash.setValues('A1', [['Rata-rata deviasi', '=AVERAGE(Progres!C2:C8)-AVERAGE(Progres!D2:D8)']]);
    dash.setStyle('B1', { bold: true, format: { type: 'percent', decimals: 2 } });
    dash.setColProps('A', { width: 140 });
    dash.addChart({ at: 'A3:H18', data: 'Progres!A1:D8', type: 'bullet', title: 'Progres per proyek', series: [{ hidden: true }] });
    return wb;
}
// baru: dashboard hanya untuk dibaca, chart pun tidak bisa digeser atau diubah
const akses: AccessRow[] = [{ who: '*', effect: 'allow', action: 'read' }];

export default function Halaman() {
    const [wb] = useState(buat);
    const [proyek, setProyek] = useState(PROGRES[0][0]);
    const [aktual, setAktual] = useState('');
    // baru: form biasa milik aplikasi Anda; tombolnya menulis ke tabel lewat kode (kode tidak dibatasi aturan akses, orang yang dibatasi)
    function simpan() {
        const baris = PROGRES.findIndex((p) => p[0] === proyek) + 2;
        const angka = Number(aktual.replace(',', '.')) / 100;
        if (!Number.isFinite(angka)) return;
        wb.sheet('Progres').setValues('C' + baris, angka);
        setAktual('');
    }
    return (
        <div>
            <form className="form-progres" onSubmit={(e) => { e.preventDefault(); simpan(); }} style={{ display: 'flex', gap: 8, alignItems: 'end', marginBottom: 10 }}>
                <label>Proyek<br /><select value={proyek} onChange={(e) => setProyek(e.target.value)}>{PROGRES.map((p) => <option key={p[0]}>{p[0]}</option>)}</select></label>
                <label>Aktual (%)<br /><input value={aktual} onChange={(e) => setAktual(e.target.value)} placeholder="mis. 74,2" /></label>
                <button type="submit">Simpan progres</button>
            </form>
            <div style={{ height: 420 }}>
                <Sheet workbook={wb} sheet={wb.sheetIdByName('Dashboard')} access={{ rows: akses, who: 'tamu' }} marks={false} />
            </div>
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
const root = document.getElementById('root');
if (root) createRoot(root).render(<Halaman />);
