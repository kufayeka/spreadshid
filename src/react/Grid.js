import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { colName } from '../core/formula/address.js';
import { displayOf } from '../core/display.js';
import { rectsOf, selectCell, extendTo, addCell, selectRows, selectCols, selectAll, focusOf, stepActive } from '../core/selection.js';
import { layoutOf, HEADER_HEIGHT, ROW_HEADER_WIDTH } from './geometry.js';
import { keyAction } from './keys.js';
import { columnNeed } from './measure.js';
import { copyBlock, clipText, clipHtml, clipFromHtml, pasteClip, pasteText, fillBlock } from '../core/transfer.js';
import { fillTarget } from '../core/fill.js';
import { sortRange } from '../core/search.js';
import { Menu } from './Menu.js';

// The last copy made in this page, for the Paste of the right-click menu: a page can read the clipboard's text, not the formulas inside it, so when the
// text is the one this copy put there, the copy itself is pasted (formulas and styles included).
let lastCopy = null;

// the smallest a column or a row can be dragged to
const MIN_SIZE = 4;

// useLayoutEffect warns when React renders on a server (Next.js); there is nothing to measure there anyway
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

// how far a text may run on into the empty cells on its right (as in Google Sheets), counted in cells
const OVERFLOW_CELLS = 12;

/** The CSS of a cell's text from its kept style and what its value is. */
export function cellCss(style, display) {
    const s = style || {};
    const deco = [s.underline ? 'underline' : '', s.strike ? 'line-through' : ''].filter(Boolean).join(' ');
    const align = s.align || display.align;
    const valign = s.valign || 'bottom';
    return {
        fontWeight: s.bold ? 700 : undefined,
        fontStyle: s.italic ? 'italic' : undefined,
        textDecoration: deco || undefined,
        color: s.color || (display.kind === 'error' ? 'var(--ks-error)' : undefined),
        background: s.fill || undefined,
        fontSize: s.fontSize ? s.fontSize + 'pt' : undefined,
        fontFamily: s.font || undefined,
        justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start',
        textAlign: align,
        alignItems: valign === 'top' ? 'flex-start' : valign === 'middle' ? 'center' : 'flex-end',
        whiteSpace: s.wrap === 'wrap' ? 'pre-wrap' : 'pre',
        overflow: s.wrap === 'clip' || s.wrap === 'wrap' ? 'hidden' : undefined
    };
}

// The borders a cell's style asks for, drawn over the grid lines: { top: { width, style, color }, right, bottom, left }.
function bordersCss(borders) {
    const side = (b) => (b ? (b.width || 1) + 'px ' + (b.style || 'solid') + ' ' + (b.color || '#000') : undefined);
    return { borderTop: side(borders.top), borderRight: side(borders.right), borderBottom: side(borders.bottom), borderLeft: side(borders.left) };
}

// A cell is drawn only when it shows something (a value, a fill, a border). It leaves the last pixel on its right and at its bottom to the grid lines,
// which are drawn once per row and once per column under the cells; a cell that must hide the lines inside it (a merged block, a text that runs on over
// empty cells) covers them with the sheet's colour, as Google Sheets does.
function Cell({ r, c, x, y, w, h, merged, cover, display, style }) {
    const css = cellCss(style, display);
    return (
        <div className={'ks-cell' + (merged ? ' ks-merged' : '') + (cover ? ' ks-cover' : '')} data-r={r} data-c={c}
            style={{ left: x, top: y, width: Math.max(0, w - 1), height: Math.max(0, h - 1), background: css.background, alignItems: css.alignItems, justifyContent: css.justifyContent }}>
            <span className="ks-text" style={{ ...css, background: undefined, alignItems: undefined, justifyContent: undefined }}>{display.text}</span>
            {style && style.borders ? <span className="ks-borders" style={bordersCss(style.borders)} /> : null}
        </div>
    );
}

/**
 * One row of a pane. Its cells are placed against the sheet, not against the screen (the layer around them moves with the scroll), so a row that stays
 * on screen while scrolling up or down keeps all its props and is not drawn again: a scroll only draws the rows that come in.
 * `revision` is the workbook's: a change anywhere draws the rows again (their values may have changed through formulas).
 */
const Row = memo(function Row({ wb, sheetId, r, top, height, from, to, xBase, colAxis, blocks, revision }) {
    void revision;
    const cells = [];
    // the columns of this row that a merged block covers (the block itself is drawn by the pane)
    const covered = new Set();
    for (const b of blocks) if (r >= b.r1 && r <= b.r2) for (let c = Math.max(b.c1, from); c <= Math.min(b.c2, to); c++) covered.add(c);
    for (let c = from; c <= to; c++) {
        if (covered.has(c)) continue;
        const w = colAxis.size(c);
        if (!w) continue;
        const display = displayOf(wb.value(sheetId, r, c));
        const style = wb.style(sheetId, r, c);
        // an empty cell with no style is not drawn: the grid lines are all it shows
        if (display.kind === 'empty' && !style) continue;
        // a text that does not wrap runs on into the empty cells on its right, which are then not drawn (their grid lines would cross the text)
        let width = w;
        if (display.kind === 'text' && (!style || (!style.wrap && (!style.align || style.align === 'left')))) {
            let next = c + 1;
            while (next <= to && next - c <= OVERFLOW_CELLS && !covered.has(next) && wb.raw(sheetId, r, next) === undefined) {
                width += colAxis.size(next);
                covered.add(next);
                next++;
            }
        }
        cells.push(<Cell key={c} r={r} c={c} x={colAxis.start(c) - xBase} y={top} w={width} h={height} cover={width > w} display={display} style={style} />);
    }
    return cells;
});

/**
 * One pane: a box that cuts what is outside it, and a layer inside it that moves with the scroll in the directions the pane scrolls.
 */
function Pane({ className, left, top, width, height, shiftX, shiftY, children }) {
    if (width <= 0 || height <= 0) return null;
    return (
        <div className={'ks-pane ' + className} style={{ left, top, width, height }}>
            <div className="ks-layer" style={{ transform: 'translate(' + -shiftX + 'px,' + -shiftY + 'px)' }}>{children}</div>
        </div>
    );
}

/**
 * The grid of one sheet: the scroller, the headers, the four panes, the selection, and the cell editor.
 *
 * @param {object} props
 * @param {any} props.workbook
 * @param {string} props.sheetId
 * @param {number} props.revision
 * @param {import('../core/selection.js').Selection} props.sel
 * @param {(sel: import('../core/selection.js').Selection) => void} props.setSel
 * @param {{ r: number, c: number, text: string, mode: 'type'|'edit' }|null} props.editing  The cell being edited: "type" when typing started it (the
 *   arrows then end the edit and move, as in Google Sheets), "edit" when F2, Enter or a double click did (the arrows move in the text).
 * @param {(editing: any) => void} props.setEditing
 */
export function Grid({ workbook: wb, sheetId, revision, sel, setSel, editing, setEditing, marks, revealTick, container, onFind, onError, scrollMemory }) {
    const scroller = useRef(null);
    const view = useRef(null);
    const sink = useRef(null);
    const mirror = useRef(null);
    const [box, setBox] = useState({ width: 0, height: 0 });
    const [scroll, setScroll] = useState({ top: 0, left: 0 });
    const [editorSize, setEditorSize] = useState(null);
    // the grid scrolls to the cell the keyboard moved to; a selection made with the mouse (a whole column above all) is where the person is looking already
    const reveal = useRef(false);
    // the line that shows where a dragged edge of a column or a row will be
    const [guide, setGuide] = useState(null);
    // the cells last copied or cut, framed with a moving dashed line until Escape (or until a cut is pasted)
    const [clipMark, setClipMark] = useState(null);
    // the cells the fill handle is being dragged over
    const [fillPreview, setFillPreview] = useState(null);
    // Ctrl+Shift+V was pressed: the paste that follows takes the values only
    const valuesOnly = useRef(false);
    // the right-click menu: where it opens, and on what (cells, whole rows, whole columns)
    const [menu, setMenu] = useState(null);
    const moveTo = (next) => { reveal.current = true; setSel(next); };

    // the grid fills its box: measured once on screen and whenever the box changes size
    useIsoLayoutEffect(() => {
        const el = scroller.current;
        if (!el) return undefined;
        const measure = () => setBox({ width: el.clientWidth, height: el.clientHeight });
        measure();
        if (typeof ResizeObserver === 'undefined') return undefined;
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // Each sheet is shown where it was left, as in Google Sheets: the grid is made again for every sheet (the host keys it by the sheet), and puts
    // the scroll back once it has its size, from the positions the host keeps per sheet.
    const placed = useRef(false);
    useIsoLayoutEffect(() => {
        const el = scroller.current;
        if (placed.current || !el || !box.width) return;
        placed.current = true;
        const at = scrollMemory && scrollMemory.get(sheetId);
        if (at) { el.scrollTop = at.top; el.scrollLeft = at.left; setScroll({ top: el.scrollTop, left: el.scrollLeft }); }
    }, [box.width]);

    const props = useMemo(() => wb.sheetProps(sheetId), [wb, sheetId, revision]);
    const rowAxis = wb.rowAxis(sheetId);
    const colAxis = wb.colAxis(sheetId);
    const size = { rows: rowAxis.count, cols: colAxis.count };
    const blocks = useMemo(() => wb.merges(sheetId), [wb, sheetId, revision]);
    const layout = layoutOf({ rows: rowAxis, cols: colAxis, freezeRows: props.freezeRows, freezeCols: props.freezeCols,
        scrollTop: scroll.top, scrollLeft: scroll.left, width: box.width, height: box.height });

    const fw = layout.frozenWidth, fh = layout.frozenHeight;
    const R = layout.rows, C = layout.cols;
    const top = HEADER_HEIGHT, left = ROW_HEADER_WIDTH;

    const blockAt = (r, c) => blocks.find((b) => r >= b.r1 && r <= b.r2 && c >= b.c1 && c <= b.c2);

    /** Where a cell is in the view (a merged block: all of it), in pixels of the view. */
    function cellBox(r, c) {
        const b = blockAt(r, c) || { r1: r, c1: c, r2: r, c2: c };
        const x = left + colAxis.start(b.c1) - (b.c1 >= layout.fc ? scroll.left : 0);
        const y = top + rowAxis.start(b.r1) - (b.r1 >= layout.fr ? scroll.top : 0);
        return { x, y, w: colAxis.start(b.c2 + 1) - colAxis.start(b.c1), h: rowAxis.start(b.r2 + 1) - rowAxis.start(b.r1) };
    }

    /** What is under a point of the view: a cell, a column letter, a row number, or the corner (everything). */
    function hit(x, y) {
        if (x < left && y < top) return { kind: 'all' };
        const col = () => colAxis.indexAt(x - left < fw ? x - left : x - left + scroll.left);
        const row = () => rowAxis.indexAt(y - top < fh ? y - top : y - top + scroll.top);
        if (y < top) return { kind: 'col', c: col() };
        if (x < left) return { kind: 'row', r: row() };
        return { kind: 'cell', r: row(), c: col() };
    }

    // ---- editing --------------------------------------------------------------------------------------------------------------------------------------

    function commit(move) {
        if (editing) wb.setValues(sheetId, editing.r, editing.c, editing.text, { source: 'user' });
        setEditing(null);
        if (sink.current) sink.current.value = '';
        if (move) moveTo(stepActive(sel, move.dr, move.dc, size));
    }

    function startEdit(mode, text) {
        const { r, c } = sel.active;
        setEditing({ r, c, text: text === undefined ? wb.input(sheetId, r, c) : text, mode });
    }

    // the editor grows with its text, to the right and down, as in Google Sheets (measured on a hidden copy of the text with the same font)
    useIsoLayoutEffect(() => {
        if (!editing || !mirror.current) { setEditorSize(null); return; }
        mirror.current.textContent = editing.text + '​';
        setEditorSize({ w: mirror.current.scrollWidth + 12, h: mirror.current.scrollHeight + 4 });
    }, [editing && editing.text, editing && editing.r, editing && editing.c]);

    // the caret goes to the end of what the cell holds when an edit starts
    useEffect(() => {
        const el = sink.current;
        if (!el || !editing) return;
        if (document.activeElement !== el) el.focus();
        if (el.value !== editing.text) el.value = editing.text;
    }, [editing && editing.r, editing && editing.c, !!editing]);

    function onSinkKeyDown(e) {
        if (e.nativeEvent.isComposing) return;
        if (editing) {
            if (e.key === 'Escape') { e.preventDefault(); setEditing(null); e.currentTarget.value = ''; return; }
            if (e.key === 'Enter' && (e.altKey || e.ctrlKey || e.metaKey)) {
                // a new line inside the cell
                e.preventDefault();
                const el = e.currentTarget, at = el.selectionStart;
                el.value = el.value.slice(0, at) + '\n' + el.value.slice(el.selectionEnd);
                el.selectionStart = el.selectionEnd = at + 1;
                setEditing({ ...editing, text: el.value });
                return;
            }
            if (e.key === 'Enter') { e.preventDefault(); commit({ dr: e.shiftKey ? -1 : 1, dc: 0 }); return; }
            if (e.key === 'Tab') { e.preventDefault(); commit({ dr: 0, dc: e.shiftKey ? -1 : 1 }); return; }
            if (editing.mode === 'type' && e.key.startsWith('Arrow')) {
                e.preventDefault();
                const d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
                wb.setValues(sheetId, editing.r, editing.c, editing.text, { source: 'user' });
                setEditing(null);
                e.currentTarget.value = '';
                moveTo(selectCell(Math.max(0, Math.min(size.rows - 1, sel.active.r + d[0])), Math.max(0, Math.min(size.cols - 1, sel.active.c + d[1]))));
            }
            return;
        }
        if (e.key === 'Escape' && clipMark) { setClipMark(null); return; }
        if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'f' || e.key === 'F' || e.key === 'h' || e.key === 'H')) {
            e.preventDefault();
            if (onFind) onFind(e.key.toLowerCase() === 'f' ? 'find' : 'replace');
            return;
        }
        // the paste itself comes as a paste event right after this key, with the clipboard's content
        if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) { valuesOnly.current = e.shiftKey; return; }
        const answer = keyAction(e, {
            sel, size,
            filled: (r, c) => wb.raw(sheetId, r, c) !== undefined,
            rowShown: (r) => rowAxis.size(r) > 0,
            colShown: (c) => colAxis.size(c) > 0,
            pageRows: Math.max(1, Math.floor(layout.mainHeight / (props.rowHeight || 21)) - 1),
            lastFilled: () => wb.lastFilled(sheetId)
        });
        if (!answer) return;
        e.preventDefault();
        if (answer.sel) moveTo(answer.sel);
        if (answer.start) startEdit('edit');
        if (answer.clear) wb.clear(sheetId, rectsOf(sel), { source: 'user' });
        if (answer.history) wb[answer.history]();
    }

    function onSinkInput(e) {
        const text = e.currentTarget.value;
        if (editing) setEditing({ ...editing, text });
        // a character typed on a selected cell starts the edit, replacing what the cell held
        else if (text) setEditing({ r: sel.active.r, c: sel.active.c, text, mode: 'type' });
    }

    // ---- the clipboard: the browser's own copy, cut and paste events, so Ctrl+C, Ctrl+X, Ctrl+V and the browser's menu all work --------------

    function onCopyOrCut(e, cut) {
        if (editing) return; // the editor copies its own text
        if (rects.length !== 1) { e.preventDefault(); return; } // as in Google Sheets: a copy is one rectangle
        e.preventDefault();
        const clip = copyBlock(wb, sheetId, rects[0], cut);
        e.clipboardData.setData('text/plain', clipText(clip));
        lastCopy = clip;
        e.clipboardData.setData('text/html', clipHtml(clip));
        setClipMark({ sheetId, rect: rects[0], cut });
    }

    function onPaste(e) {
        if (editing) return; // the editor pastes into its text
        e.preventDefault();
        const only = valuesOnly.current ? 'values' : 'all';
        valuesOnly.current = false;
        const target = rects[rects.length - 1];
        const clip = clipFromHtml(e.clipboardData.getData('text/html'));
        let landed;
        if (clip) landed = pasteClip(wb, sheetId, target, clip, only);
        else {
            const text = e.clipboardData.getData('text/plain');
            if (!text) return;
            landed = pasteText(wb, sheetId, target, text);
        }
        if (clip && clip.cut) setClipMark(null);
        setSel({ ranges: [{ anchor: { r: landed.r1, c: landed.c1 }, focus: { r: landed.r2, c: landed.c2 } }], active: { r: landed.r1, c: landed.c1 } });
    }

    // ---- the fill handle: the small square at the corner of the selection, dragged over the cells to fill ---------------------------------------

    function startFill() {
        const source = rects[0];
        let found = null;
        const move = (ev) => {
            const { x, y, rect } = pointIn(ev);
            const el = scroller.current;
            if (y > rect.height) el.scrollTop += Math.min(60, y - rect.height);
            if (x > rect.width) el.scrollLeft += Math.min(60, x - rect.width);
            const at = hit(Math.max(left + 1, Math.min(rect.width - 1, x)), Math.max(top + 1, Math.min(rect.height - 1, y)));
            found = at.kind === 'cell' ? fillTarget(source, at, size) : null;
            setFillPreview(found ? { r1: Math.min(source.r1, found.target.r1), c1: Math.min(source.c1, found.target.c1), r2: Math.max(source.r2, found.target.r2), c2: Math.max(source.c2, found.target.c2) } : null);
        };
        const up = (ev) => {
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', up);
            setFillPreview(null);
            if (!found) return;
            fillBlock(wb, sheetId, source, found.target, found.dir, ev.ctrlKey || ev.metaKey);
            const all = { r1: Math.min(source.r1, found.target.r1), c1: Math.min(source.c1, found.target.c1), r2: Math.max(source.r2, found.target.r2), c2: Math.max(source.c2, found.target.c2) };
            setSel({ ranges: [{ anchor: { r: all.r1, c: all.c1 }, focus: { r: all.r2, c: all.c2 } }], active: sel.active });
        };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
    }

    // an input method (Chinese, Japanese ...) starts composing: the editor shows at once, so the composition is seen where it goes
    function onCompositionStart() {
        if (!editing) setEditing({ r: sel.active.r, c: sel.active.c, text: '', mode: 'type' });
    }

    // ---- the mouse ------------------------------------------------------------------------------------------------------------------------------------

    function pointIn(e) {
        const rect = view.current.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top, rect };
    }

    // ---- resizing columns and rows: their edges in the headers are dragged, or double-clicked to fit the content ---------------------------------

    // the columns (or rows) a resize applies to: all the whole columns selected when the dragged one is one of them, else the dragged one alone
    function resizeTargets(kind, i) {
        const out = new Set();
        for (const b of rects) {
            const whole = kind === 'col' ? b.r1 === 0 && b.r2 === size.rows - 1 : b.c1 === 0 && b.c2 === size.cols - 1;
            const lo = kind === 'col' ? b.c1 : b.r1, hi = kind === 'col' ? b.c2 : b.r2;
            if (whole && i >= lo && i <= hi) for (let k = lo; k <= hi; k++) out.add(k);
        }
        return out.size ? [...out] : [i];
    }

    function startResize(kind, i, e) {
        const axis = kind === 'col' ? colAxis : rowAxis;
        const frozen = kind === 'col' ? layout.fc : layout.fr;
        const origin = (kind === 'col' ? left : top) + axis.start(i) - (i >= frozen ? (kind === 'col' ? scroll.left : scroll.top) : 0);
        const startSize = axis.size(i);
        const from = kind === 'col' ? e.clientX : e.clientY;
        let current = startSize;
        setGuide({ kind, at: origin + startSize });
        const move = (ev) => {
            current = Math.max(MIN_SIZE, startSize + (kind === 'col' ? ev.clientX : ev.clientY) - from);
            setGuide({ kind, at: origin + current });
        };
        const up = () => {
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', up);
            setGuide(null);
            if (current === startSize) return;
            const targets = resizeTargets(kind, i);
            if (kind === 'col') wb.setColProps(sheetId, targets, { width: current }, { source: 'user' });
            else wb.setRowProps(sheetId, targets, { height: current }, { source: 'user' });
        };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
    }

    // a double click on an edge: columns as wide as their widest text; rows back to the height their text needs (the height set by hand is taken away)
    function fit(kind, i) {
        const targets = resizeTargets(kind, i);
        if (kind === 'row') { wb.setRowProps(sheetId, targets, { height: null }, { source: 'user' }); return; }
        const each = (fn) => wb.forEachFilledRow(sheetId, fn);
        wb.setColProps(sheetId, targets, (c) => ({ width: columnNeed(each, wb.colId(sheetId, c), (r) => wb.value(sheetId, r, c)) }), { source: 'user' });
    }

    function onMouseDown(e) {
        if (e.button !== 0) return;
        const edge = e.target && e.target.dataset;
        if (edge && edge.fill !== undefined) {
            e.preventDefault();
            if (editing) commit(null);
            if (sink.current) sink.current.focus({ preventScroll: true });
            startFill();
            return;
        }
        if (edge && (edge.resizeCol !== undefined || edge.resizeRow !== undefined)) {
            e.preventDefault();
            if (editing) commit(null);
            // the keyboard stays with the grid, so Ctrl+Z right after the drag takes it back
            if (sink.current) sink.current.focus({ preventScroll: true });
            // the second press of a double click: the double click fits, it does not drag
            if (e.detail >= 2) return;
            startResize(edge.resizeCol !== undefined ? 'col' : 'row', Number(edge.resizeCol !== undefined ? edge.resizeCol : edge.resizeRow), e);
            return;
        }
        const { x, y } = pointIn(e);
        const target = hit(x, y);
        // the editor keeps the focus and the text: a click elsewhere ends the edit with what was typed
        if (editing) commit(null);
        e.preventDefault();
        if (sink.current) sink.current.focus({ preventScroll: true });
        const add = e.ctrlKey || e.metaKey;
        let next;
        if (target.kind === 'all') next = selectAll(size.rows, size.cols);
        else if (target.kind === 'col') next = e.shiftKey ? selectCols(Math.min(sel.active.c, target.c), Math.max(sel.active.c, target.c), size.rows) : selectCols(target.c, target.c, size.rows);
        else if (target.kind === 'row') next = e.shiftKey ? selectRows(Math.min(sel.active.r, target.r), Math.max(sel.active.r, target.r), size.cols) : selectRows(target.r, target.r, size.cols);
        else if (e.shiftKey) next = extendTo(sel, target.r, target.c);
        else if (add) next = addCell(sel, target.r, target.c);
        else next = selectCell(target.r, target.c);
        setSel(next);
        drag(target, next);
    }

    // a drag from where the mouse went down: the rectangle (or the rows, or the columns) follows the mouse, and the grid scrolls when it leaves the edge
    function drag(start, first) {
        if (start.kind === 'all') return;
        let current = first;
        const move = (ev) => {
            const { x, y, rect } = pointIn(ev);
            const el = scroller.current;
            if (y > rect.height) el.scrollTop += Math.min(60, y - rect.height);
            if (y < top && start.kind !== 'col') el.scrollTop -= Math.min(60, top - y);
            if (x > rect.width) el.scrollLeft += Math.min(60, x - rect.width);
            if (x < left && start.kind !== 'row') el.scrollLeft -= Math.min(60, left - x);
            const cx = Math.max(left + 1, Math.min(rect.width - 1, x)), cy = Math.max(top + 1, Math.min(rect.height - 1, y));
            const at = hit(cx, cy);
            if (start.kind === 'col') current = selectCols(Math.min(start.c, at.c), Math.max(start.c, at.c), size.rows);
            else if (start.kind === 'row') current = selectRows(Math.min(start.r, at.r), Math.max(start.r, at.r), size.cols);
            else current = extendTo(current, at.r, at.c);
            setSel(current);
        };
        const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
    }

    // ---- the right-click menu ----------------------------------------------------------------------------------------------------------------------

    function onContextMenu(e) {
        const { x, y } = pointIn(e);
        const target = hit(x, y);
        if (target.kind === 'all') return;
        e.preventDefault();
        if (editing) commit(null);
        if (sink.current) sink.current.focus({ preventScroll: true });
        // a right click inside the selection keeps it; elsewhere it selects what it is on, as a left click would
        const inside = target.kind === 'cell' ? rects.some((b) => target.r >= b.r1 && target.r <= b.r2 && target.c >= b.c1 && target.c <= b.c2)
            : target.kind === 'col' ? rects.some((b) => b.r1 === 0 && b.r2 === size.rows - 1 && target.c >= b.c1 && target.c <= b.c2)
            : rects.some((b) => b.c1 === 0 && b.c2 === size.cols - 1 && target.r >= b.r1 && target.r <= b.r2);
        let current = sel;
        if (!inside) {
            current = target.kind === 'col' ? selectCols(target.c, target.c, size.rows) : target.kind === 'row' ? selectRows(target.r, target.r, size.cols) : selectCell(target.r, target.c);
            setSel(current);
        }
        setMenu({ x: e.clientX, y: e.clientY, kind: target.kind, rect: rectsOf(current)[rectsOf(current).length - 1] });
    }

    function menuItems(m) {
        const b = m.rect;
        const nr = b.r2 - b.r1 + 1, nc = b.c2 - b.c1 + 1;
        const rowsText = nr === 1 ? 'row ' + (b.r1 + 1) : 'rows ' + (b.r1 + 1) + ' - ' + (b.r2 + 1);
        const colsText = nc === 1 ? 'column ' + colName(b.c1) : 'columns ' + colName(b.c1) + ' - ' + colName(b.c2);
        const merged = blocks.some((x) => x.r1 <= b.r2 && x.r2 >= b.r1 && x.c1 <= b.c2 && x.c2 >= b.c1);
        let hiddenRows = false, hiddenCols = false;
        for (let r = b.r1; r <= b.r2 && !hiddenRows && m.kind === 'row'; r++) if (!rowAxis.size(r)) hiddenRows = true;
        for (let c = b.c1; c <= b.c2 && !hiddenCols && m.kind === 'col'; c++) if (!colAxis.size(c)) hiddenCols = true;
        const items = [
            { value: 'cut', label: 'Cut', hint: 'Ctrl+X' },
            { value: 'copy', label: 'Copy', hint: 'Ctrl+C' },
            { value: 'paste', label: 'Paste', hint: 'Ctrl+V' },
            { value: 'pasteValues', label: 'Paste values only', hint: 'Ctrl+Shift+V' },
            { separator: true }
        ];
        if (m.kind !== 'col') items.push({ value: 'rowsAbove', label: 'Insert ' + nr + (nr === 1 ? ' row' : ' rows') + ' above' }, { value: 'rowsBelow', label: 'Insert ' + nr + (nr === 1 ? ' row' : ' rows') + ' below' });
        if (m.kind !== 'row') items.push({ value: 'colsLeft', label: 'Insert ' + nc + (nc === 1 ? ' column' : ' columns') + ' left' }, { value: 'colsRight', label: 'Insert ' + nc + (nc === 1 ? ' column' : ' columns') + ' right' });
        items.push({ separator: true });
        if (m.kind !== 'col') items.push({ value: 'deleteRows', label: 'Delete ' + rowsText });
        if (m.kind !== 'row') items.push({ value: 'deleteCols', label: 'Delete ' + colsText });
        items.push({ value: 'clear', label: 'Clear contents', hint: 'Delete' });
        if (m.kind === 'row') items.push({ value: 'hideRows', label: 'Hide ' + rowsText }, ...(hiddenRows ? [{ value: 'showRows', label: 'Unhide rows' }] : []));
        if (m.kind === 'col') items.push({ value: 'hideCols', label: 'Hide ' + colsText }, ...(hiddenCols ? [{ value: 'showCols', label: 'Unhide columns' }] : []));
        items.push({ separator: true });
        if (m.kind === 'col') items.push({ value: 'sortSheetAsc', label: 'Sort sheet A to Z' }, { value: 'sortSheetDesc', label: 'Sort sheet Z to A' });
        else if (m.kind === 'cell' && nr > 1) items.push({ value: 'sortRangeAsc', label: 'Sort range by column ' + colName(sel.active.c) + ' (A to Z)' }, { value: 'sortRangeDesc', label: 'Sort range by column ' + colName(sel.active.c) + ' (Z to A)' });
        if (m.kind === 'cell') items.push(merged ? { value: 'unmerge', label: 'Unmerge cells' } : { value: 'merge', label: 'Merge cells', disabled: nr === 1 && nc === 1 });
        // no separator at the end
        while (items.length && items[items.length - 1].separator) items.pop();
        return items;
    }

    function onMenuSelect(value) {
        const m = menu;
        setMenu(null);
        const b = m.rect;
        const nr = b.r2 - b.r1 + 1, nc = b.c2 - b.c1 + 1;
        const how = { source: 'user' };
        const run = (fn) => { try { fn(); } catch (err) { if (onError) onError(err.message); } };
        if (sink.current) sink.current.focus({ preventScroll: true });
        switch (value) {
            case 'cut': case 'copy': document.execCommand(value); break;
            case 'paste': case 'pasteValues': pasteFromMenu(value === 'pasteValues' ? 'values' : 'all'); break;
            case 'rowsAbove': run(() => wb.insertRows(sheetId, b.r1, nr, how)); break;
            case 'rowsBelow': run(() => wb.insertRows(sheetId, b.r2 + 1, nr, how)); break;
            case 'colsLeft': run(() => wb.insertCols(sheetId, b.c1, nc, how)); break;
            case 'colsRight': run(() => wb.insertCols(sheetId, b.c2 + 1, nc, how)); break;
            case 'deleteRows': run(() => wb.deleteRows(sheetId, b.r1, nr, how)); setSel(selectCell(Math.min(b.r1, Math.max(0, size.rows - nr - 1)), sel.active.c)); break;
            case 'deleteCols': run(() => wb.deleteCols(sheetId, b.c1, nc, how)); setSel(selectCell(sel.active.r, Math.min(b.c1, Math.max(0, size.cols - nc - 1)))); break;
            case 'clear': wb.clear(sheetId, rects, how); break;
            case 'hideRows': run(() => wb.setRowProps(sheetId, range(b.r1, b.r2), { hidden: true }, how)); break;
            case 'showRows': run(() => wb.setRowProps(sheetId, range(b.r1, b.r2), { hidden: null }, how)); break;
            case 'hideCols': run(() => wb.setColProps(sheetId, range(b.c1, b.c2), { hidden: true }, how)); break;
            case 'showCols': run(() => wb.setColProps(sheetId, range(b.c1, b.c2), { hidden: null }, how)); break;
            case 'sortSheetAsc': case 'sortSheetDesc': {
                // the whole sheet below its frozen rows (the header stays), by the column clicked
                const last = wb.lastFilled(sheetId);
                if (last.r > layout.fr) run(() => sortRange(wb, sheetId, { r1: layout.fr, c1: 0, r2: last.r, c2: Math.max(last.c, b.c2) }, b.c1, value === 'sortSheetAsc' ? 'asc' : 'desc'));
                break;
            }
            case 'sortRangeAsc': case 'sortRangeDesc': run(() => sortRange(wb, sheetId, b, sel.active.c, value === 'sortRangeAsc' ? 'asc' : 'desc')); break;
            case 'merge': run(() => wb.mergeCells(sheetId, b, how)); break;
            case 'unmerge': run(() => wb.unmergeCells(sheetId, b, how)); break;
            default: break;
        }
    }

    const range = (a, z) => { const out = []; for (let i = a; i <= z; i++) out.push(i); return out; };

    // The menu's Paste reads the clipboard's text (the browser asks the person the first time). A page cannot read the formulas a copy put in the
    // clipboard, so when the text is the one the last copy here made, that copy is pasted whole.
    async function pasteFromMenu(only) {
        const target = rects[rects.length - 1];
        let text;
        try { text = await navigator.clipboard.readText(); } catch { if (onError) onError('The browser does not let the page read the clipboard: use Ctrl+V to paste.'); return; }
        let landed;
        if (lastCopy && text === clipText(lastCopy)) { landed = pasteClip(wb, sheetId, target, lastCopy, only); if (lastCopy.cut) { setClipMark(null); lastCopy = null; } }
        else if (text) landed = pasteText(wb, sheetId, target, text);
        if (landed) setSel({ ranges: [{ anchor: { r: landed.r1, c: landed.c1 }, focus: { r: landed.r2, c: landed.c2 } }], active: { r: landed.r1, c: landed.c1 } });
    }

    function onDoubleClick(e) {
        const edge = e.target && e.target.dataset;
        if (edge && edge.resizeCol !== undefined) { fit('col', Number(edge.resizeCol)); return; }
        if (edge && edge.resizeRow !== undefined) { fit('row', Number(edge.resizeRow)); return; }
        const { x, y } = pointIn(e);
        const target = hit(x, y);
        if (target.kind !== 'cell') return;
        setSel(selectCell(target.r, target.c));
        setEditing({ r: target.r, c: target.c, text: wb.input(sheetId, target.r, target.c), mode: 'edit' });
    }

    // ---- the active cell stays on screen ------------------------------------------------------------------------------------------------------------

    const focus = focusOf(sel);
    // the host (the find bar) asks for the active cell to be shown
    useEffect(() => { if (revealTick) { reveal.current = true; showCell(sel.active); } }, [revealTick]);
    useEffect(() => {
        if (!reveal.current) return;
        showCell(focus);
    }, [focus.r, focus.c, box.width]);

    function showCell(p) {
        const el = scroller.current;
        if (!el || !box.width || !reveal.current) return;
        reveal.current = false;
        // a cell in the frozen rows (or columns) is always on screen, but going there takes the scrolling part back to its start, as in Google Sheets
        // (Ctrl+Home from the bottom of a sheet with a frozen header ends at the top)
        if (p.r < layout.fr) el.scrollTop = 0;
        else {
            const y = rowAxis.start(p.r) - fh, h = rowAxis.size(p.r);
            if (y < el.scrollTop) el.scrollTop = y;
            else if (y + h > el.scrollTop + layout.mainHeight) el.scrollTop = y + h - layout.mainHeight;
        }
        if (p.c < layout.fc) el.scrollLeft = 0;
        else {
            const x = colAxis.start(p.c) - fw, w = colAxis.size(p.c);
            if (x < el.scrollLeft) el.scrollLeft = x;
            else if (x + w > el.scrollLeft + layout.mainWidth) el.scrollLeft = x + w - layout.mainWidth;
        }
    }

    // ---- drawing --------------------------------------------------------------------------------------------------------------------------------------

    const onScroll = (e) => {
        const at = { top: e.currentTarget.scrollTop, left: e.currentTarget.scrollLeft };
        setScroll(at);
        if (scrollMemory) scrollMemory.set(sheetId, at);
    };
    const rects = rectsOf(sel);

    // The cells of a pane, against the sheet: a scrolling direction counts from the end of the frozen part, and the pane's layer moves by the scroll.
    const paneCells = (rows, cols, rowsScroll, colsScroll) => {
        const out = [];
        if (rows.to < rows.from || cols.to < cols.from) return out;
        const yBase = rowsScroll ? fh : 0, xBase = colsScroll ? fw : 0;
        // the grid lines first, under the cells: one along the bottom of each row, one along the right of each column
        const x0 = colAxis.start(cols.from) - xBase, x1 = colAxis.start(cols.to + 1) - xBase;
        const y0 = rowAxis.start(rows.from) - yBase, y1 = rowAxis.start(rows.to + 1) - yBase;
        for (let r = rows.from; r <= rows.to; r++) if (rowAxis.size(r)) out.push(<div key={'h' + r} className="ks-line-h" style={{ top: rowAxis.start(r + 1) - yBase - 1, left: x0, width: x1 - x0 }} />);
        for (let c = cols.from; c <= cols.to; c++) if (colAxis.size(c)) out.push(<div key={'v' + c} className="ks-line-v" style={{ left: colAxis.start(c + 1) - xBase - 1, top: y0, height: y1 - y0 }} />);
        for (let r = rows.from; r <= rows.to; r++) {
            const h = rowAxis.size(r);
            if (!h) continue;
            out.push(<Row key={r} wb={wb} sheetId={sheetId} r={r} top={rowAxis.start(r) - yBase} height={h} from={cols.from} to={cols.to} xBase={xBase}
                colAxis={colAxis} blocks={blocks} revision={revision} />);
        }
        // the merged blocks that reach into the pane, each drawn whole (the pane cuts what is outside it)
        for (const b of blocks) {
            if (b.r1 > rows.to || b.r2 < rows.from || b.c1 > cols.to || b.c2 < cols.from) continue;
            out.push(<Cell key={'m' + b.r1 + ':' + b.c1} r={b.r1} c={b.c1} merged x={colAxis.start(b.c1) - xBase} y={rowAxis.start(b.r1) - yBase}
                w={colAxis.start(b.c2 + 1) - colAxis.start(b.c1)} h={rowAxis.start(b.r2 + 1) - rowAxis.start(b.r1)}
                display={displayOf(wb.value(sheetId, b.r1, b.c1))} style={wb.style(sheetId, b.r1, b.c1)} />);
        }
        // the selection over them: each rectangle tinted, and the active cell framed
        rects.forEach((b, i) => {
            if (b.r1 > rows.to || b.r2 < rows.from || b.c1 > cols.to || b.c2 < cols.from) return;
            const single = b.r1 === b.r2 && b.c1 === b.c2;
            if (single && rects.length === 1) return;
            out.push(<div key={'s' + i} className="ks-sel" style={{ left: colAxis.start(b.c1) - xBase, top: rowAxis.start(b.r1) - yBase,
                width: colAxis.start(b.c2 + 1) - colAxis.start(b.c1), height: rowAxis.start(b.r2 + 1) - rowAxis.start(b.r1) }} />);
        });
        // a frame over a rectangle of cells, against the sheet like everything in the pane
        const frame = (key, cls, b) => {
            if (b.r1 > rows.to || b.r2 < rows.from || b.c1 > cols.to || b.c2 < cols.from) return;
            out.push(<div key={key} className={cls} style={{ left: colAxis.start(b.c1) - xBase, top: rowAxis.start(b.r1) - yBase,
                width: colAxis.start(b.c2 + 1) - colAxis.start(b.c1), height: rowAxis.start(b.r2 + 1) - rowAxis.start(b.r1) }} />);
        };
        if (clipMark && clipMark.sheetId === sheetId) frame('clip', 'ks-clipmark', clipMark.rect);
        if (fillPreview) frame('fill', 'ks-fillpreview', fillPreview);
        if (marks && marks.length) {
            for (let i = 0; i < marks.length; i++) {
                const m = marks[i];
                if (m.r >= rows.from && m.r <= rows.to && m.c >= cols.from && m.c <= cols.to) frame('mark' + i, 'ks-mark', { r1: m.r, c1: m.c, r2: m.r, c2: m.c });
            }
        }
        // the fill handle, at the corner of the selection when it is one rectangle
        if (rects.length === 1 && !editing) {
            const b = rects[0];
            if (b.r2 >= rows.from && b.r2 <= rows.to && b.c2 >= cols.from && b.c2 <= cols.to) {
                out.push(<div key="handle" className="ks-fill" data-fill="" style={{ left: colAxis.start(b.c2 + 1) - xBase - 4, top: rowAxis.start(b.r2 + 1) - yBase - 4 }} />);
            }
        }
        const a = blockAt(sel.active.r, sel.active.c) || { r1: sel.active.r, c1: sel.active.c, r2: sel.active.r, c2: sel.active.c };
        if (!(a.r1 > rows.to || a.r2 < rows.from || a.c1 > cols.to || a.c2 < cols.from)) {
            out.push(<div key="active" className="ks-active" style={{ left: colAxis.start(a.c1) - xBase, top: rowAxis.start(a.r1) - yBase,
                width: colAxis.start(a.c2 + 1) - colAxis.start(a.c1), height: rowAxis.start(a.r2 + 1) - rowAxis.start(a.r1) }} />);
        }
        return out;
    };

    // a header is marked when its row or column is in the selection, and marked strongly when all of it is
    const colState = (c) => {
        let on = false;
        for (const b of rects) if (c >= b.c1 && c <= b.c2) { if (b.r1 === 0 && b.r2 === size.rows - 1) return ' ks-on ks-full'; on = true; }
        return on ? ' ks-on' : '';
    };
    const rowState = (r) => {
        let on = false;
        for (const b of rects) if (r >= b.r1 && r <= b.r2) { if (b.c1 === 0 && b.c2 === size.cols - 1) return ' ks-on ks-full'; on = true; }
        return on ? ' ks-on' : '';
    };
    const colHeads = (cols, scrolling) => {
        const out = [];
        const base = scrolling ? fw : 0;
        for (let c = cols.from; c <= cols.to; c++) {
            const w = colAxis.size(c);
            if (!w) continue;
            out.push(<div key={c} className={'ks-colhead' + colState(c)} data-c={c} style={{ left: colAxis.start(c) - base, width: w, height: HEADER_HEIGHT }}>{colName(c)}</div>);
            out.push(<div key={'e' + c} className="ks-colresize" data-resize-col={c} style={{ left: colAxis.start(c + 1) - base - 3, height: HEADER_HEIGHT }} />);
        }
        return out;
    };
    const rowHeads = (rows, scrolling) => {
        const out = [];
        const base = scrolling ? fh : 0;
        for (let r = rows.from; r <= rows.to; r++) {
            const h = rowAxis.size(r);
            if (!h) continue;
            out.push(<div key={r} className={'ks-rowhead' + rowState(r)} data-r={r} style={{ top: rowAxis.start(r) - base, height: h, width: ROW_HEADER_WIDTH }}>{r + 1}</div>);
            out.push(<div key={'e' + r} className="ks-rowresize" data-resize-row={r} style={{ top: rowAxis.start(r + 1) - base - 3, width: ROW_HEADER_WIDTH }} />);
        }
        return out;
    };

    // the keyboard sink sits on the active cell; while a cell is edited it is the editor, with the cell's font, as big as its text needs
    const at = editing ? cellBox(editing.r, editing.c) : cellBox(sel.active.r, sel.active.c);
    const editStyle = editing ? cellCss(wb.style(sheetId, editing.r, editing.c), { align: 'left', kind: 'text' }) : null;
    const sinkStyle = editing
        ? { left: at.x, top: at.y, width: Math.max(at.w, editorSize ? editorSize.w : 0), height: Math.max(at.h, editorSize ? editorSize.h : 0),
            fontWeight: editStyle.fontWeight, fontStyle: editStyle.fontStyle, fontSize: editStyle.fontSize, fontFamily: editStyle.fontFamily, color: editStyle.color, background: editStyle.background }
        : { left: at.x, top: at.y, width: Math.max(1, at.w), height: Math.max(1, at.h) };

    const sx = scroll.left, sy = scroll.top;
    return (
        <div className="ks-grid" ref={scroller} onScroll={onScroll}>
            <div className="ks-spacer" style={{ width: layout.contentWidth, height: layout.contentHeight }} />
            <div className="ks-view" ref={view} style={{ width: box.width, height: box.height }} onMouseDown={onMouseDown} onDoubleClick={onDoubleClick} onContextMenu={onContextMenu}>
                {box.width > 0 ? (
                    <>
                        <Pane className="ks-main" left={left + fw} top={top + fh} width={layout.mainWidth} height={layout.mainHeight} shiftX={sx} shiftY={sy}>{paneCells(R.scrolling, C.scrolling, true, true)}</Pane>
                        <Pane className="ks-top" left={left + fw} top={top} width={layout.mainWidth} height={fh} shiftX={sx} shiftY={0}>{paneCells(R.frozen, C.scrolling, false, true)}</Pane>
                        <Pane className="ks-left" left={left} top={top + fh} width={fw} height={layout.mainHeight} shiftX={0} shiftY={sy}>{paneCells(R.scrolling, C.frozen, true, false)}</Pane>
                        <Pane className="ks-corner" left={left} top={top} width={fw} height={fh} shiftX={0} shiftY={0}>{paneCells(R.frozen, C.frozen, false, false)}</Pane>
                        <Pane className="ks-heads-cols" left={left + fw} top={0} width={layout.mainWidth} height={HEADER_HEIGHT} shiftX={sx} shiftY={0}>{colHeads(C.scrolling, true)}</Pane>
                        <Pane className="ks-heads-cols ks-frozen" left={left} top={0} width={fw} height={HEADER_HEIGHT} shiftX={0} shiftY={0}>{colHeads(C.frozen, false)}</Pane>
                        <Pane className="ks-heads-rows" left={0} top={top + fh} width={ROW_HEADER_WIDTH} height={layout.mainHeight} shiftX={0} shiftY={sy}>{rowHeads(R.scrolling, true)}</Pane>
                        <Pane className="ks-heads-rows ks-frozen" left={0} top={top} width={ROW_HEADER_WIDTH} height={fh} shiftX={0} shiftY={0}>{rowHeads(R.frozen, false)}</Pane>
                        <div className="ks-origin" style={{ width: ROW_HEADER_WIDTH, height: HEADER_HEIGHT }} />
                        {fh > 0 ? <div className="ks-freeze-line ks-h" style={{ top: top + fh - 1, width: box.width }} /> : null}
                        {fw > 0 ? <div className="ks-freeze-line ks-v" style={{ left: left + fw - 1, height: box.height }} /> : null}
                        {guide ? <div className={'ks-guide ' + (guide.kind === 'col' ? 'ks-v' : 'ks-h')} style={guide.kind === 'col' ? { left: guide.at - 1, height: box.height } : { top: guide.at - 1, width: box.width }} /> : null}
                    </>
                ) : null}
                <textarea ref={sink} className={'ks-input' + (editing ? ' ks-editing' : '')} style={sinkStyle} spellCheck={false} autoComplete="off"
                    aria-label={'Cell ' + colName(sel.active.c) + (sel.active.r + 1)} onKeyDown={onSinkKeyDown} onInput={onSinkInput}
                    onCompositionStart={onCompositionStart} onBlur={() => { if (editing) commit(null); }}
                    onCopy={(e) => onCopyOrCut(e, false)} onCut={(e) => onCopyOrCut(e, true)} onPaste={onPaste} />
                {menu ? <Menu at={{ x: menu.x, y: menu.y }} items={menuItems(menu)} onSelect={onMenuSelect} onClose={() => setMenu(null)} container={container} label="Cell" /> : null}
                <span ref={mirror} className="ks-mirror" style={editStyle ? { fontWeight: editStyle.fontWeight, fontStyle: editStyle.fontStyle, fontSize: editStyle.fontSize, fontFamily: editStyle.fontFamily } : undefined} />
            </div>
        </div>
    );
}
