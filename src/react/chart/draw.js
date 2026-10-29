// The drawing of a chart on a canvas, the way the Nexa charts draw (their palette, their nice axis steps, their monotone curves, IBM Plex): column,
// bar, line, area, pie, donut, combo (columns and lines, a second axis on the right), bullet (actual against a target, coloured by how far off) and
// waterfall (from a start, through the steps up and down, to what is left). Pure canvas work: no React, no DOM besides the context it is given.
//
//   drawChart(ctx, { width, height, model, spec, locale, cells })  ->  hits: [{ x, y, w, h, category, series, value }] (for the tooltip)
//
// `model` is what chartData gives ({ categories, series }); `spec` the chart's settings. `cells`, when the chart is laid over its cells
// (align 'cells'), is { plot: { x, y, w, h }, xs: [the centre of each column, from the plot's left] }: the plot is the block of cells itself and
// category i stands in the middle of column i, so an S-curve meets the weeks of the schedule under it.

/** Carbon's categorical colours, as the Nexa charts use them. */
export const PALETTE = ['#6929c4', '#1192e8', '#005d5d', '#9f1853', '#fa4d56', '#520408', '#198038', '#002d9c', '#ee5396', '#b28600', '#009d9a', '#012749', '#8a3800', '#a56eff'];
const FONT = "'IBM Plex Sans', 'Segoe UI', Arial, sans-serif";
const INK = { text: '#161616', muted: '#6f6f6f', axis: '#525252', grid: '#e0e0e0', base: '#8d8d8d', track: '#f4f4f4' };
// the axis of a chart drawn from one series (pie, bullet, waterfall): the format of the series' cells, then the chart's own y
const axisOf = (spec, s) => ({ ...(s && s.format && s.format.type === 'percent' ? { percent: true } : {}), ...(spec.y || {}) });
const STATUS = { good: '#198038', warn: '#f1c21b', bad: '#da1e28', total: '#6929c4', up: '#198038', down: '#da1e28' };

// ---- numbers ------------------------------------------------------------------------------------------------------------------------------------

// a "nice" number near x (1, 2, 5 times a power of ten), as the Nexa charts (and most charting) step their axes
function niceNum(range, round) {
    if (!(range > 0)) return 1;
    const exponent = Math.floor(Math.log10(range));
    const fraction = range / Math.pow(10, exponent);
    let nice;
    if (round) nice = fraction < 1.5 ? 1 : fraction < 3 ? 2 : fraction < 7 ? 5 : 10;
    else nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
    return nice * Math.pow(10, exponent);
}
/** The axis from lo to hi in nice steps: { lo, hi, step, ticks }. A fixed min or max of the chart's axis is kept as it is. */
export function niceScale(min, max, axis = {}) {
    let lo = Number.isFinite(axis.min) ? axis.min : Math.min(0, min);
    let hi = Number.isFinite(axis.max) ? axis.max : Math.max(0, max);
    if (lo === hi) hi = lo + 1;
    const step = niceNum(niceNum(hi - lo, false) / 4, true);
    if (!Number.isFinite(axis.min)) lo = Math.floor(lo / step) * step;
    if (!Number.isFinite(axis.max)) hi = Math.ceil(hi / step) * step;
    const ticks = [];
    for (let v = lo; v <= hi + step * 1e-9; v += step) ticks.push(Math.round(v / step) * step);
    return { lo, hi, step, ticks };
}
// a number as the chart writes it: the axis's prefix and suffix, its decimals, short (1,2 jt) on an axis when it is large
function numberText(v, axis, locale, short) {
    if (v === null || v === undefined || !Number.isFinite(v)) return '';
    // a percent axis (its own `percent`, or the format of its cells): 0.495 is 49,5%
    if (axis.percent) {
        const d = Number.isFinite(axis.decimals) ? axis.decimals : short ? 0 : 1;
        let p;
        try { p = new Intl.NumberFormat(locale || undefined, { minimumFractionDigits: 0, maximumFractionDigits: d }).format(v * 100); } catch (err) { p = String(Math.round(v * 1000) / 10); }
        return (axis.prefix || '') + p + '%' + (axis.suffix || '');
    }
    const opts = Number.isFinite(axis.decimals) ? { minimumFractionDigits: axis.decimals, maximumFractionDigits: axis.decimals } : { maximumFractionDigits: Math.abs(v) < 10 ? 2 : Math.abs(v) < 1000 ? 1 : 0 };
    let text;
    try {
        text = short && Math.abs(v) >= 10000 ? new Intl.NumberFormat(locale || undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(v) : new Intl.NumberFormat(locale || undefined, opts).format(v);
    } catch (err) {
        text = String(Math.round(v * 100) / 100);
    }
    return (axis.prefix || '') + text + (axis.suffix || '');
}

// ---- drawing helpers ----------------------------------------------------------------------------------------------------------------------------

// text with a white halo when the chart has no background of its own, so it stays readable over the numbers of the cells under it
function label(ctx, text, x, y, color, halo, weight) {
    ctx.save();
    ctx.font = (weight || '600') + ' 11px ' + FONT;
    if (halo) { ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.strokeText(text, x, y); }
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
}
function roundedBar(ctx, x, y, w, h, radius, horizontal) {
    const r = Math.max(0, Math.min(radius, Math.abs(w) / 2, Math.abs(h) / 2));
    ctx.beginPath();
    if (!r || !ctx.roundRect) { ctx.rect(x, y, w, h); return; }
    // the round corners on the end of the bar (its top, or its right end when it lies down), the base square on the axis
    ctx.roundRect(x, y, w, h, horizontal ? [0, r, r, 0] : [r, r, 0, 0]);
}
// the control points of a monotone cubic through the points (Fritsch–Carlson, as the Nexa line chart smooths): smooth, never past a peak
function monotone(xs, ys) {
    const n = xs.length, d = [], t = [];
    for (let k = 0; k < n - 1; k++) { const h = xs[k + 1] - xs[k]; d[k] = h ? (ys[k + 1] - ys[k]) / h : 0; }
    t[0] = d[0]; t[n - 1] = d[n - 2];
    for (let k = 1; k < n - 1; k++) t[k] = d[k - 1] * d[k] <= 0 ? 0 : (d[k - 1] + d[k]) / 2;
    for (let k = 0; k < n - 1; k++) {
        if (d[k] === 0) { t[k] = 0; t[k + 1] = 0; continue; }
        const a = t[k] / d[k], b = t[k + 1] / d[k], q = a * a + b * b;
        if (q > 9) { const tau = 3 / Math.sqrt(q); t[k] = tau * a * d[k]; t[k + 1] = tau * b * d[k]; }
    }
    const out = [];
    for (let k = 0; k < n - 1; k++) { const h = (xs[k + 1] - xs[k]) / 3; out.push([xs[k] + h, ys[k] + t[k] * h, xs[k + 1] - h, ys[k + 1] - t[k + 1] * h, xs[k + 1], ys[k + 1]]); }
    return out;
}

// the colour of series i: its own, else the chart's list, else the palette
const colorOf = (spec, s, i) => s.color || (spec.colors && spec.colors[i]) || PALETTE[i % PALETTE.length];

// ---- the frame: title, legend, plot ---------------------------------------------------------------------------------------------------------------

function frame(ctx, o, legendItems) {
    const { width, height, spec } = o;
    const halo = spec.background === 'none';
    if (!halo) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height); }
    if (o.cells) {
        // over its cells: the plot is the block of cells; the title (if any) above it and the legend in its top-left corner, both outside the grid's numbers
        const p = o.cells.plot;
        if (spec.title) { ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; label(ctx, spec.title, p.x, p.y - 8, INK.text, true); }
        if (spec.legend !== 'none' && legendItems.length) drawLegendColumn(ctx, legendItems, p.x + p.w + (o.cells.legendGap || 44), p.y + 2);
        return { x: p.x, y: p.y, w: p.w, h: p.h };
    }
    let top = 12;
    const pad = 14;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const part = (node, x, y, w, h) => { if (o.parts) o.parts.push({ node, x, y, w, h }); };
    if (spec.title) { ctx.font = '600 14px ' + FONT; ctx.fillStyle = INK.text; ctx.fillText(spec.title, pad, top + 14); part('title', pad, top, ctx.measureText(spec.title).width, 18); top += 20; }
    if (spec.subtitle) { ctx.font = '12px ' + FONT; ctx.fillStyle = INK.muted; ctx.fillText(spec.subtitle, pad, top + 12); part('title', pad, top, ctx.measureText(spec.subtitle).width, 16); top += 18; }
    let right = width - pad, bottom = height - 10;
    const legend = spec.legend || 'top';
    if (legend !== 'none' && legendItems.length) {
        if (legend === 'right') { const w = legendWidth(ctx, legendItems); drawLegendColumn(ctx, legendItems, width - pad - w, top + 6); part('title', width - pad - w, top + 6, w, legendItems.length * 18); right -= w + 12; }
        else if (legend === 'bottom') { bottom -= 20; drawLegend(ctx, legendItems, pad, bottom + 6, width - 2 * pad, halo); part('title', pad, bottom + 4, width - 2 * pad, 16); }
        else { top += 4; const h = drawLegend(ctx, legendItems, pad, top, width - 2 * pad, halo); part('title', pad, top - 2, width - 2 * pad, h + 4); top += h + 6; }
    }
    return { x: pad, y: top + 6, w: right - pad, h: bottom - top - 6 };
}
function legendWidth(ctx, items) { ctx.font = '12px ' + FONT; return Math.max(...items.map((x) => ctx.measureText(x.name).width)) + 20; }
function swatch(ctx, item, x, y) {
    ctx.fillStyle = item.color;
    if (item.line) {
        ctx.strokeStyle = item.color; ctx.lineWidth = 2.5; ctx.setLineDash(item.dash ? [4, 3] : []);
        ctx.beginPath(); ctx.moveTo(x, y + 5); ctx.lineTo(x + 14, y + 5); ctx.stroke(); ctx.setLineDash([]);
    } else ctx.fillRect(x, y, 10, 10);
}
// the legend in a row (wrapping), its height returned
function drawLegend(ctx, items, x0, y0, width, halo) {
    ctx.font = '12px ' + FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    let x = x0, y = y0;
    for (const item of items) {
        const w = (item.line ? 18 : 14) + ctx.measureText(item.name).width + 16;
        if (x + w > x0 + width && x > x0) { x = x0; y += 18; }
        swatch(ctx, item, x, y);
        label(ctx, item.name, x + (item.line ? 18 : 14), y + 9, INK.axis, halo, '400');
        x += w;
    }
    return y - y0 + 12;
}
function drawLegendColumn(ctx, items, x, y) {
    ctx.font = '12px ' + FONT; ctx.textAlign = 'left';
    items.forEach((item, i) => { swatch(ctx, item, x, y + i * 18); ctx.fillStyle = INK.axis; ctx.fillText(item.name, x + 18, y + i * 18 + 9); });
}

// ---- charts on axes: column, bar, line, area, combo, bullet, waterfall ---------------------------------------------------------------------------

/**
 * Draws the chart. Returns the hit boxes of what was drawn (for the tooltip).
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ width: number, height: number, model: { categories: string[], series: any[] }, spec: any, locale?: string, cells?: { plot: any, xs: number[] } }} o
 */
export function drawChart(ctx, o) {
    const { spec, model } = o;
    ctx.save();
    ctx.clearRect(0, 0, o.width, o.height);
    const series = model.series.map((s, pos) => ({ ...s, pos })).filter((s) => !s.hidden);
    const hits = [];
    const parts = [];
    o = { ...o, parts };
    if (!series.length || (!model.categories.length && spec.type !== 'scatter')) {
        const p = frame(ctx, o, []);
        ctx.font = '12px ' + FONT; ctx.fillStyle = INK.muted; ctx.textAlign = 'center';
        ctx.fillText('No data', p.x + p.w / 2, p.y + p.h / 2);
        ctx.restore();
        return hits;
    }
    if (spec.type === 'pie' || spec.type === 'donut') drawPie(ctx, o, series[0], hits);
    else if (spec.type === 'bullet') drawBullet(ctx, o, series, hits);
    else if (spec.type === 'waterfall') drawWaterfall(ctx, o, series[0], hits);
    else if (spec.type === 'scatter') drawScatter(ctx, o, series, hits);
    else drawAxes(ctx, o, series, hits);
    ctx.restore();
    // a hit names its series by its place among the drawn ones: given back by its place in the model, the editor's numbering
    for (const h of hits) if (h.series >= 0 && series[h.series]) h.series = series[h.series].pos;
    hits.parts = parts;
    return hits;
}

// what each series is drawn as: the chart's type, or in a combo the series' own (columns by default, a line when it says so)
function kindOf(spec, s) {
    if (spec.type === 'combo') return s.type === 'line' || s.type === 'area' ? s.type : 'column';
    if (spec.type === 'bar') return 'bar';
    if (spec.type === 'line' || spec.type === 'area') return s.type === 'column' ? 'column' : spec.type;
    return s.type === 'line' || s.type === 'area' ? s.type : 'column';
}

function drawAxes(ctx, o, series, hits) {
    const { spec, model, locale } = o;
    const halo = spec.background === 'none';
    const horizontal = spec.type === 'bar';
    const n = model.categories.length;
    const kinds = series.map((s) => kindOf(spec, s));
    const legendItems = series.map((s, i) => ({ name: s.name, color: colorOf(spec, s, s.index ?? i), line: kinds[i] === 'line', dash: !!s.dash }));
    const plot = frame(ctx, o, spec.legend === 'none' || (series.length < 2 && !spec.title && spec.legend !== 'top') ? [] : legendItems);

    // the extent of each axis: stacked columns add up per category; a series on the right has an axis of its own
    const sides = { left: [], right: [] };
    series.forEach((s, i) => sides[s.axis === 'right' ? 'right' : 'left'].push(i));
    const extent = (idx) => {
        let lo = Infinity, hi = -Infinity;
        const stackable = idx.filter((i) => kinds[i] === 'column' || kinds[i] === 'bar');
        if (spec.stacked && stackable.length) {
            for (let c = 0; c < n; c++) {
                let pos = 0, neg = 0;
                for (const i of stackable) { const v = series[i].values[c]; if (v > 0) pos += v; else if (v < 0) neg += v; }
                hi = Math.max(hi, pos); lo = Math.min(lo, neg);
            }
        }
        for (const i of idx) if (!(spec.stacked && stackable.includes(i))) for (const v of series[i].values) if (v !== null) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
        return lo === Infinity ? { lo: 0, hi: 1 } : { lo, hi };
    };
    const yl = sides.left.length ? niceScale(extent(sides.left).lo, extent(sides.left).hi, spec.y || {}) : null;
    // the right axis takes y2; when every series is on the right, the chart's y is its only axis and goes there
    const rightAxis = spec.y2 || (sides.left.length ? {} : spec.y || {});
    const yr = sides.right.length ? niceScale(extent(sides.right).lo, extent(sides.right).hi, rightAxis) : null;
    // an axis is in the format of its series' cells unless it says otherwise (percent cells: a percent axis)
    const fmtOf = (idx) => { const f = idx.length && series[idx[0]].format; return f && f.type === 'percent' ? { percent: true } : f && f.type === 'money' ? { decimals: f.decimals } : {}; };
    const axisL = { ...fmtOf(sides.left), ...(spec.y || {}) }, axisR = { ...fmtOf(sides.right), ...rightAxis };

    // room for the value axis labels and the category labels (not over its cells: there the axes stand outside the block, the cells name the categories)
    ctx.font = '11px ' + FONT;
    const showY = spec.yAxis !== false, showX = spec.xAxis !== false;
    const wL = yl && showY ? Math.max(...yl.ticks.map((t) => ctx.measureText(numberText(t, axisL, locale, true)).width)) + 8 : 0;
    const wR = yr && showY ? Math.max(...yr.ticks.map((t) => ctx.measureText(numberText(t, axisR, locale, true)).width)) + 8 : 0;
    let P = plot;
    if (!o.cells) {
        const catW = horizontal && showX ? Math.min(140, Math.max(...model.categories.map((c) => ctx.measureText(c).width)) + 10) : 0;
        P = { x: plot.x + (horizontal ? catW : wL), y: plot.y + 6, w: plot.w - (horizontal ? catW : wL) - wR, h: plot.h - 6 - (showX && !horizontal ? 18 : horizontal && showY ? 16 : 0) };
    }
    if (P.w < 10 || P.h < 10) return;
    if (o.parts) {
        o.parts.push({ node: 'axes', x: P.x - (horizontal ? 0 : wL), y: P.y, w: horizontal ? P.w : wL, h: horizontal ? 0 : P.h });
        if (wR) o.parts.push({ node: 'axes', x: P.x + P.w, y: P.y, w: wR, h: P.h });
        o.parts.push({ node: 'axes', x: P.x, y: P.y + P.h, w: P.w, h: 20 });
    }

    // where things stand: categories along x (y when the bars lie down), values up (right)
    const band = (horizontal ? P.h : P.w) / n;
    const catAt = (c) => (o.cells && !horizontal && o.cells.xs[c] !== undefined ? P.x + o.cells.xs[c] : horizontal ? P.y + band * c + band / 2 : P.x + band * c + band / 2);
    const valAt = (scale, v) => (horizontal ? P.x + ((v - scale.lo) / (scale.hi - scale.lo)) * P.w : P.y + P.h - ((v - scale.lo) / (scale.hi - scale.lo)) * P.h);

    // the grid and the axes
    const main = yl || yr, mainAxis = yl ? axisL : axisR;
    ctx.lineWidth = 1;
    for (const t of main.ticks) {
        const at = Math.round(valAt(main, t)) + 0.5;
        if (spec.grid !== false) {
            ctx.strokeStyle = INK.grid; ctx.beginPath();
            if (horizontal) { ctx.moveTo(at, P.y); ctx.lineTo(at, P.y + P.h); } else { ctx.moveTo(P.x, at); ctx.lineTo(P.x + P.w, at); }
            ctx.stroke();
        }
        if (showY) {
            ctx.textBaseline = 'middle';
            if (horizontal) { ctx.textAlign = 'center'; label(ctx, numberText(t, mainAxis, locale, true), at, P.y + P.h + 9, INK.muted, halo, '400'); }
            else if (yl) { ctx.textAlign = 'right'; label(ctx, numberText(t, axisL, locale, true), P.x - 6, at, INK.muted, halo, '400'); }
        }
    }
    if (yr && showY && !horizontal) {
        const c = colorOf(spec, series[sides.right[0]], series[sides.right[0]].index ?? sides.right[0]);
        ctx.strokeStyle = c; ctx.beginPath(); ctx.moveTo(P.x + P.w + 0.5, P.y); ctx.lineTo(P.x + P.w + 0.5, P.y + P.h); ctx.stroke();
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        for (const t of yr.ticks) { const y = valAt(yr, t); ctx.beginPath(); ctx.moveTo(P.x + P.w, y); ctx.lineTo(P.x + P.w + 3, y); ctx.stroke(); label(ctx, numberText(t, axisR, locale, true), P.x + P.w + 6, y, c, halo, '400'); }
    }
    // the baseline (zero) and the category labels
    const zero = Math.round(valAt(main, Math.max(main.lo, Math.min(main.hi, 0)))) + 0.5;
    ctx.strokeStyle = INK.base; ctx.beginPath();
    if (horizontal) { ctx.moveTo(zero, P.y); ctx.lineTo(zero, P.y + P.h); } else { ctx.moveTo(P.x, zero); ctx.lineTo(P.x + P.w, zero); }
    ctx.stroke();
    if (showX && !o.cells) {
        ctx.textBaseline = 'middle';
        const every = horizontal ? 1 : Math.max(1, Math.ceil(n / Math.max(1, Math.floor(P.w / 46))));
        model.categories.forEach((c, i) => {
            if (i % every) return;
            if (horizontal) { ctx.textAlign = 'right'; label(ctx, c, P.x - 6, catAt(i), INK.axis, halo, '400'); }
            else { ctx.textAlign = 'center'; label(ctx, c, catAt(i), P.y + P.h + 10, INK.axis, halo, '400'); }
        });
    }

    // the columns (or bars): side by side in a category, or stacked
    const cols = series.map((s, i) => i).filter((i) => kinds[i] === 'column' || kinds[i] === 'bar');
    const groupW = band * (cols.length > 1 && !spec.stacked ? 0.78 : 0.62);
    const eachW = spec.stacked ? groupW : groupW / Math.max(1, cols.length);
    for (let c = 0; c < n; c++) {
        let pos = 0, neg = 0;
        cols.forEach((i, k) => {
            const s = series[i], v = s.values[c];
            if (v === null) return;
            const scale = s.axis === 'right' && yr ? yr : main;
            const from = spec.stacked ? (v >= 0 ? pos : neg) : 0;
            const to = from + v;
            if (spec.stacked) { if (v >= 0) pos = to; else neg = to; }
            const a = valAt(scale, from), b = valAt(scale, to);
            const off = catAt(c) - groupW / 2 + (spec.stacked ? 0 : k * eachW);
            const gap = spec.stacked || cols.length < 2 ? 0 : 1;
            ctx.fillStyle = colorOf(spec, s, s.index ?? i);
            const topOfStack = !spec.stacked || cols.slice(k + 1).every((j) => !series[j].values[c]);
            if (horizontal) { roundedBar(ctx, Math.min(a, b), off, Math.abs(b - a), eachW - gap, topOfStack ? 2 : 0, true); ctx.fill(); hits.push({ x: Math.min(a, b), y: off, w: Math.abs(b - a), h: eachW, category: c, series: i, value: v }); }
            else { roundedBar(ctx, off, Math.min(a, b), eachW - gap, Math.abs(b - a), topOfStack ? 2 : 0, false); ctx.fill(); hits.push({ x: off, y: Math.min(a, b), w: eachW, h: Math.abs(b - a), category: c, series: i, value: v }); }
            if (spec.labels || s.labels) {
                const text = numberText(v, s.axis === 'right' ? axisR : axisL, locale, false);
                if (spec.stacked) { ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; if (Math.abs(b - a) > 14) label(ctx, text, horizontal ? (a + b) / 2 : off + eachW / 2, horizontal ? off + eachW / 2 : (a + b) / 2, '#ffffff', false); }
                else if (horizontal) { ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; label(ctx, text, Math.max(a, b) + 4, off + eachW / 2, INK.text, halo); }
                else { ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; label(ctx, text, off + eachW / 2, Math.min(a, b) - 3, INK.text, halo); }
            }
        });
    }

    // the lines (and areas): through the categories' centres, broken where a cell is not a number, smooth when asked
    series.forEach((s, i) => {
        if (kinds[i] !== 'line' && kinds[i] !== 'area') return;
        const scale = s.axis === 'right' && yr ? yr : main;
        const color = colorOf(spec, s, s.index ?? i);
        const runs = [];
        let run = [];
        s.values.forEach((v, c) => { if (v === null) { if (run.length) runs.push(run); run = []; } else run.push([catAt(c), valAt(scale, v), c, v]); });
        if (run.length) runs.push(run);
        for (const pts of runs) {
            const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
            const path = () => {
                ctx.moveTo(xs[0], ys[0]);
                if ((spec.smooth || s.smooth) && pts.length > 2) for (const seg of monotone(xs, ys)) ctx.bezierCurveTo(...seg);
                else for (let k = 1; k < pts.length; k++) ctx.lineTo(xs[k], ys[k]);
            };
            if (kinds[i] === 'area') {
                ctx.beginPath(); path(); ctx.lineTo(xs[xs.length - 1], zero); ctx.lineTo(xs[0], zero); ctx.closePath();
                ctx.globalAlpha = 0.16; ctx.fillStyle = color; ctx.fill(); ctx.globalAlpha = 1;
            }
            ctx.beginPath(); path();
            ctx.strokeStyle = color; ctx.lineWidth = s.width || 2.5; ctx.lineJoin = 'round'; ctx.setLineDash(s.dash ? [6, 4] : []);
            ctx.stroke(); ctx.setLineDash([]);
            if (spec.markers !== false && s.markers !== false) {
                for (const [x, y] of pts) { ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fillStyle = s.dash ? color : '#ffffff'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = color; ctx.stroke(); }
            }
            for (const [x, y, c, v] of pts) hits.push({ x: x - 6, y: y - 6, w: 12, h: 12, category: c, series: i, value: v });
            if (spec.labels || s.labels) { ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; for (const [x, y, , v] of pts) label(ctx, numberText(v, s.axis === 'right' ? axisR : axisL, locale, false), x, y - 6, color, true); }
        }
        // the last value at the end of the line, when asked (an S-curve's "Realisasi 49,5%")
        if (s.endLabel && runs.length) {
            const last = runs[runs.length - 1][runs[runs.length - 1].length - 1];
            ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            label(ctx, (s.endLabel === true ? s.name + ' ' : String(s.endLabel)) + numberText(last[3], s.axis === 'right' ? axisR : axisL, locale, false), last[0] + 8, last[1], color, true);
        }
    });
}

// ---- scatter: each series its own x and y, the x axis a number (or a date) with its real distances ----------------------------------------------

// a day number as a short date in the workbook's locale ("27 Okt"), for a date x axis
function dateText(serial, locale) {
    const d = new Date(Math.round((serial - 25569) * 86400000));
    try { return new Intl.DateTimeFormat(locale || undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(d); } catch (err) { return d.toISOString().slice(5, 10); }
}

function drawScatter(ctx, o, series, hits) {
    const { spec, locale } = o;
    const halo = spec.background === 'none';
    const lined = (s) => s.type === 'line' || (spec.lines && s.type !== 'points');
    const legendItems = series.map((s, i) => ({ name: s.name, color: colorOf(spec, s, s.index ?? i), line: lined(s), dash: !!s.dash }));
    const plot = frame(ctx, o, spec.legend === 'none' ? [] : legendItems);
    // every point with both an x and a y
    const pts = series.map((s) => (s.x || s.values.map((_, i) => i + 1)).map((x, i) => [x, s.values[i]]).filter(([x, y]) => x !== null && y !== null && x !== undefined));
    const all = pts.flat();
    if (!all.length) return;
    const isDate = series.some((s) => s.xFormat && /date|time/.test(s.xFormat.type || ''));
    // a number axis starts at 0 as any value axis does; a date axis runs from the first date to the last
    const xLo = Math.min(...all.map((p) => p[0])), xHi = Math.max(...all.map((p) => p[0]));
    const xs = isDate ? niceScale(xLo, xHi, { min: xLo, max: xHi, ...(spec.x || {}) }) : niceScale(xLo, xHi, spec.x || {});
    const yAxis = { ...(series[0].format && series[0].format.type === 'percent' ? { percent: true } : {}), ...(spec.y || {}) };
    const ys = niceScale(Math.min(...all.map((p) => p[1])), Math.max(...all.map((p) => p[1])), spec.y || {});
    ctx.font = '11px ' + FONT;
    const wL = spec.yAxis === false ? 0 : Math.max(...ys.ticks.map((v) => ctx.measureText(numberText(v, yAxis, locale, true)).width)) + 8;
    const P = { x: plot.x + wL, y: plot.y + 6, w: plot.w - wL - 8, h: plot.h - 6 - (spec.xAxis === false ? 0 : 18) };
    if (P.w < 10 || P.h < 10) return;
    const X = (v) => P.x + ((v - xs.lo) / (xs.hi - xs.lo || 1)) * P.w, Y = (v) => P.y + P.h - ((v - ys.lo) / (ys.hi - ys.lo || 1)) * P.h;
    for (const v of ys.ticks) {
        const y = Math.round(Y(v)) + 0.5;
        if (spec.grid !== false) { ctx.strokeStyle = INK.grid; ctx.beginPath(); ctx.moveTo(P.x, y); ctx.lineTo(P.x + P.w, y); ctx.stroke(); }
        if (spec.yAxis !== false) { ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; label(ctx, numberText(v, yAxis, locale, true), P.x - 6, y, INK.muted, halo, '400'); }
    }
    ctx.strokeStyle = INK.base; ctx.beginPath(); ctx.moveTo(P.x, P.y + P.h + 0.5); ctx.lineTo(P.x + P.w, P.y + P.h + 0.5); ctx.stroke();
    if (spec.xAxis !== false) {
        const ticks = isDate ? Array.from({ length: 5 }, (_, i) => xs.lo + ((xs.hi - xs.lo) * i) / 4) : xs.ticks;
        for (const v of ticks) { ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; label(ctx, isDate ? dateText(v, locale) : numberText(v, spec.x || {}, locale, true), X(v), P.y + P.h + 10, INK.axis, halo, '400'); }
    }
    series.forEach((s, i) => {
        const color = colorOf(spec, s, s.index ?? i);
        const list = pts[i].slice().sort((a, b) => a[0] - b[0]);
        if (lined(s) && list.length > 1) {
            const px = list.map((p) => X(p[0])), py = list.map((p) => Y(p[1]));
            ctx.beginPath(); ctx.moveTo(px[0], py[0]);
            if ((spec.smooth || s.smooth) && list.length > 2) for (const seg of monotone(px, py)) ctx.bezierCurveTo(...seg); else for (let k = 1; k < px.length; k++) ctx.lineTo(px[k], py[k]);
            ctx.strokeStyle = color; ctx.lineWidth = s.width || 2; ctx.setLineDash(s.dash ? [6, 4] : []); ctx.stroke(); ctx.setLineDash([]);
        }
        for (const [x, y] of list) {
            ctx.beginPath(); ctx.arc(X(x), Y(y), s.size || 4, 0, Math.PI * 2); ctx.fillStyle = color; ctx.globalAlpha = 0.85; ctx.fill(); ctx.globalAlpha = 1;
            hits.push({ x: X(x) - 6, y: Y(y) - 6, w: 12, h: 12, category: -1, series: i, value: y, xValue: isDate ? dateText(x, locale) : x });
            if (spec.labels || s.labels) { ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; label(ctx, numberText(y, yAxis, locale, false), X(x), Y(y) - 6, color, true); }
        }
    });
}

// ---- pie and donut ----------------------------------------------------------------------------------------------------------------------------

function drawPie(ctx, o, s, hits) {
    const { spec, model, locale } = o;
    const items = model.categories.map((name, i) => ({ name, value: s.values[i] > 0 ? s.values[i] : 0, color: (spec.colors && spec.colors[i]) || PALETTE[i % PALETTE.length] }));
    const total = items.reduce((a, x) => a + x.value, 0);
    const legendSide = spec.legend === 'none' ? 'none' : spec.legend === 'bottom' || spec.legend === 'top' ? 'bottom' : 'right';
    const plot = frame(ctx, { ...o, spec: { ...spec, legend: 'none' } }, []);
    const listW = legendSide === 'right' ? Math.min(plot.w * 0.45, 200) : 0;
    const listH = legendSide === 'bottom' ? items.length * 18 + 6 : 0;
    const cx = plot.x + (plot.w - listW) / 2, cy = plot.y + (plot.h - listH) / 2;
    const r = Math.max(8, Math.min((plot.w - listW) / 2, (plot.h - listH) / 2) - 6);
    let a = -Math.PI / 2;
    items.forEach((x, i) => {
        if (!total || !x.value) return;
        const b = a + (x.value / total) * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, a, b); ctx.closePath();
        ctx.fillStyle = x.color; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#ffffff'; ctx.stroke();
        const mid = (a + b) / 2;
        hits.push({ x: cx + Math.cos(mid) * r * 0.7 - 10, y: cy + Math.sin(mid) * r * 0.7 - 10, w: 20, h: 20, category: i, series: 0, value: x.value });
        if (spec.labels && b - a > 0.3) {
            const rr = spec.type === 'donut' ? r * 0.8 : r * 0.65;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            label(ctx, Math.round((x.value / total) * 100) + '%', cx + Math.cos(mid) * rr, cy + Math.sin(mid) * rr, '#ffffff', false);
        }
        a = b;
    });
    if (spec.type === 'donut') {
        ctx.beginPath(); ctx.arc(cx, cy, r * 0.6, 0, Math.PI * 2); ctx.fillStyle = spec.background === 'none' ? 'rgba(255,255,255,0.92)' : '#ffffff'; ctx.fill();
        ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        ctx.font = '600 ' + Math.round(Math.max(14, r * 0.3)) + 'px ' + FONT; ctx.fillStyle = INK.text;
        ctx.fillText(spec.centerText !== undefined ? String(spec.centerText) : numberText(total, axisOf(spec, s), locale, true), cx, cy + 4);
        ctx.font = '11px ' + FONT; ctx.fillStyle = INK.muted; ctx.fillText(spec.centerLabel !== undefined ? String(spec.centerLabel) : s.name, cx, cy + 20);
    }
    if (legendSide !== 'none') {
        const x0 = legendSide === 'right' ? plot.x + plot.w - listW + 8 : plot.x + 8, y0 = legendSide === 'right' ? cy - (items.length * 18) / 2 : plot.y + plot.h - listH + 6;
        const w = legendSide === 'right' ? listW - 8 : plot.w - 16;
        ctx.font = '12px ' + FONT;
        items.forEach((x, i) => {
            const y = y0 + i * 18;
            ctx.fillStyle = x.color; ctx.fillRect(x0, y, 10, 10);
            ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.fillStyle = INK.axis; ctx.fillText(x.name, x0 + 16, y + 9);
            ctx.textAlign = 'right'; ctx.fillText(numberText(x.value, axisOf(spec, s), locale, false), x0 + w, y + 9);
        });
    }
}

// ---- bullet: per category the actual (series 1) as a bar, the target (series 2) as a mark, the bar coloured by how far off it is --------------------

function drawBullet(ctx, o, series, hits) {
    const { spec, model, locale } = o;
    const halo = spec.background === 'none';
    const actual = series[0], target = series[1];
    const plot = frame(ctx, o, []);
    const n = model.categories.length;
    const axis = axisOf(spec, actual);
    let hi = 0;
    for (const s of [actual, target]) if (s) for (const v of s.values) if (v !== null) hi = Math.max(hi, v);
    const scale = niceScale(0, hi, axis);
    ctx.font = '11px ' + FONT;
    const catW = Math.min(160, Math.max(...model.categories.map((c) => ctx.measureText(c).width)) + 12);
    const devW = target ? 56 : 0;
    const P = { x: plot.x + catW, y: plot.y, w: plot.w - catW - devW, h: plot.h - 16 };
    if (P.w < 10) return;
    const valAt = (v) => P.x + ((v - scale.lo) / (scale.hi - scale.lo)) * P.w;
    // how far off is bad: below the target by more than `bad` (5 by default) is red, by more than `warn` (1) amber, else green
    const warn = Number.isFinite(spec.warn) ? spec.warn : 1, bad = Number.isFinite(spec.bad) ? spec.bad : 5;
    for (const t of scale.ticks) {
        const x = Math.round(valAt(t)) + 0.5;
        if (spec.grid !== false) { ctx.strokeStyle = INK.grid; ctx.beginPath(); ctx.moveTo(x, P.y); ctx.lineTo(x, P.y + P.h); ctx.stroke(); }
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; label(ctx, numberText(t, axis, locale, true), x, P.y + P.h + 9, INK.muted, halo, '400');
    }
    const row = P.h / n, barH = Math.min(18, row * 0.56);
    model.categories.forEach((c, i) => {
        const y = P.y + row * i + (row - barH) / 2;
        const v = actual.values[i], t = target ? target.values[i] : null;
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; label(ctx, c, P.x - 8, y + barH / 2, INK.axis, halo, '400');
        ctx.fillStyle = INK.track; ctx.fillRect(P.x, y, P.w, barH);
        const off = v !== null && t !== null ? v - t : null;
        // on a percent axis the limits are percentage points (5 is 5%, i.e. 0.05 of the cells' values)
        const points = off === null ? null : axis.percent ? off * 100 : off;
        const color = off === null ? colorOf(spec, actual, 0) : points < -bad ? STATUS.bad : points < -warn ? STATUS.warn : STATUS.good;
        if (v !== null) { ctx.fillStyle = color; roundedBar(ctx, P.x, y, Math.max(0, valAt(v) - P.x), barH, 2, true); ctx.fill(); hits.push({ x: P.x, y, w: valAt(v) - P.x, h: barH, category: i, series: 0, value: v }); }
        if (t !== null) { ctx.fillStyle = INK.text; ctx.fillRect(valAt(t) - 1, y - 4, 2.5, barH + 8); }
        if (off !== null) {
            ctx.textAlign = 'left';
            label(ctx, (off >= 0 ? '+' : '') + numberText(off, axis, locale, false), P.x + P.w + 8, y + barH / 2, color === STATUS.warn ? '#8e6a00' : color, halo);
        }
    });
}

// ---- waterfall: the first value is where it starts; each next one goes up or down from there; a total (the chart's `totals`, by category
// index; the last one when it is empty) stands on the axis with what has been added up so far ------------------------------------------------------

function drawWaterfall(ctx, o, s, hits) {
    const { spec, model, locale } = o;
    const halo = spec.background === 'none';
    const n = model.categories.length;
    const totals = new Set(Array.isArray(spec.totals) ? spec.totals : [0]);
    const steps = [];
    let run = 0;
    for (let i = 0; i < n; i++) {
        const v = s.values[i];
        // a total shows what has been added up so far (the first one is where it starts: its own value)
        if (totals.has(i) || (v === null && i === n - 1)) { if (i === 0 && v !== null) run = v; steps.push({ from: 0, to: run, kind: 'total' }); }
        else { const d = v || 0; steps.push({ from: run, to: run + d, kind: d >= 0 ? 'up' : 'down', d }); run += d; }
    }
    const plot = frame(ctx, o, []);
    let lo = 0, hi = 0;
    for (const x of steps) { lo = Math.min(lo, x.from, x.to); hi = Math.max(hi, x.from, x.to); }
    const axis = axisOf(spec, s);
    const scale = niceScale(lo, hi, axis);
    ctx.font = '11px ' + FONT;
    const wL = Math.max(...scale.ticks.map((t) => ctx.measureText(numberText(t, axis, locale, true)).width)) + 8;
    const P = { x: plot.x + wL, y: plot.y + 14, w: plot.w - wL, h: plot.h - 32 };
    const valAt = (v) => P.y + P.h - ((v - scale.lo) / (scale.hi - scale.lo)) * P.h;
    for (const t of scale.ticks) {
        const y = Math.round(valAt(t)) + 0.5;
        if (spec.grid !== false) { ctx.strokeStyle = INK.grid; ctx.beginPath(); ctx.moveTo(P.x, y); ctx.lineTo(P.x + P.w, y); ctx.stroke(); }
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; label(ctx, numberText(t, axis, locale, true), P.x - 6, y, INK.muted, halo, '400');
    }
    const band = P.w / n, w = band * 0.62;
    const colors = { total: spec.totalColor || STATUS.total, up: spec.upColor || STATUS.up, down: spec.downColor || STATUS.down };
    steps.forEach((x, i) => {
        const left = P.x + band * i + (band - w) / 2, a = valAt(x.from), b = valAt(x.to);
        ctx.fillStyle = colors[x.kind]; ctx.fillRect(left, Math.min(a, b), w, Math.max(1, Math.abs(b - a)));
        hits.push({ x: left, y: Math.min(a, b), w, h: Math.abs(b - a), category: i, series: 0, value: x.kind === 'total' ? x.to : x.d });
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        label(ctx, numberText(x.kind === 'total' ? x.to : x.d, axis, locale, false), left + w / 2, Math.min(a, b) - 3, INK.text, halo);
        ctx.textBaseline = 'middle'; label(ctx, model.categories[i], left + w / 2, P.y + P.h + 10, INK.axis, halo, '400');
        // the dotted step to the next bar, at the level this one ends
        if (i < n - 1) {
            const y = Math.round(valAt(x.to)) + 0.5;
            ctx.strokeStyle = INK.base; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(left + w, y); ctx.lineTo(left + band, y); ctx.stroke(); ctx.setLineDash([]);
        }
    });
}

// ---- sparklines: a small chart in one cell, without axes ------------------------------------------------------------------------------------------

/**
 * Draws a sparkline: a line (with a dot on the last value, or on every value, or none), columns, or win/loss (up for a positive number, down for a
 * negative one). Gaps (null) break the line and leave a column out.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ width: number, height: number, values: Array<number|null>, type?: string, color?: string, negColor?: string, markers?: string, min?: number, max?: number }} o
 */
export function drawSparkline(ctx, o) {
    const { width, height, values } = o;
    ctx.clearRect(0, 0, width, height);
    const pad = 3, w = width - pad * 2, h = height - pad * 2;
    const nums = values.filter((v) => v !== null);
    if (!nums.length || w <= 2 || h <= 2) return;
    const color = o.color || PALETTE[0], neg = o.negColor || STATUS.bad;
    const n = values.length;
    if (o.type === 'column' || o.type === 'winloss') {
        const lo = o.type === 'winloss' ? -1 : Math.min(0, Number.isFinite(o.min) ? o.min : Math.min(...nums));
        const hi = o.type === 'winloss' ? 1 : Math.max(0, Number.isFinite(o.max) ? o.max : Math.max(...nums));
        const y = (v) => pad + h - ((v - lo) / (hi - lo || 1)) * h;
        const band = w / n, bw = Math.max(1, band * 0.7);
        values.forEach((v, i) => {
            if (v === null || v === 0) return;
            const val = o.type === 'winloss' ? Math.sign(v) : v;
            const a = y(0), b = y(val);
            ctx.fillStyle = v < 0 ? neg : color;
            ctx.fillRect(pad + band * i + (band - bw) / 2, Math.min(a, b), bw, Math.max(1, Math.abs(b - a)));
        });
        return;
    }
    const lo = Number.isFinite(o.min) ? o.min : Math.min(...nums), hi = Number.isFinite(o.max) ? o.max : Math.max(...nums);
    const x = (i) => pad + (n === 1 ? w / 2 : (i / (n - 1)) * w);
    const y = (v) => pad + h - ((v - lo) / (hi - lo || 1)) * h;
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
    ctx.beginPath();
    let pen = false;
    values.forEach((v, i) => { if (v === null) { pen = false; return; } if (pen) ctx.lineTo(x(i), y(v)); else ctx.moveTo(x(i), y(v)); pen = true; });
    ctx.stroke();
    const dot = (i) => { ctx.beginPath(); ctx.arc(x(i), y(values[i]), 2.2, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); };
    if (o.markers === 'all') values.forEach((v, i) => { if (v !== null) dot(i); });
    else if (o.markers !== 'none') { for (let i = n - 1; i >= 0; i--) if (values[i] !== null) { dot(i); break; } }
}
