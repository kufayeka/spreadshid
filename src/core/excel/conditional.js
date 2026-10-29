// Conditional formatting to Excel and back. A rule of the sheet becomes the rule Excel has for it: a text condition the type Excel's own menu makes
// (containsText, beginsWith ...), a number one a cellIs, a date one a formula with TODAY() (so it keeps moving with the day, as in the sheet), a custom
// formula an expression, a colour scale a colorScale. Every rule but a scale stops the ones after it (stopIfTrue), so the first rule wins in Excel too.
// Back from a file, what the sheet has no rule for (icon sets, top 10, above average, duplicates) is said in a warning.

import { colName } from '../formula/address.js';

const quote = (text) => '"' + String(text).replace(/"/g, '""') + '"';
const CELL_IS = { gt: 'greaterThan', gte: 'greaterThanOrEqual', lt: 'lessThan', lte: 'lessThanOrEqual', eq: 'equal', ne: 'notEqual', between: 'between', notBetween: 'notBetween' };
const FROM_CELL_IS = Object.fromEntries(Object.entries(CELL_IS).map(([k, v]) => [v, k]));
const SIGN = { gt: '>', gte: '>=', lt: '<', lte: '<=', eq: '=', ne: '<>' };
const DAY = { today: 'TODAY()', yesterday: 'TODAY()-1', tomorrow: 'TODAY()+1', pastWeek: 'TODAY()-7', pastMonth: 'EDATE(TODAY(),-1)', pastYear: 'EDATE(TODAY(),-12)' };
const PERIOD = { today: 'today', yesterday: 'yesterday', tomorrow: 'tomorrow', last7Days: 'pastWeek' };

/**
 * A rule of the sheet as Excel keeps it: { rects, type, operator, text, formulas, style, scale }, or null for a rule with nothing to show.
 * `rects` are where its ranges stand now, `formulaText` its custom formula for the top-left cell (without "=").
 */
export function toExcelRule(rule, rects, formulaText) {
    if (!rects.length) return null;
    const A = colName(rects[0].c1) + (rects[0].r1 + 1);
    if (rule.kind === 'bar') return { rects, type: 'dataBar', color: rule.color || '#6929c4' };
    if (rule.kind === 'scale') {
        const point = (p, end) => ({ type: p.type === 'number' ? 'num' : p.type || end, value: p.type === 'min' || p.type === 'max' ? undefined : p.value, color: p.color });
        return { rects, type: 'colorScale', scale: [point(rule.min, 'min'), rule.mid ? point(rule.mid, 'percentile') : null, point(rule.max, 'max')].filter(Boolean) };
    }
    if (!rule.style || !Object.keys(rule.style).length) return null;
    const base = { rects, style: rule.style };
    const isNumber = (v) => typeof v === 'number' && Number.isFinite(v);
    const q = quote(rule.a === undefined || rule.a === null ? '' : rule.a);
    const day = (a) => (typeof a === 'number' ? String(Math.floor(a)) : DAY[a] || 'TODAY()');
    switch (rule.op) {
        case 'empty': return { ...base, type: 'containsBlanks', formulas: ['LEN(TRIM(' + A + '))=0'] };
        case 'notEmpty': return { ...base, type: 'notContainsBlanks', formulas: ['LEN(TRIM(' + A + '))>0'] };
        case 'textContains': return { ...base, type: 'containsText', operator: 'containsText', text: String(rule.a), formulas: ['NOT(ISERROR(SEARCH(' + q + ',' + A + ')))'] };
        case 'textNotContains': return { ...base, type: 'notContainsText', operator: 'notContains', text: String(rule.a), formulas: ['ISERROR(SEARCH(' + q + ',' + A + '))'] };
        case 'textStarts': return { ...base, type: 'beginsWith', operator: 'beginsWith', text: String(rule.a), formulas: ['LEFT(' + A + ',LEN(' + q + '))=' + q] };
        case 'textEnds': return { ...base, type: 'endsWith', operator: 'endsWith', text: String(rule.a), formulas: ['RIGHT(' + A + ',LEN(' + q + '))=' + q] };
        case 'textIs': return { ...base, type: 'expression', formulas: ['AND(' + A + '<>"",' + A + '=' + q + ')'] };
        case 'dateIs':
            if (rule.a === 'pastWeek' || rule.a === 'pastMonth' || rule.a === 'pastYear') return { ...base, type: 'expression', formulas: ['AND(ISNUMBER(' + A + '),INT(' + A + ')>=' + day(rule.a) + ',INT(' + A + ')<=TODAY())'] };
            return { ...base, type: 'expression', formulas: ['AND(ISNUMBER(' + A + '),INT(' + A + ')=' + day(rule.a) + ')'] };
        case 'dateBefore': return { ...base, type: 'expression', formulas: ['AND(ISNUMBER(' + A + '),INT(' + A + ')<' + day(rule.a) + ')'] };
        case 'dateAfter': return { ...base, type: 'expression', formulas: ['AND(ISNUMBER(' + A + '),INT(' + A + ')>' + day(rule.a) + ')'] };
        case 'formula': return formulaText ? { ...base, type: 'expression', formulas: [formulaText] } : null;
        default: {
            if (!CELL_IS[rule.op]) return null;
            // equal to a text: Excel compares a cell with a quoted text; a number goes as it is
            const v = (x) => (isNumber(x) ? String(x) : quote(x));
            return { ...base, type: 'cellIs', operator: CELL_IS[rule.op], formulas: rule.op === 'between' || rule.op === 'notBetween' ? [v(rule.a), v(rule.b)] : [v(rule.a)] };
        }
    }
}

// a value Excel wrote in a rule's formula: a number, a quoted text, or null for anything else (a reference, a formula)
function literal(text) {
    const t = String(text || '').trim();
    if (/^-?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(t)) return { value: Number(t) };
    const m = /^"((?:[^"]|"")*)"$/.exec(t);
    return m ? { value: m[1].replace(/""/g, '"') } : null;
}

/**
 * A rule Excel keeps, made into a rule of the sheet: { spec } (its ranges are the caller's), or { skip: what it is } for one the sheet has not.
 * `node` is the parsed <cfRule>; `dxf` the style it points to ({ bold, color, fill ... }); `A` the address of the top-left cell of its ranges.
 */
export function fromExcelRule(node, dxf, A, kid, kids) {
    const at = node.attrs;
    const formulas = kids(node, 'formula').map((f) => f.text);
    const style = dxf || {};
    const single = (spec) => ({ spec: { kind: 'single', style, ...spec } });
    switch (at.type) {
        case 'colorScale': {
            const scale = kid(node, 'colorScale');
            const points = kids(scale, 'cfvo'), colors = kids(scale, 'color');
            const point = (i) => {
                const p = points[i], rgb = colors[i] && colors[i].attrs.rgb;
                const type = p.attrs.type === 'num' ? 'number' : p.attrs.type;
                const color = rgb && /^[0-9a-f]{8}$/i.test(rgb) ? '#' + rgb.slice(2).toLowerCase() : '#ffffff';
                const lit = literal(p.attrs.val);
                return { type: ['min', 'max', 'number', 'percent', 'percentile'].includes(type) ? type : 'percentile', ...(type === 'min' || type === 'max' ? {} : { value: lit && typeof lit.value === 'number' ? lit.value : 50 }), color };
            };
            if (points.length < 2) return { skip: 'a colour scale with no points' };
            return { spec: { kind: 'scale', min: point(0), mid: points.length === 3 ? point(1) : null, max: point(points.length - 1) } };
        }
        case 'dataBar': {
            const color = kid(kid(node, 'dataBar'), 'color');
            const rgb = color && color.attrs.rgb;
            return { spec: { kind: 'bar', color: rgb && /^[0-9a-f]{8}$/i.test(rgb) ? '#' + rgb.slice(2).toLowerCase() : '#6929c4' } };
        }
        case 'containsBlanks': return single({ op: 'empty' });
        case 'notContainsBlanks': return single({ op: 'notEmpty' });
        case 'containsText': return single({ op: 'textContains', a: at.text || '' });
        case 'notContainsText': return single({ op: 'textNotContains', a: at.text || '' });
        case 'beginsWith': return single({ op: 'textStarts', a: at.text || '' });
        case 'endsWith': return single({ op: 'textEnds', a: at.text || '' });
        case 'timePeriod': return PERIOD[at.timePeriod] ? single({ op: 'dateIs', a: PERIOD[at.timePeriod] }) : { skip: 'dates of "' + at.timePeriod + '"' };
        case 'expression': return formulas[0] ? single({ op: 'formula', formula: '=' + formulas[0] }) : { skip: 'a formula rule without its formula' };
        case 'cellIs': {
            const op = FROM_CELL_IS[at.operator];
            if (!op) return { skip: 'a rule "' + at.operator + '"' };
            const a = literal(formulas[0]), b = literal(formulas[1]);
            const two = op === 'between' || op === 'notBetween';
            if (a && (!two || b) && (typeof a.value === 'number' || op === 'eq' || op === 'ne')) return single({ op, a: a.value, ...(two ? { b: b.value } : {}) });
            // a bound that is a reference or a formula: the same rule as a custom formula
            if (two) return single({ op: 'formula', formula: (op === 'between' ? '=AND(' : '=OR(') + A + (op === 'between' ? '>=' : '<') + formulas[0] + ',' + A + (op === 'between' ? '<=' : '>') + formulas[1] + ')' });
            return single({ op: 'formula', formula: '=' + A + SIGN[op] + formulas[0] });
        }
        case 'iconSet': return { skip: 'icon sets' };
        case 'top10': return { skip: 'top / bottom rules' };
        case 'aboveAverage': return { skip: 'above / below average rules' };
        case 'duplicateValues': case 'uniqueValues': return { skip: 'duplicate / unique value rules' };
        default: return { skip: 'rules of type "' + at.type + '"' };
    }
}
