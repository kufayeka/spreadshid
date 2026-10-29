// Still more functions of the formulas, the ones a construction or finance sheet reaches for after the basics:
//   - finance: how long and at what rate a loan runs (NPER, RATE), a payment split into interest and principal (IPMT, PPMT, CUMIPMT, CUMPRINC),
//     cash flows on their own dates (XNPV, XIRR), MIRR, depreciation (SLN, DB, DDB, SYD), and nominal against effective interest (EFFECT, NOMINAL);
//   - construction: angles (SIN ... ATAN2, RADIANS, DEGREES), whole pieces and multiples (QUOTIENT, EVEN, ODD, CEILING.MATH, FLOOR.MATH), SUMSQ,
//     and units (CONVERT);
//   - schedules: working days with any weekend (WORKDAY.INTL, NETWORKDAYS.INTL), YEARFRAC, DAYS360, dates and times written as text (DATEVALUE,
//     TIMEVALUE);
//   - analysis: a straight line through the past (FORECAST, TREND, SLOPE, INTERCEPT, CORREL), spread (PERCENTILE, QUARTILE, MODE), AGGREGATE;
//   - text and checks for imported data: TEXTBEFORE, TEXTAFTER, NUMBERVALUE, FIXED, CHAR, CODE, CLEAN, ISEVEN, ISODD, ISERR, ISFORMULA, NA,
//     ERROR.TYPE.
// Every one gives the answer Excel gives (test/formulas-extra.test.js holds Excel's own numbers). Pure (no DOM). registerExtra(def, FUNCTIONS) puts
// them in the table of functions (xlfuncs.js).
import { ERR, XlArray, XlRange, isError, isRange, toNumber, toText, roundSig, dateToSerial, serialToDate } from "./xlvalue.js";
import { readDate, readTime } from "../input.js";
import { localeInfo } from "../format.js";

// ---- reading arguments ---------------------------------------------------------------------------------------------------------------------------

const num = (v) => (isRange(v) ? toNumber(v.at(0, 0)) : toNumber(v));
const int = (v) => { const n = num(v); return isError(n) ? n : Math.trunc(n); };
// an optional argument: its default when it is left out or empty
const opt = (a, i, d) => (a.length > i && a[i] !== null && a[i] !== undefined ? num(a[i]) : d);
const valuesOf = (v) => (isRange(v) ? v.values() : [v]);
// the first error among already read numbers, if there is one
const firstError = (...xs) => xs.find(isError);
// the numbers of a range or of plain arguments, as SUM reads them (text and empty cells in a range are left out)
function numbersOf(args) {
    const out = [];
    for (const a of args) {
        if (isRange(a)) { for (const v of a.values()) { if (isError(v)) return { error: v }; if (typeof v === "number") out.push(v); } }
        else if (a !== null && a !== undefined) { const n = toNumber(a); if (isError(n)) return { error: n }; out.push(n); }
    }
    return { nums: out };
}
// the pairs (y, x) where both are numbers, as SLOPE and CORREL read two ranges of the same size
function pairsOf(ys, xs) {
    const a = valuesOf(ys), b = valuesOf(xs);
    if (a.length !== b.length) return { error: ERR.NA };
    const y = [], x = [];
    for (let i = 0; i < a.length; i++) {
        if (isError(a[i])) return { error: a[i] };
        if (isError(b[i])) return { error: b[i] };
        if (typeof a[i] === "number" && typeof b[i] === "number") { y.push(a[i]); x.push(b[i]); }
    }
    return { y, x };
}
const mean = (xs) => xs.reduce((s, v) => s + v, 0) / xs.length;
// the straight line that fits the pairs best (least squares): { slope, intercept }, or an error when the x values do not vary
function fitLine(y, x) {
    if (y.length < 2) return { error: ERR.DIV0 };
    const my = mean(y), mx = mean(x);
    let sxy = 0, sxx = 0;
    for (let i = 0; i < y.length; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; }
    if (sxx === 0) return { error: ERR.DIV0 };
    const slope = sxy / sxx;
    return { slope, intercept: my - slope * mx };
}

// ---- finance --------------------------------------------------------------------------------------------------------------------------------------

// The payment of a loan, the future value and the interest part of a payment, signed as Excel signs money (paid out is negative).
function pmtOf(rate, nper, pv, fv, type) {
    if (rate === 0) return -(pv + fv) / nper;
    const f = Math.pow(1 + rate, nper);
    return -(rate * (pv * f + fv)) / ((1 + rate * type) * (f - 1));
}
function fvOf(rate, nper, pmt, pv, type) {
    if (rate === 0) return -(pv + pmt * nper);
    const f = Math.pow(1 + rate, nper);
    return -(pv * f + pmt * (1 + rate * type) * (f - 1) / rate);
}
// the interest in payment number `per` (1 is the first): what the balance left after the payments before it earns in one period
function ipmtOf(rate, per, nper, pv, fv, type) {
    const pmt = pmtOf(rate, nper, pv, fv, type);
    let interest;
    if (per === 1) interest = type === 1 ? 0 : -pv;
    else interest = type === 1 ? fvOf(rate, per - 2, pmt, pv, 1) - pmt : fvOf(rate, per - 1, pmt, pv, 0);
    return interest * rate;
}
// a root by Newton's method from a guess, the slope taken from a small step; null when it does not settle
function solve(f, guess) {
    let x = guess;
    for (let i = 0; i < 200; i++) {
        const y = f(x);
        if (!isFinite(y)) return null;
        if (Math.abs(y) < 1e-10) return x;
        const h = Math.max(1e-7, Math.abs(x) * 1e-7);
        const d = (f(x + h) - y) / h;
        if (!d || !isFinite(d)) return null;
        const next = x - y / d;
        if (!isFinite(next)) return null;
        if (Math.abs(next - x) < 1e-12) return next;
        x = next;
    }
    return null;
}
// the cash flows and their dates for XNPV and XIRR: the same count, the dates not before the first one
function datedFlows(values, dates) {
    const v = valuesOf(values), d = valuesOf(dates);
    if (v.length !== d.length || !v.length) return { error: ERR.NUM };
    for (const x of v.concat(d)) { if (isError(x)) return { error: x }; if (typeof x !== "number") return { error: ERR.VALUE }; }
    const days = d.map(Math.floor);
    if (days.some((x) => x < days[0])) return { error: ERR.NUM };
    return { v, t: days.map((x) => (x - days[0]) / 365) };
}
const xnpv = (rate, f) => f.v.reduce((s, x, i) => s + x / Math.pow(1 + rate, f.t[i]), 0);

// ---- units (CONVERT) ------------------------------------------------------------------------------------------------------------------------------

// Each unit by what one of it is in the base unit of its kind, Excel's names. `p`: a metric unit that takes a prefix (k for kilo, m for milli ...).
const UNITS = {
    // length, in metres
    m: ["length", 1, true], in: ["length", 0.0254], ft: ["length", 0.3048], yd: ["length", 0.9144], mi: ["length", 1609.344], Nmi: ["length", 1852],
    ang: ["length", 1e-10, true], ell: ["length", 1.143],
    // mass, in grams. Note: Excel's "ton" is the US short ton (2000 lbm); a metric tonne is "Mg" (megagram) or 1000 "kg"
    g: ["mass", 1, true], lbm: ["mass", 453.59237], ozm: ["mass", 28.349523125], ton: ["mass", 907184.74], uk_ton: ["mass", 1016046.9088],
    stone: ["mass", 6350.29318], grain: ["mass", 0.06479891], u: ["mass", 1.66053886e-24, true],
    // area, in square metres
    m2: ["area", 1, true], ft2: ["area", 0.09290304], in2: ["area", 0.00064516], yd2: ["area", 0.83612736], mi2: ["area", 2589988.110336],
    ha: ["area", 10000], ar: ["area", 100, true], us_acre: ["area", 4046.87260987425], uk_acre: ["area", 4046.8564224],
    // volume, in cubic metres
    m3: ["volume", 1, true], l: ["volume", 0.001, true], L: ["volume", 0.001, true], lt: ["volume", 0.001, true], ft3: ["volume", 0.028316846592],
    in3: ["volume", 1.6387064e-5], yd3: ["volume", 0.764554857984], gal: ["volume", 0.003785411784], uk_gal: ["volume", 0.00454609],
    barrel: ["volume", 0.158987294928], qt: ["volume", 0.000946352946], pt: ["volume", 0.000473176473],
    // pressure, in pascals
    Pa: ["pressure", 1, true], p: ["pressure", 1, true], atm: ["pressure", 101325, true], at: ["pressure", 101325, true], mmHg: ["pressure", 133.322, true],
    psi: ["pressure", 6894.75729316836], Torr: ["pressure", 133.322368421053],
    // force, in newtons
    N: ["force", 1, true], dyn: ["force", 1e-5, true], dy: ["force", 1e-5, true], lbf: ["force", 4.4482216152605], pond: ["force", 0.00980665, true],
    // energy, in joules
    J: ["energy", 1, true], e: ["energy", 1e-7, true], c: ["energy", 4.184, true], cal: ["energy", 4.1868, true], eV: ["energy", 1.602176487e-19, true],
    HPh: ["energy", 2684519.53769617], Wh: ["energy", 3600, true], BTU: ["energy", 1055.05585262], flb: ["energy", 1.3558179483314],
    // power, in watts
    W: ["power", 1, true], w: ["power", 1, true], HP: ["power", 745.69987158227], h: ["power", 745.69987158227], PS: ["power", 735.49875],
    // time, in seconds
    sec: ["time", 1, true], s: ["time", 1, true], mn: ["time", 60], min: ["time", 60], hr: ["time", 3600], day: ["time", 86400], d: ["time", 86400],
    yr: ["time", 31557600],
    // speed, in metres per second
    "m/s": ["speed", 1, true], "m/sec": ["speed", 1, true], "m/h": ["speed", 1 / 3600, true], "m/hr": ["speed", 1 / 3600, true], mph: ["speed", 0.44704],
    kn: ["speed", 0.514444444444444], admkn: ["speed", 0.514773333333333],
};
const PREFIXES = { Y: 1e24, Z: 1e21, E: 1e18, P: 1e15, T: 1e12, G: 1e9, M: 1e6, k: 1e3, h: 1e2, da: 1e1, e: 1e1, d: 1e-1, c: 1e-2, m: 1e-3, u: 1e-6, n: 1e-9, p: 1e-12, f: 1e-15, a: 1e-18, z: 1e-21, y: 1e-24 };
const TEMPERATURES = { C: "C", cel: "C", F: "F", fah: "F", K: "K", kel: "K", Rank: "Rank", Reau: "Reau" };
// a unit name as { kind, factor }: the name itself, or a prefix before a metric unit; m2 and m3 take the prefix to their power (cm2 is 0.0001 m2)
function unitOf(name) {
    if (Object.prototype.hasOwnProperty.call(UNITS, name)) { const [kind, factor] = UNITS[name]; return { kind, factor }; }
    for (const pre of Object.keys(PREFIXES).sort((a, b) => b.length - a.length)) {
        if (!name.startsWith(pre)) continue;
        const rest = name.slice(pre.length);
        const u = Object.prototype.hasOwnProperty.call(UNITS, rest) ? UNITS[rest] : null;
        if (!u || !u[2]) continue;
        const power = rest === "m2" ? 2 : rest === "m3" ? 3 : 1;
        return { kind: u[0], factor: u[1] * Math.pow(PREFIXES[pre], power) };
    }
    return null;
}
// a temperature in kelvin, and back
const toKelvin = { C: (x) => x + 273.15, F: (x) => (x - 32) * 5 / 9 + 273.15, K: (x) => x, Rank: (x) => x * 5 / 9, Reau: (x) => x * 1.25 + 273.15 };
const fromKelvin = { C: (x) => x - 273.15, F: (x) => (x - 273.15) * 9 / 5 + 32, K: (x) => x, Rank: (x) => x * 9 / 5, Reau: (x) => (x - 273.15) / 1.25 };

// ---- working days with any weekend -----------------------------------------------------------------------------------------------------------------

// the day of the week of a day number (day 0, 30 December 1899, was a Saturday): 0 Sunday ... 6 Saturday
const weekdayOf = (serial) => (Math.floor(serial) + 6) % 7;
// The weekend of WORKDAY.INTL and NETWORKDAYS.INTL as the set of the days off (0 Sunday ... 6 Saturday). A number: 1 Saturday and Sunday (the
// default), 2 Sunday and Monday ... 7 Friday and Saturday, 11 Sunday only ... 17 Saturday only. A text of seven 0/1 from Monday to Sunday,
// 1 a day off: "0000001" is Sunday only, the six-day week of many sites.
function weekendOf(v) {
    if (v === undefined || v === null) return new Set([0, 6]);
    if (typeof v === "string") {
        if (!/^[01]{7}$/.test(v) || v === "1111111") return ERR.VALUE;
        const off = new Set();
        [...v].forEach((ch, i) => { if (ch === "1") off.add((i + 1) % 7); });
        return off;
    }
    const n = num(v);
    if (isError(n)) return n;
    if (n >= 1 && n <= 7) { const first = (n + 5) % 7; return new Set([first, (first + 1) % 7]); }
    if (n >= 11 && n <= 17) return new Set([(n - 11) % 7]);
    return ERR.NUM;
}
function holidaysOf(v) {
    const out = new Set();
    if (v === undefined || v === null) return out;
    for (const x of valuesOf(v)) { if (typeof x === "number") out.add(Math.floor(x)); }
    return out;
}

// ---- spread ---------------------------------------------------------------------------------------------------------------------------------------

// the k-th percentile of the numbers (k from 0 to 1), drawn between the two neighbours as Excel does; `exclusive`: PERCENTILE.EXC
function percentile(nums, k, exclusive) {
    if (!nums.length) return ERR.NUM;
    const s = nums.slice().sort((a, b) => a - b), n = s.length;
    if (exclusive) {
        const r = k * (n + 1);
        if (k <= 0 || k >= 1 || r < 1 || r > n) return ERR.NUM;
        const i = Math.floor(r);
        return roundSig(i >= n ? s[n - 1] : s[i - 1] + (r - i) * (s[i] - s[i - 1]));
    }
    if (k < 0 || k > 1) return ERR.NUM;
    const r = k * (n - 1), i = Math.floor(r);
    return roundSig(i + 1 >= n ? s[n - 1] : s[i] + (r - i) * (s[i + 1] - s[i]));
}
// the number that comes most often (the first one met when there is a tie), #N/A when none comes twice
function modeOf(nums) {
    const count = new Map();
    let best = null, most = 1;
    for (const x of nums) {
        const c = (count.get(x) || 0) + 1;
        count.set(x, c);
        if (c > most) { most = c; best = x; }
    }
    // a tie keeps the number met first in the list, not the one that reached the count first
    if (best === null) return ERR.NA;
    return nums.find((x) => count.get(x) === most);
}

// ---- text -----------------------------------------------------------------------------------------------------------------------------------------

// where the delimiter stands for TEXTBEFORE and TEXTAFTER: { at, length } of the n-th one (from the end when n is negative), or null
function delimiterAt(text, delim, n, caseless, matchEnd) {
    const hay = caseless ? text.toLowerCase() : text, needle = caseless ? delim.toLowerCase() : delim;
    const spots = [];
    if (needle === "") spots.push(n > 0 ? 0 : text.length);
    else for (let i = hay.indexOf(needle); i >= 0; i = hay.indexOf(needle, i + needle.length)) spots.push(i);
    // match_end: the end of the text counts as one more delimiter (the start, counted from the end)
    if (matchEnd && needle !== "") { if (n > 0) spots.push(text.length); else spots.unshift(0); }
    const i = n > 0 ? n - 1 : spots.length + n;
    if (i < 0 || i >= spots.length) return null;
    const at = spots[i];
    const length = matchEnd && ((n > 0 && at === text.length) || (n < 0 && at === 0 && hay.slice(0, needle.length) !== needle)) ? 0 : needle.length;
    return { at, length };
}
const ERROR_NUMBER = { "#NULL!": 1, "#DIV/0!": 2, "#VALUE!": 3, "#REF!": 4, "#NAME?": 5, "#NUM!": 6, "#N/A": 7 };

// the AGGREGATE functions by their numbers; 14 to 19 take one more argument (k)
const AGGREGATE_OF = { 1: "AVERAGE", 2: "COUNT", 3: "COUNTA", 4: "MAX", 5: "MIN", 6: "PRODUCT", 7: "STDEV.S", 8: "STDEV.P", 9: "SUM", 10: "VAR.S",
    11: "VAR.P", 12: "MEDIAN", 13: "MODE.SNGL", 14: "LARGE", 15: "SMALL", 16: "PERCENTILE.INC", 17: "QUARTILE.INC", 18: "PERCENTILE.EXC", 19: "QUARTILE.EXC" };

/**
 * @param {(names: string | string[], min: number, max: number, fn: Function, opts?: object) => void} def
 * @param {Record<string, { fn: Function, errors?: boolean }>} FUNCTIONS  The table, for AGGREGATE to call the function it is asked for.
 */
export function registerExtra(def, FUNCTIONS) {
    // ---- finance: loans
    // NPER(rate, payment, present value, [future value], [type]): how many periods the loan runs
    def("NPER", 3, 5, (a) => {
        const rate = num(a[0]), pmt = num(a[1]), pv = num(a[2]), fv = opt(a, 3, 0), type = opt(a, 4, 0) ? 1 : 0;
        const bad = firstError(rate, pmt, pv, fv);
        if (bad) return bad;
        if (rate === 0) return pmt === 0 ? ERR.NUM : roundSig(-(pv + fv) / pmt);
        const z = pmt * (1 + rate * type) / rate;
        const r = Math.log((z - fv) / (z + pv)) / Math.log(1 + rate);
        return isFinite(r) ? roundSig(r) : ERR.NUM;
    });
    // RATE(periods, payment, present value, [future value], [type], [guess]): the rate per period that makes the loan come out even
    def("RATE", 3, 6, (a) => {
        const nper = num(a[0]), pmt = num(a[1]), pv = num(a[2]), fv = opt(a, 3, 0), type = opt(a, 4, 0) ? 1 : 0, guess = opt(a, 5, 0.1);
        const bad = firstError(nper, pmt, pv, fv, guess);
        if (bad) return bad;
        if (nper <= 0) return ERR.NUM;
        const f = (r) => (Math.abs(r) < 1e-12 ? pv + pmt * nper + fv : pv * Math.pow(1 + r, nper) + pmt * (1 + r * type) * (Math.pow(1 + r, nper) - 1) / r + fv);
        const r = solve(f, guess);
        return r === null || r <= -1 ? ERR.NUM : roundSig(r);
    });
    // IPMT and PPMT(rate, period, periods, present value, [future value], [type]): the interest and the principal in one payment
    const splitArgs = (a) => {
        const v = [num(a[0]), int(a[1]), num(a[2]), num(a[3]), opt(a, 4, 0), opt(a, 5, 0)];
        const bad = firstError(...v);
        if (bad) return { error: bad };
        const [rate, per, nper, pv, fv, type] = v;
        if (per < 1 || per > nper) return { error: ERR.NUM };
        return { rate, per, nper, pv, fv, type: type ? 1 : 0 };
    };
    def("IPMT", 4, 6, (a) => { const x = splitArgs(a); return x.error || roundSig(ipmtOf(x.rate, x.per, x.nper, x.pv, x.fv, x.type)); });
    def("PPMT", 4, 6, (a) => {
        const x = splitArgs(a);
        return x.error || roundSig(pmtOf(x.rate, x.nper, x.pv, x.fv, x.type) - ipmtOf(x.rate, x.per, x.nper, x.pv, x.fv, x.type));
    });
    // CUMIPMT and CUMPRINC(rate, periods, present value, first period, last period, type): the interest or principal paid over those periods
    const cumulative = (a, part) => {
        const v = [num(a[0]), num(a[1]), num(a[2]), int(a[3]), int(a[4]), int(a[5])];
        const bad = firstError(...v);
        if (bad) return bad;
        const [rate, nper, pv, first, last, type] = v;
        if (rate <= 0 || nper <= 0 || pv <= 0 || first < 1 || last < first || last > nper || (type !== 0 && type !== 1)) return ERR.NUM;
        const pmt = pmtOf(rate, nper, pv, 0, type);
        let sum = 0;
        for (let p = first; p <= last; p++) { const i = ipmtOf(rate, p, nper, pv, 0, type); sum += part === "interest" ? i : pmt - i; }
        return roundSig(sum);
    };
    def("CUMIPMT", 6, 6, (a) => cumulative(a, "interest"));
    def("CUMPRINC", 6, 6, (a) => cumulative(a, "principal"));
    // EFFECT(nominal rate, periods a year) and NOMINAL(effective rate, periods a year)
    def("EFFECT", 2, 2, (a) => {
        const r = num(a[0]), n = int(a[1]);
        const bad = firstError(r, n);
        if (bad) return bad;
        return r <= 0 || n < 1 ? ERR.NUM : roundSig(Math.pow(1 + r / n, n) - 1);
    });
    def("NOMINAL", 2, 2, (a) => {
        const r = num(a[0]), n = int(a[1]);
        const bad = firstError(r, n);
        if (bad) return bad;
        return r <= 0 || n < 1 ? ERR.NUM : roundSig(n * (Math.pow(1 + r, 1 / n) - 1));
    });

    // ---- finance: cash flows
    // XNPV(rate, values, dates): the cash flows on their own dates, each brought back to the first date (a year is 365 days)
    def("XNPV", 3, 3, (a) => {
        const rate = num(a[0]);
        if (isError(rate)) return rate;
        const f = datedFlows(a[1], a[2]);
        return f.error || roundSig(xnpv(rate, f));
    }, { errors: true });
    // XIRR(values, dates, [guess]): the rate at which those cash flows are worth nothing
    def("XIRR", 2, 3, (a) => {
        const f = datedFlows(a[0], a[1]);
        if (f.error) return f.error;
        if (!f.v.some((x) => x > 0) || !f.v.some((x) => x < 0)) return ERR.NUM;
        const guess = opt(a, 2, 0.1);
        if (isError(guess)) return guess;
        const r = solve((x) => (x <= -1 ? NaN : xnpv(x, f)), guess);
        return r === null || r <= -1 ? ERR.NUM : roundSig(r);
    }, { errors: true });
    // MIRR(values, finance rate, reinvestment rate): what is paid out costs the finance rate, what comes in earns the reinvestment rate
    def("MIRR", 3, 3, (a) => {
        const flows = valuesOf(a[0]).filter((x) => typeof x === "number");
        const fr = num(a[1]), rr = num(a[2]);
        const bad = firstError(fr, rr);
        if (bad) return bad;
        const n = flows.length;
        if (!flows.some((x) => x > 0) || !flows.some((x) => x < 0)) return ERR.DIV0;
        let pvOut = 0, fvIn = 0;
        flows.forEach((x, t) => { if (x < 0) pvOut += x / Math.pow(1 + fr, t); else fvIn += x * Math.pow(1 + rr, n - 1 - t); });
        return roundSig(Math.pow(-fvIn / pvOut, 1 / (n - 1)) - 1);
    });

    // ---- finance: depreciation of an asset (a machine, a truck, an excavator)
    // SLN(cost, salvage, life): the same every period
    def("SLN", 3, 3, (a) => {
        const c = num(a[0]), s = num(a[1]), l = num(a[2]);
        const bad = firstError(c, s, l);
        if (bad) return bad;
        return l === 0 ? ERR.DIV0 : roundSig((c - s) / l);
    });
    // SYD(cost, salvage, life, period): sum of the years' digits, more in the first years
    def("SYD", 4, 4, (a) => {
        const c = num(a[0]), s = num(a[1]), l = num(a[2]), p = num(a[3]);
        const bad = firstError(c, s, l, p);
        if (bad) return bad;
        if (l <= 0 || p <= 0 || p > l) return ERR.NUM;
        return roundSig((c - s) * (l - p + 1) * 2 / (l * (l + 1)));
    });
    // DDB(cost, salvage, life, period, [factor]): double declining balance (factor 2), never below the salvage value
    def("DDB", 4, 5, (a) => {
        const c = num(a[0]), s = num(a[1]), l = num(a[2]), p = num(a[3]), factor = opt(a, 4, 2);
        const bad = firstError(c, s, l, p, factor);
        if (bad) return bad;
        if (c < 0 || s < 0 || l <= 0 || p <= 0 || p > l || factor <= 0) return ERR.NUM;
        let total = 0, dep = 0;
        for (let i = 1; i <= Math.ceil(p); i++) { dep = Math.max(0, Math.min((c - total) * factor / l, c - s - total)); total += dep; }
        return roundSig(dep);
    });
    // DB(cost, salvage, life, period, [months in the first year]): fixed declining balance, its rate rounded to three decimals as Excel does
    def("DB", 4, 5, (a) => {
        const c = num(a[0]), s = num(a[1]), l = int(a[2]), p = int(a[3]), month = opt(a, 4, 12);
        const bad = firstError(c, s, l, p, month);
        if (bad) return bad;
        if (c < 0 || s < 0 || l <= 0 || p <= 0 || month < 1 || month > 12 || p > l + (month < 12 ? 1 : 0)) return ERR.NUM;
        if (c === 0) return 0;
        const rate = Math.round((1 - Math.pow(s / c, 1 / l)) * 1000) / 1000;
        let total = c * rate * month / 12;
        if (p === 1) return roundSig(total);
        for (let i = 2; i <= p; i++) {
            const dep = i === l + 1 ? (c - total) * rate * (12 - month) / 12 : (c - total) * rate;
            if (i === p) return roundSig(dep);
            total += dep;
        }
        return ERR.NUM;
    });

    // ---- construction: angles (in radians, as in Excel; RADIANS and DEGREES turn them)
    const one = (name, f, ok) => def(name, 1, 1, (a) => { const x = num(a[0]); if (isError(x)) return x; if (ok && !ok(x)) return ERR.NUM; return roundSig(f(x)); });
    one("SIN", Math.sin); one("COS", Math.cos); one("TAN", Math.tan);
    one("ASIN", Math.asin, (x) => x >= -1 && x <= 1); one("ACOS", Math.acos, (x) => x >= -1 && x <= 1); one("ATAN", Math.atan);
    one("RADIANS", (x) => x * Math.PI / 180); one("DEGREES", (x) => x * 180 / Math.PI);
    // ATAN2(x, y): the angle of the point (x, y), x first as in Excel
    def("ATAN2", 2, 2, (a) => {
        const x = num(a[0]), y = num(a[1]);
        const bad = firstError(x, y);
        if (bad) return bad;
        return x === 0 && y === 0 ? ERR.DIV0 : roundSig(Math.atan2(y, x));
    });

    // ---- construction: whole pieces and multiples
    // QUOTIENT(numerator, denominator): the whole part of the division (how many full bars of 12 m in 100 m)
    def("QUOTIENT", 2, 2, (a) => {
        const n = num(a[0]), d = num(a[1]);
        const bad = firstError(n, d);
        if (bad) return bad;
        return d === 0 ? ERR.DIV0 : Math.trunc(roundSig(n / d));
    });
    // EVEN and ODD: up (away from zero) to the next even or odd whole number
    def("EVEN", 1, 1, (a) => { const x = num(a[0]); if (isError(x)) return x; const r = Math.ceil(roundSig(Math.abs(x)) / 2) * 2; return x < 0 ? -r : r; });
    def("ODD", 1, 1, (a) => {
        const x = num(a[0]);
        if (isError(x)) return x;
        let r = Math.ceil(roundSig(Math.abs(x)));
        if (r % 2 === 0) r += 1;
        return x < 0 ? -r : r;
    });
    // CEILING.MATH(number, [significance], [mode]): up to a multiple; a negative number goes toward zero, or away from it when mode is not 0
    def("CEILING.MATH", 1, 3, (a) => {
        const x = num(a[0]), sig = Math.abs(opt(a, 1, 1)), mode = opt(a, 2, 0);
        const bad = firstError(x, sig, mode);
        if (bad) return bad;
        if (sig === 0) return 0;
        const q = roundSig(Math.abs(x) / sig);
        return roundSig(x >= 0 ? Math.ceil(q) * sig : mode ? -Math.ceil(q) * sig : -Math.floor(q) * sig);
    });
    // FLOOR.MATH(number, [significance], [mode]): down to a multiple; a negative number goes away from zero, or toward it when mode is not 0
    def("FLOOR.MATH", 1, 3, (a) => {
        const x = num(a[0]), sig = Math.abs(opt(a, 1, 1)), mode = opt(a, 2, 0);
        const bad = firstError(x, sig, mode);
        if (bad) return bad;
        if (sig === 0) return 0;
        const q = roundSig(Math.abs(x) / sig);
        return roundSig(x >= 0 ? Math.floor(q) * sig : mode ? -Math.floor(q) * sig : -Math.ceil(q) * sig);
    });
    // SUMSQ(numbers...): the sum of the squares
    def("SUMSQ", 1, 255, (a) => { const r = numbersOf(a); return r.error || roundSig(r.nums.reduce((s, x) => s + x * x, 0)); });
    // CONVERT(number, from, to): a measure in another unit of the same kind ("m" to "ft", "kg" to "lbm", "m3" to "l", "C" to "F")
    def("CONVERT", 3, 3, (a) => {
        const x = num(a[0]);
        if (isError(x)) return x;
        const from = toText(a[1]), to = toText(a[2]);
        if (TEMPERATURES[from] || TEMPERATURES[to]) {
            if (!TEMPERATURES[from] || !TEMPERATURES[to]) return ERR.NA;
            return roundSig(fromKelvin[TEMPERATURES[to]](toKelvin[TEMPERATURES[from]](x)));
        }
        const f = unitOf(from), t = unitOf(to);
        if (!f || !t || f.kind !== t.kind) return ERR.NA;
        return roundSig(x * f.factor / t.factor);
    });

    // ---- schedules
    // WORKDAY.INTL(start, days, [weekend], [holidays]): as WORKDAY, with the weekend of the site (a code or "0000001")
    def("WORKDAY.INTL", 2, 4, (a) => {
        let s = num(a[0]); const n = int(a[1]);
        const bad = firstError(s, n);
        if (bad) return bad;
        const off = weekendOf(a.length > 2 ? a[2] : null);
        if (isError(off)) return off;
        const holidays = holidaysOf(a[3]);
        s = Math.floor(s);
        const step = n < 0 ? -1 : 1;
        for (let left = Math.abs(n); left > 0;) { s += step; if (!off.has(weekdayOf(s)) && !holidays.has(s)) left--; }
        return s;
    }, { errors: true });
    // NETWORKDAYS.INTL(start, end, [weekend], [holidays]): the working days from start to end, both counted
    def("NETWORKDAYS.INTL", 2, 4, (a) => {
        const s = num(a[0]), e = num(a[1]);
        const bad = firstError(s, e);
        if (bad) return bad;
        const off = weekendOf(a.length > 2 ? a[2] : null);
        if (isError(off)) return off;
        const holidays = holidaysOf(a[3]);
        const lo = Math.floor(Math.min(s, e)), hi = Math.floor(Math.max(s, e));
        let count = 0;
        for (let d = lo; d <= hi; d++) if (!off.has(weekdayOf(d)) && !holidays.has(d)) count++;
        return e < s ? -count : count;
    }, { errors: true });
    // DAYS360(start, end, [method]): days on a 360-day year of twelve 30-day months, the US way (FALSE) or the European way (TRUE)
    def("DAYS360", 2, 3, (a) => {
        const s = num(a[0]), e = num(a[1]);
        const bad = firstError(s, e);
        if (bad) return bad;
        const european = a.length > 2 && a[2] !== null && !!(typeof a[2] === "boolean" ? a[2] : num(a[2]));
        const d1 = serialToDate(Math.floor(s)), d2 = serialToDate(Math.floor(e));
        let sd = d1.getDate(), ed = d2.getDate();
        if (european) { if (sd === 31) sd = 30; if (ed === 31) ed = 30; }
        else {
            const lastFeb = (d) => d.getMonth() === 1 && new Date(d.getFullYear(), 2, 0).getDate() === d.getDate();
            if (lastFeb(d1)) sd = 30;
            if (sd >= 30 || lastFeb(d1)) { sd = 30; if (ed === 31) ed = 30; }
        }
        return (d2.getFullYear() - d1.getFullYear()) * 360 + (d2.getMonth() - d1.getMonth()) * 30 + (ed - sd);
    });
    // YEARFRAC(start, end, [basis]): the part of a year between two dates. basis 0 US 30/360 (the default), 1 actual/actual, 2 actual/360,
    // 3 actual/365, 4 European 30/360. For interest or a penalty by the day.
    def("YEARFRAC", 2, 3, (a) => {
        let s = num(a[0]), e = num(a[1]);
        const basis = Math.trunc(opt(a, 2, 0));
        const bad = firstError(s, e, basis);
        if (bad) return bad;
        if (basis < 0 || basis > 4) return ERR.NUM;
        s = Math.floor(s); e = Math.floor(e);
        if (s > e) [s, e] = [e, s];
        const d1 = serialToDate(s), d2 = serialToDate(e);
        let sd = d1.getDate(), sm = d1.getMonth(), sy = d1.getFullYear(), ed = d2.getDate(), em = d2.getMonth(), ey = d2.getFullYear();
        const leap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
        if (basis === 0) {
            if (sd === 31 && ed === 31) { sd = 30; ed = 30; } else if (sd === 31) sd = 30; else if (sd === 30 && ed === 31) ed = 30;
            return roundSig((ed + em * 30 + ey * 360 - (sd + sm * 30 + sy * 360)) / 360);
        }
        if (basis === 2) return roundSig((e - s) / 360);
        if (basis === 3) return roundSig((e - s) / 365);
        if (basis === 4) {
            if (sd === 31) sd = 30;
            if (ed === 31) ed = 30;
            return roundSig((ed + em * 30 + ey * 360 - (sd + sm * 30 + sy * 360)) / 360);
        }
        // actual/actual: within a year (or less than a year apart) the length of that year; over more years the average length of them
        if (sy === ey || (ey === sy + 1 && (sm > em || (sm === em && sd >= ed)))) {
            const mar1 = (y) => dateToSerial(new Date(y, 2, 1));
            const feb29 = (leap(sy) && s < mar1(sy) && e >= mar1(sy)) || (leap(ey) && e >= mar1(ey) && s < mar1(ey));
            const length = (sy === ey && leap(sy)) || feb29 || (em === 1 && ed === 29) ? 366 : 365;
            return roundSig((e - s) / length);
        }
        const years = ey - sy + 1;
        const days = dateToSerial(new Date(ey + 1, 0, 1)) - dateToSerial(new Date(sy, 0, 1));
        return roundSig((e - s) / (days / years));
    });
    // DATEVALUE(text) and TIMEVALUE(text): a date or a time written as text (from an import), read the way the workbook's locale writes dates
    def("DATEVALUE", 1, 1, (a, ctx) => {
        if (typeof a[0] === "number") return Math.floor(a[0]);
        const t = toText(a[0]).trim();
        const info = localeInfo(ctx && ctx.locale);
        // a date may come with a time after it ("27/10/2026 13:05"): the time is left out
        const d = readDate(t.split(/\s+(?=\d{1,2}:\d{2})/)[0], info);
        return d === null ? ERR.VALUE : Math.floor(d);
    });
    def("TIMEVALUE", 1, 1, (a, ctx) => {
        if (typeof a[0] === "number") return roundSig(a[0] - Math.floor(a[0]));
        const t = toText(a[0]).trim();
        const parts = /^(.*?)\s*(\d{1,2}:\d{2}(?::\d{2})?\s*(?:[AaPp][Mm])?)$/.exec(t);
        if (parts && parts[1] && readDate(parts[1], localeInfo(ctx && ctx.locale)) === null) return ERR.VALUE;
        const time = readTime(parts ? parts[2] : t);
        return time ? roundSig(time.fraction) : ERR.VALUE;
    });

    // ---- analysis: a straight line through the past
    def("SLOPE", 2, 2, (a) => { const p = pairsOf(a[0], a[1]); if (p.error) return p.error; const l = fitLine(p.y, p.x); return l.error || roundSig(l.slope); }, { errors: true });
    def("INTERCEPT", 2, 2, (a) => { const p = pairsOf(a[0], a[1]); if (p.error) return p.error; const l = fitLine(p.y, p.x); return l.error || roundSig(l.intercept); }, { errors: true });
    // FORECAST(x, known ys, known xs): the y the line gives at x (next month's cost from the months before)
    def(["FORECAST", "FORECAST.LINEAR"], 3, 3, (a) => {
        const x = num(a[0]);
        if (isError(x)) return x;
        const p = pairsOf(a[1], a[2]);
        if (p.error) return p.error;
        const l = fitLine(p.y, p.x);
        return l.error || roundSig(l.intercept + l.slope * x);
    }, { errors: true });
    def("CORREL", 2, 2, (a) => {
        const p = pairsOf(a[0], a[1]);
        if (p.error) return p.error;
        if (p.y.length < 2) return ERR.DIV0;
        const my = mean(p.y), mx = mean(p.x);
        let sxy = 0, sxx = 0, syy = 0;
        for (let i = 0; i < p.y.length; i++) { sxy += (p.x[i] - mx) * (p.y[i] - my); sxx += (p.x[i] - mx) ** 2; syy += (p.y[i] - my) ** 2; }
        return sxx === 0 || syy === 0 ? ERR.DIV0 : roundSig(sxy / Math.sqrt(sxx * syy));
    }, { errors: true });
    // TREND(known ys, [known xs], [new xs], [const]): the line's ys at the new xs (an array: a cell shows its first one, there is no spilling)
    def("TREND", 1, 4, (a) => {
        const ys = valuesOf(a[0]);
        const xs = a.length > 1 && a[1] !== null ? valuesOf(a[1]) : ys.map((_, i) => i + 1);
        if (xs.length !== ys.length) return ERR.REF;
        const p = pairsOf(new XlArray([ys]), new XlArray([xs]));
        if (p.error) return p.error;
        const fitConst = !(a.length > 3 && a[3] !== null && !(typeof a[3] === "boolean" ? a[3] : num(a[3])));
        let slope, intercept = 0;
        if (fitConst) { const l = fitLine(p.y, p.x); if (l.error) return l.error; slope = l.slope; intercept = l.intercept; }
        else { let sxy = 0, sxx = 0; p.x.forEach((x, i) => { sxy += x * p.y[i]; sxx += x * x; }); if (sxx === 0) return ERR.DIV0; slope = sxy / sxx; }
        const target = a.length > 2 && a[2] !== null ? a[2] : (a.length > 1 && a[1] !== null ? a[1] : a[0]);
        const at = (v) => (typeof v === "number" ? roundSig(intercept + slope * v) : ERR.VALUE);
        if (!isRange(target)) { const v = num(target); return isError(v) ? v : at(v); }
        const rows = [];
        for (let r = 0; r < target.rows; r++) { const row = []; for (let c = 0; c < target.cols; c++) row.push(at(a.length > 2 && a[2] !== null ? target.at(r, c) : xs[r * target.cols + c])); rows.push(row); }
        return new XlArray(rows);
    }, { errors: true });

    // ---- analysis: spread
    const kArg = (name, exclusive, quart) => def(name, 2, 2, (a) => {
        const r = numbersOf([a[0]]);
        if (r.error) return r.error;
        let k = num(a[1]);
        if (isError(k)) return k;
        if (quart) { k = Math.trunc(k); if (exclusive ? k < 1 || k > 3 : k < 0 || k > 4) return ERR.NUM; k = k / 4; }
        return percentile(r.nums, k, exclusive);
    });
    kArg(["PERCENTILE", "PERCENTILE.INC"], false, false);
    kArg("PERCENTILE.EXC", true, false);
    kArg(["QUARTILE", "QUARTILE.INC"], false, true);
    kArg("QUARTILE.EXC", true, true);
    def(["MODE", "MODE.SNGL"], 1, 255, (a) => { const r = numbersOf(a); return r.error || modeOf(r.nums); });

    // AGGREGATE(function, options, ranges..., [k]): a function of the list (1 AVERAGE ... 19 QUARTILE.EXC) over the ranges, leaving out what the options
    // say: 0 other SUBTOTALs and AGGREGATEs (the default), 1 also hidden rows, 2 also errors, 3 all three, 4 nothing, 5 hidden rows only,
    // 6 errors only, 7 hidden rows and errors. A total that has errors among its cells still works out with 2, 3, 6 or 7.
    def("AGGREGATE", 3, 255, (a, env) => {
        const code = int(a[0]), option = a[1] === null ? 0 : int(a[1]);
        const bad = firstError(code, option);
        if (bad) return bad;
        const name = AGGREGATE_OF[code];
        if (!name || option < 0 || option > 7) return ERR.VALUE;
        const withK = code >= 14;
        if (withK && a.length < 4) return ERR.VALUE;
        const refs = withK ? a.slice(2, -1) : a.slice(2);
        const skipHidden = [1, 3, 5, 7].includes(option), skipErrors = [2, 3, 6, 7].includes(option), skipTotals = option <= 3;
        const kept = [];
        for (const x of refs) {
            if (!isRange(x)) { if (isError(x) && skipErrors) continue; kept.push(x); continue; }
            for (let r = x.r1; r <= x.r2; r++) {
                if (skipHidden && x.s && env.rowHidden && env.rowHidden(x.s, r, true)) continue;
                for (let c = x.c1; c <= x.c2; c++) {
                    const f = skipTotals && x.s && env.formulaOf ? env.formulaOf(x.s, r, c) : null;
                    if (f && /\b(SUBTOTAL|AGGREGATE)\s*\(/i.test(f)) continue;
                    const v = x._get(r, c);
                    if (isError(v) && skipErrors) continue;
                    kept.push(v);
                }
            }
        }
        const list = new XlRange(0, 0, Math.max(0, kept.length - 1), 0, (r) => (kept.length ? kept[r] : null));
        const args = withK ? [list, a[a.length - 1]] : [list];
        const fn = FUNCTIONS[name];
        if (!fn.errors) { const e = kept.find(isError); if (e) return e; }
        return fn.fn(args, env);
    }, { refs: true, errors: true });

    // ---- text and checks for imported data
    // TEXTBEFORE and TEXTAFTER(text, delimiter, [instance], [match mode], [match end], [if not found]): the text before or after the n-th delimiter
    // ("PIP-34-A" before "-" is "PIP"); a negative instance counts from the end; match mode 1 ignores upper and lower case
    const around = (after) => (a) => {
        const text = toText(a[0]), delim = toText(a[1]);
        const n = a.length > 2 && a[2] !== null ? int(a[2]) : 1;
        if (isError(n)) return n;
        if (n === 0 || Math.abs(n) > text.length + 1) return ERR.VALUE;
        const caseless = a.length > 3 && a[3] !== null && !!num(a[3]);
        const matchEnd = a.length > 4 && a[4] !== null && !!num(a[4]);
        const spot = delimiterAt(text, delim, n, caseless, matchEnd);
        if (!spot) return a.length > 5 ? a[5] : ERR.NA;
        return after ? text.slice(spot.at + spot.length) : text.slice(0, spot.at);
    };
    def("TEXTBEFORE", 2, 6, around(false));
    def("TEXTAFTER", 2, 6, around(true));
    // NUMBERVALUE(text, [decimal separator], [group separator]): a number written the local way, "1.250,50" with "," and "." is 1250.5
    def("NUMBERVALUE", 1, 3, (a) => {
        if (typeof a[0] === "number") return a[0];
        const dec = a.length > 1 && a[1] !== null ? toText(a[1])[0] : ".", group = a.length > 2 && a[2] !== null ? toText(a[2])[0] : ",";
        if (!dec || !group || dec === group) return ERR.VALUE;
        let t = toText(a[0]).replace(/\s/g, "");
        if (t === "") return 0;
        let percent = 0;
        while (t.endsWith("%")) { percent++; t = t.slice(0, -1); }
        const at = t.indexOf(dec);
        if (at >= 0 && t.indexOf(dec, at + 1) >= 0) return ERR.VALUE;
        const whole = (at >= 0 ? t.slice(0, at) : t).split(group).join(""), frac = at >= 0 ? t.slice(at + 1) : "";
        if (frac.includes(group)) return ERR.VALUE;
        const n = toNumber(whole + (at >= 0 ? "." + frac : ""));
        return isError(n) ? ERR.VALUE : roundSig(n / Math.pow(100, percent));
    });
    // FIXED(number, [decimals], [no commas]): the number rounded and written as text, 1234.567 is "1,234.57"
    def("FIXED", 1, 3, (a) => {
        const x = num(a[0]), d = a.length > 1 && a[1] !== null ? int(a[1]) : 2;
        const bad = firstError(x, d);
        if (bad) return bad;
        if (d > 127) return ERR.VALUE;
        const noCommas = a.length > 2 && a[2] !== null && !!(typeof a[2] === "boolean" ? a[2] : num(a[2]));
        const f = Math.pow(10, d), rounded = (x < 0 ? -1 : 1) * Math.round(roundSig(Math.abs(x) * f)) / f;
        const text = rounded.toLocaleString("en-US", { minimumFractionDigits: Math.max(0, d), maximumFractionDigits: Math.max(0, d), useGrouping: !noCommas });
        return text;
    });
    def("CHAR", 1, 1, (a) => { const n = int(a[0]); if (isError(n)) return n; return n < 1 || n > 255 ? ERR.VALUE : String.fromCharCode(n); });
    def("CODE", 1, 1, (a) => { const t = toText(a[0]); return t === "" ? ERR.VALUE : t.charCodeAt(0); });
    // CLEAN(text): the characters that do not print (codes 0 to 31) taken out, as text pasted from another program carries them
    def("CLEAN", 1, 1, (a) => toText(a[0]).replace(/[\x00-\x1f]/g, ""));
    def("ISEVEN", 1, 1, (a) => { const n = num(a[0]); return isError(n) ? n : Math.trunc(n) % 2 === 0; });
    def("ISODD", 1, 1, (a) => { const n = num(a[0]); return isError(n) ? n : Math.abs(Math.trunc(n) % 2) === 1; });
    def("ISERR", 1, 1, (a) => isError(a[0]) && a[0] !== ERR.NA, { errors: true });
    // ISFORMULA(reference): whether the cell holds a formula
    def("ISFORMULA", 1, 1, (a, env) => {
        const x = a[0];
        if (!isRange(x) || x.s === undefined) return ERR.VALUE;
        return !!(env.formulaOf && env.formulaOf(x.s, x.r1, x.c1));
    }, { refs: true, errors: true });
    def("NA", 0, 0, () => ERR.NA);
    def("ERROR.TYPE", 1, 1, (a) => (isError(a[0]) && ERROR_NUMBER[a[0].code] ? ERROR_NUMBER[a[0].code] : ERR.NA), { errors: true });
}
