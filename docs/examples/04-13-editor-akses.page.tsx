import { useEffect, useRef, useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import type { SheetSelection, SheetHandle } from '@kufayeka/sheet';
import { createWorkbook, validateAccess, accessColor } from '@kufayeka/sheet/core';
import type { Workbook, AccessRow, Who } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';

// Layar pengaturan hak akses buatan aplikasimu sendiri, di luar sheet:
// 1. Mode "Pengaturan": setiap sel yang kena aturan diberi kotak warna kecil, satu per who
// 2. pilih range di sheet, pilih siapa dan aturannya, Tambah: satu baris baru
// 3. klik baris di daftar: range-nya bergaris dan terpilih di sheet. Klik kotak di sel: barisnya terpilih di daftar
// 4. Mode "Lihat sebagai ...": sheet seperti yang dilihat orang itu (gembok di sel hanya-baca, mata di sel tersembunyi)
// 5. baris-barisnya disimpan ke tabel database

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
// mode layar: pengaturan, atau sheet seperti dilihat seseorang (akun + role-nya, seperti dari sesi login aplikasimu)
const MODE: Record<string, { nama: string; who: Who }> = {
    setup: { nama: 'Pengaturan', who: { user: 'yeka' } },
    rina: { nama: 'Lihat sebagai Rina (kasir)', who: { user: 'rina', roles: ['kasir'] } },
    joko: { nama: 'Lihat sebagai Joko (gudang)', who: { user: 'joko', roles: ['gudang'] } }
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
    const sheet = useRef<SheetHandle>(null);
    const [rows, setRows] = useState<AccessRow[]>(ATURAN_AWAL);
    const [pilihan, setPilihan] = useState<SheetSelection | null>(null);   // seleksi terakhir di sheet
    const [dipilih, setDipilih] = useState<number | null>(null);           // baris aturan yang dipilih
    const [siapa, setSiapa] = useState('role:kasir');
    const [aturan, setAturan] = useState<Pilihan>('read');
    const [mode, setMode] = useState('setup');

    // satu aturan baru = satu baris baru, langsung terpilih
    function tambah() {
        if (!pilihan) return;
        const { effect, action } = ATURAN[aturan];
        setRows([...rows, { who: siapa, effect, action, where: pilihan.sheet.name + '!' + pilihan.address }]);
        setDipilih(rows.length);
    }
    const hapus = (i: number) => { setRows(rows.filter((_, j) => j !== i)); setDipilih(null); };
    // memilih baris di daftar: range-nya juga terpilih di sheet
    function pilih(i: number) {
        setDipilih(i);
        const where = rows[i].where;
        if (where) sheet.current?.select(where.includes('!') ? where.slice(where.indexOf('!') + 1) : where);
    }
    // sheet yang dilihat sebagai orang lain: tidak ada yang dipilih
    useEffect(() => { if (mode !== 'setup') setDipilih(null); }, [mode]);
    const masalah = validateAccess(rows);

    return (
        <div style={{ display: 'flex', height: 520, font: '13px system-ui' }}>
            <Sheet ref={sheet} workbook={wb} style={{ flex: 1 }} onSelectionChange={setPilihan}
                access={{ rows, who: MODE[mode].who, view: mode === 'setup' ? 'setup' : 'live', selected: dipilih, onSelect: setDipilih }} />
            <aside className="editor-akses" style={{ width: 380, padding: 12, borderLeft: '1px solid #dadce0', overflow: 'auto' }}>
                <h3 style={{ margin: '0 0 8px' }}>Aturan akses</h3>
                <p>
                    Mode <select className="lihat-sebagai" value={mode} onChange={(e) => setMode(e.target.value)}>
                        {Object.entries(MODE).map(([id, m]) => <option key={id} value={id}>{m.nama}</option>)}
                    </select>
                </p>
                <p>Range terpilih: <b className="range-terpilih">{pilihan ? pilihan.sheet.name + '!' + pilihan.address : '-'}</b></p>
                <p>
                    <select className="pilih-peran" value={siapa} onChange={(e) => setSiapa(e.target.value)}>
                        <option value="role:kasir">role:kasir</option><option value="role:gudang">role:gudang</option>
                        <option value="user:rina">user:rina</option><option value="*">semua orang</option>
                    </select>{' '}
                    <select className="pilih-mode" value={aturan} onChange={(e) => setAturan(e.target.value as Pilihan)}>
                        {(Object.keys(ATURAN) as Pilihan[]).map((k) => <option key={k} value={k}>{ATURAN[k].label}</option>)}
                    </select>{' '}
                    <button className="tambah-aturan" onClick={tambah} disabled={!pilihan || mode !== 'setup'}>Tambah</button>
                </p>
                <table className="daftar-aturan" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr><th /><th align="left">who</th><th align="left">effect</th><th align="left">action</th><th align="left">where</th><th /></tr></thead>
                    <tbody>
                        {rows.map((r, i) => (
                            <tr key={i} onClick={() => pilih(i)} style={{ borderTop: '1px solid #eee', cursor: 'pointer', background: i === dipilih ? '#e8f0fe' : undefined }}>
                                {/* warna yang sama dengan kotak di sheet */}
                                <td><i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: accessColor(r.who) }} /></td>
                                <td>{r.who}</td><td>{r.effect}</td><td>{r.action}</td><td>{r.where ?? ''}</td>
                                <td><button onClick={(e) => { e.stopPropagation(); hapus(i); }}>✕</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <p style={{ color: masalah.length ? '#d93025' : '#188038' }}>{masalah.length ? masalah.map((m) => 'baris ' + (m.row + 1) + ': ' + m.problem).join('; ') : 'Aturan sah, siap disimpan'}</p>
            </aside>
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
createRoot(document.getElementById('root')!).render(<EditorAkses />);
