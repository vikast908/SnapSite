// Renders assets/logo.svg to assets/icons/{16,32,48,128}.png
// Usage: node tools/build-icons.js

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function main(){
  const root = process.cwd();
  const src = path.join(root, 'assets', 'logo.svg');
  const svg = fs.readFileSync(src);
  const outDir = path.join(root, 'assets', 'icons');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const sizes = [16, 32, 48, 128];
  for (const size of sizes){
    const out = path.join(outDir, `${size}.png`);
    await sharp(svg).resize(size, size, { fit: 'contain', background: { r:0, g:0, b:0, alpha:0 } }).png({ progressive:true }).toFile(out);
    console.log('Wrote', out);
  }
}

main().catch((e)=>{ console.error(e); process.exit(1); });

