import { createWorkbook, validatePolicy, ACTIONS, UI_ITEMS } from '@kufayeka/sheet/core';
import { PRODUK, KOLOM_PRODUK } from './data/toko.js';

// Satu policy untuk workbook stok toko, disimpan di database bersama workbook-nya. Siapa yang membuka menentukan apa yang boleh.
export const POLICY = {
    owners: ['user:yeka'],
    members: { 'user:dewi': 'manajer', 'user:rina': 'kasir', 'group:gudang': 'gudang', 'user:pak-audit': 'auditor' },
    default: 'auditor',
    message: 'Bagian ini bukan wewenangmu',
    roles: {
        manajer: { can: ['edit', 'format', 'rows', 'sort', 'filter', 'copy', 'download', 'comment.read', 'comment.create', 'comment.reply'] },
        // kasir hanya melihat, kecuali kolom Status yang boleh diubah. Harga beli tidak terlihat sama sekali
        kasir: {
            can: ['sort', 'filter', 'comment.read'],
            ui: { toolbar: false, hide: ['menu.Insert', 'menu.Format'] },
            ranges: [
                { sheet: 'Produk', columns: ['Status'], mode: 'edit' },
                { sheet: 'Produk', columns: ['Harga beli'], mode: 'invisible' }
            ]
        },
        // gudang mengubah stok saja, dan hanya untuk produk yang masih aktif
        gudang: {
            can: ['filter'],
            ranges: [
                { sheet: 'Produk', columns: ['Stok'], mode: 'edit' },
                { sheet: 'Produk', range: 'A2:I1000', when: '=$I2="Dihentikan"', mode: 'readonly', message: 'Produk ini sudah dihentikan' },
                { sheet: 'Produk', columns: ['Harga beli'], mode: 'hidden' }
            ]
        },
        auditor: { can: ['comment.read', 'comment.create', 'comment.reply', 'download'], ui: { disallowed: 'hide', menubar: false } }
    }
};

export function buatStok() {
    const wb = createWorkbook();
    wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
    const p = wb.sheet('Sheet1');
    p.setSheetProps({ name: 'Produk' });
    p.setValues('A1', [[...KOLOM_PRODUK, 'Status'], ...PRODUK.map((x, i) => [...x, i === 7 ? 'Dihentikan' : 'Aktif'])]);
    p.setStyle('A1:I1', { bold: true, fill: '#e8f0fe' });
    p.setColProps('E:F', { format: { type: 'money', decimals: 0 } });
    p.setColProps('B', { width: 180 });
    return wb;
}

console.log('policy sah        :', JSON.stringify(validatePolicy(POLICY)));
console.log('salah ketik       :', JSON.stringify(validatePolicy({ roles: { kasir: { can: ['edti'] } } })));
console.log('jumlah tindakan   :', ACTIONS.length, '| bagian layar:', UI_ITEMS.length);

const doc = buatStok().toJSON();
// siapa: 'user:rina', atau { user: 'joko', groups: ['gudang'] } kalau orang itu anggota grup (tanpa awalan user: dan group:)
function coba(siapa, label) {
    const wb = createWorkbook(doc);
    wb.setAccess(POLICY, siapa);
    const ditolak = [];
    wb.on('reject', (e) => ditolak.push(e.reason));
    const orang = { source: 'user' };
    wb.setValues('Produk', 'G2', 999, orang);          // stok
    wb.setValues('Produk', 'G9', 999, orang);          // stok produk dihentikan
    wb.setValues('Produk', 'I3', 'Dihentikan', orang); // status
    wb.deleteRows('Produk', '13', 1, orang);           // hapus baris
    console.log(label.padEnd(15), '| peran', (wb.access().owner ? 'pemilik' : wb.access().roles.join(',')).padEnd(8), '| G2', String(wb.value('Produk', 'G2')).padEnd(3), 'G9', String(wb.value('Produk', 'G9')).padEnd(3),
        'I3', String(wb.value('Produk', 'I3')).padEnd(10), '| E2', JSON.stringify(wb.display('Produk', 'E2').text).padEnd(10), '| sort', wb.can('sort'), '| menu Format', wb.shows('menu.Format'), '| menubar', wb.access().ui.menubar);
    if (ditolak.length) console.log(''.padEnd(15), '  ditolak:', [...new Set(ditolak)].join(' / '));
}
coba('user:yeka', 'yeka (pemilik)');
coba('user:dewi', 'dewi (manajer)');
coba('user:rina', 'rina (kasir)');
coba({ user: 'joko', groups: ['gudang'] }, 'joko (gudang)');
coba('user:tamu', 'tamu (bawaan)');
