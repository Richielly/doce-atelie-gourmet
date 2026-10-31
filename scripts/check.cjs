const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
for (const file of JSON.parse(fs.readFileSync(path.join(root,'assets.json'),'utf8')).filter(f=>f.endsWith('.html')||f.endsWith('.js')).filter(f=>!['qr-reader.js','qr-generator.js','barcode-reader.js'].includes(f))) {
  const source=fs.readFileSync(path.join(root,file),'utf8');
  const scripts=file.endsWith('.html') ? [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]) : [source];
  for (const script of scripts) {
    const result=spawnSync(process.execPath,['--check','--input-type=module'],{input:script,encoding:'utf8'});
    if(result.status!==0){console.error(file, result.stderr);process.exit(1);}
  }
}
console.log('OK: sintaxe dos clientes e scripts de administração.');
