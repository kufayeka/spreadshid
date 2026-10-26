import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { colName } from '../core/formula/address.js';
import { displayOf } from '../core/display.js';
import { layoutOf, HEADER_HEIGHT, ROW_HEADER_WIDTH } from './geometry.js';

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

function Cell({ r, c, x, y, w, h, merged, display, style }) {
    const css = cellCss(style, display);
    return (
        <div className={'ks-cell' + (merged ? ' ks-merged' : '')} data-r={r} data-c={c}
            style={{ left: x, top: y, width: w, height: h, background: css.background, alignItems: css.alignItems, justifyContent: css.justifyContent }}>
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
        cells.push(<Cell key={c} r={r} c={c} x={colAxis.start(c) - xBase} y={top} w={width} h={height} display={display} style={style} />);
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
 * The grid of one sheet: the scroller, the headers and the four panes.
 * @param {{ workbook: any, sheetId: string, revision: number }} props
 */
export function Grid({ workbook: wb, sheetId, revision }) {
    const scroller = useRef(null);
    const [box, setBox] = useState({ width: 0, height: 0 });
    const [scroll, setScroll] = useState({ top: 0, left: 0 });

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

    const props = useMemo(() => wb.sheetProps(sheetId), [wb, sheetId, revision]);
    const rowAxis = wb.rowAxis(sheetId);
    const colAxis = wb.colAxis(sheetId);
    const blocks = useMemo(() => wb.merges(sheetId), [wb, sheetId, revision]);
    const layout = layoutOf({ rows: rowAxis, cols: colAxis, freezeRows: props.freezeRows, freezeCols: props.freezeCols,
        scrollTop: scroll.top, scrollLeft: scroll.left, width: box.width, height: box.height });

    const onScroll = (e) => setScroll({ top: e.currentTarget.scrollTop, left: e.currentTarget.scrollLeft });

    const fw = layout.frozenWidth, fh = layout.frozenHeight;
    const R = layout.rows, C = layout.cols;

    // The cells of a pane, against the sheet: a scrolling direction counts from the end of the frozen part, and the pane's layer moves by the scroll.
    const paneCells = (rows, cols, rowsScroll, colsScroll) => {
        const out = [];
        if (rows.to < rows.from || cols.to < cols.from) return out;
        const yBase = rowsScroll ? fh : 0, xBase = colsScroll ? fw : 0;
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
        return out;
    };

    const colHeads = (cols, scrolling) => {
        const out = [];
        const base = scrolling ? fw : 0;
        for (let c = cols.from; c <= cols.to; c++) {
            const w = colAxis.size(c);
            if (w) out.push(<div key={c} className="ks-colhead" data-c={c} style={{ left: colAxis.start(c) - base, width: w, height: HEADER_HEIGHT }}>{colName(c)}</div>);
        }
        return out;
    };
    const rowHeads = (rows, scrolling) => {
        const out = [];
        const base = scrolling ? fh : 0;
        for (let r = rows.from; r <= rows.to; r++) {
            const h = rowAxis.size(r);
            if (h) out.push(<div key={r} className="ks-rowhead" data-r={r} style={{ top: rowAxis.start(r) - base, height: h, width: ROW_HEADER_WIDTH }}>{r + 1}</div>);
        }
        return out;
    };

    const top = HEADER_HEIGHT, left = ROW_HEADER_WIDTH;
    const sx = scroll.left, sy = scroll.top;
    return (
        <div className="ks-grid" ref={scroller} onScroll={onScroll}>
            <div className="ks-spacer" style={{ width: layout.contentWidth, height: layout.contentHeight }} />
            <div className="ks-view" style={{ width: box.width, height: box.height }}>
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
                    </>
                ) : null}
            </div>
        </div>
    );
}
