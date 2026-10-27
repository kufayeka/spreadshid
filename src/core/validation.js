// Data validation, as in Google Sheets (Data > Data validation): a rule on a range of cells that a person makes in the sheet, saved with it. A rule
// gives the cells a dropdown (a list of values, or the values of another range), a checkbox, or a check of what is typed (a number between, a date
// after ...). What breaks the rule is refused, or only marked, as the rule says. Pure (no DOM).
//
// A rule, kept in the sheet's props (`validations`), by the ids of the corners of its range so it follows inserted rows:
//   { id, r1, c1, r2, c2,                         the range (row and column ids)
//     kind: 'list' | 'listFrom' | 'checkbox' | 'number' | 'date' | 'textLength' | 'text',
//     values: ['Draft', 'Approved'],              list: the choices
//     source: 'Rates!A2:A20',                     listFrom: the cells whose values are the choices
//     op: 'between' | 'notBetween' | 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'notContains' | 'email' | 'url',
//     a, b,                                       the bounds of op
//     reject: true,                               true: what breaks it is refused; false: it is kept and marked
//     help: 'Pick a status' }                     shown when a cell of the range is selected

import { newId } from './ids.js';
import { colIndex } from './formula/address.js';

const parseRange = (text) => {
    const m = /^\s*(?:(?:'([^']+)'|([^!]+))!)?\$?([A-Za-z]{1,3})\$?(\d+)\s*(?::\s*\$?([A-Za-z]{1,3})\$?(\d+))?\s*$/.exec(text || '');
    if (!m) return null;
    const c1 = colIndex(m[3]), r1 = Number(m[4]) - 1;
    const c2 = m[5] ? colIndex(m[5]) : c1, r2 = m[6] ? Number(m[6]) - 1 : r1;
    return { sheet: m[1] || m[2] || null, r1: Math.min(r1, r2), c1: Math.min(c1, c2), r2: Math.max(r1, r2), c2: Math.max(c1, c2) };
};
export { parseRange as parseRangeText };

/** The rule kept for a range of a sheet: by the ids of its corners. */
export function makeRule(wb, s, rect, spec) {
    return { ...spec, id: spec.id || newId(), r1: wb.rowId(s, rect.r1), c1: wb.colId(s, rect.c1), r2: wb.rowId(s, rect.r2), c2: wb.colId(s, rect.c2) };
}

/** Where a kept rule stands now, by position, or null when a corner of it was deleted. */
export function ruleRect(wb, s, rule) {
    const r1 = wb.rowIndex(s, rule.r1), r2 = wb.rowIndex(s, rule.r2), c1 = wb.colIndex(s, rule.c1), c2 = wb.colIndex(s, rule.c2);
    if (r1 < 0 || r2 < 0 || c1 < 0 || c2 < 0) return null;
    return { r1: Math.min(r1, r2), c1: Math.min(c1, c2), r2: Math.max(r1, r2), c2: Math.max(c1, c2) };
}

/** The rule of a cell (the last one made wins, as in Google Sheets), or null. */
export function ruleAt(wb, s, r, c) {
    const list = wb.sheetProps(s).validations || [];
    for (let i = list.length - 1; i >= 0; i--) {
        const at = ruleRect(wb, s, list[i]);
        if (at && r >= at.r1 && r <= at.r2 && c >= at.c1 && c <= at.c2) return list[i];
    }
    return null;
}

/** The choices of a dropdown: its own list, or the values of the range it takes them from (empty ones left out, each once). */
export function choicesOf(wb, s, rule) {
    if (rule.kind === 'list') return (rule.values || []).map(String);
    if (rule.kind !== 'listFrom') return [];
    const src = parseRange(rule.source);
    if (!src) return [];
    const sheet = src.sheet ? wb.sheetIdByName(src.sheet) : s;
    if (!sheet) return [];
    const out = [];
    const seen = new Set();
    for (let r = src.r1; r <= src.r2; r++) for (let c = src.c1; c <= src.c2; c++) {
        const v = wb.value(sheet, r, c);
        if (v === null || v === undefined || v === '') continue;
        const t = String(v);
        if (!seen.has(t)) { seen.add(t); out.push(t); }
    }
    return out;
}

const num = (x) => (typeof x === 'number' ? x : Number(x));

/**
 * Whether a value keeps a rule: null when it does (an empty cell always does), else what the rule wants, in words.
 * @returns {string|null}
 */
export function breaks(wb, s, rule, value) {
    if (value === null || value === undefined || value === '') return null;
    switch (rule.kind) {
        case 'list': case 'listFrom': {
            const choices = choicesOf(wb, s, rule);
            return choices.includes(String(value)) ? null : 'one of: ' + choices.join(', ');
        }
        case 'checkbox': return typeof value === 'boolean' ? null : 'TRUE or FALSE (a checkbox)';
        case 'number': case 'date': {
            if (typeof value !== 'number') return rule.kind === 'date' ? 'a date' : 'a number';
            return compare(value, rule) ? null : describe(rule);
        }
        case 'textLength': return compare(String(value).length, rule) ? null : 'a text whose length is ' + describe(rule);
        case 'text': {
            const t = String(value), a = String(rule.a || '');
            if (rule.op === 'contains') return t.toLowerCase().includes(a.toLowerCase()) ? null : 'a text that contains "' + a + '"';
            if (rule.op === 'notContains') return !t.toLowerCase().includes(a.toLowerCase()) ? null : 'a text without "' + a + '"';
            if (rule.op === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) ? null : 'an email address';
            if (rule.op === 'url') return /^https?:\/\/\S+$/i.test(t) ? null : 'a web address';
            return null;
        }
        default: return null;
    }
}

function compare(v, rule) {
    const a = num(rule.a), b = num(rule.b);
    switch (rule.op) {
        case 'between': return v >= Math.min(a, b) && v <= Math.max(a, b);
        case 'notBetween': return v < Math.min(a, b) || v > Math.max(a, b);
        case 'eq': return v === a;
        case 'ne': return v !== a;
        case 'gt': return v > a;
        case 'gte': return v >= a;
        case 'lt': return v < a;
        case 'lte': return v <= a;
        default: return true;
    }
}

const WORDS = { between: 'between', notBetween: 'not between', eq: 'equal to', ne: 'not equal to', gt: 'greater than', gte: 'at least', lt: 'less than', lte: 'at most' };
function describe(rule) {
    const w = WORDS[rule.op] || '';
    return rule.op === 'between' || rule.op === 'notBetween' ? w + ' ' + rule.a + ' and ' + rule.b : w + ' ' + rule.a;
}
