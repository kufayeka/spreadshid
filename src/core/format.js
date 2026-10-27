// Number formats: how a value is shown, never what it is. A cell holding 1250000 shows "Rp 1.250.000,00" with a money format in an Indonesian sheet, and
// stays 1250000 for every formula that reads it. Pure (no DOM).
//
// A format is an object, kept on a cell (its style's `format`) or on a column (the column's `format`, the default for its cells):
//
//   { type: 'general' }                                        as typed: 1234.5
//   { type: 'number', decimals: 2, thousands: true }           1,234.50
//   { type: 'money', currency: 'IDR', decimals: 2 }            Rp 1.250.000,00   (the symbol from the currency; or `symbol: 'Rp'`)
//   { type: 'percent', decimals: 1 }                           12.5%
//   { type: 'scientific', decimals: 2 }                        1.23E+05
//   { type: 'date', pattern: 'dd/MM/yyyy' }                    26/10/2026        (pattern optional: the locale's)
//   { type: 'time', pattern: 'HH:mm' }  { type: 'datetime' }  { type: 'duration' }   ([h]:mm:ss)
//   { type: 'text' }                                           what was typed, never read as a number
//   { type: 'custom', pattern: '#,##0.00;[Red](#,##0.00);"-"' }   the usual codes of a sheet (see customFormat)
//
// and, on any of them: `prefix` and `suffix` (texts put around the shown value), `negative: 'minus' | 'parens' | 'red'`. A suffix can also be the text
// of another column of the same row (`suffixFrom: <column id>`), so a quantity shows "850 m3" with the unit of its line: the grid gives that text in.
//
// Dates and times are numbers too, as in every sheet: days since 30 December 1899 (1 is 31 December 1899, 46000 is 9 December 2025), the time of day
// as the fraction. The locale (the workbook's settings: `locale`, `currency`) decides the separators, the order of day and month, and the symbol.

const DAY_MS = 86400000;
const EPOCH = Date.UTC(1899, 11, 30);

/** A serial (days since 30 December 1899) as a date in UTC. */
export const serialToDate = (n) => new Date(EPOCH + Math.round(n * DAY_MS));
/** A date (its UTC parts) as a serial. */
export const dateToSerial = (d) => (d.getTime() - EPOCH) / DAY_MS;

// the separators and the order of a locale, worked out once from Intl
const localeCache = new Map();
export function localeInfo(locale) {
    const key = locale || 'en-US';
    let info = localeCache.get(key);
    if (info) return info;
    let decimal = '.', group = ',', order = 'mdy', dateSep = '/';
    try {
        const parts = new Intl.NumberFormat(key).formatToParts(1234567.5);
        decimal = (parts.find((p) => p.type === 'decimal') || {}).value || '.';
        group = (parts.find((p) => p.type === 'group') || {}).value || ',';
        const dparts = new Intl.DateTimeFormat(key, { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC' }).formatToParts(new Date(Date.UTC(2006, 10, 22)));
        order = dparts.filter((p) => p.type === 'day' || p.type === 'month' || p.type === 'year').map((p) => p.type[0]).join('');
        // the mark between day, month and year: 26/10/2026 in Indonesia, 26.10.2026 in Germany
        const lit = dparts.find((p) => p.type === 'literal');
        if (lit && /^[./-]$/.test(lit.value.trim())) dateSep = lit.value.trim();
    } catch { /* an unknown locale: the English one */ }
    // a group separator that is a no-break space is shown as one, and typed as a plain space too
    info = { locale: key, decimal, group, order, datePattern: order === 'dmy' ? ['dd', 'MM', 'yyyy'].join(dateSep) : order === 'ymd' ? ['yyyy', 'MM', 'dd'].join(dateSep) : ['M', 'd', 'yyyy'].join(dateSep) };
    localeCache.set(key, info);
    return info;
}

/** The symbol of a currency in a locale: "Rp" for IDR in id-ID, "$" for USD in en-US. */
export function currencySymbol(currency, locale) {
    return currencyInfo(currency, locale).symbol;
}

// the symbol of a currency in a locale and which side of the number it stands on, worked out once from Intl: "Rp 72.000" in Indonesia,
// "$72,000.00" in the US, "72.000,00 €" in Germany
const currencyCache = new Map();
function currencyInfo(currency, locale) {
    const key = (locale || 'en-US') + '|' + currency;
    let info = currencyCache.get(key);
    if (info) return info;
    try {
        const parts = new Intl.NumberFormat(locale || 'en-US', { style: 'currency', currency, currencyDisplay: 'narrowSymbol' }).formatToParts(1);
        const at = parts.findIndex((p) => p.type === 'currency');
        const number = parts.findIndex((p) => p.type === 'integer');
        info = { symbol: at < 0 ? currency : parts[at].value, after: at > number };
    } catch {
        info = { symbol: currency, after: false };
    }
    currencyCache.set(key, info);
    return info;
}

/** A number with a number of decimals and, when asked, the thousands grouped, with the locale's separators: 1234.5 -> "1.234,50" in id-ID. */
export function groupNumber(n, decimals, thousands, info) {
    const fixed = Math.abs(n).toFixed(Math.max(0, Math.min(20, decimals)));
    let [whole, frac] = fixed.split('.');
    if (thousands) whole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, info.group);
    return whole + (frac ? info.decimal + frac : '');
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function monthNames(locale, style) {
    try {
        return Array.from({ length: 12 }, (_, m) => new Intl.DateTimeFormat(locale, { month: style, timeZone: 'UTC' }).format(new Date(Date.UTC(2000, m, 15))));
    } catch { return style === 'long' ? MONTHS : MONTHS.map((x) => x.slice(0, 3)); }
}
function dayNames(locale, style) {
    try {
        return Array.from({ length: 7 }, (_, d) => new Intl.DateTimeFormat(locale, { weekday: style, timeZone: 'UTC' }).format(new Date(Date.UTC(2000, 0, 2 + d))));
    } catch { return style === 'long' ? DAYS : DAYS.map((x) => x.slice(0, 3)); }
}

/**
 * A date and time pattern: yyyy yy (year), MMMM MMM MM M (month), dd d (day), dddd ddd (weekday), HH H (24-hour), hh h (12-hour), mm m (minutes),
 * ss s (seconds), a (AM/PM), and text in quotes. Day and month are told apart by case (M month, m minute), as in Java and in Intl.
 */
export function formatDate(serial, pattern, locale) {
    // rounded to the second first, as Excel shows it: 8:00 typed as a fraction (0.333333) is 07:59:59.97, and it shows 08:00, not 07:59
    const d = serialToDate(Math.round(serial * 86400) / 86400);
    const Y = d.getUTCFullYear(), Mo = d.getUTCMonth(), D = d.getUTCDate(), W = d.getUTCDay();
    const H = d.getUTCHours(), Mi = d.getUTCMinutes(), S = d.getUTCSeconds();
    const pad = (x, n) => String(x).padStart(n, '0');
    const tokens = /"[^"]*"|yyyy|yy|MMMM|MMM|MM|M|dddd|ddd|dd|d|HH|H|hh|h|mm|m|ss|s|a/g;
    return pattern.replace(tokens, (t) => {
        switch (t) {
            case 'yyyy': return String(Y);
            case 'yy': return pad(Y % 100, 2);
            case 'MMMM': return monthNames(locale, 'long')[Mo];
            case 'MMM': return monthNames(locale, 'short')[Mo];
            case 'MM': return pad(Mo + 1, 2);
            case 'M': return String(Mo + 1);
            case 'dddd': return dayNames(locale, 'long')[W];
            case 'ddd': return dayNames(locale, 'short')[W];
            case 'dd': return pad(D, 2);
            case 'd': return String(D);
            case 'HH': return pad(H, 2);
            case 'H': return String(H);
            case 'hh': return pad(H % 12 || 12, 2);
            case 'h': return String(H % 12 || 12);
            case 'mm': return pad(Mi, 2);
            case 'm': return String(Mi);
            case 'ss': return pad(S, 2);
            case 's': return String(S);
            case 'a': return H < 12 ? 'AM' : 'PM';
            default: return t.slice(1, -1);
        }
    });
}

/** A length of time (a number of days) as [h]:mm:ss: 1.5 -> "36:00:00". */
export function formatDuration(days) {
    const total = Math.round(Math.abs(days) * 86400);
    const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
    return (days < 0 ? '-' : '') + h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

/**
 * A custom number pattern, with the codes every sheet knows: sections for positive;negative;zero;text, `0` (a digit always shown), `#` (a digit when
 * there is one), `,` in the whole part (thousands), `.` (the decimal point), `%` (times 100), `E+00` (scientific), text in quotes or after a backslash,
 * `@` (the text itself) and a colour in brackets ([Red], [Blue] ...). A pattern with date letters (yyyy, dd, MM, HH ...) is a date pattern.
 * @returns {{ text: string, color?: string }}
 */
export function customFormat(value, pattern, info) {
    const sections = splitSections(pattern);
    if (typeof value === 'string') {
        const textSection = sections[3] || (sections.length < 4 && sections.some((s) => s.includes('@')) ? sections.find((s) => s.includes('@')) : null);
        return textSection ? { text: literalParts(textSection).replace(/@/g, value) } : { text: value };
    }
    let section = sections[0], n = value;
    if (value < 0 && sections[1] !== undefined) { section = sections[1]; n = -value; }
    else if (value === 0 && sections[2] !== undefined) section = sections[2];
    let color;
    section = section.replace(/\[(Red|Blue|Green|Black|White|Magenta|Cyan|Yellow)\]/i, (m, c) => { color = c.toLowerCase(); return ''; });
    if (/(?:yy|dd|MM|HH|hh|mm:ss)/.test(section.replace(/"[^"]*"/g, ''))) return { text: formatDate(n, section, info.locale), color };
    return { text: numberPattern(n, section, info), color };
}

function splitSections(pattern) {
    const out = [];
    let cur = '', quoted = false;
    for (const ch of pattern) {
        if (ch === '"') quoted = !quoted;
        if (ch === ';' && !quoted) { out.push(cur); cur = ''; continue; }
        cur += ch;
    }
    out.push(cur);
    return out;
}

// the texts of a section with its quotes and backslashes taken off
function literalParts(section) {
    return section.replace(/"([^"]*)"/g, '$1').replace(/\\(.)/g, '$1');
}

function numberPattern(n, section, info) {
    // the number part is the run of 0 # , . % E+ that the pattern has; what is around it is written as it is
    const m = /[0#][0#,.]*(?:E[+-]0+)?%?|%/.exec(section.replace(/"[^"]*"/g, (q) => q.replace(/[0#,.%E]/g, ' ')));
    if (!m) return literalParts(section);
    const spec = m[0];
    const before = literalParts(section.slice(0, m.index));
    const after = literalParts(section.slice(m.index + spec.length));
    let x = n;
    const percent = spec.endsWith('%') || /%/.test(after);
    if (percent) x *= 100;
    const sci = /E[+-](0+)/.exec(spec);
    const body = spec.replace(/%$/, '').replace(/E[+-]0+/, '');
    const [wholeSpec, fracSpec = ''] = body.split('.');
    const decimals = fracSpec.replace(/[^0#]/g, '').length;
    const required = (fracSpec.match(/0/g) || []).length;
    const thousands = wholeSpec.includes(',');
    let text;
    if (sci) {
        const e = x === 0 ? 0 : Math.floor(Math.log10(Math.abs(x)));
        const mant = x / Math.pow(10, e);
        text = groupNumber(mant, decimals, false, info) + 'E' + (e < 0 ? '-' : '+') + String(Math.abs(e)).padStart(sci[1].length, '0');
    } else {
        text = groupNumber(x, decimals, thousands, info);
        // optional decimals (#) are dropped when they are zeros
        if (decimals > required && text.includes(info.decimal)) {
            const [w, f] = text.split(info.decimal);
            let frac = f;
            while (frac.length > required && frac.endsWith('0')) frac = frac.slice(0, -1);
            text = w + (frac ? info.decimal + frac : '');
        }
        // the least digits of the whole part (000 shows 007)
        const minWhole = (wholeSpec.match(/0/g) || []).length;
        const [w, f] = text.split(info.decimal);
        const digits = w.replace(new RegExp('\\' + info.group, 'g'), '');
        if (digits.length < minWhole) text = (thousands ? groupNumber(Number(digits), 0, true, info).padStart(minWhole, '0') : digits.padStart(minWhole, '0')) + (f !== undefined ? info.decimal + f : '');
        if (minWhole === 0 && /^0(?=\D|$)/.test(text) && wholeSpec.replace(/,/g, '') === '#') text = text.replace(/^0/, '');
    }
    return before + (n < 0 ? '-' : '') + text + (percent && !after.includes('%') ? '%' : '') + after;
}

/**
 * What a value shows with a format, in a locale: { text, color }. `extra` gives what a format may take from the row (the text of the column a suffix
 * comes from).
 * @param {any} value  A number, a text, a boolean, an error, or nothing.
 * @param {object} [format]
 * @param {{ locale?: string, currency?: string }} [settings]
 * @param {{ suffixText?: string }} [extra]
 */
export function formatValue(value, format, settings, extra) {
    const f = format || {};
    const info = localeInfo(settings && settings.locale);
    let text, color;
    if (typeof value !== 'number' || !isFinite(value) || f.type === 'text' || f.type === undefined || f.type === 'general') {
        if (typeof value === 'number' && isFinite(value)) text = generalNumber(value, info);
        else text = value === null || value === undefined ? '' : String(value);
        if (f.type === 'custom' && f.pattern && typeof value === 'string') text = customFormat(value, f.pattern, info).text;
    } else {
        const neg = value < 0;
        const abs = Math.abs(value);
        switch (f.type) {
            case 'number': text = groupNumber(abs, f.decimals === undefined ? 2 : f.decimals, f.thousands !== false, info); break;
            case 'money': {
                const currency = f.currency || (settings && settings.currency) || 'USD';
                const known = currencyInfo(currency, info.locale);
                const symbol = f.symbol !== undefined ? f.symbol : known.symbol;
                const decimals = f.decimals === undefined ? 2 : f.decimals;
                const number = groupNumber(abs, decimals, f.thousands !== false, info);
                // the symbol stands where the locale puts it; after the number it is always one space away ("72.000,00 €")
                if (known.after && f.symbol === undefined) text = number + (f.symbolSpace === false ? '' : ' ') + symbol;
                else text = symbol + (f.symbolSpace === false ? '' : symbol && /[A-Za-z]$/.test(symbol) ? ' ' : '') + number;
                break;
            }
            case 'percent': text = groupNumber(abs * 100, f.decimals === undefined ? 2 : f.decimals, f.thousands === true, info) + '%'; break;
            case 'scientific': {
                const e = abs === 0 ? 0 : Math.floor(Math.log10(abs));
                text = groupNumber(abs / Math.pow(10, e), f.decimals === undefined ? 2 : f.decimals, false, info) + 'E' + (e < 0 ? '-' : '+') + String(Math.abs(e)).padStart(2, '0');
                break;
            }
            case 'date': text = formatDate(value, f.pattern || info.datePattern, info.locale); break;
            case 'time': text = formatDate(value, f.pattern || 'HH:mm:ss', info.locale); break;
            case 'datetime': text = formatDate(value, f.pattern || info.datePattern + ' HH:mm:ss', info.locale); break;
            case 'duration': text = formatDuration(value); break;
            case 'custom': { const c = customFormat(value, f.pattern || 'General', info); text = c.text; color = c.color; break; }
            default: text = generalNumber(value, info);
        }
        // dates, times, durations and custom patterns say their own sign; the others take the sign as the format asks
        if (neg && ['number', 'money', 'percent', 'scientific'].includes(f.type)) {
            if (f.negative === 'parens') text = '(' + text + ')';
            else { text = '-' + text; }
            if (f.negative === 'red') color = 'red';
        }
    }
    const suffix = f.suffixFrom !== undefined ? (extra && extra.suffixText ? (f.suffix || ' ') + extra.suffixText : f.suffix || '') : f.suffix || '';
    if (text !== '' && (f.prefix || suffix)) text = (f.prefix || '') + text + suffix;
    return { text, color };
}

// a number as "general" shows it: up to 15 significant digits, no grouping, the locale's decimal sign, an exponent for the very big and very small
function generalNumber(n, info) {
    const r = Number(n.toPrecision(15));
    const a = Math.abs(r);
    let text;
    if (a !== 0 && (a >= 1e15 || a < 1e-9)) text = r.toExponential().replace(/e([+-])(\d)$/, 'E$10$2').replace('e', 'E');
    else text = String(r);
    return info.decimal === '.' ? text : text.replace('.', info.decimal);
}

/** The formats a toolbar offers, in its order (each as the format object it sets). */
export const FORMAT_PRESETS = {
    general: { type: 'general' },
    number: { type: 'number', decimals: 2 },
    percent: { type: 'percent', decimals: 2 },
    scientific: { type: 'scientific', decimals: 2 },
    money: { type: 'money', decimals: 2 },
    moneyRounded: { type: 'money', decimals: 0 },
    date: { type: 'date' },
    time: { type: 'time' },
    datetime: { type: 'datetime' },
    duration: { type: 'duration' },
    text: { type: 'text' }
};
