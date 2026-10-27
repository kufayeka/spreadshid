// Conditional formatting, as in Google Sheets (Format > Conditional formatting): rules a person makes on ranges, saved with the sheet, that change how a
// cell looks by what it holds. A rule is one colour (a style when a condition holds) or a colour scale (a fill between two or three colours by the
// cell's number). The rules are in order and the first one that gives a cell a style wins. Nothing is written into the cells: the style is worked out
// when the cell is drawn. Pure (no DOM).
//
// A rule, kept in the sheet's props (`conditionals`), its ranges by the ids of their corners so they follow inserted rows:
//   { id, ranges: [{ r1, c1, r2, c2 }],          the ranges (row and column ids)
//     kind: 'single',
//     op: 'empty' | 'notEmpty' | 'textContains' | 'textNotContains' | 'textStarts' | 'textEnds' | 'textIs'
//       | 'dateIs' | 'dateBefore' | 'dateAfter' | 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'ne' | 'between' | 'notBetween' | 'formula',
//     a, b,                                       the values of op (a date: a day number, or 'today', 'yesterday', 'tomorrow', 'pastWeek',
//                                                 'pastMonth', 'pastYear')
//     formula: { f, refs },                       op 'formula': a formula written for the top-left cell of the first range, moved for every other
//     style: { bold, italic, underline, strike, color, fill } }
//   { id, ranges, kind: 'scale',
//     min: { type: 'min' | 'number' | 'percent' | 'percentile', value, color }, mid: { ... } | null, max: { type: 'max' | ..., value, color } }

import { newId } from './ids.js';
import { shiftFormula } from './formula/formula.js';
import { storeFormula, formulaText } from './refs.js';
import { dateToSerial } from './format.js';

export const CONDITION_OPS = ['empty', 'notEmpty', 'textContains', 'textNotContains', 'textStarts', 'textEnds', 'textIs', 'dateIs', 'dateBefore', 'dateAfter',
    'gt', 'gte', 'lt', 'lte', 'eq', 'ne', 'between', 'notBetween', 'formula'];
const STYLE_KEYS = ['bold', 'italic', 'underline', 'strike', 'color', 'fill'];

/** The rule kept for ranges of a sheet: by the ids of their corners; a formula text kept by ids, as a cell's formula is. */
export function makeConditional(wb, s, rects, spec) {
    const ranges = rects.map((rect) => ({ r1: wb.rowId(s, rect.r1), c1: wb.colId(s, rect.c1), r2: wb.rowId(s, rect.r2), c2: wb.colId(s, rect.c2) }));
    const rule = { ...spec, id: spec.id || newId(), ranges };
    delete rule.r1; delete rule.c1; delete rule.r2; delete rule.c2;
    if (rule.kind !== 'scale') {
        rule.kind = 'single';
        if (!CONDITION_OPS.includes(rule.op)) throw new Error('a rule of conditional formatting needs one of these conditions: ' + CONDITION_OPS.join(', '));
        if (rule.op === 'formula') {
            const text = typeof spec.formula === 'string' ? spec.formula.trim() : spec.formula ? formulaText(spec.formula, s, wb._grid) : '';
            if (!text) throw new Error('a custom formula is needed');
            rule.formula = storeFormula(text.startsWith('=') ? text : '=' + text, s, wb._grid);
        } else delete rule.formula;
        const style = {};
        for (const k of STYLE_KEYS) if (spec.style && spec.style[k] !== undefined && spec.style[k] !== null && spec.style[k] !== false) style[k] = spec.style[k];
        rule.style = style;
    } else {
        if (!rule.min || !rule.max) throw new Error('a colour scale needs a min and a max point');
        rule.mid = rule.mid || null;
    }
    return rule;
}

/** Where the ranges of a kept rule stand now, by position (a range whose corner was deleted is left out). */
export function conditionalRects(wb, s, rule) {
    const out = [];
    for (const g of rule.ranges || []) {
        const r1 = wb.rowIndex(s, g.r1), r2 = wb.rowIndex(s, g.r2), c1 = wb.colIndex(s, g.c1), c2 = wb.colIndex(s, g.c2);
        if (r1 < 0 || r2 < 0 || c1 < 0 || c2 < 0) continue;
        out.push({ r1: Math.min(r1, r2), c1: Math.min(c1, c2), r2: Math.max(r1, r2), c2: Math.max(c1, c2) });
    }
    return out;
}

/** The formula of a rule as text, for its top-left cell where it stands now (for the editor). */
export function conditionalFormulaText(wb, s, rule) {
    return rule.formula ? formulaText(rule.formula, s, wb._grid) : '';
}

// ---- working out ----------------------------------------------------------------------------------------------------------------------------------

/**
 * The style the rules of a sheet (`list`, its props' own, not a copy) give a cell, or null. `cache` is the workbook's (rule id -> what was worked
 * out for this revision).
 * @param {any} wb @param {any[]} list @param {string} s @param {number} r @param {number} c @param {number} revision @param {Map<string, any>} cache
 */
export function conditionalStyleOf(wb, list, s, r, c, revision, cache) {
    if (!list || !list.length) return null;
    for (const rule of list) {
        const rects = rectsCached(wb, s, rule, revision, cache);
        const inside = rects.find((b) => r >= b.r1 && r <= b.r2 && c >= b.c1 && c <= b.c2);
        if (!inside) continue;
        if (rule.kind === 'scale') {
            const fill = scaleColour(wb, s, rule, wb.value(s, r, c), rects, revision, cache);
            if (fill) return { fill };
            continue;
        }
        if (!Object.keys(rule.style || {}).length) continue;
        if (holds(wb, s, rule, r, c, rects[0], revision, cache)) return rule.style;
    }
    return null;
}

function entryOf(cache, rule, revision) {
    let e = cache.get(rule.id);
    if (!e || e.revision !== revision || e.rule !== rule) { e = { revision, rule, rects: null, scale: null, formulas: new Map() }; cache.set(rule.id, e); }
    return e;
}

function rectsCached(wb, s, rule, revision, cache) {
    const e = entryOf(cache, rule, revision);
    if (!e.rects) e.rects = conditionalRects(wb, s, rule);
    return e.rects;
}

const asText = (v) => (v === null || v === undefined ? '' : typeof v === 'object' ? (v.error || v.code || '') : String(v)).toLowerCase();
const isEmpty = (v) => v === null || v === undefined || v === '';

// the day a date condition names: today and the days around it are worked out when asked (a sheet open past midnight moves with the day)
function dayOf(a) {
    if (typeof a === 'number') return Math.floor(a);
    const now = new Date();
    const today = dateToSerial(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
    switch (a) {
        case 'today': return today;
        case 'yesterday': return today - 1;
        case 'tomorrow': return today + 1;
        case 'pastWeek': return today - 7;
        case 'pastMonth': { const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, now.getDate())); return dateToSerial(d); }
        case 'pastYear': { const d = new Date(Date.UTC(now.getFullYear() - 1, now.getMonth(), now.getDate())); return dateToSerial(d); }
        default: { const n = Number(a); return Number.isFinite(n) ? Math.floor(n) : NaN; }
    }
}

/** True when a value meets a rule's condition (all but the custom formula, which needs the cell). */
export function meets(rule, v) {
    const { op, a, b } = rule;
    const num = typeof v === 'number';
    switch (op) {
        case 'empty': return isEmpty(v);
        case 'notEmpty': return !isEmpty(v);
        case 'textContains': return !isEmpty(v) && asText(v).includes(asText(a));
        case 'textNotContains': return !asText(v).includes(asText(a));
        case 'textStarts': return !isEmpty(v) && asText(v).startsWith(asText(a));
        case 'textEnds': return !isEmpty(v) && asText(v).endsWith(asText(a));
        case 'textIs': return !isEmpty(v) && asText(v) === asText(a);
        case 'dateIs': {
            if (!num) return false;
            const day = dayOf(a), v0 = Math.floor(v);
            // "is in the past week / month / year": from that day up to today, as in Google Sheets
            return a === 'pastWeek' || a === 'pastMonth' || a === 'pastYear' ? v0 >= day && v0 <= dayOf('today') : v0 === day;
        }
        case 'dateBefore': return num && Math.floor(v) < dayOf(a);
        case 'dateAfter': return num && Math.floor(v) > dayOf(a);
        case 'gt': return num && v > Number(a);
        case 'gte': return num && v >= Number(a);
        case 'lt': return num && v < Number(a);
        case 'lte': return num && v <= Number(a);
        case 'eq': return num && a !== '' && a !== null && Number.isFinite(Number(a)) ? v === Number(a) : !isEmpty(v) && asText(v) === asText(a);
        case 'ne': return num && a !== '' && a !== null && Number.isFinite(Number(a)) ? v !== Number(a) : asText(v) !== asText(a);
        case 'between': { const lo = Math.min(Number(a), Number(b)), hi = Math.max(Number(a), Number(b)); return num && v >= lo && v <= hi; }
        case 'notBetween': { const lo = Math.min(Number(a), Number(b)), hi = Math.max(Number(a), Number(b)); return num && (v < lo || v > hi); }
        default: return false;
    }
}

function holds(wb, s, rule, r, c, base, revision, cache) {
    if (rule.op !== 'formula') return meets(rule, wb.value(s, r, c));
    if (!rule.formula) return false;
    const e = entryOf(cache, rule, revision);
    const key = r + ':' + c;
    if (e.formulas.has(key)) return e.formulas.get(key);
    // the formula is written for the top-left cell of the first range: moved to this cell, worked out as if it were in it, kept nowhere
    let value = false;
    try {
        const text = shiftFormula(formulaText(rule.formula, s, wb._grid), r - base.r1, c - base.c1);
        const v = wb._engine.evaluateDetached(s, wb.rowId(s, r), wb.colId(s, c), storeFormula(text, s, wb._grid));
        value = v === true || (typeof v === 'number' && v !== 0);
    } catch { value = false; }
    e.formulas.set(key, value);
    return value;
}

// ---- colour scales --------------------------------------------------------------------------------------------------------------------------------

const hexToRgb = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return [255, 255, 255]; const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgbToHex = (rgb) => '#' + rgb.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => rgbToHex(hexToRgb(a).map((x, i) => x + (hexToRgb(b)[i] - x) * t));

function percentile(sorted, p) {
    if (!sorted.length) return NaN;
    const at = (sorted.length - 1) * Math.max(0, Math.min(100, p)) / 100, lo = Math.floor(at), hi = Math.ceil(at);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (at - lo);
}

function pointValue(point, sorted, fallback) {
    if (!point) return NaN;
    const lo = sorted[0], hi = sorted[sorted.length - 1];
    switch (point.type) {
        case 'min': return lo;
        case 'max': return hi;
        case 'number': return Number(point.value);
        case 'percent': return lo + (hi - lo) * Number(point.value) / 100;
        case 'percentile': return percentile(sorted, Number(point.value));
        default: return fallback;
    }
}

// the points of a scale over the numbers of its ranges, worked out once per revision
function scalePoints(wb, s, rule, rects, revision, cache) {
    const e = entryOf(cache, rule, revision);
    if (e.scale) return e.scale;
    const numbers = [];
    for (const b of rects) for (let r = b.r1; r <= b.r2; r++) for (let c = b.c1; c <= b.c2; c++) { const v = wb.value(s, r, c); if (typeof v === 'number') numbers.push(v); }
    numbers.sort((x, y) => x - y);
    if (!numbers.length) { e.scale = { none: true }; return e.scale; }
    const lo = pointValue(rule.min, numbers, numbers[0]), hi = pointValue(rule.max, numbers, numbers[numbers.length - 1]);
    const mid = rule.mid ? pointValue({ type: 'percentile', value: 50, ...rule.mid }, numbers, (lo + hi) / 2) : null;
    e.scale = { lo, hi, mid };
    return e.scale;
}

function scaleColour(wb, s, rule, v, rects, revision, cache) {
    if (typeof v !== 'number') return null;
    const p = scalePoints(wb, s, rule, rects, revision, cache);
    if (p.none || !Number.isFinite(p.lo) || !Number.isFinite(p.hi)) return null;
    const at = (x, from, to) => (to === from ? 0 : Math.max(0, Math.min(1, (x - from) / (to - from))));
    if (rule.mid && Number.isFinite(p.mid)) return v <= p.mid ? mix(rule.min.color, rule.mid.color, at(v, p.lo, p.mid)) : mix(rule.mid.color, rule.max.color, at(v, p.mid, p.hi));
    return mix(rule.min.color, rule.max.color, at(v, p.lo, p.hi));
}
