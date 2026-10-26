import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createWorkbook, VERSION } from '../core/index.js';
import { selectCell } from '../core/selection.js';
import { findAll, replaceIn } from '../core/search.js';
import { Grid } from './Grid.js';
import { Tabs } from './Tabs.js';
import { FindBar, ReplaceDialog } from './FindBar.js';
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
 * @param {string} [props.className]  An extra class on the outer element, for the host's layout.
 * @param {import('react').CSSProperties} [props.style]  Inline style of the outer element (its height above all: the grid fills it).
 */
export function Sheet(props) {
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
    useAutoHeights(wb, sheetId);

    // a short message when something is refused (a name taken, the last sheet ...)
    const [notice, setNotice] = useState(null);
    useEffect(() => { if (!notice) return undefined; const t = setTimeout(() => setNotice(null), 4000); return () => clearTimeout(t); }, [notice]);

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

    const onFind = (kind) => setFind((f) => (kind === 'find' ? { ...f, open: true, index: -1 } : { ...f, dialog: true, index: -1, status: '' }));
    const marks = matches.filter((m) => m.sheet === sheetId);
    const current = matches[find.index];

    // Nothing here may touch window or document while rendering: Next.js renders this on the server first, where neither exists.
    return (
        <div ref={root} className={'ks-sheet' + (props.className ? ' ' + props.className : '')} style={props.style} data-sheet-version={VERSION} role="grid" aria-label="Spreadsheet">
            <div className="ks-body">
                <Grid key={sheetId} scrollMemory={scrollMemory} workbook={wb} sheetId={sheetId} revision={revision} sel={sel} setSel={setSel} editing={editing} setEditing={setEditing}
                    marks={marks} revealTick={revealTick} container={root} onFind={onFind} onError={setNotice} />
                {find.open ? (
                    <FindBar query={find.query} count={marks.length} index={current ? marks.indexOf(current) : -1}
                        onQuery={(query) => setFind((f) => ({ ...f, query, index: -1 }))}
                        onNext={() => goToMatch(1)} onPrev={() => goToMatch(-1)}
                        onClose={() => setFind((f) => ({ ...f, open: false, index: -1 }))}
                        onMore={() => setFind((f) => ({ ...f, open: false, dialog: true }))} />
                ) : null}
                {notice ? <div className="ks-notice" role="status">{notice}</div> : null}
            </div>
            <Tabs workbook={wb} active={sheetId} onShow={show} container={root} onError={setNotice} />
            {find.dialog ? (
                <ReplaceDialog find={find} count={matches.length} status={find.status} container={root}
                    onChange={(patch) => setFind((f) => ({ ...f, ...patch, index: -1, status: '' }))}
                    onFindNext={() => goToMatch(1)} onReplace={replaceOne} onReplaceAll={replaceAll}
                    onClose={() => setFind((f) => ({ ...f, dialog: false, index: -1 }))} />
            ) : null}
        </div>
    );
}
