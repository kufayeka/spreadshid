import { createWorkbook } from '@kufayeka/sheet/core';
import { penjualan, KOLOM_PENJUALAN, barisPenjualan } from './data/toko.js';

// Setahun penjualan: 100.000 transaksi dengan rumus Total per baris dan ringkasan per cabang.
// Yang dicetak di sini adalah hal yang tidak bergantung pada kecepatan komputer: berapa yang dihitung ulang dan berapa yang dikirim saat menyimpan.
const N = 100000;
const wb = createWorkbook(null, { undoLimit: 50 });
const jual = wb.sheet('Sheet1');
jual.setSheetProps({ name: 'Penjualan' });
jual.insertRows(1000, N + 1 - 1000);
jual.setValues('A1', [KOLOM_PENJUALAN]);
jual.setValues('A2', barisPenjualan(penjualan(N), 2));          // 1.100.000 sel, 100.000 rumus, satu perubahan
wb.setValues('Penjualan', 'M1', [['Jakarta', `=SUMIFS(K2:K${N + 1}, C2:C${N + 1}, M1)`], ['Bandung', `=SUMIFS(K2:K${N + 1}, C2:C${N + 1}, M2)`]]);
const sebelum = jual.value('N2');
console.log('ukuran         :', jual.size().rows, 'baris |', N, 'rumus Total | omzet Bandung', sebelum);

// satu ketikan: hanya rumus Total baris itu dan dua SUMIFS yang dihitung ulang, bukan 100.000 rumus
let dihitung = 0;
const off = wb.on('op', () => { dihitung++; });
wb.saved(wb.pendingPatch());
jual.setValues('H50001', 1000, { source: 'user' });            // transaksi ke-50.000, cabang Bandung
console.log('satu ketikan   :', dihitung, 'perubahan | omzet Bandung', sebelum, '->', jual.value('N2'));
off();

// yang dikirim saat menyimpan: satu baris, bukan seluruh workbook
const patch = wb.pendingPatch();
console.log('patch          :', patch.rows.upsert.length, 'baris,', Math.round(JSON.stringify(patch).length / 100) / 10, 'KB');

// menyisipkan baris di tengah tidak menulis ulang 50.000 rumus di bawahnya: rumus menyimpan id baris, bukan nomornya
wb.saved(patch);
jual.insertRows('50001', 1);
console.log('sisip baris    :', wb.pendingPatch().rows.upsert.length, 'baris di patch | rumus K50002 kini', jual.input('K50002'));
