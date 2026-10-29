// Data validation and comments in an .xlsx file, both ways. Pure (no DOM).
//
// Validation: Excel's <dataValidations> has the same kinds as the sheet, nearly one for one:
//   list (values)          type="list"  formula1 "Jakarta,Bandung"
//   listFrom (a range)     type="list"  formula1 Produk!$A$2:$A$50
//   checkbox               type="list"  formula1 "TRUE,FALSE"   (Excel has no checkbox: read back as a checkbox)
//   number                 type="decimal" with its operator and bounds
//   date                   type="date"  ('today' is the formula TODAY())
//   textLength             type="textLength"
//   text contains          type="custom" ISNUMBER(SEARCH("x",A2))  (email and url have no Excel kind: left out of the file, and said)
// reject: false is errorStyle="information" (Excel keeps the value and only tells); help is the input message, message the error message.
//
// Comments: written as Excel's notes (comments1.xml and the VML drawing that shows them), which Excel, Google Sheets and LibreOffice all read. A
// thread becomes one note, a line per comment ("Dewi: Kapan datang?"). Read back the same way.

import { colName } from '../formula/address.js';
import { newId } from '../ids.js';

const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const refOf = (b) => colName(b.c1) + (b.r1 + 1) + (b.r2 > b.r1 || b.c2 > b.c1 ? ':' + colName(b.c2) + (b.r2 + 1) : '');
const OPS = { between: 'between', notBetween: 'notBetween', eq: 'equal', ne: 'notEqual', gt: 'greaterThan', gte: 'greaterThanOrEqual', lt: 'lessThan', lte: 'lessThanOrEqual' };
const OPS_BACK = Object.fromEntries(Object.entries(OPS).map(([a, b]) => [b, a]));

// ---- validation out ---------------------------------------------------------------------------------------------------------------------------

/**
 * The rules of a sheet as Excel's <dataValidations> ('' when none), and the kinds Excel has nothing for.
 * @param {{ rule: object, rect: { r1: number, c1: number, r2: number, c2: number } }[]} list  The sheet's rules, each with where it stands now.
 */
export function validationsXml(list) {
    const out = [], left = new Set();
    for (const { rule, rect } of list) {
        const top = colName(rect.c1) + (rect.r1 + 1);
        const bound = (v) => (v === 'today' ? 'TODAY()' : String(v));
        let type, op = null, f1 = null, f2 = null;
        if (rule.kind === 'list') { type = 'list'; f1 = '"' + (rule.values || []).map((v) => String(v).replace(/"/g, '""')).join(',') + '"'; }
        else if (rule.kind === 'listFrom') { type = 'list'; f1 = String(rule.source || ''); }
        else if (rule.kind === 'checkbox') { type = 'list'; f1 = '"TRUE,FALSE"'; }
        else if (rule.kind === 'number' || rule.kind === 'date' || rule.kind === 'textLength') {
            type = rule.kind === 'number' ? 'decimal' : rule.kind;
            op = OPS[rule.op] || 'between';
            f1 = bound(rule.a);
            if (rule.op === 'between' || rule.op === 'notBetween') f2 = bound(rule.b);
        } else if (rule.kind === 'text' && (rule.op === 'contains' || rule.op === 'notContains')) {
            type = 'custom';
            const found = 'ISNUMBER(SEARCH("' + String(rule.a).replace(/"/g, '""') + '",' + top + '))';
            f1 = rule.op === 'contains' ? found : 'NOT(' + found + ')';
        } else { left.add(rule.kind + (rule.op ? ' ' + rule.op : '')); continue; }
        const attrs = ' type="' + type + '"' + (op ? ' operator="' + op + '"' : '') + ' allowBlank="1"'
            + (rule.kind === 'list' || rule.kind === 'listFrom' ? '' : ' showDropDown="0"')
            + ' showErrorMessage="1" errorStyle="' + (rule.reject === false ? 'information' : 'stop') + '"'
            + (rule.help ? ' showInputMessage="1" prompt="' + xmlEsc(rule.help) + '"' : '')
            // Excel says one message for the whole range: {cell} becomes the range
            + (rule.message ? ' error="' + xmlEsc(String(rule.message).split('{cell}').join(refOf(rect))) + '"' : '')
            + ' sqref="' + refOf(rect) + '"';
        out.push('<dataValidation' + attrs + '><formula1>' + xmlEsc(f1) + '</formula1>' + (f2 !== null ? '<formula2>' + xmlEsc(f2) + '</formula2>' : '') + '</dataValidation>');
    }
    return { xml: out.length ? '<dataValidations count="' + out.length + '">' + out.join('') + '</dataValidations>' : '', left: [...left] };
}

// ---- validation in ----------------------------------------------------------------------------------------------------------------------------

/**
 * Excel's <dataValidations> of a sheet as the sheet's rules: [{ rects, spec }], and the kinds left out (said by the caller).
 * @param {any} node  The <dataValidations> element, or nothing.
 */
export function readValidations(node, kid, kids, addressOf) {
    const rules = [], left = new Set();
    for (const v of kids(node, 'dataValidation')) {
        const rects = String(v.attrs.sqref || '').split(/\s+/).filter(Boolean).map((ref) => {
            const [a, b] = ref.split(':').map(addressOf);
            const z = b || a;
            return a && z ? { r1: Math.min(a.r, z.r), c1: Math.min(a.c, z.c), r2: Math.max(a.r, z.r), c2: Math.max(a.c, z.c) } : null;
        }).filter(Boolean);
        if (!rects.length) continue;
        const f1 = ((kid(v, 'formula1') || {}).text || '').trim(), f2 = ((kid(v, 'formula2') || {}).text || '').trim();
        const num = (f) => (/^TODAY\(\)$/i.test(f) ? 'today' : Number(f));
        const type = v.attrs.type || 'none';
        let spec;
        if (type === 'list') {
            if (/^"/.test(f1)) {
                const values = f1.slice(1, -1).split(',').map((x) => x.replace(/""/g, '"'));
                spec = values.length === 2 && values[0].toUpperCase() === 'TRUE' && values[1].toUpperCase() === 'FALSE' ? { kind: 'checkbox' } : { kind: 'list', values };
            } else spec = { kind: 'listFrom', source: f1.replace(/\$/g, '') };
        } else if (type === 'decimal' || type === 'whole' || type === 'date' || type === 'textLength') {
            const op = OPS_BACK[v.attrs.operator || 'between'] || 'between';
            spec = { kind: type === 'date' ? 'date' : type === 'textLength' ? 'textLength' : 'number', op, a: num(f1) };
            if (op === 'between' || op === 'notBetween') spec.b = num(f2);
            if ((type !== 'date' && !Number.isFinite(spec.a)) || (spec.b !== undefined && type !== 'date' && !Number.isFinite(spec.b))) { left.add(type + ' with a formula'); continue; }
        } else if (type === 'custom') {
            const m = /^(NOT\()?ISNUMBER\(SEARCH\("((?:[^"]|"")*)",\s*[A-Z]+\d+\)\)\)?$/i.exec(f1);
            if (!m) { left.add('custom formulas'); continue; }
            spec = { kind: 'text', op: m[1] ? 'notContains' : 'contains', a: m[2].replace(/""/g, '"') };
        } else { left.add(type); continue; }
        spec.reject = v.attrs.errorStyle !== 'information' && v.attrs.errorStyle !== 'warning';
        if (v.attrs.prompt) spec.help = v.attrs.prompt;
        if (v.attrs.error) spec.message = v.attrs.error;
        for (const rect of rects) rules.push({ rect, spec });
    }
    return { rules, left: [...left] };
}

// ---- comments out -----------------------------------------------------------------------------------------------------------------------------

/** The text of a thread as one note: a line per comment. */
export function noteText(thread) {
    return thread.items.map((i) => (i.by && i.by.name ? i.by.name + ': ' : '') + i.text).join('\n');
}

/**
 * The parts of a sheet's notes: comments<n>.xml and the VML drawing that shows them. `notes` is [{ r, c, author, text }].
 * @param {number} n  The number of the sheet in the file (1, 2 ...): Excel wants the drawings' ids apart per sheet.
 */
export function notesParts(notes, n) {
    const authors = [...new Set(notes.map((x) => x.author || ''))];
    const comments = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><comments xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><authors>'
        + authors.map((a) => '<author>' + xmlEsc(a) + '</author>').join('') + '</authors><commentList>'
        + notes.map((x) => '<comment ref="' + colName(x.c) + (x.r + 1) + '" authorId="' + authors.indexOf(x.author || '') + '"><text><r><t xml:space="preserve">' + xmlEsc(x.text) + '</t></r></text></comment>').join('')
        + '</commentList></comments>';
    const shapes = notes.map((x, i) => '<v:shape id="_x0000_s' + (n * 1024 + i + 1) + '" type="#_x0000_t202" style="position:absolute;margin-left:59.25pt;margin-top:1.5pt;width:160pt;height:70pt;z-index:' + (i + 1) + ';visibility:hidden" fillcolor="#ffffe1" o:insetmode="auto">'
        + '<v:fill color2="#ffffe1"/><v:shadow on="t" color="black" obscured="t"/><v:path o:connecttype="none"/><v:textbox style="mso-direction-alt:auto"><div style="text-align:left"></div></v:textbox>'
        + '<x:ClientData ObjectType="Note"><x:MoveWithCells/><x:SizeWithCells/><x:Anchor>' + (x.c + 1) + ', 15, ' + x.r + ', 2, ' + (x.c + 3) + ', 15, ' + (x.r + 4) + ', 16</x:Anchor><x:AutoFill>False</x:AutoFill>'
        + '<x:Row>' + x.r + '</x:Row><x:Column>' + x.c + '</x:Column></x:ClientData></v:shape>').join('');
    const vml = '<xml xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">'
        + '<o:shapelayout v:ext="edit"><o:idmap v:ext="edit" data="' + n + '"/></o:shapelayout>'
        + '<v:shapetype id="_x0000_t202" coordsize="21600,21600" o:spt="202" path="m,l,21600r21600,l21600,xe"><v:stroke joinstyle="miter"/><v:path gradientshapeok="t" o:connecttype="rect"/></v:shapetype>'
        + shapes + '</xml>';
    return { comments, vml };
}

// ---- comments in ------------------------------------------------------------------------------------------------------------------------------

/**
 * A comments<n>.xml as threads to put on a sheet: [{ r, c, items: [{ name, text }] }]. Each line "Name: text" is a comment by Name (the
 * shape this file writes, and the one Excel's own notes have: "Author:" on the first line); a line without a name continues the comment before it.
 */
export function readNotes(root, kid, kids, addressOf) {
    const authors = kids(kid(root, 'authors'), 'author').map((a) => a.text || '');
    const out = [];
    for (const cm of kids(kid(root, 'commentList'), 'comment')) {
        const at = addressOf(cm.attrs.ref || '');
        if (!at) continue;
        const text = textOf(kid(cm, 'text'), kids);
        let lines = text.replace(/\r/g, '').split('\n');
        const items = [];
        const fallback = authors[Number(cm.attrs.authorId)] || '';
        for (const line of lines) {
            const m = /^([^:\n]{1,60}):\s?(.*)$/.exec(line);
            if (m && (items.length === 0 || authors.includes(m[1]) || m[1] === fallback || /^[\p{L} .'-]+$/u.test(m[1]))) items.push({ name: m[1], text: m[2] });
            else if (items.length) items[items.length - 1].text += '\n' + line;
            else items.push({ name: fallback, text: line });
        }
        if (items.length) out.push({ r: at.r, c: at.c, items });
    }
    return out;
}

// the text of a note: plain <t>, or runs <r><t> (Excel writes the author in a bold run)
function textOf(node, kids) {
    if (!node) return '';
    const direct = kids(node, 't').map((t) => t.text || '').join('');
    const runs = kids(node, 'r').map((r) => kids(r, 't').map((t) => t.text || '').join('')).join('');
    return direct + runs;
}

/** Threads read from a file in the shape a sheet keeps them (by the ids of their cells). */
export function threadsFor(wb, s, notes) {
    const at = new Date().toISOString();
    return notes.map((n) => ({
        id: newId(), row: wb.rowId(s, n.r), col: wb.colId(s, n.c),
        items: n.items.map((i) => ({ id: newId(), by: { id: null, name: i.name }, text: i.text, at }))
    })).filter((t) => t.row && t.col);
}
