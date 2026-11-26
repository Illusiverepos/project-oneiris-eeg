'use strict';

/**
 * Project ONEIRIS — Missing Edge #1 & #2 Empirical Test:
 * Volume-Conduction-Free Theta wPLI (4-8 Hz, Posterior <-> Right Frontal) & Posterior HFD
 * Across Human Fear Conditioning & Extinction (Lab #12, OpenNeuro ds007114, n = 28)
 *
 * Uses saved (tPre, tCond, tExt) phase timestamps from lab12_ds007114_fear_extinction_results.json
 * and 8-worker parallel HTTP Range streaming from OpenNeuro S3.
 *
 * Output: reanalysis/data/lab12_theta_wpli_and_hfd_results.json
 */

const fs = require('fs');
const path = require('path');

const S3_BASE = 'https://s3.amazonaws.com/openneuro.org/ds007114/';
const L12_PATH = path.join(__dirname, 'data', 'lab12_ds007114_fear_extinction_results.json');
const OUT_PATH = path.join(__dirname, 'data', 'lab12_theta_wpli_and_hfd_results.json');

const RAW_SFREQ = 500, DECIM = 2, SFREQ = 250, WIN_SEC = 20;

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

function computeWPLI(sigA, sigB, fLow, fHigh, sfreq = SFREQ, nfft = 512) {
  const step = nfft / 2, half = nfft / 2 + 1, df = sfreq / nfft;
  const win = new Float64Array(nfft);
  for (let i = 0; i < nfft; i++) win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (nfft - 1)));
  const imSums = new Float64Array(half), absImSums = new Float64Array(half);
  for (let st = 0; st + nfft <= Math.min(sigA.length, sigB.length); st += step) {
    let ma = 0, mb = 0;
    for (let i = 0; i < nfft; i++) { ma += sigA[st + i]; mb += sigB[st + i]; }
    ma /= nfft; mb /= nfft;
    const ra = new Float64Array(nfft), ia = new Float64Array(nfft);
    const rb = new Float64Array(nfft), ib = new Float64Array(nfft);
    for (let i = 0; i < nfft; i++) { ra[i] = (sigA[st + i] - ma) * win[i]; rb[i] = (sigB[st + i] - mb) * win[i]; }
    fft(ra, ia); fft(rb, ib);
    for (let k = 1; k < half; k++) {
      const f = k * df;
      if (f < fLow || f > fHigh) continue;
      // Im(X_A * conj(X_B)) = ia*rb - ra*ib
      const imCross = ia[k] * rb[k] - ra[k] * ib[k];
      imSums[k] += imCross;
      absImSums[k] += Math.abs(imCross);
    }
  }
  let num = 0, den = 0;
  for (let k = 1; k < half; k++) {
    const f = k * df;
    if (f >= fLow && f <= fHigh) { num += Math.abs(imSums[k]); den += absImSums[k]; }
  }
  return den > 1e-18 ? num / den : 0;
}

function computeHFD(sig, kMax = 12) {
  const N = sig.length, xs = [], ys = [];
  for (let k = 1; k <= kMax; k++) {
    let Lk = 0;
    for (let m = 0; m < k; m++) {
      const nSteps = Math.floor((N - 1 - m) / k);
      if (nSteps < 1) continue;
      let Lm = 0;
      for (let i = 1; i <= nSteps; i++) Lm += Math.abs(sig[m + i * k] - sig[m + (i - 1) * k]);
      Lk += (Lm * (N - 1)) / (nSteps * k * k);
    }
    Lk /= k;
    if (Lk > 0) { xs.push(Math.log(1 / k)); ys.push(Math.log(Lk)); }
  }
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  return den > 0 ? num / den : 1.5;
}

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

async function evalPhase(setUrl, hdr, chNames, startSec) {
  const rawLen = WIN_SEC * RAW_SFREQ;
  const startSamp = Math.max(0, Math.min(hdr.nSamples - rawLen - 1, Math.floor(startSec * RAW_SFREQ)));
  const byteStart = hdr.dataOff + startSamp * hdr.nCh * 4;
  const byteEnd = byteStart + rawLen * hdr.nCh * 4 - 1;
  const r = await fetch(setUrl, { headers: { Range: `bytes=${byteStart}-${byteEnd}` } });
  const buf = Buffer.from(await r.arrayBuffer());
  const nCh = hdr.nCh, decLen = Math.floor(rawLen / DECIM);
  const rc = 1 / (2 * Math.PI * 1.0), a = rc / (rc + 1 / SFREQ);

  const rfList = ['F4', 'F8', 'FC4', 'AF4'];
  const postList = ['P4', 'P8', 'PO8', 'O2', 'PZ'];
  const needed = new Set([...rfList, ...postList]);
  const chMap = new Map();
  for (let c = 0; c < Math.min(nCh, chNames.length); c++) {
    const nm = chNames[c].toUpperCase();
    if (!needed.has(nm)) continue;
    const arr = new Float64Array(decLen);
    for (let t = 0; t < decLen; t++) {
      let s = 0;
      for (let k = 0; k < DECIM; k++) s += buf.readFloatLE(((t * DECIM + k) * nCh + c) * 4);
      arr[t] = s / DECIM;
    }
    let px = arr[0], py = 0; arr[0] = 0;
    for (let t = 1; t < decLen; t++) { const x = arr[t], y = a * (py + x - px); arr[t] = y; px = x; py = y; }
    chMap.set(nm, arr);
  }
  const avgSig = (list) => {
    const segs = list.map((n) => chMap.get(n)).filter(Boolean);
    const out = new Float64Array(decLen);
    for (const s of segs) for (let t = 0; t < decLen; t++) out[t] += s[t] / segs.length;
    return out;
  };
  const rfSig = avgSig(rfList), postSig = avgSig(postList);
  return {
    wpliTheta: +computeWPLI(postSig, rfSig, 4, 8).toFixed(4),
    wpliAlpha: +computeWPLI(postSig, rfSig, 8, 12).toFixed(4),
    postHFD: +computeHFD(postSig, 12).toFixed(4),
    rfHFD: +computeHFD(rfSig, 12).toFixed(4),
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
  return { n, mean: +mean.toFixed(4), dz: +(mean / sd).toFixed(3), t: +t.toFixed(3), pApprox: +erfc(Math.abs(t) / Math.SQRT2).toFixed(4), nPos: diffs.filter((x) => x > 0).length, nNeg: diffs.filter((x) => x < 0).length };
}

async function main() {
  const l12 = JSON.parse(fs.readFileSync(L12_PATH, 'utf8'));
  const subs = l12.subjects;
  console.log(`Streaming Lab #12 (ds007114, n = ${subs.length}) for Theta wPLI & Posterior HFD (8 parallel workers)...`);
  const results = [];
  let cursor = 0;

  async function worker() {
    while (cursor < subs.length) {
      const s = subs[cursor++];
      try {
        const base = `${S3_BASE}${s.sub}/eeg/`;
        const chTxt = await fetch(`${base}${s.sub}_task-SUBEMOcondEEG1_channels.tsv`).then((r) => r.text());
        const chNames = chTxt.trim().split('\n').slice(1).map((l) => l.split('\t')[0].trim());
        const setUrl = `${base}${s.sub}_task-SUBEMOcondEEG1_eeg.set`;
        const hdr = await findDataHeader(setUrl);
        if (!hdr) continue;
        const [pre, cond, ext] = await Promise.all([
          evalPhase(setUrl, hdr, chNames, s.tPre),
          evalPhase(setUrl, hdr, chNames, s.tCond),
          evalPhase(setUrl, hdr, chNames, s.tExt),
        ]);
        results.push({ sub: s.sub, pre, cond, ext });
      } catch {}
    }
  }

  await Promise.all(Array.from({ length: 8 }, () => worker()));
  const summarize = (a, b) => {
    const out = {};
    for (const k of ['wpliTheta', 'wpliAlpha', 'postHFD', 'rfHFD']) {
      out[k] = pairedStats(results.map((r) => r[b][k] - r[a][k]));
    }
    return out;
  };

  const report = {
    generatedAt: new Date().toISOString(),
    nSubjects: results.length,
    condVsPre: summarize('pre', 'cond'),
    extVsCond: summarize('cond', 'ext'),
    extVsPre: summarize('pre', 'ext'),
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(report, null, 2));
  console.log(`\n=== LAB #12 FEAR EXTINCTION (n = ${results.length}) — MISSING EDGE #1 (Theta wPLI) & #2 (postHFD) ===`);
  console.log('Extinction vs. Conditioning:'); console.table(report.extVsCond);
  console.log('Extinction vs. Pre-Conditioning:'); console.table(report.extVsPre);
  console.log('Conditioning vs. Pre-Conditioning:'); console.table(report.condVsPre);
  console.log(`Saved -> ${OUT_PATH}`);
}
main();
