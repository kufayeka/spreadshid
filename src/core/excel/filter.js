// The filter of a sheet to Excel and back (Excel calls it an autoFilter). By values: the values that show (Excel lists those, the sheet the hidden ones).
// By condition: Excel's custom filters (greater than, between, a text with * around it ...); a date or a formula condition has no custom filter, so it is
// left out of the file (its rows are still hidden there, as Excel keeps the rows a filter hid as hidden rows).

import { colName } from '../formula/address.js';

const TO_EXCEL = { gt: 'greaterThan', gte: 'greaterThanOrEqual', lt: 'lessThan', lte: 'lessThanOrEqual', eq: 'equal', ne: 'notEqual' };
const FROM_EXCEL = Object.fromEntries(Object.entries(TO_EXCEL).map(([k, v]) => [v, k]));
const star = (text) => String(text).replace(/[*?~]/g, (ch) => '~' + ch);

function customOf(crit) {
    const a = crit.a, b = crit.b;
    switch (crit.op) {
        case 'between': return { and: true, list: [{ operator: 'greaterThanOrEqual', val: a }, { operator: 'lessThanOrEqual', val: b }] };
        case 'notBetween': return { and: false, list: [{ operator: 'lessThan', val: a }, { operator: 'greaterThan', val: b }] };
        case 'textContains': return { list: [{ operator: 'equal', val: '*' + star(a) + '*' }] };
        case 'textNotContains': return { list: [{ operator: 'notEqual', val: '*' + star(a) + '*' }] };
        case 'textStarts': return { list: [{ operator: 'equal', val: star(a) + '*' }] };
        case 'textEnds': return { list: [{ operator: 'equal', val: '*' + star(a) }] };
        case 'textIs': return { list: [{ operator: 'equal', val: a }] };
        case 'empty': return { list: [{ operator: 'equal', val: '' }] };
        case 'notEmpty': return { list: [{ operator: 'notEqual', val: ' ' }] };
        default: return TO_EXCEL[crit.op] ? { list: [{ operator: TO_EXCEL[crit.op], val: a }] } : null;
    }
}

/** The filter of a sheet as Excel keeps it: { ref, columns: [{ colId, values, blank, custom }] }, or null. */
export function toExcelFilter(wb, s) {
    const filter = wb.filterOf(s);
    if (!filter) return null;
    const f = filter.range;
    const columns = [];
    for (const [key, crit] of Object.entries(filter.columns)) {
        const c = Number(key);
        if (crit.op) { const custom = customOf(crit); if (custom) { columns.push({ colId: c - f.c1, custom }); continue; } }
        if (crit.hidden && crit.hidden.length) {
            const hidden = new Set(crit.hidden), shown = new Set();
            for (let r = f.r1 + 1; r <= f.r2; r++) { const t = wb.display(s, r, c).text; if (!hidden.has(t)) shown.add(t); }
            columns.push({ colId: c - f.c1, values: [...shown].filter((t) => t !== ''), blank: shown.has('') });
        }
    }
    return { ref: colName(f.c1) + (f.r1 + 1) + ':' + colName(f.c2) + (f.r2 + 1), columns };
}

/** A filter read from a file (its <autoFilter>, parsed): { rect, columns: [{ colId, values, blank, custom: { and, list } }] }. */
export function readExcelFilter(node, kid, kids, addressOf) {
    if (!node || !node.attrs.ref) return null;
    const [a, b] = String(node.attrs.ref).split(':').map(addressOf);
    const z = b || a;
    if (!a || !z) return null;
    const columns = kids(node, 'filterColumn').map((fc) => {
        const filters = kid(fc, 'filters'), custom = kid(fc, 'customFilters');
        return {
            colId: Number(fc.attrs.colId) || 0,
            values: filters ? kids(filters, 'filter').map((x) => String(x.attrs.val)) : null,
            blank: !!filters && (filters.attrs.blank === '1' || filters.attrs.blank === 'true'),
            custom: custom ? { and: custom.attrs.and === '1' || custom.attrs.and === 'true', list: kids(custom, 'customFilter').map((x) => ({ operator: x.attrs.operator || 'equal', val: x.attrs.val === undefined ? '' : String(x.attrs.val) })) } : null,
            other: !filters && !custom
        };
    });
    return { rect: { r1: Math.min(a.r, z.r), c1: Math.min(a.c, z.c), r2: Math.max(a.r, z.r), c2: Math.max(a.c, z.c) }, columns };
}

// a custom filter of Excel made into a condition of the sheet, or null for one the sheet has not
function conditionOf(custom) {
    const num = (v) => (v !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
    const list = custom.list;
    if (list.length === 2) {
        const [x, y] = list;
        if (custom.and && x.operator === 'greaterThanOrEqual' && y.operator === 'lessThanOrEqual' && num(x.val) !== null && num(y.val) !== null) return { op: 'between', a: num(x.val), b: num(y.val) };
        if (!custom.and && x.operator === 'lessThan' && y.operator === 'greaterThan' && num(x.val) !== null && num(y.val) !== null) return { op: 'notBetween', a: num(x.val), b: num(y.val) };
        return null;
    }
    if (list.length !== 1) return null;
    const { operator, val } = list[0];
    const plain = (t) => t.replace(/~([*?~])/g, '$1');
    if (operator === 'notEqual' && val === ' ') return { op: 'notEmpty' };
    if (operator === 'equal' && val === '') return { op: 'empty' };
    const wild = /^\*(.*)\*$/.exec(val);
    if (wild && !/(^|[^~])[*?]/.test(wild[1])) return { op: operator === 'equal' ? 'textContains' : operator === 'notEqual' ? 'textNotContains' : null, a: plain(wild[1]) };
    if (operator === 'equal' && /[^~]\*$/.test(val) && !/[*?]/.test(val.slice(0, -1).replace(/~[*?~]/g, ''))) return { op: 'textStarts', a: plain(val.slice(0, -1)) };
    if (operator === 'equal' && /^\*/.test(val) && !/[*?]/.test(val.slice(1).replace(/~[*?~]/g, ''))) return { op: 'textEnds', a: plain(val.slice(1)) };
    if (FROM_EXCEL[operator] && num(val) !== null) return { op: FROM_EXCEL[operator], a: num(val) };
    if (operator === 'equal') return { op: 'textIs', a: plain(val) };
    return null;
}

/** Puts a filter read from a file on a sheet of a workbook (its values and formulas in): its rows are filtered as the sheet does it. */
export function applyExcelFilter(wb, s, read, warnings, sheetName) {
    const how = { source: 'remote' };
    wb.createFilter(s, read.rect, how);
    const f = read.rect;
    const left = [];
    for (const col of read.columns) {
        const c = f.c1 + col.colId;
        if (c > f.c2) continue;
        if (col.custom) {
            const cond = conditionOf(col.custom);
            if (cond && cond.op) wb.setFilterColumn(s, c, cond, how); else left.push(colName(c));
            continue;
        }
        if (col.values) {
            // the values that show, as Excel writes them: a cell shows when its text, or its value, is one of them (Excel and the sheet may write a number apart)
            const shown = new Set(col.values);
            const hidden = new Set();
            for (let r = f.r1 + 1; r <= f.r2; r++) {
                const text = wb.display(s, r, c).text, v = wb.value(s, r, c);
                const shows = text === '' ? col.blank : shown.has(text) || (v !== null && v !== undefined && shown.has(String(v)));
                if (!shows) hidden.add(text);
            }
            if (hidden.size) wb.setFilterColumn(s, c, { hidden: [...hidden] }, how);
            continue;
        }
        if (col.other) left.push(colName(c));
    }
    if (left.length) warnings.push('"' + sheetName + '": the filter of column ' + left.join(', ') + ' (top 10, colours, dates) was not imported; the column shows every value');
}
