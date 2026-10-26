// What a server (Nexa AM) does with a save: put a patch onto the stored workbook, and check, before it keeps it, that the patch keeps the rules and
// the types this person must keep. The browser refuses such changes already; the server refuses them again, because a browser can be made to send
// anything. Pure (no DOM): it runs in Node with the same code as the grid.

import { createWorkbook } from './workbook.js';
import { checkValue as checkTypeOf } from './types.js';

const clone = (v) => JSON.parse(JSON.stringify(v));

/**
 * The stored workbook with a patch put on it (the shape pendingPatch() gives): sheets, columns and rows written whole by id, deleted ones taken out.
 * @param {import('./workbook.js').WorkbookDoc} doc
 * @param {ReturnType<ReturnType<typeof createWorkbook>['pendingPatch']>} patch
 */
export function mergePatch(doc, patch) {
    const out = clone(doc);
    out.sheets = out.sheets || [];
    if (patch.workbook && patch.workbook.settings) out.settings = clone(patch.workbook.settings);
    const sheetById = new Map(out.sheets.map((s) => [s.id, s]));
    for (const s of patch.sheets.upsert) {
        const had = sheetById.get(s.id);
        if (had) { had.key = s.key; had.props = clone(s.props); } else { const fresh = { id: s.id, key: s.key, props: clone(s.props), columns: [], rows: [] }; out.sheets.push(fresh); sheetById.set(s.id, fresh); }
    }
    for (const id of patch.sheets.delete) { out.sheets = out.sheets.filter((s) => s.id !== id); sheetById.delete(id); }
    for (const c of patch.columns.upsert) {
        const sheet = sheetById.get(c.sheetId);
        if (!sheet) continue;
        const i = sheet.columns.findIndex((x) => x.id === c.id);
        const col = { id: c.id, key: c.key, props: clone(c.props || {}) };
        if (i >= 0) sheet.columns[i] = col; else sheet.columns.push(col);
    }
    const goneCols = new Set(patch.columns.delete);
    for (const sheet of out.sheets) sheet.columns = sheet.columns.filter((c) => !goneCols.has(c.id));
    for (const r of patch.rows.upsert) {
        const sheet = sheetById.get(r.sheetId);
        if (!sheet) continue;
        const i = sheet.rows.findIndex((x) => x.id === r.id);
        const row = { id: r.id, key: r.key, cells: clone(r.cells || {}), style: clone(r.style || {}), props: clone(r.props || {}) };
        if (i >= 0) sheet.rows[i] = row; else sheet.rows.push(row);
    }
    const goneRows = new Set(patch.rows.delete);
    for (const sheet of out.sheets) sheet.rows = sheet.rows.filter((r) => !goneRows.has(r.id));
    if (patch.workbook && typeof patch.workbook.version === 'number') out.version = patch.workbook.version;
    return out;
}

/**
 * Checks a patch against the rules and the types this person must keep. Returns { ok, problems: [{ sheet, address, reason }] }.
 * A cell that changed (its content or its style) in a protected place is a problem; so is a deleted row or column that held protected cells, and a
 * value written in a typed column that is not of its type (a formula judged by what it works out to, in the workbook as the patch leaves it).
 *
 * @param {import('./workbook.js').WorkbookDoc} doc  The workbook as it is stored now.
 * @param {object} patch
 * @param {{ rules?: object[], types?: Object<string, object> }} what  The rules (as setRules takes them) and the types per sheet name or id (as setTypes).
 */
export function checkPatch(doc, patch, what) {
    const problems = [];
    const before = createWorkbook(doc);
    const after = createWorkbook(mergePatch(doc, patch));
    const rules = (what && what.rules) || [];
    before.setRules(rules);
    after.setRules(rules);
    for (const [name, spec] of Object.entries((what && what.types) || {})) {
        const s = after.sheetIds().includes(name) ? name : after.sheetIdByName(name);
        if (s) after.setTypes(s, spec);
    }
    const storedRows = new Map();
    for (const sheet of doc.sheets || []) for (const row of sheet.rows || []) storedRows.set(row.id, { sheet: sheet.id, row });
    const same = (a, b) => JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b);
    const say = (wb, s, r, c, reason) => problems.push({ sheet: wb.sheetProps(s).name, address: wb.address(r, c), reason });

    for (const row of patch.rows.upsert) {
        const s = row.sheetId;
        if (!after.sheetIds().includes(s)) continue;
        const stored = storedRows.get(row.id);
        const cols = new Set([...Object.keys(row.cells || {}), ...Object.keys(row.style || {}), ...Object.keys((stored && stored.row.cells) || {}), ...Object.keys((stored && stored.row.style) || {})]);
        for (const cid of cols) {
            const changed = !stored || !same(stored.row.cells && stored.row.cells[cid], row.cells && row.cells[cid]) || !same(stored.row.style && stored.row.style[cid], row.style && row.style[cid]);
            if (!changed) continue;
            // the rules are read where the cell stood before the save (a person cannot move a cell out of a protected place and change it in one save)
            const wb = stored ? before : after;
            const r = wb.rowIndex(s, row.id), c = wb.colIndex(s, cid);
            if (r >= 0 && c >= 0) { const m = wb.modeAt(s, r, c); if (m) { say(wb, s, r, c, m.message || 'a protected cell was changed'); continue; } }
            const ra = after.rowIndex(s, row.id), ca = after.colIndex(s, cid);
            const t = ra >= 0 && ca >= 0 ? after.typeAt(s, ra, ca) : null;
            if (t) {
                const expected = checkTypeOf(t, after.value(s, ra, ca));
                if (expected) say(after, s, ra, ca, 'expected ' + expected + (t.field ? ' (' + t.field + ')' : ''));
            }
        }
    }
    for (const id of patch.rows.delete) {
        const stored = storedRows.get(id);
        if (!stored) continue;
        const s = stored.sheet, r = before.rowIndex(s, id);
        for (let c = 0; r >= 0 && c < before.size(s).cols; c++) { const m = before.modeAt(s, r, c); if (m) { say(before, s, r, c, m.message || 'a row with protected cells was deleted'); break; } }
    }
    for (const cid of patch.columns.delete) {
        for (const s of before.sheetIds()) {
            const c = before.colIndex(s, cid);
            if (c < 0) continue;
            for (let r = 0; r < before.size(s).rows; r++) { const m = before.modeAt(s, r, c); if (m) { say(before, s, r, c, m.message || 'a column with protected cells was deleted'); break; } }
        }
    }
    return { ok: problems.length === 0, problems };
}
