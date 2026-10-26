// The calculation of a workbook: every formula's value, kept until something it depends on changes.
//
// The formulas are registered here by the workbook (by the ids of their sheet, row and column). For each formula the engine knows what it reads: single
// cells (by ids) and ranges (by the ids of their corners). When a cell changes, the formulas that read it lose their value, and the ones that read those,
// and so on; nothing else is worked out again. A value is worked out only when someone asks for it (the grid asks for the cells on screen, a total asks
// for the cells it adds), so a sheet of 100 000 formulas costs what the screen and the edited cell need.
//
// Working out a formula first walks, with a stack of its own, everything it needs that has no value yet, and works those out from the deepest up. A chain
// of 100 000 formulas that each read the one above (a running total) is therefore worked out without 100 000 nested calls, which would overflow the stack.
//
// How it stays quick in a big sheet:
// - the formulas are found by row id, then column id (ids are unique in the whole workbook), never through a text key made for every look-up;
// - each column keeps the set of its formulas that have no value, so a SUM over 100 000 rows after one keystroke finds the one amount to work out at once;
// - where a range points (its rows and columns by position) is kept until rows or columns move;
// - inserting or moving rows only takes the value from the formulas whose answer can change: the ones that read ranges, and the ones that ask where a cell
//   stands (ROW, COLUMN). A formula that reads single cells keeps its value, because it reads the same cells by id wherever they went.

import { parseFormula, evaluate } from './formula/formula.js';
import { ERR, XlRange, isRange } from './formula/xlvalue.js';
import { resolveRef } from './refs.js';

/**
 * What the engine needs from the workbook: the Grid of refs.js, plus the plain content of a cell, the order of a sheet and the rounding of a column.
 * @typedef {import('./refs.js').Grid & {
 *   content: (sheetId: string, rowId: string, colId: string) => any,
 *   rowOrder: (sheetId: string) => string[],
 *   colOrder: (sheetId: string) => string[],
 *   decimalsFor: (sheetId: string, rowId: string, colId: string) => number|null,
 *   now: () => Date
 * }} EngineHost
 */

/**
 * A number rounded to `decimals` places, half away from zero, without the error of multiplying a float (1.005 rounds to 1.01, as written).
 * @param {number} x
 * @param {number} decimals
 */
export function roundTo(x, decimals) {
    if (typeof x !== 'number' || !isFinite(x)) return x;
    const sign = x < 0 ? -1 : 1;
    // moving the decimal point by editing the exponent of the text keeps the digits as they were written
    const shifted = Math.round(Number(Math.abs(x) + 'e' + decimals));
    return sign * Number(shifted + 'e-' + decimals);
}

// a map of sets, the sets made when first needed and dropped when empty
function addTo(map, key, item) { let set = map.get(key); if (!set) map.set(key, (set = new Set())); set.add(item); }
function takeFrom(map, key, item) { const set = map.get(key); if (set) { set.delete(item); if (!set.size) map.delete(key); } }

// The tree of a formula text, made once for every formula that has the same text. Formulas kept by ids read alike down a column ("=⟦0⟧*⟦1⟧" in
// every row of an amount column), so 100 000 of them are read once.
const trees = new Map();
function treeOf(text) {
    let ast = trees.get(text);
    if (ast === undefined) {
        ast = parseFormula(text).ast || null;
        if (trees.size > 20000) trees.clear();
        trees.set(text, ast);
    }
    return ast;
}

/** @param {EngineHost} host */
export function createEngine(host) {
    const entries = new Map();        // row id -> Map(column id -> entry): every formula
    let count = 0;
    const cellReaders = new Map();    // row id -> Map(column id -> Set of entries that read that one cell)
    const rowReaders = new Map();     // row id -> Set of entries that read a single cell in that row
    const colReaders = new Map();     // column id -> Set of entries that read a single cell in that column
    const rangeReaders = new Map();   // sheet id -> Set of entries that read a range (or whole rows or columns) of that sheet
    const sheetReaders = new Map();   // sheet id -> Set of entries that read anything in that sheet
    const positional = new Map();     // sheet id -> Set of entries whose answer depends on where cells stand in that sheet (ROW, COLUMN)
    const inSheet = new Map();        // sheet id -> Set of entries that are in that sheet
    const inColumn = new Map();       // column id -> Set of entries in that column
    const pendingInColumn = new Map();// column id -> Set of entries in that column that have no value
    const volatile = new Set();       // entries that read the clock (NOW, TODAY, RAND)
    let structure = 0;                // raised whenever rows or columns move: the positions kept for ranges are old after it

    function entryAt(row, col) { const m = entries.get(row); return m ? m.get(col) : undefined; }

    function setValueOf(e, v) {
        e.value = v;
        if (!e.has) { e.has = true; takeFrom(pendingInColumn, e.col, e); }
    }
    function dropValueOf(e) {
        if (!e.has) return false;
        e.has = false;
        e.value = undefined;
        addTo(pendingInColumn, e.col, e);
        return true;
    }

    function link(e) {
        addTo(inSheet, e.s, e);
        addTo(inColumn, e.col, e);
        addTo(pendingInColumn, e.col, e);
        for (const ref of e.formula.refs) {
            const target = ref.s || e.s;
            addTo(sheetReaders, target, e);
            if (ref.k === 'cell') {
                let byCol = cellReaders.get(ref.r1);
                if (!byCol) cellReaders.set(ref.r1, (byCol = new Map()));
                addTo(byCol, ref.c1, e);
                addTo(rowReaders, ref.r1, e);
                addTo(colReaders, ref.c1, e);
            } else {
                addTo(rangeReaders, target, e);
            }
        }
    }

    function unlink(e) {
        takeFrom(inSheet, e.s, e);
        takeFrom(inColumn, e.col, e);
        takeFrom(pendingInColumn, e.col, e);
        for (const ref of e.formula.refs) {
            const target = ref.s || e.s;
            takeFrom(sheetReaders, target, e);
            if (ref.k === 'cell') {
                const byCol = cellReaders.get(ref.r1);
                if (byCol) { takeFrom(byCol, ref.c1, e); if (!byCol.size) cellReaders.delete(ref.r1); }
                takeFrom(rowReaders, ref.r1, e);
                takeFrom(colReaders, ref.c1, e);
            } else {
                takeFrom(rangeReaders, target, e);
            }
        }
        for (const set of positional.values()) set.delete(e);
        volatile.delete(e);
    }

    /** Where reference number i of a formula points now (kept until rows or columns move), or null for #REF!. */
    function rectOf(e, i) {
        if (e.rectsAt !== structure) { e.rects = new Array(e.formula.refs.length); e.rectsAt = structure; }
        let rect = e.rects[i];
        if (rect === undefined) rect = e.rects[i] = resolveRef(e.formula.refs[i], e.s, host);
        return rect;
    }

    /** The formulas that read the cell (s, row, col) directly: the ones that name it, and the ones whose range holds it where it stands now. */
    function readersOf(s, row, col, out) {
        const byCol = cellReaders.get(row);
        const direct = byCol && byCol.get(col);
        if (direct) for (const e of direct) out.push(e);
        const ranged = rangeReaders.get(s);
        if (!ranged || !ranged.size) return;
        const c = host.colIndexOf(s, col);
        if (c < 0) return;
        // the row is looked up only when a range covers the column (most cells that change are outside every range's columns)
        let r = -2;
        for (const e of ranged) {
            const refs = e.formula.refs;
            for (let i = 0; i < refs.length; i++) {
                if (refs[i].k === 'cell' || (refs[i].s || e.s) !== s) continue;
                const rect = rectOf(e, i);
                if (!rect || c < rect.c1 || c > rect.c2) continue;
                if (r === -2) r = host.rowIndexOf(s, row);
                if (r >= rect.r1 && r <= rect.r2 && c >= rect.c1 && c <= rect.c2) { out.push(e); break; }
            }
        }
    }

    /** Takes the value away from these formulas, and from every formula that reads them, and so on. */
    function loseAll(start) {
        const queue = [];
        for (const e of start) if (dropValueOf(e)) queue.push(e);
        const found = [];
        while (queue.length) {
            const e = queue.pop();
            found.length = 0;
            readersOf(e.s, e.row, e.col, found);
            // a formula with no value has none to lose, and nothing after it has one either (it was lost with it)
            for (const reader of found) if (dropValueOf(reader)) queue.push(reader);
        }
    }

    /** Takes the value away from every formula that reads the cell (s, row, col), and from the ones after them. */
    function cellChanged(s, row, col) {
        const found = [];
        readersOf(s, row, col, found);
        loseAll(found);
    }

    /** The formulas a formula reads that have no value yet (what must be worked out before it). */
    function pendingInputs(e, out) {
        const refs = e.formula.refs;
        for (let i = 0; i < refs.length; i++) {
            const ref = refs[i];
            const rect = rectOf(e, i);
            if (!rect) continue;
            if (ref.k === 'cell') {
                const p = entryAt(ref.r1, ref.c1);
                if (p && !p.has) out.push(p);
                continue;
            }
            const cols = host.colOrder(rect.s);
            for (let c = rect.c1; c <= rect.c2; c++) {
                const pending = pendingInColumn.get(cols[c]);
                if (!pending) continue;
                for (const p of pending) {
                    const r = host.rowIndexOf(rect.s, p.row);
                    if (r >= rect.r1 && r <= rect.r2) out.push(p);
                }
            }
        }
    }

    function plain(s, row, col) {
        const v = host.content(s, row, col);
        return v === undefined || v === '' ? null : v;
    }

    function valueOfIds(s, row, col) {
        const e = entryAt(row, col);
        if (e) return e.has ? e.value : compute(e);
        return plain(s, row, col);
    }

    // what evaluate() asks of a formula's surroundings; made once per formula and kept with it
    function envOf(e) {
        if (e.env) return e.env;
        const mark = (s) => addTo(positional, s, e);
        e.env = {
            slot(i, asRange) {
                const rect = rectOf(e, i);
                if (!rect) return ERR.REF;
                const ref = e.formula.refs[i];
                if (ref.k === 'cell' && !asRange) return valueOfIds(rect.s, ref.r1, ref.c1);
                // ROW(A5) and the like ask where the cell stands: the answer changes when rows move
                if (asRange) mark(rect.s);
                const rows = host.rowOrder(rect.s), cols = host.colOrder(rect.s);
                return new XlRange(rect.r1, rect.c1, rect.r2, rect.c2, (r, c) => {
                    const row = rows[r], col = cols[c];
                    return row === undefined || col === undefined ? ERR.REF : valueOfIds(rect.s, row, col);
                });
            },
            // a formula that could not be kept by ids (it did not read) has no references; these two are here for completeness
            cell: () => ERR.REF,
            range: () => ERR.REF,
            get now() { return host.now(); },
            get at() { mark(e.s); return { s: e.s, r: host.rowIndexOf(e.s, e.row), c: host.colIndexOf(e.s, e.col) }; },
            volatile() { volatile.add(e); }
        };
        return e.env;
    }

    /** Works one formula out, everything it reads having been worked out before (or being part of a cycle). */
    function evaluateEntry(e) {
        if (!e.ast) return ERR.NAME;
        let result = evaluate(e.ast, envOf(e));
        if (isRange(result)) result = result.rows === 1 && result.cols === 1 ? result.at(0, 0) : ERR.VALUE;
        if (result === undefined) result = null;
        const decimals = host.decimalsFor(e.s, e.row, e.col);
        if (decimals !== null && typeof result === 'number') result = roundTo(result, decimals);
        return result;
    }

    function compute(start) {
        if (start.has) return start.value;
        if (start.busy) return ERR.CYCLE;
        // A formula stays "busy" from the moment it is opened until it has its value. Everything opened after it and before its value is something it
        // needs; so when a formula reads one that is busy, that one needs it back: a cycle, and the reader gets #CYCLE! (as in Excel).
        const stack = [start];
        const opened = [];
        const inputs = [];
        try {
            while (stack.length) {
                const e = stack[stack.length - 1];
                if (e.has) { stack.pop(); continue; }
                if (!e.busy) {
                    e.busy = true;
                    opened.push(e);
                    inputs.length = 0;
                    pendingInputs(e, inputs);
                    for (const p of inputs) if (!p.busy) stack.push(p);
                    continue;
                }
                stack.pop();
                setValueOf(e, evaluateEntry(e));
                e.busy = false;
            }
        } finally {
            for (const e of opened) e.busy = false;
        }
        return start.value;
    }

    function setFormula(s, row, col, formula, quiet) {
        let byCol = entries.get(row);
        const old = byCol && byCol.get(col);
        if (old) { unlink(old); byCol.delete(col); count--; }
        if (formula) {
            if (!byCol) entries.set(row, (byCol = new Map()));
            const e = { s, row, col, formula, ast: treeOf(formula.f), has: false, value: undefined, busy: false, rects: null, rectsAt: -1, env: null };
            byCol.set(col, e);
            count++;
            link(e);
        } else if (byCol && !byCol.size) {
            entries.delete(row);
        }
        if (!quiet) cellChanged(s, row, col);
    }

    // the formulas whose answer can change when rows or columns of sheet s move: ranges into it, and the ones that ask for positions in it
    function movedIn(s) {
        structure++;
        return [...(rangeReaders.get(s) || []), ...(positional.get(s) || [])];
    }

    return {
        /** The value of a cell, by ids: a formula worked out, or the plain content. */
        value: valueOfIds,
        /**
         * Registers the formula of a cell (or takes it away with null). The formulas that read the cell lose their value, unless `quiet` (when a workbook
         * is opened nothing has a value yet, and when rows come and go the workbook says so with rowsChanged).
         */
        setFormula,
        /** A plain value changed. */
        cellChanged,
        /** Rows were inserted or deleted (undo brings deleted rows back by inserting them): what read them, ranges, and positions are worked out again. */
        rowsChanged(s, rowIds) {
            const lost = movedIn(s);
            for (const id of rowIds) { const set = rowReaders.get(id); if (set) for (const e of set) lost.push(e); }
            loseAll(lost);
        },
        /** Columns were inserted or deleted. */
        colsChanged(s, colIds) {
            const lost = movedIn(s);
            for (const id of colIds) { const set = colReaders.get(id); if (set) for (const e of set) lost.push(e); }
            loseAll(lost);
        },
        /** Rows or columns moved (a sort, a drag): only ranges and positions can answer differently. */
        moved(s) { loseAll(movedIn(s)); },
        /** A whole sheet came or went: every formula in it and every formula that reads it is worked out again. */
        sheetChanged(s) {
            structure++;
            loseAll([...(inSheet.get(s) || []), ...(sheetReaders.get(s) || [])]);
        },
        /** The clock moved on: NOW, TODAY and RAND are worked out again, and what reads them. */
        tick() { loseAll([...volatile]); },
        /** The formula of a cell, or undefined. */
        formulaOf(s, row, col) { const e = entryAt(row, col); return e ? e.formula : undefined; },
        /** The row ids of a column that hold formulas (for the workbook, when a column is deleted or changes its format). */
        formulaRowsOf(s, col) { return [...(inColumn.get(col) || [])].map((e) => e.row); },
        /**
         * Works out a formula that is in no cell (the condition of a rule, worked out for one row), as if it were in the cell (s, row, col): it reads the
         * sheet as the cell's own formula would, and is not kept (nothing reads it, so no change has to reach it).
         * @param {import('./refs.js').StoredFormula} formula
         */
        evaluateDetached(s, row, col, formula) {
            const e = { s, row, col, formula, ast: treeOf(formula.f), has: false, value: undefined, busy: false, rects: null, rectsAt: -1, env: null };
            // what it reads that has no value yet is worked out first, as for any formula
            const inputs = [];
            pendingInputs(e, inputs);
            for (const p of inputs) compute(p);
            return evaluateEntry(e);
        },
        /** How many formulas there are, and how many have a value (for the tests). */
        stats() { let worked = 0; for (const m of entries.values()) for (const e of m.values()) if (e.has) worked++; return { formulas: count, worked }; }
    };
}
