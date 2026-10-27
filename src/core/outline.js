// Groups of rows and of columns, as in Google Sheets (View > Group): a row (or column) has a level, 0 to 7; the rows next to each other with a level of
// at least L are a group of level L, inside the groups of the levels under it. A group is folded or open; the rows of a folded group are not shown. The
// [−] / [+] of a group sits on the row just before it (the row of its title: "1. PEKERJAAN TANAH" over its lines). Pure (no DOM).
//
// Kept in the props of the rows (and of the columns), so they are saved and undone as any other change:
//   level: 2           the row is in a group of level 1 and in one of level 2 inside it
//   fold: [2]          the groups of these levels that start at this row are folded

export const MAX_LEVEL = 7;

/**
 * The groups of a list of rows (or columns): { groups: [{ level, from, to, folded }], hidden: Set of the indexes a folded group hides, maxLevel }.
 * @param {number} count
 * @param {(i: number) => { level?: number, fold?: number[] }} propsOf
 */
export function outlineOf(count, propsOf) {
    const levels = new Array(count);
    let maxLevel = 0;
    for (let i = 0; i < count; i++) { const l = Math.min(MAX_LEVEL, Math.max(0, Number(propsOf(i).level) || 0)); levels[i] = l; if (l > maxLevel) maxLevel = l; }
    const groups = [], hidden = new Set();
    for (let level = 1; level <= maxLevel; level++) {
        for (let i = 0; i < count; i++) {
            if (levels[i] < level) continue;
            const from = i;
            while (i + 1 < count && levels[i + 1] >= level) i++;
            const fold = propsOf(from).fold;
            const folded = Array.isArray(fold) && fold.includes(level);
            groups.push({ level, from, to: i, folded });
            if (folded) for (let j = from; j <= i; j++) hidden.add(j);
        }
    }
    return { groups, hidden, maxLevel };
}
