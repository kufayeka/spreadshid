// Reading a workbook from the rest of a React app: a total in the page header, an Undo button that knows when it can undo, a "not saved yet" mark.
//
//   const total = useWorkbook(wb, (w) => w.value('Penjualan', 'N2'));
//   const canUndo = useWorkbook(wb, (w) => w.canUndo());
//
// The component draws again when what `read` gives changes, after any change to the workbook (by a person, by code, by undo, by a save). A plain
// value (a number, a text, a boolean) that stays the same does not draw the component again, so a total in the header is not drawn for every key
// typed elsewhere in the sheet. An object or an array made by `read` is new every time, so the component draws on every change: give back plain values
// where that matters.

import { useCallback, useRef, useSyncExternalStore } from 'react';

const EVENTS = ['op', 'saved', 'layout', 'access'];

/**
 * @template T
 * @param {ReturnType<typeof import('../core/workbook.js').createWorkbook>|null} wb  None yet (still loading): `read` is not called, and undefined comes back.
 * @param {(wb: any) => T} [read]  What the component shows of the workbook; none: the workbook itself (the component draws on every change).
 * @returns {T}
 */
export function useWorkbook(wb, read) {
    const subscribe = useCallback((notify) => {
        if (!wb) return () => {};
        const offs = EVENTS.map((type) => wb.on(type, notify));
        return () => offs.forEach((off) => off());
    }, [wb]);
    // what read gave, kept until the workbook changes or read does (a read written inline is new every render, and may read other props)
    const kept = useRef({ wb: null, revision: -1, read: null, value: undefined });
    const snapshot = () => {
        const k = kept.current;
        if (!wb) return undefined;
        if (!read) return wb.revision;
        if (k.wb === wb && k.revision === wb.revision && k.read === read) return k.value;
        const value = read(wb);
        kept.current = { wb, revision: wb.revision, read, value: k.wb === wb && Object.is(value, k.value) ? k.value : value };
        return kept.current.value;
    };
    const value = useSyncExternalStore(subscribe, snapshot, snapshot);
    return read && wb ? value : read ? undefined : wb;
}
