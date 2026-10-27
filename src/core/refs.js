// A formula as the sheet keeps it: the text a person typed, with every reference to a cell or a range taken out and kept by the ids of its rows and columns.
//
//   typed:  =SUM(D2:D9)*Rates!$B$1
//   kept:   { f: "=SUM(⟦0⟧)*⟦1⟧", refs: [ { k: "range", r1: <id of row 2>, c1: <id of D>, r2: <id of row 9>, c2: <id of D> },
//                                         { k: "cell", s: <id of Rates>, r1: <id of row 1>, c1: <id of B>, ra1: true, ca1: true } ] }
//
// Why: a row inserted above row 2 moves rows 2 and 9 down, and the formula follows them, because it never said "2" — it said "that row". A row inserted
// between 2 and 9 is inside the range at once. A row that is deleted turns its references into #REF!, as in Excel. Nothing is rewritten when rows move,
// which is what makes inserting cheap in a big sheet and what lets two people change the sheet at the same time later.
//
// The $ of a reference (fixed row or column) changes nothing about where it points; it is kept for copy and fill, where the parts without $ move along.

import { tokenize } from './formula/formula.js';
import { colIndex, colName } from './formula/address.js';

const OPEN = '⟦';
const CLOSE = '⟧';

/**
 * What the conversions need to know about the workbook (the workbook gives this; tests give a small one).
 * @typedef {object} Grid
 * @property {(name: string) => string|null} sheetIdByName  The id of the sheet with that name (any case), or null.
 * @property {(sheetId: string) => string} sheetName
 * @property {(sheetId: string) => { rows: number, cols: number }} size
 * @property {(sheetId: string, index: number) => string|undefined} rowIdAt
 * @property {(sheetId: string, index: number) => string|undefined} colIdAt
 * @property {(sheetId: string, id: string) => number} rowIndexOf  -1 when the row is gone.
 * @property {(sheetId: string, id: string) => number} colIndexOf  -1 when the column is gone.
 */

/**
 * A reference kept by ids.
 * @typedef {object} Ref
 * @property {'cell'|'range'|'cols'|'rows'} k  cols: whole columns (B:D), rows: whole rows (2:5).
 * @property {string} [s]  The sheet, when it is not the sheet of the formula.
 * @property {string|null} r1 @property {string|null} c1 @property {string|null} r2 @property {string|null} c2
 * @property {boolean} [ra1] @property {boolean} [ca1] @property {boolean} [ra2] @property {boolean} [ca2]  Fixed ($) parts.
 */

/** @typedef {{ f: string, refs: Ref[] }} StoredFormula */

/** True for a cell content that is a formula kept by the sheet. */
export const isStoredFormula = (v) => !!v && typeof v === 'object' && typeof v.f === 'string' && Array.isArray(v.refs);

// "$B$7" -> { r: 6, c: 1, ra: true, ca: true }
function cellParts(text) {
    const m = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)$/.exec(text);
    return m ? { c: colIndex(m[2]), r: Number(m[4]) - 1, ca: m[1] === '$', ra: m[3] === '$' } : null;
}

/**
 * The formula a person typed ("=A1+B2", with or without "="), kept by ids.
 * A cell outside the sheet becomes #REF! (there is no row to point at); a range that reaches past the end is cut at the end of the sheet.
 * @param {string} text
 * @param {string} sheetId  The sheet the formula is in.
 * @param {Grid} grid
 * @returns {StoredFormula}
 */
export function storeFormula(text, sheetId, grid) {
    const src = String(text).replace(/^\s*=/, '');
    const lexed = tokenize(src);
    // A formula that cannot be read is kept as it was typed: the cell shows the error, and the person can fix the text.
    if (lexed.error) return { f: '=' + src, refs: [] };
    const toks = lexed.tokens;
    const refs = [];
    let out = '';
    let at = 0;
    for (let i = 0; i < toks.length; i++) {
        let t = toks[i];
        const start = t.start;
        let target = sheetId;
        if (t.type === 'sheet') {
            const next = toks[i + 1];
            if (!next || (next.type !== 'cell' && next.type !== 'colrange' && next.type !== 'rowrange')) continue;
            target = grid.sheetIdByName(t.text);
            i++;
            t = toks[i];
        }
        // a word on its own (not a function, not TRUE or FALSE) is a named range: kept by the id of the name, and by its text for a name made later
        if (t.type === 'name' && target === sheetId && grid.nameId) {
            const next = toks[i + 1];
            const up = t.text.toUpperCase();
            if ((next && next.type === 'op' && next.text === '(') || up === 'TRUE' || up === 'FALSE') continue;
            out += src.slice(at, t.start) + OPEN + refs.length + CLOSE;
            refs.push({ k: 'name', id: grid.nameId(t.text), n: t.text });
            at = t.end;
            continue;
        }
        if (t.type !== 'cell' && t.type !== 'colrange' && t.type !== 'rowrange') continue;
        let end = t.end;
        let ref = null;
        if (target === null) ref = null; // a sheet that does not exist
        else if (t.type === 'cell') {
            const a = cellParts(t.text);
            const colon = toks[i + 1];
            const second = toks[i + 2];
            if (colon && colon.type === 'op' && colon.text === ':' && second && second.type === 'cell') {
                const b = cellParts(second.text);
                i += 2;
                end = second.end;
                ref = rangeRef(a, b, target, grid);
            } else {
                ref = cellRef(a, target, grid);
            }
        } else if (t.type === 'colrange') {
            const [x, y] = t.text.split(':');
            ref = lineRef('cols', colIndex(x.replace('$', '')), colIndex(y.replace('$', '')), x[0] === '$', y[0] === '$', target, grid);
        } else {
            const [x, y] = t.text.split(':');
            ref = lineRef('rows', Number(x.replace('$', '')) - 1, Number(y.replace('$', '')) - 1, x[0] === '$', y[0] === '$', target, grid);
        }
        out += src.slice(at, start);
        if (!ref) out += '#REF!';
        else {
            if (target !== sheetId) ref.s = target;
            out += OPEN + refs.length + CLOSE;
            refs.push(ref);
        }
        at = end;
    }
    return { f: '=' + out + src.slice(at), refs };
}

function cellRef(a, sheetId, grid) {
    const size = grid.size(sheetId);
    if (!a || a.r >= size.rows || a.c >= size.cols) return null;
    return { k: 'cell', r1: grid.rowIdAt(sheetId, a.r), c1: grid.colIdAt(sheetId, a.c), r2: null, c2: null, ra1: a.ra, ca1: a.ca };
}

function rangeRef(a, b, sheetId, grid) {
    if (!a || !b) return null;
    const size = grid.size(sheetId);
    // the corners in order, each keeping its own $
    const top = a.r <= b.r ? a : b, bottom = a.r <= b.r ? b : a;
    const left = a.c <= b.c ? a : b, right = a.c <= b.c ? b : a;
    if (top.r >= size.rows || left.c >= size.cols) return null;
    const r2 = Math.min(bottom.r, size.rows - 1), c2 = Math.min(right.c, size.cols - 1);
    return { k: 'range', r1: grid.rowIdAt(sheetId, top.r), c1: grid.colIdAt(sheetId, left.c), r2: grid.rowIdAt(sheetId, r2), c2: grid.colIdAt(sheetId, c2),
        ra1: top.ra, ca1: left.ca, ra2: bottom.ra, ca2: right.ca };
}

function lineRef(kind, x, y, fixedX, fixedY, sheetId, grid) {
    if (x < 0 || y < 0) return null;
    const size = grid.size(sheetId);
    const lo = Math.min(x, y), hi = Math.max(x, y);
    const count = kind === 'cols' ? size.cols : size.rows;
    if (lo >= count) return null;
    const idAt = (i) => (kind === 'cols' ? grid.colIdAt(sheetId, i) : grid.rowIdAt(sheetId, i));
    const first = idAt(lo), last = idAt(Math.min(hi, count - 1));
    return kind === 'cols'
        ? { k: 'cols', r1: null, c1: first, r2: null, c2: last, ca1: fixedX, ca2: fixedY }
        : { k: 'rows', r1: first, c1: null, r2: last, c2: null, ra1: fixedX, ra2: fixedY };
}

/**
 * Where a reference points now, by index: { s, r1, c1, r2, c2 } (whole columns and rows reach the edges of the sheet), or null when a row, a column or the
 * sheet it points at is gone (#REF!).
 * @param {Ref} ref
 * @param {string} sheetId  The sheet of the formula.
 * @param {Grid} grid
 */
export function resolveRef(ref, sheetId, grid) {
    // a named range points where its name points now, or nowhere (#NAME?) when the workbook has no such name
    if (ref.k === 'name') return grid.nameRect ? grid.nameRect(ref) : null;
    const s = ref.s || sheetId;
    let size;
    try { size = grid.size(s); } catch { return null; }
    if (!size) return null;
    const row = (id) => (id === null ? -2 : grid.rowIndexOf(s, id));
    const col = (id) => (id === null ? -2 : grid.colIndexOf(s, id));
    if (ref.k === 'cell') {
        const r = row(ref.r1), c = col(ref.c1);
        return r < 0 || c < 0 ? null : { s, r1: r, c1: c, r2: r, c2: c };
    }
    if (ref.k === 'cols') {
        const c1 = col(ref.c1), c2 = col(ref.c2);
        return c1 < 0 || c2 < 0 ? null : { s, r1: 0, c1: Math.min(c1, c2), r2: size.rows - 1, c2: Math.max(c1, c2) };
    }
    if (ref.k === 'rows') {
        const r1 = row(ref.r1), r2 = row(ref.r2);
        return r1 < 0 || r2 < 0 ? null : { s, r1: Math.min(r1, r2), c1: 0, r2: Math.max(r1, r2), c2: size.cols - 1 };
    }
    const r1 = row(ref.r1), c1 = col(ref.c1), r2 = row(ref.r2), c2 = col(ref.c2);
    if (r1 < 0 || c1 < 0 || r2 < 0 || c2 < 0) return null;
    // rows moved by a sort or a drag can swap the corners: the range is still the rectangle between them
    return { s, r1: Math.min(r1, r2), c1: Math.min(c1, c2), r2: Math.max(r1, r2), c2: Math.max(c1, c2) };
}

function sheetPrefix(ref, sheetId, grid) {
    if (!ref.s || ref.s === sheetId) return '';
    const name = grid.sheetName(ref.s);
    const plain = /^[A-Za-z_][A-Za-z0-9_.]*$/.test(name) && !/^[A-Za-z]{1,3}\d+$/.test(name);
    return (plain ? name : "'" + name.replace(/'/g, "''") + "'") + '!';
}

/** The A1 text of one reference as it points now, or "#REF!". */
export function refText(ref, sheetId, grid) {
    // a name shows as it is called now (renamed, every formula shows the new name), or as it was typed when there is no such name
    if (ref.k === 'name') return grid.nameText ? grid.nameText(ref) : ref.n;
    const at = resolveRef(ref, sheetId, grid);
    if (!at) return '#REF!';
    const prefix = sheetPrefix(ref, sheetId, grid);
    const cell = (r, c, ra, ca) => (ca ? '$' : '') + colName(c) + (ra ? '$' : '') + (r + 1);
    if (ref.k === 'cell') return prefix + cell(at.r1, at.c1, ref.ra1, ref.ca1);
    if (ref.k === 'cols') return prefix + (ref.ca1 ? '$' : '') + colName(at.c1) + ':' + (ref.ca2 ? '$' : '') + colName(at.c2);
    if (ref.k === 'rows') return prefix + (ref.ra1 ? '$' : '') + (at.r1 + 1) + ':' + (ref.ra2 ? '$' : '') + (at.r2 + 1);
    return prefix + cell(at.r1, at.c1, ref.ra1, ref.ca1) + ':' + cell(at.r2, at.c2, ref.ra2, ref.ca2);
}

/**
 * The formula as a person reads it now ("=SUM(D3:D10)" after a row was inserted above): what the cell shows while it is edited.
 * @param {StoredFormula} formula
 * @param {string} sheetId
 * @param {Grid} grid
 */
export function formulaText(formula, sheetId, grid) {
    return formula.f.replace(/⟦(\d+)⟧/g, (m, n) => {
        const ref = formula.refs[Number(n)];
        return ref ? refText(ref, sheetId, grid) : '#REF!';
    });
}

/** Every sheet a formula points into (its own sheet is not listed). */
export function sheetsOf(formula) {
    const out = new Set();
    for (const ref of formula.refs) if (ref.s) out.add(ref.s);
    return out;
}
