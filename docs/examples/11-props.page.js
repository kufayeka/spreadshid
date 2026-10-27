import { useEffect, useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import { createWorkbook, populate } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';
import { penjualan, CABANG } from './data/toko.js';

// Laporan per cabang: cabang dipilih di luar sheet, datanya datang lewat props. Workbook dibuat sekali, isinya diganti saat props berubah.
function buatTemplate() {
    const wb = createWorkbook();
    wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
    const lap = wb.sheet('Sheet1');
    lap.setSheetProps({ name: 'Transaksi', freezeRows: 1 });
    lap.setColProps('B', { format: { type: 'date' } });
    lap.setColProps('E:F', { format: { type: 'money', decimals: 0 } });
    lap.setColProps('C', { width: 180 });
    const rekap = wb.sheet(wb.addSheet('Rekap'));
    rekap.setValues('A1', [['Transaksi', '=COUNT(Transaksi!A:A)'], ['Omzet', '=SUM(Transaksi!F:F)']]);
    rekap.setColProps('B', { format: { type: 'money', decimals: 0 }, width: 140 });
    return wb;
}

function LaporanCabang({ data, sheet, onSheetChange }) {
    // useState dengan fungsi: workbook dibuat SEKALI untuk umur komponen ini, tidak setiap render
    const [wb] = useState(buatTemplate);
    // props berubah: isi tabelnya diganti, workbook-nya tetap. Undo, sheet aktif, lebar kolom yang diatur orang, semuanya tetap
    useEffect(() => {
        wb.sheet('Transaksi').clear('A1:F1000', { source: 'remote' });     // remote: tidak masuk undo, ini bukan perubahan orang
        populate(wb, 'Transaksi', { at: 'A1', fields: ['No', 'Tanggal', 'Produk', 'Qty', 'Harga', 'Total'], header: true }, data, { source: 'remote' });
    }, [wb, data]);
    // sheet yang tampil dikontrol dari luar lewat props sheet + onSheetChange
    return <Sheet workbook={wb} sheet={wb.sheetIdByName(sheet)} onSheetChange={(id) => onSheetChange(wb.sheetProps(id).name)} style={{ height: 460 }} />;
}

export default function HalamanCabang() {
    const [cabang, setCabang] = useState('Jakarta');
    const [sheet, setSheet] = useState('Transaksi');
    const [data, setData] = useState([]);
    useEffect(() => {
        // di aplikasi: fetch('/api/penjualan?cabang=' + cabang)
        setData(penjualan(60).filter((x) => x.Cabang === cabang).map((x) => ({ ...x, Total: x.Qty * x.Harga * (1 - x.Diskon) })));
    }, [cabang]);
    return (
        <div>
            <p style={{ display: 'flex', gap: 8, margin: 8 }}>
                <select className="pilih-cabang" value={cabang} onChange={(e) => setCabang(e.target.value)}>{CABANG.map((c) => <option key={c}>{c}</option>)}</select>
                <button onClick={() => setSheet('Transaksi')}>Transaksi</button>
                <button onClick={() => setSheet('Rekap')}>Rekap</button>
                <span>Sheet aktif: {sheet}</span>
            </p>
            <LaporanCabang data={data} sheet={sheet} onSheetChange={setSheet} />
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
createRoot(document.getElementById('root')).render(<HalamanCabang />);
