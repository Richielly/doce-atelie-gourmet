const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const files = new Set(JSON.parse(require('node:fs').readFileSync(path.join(root,'assets.json'),'utf8')));
const port = Number(process.env.PORT || 6002);
if (!Number.isInteger(port) || port < 6001 || port > 6010) throw Error('A porta deve estar entre 6001 e 6010.');
const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const file = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (!files.has(file)) { res.writeHead(404); res.end('Não encontrado'); return; }
  try {
    const source=file==='barcode-reader.js'?'node_modules/zxing-wasm/dist/iife/reader/index.js':file==='barcode-engine.wasm'?'node_modules/zxing-wasm/dist/reader/zxing_reader.wasm':file==='qr-reader.js'?'node_modules/jsqr/dist/jsQR.js':file==='qr-generator.js'?'node_modules/qrcode-generator/qrcode.js':file;
    const data = file === 'version.js' ? 'window.DOCE_BUILD=' + await fs.readFile(path.join(root, 'release.json'), 'utf8') + ';' : await fs.readFile(path.join(root,source));
    res.writeHead(200, { 'Content-Type': file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.css')?'text/css; charset=utf-8':file.endsWith('.wasm')?'application/wasm':'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(data);
  } catch (error) { console.error(error.message); res.writeHead(500); res.end('Erro ao ler arquivo'); }
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`Doce Ateliê: http://localhost:${port} — Ctrl+C para parar. Recarregue a página após editar.`));
