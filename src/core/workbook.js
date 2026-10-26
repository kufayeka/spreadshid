// The workbook: its sheets, their columns and rows, the content and style of every cell, and the one door every change goes through.
//
// A change is an operation ("op"), written with ids, never with positions: "set cell (row R, column C) from X to Y", "insert these rows with these keys".
// Every op carries what was there before, so it can be turned around (undo), and it means the same thing on another computer whatever that one has
// inserted in the meantime (what working together will need). Typing, pasting, filling, inserting, sorting, formatting, undo and the host's own code all
// make ops; before one is applied the host's `beforeOp` sees it and may let it through, change it, or refuse it. Nothing changes any other way.
//
// What changed since the last save is kept as a patch of whole rows, columns and sheets (by id), the shape the database keeps them in.

import { newId } from './ids.js';
import { keyBetween, keysBetween, compareKeys } from './order.js';
import { createEngine } from './calc.js';
import { storeFormula, formulaText, isStoredFormula } from './refs.js';
import { colName } from './formula/address.js';
import { parseInput } from './input.js';
import { createAxis } from './axis.js';

/**
 * A workbook as it is stored (and as a patch carries its parts).
 * @typedef {object} WorkbookDoc
 * @property {string} [id]
 * @property {number} [version]  Raised by the server on every save; a save made from an older version is refused there.
 * @property {object} [settings]
 * @property {SheetDoc[]} [sheets]
 *
 * @typedef {{ id: string, key: string, props: object, columns?: ColumnDoc[], rows?: RowDoc[] }} SheetDoc
 * @typedef {{ id: string, key: string, props?: object }} ColumnDoc
 * @typedef {{ id: string, key: string, cells?: Object<string, any>, style?: Object<string, object>, props?: object }} RowDoc
 */

/**
 * @typedef {object} OpContext
 * @property {'user'|'code'|'undo'|'redo'|'remote'} source  Who made the change: a person in the grid, the host's code, undo / redo, or another computer.
 * @property {string|null} user  Who the host said is working (options.user).
 * @property {object} workbook  The workbook, to look things up.
 */

/**
 * @typedef {object} WorkbookOptions
 * @property {string} [user]  Written into every op, for the history.
 * @property {(op: object, ctx: OpContext) => (object|null|false|{ reject: string })} [beforeOp]
 *   Sees every op before it is applied. Return the op (or a changed copy) to apply it, null or false to drop it quietly, or { reject: "why" } to refuse the
 *   whole change it belongs to (nothing of it is applied, and the "reject" event says why).
 * @property {() => Date} [now]  The clock of NOW() and TODAY() (tests fix it).
 * @property {number} [undoLimit]  How many changes undo remembers (default 200).
 */

const DEFAULT_ROWS = 1000;
const DEFAULT_COLS = 26;
// the sizes Google Sheets gives a new sheet, in pixels
const DEFAULT_ROW_HEIGHT = 21;
const DEFAULT_COL_WIDTH = 100;

// A copy of what is kept, so that the caller cannot change the workbook behind its back. Numbers, texts and booleans (most cells) need no copy at all.
const clone = (v) => (v === null || typeof v !== 'object' ? v : isStoredFormula(v) ? { f: v.f, refs: v.refs.map((r) => ({ ...r })) } : JSON.parse(JSON.stringify(v)));
// a copy of the cells (or styles) of a row: one level, each content copied as above
const copyCells = (cells) => { const out = {}; for (const k in cells) out[k] = clone(cells[k]); return out; };
const sameValue = (a, b) => (a === b) || JSON.stringify(a) === JSON.stringify(b);

/**
 * Makes a workbook from what was stored, or a new one with one empty sheet of 1000 rows and 26 columns.
 * @param {WorkbookDoc} [doc]
 * @param {WorkbookOptions} [options]
 */
export function createWorkbook(doc, options) {
    const opt = options || {};
    const listeners = new Map();
    const sheets = new Map();        // id -> sheet (see makeSheet)
    let sheetOrder = [];             // ids, in the order of their keys
    let settings = clone((doc && doc.settings) || {});
    let version = (doc && doc.version) || 0;
    const id = (doc && doc.id) || newId();

    const undoStack = [];
    const redoStack = [];
    const undoLimit = opt.undoLimit || 200;

    // what changed since the last save: id -> the number of the change that last touched it (a save clears only what it carried, see saved())
    let changeNo = 0;
    const dirty = { sheets: new Map(), columns: new Map(), rows: new Map(), settings: 0 };
    const gone = { sheets: new Map(), columns: new Map(), rows: new Map() };
    const homeOfRow = new Map();     // row id -> its sheet
    const homeOfCol = new Map();     // column id -> its sheet

    // ---- the sheets in memory ----------------------------------------------------------------------------------------------------------------------

    function makeSheet(d) {
        const sheet = { id: d.id, key: d.key, props: clone(d.props || {}), cols: new Map(), colOrder: [], colPos: null, rows: new Map(), rowOrder: [], rowPos: null };
        for (const c of d.columns || []) sheet.cols.set(c.id, { id: c.id, key: c.key, props: clone(c.props || {}) });
        for (const r of d.rows || []) sheet.rows.set(r.id, { id: r.id, key: r.key, cells: copyCells(r.cells || {}), style: copyCells(r.style || {}), props: clone(r.props || {}) });
        sheet.colOrder = [...sheet.cols.values()].sort((a, b) => compareKeys(a.key, b.key)).map((c) => c.id);
        sheet.rowOrder = [...sheet.rows.values()].sort((a, b) => compareKeys(a.key, b.key)).map((r) => r.id);
        for (const cid of sheet.colOrder) homeOfCol.set(cid, sheet);
        for (const rid of sheet.rowOrder) homeOfRow.set(rid, sheet);
        return sheet;
    }

    function blankSheet(name, rows, cols) {
        const colKeys = keysBetween(null, null, cols);
        const rowKeys = keysBetween(null, null, rows);
        return {
            id: newId(), key: keyBetween(sheetOrder.length ? sheets.get(sheetOrder[sheetOrder.length - 1]).key : null, null), props: { name },
            columns: colKeys.map((key) => ({ id: newId(), key, props: {} })),
            rows: rowKeys.map((key) => ({ id: newId(), key, cells: {}, style: {}, props: {} }))
        };
    }

    function sortSheets() { sheetOrder = [...sheets.values()].sort((a, b) => compareKeys(a.key, b.key)).map((s) => s.id); }

    const sheetOf = (s) => {
        const sheet = sheets.get(s);
        if (!sheet) throw new Error('there is no sheet ' + s);
        return sheet;
    };
    // the position of every row and column, worked out again only after rows or columns moved
    const rowPos = (sheet) => sheet.rowPos || (sheet.rowPos = new Map(sheet.rowOrder.map((rid, i) => [rid, i])));
    const colPos = (sheet) => sheet.colPos || (sheet.colPos = new Map(sheet.colOrder.map((cid, i) => [cid, i])));

    // Inserts ids into an order kept by key, and returns the new order. A few ids: a binary search and a splice each. Many ids: one merge of the two
    // sorted lists (a splice for each of 99 000 rows would move the whole list 99 000 times).
    function placeByKey(order, items, keyOf) {
        const sorted = [...items].sort((a, b) => compareKeys(a.key, b.key));
        if (sorted.length < 64) {
            for (const item of sorted) {
                let lo = 0, hi = order.length;
                while (lo < hi) { const mid = (lo + hi) >> 1; if (compareKeys(keyOf(order[mid]), item.key) < 0) lo = mid + 1; else hi = mid; }
                order.splice(lo, 0, item.id);
            }
            return order;
        }
        const out = new Array(order.length + sorted.length);
        let i = 0, j = 0, k = 0;
        while (i < order.length && j < sorted.length) out[k++] = compareKeys(keyOf(order[i]), sorted[j].key) <= 0 ? order[i++] : sorted[j++].id;
        while (i < order.length) out[k++] = order[i++];
        while (j < sorted.length) out[k++] = sorted[j++].id;
        return out;
    }

    // ---- what refs.js and calc.js read -------------------------------------------------------------------------------------------------------------

    const grid = {
        sheetIdByName(name) {
            const want = String(name).toLowerCase();
            for (const s of sheetOrder) if (String(sheets.get(s).props.name || '').toLowerCase() === want) return s;
            return null;
        },
        sheetName: (s) => String(sheetOf(s).props.name || ''),
        size: (s) => { const sheet = sheets.get(s); return sheet ? { rows: sheet.rowOrder.length, cols: sheet.colOrder.length } : null; },
        rowIdAt: (s, i) => sheetOf(s).rowOrder[i],
        colIdAt: (s, i) => sheetOf(s).colOrder[i],
        rowOrder: (s) => sheetOf(s).rowOrder,
        colOrder: (s) => sheetOf(s).colOrder,
        rowIndexOf: (s, rid) => { const sheet = sheets.get(s); if (!sheet) return -1; const i = rowPos(sheet).get(rid); return i === undefined ? -1 : i; },
        colIndexOf: (s, cid) => { const sheet = sheets.get(s); if (!sheet) return -1; const i = colPos(sheet).get(cid); return i === undefined ? -1 : i; },
        content(s, rid, cid) {
            const sheet = sheets.get(s);
            const row = sheet && sheet.rows.get(rid);
            if (!row || !sheet.cols.has(cid)) return undefined;
            const v = row.cells[cid];
            return isStoredFormula(v) ? undefined : v;
        },
        decimalsFor(s, cid) {
            const sheet = sheets.get(s);
            const col = sheet && sheet.cols.get(cid);
            const fmt = col && col.props.format;
            return fmt && fmt.type === 'money' ? (fmt.decimals === undefined ? 2 : fmt.decimals) : null;
        },
        now: () => (opt.now ? opt.now() : new Date())
    };
    const engine = createEngine(grid);

    // every formula of a sheet into the engine (when a workbook is opened, and when a sheet comes back by undo)
    function registerSheet(sheet) {
        for (const row of sheet.rows.values()) {
            for (const cid of Object.keys(row.cells)) {
                const v = row.cells[cid];
                if (isStoredFormula(v) && sheet.cols.has(cid)) engine.setFormula(sheet.id, row.id, cid, v, true);
            }
        }
    }

    // ---- opening -----------------------------------------------------------------------------------------------------------------------------------

    const initial = doc && doc.sheets && doc.sheets.length ? doc.sheets : [blankSheet('Sheet1', DEFAULT_ROWS, DEFAULT_COLS)];
    for (const d of initial) sheets.set(d.id, makeSheet(d));
    sortSheets();
    for (const s of sheetOrder) registerSheet(sheets.get(s));
    // a new workbook is not stored yet: all of it is in the first patch
    if (!(doc && doc.sheets && doc.sheets.length)) {
        changeNo++;
        for (const sheet of sheets.values()) {
            dirty.sheets.set(sheet.id, changeNo);
            for (const cid of sheet.colOrder) dirty.columns.set(cid, changeNo);
            for (const rid of sheet.rowOrder) dirty.rows.set(rid, changeNo);
        }
        dirty.settings = changeNo;
    }

    // ---- events -------------------------------------------------------------------------------------------------------------------------------------

    function on(type, fn) {
        let set = listeners.get(type);
        if (!set) listeners.set(type, (set = new Set()));
        set.add(fn);
        return () => set.delete(fn);
    }
    function emit(type, payload) {
        const set = listeners.get(type);
        if (set) for (const fn of [...set]) fn(payload);
    }

    // ---- applying one op ----------------------------------------------------------------------------------------------------------------------------

    function touchRow(rid) { dirty.rows.set(rid, changeNo); gone.rows.delete(rid); }

    function setContent(sheet, rid, cid, after) {
        const row = sheet.rows.get(rid);
        if (!row) throw new Error('there is no row ' + rid + ' in sheet ' + sheet.id);
        if (after === undefined || after === null || after === '') delete row.cells[cid];
        else row.cells[cid] = clone(after);
        if (!sheet.cols.has(cid)) return;
        if (isStoredFormula(after)) engine.setFormula(sheet.id, rid, cid, after);
        else {
            if (engine.formulaOf(sheet.id, rid, cid)) engine.setFormula(sheet.id, rid, cid, null);
            else engine.cellChanged(sheet.id, rid, cid);
        }
        touchRow(rid);
    }

    const APPLY = {
        cells(op) {
            const sheet = sheetOf(op.sheet);
            for (const ch of op.changes) setContent(sheet, ch.row, ch.col, ch.after);
        },
        styles(op) {
            const sheet = sheetOf(op.sheet);
            for (const ch of op.changes) {
                const row = sheet.rows.get(ch.row);
                if (!row) throw new Error('there is no row ' + ch.row);
                if (ch.after === undefined || ch.after === null || !Object.keys(ch.after).length) delete row.style[ch.col];
                else row.style[ch.col] = clone(ch.after);
                touchRow(ch.row);
            }
        },
        insertRows(op) {
            const sheet = sheetOf(op.sheet);
            for (const r of op.rows) {
                if (sheet.rows.has(r.id)) throw new Error('the row ' + r.id + ' is there already');
                sheet.rows.set(r.id, { id: r.id, key: r.key, cells: clone(r.cells || {}), style: clone(r.style || {}), props: clone(r.props || {}) });
                homeOfRow.set(r.id, sheet);
                touchRow(r.id);
            }
            sheet.rowOrder = placeByKey(sheet.rowOrder, op.rows, (x) => sheet.rows.get(x).key);
            sheet.rowPos = null;
            for (const r of op.rows) {
                for (const cid of Object.keys(r.cells || {})) if (isStoredFormula(r.cells[cid]) && sheet.cols.has(cid)) engine.setFormula(sheet.id, r.id, cid, r.cells[cid], true);
            }
            engine.rowsChanged(sheet.id, op.rows.map((r) => r.id));
        },
        deleteRows(op) {
            const sheet = sheetOf(op.sheet);
            const ids = new Set(op.rows.map((r) => r.id));
            for (const rid of ids) {
                const row = sheet.rows.get(rid);
                if (!row) throw new Error('there is no row ' + rid);
                for (const cid of Object.keys(row.cells)) if (engine.formulaOf(sheet.id, rid, cid)) engine.setFormula(sheet.id, rid, cid, null, true);
                sheet.rows.delete(rid);
                homeOfRow.delete(rid);
                dirty.rows.delete(rid);
                gone.rows.set(rid, changeNo);
            }
            sheet.rowOrder = sheet.rowOrder.filter((rid) => !ids.has(rid));
            sheet.rowPos = null;
            engine.rowsChanged(sheet.id, [...ids]);
        },
        insertCols(op) {
            const sheet = sheetOf(op.sheet);
            for (const c of op.cols) {
                if (sheet.cols.has(c.id)) throw new Error('the column ' + c.id + ' is there already');
                sheet.cols.set(c.id, { id: c.id, key: c.key, props: clone(c.props || {}) });
                homeOfCol.set(c.id, sheet);
                dirty.columns.set(c.id, changeNo);
                gone.columns.delete(c.id);
            }
            sheet.colOrder = placeByKey(sheet.colOrder, op.cols, (x) => sheet.cols.get(x).key);
            sheet.colPos = null;
            // a column that comes back (undo of a delete) finds its cells still in the rows: their formulas count again
            const back = new Set(op.cols.map((c) => c.id));
            for (const row of sheet.rows.values()) {
                for (const cid of Object.keys(row.cells)) if (back.has(cid) && isStoredFormula(row.cells[cid])) engine.setFormula(sheet.id, row.id, cid, row.cells[cid], true);
            }
            engine.colsChanged(sheet.id, [...back]);
        },
        deleteCols(op) {
            const sheet = sheetOf(op.sheet);
            const ids = new Set(op.cols.map((c) => c.id));
            for (const cid of ids) {
                if (!sheet.cols.has(cid)) throw new Error('there is no column ' + cid);
                // the cells stay in their rows, unseen: undo brings the column back with them, and the next save of a row leaves them out
                for (const rid of engine.formulaRowsOf(sheet.id, cid)) engine.setFormula(sheet.id, rid, cid, null, true);
                sheet.cols.delete(cid);
                homeOfCol.delete(cid);
                dirty.columns.delete(cid);
                gone.columns.set(cid, changeNo);
            }
            sheet.colOrder = sheet.colOrder.filter((cid) => !ids.has(cid));
            sheet.colPos = null;
            engine.colsChanged(sheet.id, [...ids]);
        },
        moveRows(op) {
            const sheet = sheetOf(op.sheet);
            const ids = new Set(op.moves.map((m) => m.id));
            for (const m of op.moves) { sheet.rows.get(m.id).key = m.after; touchRow(m.id); }
            sheet.rowOrder = sheet.rowOrder.filter((rid) => !ids.has(rid));
            sheet.rowOrder = placeByKey(sheet.rowOrder, op.moves.map((m) => ({ id: m.id, key: m.after })), (x) => sheet.rows.get(x).key);
            sheet.rowPos = null;
            engine.moved(sheet.id);
        },
        moveCols(op) {
            const sheet = sheetOf(op.sheet);
            const ids = new Set(op.moves.map((m) => m.id));
            for (const m of op.moves) { sheet.cols.get(m.id).key = m.after; dirty.columns.set(m.id, changeNo); }
            sheet.colOrder = sheet.colOrder.filter((cid) => !ids.has(cid));
            sheet.colOrder = placeByKey(sheet.colOrder, op.moves.map((m) => ({ id: m.id, key: m.after })), (x) => sheet.cols.get(x).key);
            sheet.colPos = null;
            engine.moved(sheet.id);
        },
        rowProps(op) {
            const sheet = sheetOf(op.sheet);
            for (const ch of op.changes) { sheet.rows.get(ch.id).props = clone(ch.after || {}); touchRow(ch.id); }
        },
        colProps(op) {
            const sheet = sheetOf(op.sheet);
            for (const ch of op.changes) {
                const col = sheet.cols.get(ch.id);
                const moneyBefore = JSON.stringify(col.props.format || null);
                col.props = clone(ch.after || {});
                dirty.columns.set(ch.id, changeNo);
                // a column that turns into money (or stops being money) rounds its formulas differently
                if (JSON.stringify(col.props.format || null) !== moneyBefore) {
                    for (const rid of engine.formulaRowsOf(sheet.id, ch.id)) engine.setFormula(sheet.id, rid, ch.id, engine.formulaOf(sheet.id, rid, ch.id));
                }
            }
        },
        sheetProps(op) {
            const sheet = sheetOf(op.sheet);
            sheet.props = clone(op.after || {});
            dirty.sheets.set(sheet.id, changeNo);
            // a renamed sheet changes no value: the formulas into it keep it by id, and only read with its new name
        },
        addSheet(op) {
            if (sheets.has(op.sheet.id)) throw new Error('the sheet ' + op.sheet.id + ' is there already');
            const sheet = makeSheet(op.sheet);
            sheets.set(sheet.id, sheet);
            sortSheets();
            dirty.sheets.set(sheet.id, changeNo);
            gone.sheets.delete(sheet.id);
            for (const cid of sheet.colOrder) { dirty.columns.set(cid, changeNo); gone.columns.delete(cid); }
            for (const rid of sheet.rowOrder) { dirty.rows.set(rid, changeNo); gone.rows.delete(rid); }
            registerSheet(sheet);
            engine.sheetChanged(sheet.id);
        },
        removeSheet(op) {
            const sheet = sheetOf(op.sheet.id);
            for (const row of sheet.rows.values()) {
                for (const cid of Object.keys(row.cells)) if (engine.formulaOf(sheet.id, row.id, cid)) engine.setFormula(sheet.id, row.id, cid, null);
            }
            engine.sheetChanged(sheet.id);
            sheets.delete(sheet.id);
            sortSheets();
            // the rows and columns go with their sheet: the database deletes them with it (on delete cascade)
            dirty.sheets.delete(sheet.id);
            for (const cid of sheet.colOrder) { dirty.columns.delete(cid); homeOfCol.delete(cid); }
            for (const rid of sheet.rowOrder) { dirty.rows.delete(rid); homeOfRow.delete(rid); }
            gone.sheets.set(sheet.id, changeNo);
        },
        moveSheet(op) {
            sheetOf(op.id).key = op.after;
            sortSheets();
            dirty.sheets.set(op.id, changeNo);
        },
        settings(op) {
            settings = clone(op.after || {});
            dirty.settings = changeNo;
        }
    };

    /** The op that undoes an op. */
    function invert(op) {
        switch (op.t) {
            case 'cells': case 'styles': return { ...op, changes: op.changes.map((c) => ({ ...c, before: c.after, after: c.before })).reverse() };
            case 'insertRows': return { ...op, t: 'deleteRows' };
            case 'deleteRows': return { ...op, t: 'insertRows' };
            case 'insertCols': return { ...op, t: 'deleteCols' };
            case 'deleteCols': return { ...op, t: 'insertCols' };
            case 'moveRows': case 'moveCols': return { ...op, moves: op.moves.map((m) => ({ id: m.id, before: m.after, after: m.before })) };
            case 'rowProps': case 'colProps': return { ...op, changes: op.changes.map((c) => ({ id: c.id, before: c.after, after: c.before })) };
            case 'sheetProps': case 'settings': return { ...op, before: op.after, after: op.before };
            case 'addSheet': return { ...op, t: 'removeSheet' };
            case 'removeSheet': return { ...op, t: 'addSheet' };
            case 'moveSheet': return { ...op, before: op.after, after: op.before };
            default: throw new Error('an op that cannot be turned around: ' + op.t);
        }
    }

    // ---- the one door ---------------------------------------------------------------------------------------------------------------------------

    // ---- the layout: sizes of rows and columns, merged cells ------------------------------------------------------------------------------------------

    // Raised on every change that is applied, so a screen knows when to draw again (React reads it with useSyncExternalStore).
    let revision = 0;

    const ROW_OPS = new Set(['insertRows', 'deleteRows', 'moveRows', 'rowProps']);
    const COL_OPS = new Set(['insertCols', 'deleteCols', 'moveCols', 'colProps']);
    // the sizes of a sheet are made into positions once, and again only after a change of a size, a row or a column
    function forgetLayout(op) {
        const sheet = op.sheet && typeof op.sheet === 'string' ? sheets.get(op.sheet) : null;
        if (!sheet) return;
        if (ROW_OPS.has(op.t) || op.t === 'sheetProps') sheet.rowAxis = null;
        if (COL_OPS.has(op.t) || op.t === 'sheetProps') sheet.colAxis = null;
    }

    /** The height of every row (hidden rows: 0), as positions. */
    function rowAxis(s) {
        const sheet = sheetOf(sheetIdOf(s));
        if (!sheet.rowAxis) {
            const fallback = sheet.props.rowHeight || DEFAULT_ROW_HEIGHT;
            const auto = sheet.autoHeights;
            // a height set by hand wins; else the height the screen measured for the row's text (wrapped, several lines, a big font); else the default
            sheet.rowAxis = createAxis(sheet.rowOrder.length, (i) => {
                const rid = sheet.rowOrder[i];
                const p = sheet.rows.get(rid).props;
                if (p.hidden) return 0;
                if (p.height) return p.height;
                const measured = auto && auto.get(rid);
                return measured && measured > fallback ? measured : fallback;
            });
        }
        return sheet.rowAxis;
    }

    /**
     * The heights the screen measured for rows whose text needs more room than a row has (wrapped text, several lines, a big font). They depend on fonts,
     * which only a browser can measure, so they are not part of the workbook: not an op, not undone, not saved. A row with a height set by hand keeps it.
     * @param {string} s
     * @param {Map<string, number>} heights  row id -> height in pixels (0 or absent: the default height)
     */
    function setAutoHeights(s, heights) {
        const sheet = sheetOf(sheetIdOf(s));
        if (!sheet.autoHeights) sheet.autoHeights = new Map();
        let changed = false;
        for (const [rid, h] of heights) {
            const before = sheet.autoHeights.get(rid) || 0;
            if (before === (h || 0)) continue;
            if (h) sheet.autoHeights.set(rid, h); else sheet.autoHeights.delete(rid);
            changed = true;
        }
        if (!changed) return false;
        sheet.rowAxis = null;
        revision++;
        emit('layout', { sheet: sheet.id });
        return true;
    }

    /**
     * Calls fn(r, cells, styles) for every row that holds content or style, in order. `cells` and `styles` are the workbook's own objects (column id ->
     * content / style), given without a copy for speed: they must only be read.
     */
    function forEachFilledRow(s, fn) {
        const sheet = sheetOf(sheetIdOf(s));
        for (let r = 0; r < sheet.rowOrder.length; r++) {
            const row = sheet.rows.get(sheet.rowOrder[r]);
            let any = false;
            for (const k in row.cells) { any = true; break; }
            if (!any) for (const k in row.style) { any = true; break; }
            if (any) fn(r, row.cells, row.style);
        }
    }

    /** The width of every column (hidden columns: 0), as positions. */
    function colAxis(s) {
        const sheet = sheetOf(sheetIdOf(s));
        if (!sheet.colAxis) {
            const fallback = sheet.props.colWidth || DEFAULT_COL_WIDTH;
            sheet.colAxis = createAxis(sheet.colOrder.length, (i) => {
                const p = sheet.cols.get(sheet.colOrder[i]).props;
                return p.hidden ? 0 : p.width || fallback;
            });
        }
        return sheet.colAxis;
    }

    /**
     * The merged blocks of a sheet, by position: [{ r1, c1, r2, c2 }]. They are kept by the ids of their corners, so a block moves with its rows; a block
     * whose corner row or column was deleted is left out.
     */
    // where one stored block stands now, or null when a corner of it was deleted
    function resolveMerge(s, m) {
        const r1 = grid.rowIndexOf(s, m.r1), r2 = grid.rowIndexOf(s, m.r2), c1 = grid.colIndexOf(s, m.c1), c2 = grid.colIndexOf(s, m.c2);
        if (r1 < 0 || r2 < 0 || c1 < 0 || c2 < 0) return null;
        return { r1: Math.min(r1, r2), c1: Math.min(c1, c2), r2: Math.max(r1, r2), c2: Math.max(c1, c2) };
    }

    function merges(s) {
        s = sheetIdOf(s);
        const out = [];
        for (const m of sheetOf(s).props.merges || []) { const at = resolveMerge(s, m); if (at) out.push(at); }
        return out;
    }

    const overlaps = (a, b) => a.r1 <= b.r2 && a.r2 >= b.r1 && a.c1 <= b.c2 && a.c2 >= b.c1;

    // the stored blocks that stand and do not overlap `range` (a block that lost a corner is dropped on the way)
    const mergesApartFrom = (s, range) => (sheetOf(s).props.merges || []).filter((m) => { const at = resolveMerge(s, m); return at && !overlaps(at, range); });

    /** Merges a rectangle into one cell (blocks it overlaps are taken apart first). The cells under it keep their content, unseen, as undo needs. */
    function mergeCells(s, range, how) {
        s = sheetIdOf(s);
        const sheet = sheetOf(s);
        if (range.r1 === range.r2 && range.c1 === range.c2) return [];
        const block = { r1: sheet.rowOrder[range.r1], c1: sheet.colOrder[range.c1], r2: sheet.rowOrder[range.r2], c2: sheet.colOrder[range.c2] };
        return setSheetProps(s, { merges: mergesApartFrom(s, range).concat([block]) }, how);
    }

    /** Takes apart every merged block that overlaps the rectangle. */
    function unmergeCells(s, range, how) {
        s = sheetIdOf(s);
        const all = sheetOf(s).props.merges || [];
        const kept = mergesApartFrom(s, range);
        return kept.length === all.length ? [] : setSheetProps(s, { merges: kept.length ? kept : null }, how);
    }

    /**
     * Applies a change: a list of ops that belong together (one paste, one insert, one undo). The host's beforeOp sees each op first; if it refuses one,
     * nothing of the change is applied. Returns the ops that were applied (after beforeOp), or null when the change was refused.
     * @param {object[]} ops
     * @param {{ source?: OpContext['source'] }} [how]
     */
    function apply(ops, how) {
        const source = (how && how.source) || 'code';
        const ctx = { source, user: opt.user || null, workbook: api };
        const accepted = [];
        for (const op of ops) {
            const answer = opt.beforeOp ? opt.beforeOp(op, ctx) : op;
            if (answer && typeof answer === 'object' && typeof answer.reject === 'string') {
                emit('reject', { op, reason: answer.reject, source });
                return null;
            }
            if (answer) accepted.push(answer);
        }
        if (!accepted.length) return [];
        changeNo++;
        const at = new Date().toISOString();
        const done = [];
        try {
            for (const op of accepted) { APPLY[op.t](op); done.push(op); }
        } catch (error) {
            // an op that cannot be applied (it names a row that is not there) takes back the ones of the same change before it: a change is whole or nothing
            for (const op of done.reverse()) APPLY[invert(op).t](invert(op));
            throw error;
        }
        if (source === 'user' || source === 'code') {
            undoStack.push(accepted);
            if (undoStack.length > undoLimit) undoStack.shift();
            redoStack.length = 0;
        }
        for (const op of accepted) forgetLayout(op);
        revision++;
        const stamped = accepted.map((op) => ({ ...op, user: opt.user || null, at }));
        emit('op', { ops: stamped, source });
        return stamped;
    }

    function undo() {
        const last = undoStack.pop();
        if (!last) return false;
        const done = apply(last.map(invert).reverse(), { source: 'undo' });
        if (done === null) { undoStack.push(last); return false; }
        redoStack.push(last);
        return true;
    }

    function redo() {
        const next = redoStack.pop();
        if (!next) return false;
        const done = apply(next, { source: 'redo' });
        if (done === null) { redoStack.push(next); return false; }
        undoStack.push(next);
        return true;
    }

    // ---- changes said as a person thinks of them (by position), made into ops ---------------------------------------------------------------------

    const sheetIdOf = (s) => (s === undefined ? sheetOrder[0] : s);

    /**
     * What a cell holds once `input` is written in it: a formula kept by ids, a number, a boolean, or a text (see input.js).
     * Values that are not text (a number from code) are kept as they are.
     */
    function contentFor(s, input) {
        if (typeof input !== 'string') return input === null ? undefined : input;
        const parsed = parseInput(input);
        if (parsed && parsed.formula !== undefined) return storeFormula(parsed.formula, s, grid);
        return parsed.value;
    }

    /**
     * Writes values into cells from (r, c) on: one value, or rows of values (a matrix). Strings are read as a person types them ("=A1*2", "12.5", "TRUE").
     * @param {string} s @param {number} r @param {number} c @param {any|any[][]} values
     * @param {{ source?: OpContext['source'] }} [how]
     */
    function setValues(s, r, c, values, how) {
        s = sheetIdOf(s);
        const sheet = sheetOf(s);
        const matrix = Array.isArray(values) ? values.map((row) => (Array.isArray(row) ? row : [row])) : [[values]];
        const changes = [];
        matrix.forEach((row, i) => row.forEach((v, j) => {
            const rid = sheet.rowOrder[r + i], cid = sheet.colOrder[c + j];
            if (rid === undefined || cid === undefined) return;
            const before = sheet.rows.get(rid).cells[cid];
            const after = contentFor(s, v);
            if (!sameValue(before, after)) changes.push({ row: rid, col: cid, before: clone(before), after });
        }));
        return changes.length ? apply([{ t: 'cells', sheet: s, changes }], how) : [];
    }

    /**
     * Empties the cells of a rectangle, or of several (a selection made with Ctrl): their style stays, as with the Delete key in Google Sheets.
     * Several rectangles are one change, so one undo brings them all back.
     */
    function clear(s, ranges, how) {
        s = sheetIdOf(s);
        const sheet = sheetOf(s);
        const changes = [];
        const seen = new Set();
        for (const range of Array.isArray(ranges) ? ranges : [ranges]) {
            for (let r = range.r1; r <= range.r2; r++) {
                const rid = sheet.rowOrder[r];
                if (rid === undefined) continue;
                const row = sheet.rows.get(rid);
                for (let c = range.c1; c <= range.c2; c++) {
                    const cid = sheet.colOrder[c];
                    if (cid === undefined || row.cells[cid] === undefined || seen.has(rid + cid)) continue;
                    seen.add(rid + cid);
                    changes.push({ row: rid, col: cid, before: clone(row.cells[cid]), after: undefined });
                }
            }
        }
        return changes.length ? apply([{ t: 'cells', sheet: s, changes }], how) : [];
    }

    /**
     * Writes the content and the style of many cells as one change (a paste, a cut, a fill): one undo takes it all back.
     * Each entry is { r, c, value, style }: `value` is read as typed when it is a text ("=A1*2", "12", "TRUE"), kept as it is otherwise, and left alone when
     * it is absent; `style` replaces the whole style of the cell (null takes it away) and is left alone when absent. A later entry for the same cell wins.
     * @param {string} s
     * @param {{ r: number, c: number, value?: any, style?: object|null }[]} entries
     */
    function setBlock(s, entries, how) {
        s = sheetIdOf(s);
        const sheet = sheetOf(s);
        const last = new Map();
        for (const e of entries) {
            const rid = sheet.rowOrder[e.r], cid = sheet.colOrder[e.c];
            if (rid === undefined || cid === undefined) continue;
            const k = rid + '|' + cid;
            last.set(k, Object.assign({}, last.get(k), { rid, cid }, 'value' in e ? { hasValue: true, value: e.value } : null, 'style' in e ? { hasStyle: true, style: e.style } : null));
        }
        const cells = [], styles = [];
        for (const x of last.values()) {
            const row = sheet.rows.get(x.rid);
            if (x.hasValue) {
                const before = row.cells[x.cid];
                const after = x.value === null || x.value === undefined ? undefined : contentFor(s, x.value);
                if (!sameValue(before, after)) cells.push({ row: x.rid, col: x.cid, before: clone(before), after });
            }
            if (x.hasStyle) {
                const before = row.style[x.cid];
                const after = x.style && Object.keys(x.style).length ? clone(x.style) : undefined;
                if (!sameValue(before, after)) styles.push({ row: x.rid, col: x.cid, before: clone(before), after });
            }
        }
        const ops = [];
        if (cells.length) ops.push({ t: 'cells', sheet: s, changes: cells });
        if (styles.length) ops.push({ t: 'styles', sheet: s, changes: styles });
        return ops.length ? apply(ops, how) : [];
    }

    /** The last row and the last column that hold anything, as Ctrl+End finds them; { r: -1, c: -1 } in an empty sheet. */
    function lastFilled(s) {
        const sheet = sheetOf(sheetIdOf(s));
        let r = -1, c = -1;
        const order = new Map(sheet.colOrder.map((cid, i) => [cid, i]));
        for (let i = sheet.rowOrder.length - 1; i >= 0; i--) {
            const cells = sheet.rows.get(sheet.rowOrder[i]).cells;
            for (const cid in cells) { const ci = order.get(cid); if (ci !== undefined) { if (r < 0) r = i; if (ci > c) c = ci; } }
        }
        return { r, c };
    }

    /** Merges a style patch into every cell of a rectangle (a key set to null takes that part of the style away). */
    function setStyle(s, range, patch, how) {
        s = sheetIdOf(s);
        const sheet = sheetOf(s);
        const changes = [];
        for (let r = range.r1; r <= range.r2; r++) {
            const rid = sheet.rowOrder[r];
            if (rid === undefined) continue;
            const row = sheet.rows.get(rid);
            for (let c = range.c1; c <= range.c2; c++) {
                const cid = sheet.colOrder[c];
                if (cid === undefined) continue;
                const before = row.style[cid];
                const after = Object.assign({}, before || {}, patch);
                for (const k of Object.keys(after)) if (after[k] === null || after[k] === undefined) delete after[k];
                if (!sameValue(before || {}, after)) changes.push({ row: rid, col: cid, before: clone(before), after });
            }
        }
        return changes.length ? apply([{ t: 'styles', sheet: s, changes }], how) : [];
    }

    /** Inserts `count` empty rows before row `at` (at = the number of rows: at the end). */
    function insertRows(s, at, count, how) {
        s = sheetIdOf(s);
        const sheet = sheetOf(s);
        const before = at > 0 ? sheet.rows.get(sheet.rowOrder[at - 1]).key : null;
        const after = at < sheet.rowOrder.length ? sheet.rows.get(sheet.rowOrder[at]).key : null;
        const keys = keysBetween(before, after, count);
        return apply([{ t: 'insertRows', sheet: s, rows: keys.map((key) => ({ id: newId(), key, cells: {}, style: {}, props: {} })) }], how);
    }

    /** Deletes `count` rows from row `at`. */
    function deleteRows(s, at, count, how) {
        s = sheetIdOf(s);
        const sheet = sheetOf(s);
        const rows = sheet.rowOrder.slice(at, at + count).map((rid) => {
            const row = sheet.rows.get(rid);
            return { id: rid, key: row.key, cells: clone(row.cells), style: clone(row.style), props: clone(row.props) };
        });
        return rows.length ? apply([{ t: 'deleteRows', sheet: s, rows }], how) : [];
    }

    /** Inserts `count` empty columns before column `at`. */
    function insertCols(s, at, count, how) {
        s = sheetIdOf(s);
        const sheet = sheetOf(s);
        const before = at > 0 ? sheet.cols.get(sheet.colOrder[at - 1]).key : null;
        const after = at < sheet.colOrder.length ? sheet.cols.get(sheet.colOrder[at]).key : null;
        const keys = keysBetween(before, after, count);
        return apply([{ t: 'insertCols', sheet: s, cols: keys.map((key) => ({ id: newId(), key, props: {} })) }], how);
    }

    /** Deletes `count` columns from column `at`. */
    function deleteCols(s, at, count, how) {
        s = sheetIdOf(s);
        const sheet = sheetOf(s);
        const cols = sheet.colOrder.slice(at, at + count).map((cid) => { const col = sheet.cols.get(cid); return { id: cid, key: col.key, props: clone(col.props) }; });
        return cols.length ? apply([{ t: 'deleteCols', sheet: s, cols }], how) : [];
    }

    /** Moves `count` rows from row `from` so that they stand before row `to` (counted before the move). */
    function moveRows(s, from, count, to, how) {
        s = sheetIdOf(s);
        const sheet = sheetOf(s);
        const moving = sheet.rowOrder.slice(from, from + count);
        if (!moving.length || (to >= from && to <= from + count)) return [];
        const before = to > 0 ? sheet.rows.get(sheet.rowOrder[to - 1]).key : null;
        const after = to < sheet.rowOrder.length ? sheet.rows.get(sheet.rowOrder[to]).key : null;
        const keys = keysBetween(before, after, moving.length);
        return apply([{ t: 'moveRows', sheet: s, moves: moving.map((rid, i) => ({ id: rid, before: sheet.rows.get(rid).key, after: keys[i] })) }], how);
    }

    /** Moves `count` columns from column `from` so that they stand before column `to`. */
    function moveCols(s, from, count, to, how) {
        s = sheetIdOf(s);
        const sheet = sheetOf(s);
        const moving = sheet.colOrder.slice(from, from + count);
        if (!moving.length || (to >= from && to <= from + count)) return [];
        const before = to > 0 ? sheet.cols.get(sheet.colOrder[to - 1]).key : null;
        const after = to < sheet.colOrder.length ? sheet.cols.get(sheet.colOrder[to]).key : null;
        const keys = keysBetween(before, after, moving.length);
        return apply([{ t: 'moveCols', sheet: s, moves: moving.map((cid, i) => ({ id: cid, before: sheet.cols.get(cid).key, after: keys[i] })) }], how);
    }

    const merged = (base, patch) => { const out = Object.assign({}, base, patch); for (const k of Object.keys(out)) if (out[k] === null || out[k] === undefined) delete out[k]; return out; };

    /**
     * Merges a patch into the props of rows (height, hidden, group level ...). `patch` is one object for every row, or a function of the row's number that
     * gives each its own (fitting rows to their text gives each its height); either way it is one change, undone at once.
     */
    function setRowProps(s, rows, patch, how) {
        s = sheetIdOf(s);
        const sheet = sheetOf(s);
        const changes = [];
        for (const r of rows) {
            const rid = sheet.rowOrder[r];
            if (!rid) continue;
            const p = sheet.rows.get(rid).props;
            changes.push({ id: rid, before: clone(p), after: merged(p, typeof patch === 'function' ? patch(r) : patch) });
        }
        return changes.length ? apply([{ t: 'rowProps', sheet: s, changes }], how) : [];
    }

    /** Merges a patch into the props of columns (width, hidden, header name, format ...): one object, or a function of the column's number. */
    function setColProps(s, cols, patch, how) {
        s = sheetIdOf(s);
        const sheet = sheetOf(s);
        const changes = [];
        for (const c of cols) {
            const cid = sheet.colOrder[c];
            if (!cid) continue;
            const p = sheet.cols.get(cid).props;
            changes.push({ id: cid, before: clone(p), after: merged(p, typeof patch === 'function' ? patch(c) : patch) });
        }
        return changes.length ? apply([{ t: 'colProps', sheet: s, changes }], how) : [];
    }

    /** The content and the styles of a row (column id -> ...), the workbook's own objects: only to be read. */
    function rowContent(s, r) {
        const sheet = sheetOf(sheetIdOf(s));
        const rid = sheet.rowOrder[r];
        const row = rid && sheet.rows.get(rid);
        return row ? { id: rid, cells: row.cells, styles: row.style } : null;
    }

    /** Merges `patch` into the props of a sheet (name, freeze, colours ...). */
    function setSheetProps(s, patch, how) {
        s = sheetIdOf(s);
        const sheet = sheetOf(s);
        if (patch.name !== undefined) {
            const name = String(patch.name).trim();
            const taken = grid.sheetIdByName(name);
            if (!name || (taken && taken !== s)) throw new Error('a sheet needs a name that no other sheet has: "' + name + '"');
        }
        return apply([{ t: 'sheetProps', sheet: s, before: clone(sheet.props), after: merged(sheet.props, patch) }], how);
    }

    /** Merges `patch` into the settings of the workbook (locale, currency, calculation ...). */
    function setSettings(patch, how) { return apply([{ t: 'settings', before: clone(settings), after: merged(settings, patch) }], how); }

    /** Adds a sheet at the end (an unused name like "Sheet2" when none is given); returns its id. */
    function addSheet(name, how) {
        let wanted = name ? String(name).trim() : '';
        if (!wanted) { let n = sheets.size + 1; while (grid.sheetIdByName('Sheet' + n)) n++; wanted = 'Sheet' + n; }
        if (grid.sheetIdByName(wanted)) throw new Error('a sheet is called "' + wanted + '" already');
        const d = blankSheet(wanted, DEFAULT_ROWS, DEFAULT_COLS);
        const done = apply([{ t: 'addSheet', sheet: d }], how);
        return done && done.length ? d.id : null;
    }

    /** Removes a sheet (the last one cannot go: a workbook always has a sheet). */
    function removeSheet(s, how) {
        if (sheets.size === 1) throw new Error('the last sheet cannot be removed');
        return apply([{ t: 'removeSheet', sheet: snapshotSheet(sheetOf(s)) }], how);
    }

    /** Moves a sheet so that it stands before sheet number `to`. */
    function moveSheet(s, to, how) {
        const others = sheetOrder.filter((x) => x !== s);
        const before = to > 0 ? sheets.get(others[to - 1]).key : null;
        const after = to < others.length ? sheets.get(others[to]).key : null;
        return apply([{ t: 'moveSheet', id: s, before: sheetOf(s).key, after: keyBetween(before, after) }], how);
    }

    /**
     * A copy of a sheet, right after it, called "Copy of …" (a number is added when that name is taken); returns its id. Every row, column and the sheet
     * itself get new ids, and the formulas and merged blocks that point inside the sheet are pointed at the copy's own rows and columns: the copy stands on
     * its own, it does not read the sheet it was made from. Formulas that read other sheets still read them.
     */
    function duplicateSheet(s, how) {
        const source = snapshotSheet(sheetOf(s));
        const ids = new Map();
        const renew = (old) => { if (old === null || old === undefined) return old; let n = ids.get(old); if (!n) ids.set(old, (n = newId())); return n; };
        for (const c of source.columns) renew(c.id);
        for (const r of source.rows) renew(r.id);
        const moveFormula = (v) => (isStoredFormula(v)
            ? { f: v.f, refs: v.refs.map((ref) => (ref.s ? { ...ref } : { ...ref, r1: renew(ref.r1), c1: renew(ref.c1), r2: renew(ref.r2), c2: renew(ref.c2) })) }
            : v);
        const name = (() => {
            const base = 'Copy of ' + (source.props.name || 'Sheet');
            if (!grid.sheetIdByName(base)) return base;
            let n = 2;
            while (grid.sheetIdByName(base + ' ' + n)) n++;
            return base + ' ' + n;
        })();
        const at = sheetOrder.indexOf(s);
        const next = sheetOrder[at + 1];
        const props = { ...source.props, name };
        if (props.merges) props.merges = props.merges.map((m) => ({ r1: renew(m.r1), c1: renew(m.c1), r2: renew(m.r2), c2: renew(m.c2) }));
        delete props.hidden;
        const copy = {
            id: newId(), key: keyBetween(source.key, next ? sheets.get(next).key : null), props,
            columns: source.columns.map((c) => ({ id: ids.get(c.id), key: c.key, props: c.props })),
            rows: source.rows.map((r) => {
                const cells = {}, style = {};
                for (const cid in r.cells) cells[ids.get(cid)] = moveFormula(r.cells[cid]);
                for (const cid in r.style) style[ids.get(cid)] = r.style[cid];
                return { id: ids.get(r.id), key: r.key, cells, style, props: r.props };
            })
        };
        const done = apply([{ t: 'addSheet', sheet: copy }], how);
        return done && done.length ? copy.id : null;
    }

    /** Hides a sheet (its tab goes; its cells still count in formulas). The last sheet that shows cannot be hidden. */
    function hideSheet(s, hidden, how) {
        if (hidden && !sheetOrder.some((x) => x !== s && !sheets.get(x).props.hidden)) throw new Error('the last sheet that shows cannot be hidden');
        return setSheetProps(s, { hidden: hidden ? true : null }, how);
    }

    // ---- reading ----------------------------------------------------------------------------------------------------------------------------------

    function snapshotSheet(sheet) {
        return {
            id: sheet.id, key: sheet.key, props: clone(sheet.props),
            columns: sheet.colOrder.map((cid) => { const c = sheet.cols.get(cid); return { id: cid, key: c.key, props: clone(c.props) }; }),
            rows: sheet.rowOrder.map((rid) => rowDoc(sheet, sheet.rows.get(rid)))
        };
    }

    // a row as it is saved: the cells of columns that were deleted are left out (they were only kept for undo)
    function rowDoc(sheet, row) {
        const cells = {}, style = {};
        for (const cid in row.cells) if (sheet.cols.has(cid)) cells[cid] = clone(row.cells[cid]);
        for (const cid in row.style) if (sheet.cols.has(cid)) style[cid] = clone(row.style[cid]);
        return { id: row.id, key: row.key, cells, style, props: clone(row.props) };
    }

    /**
     * What changed since the last save, as whole things by id: the shape the database keeps them in. The workbook does not forget it until saved() says the
     * server kept it (a save that fails can be tried again; a change made while saving stays for the next save).
     */
    function pendingPatch() {
        const upTo = changeNo;
        const rows = [], columns = [], sheetDocs = [];
        for (const rid of dirty.rows.keys()) { const sheet = homeOfRow.get(rid); if (sheet) rows.push(Object.assign({ sheetId: sheet.id }, rowDoc(sheet, sheet.rows.get(rid)))); }
        for (const cid of dirty.columns.keys()) { const sheet = homeOfCol.get(cid); if (sheet) { const c = sheet.cols.get(cid); columns.push({ sheetId: sheet.id, id: cid, key: c.key, props: clone(c.props) }); } }
        for (const sid of dirty.sheets.keys()) { const sheet = sheets.get(sid); if (sheet) sheetDocs.push({ id: sid, key: sheet.key, props: clone(sheet.props) }); }
        return {
            workbook: { id, version, settings: dirty.settings ? clone(settings) : undefined },
            upTo,
            sheets: { upsert: sheetDocs, delete: [...gone.sheets.keys()] },
            columns: { upsert: columns, delete: [...gone.columns.keys()] },
            rows: { upsert: rows, delete: [...gone.rows.keys()] },
            isEmpty: !rows.length && !columns.length && !sheetDocs.length && !gone.sheets.size && !gone.columns.size && !gone.rows.size && !dirty.settings
        };
    }

    /**
     * The server kept `patch`: forget what it carried, unless it changed again after the patch was taken.
     * @param {ReturnType<typeof pendingPatch>} patch
     * @param {{ version?: number }} [answer]  The new version the server gave the workbook.
     */
    function saved(patch, answer) {
        revision++;
        const forget = (map) => { for (const [k, n] of [...map]) if (n <= patch.upTo) map.delete(k); };
        forget(dirty.rows); forget(dirty.columns); forget(dirty.sheets);
        forget(gone.rows); forget(gone.columns); forget(gone.sheets);
        if (dirty.settings <= patch.upTo) dirty.settings = 0;
        if (answer && typeof answer.version === 'number') version = answer.version;
        emit('saved', { version });
    }

    const api = {
        id,
        get version() { return version; },
        /** Raised on every applied change: a screen draws again when it moves. */
        get revision() { return revision; },
        // the layout
        rowAxis, colAxis, merges, mergeCells, unmergeCells, setAutoHeights, forEachFilledRow, rowContent,
        // reading
        sheetIds: () => [...sheetOrder],
        sheetProps: (s) => clone(sheetOf(sheetIdOf(s)).props),
        sheetIdByName: grid.sheetIdByName,
        size: (s) => grid.size(sheetIdOf(s)),
        rowId: (s, r) => sheetOf(sheetIdOf(s)).rowOrder[r],
        colId: (s, c) => sheetOf(sheetIdOf(s)).colOrder[c],
        rowIndex: (s, rid) => grid.rowIndexOf(sheetIdOf(s), rid),
        colIndex: (s, cid) => grid.colIndexOf(sheetIdOf(s), cid),
        rowProps: (s, r) => { const sheet = sheetOf(sheetIdOf(s)); const rid = sheet.rowOrder[r]; return rid ? clone(sheet.rows.get(rid).props) : undefined; },
        colProps: (s, c) => { const sheet = sheetOf(sheetIdOf(s)); const cid = sheet.colOrder[c]; return cid ? clone(sheet.cols.get(cid).props) : undefined; },
        settings: () => clone(settings),
        /** What is kept in a cell: a value, or a formula { f, refs }; undefined when empty. */
        raw(s, r, c) {
            s = sheetIdOf(s);
            const sheet = sheetOf(s);
            const rid = sheet.rowOrder[r], cid = sheet.colOrder[c];
            return rid && cid ? sheet.rows.get(rid).cells[cid] : undefined;
        },
        /** What a cell shows (before formatting): the formula worked out, or the value. */
        value(s, r, c) {
            s = sheetIdOf(s);
            const sheet = sheetOf(s);
            const rid = sheet.rowOrder[r], cid = sheet.colOrder[c];
            return rid && cid ? engine.value(s, rid, cid) : null;
        },
        /** What a person edits in a cell: the formula as it reads now ("=SUM(D3:D10)"), or the value as text. */
        input(s, r, c) {
            s = sheetIdOf(s);
            const v = api.raw(s, r, c);
            if (v === undefined || v === null) return '';
            if (isStoredFormula(v)) return formulaText(v, s, grid);
            if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
            // a text that would read as something else when typed again keeps the apostrophe it was typed with
            if (typeof v === 'string') { const again = parseInput(v); return again.formula !== undefined || again.value !== v ? "'" + v : v; }
            return String(v);
        },
        /** The style kept on one cell (not counting the rules of ranges, which come with formatting). */
        style(s, r, c) {
            s = sheetIdOf(s);
            const sheet = sheetOf(s);
            const rid = sheet.rowOrder[r], cid = sheet.colOrder[c];
            return rid && cid ? clone(sheet.rows.get(rid).style[cid]) : undefined;
        },
        /** The address of a cell as a person reads it: "B7". */
        address: (r, c) => colName(c) + (r + 1),
        /** The whole workbook as it is stored. */
        toJSON: () => ({ id, version, settings: clone(settings), sheets: sheetOrder.map((s) => snapshotSheet(sheets.get(s))) }),
        // changing
        apply, undo, redo,
        canUndo: () => undoStack.length > 0,
        canRedo: () => redoStack.length > 0,
        setValues, clear, setStyle, setBlock, lastFilled,
        insertRows, deleteRows, insertCols, deleteCols, moveRows, moveCols,
        setRowProps, setColProps, setSheetProps, setSettings,
        addSheet, removeSheet, moveSheet, duplicateSheet, hideSheet,
        /** NOW() and TODAY() are worked out again (the host calls this on a timer when it wants a live clock). */
        tick: () => engine.tick(),
        // saving
        pendingPatch, saved,
        // events: "op" ({ ops, source }), "reject" ({ op, reason, source }), "saved" ({ version })
        on,
        /** @internal for the tests */
        _engine: engine
    };
    return api;
}
