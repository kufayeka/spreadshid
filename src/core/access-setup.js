// What the rules editor shows over the sheet (the access rows' "setup" view): which rows touch a cell, the colour of each who, and the cells of one
// row, to outline the row that is selected. Pure (no DOM): the grid asks, and draws.
//
// A row touches a cell when its where names the cell. The squares are drawn only over the part of a sheet that holds something (up to its last
// filled row and column): a rule for a whole column would otherwise mark a thousand empty rows. The outline of the selected rule shows all of it.
//
// A row touches a cell when its where names the cell. Its condition (when) is left out on purpose: the editor shows where a rule can hold, not
// whether it holds now for the data of today. A row without a where (an action anywhere, a part of the screen) touches no cell.

import { resolveRules, modeOf } from './access.js';
import { parseWhere } from './policy.js';

// Eight colours that stay apart from each other, on white and for most kinds of colour blindness, with the darker ones first.
const PALETTE = ['#1a73e8', '#9334e6', '#e37400', '#188038', '#d01884', '#007b83', '#b06000', '#5f6368'];

/**
 * The colour of a who ('role:kasir', 'user:budi', '*'), the same everywhere and on every computer: worked out from its text, so the host's own list
 * of rules can show the same colour the sheet does. `colors` gives some of them a colour of the host's own.
 * @param {string} who
 * @param {Record<string, string>} [colors]
 */
export function accessColor(who, colors) {
    if (colors && colors[who]) return colors[who];
    let h = 0;
    for (const ch of String(who)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return PALETTE[h % PALETTE.length];
}

/**
 * The places of the access rows in a workbook, made once (again when the rows or the workbook's shape change):
 *   at(s, r, c)   the rows touching that cell, as [{ who, color, rows: [index, ...] }], one entry per who, in the order of the rows
 *   rects(i, s)   the rectangles of row i on sheet s ({ r1, c1, r2, c2 }), for the outline of the selected row
 *   colorOf(i)    the colour of row i's who
 * @param {any} wb
 * @param {Array<{ who: string, where?: string|null }>} rows
 * @param {Record<string, string>} [colors]
 */
export function accessPlaces(wb, rows, colors) {
    // each row with a where, resolved on its own (as the cells' rules are), without its condition
    const places = (rows || []).map((row) => {
        if (!row || !row.where) return null;
        const w = parseWhere(row.where);
        return resolveRules(wb, [{ sheet: w.sheet || undefined, range: w.range || undefined, columns: w.columns || undefined, mode: 'edit' }]);
    });
    const touches = (i, s, r, c) => {
        const own = places[i];
        if (!own) return false;
        return own.some((rule) => rule.s === s && modeOf(wb, [rule], s, r, c, 0) !== null);
    };
    // the last filled row and column of each sheet, found once
    const extents = new Map();
    const extentOf = (s) => {
        if (!extents.has(s)) {
            let rows = -1, cols = -1;
            wb.forEachFilledRow(s, (r, cells) => {
                rows = Math.max(rows, r);
                for (const id of Object.keys(cells)) cols = Math.max(cols, wb.colIndex(s, id));
            });
            extents.set(s, { rows, cols });
        }
        return extents.get(s);
    };
    return {
        /** The colour of row i's who (null when there is no row i). */
        colorOf(i) { return rows && rows[i] ? accessColor(rows[i].who, colors) : null; },
        at(s, r, c) {
            const extent = extentOf(s);
            if (r > extent.rows || c > extent.cols) return [];
            const byWho = new Map();
            for (let i = 0; i < places.length; i++) {
                if (!touches(i, s, r, c)) continue;
                const who = rows[i].who;
                if (!byWho.has(who)) byWho.set(who, { who, color: accessColor(who, colors), rows: [] });
                byWho.get(who).rows.push(i);
            }
            return [...byWho.values()];
        },
        rects(i, s) {
            const own = places[i];
            if (!own) return [];
            const size = wb.size(s);
            const out = [];
            for (const rule of own) {
                if (rule.s !== s) continue;
                if (rule.corners) {
                    const r1 = wb.rowIndex(s, rule.corners.r1), r2 = wb.rowIndex(s, rule.corners.r2), c1 = wb.colIndex(s, rule.corners.c1), c2 = wb.colIndex(s, rule.corners.c2);
                    if (r1 >= 0 && r2 >= 0 && c1 >= 0 && c2 >= 0) out.push({ r1: Math.min(r1, r2), c1: Math.min(c1, c2), r2: Math.max(r1, r2), c2: Math.max(c1, c2) });
                } else if (rule.cols) {
                    // a rule by columns: each of its columns, from under the header row to the end of the sheet
                    const top = rule.headerRowId ? wb.rowIndex(s, rule.headerRowId) + 1 : 0;
                    for (const id of rule.cols) { const c = wb.colIndex(s, id); if (c >= 0) out.push({ r1: top, c1: c, r2: size.rows - 1, c2: c }); }
                } else {
                    out.push({ r1: 0, c1: 0, r2: size.rows - 1, c2: size.cols - 1 });
                }
            }
            return out;
        }
    };
}
