// Moving cells around: copy, cut, paste, and the fill handle. Pure (no DOM): the grid gives it the browser's clipboard as text, and gets text back.
//
// A copy keeps, for every cell, what a person would edit (the formula as it reads, "=SUM(D2:D9)"), its value and its style. Pasted somewhere else, a
// formula moves along with the distance it travelled, as in Google Sheets ("=A1" pasted one row down reads "=A2"; what is fixed with $ stays), and is
// then kept by ids where it lands. A copy can leave the sheet: as tab-separated text (what Excel and every text field read) and inside an HTML table
// (what this sheet reads back with the formulas and the styles).

import { shiftFormula } from './formula/formula.js';
import { formatTsv, parseTsv } from './clipboard.js';
import { seriesValues } from './fill.js';
import { displayOf } from './display.js';

/**
 * @typedef {object} Clip
 * @property {number} v  1
 * @property {number} h  Rows.
 * @property {number} w  Columns.
 * @property {{ sheet: string, r: number, c: number }} origin  Where the copy was taken from (formulas move by the distance from here).
 * @property {{ input: string, value: any, style: object|undefined }[][]} cells
 * @property {boolean} [cut]
 */

/** A copy of the rectangle `rect` of sheet `s`. */
export function copyBlock(wb, s, rect, cut) {
    const cells = [];
    for (let r = rect.r1; r <= rect.r2; r++) {
        const row = [];
        for (let c = rect.c1; c <= rect.c2; c++) {
            const v = wb.value(s, r, c);
            // an error value goes out as its text; the input brings the formula back anyway
            row.push({ input: wb.input(s, r, c), value: v && typeof v === 'object' ? displayOf(v).text : v, text: wb.display(s, r, c).text, style: wb.style(s, r, c) });
        }
        cells.push(row);
    }
    return { v: 1, h: rect.r2 - rect.r1 + 1, w: rect.c2 - rect.c1 + 1, origin: { sheet: s, r: rect.r1, c: rect.c1 }, cells, cut: !!cut };
}

/** The copy as tab-separated text: what each cell shows. */
export function clipText(clip) {
    return formatTsv(clip.cells.map((row) => row.map((cell) => (cell.text !== undefined ? cell.text : displayOf(cell.value).text))));
}

const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The copy as an HTML table: other programs read the table, this sheet reads the copy kept in an attribute of it. */
export function clipHtml(clip) {
    const body = clip.cells.map((row) => '<tr>' + row.map((cell) => '<td>' + escapeHtml(cell.text !== undefined ? cell.text : displayOf(cell.value).text) + '</td>').join('') + '</tr>').join('');
    return '<table data-ks-clip="' + escapeHtml(encodeURIComponent(JSON.stringify(clip))) + '">' + body + '</table>';
}

/** The copy kept in an HTML table that clipHtml made, or null. */
export function clipFromHtml(html) {
    const m = /data-ks-clip="([^"]*)"/.exec(String(html || ''));
    if (!m) return null;
    try {
        const text = decodeURIComponent(m[1].replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&'));
        const clip = JSON.parse(text);
        return clip && clip.v === 1 && Array.isArray(clip.cells) ? clip : null;
    } catch {
        return null;
    }
}

/**
 * Where a copy of h x w cells goes when it is pasted on a selection: once at its corner, or, when the selection is bigger and a whole number of copies
 * fits in it (a cell copied onto a column, a row onto a block of rows), again and again to fill it, as in Google Sheets.
 * @returns {{ r: number, c: number, i: number, j: number }[]}  the cell of the sheet, and the cell of the copy it gets
 */
export function pastePlaces(rect, h, w, size) {
    const sh = rect.r2 - rect.r1 + 1, sw = rect.c2 - rect.c1 + 1;
    const tile = (sh > h || sw > w) && sh % h === 0 && sw % w === 0;
    const rows = tile ? sh : h, cols = tile ? sw : w;
    const out = [];
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            const r = rect.r1 + i, c = rect.c1 + j;
            if (r < size.rows && c < size.cols) out.push({ r, c, i: i % h, j: j % w });
        }
    }
    return out;
}

/**
 * Pastes a copy on the selection `rect` of sheet `s`.
 * @param {'all'|'values'|'styles'} [only]  "values": the values as they were worked out, no formula and no style (Ctrl+Shift+V); "styles": the styles
 *   alone, the values stay (the paint format).
 * @returns {{ r1: number, c1: number, r2: number, c2: number }}  the cells that were pasted on (the grid selects them).
 */
export function pasteClip(wb, s, rect, clip, only) {
    const places = pastePlaces(rect, clip.h, clip.w, wb.size(s));
    const entries = [];
    // a cut moves: the cells it came from are emptied (in the same change), unless the paste lands on them
    if (clip.cut && clip.origin.sheet === s) {
        for (let i = 0; i < clip.h; i++) for (let j = 0; j < clip.w; j++) entries.push({ r: clip.origin.r + i, c: clip.origin.c + j, value: null, style: null });
    }
    for (const p of places) {
        const cell = clip.cells[p.i][p.j];
        if (only === 'values') { entries.push({ r: p.r, c: p.c, value: cell.value === '' ? null : cell.value }); continue; }
        if (only === 'styles') { entries.push({ r: p.r, c: p.c, style: cell.style || null }); continue; }
        let input = cell.input;
        if (typeof input === 'string' && input.length > 1 && input[0] === '=') input = shiftFormula(input, p.r - (clip.origin.r + p.i), p.c - (clip.origin.c + p.j));
        entries.push({ r: p.r, c: p.c, value: input === '' ? null : input, style: cell.style || null });
    }
    wb.setBlock(s, entries, { source: 'user' });
    const rs = places.map((p) => p.r), cs = places.map((p) => p.c);
    return places.length ? { r1: Math.min(...rs), c1: Math.min(...cs), r2: Math.max(...rs), c2: Math.max(...cs) } : rect;
}

/** Pastes text from elsewhere (tab-separated, as Excel and Google Sheets copy): each piece is read as if it was typed. */
export function pasteText(wb, s, rect, text) {
    const matrix = parseTsv(text);
    if (!matrix.length) return rect;
    const w = Math.max(...matrix.map((row) => row.length));
    const clip = { v: 1, h: matrix.length, w, origin: { sheet: s, r: rect.r1, c: rect.c1 },
        cells: matrix.map((row) => Array.from({ length: w }, (_, j) => ({ input: row[j] === undefined ? '' : row[j], value: row[j] === undefined ? null : row[j], style: undefined }))) };
    // text from elsewhere brings no style: the cells keep theirs
    const places = pastePlaces(rect, clip.h, clip.w, wb.size(s));
    wb.setBlock(s, places.map((p) => ({ r: p.r, c: p.c, value: clip.cells[p.i][p.j].input === '' ? null : clip.cells[p.i][p.j].input })), { source: 'user' });
    const rs = places.map((p) => p.r), cs = places.map((p) => p.c);
    return { r1: Math.min(...rs), c1: Math.min(...cs), r2: Math.max(...rs), c2: Math.max(...cs) };
}

/**
 * The fill handle: the cells of `target` get what `source` has, line by line in the direction of the drag. A line of plain values goes on as a series
 * where it is one (numbers by their step, "Item 1", "Item 2"), else it repeats; a line with a formula repeats its cells, each formula moved by the distance
 * (as a paste); styles repeat. `copy` (Ctrl held) repeats everything as it is.
 * @param {'down'|'up'|'right'|'left'} dir
 */
export function fillBlock(wb, s, source, target, dir, copy) {
    const vertical = dir === 'down' || dir === 'up';
    const backward = dir === 'up' || dir === 'left';
    const lines = vertical ? [source.c1, source.c2] : [source.r1, source.r2];
    const n = vertical ? source.r2 - source.r1 + 1 : source.c2 - source.c1 + 1;
    const count = vertical ? target.r2 - target.r1 + 1 : target.c2 - target.c1 + 1;
    const entries = [];
    for (let line = lines[0]; line <= lines[1]; line++) {
        // the source cells of this line, from the first to the last in reading order
        const src = [];
        for (let k = 0; k < n; k++) {
            const r = vertical ? source.r1 + k : line, c = vertical ? line : source.c1 + k;
            src.push({ r, c, input: wb.input(s, r, c), value: wb.value(s, r, c), style: wb.style(s, r, c) });
        }
        // where the k-th filled cell is: going away from the source
        const at = (k) => {
            const d = backward ? -(k + 1) : k + 1;
            if (vertical) return { r: backward ? source.r1 + d : source.r2 + d, c: line };
            return { r: line, c: backward ? source.c1 + d : source.c2 + d };
        };
        const hasFormula = src.some((x) => x.input.length > 1 && x.input[0] === '=');
        const plain = src.map((x) => (x.value === null || x.value === undefined ? '' : x.value));
        const series = !hasFormula && plain.every((v) => typeof v === 'number' || typeof v === 'string') ? seriesValues(plain, count, { copy, backward }) : null;
        for (let k = 0; k < count; k++) {
            const p = at(k);
            // the source cell this one repeats: cycling away from the source in the direction of the drag
            const from = backward ? src[n - 1 - (k % n)] : src[k % n];
            let value;
            if (series) value = series[k] === '' ? null : typeof series[k] === 'string' && from.input[0] === "'" ? "'" + series[k] : series[k];
            else if (from.input.length > 1 && from.input[0] === '=') value = shiftFormula(from.input, p.r - from.r, p.c - from.c);
            else value = from.input === '' ? null : from.input;
            entries.push({ r: p.r, c: p.c, value, style: from.style || null });
        }
    }
    return wb.setBlock(s, entries, { source: 'user' });
}
