// What a server (Nexa AM) does with a workbook: give each person only what they may see (viewFor), put a save onto the stored workbook (mergePatch),
// and check, before it keeps it, that the save keeps the rules, the types and the access policy this person must keep (checkPatch). The browser refuses such changes already; the server refuses them again, because a browser can be made to send
// anything. Pure (no DOM): it runs in Node with the same code as the grid.

import { createWorkbook } from './workbook.js';
import { checkValue as checkTypeOf } from './types.js';
import { isStoredFormula, resolveRef } from './refs.js';
import { actionsOfOp, refusalOf } from './policy.js';

const clone = (v) => JSON.parse(JSON.stringify(v));

/**
 * The stored workbook with a patch put on it (the shape pendingPatch() gives): sheets, columns and rows written whole by id, deleted ones taken out.
 * @param {import('./workbook.js').WorkbookDoc} doc
 * @param {ReturnType<ReturnType<typeof createWorkbook>['pendingPatch']>} patch
 * @param {{ policy?: object, who?: any, rules?: object[] }} [what]  The policy and the person (as viewFor takes them): the cells they were not given
 *   are kept as stored (their browser had them empty, or as answers), whatever the patch says of them.
 */
export function mergePatch(doc, patch, what) {
    patch = keepHeld(doc, patch, what);
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
 * @param {{ rules?: object[], types?: Object<string, object>, policy?: object, who?: any }} what  The rules (as setRules takes them), the types per sheet
 *   name or id (as setTypes), and the access policy with the person who saves (policy.js): what they may not do is a problem too.
 */
export function checkPatch(doc, patch, what) {
    const problems = [];
    patch = keepHeld(doc, patch, what);
    const before = workbookFor(doc, what);
    const after = workbookFor(mergePatch(doc, patch), what);
    if (what && what.policy !== undefined && !before.access().owner) problems.push(...refusedActions(doc, patch, before, what.who));
    for (const [name, spec] of Object.entries((what && what.types) || {})) {
        const s = after.sheetIds().includes(name) ? name : after.sheetIdByName(name);
        if (s) after.setTypes(s, spec);
    }
    const storedRows = new Map();
    for (const sheet of doc.sheets || []) for (const row of sheet.rows || []) storedRows.set(row.id, { sheet: sheet.id, row });
    const same = (a, b) => JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b);
    const say = (wb, s, r, c, reason) => problems.push({ sheet: wb.sheetProps(s).name, address: wb.address(r, c), reason });

    // the rows of a sort (their contents only moved among them) are let through where the person may sort but not edit
    const noEdit = before.access().message || 'You can only view this sheet';
    const sorted = what && what.policy !== undefined && before.can('sort') ? sortedRows(doc, patch) : new Set();
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
            if (r >= 0 && c >= 0) { const m = wb.modeAt(s, r, c); if (m && !(sorted.has(row.id) && m.message === noEdit)) { say(wb, s, r, c, m.message || 'a protected cell was changed'); continue; } }
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

// ---- access control on the server -------------------------------------------------------------------------------------------------------------------

// a workbook of the stored doc, with the host's rules and the policy for this person
function workbookFor(doc, what) {
    const wb = createWorkbook(doc);
    if (what && what.rules) wb.setRules(what.rules);
    if (what && what.policy !== undefined) wb.setAccess(what.policy, what.who);
    return wb;
}

/**
 * The cells a person is not given (policy.js): the hidden and invisible ones, and the formulas that read one of them (whose answer is given instead,
 * so the person sees the right total without the cells it is made of). Returns Map(rowId -> Map(colId -> 'gone' | value)).
 */
function heldCells(wb) {
    const held = new Map();
    const hold = (rid, cid, what) => { if (!held.has(rid)) held.set(rid, new Map()); held.get(rid).set(cid, what); };
    for (const s of wb.sheetIds()) {
        // the hidden cells of the sheet, by column: the rows (sorted), to find quickly whether a range reaches one
        const byCol = new Map();
        wb.forEachFilledRow(s, (r, cells) => {
            for (const cid of Object.keys(cells)) {
                const c = wb.colIndex(s, cid);
                if (c < 0) continue;
                const m = wb.modeAt(s, r, c);
                if (m && (m.mode === 'hidden' || m.mode === 'invisible')) {
                    hold(wb.rowId(s, r), cid, 'gone');
                    if (!byCol.has(c)) byCol.set(c, []);
                    byCol.get(c).push(r);
                }
            }
        });
        hiddenBySheet.set(s, byCol);
    }
    const reaches = (rect) => {
        const byCol = hiddenBySheet.get(rect.s);
        if (!byCol || !byCol.size) return false;
        for (const [c, rows] of byCol) {
            if (c < rect.c1 || c > rect.c2) continue;
            // the first hidden row at or after r1: is it at or before r2
            let lo = 0, hi = rows.length;
            while (lo < hi) { const mid = (lo + hi) >> 1; if (rows[mid] < rect.r1) lo = mid + 1; else hi = mid; }
            if (lo < rows.length && rows[lo] <= rect.r2) return true;
        }
        return false;
    };
    for (const s of wb.sheetIds()) {
        wb.forEachFilledRow(s, (r, cells) => {
            const rid = wb.rowId(s, r);
            for (const [cid, v] of Object.entries(cells)) {
                if (!isStoredFormula(v) || (held.has(rid) && held.get(rid).has(cid))) continue;
                if (v.refs.some((ref) => { const rect = resolveRef(ref, s, wb._grid); return rect && reaches(rect); })) {
                    const c = wb.colIndex(s, cid);
                    const value = wb.value(s, r, c);
                    hold(rid, cid, { value: value && typeof value === 'object' && value.code ? '=' + value.code : value });
                }
            }
        });
    }
    hiddenBySheet.clear();
    return held;
}
const hiddenBySheet = new Map();

/**
 * The workbook as a person may have it (what the server sends them): the hidden and invisible cells' content left out, and a formula that reads one of
 * them given as its answer. The host's rules and the policy (policy.js) decide, as the browser does; nothing the person may not see leaves the server.
 * @param {import('./workbook.js').WorkbookDoc} doc
 * @param {{ policy?: object, who?: any, rules?: object[] }} what
 */
export function viewFor(doc, what) {
    const wb = workbookFor(doc, what);
    const held = heldCells(wb);
    const out = clone(doc);
    // comments a person may not read are not sent
    if (!wb.can('comment.read')) for (const sheet of out.sheets || []) if (sheet.props) delete sheet.props.comments;
    for (const sheet of out.sheets || []) for (const row of sheet.rows || []) {
        const cells = held.get(row.id);
        if (!cells) continue;
        for (const [cid, what2] of cells) {
            if (what2 === 'gone') delete row.cells[cid];
            else if (what2.value === null || what2.value === undefined) delete row.cells[cid];
            else row.cells[cid] = what2.value;
        }
    }
    return out;
}

// the cells a person was not given, put back from what is stored into the rows a patch writes (the person's browser had them empty, or as answers)
function keepHeld(doc, patch, what) {
    if (!what || what.policy === undefined) return patch;
    const wb = workbookFor(doc, what);
    const out = clone(patch);
    // the comments of a person who may not read them were not sent: the sheets they save keep the stored ones
    if (!wb.can('comment.read')) {
        const storedSheets = new Map((doc.sheets || []).map((s) => [s.id, s]));
        for (const s of out.sheets.upsert) {
            const was = storedSheets.get(s.id);
            s.props = { ...(s.props || {}) };
            if (was && was.props && was.props.comments) s.props.comments = clone(was.props.comments); else delete s.props.comments;
        }
    }
    const held = heldCells(wb);
    if (!held.size) return out;
    const stored = new Map();
    for (const sheet of doc.sheets || []) for (const row of sheet.rows || []) stored.set(row.id, row);
    for (const row of out.rows.upsert) {
        const cells = held.get(row.id), was = stored.get(row.id);
        if (!cells || !was) continue;
        row.cells = row.cells || {};
        for (const cid of cells.keys()) { if (was.cells && was.cells[cid] !== undefined) row.cells[cid] = clone(was.cells[cid]); else delete row.cells[cid]; }
    }
    return out;
}

// the ids of the rows a patch only reorders: in each column, the contents (and styles) of the changed rows of a sheet, taken together, are the same
// before and after (a sort moves the cells of its columns among its rows; the columns it does not cover stay as they were)
function sortedRows(doc, patch) {
    const stored = new Map();
    for (const sheet of doc.sheets || []) for (const row of sheet.rows || []) stored.set(row.id, row);
    const bySheet = new Map();
    for (const row of patch.rows.upsert) {
        const was = stored.get(row.id);
        if (!was || JSON.stringify(was.cells || {}) === JSON.stringify(row.cells || {})) continue;
        if (!bySheet.has(row.sheetId)) bySheet.set(row.sheetId, []);
        bySheet.get(row.sheetId).push({ id: row.id, was, now: row });
    }
    const out = new Set();
    for (const rows of bySheet.values()) {
        const cols = new Set();
        for (const x of rows) for (const part of [x.was.cells, x.now.cells, x.was.style, x.now.style]) for (const cid of Object.keys(part || {})) cols.add(cid);
        const sameIn = (cid) => {
            const before = rows.map((x) => JSON.stringify([(x.was.cells || {})[cid], (x.was.style || {})[cid]])).sort();
            const after = rows.map((x) => JSON.stringify([(x.now.cells || {})[cid], (x.now.style || {})[cid]])).sort();
            return JSON.stringify(before) === JSON.stringify(after);
        };
        if ([...cols].every(sameIn)) rows.forEach((x) => out.add(x.id));
    }
    return out;
}

// What a patch asks to do that the policy does not let the person do: the changes it makes, as the ops that would make them (policy.js), each asked of
// the policy. Writing cells is the rules' to judge (per cell); a sort is let through as a sort.
function refusedActions(doc, patch, wb, who) {
    const out = [];
    const me = who && typeof who === 'object' ? who.user : typeof who === 'string' ? who.replace(/^user:/, '') : null;
    const ask = (op, sheet) => { for (const a of actionsOfOp(op, me)) if (a !== 'edit' && !wb.can(a)) out.push({ sheet, address: null, reason: refusalOf(a, wb.access().message) }); };
    const storedSheets = new Map((doc.sheets || []).map((s) => [s.id, s]));
    const storedRows = new Map(), storedCols = new Map();
    for (const sheet of doc.sheets || []) { for (const row of sheet.rows || []) storedRows.set(row.id, row); for (const col of sheet.columns || []) storedCols.set(col.id, col); }
    const name = (id) => (storedSheets.get(id) ? storedSheets.get(id).props.name : id);
    for (const s of patch.sheets.upsert) {
        const was = storedSheets.get(s.id);
        if (!was) ask({ t: 'addSheet' }, s.props && s.props.name);
        else {
            ask({ t: 'sheetProps', before: was.props, after: s.props }, name(s.id));
            if (was.key !== s.key) ask({ t: 'moveSheet' }, name(s.id));
        }
    }
    for (const id of patch.sheets.delete) ask({ t: 'removeSheet' }, name(id));
    for (const c of patch.columns.upsert) {
        const was = storedCols.get(c.id);
        if (!was) ask({ t: 'insertCols' }, name(c.sheetId)); else ask({ t: 'colProps', changes: [{ before: was.props, after: c.props }] }, name(c.sheetId));
    }
    for (const id of patch.columns.delete) if (storedCols.has(id)) ask({ t: 'deleteCols' }, null);
    const sorted = wb.can('sort') ? sortedRows(doc, patch) : new Set();
    for (const r of patch.rows.upsert) {
        const was = storedRows.get(r.id);
        if (!was) { ask({ t: 'insertRows' }, name(r.sheetId)); continue; }
        ask({ t: 'rowProps', changes: [{ before: was.props, after: r.props }] }, name(r.sheetId));
        if (sorted.has(r.id)) continue;
        const cols = new Set([...Object.keys(was.style || {}), ...Object.keys(r.style || {})]);
        ask({ t: 'styles', changes: [...cols].map((cid) => ({ before: (was.style || {})[cid], after: (r.style || {})[cid] })) }, name(r.sheetId));
    }
    for (const id of patch.rows.delete) if (storedRows.has(id)) ask({ t: 'deleteRows' }, null);
    if (patch.workbook && patch.workbook.settings) ask({ t: 'settings', before: doc.settings || {}, after: patch.workbook.settings }, null);
    // one problem per reason is enough to say
    const seen = new Set();
    return out.filter((p) => (seen.has(p.reason) ? false : seen.add(p.reason)));
}
