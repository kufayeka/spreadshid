import { createWorkbook } from '@kufayeka/sheet/core';

const wb = createWorkbook();
const sh = wb.sheet('Sheet1');
sh.setValues('A1', [['1. Tanah'], ['Galian'], ['Urugan'], ['2. Beton'], ['Pile'], ['Balok'], ['Kolom']]);
const terlihat = () => [0, 1, 2, 3, 4, 5, 6].filter((r) => sh.rowAxis().size(r) > 0).map((r) => sh.value(r, 0)).join(', ');

// grup: baris di bawah judul bab. Tombol [-] muncul di baris judulnya
sh.groupRows('2:3');
sh.groupRows('5:7');
sh.groupRows('6:7');                       // grup di dalam grup (level 2)
console.log('grup  :', JSON.stringify(sh.rowGroups()));

sh.foldRowGroup(1, 1, true);               // lipat grup yang mulai di baris nomor 1, level 1
console.log('lipat :', terlihat());
sh.showRowLevel(0);                        // tombol level "1": cuma yang di luar grup
console.log('lvl 1 :', terlihat());
sh.showRowLevel(1);                        // tombol level "2"
console.log('lvl 2 :', terlihat());
sh.showRowLevel(9);                        // semua terbuka
sh.ungroupRows('6:7');                     // lepas satu level
console.log('lepas :', JSON.stringify(sh.rowGroups().groups.map((g) => [g.level, g.from + 1, g.to + 1])));
