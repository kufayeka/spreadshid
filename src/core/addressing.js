// Addresses as a person writes them, everywhere the workbook takes rows and columns: "C2" for a cell, "A1:F1" for a range ("A1:F1, A6:F6" for
// several), "B" or "B:D" for columns, "2:5" for rows. The workbook's functions keep taking numbers (counted from 0) as well; these only put the text
// into numbers before the function sees it. And wb.sheet("BOQ") gives the same functions bound to one sheet, so it is not written again and again:
//
//   const boq = wb.sheet('BOQ');
//   boq.setValues('A1', [['No', 'Pekerjaan']]);
//   boq.setStyle('A1:F1', { bold: true });
//   boq.value('F6');

import { colIndex } from './formula/address.js';

const CELL = /^\s*(?:(?:'(?:[^']|'')+'|[^!'":]+)!)?\$?([A-Za-z]{1,3})\$?(\d{1,7})\s*$/;

/** "C2" -> { r: 1, c: 2 }; throws for a text that is not the address of one cell. */
export function cellOf(text) {
    const m = CELL.exec(String(text));
    if (!m) throw new Error('"' + text + '" is not the address of a cell (as "C2")');
    return { r: Number(m[2]) - 1, c: colIndex(m[1].toUpperCase()) };
}

/** "A1:F1" -> { r1, c1, r2, c2 }; "C2" -> the one cell. Throws for a text that is not a range. */
export function rangeOf(text) {
    const parts = String(text).replace(/^\s*(?:'(?:[^']|'')+'|[^!'":]+)!/, '').split(':');
    if (parts.length > 2) throw new Error('"' + text + '" is not a range (as "A1:F10")');
    const a = cellOf(parts[0]), b = parts.length === 2 ? cellOf(parts[1]) : a;
    return { r1: Math.min(a.r, b.r), c1: Math.min(a.c, b.c), r2: Math.max(a.r, b.r), c2: Math.max(a.c, b.c) };
}

// a range given as text ("A1:F1", "A1:F1, A6:F6"), as a rectangle, or as a list of either: as the function takes it (one, or a list)
function ranges(x) {
    if (typeof x === 'string') { const list = x.split(',').map((p) => p.trim()).filter(Boolean).map(rangeOf); return list.length === 1 ? list[0] : list; }
    if (Array.isArray(x)) return x.map((y) => (typeof y === 'string' ? rangeOf(y) : y));
    return x;
}

// "2:5" -> [1, 2, 3, 4]; "3" -> [2]; numbers stay as they are (counted from 0)
function rowList(x) {
    if (typeof x === 'number') return [x];
    if (typeof x === 'string') {
        const out = [];
        for (const part of x.split(',').map((p) => p.trim()).filter(Boolean)) {
            const m = /^(\d+)(?::(\d+))?$/.exec(part);
            if (!m) throw new Error('"' + part + '" is not a row or rows (as "2" or "2:5")');
            const a = Number(m[1]) - 1, b = m[2] ? Number(m[2]) - 1 : a;
            for (let r = Math.min(a, b); r <= Math.max(a, b); r++) out.push(r);
        }
        return out;
    }
    return Array.isArray(x) ? x.flatMap((y) => (typeof y === 'number' ? [y] : rowList(y))) : x;
}

// "B:D" -> [1, 2, 3]; "B" -> [1]; numbers stay as they are
function colList(x) {
    if (typeof x === 'number') return [x];
    if (typeof x === 'string') {
        const out = [];
        for (const part of x.split(',').map((p) => p.trim()).filter(Boolean)) {
            const m = /^([A-Za-z]{1,3})(?::([A-Za-z]{1,3}))?$/.exec(part);
            if (!m) throw new Error('"' + part + '" is not a column or columns (as "B" or "B:D")');
            const a = colIndex(m[1].toUpperCase()), b = m[2] ? colIndex(m[2].toUpperCase()) : a;
            for (let c = Math.min(a, b); c <= Math.max(a, b); c++) out.push(c);
        }
        return out;
    }
    return Array.isArray(x) ? x.flatMap((y) => (typeof y === 'number' ? [y] : colList(y))) : x;
}
const oneCol = (x) => (typeof x === 'string' ? colList(x)[0] : x);
const oneRow = (x) => (typeof x === 'string' ? rowList(x)[0] : x);

// the functions that take a cell as (s, r, c, ...): also (s, "C2", ...)
const CELL_FNS = ['raw', 'value', 'input', 'display', 'style', 'cellFormat', 'modeAt', 'typeAt', 'validationAt', 'choicesAt', 'invalidAt', 'commentAt', 'hasComment',
    'conditionalStyleAt', 'shownStyle', 'setValues', 'addComment', 'filteredOut'];
// the functions that take a range as their argument number i (after the sheet): also its text
const RANGE_FNS = { setStyle: 1, clear: 1, mergeCells: 1, unmergeCells: 1, createFilter: 1, addValidation: 1, setValidation: 1, removeValidation: 1, addConditional: 1, setConditional: 2 };

/**
 * Lets the functions of a workbook take addresses as text too (see the top of this file), and adds wb.sheet(). Changes `api` in place.
 * @param {any} api
 */
export function addressable(api) {
    for (const name of CELL_FNS) {
        const fn = api[name];
        if (!fn) continue;
        api[name] = (s, r, ...rest) => {
            if (typeof r !== 'string') return fn(s, r, ...rest);
            const at = cellOf(r);
            return fn(s, at.r, at.c, ...rest);
        };
    }
    for (const [name, i] of Object.entries(RANGE_FNS)) {
        const fn = api[name];
        if (!fn) continue;
        api[name] = (...args) => { args[i] = ranges(args[i]); return fn(...args); };
    }
    const addName = api.addName;
    api.addName = (name, s, rect, how) => addName(name, s, ranges(rect), how);
    const setName = api.setName;
    api.setName = (id, patch, how) => setName(id, patch && typeof patch.range === 'string' ? { ...patch, range: ranges(patch.range) } : patch, how);
    // setBlock's entries may say where by address: { at: 'A6', value, style }
    const setBlock = api.setBlock;
    api.setBlock = (s, entries, how) => setBlock(s, entries.map((e) => (e && typeof e.at === 'string' ? (({ at, ...rest }) => ({ ...cellOf(at), ...rest }))(e) : e)), how);
    for (const [name, list] of [['setRowProps', rowList], ['setColProps', colList]]) {
        const fn = api[name];
        api[name] = (s, which, patch, how) => fn(s, list(which), patch, how);
    }
    // inserting and deleting: (s, "5", 2) inserts 2 rows at row 5; (s, "3:5") deletes rows 3 to 5; the same with column letters
    for (const [name, one, list] of [['insertRows', oneRow, rowList], ['deleteRows', oneRow, rowList], ['insertCols', oneCol, colList], ['deleteCols', oneCol, colList]]) {
        const fn = api[name];
        api[name] = (s, at, count, how) => {
            if (typeof at !== 'string') return fn(s, at, count, how);
            const all = list(at);
            // a span ("3:5") is its own count; how may then come where count would
            if (all.length > 1 || typeof count === 'object') return fn(s, all[0], all.length > 1 ? all.length : 1, typeof count === 'object' ? count : how);
            return fn(s, one(at), count === undefined ? 1 : count, how);
        };
    }
    for (const [name, list] of [['groupRows', rowList], ['ungroupRows', rowList], ['groupCols', colList], ['ungroupCols', colList]]) {
        const fn = api[name];
        api[name] = (s, from, to, how) => {
            if (typeof from !== 'string') return fn(s, from, to, how);
            const all = list(from);
            return fn(s, all[0], all[all.length - 1], typeof to === 'object' ? to : how);
        };
    }
    for (const name of ['setFilterColumn', 'filterValues']) {
        const fn = api[name];
        api[name] = (s, c, ...rest) => fn(s, oneCol(c), ...rest);
    }

    // a sheet given by its name ("BOQ") is its id to every function that takes the sheet first (the workbook itself keeps ids only)
    const idOf = (s) => (typeof s !== 'string' || api.sheetIds().includes(s) ? s : api.sheetIdByName(s) || s);
    for (const name of SHEET_FNS) {
        const fn = api[name];
        if (typeof fn === 'function') api[name] = (s, ...rest) => fn(idOf(s), ...rest);
    }
    const addNameById = api.addName;
    api.addName = (name, s, rect, how) => addNameById(name, idOf(s), rect, how);

    /**
     * The workbook's functions bound to one sheet (by its name or id): every function that takes the sheet first, without it.
     * @param {string} nameOrId
     */
    api.sheet = (nameOrId) => {
        const s = api.sheetIds().includes(nameOrId) ? nameOrId : api.sheetIdByName(nameOrId);
        if (!s) throw new Error('there is no sheet "' + nameOrId + '"');
        const bound = { id: s, get name() { return api.sheetProps(s).name; } };
        for (const name of SHEET_FNS) if (typeof api[name] === 'function') bound[name] = (...args) => api[name](s, ...args);
        return bound;
    };
    return api;
}

// the functions that take the sheet first (bound by wb.sheet)
const SHEET_FNS = [...CELL_FNS, ...Object.keys(RANGE_FNS), 'setRowProps', 'setColProps', 'insertRows', 'deleteRows', 'insertCols', 'deleteCols', 'moveRows',
    'rowProps', 'colProps', 'rowId', 'colId', 'rowIndex', 'colIndex', 'size', 'sheetProps', 'setSheetProps', 'merges', 'lastFilled', 'forEachFilledRow', 'setBlock',
    'rowAxis', 'colAxis', 'setTypes', 'groupRows', 'ungroupRows', 'groupCols', 'ungroupCols', 'foldRowGroup', 'foldColGroup', 'showRowLevel', 'showColLevel',
    'rowGroups', 'colGroups', 'removeFilter', 'setFilterColumn', 'filterOf', 'filterValues', 'dataRegion', 'conditionals', 'removeConditional', 'moveConditional',
    'replyComment', 'editComment', 'deleteComment', 'resolveComment', 'comments', 'hideSheet', 'removeSheet', 'duplicateSheet', 'moveSheet', 'sheetShown'];
