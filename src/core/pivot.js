// Tables and pivots: a sheet read as records (tableOf), and records summed up by groups (pivot), as a pivot table in Google Sheets does it, and as
// GROUP BY does it in a database. Both are pure and run anywhere: the pivot table of a sheet uses them, and a server uses them to put the files of a
// project together (the S-curve of an overview from the weekly progress files). Pure (no DOM).
//
//   tableOf(wb, 'Opname', 'A1:F200')     -> [{ Minggu: 1, Pekerjaan: 'Galian', Realisasi: 0.4 }, ...]   (the first row names the fields)
//   tableOf(wb, null, 'Progres')         -> the same, from a named range
//   pivot(records, {
//       rows: ['Bab'],                                     the groups down
//       columns: ['Minggu'],                               the groups across (optional)
//       values: [{ field: 'Jumlah', fn: 'SUM' }],          what is summed in each (SUM, COUNT, COUNTA, COUNTUNIQUE, AVERAGE, MAX, MIN, MEDIAN, PRODUCT)
//       filters: { Status: { hidden: ['Draft'] } },        records left out
//       sort: { Bab: 'asc' },                              the order of the groups of a field ('asc' | 'desc'), by their names; the default is 'asc'
//       totals: true                                       a row and a column of grand totals (and subtotals under each outer group)
//   })
//   -> { cells: [[...]], header: n, rows: [...], ... }    cells is the table as it is written in a sheet

import { rangeOf } from './addressing.js';

/** The fields of a record table: the texts of its first row (an empty one is "Column B" ...). */
function fieldNames(first, c1) {
    const names = [];
    const seen = new Map();
    first.forEach((v, i) => {
        let name = v === null || v === undefined || v === '' ? 'Column ' + colLetter(c1 + i) : String(v).trim();
        // two columns named the same: the second is "Name 2", as a database would need them apart
        if (seen.has(name)) { const n = seen.get(name) + 1; seen.set(name, n); name = name + ' ' + n; } else seen.set(name, 1);
        names.push(name);
    });
    return names;
}
const colLetter = (c) => { let s = ''; c++; while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; };

/**
 * A range of a sheet as records: its first row names the fields, every row under it is a record (a row with nothing in it is left out). The values are
 * what the cells hold (formulas worked out). `where` is a range ("A1:F200", "B:F" for whole columns down to the last filled row) or a named range; with a
 * named range the sheet is the name's.
 * @param {any} wb
 * @param {string|null} sheet  The sheet (name or id); null with a named range.
 * @param {string|object} where
 * @returns {{ fields: string[], records: object[] }}
 */
export function tableOf(wb, sheet, where) {
    let s = sheet, rect;
    const named = typeof where === 'string' && wb.nameRange ? wb.nameRange(where) : null;
    if (named) { s = named.sheetId; rect = named.range; }
    else if (typeof where === 'string') {
        const cols = /^\s*([A-Za-z]{1,3})\s*:\s*([A-Za-z]{1,3})\s*$/.exec(where);
        if (cols) {
            const a = rangeOf(cols[1] + '1'), b = rangeOf(cols[2] + '1');
            rect = { r1: 0, c1: Math.min(a.c1, b.c1), r2: Math.max(0, wb.lastFilled(s).r), c2: Math.max(a.c1, b.c1) };
        } else rect = rangeOf(where);
    } else rect = where;
    if (!s) throw new Error('tableOf: "' + where + '" is not a named range, and no sheet was given');
    const read = (r) => { const row = []; for (let c = rect.c1; c <= rect.c2; c++) row.push(wb.value(s, r, c)); return row; };
    const fields = fieldNames(read(rect.r1), rect.c1);
    const records = [];
    for (let r = rect.r1 + 1; r <= rect.r2; r++) {
        const row = read(r);
        if (row.every((v) => v === null || v === undefined || v === '')) continue;
        const rec = {};
        fields.forEach((f, i) => { rec[f] = row[i] === undefined ? null : row[i]; });
        records.push(rec);
    }
    return { fields, records };
}

// ---- summing up ------------------------------------------------------------------------------------------------------------------------------------

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const nums = (list) => list.filter(isNum);
const round = (n) => (isNum(n) ? Number(n.toPrecision(15)) : n);
export const PIVOT_FUNCTIONS = {
    SUM: (l) => round(nums(l).reduce((a, b) => a + b, 0)),
    COUNT: (l) => nums(l).length,
    COUNTA: (l) => l.filter((v) => v !== null && v !== undefined && v !== '').length,
    COUNTUNIQUE: (l) => new Set(l.filter((v) => v !== null && v !== undefined && v !== '').map((v) => (typeof v === 'string' ? v.toLowerCase() : v))).size,
    AVERAGE: (l) => { const n = nums(l); return n.length ? round(n.reduce((a, b) => a + b, 0) / n.length) : null; },
    MAX: (l) => { const n = nums(l); return n.length ? Math.max(...n) : null; },
    MIN: (l) => { const n = nums(l); return n.length ? Math.min(...n) : null; },
    MEDIAN: (l) => { const n = nums(l).sort((a, b) => a - b); if (!n.length) return null; const m = n.length >> 1; return n.length % 2 ? n[m] : round((n[m - 1] + n[m]) / 2); },
    PRODUCT: (l) => { const n = nums(l); return n.length ? round(n.reduce((a, b) => a * b, 1)) : null; }
};

// the text a group is known by: an empty value is "(blank)", as in Google Sheets
const keyOf = (v) => (v === null || v === undefined || v === '' ? '' : typeof v === 'object' ? String(v.code || '') : v);
const labelOf = (k) => (k === '' ? '(blank)' : k);
function compareKeys(a, b) {
    if (a === b) return 0;
    if (a === '') return 1;
    if (b === '') return -1;
    if (isNum(a) && isNum(b)) return a - b;
    if (isNum(a) !== isNum(b)) return isNum(a) ? -1 : 1;
    return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

/** True when a record passes the filters ({ field: { hidden: [values] } }). */
function passes(rec, filters) {
    for (const [field, f] of Object.entries(filters || {})) {
        if (!f || !f.hidden || !f.hidden.length) continue;
        const k = keyOf(rec[field]);
        if (f.hidden.some((h) => keyOf(h) === k || String(keyOf(h)).toLowerCase() === String(k).toLowerCase())) return false;
    }
    return true;
}

/**
 * Records summed up by groups. Returns the table as cells (what a pivot table shows, ready to be written in a sheet) and as data:
 *   { cells: any[][], header: number, rowKeys: any[][], colKeys: any[][], value(rowKey, colKey, i) }
 * The first `header` rows of cells are the header (the names of the value fields, and the column groups); the first rows.length columns of each row
 * under it are the row groups.
 * @param {object[]} records
 * @param {{ rows?: string[], columns?: string[], values: { field: string, fn?: string, as?: string }[], filters?: object, sort?: object, totals?: boolean }} spec
 */
export function pivot(records, spec) {
    const rowFields = spec.rows || [], colFields = spec.columns || [];
    const values = (spec.values || []).map((v) => ({ field: v.field, fn: String(v.fn || 'SUM').toUpperCase(), as: v.as }));
    if (!values.length) throw new Error('a pivot needs at least one value to sum up');
    for (const v of values) if (!PIVOT_FUNCTIONS[v.fn]) throw new Error('a pivot has no function ' + v.fn + ' (it has ' + Object.keys(PIVOT_FUNCTIONS).join(', ') + ')');
    const totals = spec.totals !== false;
    const kept = records.filter((rec) => passes(rec, spec.filters));

    // the groups, and the values of each cell of the table (a cell: a group of rows and a group of columns, each a list of keys; [] is "all")
    const buckets = new Map();
    const put = (rk, ck, rec) => {
        const id = JSON.stringify([rk, ck]);
        if (!buckets.has(id)) buckets.set(id, values.map(() => []));
        const b = buckets.get(id);
        values.forEach((v, i) => b[i].push(rec[v.field]));
    };
    const rowKeySet = new Map(), colKeySet = new Map();
    for (const rec of kept) {
        const rk = rowFields.map((f) => keyOf(rec[f])), ck = colFields.map((f) => keyOf(rec[f]));
        rowKeySet.set(JSON.stringify(rk), rk);
        colKeySet.set(JSON.stringify(ck), ck);
        // every level of the groups gets the record: the subtotals and the totals are worked out from the records, not from other sums (an average of
        // averages would be wrong)
        for (let i = 0; i <= rk.length; i++) for (let j = 0; j <= ck.length; j++) put(rk.slice(0, i), ck.slice(0, j), rec);
    }
    const order = (fields) => (a, b) => {
        for (let i = 0; i < fields.length; i++) {
            const dir = (spec.sort && spec.sort[fields[i]]) === 'desc' ? -1 : 1;
            const c = compareKeys(a[i], b[i]);
            if (c) return c * dir;
        }
        return 0;
    };
    const rowKeys = [...rowKeySet.values()].sort(order(rowFields));
    const colKeys = [...colKeySet.values()].sort(order(colFields));
    const value = (rk, ck, i) => { const b = buckets.get(JSON.stringify([rk, ck])); return b ? PIVOT_FUNCTIONS[values[i].fn](b[i]) : null; };
    const valueName = (v) => v.as || v.fn + ' of ' + v.field;

    // the columns of the table: each column group (and, with totals, the grand total), times each value
    const colsOut = [];
    for (const ck of colKeys) values.forEach((v, i) => colsOut.push({ ck, i }));
    if (totals && colFields.length) values.forEach((v, i) => colsOut.push({ ck: [], i, total: true }));

    // the header: one row per column field (with its group names), and one row of value names when there is more than one value or no column field
    const header = [];
    const lead = Math.max(1, rowFields.length);
    for (let level = 0; level < colFields.length; level++) {
        const row = new Array(lead).fill('');
        row[lead - 1] = colFields[level];
        for (const col of colsOut) row.push(col.total ? (level === 0 ? 'Grand total' : '') : labelOf(col.ck[level]));
        header.push(row);
    }
    if (values.length > 1 || !colFields.length) {
        const row = rowFields.length ? rowFields.slice() : [''];
        for (const col of colsOut) row.push(valueName(values[col.i]));
        header.push(row);
    } else if (header.length) {
        // one value and column fields: the row fields name their columns on the last header row
        rowFields.forEach((f, i) => { header[header.length - 1][i] = f; });
    }

    // the body: each row group, with a subtotal under each outer group when there are several row fields, and a grand total at the end
    const body = [];
    const line = (labels, rk, kind) => {
        const row = labels.slice();
        while (row.length < lead) row.push('');
        for (const col of colsOut) row.push(value(rk, col.ck, col.i));
        body.push({ cells: row, kind, key: rk });
    };
    let prev = null;
    rowKeys.forEach((rk, n) => {
        // the labels of a row: an outer group's name only where it starts (as Google Sheets shows it)
        const labels = rk.map((k, i) => (prev && i < rk.length - 1 && prev.slice(0, i + 1).every((x, j) => x === rk[j]) ? '' : labelOf(k)));
        if (!rowFields.length) labels.push('');
        line(labels, rk, 'row');
        prev = rk;
        const next = rowKeys[n + 1];
        if (totals && rowFields.length > 1) {
            // a subtotal under each outer group that ends here, deepest first
            for (let depth = rk.length - 1; depth >= 1; depth--) {
                const outer = rk.slice(0, depth);
                if (next && next.slice(0, depth).every((x, j) => x === outer[j])) continue;
                const labelsT = new Array(lead).fill('');
                labelsT[depth - 1] = labelOf(outer[depth - 1]) + ' total';
                line(labelsT, outer, 'subtotal');
            }
        }
    });
    if (totals && rowFields.length) { const labels = ['Grand total']; line(labels, [], 'total'); }

    return {
        cells: header.concat(body.map((b) => b.cells)),
        header: header.length,
        rows: body,
        rowKeys, colKeys, rowFields, colFields, values,
        value
    };
}
