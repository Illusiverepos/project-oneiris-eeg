'use strict';

/**
 * Project ONEIRIS — Lab #31 (Option B Cross-Test on Human Locomotion):
 *   Fourier Phase-Randomized Surrogate Proof on Human Walking (PhysioNet gaitndd, N = 62:
 *   16 Healthy Controls, 19 Huntington's, 15 Parkinson's, 12 ALS)
 *
 * Cross-tests whether ALS's broken Δ_WK_Gait (d = -0.930, p = 0.0199) and healthy walking Δ_WK
 * reflect linear multi-scale spectral-crossover curvature (survives phase randomization, like Heart)
 * OR genuine nonlinear motor-neuron phase coupling (collapses in surrogates, like Arterial BP).
 *
 * Output: reanalysis/data/lab31_gaitndd_fourier_surrogates_results.json
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://physionet.org/files/gaitndd/1.0.0';
const OUT_PATH = path.join(__dirname, 'data', 'lab31_gaitndd_fourier_surrogates_results.json');

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
  if (xs.length < 3) return NaN;
  const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  return den > 0 ? num / den : NaN;
}

function computeSlopeBeatDomain(sig, nfft = 128, fLow = 0.02, fHigh = 0.25) {
  if (sig.length < nfft) return NaN;
  const step = nfft / 2, half = nfft / 2 + 1;
  const win = new Float64Array(nfft);
  for (let i = 0; i < nfft; i++) win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (nfft - 1)));
  const psd = new Float64Array(half); let segs = 0;
  for (let st = 0; st + nfft <= sig.length; st += step) {
    let m = 0; for (let i = 0; i < nfft; i++) m += sig[st + i]; m /= nfft;
    const re = new Float64Array(nfft), im = new Float64Array(nfft);
    for (let i = 0; i < nfft; i++) re[i] = (sig[st + i] - m) * win[i];
    fft(re, im, false);
    for (let k = 1; k < half; k++) psd[k] += re[k] * re[k] + im[k] * im[k];
    segs++;
  }
  if (segs === 0) return NaN;
  const df = 1.0 / nfft, xs = [], ys = [];
  for (let k = 1; k < half; k++) {
    const f = k * df;
    if (f >= fLow && f <= fHigh) { xs.push(Math.log10(f)); ys.push(Math.log10(psd[k] / segs + 1e-18)); }
  }
  const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  return den > 0 ? num / den : NaN;
}

function cleanStrides(arr) {
  const valid = arr.filter((v) => Number.isFinite(v) && v >= 0.4 && v <= 3.0);
  if (valid.length < 64) return [];
  const sorted = [...valid].sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)];
  const mad = sorted.map((v) => Math.abs(v - med)).sort((a, b) => a - b)[Math.floor(sorted.length / 2)] || 0.05;
  return valid.filter((v) => v >= med - 4.5 * 1.4826 * mad && v <= med + 4.5 * 1.4826 * mad);
}

function cohenDAndPermP(a, b, nPerm = 10000) {
  const ma = a.reduce((s, v) => s + v, 0) / a.length, mb = b.reduce((s, v) => s + v, 0) / b.length;
  const va = a.reduce((s, v) => s + (v - ma) ** 2, 0) / (a.length - 1);
  const vb = b.reduce((s, v) => s + (v - mb) ** 2, 0) / (b.length - 1);
  const sp = Math.sqrt(((a.length - 1) * va + (b.length - 1) * vb) / (a.length + b.length - 2)) || 1e-9;
  const diffObs = Math.abs(ma - mb), all = [...a, ...b];
  let ge = 0, seed = 202631;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let p = 0; p < nPerm; p++) {
    for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
    let s1 = 0, s2 = 0;
    for (let i = 0; i < a.length; i++) s1 += all[i];
    for (let i = a.length; i < all.length; i++) s2 += all[i];
    if (Math.abs(s1 / a.length - s2 / b.length) >= diffObs) ge++;
  }
  return { meanA: +ma.toFixed(4), meanB: +mb.toFixed(4), d: +((ma - mb) / sp).toFixed(3), p: +((ge + 1) / (nPerm + 1)).toFixed(5) };
}

function pairedPerm(a, b, nPerm = 10000) {
  const d = a.map((v, i) => v - b[i]), n = d.length;
  const m = d.reduce((s, v) => s + v, 0) / n;
  const sd = Math.sqrt(d.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, n - 1)) || 1e-9;
  let ge = 0, seed = 2026319;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let p = 0; p < nPerm; p++) {
    let s = 0; for (let i = 0; i < n; i++) s += (rand() < 0.5 ? 1 : -1) * d[i];
    if (Math.abs(s / n) >= Math.abs(m)) ge++;
  }
  return { meanA: +(a.reduce((x, y) => x + y, 0) / n).toFixed(4), meanB: +(b.reduce((x, y) => x + y, 0) / n).toFixed(4), t: +(m / (sd / Math.sqrt(n))).toFixed(3), p: +((ge + 1) / (nPerm + 1)).toFixed(5) };
}

async function main() {
  console.log('=== Lab #31: Fourier Phase-Randomized Surrogates on Human Locomotion (gaitndd, N=62) ===');
  const metaText = await (await fetch(`${BASE_URL}/subject-description.txt`)).text();
  const ids = metaText.trim().split(/\r?\n/).slice(1).map((ln) => ln.trim().split(/\t+/)[0]).filter(Boolean);
  const scales = [4, 6, 8, 12, 16, 24, 32, 48];

  const rows = [];
  let cursor = 0;
  async function worker() {
    while (cursor < ids.length) {
      const idx = cursor++;
      const id = ids[idx];
      try {
        const res = await fetch(`${BASE_URL}/${id}.ts`);
        if (!res.ok) continue;
        const txt = await res.text();
        const left = [], right = [];
        for (const ln of txt.trim().split(/\r?\n/)) {
          const c = ln.trim().split(/\s+/);
          if (c.length >= 3) { left.push(parseFloat(c[1])); right.push(parseFloat(c[2])); }
        }
        const cL = cleanStrides(left), cR = cleanStrides(right);
        if (cL.length < 128 || cR.length < 128) continue;
        const sL = phaseRand(cL, (idx + 1) * 7919 + 3);
        const sR = phaseRand(cR, (idx + 1) * 7919 + 17);
        const realWK = 0.5 * ((computeSlopeBeatDomain(cL) + (2 * computeDFA(cL, scales) - 1)) + (computeSlopeBeatDomain(cR) + (2 * computeDFA(cR, scales) - 1)));
        const surrWK = 0.5 * ((computeSlopeBeatDomain(sL) + (2 * computeDFA(sL, scales) - 1)) + (computeSlopeBeatDomain(sR) + (2 * computeDFA(sR, scales) - 1)));
        if (Number.isFinite(realWK) && Number.isFinite(surrWK)) {
          rows.push({ id, group: id.replace(/\d+$/, '').toLowerCase(), realWK, surrWK, residWK: realWK - surrWK });
        }
      } catch {}
    }
  }
  await Promise.all(Array.from({ length: 6 }, () => worker()));

  const ctrl = rows.filter((r) => r.group === 'control');
  const als = rows.filter((r) => r.group === 'als');
  const hunt = rows.filter((r) => r.group === 'hunt');

  const out = {
    lab: 'Lab #31 — Fourier Phase-Randomized Surrogates on Human Locomotion (gaitndd)',
    nTotal: rows.length,
    allRealVsSurr_Signed: pairedPerm(rows.map((r) => r.realWK), rows.map((r) => r.surrWK)),
    allRealVsSurr_Abs: pairedPerm(rows.map((r) => Math.abs(r.realWK)), rows.map((r) => Math.abs(r.surrWK))),
    ALS_vs_Ctrl_RealWK: cohenDAndPermP(als.map((r) => r.realWK), ctrl.map((r) => r.realWK)),
    ALS_vs_Ctrl_SurrWK: cohenDAndPermP(als.map((r) => r.surrWK), ctrl.map((r) => r.surrWK)),
    ALS_vs_Ctrl_NonlinearResid: cohenDAndPermP(als.map((r) => r.residWK), ctrl.map((r) => r.residWK)),
    HD_vs_Ctrl_RealWK: cohenDAndPermP(hunt.map((r) => r.realWK), ctrl.map((r) => r.realWK)),
    HD_vs_Ctrl_SurrWK: cohenDAndPermP(hunt.map((r) => r.surrWK), ctrl.map((r) => r.surrWK))
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
  console.log(`Analyzed N=${rows.length} walkers (Ctrl=${ctrl.length}, ALS=${als.length}, HD=${hunt.length}):`);
  console.log('  ALL Real vs Surr (Signed):', out.allRealVsSurr_Signed);
  console.log('  ALL |Real| vs |Surr|:     ', out.allRealVsSurr_Abs);
  console.log('  ALS vs Ctrl REAL Δ_WK:    ', out.ALS_vs_Ctrl_RealWK);
  console.log('  ALS vs Ctrl SURR Δ_WK:    ', out.ALS_vs_Ctrl_SurrWK);
  console.log('  ALS vs Ctrl NONLINEAR:    ', out.ALS_vs_Ctrl_NonlinearResid);
  console.log(`Saved -> ${OUT_PATH}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
