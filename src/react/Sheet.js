import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createWorkbook, VERSION } from '../core/index.js';
import { selectCell, stepActive, rectsOf } from '../core/selection.js';
import { parseAddressText } from './FormulaBar.js';
import { findAll, replaceIn } from '../core/search.js';
import { Grid } from './Grid.js';
import { Tabs } from './Tabs.js';
import { FindBar, ReplaceDialog } from './FindBar.js';
import { FormulaBar, rectText } from './FormulaBar.js';
import { Toolbar } from './Toolbar.js';
import { LinkDialog } from './LinkDialog.js';
import { Menubar } from './Menubar.js';
import { SettingsDialog } from './SettingsDialog.js';
import { ValidationDialog } from './ValidationDialog.js';
import { ConditionalPanel } from './ConditionalPanel.js';
import { NamesPanel } from './NamesPanel.js';
import { parseRangeText } from '../core/validation.js';
import { copyBlock, pasteClip } from '../core/transfer.js';
import { useAutoHeights } from './autoHeights.js';

/**
 * Follows a workbook: the component draws again whenever a change is applied to it (by a person, by code, by undo).
 * @param {ReturnType<typeof createWorkbook>} wb
 */
export function useWorkbookRevision(wb) {
    return useSyncExternalStore(
        (notify) => { const offs = ['op', 'saved', 'layout'].map((type) => wb.on(type, notify)); return () => offs.forEach((off) => off()); },
        () => wb.revision,
        () => wb.revision
    );
}

const FIND_START = { open: false, dialog: false, query: '', replacement: '', matchCase: false, wholeCell: false, regex: false, inFormulas: false, allSheets: false, index: -1, status: '' };

/**
 * The spreadsheet.
 *
 * @param {object} props
 * @param {ReturnType<typeof createWorkbook>} [props.workbook]  The workbook to show and change (made with createWorkbook from "@kufayeka/sheet/core").
 *   The host keeps it: it gives it the rules (beforeOp), listens to its changes and saves its patches. Without one the sheet makes an empty workbook.
 * @param {string} [props.sheet]  The id of the sheet to show (the host controls it then, with onSheetChange); without it the tabs change it.
 * @param {(sheetId: string) => void} [props.onSheetChange]  A tab was clicked (or a sheet was added, duplicated, found ...).
 * @param {(event: { ops: object[], source: string }) => void} [props.onOp]  Every change applied (by a person, by code, by undo), as ops: what the host
 *   saves, sends to others, or keeps as history.
 * @param {(event: { reason: string, op: object, source: string }) => void} [props.onReject]  A change was refused (by the rules, the types, or beforeOp).
 * @param {(event: { address: string, field?: string, value: any, expected: string }) => void} [props.onCellError]  A value was not of its column's type.
 * @param {(sel: { ranges: object[], active: { r: number, c: number } }) => void} [props.onSelectionChange]
 * @param {string} [props.fileName]  The name a download from File > Download gets, without its extension ("Spreadsheet" when not given).
 * @param {boolean} [props.showProtected]  Draw the protected cells striped (the rules are the workbook's: setRules).
 * @param {string} [props.className]  An extra class on the outer element, for the host's layout.
 * @param {import('react').CSSProperties} [props.style]  Inline style of the outer element (its height above all: the grid fills it).
 * @param {import('react').Ref<SheetHandle>} [ref]  What the host's code can ask of the sheet (see SheetHandle).
 */
export const Sheet = forwardRef(function Sheet(props, ref) {
    // a workbook of its own when the host gives none (made once, on the first render)
    const [own] = useState(() => (props.workbook ? null : createWorkbook()));
    const wb = props.workbook || own;
    const revision = useWorkbookRevision(wb);
    const root = useRef(null);
    // where each sheet was scrolled to, so it comes back there when its tab is clicked again
    const scrollMemory = useRef(new Map()).current;

    // the sheet shown: the host's when it says, else the one the tabs chose (a sheet that went away gives its place to the first one that shows)
    const [chosen, setChosen] = useState(null);
    const ids = wb.sheetIds();
    const showing = ids.filter((id) => !wb.sheetProps(id).hidden);
    const wanted = props.sheet !== undefined ? props.sheet : chosen;
    const sheetId = wanted && ids.includes(wanted) && !wb.sheetProps(wanted).hidden ? wanted : showing[0] || ids[0];
    const show = (id) => { setChosen(id); if (props.onSheetChange) props.onSheetChange(id); };

    // each sheet keeps its own selection, as in Google Sheets
    const [selections, setSelections] = useState(() => new Map());
    const sel = selections.get(sheetId) || selectCell(0, 0);
    const setSel = (next) => setSelections((m) => new Map(m).set(sheetId, typeof next === 'function' ? next(m.get(sheetId) || selectCell(0, 0)) : next));
    const [editing, setEditing] = useState(null);
    useEffect(() => { setEditing(null); }, [sheetId]);
    // the grid's keyboard sink, so the formula bar can give the keyboard back to the grid when its edit ends
    const sinkRef = useRef(null);
    const toGrid = () => { if (sinkRef.current) sinkRef.current.focus({ preventScroll: true }); };

    // the zoom of the grid, and the paint format (the styles copied from the selection, waiting for the cells to paint them on)
    const [zoom, setZoom] = useState(1);
    const [paint, setPaint] = useState(null);
    const onPaint = () => setPaint((p) => (p ? null : copyBlock(wb, sheetId, rectsOf(sel)[rectsOf(sel).length - 1])));
    const onSelectEnd = (picked) => {
        if (!paint) return;
        const rects = rectsOf(picked);
        pasteClip(wb, sheetId, rects[rects.length - 1], paint, 'styles');
        setPaint(null);
    };
    useEffect(() => { setPaint(null); }, [sheetId]);

    // the link of the active cell (Ctrl+K, the toolbar)
    const [linking, setLinking] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    // the data validation dialog: open for the selection, with the rule of the active cell (or a new one of a kind)
    const [validating, setValidating] = useState(null);
    // the panel on the right of the grid (conditional formatting, named ranges), and the selection it opened on (where a new rule or name goes)
    const [panel, setPanel] = useState(null); // { kind: 'conditional' | 'names', range }

    // the formula bar's edit ends as the cell's does: the text is written, and Enter, Tab move on
    function commitFromBar(move) {
        if (editing) wb.setValues(sheetId, editing.r, editing.c, editing.text, { source: 'user' });
        setEditing(null);
        if (move) { setSel(stepActive(sel, move.dr, move.dc, wb.size(sheetId))); setRevealTick((t) => t + 1); }
        toGrid();
    }
    useAutoHeights(wb, sheetId);

    // a short message when something is refused (a name taken, the last sheet, a protected cell, a value of the wrong type ...)
    const [notice, setNotice] = useState(null);
    const latest = useRef(props);
    latest.current = props;
    useEffect(() => {
        const offs = [
            wb.on('op', (e) => { if (latest.current.onOp) latest.current.onOp(e); }),
            wb.on('reject', (e) => { setNotice(e.reason); if (latest.current.onReject) latest.current.onReject(e); }),
            wb.on('cellError', (e) => { if (latest.current.onCellError) latest.current.onCellError(e); })
        ];
        return () => offs.forEach((off) => off());
    }, [wb]);
    useEffect(() => { if (props.onSelectionChange) props.onSelectionChange(sel); }, [sel]);
    // a notice goes after a while, a longer one (what an import left out) later
    useEffect(() => { if (!notice) return undefined; const t = setTimeout(() => setNotice(null), Math.min(12000, 4000 + notice.length * 40)); return () => clearTimeout(t); }, [notice]);

    // ---- find and replace --------------------------------------------------------------------------------------------------------------------------

    const [find, setFind] = useState(FIND_START);
    const [revealTick, setRevealTick] = useState(0);
    const options = { matchCase: find.matchCase, wholeCell: find.wholeCell, regex: find.regex, inFormulas: find.inFormulas };
    const matches = useMemo(() => {
        if (!(find.open || find.dialog) || !find.query) return [];
        const where = find.allSheets && find.dialog ? showing : [sheetId];
        return where.flatMap((id) => findAll(wb, id, find.query, options).map((m) => ({ ...m, sheet: id })));
    }, [wb, revision, sheetId, find.open, find.dialog, find.query, find.matchCase, find.wholeCell, find.regex, find.inFormulas, find.allSheets]);

    // the next match after the active cell (or after the match last shown), going round at the end
    function goToMatch(step) {
        if (!matches.length) return;
        let i;
        if (find.index >= 0 && find.index < matches.length) i = (find.index + step + matches.length) % matches.length;
        else {
            const order = ids.indexOf(sheetId);
            const cmp = (m) => { const o = ids.indexOf(m.sheet) - order; return o !== 0 ? o : m.r !== sel.active.r ? m.r - sel.active.r : m.c - sel.active.c; };
            if (step > 0) { i = matches.findIndex((m) => cmp(m) > 0); if (i < 0) i = 0; }
            else { i = -1; for (let k = matches.length - 1; k >= 0; k--) if (cmp(matches[k]) < 0) { i = k; break; } if (i < 0) i = matches.length - 1; }
        }
        const m = matches[i];
        if (m.sheet !== sheetId) show(m.sheet);
        setSelections((map) => new Map(map).set(m.sheet, selectCell(m.r, m.c)));
        setFind((f) => ({ ...f, index: i, status: '' }));
        setRevealTick((t) => t + 1);
    }

    function replaceOne() {
        const m = matches[find.index];
        // the match being looked at is replaced, then the next one is shown
        if (!m || m.sheet !== sheetId || m.r !== sel.active.r || m.c !== sel.active.c) { goToMatch(1); return; }
        const n = replaceIn(wb, m.sheet, [m], find.query, find.replacement, options);
        setFind((f) => ({ ...f, index: -1, status: n ? 'Replaced 1 cell' : '' }));
    }

    function replaceAll() {
        let changed = 0;
        const bySheet = new Map();
        for (const m of matches) { if (!bySheet.has(m.sheet)) bySheet.set(m.sheet, []); bySheet.get(m.sheet).push(m); }
        for (const [id, list] of bySheet) changed += replaceIn(wb, id, list, find.query, find.replacement, options);
        setFind((f) => ({ ...f, index: -1, status: 'Replaced ' + changed + (changed === 1 ? ' cell' : ' cells') }));
    }

    /**
     * @typedef {object} SheetHandle
     * @property {ReturnType<typeof createWorkbook>} workbook  The workbook shown.
     * @property {(target: string|{ r1: number, c1: number, r2?: number, c2?: number }) => void} select  Select "B7", "A1:C3" or a rectangle, and show it.
     * @property {(address: string) => void} scrollTo  Show a cell without selecting it.
     * @property {(text?: string) => void} startEdit  Start editing the active cell (with a text, or what it holds).
     * @property {() => void} focus  Give the keyboard to the grid.
     * @property {(sheetId: string) => void} showSheet
     * @property {() => object} getSelection
     */
    useImperativeHandle(ref, () => ({
        workbook: wb,
        select(target) {
            const b = typeof target === 'string' ? parseAddressText(target) : { r1: target.r1, c1: target.c1, r2: target.r2 === undefined ? target.r1 : target.r2, c2: target.c2 === undefined ? target.c1 : target.c2 };
            if (!b) throw new Error('select: "' + target + '" is not an address');
            setSel({ ranges: [{ anchor: { r: b.r1, c: b.c1 }, focus: { r: b.r2, c: b.c2 } }], active: { r: b.r1, c: b.c1 } });
            setRevealTick((t) => t + 1);
        },
        scrollTo(address) {
            const b = parseAddressText(address);
            if (!b) throw new Error('scrollTo: "' + address + '" is not an address');
            setSel(selectCell(b.r1, b.c1));
            setRevealTick((t) => t + 1);
        },
        startEdit(text) { setEditing({ r: sel.active.r, c: sel.active.c, text: text === undefined ? wb.input(sheetId, sel.active.r, sel.active.c) : text, mode: 'edit' }); },
        focus() { toGrid(); },
        showSheet(id) { show(id); },
        getSelection() { return sel; }
    }), [wb, sel, sheetId]);

    const onFind = (kind) => setFind((f) => (kind === 'find' ? { ...f, open: true, index: -1 } : { ...f, dialog: true, index: -1, status: '' }));
    const marks = matches.filter((m) => m.sheet === sheetId);
    const current = matches[find.index];

    // a range selected on its sheet (another sheet is shown first), and shown
    function goToRange(id, r) {
        setSelections((m) => new Map(m).set(id, { ranges: [{ anchor: { r: r.r1, c: r.c1 }, focus: { r: r.r2, c: r.c2 } }], active: { r: r.r1, c: r.c1 } }));
        if (id !== sheetId) show(id);
        setRevealTick((t) => t + 1);
        toGrid();
    }

    // A word typed in the name box: a named range is gone to; a new name names the selection, as in Google Sheets and Excel.
    function goToName(text) {
        const at = wb.nameRange(text);
        if (at) { goToRange(at.sheetId, at.range); return; }
        const why = wb.nameProblem(text);
        if (why) { setNotice(why[0].toUpperCase() + why.slice(1)); toGrid(); return; }
        const b = rectsOf(sel)[rectsOf(sel).length - 1];
        wb.addName(text.trim(), sheetId, b, { source: 'user' });
        setNotice('Named range ' + text.trim() + ' is ' + rectText(b));
        toGrid();
    }

    // the name box shows the name of a named range that is exactly the selection, as in Google Sheets
    function nameOfSelection() {
        const all = rectsOf(sel);
        if (all.length !== 1) return '';
        const b = all[0];
        const n = wb.names().find((x) => x.sheetId === sheetId && x.range && x.range.r1 === b.r1 && x.range.c1 === b.c1 && x.range.r2 === b.r2 && x.range.c2 === b.c2);
        return n ? n.name : '';
    }

    // Nothing here may touch window or document while rendering: Next.js renders this on the server first, where neither exists.
    return (
        <div ref={root} className={'ks-sheet' + (props.className ? ' ' + props.className : '')} style={props.style} data-sheet-version={VERSION} role="grid" aria-label="Spreadsheet">
            <Menubar workbook={wb} sheetId={sheetId} sel={sel} setSel={setSel} sinkRef={sinkRef} zoom={zoom} onZoom={setZoom} onFind={onFind}
                onLink={() => setLinking(true)} onSettings={() => setSettingsOpen(true)} onShow={show} onError={setNotice} fileName={props.fileName}
                onConditional={() => setPanel({ kind: 'conditional', range: rectText(rectsOf(sel)[rectsOf(sel).length - 1]) })}
                onNames={() => setPanel({ kind: 'names', range: rectText(rectsOf(sel)[rectsOf(sel).length - 1]) })}
                onValidation={(kind) => {
                    const b = rectsOf(sel)[rectsOf(sel).length - 1];
                    const own = wb.validationAt(sheetId, sel.active.r, sel.active.c);
                    setValidating({ range: rectText(b), rule: kind ? { kind } : own });
                }}
                onStartEdit={(text) => setEditing({ r: sel.active.r, c: sel.active.c, text, mode: 'edit' })}
                onReveal={() => setRevealTick((t) => t + 1)} container={root} />
            <Toolbar workbook={wb} sheetId={sheetId} sel={sel} revision={revision} zoom={zoom} onZoom={setZoom} painting={!!paint} onPaint={onPaint}
                onStartEdit={(text) => { setEditing({ r: sel.active.r, c: sel.active.c, text, mode: 'edit' }); }}
                onLink={() => setLinking(true)} onDone={toGrid} container={root} />
            <FormulaBar address={nameOfSelection() || rectText(rectsOf(sel)[rectsOf(sel).length - 1])} onGoName={goToName} content={wb.input(sheetId, sel.active.r, sel.active.c)} editing={editing}
                onStartEdit={(text) => {
                    const m = wb.modeAt(sheetId, sel.active.r, sel.active.c);
                    if (m) { setNotice(m.message || 'This cell is protected: it cannot be changed here'); toGrid(); return; }
                    setEditing({ r: sel.active.r, c: sel.active.c, text, mode: 'edit', from: 'bar' });
                }}
                onText={(text) => setEditing((e) => (e ? { ...e, text } : { r: sel.active.r, c: sel.active.c, text, mode: 'edit', from: 'bar' }))}
                onCommit={commitFromBar}
                onCancel={() => { setEditing(null); toGrid(); }}
                onGo={(b) => {
                    const size = wb.size(sheetId);
                    const r2 = Math.min(b.r2, size.rows - 1), c2 = Math.min(b.c2, size.cols - 1);
                    setSel({ ranges: [{ anchor: { r: Math.min(b.r1, r2), c: Math.min(b.c1, c2) }, focus: { r: r2, c: c2 } }], active: { r: Math.min(b.r1, r2), c: Math.min(b.c1, c2) } });
                    setRevealTick((t) => t + 1);
                    toGrid();
                }} />
            <div className={'ks-body' + (panel ? ' ks-with-panel' : '')}>
                <Grid key={sheetId} scrollMemory={scrollMemory} sinkRef={sinkRef} zoom={zoom} showProtected={!!props.showProtected} painting={!!paint} onSelectEnd={onSelectEnd} onLink={() => setLinking(true)} workbook={wb} sheetId={sheetId} revision={revision} sel={sel} setSel={setSel} editing={editing} setEditing={setEditing}
                    marks={marks} revealTick={revealTick} container={root} onFind={onFind} onError={setNotice} />
                {find.open ? (
                    <FindBar query={find.query} count={marks.length} index={current ? marks.indexOf(current) : -1}
                        onQuery={(query) => setFind((f) => ({ ...f, query, index: -1 }))}
                        onNext={() => goToMatch(1)} onPrev={() => goToMatch(-1)}
                        onClose={() => setFind((f) => ({ ...f, open: false, index: -1 }))}
                        onMore={() => setFind((f) => ({ ...f, open: false, dialog: true }))} />
                ) : null}
                {notice ? <div className="ks-notice" role="status">{notice}</div> : null}
                {panel && panel.kind === 'conditional' ? <ConditionalPanel workbook={wb} sheetId={sheetId} range={panel.range} revision={revision} container={root}
                    key={sheetId} onClose={() => { setPanel(null); toGrid(); }} /> : null}
                {panel && panel.kind === 'names' ? <NamesPanel workbook={wb} sheetId={sheetId} range={rectText(rectsOf(sel)[rectsOf(sel).length - 1])} revision={revision}
                    onGo={(id, range) => goToRange(id, range)} onClose={() => { setPanel(null); toGrid(); }} /> : null}
            </div>
            <Tabs workbook={wb} active={sheetId} onShow={show} container={root} onError={setNotice} />
            {validating ? (
                <ValidationDialog container={root} range={validating.range} rule={validating.rule}
                    onClose={() => { setValidating(null); toGrid(); }}
                    onSave={(rangeText, spec) => {
                        const b = parseRangeText(rangeText);
                        if (!b || b.sheet) return 'Write a range of this sheet, for example B2:B200';
                        wb.setValidation(sheetId, b, spec, { source: 'user' });
                        return null;
                    }}
                    onRemove={(rangeText) => { const b = parseRangeText(rangeText); if (b) wb.removeValidation(sheetId, b, { source: 'user' }); }} />
            ) : null}
            {settingsOpen ? <SettingsDialog settings={wb.settings()} container={root} onClose={() => { setSettingsOpen(false); toGrid(); }}
                onApply={(patch) => wb.setSettings(patch, { source: 'user' })} /> : null}
            {linking ? (
                <LinkDialog container={root} text={wb.display(sheetId, sel.active.r, sel.active.c).text} link={(wb.style(sheetId, sel.active.r, sel.active.c) || {}).link || ''}
                    onClose={() => { setLinking(false); toGrid(); }}
                    onApply={(text, link) => {
                        // the text and the link are one change; an empty link takes it away
                        const st = { ...(wb.style(sheetId, sel.active.r, sel.active.c) || {}) };
                        if (link) st.link = link; else delete st.link;
                        const now = wb.display(sheetId, sel.active.r, sel.active.c).text;
                        wb.setBlock(sheetId, [{ r: sel.active.r, c: sel.active.c, style: Object.keys(st).length ? st : null, ...(text !== now ? { value: text || link || null } : {}) }], { source: 'user' });
                    }} />
            ) : null}
            {find.dialog ? (
                <ReplaceDialog find={find} count={matches.length} status={find.status} container={root}
                    onChange={(patch) => setFind((f) => ({ ...f, ...patch, index: -1, status: '' }))}
                    onFindNext={() => goToMatch(1)} onReplace={replaceOne} onReplaceAll={replaceAll}
                    onClose={() => setFind((f) => ({ ...f, dialog: false, index: -1 }))} />
            ) : null}
        </div>
    );
});
