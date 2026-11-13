import { createWorkbook } from '@kufayeka/sheet/core';

// Kolaborasi Ringan / Server-Push Realtime: 1 workbook pusat di server mem-push op ke banyak FE
const serverWb = createWorkbook(null, { user: { id: 'server', name: 'Backend Sync' } });
serverWb.sheet('Sheet1').setSheetProps({ name: 'Harga' });
serverWb.sheet('Harga').setValues('A1', [['Produk', 'Harga'], ['Semen', 72000]]);

const snapshot = serverWb.toJSON();
const fe1 = createWorkbook(snapshot);
const fe2 = createWorkbook(snapshot);

// Simulasi transport WebSocket/SSE: setiap op dari server di-broadcast ke FE1 & FE2
serverWb.on('op', ({ ops, source }) => {
    if (source === 'remote') return;
    for (const client of [fe1, fe2]) {
        client.apply(ops, { source: 'remote' });
        // Penting: apply() menandai dirty di client; tandai saved() agar client tidak mengirim balik patch yang sudah disimpan server
        client.saved(undefined, { version: serverWb.version });
    }
});

// Server menerima update harga dari sistem ERP/API
serverWb.sheet('Harga').setValues('B2', 75000);

console.log('FE1 B2:', fe1.value('Harga', 'B2'), '| unsaved:', fe1.unsaved(), '| canUndo:', fe1.canUndo());
console.log('FE2 B2:', fe2.value('Harga', 'B2'), '| unsaved:', fe2.unsaved(), '| canUndo:', fe2.canUndo());
