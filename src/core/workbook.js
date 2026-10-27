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
import { formatDate, formatValue, localeInfo } from './format.js';
import { displayOf } from './display.js';
import { resolveRules, modeOf, resolveTypes, checkValue } from './access.js';
import { makeRule, ruleRect, ruleAt, choicesOf, breaks } from './validation.js';
import { makeConditional, conditionalStyleOf } from './conditional.js';
import { outlineOf, MAX_LEVEL } from './outline.js';
import { addressable, cellOf, rangeOf } from './addressing.js';
import { tableOf, pivot } from './pivot.js';
import { resolveAccess, actionsOfOp, refusalOf } from './policy.js';
import { filterRect, hiddenByFilter, filterValues as valuesOfFilter, dataRegion as regionAround } from './filter.js';
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
        // a formula in a money cell (the cell's format, or its column's) is rounded to the decimals of the money
        decimalsFor(s, rid, cid) {
            const fmt = formatOfIds(s, rid, cid);
            return fmt && fmt.type === 'money' ? (fmt.decimals === undefined ? 2 : fmt.decimals) : null;
        },
        now: () => (opt.now ? opt.now() : new Date()),
        // is row r hidden by the filter, or (byHand) also hidden by hand or in a folded group (for SUBTOTAL)
        rowHidden(s, r, byHand) {
            const sheet = sheets.get(s);
            const rid = sheet && sheet.rowOrder[r];
            if (!rid) return false;
            if (filteredOf(sheet).has(rid)) return true;
            if (!byHand) return false;
            if (sheet.rows.get(rid).props.hidden) return true;
            if (!sheet.rowAxis) rowAxis(s);
            return sheet.rowOutline.hidden.has(r);
        },
        // named ranges (kept in the settings, so they are saved, undone and checked as the workbook's own): found by id, else by the text typed
        nameId: (text) => { const n = findName(text); return n ? n.id : null; },
        nameRect(ref) {
            const n = (ref.id && namesOf().find((x) => x.id === ref.id)) || findName(ref.n);
            return n ? nameRectOf(n) : null;
        },
        nameText: (ref) => { const n = ref.id && namesOf().find((x) => x.id === ref.id); return n ? n.name : ref.n; }
    };
    const namesOf = () => settings.names || [];
    const findName = (text) => { const want = String(text || '').toLowerCase(); return namesOf().find((x) => x.name.toLowerCase() === want) || null; };
    // where a name points now: { s, r1, c1, r2, c2 }, or null when its sheet, a row or a column of its corners is gone
    function nameRectOf(n) {
        if (!sheets.has(n.s)) return null;
        const r1 = grid.rowIndexOf(n.s, n.r1), r2 = grid.rowIndexOf(n.s, n.r2), c1 = grid.colIndexOf(n.s, n.c1), c2 = grid.colIndexOf(n.s, n.c2);
        if (r1 < 0 || r2 < 0 || c1 < 0 || c2 < 0) return null;
        return { s: n.s, r1: Math.min(r1, r2), c1: Math.min(c1, c2), r2: Math.max(r1, r2), c2: Math.max(c1, c2) };
    }
    /** The format of a cell: its own (its style's), else its column's, else none. */
    function formatOfIds(s, rid, cid) {
        const sheet = sheets.get(s);
        if (!sheet) return null;
        const row = sheet.rows.get(rid);
        const own = row && row.style[cid] && row.style[cid].format;
        if (own) return own;
        const col = sheet.cols.get(cid);
        return (col && col.props.format) || null;
    }

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
    // a new workbook is not stored yet (nor one made from a file: options.fresh): all of it is in the first patch
    if (!(doc && doc.sheets && doc.sheets.length) || opt.fresh) {
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
                const formatChanged = JSON.stringify((ch.before && ch.before.format) || null) !== JSON.stringify((ch.after && ch.after.format) || null);
                const formula = formatChanged && engine.formulaOf(sheet.id, ch.row, ch.col);
                if (formula) engine.setFormula(sheet.id, ch.row, ch.col, formula);
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
            // a row hidden or shown (by hand, or a group folded): SUBTOTAL works out again
            if (op.changes.some((ch) => ['hidden', 'level', 'fold'].some((k) => JSON.stringify((ch.before || {})[k]) !== JSON.stringify((ch.after || {})[k])))) engine.visibilityChanged();
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
            let changedFilter = false;
            // a filter changed: its rows are filtered again when the rows are next laid out
            if (JSON.stringify(sheet.props.filter || null) !== JSON.stringify((op.after && op.after.filter) || null)) { sheet.rowAxis = null; sheet.filteredKey = undefined; changedFilter = true; }
            sheet.props = clone(op.after || {});
            dirty.sheets.set(sheet.id, changeNo);
            // the filter changed: SUBTOTAL works out again (after the props are in, so it reads the new filter)
            if (changedFilter) engine.visibilityChanged();
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
            const namesBefore = JSON.stringify(settings.names || null);
            settings = clone(op.after || {});
            dirty.settings = changeNo;
            if (JSON.stringify(settings.names || null) !== namesBefore) engine.namesChanged();
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
            const filtered = filteredOf(sheet);
            // the groups of rows, worked out with the layout (a row of a folded group is not shown)
            sheet.rowOutline = outlineOf(sheet.rowOrder.length, (i) => sheet.rows.get(sheet.rowOrder[i]).props);
            const folded = sheet.rowOutline.hidden;
            // a height set by hand wins; else the height the screen measured for the row's text (wrapped, several lines, a big font); else the default
            sheet.rowAxis = createAxis(sheet.rowOrder.length, (i) => {
                const rid = sheet.rowOrder[i];
                const p = sheet.rows.get(rid).props;
                if (p.hidden || filtered.has(rid) || folded.has(i)) return 0;
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
            sheet.colOutline = outlineOf(sheet.colOrder.length, (i) => sheet.cols.get(sheet.colOrder[i]).props);
            const folded = sheet.colOutline.hidden;
            sheet.colAxis = createAxis(sheet.colOrder.length, (i) => {
                const p = sheet.cols.get(sheet.colOrder[i]).props;
                return p.hidden || folded.has(i) ? 0 : p.width || fallback;
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

    /**
     * Merges a rectangle into one cell, or several rectangles each into one (merging a selection row by row, or column by column), as one change; blocks
     * they overlap are taken apart first. The cells under a block keep their content, unseen, as undo needs.
     */
    function mergeCells(s, ranges, how) {
        s = sheetIdOf(s);
        const sheet = sheetOf(s);
        const list = (Array.isArray(ranges) ? ranges : [ranges]).filter((range) => range.r1 !== range.r2 || range.c1 !== range.c2);
        if (!list.length) return [];
        let kept = sheet.props.merges || [];
        for (const range of list) kept = kept.filter((m) => { const at = resolveMerge(s, m); return at && !overlaps(at, range); });
        const blocks = list.map((range) => ({ r1: sheet.rowOrder[range.r1], c1: sheet.colOrder[range.c1], r2: sheet.rowOrder[range.r2], c2: sheet.colOrder[range.c2] }));
        return setSheetProps(s, { merges: kept.concat(blocks) }, how);
    }

    /** Takes apart every merged block that overlaps the rectangle. */
    function unmergeCells(s, range, how) {
        s = sheetIdOf(s);
        const all = sheetOf(s).props.merges || [];
        const kept = mergesApartFrom(s, range);
        return kept.length === all.length ? [] : setSheetProps(s, { merges: kept.length ? kept : null }, how);
    }

    // ---- the host's rules and the types of columns (see access.js and types.js): not part of the workbook, never saved or undone -----------------

    let rules = [];
    // the host's rules (setRules) and what the access policy gives this person (setAccess): the policy's ranges join the host's rules
    let hostRules = [];
    let access = resolveAccess(null);
    let hasPolicy = false;
    const types = new Map(); // sheet id -> Map(column id -> type)

    /**
     * The rules a person must keep here (read-only and hidden cells), as the host's backend gives them for this person. They replace the ones before.
     * @param {object[]} list
     */
    function setRules(list) {
        hostRules = list || [];
        rules = resolveRules(api, hostRules.concat(access.ranges));
        revision++;
        emit('layout', {});
    }

    /**
     * The access policy of the workbook and the person who has it open (policy.js): what they may do, what they see, and the rules of their ranges.
     * It is the host's (kept in its database, given again on every open); null takes it away (everything is allowed).
     * @param {object|null} policy
     * @param {string|{ user?: string, groups?: string[] }} who
     */
    function setAccess(policy, who) {
        access = resolveAccess(policy, who);
        hasPolicy = !!policy;
        rules = resolveRules(api, hostRules.concat(access.ranges));
        revision++;
        emit('access', accessInfo());
        emit('layout', {});
    }
    const accessInfo = () => ({ owner: access.owner, roles: access.roles.slice(), ui: clone(access.ui), message: access.message });

    /**
     * True when the part of the screen with this id (UI_ITEMS: 'tool.bold', 'menu.Insert', 'menu.data:filter', 'panel.comments', 'feature.contextMenu' ...)
     * is shown to this person. A menu item's id is "menu." and its value; hiding 'menu.view:group' hides every item under it.
     */
    function shows(id) {
        const hide = access.ui.hide;
        if (!hide || !hide.length) return true;
        return !hide.some((h) => h === id || (id.startsWith(h + ':') && h.startsWith('menu.')));
    }

    /** True when this person sees sheet s (ui.sheets lists them by name or id; none listed: every sheet). */
    function sheetShown(s) {
        const list = access.ui.sheets;
        if (!list) return true;
        s = sheetIdOf(s);
        return list.includes(s) || list.includes(sheetOf(s).props.name);
    }

    /**
     * What may be done with a cell for the person who has the workbook open: { mode: 'readonly' | 'hidden' | 'invisible', message } or null (it may be
     * changed). The host's rules and the policy's ranges decide where they say something (an 'edit' range opens it); anywhere else a person who may not
     * edit only reads.
     */
    function cellMode(s, r, c, action) {
        if (anyPivots() && pivotAt(s, r, c)) return { mode: 'readonly', message: 'This is a pivot table: change it in its editor' };
        const m = rules.length ? modeOf(api, rules, s, r, c, revision) : null;
        if (m) return m.mode === 'edit' ? null : m;
        // a change made for an action of its own (a sort) needs that action, not 'edit'
        if (!access.can('edit') && !(action && access.can(action))) return { mode: 'readonly', message: access.message || 'You can only view this sheet' };
        return null;
    }

    /** The types of the columns of a sheet ({ headerRow, fields } or { columns }), or null to take them away. */
    function setTypes(s, spec) {
        s = sheetIdOf(s);
        if (spec) types.set(s, resolveTypes(api, s, spec)); else types.delete(s);
    }

    /** What the rules make of a cell: { mode: 'readonly'|'hidden', message } or null. */
    const modeAt = (s, r, c) => cellMode(sheetIdOf(s), r, c);

    /** The type of a cell's column, or null (the header row of a typed sheet has none). */
    function typeAt(s, r, c) {
        s = sheetIdOf(s);
        const map = types.get(s);
        if (!map) return null;
        const sheet = sheetOf(s);
        if (map.headerRowId && sheet.rowOrder[r] === map.headerRowId) return null;
        return map.get(sheet.colOrder[c]) || null;
    }

    const PROTECTED = 'This cell is protected: it cannot be changed here';

    // the first op of a change that breaks a rule, with the rule's message, or null
    function brokenRule(ops, action) {
        for (const op of ops) {
            const s = typeof op.sheet === 'string' ? op.sheet : op.sheet && op.sheet.id;
            if (!s || !sheets.has(s)) continue;
            const sheet = sheets.get(s);
            const at = (rid, cid) => { const r = grid.rowIndexOf(s, rid), c = grid.colIndexOf(s, cid); return r < 0 || c < 0 ? null : cellMode(s, r, c, action); };
            if (op.t === 'cells' || op.t === 'styles') {
                for (const ch of op.changes) { const m = at(ch.row, ch.col); if (m) return { op, message: m.message || PROTECTED }; }
            } else if (op.t === 'deleteRows') {
                for (const row of op.rows) for (const cid of sheet.colOrder) { const m = at(row.id, cid); if (m) return { op, message: m.message || 'These rows hold protected cells: they cannot be deleted here' }; }
            } else if (op.t === 'deleteCols') {
                for (const col of op.cols) for (const rid of sheet.rowOrder) { const m = at(rid, col.id); if (m) return { op, message: m.message || 'These columns hold protected cells: they cannot be deleted here' }; }
            } else if (op.t === 'removeSheet') {
                if (rules.some((rule) => rule.s === op.sheet.id && rule.mode !== 'edit')) return { op, message: 'This sheet holds protected cells: it cannot be deleted here' };
            }
        }
        return null;
    }

    // the cells of a change (already applied) whose value is not of their column's type
    function wrongTypes(ops) {
        const out = [];
        for (const op of ops) {
            if (op.t !== 'cells' || !types.has(op.sheet)) continue;
            for (const ch of op.changes) {
                const r = grid.rowIndexOf(op.sheet, ch.row), c = grid.colIndexOf(op.sheet, ch.col);
                const t = r < 0 || c < 0 ? null : typeAt(op.sheet, r, c);
                if (!t) continue;
                const value = engine.value(op.sheet, ch.row, ch.col);
                const expected = checkValue(t, value);
                if (expected) out.push({ op, sheet: op.sheet, r, c, address: colName(c) + (r + 1), field: t.field, value, expected });
            }
        }
        return out;
    }

    // ---- data validation (validation.js): rules a person makes on ranges, kept in the sheet's props ------------------------------------------------

    /** Adds a rule of data validation to a rectangle (one change). Returns its id. */
    function addValidation(s, rect, spec, how) {
        s = sheetIdOf(s);
        const rule = makeRule(api, s, rect, spec);
        setSheetProps(s, { validations: (sheetOf(s).props.validations || []).concat([rule]) }, how);
        return rule.id;
    }

    /** Takes away the rules of data validation that overlap a rectangle (one change). */
    function removeValidation(s, rect, how) {
        s = sheetIdOf(s);
        const all = sheetOf(s).props.validations || [];
        const kept = all.filter((rule) => { const at = ruleRect(api, s, rule); return at && !(at.r1 <= rect.r2 && at.r2 >= rect.r1 && at.c1 <= rect.c2 && at.c2 >= rect.c1); });
        return kept.length === all.length ? [] : setSheetProps(s, { validations: kept.length ? kept : null }, how);
    }

    /** Puts a rule on a rectangle in place of the rules it overlaps (what the dialog's Done does): one change. Returns its id. */
    function setValidation(s, rect, spec, how) {
        s = sheetIdOf(s);
        const kept = (sheetOf(s).props.validations || []).filter((rule) => { const at = ruleRect(api, s, rule); return at && !(at.r1 <= rect.r2 && at.r2 >= rect.r1 && at.c1 <= rect.c2 && at.c2 >= rect.c1); });
        const rule = makeRule(api, s, rect, spec);
        setSheetProps(s, { validations: kept.concat([rule]) }, how);
        return rule.id;
    }

    // ---- groups of rows and columns (outline.js): a level in the props of each row or column, folded groups not shown ----------------------------------

    const setPropsOf = (kind) => (kind === 'rows' ? setRowProps : setColProps);
    const propsAt = (kind, s, i) => (kind === 'rows' ? api.rowProps(s, i) : api.colProps(s, i)) || {};

    /** The groups of rows (or columns) of a sheet: { groups: [{ level, from, to, folded }], maxLevel }. */
    function groupsOf(kind, s) {
        s = sheetIdOf(s);
        const sheet = sheetOf(s);
        if (kind === 'rows') rowAxis(s); else colAxis(s);
        const o = kind === 'rows' ? sheet.rowOutline : sheet.colOutline;
        return { groups: o.groups.map((g) => ({ ...g })), maxLevel: o.maxLevel };
    }

    /** Groups rows (or columns) from..to: each goes one level deeper (7 at most), as Google Sheets' Group does. One change. */
    function group(kind, s, from, to, how) {
        s = sheetIdOf(s);
        const list = [];
        for (let i = Math.min(from, to); i <= Math.max(from, to); i++) list.push(i);
        if (list.some((i) => (Number(propsAt(kind, s, i).level) || 0) >= MAX_LEVEL)) throw new Error('groups go ' + MAX_LEVEL + ' levels deep at most');
        return setPropsOf(kind)(s, list, (i) => ({ level: (Number(propsAt(kind, s, i).level) || 0) + 1 }), how);
    }

    /** Ungroups rows (or columns) from..to: each comes one level up; what is not grouped is left. One change. */
    function ungroup(kind, s, from, to, how) {
        s = sheetIdOf(s);
        const list = [];
        for (let i = Math.min(from, to); i <= Math.max(from, to); i++) if (Number(propsAt(kind, s, i).level) > 0) list.push(i);
        // a fold kept for a level the row no longer has would fold a group made there later: it goes
        return list.length ? setPropsOf(kind)(s, list, (i) => {
            const level = Number(propsAt(kind, s, i).level) - 1;
            const fold = (propsAt(kind, s, i).fold || []).filter((l) => l <= level);
            return { level: level || null, fold: fold.length ? fold : null };
        }, how) : [];
    }

    /** Folds (or opens) the group of a level that starts at row (or column) `from`. One change. */
    function foldGroup(kind, s, from, level, folded, how) {
        s = sheetIdOf(s);
        const fold = new Set(propsAt(kind, s, from).fold || []);
        if (folded) fold.add(level); else fold.delete(level);
        return setPropsOf(kind)(s, [from], { fold: fold.size ? [...fold].sort() : null }, how);
    }

    /** Shows the groups up to a level, as the level buttons do: the groups deeper than `level` are folded, the others open (level 0 folds them all). One change. */
    function showLevel(kind, s, level, how) {
        s = sheetIdOf(s);
        const { groups } = groupsOf(kind, s);
        const starts = new Map();
        for (const g of groups) { if (!starts.has(g.from)) starts.set(g.from, new Set()); if (g.level > level) starts.get(g.from).add(g.level); }
        const changed = [...starts.keys()].filter((i) => JSON.stringify([...starts.get(i)].sort()) !== JSON.stringify((propsAt(kind, s, i).fold || []).slice().sort()));
        return changed.length ? setPropsOf(kind)(s, changed, (i) => ({ fold: starts.get(i).size ? [...starts.get(i)].sort() : null }), how) : [];
    }

    // ---- the filter of a sheet (filter.js): a range with a header, criteria per column, the rows that fail hidden -----------------------------------------

    // The rows a sheet's filter hides, worked out when the filter changed (or the workbook was opened), not when a value does: as in Google Sheets.
    function filteredOf(sheet) {
        const key = JSON.stringify(sheet.props.filter || null);
        if (sheet.filteredKey !== key) {
            sheet.filteredKey = key;
            sheet.filtered = sheet.props.filter ? hiddenByFilter(api, sheet.id, sheet.props.filter) : new Set();
        }
        return sheet.filtered;
    }

    /** Puts a filter on a range of a sheet (its first row is the header): one change. A sheet has one filter; one there before is replaced. */
    function createFilter(s, rect, how) {
        s = sheetIdOf(s);
        return setSheetProps(s, { filter: { r1: api.rowId(s, rect.r1), c1: api.colId(s, rect.c1), r2: api.rowId(s, rect.r2), c2: api.colId(s, rect.c2), columns: {} } }, how);
    }

    /** Takes the filter of a sheet away: every row it hid shows again (one change). */
    const removeFilter = (s, how) => (sheetOf(sheetIdOf(s)).props.filter ? setSheetProps(sheetIdOf(s), { filter: null }, how) : []);

    /**
     * Sets what a column of the filter shows (column c by its index): { hidden: ['Draft'] } and/or a condition { op, a, b, formula }, or null for all.
     * The rows are filtered again (also when the criterion is the same: what was edited since is filtered too). One change.
     */
    function setFilterColumn(s, c, crit, how) {
        s = sheetIdOf(s);
        const filter = sheetOf(s).props.filter;
        if (!filter) throw new Error('the sheet has no filter');
        const at = filterRect(api, s, filter);
        if (!at || c < at.c1 || c > at.c2) throw new Error('the column is not in the filter');
        const columns = { ...(filter.columns || {}) };
        const cid = api.colId(s, c);
        const clean = crit && ((crit.hidden && crit.hidden.length) || crit.op) ? { ...(crit.hidden && crit.hidden.length ? { hidden: crit.hidden.map(String) } : {}), ...(crit.op ? { op: crit.op, a: crit.a, b: crit.b, formula: crit.formula } : {}) } : null;
        if (clean) {
            for (const k of Object.keys(clean)) if (clean[k] === undefined) delete clean[k];
            // a custom formula is kept by ids, as a cell's formula is (it follows inserted rows)
            if (clean.op === 'formula' && clean.formula !== undefined) { const text = isStoredFormula(clean.formula) ? formulaText(clean.formula, s, grid) : String(clean.formula).trim(); clean.formula = storeFormula(text.startsWith('=') ? text : '=' + text, s, grid); }
            columns[cid] = clean;
        } else delete columns[cid];
        return setSheetProps(s, { filter: { ...filter, columns, applied: (filter.applied || 0) + 1 } }, how);
    }

    /** The filter of a sheet: { range, columns: { [column index]: criterion } }, or null. */
    function filterOf(s) {
        s = sheetIdOf(s);
        const filter = sheetOf(s).props.filter;
        const at = filterRect(api, s, filter);
        if (!at) return null;
        const columns = {};
        for (const [cid, crit] of Object.entries(filter.columns || {})) {
            const c = api.colIndex(s, cid);
            if (c < 0) continue;
            columns[c] = clone(crit);
            // a custom formula as a person reads it now
            if (isStoredFormula(crit.formula)) columns[c].formula = formulaText(crit.formula, s, grid);
        }
        return { range: at, columns };
    }

    /** True when the filter of a sheet hides row r. */
    const filteredOut = (s, r) => { const sheet = sheetOf(sheetIdOf(s)); return filteredOf(sheet).has(sheet.rowOrder[r]); };

    // ---- comments, as in Google Sheets: a thread on a cell (a comment and its replies), kept in the sheet's props by the ids of its cell -------------
    //   comments: [{ id, row, col, resolved, items: [{ id, by: { id, name }, text, at }] }]

    const threadsOf = (s) => sheetOf(s).props.comments || [];
    // the comments a person may not read are not there for them (the server does not send them either: viewFor)
    const readable = () => access.can('comment.read');
    // who writes: the person the workbook is open for (createWorkbook's user, or setUser)
    const author = () => { const u = opt.user; return u && typeof u === 'object' ? { id: u.id === undefined ? null : u.id, name: u.name || String(u.id || '') } : u ? { id: String(u), name: String(u) } : { id: null, name: 'Anonymous' }; };
    const putThreads = (s, list, how) => setSheetProps(s, { comments: list.length ? list : null }, how);

    /** Comments on a cell: a new thread, or a reply when the cell has an open one (one change). Returns { thread, item } ids. */
    function addComment(s, r, c, text, how) {
        s = sheetIdOf(s);
        const words = String(text || '').trim();
        if (!words) throw new Error('a comment needs some text');
        const item = { id: newId(), by: author(), text: words, at: new Date().toISOString() };
        const all = threadsOf(s);
        const open = all.find((x) => !x.resolved && x.row === api.rowId(s, r) && x.col === api.colId(s, c));
        if (open) { putThreads(s, all.map((x) => (x === open ? { ...x, items: x.items.concat([item]) } : x)), how); return { thread: open.id, item: item.id }; }
        const thread = { id: newId(), row: api.rowId(s, r), col: api.colId(s, c), resolved: false, items: [item] };
        putThreads(s, all.concat([thread]), how);
        return { thread: thread.id, item: item.id };
    }

    /** Replies in a thread (one change). Returns the reply's id. */
    function replyComment(s, threadId, text, how) {
        s = sheetIdOf(s);
        const words = String(text || '').trim();
        if (!words) throw new Error('a reply needs some text');
        const item = { id: newId(), by: author(), text: words, at: new Date().toISOString() };
        const all = threadsOf(s);
        if (!all.some((x) => x.id === threadId)) throw new Error('there is no comment ' + threadId);
        // a reply opens a resolved thread again, as in Google Sheets
        putThreads(s, all.map((x) => (x.id === threadId ? { ...x, resolved: false, items: x.items.concat([item]) } : x)), how);
        return item.id;
    }

    // only the one who wrote a comment changes or takes it away (and, when there is an access policy, whom it lets moderate)
    function ownItem(thread, itemId) {
        const item = thread && thread.items.find((x) => x.id === itemId);
        if (!item) throw new Error('there is no such comment');
        const me = author();
        if (!(hasPolicy && access.can('comment.moderate')) && !(me.id !== null && item.by && item.by.id === me.id)) throw new Error('only the one who wrote a comment can change it');
        return item;
    }

    /** Changes the text of a comment (its writer only). One change. */
    function editComment(s, threadId, itemId, text, how) {
        s = sheetIdOf(s);
        const all = threadsOf(s);
        const thread = all.find((x) => x.id === threadId);
        ownItem(thread, itemId);
        const words = String(text || '').trim();
        if (!words) throw new Error('a comment needs some text');
        putThreads(s, all.map((x) => (x.id === threadId ? { ...x, items: x.items.map((i) => (i.id === itemId ? { ...i, text: words, edited: new Date().toISOString() } : i)) } : x)), how);
    }

    /** Takes a comment away (its writer only); the first one of a thread takes the whole thread. One change. */
    function deleteComment(s, threadId, itemId, how) {
        s = sheetIdOf(s);
        const all = threadsOf(s);
        const thread = all.find((x) => x.id === threadId);
        ownItem(thread, itemId);
        if (thread.items[0].id === itemId) return putThreads(s, all.filter((x) => x.id !== threadId), how);
        return putThreads(s, all.map((x) => (x.id === threadId ? { ...x, items: x.items.filter((i) => i.id !== itemId) } : x)), how);
    }

    /** Resolves a thread (it stays, closed; a reply opens it again), or opens it. One change. */
    function resolveComment(s, threadId, resolved, how) {
        s = sheetIdOf(s);
        return putThreads(s, threadsOf(s).map((x) => (x.id === threadId ? { ...x, resolved: resolved !== false } : x)), how);
    }

    // the open threads of a sheet by "row:col", made again when the sheet's props change
    function openThreads(s) {
        const sheet = sheetOf(s);
        if (!sheet.threadsByCell || sheet.threadsFor !== sheet.props.comments) {
            sheet.threadsFor = sheet.props.comments;
            sheet.threadsByCell = new Map();
            for (const x of sheet.props.comments || []) if (!x.resolved) sheet.threadsByCell.set(x.row + ':' + x.col, x);
        }
        return sheet.threadsByCell;
    }

    /** The open thread of a cell, or null. */
    /** True when a cell has an open thread (quick: for drawing its mark). */
    const hasComment = (s, r, c) => { if (!readable()) return false; s = sheetIdOf(s); const rid = api.rowId(s, r), cid = api.colId(s, c); return !!rid && !!cid && openThreads(s).has(rid + ':' + cid); };

    const commentAt = (s, r, c) => { if (!readable()) return null; s = sheetIdOf(s); const rid = api.rowId(s, r), cid = api.colId(s, c); const x = rid && cid ? openThreads(s).get(rid + ':' + cid) : null; return x ? clone(x) : null; };

    /** Every thread of a sheet (open and resolved), with where its cell stands now ({ r, c }, or null when its row or column was deleted). */
    const comments = (s) => { if (!readable()) return []; s = sheetIdOf(s); return threadsOf(s).map((x) => { const r = api.rowIndex(s, x.row), c = api.colIndex(s, x.col); return { ...clone(x), at: r >= 0 && c >= 0 ? { r, c } : null }; }); };

    // ---- pivot tables (pivot.js): a summary of a range written into the sheet, worked out again when its data changes -------------------------------
    //   pivots: [{ id, at: { r: rowId, c: colId }, source: 'RAB!A1:F500' | 'NamedRange', spec, size: { rows, cols } }]   in the props of the sheet it is in
    // The result is written as values (formulas elsewhere can read it, and it is saved with the sheet), by the workbook itself (source 'remote': not
    // undone, not checked); a person cannot type in it. What a pivot wrote is known by `size`, so a smaller result clears what is left of the bigger one.

    const pivotsOf = (s) => sheetOf(s).props.pivots || [];
    const anyPivots = () => sheetOrder.some((s) => (sheets.get(s).props.pivots || []).length);
    const pivotWritten = new Map(); // id -> the key of what was written for it (its definition), and where: { key, s, rect }
    let pivotWriting = false;

    // where a pivot's data is: a named range, or a range "Sheet!A1:F500" / "A1:F500" (in the pivot's own sheet)
    function pivotSource(s, p) {
        const named = nameRange(p.source);
        if (named) return { s: named.sheetId, rect: named.range };
        const m = /^\s*(?:(?:'((?:[^']|'')+)'|([^!'"]+))!)?(.+)$/.exec(String(p.source || ''));
        if (!m) return null;
        const sheetName = m[1] ? m[1].replace(/''/g, "'") : m[2];
        const src = sheetName ? grid.sheetIdByName(sheetName.trim()) : s;
        if (!src) return null;
        try { return { s: src, rect: rangeOf(m[3]) }; } catch { return null; }
    }

    // the top-left cell of a pivot where it stands now, or null when its row or column was deleted
    function pivotAnchor(s, p) {
        const r = api.rowIndex(s, p.at.r), c = api.colIndex(s, p.at.c);
        return r < 0 || c < 0 ? null : { r, c };
    }

    /** The area of a pivot (what it wrote last), by position, or null. */
    function pivotArea(s, p) {
        const a = pivotAnchor(s, p);
        if (!a || !p.size || !p.size.rows) return null;
        return { r1: a.r, c1: a.c, r2: a.r + p.size.rows - 1, c2: a.c + p.size.cols - 1 };
    }

    // a pivot's table, or the reason it cannot be made
    function pivotCells(s, p) {
        const src = pivotSource(s, p);
        if (!src) return { error: 'Pivot table: its data "' + p.source + '" is not there' };
        if (!p.spec || !(p.spec.values || []).length) return { error: 'Pivot table: add Rows and Values in its editor' };
        try {
            const { records } = tableOf(api, src.s, src.rect);
            return pivot(records, p.spec);
        } catch (err) { return { error: 'Pivot table: ' + err.message }; }
    }

    // writes a pivot's table where it is (clearing what it wrote before and no longer covers), and keeps its size
    function writePivot(s, p) {
        const a = pivotAnchor(s, p);
        if (!a) return;
        const out = pivotCells(s, p);
        const cells = out.error ? [[out.error]] : out.cells;
        const rows = cells.length, cols = cells.reduce((n, row) => Math.max(n, row.length), 0);
        const size = sheetOf(s).rows ? grid.size(s) : { rows: 0, cols: 0 };
        const entries = [];
        const put = (r, c, value, style) => { if (r < size.rows && c < size.cols) entries.push({ r, c, value, style }); };
        const kinds = out.rows ? out.rows.map((x) => x.kind) : [];
        for (let i = 0; i < rows; i++) {
            const kind = i < (out.header || 0) ? 'header' : kinds[i - (out.header || 0)];
            for (let j = 0; j < cols; j++) {
                const v = cells[i][j];
                // what a pivot writes is data: a text stays a text (a group named "=1" is no formula)
                const value = v === null || v === undefined || v === '' ? null : typeof v === 'string' ? "'" + v : v;
                const style = kind === 'header' ? { bold: true, fill: '#e8f0fe' } : kind === 'total' ? { bold: true, fill: '#f1f3f4' } : kind === 'subtotal' ? { bold: true } : null;
                put(a.r + i, a.c + j, value, style);
            }
        }
        const was = p.size || { rows: 0, cols: 0 };
        for (let i = 0; i < was.rows; i++) for (let j = 0; j < was.cols; j++) if (i >= rows || j >= cols) put(a.r + i, a.c + j, null, null);
        pivotWriting = true;
        try {
            if (entries.length) setBlock(s, entries, { source: 'remote' });
            if (was.rows !== rows || was.cols !== cols) {
                setSheetProps(s, { pivots: pivotsOf(s).map((x) => (x.id === p.id ? { ...x, size: { rows, cols } } : x)) }, { source: 'remote' });
            }
        } finally { pivotWriting = false; }
    }

    // clears what a pivot that is gone wrote
    function clearPivot(s, rect) {
        if (!sheets.has(s) || !rect) return;
        const entries = [];
        for (let r = rect.r1; r <= rect.r2; r++) for (let c = rect.c1; c <= rect.c2; c++) entries.push({ r, c, value: null, style: null });
        pivotWriting = true;
        try { setBlock(s, entries, { source: 'remote' }); } finally { pivotWriting = false; }
    }

    // After a change: a pivot made or changed is written, one whose data was touched is worked out again, one taken away (or undone) is cleared.
    function reconcilePivots(ops) {
        if (pivotWriting || (!pivotWritten.size && !anyPivots())) return;
        const touched = new Set(ops.map((op) => (typeof op.sheet === 'string' ? op.sheet : op.sheet && op.sheet.id)).filter(Boolean));
        const namesChanged = ops.some((op) => op.t === 'settings');
        const seen = new Set();
        for (const s of [...sheetOrder]) {
            for (const p of pivotsOf(s)) {
                seen.add(p.id);
                const key = JSON.stringify([s, p.at, p.source, p.spec]);
                const src = pivotSource(s, p);
                const was = pivotWritten.get(p.id);
                if (!was || was.key !== key || namesChanged || (src && touched.has(src.s))) {
                    writePivot(s, p);
                    const now = pivotsOf(s).find((x) => x.id === p.id) || p;
                    pivotWritten.set(p.id, { key, s, rect: pivotArea(s, now) });
                }
            }
        }
        for (const [id, w] of [...pivotWritten]) if (!seen.has(id)) { clearPivot(w.s, w.rect); pivotWritten.delete(id); }
    }

    /**
     * Makes a pivot table: the summary of `source` (a range "RAB!A1:F500", a range of this sheet, or a named range; its first row names the fields)
     * written from the cell `at` on, as `spec` says (pivot.js). One change (undone at once). Returns its id.
     */
    function addPivot(s, at, source, spec, how) {
        s = sheetIdOf(s);
        const a = typeof at === 'string' ? cellOf(at) : at;
        const p = { id: newId(), at: { r: api.rowId(s, a.r), c: api.colId(s, a.c) }, source: String(source), spec: spec || { values: [] }, size: { rows: 0, cols: 0 } };
        const src = pivotSource(s, p);
        if (!src) throw new Error('the data of a pivot table "' + source + '" is not a range or a named range');
        if (src.s === s && a.r >= src.rect.r1 && a.r <= src.rect.r2 && a.c >= src.rect.c1 && a.c <= src.rect.c2) throw new Error('a pivot table cannot be written inside its own data');
        setSheetProps(s, { pivots: pivotsOf(s).concat([p]) }, how);
        return p.id;
    }

    /** Changes a pivot table: its source, its spec (rows, columns, values, filters, sort, totals), or where it is (`at`). One change. */
    function setPivot(s, id, patch, how) {
        s = sheetIdOf(s);
        const all = pivotsOf(s);
        const at = all.findIndex((x) => x.id === id);
        if (at < 0) throw new Error('there is no pivot table ' + id);
        const next = { ...all[at] };
        if (patch.source !== undefined) next.source = String(patch.source);
        if (patch.spec !== undefined) next.spec = patch.spec;
        if (patch.at !== undefined) { const a = typeof patch.at === 'string' ? cellOf(patch.at) : patch.at; next.at = { r: api.rowId(s, a.r), c: api.colId(s, a.c) }; }
        return setSheetProps(s, { pivots: all.map((x, i) => (i === at ? next : x)) }, how);
    }

    /** Takes a pivot table away, and what it wrote. One change. */
    const removePivot = (s, id, how) => { s = sheetIdOf(s); const all = pivotsOf(s); const kept = all.filter((x) => x.id !== id); return kept.length === all.length ? [] : setSheetProps(s, { pivots: kept.length ? kept : null }, how); };

    /** The pivot tables of a sheet: [{ id, source, spec, area }]. */
    const pivots = (s) => { s = sheetIdOf(s); return pivotsOf(s).map((p) => ({ id: p.id, source: p.source, spec: clone(p.spec), area: pivotArea(s, p) })); };

    /** The pivot table whose result covers the cell (r, c), or null. */
    function pivotAt(s, r, c) {
        s = sheetIdOf(s);
        for (const p of pivotsOf(s)) { const b = pivotArea(s, p); if (b && r >= b.r1 && r <= b.r2 && c >= b.c1 && c <= b.c2) return { id: p.id, source: p.source, spec: clone(p.spec), area: b }; }
        return null;
    }

    // ---- named ranges: a name for a range ("Budget" for BOQ!D2:D200) that formulas use (=SUM(Budget)) and the name box goes to ---------------------

    /** Why a name cannot be given (a reason), or '' when it can. Names are as in Google Sheets: a letter or _ first, then letters, digits, _ and dots. */
    function nameProblem(name, exceptId) {
        const text = String(name || '').trim();
        if (!text) return 'a named range needs a name';
        if (!/^[A-Za-z_][A-Za-z0-9_.]*$/.test(text)) return 'a name starts with a letter or _ and has only letters, digits, _ and dots: "' + text + '"';
        if (/^[A-Za-z]{1,3}\d+$/.test(text) || /^R\d*C\d*$/i.test(text)) return '"' + text + '" is the address of a cell, not a name';
        if (/^(TRUE|FALSE)$/i.test(text)) return '"' + text + '" is a value, not a name';
        const same = findName(text);
        if (same && same.id !== exceptId) return 'there is a named range "' + same.name + '" already';
        return '';
    }

    /** Gives a range of a sheet a name (one change). Returns its id. */
    function addName(name, s, rect, how) {
        s = sheetIdOf(s);
        const why = nameProblem(name);
        if (why) throw new Error(why);
        const n = { id: newId(), name: String(name).trim(), s, r1: api.rowId(s, rect.r1), c1: api.colId(s, rect.c1), r2: api.rowId(s, rect.r2), c2: api.colId(s, rect.c2) };
        const ops = [{ t: 'settings', before: clone(settings), after: merged(settings, { names: namesOf().concat([n]) }) }];
        // the formulas written before the name was made know it only by its text: they get its id in the same change, so a rename reaches them
        const want = n.name.toLowerCase();
        ops.push(...nameRefOps((ref) => !ref.id && String(ref.n).toLowerCase() === want, (ref) => ({ ...ref, id: n.id })));
        apply(ops, how);
        return n.id;
    }

    // changes to the formulas that read names: each name reference that `pick` takes is made anew by `make` (one 'cells' op per sheet)
    function nameRefOps(pick, make) {
        const bySheet = new Map();
        for (const cell of engine.nameReaderCells()) {
            if (!cell.formula.refs.some((ref) => ref.k === 'name' && pick(ref))) continue;
            const after = { ...cell.formula, refs: cell.formula.refs.map((ref) => (ref.k === 'name' && pick(ref) ? make(ref) : ref)) };
            if (!bySheet.has(cell.s)) bySheet.set(cell.s, []);
            bySheet.get(cell.s).push({ row: cell.row, col: cell.col, before: cell.formula, after });
        }
        return [...bySheet].map(([sheet, changes]) => ({ t: 'cells', sheet, changes }));
    }

    /** Renames a named range, or points it at another range ({ name, sheetId, range }): one change. Formulas that use it follow. */
    function setName(id, patch, how) {
        const all = namesOf();
        const at = all.findIndex((x) => x.id === id);
        if (at < 0) throw new Error('there is no named range ' + id);
        const n = { ...all[at] };
        if (patch.name !== undefined) { const why = nameProblem(patch.name, id); if (why) throw new Error(why); n.name = String(patch.name).trim(); }
        if (patch.range) {
            const s = sheetIdOf(patch.sheetId || n.s), b = patch.range;
            Object.assign(n, { s, r1: api.rowId(s, b.r1), c1: api.colId(s, b.c1), r2: api.rowId(s, b.r2), c2: api.colId(s, b.c2) });
        }
        const ops = [{ t: 'settings', before: clone(settings), after: merged(settings, { names: all.map((x, i) => (i === at ? n : x)) }) }];
        // renamed: the formulas keep the new name as their text too (a formula shows it if the name is taken away later, as in Google Sheets)
        if (n.name !== all[at].name) ops.push(...nameRefOps((ref) => ref.id === id, (ref) => ({ ...ref, n: n.name })));
        apply(ops, how);
        return id;
    }

    /** Takes a named range away (one change): the formulas that use it show #NAME? until a range has that name again. */
    function removeName(id, how) {
        const all = namesOf();
        const kept = all.filter((x) => x.id !== id);
        return kept.length === all.length ? [] : setSettings({ names: kept.length ? kept : null }, how);
    }

    /** The named ranges: { id, name, sheetId, range } (range null when what it pointed at is gone), in the order they were made. */
    // `ref` is the range as a person writes it ("Penjualan!C2:C301", "'Data Toko'!A1"), for lists and logs; `range` is the same by numbers
    const names = () => namesOf().map((n) => {
        const at = nameRectOf(n);
        if (!at) return { id: n.id, name: n.name, sheetId: n.s, range: null, ref: null };
        const sheetName = sheets.has(n.s) ? String(sheets.get(n.s).props.name || '') : '';
        const quoted = /^[A-Za-z_][A-Za-z0-9_.]*$/.test(sheetName) ? sheetName : "'" + sheetName.replace(/'/g, "''") + "'";
        const corner = colName(at.c1) + (at.r1 + 1), other = colName(at.c2) + (at.r2 + 1);
        return { id: n.id, name: n.name, sheetId: n.s, range: { r1: at.r1, c1: at.c1, r2: at.r2, c2: at.c2 }, ref: quoted + '!' + corner + (other === corner ? '' : ':' + other) };
    });

    /** Where a name points: { sheetId, range }, or null. */
    const nameRange = (name) => { const n = findName(name); const at = n && nameRectOf(n); return at ? { sheetId: at.s, range: { r1: at.r1, c1: at.c1, r2: at.r2, c2: at.c2 } } : null; };

    // ---- conditional formatting (conditional.js): rules a person makes on ranges, kept in the sheet's props, worked out when a cell is drawn -------

    const conditionalCache = new Map();
    const conditionalsOf = (s) => sheetOf(s).props.conditionals || [];

    /** Adds a rule of conditional formatting on rectangles, after the others (one change). Returns its id. */
    function addConditional(s, rects, spec, how) {
        s = sheetIdOf(s);
        const rule = makeConditional(api, s, Array.isArray(rects) ? rects : [rects], spec);
        setSheetProps(s, { conditionals: conditionalsOf(s).concat([rule]) }, how);
        return rule.id;
    }

    /** Changes a rule of conditional formatting, its ranges too when given (one change). */
    function setConditional(s, id, rects, spec, how) {
        s = sheetIdOf(s);
        const all = conditionalsOf(s);
        const at = all.findIndex((x) => x.id === id);
        if (at < 0) throw new Error('there is no rule of conditional formatting ' + id);
        const rule = rects ? makeConditional(api, s, Array.isArray(rects) ? rects : [rects], { ...all[at], ...spec, id }) : makeConditional(api, s, [], { ...all[at], ...spec, id });
        if (!rects) rule.ranges = all[at].ranges;
        setSheetProps(s, { conditionals: all.map((x, i) => (i === at ? rule : x)) }, how);
        return id;
    }

    /** Takes a rule of conditional formatting away (one change). */
    function removeConditional(s, id, how) {
        s = sheetIdOf(s);
        const all = conditionalsOf(s);
        const kept = all.filter((x) => x.id !== id);
        return kept.length === all.length ? [] : setSheetProps(s, { conditionals: kept.length ? kept : null }, how);
    }

    /** Moves a rule of conditional formatting to another place in the order (the first rule that styles a cell wins): one change. */
    function moveConditional(s, id, to, how) {
        s = sheetIdOf(s);
        const all = conditionalsOf(s).slice();
        const from = all.findIndex((x) => x.id === id);
        if (from < 0) return [];
        const [rule] = all.splice(from, 1);
        all.splice(Math.max(0, Math.min(all.length, to)), 0, rule);
        return setSheetProps(s, { conditionals: all }, how);
    }

    /** The style the rules of conditional formatting give a cell, or null. */
    function conditionalStyleAt(s, r, c) {
        s = sheetIdOf(s);
        const list = conditionalsOf(s);
        return list.length ? conditionalStyleOf(api, list, s, r, c, revision, conditionalCache) : null;
    }

    /** The style a cell is drawn with: its own, and over it what the rules of conditional formatting give it. */
    function shownStyle(s, r, c) {
        const own = api.style(s, r, c);
        const extra = conditionalStyleAt(s, r, c);
        return extra ? { ...(own || {}), ...extra } : own;
    }

    /** The rule of data validation of a cell, or null. */
    const validationAt = (s, r, c) => ruleAt(api, sheetIdOf(s), r, c);
    /** The choices of a cell's dropdown (empty when it has none). */
    const choicesAt = (s, r, c) => { const rule = validationAt(s, r, c); return rule ? choicesOf(api, sheetIdOf(s), rule) : []; };
    /** What a cell's value breaks of its rule (a rule that only warns keeps the value, and the grid marks it), or null. */
    const invalidAt = (s, r, c) => { const rule = validationAt(s, r, c); return rule ? breaks(api, sheetIdOf(s), rule, api.value(s, r, c)) : null; };

    // the first cell of a change (already applied) whose value a refusing rule does not take
    function refusedByValidation(ops) {
        for (const op of ops) {
            if (op.t !== 'cells' || !(sheets.get(op.sheet) && sheets.get(op.sheet).props.validations)) continue;
            for (const ch of op.changes) {
                const r = grid.rowIndexOf(op.sheet, ch.row), c = grid.colIndexOf(op.sheet, ch.col);
                if (r < 0 || c < 0) continue;
                const rule = ruleAt(api, op.sheet, r, c);
                if (!rule || rule.reject === false) continue;
                const wanted = breaks(api, op.sheet, rule, engine.value(op.sheet, ch.row, ch.col));
                if (wanted) return { op, message: 'The value in ' + colName(c) + (r + 1) + ' must be ' + wanted };
            }
        }
        return null;
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
        // a person's change must be one the access policy lets them do (the host's own code is not stopped by it): the actions it asks for, each
        // allowed; a change made for one action (a sort writes its cells again) asks only for that one
        if (source === 'user' && !access.owner) {
            const asked = new Set();
            if (how && how.action) asked.add(how.action);
            for (const op of accepted) {
                if (how && how.action && (op.t === 'cells' || op.t === 'styles')) continue;
                for (const a of actionsOfOp(op, author().id)) asked.add(a);
            }
            // writing cells is decided per cell (an 'edit' range opens cells to a person who may not edit elsewhere): see cellMode
            asked.delete('edit');
            for (const a of asked) if (!access.can(a)) { emit('reject', { op: accepted[0], reason: refusalOf(a, access.message), source }); return null; }
        }
        // a person's change must keep the host's rules and the policy's ranges (read-only and hidden cells), and a person who may not edit writes only
        // in the ranges open to them; the host's own code is not stopped by them
        if (source === 'user' && (rules.length || !access.can('edit') || anyPivots())) {
            const broken = brokenRule(accepted, how && how.action);
            if (broken) { emit('reject', { op: broken.op, reason: broken.message, source }); return null; }
        }
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
        // a value a person wrote in a typed column must be of its type; a formula is judged by what it works out to, so this is looked at once applied,
        // and a change with a value of the wrong type is taken back whole
        if (source === 'user' && types.size) {
            const wrong = wrongTypes(accepted);
            if (wrong.length) {
                for (const op of done.reverse()) APPLY[invert(op).t](invert(op));
                for (const w of wrong) emit('cellError', w);
                emit('reject', { op: wrong[0].op, reason: 'Expected ' + wrong[0].expected + ' in ' + wrong[0].address + (wrong[0].field ? ' (' + wrong[0].field + ')' : ''), source });
                return null;
            }
        }
        // the sheet's own data validation (made by a person, saved with the sheet): a rule that refuses takes the change back whole
        if (source === 'user') {
            const refused = refusedByValidation(accepted);
            if (refused) {
                for (const op of done.reverse()) APPLY[invert(op).t](invert(op));
                emit('reject', { op: refused.op, reason: refused.message, source });
                return null;
            }
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
        // the pivot tables whose data or definition changed are written again (a change of their own, after this one)
        reconcilePivots(accepted);
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
    function contentFor(s, input, rid, cid) { return typed(s, input, rid, cid).content; }

    /**
     * What a cell holds once `input` is written in it, and the format it was written in: "26/10/2026" is a date (a number) written as a date, "Rp 1.250.000"
     * money. The format is only given when the cell has none yet (its own or its column's): a cell already formatted keeps its format.
     */
    function typed(s, input, rid, cid) {
        if (typeof input !== 'string') return { content: input === null ? undefined : input };
        // a column typed as text keeps what is typed as text ("00123" stays "00123"), as a text format does
        const columnType = types.get(s) && types.get(s).get(cid);
        if (columnType && columnType.kind === 'string' && !(input.length > 1 && input[0] === '=')) return { content: input[0] === "'" ? input.slice(1) : input };
        const current = rid && cid ? formatOfIds(s, rid, cid) : null;
        const parsed = parseInput(input, settings, current);
        if (parsed && parsed.formula !== undefined) return { content: storeFormula(parsed.formula, s, grid) };
        return { content: parsed.value, format: !current && parsed.format ? parsed.format : undefined };
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
        const changes = [], styles = [];
        matrix.forEach((row, i) => row.forEach((v, j) => {
            const rid = sheet.rowOrder[r + i], cid = sheet.colOrder[c + j];
            if (rid === undefined || cid === undefined) return;
            const before = sheet.rows.get(rid).cells[cid];
            const got = typed(s, v, rid, cid);
            if (!sameValue(before, got.content)) changes.push({ row: rid, col: cid, before: clone(before), after: got.content });
            if (got.format) { const st = sheet.rows.get(rid).style[cid]; styles.push({ row: rid, col: cid, before: clone(st), after: Object.assign({}, st, { format: got.format }) }); }
        }));
        const ops = [];
        if (changes.length) ops.push({ t: 'cells', sheet: s, changes });
        if (styles.length) ops.push({ t: 'styles', sheet: s, changes: styles });
        return ops.length ? apply(ops, how) : [];
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
                const got = x.value === null || x.value === undefined ? { content: undefined } : typed(s, x.value, x.rid, x.cid);
                if (!sameValue(before, got.content)) cells.push({ row: x.rid, col: x.cid, before: clone(before), after: got.content });
                // the format a value was written in, when the entry brings no style of its own (a paste brings the copied cell's style)
                if (got.format && !x.hasStyle) { const st = row.style[x.cid]; styles.push({ row: x.rid, col: x.cid, before: clone(st), after: Object.assign({}, st, { format: got.format }) }); }
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

    /**
     * Merges a style patch into every cell of a rectangle, or of several (a selection made with Ctrl): one change, undone at once. A key set to null takes
     * that part of the style away. `patch` is one object for every cell, or a function of the cell (r, c, its style now) that gives each its own (outer
     * borders give the top cells a top line, the left cells a left line ...), or null for a cell to leave alone.
     */
    function setStyle(s, ranges, patch, how) {
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
                    if (cid === undefined || seen.has(rid + cid)) continue;
                    seen.add(rid + cid);
                    const before = row.style[cid];
                    const own = typeof patch === 'function' ? patch(r, c, before || {}) : patch;
                    if (!own) continue;
                    const after = Object.assign({}, before || {}, own);
                    // borders are merged side by side like the rest of the style: { borders: { top } } keeps the left border a cell already has,
                    // and { borders: { top: null } } takes only the top away
                    if (own.borders && before && before.borders) after.borders = Object.assign({}, before.borders, own.borders);
                    if (after.borders) {
                        after.borders = { ...after.borders };
                        for (const k of Object.keys(after.borders)) if (after.borders[k] == null) delete after.borders[k];
                        if (!Object.keys(after.borders).length) delete after.borders;
                    }
                    for (const k of Object.keys(after)) if (after[k] === null || after[k] === undefined) delete after[k];
                    if (!sameValue(before || {}, after)) changes.push({ row: rid, col: cid, before: clone(before), after });
                }
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
        // rows inserted inside a group are in it, as in Google Sheets: they take the level the rows on both sides share (not a fold)
        const level = Math.min(at > 0 ? Number(sheet.rows.get(sheet.rowOrder[at - 1]).props.level) || 0 : 0, at < sheet.rowOrder.length ? Number(sheet.rows.get(sheet.rowOrder[at]).props.level) || 0 : 0);
        return apply([{ t: 'insertRows', sheet: s, rows: keys.map((key) => ({ id: newId(), key, cells: {}, style: {}, props: level ? { level } : {} })) }], how);
    }

    /** Deletes `count` rows from row `at`. */
    // A range whose first or last row (or column) is deleted shrinks to the rows that stay, as in Excel: =SUM(A2:A9) with row 2 deleted becomes
    // =SUM(A2:A8), not =SUM(#REF!). The formulas are rewritten by a cells op that goes in the same change as the delete, so one undo puts the rows
    // back and the formulas as they were, and every copy of the workbook that applies the change rewrites the same way. A range whose rows all go
    // is left alone and shows #REF!, which is what Excel does too.
    function shrinkRanges(s, axis, at, count) {
        const isRow = axis === 'row';
        const end = at + count - 1;
        const gone = (i) => i >= at && i <= end;
        const idAt = (i) => (isRow ? grid.rowIdAt(s, i) : grid.colIdAt(s, i));
        const indexOf = (id) => (isRow ? grid.rowIndexOf(s, id) : grid.colIndexOf(s, id));
        const [k1, k2] = isRow ? ['r1', 'r2'] : ['c1', 'c2'];
        const changes = [];
        const bySheet = new Map();
        for (const e of engine.rangeReaderCells(s)) {
            const home = sheets.get(e.s);
            const row = home && home.rows.get(e.row);
            const before = row && row.cells[e.col];
            if (!isStoredFormula(before)) continue;
            // the formula's own row (or column) goes too: nothing to rewrite
            if (e.s === s && gone(isRow ? grid.rowIndexOf(s, e.row) : grid.colIndexOf(s, e.col))) continue;
            let refs = null;
            before.refs.forEach((ref, i) => {
                if ((ref.s || e.s) !== s || ref[k1] == null || ref[k2] == null) return;
                if (ref.k !== 'range' && ref.k !== (isRow ? 'rows' : 'cols')) return;
                const a = indexOf(ref[k1]), b = indexOf(ref[k2]);
                if (a < 0 || b < 0) return;
                const lo = Math.min(a, b), hi = Math.max(a, b);
                if (!gone(lo) && !gone(hi)) return;
                let newLo = lo, newHi = hi;
                while (newLo <= hi && gone(newLo)) newLo++;
                while (newHi >= lo && gone(newHi)) newHi--;
                if (newLo > newHi) return;
                // keep which corner was the first one: a range turned around by a sort stays turned around
                const next = { ...ref };
                next[a <= b ? k1 : k2] = idAt(newLo);
                next[a <= b ? k2 : k1] = idAt(newHi);
                if (!refs) refs = before.refs.slice();
                refs[i] = next;
            });
            if (!refs) continue;
            if (!bySheet.has(e.s)) bySheet.set(e.s, []);
            bySheet.get(e.s).push({ row: e.row, col: e.col, before, after: { ...before, refs } });
        }
        for (const [sheet, list] of bySheet) changes.push({ t: 'cells', sheet, changes: list });

        // The same for every other range the workbook keeps by the ids of its corners: merged cells, conditional formatting, validation, the filter,
        // groups, pivot tables and the areas of access rules (in the props of the sheets) and named ranges (in the settings). They are found by their
        // shape, an object with the two corner ids, so a feature added later is covered without being listed here. Ids are unique in the whole
        // workbook, so a corner that is not a row (or column) of this sheet is never touched.
        const shrink = (x) => {
            if (Array.isArray(x)) {
                let out = x;
                x.forEach((v, i) => { const n = shrink(v); if (n !== v) { if (out === x) out = x.slice(); out[i] = n; } });
                return out;
            }
            if (!x || typeof x !== 'object') return x;
            let out = x;
            for (const k of Object.keys(x)) { const n = shrink(x[k]); if (n !== x[k]) { if (out === x) out = { ...x }; out[k] = n; } }
            if (typeof out[k1] !== 'string' || typeof out[k2] !== 'string') return out;
            const a = indexOf(out[k1]), b = indexOf(out[k2]);
            if (a < 0 || b < 0) return out;
            const lo = Math.min(a, b), hi = Math.max(a, b);
            if (!gone(lo) && !gone(hi)) return out;
            let newLo = lo, newHi = hi;
            while (newLo <= hi && gone(newLo)) newLo++;
            while (newHi >= lo && gone(newHi)) newHi--;
            if (newLo > newHi) return out;
            out = { ...out };
            out[a <= b ? k1 : k2] = idAt(newLo);
            out[a <= b ? k2 : k1] = idAt(newHi);
            return out;
        };
        for (const id of sheetOrder) {
            const props = sheets.get(id).props;
            const after = shrink(props);
            if (after !== props) changes.push({ t: 'sheetProps', sheet: id, before: clone(props), after: clone(after) });
        }
        const settingsAfter = shrink(settings);
        if (settingsAfter !== settings) changes.push({ t: 'settings', before: clone(settings), after: clone(settingsAfter) });
        return changes;
    }
    function deleteRows(s, at, count, how) {
        s = sheetIdOf(s);
        const sheet = sheetOf(s);
        const rows = sheet.rowOrder.slice(at, at + count).map((rid) => {
            const row = sheet.rows.get(rid);
            return { id: rid, key: row.key, cells: clone(row.cells), style: clone(row.style), props: clone(row.props) };
        });
        if (!rows.length) return [];
        return apply([...shrinkRanges(s, 'row', at, rows.length), { t: 'deleteRows', sheet: s, rows }], how);
    }

    /** Inserts `count` empty columns before column `at`. */
    function insertCols(s, at, count, how) {
        s = sheetIdOf(s);
        const sheet = sheetOf(s);
        const before = at > 0 ? sheet.cols.get(sheet.colOrder[at - 1]).key : null;
        const after = at < sheet.colOrder.length ? sheet.cols.get(sheet.colOrder[at]).key : null;
        const keys = keysBetween(before, after, count);
        // columns inserted inside a group are in it, as rows are
        const level = Math.min(at > 0 ? Number(sheet.cols.get(sheet.colOrder[at - 1]).props.level) || 0 : 0, at < sheet.colOrder.length ? Number(sheet.cols.get(sheet.colOrder[at]).props.level) || 0 : 0);
        return apply([{ t: 'insertCols', sheet: s, cols: keys.map((key) => ({ id: newId(), key, props: level ? { level } : {} })) }], how);
    }

    /** Deletes `count` columns from column `at`. */
    function deleteCols(s, at, count, how) {
        s = sheetIdOf(s);
        const sheet = sheetOf(s);
        const cols = sheet.colOrder.slice(at, at + count).map((cid) => { const col = sheet.cols.get(cid); return { id: cid, key: col.key, props: clone(col.props) }; });
        if (!cols.length) return [];
        return apply([...shrinkRanges(s, 'col', at, cols.length), { t: 'deleteCols', sheet: s, cols }], how);
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
        // the host's rules and types
        setRules, setTypes, modeAt, typeAt,
        // access control
        setAccess, access: accessInfo, can: (action) => access.can(action), shows, sheetShown,
        // data validation
        addValidation, setValidation, removeValidation, validationAt, choicesAt, invalidAt,
        // groups of rows and columns
        groupRows: (s, from, to, how) => group('rows', s, from, to, how), ungroupRows: (s, from, to, how) => ungroup('rows', s, from, to, how),
        groupCols: (s, from, to, how) => group('cols', s, from, to, how), ungroupCols: (s, from, to, how) => ungroup('cols', s, from, to, how),
        foldRowGroup: (s, from, level, folded, how) => foldGroup('rows', s, from, level, folded, how), foldColGroup: (s, from, level, folded, how) => foldGroup('cols', s, from, level, folded, how),
        showRowLevel: (s, level, how) => showLevel('rows', s, level, how), showColLevel: (s, level, how) => showLevel('cols', s, level, how),
        rowGroups: (s) => groupsOf('rows', s), colGroups: (s) => groupsOf('cols', s),
        // the filter
        createFilter, removeFilter, setFilterColumn, filterOf, filteredOut,
        filterValues: (s, c) => { const f = sheetOf(sheetIdOf(s)).props.filter; return f ? valuesOfFilter(api, sheetIdOf(s), f, c) : []; },
        dataRegion: (s, r, c) => regionAround(api, sheetIdOf(s), r, c),
        // comments
        addComment, replyComment, editComment, deleteComment, resolveComment, commentAt, comments, hasComment,
        /** The person who writes from now on ({ id, name }): their name goes on their comments, and only they change them. */
        setUser: (user) => { opt.user = user; },
        // pivot tables
        addPivot, setPivot, removePivot, pivots, pivotAt,
        // named ranges
        addName, setName, removeName, names, nameRange, nameProblem,
        // conditional formatting
        addConditional, setConditional, removeConditional, moveConditional, conditionalStyleAt, shownStyle,
        conditionals: (s) => clone(conditionalsOf(sheetIdOf(s))),
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
            if (rules.length) { const m = modeOf(api, rules, s, r, c, revision); if (m && (m.mode === 'hidden' || m.mode === 'invisible')) return ''; }
            if (isStoredFormula(v)) return formulaText(v, s, grid);
            if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
            const sheet = sheetOf(s);
            const fmt = formatOfIds(s, sheet.rowOrder[r], sheet.colOrder[c]);
            // a text that would read as something else when typed again keeps the apostrophe it was typed with
            if (typeof v === 'string') { if (fmt && fmt.type === 'text') return v; const again = parseInput(v, settings); return again.formula !== undefined || again.value !== v ? "'" + v : v; }
            if (typeof v === 'number') {
                // dates and times are edited as they are written; a percent as a percent; other numbers plainly, with the locale's decimal sign
                const info = localeInfo(settings.locale);
                if (fmt && fmt.type === 'date') return formatDate(v, info.datePattern, info.locale);
                if (fmt && fmt.type === 'time') return formatDate(v, 'HH:mm:ss', info.locale);
                if (fmt && fmt.type === 'datetime') return formatDate(v, info.datePattern + ' HH:mm:ss', info.locale);
                if (fmt && fmt.type === 'percent') return formatValue(v * 100, { type: 'general' }, settings).text + '%';
                return formatValue(v, { type: 'general' }, settings).text;
            }
            return String(v);
        },
        /** The style kept on one cell (not counting the rules of ranges, which come with formatting). */
        style(s, r, c) {
            s = sheetIdOf(s);
            const sheet = sheetOf(s);
            const rid = sheet.rowOrder[r], cid = sheet.colOrder[c];
            return rid && cid ? clone(sheet.rows.get(rid).style[cid]) : undefined;
        },
        /**
         * What a cell shows: its value through its format, in the workbook's locale ({ text, align, kind, color }). A format whose suffix comes from another
         * column (the unit of a quantity) takes that column's text from the same row.
         */
        display(s, r, c) {
            s = sheetIdOf(s);
            // a hidden cell shows dots: its content is not read, copied or found (see access.js)
            if (rules.length) {
                const m = modeOf(api, rules, s, r, c, revision);
                if (m && m.mode === 'hidden' && api.raw(s, r, c) !== undefined) return { text: '•••', align: 'center', kind: 'text' };
                // an invisible cell shows nothing: nothing tells it holds anything
                if (m && m.mode === 'invisible') return { text: '', align: 'left', kind: 'empty' };
            }
            const value = api.value(s, r, c);
            const fmt = api.cellFormat(s, r, c);
            let extra;
            if (fmt && fmt.suffixFrom !== undefined) {
                const ci = grid.colIndexOf(s, fmt.suffixFrom);
                if (ci >= 0) { const u = api.value(s, r, ci); extra = { suffixText: u === null || u === undefined ? '' : String(u) }; }
            }
            return displayOf(value, fmt, settings, extra);
        },
        /** The format of a cell (its own, else its column's), or null: the workbook's own object, only to be read. */
        cellFormat(s, r, c) {
            s = sheetIdOf(s);
            const sheet = sheetOf(s);
            const rid = sheet.rowOrder[r], cid = sheet.colOrder[c];
            return rid && cid ? formatOfIds(s, rid, cid) : null;
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
        _engine: engine,
        /** @internal for access.js */
        _grid: grid,
        /** @internal the key of a sheet's place (for excel/index.js) */
        _sheetKey: (s) => sheetOf(s).key
    };
    return addressable(api);
}
