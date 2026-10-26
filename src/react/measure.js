// Measuring texts as the cells draw them, with a canvas (quick, and nothing is added to the page): how wide a text is, how many lines it takes when it wraps
// in a width, how high a row must be for its texts, how wide a column must be for its texts. Used for rows that grow (wrapped text, several lines, a big
// font) and for the double click on a header's edge (fit to the content).

import { displayOf } from '../core/display.js';

// The font of the cells: the same as .ks-cell in sheet.css (10pt Arial), and the room a cell keeps around its text.
const BASE_SIZE_PT = 10;
const FAMILY = 'Arial, "Helvetica Neue", Helvetica, sans-serif';
const LINE = 1.25;
const PAD_X = 6;   // 3 px on each side
const PAD_Y = 3;
const PT = 4 / 3;  // pixels in a point

let ctx = null;
function context() {
    if (ctx) return ctx;
    if (typeof document === 'undefined') return null;
    ctx = document.createElement('canvas').getContext('2d');
    return ctx;
}

/** The CSS font of a cell's style. */
export function fontOf(style) {
    const s = style || {};
    return (s.italic ? 'italic ' : '') + (s.bold ? '700 ' : '400 ') + (s.fontSize || BASE_SIZE_PT) + 'pt ' + (s.font ? '"' + s.font + '", ' : '') + FAMILY;
}

/** The height of one line of a cell's text, in pixels. */
export const lineHeightOf = (style) => Math.ceil(((style && style.fontSize) || BASE_SIZE_PT) * PT * LINE);

/** How wide a text is in a font. */
export function textWidth(text, font) {
    const c = context();
    if (!c) return text.length * 7;
    c.font = font;
    let widest = 0;
    for (const line of String(text).split('\n')) widest = Math.max(widest, c.measureText(line).width);
    return widest;
}

/** How many lines a text takes when it wraps at `width` (words stay whole where they fit; a word longer than the width is cut where it must be). */
export function wrappedLines(text, font, width) {
    const c = context();
    if (!c) return String(text).split('\n').length;
    c.font = font;
    let lines = 0;
    for (const para of String(text).split('\n')) {
        lines++;
        let line = 0;
        for (const word of para.split(/(\s+)/)) {
            if (!word) continue;
            const w = c.measureText(word).width;
            if (line + w <= width || line === 0) {
                if (w > width && line === 0) { lines += Math.floor(w / Math.max(1, width)); line = w % Math.max(1, width); }
                else line += w;
            } else if (/^\s+$/.test(word)) {
                line += w;
            } else {
                lines++;
                line = w;
            }
        }
    }
    return lines;
}

/**
 * The height a row needs for its texts, or 0 when the default height is enough. Only the cells that can need more are measured: the wrapped ones, the
 * ones with several lines, the ones in a bigger font.
 * @param {(c: number) => number} widthOf  The width of column c.
 * @param {(cid: string) => number} colIndexOf
 * @param {(c: number) => any} valueOf  The value of the cell in column c (a formula worked out).
 */
export function rowNeed(cells, styles, widthOf, colIndexOf, valueOf) {
    let need = 0;
    const seen = new Set();
    const consider = (cid) => {
        if (seen.has(cid)) return;
        seen.add(cid);
        const c = colIndexOf(cid);
        if (c < 0) return;
        const style = styles[cid];
        const raw = cells[cid];
        const big = style && style.fontSize && style.fontSize > BASE_SIZE_PT;
        const wrap = style && style.wrap === 'wrap';
        const lines = typeof raw === 'string' && raw.indexOf('\n') !== -1;
        // a cell in the default font, on one line, never needs more than the default height
        if (!big && !wrap && !lines) return;
        const text = displayOf(valueOf(c)).text;
        if (!text) return;
        const font = fontOf(style);
        const count = wrap ? wrappedLines(text, font, widthOf(c) - PAD_X) : text.split('\n').length;
        need = Math.max(need, count * lineHeightOf(style) + PAD_Y);
    };
    for (const cid in cells) consider(cid);
    for (const cid in styles) consider(cid);
    return need;
}

/**
 * The width a column needs for its texts (the double click on its edge), at least 20 pixels.
 * @param {(fn: (r: number, cells: object, styles: object) => void) => void} eachRow
 * @param {string} colId
 * @param {(r: number) => any} valueOf
 */
export function columnNeed(eachRow, colId, valueOf) {
    let need = 20;
    eachRow((r, cells, styles) => {
        if (cells[colId] === undefined) return;
        const style = styles[colId];
        if (style && style.wrap === 'wrap') return;
        const text = displayOf(valueOf(r)).text;
        if (text) need = Math.max(need, Math.ceil(textWidth(text, fontOf(style))) + PAD_X + 4);
    });
    return need;
}
