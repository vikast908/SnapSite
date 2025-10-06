// Renders assets/logo.svg to assets/icons/{16,32,48,128}.png
// Usage: node tools/build-icons.js

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function main(){
  const root = process.cwd();
  const src = path.join(root, 'assets', 'logo.svg');
  const svgBuf = fs.readFileSync(src);
  const svg = svgBuf.toString('utf8');
  const svgLight = svg.replace(/currentColor/gi, '#0f172a');
  const svgDark = svg.replace(/currentColor/gi, '#ffffff');
  const outDir = path.join(root, 'assets', 'icons');
  const outDirDark = path.join(root, 'assets', 'icons-dark');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  if (!fs.existsSync(outDirDark)) fs.mkdirSync(outDirDark, { recursive: true });
  const sizes = [16, 32, 48, 128];
  for (const size of sizes){
    const out = path.join(outDir, `${size}.png`);
    await sharp(Buffer.from(svgLight)).resize(size, size, { fit: 'contain', background: { r:0, g:0, b:0, alpha:0 } }).png({ progressive:true }).toFile(out);
    console.log('Wrote', out);
    const outDark = path.join(outDirDark, `${size}.png`);
    await sharp(Buffer.from(svgDark)).resize(size, size, { fit: 'contain', background: { r:0, g:0, b:0, alpha:0 } }).png({ progressive:true }).toFile(outDark);
    console.log('Wrote', outDark);
  }
}

main().catch((e)=>{ console.error(e); process.exit(1); });
