// (Copied from the Nexa data grid.) the sheet as an Excel file (.xlsx). Pure (no DOM): it makes the text of the files of the package; the view puts them in a zip (the chart's
// zipStore) and downloads it.
//
// The model it takes is plain data: the cells (with the value as Excel keeps it, the number format, the font, the fill, the alignment and the borders), the
// widths and heights, the merges, the frozen panes. The view makes it from the grid as it is shown.
import { colName } from "../formula/address.js";
import { dateToSerial } from "../formula/xlvalue.js";
import { validationsXml, notesParts } from "./notes.js";
import { chartXml, drawingParts, sparklinesXml } from "./charts.js";

const xmlEsc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]);
// characters XML cannot hold at all (control characters other than tab, new line, carriage return)
const clean = (s) => String(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");

// ---- colours -----------------------------------------------------------------------------------------------------------------------------
const NAMED = {
    black: "000000", white: "FFFFFF", red: "FF0000", green: "008000", blue: "0000FF", yellow: "FFFF00", orange: "FFA500", purple: "800080", gray: "808080", grey: "808080",
    silver: "C0C0C0", maroon: "800000", olive: "808000", lime: "00FF00", aqua: "00FFFF", teal: "008080", navy: "000080", fuchsia: "FF00FF", pink: "FFC0CB", brown: "A52A2A",
    // the grid's own short names (see sheet.js colorOf / layout.js resolveColor)
    primary: "0F62FF", text: "161616", muted: "6F6F6F", error: "DA1E28", border: "C6C6C6", bd: "C6C6C6", "bd-strong": "8D8D8D", fg: "161616"
};

// the grid's own theme variables, as the colours they have in the light theme (a file has no theme)
const VARS = { "--cp-solid": "0F62FF", "--bd": "C6C6C6", "--bd-strong": "8D8D8D", "--fg": "161616", "--fg-muted": "6F6F6F", "--err": "DA1E28" };

/** A CSS colour as Excel's ARGB ("FFRRGGBB"), or null when it has no colour of its own (empty, transparent, a theme variable). */
export function cssToArgb(color) {
    const t = String(color === undefined || color === null ? "" : color).trim().toLowerCase();
    if (!t || t === "transparent" || t === "inherit") return null;
    const v = /^var\(\s*(--[a-z-]+)\s*(?:,.*)?\)$/.exec(t);
    if (v) return VARS[v[1]] ? "FF" + VARS[v[1]] : null;
    if (t.indexOf("var(") !== -1) return null;
    if (NAMED[t]) return "FF" + NAMED[t];
    let m = /^#([0-9a-f]{3})$/.exec(t);
    if (m) return ("FF" + m[1].split("").map((c) => c + c).join("")).toUpperCase();
    m = /^#([0-9a-f]{6})/.exec(t);
    if (m) return ("FF" + m[1]).toUpperCase();
    m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/.exec(t);
    if (m) return ("FF" + [m[1], m[2], m[3]].map((v) => Math.max(0, Math.min(255, Number(v))).toString(16).padStart(2, "0")).join("")).toUpperCase();
    return null;
}

// ---- sizes and dates ---------------------------------------------------------------------------------------------------------------------
/** A column width in pixels as Excel's character width (a column of 7-pixel characters, with 5 pixels of padding). */
export function pxToChars(px) { return Math.round(Math.max(0, (Number(px) - 5) / 7) * 100) / 100; }

/** A row height in pixels as points. */
export function pxToPoints(px) { return Math.round(Number(px) * 75) / 100; }

/** A date as Excel keeps it: days since 1899-12-30, the fraction being the time of day (as the clock on the viewer's wall reads, as the grid shows it). */
export function excelSerial(date) { return dateToSerial(date); }

/** The number format code of a number cell: decimals and a unit ("0.0" and " °C" -> 0.0" °C"). "" = the general format. */
export function numberFormat(decimals, suffix) {
    const base = decimals >= 0 ? (decimals === 0 ? "0" : "0." + "0".repeat(decimals)) : "";
    const unit = suffix ? '"' + String(suffix).replace(/"/g, "") + '"' : "";
    if (!unit) return base;
    return (base || "General") + unit;
}

const BORDER_STYLE = (style, width) => {
    const w = Number(width) || 1;
    if (style === "dashed") return w >= 2 ? "mediumDashed" : "dashed";
    if (style === "dotted") return "dotted";
    if (style === "double") return "double";
    return w >= 3 ? "thick" : w >= 2 ? "medium" : "thin";
};

// ---- the styles ---------------------------------------------------------------------------------------------------------------------------
function registry() {
    const list = [], at = new Map();
    return { list, get(item) { const k = JSON.stringify(item); if (!at.has(k)) { at.set(k, list.length); list.push(item); } return at.get(k); } };
}

function fontXml(f) {
    return "<font>" + (f.b ? "<b/>" : "") + (f.i ? "<i/>" : "") + (f.s ? "<strike/>" : "") + (f.u ? "<u/>" : "") + '<sz val="' + (f.sz || 10) + '"/>'
        + (f.color ? '<color rgb="' + f.color + '"/>' : '<color theme="1"/>') + '<name val="' + xmlEsc(f.name || "Arial") + '"/><family val="2"/></font>';
}

function borderXml(b) {
    const side = (name, s) => (s ? "<" + name + ' style="' + BORDER_STYLE(s.style, s.width) + '"><color rgb="' + (cssToArgb(s.color) || "FF8D8D8D") + '"/></' + name + ">" : "<" + name + "/>");
    return "<border>" + side("left", b.l) + side("right", b.r) + side("top", b.t) + side("bottom", b.b) + "<diagonal/></border>";
}

/**
 * The files of the package for a model:
 *   { name, cells: [{ r, c, kind: "n" | "s" | "b" | null, v, fmt, font: { b, i, u, s, sz, color, name }, fill, align: { h, v, wrap }, border: { t, r, b, l } }],
 *     cols: { c: px }, rows: { r: px }, defaultCol: px, defaultRow: px, merges: [{ r1, c1, r2, c2 }], freeze: { rows, cols } }
 * (r and c from 0; "fill" and a font's "color" are ARGB; a border side is { style, width, color }). Returns [{ name, text }].
 */
export function buildXlsxFiles(book) {
    const models = book.sheets || [book];
    const fonts = registry(), fills = registry(), borders = registry(), fmts = registry(), xfs = registry();
    fonts.get({});
    fills.get({ none: true }); fills.get({ gray125: true });
    borders.get({});
    xfs.get({ f: 0, fi: 0, b: 0, n: 0, a: null });
    // the styles of the rules of conditional formatting (Excel keeps them apart from the cells' styles)
    const dxfs = registry();
    let priority = 0;
    const cfXml = (model) => (model.conditionals || []).map((rule) => {
        const sqref = rule.rects.map((b) => colName(b.c1) + (b.r1 + 1) + (b.r2 > b.r1 || b.c2 > b.c1 ? ':' + colName(b.c2) + (b.r2 + 1) : '')).join(' ');
        priority++;
        if (rule.type === 'dataBar') {
            return '<conditionalFormatting sqref="' + sqref + '"><cfRule type="dataBar" priority="' + priority + '"><dataBar><cfvo type="min"/><cfvo type="max"/><color rgb="' + (cssToArgb(rule.color) || 'FF6929C4') + '"/></dataBar></cfRule></conditionalFormatting>';
        }
        if (rule.type === 'colorScale') {
            const cfvo = rule.scale.map((p) => '<cfvo type="' + p.type + '"' + (p.value !== undefined ? ' val="' + xmlEsc(String(p.value)) + '"' : '') + '/>').join('');
            const colors = rule.scale.map((p) => '<color rgb="' + (cssToArgb(p.color) || 'FFFFFFFF') + '"/>').join('');
            return '<conditionalFormatting sqref="' + sqref + '"><cfRule type="colorScale" priority="' + priority + '"><colorScale>' + cfvo + colors + '</colorScale></cfRule></conditionalFormatting>';
        }
        const dxf = dxfs.get(rule.style);
        return '<conditionalFormatting sqref="' + sqref + '"><cfRule type="' + rule.type + '" dxfId="' + dxf + '" priority="' + priority + '" stopIfTrue="1"'
            + (rule.operator ? ' operator="' + rule.operator + '"' : '') + (rule.text !== undefined ? ' text="' + xmlEsc(rule.text) + '"' : '') + '>'
            + (rule.formulas || []).map((f) => '<formula>' + xmlEsc(f) + '</formula>').join('') + '</cfRule></conditionalFormatting>';
    }).join('');
    // the filter of a sheet: the values that show, or Excel's custom filters
    const autoFilterXml = (af) => {
        if (!af) return '';
        const cols = af.columns.map((c) => '<filterColumn colId="' + c.colId + '">' + (c.custom
            ? '<customFilters' + (c.custom.and ? ' and="1"' : '') + '>' + c.custom.list.map((x) => '<customFilter operator="' + x.operator + '" val="' + xmlEsc(String(x.val)) + '"/>').join('') + '</customFilters>'
            : '<filters' + (c.blank ? ' blank="1"' : '') + '>' + c.values.map((v) => '<filter val="' + xmlEsc(v) + '"/>').join('') + '</filters>') + '</filterColumn>').join('');
        return '<autoFilter ref="' + af.ref + '">' + cols + '</autoFilter>';
    };
    const dxfXml = (s) => {
        const font = (s.bold ? '<b/>' : '') + (s.italic ? '<i/>' : '') + (s.strike ? '<strike/>' : '') + (s.underline ? '<u/>' : '') + (s.color ? '<color rgb="' + cssToArgb(s.color) + '"/>' : '');
        return '<dxf>' + (font ? '<font>' + font + '</font>' : '') + (s.fill ? '<fill><patternFill patternType="solid"><bgColor rgb="' + cssToArgb(s.fill) + '"/></patternFill></fill>' : '') + '</dxf>';
    };

    const xfOf = (cell) => {
        const font = cell.font && Object.keys(cell.font).some((k) => cell.font[k]) ? fonts.get(cell.font) : 0;
        const fill = cell.fill ? fills.get({ rgb: cell.fill }) : 0;
        const border = cell.border && Object.keys(cell.border).some((k) => cell.border[k]) ? borders.get(cell.border) : 0;
        const numFmt = cell.fmt ? fmts.get(cell.fmt) + 164 : 0;
        const a = cell.align && (cell.align.h || cell.align.v || cell.align.wrap) ? { h: cell.align.h || "", v: cell.align.v || "", w: !!cell.align.wrap } : null;
        return xfs.get({ f: font, fi: fill, b: border, n: numFmt, a });
    };

    const renderSheet = (model) => {
        const sheetName = clean(model.name || "Sheet1").replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Sheet1";
        // the rows of cells, in order
        const byRow = new Map();
        model.cells.forEach((cell) => { if (!byRow.has(cell.r)) byRow.set(cell.r, []); byRow.get(cell.r).push(cell); });
        // hidden rows and columns stay hidden in the file (the sheet's own addition)
        const hiddenRows = new Set(model.hiddenRows || []), hiddenCols = new Set(model.hiddenCols || []);
        const rowLevels = model.rowLevels || {}, colLevels = model.colLevels || {}, collapsedRows = new Set(model.collapsedRows || []), collapsedCols = new Set(model.collapsedCols || []);
        const rowNumbers = [...new Set([...byRow.keys(), ...Object.keys(model.rows || {}).map(Number), ...hiddenRows, ...Object.keys(rowLevels).map(Number), ...collapsedRows])].sort((a, b) => a - b);
        let maxR = -1, maxC = -1;
        const rowsXml = rowNumbers.map((r) => {
            const ht = (model.rows && model.rows[r] !== undefined && model.rows[r] !== model.defaultRow ? ' ht="' + pxToPoints(model.rows[r]) + '" customHeight="1"' : "") + (hiddenRows.has(r) ? ' hidden="1"' : "") + (rowLevels[r] ? ' outlineLevel="' + rowLevels[r] + '"' : "") + (collapsedRows.has(r) ? ' collapsed="1"' : "");
            const cells = (byRow.get(r) || []).sort((a, b) => a.c - b.c).map((cell) => {
                if (cell.r > maxR) maxR = cell.r;
                if (cell.c > maxC) maxC = cell.c;
                const ref = colName(cell.c) + (cell.r + 1), s = xfOf(cell);
                const style = s ? ' s="' + s + '"' : "";
                // a formula goes as the formula with its result next to it (Excel works it out again when the file opens)
                const f = typeof cell.formula === "string" && cell.formula.length > 1 ? "<f>" + xmlEsc(cell.formula.slice(1)) + "</f>" : "";
                if (cell.kind === "e") return '<c r="' + ref + '"' + style + ' t="e">' + f + "<v>" + xmlEsc(String(cell.v)) + "</v></c>";
                if (cell.kind === "n" && typeof cell.v === "number" && isFinite(cell.v)) return '<c r="' + ref + '"' + style + ">" + f + "<v>" + cell.v + "</v></c>";
                if (cell.kind === "b") return '<c r="' + ref + '"' + style + ' t="b">' + f + "<v>" + (cell.v ? 1 : 0) + "</v></c>";
                if (f && cell.kind === "s") return '<c r="' + ref + '"' + style + ' t="str">' + f + "<v>" + xmlEsc(clean(cell.v)) + "</v></c>";
                if (cell.kind === "s") return '<c r="' + ref + '"' + style + ' t="inlineStr"><is><t xml:space="preserve">' + xmlEsc(clean(cell.v)) + "</t></is></c>";
                return '<c r="' + ref + '"' + style + "/>";
            }).join("");
            return '<row r="' + (r + 1) + '"' + ht + ">" + cells + "</row>";
        }).join("");

        const colNumbers = [...new Set([...Object.keys(model.cols || {}).map(Number), ...hiddenCols, ...Object.keys(colLevels).map(Number), ...collapsedCols])].sort((a, b) => a - b);
        const colsXml = colNumbers.length ? "<cols>" + colNumbers.map((c) => '<col min="' + (c + 1) + '" max="' + (c + 1) + '"'
            + (model.cols && model.cols[c] !== undefined ? ' width="' + pxToChars(model.cols[c]) + '" customWidth="1"' : ' width="' + pxToChars(model.defaultCol || 100) + '"')
            + (hiddenCols.has(c) ? ' hidden="1"' : "") + (colLevels[c] ? ' outlineLevel="' + colLevels[c] + '"' : "") + (collapsedCols.has(c) ? ' collapsed="1"' : "") + "/>").join("") + "</cols>" : "";
        const fz = model.freeze || { rows: 0, cols: 0 };
        const pane = fz.rows || fz.cols
            ? '<pane' + (fz.cols ? ' xSplit="' + fz.cols + '"' : "") + (fz.rows ? ' ySplit="' + fz.rows + '"' : "") + ' topLeftCell="' + colName(fz.cols) + (fz.rows + 1) + '" activePane="'
                + (fz.rows && fz.cols ? "bottomRight" : fz.rows ? "bottomLeft" : "topRight") + '" state="frozen"/>' : "";
        const merges = (model.merges || []).map((m) => '<mergeCell ref="' + colName(m.c1) + (m.r1 + 1) + ":" + colName(m.c2) + (m.r2 + 1) + '"/>');
        const dim = maxR >= 0 ? '<dimension ref="A1:' + colName(Math.max(maxC, 0)) + (maxR + 1) + '"/>' : "";
        // the [−] of a group is on the row before it (its title) and on the column before it: Excel is told so (summaryBelow, summaryRight)
        const levelsRow = Math.max(0, ...Object.values(rowLevels)), levelsCol = Math.max(0, ...Object.values(colLevels));
        const outlinePr = levelsRow || levelsCol ? '<sheetPr><outlinePr summaryBelow="0" summaryRight="0"/></sheetPr>' : '';
        // data validation, and the notes (comments) with the drawing that shows them: the drawing is a part of its own, linked from the sheet
        const valid = validationsXml(model.validations || []);
        const notes = model.notes || [];
        // the charts are a drawing linked from the sheet (rId3, after the notes' two), the sparklines an extension at the end of the sheet
        const charts = model.charts || [];
        const sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' + outlinePr + dim
            + '<sheetViews><sheetView' + (model.active ? ' tabSelected="1"' : "") + ' workbookViewId="0">' + pane + "</sheetView></sheetViews>"
            + '<sheetFormatPr defaultRowHeight="' + pxToPoints(model.defaultRow || 28) + '"' + (model.defaultRow ? ' customHeight="1"' : "") + (levelsRow ? ' outlineLevelRow="' + levelsRow + '"' : "") + (levelsCol ? ' outlineLevelCol="' + levelsCol + '"' : "") + "/>" + colsXml
            + "<sheetData>" + rowsXml + "</sheetData>" + autoFilterXml(model.autoFilter) + (merges.length ? '<mergeCells count="' + merges.length + '">' + merges.join("") + "</mergeCells>" : "") + cfXml(model) + valid.xml + (charts.length ? '<drawing r:id="rId3"/>' : '') + (notes.length ? '<legacyDrawing r:id="rId1"/>' : '') + sparklinesXml(model.sparklines || []) + "</worksheet>";
        return { sheetName, hidden: !!model.hidden, sheet, notes, charts, left: valid.left };
    };
    const rendered = models.map(renderSheet);

    const numFmts = fmts.list.length ? '<numFmts count="' + fmts.list.length + '">' + fmts.list.map((code, i) => '<numFmt numFmtId="' + (164 + i) + '" formatCode="' + xmlEsc(code) + '"/>').join("") + "</numFmts>" : "";
    const fillXml = (f) => (f.none ? '<fill><patternFill patternType="none"/></fill>' : f.gray125 ? '<fill><patternFill patternType="gray125"/></fill>'
        : '<fill><patternFill patternType="solid"><fgColor rgb="' + f.rgb + '"/><bgColor indexed="64"/></patternFill></fill>');
    const xfXml = (x) => '<xf numFmtId="' + x.n + '" fontId="' + x.f + '" fillId="' + x.fi + '" borderId="' + x.b + '" xfId="0"' + (x.n ? ' applyNumberFormat="1"' : "") + (x.f ? ' applyFont="1"' : "")
        + (x.fi ? ' applyFill="1"' : "") + (x.b ? ' applyBorder="1"' : "") + (x.a ? ' applyAlignment="1"><alignment' + (x.a.h ? ' horizontal="' + x.a.h + '"' : "") + (x.a.v ? ' vertical="' + x.a.v + '"' : "") + (x.a.w ? ' wrapText="1"' : "") + "/></xf>" : "/>");
    const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' + numFmts
        + '<fonts count="' + fonts.list.length + '">' + fonts.list.map(fontXml).join("") + "</fonts>"
        + '<fills count="' + fills.list.length + '">' + fills.list.map(fillXml).join("") + "</fills>"
        + '<borders count="' + borders.list.length + '">' + borders.list.map(borderXml).join("") + "</borders>"
        + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
        + '<cellXfs count="' + xfs.list.length + '">' + xfs.list.map(xfXml).join("") + "</cellXfs>"
        + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
        + (dxfs.list.length ? '<dxfs count="' + dxfs.list.length + '">' + dxfs.list.map(dxfXml).join("") + "</dxfs>" : "") + "</styleSheet>";

    const head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    // the named ranges of the workbook ({ name, ref: "'BOQ'!$D$2:$D$200" }), as Excel keeps them
    const namesXml = book.names && book.names.length ? '<definedNames>' + book.names.map((n) => '<definedName name="' + xmlEsc(n.name) + '"' + (n.localSheetId !== undefined ? ' localSheetId="' + n.localSheetId + '"' : '') + (n.hidden ? ' hidden="1"' : '') + '>' + xmlEsc(n.ref) + '</definedName>').join('') + '</definedNames>' : '';
    const sheetParts = rendered.map((x, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        + (x.notes.length ? '<Override PartName="/xl/comments' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.comments+xml"/>' : '')
        + (x.charts.length ? '<Override PartName="/xl/drawings/drawing' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>' : '')).join("");
    // a sheet with notes: its comments part and its drawing; a sheet with charts: its chart drawing and the chart parts; all linked from the sheet's own
    // relationships (rId1, rId2 the notes', rId3 the charts')
    const noteFiles = [];
    let chartCount = 0, chartTypes = '';
    rendered.forEach((x, i) => {
        if (!x.notes.length && !x.charts.length) return;
        const n = i + 1;
        let rels = '';
        if (x.notes.length) {
            const parts = notesParts(x.notes, n);
            noteFiles.push({ name: "xl/comments" + n + ".xml", text: parts.comments });
            noteFiles.push({ name: "xl/drawings/vmlDrawing" + n + ".vml", text: parts.vml });
            rels += '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/vmlDrawing" Target="../drawings/vmlDrawing' + n + '.vml"/>'
                + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="../comments' + n + '.xml"/>';
        }
        if (x.charts.length) {
            const parts = drawingParts(x.charts, chartCount + 1);
            noteFiles.push({ name: "xl/drawings/drawing" + n + ".xml", text: parts.drawing });
            noteFiles.push({ name: "xl/drawings/_rels/drawing" + n + ".xml.rels", text: parts.rels });
            x.charts.forEach((c) => {
                chartCount++;
                noteFiles.push({ name: "xl/charts/chart" + chartCount + ".xml", text: chartXml(c) });
                chartTypes += '<Override PartName="/xl/charts/chart' + chartCount + '.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>';
            });
            rels += '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing' + n + '.xml"/>';
        }
        noteFiles.push({ name: "xl/worksheets/_rels/sheet" + n + ".xml.rels", text: head + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + rels + '</Relationships>' });
    });
    const sheetRels = rendered.map((x, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join("");
    const activeTab = Math.max(0, Math.min(rendered.length - 1, Number(book.active) || 0));
    const sheetList = rendered.map((x, i) => '<sheet name="' + xmlEsc(x.sheetName) + '" sheetId="' + (i + 1) + '"' + (x.hidden ? ' state="hidden"' : "") + ' r:id="rId' + (i + 1) + '"/>').join("");
    return [
        { name: "[Content_Types].xml", text: head + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="vml" ContentType="application/vnd.openxmlformats-officedocument.vmlDrawing"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' + sheetParts + chartTypes + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>' },
        { name: "_rels/.rels", text: head + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
        { name: "xl/workbook.xml", text: head + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="' + activeTab + '"/></bookViews><sheets>' + sheetList + '</sheets>' + namesXml + '</workbook>' },
        { name: "xl/_rels/workbook.xml.rels", text: head + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheetRels + '<Relationship Id="rId' + (rendered.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
        { name: "xl/styles.xml", text: styles }
    ].concat(rendered.map((x, i) => ({ name: "xl/worksheets/sheet" + (i + 1) + ".xml", text: x.sheet })), noteFiles);
}
