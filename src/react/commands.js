// What the right-click menu and the menu bar both do, written once.

import { clipText, pasteClip, pasteText } from '../core/transfer.js';

// The last copy made in this page. A page can read the clipboard's text, not the formulas a copy put there, so when the text is the one this copy put
// in the clipboard, the copy itself is pasted (formulas and styles included).
let lastCopy = null;

/** The grid made a copy (Ctrl+C, Ctrl+X, the menus). */
export function rememberCopy(clip) { lastCopy = clip; }

/** The cut was pasted: it is not pasted again as a cut. */
export function forgetCut() { if (lastCopy && lastCopy.cut) lastCopy = null; }

/**
 * Paste from a menu (Ctrl+V needs none of this: the browser gives the clipboard to the paste event). The browser asks the person, the first time, to let
 * the page read the clipboard; a refusal is an error the caller says.
 * @param {'all'|'values'|'styles'} only
 * @returns {Promise<{ landed: object, cut: boolean }>}
 */
export async function pasteFromClipboard(wb, s, rect, only) {
    let text;
    try { text = await navigator.clipboard.readText(); } catch { throw new Error('The browser does not let the page read the clipboard: use Ctrl+V to paste.'); }
    if (lastCopy && text === clipText(lastCopy)) {
        const cut = lastCopy.cut;
        const landed = pasteClip(wb, s, rect, lastCopy, only);
        if (cut) lastCopy = null;
        return { landed, cut };
    }
    if (only === 'styles') return { landed: rect, cut: false }; // text from elsewhere has no format to paste
    return { landed: text ? pasteText(wb, s, rect, text) : rect, cut: false };
}
