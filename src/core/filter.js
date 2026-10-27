// The filter of a sheet, as in Google Sheets (Data > Create a filter): a range whose first row is its header, and for each of its columns what is shown
// (by values: the values unticked are hidden; by condition: the conditions of conditional formatting). A row that fails a column is hidden. As in Google
// Sheets, the rows are filtered when the filter changes, not when a value does: a row edited so it no longer matches stays until the filter is changed.
// Pure (no DOM).
//
// Kept in the sheet's props (`filter`), by the ids of the corners of its range so it follows inserted rows:
//   { r1, c1, r2, c2,                                the range: row and column ids (r1 is the header)
//     columns: { [columnId]: { hidden: ['Draft', ''],  by values: the texts that are hidden ('' is an empty cell)
//                              op, a, b, formula } } }  by condition (as in conditional.js; a formula is written for the first row under the header,
//                                                       and kept by ids as a cell's formula is, so it follows inserted rows)

import { meets } from './conditional.js';
import { shiftFormula } from './formula/formula.js';
import { storeFormula, formulaText, isStoredFormula } from './refs.js';

/** Where a filter stands now, by position: { r1, c1, r2, c2 } (r1 the header), or null when a corner of it was deleted. */
export function filterRect(wb, s, filter) {
    if (!filter) return null;
    const r1 = wb.rowIndex(s, filter.r1), r2 = wb.rowIndex(s, filter.r2), c1 = wb.colIndex(s, filter.c1), c2 = wb.colIndex(s, filter.c2);
    if (r1 < 0 || r2 < 0 || c1 < 0 || c2 < 0) return null;
    return { r1: Math.min(r1, r2), c1: Math.min(c1, c2), r2: Math.max(r1, r2), c2: Math.max(c1, c2) };
}

/** The text a filter compares a cell by: what the cell shows (an empty cell is ''). */
export const filterText = (wb, s, r, c) => wb.display(s, r, c).text;

/** True when a column's criterion keeps the row r. */
export function keeps(wb, s, r, c, crit, firstRow) {
    if (!crit) return true;
    if (crit.hidden && crit.hidden.length && crit.hidden.includes(filterText(wb, s, r, c))) return false;
    if (!crit.op) return true;
    if (crit.op !== 'formula') return meets(crit, wb.value(s, r, c));
    if (!crit.formula) return true;
    // the formula is written for the first row under the header: moved to this row (and kept nowhere), worked out as if it were in the cell
    try {
        const own = isStoredFormula(crit.formula) ? formulaText(crit.formula, s, wb._grid) : String(crit.formula);
        const text = shiftFormula(own.startsWith('=') ? own : '=' + own, r - firstRow, 0);
        const v = wb._engine.evaluateDetached(s, wb.rowId(s, r), wb.colId(s, c), storeFormula(text, s, wb._grid));
        return v === true || (typeof v === 'number' && v !== 0);
    } catch { return true; }
}

/** The ids of the rows a filter hides (the header never is). */
export function hiddenByFilter(wb, s, filter) {
    const out = new Set();
    const at = filterRect(wb, s, filter);
    if (!at || !filter.columns) return out;
    const crits = [];
    for (const [cid, crit] of Object.entries(filter.columns)) {
        const c = wb.colIndex(s, cid);
        if (c >= 0 && crit && ((crit.hidden && crit.hidden.length) || crit.op)) crits.push([c, crit]);
    }
    if (!crits.length) return out;
    for (let r = at.r1 + 1; r <= at.r2; r++) {
        for (const [c, crit] of crits) if (!keeps(wb, s, r, c, crit, at.r1 + 1)) { out.add(wb.rowId(s, r)); break; }
    }
    return out;
}

/**
 * The values of a column of a filter, for its list of values: [{ text, count }] in order (numbers by their value, then texts, the empty one last). The rows
 * other columns hide are left out, as in Google Sheets (the list shows what can still be chosen).
 */
export function filterValues(wb, s, filter, c) {
    const at = filterRect(wb, s, filter);
    if (!at) return [];
    const cid = wb.colId(s, c);
    const others = [];
    for (const [id, crit] of Object.entries(filter.columns || {})) { const x = wb.colIndex(s, id); if (id !== cid && x >= 0) others.push([x, crit]); }
    const counts = new Map(), sortBy = new Map();
    for (let r = at.r1 + 1; r <= at.r2; r++) {
        if (others.some(([x, crit]) => !keeps(wb, s, r, x, crit, at.r1 + 1))) continue;
        const text = filterText(wb, s, r, c);
        counts.set(text, (counts.get(text) || 0) + 1);
        if (!sortBy.has(text)) { const v = wb.value(s, r, c); sortBy.set(text, typeof v === 'number' ? v : null); }
    }
    return [...counts].map(([text, count]) => ({ text, count })).sort((x, y) => {
        if (x.text === '' || y.text === '') return x.text === '' ? 1 : -1;
        const a = sortBy.get(x.text), b = sortBy.get(y.text);
        if (a !== null && b !== null) return a - b;
        if (a !== null || b !== null) return a !== null ? -1 : 1;
        return x.text.localeCompare(y.text, undefined, { numeric: true, sensitivity: 'base' });
    });
}

/**
 * The range a filter takes when it is made from one cell: the block of filled cells around it, as in Google Sheets (it grows while a row or a column
 * next to it has something in it, within its rows and columns).
 */
export function dataRegion(wb, s, r, c) {
    const size = wb.size(s);
    const filled = (rr, cc) => { const v = wb.raw(s, rr, cc); return v !== undefined && v !== null && v !== ''; };
    const b = { r1: r, c1: c, r2: r, c2: c };
    const rowHas = (rr) => { for (let cc = b.c1; cc <= b.c2; cc++) if (filled(rr, cc)) return true; return false; };
    const colHas = (cc) => { for (let rr = b.r1; rr <= b.r2; rr++) if (filled(rr, cc)) return true; return false; };
    for (let grew = true; grew;) {
        grew = false;
        if (b.r1 > 0 && rowHas(b.r1 - 1)) { b.r1--; grew = true; }
        while (b.r2 + 1 < size.rows && rowHas(b.r2 + 1)) { b.r2++; grew = true; }
        if (b.c1 > 0 && colHas(b.c1 - 1)) { b.c1--; grew = true; }
        if (b.c2 + 1 < size.cols && colHas(b.c2 + 1)) { b.c2++; grew = true; }
    }
    return b;
}
