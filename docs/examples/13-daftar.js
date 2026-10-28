import { ACTION_INFO, UI_ITEMS } from '@kufayeka/sheet/core';

// Daftar tindakan (untuk can) dan bagian layar (untuk ui.hide), diambil dari library sendiri. Dipakai juga untuk membuat editor policy sendiri.
const perGrup = (list) => {
    const g = new Map();
    for (const x of list) { if (!g.has(x.group)) g.set(x.group, []); g.get(x.group).push(x.id); }
    return g;
};
console.log('TINDAKAN (can):');
for (const [grup, ids] of perGrup(ACTION_INFO)) console.log('  ' + grup.padEnd(10), ids.join(', '));
console.log('BAGIAN LAYAR (ui.hide):');
for (const [grup, ids] of perGrup(UI_ITEMS)) console.log('  ' + grup.padEnd(10), ids.join(', '));
