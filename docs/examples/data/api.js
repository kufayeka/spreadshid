// API tiruan untuk contoh bab 11, supaya contohnya jalan tanpa server. Di aplikasimu, ganti isinya dengan fetch ke API-mu sendiri:
//
//   export const ambilWorkbook = (id, signal) => fetch('/api/workbooks/' + id, { signal }).then((r) => r.json());
//   export const simpanPatch = (id, patch) => fetch('/api/workbooks/' + id, { method: 'PATCH', body: JSON.stringify(patch) }).then((r) => r.json());
//
// Server-nya menggabungkan patch dengan mergePatch dan memeriksanya dengan checkPatch (bab 12).
import { createWorkbook, mergePatch } from '@kufayeka/sheet/core';
import { penjualan, KOLOM_PENJUALAN, barisPenjualan } from './toko.js';

// "database": satu workbook penjualan, disimpan sebagai JSON seperti di tabel sungguhan
let tersimpan = null;
function awal() {
    const wb = createWorkbook();
    wb.setSettings({ locale: 'id-ID', currency: 'IDR' });
    const jual = wb.sheet('Sheet1');
    jual.setSheetProps({ name: 'Penjualan', freezeRows: 1 });
    jual.setValues('A1', [KOLOM_PENJUALAN]);
    jual.setValues('A2', barisPenjualan(penjualan(40), 2));
    jual.setStyle('A1:K1', { bold: true, fill: '#e8f0fe' });
    jual.setColProps('B', { format: { type: 'date' }, width: 95 });
    jual.setColProps('F', { width: 170 });
    jual.setColProps('I', { format: { type: 'money', decimals: 0 } });
    jual.setColProps('J', { format: { type: 'percent', decimals: 0 }, width: 70 });
    jual.setColProps('K', { format: { type: 'money', decimals: 0 }, width: 120 });
    jual.setValues('M1', [['Omzet', '=SUM(K:K)'], ['Transaksi', '=COUNT(A:A)']]);
    jual.setColProps('N', { format: { type: 'money', decimals: 0 }, width: 130 });
    return wb.toJSON();
}

const tunggu = (ms, signal) => new Promise((ok, gagal) => {
    const t = setTimeout(ok, ms);
    if (signal) signal.addEventListener('abort', () => { clearTimeout(t); gagal(new DOMException('dibatalkan', 'AbortError')); });
});

/** GET /api/workbooks/:id: workbook tersimpan, sebagai JSON. */
export async function ambilWorkbook(id, signal) {
    await tunggu(300, signal);
    if (!tersimpan) tersimpan = awal();
    return JSON.parse(JSON.stringify(tersimpan));
}

/** PATCH /api/workbooks/:id: perubahan sejak simpan terakhir. Menjawab versi yang baru. */
export async function simpanPatch(id, patch) {
    await tunggu(200);
    tersimpan = mergePatch(tersimpan, patch);
    tersimpan.version = (tersimpan.version || 0) + 1;
    return { version: tersimpan.version };
}
