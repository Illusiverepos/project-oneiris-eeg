'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function unzip(buf) {
  const out = {};
  let i = 0;
  while (i < buf.length - 30) {
    if (buf.readUInt32LE(i) !== 0x04034b50) { i++; continue; }
    const comp = buf.readUInt16LE(i + 8);
    const flags = buf.readUInt16LE(i + 6);
    let csz = buf.readUInt32LE(i + 18);
    const nlen = buf.readUInt16LE(i + 26);
    const elen = buf.readUInt16LE(i + 28);
    const name = buf.toString('utf8', i + 30, i + 30 + nlen);
    const ds = i + 30 + nlen + elen;
    if (csz === 0 && (flags & 8)) {
      // Find next PK header
      let next = ds;
      while (next < buf.length - 4 && buf.readUInt32LE(next) !== 0x04034b50 && buf.readUInt32LE(next) !== 0x02014b50 && buf.readUInt32LE(next) !== 0x08074b50) next++;
      csz = next - ds;
    }
    if (csz > 0) {
      const raw = buf.subarray(ds, ds + csz);
      try { out[name] = (comp === 8 ? zlib.inflateRawSync(raw) : raw).toString('utf8'); } catch {}
    }
    i = ds + csz;
  }
  return out;
}

const dir = path.join(__dirname, 'data', 'dream_db', 'tononi_256ch', 'Tononi Serial Awakenings', 'Data', 'Reports');
for (const fn of ['Reports_S01.xlsx', 'Reports_S05.xlsx', 'Reports_S10.xlsx']) {
  const e = unzip(fs.readFileSync(path.join(dir, fn)));
  console.log('\n=== ' + fn + ' ===');
  const sheets = (e['xl/workbook.xml'] || '').match(/name="[^"]+"/g);
  console.log('Sheets:', sheets);
  const ss = (e['xl/sharedStrings.xml'] || '').match(/<t[^>]*>[^<]*<\/t>/g) || [];
  console.log('Unique strings:', ss.length);
  console.log('Longest strings:', ss.map((s) => s.replace(/<[^>]+>/g, '')).sort((a, b) => b.length - a.length).slice(0, 8));
}
