// Excel and CSV, in and out. Pure (no DOM): bytes and text in, bytes and text out; the grid's File menu puts them in a download or reads them from a file.
//
//   exportXlsx(wb)              the workbook as an .xlsx file: values, formulas (as they read now), number formats, fonts, colours, fills, alignment,
//                               borders, widths, heights, hidden rows and columns, merged cells, frozen panes, hidden sheets. A cell the host's rules
//                               hide from this person is left out: what cannot be seen cannot be downloaded.
//   importXlsx(bytes)           a new workbook from an .xlsx file, and what was left out (warnings)
//   importXlsxInto(wb, bytes)   the sheets of a file added to a workbook (one change: one undo takes them all away)
//   exportCsv(wb, s)            one sheet as CSV: the text every cell shows
//   parseCsv(text)              CSV (or a semicolon or tab separated text, as found) as rows of texts

import { createWorkbook } from '../workbook.js';
import { newId } from '../ids.js';
import { keysBetween, keyBetween } from '../order.js';
import { isStoredFormula } from '../refs.js';
import { isError } from '../formula/xlvalue.js';
import { currencySymbol, localeInfo } from '../format.js';
import { buildXlsxFiles, cssToArgb } from './write.js';
import { zipStore } from './zip.js';
import { readXlsx } from './read.js';

// ---- out ------------------------------------------------------------------------------------------------------------------------------------------

// a date and time pattern of the sheet in Excel's letters (Excel says m for the month and for the minute, and tells them apart by what is near)
const excelDate = (p) => p.replace(/MMMM/g, 'mmmm').replace(/MMM/g, 'mmm').replace(/MM/g, 'mm').replace(/(^|[^Mm])M(?!M)/g, '$1m').replace(/HH/g, 'hh').replace(/(^|[^Hh])H(?!H)/g, '$1h').replace(/\ba\b/g, 'AM/PM');

/** The number format code of Excel for a format of the sheet (or "" for General). */
export function codeOfFormat(f, settings) {
    if (!f) return '';
    const info = localeInfo(settings && settings.locale);
    const dec = (n) => (n > 0 ? '.' + '0'.repeat(n) : '');
    const d = f.decimals === undefined ? 2 : f.decimals;
    let code;
    switch (f.type) {
        case 'text': return '@';
        case 'number': code = (f.thousands === false ? '0' : '#,##0') + dec(d); break;
        case 'money': {
            const symbol = f.symbol !== undefined ? f.symbol : currencySymbol(f.currency || (settings && settings.currency) || 'USD', info.locale);
            code = '"' + symbol + (/[A-Za-z]$/.test(symbol) ? ' ' : '') + '"#,##0' + dec(d);
            break;
        }
        case 'percent': code = '0' + dec(d) + '%'; break;
        case 'scientific': code = '0' + dec(d) + 'E+00'; break;
        case 'date': code = excelDate(f.pattern || info.datePattern); break;
        case 'time': code = excelDate(f.pattern || 'HH:mm:ss'); break;
        case 'datetime': code = excelDate(f.pattern || info.datePattern + ' HH:mm:ss'); break;
        case 'duration': code = '[h]:mm:ss'; break;
        case 'custom': code = f.pattern || ''; break;
        default: code = '';
    }
    if (code && (f.prefix || f.suffix)) code = (f.prefix ? '"' + f.prefix.replace(/"/g, '') + '"' : '') + code + (f.suffix ? '"' + f.suffix.replace(/"/g, '') + '"' : '');
    return code;
}

// one cell of a sheet as the writer takes it
function cellModel(wb, s, r, c, settings) {
    const raw = wb.raw(s, r, c);
    const style = wb.style(s, r, c) || {};
    const fmt = wb.cellFormat(s, r, c);
    const m = wb.modeAt(s, r, c);
    // what this person may not see is not written: a hidden cell goes out empty (its style stays, so the file looks the same)
    const hidden = m && m.mode === 'hidden';
    const value = hidden ? null : wb.value(s, r, c);
    const out = { r, c };
    if (!hidden && isStoredFormula(raw)) out.formula = wb.input(s, r, c);
    if (value === null || value === undefined || value === '') out.kind = null;
    else if (isError(value)) { out.kind = 'e'; out.v = value.code; }
    else if (typeof value === 'number') { out.kind = 'n'; out.v = value; }
    else if (typeof value === 'boolean') { out.kind = 'b'; out.v = value; }
    else { out.kind = 's'; out.v = String(value); }
    if (!out.kind && !Object.keys(style).length && !fmt) return null;
    const code = codeOfFormat(fmt, settings);
    if (code) out.fmt = code;
    if (style.bold || style.italic || style.underline || style.strike || style.fontSize || style.color || style.font) {
        out.font = { b: !!style.bold, i: !!style.italic, u: !!style.underline, s: !!style.strike, sz: style.fontSize || 10, color: cssToArgb(style.color) || undefined, name: style.font || 'Arial' };
    }
    if (style.fill) out.fill = cssToArgb(style.fill) || undefined;
    if (style.align || style.valign || style.wrap === 'wrap') out.align = { h: style.align || '', v: style.valign === 'middle' ? 'center' : style.valign || '', wrap: style.wrap === 'wrap' };
    if (style.borders) {
        const b = style.borders;
        out.border = { t: b.top || null, r: b.right || null, b: b.bottom || null, l: b.left || null };
    }
    return out;
}

/**
 * The workbook as the bytes of an .xlsx file.
 * @param {ReturnType<typeof createWorkbook>} wb
 * @returns {Uint8Array}
 */
export function exportXlsx(wb) {
    const settings = wb.settings();
    const ids = wb.sheetIds();
    const sheets = ids.map((s) => {
        const props = wb.sheetProps(s);
        const size = wb.size(s);
        const cells = [];
        const rows = {}, cols = {}, hiddenRows = [], hiddenCols = [];
        wb.forEachFilledRow(s, (r, rowCells, rowStyles) => {
            const seen = new Set([...Object.keys(rowCells), ...Object.keys(rowStyles)]);
            for (const cid of seen) {
                const c = wb.colIndex(s, cid);
                if (c < 0) continue;
                const cell = cellModel(wb, s, r, c, settings);
                if (cell) cells.push(cell);
            }
        });
        for (let r = 0; r < size.rows; r++) { const p = wb.rowProps(s, r); if (p && p.height) rows[r] = p.height; if (p && p.hidden) hiddenRows.push(r); }
        for (let c = 0; c < size.cols; c++) { const p = wb.colProps(s, c); if (p && p.width) cols[c] = p.width; if (p && p.hidden) hiddenCols.push(c); }
        return {
            name: props.name, hidden: !!props.hidden, cells, rows, cols, hiddenRows, hiddenCols,
            defaultCol: props.colWidth || 100, defaultRow: props.rowHeight || 21,
            merges: wb.merges(s), freeze: { rows: props.freezeRows || 0, cols: props.freezeCols || 0 }
        };
    });
    return zipStore(buildXlsxFiles({ sheets, active: 0 }));
}

// ---- in -------------------------------------------------------------------------------------------------------------------------------------------

// the documents of sheets read from a file, their formulas still as texts (put in once the sheets are in a workbook, where they can be kept by ids)
function sheetDocs(read) {
    const docs = [], formulas = [];
    const sheetKeys = keysBetween(null, null, read.sheets.length);
    read.sheets.forEach((sh, i) => {
        const rowCount = Math.max(1000, sh.maxR + 1, ...sh.hiddenRows.map((r) => r + 1));
        const colCount = Math.max(26, sh.maxC + 1, ...sh.hiddenCols.map((c) => c + 1));
        const colIds = Array.from({ length: colCount }, () => newId());
        const rowIds = Array.from({ length: rowCount }, () => newId());
        const colKeys = keysBetween(null, null, colCount), rowKeys = keysBetween(null, null, rowCount);
        const hiddenCols = new Set(sh.hiddenCols), hiddenRows = new Set(sh.hiddenRows);
        const columns = colIds.map((id, c) => {
            const props = {};
            if (sh.widths[c] !== undefined && sh.widths[c] !== sh.defaultCol) props.width = sh.widths[c];
            if (hiddenCols.has(c)) props.hidden = true;
            return { id, key: colKeys[c], props };
        });
        const rows = rowIds.map((id, r) => {
            const props = {};
            if (sh.heights[r] !== undefined) props.height = sh.heights[r];
            if (hiddenRows.has(r)) props.hidden = true;
            return { id, key: rowKeys[r], cells: {}, style: {}, props };
        });
        const sheetFormulas = [];
        for (const cell of sh.cells) {
            const row = rows[cell.r], cid = colIds[cell.c];
            if (Object.keys(cell.style).length) row.style[cid] = cell.style;
            // a formula, or an error Excel left in the cell (written as a formula that is that error), goes in once the sheet stands
            if (cell.formula || (typeof cell.value === 'string' && /^=#/.test(cell.value))) sheetFormulas.push({ r: cell.r, c: cell.c, value: cell.formula || cell.value });
            else if (cell.value !== null && cell.value !== undefined && cell.value !== '') row.cells[cid] = cell.value;
        }
        const props = { name: sh.name };
        if (sh.hidden) props.hidden = true;
        if (sh.defaultCol) props.colWidth = sh.defaultCol;
        if (sh.defaultRow) props.rowHeight = sh.defaultRow;
        if (sh.freeze && sh.freeze.rows) props.freezeRows = sh.freeze.rows;
        if (sh.freeze && sh.freeze.cols) props.freezeCols = sh.freeze.cols;
        if (sh.merges.length) props.merges = sh.merges.map((m) => ({ r1: rowIds[m.r1], c1: colIds[m.c1], r2: rowIds[m.r2], c2: colIds[m.c2] }));
        docs.push({ id: newId(), key: sheetKeys[i], props, columns, rows });
        formulas.push(sheetFormulas);
    });
    return { docs, formulas };
}

/**
 * A new workbook from the bytes of an .xlsx file: { workbook, warnings }. The workbook has nothing to save yet but all of it (a new workbook).
 * @param {Uint8Array} bytes
 * @param {object} [options]  As createWorkbook takes them (user, beforeOp ...); `settings` for the new workbook.
 */
export async function importXlsx(bytes, options) {
    const read = await readXlsx(bytes);
    const { docs, formulas } = sheetDocs(read);
    const wb = createWorkbook({ sheets: docs, settings: (options && options.settings) || {} }, { ...options, fresh: true });
    docs.forEach((d, i) => { if (formulas[i].length) wb.setBlock(d.id, formulas[i], { source: 'remote' }); });
    return { workbook: wb, warnings: read.warnings, active: docs[read.active] ? docs[read.active].id : docs[0].id };
}

/**
 * The sheets of an .xlsx file added after the sheets of a workbook (a name that is taken gets a number): one change. Returns { sheetIds, warnings }.
 * @param {ReturnType<typeof createWorkbook>} wb
 * @param {Uint8Array} bytes
 */
export async function importXlsxInto(wb, bytes, how) {
    const read = await readXlsx(bytes);
    const { docs, formulas } = sheetDocs(read);
    // the formulas are put in the sheets in a workbook of their own (they read one another by name), then the finished sheets move over
    const temp = createWorkbook({ sheets: docs, settings: wb.settings() });
    docs.forEach((d, i) => { if (formulas[i].length) temp.setBlock(d.id, formulas[i], { source: 'remote' }); });
    const sheetIds = addFinishedSheets(wb, temp.toJSON().sheets, how);
    return { sheetIds, warnings: read.warnings };
}

// The finished sheets of another workbook added after the sheets of this one, as one change (one undo), a name that is taken given a number.
function addFinishedSheets(wb, ready, how) {
    const ids = wb.sheetIds();
    let last = ids.length ? wb._sheetKey(ids[ids.length - 1]) : null;
    const taken = new Set(ids.map((s) => String(wb.sheetProps(s).name).toLowerCase()));
    const ops = ready.map((sheet) => {
        let name = sheet.props.name, n = 2;
        while (taken.has(name.toLowerCase())) name = sheet.props.name + ' (' + n++ + ')';
        taken.add(name.toLowerCase());
        last = keyBetween(last, null);
        return { t: 'addSheet', sheet: { ...sheet, key: last, props: { ...sheet.props, name } } };
    });
    wb.apply(ops, how || { source: 'user' });
    return ops.map((op) => op.sheet.id);
}

// ---- CSV ------------------------------------------------------------------------------------------------------------------------------------------

/** One sheet as CSV: the text each cell shows, up to the last row and column that hold anything. */
export function exportCsv(wb, s, options) {
    const sep = (options && options.delimiter) || ',';
    const last = wb.lastFilled(s);
    const lines = [];
    for (let r = 0; r <= last.r; r++) {
        const fields = [];
        for (let c = 0; c <= last.c; c++) {
            // a cell this person may not see goes out empty, as in an .xlsx (its dots are for the screen)
            const m = wb.modeAt(s, r, c);
            const t = m && m.mode === 'hidden' ? '' : wb.display(s, r, c).text;
            fields.push(/["\r\n]/.test(t) || t.includes(sep) ? '"' + t.replace(/"/g, '""') + '"' : t);
        }
        lines.push(fields.join(sep));
    }
    return lines.join('\r\n');
}

/**
 * CSV text as rows of texts, as RFC 4180 writes it (quotes, doubled quotes, new lines inside quotes). The separator is found from the first line when it
 * is not given: a comma, a semicolon (what Excel writes in a locale with a decimal comma, Indonesian among them) or a tab.
 */
export function parseCsv(text, delimiter) {
    const s = String(text).replace(/^﻿/, '');
    const firstLine = s.split(/\r?\n/, 1)[0] || '';
    const count = (ch) => firstLine.split(ch).length - 1;
    const sep = delimiter || [',', ';', '\t'].sort((a, b) => count(b) - count(a))[0];
    const rows = [];
    let row = [], field = '', quoted = false, i = 0, started = false;
    while (i < s.length) {
        const ch = s[i];
        if (quoted) {
            if (ch === '"') { if (s[i + 1] === '"') { field += '"'; i += 2; continue; } quoted = false; i++; continue; }
            field += ch; i++; continue;
        }
        if (ch === '"' && field === '') { quoted = true; started = true; i++; continue; }
        if (ch === sep) { row.push(field); field = ''; started = true; i++; continue; }
        if (ch === '\r' || ch === '\n') {
            row.push(field); rows.push(row); row = []; field = ''; started = false;
            if (ch === '\r' && s[i + 1] === '\n') i++;
            i++; continue;
        }
        field += ch; started = true; i++;
    }
    if (started || field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows;
}

/**
 * The rows of a CSV text added as a new sheet after the sheets of a workbook, named as asked (a name that is taken gets a number): one change.
 * Every field is read as if typed in the workbook's locale, so "1.250,5" in an Indonesian workbook is the number 1250.5 and "=A1*2" a formula.
 * Returns { sheetIds, warnings }.
 * @param {ReturnType<typeof createWorkbook>} wb
 * @param {string} text
 * @param {string} [name]
 */
export function importCsvInto(wb, text, name, how) {
    const rows = parseCsv(text);
    const width = rows.reduce((n, row) => Math.max(n, row.length), 0);
    const temp = createWorkbook({ settings: wb.settings() });
    const s = temp.sheetIds()[0];
    temp.setSheetProps(s, { name: String(name || 'Sheet1').trim() || 'Sheet1' });
    // a sheet as big as the rows, with room after them, as a sheet the person made would have
    if (rows.length > temp.size(s).rows) temp.insertRows(s, temp.size(s).rows, rows.length - temp.size(s).rows);
    if (width > temp.size(s).cols) temp.insertCols(s, temp.size(s).cols, width - temp.size(s).cols);
    if (rows.length) temp.setValues(s, 0, 0, rows.map((row) => row.concat(new Array(width - row.length).fill(''))));
    return { sheetIds: addFinishedSheets(wb, temp.toJSON().sheets, how), warnings: [] };
}
