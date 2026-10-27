import { useState, useRef } from 'react';
import { Menu } from './Menu.js';
import { rectsOf, selectCell } from '../core/selection.js';
import { colName } from '../core/formula/address.js';
import { sortRange } from '../core/search.js';
import { formatValue, FORMAT_PRESETS } from '../core/format.js';
import { toggle, setPart, setFormat, merge, clearFormatting, functionText } from './toolbarActions.js';
import { pasteFromClipboard } from './commands.js';
import { SIZES, ZOOMS } from './Toolbar.js';
import { exportXlsx, importXlsxInto, importCsvInto, exportCsv } from '../core/excel/index.js';

/**
 * The menu bar, as in Google Sheets: File, Edit, View, Insert, Format, Data, each with its submenus. Every item does what the toolbar, the keys or the
 * right-click menu do (one change, one undo), so the three never disagree. File imports an .xlsx or .csv file (its sheets are added, one undo) and
 * downloads the workbook as .xlsx or this sheet as .csv.
 *
 * @param {object} props
 * @param {any} props.workbook @param {string} props.sheetId @param {any} props.sel @param {(sel: any) => void} props.setSel
 * @param {import('react').RefObject<HTMLTextAreaElement>} props.sinkRef  The grid's keyboard sink (the clipboard commands run from it).
 * @param {number} props.zoom @param {(z: number) => void} props.onZoom
 * @param {(kind: 'find'|'replace') => void} props.onFind
 * @param {() => void} props.onLink @param {() => void} props.onSettings @param {() => void} props.onConditional  Opens the panel of conditional formatting.
 * @param {() => void} props.onNames  Opens the panel of named ranges.
 * @param {(text: string) => void} props.onStartEdit @param {(id: string) => void} props.onShow  A sheet was added: show it.
 * @param {() => void} props.onReveal  Show the active cell (after a selection made from the menu).
 * @param {(message: string) => void} props.onError  Also how what an import left out is told.
 * @param {string} [props.fileName]  The name a download gets (without its extension).
 * @param {import('react').RefObject<HTMLElement>} props.container
 */
export function Menubar(props) {
    const { workbook: wb, sheetId: s, sel, setSel, sinkRef, container } = props;
    const [open, setOpen] = useState(null); // { name, x, y }
    const fileInput = useRef(null);
    const rects = rectsOf(sel);
    const b = rects[rects.length - 1];
    const sheet = wb.sheetProps(s);
    const size = wb.size(s);
    const nr = b.r2 - b.r1 + 1, nc = b.c2 - b.c1 + 1;
    const settings = wb.settings();
    const formatItem = (name, label) => ({ value: 'format:' + name, label, hint: name === 'general' || name === 'text' ? undefined : formatValue(name.startsWith('date') || name === 'time' ? 46321.5625 : name === 'duration' ? 1.0007 : name === 'percent' ? 0.1012 : 1000.12, FORMAT_PRESETS[name].type === 'money' ? { ...FORMAT_PRESETS[name], currency: settings.currency } : FORMAT_PRESETS[name], settings).text });

    const MENUS = {
        File: [
            { value: 'file:import', label: 'Import…' },
            { label: 'Download', children: [{ value: 'file:download:xlsx', label: 'Microsoft Excel (.xlsx)' }, { value: 'file:download:csv', label: 'Comma-separated values (.csv, this sheet)' }] },
            { separator: true },
            { value: 'file:settings', label: 'Spreadsheet settings…' }
        ],
        Edit: [
            { value: 'edit:undo', label: 'Undo', hint: 'Ctrl+Z', disabled: !wb.canUndo() },
            { value: 'edit:redo', label: 'Redo', hint: 'Ctrl+Y', disabled: !wb.canRedo() },
            { separator: true },
            { value: 'edit:cut', label: 'Cut', hint: 'Ctrl+X' }, { value: 'edit:copy', label: 'Copy', hint: 'Ctrl+C' }, { value: 'edit:paste', label: 'Paste', hint: 'Ctrl+V' },
            { label: 'Paste special', children: [{ value: 'edit:pasteValues', label: 'Values only', hint: 'Ctrl+Shift+V' }, { value: 'edit:pasteStyles', label: 'Format only' }] },
            { separator: true },
            { value: 'edit:find', label: 'Find and replace', hint: 'Ctrl+H' },
            { label: 'Delete', children: [
                { value: 'edit:clear', label: 'Values' },
                { value: 'edit:deleteRows', label: nr === 1 ? 'Row ' + (b.r1 + 1) : 'Rows ' + (b.r1 + 1) + ' - ' + (b.r2 + 1) },
                { value: 'edit:deleteCols', label: nc === 1 ? 'Column ' + colName(b.c1) : 'Columns ' + colName(b.c1) + ' - ' + colName(b.c2) }
            ] }
        ],
        View: [
            { label: 'Freeze', children: [
                { value: 'view:freezeRows:0', label: 'No rows', checked: !sheet.freezeRows }, { value: 'view:freezeRows:1', label: '1 row', checked: sheet.freezeRows === 1 },
                { value: 'view:freezeRows:2', label: '2 rows', checked: sheet.freezeRows === 2 }, { value: 'view:freezeRows:' + (sel.active.r + 1), label: 'Up to row ' + (sel.active.r + 1), checked: sheet.freezeRows === sel.active.r + 1 && sel.active.r > 1 },
                { separator: true },
                { value: 'view:freezeCols:0', label: 'No columns', checked: !sheet.freezeCols }, { value: 'view:freezeCols:1', label: '1 column', checked: sheet.freezeCols === 1 },
                { value: 'view:freezeCols:2', label: '2 columns', checked: sheet.freezeCols === 2 }, { value: 'view:freezeCols:' + (sel.active.c + 1), label: 'Up to column ' + colName(sel.active.c), checked: sheet.freezeCols === sel.active.c + 1 && sel.active.c > 1 }
            ] },
            { label: 'Show', children: [{ value: 'view:gridlines', label: 'Gridlines', checked: !sheet.hideGridlines }] },
            { label: 'Zoom', children: ZOOMS.map((z) => ({ value: 'view:zoom:' + z, label: Math.round(z * 100) + '%', checked: props.zoom === z })) }
        ],
        Insert: [
            { label: 'Rows', children: [{ value: 'insert:rowsAbove', label: 'Insert ' + nr + (nr === 1 ? ' row' : ' rows') + ' above' }, { value: 'insert:rowsBelow', label: 'Insert ' + nr + (nr === 1 ? ' row' : ' rows') + ' below' }] },
            { label: 'Columns', children: [{ value: 'insert:colsLeft', label: 'Insert ' + nc + (nc === 1 ? ' column' : ' columns') + ' left' }, { value: 'insert:colsRight', label: 'Insert ' + nc + (nc === 1 ? ' column' : ' columns') + ' right' }] },
            { value: 'insert:sheet', label: 'Sheet' },
            { value: 'insert:checkbox', label: 'Checkbox' },
            { value: 'insert:dropdown', label: 'Dropdown' },
            { separator: true },
            { label: 'Function', children: ['SUM', 'AVERAGE', 'COUNT', 'MAX', 'MIN'].map((f) => ({ value: 'insert:fn:' + f, label: f })) },
            { value: 'insert:link', label: 'Link', hint: 'Ctrl+K' }
        ],
        Format: [
            { label: 'Number', children: [
                formatItem('general', 'Automatic'), formatItem('text', 'Plain text'), { separator: true },
                formatItem('number', 'Number'), formatItem('percent', 'Percent'), formatItem('scientific', 'Scientific'), { separator: true },
                formatItem('money', 'Currency'), formatItem('moneyRounded', 'Currency rounded'), { separator: true },
                formatItem('date', 'Date'), formatItem('time', 'Time'), formatItem('datetime', 'Date time'), formatItem('duration', 'Duration')
            ] },
            { label: 'Text', children: [
                { value: 'style:bold', label: 'Bold', hint: 'Ctrl+B' }, { value: 'style:italic', label: 'Italic', hint: 'Ctrl+I' },
                { value: 'style:underline', label: 'Underline', hint: 'Ctrl+U' }, { value: 'style:strike', label: 'Strikethrough', hint: 'Alt+Shift+5' }
            ] },
            { label: 'Alignment', children: [
                { value: 'align:left', label: 'Left' }, { value: 'align:center', label: 'Center' }, { value: 'align:right', label: 'Right' }, { separator: true },
                { value: 'valign:top', label: 'Top' }, { value: 'valign:middle', label: 'Middle' }, { value: 'valign:bottom', label: 'Bottom' }
            ] },
            { label: 'Wrapping', children: [{ value: 'wrap:overflow', label: 'Overflow' }, { value: 'wrap:wrap', label: 'Wrap' }, { value: 'wrap:clip', label: 'Clip' }] },
            { label: 'Rotation', children: [
                { value: 'rotate:0', label: 'None' }, { value: 'rotate:45', label: 'Tilt up' }, { value: 'rotate:-45', label: 'Tilt down' },
                { value: 'rotate:vertical', label: 'Stack vertically' }, { value: 'rotate:90', label: 'Rotate up' }, { value: 'rotate:-90', label: 'Rotate down' }
            ] },
            { label: 'Font size', children: SIZES.map((n) => ({ value: 'size:' + n, label: String(n) })) },
            { label: 'Merge cells', children: [{ value: 'merge:all', label: 'Merge all' }, { value: 'merge:horizontal', label: 'Merge horizontally' }, { value: 'merge:vertical', label: 'Merge vertically' }, { value: 'merge:unmerge', label: 'Unmerge' }] },
            { separator: true },
            { value: 'format:conditional', label: 'Conditional formatting' },
            { value: 'format:clear', label: 'Clear formatting', hint: 'Ctrl+\\' }
        ],
        Data: [
            { label: 'Sort sheet', children: [{ value: 'data:sortSheet:asc', label: 'Sort sheet by column ' + colName(sel.active.c) + ' (A to Z)' }, { value: 'data:sortSheet:desc', label: 'Sort sheet by column ' + colName(sel.active.c) + ' (Z to A)' }] },
            { value: 'data:filter', label: sheet.filter ? 'Remove filter' : 'Create a filter' },
            { value: 'data:validation', label: 'Data validation' },
            { value: 'data:names', label: 'Named ranges' },
            { separator: true },
            { label: 'Sort range', disabled: nr < 2, children: [{ value: 'data:sortRange:asc', label: 'Sort range by column ' + colName(sel.active.c) + ' (A to Z)' }, { value: 'data:sortRange:desc', label: 'Sort range by column ' + colName(sel.active.c) + ' (Z to A)' }] }
        ]
    };

    const how = { source: 'user' };
    const run = (fn) => { try { fn(); } catch (err) { props.onError(err.message); } };
    const toGrid = () => { if (sinkRef.current) sinkRef.current.focus({ preventScroll: true }); };

    // the workbook as an .xlsx file, or this sheet as a .csv file, saved by the browser
    function download(kind) {
        const name = (props.fileName || 'Spreadsheet') + (kind === 'csv' ? ' - ' + sheet.name + '.csv' : '.xlsx');
        // a byte order mark before a CSV text, so Excel reads its letters as UTF-8
        const blob = kind === 'csv' ? new Blob(['\uFEFF' + exportCsv(wb, s)], { type: 'text/csv;charset=utf-8' })
            : new Blob([exportXlsx(wb)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }

    // a file chosen to import: an .xlsx adds its sheets, a .csv (or a .tsv or .txt) one sheet named after the file; the first new sheet is shown
    async function importFile(file) {
        try {
            const csv = !/\.xlsx$/i.test(file.name);
            const result = csv ? importCsvInto(wb, await file.text(), file.name.replace(/\.[^.]*$/, ''), how) : await importXlsxInto(wb, new Uint8Array(await file.arrayBuffer()), how);
            if (result.sheetIds.length) props.onShow(result.sheetIds[0]);
            const n = result.sheetIds.length;
            props.onError('Imported ' + n + (n === 1 ? ' sheet' : ' sheets') + (result.warnings.length ? '. ' + result.warnings.join('. ') : ''));
        } catch (err) { props.onError('The file could not be imported: ' + err.message); }
    }

    async function onSelect(value) {
        setOpen(null);
        const [area, what, extra] = value.split(':');
        toGrid();
        switch (area) {
            case 'file':
                if (what === 'import') { if (fileInput.current) fileInput.current.click(); }
                else if (what === 'download') download(extra);
                else props.onSettings();
                break;
            case 'edit':
                if (what === 'undo') wb.undo();
                else if (what === 'redo') wb.redo();
                // the clipboard commands run from the grid's keyboard sink, where the copy and cut events are handled
                else if (what === 'cut' || what === 'copy') document.execCommand(what);
                else if (what === 'paste' || what === 'pasteValues' || what === 'pasteStyles') {
                    try {
                        const { landed } = await pasteFromClipboard(wb, s, b, what === 'paste' ? 'all' : what === 'pasteValues' ? 'values' : 'styles');
                        setSel({ ranges: [{ anchor: { r: landed.r1, c: landed.c1 }, focus: { r: landed.r2, c: landed.c2 } }], active: { r: landed.r1, c: landed.c1 } });
                    } catch (err) { props.onError(err.message); }
                } else if (what === 'find') props.onFind('replace');
                else if (what === 'clear') wb.clear(s, rects, how);
                else if (what === 'deleteRows') { run(() => wb.deleteRows(s, b.r1, nr, how)); setSel(selectCell(Math.min(b.r1, Math.max(0, size.rows - nr - 1)), sel.active.c)); }
                else if (what === 'deleteCols') { run(() => wb.deleteCols(s, b.c1, nc, how)); setSel(selectCell(sel.active.r, Math.min(b.c1, Math.max(0, size.cols - nc - 1)))); }
                break;
            case 'view':
                if (what === 'freezeRows') run(() => wb.setSheetProps(s, { freezeRows: Number(extra) || null }, how));
                else if (what === 'freezeCols') run(() => wb.setSheetProps(s, { freezeCols: Number(extra) || null }, how));
                else if (what === 'gridlines') run(() => wb.setSheetProps(s, { hideGridlines: sheet.hideGridlines ? null : true }, how));
                else if (what === 'zoom') props.onZoom(Number(extra));
                break;
            case 'insert':
                if (what === 'rowsAbove') run(() => wb.insertRows(s, b.r1, nr, how));
                else if (what === 'rowsBelow') run(() => wb.insertRows(s, b.r2 + 1, nr, how));
                else if (what === 'colsLeft') run(() => wb.insertCols(s, b.c1, nc, how));
                else if (what === 'colsRight') run(() => wb.insertCols(s, b.c2 + 1, nc, how));
                else if (what === 'sheet') run(() => { const id = wb.addSheet(undefined, how); if (id) props.onShow(id); });
                else if (what === 'fn') props.onStartEdit(functionText(wb, s, sel, extra));
                else if (what === 'link') props.onLink();
                // a checkbox in every cell of the selection (an empty one shows unticked): one change
                else if (what === 'checkbox') run(() => wb.setValidation(s, b, { kind: 'checkbox' }, how));
                else if (what === 'dropdown') props.onValidation('list');
                break;
            case 'format': if (what === 'clear') clearFormatting(wb, s, sel); else if (what === 'conditional') props.onConditional(); else setFormat(wb, s, sel, what); break;
            case 'style': toggle(wb, s, sel, what); break;
            case 'align': setPart(wb, s, sel, 'align', what); break;
            case 'valign': setPart(wb, s, sel, 'valign', what); break;
            case 'wrap': setPart(wb, s, sel, 'wrap', what === 'overflow' ? null : what); break;
            case 'rotate': setPart(wb, s, sel, 'rotate', what === '0' ? null : what === 'vertical' ? 'vertical' : Number(what)); break;
            case 'size': setPart(wb, s, sel, 'fontSize', Number(what) === 10 ? null : Number(what)); break;
            case 'merge': run(() => merge(wb, s, sel, what)); break;
            case 'data': {
                if (what === 'validation') { props.onValidation(null); break; }
                if (what === 'names') { props.onNames(); break; }
                // a filter on the selection, or on the block of filled cells around the active cell when one cell is selected (as in Google Sheets)
                if (what === 'filter') {
                    if (sheet.filter) run(() => wb.removeFilter(s, how));
                    else run(() => wb.createFilter(s, rects.length === 1 && nr === 1 && nc === 1 ? wb.dataRegion(s, b.r1, b.c1) : b, how));
                    break;
                }
                const dir = extra;
                if (what === 'sortRange') run(() => sortRange(wb, s, b, sel.active.c, dir));
                else {
                    const last = wb.lastFilled(s);
                    const top = sheet.freezeRows || 0;
                    if (last.r > top) run(() => sortRange(wb, s, { r1: top, c1: 0, r2: last.r, c2: Math.max(last.c, sel.active.c) }, sel.active.c, dir));
                }
                break;
            }
            default: break;
        }
        props.onReveal();
    }

    return (
        <div className="ks-menubar" role="menubar" aria-label="Menu">
            {Object.keys(MENUS).map((name) => (
                <button key={name} type="button" className={'ks-menubar-item' + (open && open.name === name ? ' ks-open' : '')} role="menuitem" aria-haspopup="menu"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setOpen(open && open.name === name ? null : { name, x: r.left, y: r.bottom }); }}
                    onMouseEnter={(e) => { if (open && open.name !== name) { const r = e.currentTarget.getBoundingClientRect(); setOpen({ name, x: r.left, y: r.bottom }); } }}>
                    {name}
                </button>
            ))}
            <input ref={fileInput} type="file" accept=".xlsx,.csv,.tsv,.txt" hidden aria-label="Import a file"
                onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) importFile(f); }} />
            {open ? <Menu key={open.name} at={{ x: open.x, y: open.y }} items={MENUS[open.name]} onSelect={onSelect} onClose={() => setOpen(null)} container={container} label={open.name} /> : null}
        </div>
    );
}
