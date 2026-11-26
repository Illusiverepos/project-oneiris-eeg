'use strict';

/**
 * Project ONEIRIS — Lab #11 PCL-5 Sub-Audit: Nightmares (Item 2) & Insomnia (Item 20)
 *
 * Extracts individual DSM-5 PCL-5 items (Pre & Post) from `CI_raw-data-scores.xlsx`
 * (Du Bois et al., 2021/2022, Mendeley 10.17632/gsxphk87mc) and pairs them with
 * our 100% same-device Lab #11 EEG shifts (`lab11_mendeley_ptsd_eeg_results.json`):
 *   - Item 2:  "Repeated, disturbing dreams of the stressful experience" (Nightmares, 0-4)
 *   - Item 20: "Trouble falling or staying asleep" (Insomnia, 0-4)
 *   - Cluster B (Items 1-5: Intrusion) & Cluster E (Items 15-20: Hyperarousal)
 *
 * Output: reanalysis/data/lab11_pcl5_nightmares_insomnia_results.json
 */

const fs = require('fs');
const path = require('path');

const TMP_DIR = path.join(__dirname, 'data', 'mendeley_ptsd', 'extracted', '_xlsx_tmp');
const EEG_JSON = path.join(__dirname, 'data', 'lab11_mendeley_ptsd_eeg_results.json');
const OUT_PATH = path.join(__dirname, 'data', 'lab11_pcl5_nightmares_insomnia_results.json');

function colToIdx(col) {
  let n = 0;
  for (let i = 0; i < col.length; i++) n = n * 26 + (col.charCodeAt(i) - 64);
  return n;
}
function idxToCol(n) {
  let s = '';
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

function erfc(x) {
  const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
    t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}

function pairedStats(diffs) {
  const n = diffs.length;
  const mean = diffs.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(diffs.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1)) || 1e-9;
  const t = mean / (sd / Math.sqrt(n));
  return { n, mean: +mean.toFixed(3), dz: +(mean / sd).toFixed(3), t: +t.toFixed(3), pApprox: +erfc(Math.abs(t) / Math.SQRT2).toFixed(4) };
}

function spearman(xs, ys) {
  const rank = (arr) => {
    const sorted = arr.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
    const r = new Array(arr.length);
    for (let i = 0; i < sorted.length; ) {
      let j = i;
      while (j + 1 < sorted.length && sorted[j + 1][0] === sorted[i][0]) j++;
      const avgR = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) r[sorted[k][1]] = avgR;
      i = j + 1;
    }
    return r;
  };
  const rx = rank(xs), ry = rank(ys), n = xs.length;
  const mx = rx.reduce((a, b) => a + b, 0) / n, my = ry.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) { num += (rx[i] - mx) * (ry[i] - my); dx += (rx[i] - mx) ** 2; dy += (ry[i] - my) ** 2; }
  const rho = num / Math.sqrt(dx * dy);
  const t = rho * Math.sqrt((n - 2) / Math.max(1e-9, 1 - rho * rho));
  return { n, rho: +rho.toFixed(3), pApprox: +erfc(Math.abs(t) / Math.SQRT2).toFixed(4) };
}

function main() {
  const ss = fs.readFileSync(path.join(TMP_DIR, 'xl', 'sharedStrings.xml'), 'utf8');
  const strs = [...ss.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join('')
  );
  const xml = fs.readFileSync(path.join(TMP_DIR, 'xl', 'worksheets', 'sheet1.xml'), 'utf8');
  const rows = new Map();
  for (const rm of xml.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = {};
    for (const cm of rm[2].matchAll(/<c r="([A-Z]+)\d+"([^>]*)>([\s\S]*?)<\/c>/g)) {
      const vm = cm[3].match(/<v>([^<]*)<\/v>/);
      if (vm) cells[cm[1]] = /t="s"/.test(cm[2]) ? strs[Number(vm[1])] : Number(vm[1]);
    }
    rows.set(Number(rm[1]), cells);
  }

  // Locate PRE & POST PCL-5 blocks in row 3 by finding 'Item 20' followed by 'TOTAL' where P16 (row 31) = 61 (Pre) and 6 (Post)
  const r3 = rows.get(3) || {};
  const p16 = rows.get(31) || {};
  const pclBlocks = [];
  for (const [col, val] of Object.entries(r3)) {
    if (String(val).trim() === 'Item 20') {
      const i20 = colToIdx(col);
      const totCol = idxToCol(i20 + 1);
      if (String(r3[totCol] || '').trim() === 'TOTAL') {
        const i1 = i20 - 19;
        pclBlocks.push({ startIdx: i1, endIdx: i20, totCol, p16Total: p16[totCol] });
      }
    }
  }
  const preBlock = pclBlocks.find((b) => b.p16Total === 61);
  const postBlock = pclBlocks.find((b) => b.p16Total === 6);
  if (!preBlock || !postBlock) {
    console.error('Could not locate Pre/Post PCL-5 blocks. Found:', pclBlocks);
    process.exit(1);
  }

  const extractItems = (rowCells, block) => {
    const items = [];
    for (let k = 0; k < 20; k++) items.push(Number(rowCells[idxToCol(block.startIdx + k)] || 0));
    return {
      items,
      item2_nightmares: items[1],
      item20_insomnia: items[19],
      clusterB_intrusion: items.slice(0, 5).reduce((a, b) => a + b, 0),
      clusterE_hyperarousal: items.slice(14, 20).reduce((a, b) => a + b, 0),
      total: Number(rowCells[block.totCol] || items.reduce((a, b) => a + b, 0)),
    };
  };

  const groups = { Control: [], MI: [], NF: [] };
  const byPid = new Map();
  for (const [rn, cells] of rows.entries()) {
    const pid = String(cells.A || '').trim();
    if (!/^P\d{2}$/.test(pid)) continue;
    const grp = rn <= 12 ? 'Control' : rn <= 26 ? 'MI' : 'NF';
    const pre = extractItems(cells, preBlock);
    const post = extractItems(cells, postBlock);
    const rec = {
      pid, group: grp,
      preNightmare: pre.item2_nightmares, postNightmare: post.item2_nightmares, dropNightmare: pre.item2_nightmares - post.item2_nightmares,
      preInsomnia: pre.item20_insomnia, postInsomnia: post.item20_insomnia, dropInsomnia: pre.item20_insomnia - post.item20_insomnia,
      preClusterB: pre.clusterB_intrusion, postClusterB: post.clusterB_intrusion, dropClusterB: pre.clusterB_intrusion - post.clusterB_intrusion,
      preClusterE: pre.clusterE_hyperarousal, postClusterE: post.clusterE_hyperarousal, dropClusterE: pre.clusterE_hyperarousal - post.clusterE_hyperarousal,
      preTotal: pre.total, postTotal: post.total, dropTotal: pre.total - post.total,
    };
    groups[grp].push(rec);
    byPid.set(pid, rec);
  }

  const summary = {};
  for (const [g, list] of Object.entries(groups)) {
    const avg = (k) => +(list.reduce((a, x) => a + x[k], 0) / list.length).toFixed(2);
    summary[g] = {
      n: list.length,
      nightmare_Pre: avg('preNightmare'), nightmare_Post: avg('postNightmare'),
      nightmare_Drop: pairedStats(list.map((x) => x.dropNightmare)),
      nightmare_ZeroPost: list.filter((x) => x.postNightmare === 0).length,
      insomnia_Pre: avg('preInsomnia'), insomnia_Post: avg('postInsomnia'),
      insomnia_Drop: pairedStats(list.map((x) => x.dropInsomnia)),
      insomnia_ZeroPost: list.filter((x) => x.postInsomnia === 0).length,
      clusterB_Drop: pairedStats(list.map((x) => x.dropClusterB)),
      clusterE_Drop: pairedStats(list.map((x) => x.dropClusterE)),
    };
  }

  // Pair with Lab #11 EEG results (n = 20)
  const eeg = JSON.parse(fs.readFileSync(EEG_JSON, 'utf8'));
  const paired = eeg.subjects.map((s) => ({ ...s, ...byPid.get(s.pid) }));
  const corrs = {
    dRFSlope_vs_dropNightmare: spearman(paired.map((x) => x.dRFSlope), paired.map((x) => x.dropNightmare)),
    dRFSlope_vs_dropInsomnia: spearman(paired.map((x) => x.dRFSlope), paired.map((x) => x.dropInsomnia)),
    dRFSlope_vs_dropClusterE: spearman(paired.map((x) => x.dRFSlope), paired.map((x) => x.dropClusterE)),
    dPostSlope_vs_dropNightmare: spearman(paired.map((x) => x.dPostSlope), paired.map((x) => x.dropNightmare)),
  };

  const out = { generatedAt: new Date().toISOString(), preBlock, postBlock, summary, brainSleepCorrelations: corrs, participants: [...byPid.values()] };
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));

  console.log('=== LAB #11 PCL-5 NIGHTMARES (ITEM 2) & INSOMNIA (ITEM 20) — PRE TO POST ===');
  for (const [g, s] of Object.entries(summary)) {
    console.log(`\n[${g}, n=${s.n}]`);
    console.log(`  Nightmares (Item 2, 0-4): ${s.nightmare_Pre} -> ${s.nightmare_Post} | Drop=${s.nightmare_Drop.mean} (dz=${s.nightmare_Drop.dz}, p=${s.nightmare_Drop.pApprox}) | Resolved to 0: ${s.nightmare_ZeroPost}/${s.n}`);
    console.log(`  Insomnia   (Item 20,0-4): ${s.insomnia_Pre} -> ${s.insomnia_Post} | Drop=${s.insomnia_Drop.mean} (dz=${s.insomnia_Drop.dz}, p=${s.insomnia_Drop.pApprox}) | Resolved to 0: ${s.insomnia_ZeroPost}/${s.n}`);
    console.log(`  Intrusion Cluster B Drop: ${s.clusterB_Drop.mean} (dz=${s.clusterB_Drop.dz}, p=${s.clusterB_Drop.pApprox})`);
    console.log(`  Hyperarousal Clust E Drop:${s.clusterE_Drop.mean} (dz=${s.clusterE_Drop.dz}, p=${s.clusterE_Drop.pApprox})`);
  }
  console.log('\n=== BRAIN-SLEEP CORRELATIONS (n=20) ===');
  console.table(corrs);
  console.log(`\nSaved -> ${OUT_PATH}`);
}

main();
