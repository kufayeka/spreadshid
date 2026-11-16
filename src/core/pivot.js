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
//       sort: { Produk: { by: 'Omzet', dir: 'desc' } },    or by a value: the groups with the biggest Omzet first (by: a value's `as`, or its field)
//       group: { Tanggal: 'month' },                       dates put together: 'year', 'quarter', 'month' (2026-10), 'week' (2026-W43, ISO)
//       totals: true                                       a row and a column of grand totals (and subtotals under each outer group)
//   })
//   -> { cells: [[...]], header: n, rows: [...], ... }    cells is the table as it is written in a sheet

import { rangeOf } from './addressing.js';
import { serialToDate } from './format.js';

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
    // a cell this person may not see (hidden or invisible by the rules) is read as empty: a summary does not tell what the cells do not
    const unseen = (r, c) => { const m = wb.modeAt ? wb.modeAt(s, r, c) : null; return !!m && (m.mode === 'hidden' || m.mode === 'invisible'); };
    const read = (r) => { const row = []; for (let c = rect.c1; c <= rect.c2; c++) row.push(unseen(r, c) ? null : wb.value(s, r, c)); return row; };
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

// The calendar day of a value, as { y, m (0-11), day }, or null when it is not a date. A date comes in three shapes:
//   - a day number, as a date cell of a sheet holds it;
//   - a Date object, as a database driver gives a date column (pg gives a DATE as midnight in the server's own time zone, so its local day is
//     the day that was stored; reading it in UTC would move it a day back east of Greenwich);
//   - a text in ISO form, "2026-09-03" or "2026-09-03T10:15:00Z", as dates arrive in JSON from an API: its first ten characters are the day.
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T ])/;
function calendarDayOf(v) {
    if (isNum(v)) { const d = serialToDate(Math.floor(v)); return { y: d.getUTCFullYear(), m: d.getUTCMonth(), day: d.getUTCDate() }; }
    if (v instanceof Date && !isNaN(v.getTime())) return { y: v.getFullYear(), m: v.getMonth(), day: v.getDate() };
    if (typeof v === 'string') {
        const iso = ISO_DAY.exec(v.trim());
        if (iso) return { y: Number(iso[1]), m: Number(iso[2]) - 1, day: Number(iso[3]) };
    }
    return null;
}

// a date (see calendarDayOf) as the group it falls in: 2026, "2026-Q4", "2026-10", "2026-W44" (ISO weeks start on Monday), "2026-11-03" (a day),
// or 1 to 7 (the day of the week, 1 Monday as ISO counts, shown by its name: see weekdayName). The keys sort in time order. What is not a date is
// grouped as it is.
const pad2 = (n) => String(n).padStart(2, '0');
export const PIVOT_DATE_GROUPS = ['year', 'quarter', 'month', 'week', 'day', 'weekday'];
function dateGroup(v, unit) {
    const calendar = calendarDayOf(v);
    if (!calendar) return keyOf(v);
    const { y, m } = calendar;
    if (unit === 'day') return y + '-' + pad2(m + 1) + '-' + pad2(calendar.day);
    if (unit === 'weekday') return new Date(Date.UTC(y, m, calendar.day)).getUTCDay() || 7;
    if (unit === 'year') return y;
    if (unit === 'quarter') return y + '-Q' + (Math.floor(m / 3) + 1);
    if (unit === 'month') return y + '-' + pad2(m + 1);
    if (unit === 'week') {
        // ISO 8601: the week that holds the year's first Thursday is week 1
        const t = new Date(Date.UTC(y, m, calendar.day));
        const day = t.getUTCDay() || 7;
        t.setUTCDate(t.getUTCDate() + 4 - day);
        const first = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
        return t.getUTCFullYear() + '-W' + pad2(Math.ceil(((t - first) / 86400000 + 1) / 7));
    }
    throw new Error('a pivot groups dates by ' + PIVOT_DATE_GROUPS.join(', ') + ', not by ' + unit);
}

// The name of a day of the week (1 Monday ... 7 Sunday) in a language: "Senin" in id-ID, "Monday" in en-US. 2024-01-01 was a Monday.
function weekdayName(n, locale) {
    try { return new Intl.DateTimeFormat(locale || 'en-US', { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, n))); }
    catch { return String(n); }
}

// ---- filters ----------------------------------------------------------------------------------------------------------------------------------------
//
// A field's filter, as Excel has them:
//   { hidden: ['Draft'] }                                         the values left out (the boxes unticked)
//   { label: { op: 'contains', value: 'kopi' } }                  a condition on the field's value (Label Filters, and Date Filters on a date)
//   { value: { by: 'Omzet', op: '>', value: 1000000 } }           a condition on a group's total of a value (Value Filters)
//   { top: { n: 10, by: 'Omzet', bottom: false } }                the n biggest (or smallest) groups by a value (Top 10)
// hidden and label leave records out before anything is summed up; value and top leave out whole groups of a row or column field after, and the
// totals are then worked out without them (as Excel does).

export const PIVOT_LABEL_OPS = ['equals', 'notEquals', 'beginsWith', 'notBeginsWith', 'endsWith', 'notEndsWith', 'contains', 'notContains',
    'greaterThan', 'greaterOrEqual', 'lessThan', 'lessOrEqual', 'between', 'notBetween'];
export const PIVOT_VALUE_OPS = ['=', '<>', '>', '>=', '<', '<=', 'between', 'notBetween'];

// A value of a condition made comparable with a key: a date written as text ("2026-09-01") becomes the day number a date cell holds, when the key
// is a day number; anything else stays as it is.
function comparable(v, key) {
    if (isNum(key) && typeof v === 'string') { const day = calendarDayOf(v); if (day) return Date.UTC(day.y, day.m, day.day) / 86400000 + 25569; }
    return v;
}
// -1, 0 or 1: numbers by size, texts without regard to case (and numbers within texts by size, so "2026-W9" comes before "2026-W10")
function compareLoose(a, b) {
    if (isNum(a) && isNum(b)) return a < b ? -1 : a > b ? 1 : 0;
    return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

/** True when a key meets a label condition ({ op, value, to }). */
function meetsLabel(key, cond) {
    const v = comparable(cond.value, key), to = comparable(cond.to, key);
    const text = String(key).toLowerCase(), want = String(cond.value ?? '').toLowerCase();
    switch (cond.op) {
        case 'equals': return compareLoose(key, v) === 0;
        case 'notEquals': return compareLoose(key, v) !== 0;
        case 'beginsWith': return text.startsWith(want);
        case 'notBeginsWith': return !text.startsWith(want);
        case 'endsWith': return text.endsWith(want);
        case 'notEndsWith': return !text.endsWith(want);
        case 'contains': return text.includes(want);
        case 'notContains': return !text.includes(want);
        case 'greaterThan': return compareLoose(key, v) > 0;
        case 'greaterOrEqual': return compareLoose(key, v) >= 0;
        case 'lessThan': return compareLoose(key, v) < 0;
        case 'lessOrEqual': return compareLoose(key, v) <= 0;
        case 'between': return compareLoose(key, v) >= 0 && compareLoose(key, to) <= 0;
        case 'notBetween': return compareLoose(key, v) < 0 || compareLoose(key, to) > 0;
        default: throw new Error('a pivot label filter has no condition "' + cond.op + '" (it has ' + PIVOT_LABEL_OPS.join(', ') + ')');
    }
}

/** True when a number meets a value condition ({ op, value, to }). A group with no number (blank) never does. */
function meetsValue(n, cond) {
    if (!isNum(n)) return false;
    const v = Number(cond.value), to = Number(cond.to);
    switch (cond.op) {
        case '=': return n === v;
        case '<>': return n !== v;
        case '>': return n > v;
        case '>=': return n >= v;
        case '<': return n < v;
        case '<=': return n <= v;
        case 'between': return n >= Math.min(v, to) && n <= Math.max(v, to);
        case 'notBetween': return n < Math.min(v, to) || n > Math.max(v, to);
        default: throw new Error('a pivot value filter has no condition "' + cond.op + '" (it has ' + PIVOT_VALUE_OPS.join(', ') + ')');
    }
}

/** True when a record passes the record filters of every field (hidden values, label conditions); keyFor gives a field's group key. */
function passes(rec, filters, keyFor) {
    for (const [field, f] of Object.entries(filters || {})) {
        if (!f) continue;
        if (f.hidden && f.hidden.length) {
            const k = keyOf(rec[field]);
            if (f.hidden.some((h) => keyOf(h) === k || String(keyOf(h)).toLowerCase() === String(k).toLowerCase())) return false;
        }
        if (f.label && f.label.op && !meetsLabel(keyFor(rec, field), f.label)) return false;
    }
    return true;
}

// ---- calculated fields -----------------------------------------------------------------------------------------------------------------------------
//
// A calculated field is a formula over other fields, as Excel's: { name: 'Margin %', formula: 'Margin / Omzet' }. Each field in it stands for the SUM
// of that field over the records of a cell of the table, and the formula is worked out from those sums; so "Margin / Omzet" is the margin of each
// group as a share of its turnover, right in every subtotal and total too. A field whose name has spaces or signs is written in brackets
// ([Harga beli]) or quotes ('Harga beli'). Numbers, + - * /, and brackets ( ) are what a formula has; a division by zero gives a blank.

/** A calculated field's formula as a tree, and the fields it reads. Throws with a plain reason when it cannot be read. */
export function parseCalculated(formula) {
    const text = String(formula || '').trim().replace(/^=/, '');
    let at = 0;
    const fields = new Set();
    const fail = (why) => { throw new Error('the calculated field "' + formula + '" cannot be read: ' + why); };
    const space = () => { while (at < text.length && /\s/.test(text[at])) at++; };
    const primary = () => {
        space();
        const ch = text[at];
        if (ch === undefined) fail('it ends too early');
        if (ch === '(') { at++; const e = sum(); space(); if (text[at] !== ')') fail('a bracket ( is not closed'); at++; return e; }
        if (ch === '-') { at++; return { neg: primary() }; }
        if (ch === '+') { at++; return primary(); }
        const num = /^\d+(?:\.\d+)?/.exec(text.slice(at));
        if (num) { at += num[0].length; return { num: Number(num[0]) }; }
        if (ch === '[' || ch === "'") {
            const close = ch === '[' ? ']' : "'";
            const end = text.indexOf(close, at + 1);
            if (end < 0) fail('a field name ' + ch + ' is not closed');
            const name = text.slice(at + 1, end).trim();
            at = end + 1;
            fields.add(name);
            return { field: name };
        }
        const word = /^[\p{L}_][\p{L}\p{N}_.]*/u.exec(text.slice(at));
        if (word) { at += word[0].length; fields.add(word[0]); return { field: word[0] }; }
        fail('"' + ch + '" is not a number, a field or a sign it knows');
    };
    const product = () => {
        let left = primary();
        for (;;) { space(); const op = text[at]; if (op !== '*' && op !== '/') return left; at++; left = { op, left, right: primary() }; }
    };
    const sum = () => {
        let left = product();
        for (;;) { space(); const op = text[at]; if (op !== '+' && op !== '-') return left; at++; left = { op, left, right: product() }; }
    };
    const tree = sum();
    space();
    if (at < text.length) fail('"' + text.slice(at) + '" is left over');
    return { tree, fields: [...fields] };
}

// a calculated field's tree worked out, with sumOf(field) the sum of that field; a division by zero (or anything not a number) gives null
function evaluate(node, sumOf) {
    if ('num' in node) return node.num;
    if ('field' in node) return sumOf(node.field);
    if ('neg' in node) { const v = evaluate(node.neg, sumOf); return isNum(v) ? -v : null; }
    const a = evaluate(node.left, sumOf), b = evaluate(node.right, sumOf);
    if (!isNum(a) || !isNum(b)) return null;
    if (node.op === '+') return round(a + b);
    if (node.op === '-') return round(a - b);
    if (node.op === '*') return round(a * b);
    return b === 0 ? null : round(a / b);
}

// ---- show values as --------------------------------------------------------------------------------------------------------------------------------
//
// A value can be shown as Excel's "Show Values As" shows it: { field: 'Omzet', show: 'percentOfTotal' }. Those that walk along a field (running
// totals, differences, ranks) take it as `base` (the last row field when not said, or the first column field when there are no row fields).
export const PIVOT_SHOW = ['percentOfTotal', 'percentOfRow', 'percentOfColumn', 'runningTotal', 'percentRunningTotal', 'difference', 'percentDifference', 'rank'];
const PERCENT_SHOWS = new Set(['percentOfTotal', 'percentOfRow', 'percentOfColumn', 'percentRunningTotal', 'percentDifference']);
/** True when a value shown this way is a share (0.25 is 25%), to be written with a percent format. */
export const isPercentShow = (show) => PERCENT_SHOWS.has(show);

/**
 * Records summed up by groups. Returns the table as cells (what a pivot table shows, ready to be written in a sheet) and as data:
 *   { cells, header, rows, rowKeys, colKeys, columns, value(rowKey, colKey, i), shown(rowKey, colKey, i) }
 * The first `header` rows of cells are the header (the names of the value fields, and the column groups); the first rows.length columns of each row
 * under it are the row groups. `columns` tells, for each column after those, which value it holds (its index in spec.values), so a writer can give
 * a share its percent format. value() is the summed-up number; shown() is what the table shows (the same, unless the value has a `show`).
 * @param {object[]} records
 * @param {object} spec  rows, columns, values ({ field, fn, as, show, base }), calculated ({ name, formula }), filters, sort, group, totals
 * @param {{ locale?: string }} [options]  locale: the language of the names of the days of the week (group 'weekday')
 */
export function pivot(records, spec, options) {
    const locale = (options && options.locale) || 'en-US';
    const rowFields = spec.rows || [], colFields = spec.columns || [];
    const calculated = new Map();
    for (const c of spec.calculated || []) {
        if (!c || !c.name) throw new Error('a calculated field of a pivot needs a name');
        calculated.set(String(c.name), parseCalculated(c.formula));
    }
    const values = (spec.values || []).map((v) => ({
        field: v.field, as: v.as, show: v.show || null, base: v.base || null,
        calc: calculated.get(v.field) || null,
        // a calculated field is worked out from sums, whatever function is asked: Excel's calculated fields are SUMs too
        fn: calculated.has(v.field) ? 'SUM' : String(v.fn || 'SUM').toUpperCase()
    }));
    if (!values.length) throw new Error('a pivot needs at least one value to sum up');
    for (const v of values) {
        if (!PIVOT_FUNCTIONS[v.fn]) throw new Error('a pivot has no function ' + v.fn + ' (it has ' + Object.keys(PIVOT_FUNCTIONS).join(', ') + ')');
        if (v.show && !PIVOT_SHOW.includes(v.show)) throw new Error('a pivot shows a value as ' + PIVOT_SHOW.join(', ') + ', not as ' + v.show);
    }
    for (const [f, unit] of Object.entries(spec.group || {})) {
        if (unit && !PIVOT_DATE_GROUPS.includes(unit)) throw new Error('a pivot groups dates by ' + PIVOT_DATE_GROUPS.join(', ') + ', not by ' + unit + ' (' + f + ')');
    }
    const totals = spec.totals !== false;
    const filters = spec.filters || {};

    // the key a record has in a field: its date group when the field is grouped, else its value
    const keyFor = (rec, f) => (spec.group && spec.group[f] ? dateGroup(rec[f], spec.group[f]) : keyOf(rec[f]));
    // the label a key is shown with: a day of the week by its name, an empty value as (blank)
    const labelFor = (f, k) => (spec.group && spec.group[f] === 'weekday' && isNum(k) ? weekdayName(k, locale) : labelOf(k));

    // a value of one cell of the table, from what was put in its bucket: a calculated field from the sums of its fields, the rest by their function
    const sumUp = (v, list) => {
        if (!v.calc) return PIVOT_FUNCTIONS[v.fn](list);
        return evaluate(v.calc.tree, (field) => PIVOT_FUNCTIONS.SUM(list.map((rec) => rec[field])));
    };

    // The groups, and what each cell of the table holds (a cell: a group of rows and a group of columns, each a list of keys; [] is "all").
    // Every level of the groups gets each record: the subtotals and the totals are worked out from the records, not from other sums (an average of
    // averages would be wrong). A calculated field keeps the whole record, as it sums several fields.
    function summarise(list) {
        const buckets = new Map(), rowKeySet = new Map(), colKeySet = new Map();
        for (const rec of list) {
            const rk = rowFields.map((f) => keyFor(rec, f)), ck = colFields.map((f) => keyFor(rec, f));
            rowKeySet.set(JSON.stringify(rk), rk);
            colKeySet.set(JSON.stringify(ck), ck);
            for (let i = 0; i <= rk.length; i++) {
                for (let j = 0; j <= ck.length; j++) {
                    const id = JSON.stringify([rk.slice(0, i), ck.slice(0, j)]);
                    if (!buckets.has(id)) buckets.set(id, values.map(() => []));
                    const b = buckets.get(id);
                    values.forEach((v, n) => b[n].push(v.calc ? rec : rec[v.field]));
                }
            }
        }
        return { buckets, rowKeySet, colKeySet };
    }
    const valueIndex = (by, use = 'sorts') => {
        const i = values.findIndex((v) => v.as === by || v.field === by || v.fn + ' of ' + v.field === by);
        if (i < 0) throw new Error('a pivot ' + use + ' by a value it has: "' + by + '" is not one of ' + values.map((v) => v.as || v.field).join(', '));
        return i;
    };

    // 1. the records the record filters let through
    let kept = records.filter((rec) => passes(rec, filters, keyFor));
    let sums = summarise(kept);
    const totalIn = (s, rk, ck, i) => { const b = s.buckets.get(JSON.stringify([rk, ck])); return sumUp(values[i], b ? b[i] : []); };

    // 2. the group filters (value conditions, top n) of the row and column fields, outer fields first: the groups that fail are taken out with their
    //    records, and what is left is summed up again, so the next filter and the totals see only what stays
    const grouped = [...rowFields.map((f, at) => ({ f, at, rows: true })), ...colFields.map((f, at) => ({ f, at, rows: false }))];
    for (const { f, at, rows } of grouped) {
        const flt = filters[f];
        if (!flt || (!flt.value && !flt.top)) continue;
        const keysAt = new Map();
        for (const k of (rows ? sums.rowKeySet : sums.colKeySet).values()) { const p = k.slice(0, at + 1); keysAt.set(JSON.stringify(p), p); }
        const totalOfGroup = (p, i) => (rows ? totalIn(sums, p, [], i) : totalIn(sums, [], p, i));
        const dropped = new Set();
        if (flt.value && flt.value.op) {
            const i = valueIndex(flt.value.by, 'filters');
            for (const [id, p] of keysAt) if (!meetsValue(totalOfGroup(p, i), flt.value)) dropped.add(id);
        }
        if (flt.top && flt.top.n !== undefined) {
            const i = valueIndex(flt.top.by, 'filters'), n = Math.max(0, Math.floor(Number(flt.top.n)));
            // the n biggest (or smallest) within each outer group, as Excel's Top 10 on an inner field does
            const byParent = new Map();
            for (const [id, p] of keysAt) {
                if (dropped.has(id)) continue;
                const parent = JSON.stringify(p.slice(0, at));
                if (!byParent.has(parent)) byParent.set(parent, []);
                byParent.get(parent).push({ id, total: totalOfGroup(p, i) });
            }
            for (const list of byParent.values()) {
                list.sort((a, b) => (isNum(b.total) ? b.total : -Infinity) - (isNum(a.total) ? a.total : -Infinity));
                if (flt.top.bottom) list.reverse();
                list.slice(n).forEach((x) => dropped.add(x.id));
            }
        }
        if (!dropped.size) continue;
        kept = kept.filter((rec) => {
            const p = (rows ? rowFields : colFields).slice(0, at + 1).map((x) => keyFor(rec, x));
            return !dropped.has(JSON.stringify(p));
        });
        sums = summarise(kept);
    }
    const { buckets, rowKeySet, colKeySet } = sums;

    // a group's total of one value (all the columns together), for groups sorted by a value
    const totalOf = (rk, ck, i) => totalIn(sums, rk, ck, i);
    const order = (fields, rows) => (a, b) => {
        for (let i = 0; i < fields.length; i++) {
            const how = spec.sort && spec.sort[fields[i]];
            const dir = (how && typeof how === 'object' ? how.dir : how) === 'desc' ? -1 : 1;
            let c;
            if (how && typeof how === 'object' && how.by) {
                // by a value: the totals of the two groups at this level (the same outer groups, as the earlier fields are equal here)
                const at = valueIndex(how.by);
                const ka = a.slice(0, i + 1), kb = b.slice(0, i + 1);
                const va = rows ? totalOf(ka, [], at) : totalOf([], ka, at), vb = rows ? totalOf(kb, [], at) : totalOf([], kb, at);
                c = (isNum(va) && isNum(vb) ? va - vb : compareKeys(va, vb)) * dir;
                // two groups with the same total stand by their names, A to Z
                if (!c) c = compareKeys(a[i], b[i]);
            } else c = compareKeys(a[i], b[i]) * dir;
            if (c) return c;
        }
        return 0;
    };
    const rowKeys = [...rowKeySet.values()].sort(order(rowFields, true));
    // no column fields: one column group, there even when no record is left (the table still has its value columns)
    const colKeys = colFields.length ? [...colKeySet.values()].sort(order(colFields, false)) : [[]];
    // a row group and a column group that have no record together are blank (as in Excel); a total with no record is what its function makes
    // of nothing (0 for SUM and COUNT), as the grand total of a table whose records are all filtered out
    const value = (rk, ck, i) => { const b = buckets.get(JSON.stringify([rk, ck])); if (!b && rk.length && ck.length) return null; return sumUp(values[i], b ? b[i] : []); };
    const valueName = (v) => v.as || (v.calc ? v.field : v.fn + ' of ' + v.field);

    // ---- show values as: what a cell shows, from the summed-up values around it ----
    // the field a running total, a difference or a rank walks along, and the order of its keys (as the table shows them)
    const baseOf = (v) => {
        const f = v.base || (rowFields.length ? rowFields[rowFields.length - 1] : colFields[0]);
        if (!f) return null;
        const inRows = rowFields.indexOf(f), inCols = colFields.indexOf(f);
        if (inRows < 0 && inCols < 0) throw new Error('a pivot walks along a field of its rows or columns: "' + f + '" is neither');
        const rows = inRows >= 0, at = rows ? inRows : inCols;
        const seen = new Map();
        for (const k of rows ? rowKeys : colKeys) if (k.length > at) seen.set(JSON.stringify(k[at]), k[at]);
        return { rows, at, keys: [...seen.values()] };
    };
    const bases = values.map((v) => (v.show && !v.show.startsWith('percentOf') ? baseOf(v) : null));
    const share = (a, b) => (isNum(a) && isNum(b) && b !== 0 ? round(a / b) : null);
    const shown = (rk, ck, i) => {
        const v = values[i], raw = value(rk, ck, i);
        if (!v.show) return raw;
        if (v.show === 'percentOfTotal') return share(raw, value([], [], i));
        if (v.show === 'percentOfRow') return share(raw, value(rk, [], i));
        if (v.show === 'percentOfColumn') return share(raw, value([], ck, i));
        const base = bases[i];
        if (!base) return raw;
        const own = base.rows ? rk : ck;
        // a row (or column) above the base field's level (a subtotal of an outer field, the grand total) has nothing to walk along: blank
        if (own.length <= base.at) return null;
        const at = base.keys.findIndex((k) => compareKeys(k, own[base.at]) === 0);
        // the same cell with another key of the base field, the other keys as they are
        const other = (key) => { const k = own.slice(); k[base.at] = key; return base.rows ? value(k, ck, i) : value(rk, k, i); };
        if (v.show === 'runningTotal' || v.show === 'percentRunningTotal') {
            let run = 0;
            for (let n = 0; n <= at; n++) { const x = other(base.keys[n]); if (isNum(x)) run += x; }
            run = round(run);
            if (v.show === 'runningTotal') return run;
            let all = 0;
            for (const key of base.keys) { const x = other(key); if (isNum(x)) all += x; }
            return share(run, all);
        }
        if (v.show === 'difference' || v.show === 'percentDifference') {
            // the change from the key before along the base field; the first key has nothing before it
            if (at <= 0 || !isNum(raw)) return null;
            const before = other(base.keys[at - 1]);
            if (!isNum(before)) return null;
            return v.show === 'difference' ? round(raw - before) : share(raw - before, before);
        }
        if (v.show === 'rank') {
            // 1 for the biggest among the keys of the base field (the other keys as they are); equal values share a rank, as RANK does
            if (!isNum(raw)) return null;
            let bigger = 0;
            for (const key of base.keys) { const x = other(key); if (isNum(x) && x > raw) bigger++; }
            return bigger + 1;
        }
        return raw;
    };

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
        for (const col of colsOut) row.push(col.total ? (level === 0 ? 'Grand total' : '') : labelFor(colFields[level], col.ck[level]));
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
        for (const col of colsOut) row.push(shown(rk, col.ck, col.i));
        body.push({ cells: row, kind, key: rk });
    };
    let prev = null;
    rowKeys.forEach((rk, n) => {
        // the labels of a row: an outer group's name only where it starts (as Excel shows it in its tabular form)
        const labels = rk.map((k, i) => (prev && i < rk.length - 1 && prev.slice(0, i + 1).every((x, j) => x === rk[j]) ? '' : labelFor(rowFields[i], k)));
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
                labelsT[depth - 1] = labelFor(rowFields[depth - 1], outer[depth - 1]) + ' total';
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
        columns: colsOut.map((c) => c.i),
        value, shown
    };
}
