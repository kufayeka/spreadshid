import { createWorkbook, mergePatch, checkPatch } from '@kufayeka/sheet/core';

// ---- di server: workbook yang tersimpan (misalnya dari database), dan aturannya
let tersimpan = (() => {
    const wb = createWorkbook();
    wb.setSheetProps('Sheet1', { name: 'BOQ' });
    wb.setValues('BOQ', 'A1', [['Pekerjaan', 'Volume', 'Harga'], ['Galian', 120, 85000], ['Urugan', 40, 210000]]);
    return wb.toJSON();
})();
const aturan = [{ sheet: 'BOQ', columns: ['Harga'], mode: 'readonly', message: 'Harga diatur estimator' }];

// ---- di browser: buka, orang mengedit, kirim patch
const wb = createWorkbook(tersimpan);
wb.setRules(aturan);
wb.saved(wb.pendingPatch());          // baru dibuka: belum ada yang berubah
wb.setValues('BOQ', 'B2', 125, { source: 'user' });
const patch = wb.pendingPatch();
console.log('patch dikirim   :', patch.rows.upsert.length, 'baris,', patch.rows.delete.length, 'dihapus, versi', patch.workbook.version);

// ---- di server: cek, gabungkan, simpan
const cek = checkPatch(tersimpan, patch, { rules: aturan });
console.log('cek             :', JSON.stringify(cek));
tersimpan = mergePatch(tersimpan, patch);
tersimpan.version = (tersimpan.version || 0) + 1;
console.log('sekarang B2     :', createWorkbook(tersimpan).value('BOQ', 'B2'), '| versi', tersimpan.version);

// ---- di browser: server sudah menyimpan, kasih tahu versinya
wb.saved(patch, { version: tersimpan.version });
console.log('belum tersimpan :', wb.pendingPatch().rows.upsert.length, 'baris');

// ---- patch palsu (tidak lewat sheet) yang mengubah harga: ditolak server
const palsu = JSON.parse(JSON.stringify(patch));
palsu.rows.upsert[0].cells[wb.colId('BOQ', 2)] = 1;
console.log('patch palsu     :', JSON.stringify(checkPatch(tersimpan, palsu, { rules: aturan })));
