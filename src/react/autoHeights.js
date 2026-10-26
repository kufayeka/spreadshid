import { useEffect } from 'react';
import { rowNeed } from './measure.js';

/**
 * Rows grow to their text, as in Google Sheets: a wrapped text, a text of several lines, a bigger font. The heights are measured here (fonts are the
 * browser's) and given to the workbook, which uses them where no height was set by hand.
 *
 * The whole sheet is measured once when it is shown; after that only the rows a change touched, unless a column changed its width or the sheet its
 * default sizes (then every row with a wrapped text may change, and the sheet is measured again).
 *
 * @param {any} wb
 * @param {string} sheetId
 */
export function useAutoHeights(wb, sheetId) {
    useEffect(() => {
        if (typeof document === 'undefined') return undefined;
        const colAxis = () => wb.colAxis(sheetId);
        const measure = (r, cells, styles) => rowNeed(cells, styles, (c) => colAxis().size(c), (cid) => wb.colIndex(sheetId, cid), (c) => wb.display(sheetId, r, c).text);
        let grown = new Set();   // the rows that have a measured height now (they go back to 0 when they no longer need one)

        function measureAll() {
            const heights = new Map();
            const now = new Set();
            wb.forEachFilledRow(sheetId, (r, cells, styles) => {
                const h = measure(r, cells, styles);
                if (h) { const rid = wb.rowId(sheetId, r); heights.set(rid, h); now.add(rid); }
            });
            for (const rid of grown) if (!now.has(rid)) heights.set(rid, 0);
            grown = now;
            wb.setAutoHeights(sheetId, heights);
        }

        function measureRows(ids) {
            const heights = new Map();
            for (const rid of ids) {
                const r = wb.rowIndex(sheetId, rid);
                if (r < 0) { grown.delete(rid); continue; }
                const row = wb.rowContent(sheetId, r);
                const h = measure(r, row.cells, row.styles);
                heights.set(rid, h);
                if (h) grown.add(rid); else grown.delete(rid);
            }
            wb.setAutoHeights(sheetId, heights);
        }

        measureAll();

        // the rows the changes touched, gathered and measured once per frame (a paste of 10 000 cells is measured once, not 10 000 times)
        let pending = null;
        let all = false;
        const flush = () => {
            const ids = pending;
            pending = null;
            if (all) { all = false; measureAll(); } else if (ids && ids.size) measureRows(ids);
        };
        const off = wb.on('op', ({ ops }) => {
            for (const op of ops) {
                if (op.sheet !== sheetId && !(op.sheet && op.sheet.id === sheetId)) continue;
                if (op.t === 'colProps' || op.t === 'sheetProps' || op.t === 'insertCols' || op.t === 'deleteCols' || op.t === 'moveCols') { all = true; continue; }
                pending = pending || new Set();
                if (op.t === 'cells' || op.t === 'styles') for (const ch of op.changes) pending.add(ch.row);
                if (op.t === 'insertRows') for (const row of op.rows) pending.add(row.id);
            }
            if (pending || all) (typeof requestAnimationFrame === 'function' ? requestAnimationFrame : setTimeout)(flush);
        });
        return off;
    }, [wb, sheetId]);
}
