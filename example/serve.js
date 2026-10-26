// Builds the example page and serves the package folder: node example/serve.js [port]. Used by hand and by the tests in Chrome (port 0 = any free port).
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.map': 'application/json', '.json': 'application/json' };

/**
 * Builds the example and starts the server.
 * @param {number} [port] 0 takes any free port.
 * @param {string} [entry] The page script to build, relative to example/ (the tests build their own pages).
 * @returns {Promise<{ port: number, close: () => Promise<void> }>}
 */
export async function serveExample(port = 0, entry = 'main.js') {
    // The example takes React from the devDependencies of the package, bundled in, so the page needs nothing else.
    await build({ entryPoints: [join(root, 'example', entry)], outfile: join(root, 'example', 'dist', 'main.js'), bundle: true, format: 'esm',
        jsx: 'automatic', loader: { '.js': 'jsx' }, sourcemap: true, define: { 'process.env.NODE_ENV': '"development"' } });
    const server = createServer(async (req, res) => {
        const path = decodeURIComponent(req.url.split('?')[0]);
        const file = normalize(join(root, path === '/' ? 'example/index.html' : path));
        if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
        try {
            const body = await readFile(file);
            res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' }).end(body);
        } catch {
            res.writeHead(404).end('not found');
        }
    });
    await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
    return { port: server.address().port, close: () => new Promise((resolve) => server.close(resolve)) };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    const { port } = await serveExample(Number(process.argv[2]) || 5180);
    console.log('the example is at http://127.0.0.1:' + port + '/');
}
