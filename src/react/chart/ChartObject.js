import { memo, useEffect, useRef, useState } from 'react';
import { drawChart, drawSparkline } from './draw.js';

// the room a chart laid over its cells keeps around the block for its axes, title and end labels (they stand outside the cells it covers)
export const OVER = { left: 64, right: 150, top: 30, bottom: 12 };
const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

/**
 * One chart on the grid, on the block of cells it covers: its canvas, and when it is selected its frame and the handles to resize it.
 *
 * A chart with a background is a card: a click on it selects it, a drag moves it. A chart without one (background 'none') is laid over its cells, as
 * an S-curve over a schedule: the mouse goes through it to the cells, and it is picked by its edge (or from the chart panel).
 *
 * @param {object} props
 * @param {any} props.workbook @param {string} props.sheetId
 * @param {any} props.chart  As wb.charts() gives it.
 * @param {number} props.revision  Drawn again after a change (its data may have changed).
 * @param {{ left: number, top: number, width: number, height: number }} props.box  Where its block of cells is, in the pane.
 * @param {number[]} props.xs  The centre of each column of the block, from its left (for a chart laid over its cells).
 * @param {boolean} props.selected
 * @param {(e: MouseEvent, id: string, mode: string) => void} props.onPointer  A press on it ('move') or on a handle ('nw' ... 'w').
 */
export const ChartObject = memo(function ChartObject({ workbook: wb, sheetId, chart, revision, box, xs, selected, onPointer }) {
    const canvas = useRef(null);
    const hits = useRef([]);
    const [tip, setTip] = useState(null);
    const over = chart.align === 'cells';
    const room = over ? OVER : { left: 0, right: 0, top: 0, bottom: 0 };
    const W = Math.max(1, Math.round(box.width + room.left + room.right)), H = Math.max(1, Math.round(box.height + room.top + room.bottom));
    const xsKey = over ? xs.join(',') : '';

    useEffect(() => {
        const c = canvas.current;
        if (!c) return;
        // drawn at the screen's own sharpness: the backing store is the size times the device pixel ratio
        const ratio = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
        c.width = Math.round(W * ratio);
        c.height = Math.round(H * ratio);
        const ctx = c.getContext('2d');
        if (!ctx) return;
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        let model;
        try { model = wb.chartData(sheetId, chart.id); } catch (err) { model = { categories: [], series: [] }; }
        const locale = wb.settings().locale;
        hits.current = drawChart(ctx, { width: W, height: H, model, spec: chart, locale, cells: over ? { plot: { x: room.left, y: room.top, w: box.width, h: box.height }, xs } : null });
        hits.current.model = model;
    }, [wb, sheetId, chart, revision, W, H, xsKey]);

    // the value under the mouse, in a small box beside it
    function onMove(e) {
        const r = canvas.current.getBoundingClientRect();
        const x = e.clientX - r.left, y = e.clientY - r.top;
        const h = hits.current.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
        if (!h) { if (tip) setTip(null); return; }
        const m = hits.current.model;
        const s = m.series.filter((x) => !x.hidden)[h.series];
        const name = chart.type === 'pie' || chart.type === 'donut' ? m.categories[h.category] : (s ? s.name : '') + ' · ' + m.categories[h.category];
        let value;
        try { value = new Intl.NumberFormat(wb.settings().locale || undefined, { maximumFractionDigits: 2 }).format(h.value); } catch (err) { value = String(h.value); }
        setTip({ x: x + 12, y: y + 12, name, value });
    }

    const through = chart.background === 'none';
    return (
        <div className={'ks-chart' + (through ? ' ks-chart-over' : '') + (selected ? ' ks-chart-selected' : '')} data-chart={chart.id}
            style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
            onMouseDown={through ? undefined : (e) => onPointer(e, chart.id, 'move')}>
            <canvas ref={canvas} className="ks-chart-canvas" aria-label={chart.title ? 'Chart: ' + chart.title : 'Chart'} role="img"
                style={{ left: -room.left, top: -room.top, width: W, height: H }}
                onMouseMove={through ? undefined : onMove} onMouseLeave={() => setTip(null)} />
            {/* the edge of a chart laid over its cells: the one place the mouse picks it (the inside goes through to the cells) */}
            {through ? ['top', 'right', 'bottom', 'left'].map((side) => <div key={side} className={'ks-chart-edge ks-edge-' + side} onMouseDown={(e) => onPointer(e, chart.id, 'move')} />) : null}
            {selected ? HANDLES.map((h) => <div key={h} className={'ks-chart-handle ks-h-' + h} onMouseDown={(e) => onPointer(e, chart.id, h)} />) : null}
            {tip ? <div className="ks-chart-tip" style={{ left: tip.x - room.left, top: tip.y - room.top }}><span>{tip.name}</span><b>{tip.value}</b></div> : null}
        </div>
    );
});

/** One cell's sparkline: a small canvas over the cell, drawn again when its numbers change. */
export const SparkCell = memo(function SparkCell({ box, values, group }) {
    const canvas = useRef(null);
    const key = values.join(',');
    useEffect(() => {
        const c = canvas.current;
        if (!c) return;
        const ratio = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
        c.width = Math.max(1, Math.round(box.width * ratio));
        c.height = Math.max(1, Math.round(box.height * ratio));
        const ctx = c.getContext('2d');
        if (!ctx) return;
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        drawSparkline(ctx, { width: box.width, height: box.height, values, type: group.type, color: group.color, negColor: group.negColor, markers: group.markers, min: group.min, max: group.max });
    }, [key, box.width, box.height, group.type, group.color, group.markers, group.negColor, group.min, group.max]);
    return <canvas ref={canvas} className="ks-spark" role="img" aria-label="Sparkline" style={{ left: box.left, top: box.top, width: box.width, height: box.height }} />;
});
