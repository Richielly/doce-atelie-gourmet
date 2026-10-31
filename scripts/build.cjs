const fs = require('node:fs/promises');
const path = require('node:path');
async function build() {
  const root = path.resolve(__dirname, '..');
  await fs.mkdir(path.join(root, 'dist'), { recursive: true });
  const assets=JSON.parse(await fs.readFile(path.join(root,'assets.json'),'utf8'));
  for (const file of assets) {
    const source=file==='barcode-reader.js'?'node_modules/zxing-wasm/dist/iife/reader/index.js':file==='barcode-engine.wasm'?'node_modules/zxing-wasm/dist/reader/zxing_reader.wasm':file==='qr-reader.js'?'node_modules/jsqr/dist/jsQR.js':file==='qr-generator.js'?'node_modules/qrcode-generator/qrcode.js':file;
    await fs.copyFile(path.join(root,source), path.join(root, 'dist', file));
  }
  for(const legacy of ['admin-sync.js','product-publish.js','publish-page.js'])await fs.rm(path.join(root,'dist',legacy),{force:true});
  await fs.copyFile(path.join(root,'assets.json'),path.join(root,'dist','assets.json'));
  const release = JSON.parse(await fs.readFile(path.join(root, 'release.json'), 'utf8'));
  if (!/^\d+\.\d+\.\d+$/.test(release.version) || !Number.isSafeInteger(release.code) || release.code < 1) throw Error('release.json inválido');
  await fs.writeFile(path.join(root, 'dist', 'version.js'), 'window.DOCE_BUILD=' + JSON.stringify(release) + ';\n');
  await fs.copyFile(path.join(root, 'release.json'), path.join(root, 'dist', 'release.json'));
  let firebase=false;try{await fs.access(path.resolve(root,'../.private/firebase/google-services.json'));firebase=true;}catch{}
  await fs.writeFile(path.join(root,'dist','notification-build.js'),'window.DOCE_PUSH_BUILD='+JSON.stringify({firebase})+';\n');
  console.log('Arquivos web preparados em dist/ para o Capacitor.');
}
build().catch(error => { console.error(error); process.exitCode = 1; });
