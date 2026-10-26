// The order of sheets, columns and rows, kept as keys that sort as text ("fractional indexing"). A row put between two others gets a key between theirs, so
// no other row is numbered again: inserting one row in a sheet of 100 000 writes one row, and two people inserting at the same time do not move each other.
//
// A key is a string of the 62 digits below, and never ends in "0" (a key that ended in "0" would have no room left below it).

const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const BASE = DIGITS.length;

/**
 * A key that sorts after `a` and before `b`.
 * @param {string|null} a The key before, or null (or "") for "at the start".
 * @param {string|null} b The key after, or null for "at the end".
 * @returns {string}
 */
export function keyBetween(a, b) {
    const lo = a || '';
    if (b !== null && b !== undefined && !(lo < b)) throw new Error('keyBetween: "' + lo + '" is not before "' + b + '"');
    return midpoint(lo, b === undefined ? null : b);
}

// The classic midpoint of two digit strings read as fractions (0.a and 0.b), the shortest one that fits between them.
function midpoint(a, b) {
    if (b !== null) {
        // the digits that a and b share stay as they are; the middle is found after them
        let n = 0;
        while ((a[n] || '0') === b[n]) n++;
        if (n > 0) return b.slice(0, n) + midpoint(a.slice(n), b.slice(n));
    }
    const da = a ? DIGITS.indexOf(a[0]) : 0;
    const db = b !== null ? DIGITS.indexOf(b[0]) : BASE;
    if (db - da > 1) return DIGITS[Math.round((da + db) / 2)];
    // the first digits are next to each other: take the first digit of b if b goes on after it, else go one digit deeper after a
    if (b !== null && b.length > 1) return b.slice(0, 1);
    return DIGITS[da] + midpoint(a.slice(1), null);
}

/**
 * `n` keys in order, all between `a` and `b`. They are spread evenly (by halving), so their length grows with the logarithm of n: 100 000 keys are a few
 * characters each, where adding them one after the other would make them longer and longer.
 * @param {string|null} a
 * @param {string|null} b
 * @param {number} n
 * @returns {string[]}
 */
export function keysBetween(a, b, n) {
    const out = new Array(n);
    // the middle key first, then the halves on each side of it; an explicit stack keeps deep halving off the call stack
    const stack = [[a || '', b === undefined ? null : b, 0, n]];
    while (stack.length) {
        const [lo, hi, from, count] = stack.pop();
        if (count <= 0) continue;
        const mid = from + (count >> 1);
        const key = keyBetween(lo, hi);
        out[mid] = key;
        stack.push([lo, key, from, mid - from]);
        stack.push([key, hi, mid + 1, from + count - mid - 1]);
    }
    return out;
}

/** Compares two keys for Array.prototype.sort (plain code-unit order, the same order PostgreSQL gives with COLLATE "C"). */
export const compareKeys = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
