import { createWorkbook, mergePatch } from '@kufayeka/sheet/core';

// Komentar disimpan di dalam sheet.props.comments (terikat ke rowId & colId), sehingga otomatis ikut toJSON() & pendingPatch()
const docAwal = (() => {
    const w = createWorkbook();
    w.setSheetProps('Sheet1', { name: 'Stok' });
    w.setValues('Stok', 'A1', [['Produk', 'Stok'], ['Semen', 12]]);
    return w.toJSON();
})();

// User menambahkan komentar di browser
const browser = createWorkbook(docAwal, {
    user: { id: 'u1', name: 'Dewi' },
    now: () => new Date(Date.UTC(2026, 9, 27, 9, 30)),
});
const { thread } = browser.addComment('Stok', 'B2', 'Stok menipis, perlu PO.');
browser.replyComment('Stok', thread, 'Sudah diajukan ke purchasing.');

// 1. Jika pakai delta patch: komentar terbawa di patch.sheets.upsert[].props.comments
const patch = browser.pendingPatch();
console.log('Patch membawa sheet.props.comments:', patch.sheets.upsert[0]?.props?.comments?.length ?? 0, 'thread');

// 2. Server menggabungkan patch ke dokumen DB
const tersimpan = mergePatch(docAwal, patch);
const dariDb = createWorkbook(tersimpan);

// 3. Jika aplikasi butuh menyimpan/mengindeks komentar ke tabel SQL terpisah (untuk notifikasi)
const untukTabelDb = dariDb.comments('Stok').map((t, idx) => ({
    threadKey: 'thread-' + (idx + 1),
    address: t.at ? dariDb.address(t.at.r, t.at.c) : null,
    messages: t.items.map((m) => `${m.by.name}: ${m.text}`),
}));
console.log('Ekstrak untuk tabel notifikasi DB:', JSON.stringify(untukTabelDb));
