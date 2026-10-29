// Every setting of a chart and of a sparkline group, in one list (exported from the core: CHART_FIELDS, SPARKLINE_FIELDS, CHART_NODES): where it stands in the chart editor (the node of its tree), how it is edited (the
// kind of its field), and when it shows (the kinds of chart it is for). The editor is drawn from this list, the reference of the docs is printed
// from it, and a test checks that every key of the types (ChartSpec, ChartSeriesSpec, SparklineSpec) is in it, so the editor can never offer less
// than the code can do. Pure: no React.
//
// A field: { key, label, kind, node, for?, options?, unit?, help? }
//   key    the setting ('title', 'y.min' for a key inside y, 'series.color' for a key of one series)
//   kind   text | number | range | color | toggle | segment | type | colors | totals
//   node   the node of the tree it is edited in: chart, data, series, axes, title, labels, place, slices, center, limits, steps, sparkline
//   for    the kinds of chart it shows for (all when left out)

export const ON_AXES = ['column', 'bar', 'line', 'area', 'combo', 'scatter'];
const CATEGORY = ['column', 'bar', 'line', 'area', 'combo', 'bullet', 'waterfall', 'pie', 'donut'];
const LINES = ['line', 'area', 'combo', 'scatter'];
const axis = (k, label) => [
    { key: k + '.min', label: 'Min', kind: 'number', node: 'axes', group: label, for: ON_AXES.concat(['bullet', 'waterfall']) },
    { key: k + '.max', label: 'Max', kind: 'number', node: 'axes', group: label, for: ON_AXES.concat(['bullet', 'waterfall']) },
    { key: k + '.prefix', label: 'Before', kind: 'text', node: 'axes', group: label, placeholder: 'Rp ', for: ON_AXES.concat(['bullet', 'waterfall', 'pie', 'donut']) },
    { key: k + '.suffix', label: 'After', kind: 'text', node: 'axes', group: label, placeholder: ' jt', for: ON_AXES.concat(['bullet', 'waterfall', 'pie', 'donut']) },
    { key: k + '.decimals', label: 'Decimals', kind: 'number', node: 'axes', group: label, for: ON_AXES.concat(['bullet', 'waterfall', 'pie', 'donut']) },
    { key: k + '.percent', label: 'Percent', kind: 'toggle', node: 'axes', group: label, help: 'Write 0.5 as 50% (on its own when the cells are percents)', for: ON_AXES.concat(['bullet', 'waterfall', 'pie', 'donut']) }
];

/** The settings of a chart, node by node. */
export const CHART_FIELDS = [
    { key: 'type', label: 'Type', kind: 'type', node: 'chart' },

    { key: 'data', label: 'Block', kind: 'range', node: 'data', help: 'One block read as Excel reads a selection; leave it empty for series of their own ranges' },
    { key: 'seriesIn', label: 'Series in', kind: 'segment', node: 'data', options: [['auto', 'Auto'], ['cols', 'Columns'], ['rows', 'Rows']] },
    { key: 'categories', label: 'Categories', kind: 'range', node: 'data', for: CATEGORY, help: 'A range of labels every series shares (or the first column of the block)' },

    { key: 'series.name', label: 'Name', kind: 'text', node: 'series' },
    { key: 'series.nameFrom', label: 'Name from cell', kind: 'range', node: 'series' },
    { key: 'series.values', label: 'Values (y)', kind: 'range', node: 'series', help: 'Its own range (a series past the block\'s)' },
    { key: 'series.x', label: 'X values', kind: 'range', node: 'series', for: ['scatter'] },
    { key: 'series.color', label: 'Color', kind: 'color', node: 'series' },
    { key: 'series.type', label: 'Draw as', kind: 'segment', node: 'series', for: ['column', 'line', 'area', 'combo'], options: [['', 'Default'], ['column', 'Column'], ['line', 'Line'], ['area', 'Area']] },
    { key: 'series.type', label: 'Draw as', kind: 'segment', node: 'series', for: ['scatter'], options: [['', 'Default'], ['line', 'Line'], ['points', 'Points']] },
    { key: 'series.axis', label: 'Axis', kind: 'segment', node: 'series', for: ['column', 'line', 'area', 'combo'], options: [['', 'Left'], ['right', 'Right']] },
    { key: 'series.dash', label: 'Dashed', kind: 'toggle', node: 'series', for: LINES },
    { key: 'series.width', label: 'Line width', kind: 'number', unit: 'px', node: 'series', for: LINES },
    { key: 'series.smooth', label: 'Smooth', kind: 'toggle', node: 'series', for: LINES },
    { key: 'series.markers', label: 'Markers', kind: 'toggle', node: 'series', for: ['line', 'area', 'combo'], default: true },
    { key: 'series.size', label: 'Point size', kind: 'number', unit: 'px', node: 'series', for: ['scatter'] },
    { key: 'series.labels', label: 'Data labels', kind: 'toggle', node: 'series' },
    { key: 'series.endLabel', label: 'End label', kind: 'text', node: 'series', for: LINES, help: 'Text before the last value, at the end of the line' },
    { key: 'series.hidden', label: 'Hidden', kind: 'toggle', node: 'series' },

    ...axis('y', 'Value axis (left)'),
    ...axis('y2', 'Right axis'),
    { key: 'x.min', label: 'Min', kind: 'number', node: 'axes', group: 'X axis', for: ['scatter'] },
    { key: 'x.max', label: 'Max', kind: 'number', node: 'axes', group: 'X axis', for: ['scatter'] },
    { key: 'x.prefix', label: 'Before', kind: 'text', node: 'axes', group: 'X axis', for: ['scatter'] },
    { key: 'x.suffix', label: 'After', kind: 'text', node: 'axes', group: 'X axis', for: ['scatter'] },
    { key: 'x.decimals', label: 'Decimals', kind: 'number', node: 'axes', group: 'X axis', for: ['scatter'] },
    { key: 'x.percent', label: 'Percent', kind: 'toggle', node: 'axes', group: 'X axis', for: ['scatter'] },
    { key: 'yAxis', label: 'Show the value axis', kind: 'toggle', node: 'axes', group: 'Show', default: true },
    { key: 'xAxis', label: 'Show the categories (x)', kind: 'toggle', node: 'axes', group: 'Show', default: true },

    { key: 'title', label: 'Title', kind: 'text', node: 'title' },
    { key: 'subtitle', label: 'Subtitle', kind: 'text', node: 'title' },
    { key: 'legend', label: 'Legend', kind: 'segment', node: 'title', options: [['top', 'Top'], ['right', 'Right'], ['bottom', 'Bottom'], ['none', 'Off']] },

    { key: 'labels', label: 'Data labels', kind: 'toggle', node: 'labels' },
    { key: 'grid', label: 'Gridlines', kind: 'toggle', node: 'labels', default: true, for: ON_AXES.concat(['bullet', 'waterfall']) },
    { key: 'stacked', label: 'Stacked', kind: 'toggle', node: 'labels', for: ['column', 'bar', 'area', 'combo'] },
    { key: 'smooth', label: 'Smooth lines', kind: 'toggle', node: 'labels', for: LINES },
    { key: 'markers', label: 'Markers', kind: 'toggle', node: 'labels', default: true, for: ['line', 'area', 'combo'] },
    { key: 'lines', label: 'Lines through the points', kind: 'toggle', node: 'labels', for: ['scatter'] },

    { key: 'at', label: 'Cells', kind: 'range', node: 'place', help: 'The block of cells the chart stands on' },
    { key: 'background', label: 'Background', kind: 'segment', node: 'place', options: [['white', 'White'], ['none', 'Transparent']], help: 'Transparent: over the cells, a click goes through; pick it by its edge' },
    { key: 'align', label: 'Points', kind: 'segment', node: 'place', for: ['column', 'line', 'area', 'combo'], options: [['fit', 'Fit'], ['cells', 'On the columns']], help: 'On the columns: category i in the middle of column i of its cells (an S-curve over a schedule)' },

    { key: 'colors', label: 'Colors', kind: 'colors', node: 'slices', for: ['pie', 'donut'], help: 'One per slice, in the order of the categories' },
    { key: 'centerText', label: 'Center text', kind: 'text', node: 'center', for: ['donut'], placeholder: 'the total' },
    { key: 'centerLabel', label: 'Under it', kind: 'text', node: 'center', for: ['donut'], placeholder: 'the series\' name' },
    { key: 'warn', label: 'Amber when below by', kind: 'number', node: 'limits', for: ['bullet'], placeholder: '1' },
    { key: 'bad', label: 'Red when below by', kind: 'number', node: 'limits', for: ['bullet'], placeholder: '5' },
    { key: 'totals', label: 'Totals (category numbers)', kind: 'totals', node: 'steps', for: ['waterfall'], help: 'From 1; the last one is a total when its cell is empty' },
    { key: 'upColor', label: 'Up', kind: 'color', node: 'steps', for: ['waterfall'] },
    { key: 'downColor', label: 'Down', kind: 'color', node: 'steps', for: ['waterfall'] },
    { key: 'totalColor', label: 'Total', kind: 'color', node: 'steps', for: ['waterfall'] }
];

/** The settings of a group of sparklines. */
export const SPARKLINE_FIELDS = [
    { key: 'type', label: 'Type', kind: 'segment', node: 'sparkline', options: [['line', 'Line'], ['column', 'Column'], ['winloss', 'Win/loss']] },
    { key: 'color', label: 'Color', kind: 'color', node: 'sparkline' },
    { key: 'negColor', label: 'Negative', kind: 'color', node: 'sparkline' },
    { key: 'markers', label: 'Dots', kind: 'segment', node: 'sparkline', options: [['last', 'Last'], ['all', 'All'], ['none', 'None']] },
    { key: 'min', label: 'Min', kind: 'number', node: 'sparkline' },
    { key: 'max', label: 'Max', kind: 'number', node: 'sparkline' },
    { key: 'at', label: 'Cells', kind: 'range', node: 'sparkline' },
    { key: 'data', label: 'Data', kind: 'range', node: 'sparkline' }
];

/** The nodes of the chart editor's tree, in their order, with the kinds of chart each is for. */
export const NODES = [
    { id: 'chart', label: 'Chart' },
    { id: 'data', label: 'Data' },
    { id: 'series', label: 'Series' },
    { id: 'axes', label: 'Axes', for: ON_AXES.concat(['bullet', 'waterfall']) },
    { id: 'title', label: 'Title and legend' },
    { id: 'labels', label: 'Labels and gridlines' },
    { id: 'place', label: 'Place and background' },
    { id: 'slices', label: 'Slices', for: ['pie', 'donut'] },
    { id: 'center', label: 'Center', for: ['donut'] },
    { id: 'limits', label: 'Limits', for: ['bullet'] },
    { id: 'steps', label: 'Steps', for: ['waterfall'] }
];

/** Whether a field or a node is for a kind of chart. */
export const isFor = (x, type) => !x.for || x.for.includes(type);
/** The fields of a node for a kind of chart (the series' fields for a series node). */
export const fieldsOf = (node, type) => CHART_FIELDS.filter((f) => f.node === node && isFor(f, type));

/** A setting's value in a chart or a series ('y.min' looks inside y). */
export function valueAt(obj, key) {
    const [a, b] = key.split('.');
    if (b === undefined) return obj ? obj[a] : undefined;
    return obj && obj[a] ? obj[a][b] : undefined;
}
/** The patch that sets a setting ('y.min' keeps the rest of y); an empty value takes the setting away. */
export function patchFor(obj, key, value) {
    const empty = value === undefined || value === null || value === '' || (typeof value === 'number' && !Number.isFinite(value));
    const [a, b] = key.split('.');
    if (b === undefined) return { [a]: empty ? undefined : value };
    const inner = { ...((obj && obj[a]) || {}) };
    if (empty) delete inner[b]; else inner[b] = value;
    return { [a]: Object.keys(inner).length ? inner : undefined };
}
