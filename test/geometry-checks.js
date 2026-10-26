// The geometry of the grid without a browser: which rows a pane shows and where, with frozen rows, hidden rows and a scroll.
import { createAxis } from '../src/core/axis.js';
import { layoutOf, scrollingSpan, HEADER_HEIGHT, ROW_HEADER_WIDTH } from '../src/react/geometry.js';

/** @param {(label: string, ok: boolean, actual?: any) => void} check */
export function geometryChecks(check) {
    // 10 rows of 20 px, row 4 hidden, row 6 is 50 px high
    const rows = createAxis(10, (i) => (i === 4 ? 0 : i === 6 ? 50 : 20));
    check('axis: positions are running sums of the sizes', rows.start(5) === 80 && rows.start(7) === 150 && rows.total === 210, [rows.start(5), rows.start(7), rows.total]);
    check('axis: the row at a pixel (a hidden row is skipped)', rows.indexAt(0) === 0 && rows.indexAt(79) === 3 && rows.indexAt(80) === 5 && rows.indexAt(120) === 6 && rows.indexAt(9999) === 9,
        [rows.indexAt(79), rows.indexAt(80), rows.indexAt(120)]);
    const span = scrollingSpan(rows, 2, 0, 40);
    check('a scrolling pane starts after the frozen rows', span.from === 2);

    const cols = createAxis(5, () => 100);
    const lay = layoutOf({ rows, cols, freezeRows: 2, freezeCols: 1, scrollTop: 30, scrollLeft: 50, width: ROW_HEADER_WIDTH + 300, height: HEADER_HEIGHT + 100 });
    check('frozen sizes', lay.frozenHeight === 40 && lay.frozenWidth === 100);
    check('a scrolling cell is moved by the scroll, a frozen one is not', lay.rowY(3, true) === 60 - 40 - 30 && lay.rowY(1, false) === 20 && lay.colX(2, true) === 200 - 100 - 50 && lay.colX(0, false) === 0);
    const hit = lay.cellAt(ROW_HEADER_WIDTH + 100 + 10, HEADER_HEIGHT + 40 + 5);
    check('the cell under a point, past the frozen part, counts the scroll', hit.c === 1 && hit.r === 3, hit);
    check('a point on a header is no cell', lay.cellAt(10, 100) === null);
}
