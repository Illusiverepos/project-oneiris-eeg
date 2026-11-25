'use strict';

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, 'data', 'dream_db', 'raw');

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const res = await fetch('https://api.figshare.com/v2/articles/22147085');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const art = await res.json();
  console.log(`Downloading LODE (22147085, ${art.files.length} files)...`);
  for (const f of art.files || []) {
    const dest = path.join(OUT_DIR, `22147085_${f.name}`);
    if (fs.existsSync(dest) && fs.statSync(dest).size === f.size) {
      console.log(`  Cached ${f.name}`);
      continue;
    }
    const fRes = await fetch(f.download_url);
    if (!fRes.ok) throw new Error(`HTTP ${fRes.status} for ${f.name}`);
    const buf = Buffer.from(await fRes.arrayBuffer());
    fs.writeFileSync(dest, buf);
    console.log(`  Saved ${path.basename(dest)} (${(buf.length / (1024 * 1024)).toFixed(2)} MB)`);
  }
}

main().catch((err) => { console.error(err.message); process.exit(1); });
