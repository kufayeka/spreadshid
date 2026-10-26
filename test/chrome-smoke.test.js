// The example page shows the sheet, filling its box, in a real Chrome.
//   node test/chrome-smoke.test.js     (needs a build and Chrome)
import { chromeAvailable, withExample } from './chrome.js';

if (!chromeAvailable()) { console.log('SKIP: the CDP testkit of the Nexa dashboard is not next to this package'); process.exit(0); }
let failures = 0;
const check = (label, ok, actual) => { if (!ok) failures++; console.log((ok ? 'ok   ' : 'FAIL ') + label + (!ok && actual !== undefined ? '   ' + JSON.stringify(actual) : '')); };

await withExample(async ({ js }) => {
    const box = await js('(function(){ var e = document.querySelector(".ks-sheet"); if (!e) return null; var r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; })()');
    check('the sheet is on the page', !!box, box);
    check('and it fills the window less the 16 px margins', !!box && box.w === 1366 - 32 && box.h === 768 - 32, box);
});
console.log(failures ? '\n' + failures + ' FAILED' : '\nALL OK');
process.exit(failures ? 1 : 0);
