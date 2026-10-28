import { useEffect, useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import type { SheetSelection } from '@kufayeka/sheet';
import { createWorkbook, validateAccess } from '@kufayeka/sheet/core';
import type { Workbook, AccessRow, Who } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';

// Editor hak akses buatan aplikasimu sendiri, di luar sheet:
// 1. pilih range di sheet  2. pilih siapa dan aturannya  3. Tambah  4. "Lihat sebagai" untuk mencoba  5. baris-barisnya disimpan ke tabel database.

function buatStok(): Workbook {
    const wb = createWorkbook();
    wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
    const s = wb.sheet('Sheet1');
    s.setSheetProps({ name: 'Produk', freezeRows: 1 });
    s.setValues('A1', [
        ['Kode', 'Produk', 'Harga beli', 'Harga jual', 'Stok'],
        ['SMN-01', 'Semen 50 kg', 64000, 72000, 420],
        ['BSI-10', 'Besi 10 mm', 68000, 79500, 260],
        ['CAT-05', 'Cat 5 kg', 118000, 145000, 64],
        ['PSR-01', 'Pasir m3', 245000, 290000, 31]
    ]);
    s.setStyle('A1:E1', { bold: true, fill: '#e8f0fe' });
    s.setColProps('C:D', { format: { type: 'money', decimals: 0 } });
    s.setColProps('B', { width: 130 });
    return wb;
}

// aturan awal: pemilik boleh semua, kasir dan gudang membaca tabelnya, gudang mengubah stok
const ATURAN_AWAL: AccessRow[] = [
    { who: 'user:yeka', effect: 'allow', action: '*' },
    { who: 'role:kasir', effect: 'allow', action: 'read', where: 'Produk!A1:E5' },
    { who: 'role:gudang', effect: 'allow', action: 'read', where: 'Produk!A1:E5' },
    { who: 'role:gudang', effect: 'allow', action: 'edit', where: 'Produk!col:Stok' }
];
// akun untuk "lihat sebagai": akun + role-nya, seperti yang diberikan sesi login aplikasimu
const AKUN: Record<string, { nama: string; who: Who }> = {
    'user:yeka': { nama: 'Yeka (pemilik)', who: { user: 'yeka' } },
    'user:rina': { nama: 'Rina (kasir)', who: { user: 'rina', roles: ['kasir'] } },
    'user:joko': { nama: 'Joko (gudang)', who: { user: 'joko', roles: ['gudang'] } }
};
// pilihan aturan untuk satu range: effect + action, dengan kata yang dimengerti orang
const ATURAN = {
    edit: { effect: 'allow', action: 'edit', label: 'boleh diubah' },
    read: { effect: 'allow', action: 'read', label: 'hanya baca' },
    hidden: { effect: 'deny', action: 'read', label: 'tersembunyi (•••)' },
    invisible: { effect: 'deny', action: 'see', label: 'tidak terlihat' }
} as const;
type Pilihan = keyof typeof ATURAN;

export default function EditorAkses() {
    const [wb] = useState(buatStok);
    const [rows, setRows] = useState<AccessRow[]>(ATURAN_AWAL);
    const [pilihan, setPilihan] = useState<SheetSelection | null>(null);   // seleksi terakhir di sheet
    const [siapa, setSiapa] = useState('role:kasir');
    const [aturan, setAturan] = useState<Pilihan>('read');
    const [sebagai, setSebagai] = useState('user:yeka');    // "lihat sebagai": pemilik melihat semuanya

    // setiap kali aturan atau "lihat sebagai" berubah, sheet langsung menerapkannya
    useEffect(() => { wb.setAccess(rows, AKUN[sebagai].who); }, [wb, rows, sebagai]);

    // satu aturan baru = satu baris baru
    function tambah() {
        if (!pilihan) return;
        const { effect, action } = ATURAN[aturan];
        setRows([...rows, { who: siapa, effect, action, where: pilihan.sheet.name + '!' + pilihan.address }]);
    }
    const hapus = (i: number) => setRows(rows.filter((_, j) => j !== i));
    const masalah = validateAccess(rows);

    return (
        <div style={{ display: 'flex', height: 520, font: '13px system-ui' }}>
            <Sheet workbook={wb} style={{ flex: 1 }} onSelectionChange={setPilihan} />
            <aside className="editor-akses" style={{ width: 360, padding: 12, borderLeft: '1px solid #dadce0', overflow: 'auto' }}>
                <h3 style={{ margin: '0 0 8px' }}>Aturan akses</h3>
                <p>Range terpilih: <b className="range-terpilih">{pilihan ? pilihan.sheet.name + '!' + pilihan.address : '-'}</b></p>
                <p>
                    <select className="pilih-peran" value={siapa} onChange={(e) => setSiapa(e.target.value)}>
                        <option value="role:kasir">role:kasir</option><option value="role:gudang">role:gudang</option>
                        <option value="user:rina">user:rina</option><option value="*">semua orang</option>
                    </select>{' '}
                    <select className="pilih-mode" value={aturan} onChange={(e) => setAturan(e.target.value as Pilihan)}>
                        {(Object.keys(ATURAN) as Pilihan[]).map((k) => <option key={k} value={k}>{ATURAN[k].label}</option>)}
                    </select>{' '}
                    <button className="tambah-aturan" onClick={tambah} disabled={!pilihan}>Tambah</button>
                </p>
                <table className="daftar-aturan" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr><th align="left">who</th><th align="left">effect</th><th align="left">action</th><th align="left">where</th><th /></tr></thead>
                    <tbody>
                        {rows.map((r, i) => (
                            <tr key={i} style={{ borderTop: '1px solid #eee' }}>
                                <td>{r.who}</td><td>{r.effect}</td><td>{r.action}</td><td>{r.where ?? ''}</td>
                                <td><button onClick={() => hapus(i)}>✕</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <p>
                    Lihat sebagai <select className="lihat-sebagai" value={sebagai} onChange={(e) => setSebagai(e.target.value)}>
                        {Object.entries(AKUN).map(([id, a]) => <option key={id} value={id}>{a.nama}</option>)}
                    </select>
                </p>
                <p style={{ color: masalah.length ? '#d93025' : '#188038' }}>{masalah.length ? masalah.map((m) => 'baris ' + (m.row + 1) + ': ' + m.problem).join('; ') : 'Aturan sah, siap disimpan'}</p>
            </aside>
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
createRoot(document.getElementById('root')!).render(<EditorAkses />);
