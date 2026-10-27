import { HEADER_HEIGHT, ROW_HEADER_WIDTH } from './geometry.js';
import { colName } from '../core/formula/address.js';

// One level of groups takes this many pixels of the gutter; a gutter is as wide as its levels, and one more for the level buttons.
export const LEVEL_SIZE = 16;

/** How wide the gutter of the groups of rows is (0: no groups), and how tall the one of the columns. */
export const gutterSize = (maxLevel) => (maxLevel ? (maxLevel + 1) * LEVEL_SIZE + 2 : 0);

/**
 * The gutter of the groups of rows (kind 'rows', on the left of the row numbers) or of columns ('cols', over the column letters), as in Google Sheets:
 * a bracket along each open group, a [−] / [+] on the row before it (its title), and the level buttons (1, 2, 3 ...) in its corner. It scrolls with the
 * grid: the frozen part stays, the rest moves by the scroll.
 *
 * @param {object} p
 * @param {'rows'|'cols'} p.kind
 * @param {{ groups: { level: number, from: number, to: number, folded: boolean }[], maxLevel: number }} p.outline
 * @param {any} p.axis  The rows' (or columns') axis, zoomed as the grid is.
 * @param {number} p.frozen  How many rows (or columns) are frozen. @param {number} p.frozenSize  Their size.
 * @param {{ from: number, to: number }} p.shown  The rows (or columns) the grid draws now (frozen ones included).
 * @param {number} p.scroll  The grid's scroll along this direction. @param {number} p.length  The grid's box along it.
 * @param {(g: object) => void} p.onToggle  A group's [−] / [+] was clicked.
 * @param {(level: number) => void} p.onLevel  A level button was clicked: show the groups up to that level (0: fold them all).
 */
export function Gutter({ kind, outline, axis, frozen, frozenSize, shown, scroll, length, onToggle, onLevel }) {
    const rows = kind === 'rows';
    const head = rows ? HEADER_HEIGHT : ROW_HEADER_WIDTH;
    const size = gutterSize(outline.maxLevel);
    // where a row (or column) starts in the gutter, and whether it is cut by the frozen part
    const at = (i) => head + axis.start(i) - (i >= frozen ? scroll : 0);
    // a group wholly in the frozen rows is drawn with them; any other scrolls
    const fixed = [], scrolled = [];
    for (const g of outline.groups) {
        const out = g.to < frozen ? fixed : scrolled;
        if (g.to < shown.from - 1 || g.from - 1 > shown.to) continue;
        const titleRow = g.from > 0 ? g.from - 1 : g.from;
        const across = 1 + (g.level - 1) * LEVEL_SIZE;
        const start = at(titleRow), titleSize = axis.size(titleRow);
        if (!g.folded) {
            // the bracket: from the middle of the title down to the end of the group's last row
            const a = start + titleSize / 2 + 7, b = at(g.to) + axis.size(g.to) - 3;
            if (b > a) out.push(<div key={'l' + g.level + ':' + g.from} className={'ks-outline-line ks-' + kind} style={rows ? { left: across + LEVEL_SIZE / 2, top: a, height: b - a } : { top: across + LEVEL_SIZE / 2, left: a, width: b - a }} />);
        }
        if (!titleSize) continue;
        const middle = start + titleSize / 2 - 7;
        const where = (g.folded ? 'Expand' : 'Collapse') + ' ' + (rows ? 'rows ' + (g.from + 1) + ' - ' + (g.to + 1) : 'columns ' + colName(g.from) + ' - ' + colName(g.to));
        out.push(<button key={'t' + g.level + ':' + g.from} type="button" className={'ks-outline-toggle' + (g.folded ? ' ks-folded' : '')} aria-label={where} title={where}
            aria-expanded={!g.folded} data-group-from={g.from} data-group-level={g.level} tabIndex={-1}
            style={rows ? { left: across + 1, top: middle } : { top: across + 1, left: middle }}
            onMouseDown={(e) => e.preventDefault()} onClick={() => onToggle(g)}>{g.folded ? '+' : '−'}</button>);
    }
    // the part a scrolled row is drawn in starts under the frozen ones (and the header): what scrolls under them is cut
    const box = (children, from, extent, key) => (
        <div key={key} className="ks-outline-clip" style={rows ? { top: from, height: Math.max(0, extent), left: 0, width: size } : { left: from, width: Math.max(0, extent), top: 0, height: size }}>
            <div style={{ position: 'absolute', [rows ? 'top' : 'left']: -from }}>{children}</div>
        </div>
    );
    const levels = [];
    for (let level = 0; level <= outline.maxLevel; level++) {
        levels.push(<button key={'v' + level} type="button" className="ks-outline-level" aria-label={'Show ' + (rows ? 'row' : 'column') + ' groups up to level ' + (level + 1)} title={'Level ' + (level + 1)}
            tabIndex={-1} style={rows ? { left: 1 + level * LEVEL_SIZE, top: (head - LEVEL_SIZE) / 2 } : { top: 1 + level * LEVEL_SIZE, left: (head - LEVEL_SIZE) / 2 }}
            onMouseDown={(e) => e.preventDefault()} onClick={() => onLevel(level)}>{level + 1}</button>);
    }
    return (
        <div className={'ks-outline ks-outline-' + kind} aria-label={rows ? 'Row groups' : 'Column groups'}>
            {box(fixed, head, frozenSize, 'fixed')}
            {box(scrolled, head + frozenSize, length - head - frozenSize, 'scrolled')}
            {levels}
        </div>
    );
}
