import { ACTION_INFO, UI_ITEMS } from '@kufayeka/sheet/core';

// Daftar semua isi kolom action, diambil dari library sendiri (jadi selalu sama dengan yang dikenal library).
// Dipakai juga untuk dropdown di editor aturanmu sendiri.
const perGrup = (list: Array<{ id: string; label: string; group: string }>, prefix: string) => {
    const g = new Map<string, string[]>();
    for (const x of list) {
        if (!g.has(x.group)) g.set(x.group, []);
        g.get(x.group)?.push('`' + prefix + x.id + '`');
    }
    return g;
};

console.log('| Kelompok | action |');
console.log('|---|---|');
for (const [grup, ids] of perGrup(ACTION_INFO, '')) console.log('| ' + grup + ' | ' + ids.join(', ') + ' |');
console.log('| Layar | `ui.menubar`, `ui.toolbar`, `ui.formulaBar`, `ui.headers`, `ui.gridlines`, `ui.tabs`, `ui.disallowed` |');
for (const [grup, ids] of perGrup(UI_ITEMS, 'ui.')) console.log('| Layar: ' + grup + ' | ' + ids.join(', ') + ' |');
