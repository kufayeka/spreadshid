import { useRef, useState } from 'react';
import { Sheet, useWorkbook } from '@kufayeka/sheet';
import '@kufayeka/sheet/style.css';
import { useWorkbookDariApi, useAutosave } from './11-hooks.js';
import { PRODUK } from './data/toko.js';

const STATUS = { tersimpan: 'Tersimpan', menunggu: 'Belum tersimpan', menyimpan: 'Menyimpan…', gagal: 'Gagal menyimpan' };
const rupiah = (n) => 'Rp ' + Math.round(n || 0).toLocaleString('id-ID');

// Bagian atas halaman: angka dari sheet, tombol yang tahu kapan bisa dipakai, status simpan. Bukan bagian dari <Sheet>, tapi ikut berubah bersamanya.
function Ringkasan({ wb, status, sheetRef }) {
    const omzet = useWorkbook(wb, (w) => w.value('Penjualan', 'N1'));
    const transaksi = useWorkbook(wb, (w) => w.value('Penjualan', 'N2'));
    const bisaUndo = useWorkbook(wb, (w) => w.canUndo());
    const bisaRedo = useWorkbook(wb, (w) => w.canRedo());
    return (
        <header className="kasir-atas" style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '6px 8px' }}>
            <b>Omzet <span className="kasir-omzet">{rupiah(omzet)}</span></b>
            <span><span className="kasir-jumlah">{transaksi}</span> transaksi</span>
            <button className="kasir-undo" disabled={!bisaUndo} onClick={() => wb.undo()}>Undo</button>
            <button disabled={!bisaRedo} onClick={() => wb.redo()}>Redo</button>
            <button onClick={() => sheetRef.current.select('N1')}>Ke total</button>
            <span className="kasir-status" style={{ marginLeft: 'auto', color: '#5f6368' }}>{STATUS[status]}</span>
        </header>
    );
}

// Detail baris yang sedang dipilih di sheet. Baris dipegang lewat id-nya, jadi tetap baris yang sama walau sheet di-sort atau disisipi baris
function Detail({ wb, rowId }) {
    const teks = useWorkbook(wb, (w) => {
        const r = rowId ? w.rowIndex('Penjualan', rowId) : -1;
        if (r < 1) return '';
        const d = (c) => w.display('Penjualan', r, c).text;
        return `No ${d(0)} · ${d(1)} · ${d(2)} (${d(3)})\n${d(5)}\n${d(7)} x ${d(8)}, diskon ${d(9)}\nTotal ${d(10)}`;
    });
    return <pre className="kasir-detail" style={{ font: 'inherit', whiteSpace: 'pre-wrap', minHeight: 80 }}>{teks || 'Pilih satu transaksi'}</pre>;
}

// Form React biasa yang menambah satu transaksi ke sheet. source 'user': aturan dan validasi sheet tetap berlaku
function TransaksiBaru({ wb, sheetRef }) {
    const [kode, setKode] = useState(PRODUK[0][0]);
    const [qty, setQty] = useState(1);
    const tambah = (e) => {
        e.preventDefault();
        const p = PRODUK.find((x) => x[0] === kode);
        const jual = wb.sheet('Penjualan');
        const r = wb.value('Penjualan', 'N2') + 1;            // nomor baris setelah transaksi terakhir (baris 0 adalah judul kolom)
        const n = r + 1;                                       // nomor baris seperti tertulis di layar, untuk rumus
        jual.setValues(r, 0, [[r, 46325, 'Jakarta', 'Rina', p[0], p[1], p[2], Number(qty), p[5], 0, `=H${n}*I${n}*(1-J${n})`]], { source: 'user' });
        sheetRef.current.select('A' + n);
        setQty(1);
    };
    return (
        <form className="kasir-form" onSubmit={tambah} style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <select style={{ width: '100%' }} value={kode} onChange={(e) => setKode(e.target.value)}>{PRODUK.map((p) => <option key={p[0]} value={p[0]}>{p[1]}</option>)}</select>
            <input className="kasir-qty" type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
            <button className="kasir-tambah">Tambah</button>
        </form>
    );
}

export default function Kasir() {
    const { wb } = useWorkbookDariApi('penjualan-oktober');
    const status = useAutosave(wb, 'penjualan-oktober');
    const sheetRef = useRef(null);
    const [rowId, setRowId] = useState(null);
    if (!wb) return <p>Memuat penjualan…</p>;
    return (
        <div style={{ height: 600, display: 'flex', flexDirection: 'column', font: '13px system-ui' }}>
            <Ringkasan wb={wb} status={status} sheetRef={sheetRef} />
            <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
                <Sheet ref={sheetRef} workbook={wb} style={{ flex: 1 }}
                    onSelectionChange={(sel) => setRowId(wb.rowId('Penjualan', sel.active.r))} />
                <aside style={{ width: 230, padding: 8, borderLeft: '1px solid #dadce0' }}>
                    <Detail wb={wb} rowId={rowId} />
                    <TransaksiBaru wb={wb} sheetRef={sheetRef} />
                </aside>
            </div>
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
createRoot(document.getElementById('root')).render(<Kasir />);
