// Charts and sparklines in an .xlsx file, as Excel keeps them, so a chart made in the sheet is a real Excel chart in the file (it follows its cells
// there too) and a chart of a file comes into the sheet:
//   - a sheet's charts are one drawing part (xl/drawings/drawingN.xml), linked from the sheet (<drawing r:id/>), each chart a twoCellAnchor on its
//     block of cells with a graphicFrame that points at its chart part (xl/charts/chartK.xml, DrawingML);
//   - a chart part names each series' own cells: its name (c:tx), its categories (c:cat) and its values (c:val), as formulas of the file;
//   - the sheet's sparklines are an extension of the worksheet (x14:sparklineGroups).
// What Excel has no chart for here is written as the closest one: a bullet as bars, a waterfall as columns of its steps.
// Pure (strings in, strings out).

import { colName } from '../formula/address.js';
import { kid, kids } from './read-base.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const quote = (name) => "'" + String(name).replace(/'/g, "''") + "'";
const abs = (r, c) => '$' + colName(c) + '$' + (r + 1);
const ref = (sheet, r1, c1, r2, c2) => quote(sheet) + '!' + abs(r1, c1) + (r1 === r2 && c1 === c2 ? '' : ':' + abs(r2, c2));
const hex = (color) => String(color || '').replace('#', '').toUpperCase();
const EMU = 9525; // one pixel, in the drawing's units

/** Carbon's colours, the sheet's chart palette, in the order its series take them. */
const PALETTE = ['6929C4', '1192E8', '005D5D', '9F1853', 'FA4D56', '520408', '198038', '002D9C', 'EE5396', 'B28600', '009D9A', '012749', '8A3800', 'A56EFF'];

/**
 * The cells of each part of a chart, from where its data stands and how it was read (chartSeries' layout): for each series { name, nameRef,
 * catRef, valRef }, by the file's sheet name of its data.
 * @param {{ sheet: string, rect: { r1: number, c1: number, r2: number, c2: number }, layout: { by: string, catCol: boolean, headerRow: boolean }, series: any[] }} x
 */
export function seriesRefs(x) {
    const { sheet, rect: d, layout } = x;
    const cols = layout.by === 'cols';
    // in "series down the columns" terms: the first row may be the names, the first column the categories
    const top = cols ? d.r1 : d.c1, left = cols ? d.c1 : d.r1, bottom = cols ? d.r2 : d.c2;
    const first = top + (layout.headerRow ? 1 : 0), from = left + (layout.catCol ? 1 : 0);
    const cell = (a, b) => (cols ? [a, b] : [b, a]); // (row-ish, col-ish) back to (r, c)
    const range = (a1, b1, a2, b2) => { const [r1, c1] = cell(a1, b1), [r2, c2] = cell(a2, b2); return ref(sheet, r1, c1, r2, c2); };
    return x.series.map((s, i) => {
        const at = from + i;
        return {
            name: s.name, color: s.color, kind: s.kind, axis: s.axis, dash: s.dash, hidden: s.hidden,
            nameRef: layout.headerRow ? range(top, at, top, at) : null,
            catRef: layout.catCol ? range(first, left, bottom, left) : null,
            valRef: range(first, at, bottom, at)
        };
    });
}

// ---- writing ----------------------------------------------------------------------------------------------------------------------------------

function seriesXml(s, i, chartType) {
    const color = hex(s.color) || PALETTE[i % PALETTE.length];
    const tx = s.nameRef ? '<c:tx><c:strRef><c:f>' + esc(s.nameRef) + '</c:f></c:strRef></c:tx>' : '<c:tx><c:v>' + esc(s.name) + '</c:v></c:tx>';
    const line = chartType === 'line';
    const fill = line
        ? '<c:spPr><a:ln w="28575" cap="rnd"><a:solidFill><a:srgbClr val="' + color + '"/></a:solidFill>' + (s.dash ? '<a:prstDash val="dash"/>' : '') + '<a:round/></a:ln></c:spPr>'
        : chartType === 'pie' ? '' : '<c:spPr><a:solidFill><a:srgbClr val="' + color + '"/></a:solidFill></c:spPr>';
    const marker = line ? '<c:marker><c:symbol val="circle"/><c:size val="5"/></c:marker>' : '';
    const cat = s.catRef ? '<c:cat><c:strRef><c:f>' + esc(s.catRef) + '</c:f></c:strRef></c:cat>' : '';
    const val = '<c:val><c:numRef><c:f>' + esc(s.valRef) + '</c:f></c:numRef></c:val>';
    return '<c:ser><c:idx val="' + i + '"/><c:order val="' + i + '"/>' + tx + fill + (chartType === 'bar' ? '<c:invertIfNegative val="0"/>' : '') + marker + cat + val
        + (line ? '<c:smooth val="' + (s.smooth ? 1 : 0) + '"/>' : '') + '</c:ser>';
}
const axesXml = (catId, valId, valPos, deleteCat, horizontal, percent) =>
    '<c:catAx><c:axId val="' + catId + '"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="' + (deleteCat ? 1 : 0) + '"/><c:axPos val="' + (horizontal ? 'l' : 'b') + '"/>'
    + '<c:numFmt formatCode="General" sourceLinked="1"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="' + valId + '"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>'
    + '<c:valAx><c:axId val="' + valId + '"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="' + valPos + '"/>'
    + (valPos === 'r' ? '' : '<c:majorGridlines><c:spPr><a:ln w="9525"><a:solidFill><a:srgbClr val="E0E0E0"/></a:solidFill></a:ln></c:spPr></c:majorGridlines>')
    + '<c:numFmt formatCode="' + (percent ? '0%' : 'General') + '" sourceLinked="' + (percent ? 0 : 1) + '"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="' + catId + '"/><c:crosses val="' + (valPos === 'r' ? 'max' : 'autoZero') + '"/><c:crossBetween val="between"/></c:valAx>';

/**
 * One chart part. `c` is the chart as wb.charts gives it with `refs` (seriesRefs) and `percent` (its values are percents).
 * @returns {string}
 */
export function chartXml(c) {
    const type = c.type;
    const visible = c.refs.filter((s) => !s.hidden);
    const seriesKind = (s) => (type === 'combo' ? (s.kind === 'line' || s.kind === 'area' ? s.kind : 'bar') : type === 'line' ? (s.kind === 'column' ? 'bar' : 'line') : type === 'area' ? 'area' : 'bar');
    let plot = '';
    if (type === 'pie' || type === 'donut') {
        const s = visible[0];
        const tag = type === 'donut' ? 'c:doughnutChart' : 'c:pieChart';
        // each slice its own colour, as the sheet draws them
        const points = (c.colors || PALETTE.map((x) => '#' + x)).slice(0, 32).map((col, i) => '<c:dPt><c:idx val="' + i + '"/><c:bubble3D val="0"/><c:spPr><a:solidFill><a:srgbClr val="' + (hex(col) || PALETTE[i % PALETTE.length]) + '"/></a:solidFill><a:ln w="19050"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:ln></c:spPr></c:dPt>').join('');
        const ser = s ? seriesXml(s, 0, 'pie').replace('</c:tx>', '</c:tx>' + points) : '';
        plot = '<' + tag + '><c:varyColors val="1"/>' + ser + (c.labels ? '<c:dLbls><c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="1"/><c:showBubbleSize val="0"/></c:dLbls>' : '')
            + '<c:firstSliceAng val="0"/>' + (type === 'donut' ? '<c:holeSize val="60"/>' : '') + '</' + tag + '>';
    } else {
        const horizontal = type === 'bar' || type === 'bullet';
        const groups = [['bar', 'left'], ['line', 'left'], ['area', 'left'], ['bar', 'right'], ['line', 'right'], ['area', 'right']];
        const ids = { left: [500000001, 500000002], right: [500000003, 500000004] };
        let index = 0, usesRight = false;
        const labels = c.labels ? '<c:dLbls><c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls>' : '';
        for (const [kind, side] of groups) {
            const list = visible.filter((s) => seriesKind(s) === kind && (s.axis === 'right' ? 'right' : 'left') === side);
            if (!list.length) continue;
            if (side === 'right') usesRight = true;
            const sers = list.map((s) => seriesXml({ ...s, smooth: c.smooth }, index++, kind)).join('');
            const axIds = '<c:axId val="' + ids[side][0] + '"/><c:axId val="' + ids[side][1] + '"/>';
            if (kind === 'bar') {
                const grouping = c.stacked ? 'stacked' : 'clustered';
                plot += '<c:barChart><c:barDir val="' + (horizontal ? 'bar' : 'col') + '"/><c:grouping val="' + grouping + '"/><c:varyColors val="0"/>' + sers + labels
                    + '<c:gapWidth val="60"/>' + (c.stacked ? '<c:overlap val="100"/>' : '') + axIds + '</c:barChart>';
            } else if (kind === 'line') {
                plot += '<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>' + sers + labels + '<c:marker val="1"/>' + axIds + '</c:lineChart>';
            } else {
                plot += '<c:areaChart><c:grouping val="' + (c.stacked ? 'stacked' : 'standard') + '"/><c:varyColors val="0"/>' + sers + labels + axIds + '</c:areaChart>';
            }
        }
        plot += axesXml(ids.left[0], ids.left[1], horizontal ? 'b' : 'l', c.xAxis === false, horizontal, c.percent && !usesRight);
        if (usesRight) plot += axesXml(ids.right[0], ids.right[1], 'r', true, false, c.percent);
    }
    const title = c.title ? '<c:title><c:tx><c:rich><a:bodyPr/><a:p><a:pPr><a:defRPr sz="1400" b="1"/></a:pPr><a:r><a:rPr lang="en-US" sz="1400" b="1"/><a:t>' + esc(c.title) + '</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>' : '<c:autoTitleDeleted val="1"/>';
    const legendPos = { top: 't', right: 'r', bottom: 'b' }[c.legend || 'top'];
    const legend = legendPos ? '<c:legend><c:legendPos val="' + legendPos + '"/><c:overlay val="0"/></c:legend>' : '';
    const bg = c.background === 'none' ? '<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>' : '<c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln w="9525"><a:solidFill><a:srgbClr val="C6C6C6"/></a:solidFill></a:ln></c:spPr>';
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        + '<c:roundedCorners val="0"/><c:chart>' + title + '<c:plotArea><c:layout/>' + plot + (c.background === 'none' ? '<c:spPr><a:noFill/></c:spPr>' : '') + '</c:plotArea>' + legend
        + '<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart>' + bg
        + '<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="900"><a:latin typeface="IBM Plex Sans"/></a:defRPr></a:pPr><a:endParaRPr lang="en-US"/></a:p></c:txPr>'
        + '</c:chartSpace>';
}

/**
 * The drawing part of a sheet's charts and its relationships: each chart on its cells (from its top-left cell to the cell past its bottom-right one).
 * @param {Array<{ at: { r1: number, c1: number, r2: number, c2: number }, title?: string }>} charts @param {number} firstChart  The number of the first chart part.
 */
export function drawingParts(charts, firstChart) {
    const anchors = charts.map((c, i) => '<xdr:twoCellAnchor editAs="twoCell">'
        + '<xdr:from><xdr:col>' + c.at.c1 + '</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>' + c.at.r1 + '</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>'
        + '<xdr:to><xdr:col>' + (c.at.c2 + 1) + '</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>' + (c.at.r2 + 1) + '</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>'
        + '<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="' + (i + 2) + '" name="Chart ' + (i + 1) + '"' + (c.title ? ' descr="' + esc(c.title) + '"' : '') + '/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>'
        + '<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">'
        + '<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="rId' + (i + 1) + '"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>').join('');
    const drawing = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' + anchors + '</xdr:wsDr>';
    const rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + charts.map((c, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart' + (firstChart + i) + '.xml"/>').join('') + '</Relationships>';
    return { drawing, rels };
}

/** The sparklines of a sheet as the worksheet's extension (x14), each cell with the range it reads. */
export function sparklinesXml(groups) {
    if (!groups.length) return '';
    const body = groups.map((g) => {
        const type = g.type === 'column' ? ' type="column"' : g.type === 'winloss' ? ' type="stacked"' : '';
        return '<x14:sparklineGroup' + type + ' displayEmptyCellsAs="gap"' + (g.markers === 'all' ? ' markers="1"' : g.markers === 'none' ? '' : ' last="1"') + '>'
            + '<x14:colorSeries rgb="FF' + (hex(g.color) || PALETTE[0]) + '"/><x14:colorNegative rgb="FF' + (hex(g.negColor) || 'DA1E28') + '"/><x14:colorMarkers rgb="FF' + (hex(g.color) || PALETTE[0]) + '"/>'
            + '<x14:colorFirst rgb="FF' + (hex(g.color) || PALETTE[0]) + '"/><x14:colorLast rgb="FF' + (hex(g.color) || PALETTE[0]) + '"/><x14:colorHigh rgb="FF' + (hex(g.color) || PALETTE[0]) + '"/><x14:colorLow rgb="FF' + (hex(g.color) || PALETTE[0]) + '"/>'
            + '<x14:sparklines>' + g.cells.map((x) => '<x14:sparkline><xm:f>' + esc(x.ref) + '</xm:f><xm:sqref>' + colName(x.c) + (x.r + 1) + '</xm:sqref></x14:sparkline>').join('') + '</x14:sparklines></x14:sparklineGroup>';
    }).join('');
    return '<extLst><ext uri="{05C60535-1F16-4fd2-B633-F4F36F0B64E0}" xmlns:x14="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main"><x14:sparklineGroups xmlns:xm="http://schemas.microsoft.com/office/excel/2006/main">'
        + body + '</x14:sparklineGroups></ext></extLst>';
}

// ---- reading ----------------------------------------------------------------------------------------------------------------------------------

/** "'Data'!$A$2:$A$13" as { sheet, r1, c1, r2, c2 }, or null. */
export function readRef(text) {
    const m = /^(?:'((?:[^']|'')+)'|([^!]+))!\$?([A-Z]{1,3})\$?(\d+)(?::\$?([A-Z]{1,3})\$?(\d+))?$/.exec(String(text || '').trim());
    if (!m) return null;
    const col = (s) => s.split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
    const r1 = Number(m[4]) - 1, c1 = col(m[3]), r2 = m[6] ? Number(m[6]) - 1 : r1, c2 = m[5] ? col(m[5]) : c1;
    return { sheet: m[1] ? m[1].replace(/''/g, "'") : m[2], r1, c1, r2, c2 };
}

const val = (node) => (node ? node.attrs.val : undefined);
const formulaIn = (node) => { const f = node && (kid(kid(node, 'numRef'), 'f') || kid(kid(node, 'strRef'), 'f')); return f ? f.text : null; };

/**
 * A chart part read back into what the sheet keeps: its type, title, legend, stacked, the series' colours and kinds, and the one block of cells
 * that holds all its parts (the categories, the names and the values), with how its series run. Null when its parts are not one block of one sheet.
 * @param {any} space  The parsed c:chartSpace.
 */
export function readChart(space) {
    const chart = kid(space, 'chart');
    const plot = kid(chart, 'plotArea');
    if (!plot) return null;
    const kinds = { 'barChart': 'bar', 'lineChart': 'line', 'areaChart': 'area', 'pieChart': 'pie', 'doughnutChart': 'donut', 'pie3DChart': 'pie', 'bar3DChart': 'bar', 'line3DChart': 'line' };
    const parts = [];
    let horizontal = false, stacked = false;
    const rightAxes = new Set();
    for (const ax of kids(plot, 'valAx')) if (val(kid(ax, 'axPos')) === 'r') rightAxes.add(val(kid(ax, 'axId')));
    for (const node of plot.children || []) {
        const kind = kinds[node.name];
        if (!kind) continue;
        if (kind === 'bar' && val(kid(node, 'barDir')) === 'bar') horizontal = true;
        const grouping = val(kid(node, 'grouping'));
        if (grouping === 'stacked' || grouping === 'percentStacked') stacked = true;
        const right = kids(node, 'axId').some((a) => rightAxes.has(val(a)));
        for (const ser of kids(node, 'ser')) parts.push({ kind, right, ser });
    }
    if (!parts.length) return null;
    const kindsUsed = new Set(parts.map((p) => p.kind));
    let type;
    if (kindsUsed.has('pie')) type = 'pie';
    else if (kindsUsed.has('donut')) type = 'donut';
    else if (kindsUsed.size > 1 || parts.some((p) => p.right)) type = 'combo';
    else type = kindsUsed.has('line') ? 'line' : kindsUsed.has('area') ? 'area' : horizontal ? 'bar' : 'column';
    const refs = [], series = [];
    for (const p of parts) {
        const v = readRef(formulaIn(kid(p.ser, 'val')));
        if (!v) return null;
        const cat = readRef(formulaIn(kid(p.ser, 'cat')));
        const name = readRef(formulaIn(kid(p.ser, 'tx')));
        refs.push(v); if (cat) refs.push(cat); if (name) refs.push(name);
        const fill = kid(kid(kid(p.ser, 'spPr'), 'solidFill'), 'srgbClr') || kid(kid(kid(kid(p.ser, 'spPr'), 'ln'), 'solidFill'), 'srgbClr');
        const own = {};
        if (fill && fill.attrs.val) own.color = '#' + fill.attrs.val.toLowerCase();
        if (type === 'combo') own.type = p.kind === 'bar' ? 'column' : p.kind;
        if (p.right) own.axis = 'right';
        if (kid(kid(kid(p.ser, 'spPr'), 'ln'), 'prstDash')) own.dash = true;
        series.push({ own, v });
    }
    if (new Set(refs.map((x) => x.sheet)).size !== 1) return null;
    const box = refs.reduce((b, x) => ({ r1: Math.min(b.r1, x.r1), c1: Math.min(b.c1, x.c1), r2: Math.max(b.r2, x.r2), c2: Math.max(b.c2, x.c2) }), { r1: Infinity, c1: Infinity, r2: -1, c2: -1 });
    // the values of one series in a column: the series run down the columns
    const v0 = series[0].v;
    const seriesIn = v0.c1 === v0.c2 && v0.r2 > v0.r1 ? 'cols' : v0.r1 === v0.r2 && v0.c2 > v0.c1 ? 'rows' : 'auto';
    const titleRuns = kids(kid(kid(kid(kid(chart, 'title'), 'tx'), 'rich'), 'p'), 'r');
    const title = titleRuns.map((r) => (kid(r, 't') || {}).text || '').join('');
    const legendPos = val(kid(kid(chart, 'legend'), 'legendPos'));
    const out = { type, sheet: refs[0].sheet, box, seriesIn, stacked, series: series.map((s) => s.own) };
    if (title) out.title = title;
    out.legend = !kid(chart, 'legend') ? 'none' : legendPos === 'r' ? 'right' : legendPos === 'b' ? 'bottom' : 'top';
    if (kid(kid(space, 'spPr'), 'noFill')) out.background = 'none';
    return out;
}

/** The cells a drawing's anchors stand on, in their order, with the relationship id of their chart: [{ at, rid }]. */
export function readAnchors(wsDr) {
    const out = [];
    for (const a of (wsDr && wsDr.children) || []) {
        if (a.name !== 'twoCellAnchor' && a.name !== 'oneCellAnchor') continue;
        const from = kid(a, 'from'), to = kid(a, 'to');
        const chartRef = kid(kid(kid(kid(a, 'graphicFrame'), 'graphic'), 'graphicData'), 'chart');
        if (!from || !chartRef) continue;
        const n = (node, k) => Number((kid(node, k) || {}).text || 0);
        const r1 = n(from, 'row'), c1 = n(from, 'col');
        // the cell past its corner, unless the corner sits exactly on a cell's edge
        const r2 = to ? Math.max(r1, n(to, 'row') - (n(to, 'rowOff') ? 0 : 1)) : r1 + 14;
        const c2 = to ? Math.max(c1, n(to, 'col') - (n(to, 'colOff') ? 0 : 1)) : c1 + 6;
        out.push({ at: { r1, c1, r2, c2 }, rid: chartRef.attrs.id });
    }
    return out;
}
export { EMU };
