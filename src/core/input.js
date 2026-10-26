// What a person types into a cell, read as Google Sheets reads it, in the workbook's locale:
//   "=..."            a formula
//   "1.234,5"         a number (in id-ID; "1,234.5" in en-US), "12%" a number (0.12) shown as a percent
//   "Rp 1.250.000"    a number shown as money; "$1,250.50" too
//   "26/10/2026"      a date (day and month in the locale's order; "2026-10-26" anywhere), "13:45" a time, both a date and a time
//   "TRUE", "FALSE"   booleans
//   "'123"            the text 123 (the apostrophe says: keep it as text)
//   anything else     a text
// A number, a date or a time that was read gives the format it was written in (`format`), which the workbook puts on a cell that has none: typing
// "26/10/2026" shows a date from then on, as in Google Sheets. A cell whose format is "text" keeps what is typed as text.

import { localeInfo, currencySymbol, dateToSerial } from './format.js';

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// a number written with the locale's separators (groups of three, or none), or the plain way with a point
function readNumber(t, info) {
    const g = esc(info.group === ' ' || info.group === ' ' ? ' ' : info.group), d = esc(info.decimal);
    const local = new RegExp('^[-+]?(?:\\d{1,3}(?:' + g + '\\d{3})+|\\d+)(?:' + d + '\\d*)?(?:[eE][-+]?\\d+)?$');
    const plain = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/;
    const s = t.replace(/[  ]/g, ' ');
    if (local.test(s)) {
        const norm = s.split(info.group === ' ' || info.group === ' ' ? ' ' : info.group).join('').replace(info.decimal, '.');
        const n = Number(norm);
        if (isFinite(n)) return { n, decimals: (norm.split('.')[1] || '').replace(/[eE].*$/, '').length, grouped: s !== norm.replace('.', info.decimal) && s.includes(info.group === ' ' ? ' ' : info.group) };
    }
    // a point as the decimal sign is read only where it cannot be a group separator
    if (info.decimal === '.' || !s.includes('.')) {
        if (plain.test(s)) { const n = Number(s); if (isFinite(n)) return { n, decimals: (s.split('.')[1] || '').replace(/[eE].*$/, '').length, grouped: false }; }
    }
    return null;
}

const MONTH_WORDS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function readTime(t) {
    const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?$/.exec(t);
    if (!m) return null;
    let h = Number(m[1]);
    const mi = Number(m[2]), s = Number(m[3] || 0);
    if (m[4]) { const pm = /p/i.test(m[4]); if (h > 12) return null; h = (h % 12) + (pm ? 12 : 0); }
    if (h > 23 || mi > 59 || s > 59) return null;
    return { fraction: (h * 3600 + mi * 60 + s) / 86400, seconds: m[3] !== undefined };
}

function readDate(t, info) {
    let y, mo, d;
    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
    if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; }
    else if ((m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(t))) {
        const a = +m[1], b = +m[2];
        y = +m[3];
        if (info.order === 'dmy') { d = a; mo = b; } else { mo = a; d = b; }
    } else if ((m = /^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/.exec(t))) {
        d = +m[1]; mo = MONTH_WORDS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1; y = +m[3];
    } else return null;
    if (y < 100) y += y < 50 ? 2000 : 1900;
    if (!(mo >= 1 && mo <= 12 && d >= 1 && d <= 31)) return null;
    const date = new Date(Date.UTC(y, mo - 1, d));
    if (date.getUTCMonth() !== mo - 1) return null; // 31/02 is not a date
    return dateToSerial(date);
}

/**
 * @param {string} text
 * @param {{ locale?: string, currency?: string }} [settings]  The workbook's.
 * @param {object} [format]  The cell's format: a "text" format keeps what is typed as text.
 * @returns {{ formula: string } | { value: string|number|boolean|undefined, format?: object }}
 */
export function parseInput(text, settings, format) {
    const s = String(text);
    if (s === '') return { value: undefined };
    if (s[0] === "'") return { value: s.slice(1) };
    if (s.length > 1 && s[0] === '=') return { formula: s };
    if (format && format.type === 'text') return { value: s };
    const t = s.trim();
    if (/^true$/i.test(t)) return { value: true };
    if (/^false$/i.test(t)) return { value: false };
    const info = localeInfo(settings && settings.locale);

    const num = readNumber(t, info);
    if (num) return num.grouped ? { value: num.n, format: { type: 'number', decimals: num.decimals } } : { value: num.n };

    // a percent: "12%", "12,5 %"
    let m = /^(.*?)\s*%$/.exec(t);
    if (m) { const p = readNumber(m[1], info); if (p) return { value: p.n / 100, format: { type: 'percent', decimals: p.decimals } }; }

    // money: a currency symbol before or after the number
    const symbols = new Set(['$', '€', '£', '¥', 'Rp', 'US$']);
    if (settings && settings.currency) symbols.add(currencySymbol(settings.currency, info.locale));
    for (const sym of symbols) {
        const re = new RegExp('^(-)?\\s*' + esc(sym) + '\\s*(-?[\\d.,\\s\\u00a0]+)$|^(-?[\\d.,\\s\\u00a0]+)\\s*' + esc(sym) + '$');
        m = re.exec(t);
        if (!m) continue;
        const p = readNumber((m[2] || m[3]).trim(), info);
        if (!p) continue;
        const value = (m[1] ? -1 : 1) * p.n;
        return { value, format: { type: 'money', decimals: p.decimals, symbol: sym } };
    }

    // a time, a date, or both
    const time = readTime(t);
    if (time) return { value: time.fraction, format: { type: 'time', pattern: time.seconds ? 'HH:mm:ss' : 'HH:mm' } };
    const date = readDate(t, info);
    if (date !== null) return { value: date, format: { type: 'date' } };
    m = /^(.+?)\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AaPp][Mm])?)$/.exec(t);
    if (m) {
        const dd = readDate(m[1], info), tt = readTime(m[2]);
        if (dd !== null && tt) return { value: dd + tt.fraction, format: { type: 'datetime' } };
    }
    return { value: s };
}
