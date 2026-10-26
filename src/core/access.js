// The rules the host gives the workbook about what a person may do: cells that are read only, cells whose content is hidden, and the types of columns.
// They come from the host's backend (for this person, this role), are not part of the workbook (not saved, not undone), and are kept by the same code
// in the browser and on the server: the browser refuses a change that breaks them, and the server (checkPatch) refuses a save that does.
//
//   {
//     sheet: 'BOQ',                       the sheet's name or id (none: every sheet)
//     range: 'A4:F100000',                the cells (none: the whole sheet); kept by the ids of its corners, so it follows inserted rows
//     columns: ['Rate', 'E'],             or only some columns: by the name in their header (headerRow) or by their letter
//     headerRow: 3,                       the row (counted from 1, as a person reads it) whose texts name the columns; default 1
//     when: '=$G4="Approved"',            and only where this is TRUE: a formula written for the first row of the range (without a range: for the
//                                         row right under the header row), moved down to every row it is asked for
//     mode: 'readonly' | 'hidden',        hidden: the content shows as ••• and cannot be read, copied or found (it is still in the data: a backend
//                                         that must not send it leaves it out)
//     message: 'The rates are fixed',     what the person is told when a change is refused
//   }
//
// The types are given per sheet: { headerRow: 3, fields: { Rate: { kind: 'decimal', scale: 2 }, ... } } (fromApiMakerType makes them from a Type),
// or by letter: { columns: { E: { kind: 'int' } } }.

import { shiftFormula } from './formula/formula.js';
import { colIndex } from './formula/address.js';
import { storeFormula } from './refs.js';
import { checkValue } from './types.js';

function parseRange(text) {
    const m = /^\s*([A-Za-z]{1,3})(\d+)\s*:\s*([A-Za-z]{1,3})(\d+)\s*$/.exec(text || '');
    if (!m) return null;
    return { r1: Math.min(+m[2], +m[4]) - 1, c1: Math.min(colIndex(m[1]), colIndex(m[3])), r2: Math.max(+m[2], +m[4]) - 1, c2: Math.max(colIndex(m[1]), colIndex(m[3])) };
}

/**
 * The columns a list names, as column ids: a letter ("E") is that column; another text is the column whose header (in headerRow) says it.
 * @param {any} wb
 */
function columnIds(wb, s, names, headerRow) {
    const out = new Set();
    const size = wb.size(s);
    for (const name of names) {
        if (/^[A-Za-z]{1,3}$/.test(name) && colIndex(name) < size.cols && !headerNamed(wb, s, name, headerRow)) { out.add(wb.colId(s, colIndex(name))); continue; }
        const c = headerNamed(wb, s, name, headerRow);
        if (c >= 0) out.add(wb.colId(s, c));
    }
    return out;
}

// the column whose header text is `name` (any case, spaces around ignored), or -1 (a letter-like name such as "Qty" is looked for as a header first)
function headerNamed(wb, s, name, headerRow) {
    const size = wb.size(s);
    const want = String(name).trim().toLowerCase();
    for (let c = 0; c < size.cols; c++) {
        const v = wb.value(s, headerRow, c);
        if (v !== null && v !== undefined && String(v).trim().toLowerCase() === want) return c;
    }
    return -1;
}

/**
 * Rules made ready for a workbook: their sheets, cells and columns found once, by ids.
 * @param {any} wb
 * @param {object[]} rules
 */
export function resolveRules(wb, rules) {
    const out = [];
    for (const rule of rules || []) {
        const sheets = rule.sheet ? [wb.sheetIds().includes(rule.sheet) ? rule.sheet : wb.sheetIdByName(rule.sheet)].filter(Boolean) : wb.sheetIds();
        for (const s of sheets) {
            const headerRow = (rule.headerRow || 1) - 1;
            const rect = rule.range ? parseRange(rule.range) : null;
            const size = wb.size(s);
            const corners = rect ? { r1: wb.rowId(s, Math.min(rect.r1, size.rows - 1)), c1: wb.colId(s, Math.min(rect.c1, size.cols - 1)), r2: wb.rowId(s, Math.min(rect.r2, size.rows - 1)), c2: wb.colId(s, Math.min(rect.c2, size.cols - 1)) } : null;
            const cols = rule.columns && rule.columns.length ? columnIds(wb, s, rule.columns, headerRow) : null;
            // the condition is written for the first row of the range (or the row under the header): it is moved to each row it is asked for
            const baseRow = rect ? rect.r1 : headerRow + 1;
            // the header row names the columns, it is not data: a rule given by columns leaves it alone (the name of a hidden column still shows)
            const headerRowId = cols ? wb.rowId(s, headerRow) : null;
            out.push({ s, corners, cols, headerRowId, when: rule.when || null, baseRow, mode: rule.mode === 'hidden' ? 'hidden' : 'readonly', message: rule.message || null, cache: new Map() });
        }
    }
    return out;
}

/**
 * What a rule makes of the cell (r, c) of sheet s: 'hidden', 'readonly' or null, and the message of the rule that decided.
 * @param {any} wb
 * @param {ReturnType<typeof resolveRules>} rules
 * @param {number} revision  The workbook's revision: the conditions worked out for a row are kept until it changes.
 */
export function modeOf(wb, rules, s, r, c, revision) {
    let found = null;
    for (const rule of rules) {
        if (rule.s !== s) continue;
        if (rule.corners) {
            const r1 = wb.rowIndex(s, rule.corners.r1), r2 = wb.rowIndex(s, rule.corners.r2), c1 = wb.colIndex(s, rule.corners.c1), c2 = wb.colIndex(s, rule.corners.c2);
            if (r1 < 0 || r2 < 0 || c1 < 0 || c2 < 0) continue;
            if (r < Math.min(r1, r2) || r > Math.max(r1, r2) || c < Math.min(c1, c2) || c > Math.max(c1, c2)) continue;
        }
        if (rule.cols && (!rule.cols.has(wb.colId(s, c)) || wb.rowId(s, r) === rule.headerRowId)) continue;
        if (rule.when && !conditionHolds(wb, rule, s, r, revision)) continue;
        if (!found || (rule.mode === 'hidden' && found.mode !== 'hidden')) found = { mode: rule.mode, message: rule.message };
    }
    return found;
}

// a rule's condition for one row, worked out once per row and revision
function conditionHolds(wb, rule, s, r, revision) {
    const rowId = wb.rowId(s, r);
    const key = rowId;
    const hit = rule.cache.get(key);
    if (hit && hit.revision === revision) return hit.value;
    const text = shiftFormula(rule.when.startsWith('=') ? rule.when : '=' + rule.when, r - rule.baseRow, 0);
    const formula = storeFormula(text, s, wb._grid);
    const v = wb._engine.evaluateDetached(s, rowId, wb.colId(s, 0), formula);
    const value = v === true || (typeof v === 'number' && v !== 0);
    rule.cache.set(key, { revision, value });
    return value;
}

/**
 * Types made ready: column id -> type, for a sheet. `spec` is { headerRow, fields } (the header names the fields) or { columns: { E: type } }.
 */
export function resolveTypes(wb, s, spec) {
    const out = new Map();
    if (!spec) return out;
    const headerRow = (spec.headerRow || 1) - 1;
    for (const [name, t] of Object.entries(spec.fields || {})) { const c = headerNamed(wb, s, name, headerRow); if (c >= 0) out.set(wb.colId(s, c), { ...t, field: name }); }
    for (const [letter, t] of Object.entries(spec.columns || {})) { const c = colIndex(letter); if (c >= 0 && c < wb.size(s).cols) out.set(wb.colId(s, c), { ...t, field: t.field || letter }); }
    // the header row itself is not data: it is never checked
    out.headerRowId = spec.headerRow ? wb.rowId(s, headerRow) : null;
    return out;
}

export { checkValue };
