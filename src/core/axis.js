// The sizes along one side of a sheet (the heights of the rows, or the widths of the columns), made into positions: where row r starts, and which row is
// at a given pixel. The positions are kept in one array of running sums, so both questions are answered at once in a sheet of 100 000 rows (the second by
// a binary search), and the array is made again only when a size changes.

/**
 * @param {number} count  How many rows (or columns).
 * @param {(i: number) => number} sizeAt  The size of number i in pixels (0 when it is hidden).
 */
export function createAxis(count, sizeAt) {
    const starts = new Float64Array(count + 1);
    for (let i = 0; i < count; i++) starts[i + 1] = starts[i] + sizeAt(i);
    return {
        count,
        /** The whole length. */
        total: starts[count],
        /** Where number i starts (i = count: the end). */
        start: (i) => starts[Math.max(0, Math.min(count, i))],
        /** The size of number i. */
        size: (i) => (i < 0 || i >= count ? 0 : starts[i + 1] - starts[i]),
        /** The number at pixel `px` (the last one for a pixel past the end, the first for one before the start). */
        indexAt(px) {
            if (count === 0) return 0;
            if (px <= 0) return 0;
            if (px >= starts[count]) return count - 1;
            let lo = 0, hi = count - 1;
            while (lo < hi) {
                const mid = (lo + hi + 1) >> 1;
                if (starts[mid] <= px) lo = mid; else hi = mid - 1;
            }
            // a hidden one has no size: the pixel belongs to the next one that shows
            while (lo < count - 1 && starts[lo + 1] === starts[lo]) lo++;
            return lo;
        }
    };
}
