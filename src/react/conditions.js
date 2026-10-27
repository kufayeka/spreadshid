import { parseInput } from '../core/input.js';
import { formatValue } from '../core/format.js';

// The conditions a person picks for conditional formatting and for a filter, in the words and order of Google Sheets (the two use the same list, as
// Google Sheets does), and how what is typed for them is read.

export const OPS = [
    ['empty', 'Is empty'], ['notEmpty', 'Is not empty'],
    ['textContains', 'Text contains'], ['textNotContains', 'Text does not contain'], ['textStarts', 'Text starts with'], ['textEnds', 'Text ends with'], ['textIs', 'Text is exactly'],
    ['dateIs', 'Date is'], ['dateBefore', 'Date is before'], ['dateAfter', 'Date is after'],
    ['gt', 'Greater than'], ['gte', 'Greater than or equal to'], ['lt', 'Less than'], ['lte', 'Less than or equal to'], ['eq', 'Is equal to'], ['ne', 'Is not equal to'],
    ['between', 'Is between'], ['notBetween', 'Is not between'], ['formula', 'Custom formula is']
];
export const DAYS = [['today', 'today'], ['yesterday', 'yesterday'], ['tomorrow', 'tomorrow'], ['pastWeek', 'in the past week'], ['pastMonth', 'in the past month'], ['pastYear', 'in the past year'], ['exact', 'exact date']];
export const NUMBER_OPS = new Set(['gt', 'gte', 'lt', 'lte', 'between', 'notBetween']);
export const DATE_OPS = new Set(['dateIs', 'dateBefore', 'dateAfter']);

/** True when a condition takes a value typed in its first box (not empty / not empty, not a date, not a formula). */
export const takesValue = (op) => op !== 'empty' && op !== 'notEmpty' && op !== 'formula' && !DATE_OPS.has(op);

/**
 * A condition as typed ({ op, a, b, day, formula }, texts) made into what the core keeps ({ op, a, b, formula }): numbers and dates read in the
 * workbook's locale. A string is the reason it cannot be.
 */
export function conditionOf(wb, d) {
    const spec = { op: d.op };
    const number = (text) => { const v = parseInput(String(text).trim(), wb.settings()).value; return typeof v === 'number' ? v : NaN; };
    if (d.op === 'formula') { if (!String(d.formula || '').trim()) return 'Write a custom formula, for example =$C2="Late"'; spec.formula = d.formula.trim(); }
    else if (DATE_OPS.has(d.op)) {
        if (d.day === 'exact') { spec.a = number(d.a); if (!Number.isFinite(spec.a)) return 'Write a date, as the sheet shows dates'; } else spec.a = d.day;
    } else if (NUMBER_OPS.has(d.op)) {
        spec.a = number(d.a);
        if (!Number.isFinite(spec.a)) return 'Write a number';
        if (d.op === 'between' || d.op === 'notBetween') { spec.b = number(d.b); if (!Number.isFinite(spec.b)) return 'Write the second number'; }
    } else if (d.op !== 'empty' && d.op !== 'notEmpty') {
        // "Is equal to" takes a number or a text
        const n = d.op === 'eq' || d.op === 'ne' ? number(d.a) : NaN;
        spec.a = Number.isFinite(n) ? n : d.a;
    }
    return spec;
}

/** A kept condition made into the texts of its boxes again ({ op, a, b, day, formula }), as the workbook's locale writes them. */
export function conditionDraft(wb, crit, formulaText) {
    if (!crit || !crit.op) return { op: 'notEmpty', a: '', b: '', day: 'today', formula: '' };
    const show = (v) => (v === undefined || v === null ? '' : typeof v === 'number' ? formatValue(v, { type: DATE_OPS.has(crit.op) ? 'date' : 'general' }, wb.settings()).text : String(v));
    return {
        op: crit.op,
        a: DATE_OPS.has(crit.op) && typeof crit.a === 'string' ? '' : show(crit.a), b: show(crit.b),
        day: DATE_OPS.has(crit.op) ? (typeof crit.a === 'number' ? 'exact' : crit.a) : 'today',
        formula: crit.op === 'formula' ? formulaText || '' : ''
    };
}
