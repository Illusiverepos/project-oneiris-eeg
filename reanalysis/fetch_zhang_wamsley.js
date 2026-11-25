'use strict';

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, 'data', 'dream_db', 'raw');

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const res = await fetch('https://api.figshare.com/v2/articles/22226692');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const art = await res.json();
  console.log(`Downloading Zhang & Wamsley 2019 (22226692, ${art.files.length} files)...`);
  for (const f of art.files || []) {
    const dest = path.join(OUT_DIR, `22226692_${f.name}`);
    if (fs.existsSync(dest) && fs.statSync(dest).size === f.size) {
      console.log(`  Cached ${f.name}`);
      continue;
    }
    const fRes = await fetch(f.download_url);
    if (!fRes.ok) throw new Error(`HTTP ${fRes.status} for ${f.name}`);
    const outStream = fs.createWriteStream(dest);
    const reader = fRes.body.getReader();
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      outStream.write(Buffer.from(value));
      received += value.length;
    }
    await new Promise((r) => outStream.end(r));
    console.log(`  Saved ${path.basename(dest)} (${(received / (1024 * 1024)).toFixed(1)} MB)`);
  }
}

main().catch((err) => { console.error(err.message); process.exit(1); });
