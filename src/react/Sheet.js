import { useState, useSyncExternalStore } from 'react';
import { createWorkbook, VERSION } from '../core/index.js';
import { selectCell } from '../core/selection.js';
import { Grid } from './Grid.js';
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

/**
 * The spreadsheet.
 *
 * @param {object} props
 * @param {ReturnType<typeof createWorkbook>} [props.workbook]  The workbook to show and change (made with createWorkbook from "@kufayeka/sheet/core").
 *   The host keeps it: it gives it the rules (beforeOp), listens to its changes and saves its patches. Without one the sheet makes an empty workbook.
 * @param {string} [props.sheet]  The id of the sheet to show; without it the sheet shows the first one and the tabs change it.
 * @param {string} [props.className]  An extra class on the outer element, for the host's layout.
 * @param {import('react').CSSProperties} [props.style]  Inline style of the outer element (its height above all: the grid fills it).
 */
export function Sheet(props) {
    // a workbook of its own when the host gives none (made once, on the first render)
    const [own] = useState(() => (props.workbook ? null : createWorkbook()));
    const wb = props.workbook || own;
    const revision = useWorkbookRevision(wb);
    const ids = wb.sheetIds();
    const sheetId = props.sheet && ids.includes(props.sheet) ? props.sheet : ids[0];
    const [sel, setSel] = useState(() => selectCell(0, 0));
    const [editing, setEditing] = useState(null);
    useAutoHeights(wb, sheetId);

    // Nothing here may touch window or document while rendering: Next.js renders this on the server first, where neither exists.
    return (
        <div className={'ks-sheet' + (props.className ? ' ' + props.className : '')} style={props.style} data-sheet-version={VERSION} role="grid" aria-label="Spreadsheet">
            <Grid workbook={wb} sheetId={sheetId} revision={revision} sel={sel} setSel={setSel} editing={editing} setEditing={setEditing} />
        </div>
    );
}
