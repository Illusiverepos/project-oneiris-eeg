'use strict';

/**
 * Project ONEIRIS — Lab #12 Human Fear Conditioning & Fear Extinction EEG Audit
 * Dataset: OpenNeuro ds007114 (SUBEMOcondEEG1, Brainlab, Univ. of Barcelona)
 *   - 28 healthy humans, 64-ch Neuroscan SynAmps RT (500 Hz, uncompressed float32 .set)
 *   - 3 Experimental Phases within every subject:
 *       1. Pre-Conditioning (Safe Baseline, event codes 21..34)
 *       2. Fear Conditioning (CS+ paired with unpleasant white noise US 100, codes 40..55)
 *       3. Fear Extinction (CS+ presented without US, codes 61..74)
 *   - Paired with State Anxiety & Trait Anxiety from `beh.tsv`.
 *
 * Streams exact 20-second slices per phase via HTTP Range requests (zero full-file downloads).
 * Tests ONEIRIS PTSD / Fear-Extinction Predictions:
 *   1. Conditioning vs. Pre-Conditioning: Does active threat flatten 1/f slopeBB, raise Beta,
 *      or fragment effDim — especially over Right_Frontal vs. Left_Frontal & Posterior?
 *   2. Extinction vs. Conditioning: Does safety learning reverse the fear shift (steepening
 *      Right_Frontal 1/f, releasing Posterior DFA alpha, or re-synchronizing effDim)?
 *   3. Trait / State Anxiety: Do higher-anxiety humans stay stuck in flatter Right_Frontal 1/f
 *      during Extinction?
 *
 * Output: reanalysis/data/lab12_ds007114_fear_extinction_results.json
 */

const fs = require('fs');
const path = require('path');

const S3_BASE = 'https://s3.amazonaws.com/openneuro.org/ds007114/';
const OUT_PATH = path.join(__dirname, 'data', 'lab12_ds007114_fear_extinction_results.json');

const RAW_SFREQ = 500;
const DECIM = 2;
const SFREQ = RAW_SFREQ / DECIM; // 250 Hz
const WIN_SEC = 20;

// ======================== DSP PRIMITIVES ========================

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
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
}

function spectralFeatures(sig, sfreq = SFREQ, nfft = 512) {
  const step = nfft / 2, half = nfft / 2 + 1, win = new Float64Array(nfft);
  let wp = 0; for (let i = 0; i < nfft; i++) { win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (nfft - 1))); wp += win[i] * win[i]; }
  const psd = new Float64Array(half); let segs = 0;
  for (let st = 0; st + nfft <= sig.length; st += step) {
    let m = 0; for (let i = 0; i < nfft; i++) m += sig[st + i]; m /= nfft;
    const r = new Float64Array(nfft), im = new Float64Array(nfft);
    for (let i = 0; i < nfft; i++) r[i] = (sig[st + i] - m) * win[i];
    fft(r, im); const norm = sfreq * wp;
    for (let k = 0; k < half; k++) psd[k] += (r[k] * r[k] + im[k] * im[k]) / norm;
    segs++;
  }
  const df = sfreq / nfft, xs = [], ys = [];
  let alphaP = 0, betaP = 0, totalP = 0;
  for (let k = 1; k < half; k++) {
    const f = k * df, p = psd[k] / Math.max(1, segs);
    if (f >= 1 && f <= 45) totalP += p * df;
    if (f >= 8 && f <= 12) alphaP += p * df;
    if (f >= 13 && f <= 25) betaP += p * df;
    if ((f >= 2 && f <= 7) || (f >= 14 && f <= 45)) { xs.push(Math.log10(f)); ys.push(Math.log10(p + 1e-24)); }
  }
  let mx = 0, my = 0; for (let i = 0; i < xs.length; i++) { mx += xs[i]; my += ys[i]; } mx /= xs.length; my /= xs.length;
  let num = 0, den = 0; for (let i = 0; i < xs.length; i++) { const dx = xs[i] - mx; num += dx * (ys[i] - my); den += dx * dx; }
  return {
    slopeBB: den > 0 ? num / den : 0,
    alphaFrac: alphaP / Math.max(1e-24, totalP),
    betaFrac: betaP / Math.max(1e-24, totalP),
  };
}

function computeDFA(sig) {
  const n = Math.min(sig.length, 4000);
  let mean = 0; for (let i = 0; i < n; i++) mean += sig[i]; mean /= n;
  const y = new Float64Array(n); let cum = 0;
  for (let i = 0; i < n; i++) { cum += sig[i] - mean; y[i] = cum; }
  const scales = [10, 16, 25, 40, 64, 100, 160, 250].filter((s) => s * 4 <= n);
  const lx = [], ly = [];
  for (const s of scales) {
    const nWin = Math.floor(n / s); let f2 = 0; const mx = (s - 1) / 2;
    let varX = 0; for (let k = 0; k < s; k++) varX += (k - mx) ** 2;
    for (let w = 0; w < nWin; w++) {
      const off = w * s; let my = 0; for (let k = 0; k < s; k++) my += y[off + k]; my /= s;
      let cov = 0; for (let k = 0; k < s; k++) cov += (k - mx) * (y[off + k] - my);
      const sl = cov / varX, ic = my - sl * mx;
      for (let k = 0; k < s; k++) { const r = y[off + k] - (ic + sl * k); f2 += r * r; }
    }
    const rms = Math.sqrt(f2 / (nWin * s));
    if (rms > 0) { lx.push(Math.log10(s)); ly.push(Math.log10(rms)); }
  }
  let mx = 0, my = 0; for (let i = 0; i < lx.length; i++) { mx += lx[i]; my += ly[i]; } mx /= lx.length; my /= lx.length;
  let num = 0, den = 0; for (let i = 0; i < lx.length; i++) { const dx = lx[i] - mx; num += dx * (ly[i] - my); den += dx * dx; }
  return den > 0 ? num / den : 0;
}

function computeEffDimNorm(sigs) {
  const K = sigs.length, N = sigs[0].length;
  if (K < 2) return 1;
  const zs = sigs.map((s) => {
    let m = 0; for (let t = 0; t < N; t++) m += s[t]; m /= N;
    let v = 0; for (let t = 0; t < N; t++) v += (s[t] - m) ** 2;
    const sd = Math.sqrt(v / N) || 1, o = new Float64Array(N);
    for (let t = 0; t < N; t++) o[t] = (s[t] - m) / sd;
    return o;
  });
  let sumSq = 0;
  for (let i = 0; i < K; i++) {
    sumSq += 1;
    for (let j = i + 1; j < K; j++) {
      let c = 0; const si = zs[i], sj = zs[j];
      for (let t = 0; t < N; t++) c += si[t] * sj[t];
      c /= N; sumSq += 2 * c * c;
    }
  }
  return ((K * K) / Math.max(1e-9, sumSq)) / K;
}

// ======================== S3 UNCOMPRESSED .SET STREAMER ========================

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
      if (name === 'data') {
        return { nCh: dims[0], nSamples: dims[1], dataOff: off + dataHdrOff + 8 };
      }
    }
    off += 8 + Math.ceil(nb / 8) * 8;
  }
  return null;
}

async function fetchWindowAndAnalyze(setUrl, hdr, chNames, startSec) {
  const rawLen = WIN_SEC * RAW_SFREQ;
  const startSamp = Math.max(0, Math.min(hdr.nSamples - rawLen - 1, Math.floor(startSec * RAW_SFREQ)));
  const byteStart = hdr.dataOff + startSamp * hdr.nCh * 4;
  const byteEnd = byteStart + rawLen * hdr.nCh * 4 - 1;
  const r = await fetch(setUrl, { headers: { Range: `bytes=${byteStart}-${byteEnd}` } });
  const buf = Buffer.from(await r.arrayBuffer());

  const nCh = hdr.nCh;
  const decLen = Math.floor(rawLen / DECIM);
  const rc = 1 / (2 * Math.PI * 1.0), a = rc / (rc + 1 / SFREQ);

  const rois = {
    rightFrontal: ['F4', 'F8', 'FC4', 'FC6', 'AF4'],
    leftFrontal:  ['F3', 'F7', 'FC3', 'FC5', 'AF3'],
    posterior:    ['P4', 'P8', 'PO8', 'O2', 'OZ', 'PZ', 'P3', 'P7', 'PO7', 'O1'],
  };
  const needed = new Set([...rois.rightFrontal, ...rois.leftFrontal, ...rois.posterior]);
  const chMap = new Map();

  for (let c = 0; c < Math.min(nCh, chNames.length); c++) {
    const nm = chNames[c].toUpperCase();
    if (!needed.has(nm)) continue;
    const arr = new Float64Array(decLen);
    for (let t = 0; t < decLen; t++) {
      let s = 0;
      for (let k = 0; k < DECIM; k++) {
        const idx = ((t * DECIM + k) * nCh + c) * 4;
        s += buf.readFloatLE(idx);
      }
      arr[t] = s / DECIM;
    }
    // 1 Hz high-pass
    let px = arr[0], py = 0; arr[0] = 0;
    for (let t = 1; t < decLen; t++) { const x = arr[t], y = a * (py + x - px); arr[t] = y; px = x; py = y; }
    chMap.set(nm, arr);
  }

  const evalROI = (names) => {
    const segs = names.map((n) => chMap.get(n)).filter(Boolean);
    const ms = segs.map((s) => ({ ...spectralFeatures(s), dfa: computeDFA(s) }));
    const avg = (k) => +(ms.reduce((acc, x) => acc + x[k], 0) / ms.length).toFixed(4);
    return { slopeBB: avg('slopeBB'), alphaFrac: avg('alphaFrac'), betaFrac: avg('betaFrac'), dfa: avg('dfa'), effDimNorm: +computeEffDimNorm(segs).toFixed(4) };
  };

  const rf = evalROI(rois.rightFrontal);
  const lf = evalROI(rois.leftFrontal);
  const post = evalROI(rois.posterior);
  const allSegs = [...chMap.values()];
  return {
    rfSlope: rf.slopeBB, lfSlope: lf.slopeBB, rfMinusLfSlope: +(rf.slopeBB - lf.slopeBB).toFixed(4),
    rfBeta: rf.betaFrac, postSlope: post.slopeBB, postDFA: post.dfa, postAlpha: post.alphaFrac,
    postEffDimNorm: post.effDimNorm, globalEffDimNorm: +computeEffDimNorm(allSegs).toFixed(4),
  };
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
  return { n, mean: +mean.toFixed(4), dz: +(mean / sd).toFixed(3), pApprox: +erfc(Math.abs(t) / Math.SQRT2).toFixed(4), nPos: diffs.filter((x) => x > 0).length, nNeg: diffs.filter((x) => x < 0).length };
}
function spearman(xs, ys) {
  const rank = (arr) => {
    const s = arr.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
    const r = new Array(arr.length);
    for (let i = 0; i < s.length; ) { let j = i; while (j + 1 < s.length && s[j + 1][0] === s[i][0]) j++; const av = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[s[k][1]] = av; i = j + 1; }
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

async function processSubject(sub) {
  const base = `${S3_BASE}${sub}/`;
  const [chTxt, evTxt, behTxt] = await Promise.all([
    fetch(`${base}eeg/${sub}_task-SUBEMOcondEEG1_channels.tsv`).then((r) => r.text()),
    fetch(`${base}eeg/${sub}_task-SUBEMOcondEEG1_events.tsv`).then((r) => r.text()),
    fetch(`${base}beh/${sub}_task-SUBEMOcondEEG1_beh.tsv`).then((r) => r.text()),
  ]);
  const chNames = chTxt.trim().split('\n').slice(1).map((l) => l.split('\t')[0].trim());
  const evLines = evTxt.trim().split('\n').slice(1).map((l) => { const p = l.split('\t'); return { sec: Number(p[0]), val: Number(p[3]) }; });

  // Locate midpoints of Pre-Conditioning (21..34), Fear Conditioning (40..55), Fear Extinction (61..74)
  const midSec = (lo, hi) => {
    const arr = evLines.filter((e) => e.val >= lo && e.val <= hi).map((e) => e.sec);
    return arr.length ? arr[Math.floor(arr.length / 2)] : null;
  };
  const tPre = midSec(21, 34);
  const tCond = midSec(40, 55);
  const tExt = midSec(61, 74);
  if (tPre === null || tCond === null || tExt === null) return null;

  // Parse State & Trait anxiety from beh.tsv
  const behLines = behTxt.trim().split('\n');
  const behHdr = behLines[0].split('\t');
  const stIdx = behHdr.indexOf('State'), trIdx = behHdr.indexOf('Trait');
  const row1 = (behLines[1] || '').split('\t');
  const stateAnx = stIdx >= 0 ? Number(row1[stIdx]) : null;
  const traitAnx = trIdx >= 0 ? Number(row1[trIdx]) : null;

  const setUrl = `${base}eeg/${sub}_task-SUBEMOcondEEG1_eeg.set`;
  const hdr = await findDataHeader(setUrl);
  if (!hdr) return null;

  const [pre, cond, ext] = await Promise.all([
    fetchWindowAndAnalyze(setUrl, hdr, chNames, tPre),
    fetchWindowAndAnalyze(setUrl, hdr, chNames, tCond),
    fetchWindowAndAnalyze(setUrl, hdr, chNames, tExt),
  ]);
  return { sub, stateAnx, traitAnx, tPre: Math.round(tPre), tCond: Math.round(tCond), tExt: Math.round(tExt), pre, cond, ext };
}

async function main() {
  const pTxt = await (await fetch(`${S3_BASE}participants.tsv`)).text();
  const subs = pTxt.trim().split('\n').slice(1).map((l) => l.split('\t')[0].trim()).filter((s) => /^sub-\d+$/.test(s));
  console.log(`Streaming Lab #12 (ds007114 Fear Conditioning & Extinction) across ${subs.length} humans...`);

  const results = [];
  const CONC = 4;
  for (let i = 0; i < subs.length; i += CONC) {
    const batch = subs.slice(i, i + CONC);
    const out = await Promise.all(batch.map((s) => processSubject(s).catch((e) => { console.error(s, e.message); return null; })));
    for (const x of out) if (x) results.push(x);
    process.stdout.write(`  Completed ${results.length}/${subs.length}\r`);
  }
  console.log(`\nLoaded ${results.length}/${subs.length} humans cleanly.`);

  const metrics = ['rfSlope', 'lfSlope', 'rfMinusLfSlope', 'rfBeta', 'postSlope', 'postDFA', 'postAlpha', 'postEffDimNorm', 'globalEffDimNorm'];
  const condVsPre = {}, extVsCond = {}, extVsPre = {}, traitCorrExt = {};
  for (const m of metrics) {
    condVsPre[m] = pairedStats(results.map((r) => r.cond[m] - r.pre[m]));
    extVsCond[m] = pairedStats(results.map((r) => r.ext[m] - r.cond[m]));
    extVsPre[m] = pairedStats(results.map((r) => r.ext[m] - r.pre[m]));
    const valid = results.filter((r) => Number.isFinite(r.traitAnx));
    traitCorrExt[m] = spearman(valid.map((r) => r.traitAnx), valid.map((r) => r.ext[m] - r.cond[m]));
  }

  const report = {
    generatedAt: new Date().toISOString(),
    dataset: 'OpenNeuro ds007114 (SUBEMOcondEEG1 — Human Fear Conditioning & Extinction)',
    nSubjects: results.length,
    condVsPre, extVsCond, extVsPre, traitCorrExt,
    subjects: results,
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(report, null, 2));

  console.log('\n=== 1. FEAR CONDITIONING minus PRE-CONDITIONING (ACTIVE THREAT, n=' + results.length + ') ===');
  console.table(condVsPre);
  console.log('\n=== 2. FEAR EXTINCTION minus FEAR CONDITIONING (SAFETY LEARNING, n=' + results.length + ') ===');
  console.table(extVsCond);
  console.log('\n=== 3. TRAIT ANXIETY vs. EXTINCTION SHIFT (Ext - Cond) ===');
  console.table(traitCorrExt);
  console.log(`\nSaved -> ${OUT_PATH}`);
}

main();
