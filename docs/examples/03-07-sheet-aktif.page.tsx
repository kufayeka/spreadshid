import { useState } from 'react';
import { Sheet, useWorkbook } from '@kufayeka/sheet';
import '@kufayeka/sheet/style.css';
import { buatProduk } from './data/produk.js';

// 3.7 Sheet yang tampil diatur oleh aplikasimu: tombol sendiri di luar sheet, dan tetap ikut kalau tab di sheet diklik.
function buatDuaSheet() {
    const wb = buatProduk();
    const catatan = wb.sheet(wb.addSheet('Catatan'));
    catatan.setValues('A1', [['Tanggal', 'Catatan'], ['2026-10-28', 'Semen datang 100 zak']]);
    return wb;
}

export default function Halaman() {
    const [wb] = useState(buatDuaSheet);
    const [aktif, setAktif] = useState<string>(() => wb.sheetIds()[0]);          // baru: id sheet yang tampil
    const ids = useWorkbook(wb, (w) => w.sheetIds().join(','));                  // daftar sheet, ikut kalau sheet ditambah

    return (
        <div>
            <p>
                {ids.split(',').map((id) => (
                    <button key={id} className={'ke-' + wb.sheetProps(id).name} onClick={() => setAktif(id)}
                        style={{ fontWeight: id === aktif ? 700 : 400, marginRight: 6 }}>{wb.sheetProps(id).name}</button>
                ))}
            </p>
            <div style={{ height: 280 }}>
                <Sheet workbook={wb} sheet={aktif} onSheetChange={setAktif} />       {/* baru */}
            </div>
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
const root = document.getElementById('root');
if (root) createRoot(root).render(<Halaman />);
