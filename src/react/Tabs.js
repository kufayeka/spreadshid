import { useRef, useState } from 'react';
import { Menu } from './Menu.js';

/**
 * The tabs of the sheets, at the bottom, as in Google Sheets: click to show a sheet, + to add one, the list of all sheets (hidden ones too, to show them
 * again), a double click to rename, a drag to move, and a right click for the rest (duplicate, rename, hide, delete, move).
 *
 * @param {object} props
 * @param {any} props.workbook
 * @param {string} props.active  The sheet shown.
 * @param {(sheetId: string) => void} props.onShow
 * @param {import('react').RefObject<HTMLElement>} props.container  The sheet's root (menus are drawn in it).
 * @param {(message: string) => void} props.onError  Says why something was refused (a name taken, the last sheet).
 */
export function Tabs({ workbook: wb, active, onShow, container, onError }) {
    const ids = wb.sheetIds();
    // the tabs of the sheets that show: not hidden, and seen by this person (the access policy's ui.sheets)
    const shown = ids.filter((id) => !wb.sheetProps(id).hidden && wb.sheetShown(id));
    const [renaming, setRenaming] = useState(null);
    const [menuAt, setMenuAt] = useState(null);     // { x, y, sheet }
    const [listAt, setListAt] = useState(null);     // { x, y }
    const [drag, setDrag] = useState(null);         // { sheet, to } while a tab is dragged
    const strip = useRef(null);

    const attempt = (fn) => { try { return fn(); } catch (e) { onError(e.message); return null; } };

    function rename(id, name) {
        setRenaming(null);
        const before = wb.sheetProps(id).name;
        if (!name.trim() || name.trim() === before) return;
        attempt(() => wb.setSheetProps(id, { name: name.trim() }, { source: 'user' }));
    }

    function onMenu(value) {
        const id = menuAt.sheet;
        setMenuAt(null);
        const at = shown.indexOf(id);
        if (value === 'delete') {
            const next = shown[at + 1] || shown[at - 1];
            if (attempt(() => wb.removeSheet(id, { source: 'user' })) && next) onShow(next);
        } else if (value === 'duplicate') {
            const copy = attempt(() => wb.duplicateSheet(id, { source: 'user' }));
            if (copy) onShow(copy);
        } else if (value === 'rename') {
            setRenaming(id);
        } else if (value === 'hide') {
            const next = shown[at + 1] || shown[at - 1];
            if (attempt(() => wb.hideSheet(id, true, { source: 'user' })) && next) onShow(next);
        } else if (value === 'left' || value === 'right') {
            // moved past the next sheet that shows (hidden ones in between are passed over)
            const neighbour = shown[at + (value === 'left' ? -1 : 1)];
            const others = ids.filter((x) => x !== id);
            const to = others.indexOf(neighbour) + (value === 'right' ? 1 : 0);
            attempt(() => wb.moveSheet(id, to, { source: 'user' }));
        }
    }

    // a tab is dragged sideways: it goes before the tab whose middle the mouse passed
    function onTabMouseDown(e, id) {
        if (e.button !== 0 || renaming) return;
        const startX = e.clientX;
        let moved = false, to = null;
        const tabs = () => Array.from(strip.current.querySelectorAll('.ks-tab'));
        const move = (ev) => {
            if (!moved && Math.abs(ev.clientX - startX) < 5) return;
            moved = true;
            const list = tabs();
            to = list.length;
            for (let i = 0; i < list.length; i++) { const b = list[i].getBoundingClientRect(); if (ev.clientX < b.left + b.width / 2) { to = i; break; } }
            setDrag({ sheet: id, to });
        };
        const up = () => {
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', up);
            setDrag(null);
            if (!moved) { onShow(id); return; }
            // the drop place counts tabs that show; the workbook counts every sheet, hidden ones too
            const others = ids.filter((x) => x !== id);
            const before = shown.filter((x) => x !== id)[to - (to > shown.indexOf(id) ? 1 : 0)];
            const index = before === undefined ? others.length : others.indexOf(before);
            attempt(() => wb.moveSheet(id, index, { source: 'user' }));
        };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
    }

    const at = menuAt ? shown.indexOf(menuAt.sheet) : -1;
    const tabItems = [
        { value: 'delete', label: 'Delete', disabled: shown.length < 2 },
        { value: 'duplicate', label: 'Duplicate' },
        { value: 'rename', label: 'Rename' },
        { value: 'hide', label: 'Hide sheet', disabled: shown.length < 2 },
        { separator: true },
        { value: 'right', label: 'Move right', disabled: at === shown.length - 1 },
        { value: 'left', label: 'Move left', disabled: at <= 0 }
    ];

    return (
        <div className="ks-tabs" role="tablist" aria-label="Sheets">
            <button type="button" className="ks-tab-button" title="Add sheet" aria-label="Add sheet"
                onClick={() => { const id = attempt(() => wb.addSheet(undefined, { source: 'user' })); if (id) onShow(id); }}>+</button>
            <button type="button" className="ks-tab-button" title="All sheets" aria-label="All sheets"
                onClick={(e) => { const b = e.currentTarget.getBoundingClientRect(); setListAt({ x: b.left, y: b.top - 4 }); }}>&#9776;</button>
            <div className="ks-tab-strip" ref={strip}>
                {shown.map((id, i) => {
                    const p = wb.sheetProps(id);
                    return (
                        <div key={id} role="tab" aria-selected={id === active} data-sheet={id}
                            className={'ks-tab' + (id === active ? ' ks-active-tab' : '') + (drag && drag.to === i ? ' ks-drop-before' : '') + (drag && drag.to === shown.length && i === shown.length - 1 ? ' ks-drop-after' : '')}
                            style={p.tabColor ? { boxShadow: 'inset 0 -3px 0 ' + p.tabColor } : undefined}
                            onMouseDown={(e) => onTabMouseDown(e, id)}
                            onDoubleClick={() => setRenaming(id)}
                            onContextMenu={(e) => { e.preventDefault(); onShow(id); setMenuAt({ x: e.clientX, y: e.clientY, sheet: id }); }}>
                            {renaming === id
                                ? <input className="ks-tab-input" autoFocus defaultValue={p.name} aria-label="Sheet name"
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onFocus={(e) => e.currentTarget.select()}
                                    onKeyDown={(e) => { if (e.key === 'Enter') rename(id, e.currentTarget.value); if (e.key === 'Escape') setRenaming(null); }}
                                    onBlur={(e) => rename(id, e.currentTarget.value)} />
                                : <span className="ks-tab-name">{p.name}</span>}
                        </div>
                    );
                })}
            </div>
            <Menu at={menuAt} items={tabItems} onSelect={onMenu} onClose={() => setMenuAt(null)} container={container} label="Sheet" />
            <Menu at={listAt} container={container} label="All sheets" onClose={() => setListAt(null)}
                items={ids.filter((id) => wb.sheetShown(id)).map((id) => ({ value: id, label: (wb.sheetProps(id).hidden ? '(hidden) ' : '') + wb.sheetProps(id).name }))}
                onSelect={(id) => { setListAt(null); if (wb.sheetProps(id).hidden) attempt(() => wb.hideSheet(id, false, { source: 'user' })); onShow(id); }} />
        </div>
    );
}
