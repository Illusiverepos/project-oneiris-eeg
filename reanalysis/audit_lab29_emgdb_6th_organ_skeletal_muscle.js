'use strict';

/**
 * Project ONEIRIS — Lab #29: 6TH HUMAN ORGAN SYSTEM — SKELETAL MUSCLE (Electromyography / EMG)
 * Dataset: PhysioNet Examples of Electromyograms (emgdb v1.0.0 — Healthy, Myopathy, Neuropathy, 4000 Hz)
 *
 * Tests whether the Universal Wiener-Khinchin Law:
 *     slope = -(2 * DFA_alpha - 1)   ==>   Delta_WK = slope + (2 * DFA_alpha - 1)
 * holds on human skeletal muscle motor-unit electrical activity (6th Organ System!) across
 * 1-second non-overlapping windows, and compares Healthy vs. Myopathy vs. Neuropathy!
 *
 * Output: reanalysis/data/lab29_emgdb_6th_organ_skeletal_muscle_results.json
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://physionet.org/files/emgdb/1.0.0';
const OUT_PATH = path.join(__dirname, 'data', 'lab29_emgdb_6th_organ_skeletal_muscle_results.json');

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

function computeDFA(sig, scales) {
  const N = sig.length;
  let mean = 0; for (let i = 0; i < N; i++) mean += sig[i]; mean /= N;
  const y = new Float64Array(N);
  let s = 0; for (let i = 0; i < N; i++) { s += sig[i] - mean; y[i] = s; }
  const xs = [], ys = [];
  for (const sc of scales.filter((v) => v * 4 <= N)) {
    const nSeg = Math.floor(N / sc);
    let f2 = 0;
    for (let seg = 0; seg < nSeg; seg++) {
      const off = seg * sc, mx = (sc - 1) / 2;
      let my = 0; for (let k = 0; k < sc; k++) my += y[off + k]; my /= sc;
      let num = 0, den = 0;
      for (let k = 0; k < sc; k++) { const dx = k - mx; num += dx * (y[off + k] - my); den += dx * dx; }
      const b = num / den, a = my - b * mx;
      for (let k = 0; k < sc; k++) { const e = y[off + k] - (a + b * k); f2 += e * e; }
    }
    const rms = Math.sqrt(f2 / (nSeg * sc));
    if (rms > 0) { xs.push(Math.log10(sc)); ys.push(Math.log10(rms)); }
  }
  const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  return den > 0 ? num / den : NaN;
}

function computeSlopeUniform(u, fs, fLow, fHigh, nfft = 512) {
  const step = nfft / 2, half = nfft / 2 + 1;
  const win = new Float64Array(nfft);
  for (let i = 0; i < nfft; i++) win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (nfft - 1)));
  const psd = new Float64Array(half); let segs = 0;
  for (let st = 0; st + nfft <= u.length; st += step) {
    let m = 0; for (let i = 0; i < nfft; i++) m += u[st + i]; m /= nfft;
    const re = new Float64Array(nfft), im = new Float64Array(nfft);
    for (let i = 0; i < nfft; i++) re[i] = (u[st + i] - m) * win[i];
    fft(re, im);
    for (let k = 1; k < half; k++) psd[k] += re[k] * re[k] + im[k] * im[k];
    segs++;
  }
  const df = fs / nfft, xs = [], ys = [];
  for (let k = 1; k < half; k++) {
    const f = k * df;
    if (f >= fLow && f <= fHigh) { xs.push(Math.log10(f)); ys.push(Math.log10(psd[k] / segs + 1e-18)); }
  }
  const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  return den > 0 ? num / den : NaN;
}

function pearsonR(x, y) {
  const n = x.length, mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) { num += (x[i] - mx) * (y[i] - my); dx2 += (x[i] - mx) ** 2; dy2 += (y[i] - my) ** 2; }
  return dx2 > 0 && dy2 > 0 ? num / Math.sqrt(dx2 * dy2) : 0;
}

function permP(x, y, nPerm = 10000) {
  const rObs = Math.abs(pearsonR(x, y)), yy = [...y];
  let ge = 0, seed = 202629;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let p = 0; p < nPerm; p++) {
    for (let i = yy.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [yy[i], yy[j]] = [yy[j], yy[i]]; }
    if (Math.abs(pearsonR(x, yy)) >= rObs) ge++;
  }
  return (ge + 1) / (nPerm + 1);
}

async function main() {
  console.log('=== Lab #29: 6TH HUMAN ORGAN SYSTEM — SKELETAL MUSCLE (PhysioNet emgdb, 4000 Hz) ===');
  const recs = ['emg_healthy', 'emg_myopathy', 'emg_neuropathy'];
  const allWindows = [];
  const byCondition = {};

  for (const rec of recs) {
    const txt = await fetch(`${BASE_URL}/${rec}.txt`).then((r) => r.text());
    const vals = [];
    for (const ln of txt.trim().split(/\r?\n/)) {
      const p = ln.trim().split(/\s+/);
      if (p.length >= 2) vals.push(parseFloat(p[1]));
    }
    const fs = 4000, winN = 2000; // 0.5 s windows -> ~25-70 windows per muscle condition
    const scales = [8, 12, 16, 24, 32, 48, 64, 96, 128];
    const wins = [];
    for (let s = 0; s + winN <= vals.length; s += winN) {
      const seg = vals.slice(s, s + winN);
      const dfa = computeDFA(seg, scales);
      const slope = computeSlopeUniform(seg, fs, 30, 500, 512);
      const deltaWK = slope + (2 * dfa - 1);
      if (Number.isFinite(dfa) && Number.isFinite(slope)) {
        const w = { rec, dfa, slope, wkPred: -(2 * dfa - 1), deltaWK };
        wins.push(w);
        allWindows.push(w);
      }
    }
    const mean = (k) => +(wins.reduce((a, b) => a + b[k], 0) / wins.length).toFixed(4);
    byCondition[rec] = { nWindows: wins.length, meanDFA: mean('dfa'), meanSlope: mean('slope'), meanDeltaWK: mean('deltaWK') };
    console.log(`  ${rec.padEnd(16)} (${wins.length} x 0.5s windows) | DFA=${mean('dfa')}, Slope=${mean('slope')}, Δ_WK=${mean('deltaWK')}`);
  }

  const rWK = pearsonR(allWindows.map((w) => w.slope), allWindows.map((w) => w.wkPred));
  const pWK = permP(allWindows.map((w) => w.slope), allWindows.map((w) => w.wkPred), 10000);
  console.log(`\n[6TH ORGAN SYSTEM — SKELETAL MUSCLE WIENER-KHINCHIN LAW (N=${allWindows.length} windows)]:`);
  console.log(`  slope vs -(2*DFA - 1): r = ${rWK.toFixed(4)}, R^2 = ${(rWK * rWK * 100).toFixed(1)}%, perm p = ${pWK.toExponential(2)}`);

  const out = {
    lab: 'Lab #29 — 6th Human Organ System: Skeletal Muscle EMG (PhysioNet emgdb)',
    nWindowsTotal: allWindows.length,
    wienerKhinchinLaw: { r: +rWK.toFixed(4), r2: +(rWK * rWK).toFixed(4), permP: pWK },
    byCondition
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
  console.log(`Saved -> ${OUT_PATH}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
