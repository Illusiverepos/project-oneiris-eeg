'use strict';

/**
 * Project ONEIRIS — Lab #43: Left-vs-Right Hemispheric `brainNonlin` Asymmetry
 * across Clinical AD (n=36), FTD (n=23), Healthy Controls (n=29) [ds004504, N=88]
 * AND Pre-Symptomatic PSEN1-E280A AD Carriers (n=22) vs. Non-Carriers (n=21) [ds007427, N=43].
 *
 * Tests whether re-introducing the Left-vs-Right hemispheric asymmetry axis from Papers 1–3
 * (dropped in Papers 5–9 when Fp1 and Fp2 were averaged) reveals hidden lateralized nonlinear
 * phase breakdown and improves AD vs. FTD vs. PSEN1 vs. CN differential separation!
 *
 * Output: reanalysis/data/lab43_hemispheric_nonlin_asymmetry_results.json
 */

const fs = require('fs');
const path = require('path');
const { windowMetrics } = require('../toolkit/cueing-system/closed_loop_engine.js');

const OUT_PATH = path.join(__dirname, 'data', 'lab43_hemispheric_nonlin_asymmetry_results.json');
const S3_4504 = 'https://s3.amazonaws.com/openneuro.org/ds004504/';
const S3_BASE = 'https://s3.amazonaws.com/openneuro.org/';
const WIN_SEC = 60;

function fft(re, im, inverse = false) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let j = 0; j < len / 2; j++) {
        const ur = re[i + j], ui = im[i + j];
        const vr = re[i + j + len / 2] * cr - im[i + j + len / 2] * ci;
        const vi = re[i + j + len / 2] * ci + im[i + j + len / 2] * cr;
        re[i + j] = ur + vr; im[i + j] = ui + vi;
        re[i + j + len / 2] = ur - vr; im[i + j + len / 2] = ui - vi;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}

function phaseRand(sig, seedVal) {
  let n = 1; while (n * 2 <= sig.length) n <<= 1;
  const re = new Float64Array(n), im = new Float64Array(n);
  let m = 0; for (let i = 0; i < n; i++) m += sig[i]; m /= n;
  for (let i = 0; i < n; i++) re[i] = sig[i] - m;
  fft(re, im, false);
  let seed = (seedVal >>> 0) || 1234567;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let k = 1; k < n / 2; k++) {
    const mag = Math.hypot(re[k], im[k]), phi = 2 * Math.PI * rand();
    re[k] = mag * Math.cos(phi); im[k] = mag * Math.sin(phi);
    re[n - k] = re[k]; im[n - k] = -im[k];
  }
  im[0] = 0; im[n / 2] = 0;
  fft(re, im, true);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = re[i] + m;
  return out;
}

function scoreSingleCh(sig, sfreq, seedVal) {
  const surr = phaseRand(sig, seedVal);
  const winN = Math.round(2 * sfreq);
  let rSlope = 0, rDfa = 0, rWk = 0, sWk = 0, cnt = 0;
  for (let s = 0; s + winN <= surr.length; s += winN) {
    const rm = windowMetrics(sig.subarray(s, s + winN), sfreq, 256);
    const sm = windowMetrics(surr.subarray(s, s + winN), sfreq, 256);
    if (!Number.isFinite(rm.slopeBB) || !Number.isFinite(rm.dfa) || !Number.isFinite(sm.slopeBB) || !Number.isFinite(sm.dfa)) continue;
    rSlope += rm.slopeBB;
    rDfa += rm.dfa;
    rWk += rm.slopeBB + (2 * rm.dfa - 1);
    sWk += sm.slopeBB + (2 * sm.dfa - 1);
    cnt++;
  }
  if (!cnt) return null;
  const realWK = rWk / cnt, surrWK = sWk / cnt;
  return {
    slope: rSlope / cnt,
    dfa: rDfa / cnt,
    realWK,
    surrWK,
    nonlin: realWK - surrWK,
  };
}

function combineLR(L, R) {
  return {
    slopeL: +L.slope.toFixed(4), slopeR: +R.slope.toFixed(4),
    slopeBi: +(0.5 * (L.slope + R.slope)).toFixed(4),
    dfaBi: +(0.5 * (L.dfa + R.dfa)).toFixed(4),
    realWKBi: +(0.5 * (L.realWK + R.realWK)).toFixed(4),
    surrWKBi: +(0.5 * (L.surrWK + R.surrWK)).toFixed(4),
    nonlinL: +L.nonlin.toFixed(4), nonlinR: +R.nonlin.toFixed(4),
    nonlinBi: +(0.5 * (L.nonlin + R.nonlin)).toFixed(4),
    signedAsymNonlin: +(R.nonlin - L.nonlin).toFixed(4),
    absAsymNonlin: +Math.abs(R.nonlin - L.nonlin).toFixed(4),
    signedAsymSlope: +(R.slope - L.slope).toFixed(4),
    absAsymSlope: +Math.abs(R.slope - L.slope).toFixed(4),
    signedAsymWK: +(R.realWK - L.realWK).toFixed(4),
    absAsymWK: +Math.abs(R.realWK - L.realWK).toFixed(4),
  };
}

function twoSamplePerm(a, b, nPerm = 10000, seedInit = 202643) {
  const ma = a.reduce((s, v) => s + v, 0) / a.length, mb = b.reduce((s, v) => s + v, 0) / b.length;
  const va = a.reduce((s, v) => s + (v - ma) ** 2, 0) / Math.max(1, a.length - 1);
  const vb = b.reduce((s, v) => s + (v - mb) ** 2, 0) / Math.max(1, b.length - 1);
  const sp = Math.sqrt(((a.length - 1) * va + (b.length - 1) * vb) / Math.max(1, a.length + b.length - 2)) || 1e-9;
  const obs = Math.abs(ma - mb), all = [...a, ...b];
  let ge = 0, seed = seedInit >>> 0;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let p = 0; p < nPerm; p++) {
    for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
    let s1 = 0, s2 = 0;
    for (let i = 0; i < a.length; i++) s1 += all[i];
    for (let i = a.length; i < all.length; i++) s2 += all[i];
    if (Math.abs(s1 / a.length - s2 / b.length) >= obs - 1e-12) ge++;
  }
  let w = 0; for (const x of a) for (const y of b) w += x > y ? 1 : (x === y ? 0.5 : 0);
  const auc = w / (a.length * b.length);
  return {
    n1: a.length, n2: b.length,
    mean1: +ma.toFixed(4), mean2: +mb.toFixed(4),
    d: +((ma - mb) / sp).toFixed(3),
    auc: +Math.max(auc, 1 - auc).toFixed(3),
    p: +((ge + 1) / (nPerm + 1)).toFixed(5),
  };
}

// --- ds004504 (AD / FTD / CN) ---
async function findDataHeader(setUrl) {
  const head = await fetch(setUrl, { method: 'HEAD' });
  const total = Number(head.headers.get('content-length'));
  let off = 128;
  for (let i = 0; i < 60 && off < total; i++) {
    const r = await fetch(setUrl, { headers: { Range: `bytes=${off}-${Math.min(total - 1, off + 255)}` } });
    const b = Buffer.from(await r.arrayBuffer());
    const dt = b.readUInt32LE(0), nb = b.readUInt32LE(4);
    if (dt === 14) {
      let p = 8;
      const fNb = b.readUInt32LE(p + 4); p += 8 + Math.ceil(fNb / 8) * 8;
      const dNb = b.readUInt32LE(p + 4);
      const dims = []; for (let k = 0; k < dNb; k += 4) dims.push(b.readInt32LE(p + 8 + k));
      p += 8 + Math.ceil(dNb / 8) * 8;
      const nW0 = b.readUInt32LE(p);
      let name = '', dataHdrOff = p;
      if ((nW0 >>> 16) !== 0) { name = b.subarray(p + 4, p + 4 + (nW0 >>> 16)).toString('ascii'); dataHdrOff = p + 8; }
      else { const nLen = b.readUInt32LE(p + 4); name = b.subarray(p + 8, p + 8 + nLen).toString('ascii'); dataHdrOff = p + 8 + Math.ceil(nLen / 8) * 8; }
      if (name === 'data') return { nCh: dims[0], nSamples: dims[1], dataOff: off + dataHdrOff + 8 };
    }
    off += 8 + Math.ceil(nb / 8) * 8;
  }
  return null;
}

async function runDS004504() {
  const tsv = await fetch(`${S3_4504}participants.tsv`).then((r) => r.text());
  const lines = tsv.trim().split(/\r?\n/);
  const subs = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split('\t');
    subs.push({ sub: c[0], gender: c[1], age: +c[2], group: c[3], mmse: +c[4] });
  }
  const rows = [];
  let cur = 0;
  async function worker() {
    while (cur < subs.length) {
      const idx = cur++;
      const meta = subs[idx];
      try {
        const setUrl = `${S3_4504}${meta.sub}/eeg/${meta.sub}_task-eyesclosed_eeg.set`;
        const hdr = await findDataHeader(setUrl);
        if (!hdr) continue;
        const RAW_SFREQ = 500, DECIM = 2, SFREQ = 250;
        const rawLen = Math.min(WIN_SEC * RAW_SFREQ, hdr.nSamples - 100);
        const startSamp = Math.max(0, Math.floor((hdr.nSamples - rawLen) / 2));
        const byteStart = hdr.dataOff + startSamp * hdr.nCh * 4;
        const byteEnd = byteStart + rawLen * hdr.nCh * 4 - 1;
        const r = await fetch(setUrl, { headers: { Range: `bytes=${byteStart}-${byteEnd}` } });
        if (!r.ok) continue;
        const buf = Buffer.from(await r.arrayBuffer());
        const nCh = hdr.nCh, decLen = Math.floor(rawLen / DECIM);
        const fp1 = new Float64Array(decLen), fp2 = new Float64Array(decLen);
        for (let t = 0; t < decLen; t++) {
          let s1 = 0, s2 = 0;
          for (let k = 0; k < DECIM; k++) {
            const base = (t * DECIM + k) * nCh;
            s1 += buf.readFloatLE((base + 0) * 4);
            s2 += buf.readFloatLE((base + 1) * 4);
          }
          fp1[t] = s1 / DECIM; fp2[t] = s2 / DECIM;
        }
        const rc = 1 / (2 * Math.PI * 1.0), al = rc / (rc + 1 / SFREQ);
        for (const arr of [fp1, fp2]) {
          let px = arr[0], py = 0; arr[0] = 0;
          for (let t = 1; t < decLen; t++) { const x = arr[t], y = al * (py + x - px); arr[t] = y; px = x; py = y; }
        }
        const L = scoreSingleCh(fp1, SFREQ, (idx + 1) * 9973 + 5);
        const R = scoreSingleCh(fp2, SFREQ, (idx + 1) * 9973 + 19);
        if (L && R) rows.push({ ...meta, ...combineLR(L, R) });
      } catch {}
    }
  }
  await Promise.all(Array.from({ length: 8 }, () => worker()));
  return rows;
}

// --- ds007427 (PSEN1-E280A) ---
function parseVHDR(txt) {
  const nCh = parseInt((txt.match(/NumberOfChannels=(\d+)/) || [])[1] || '60', 10);
  const siUs = parseFloat((txt.match(/SamplingInterval=([\d.]+)/) || [])[1] || '1000');
  const rawSfreq = Math.round(1e6 / siUs);
  const chNames = [];
  for (const m of txt.matchAll(/^Ch(\d+)=([^,\r\n]+)/gm)) chNames[parseInt(m[1], 10) - 1] = m[2].trim().toUpperCase();
  return { nCh, rawSfreq, chNames };
}

async function runDS007427() {
  const xml = await fetch(`${S3_BASE}?list-type=2&prefix=ds007427/sub-&max-keys=1000`).then((r) => r.text());
  const eegKeys = [...xml.matchAll(/<Key>([^<]+_eeg\.eeg)<\/Key>/g)].map((m) => m[1]).filter((k) => /sub-G[12]/.test(k));
  const rows = [];
  let cur = 0;
  async function worker() {
    while (cur < eegKeys.length) {
      const idx = cur++;
      const eegKey = eegKeys[idx];
      try {
        const sub = eegKey.split('/')[1];
        const group = sub.startsWith('sub-G1') ? 'PSEN1' : 'CN_YOUNG';
        const vhdrUrl = S3_BASE + eegKey.replace(/_eeg\.eeg$/, '_eeg.vhdr');
        const eegUrl = S3_BASE + eegKey;
        const [vhTxt, headRes] = await Promise.all([fetch(vhdrUrl).then((r) => r.text()), fetch(eegUrl, { method: 'HEAD' })]);
        const { nCh, rawSfreq, chNames } = parseVHDR(vhTxt);
        const totalSamples = Math.floor(Number(headRes.headers.get('content-length')) / (nCh * 4));
        const idxOf = (cands) => cands.map((c) => chNames.indexOf(c)).find((i) => i >= 0);
        const iFp1 = idxOf(['FP1', 'AF3', 'F7']), iFp2 = idxOf(['FP2', 'AF4', 'F8']);
        if (iFp1 === undefined || iFp1 < 0 || iFp2 === undefined || iFp2 < 0) continue;
        const rawLen = Math.min(WIN_SEC * rawSfreq, totalSamples - 100);
        const startSamp = Math.max(0, Math.floor((totalSamples - rawLen) / 2));
        const byteStart = startSamp * nCh * 4, byteEnd = byteStart + rawLen * nCh * 4 - 1;
        const r = await fetch(eegUrl, { headers: { Range: `bytes=${byteStart}-${byteEnd}` } });
        if (!r.ok) continue;
        const buf = Buffer.from(await r.arrayBuffer());
        const decim = Math.max(1, Math.round(rawSfreq / 250));
        const sfreq = rawSfreq / decim;
        const decLen = Math.floor(rawLen / decim);
        const fp1 = new Float64Array(decLen), fp2 = new Float64Array(decLen);
        for (let t = 0; t < decLen; t++) {
          let s0 = 0, s1 = 0;
          for (let k = 0; k < decim; k++) {
            const base = (t * decim + k) * nCh;
            s0 += buf.readFloatLE((base + iFp1) * 4);
            s1 += buf.readFloatLE((base + iFp2) * 4);
          }
          fp1[t] = s0 / decim; fp2[t] = s1 / decim;
        }
        const rc = 1 / (2 * Math.PI * 1.0), al = rc / (rc + 1 / sfreq);
        for (const arr of [fp1, fp2]) {
          let px = arr[0], py = 0; arr[0] = 0;
          for (let t = 1; t < decLen; t++) { const x = arr[t], y = al * (py + x - px); arr[t] = y; px = x; py = y; }
        }
        const L = scoreSingleCh(fp1, sfreq, (idx + 1) * 9973 + 11);
        const R = scoreSingleCh(fp2, sfreq, (idx + 1) * 9973 + 29);
        if (L && R) rows.push({ sub, group, ...combineLR(L, R) });
      } catch {}
    }
  }
  await Promise.all(Array.from({ length: 8 }, () => worker()));
  return rows;
}

async function main() {
  console.log('=== Lab #43: Left-vs-Right Hemispheric brainNonlin Asymmetry (ds004504 N=88 + ds007427 N=43) ===');
  const [r4504, r7427] = await Promise.all([runDS004504(), runDS007427()]);
  const metrics = ['nonlinBi', 'nonlinL', 'nonlinR', 'signedAsymNonlin', 'absAsymNonlin', 'signedAsymSlope', 'absAsymSlope', 'signedAsymWK', 'absAsymWK'];

  const ad = r4504.filter((x) => x.group === 'A');
  const ftd = r4504.filter((x) => x.group === 'F');
  const cn = r4504.filter((x) => x.group === 'C');
  const psen = r7427.filter((x) => x.group === 'PSEN1');
  const ycn = r7427.filter((x) => x.group === 'CN_YOUNG');

  const compare = (g1, g2, label) => {
    const res = {};
    for (let i = 0; i < metrics.length; i++) {
      const m = metrics[i];
      res[m] = twoSamplePerm(g1.map((x) => x[m]), g2.map((x) => x[m]), 10000, 4300 + i * 17);
    }
    console.log(`\n--- ${label} (n1=${g1.length} vs n2=${g2.length}) ---`);
    for (const m of metrics) {
      const s = res[m];
      const star = s.p < 0.05 ? ' *SIG*' : '';
      console.log(`  ${m.padEnd(18)} m1=${String(s.mean1).padStart(7)} m2=${String(s.mean2).padStart(7)} | d=${String(s.d).padStart(6)} AUC=${s.auc.toFixed(3)} p=${s.p.toFixed(5)}${star}`);
    }
    return res;
  };

  const summary = {
    AD_vs_CN: compare(ad, cn, 'Clinical AD vs Controls (ds004504)'),
    FTD_vs_CN: compare(ftd, cn, 'Clinical FTD vs Controls (ds004504)'),
    FTD_vs_AD: compare(ftd, ad, 'Clinical FTD vs Clinical AD (DIFFERENTIAL!)'),
    PSEN1_vs_CN: compare(psen, ycn, 'Pre-Symptomatic PSEN1-E280A vs Non-Carriers (ds007427)'),
  };

  const out = {
    lab: 'Lab #43 — Left-vs-Right Hemispheric brainNonlin Asymmetry (ds004504 + ds007427)',
    counts: { AD: ad.length, FTD: ftd.length, CN_4504: cn.length, PSEN1: psen.length, CN_7427: ycn.length },
    summary,
    rows_ds004504: r4504,
    rows_ds007427: r7427,
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
  console.log(`\nSaved -> ${OUT_PATH}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
