// Where things are on the screen: which rows and columns each pane shows, and where. Pure (no React, no DOM), so it is tested on its own.
//
// The grid has four panes, as a sheet with frozen rows and columns has:
//
//   corner  | top (frozen rows, scrolls sideways)
//   --------+-----------------------------------
//   left    | main (scrolls both ways)
//   (frozen columns, scrolls up and down)
//
// with the column letters above and the row numbers on the left. A pane is drawn with only the rows and columns it shows, plus a few more on each side so
// that a quick scroll does not show an empty edge before the next frame.

export const HEADER_HEIGHT = 24;   // the row of column letters
export const ROW_HEADER_WIDTH = 46; // the column of row numbers
const OVERSCAN = 3;

/**
 * The rows (or columns) a scrolling pane shows: from the one at the top edge to the one at the bottom edge, never one of the frozen ones.
 * @param {ReturnType<import('../core/axis.js').createAxis>} axis
 * @param {number} frozen  How many are frozen at the start.
 * @param {number} scroll  How far the pane is scrolled (pixels).
 * @param {number} length  How long the pane is (pixels).
 * @returns {{ from: number, to: number }}  to is included; to < from when nothing shows.
 */
export function scrollingSpan(axis, frozen, scroll, length) {
    if (axis.count <= frozen || length <= 0) return { from: frozen, to: frozen - 1 };
    const origin = axis.start(frozen);
    const from = Math.max(frozen, axis.indexAt(origin + scroll) - OVERSCAN);
    const to = Math.min(axis.count - 1, axis.indexAt(origin + scroll + length) + OVERSCAN);
    return { from, to };
}

/** The frozen rows (or columns): all of them, from 0. */
export function frozenSpan(axis, frozen) {
    return { from: 0, to: Math.min(frozen, axis.count) - 1 };
}

/**
 * Everything the grid needs to draw one frame.
 * @param {{ rows: any, cols: any, freezeRows: number, freezeCols: number, scrollTop: number, scrollLeft: number, width: number, height: number }} at
 */
export function layoutOf(at) {
    const HW = at.headW === undefined ? ROW_HEADER_WIDTH : at.headW, HH = at.headH === undefined ? HEADER_HEIGHT : at.headH;
    const fr = Math.min(at.freezeRows || 0, at.rows.count);
    const fc = Math.min(at.freezeCols || 0, at.cols.count);
    const frozenHeight = at.rows.start(fr);
    const frozenWidth = at.cols.start(fc);
    const cellsWidth = Math.max(0, at.width - HW);
    const cellsHeight = Math.max(0, at.height - HH);
    const mainWidth = Math.max(0, cellsWidth - frozenWidth);
    const mainHeight = Math.max(0, cellsHeight - frozenHeight);
    return {
        fr, fc, frozenHeight, frozenWidth, mainWidth, mainHeight,
        // the size the scroller must have so that its scrollbars reach the last row and the last column
        contentWidth: HW + at.cols.total,
        contentHeight: HH + at.rows.total,
        rows: { frozen: frozenSpan(at.rows, fr), scrolling: scrollingSpan(at.rows, fr, at.scrollTop, mainHeight) },
        cols: { frozen: frozenSpan(at.cols, fc), scrolling: scrollingSpan(at.cols, fc, at.scrollLeft, mainWidth) },
        // where a row or column starts inside a pane: a frozen pane does not scroll, a scrolling one is moved by the scroll (a merged block that starts in
        // the frozen part and reaches into the scrolling part is drawn in both, each at its own place, and each pane cuts it at its edge)
        rowY: (r, scrolling) => (scrolling ? at.rows.start(r) - frozenHeight - at.scrollTop : at.rows.start(r)),
        colX: (c, scrolling) => (scrolling ? at.cols.start(c) - frozenWidth - at.scrollLeft : at.cols.start(c)),
        // the cell under a point of the grid's box (header included), or null on a header
        cellAt(x, y) {
            if (x < HW || y < HH) return null;
            const cx = x - HW, cy = y - HH;
            // past the frozen part, the point is as far into the sheet as it is into the pane plus how far the pane is scrolled
            const c = at.cols.indexAt(cx < frozenWidth ? cx : cx + at.scrollLeft);
            const r = at.rows.indexAt(cy < frozenHeight ? cy : cy + at.scrollTop);
            return { r, c };
        }
    };
}
