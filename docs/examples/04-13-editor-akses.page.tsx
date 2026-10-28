import { useEffect, useState } from 'react';
import { Sheet } from '@kufayeka/sheet';
import { createWorkbook, validatePolicy } from '@kufayeka/sheet/core';
import '@kufayeka/sheet/style.css';

// Editor hak akses buatan aplikasimu sendiri, di luar sheet:
// 1. pilih range di sheet  2. pilih peran dan mode  3. Tambah  4. "Lihat sebagai" untuk mencoba  5. policy (JSON) disimpan ke database.

function buatStok() {
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

// policy awal: tiga peran, akun-akunnya, belum ada aturan per range
const POLICY_AWAL = {
    owners: ['user:yeka'],
    members: { 'user:rina': 'kasir', 'user:joko': 'gudang', 'user:dewi': 'manajer' },
    default: 'kasir',
    roles: {
        manajer: { can: ['edit', 'format', 'rows', 'sort', 'filter'], ranges: [] },
        kasir: { can: ['sort', 'filter'], ranges: [] },
        gudang: { can: ['filter'], ranges: [] }
    }
};
const AKUN = { 'user:yeka': 'Yeka (pemilik)', 'user:dewi': 'Dewi (manajer)', 'user:rina': 'Rina (kasir)', 'user:joko': 'Joko (gudang)' };
const MODE = { edit: 'boleh diubah', readonly: 'hanya baca', hidden: 'tersembunyi (•••)', invisible: 'tidak terlihat' };

export default function EditorAkses() {
    const [wb] = useState(buatStok);
    const [policy, setPolicy] = useState(POLICY_AWAL);
    const [pilihan, setPilihan] = useState(null);          // seleksi terakhir di sheet
    const [peran, setPeran] = useState('kasir');
    const [mode, setMode] = useState('readonly');
    const [sebagai, setSebagai] = useState('user:yeka');    // "lihat sebagai": pemilik melihat semuanya

    // setiap kali policy atau "lihat sebagai" berubah, sheet langsung menerapkannya
    useEffect(() => { wb.setAccess(policy, sebagai); }, [wb, policy, sebagai]);

    function tambah() {
        if (!pilihan) return;
        const aturan = { sheet: pilihan.sheet.name, range: pilihan.address, mode };
        setPolicy((p) => ({ ...p, roles: { ...p.roles, [peran]: { ...p.roles[peran], ranges: [...p.roles[peran].ranges, aturan] } } }));
    }
    function hapus(namaPeran, i) {
        setPolicy((p) => ({ ...p, roles: { ...p.roles, [namaPeran]: { ...p.roles[namaPeran], ranges: p.roles[namaPeran].ranges.filter((_, j) => j !== i) } } }));
    }
    const masalah = validatePolicy(policy);

    return (
        <div style={{ display: 'flex', height: 520, font: '13px system-ui' }}>
            <Sheet workbook={wb} style={{ flex: 1 }} onSelectionChange={setPilihan} />
            <aside className="editor-akses" style={{ width: 300, padding: 12, borderLeft: '1px solid #dadce0', overflow: 'auto' }}>
                <h3 style={{ margin: '0 0 8px' }}>Aturan akses</h3>
                <p>Range terpilih: <b className="range-terpilih">{pilihan ? pilihan.sheet.name + '!' + pilihan.address : '-'}</b></p>
                <p>
                    Untuk <select className="pilih-peran" value={peran} onChange={(e) => setPeran(e.target.value)}>
                        {Object.keys(policy.roles).map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>{' '}
                    <select className="pilih-mode" value={mode} onChange={(e) => setMode(e.target.value)}>
                        {Object.entries(MODE).map(([m, label]) => <option key={m} value={m}>{label}</option>)}
                    </select>{' '}
                    <button className="tambah-aturan" onClick={tambah} disabled={!pilihan}>Tambah</button>
                </p>
                {Object.entries(policy.roles).map(([namaPeran, r]) => (
                    <div key={namaPeran}>
                        <b>{namaPeran}</b>
                        <ul style={{ margin: '4px 0 8px', paddingLeft: 18 }}>
                            {r.ranges.length ? r.ranges.map((a, i) => (
                                <li key={i}>{a.sheet}!{a.range}: {MODE[a.mode]} <button onClick={() => hapus(namaPeran, i)}>✕</button></li>
                            )) : <li style={{ color: '#5f6368' }}>belum ada aturan</li>}
                        </ul>
                    </div>
                ))}
                <p>
                    Lihat sebagai <select className="lihat-sebagai" value={sebagai} onChange={(e) => setSebagai(e.target.value)}>
                        {Object.entries(AKUN).map(([id, nama]) => <option key={id} value={id}>{nama}</option>)}
                    </select>
                </p>
                <p style={{ color: masalah.length ? '#d93025' : '#188038' }}>{masalah.length ? masalah.map((m) => m.problem).join('; ') : 'Policy sah, siap disimpan'}</p>
                <details>
                    <summary>Policy (JSON yang disimpan)</summary>
                    <pre style={{ fontSize: 11 }}>{JSON.stringify(policy.roles, null, 1)}</pre>
                </details>
            </aside>
        </div>
    );
}
// ----- tampilkan -----
import { createRoot } from 'react-dom/client';
createRoot(document.getElementById('root')).render(<EditorAkses />);
