'use strict';

/**
 * 1. Fetches the FULL English DreamBank corpus from Hugging Face Datasets Server
 *    (`DReAMy-lib/DreamBank-dreams-en`, ~22k reports) using bounded concurrency.
 * 2. Queries Figshare API for `TWC_USA` (DOI 10.6084/m9.figshare.22106123, Konkoly et al. 2021)
 *    and downloads lightweight (<15 MB) CSV/TSV/TXT/JSON/README files for ECHO analysis.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const TWC_DIR = path.join(DATA_DIR, 'twc_usa');
const HF_SIZE_URL = 'https://datasets-server.huggingface.co/size?dataset=DReAMy-lib%2FDreamBank-dreams-en';
const HF_ROWS_URL = 'https://datasets-server.huggingface.co/rows?dataset=DReAMy-lib%2FDreamBank-dreams-en&config=default&split=train';
const FIGSHARE_API = 'https://api.figshare.com/v2/articles/22106123';

async function fetchJsonWithRetry(url, retries = 4) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 429 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.json();
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 800 * attempt));
    }
  }
}

async function downloadFullDreamBank() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const sizeInfo = await fetchJsonWithRetry(HF_SIZE_URL);
  const totalRows = sizeInfo?.size?.splits?.[0]?.num_rows || 22415;
  console.log(`DreamBank total rows reported by HF: ${totalRows}`);

  const pageSize = 100;
  const offsets = [];
  for (let off = 0; off < totalRows; off += pageSize) offsets.push(off);

  const pages = new Map();
  let nextIdx = 0;
  const concurrency = 6;

  async function worker() {
    while (nextIdx < offsets.length) {
      const myIdx = nextIdx++;
      const off = offsets[myIdx];
      const json = await fetchJsonWithRetry(`${HF_ROWS_URL}&offset=${off}&length=${pageSize}`);
      pages.set(off, (json.rows || []).map((r) => JSON.stringify(r.row)));
      if (pages.size % 30 === 0 || pages.size === offsets.length) {
        console.log(`DreamBank progress: ${pages.size}/${offsets.length} pages`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  const outPath = path.join(DATA_DIR, 'dreambank_full.jsonl');
  const stream = fs.createWriteStream(outPath, { encoding: 'utf8' });
  let count = 0;
  for (const off of offsets) {
    const rows = pages.get(off) || [];
    for (const line of rows) {
      stream.write(line + '\n');
      count++;
    }
  }
  await new Promise((resolve) => stream.end(resolve));
  console.log(`Saved FULL DreamBank (${count} reports) -> ${outPath}`);
}

async function downloadTwcUsa() {
  fs.mkdirSync(TWC_DIR, { recursive: true });
  const meta = await fetchJsonWithRetry(FIGSHARE_API);
  fs.writeFileSync(path.join(TWC_DIR, 'figshare_metadata.json'), JSON.stringify(meta, null, 2));
  const files = meta.files || [];
  console.log(`TWC_USA Figshare article "${meta.title}" lists ${files.length} files.`);

  const downloaded = [];
  for (const f of files) {
    const ext = path.extname(f.name).toLowerCase();
    const isLight = f.size <= 15 * 1024 * 1024;
    const isTextOrTable = ['.csv', '.tsv', '.txt', '.json', '.md', '.xlsx', '.pdf'].includes(ext);
    if (isLight && isTextOrTable) {
      const res = await fetch(f.download_url);
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        const dest = path.join(TWC_DIR, f.name);
        fs.writeFileSync(dest, buf);
        downloaded.push({ name: f.name, size: f.size });
        console.log(`  Downloaded TWC_USA file: ${f.name} (${f.size} bytes)`);
      }
    }
  }
  fs.writeFileSync(path.join(TWC_DIR, 'downloaded_index.json'), JSON.stringify({
    title: meta.title,
    doi: meta.doi,
    totalFilesOnFigshare: files.length,
    fileInventory: files.map((f) => ({ name: f.name, size: f.size })),
    downloaded,
  }, null, 2));
}

async function main() {
  await downloadFullDreamBank();
  await downloadTwcUsa();
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
