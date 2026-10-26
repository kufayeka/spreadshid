// Opens a page of the sheet in headless Chrome (the CDP testkit of the Nexa dashboard, next to this package) with real mouse and keyboard input.
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveExample } from '../example/serve.js';

const require = createRequire(import.meta.url);
const CDP = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'node-red-nexa-dashboard', 'sdk', 'testkit', 'cdp.js');

/** Whether Chrome tests can run here (the testkit is next to this package). */
export const chromeAvailable = () => existsSync(CDP);

/**
 * Runs `fn` with a page open at 1366 x 768. `fn` gets `js(expr)`, `send(method, params)` and real input: `mouse`, `click`, `type`, `key`.
 * @param {(page: any) => Promise<void>} fn
 * @param {string} [entry] The page script under example/ (main.js is the example).
 */
export async function withExample(fn, entry = 'main.js') {
    const { withPage } = require(CDP);
    const server = await serveExample(0, entry);
    try {
        await withPage('http://127.0.0.1:' + server.port + '/', async (page) => {
            await page.send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });
            const wait = (ms) => new Promise((r) => setTimeout(r, ms));
            const mouse = (type, x, y, extra) => page.send('Input.dispatchMouseEvent', Object.assign({ type, x, y, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1 }, extra));
            const click = async (x, y, extra) => { await mouse('mouseMoved', x, y); await mouse('mousePressed', x, y, extra); await mouse('mouseReleased', x, y, extra); await wait(60); };
            const type = async (text) => { for (const ch of text) await page.send('Input.dispatchKeyEvent', { type: 'char', text: ch }); await wait(40); };
            const key = async (k, code, keyCode, modifiers = 0) => {
                await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: k, code, windowsVirtualKeyCode: keyCode, modifiers });
                await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: keyCode, modifiers });
                await wait(40);
            };
            await wait(800);
            await fn(Object.assign({}, page, { wait, mouse, click, type, key }));
        });
    } finally {
        await server.close();
    }
}
