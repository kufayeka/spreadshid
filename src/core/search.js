// Finding, replacing and sorting, as in Google Sheets. Pure (no DOM).
//
// Find looks at what a cell shows (its value as text), or, when asked, at what it holds (a formula as it reads); it can match the case, and the whole
// cell only. Replace writes the cell again as if the new text was typed, so a replaced formula is a formula. Sorting puts the rows of a range in order by
// one of its columns: the cells' contents and styles move to their new rows, the rows themselves stay where they are, so every reference into the range
// (a sum over the column, a cell elsewhere that reads one of these cells) keeps pointing at the same place, as in Google Sheets; a formula that moves to
// another row is moved like a paste (its relative references follow it).

import { sortPerm } from './sort.js';
import { shiftFormula } from './formula/formula.js';

/**
 * @typedef {object} FindOptions
 * @property {boolean} [matchCase]
 * @property {boolean} [wholeCell]  The whole text of the cell, not a part of it.
 * @property {boolean} [inFormulas]  Look at what the cell holds (the formula), not what it shows.
 * @property {boolean} [regex]  The query is a regular expression.
 */

function matcher(query, o) {
    if (query === '' || query === null || query === undefined) return null;
    let re;
    if (o.regex) {
        try { re = new RegExp(o.wholeCell ? '^(?:' + query + ')$' : query, o.matchCase ? 'g' : 'gi'); } catch { return null; }
    } else {
        const escaped = String(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        re = new RegExp(o.wholeCell ? '^' + escaped + '$' : escaped, o.matchCase ? 'g' : 'gi');
    }
    return re;
}

/** The text find looks at in a cell. */
function textOf(wb, s, r, c, o) {
    return o.inFormulas ? wb.input(s, r, c) : wb.display(s, r, c).text;
}

/**
 * Every cell of sheet `s` whose text matches, in reading order (row by row, left to right): [{ r, c }].
 * @param {FindOptions} [options]
 */
export function findAll(wb, s, query, options) {
    const o = options || {};
    const re = matcher(query, o);
    if (!re) return [];
    const out = [];
    wb.forEachFilledRow(s, (r, cells) => {
        const cols = [];
        for (const cid in cells) { const c = wb.colIndex(s, cid); if (c >= 0) cols.push(c); }
        cols.sort((a, b) => a - b);
        for (const c of cols) {
            re.lastIndex = 0;
            if (re.test(textOf(wb, s, r, c, o))) out.push({ r, c });
        }
    });
    return out;
}

/**
 * Replaces the matches in the cells `at` (all the matches found, or the one being looked at): each cell is written again with the matching parts replaced,
 * read as typed. One change: one undo takes it all back. Returns how many cells changed.
 * @param {{ r: number, c: number }[]} at
 * @param {FindOptions} [options]
 */
export function replaceIn(wb, s, at, query, replacement, options) {
    const o = options || {};
    const re = matcher(query, o);
    if (!re) return 0;
    const entries = [];
    for (const { r, c } of at) {
        // A replace works on what the cell holds. A formula is only changed when looking in formulas: its shown value can match, but writing the
        // replaced value over it would throw the formula away (Google Sheets leaves it too).
        const before = wb.input(s, r, c);
        if (!o.inFormulas && before.length > 1 && before[0] === '=') continue;
        re.lastIndex = 0;
        if (!re.test(before)) continue;
        re.lastIndex = 0;
        const after = before.replace(re, o.regex ? replacement : () => replacement);
        if (after !== before) entries.push({ r, c, value: after === '' ? null : after });
    }
    if (entries.length) wb.setBlock(s, entries, { source: 'user' });
    return entries.length;
}

/**
 * Sorts the rows of `rect` by column `by` (a column of the sheet, inside the rect), A to Z or Z to A. Empty cells go last either way; equal ones keep
 * their order. One change.
 * @param {'asc'|'desc'} dir
 */
export function sortRange(wb, s, rect, by, dir) {
    const n = rect.r2 - rect.r1 + 1;
    if (n < 2) return [];
    const perm = sortPerm(n, (i) => {
        const v = wb.value(s, rect.r1 + i, by);
        return v && typeof v === 'object' ? wb.display(s, rect.r1 + i, by).text : v;
    }, dir);
    if (perm.every((from, to) => from === to)) return [];
    // what every cell of the range holds, read before anything moves
    const rows = [];
    for (let i = 0; i < n; i++) {
        const line = [];
        for (let c = rect.c1; c <= rect.c2; c++) line.push({ input: wb.input(s, rect.r1 + i, c), style: wb.style(s, rect.r1 + i, c) });
        rows.push(line);
    }
    const entries = [];
    perm.forEach((from, to) => {
        if (from === to) return;
        rows[from].forEach((cell, j) => {
            let value = cell.input;
            if (value.length > 1 && value[0] === '=') value = shiftFormula(value, to - from, 0);
            entries.push({ r: rect.r1 + to, c: rect.c1 + j, value: value === '' ? null : value, style: cell.style || null });
        });
    });
    return wb.setBlock(s, entries, { source: 'user' });
}
