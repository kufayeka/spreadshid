// The selection, as in Google Sheets: one or more rectangles, and the active cell (where typing goes). Pure (no DOM).
//
// A rectangle is kept as the cell it started from (anchor) and the cell it reaches to (focus): Shift+arrow moves the focus and keeps the anchor, so the
// rectangle grows or shrinks around the cell it started from. Ctrl+click adds a rectangle; the last one is the one that moves.

/** @typedef {{ r: number, c: number }} Point */
/** @typedef {{ r1: number, c1: number, r2: number, c2: number }} Rect */
/** @typedef {{ ranges: { anchor: Point, focus: Point }[], active: Point }} Selection */

/** A rectangle with its corners in order. */
export function rectOf(range) {
    return { r1: Math.min(range.anchor.r, range.focus.r), c1: Math.min(range.anchor.c, range.focus.c), r2: Math.max(range.anchor.r, range.focus.r), c2: Math.max(range.anchor.c, range.focus.c) };
}

/** A selection of one cell. */
export function selectCell(r, c) {
    return { ranges: [{ anchor: { r, c }, focus: { r, c } }], active: { r, c } };
}

/** The last rectangle grows (or shrinks) to (r, c); the active cell stays. */
export function extendTo(sel, r, c) {
    const ranges = sel.ranges.slice();
    const last = ranges[ranges.length - 1];
    ranges[ranges.length - 1] = { anchor: last.anchor, focus: { r, c } };
    return { ranges, active: sel.active };
}

/** Another rectangle, of one cell, added (Ctrl+click); it is the active one now. */
export function addCell(sel, r, c) {
    return { ranges: sel.ranges.concat([{ anchor: { r, c }, focus: { r, c } }]), active: { r, c } };
}

/** Whole rows (from r1 to r2) or whole columns, as a click on the headers selects them. */
export function selectRows(r1, r2, cols) {
    return { ranges: [{ anchor: { r: r1, c: 0 }, focus: { r: r2, c: cols - 1 } }], active: { r: r1, c: 0 } };
}
export function selectCols(c1, c2, rows) {
    return { ranges: [{ anchor: { r: 0, c: c1 }, focus: { r: rows - 1, c: c2 } }], active: { r: 0, c: c1 } };
}
export function selectAll(rows, cols) {
    return { ranges: [{ anchor: { r: 0, c: 0 }, focus: { r: rows - 1, c: cols - 1 } }], active: { r: 0, c: 0 } };
}

/** The rectangles of a selection. */
export const rectsOf = (sel) => sel.ranges.map(rectOf);

/** True when the cell is in one of the rectangles. */
export function contains(sel, r, c) {
    return sel.ranges.some((x) => { const b = rectOf(x); return r >= b.r1 && r <= b.r2 && c >= b.c1 && c <= b.c2; });
}

/** The point the keyboard moves from: the focus of the last rectangle (where Shift+arrow has got to). */
export const focusOf = (sel) => sel.ranges[sel.ranges.length - 1].focus;

/**
 * The active cell moves inside the selection, as Enter and Tab do in Google Sheets when more than one cell is selected: along the row (Tab) or the
 * column (Enter), wrapping to the next row or column at the edge of the rectangle. One cell selected: it moves out, and the selection with it.
 * @param {Selection} sel
 * @param {number} dr  1 or -1 for Enter / Shift+Enter, 0 for Tab
 * @param {number} dc  1 or -1 for Tab / Shift+Tab, 0 for Enter
 * @param {{ rows: number, cols: number }} size
 */
export function stepActive(sel, dr, dc, size) {
    const b = rectOf(sel.ranges[sel.ranges.length - 1]);
    const single = b.r1 === b.r2 && b.c1 === b.c2 && sel.ranges.length === 1;
    const { r, c } = sel.active;
    if (single) {
        const nr = Math.max(0, Math.min(size.rows - 1, r + dr)), nc = Math.max(0, Math.min(size.cols - 1, c + dc));
        return selectCell(nr, nc);
    }
    let nr = r + dr, nc = c + dc;
    if (dc !== 0) {
        if (nc > b.c2) { nc = b.c1; nr = r + 1 > b.r2 ? b.r1 : r + 1; }
        if (nc < b.c1) { nc = b.c2; nr = r - 1 < b.r1 ? b.r2 : r - 1; }
    } else {
        if (nr > b.r2) { nr = b.r1; nc = c + 1 > b.c2 ? b.c1 : c + 1; }
        if (nr < b.r1) { nr = b.r2; nc = c - 1 < b.c1 ? b.c2 : c - 1; }
    }
    return { ranges: sel.ranges, active: { r: nr, c: nc } };
}

/**
 * Where Ctrl+arrow lands from (r, c) going (dr, dc), as in Google Sheets: from a filled cell whose neighbour is filled, to the last filled cell of that
 * run; otherwise to the next filled cell; and to the edge of the sheet when there is none.
 * @param {(r: number, c: number) => boolean} filled
 * @param {{ rows: number, cols: number }} size
 */
export function jump(r, c, dr, dc, filled, size) {
    const inside = (rr, cc) => rr >= 0 && cc >= 0 && rr < size.rows && cc < size.cols;
    let nr = r + dr, nc = c + dc;
    if (!inside(nr, nc)) return { r, c };
    if (filled(r, c) && filled(nr, nc)) {
        while (inside(nr + dr, nc + dc) && filled(nr + dr, nc + dc)) { nr += dr; nc += dc; }
        return { r: nr, c: nc };
    }
    while (inside(nr, nc) && !filled(nr, nc)) {
        if (!inside(nr + dr, nc + dc)) return { r: nr, c: nc };
        nr += dr; nc += dc;
    }
    return { r: nr, c: nc };
}
