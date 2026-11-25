'use strict';

/**
 * Downloads 3 compact packages from Monash Bridges / Figshare DREAM Database:
 *   - 22133105: The DREAM database (master metadata, 0.6 MB)
 *   - 14899506: DeGennaro_YoungAdults (35.1 MB)
 *   - 22210684: Oudiette_N1Data (41.3 MB)
 */

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, 'data', 'dream_db', 'raw');
const ARTICLE_IDS = [22133105, 14899506, 22210684];

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const id of ARTICLE_IDS) {
    const res = await fetch(`https://api.figshare.com/v2/articles/${id}`);
    if (!res.ok) throw new Error(`HTTP ${res.status} for article ${id}`);
    const art = await res.json();
    console.log(`Downloading article ${id} ("${art.title}")...`);
    for (const f of art.files || []) {
      const dest = path.join(OUT_DIR, `${id}_${f.name}`);
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
  console.log('Done downloading DREAM Database subsets.');
}

main().catch((err) => { console.error(err.message); process.exit(1); });
