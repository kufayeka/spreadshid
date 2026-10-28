// More functions of the formulas: the ones construction and finance sheets lean on (SUMPRODUCT, working days, month ends, loans, cash flows, a
// reference worked out by OFFSET or INDIRECT), and TERBILANG, the amount in Indonesian words that receipts and payment certificates carry.
// Pure (no DOM). registerMore(def) puts them in the table of functions (xlfuncs.js).
import { ERR, XlArray, isError, isRange, toNumber, toText, compare, roundSig, dateToSerial, serialToDate } from "./xlvalue.js";
import { colIndex } from "./address.js";

const num = (v) => (isRange(v) ? toNumber(v.at(0, 0)) : toNumber(v));
const int = (v) => { const n = num(v); return isError(n) ? n : Math.trunc(n); };
const valuesOf = (v) => (isRange(v) ? v.values() : [v]);
const day = (serial) => serialToDate(Math.floor(serial));
// the day of the week of a day number, worked out from the number itself (day 0, 30 December 1899, was a Saturday): 0 Sunday ... 6 Saturday
const weekdayOf = (serial) => (Math.floor(serial) + 6) % 7;

// ---- working days ---------------------------------------------------------------------------------------------------------------------------------

// the holidays given to WORKDAY and NETWORKDAYS (a range of dates, or one date), as whole day numbers
function holidaysOf(v) {
    const out = new Set();
    if (v === undefined || v === null) return out;
    for (const x of valuesOf(v)) { if (typeof x === "number") out.add(Math.floor(x)); }
    return out;
}
const weekend = (serial) => { const w = weekdayOf(serial); return w === 0 || w === 6; };

// ---- TERBILANG -----------------------------------------------------------------------------------------------------------------------------------

const SATUAN = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"];

// a whole number below one thousand in words ("seratus dua puluh lima"), with Indonesian's own "se-" forms
function ratusan(n) {
    if (n < 12) return SATUAN[n];
    if (n < 20) return SATUAN[n - 10] + " belas";
    if (n < 100) return SATUAN[Math.floor(n / 10)] + " puluh" + (n % 10 ? " " + SATUAN[n % 10] : "");
    const rest = n % 100;
    return (n < 200 ? "seratus" : SATUAN[Math.floor(n / 100)] + " ratus") + (rest ? " " + ratusan(rest) : "");
}

/** A whole number in Indonesian words: 1250000 is "satu juta dua ratus lima puluh ribu", 1000 is "seribu" (not "satu ribu"). */
export function terbilang(n) {
    if (n === 0) return "nol";
    const groups = ["", " ribu", " juta", " miliar", " triliun", " kuadriliun"];
    const parts = [];
    let i = 0;
    while (n > 0 && i < groups.length) {
        const g = n % 1000;
        if (g) parts.unshift(i === 1 && g === 1 ? "seribu" : ratusan(g) + groups[i]);
        n = Math.floor(n / 1000);
        i++;
    }
    return parts.join(" ");
}

// ---- references worked out --------------------------------------------------------------------------------------------------------------------------

// "B2", "A1:C9", "Produk!B2", "'Daftar Harga'!A1:C9" as { sheet, r1, c1, r2, c2 }, or null
function parseRef(text) {
    const m = /^\s*(?:(?:'((?:[^']|'')+)'|([^'!]+))!)?\$?([A-Za-z]{1,3})\$?(\d+)(?::\$?([A-Za-z]{1,3})\$?(\d+))?\s*$/.exec(String(text));
    if (!m) return null;
    const r1 = Number(m[4]) - 1, c1 = colIndex(m[3].toUpperCase());
    const r2 = m[6] ? Number(m[6]) - 1 : r1, c2 = m[5] ? colIndex(m[5].toUpperCase()) : c1;
    return { sheet: m[1] ? m[1].replace(/''/g, "'") : m[2] || null, r1: Math.min(r1, r2), c1: Math.min(c1, c2), r2: Math.max(r1, r2), c2: Math.max(c1, c2) };
}

// ---- finance ----------------------------------------------------------------------------------------------------------------------------------------

function pmt(rate, nper, pv, fv, type) {
    if (rate === 0) return -(pv + fv) / nper;
    const f = Math.pow(1 + rate, nper);
    return -(rate * (pv * f + fv)) / ((1 + rate * type) * (f - 1));
}
const npv = (rate, flows) => flows.reduce((sum, v, i) => sum + v / Math.pow(1 + rate, i + 1), 0);

export function registerMore(def) {
    // SUMPRODUCT(a, b, ...): the arrays multiplied cell by cell and summed; text and empty cells count as 0; the arrays must be the same size
    def("SUMPRODUCT", 1, 255, (a) => {
        const arrays = a.map((v) => (isRange(v) ? v : new XlArray([[v]])));
        const rows = arrays[0].rows, cols = arrays[0].cols;
        if (arrays.some((x) => x.rows !== rows || x.cols !== cols)) return ERR.VALUE;
        let sum = 0;
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
            let p = 1;
            for (const x of arrays) {
                const v = x.at(r, c);
                if (isError(v)) return v;
                p *= typeof v === "number" ? v : typeof v === "boolean" && a.length === 1 ? Number(v) : 0;
            }
            sum += p;
        }
        return roundSig(sum);
    }, { errors: true });

    def("MROUND", 2, 2, (a) => {
        const n = num(a[0]), m = num(a[1]);
        if (isError(n)) return n;
        if (isError(m)) return m;
        if (m === 0) return 0;
        if (n * m < 0) return ERR.NUM;
        return roundSig(Math.round(n / m + 1e-12 * Math.sign(n / m)) * m);
    });

    // LOOKUP(value, lookup range, [result range]): the last value in the sorted lookup range that is not more than the value
    def("LOOKUP", 2, 3, (a) => {
        const keys = valuesOf(a[1]);
        const results = a.length > 2 ? valuesOf(a[2]) : keys;
        let found = -1;
        for (let i = 0; i < keys.length; i++) {
            if (keys[i] === null || keys[i] === undefined || isError(keys[i])) continue;
            if ((typeof keys[i] === "number") !== (typeof a[0] === "number")) continue;
            if (compare(keys[i], a[0]) <= 0) found = i; else break;
        }
        return found < 0 || found >= results.length ? ERR.NA : results[found];
    });

    // ---- dates
    def("DAYS", 2, 2, (a) => { const e = num(a[0]), s = num(a[1]); if (isError(e)) return e; if (isError(s)) return s; return Math.floor(e) - Math.floor(s); });
    def("EOMONTH", 2, 2, (a) => {
        const s = num(a[0]), m = int(a[1]);
        if (isError(s)) return s;
        if (isError(m)) return m;
        const d = day(s);
        return dateToSerial(new Date(d.getFullYear(), d.getMonth() + m + 1, 0));
    });
    // WEEKNUM(date, [type]): 1 (default) weeks start on Sunday, 2 on Monday; the week holding 1 January is week 1. ISOWEEKNUM: the ISO week
    def("WEEKNUM", 1, 2, (a) => {
        const s = num(a[0]), type = a.length > 1 ? int(a[1]) : 1;
        if (isError(s)) return s;
        if (type === 21) return isoWeek(s);
        const start = type === 2 || type === 11 ? 1 : 0;
        const jan1 = dateToSerial(new Date(day(s).getFullYear(), 0, 1));
        const offset = (weekdayOf(jan1) - start + 7) % 7;
        return Math.floor((Math.floor(s) - jan1 + offset) / 7) + 1;
    });
    // ISO 8601: weeks start on Monday, and week 1 is the one that holds the year's first Thursday
    const isoWeek = (s) => {
        const thursday = Math.floor(s) - ((weekdayOf(s) + 6) % 7) + 3;
        const jan1 = dateToSerial(new Date(day(thursday).getFullYear(), 0, 1));
        return Math.floor((thursday - jan1) / 7) + 1;
    };
    def("ISOWEEKNUM", 1, 1, (a) => { const s = num(a[0]); return isError(s) ? s : isoWeek(s); });
    // WORKDAY(start, days, [holidays]): the working day so many working days after (or before) the start, skipping Saturdays, Sundays and holidays
    def("WORKDAY", 2, 3, (a) => {
        let s = num(a[0]); const n = int(a[1]);
        if (isError(s)) return s;
        if (isError(n)) return n;
        const off = holidaysOf(a[2]);
        s = Math.floor(s);
        const step = n < 0 ? -1 : 1;
        for (let left = Math.abs(n); left > 0;) { s += step; if (!weekend(s) && !off.has(s)) left--; }
        return s;
    }, { errors: true });
    // NETWORKDAYS(start, end, [holidays]): the working days from start to end, both counted
    def("NETWORKDAYS", 2, 3, (a) => {
        const s = num(a[0]), e = num(a[1]);
        if (isError(s)) return s;
        if (isError(e)) return e;
        const off = holidaysOf(a[2]);
        const lo = Math.floor(Math.min(s, e)), hi = Math.floor(Math.max(s, e));
        let count = 0;
        for (let d = lo; d <= hi; d++) if (!weekend(d) && !off.has(d)) count++;
        return e < s ? -count : count;
    }, { errors: true });

    // ---- finance: loans and cash flows, as Excel signs them (money paid out is negative)
    def("PMT", 3, 5, (a) => {
        const [rate, nper, pv, fv, type] = [num(a[0]), num(a[1]), num(a[2]), a.length > 3 ? num(a[3]) : 0, a.length > 4 ? num(a[4]) : 0];
        const bad = [rate, nper, pv, fv, type].find(isError);
        if (bad) return bad;
        return nper === 0 ? ERR.NUM : roundSig(pmt(rate, nper, pv, fv, type ? 1 : 0));
    });
    def("FV", 3, 5, (a) => {
        const [rate, nper, p, pv, type] = [num(a[0]), num(a[1]), num(a[2]), a.length > 3 ? num(a[3]) : 0, a.length > 4 ? num(a[4]) : 0];
        const bad = [rate, nper, p, pv, type].find(isError);
        if (bad) return bad;
        if (rate === 0) return roundSig(-(pv + p * nper));
        const f = Math.pow(1 + rate, nper);
        return roundSig(-(pv * f + p * (1 + rate * (type ? 1 : 0)) * (f - 1) / rate));
    });
    def("PV", 3, 5, (a) => {
        const [rate, nper, p, fv, type] = [num(a[0]), num(a[1]), num(a[2]), a.length > 3 ? num(a[3]) : 0, a.length > 4 ? num(a[4]) : 0];
        const bad = [rate, nper, p, fv, type].find(isError);
        if (bad) return bad;
        if (rate === 0) return roundSig(-(fv + p * nper));
        const f = Math.pow(1 + rate, nper);
        return roundSig(-(fv + p * (1 + rate * (type ? 1 : 0)) * (f - 1) / rate) / f);
    });
    def("NPV", 2, 255, (a) => {
        const rate = num(a[0]);
        if (isError(rate)) return rate;
        const flows = [];
        for (const v of a.slice(1)) for (const x of valuesOf(v)) { if (isError(x)) return x; if (typeof x === "number") flows.push(x); }
        return roundSig(npv(rate, flows));
    }, { errors: true });
    // IRR(values, [guess]): the rate at which the cash flows (the first one now, then one per period) are worth nothing, found by Newton's method
    def("IRR", 1, 2, (a) => {
        const flows = valuesOf(a[0]).filter((x) => typeof x === "number");
        if (!flows.some((x) => x > 0) || !flows.some((x) => x < 0)) return ERR.NUM;
        let r = a.length > 1 ? num(a[1]) : 0.1;
        if (isError(r)) return r;
        for (let i = 0; i < 100; i++) {
            let f = 0, df = 0;
            flows.forEach((v, t) => { f += v / Math.pow(1 + r, t); df -= (t * v) / Math.pow(1 + r, t + 1); });
            if (Math.abs(f) < 1e-9) return roundSig(r);
            if (df === 0) return ERR.NUM;
            r -= f / df;
            if (!isFinite(r) || r <= -1) return ERR.NUM;
        }
        return ERR.NUM;
    });

    // ---- references
    // OFFSET(reference, rows, cols, [height], [width]): the range so many rows and columns away from the reference, of its size or of the size asked
    def("OFFSET", 3, 5, (a, ctx) => {
        const ref = a[0];
        if (!isRange(ref) || ref.s === undefined) return ERR.VALUE;
        const dr = int(a[1]), dc = int(a[2]);
        const h = a.length > 3 && a[3] !== null ? int(a[3]) : ref.rows, w = a.length > 4 && a[4] !== null ? int(a[4]) : ref.cols;
        const bad = [dr, dc, h, w].find(isError);
        if (bad) return bad;
        if (h < 1 || w < 1) return ERR.REF;
        const r1 = ref.r1 + dr, c1 = ref.c1 + dc;
        return ctx.rangeAt(ref.s, r1, c1, r1 + h - 1, c1 + w - 1);
    }, { refs: true });
    // INDIRECT(text): the cell or range the text names ("B2", "A1:C9", "Produk!B2")
    def("INDIRECT", 1, 2, (a, ctx) => {
        const at = parseRef(toText(a[0]));
        if (!at) return ERR.REF;
        const s = at.sheet ? ctx.sheetByName(at.sheet) : ctx.at.s;
        if (!s) return ERR.REF;
        return ctx.rangeAt(s, at.r1, at.c1, at.r2, at.c2);
    });
    // TRANSPOSE(range): rows become columns
    def("TRANSPOSE", 1, 1, (a) => {
        const v = a[0];
        if (!isRange(v)) return v;
        const m = [];
        for (let c = 0; c < v.cols; c++) { const row = []; for (let r = 0; r < v.rows; r++) row.push(v.at(r, c)); m.push(row); }
        return new XlArray(m);
    });
    // HYPERLINK(url, [text]): the text shows (the link itself is a cell's style: link)
    def("HYPERLINK", 1, 2, (a) => (a.length > 1 ? a[1] : a[0]));

    // ---- TERBILANG(amount, [unit]): the amount in Indonesian words, for receipts and payment certificates. Decimals are read digit by digit
    // ("koma lima"); a negative amount is "minus ...". The unit, when given, goes at the end: TERBILANG(1250000, "rupiah").
    def("TERBILANG", 1, 2, (a) => {
        const n = num(a[0]);
        if (isError(n)) return n;
        if (Math.abs(n) >= 1e18) return ERR.NUM;
        const unit = a.length > 1 && a[1] !== null ? " " + toText(a[1]) : "";
        const text = roundSig(Math.abs(n)).toString();
        const [whole, frac] = text.includes("e") ? [String(Math.floor(Math.abs(n))), ""] : text.split(".");
        let words = terbilang(Number(whole));
        if (frac) words += " koma " + [...frac].map((d) => (d === "0" ? "nol" : SATUAN[Number(d)])).join(" ");
        return (n < 0 ? "minus " : "") + words + unit;
    });
}
