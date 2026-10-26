// The ids of sheets, columns and rows. They are UUIDs made where the thing is made (in the browser, before anything is saved), so a new row already has the
// id it keeps in the database: a comment or a formula can point at it at once, and two people who add rows at the same time can never make the same id.

/** A new id (a version 4 UUID). */
export function newId() {
    const c = globalThis.crypto;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
    // Older browsers have getRandomValues without randomUUID: the same UUID, put together by hand.
    const b = new Uint8Array(16);
    if (c && typeof c.getRandomValues === 'function') c.getRandomValues(b);
    else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
}
