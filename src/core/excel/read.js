// An .xlsx file read into what the sheet keeps: for every sheet its name and whether it is hidden; the values (numbers, texts, booleans, errors, and
// dates as the numbers they are, with a date format); the formulas (those whose functions the sheet has; for any other, the value Excel worked out is
// kept and a warning says so); number formats (as the sheet's formats, and any other code as a custom format, which the sheet reads as Excel does);
// fonts, colours, fills, alignment, wrapping, rotation and borders; merged cells; widths and heights; hidden rows and columns; frozen panes.
// What the sheet does not take from a file (charts, pictures, comments, conditional formats, data validation, named ranges) is said in the warnings.

import { unzip, parseXml, kid, kids, BUILTIN_FORMATS } from './read-base.js';
import { colIndex } from '../formula/address.js';
import { shiftFormula, formulaProblem } from '../formula/formula.js';
import { fromExcelRule } from './conditional.js';
import { readExcelFilter } from './filter.js';
import { colName } from '../formula/address.js';

const MAX_SHEETS = 100;

/** "B7" -> { r: 6, c: 1 } (any size), or null. */
function addressOf(text) {
    const m = /^\$?([A-Za-z]{1,3})\$?(\d+)$/.exec(text || '');
    return m ? { r: Number(m[2]) - 1, c: colIndex(m[1]) } : null;
}

// ---- number formats ------------------------------------------------------------------------------------------------------------------------------

// an Excel date and time pattern in the sheet's letters: M is the month and m the minute (Excel says m for both and tells them apart by what is near)
function datePattern(code) {
    const s = code.replace(/\[[^\]]*\]/g, '').replace(/\\(.)/g, '"$1"');
    const tokens = s.match(/"[^"]*"|AM\/PM|A\/P|y+|m+|d+|h+|s+|./gi) || [];
    const ampm = tokens.some((t) => /^(AM\/PM|A\/P)$/i.test(t));
    const out = [];
    tokens.forEach((t, i) => {
        const low = t.toLowerCase();
        if (/^m+$/.test(low)) {
            // a minute when an hour stands before it or seconds after it
            const before = tokens.slice(0, i).reverse().find((x) => /^[hsdy]/i.test(x));
            const after = tokens.slice(i + 1).find((x) => /^[hsdy]/i.test(x));
            const minute = (before && /^h/i.test(before)) || (after && /^s/i.test(after));
            out.push(minute ? (low.length >= 2 ? 'mm' : 'm') : low.length >= 4 ? 'MMMM' : low.length === 3 ? 'MMM' : low.length === 2 ? 'MM' : 'M');
        } else if (/^h+$/.test(low)) out.push(ampm ? (low.length >= 2 ? 'hh' : 'h') : low.length >= 2 ? 'HH' : 'H');
        else if (/^d+$/.test(low)) out.push(low.length >= 4 ? 'dddd' : low.length === 3 ? 'ddd' : low.length === 2 ? 'dd' : 'd');
        else if (/^y+$/.test(low)) out.push(low.length <= 2 ? 'yy' : 'yyyy');
        else if (/^s+$/.test(low)) out.push(low.length >= 2 ? 'ss' : 's');
        else if (/^(AM\/PM|A\/P)$/i.test(t)) out.push('a');
        else out.push(t);
    });
    return out.join('');
}

/**
 * A number format code of Excel as the sheet's format, or null for General.
 * @param {string} code
 */
export function formatOfCode(code) {
    if (code === undefined || code === null || code === '' || /^general$/i.test(code)) return null;
    if (code === '@') return { type: 'text' };
    const first = String(code).split(';')[0];
    const bare = first.replace(/"[^"]*"/g, '').replace(/\\./g, '').replace(/\[[^\]]*\]/g, '');
    if (/\[h+\]/i.test(first)) return { type: 'duration' };
    if (/[yd]/i.test(bare) || /h/i.test(bare) || (/m/i.test(bare) && /s/i.test(bare))) {
        const hasDate = /[yd]/i.test(bare) || (/m/i.test(bare) && !/[hs]/i.test(bare));
        const hasTime = /[hs]/i.test(bare);
        return { type: hasDate && hasTime ? 'datetime' : hasTime ? 'time' : 'date', pattern: datePattern(first) };
    }
    const core = /[#0?,]*[#0?](?:\.[#0?]*)?/.exec(bare);
    const decimals = core && core[0].indexOf('.') >= 0 ? core[0].length - core[0].indexOf('.') - 1 : 0;
    if (/%/.test(bare)) return { type: 'percent', decimals };
    if (/E[+-]/i.test(bare)) return { type: 'scientific', decimals };
    // a currency: a symbol in brackets ([$Rp-421]), or a known sign before or after the number
    const bracket = /\[\$([^\]-]*)/.exec(first);
    const quoted = /"([^"]*)"/.exec(first);
    const sign = bracket ? bracket[1] : quoted && /^(Rp|\$|€|£|¥|IDR|USD|SGD|RM)\s*$/i.test(quoted[1].trim()) ? quoted[1].trim() : /^[^#0]*[$€£¥]/.test(first) ? (/[$€£¥]/.exec(first) || [''])[0] : null;
    if (sign !== null && core) return { type: 'money', decimals, symbol: sign };
    if (core && !/[^#0?,.\s-]/.test(bare.replace(/[_*]./g, ''))) {
        // a plain number, perhaps with a unit after it in quotes ("0.00 "kg"")
        const unit = /"([^"]*)"\s*$/.exec(first);
        const f = { type: 'number', decimals, thousands: core[0].includes(',') };
        if (unit) f.suffix = unit[1];
        return f;
    }
    return { type: 'custom', pattern: code };
}

// ---- styles --------------------------------------------------------------------------------------------------------------------------------------

const argbToCss = (rgb) => (!rgb || !/^[0-9a-fA-F]{8}$/.test(rgb) || rgb.slice(0, 2).toUpperCase() === '00' ? '' : '#' + rgb.slice(2).toLowerCase());
const colorOf = (node) => (node && node.attrs.rgb ? argbToCss(node.attrs.rgb) : '');
const LINES = { thin: ['solid', 1], hair: ['dotted', 1], dotted: ['dotted', 1], dashed: ['dashed', 1], dashDot: ['dashed', 1], dashDotDot: ['dashed', 1],
    mediumDashed: ['dashed', 2], mediumDashDot: ['dashed', 2], mediumDashDotDot: ['dashed', 2], slantDashDot: ['dashed', 2], medium: ['solid', 2], thick: ['solid', 3], double: ['double', 3] };

function readStyles(files) {
    const out = { xfs: [] };
    const file = files.get('xl/styles.xml');
    if (!file) return out;
    const root = kid(parseXml(new TextDecoder().decode(file)), 'styleSheet');
    const codes = {};
    kids(kid(root, 'numFmts'), 'numFmt').forEach((n) => { codes[n.attrs.numFmtId] = n.attrs.formatCode; });
    const on = (f, name) => !!kid(f, name) && kid(f, name).attrs.val !== '0' && kid(f, name).attrs.val !== 'false' && kid(f, name).attrs.val !== 'none';
    const fonts = kids(kid(root, 'fonts'), 'font').map((f) => ({
        bold: on(f, 'b'), italic: on(f, 'i'), strike: on(f, 'strike'), underline: on(f, 'u'),
        size: kid(f, 'sz') ? Number(kid(f, 'sz').attrs.val) : 0, color: colorOf(kid(f, 'color')), name: kid(f, 'name') ? kid(f, 'name').attrs.val : ''
    }));
    const fills = kids(kid(root, 'fills'), 'fill').map((f) => { const p = kid(f, 'patternFill'); return p && p.attrs.patternType === 'solid' ? colorOf(kid(p, 'fgColor')) : ''; });
    const borders = kids(kid(root, 'borders'), 'border').map((b) => {
        const side = (n) => { const s = kid(b, n); if (!s || !s.attrs.style || s.attrs.style === 'none') return null; const m = LINES[s.attrs.style] || ['solid', 1]; return { style: m[0], width: m[1], color: colorOf(kid(s, 'color')) || '#000000' }; };
        const out2 = {};
        for (const [n, k] of [['top', 'top'], ['right', 'right'], ['bottom', 'bottom'], ['left', 'left']]) { const s = side(n); if (s) out2[k] = s; }
        return Object.keys(out2).length ? out2 : null;
    });
    const base = fonts[0] || { size: 11, name: 'Calibri' };
    kids(kid(root, 'cellXfs'), 'xf').forEach((x) => {
        const style = {};
        const id = Number(x.attrs.numFmtId) || 0;
        // built-in 14 and 22 are the short date (and time) of the reader's region in Excel, so they take the sheet's locale, not a fixed pattern
        const format = codes[id] === undefined && id === 14 ? { type: 'date' } : codes[id] === undefined && id === 22 ? { type: 'datetime' } : formatOfCode(codes[id] !== undefined ? codes[id] : BUILTIN_FORMATS[id]);
        if (format) style.format = format;
        const f = fonts[Number(x.attrs.fontId) || 0];
        if (f) {
            if (f.bold) style.bold = true;
            if (f.italic) style.italic = true;
            if (f.underline) style.underline = true;
            if (f.strike) style.strike = true;
            if (f.size && f.size !== base.size) style.fontSize = f.size;
            if (f.color && f.color !== '#000000') style.color = f.color;
            if (f.name && f.name !== base.name) style.font = f.name;
        }
        const fill = fills[Number(x.attrs.fillId) || 0];
        if (fill) style.fill = fill;
        const al = kid(x, 'alignment');
        if (al) {
            if (['left', 'center', 'right'].includes(al.attrs.horizontal)) style.align = al.attrs.horizontal;
            if (al.attrs.vertical === 'top') style.valign = 'top';
            if (al.attrs.vertical === 'center') style.valign = 'middle';
            if (al.attrs.wrapText === '1' || al.attrs.wrapText === 'true') style.wrap = 'wrap';
            const rot = Number(al.attrs.textRotation) || 0;
            if (rot === 255) style.rotate = 'vertical';
            else if (rot > 0 && rot <= 90) style.rotate = rot;
            else if (rot > 90 && rot <= 180) style.rotate = -(rot - 90);
        }
        const border = borders[Number(x.attrs.borderId) || 0];
        if (border) style.borders = border;
        out.xfs.push(style);
    });
    out.baseFontSize = base.size || 11;
    // the styles of the rules of conditional formatting: a font and a fill, nothing more
    out.dxfs = kids(kid(root, 'dxfs'), 'dxf').map((d) => {
        const style = {};
        const f = kid(d, 'font');
        if (f) {
            if (on(f, 'b')) style.bold = true;
            if (on(f, 'i')) style.italic = true;
            if (on(f, 'u')) style.underline = true;
            if (on(f, 'strike')) style.strike = true;
            const color = colorOf(kid(f, 'color'));
            if (color) style.color = color;
        }
        const p = kid(kid(d, 'fill'), 'patternFill');
        const fill = p ? colorOf(kid(p, 'bgColor')) || colorOf(kid(p, 'fgColor')) : '';
        if (fill) style.fill = fill;
        return style;
    });
    return out;
}

function readShared(files) {
    const file = files.get('xl/sharedStrings.xml');
    if (!file) return [];
    const root = kid(parseXml(new TextDecoder().decode(file)), 'sst');
    // a string is its <t>, or the <t> of each of its runs (rich text, taken as plain text)
    return kids(root, 'si').map((si) => (kid(si, 't') ? kid(si, 't').text : kids(si, 'r').map((r) => (kid(r, 't') ? kid(r, 't').text : '')).join('')));
}

// ---- one sheet -----------------------------------------------------------------------------------------------------------------------------------

const charsToPx = (chars) => Math.round(Number(chars) * 7 + 5);
const pointsToPx = (pt) => Math.round(Number(pt) * 4 / 3);

function readSheet(root, shared, styles, info, warnings) {
    const sheet = kid(root, 'worksheet');
    const data = kid(sheet, 'sheetData');
    const cells = [];
    const shares = new Map();
    const unknown = new Set();
    let maxR = -1, maxC = -1;
    for (const row of kids(data, 'row')) {
        for (const c of kids(row, 'c')) {
            const a = addressOf(c.attrs.r);
            if (!a) continue;
            const style = styles.xfs[Number(c.attrs.s) || 0] || {};
            const t = c.attrs.t || 'n';
            const v = kid(c, 'v'), f = kid(c, 'f');
            let value;
            if (t === 's') value = shared[Number(v && v.text)] !== undefined ? shared[Number(v.text)] : '';
            else if (t === 'str') value = v ? v.text : '';
            else if (t === 'inlineStr') { const is = kid(c, 'is'); value = kids(is, 'r').length ? kids(is, 'r').map((r) => (kid(r, 't') ? kid(r, 't').text : '')).join('') : kid(is, 't') ? kid(is, 't').text : ''; }
            else if (t === 'b') value = !!v && v.text.trim() === '1';
            else if (t === 'e') value = { error: v ? v.text.trim() : '#N/A' };
            else value = v && v.text.trim() !== '' ? Number(v.text) : null;
            // a formula is kept when the sheet has every function in it; else the value Excel worked out stays (and a warning names the function)
            let formula = null;
            if (f) {
                let text = f.text;
                if (f.attrs.t === 'shared') {
                    if (text) shares.set(f.attrs.si, { text, r: a.r, c: a.c });
                    else if (shares.has(f.attrs.si)) { const m = shares.get(f.attrs.si); text = shiftFormula('=' + m.text, a.r - m.r, a.c - m.c).slice(1); }
                }
                if (text) {
                    const problem = formulaProblem('=' + text, info.knownNames);
                    if (!problem) formula = '=' + text;
                    else unknown.add(problem);
                }
            }
            const has = formula || (value !== null && value !== undefined && value !== '');
            if (!has && !Object.keys(style).length) continue;
            cells.push({ r: a.r, c: a.c, value: value && value.error ? '=' + value.error : value, formula, style });
            if (a.r > maxR) maxR = a.r;
            if (a.c > maxC) maxC = a.c;
        }
    }
    // sizes, hidden rows and columns
    const fmt = kid(sheet, 'sheetFormatPr');
    const defaultCol = fmt && fmt.attrs.defaultColWidth ? charsToPx(fmt.attrs.defaultColWidth) : null;
    const defaultRow = fmt && fmt.attrs.defaultRowHeight ? pointsToPx(fmt.attrs.defaultRowHeight) : null;
    const widths = {}, hiddenCols = [];
    for (const col of kids(kid(sheet, 'cols'), 'col')) {
        const lo = Number(col.attrs.min) - 1, hi = Math.min(Number(col.attrs.max) - 1, lo + 500);
        for (let c = lo; c <= hi; c++) {
            if (col.attrs.hidden === '1' || col.attrs.hidden === 'true') hiddenCols.push(c);
            if (col.attrs.width && col.attrs.customWidth !== '0') widths[c] = charsToPx(col.attrs.width);
        }
    }
    const heights = {}, hiddenRows = [];
    for (const row of kids(data, 'row')) {
        const r = Number(row.attrs.r) - 1;
        if (row.attrs.hidden === '1' || row.attrs.hidden === 'true') hiddenRows.push(r);
        if (row.attrs.ht && row.attrs.customHeight === '1') heights[r] = pointsToPx(row.attrs.ht);
    }
    const autoFilter = readExcelFilter(kid(sheet, 'autoFilter'), kid, kids, addressOf);
    const merges = kids(kid(sheet, 'mergeCells'), 'mergeCell').map((m) => {
        const [a, b] = String(m.attrs.ref || '').split(':').map(addressOf);
        return a && b ? { r1: Math.min(a.r, b.r), c1: Math.min(a.c, b.c), r2: Math.max(a.r, b.r), c2: Math.max(a.c, b.c) } : null;
    }).filter(Boolean);
    const pane = kid(kid(kid(sheet, 'sheetViews'), 'sheetView'), 'pane');
    const freeze = pane && pane.attrs.state === 'frozen' ? { rows: Number(pane.attrs.ySplit) || 0, cols: Number(pane.attrs.xSplit) || 0 } : null;
    if (unknown.size) warnings.push('"' + info.name + '": formulas with ' + [...unknown].slice(0, 6).join(', ') + (unknown.size > 6 ? ' …' : '') + ' are not in the sheet: the values Excel worked out were kept');
    if (kid(sheet, 'drawing') || kid(sheet, 'legacyDrawing')) warnings.push('"' + info.name + '": pictures, charts and comments were not imported');
    // the rules of conditional formatting, in Excel's order (its priority); what the sheet has no rule for is said
    const conditionals = [], skipped = new Set();
    const cfRules = [];
    for (const block of kids(sheet, 'conditionalFormatting')) {
        const rects = String(block.attrs.sqref || '').split(/\s+/).filter(Boolean).map((ref) => {
            const [a, b] = ref.split(':').map(addressOf);
            const z = b || a;
            return a && z ? { r1: Math.min(a.r, z.r), c1: Math.min(a.c, z.c), r2: Math.max(a.r, z.r), c2: Math.max(a.c, z.c) } : null;
        }).filter(Boolean);
        if (!rects.length) continue;
        for (const rule of kids(block, 'cfRule')) cfRules.push({ rule, rects });
    }
    cfRules.sort((x, y) => (Number(x.rule.attrs.priority) || 0) - (Number(y.rule.attrs.priority) || 0));
    for (const { rule, rects } of cfRules) {
        const dxf = rule.attrs.dxfId !== undefined ? styles.dxfs[Number(rule.attrs.dxfId)] : null;
        const made = fromExcelRule(rule, dxf, colName(rects[0].c1) + (rects[0].r1 + 1), kid, kids);
        if (made.skip) skipped.add(made.skip);
        else conditionals.push({ rects, spec: made.spec });
    }
    if (skipped.size) warnings.push('"' + info.name + '": conditional formatting with ' + [...skipped].join(', ') + ' was not imported');
    if (kid(sheet, 'dataValidations')) warnings.push('"' + info.name + '": data validation was not imported');
    return { name: info.name, hidden: info.hidden, cells, maxR, maxC, widths, heights, hiddenCols, hiddenRows, merges, freeze, defaultCol, defaultRow, conditionals, autoFilter };
}

/**
 * An .xlsx file (its bytes) read: { sheets, active, warnings }. Throws a short message for a file it cannot read.
 * @param {Uint8Array} bytes
 */
export async function readXlsx(bytes) {
    const files = await unzip(bytes);
    const book = files.get('xl/workbook.xml');
    if (!book) throw new Error('This is not an Excel workbook (no xl/workbook.xml)');
    const wb = kid(parseXml(new TextDecoder().decode(book)), 'workbook');
    const rels = {};
    const relFile = files.get('xl/_rels/workbook.xml.rels');
    if (relFile) kids(kid(parseXml(new TextDecoder().decode(relFile)), 'Relationships'), 'Relationship').forEach((r) => { rels[r.attrs.Id] = r.attrs.Target; });
    const styles = readStyles(files), shared = readShared(files);
    const date1904 = !!kid(wb, 'workbookPr') && ['1', 'true'].includes(kid(wb, 'workbookPr').attrs.date1904);
    const warnings = [], sheets = [];
    // the named ranges of the workbook, read before the sheets so a formula that uses one is kept (a name of one sheet only, or one that is a
    // formula and not a range, is left out and said)
    const names = [], knownNames = new Set(), leftOut = [];
    for (const d of kids(kid(wb, 'definedNames'), 'definedName')) {
        const name = d.attrs.name || '';
        if (!name || /^_xlnm\./i.test(name)) continue;
        const m = /^(?:'((?:[^']|'')+)'|([^!'"]+))!\$?([A-Za-z]{1,3})\$?(\d+)(?::\$?([A-Za-z]{1,3})\$?(\d+))?$/.exec((d.text || '').trim());
        if (d.attrs.localSheetId !== undefined || !m) { leftOut.push(name); continue; }
        const r1 = Number(m[4]) - 1, c1 = colIndex(m[3]), r2 = m[6] ? Number(m[6]) - 1 : r1, c2 = m[5] ? colIndex(m[5]) : c1;
        names.push({ name, sheet: m[1] ? m[1].replace(/''/g, "'") : m[2], r1: Math.min(r1, r2), c1: Math.min(c1, c2), r2: Math.max(r1, r2), c2: Math.max(c1, c2) });
        knownNames.add(name.toLowerCase());
    }
    const infos = kids(kid(wb, 'sheets'), 'sheet');
    if (!infos.length) throw new Error('The workbook has no sheets');
    if (infos.length > MAX_SHEETS) warnings.push('only the first ' + MAX_SHEETS + ' sheets were read');
    for (const s of infos.slice(0, MAX_SHEETS)) {
        const target = rels[s.attrs.id];
        const path = target ? (target[0] === '/' ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '')) : '';
        const part = files.get(path);
        if (!part) { warnings.push('the sheet "' + s.attrs.name + '" is not in the file (a chart sheet?)'); continue; }
        const read = readSheet(parseXml(new TextDecoder().decode(part)), shared, styles, { name: s.attrs.name, hidden: !!s.attrs.state && s.attrs.state !== 'visible', knownNames }, warnings);
        // a workbook of the 1904 system counts its dates from 1904: moved to the sheet's count
        if (date1904) for (const cell of read.cells) if (typeof cell.value === 'number' && cell.style.format && /date|time/.test(cell.style.format.type)) cell.value += 1462;
        sheets.push(read);
    }
    if (!sheets.length) throw new Error('The workbook has no sheet that can be read');
    if (leftOut.length) warnings.push('the named ranges ' + leftOut.slice(0, 6).join(', ') + (leftOut.length > 6 ? ' …' : '') + ' were not imported (a name of one sheet, or of a formula): a formula that used one kept its value');
    // each name by the index of its sheet among the sheets read
    const lower = sheets.map((x) => String(x.name).toLowerCase());
    const named = names.map((n) => ({ ...n, sheetIndex: lower.indexOf(String(n.sheet).toLowerCase()) })).filter((n) => n.sheetIndex >= 0);
    const view = kid(kid(wb, 'bookViews'), 'workbookView');
    const active = Math.max(0, Math.min(sheets.length - 1, Number(view && view.attrs.activeTab) || 0));
    return { sheets, active, warnings, names: named, knownNames };
}
