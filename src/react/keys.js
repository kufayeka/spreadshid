// What a key does in the grid when no cell is being edited, as in Google Sheets. Pure: it gets the key and the state, and answers what should happen;
// the grid does it. Keys that type a character are not here: they go into the cell (see Grid).

import { selectCell, extendTo, focusOf, stepActive, selectAll, jump } from '../core/selection.js';

/**
 * @typedef {object} KeyContext
 * @property {import('../core/selection.js').Selection} sel
 * @property {{ rows: number, cols: number }} size
 * @property {(r: number, c: number) => boolean} filled  The cell holds something (for Ctrl+arrow).
 * @property {(r: number) => boolean} rowShown  The row is not hidden.
 * @property {(c: number) => boolean} colShown
 * @property {number} pageRows  How many rows a screen shows (PageUp, PageDown).
 * @property {() => { r: number, c: number }} lastFilled  The last row and column with content (Ctrl+End).
 */

/**
 * @typedef {object} KeyAnswer
 * @property {import('../core/selection.js').Selection} [sel]  The selection after the key.
 * @property {'edit'} [start]  Start editing the active cell, keeping what it holds (F2, Enter).
 * @property {boolean} [clear]  Empty the selected cells (Delete, Backspace).
 * @property {'undo'|'redo'} [history]
 */

// one step in a direction, over hidden rows and columns
function step(r, c, dr, dc, ctx) {
    let nr = r, nc = c;
    do { nr += dr; nc += dc; } while (nr >= 0 && nc >= 0 && nr < ctx.size.rows && nc < ctx.size.cols && ((dr && !ctx.rowShown(nr)) || (dc && !ctx.colShown(nc))));
    if (nr < 0 || nc < 0 || nr >= ctx.size.rows || nc >= ctx.size.cols) return { r, c };
    return { r: nr, c: nc };
}

const ARROWS = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };

/**
 * @param {{ key: string, shiftKey: boolean, ctrlKey: boolean, metaKey: boolean, altKey: boolean }} e
 * @param {KeyContext} ctx
 * @returns {KeyAnswer|null}  null: the key is not the grid's (it is left to the browser, or it types).
 */
export function keyAction(e, ctx) {
    const mod = e.ctrlKey || e.metaKey;
    const { sel, size } = ctx;
    const k = e.key;

    if (ARROWS[k]) {
        const [dr, dc] = ARROWS[k];
        const from = e.shiftKey ? focusOf(sel) : sel.active;
        const to = mod ? jump(from.r, from.c, dr, dc, ctx.filled, size) : step(from.r, from.c, dr, dc, ctx);
        return { sel: e.shiftKey ? extendTo(sel, to.r, to.c) : selectCell(to.r, to.c) };
    }
    if (k === 'Tab') return { sel: stepActive(sel, 0, e.shiftKey ? -1 : 1, size) };
    if (k === 'Enter' && !mod && !e.altKey) return e.shiftKey ? { sel: stepActive(sel, -1, 0, size) } : { start: 'edit' };
    if (k === 'F2') return { start: 'edit' };
    if (k === 'Delete' || k === 'Backspace') return { clear: true };
    if (k === 'Home') {
        const at = mod ? { r: 0, c: 0 } : { r: (e.shiftKey ? focusOf(sel) : sel.active).r, c: 0 };
        return { sel: e.shiftKey ? extendTo(sel, at.r, at.c) : selectCell(at.r, at.c) };
    }
    if (k === 'End') {
        const last = ctx.lastFilled();
        const from = e.shiftKey ? focusOf(sel) : sel.active;
        const at = mod ? { r: Math.max(0, last.r), c: Math.max(0, last.c) } : { r: from.r, c: Math.max(0, last.c) };
        return { sel: e.shiftKey ? extendTo(sel, at.r, at.c) : selectCell(at.r, at.c) };
    }
    if (k === 'PageDown' || k === 'PageUp') {
        const from = e.shiftKey ? focusOf(sel) : sel.active;
        const r = Math.max(0, Math.min(size.rows - 1, from.r + (k === 'PageDown' ? 1 : -1) * Math.max(1, ctx.pageRows)));
        return { sel: e.shiftKey ? extendTo(sel, r, from.c) : selectCell(r, from.c) };
    }
    if (mod && !e.altKey) {
        const lower = k.toLowerCase();
        if (lower === 'a') return { sel: selectAll(size.rows, size.cols) };
        if (lower === 'z') return { history: e.shiftKey ? 'redo' : 'undo' };
        if (lower === 'y') return { history: 'redo' };
    }
    return null;
}
