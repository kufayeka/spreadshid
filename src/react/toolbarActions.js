// What each button of the toolbar does to the selection, as Google Sheets does it. Pure (no React, no DOM): it takes the workbook, the sheet and the
// selection, and applies one change, so every button is one undo. The toolbar (Toolbar.js) only draws the buttons and calls these.

import { FORMAT_PRESETS } from '../core/format.js';
import { rectsOf } from '../core/selection.js';

const how = { source: 'user' };

/** The style of the active cell: the buttons show its state (bold on, the font it has ...). */
export const activeStyle = (wb, s, sel) => wb.style(s, sel.active.r, sel.active.c) || {};

/** Bold, italic, strikethrough, underline: on for the whole selection when the active cell does not have it, off when it does. */
export function toggle(wb, s, sel, key) {
    const on = !activeStyle(wb, s, sel)[key];
    return wb.setStyle(s, rectsOf(sel), { [key]: on ? true : null }, how);
}

/** One part of the style for the whole selection (font, fontSize, color, fill, align, valign, wrap, rotate); null takes it away. */
export function setPart(wb, s, sel, key, value) {
    return wb.setStyle(s, rectsOf(sel), { [key]: value === undefined ? null : value }, how);
}

/** A number format for the whole selection: a preset's name ("money", "percent", "date" ...) or a format object; "general" takes the format away. */
export function setFormat(wb, s, sel, format) {
    const f = typeof format === 'string' ? FORMAT_PRESETS[format] : format;
    if (!f || f.type === 'general') return wb.setStyle(s, rectsOf(sel), { format: null }, how);
    // money takes the workbook's currency (its symbol is worked out from the locale when shown)
    const own = f.type === 'money' && !f.currency && !f.symbol ? { ...f, currency: wb.settings().currency || undefined } : f;
    return wb.setStyle(s, rectsOf(sel), { format: own }, how);
}

/**
 * One decimal more (+1) or less (-1), as the two buttons of Google Sheets: from the active cell's format (or, for a number without one, from the
 * decimals it shows), for the whole selection.
 */
export function stepDecimals(wb, s, sel, step) {
    const fmt = wb.cellFormat(s, sel.active.r, sel.active.c);
    let next;
    if (fmt && ['number', 'money', 'percent', 'scientific'].includes(fmt.type)) {
        next = { ...fmt, decimals: Math.max(0, Math.min(10, (fmt.decimals === undefined ? 2 : fmt.decimals) + step)) };
    } else {
        const v = wb.value(s, sel.active.r, sel.active.c);
        const shown = typeof v === 'number' ? (String(Number(v.toPrecision(15))).split('.')[1] || '').length : 0;
        next = { type: 'number', decimals: Math.max(0, Math.min(10, shown + step)) };
    }
    return wb.setStyle(s, rectsOf(sel), { format: next }, how);
}

/**
 * Borders on the selection. `kind`: all, inner, horizontal, vertical, outer, left, top, right, bottom, clear. `line`: { width, style, color }.
 * Each cell gets the sides that kind gives it at its place in the rectangle (outer: the top row a top line, the left column a left line ...).
 */
export function setBorders(wb, s, sel, kind, line) {
    const l = line || { width: 1, style: 'solid', color: '#000000' };
    const rects = rectsOf(sel);
    const inside = (r, c) => rects.find((b) => r >= b.r1 && r <= b.r2 && c >= b.c1 && c <= b.c2);
    return wb.setStyle(s, rects, (r, c, before) => {
        const b = inside(r, c);
        if (kind === 'clear') return before.borders ? { borders: null } : null;
        const sides = {};
        const top = r === b.r1, bottom = r === b.r2, left = c === b.c1, right = c === b.c2;
        if (kind === 'all') Object.assign(sides, { top: l, right: l, bottom: l, left: l });
        if (kind === 'outer') { if (top) sides.top = l; if (bottom) sides.bottom = l; if (left) sides.left = l; if (right) sides.right = l; }
        if (kind === 'inner') { if (!bottom) sides.bottom = l; if (!right) sides.right = l; }
        if (kind === 'horizontal' && !bottom) sides.bottom = l;
        if (kind === 'vertical' && !right) sides.right = l;
        if (kind === 'top' && top) sides.top = l;
        if (kind === 'bottom' && bottom) sides.bottom = l;
        if (kind === 'left' && left) sides.left = l;
        if (kind === 'right' && right) sides.right = l;
        if (!Object.keys(sides).length) return null;
        return { borders: { ...(before.borders || {}), ...sides } };
    }, how);
}

/** Merge: all of each rectangle into one cell, each of its rows ("horizontal"), each of its columns ("vertical"), or take merges apart ("unmerge"). */
export function merge(wb, s, sel, kind) {
    const rects = rectsOf(sel);
    if (kind === 'unmerge') { let done = []; for (const b of rects) done = done.concat(wb.unmergeCells(s, b, how) || []); return done; }
    const blocks = [];
    for (const b of rects) {
        if (kind === 'all') blocks.push(b);
        if (kind === 'horizontal') for (let r = b.r1; r <= b.r2; r++) blocks.push({ r1: r, c1: b.c1, r2: r, c2: b.c2 });
        if (kind === 'vertical') for (let c = b.c1; c <= b.c2; c++) blocks.push({ r1: b.r1, c1: c, r2: b.r2, c2: c });
    }
    return wb.mergeCells(s, blocks, how);
}

/** Takes every style away from the selection (its values stay). */
export function clearFormatting(wb, s, sel) {
    return wb.setStyle(s, rectsOf(sel), (r, c, before) => {
        const keys = Object.keys(before);
        if (!keys.length) return null;
        const off = {};
        for (const k of keys) off[k] = null;
        return off;
    }, how);
}

/** The functions of the Σ button: the active cell starts an edit with the function around the cells above it (or on its left), as Google Sheets does. */
export function functionText(wb, s, sel, name) {
    const { r, c } = sel.active;
    // the run of numbers right above the active cell, else on its left
    let top = r;
    while (top > 0 && typeof wb.value(s, top - 1, c) === 'number') top--;
    if (top < r) return '=' + name + '(' + wb.address(top, c) + ':' + wb.address(r - 1, c) + ')';
    let leftEdge = c;
    while (leftEdge > 0 && typeof wb.value(s, r, leftEdge - 1) === 'number') leftEdge--;
    if (leftEdge < c) return '=' + name + '(' + wb.address(r, leftEdge) + ':' + wb.address(r, c - 1) + ')';
    return '=' + name + '()';
}

/**
 * Groups (or ungroups) what is selected, as Google Sheets' Alt+Shift+Right (Left) and View > Group do: whole columns selected group the columns, anything
 * else the rows of the selection. One change.
 */
export function groupSelection(wb, s, sel, grouping) {
    const all = rectsOf(sel);
    const b = all[all.length - 1];
    const size = wb.size(s);
    const how = { source: 'user' };
    const cols = b.r1 === 0 && b.r2 === size.rows - 1 && !(b.c1 === 0 && b.c2 === size.cols - 1);
    if (cols) return grouping ? wb.groupCols(s, b.c1, b.c2, how) : wb.ungroupCols(s, b.c1, b.c2, how);
    return grouping ? wb.groupRows(s, b.r1, b.r2, how) : wb.ungroupRows(s, b.r1, b.r2, how);
}
