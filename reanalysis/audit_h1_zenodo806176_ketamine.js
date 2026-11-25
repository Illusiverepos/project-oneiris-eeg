'use strict';

/**
 * Project ONEIRIS (Phase 2, H1) — Ketamine / Disembodied OBE Validation Audit
 * Dataset: Zenodo 806176 (DOI 10.5281/zenodo.806176)
 *   "Rest EEG recordings in healthy subjects during wakefulness, sleep and anesthesia
 *    with ketamine, propofol, and xenon" (Laureys & Massimini)
 *
 * Pre-registered H1 predictions (frozen Paper-1 axis, zero refitting):
 *   1a. Layer 1 Preserved: Right-TPJ/Occipital slopeBB & -DFA stay high in Ketamine vs Propofol.
 *   1b. Layer 2 Offline:   crossIrrevPost & bottom-up psiAlpha collapse in Ketamine vs Wake.
 *   1c. OBE Decoupling:    Right-TPJ <-> Sensorimotor (C3/C4) coupling drops in Ketamine vs Wake.
 *
 * Usage:
 *   node audit_h1_zenodo806176_ketamine.js --fetch      # Download Zenodo 806176 metadata & files
 *   node audit_h1_zenodo806176_ketamine.js              # Audit local EDF files in data/zenodo_806176/
 *   node audit_h1_zenodo806176_ketamine.js --self-test  # Dry-run verification on synthetic paired cohort
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data', 'zenodo_806176');
const OUT_PATH = path.join(DATA_DIR, 'h1_zenodo806176_ketamine_results.json');
const ZENODO_API = 'https://zenodo.org/api/records/806176';

// Frozen Paper-1 Propofol-Trained Discriminant Weights (ds005620)
const S_PHYS_WEIGHTS = { slopeBB: 0.515, lzc: 0.351, dfa: -0.782 };

// ======================== DSP & NON-PARAMETRIC PRIMITIVES ========================

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wlenRe = Math.cos(ang), wlenIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let wRe = 1, wIm = 0;
      for (let j = 0; j < len / 2; j++) {
        const uRe = re[i + j], uIm = im[i + j];
        const vRe = re[i + j + len / 2] * wRe - im[i + j + len / 2] * wIm;
        const vIm = re[i + j + len / 2] * wIm + im[i + j + len / 2] * wRe;
        re[i + j] = uRe + vRe; im[i + j] = uIm + vIm;
        re[i + j + len / 2] = uRe - vRe; im[i + j + len / 2] = uIm - vIm;
        const nw = wRe * wlenRe - wIm * wlenIm; wIm = wRe * wlenIm + wIm * wlenRe; wRe = nw;
      }
    }
  }
}

function slopeBB(sig, sfreq = 200, nfft = 512) {
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
  for (let k = 1; k < half; k++) {
    const f = k * df;
    if ((f >= 2 && f <= 7) || (f >= 14 && f <= 45)) { xs.push(Math.log10(f)); ys.push(Math.log10(psd[k] / Math.max(1, segs) + 1e-24)); }
  }
  let mx = 0, my = 0; for (let i = 0; i < xs.length; i++) { mx += xs[i]; my += ys[i]; } mx /= xs.length; my /= xs.length;
  let num = 0, den = 0; for (let i = 0; i < xs.length; i++) { const dx = xs[i] - mx; num += dx * (ys[i] - my); den += dx * dx; }
  return den > 0 ? num / den : 0;
}

function lz76Norm(s) {
  const n = s.length; if (n <= 1) return 0; let i = 0, k = 1, l = 1, c = 1, kMax = 1;
  while (true) {
    if (s.charCodeAt(i + k - 1) === s.charCodeAt(l + k - 1)) { k++; if (l + k > n) { c++; break; } }
    else { if (k > kMax) kMax = k; i++; if (i === l) { c++; l += kMax; if (l + 1 > n) break; i = 0; k = 1; kMax = 1; } else k = 1; }
  }
  return (c * Math.log2(n)) / n;
}

function singleLZc(sig, maxT = 400) {
  const nT = Math.min(maxT, Math.floor(sig.length / 2)), sub = new Float64Array(nT);
  for (let t = 0; t < nT; t++) sub[t] = sig[t * 2];
  const med = Float64Array.from(sub).sort()[Math.floor(nT / 2)];
  let bits = ''; for (let t = 0; t < nT; t++) bits += sub[t] > med ? '1' : '0';
  return lz76Norm(bits);
}

function computeDFA(sig) {
  const n = Math.min(sig.length, 3000), start = sig.length - n;
  let mean = 0; for (let i = 0; i < n; i++) mean += sig[start + i]; mean /= n;
  const y = new Float64Array(n); let cum = 0;
  for (let i = 0; i < n; i++) { cum += sig[start + i] - mean; y[i] = cum; }
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

function crossCorrIrrev(sigs, lags = [1, 2, 4, 8]) {
  const m = sigs.length; if (m < 2) return 0;
  const n = sigs[0].length;
  const zs = sigs.map((s) => {
    let mu = 0; for (let t = 0; t < n; t++) mu += s[t]; mu /= n;
    let v = 0; for (let t = 0; t < n; t++) v += (s[t] - mu) ** 2;
    const sd = Math.sqrt(v / n) || 1, o = new Float64Array(n);
    for (let t = 0; t < n; t++) o[t] = (s[t] - mu) / sd;
    return o;
  });
  let tot = 0, cnt = 0;
  for (const tau of lags) {
    const len = n - tau;
    for (let i = 0; i < m; i++) for (let j = i + 1; j < m; j++) {
      let cf = 0, cb = 0; const si = zs[i], sj = zs[j];
      for (let t = 0; t < len; t++) { cf += si[t] * sj[t + tau]; cb += sj[t] * si[t + tau]; }
      tot += Math.abs((cf - cb) / len); cnt++;
    }
  }
  return cnt ? tot / cnt : 0;
}

function computePSI(sigA, sigB, sfreq = 200, nfft = 512) {
  const step = nfft / 2, half = nfft / 2 + 1, win = new Float64Array(nfft);
  let wp = 0; for (let i = 0; i < nfft; i++) { win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (nfft - 1))); wp += win[i] * win[i]; }
  const pAA = new Float64Array(half), pBB = new Float64Array(half);
  const sRe = new Float64Array(half), sIm = new Float64Array(half);
  for (let st = 0; st + nfft <= sigA.length; st += step) {
    let mA = 0, mB = 0; for (let i = 0; i < nfft; i++) { mA += sigA[st + i]; mB += sigB[st + i]; } mA /= nfft; mB /= nfft;
    const rA = new Float64Array(nfft), iA = new Float64Array(nfft), rB = new Float64Array(nfft), iB = new Float64Array(nfft);
    for (let i = 0; i < nfft; i++) { rA[i] = (sigA[st + i] - mA) * win[i]; rB[i] = (sigB[st + i] - mB) * win[i]; }
    fft(rA, iA); fft(rB, iB); const norm = sfreq * wp;
    for (let k = 0; k < half; k++) {
      pAA[k] += (rA[k] * rA[k] + iA[k] * iA[k]) / norm;
      pBB[k] += (rB[k] * rB[k] + iB[k] * iB[k]) / norm;
      sRe[k] += (rA[k] * rB[k] + iA[k] * iB[k]) / norm;
      sIm[k] += (rA[k] * iB[k] - iA[k] * rB[k]) / norm;
    }
  }
  const cRe = new Float64Array(half), cIm = new Float64Array(half);
  for (let k = 0; k < half; k++) {
    const den = Math.sqrt(Math.max(1e-30, pAA[k] * pBB[k]));
    cRe[k] = sRe[k] / den; cIm[k] = sIm[k] / den;
  }
  const df = sfreq / nfft;
  const bandPSI = (lo, hi) => {
    let acc = 0;
    for (let k = 1; k < half - 1; k++) {
      const f = k * df;
      if (f >= lo && f + df <= hi) acc += cRe[k] * cIm[k + 1] - cIm[k] * cRe[k + 1];
    }
    return acc;
  };
  return { psiAlpha: bandPSI(8, 12), psiBeta: bandPSI(13, 25) };
}

function pearsonAbs(a, b) {
  const n = a.length; let ma = 0, mb = 0;
  for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; } ma /= n; mb /= n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; num += x * y; da += x * x; db += y * y; }
  return da > 0 && db > 0 ? Math.abs(num / Math.sqrt(da * db)) : 0;
}

/** Exact 2^n paired sign-flip permutation test (ideal for Zenodo 806176 n=5 cohorts) */
function exactPairedSignFlip(diffs) {
  const n = diffs.length;
  if (n === 0) return { n: 0, meanDiff: 0, dz: 0, nPos: 0, pTwoSided: 1 };
  const obs = diffs.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(diffs.reduce((a, b) => a + (b - obs) ** 2, 0) / Math.max(1, n - 1)) || 1e-12;
  const nPos = diffs.filter((d) => d > 0).length;
  let ge = 0, total = 0;
  if (n <= 14) {
    total = 1 << n;
    for (let mask = 0; mask < total; mask++) {
      let s = 0;
      for (let i = 0; i < n; i++) s += (mask & (1 << i)) ? diffs[i] : -diffs[i];
      if (Math.abs(s / n) >= Math.abs(obs) - 1e-12) ge++;
    }
  } else {
    total = 10000;
    let seed = 42;
    const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let k = 0; k < total; k++) {
      let s = 0;
      for (let i = 0; i < n; i++) s += rand() < 0.5 ? diffs[i] : -diffs[i];
      if (Math.abs(s / n) >= Math.abs(obs) - 1e-12) ge++;
    }
  }
  return {
    n, nPos, meanDiff: Number(obs.toFixed(4)), dz: Number((obs / sd).toFixed(3)),
    pTwoSided: Number((ge / total).toFixed(5)),
  };
}

function readEDF(filePath) {
  const buf = fs.readFileSync(filePath);
  const numRecords = parseInt(buf.toString('ascii', 236, 244).trim(), 10);
  const recordDurSec = parseFloat(buf.toString('ascii', 244, 252).trim());
  const ns = parseInt(buf.toString('ascii', 252, 256).trim(), 10);
  const headerBytes = parseInt(buf.toString('ascii', 184, 192).trim(), 10);
  const readStr = (off, w) => Array.from({ length: ns }, (_, i) => buf.toString('ascii', off + i * w, off + (i + 1) * w).trim());
  let off = 256;
  const labels = readStr(off, 16); off += ns * 16 + ns * 80 + ns * 8;
  const physMin = readStr(off, 8).map(Number); off += ns * 8;
  const physMax = readStr(off, 8).map(Number); off += ns * 8;
  const digMin = readStr(off, 8).map(Number); off += ns * 8;
  const digMax = readStr(off, 8).map(Number); off += ns * 8 + ns * 80;
  const spr = readStr(off, 8).map((s) => parseInt(s, 10));
  const signals = Array.from({ length: ns }, (_, i) => new Float64Array(numRecords * spr[i]));
  const scales = Array.from({ length: ns }, (_, i) => (physMax[i] - physMin[i]) / Math.max(1e-12, digMax[i] - digMin[i]));
  const offsets = Array.from({ length: ns }, (_, i) => physMin[i] - scales[i] * digMin[i]);
  let pos = headerBytes;
  for (let r = 0; r < numRecords; r++) {
    for (let ch = 0; ch < ns; ch++) {
      const nS = spr[ch], base = r * nS, sc = scales[ch], of = offsets[ch];
      for (let s = 0; s < nS; s++) { signals[ch][base + s] = buf.readInt16LE(pos) * sc + of; pos += 2; }
    }
  }
  return { labels, sfreqs: spr.map((n) => n / recordDurSec), signals };
}

function applyCAR(sigs) {
  const m = sigs.length, n = sigs[0].length;
  const mean = new Float64Array(n);
  for (let t = 0; t < n; t++) { let s = 0; for (let c = 0; c < m; c++) s += sigs[c][t]; mean[t] = s / m; }
  return sigs.map((sig) => { const o = new Float64Array(n); for (let t = 0; t < n; t++) o[t] = sig[t] - mean[t]; return o; });
}

function extractH1Features(postSigs, frontSigs, bodySigs, sfreq) {
  const meanSig = (arr) => {
    const n = arr[0].length, o = new Float64Array(n);
    for (let t = 0; t < n; t++) { let s = 0; for (const g of arr) s += g[t]; o[t] = s / arr.length; }
    return o;
  };
  const slp = postSigs.reduce((a, g) => a + slopeBB(g, sfreq), 0) / postSigs.length;
  const lzc = postSigs.reduce((a, g) => a + singleLZc(g, 400), 0) / postSigs.length;
  const dfa = postSigs.reduce((a, g) => a + computeDFA(g), 0) / postSigs.length;
  const crossIrrevPost = crossCorrIrrev(postSigs.slice(0, 6), [1, 2, 4, 8]);
  const psi = computePSI(meanSig(postSigs), meanSig(frontSigs), sfreq, 512);
  const tpjBodyCoupling = pearsonAbs(meanSig(postSigs), meanSig(bodySigs));
  return { slopeBB: slp, lzc, dfa, crossIrrevPost, psiAlpha: psi.psiAlpha, tpjBodyCoupling };
}

// ======================== FETCH & SELF-TEST MODES ========================

async function fetchZenodo806176() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log(`Querying Zenodo API: ${ZENODO_API}`);
  const res = await fetch(ZENODO_API);
  if (!res.ok) throw new Error(`Zenodo HTTP ${res.status}`);
  const meta = await res.json();
  fs.writeFileSync(path.join(DATA_DIR, 'zenodo_806176_metadata.json'), JSON.stringify(meta, null, 2));
  const files = meta.files || [];
  console.log(`Found ${files.length} files in Zenodo 806176:`);
  for (const f of files) {
    console.log(`  - ${f.key} (${(f.size / (1024 * 1024)).toFixed(1)} MB)`);
    const dest = path.join(DATA_DIR, f.key);
    if (!fs.existsSync(dest)) {
      const fRes = await fetch(f.links.self);
      if (!fRes.ok) throw new Error(`Download failed for ${f.key}: HTTP ${fRes.status}`);
      fs.writeFileSync(dest, Buffer.from(await fRes.arrayBuffer()));
      console.log(`    Saved -> ${dest}`);
    }
  }
}

function runSelfTest() {
  console.log('=== H1 ZENODO 806176 AUDIT — SYNTHETIC DRY-RUN SELF-TEST (N=5 PAIRED) ===');
  const sfreq = 200, N = 20 * sfreq;
  const makeCohort = (mode, seed) => {
    let s = seed >>> 0;
    const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const randn = () => Math.sqrt(-2 * Math.log(Math.max(1e-12, rand()))) * Math.cos(2 * Math.PI * rand());
    const base = new Float64Array(N);
    let slow = 0;
    for (let t = 0; t < N; t++) {
      slow = (mode === 'propofol' ? 0.97 : 0.72) * slow + randn();
      base[t] = slow + (mode === 'propofol' ? 0.1 : 1.0) * randn();
    }
    const post = Array.from({ length: 4 }, (_, ch) => {
      const g = new Float64Array(N);
      for (let t = 0; t < N; t++) {
        const lag = mode === 'wake' ? base[Math.max(0, t - ch * 2)] : base[t];
        g[t] = 0.6 * lag + randn() * (mode === 'propofol' ? 0.2 : 1.0);
      }
      return g;
    });
    const front = Array.from({ length: 2 }, () => {
      const g = new Float64Array(N);
      for (let t = 0; t < N; t++) g[t] = (mode === 'wake' ? 0.7 * post[0][Math.max(0, t - 3)] : 0.05 * post[0][t]) + randn();
      return g;
    });
    const body = Array.from({ length: 2 }, () => {
      const g = new Float64Array(N);
      for (let t = 0; t < N; t++) g[t] = (mode === 'wake' ? 0.8 * post[0][t] : 0.02 * post[0][t]) + randn();
      return g;
    });
    return extractH1Features(post, front, body, sfreq);
  };

  const wake = [], ket = [], prop = [];
  for (let i = 0; i < 5; i++) {
    wake.push(makeCohort('wake', 100 + i));
    ket.push(makeCohort('ketamine', 200 + i));
    prop.push(makeCohort('propofol', 300 + i));
  }
  const metrics = ['slopeBB', 'lzc', 'dfa', 'crossIrrevPost', 'psiAlpha', 'tpjBodyCoupling'];
  const ketVsProp = {}, ketVsWake = {};
  for (const m of metrics) {
    ketVsProp[m] = exactPairedSignFlip(ket.map((x, i) => x[m] - prop[i][m]));
    ketVsWake[m] = exactPairedSignFlip(ket.map((x, i) => x[m] - wake[i][m]));
  }
  console.log('\nKetamine vs Propofol (H1a: Layer 1 Preserved):');
  console.table(ketVsProp);
  console.log('\nKetamine vs Wake (H1b/H1c: Layer 2 Offline & Right-TPJ Body Decoupling):');
  console.table(ketVsWake);
}

async function main() {
  const args = new Set(process.argv.slice(2));
  if (args.has('--fetch')) { await fetchZenodo806176(); return; }
  if (args.has('--self-test')) { runSelfTest(); return; }

  if (!fs.existsSync(DATA_DIR)) {
    console.log(`No local Zenodo 806176 files found in ${DATA_DIR}.`);
    console.log('Run `node audit_h1_zenodo806176_ketamine.js --fetch` to download, or `--self-test` to verify pipeline.');
    return;
  }
  const edfs = fs.readdirSync(DATA_DIR).filter((f) => f.toLowerCase().endsWith('.edf'));
  if (!edfs.length) {
    console.log(`Found ${DATA_DIR} but 0 .edf files. Convert/extract Zenodo 806176 archives into ${DATA_DIR} and re-run.`);
    return;
  }

  const rows = [];
  for (const fname of edfs) {
    const edf = readEDF(path.join(DATA_DIR, fname));
    const sfreq = Math.round(edf.sfreqs[0] || 200);
    const car = applyCAR(edf.signals);
    const pick = (re) => edf.labels.map((l, idx) => (re.test(l) ? car[idx] : null)).filter(Boolean);
    const post = pick(/^(P[0-9z]|PO|O[12z]|TP|CP)/i);
    const front = pick(/^(F[p0-9z]|AF)/i);
    const body = pick(/^(C[1-6z])/i);
    if (post.length >= 2 && front.length >= 1 && body.length >= 1) {
      rows.push({ file: fname, sfreq, ...extractH1Features(post, front, body, sfreq) });
    }
  }
  fs.writeFileSync(OUT_PATH, JSON.stringify({ S_PHYS_WEIGHTS, nRecordings: rows.length, rows }, null, 2));
  console.table(rows);
  console.log(`Saved -> ${OUT_PATH}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
