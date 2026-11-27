'use strict';

/**
 * Project ONEIRIS — Lab #23: 4th Human Organ System — Locomotion / Gait Stride Intervals
 * (PhysioNet gaitndd v1.0.0 — Hausdorff et al., N = 64 humans:
 *  16 Healthy Controls [ages 20-74], 15 Parkinson's, 20 Huntington's, 13 ALS)
 *
 * Tests whether the universal Wiener-Khinchin scaling law:
 *     slope = -(2 * DFA_alpha - 1)   ==>   Delta_WK = slope + (2 * DFA_alpha - 1)
 * holds on human walking stride-to-stride intervals (left + right stride series),
 * and evaluates group differences across Healthy Controls vs Parkinson's, Huntington's, and ALS.
 *
 * Output: reanalysis/data/lab23_gaitndd_locomotion_wk_results.json
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://physionet.org/files/gaitndd/1.0.0';
const OUT_PATH = path.join(__dirname, 'data', 'lab23_gaitndd_locomotion_wk_results.json');

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let j = 0; j < len / 2; j++) {
        const ur = re[i + j], ui = im[i + j];
        const vr = re[i + j + len / 2] * cr - im[i + j + len / 2] * ci;
        const vi = re[i + j + len / 2] * ci + im[i + j + len / 2] * cr;
        re[i + j] = ur + vr; im[i + j] = ui + vi;
        re[i + j + len / 2] = ur - vr; im[i + j + len / 2] = ui - vi;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

function computeDFA(sig, scales) {
  const N = sig.length;
  const mean = sig.reduce((a, b) => a + b, 0) / N;
  const y = new Float64Array(N);
  let s = 0;
  for (let i = 0; i < N; i++) { s += sig[i] - mean; y[i] = s; }
  const xs = [], ys = [];
  for (const sc of scales.filter((v) => v * 4 <= N)) {
    const nSeg = Math.floor(N / sc);
    let f2 = 0;
    for (let seg = 0; seg < nSeg; seg++) {
      const off = seg * sc, mx = (sc - 1) / 2;
      let my = 0;
      for (let k = 0; k < sc; k++) my += y[off + k];
      my /= sc;
      let num = 0, den = 0;
      for (let k = 0; k < sc; k++) {
        const dx = k - mx;
        num += dx * (y[off + k] - my);
        den += dx * dx;
      }
      const b = num / den, a = my - b * mx;
      for (let k = 0; k < sc; k++) {
        const e = y[off + k] - (a + b * k);
        f2 += e * e;
      }
    }
    const rms = Math.sqrt(f2 / (nSeg * sc));
    if (rms > 0) { xs.push(Math.log10(sc)); ys.push(Math.log10(rms)); }
  }
  if (xs.length < 3) return NaN;
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den > 0 ? num / den : NaN;
}

function computeSlopeBeatDomain(sig, nfft = 128, fLow = 0.02, fHigh = 0.25) {
  if (sig.length < nfft) return NaN;
  const step = nfft / 2, half = nfft / 2 + 1;
  const win = new Float64Array(nfft);
  for (let i = 0; i < nfft; i++) win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (nfft - 1)));
  const psd = new Float64Array(half);
  let segs = 0;
  for (let st = 0; st + nfft <= sig.length; st += step) {
    let m = 0;
    for (let i = 0; i < nfft; i++) m += sig[st + i];
    m /= nfft;
    const re = new Float64Array(nfft), im = new Float64Array(nfft);
    for (let i = 0; i < nfft; i++) re[i] = (sig[st + i] - m) * win[i];
    fft(re, im);
    for (let k = 1; k < half; k++) psd[k] += re[k] * re[k] + im[k] * im[k];
    segs++;
  }
  if (segs === 0) return NaN;
  const df = 1.0 / nfft; // cycles per stride
  const xs = [], ys = [];
  for (let k = 1; k < half; k++) {
    const f = k * df;
    if (f >= fLow && f <= fHigh) {
      xs.push(Math.log10(f));
      ys.push(Math.log10(psd[k] / segs + 1e-18));
    }
  }
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den > 0 ? num / den : NaN;
}

function cleanStrides(arr) {
  // Remove extreme turn-around / outlier strides (>3 SD from median)
  const valid = arr.filter((v) => Number.isFinite(v) && v >= 0.4 && v <= 3.0);
  if (valid.length < 64) return [];
  const sorted = [...valid].sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)];
  const mad = sorted.map((v) => Math.abs(v - med)).sort((a, b) => a - b)[Math.floor(sorted.length / 2)] || 0.05;
  const lo = med - 4.5 * 1.4826 * mad;
  const hi = med + 4.5 * 1.4826 * mad;
  return valid.filter((v) => v >= lo && v <= hi);
}

function pearsonR(x, y) {
  const n = x.length;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    num += (x[i] - mx) * (y[i] - my);
    dx2 += (x[i] - mx) ** 2;
    dy2 += (y[i] - my) ** 2;
  }
  return dx2 > 0 && dy2 > 0 ? num / Math.sqrt(dx2 * dy2) : 0;
}

function permPValCorr(x, y, nPerm = 10000) {
  const rObs = Math.abs(pearsonR(x, y));
  const yy = [...y];
  let ge = 0;
  let seed = 202623;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let p = 0; p < nPerm; p++) {
    for (let i = yy.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [yy[i], yy[j]] = [yy[j], yy[i]];
    }
    if (Math.abs(pearsonR(x, yy)) >= rObs) ge++;
  }
  return (ge + 1) / (nPerm + 1);
}

function cohenDAndPermP(a, b, nPerm = 10000) {
  const ma = a.reduce((s, v) => s + v, 0) / a.length;
  const mb = b.reduce((s, v) => s + v, 0) / b.length;
  const va = a.reduce((s, v) => s + (v - ma) ** 2, 0) / (a.length - 1);
  const vb = b.reduce((s, v) => s + (v - mb) ** 2, 0) / (b.length - 1);
  const sp = Math.sqrt(((a.length - 1) * va + (b.length - 1) * vb) / (a.length + b.length - 2));
  const d = sp > 0 ? (ma - mb) / sp : 0;
  const diffObs = Math.abs(ma - mb);
  const all = [...a, ...b];
  let ge = 0;
  let seed = 2026239;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let p = 0; p < nPerm; p++) {
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    let s1 = 0, s2 = 0;
    for (let i = 0; i < a.length; i++) s1 += all[i];
    for (let i = a.length; i < all.length; i++) s2 += all[i];
    if (Math.abs(s1 / a.length - s2 / b.length) >= diffObs) ge++;
  }
  return { meanA: ma, meanB: mb, d, p: (ge + 1) / (nPerm + 1) };
}

function computeAUC(pos, neg) {
  let wins = 0;
  for (const p of pos) for (const n of neg) wins += p > n ? 1 : (p === n ? 0.5 : 0);
  return wins / (pos.length * neg.length);
}

async function main() {
  console.log('=== Project ONEIRIS — Lab #23: 4th Human Organ System (Locomotion / Gait Strides) ===');
  const metaText = await (await fetch(`${BASE_URL}/subject-description.txt`)).text();
  const lines = metaText.trim().split(/\r?\n/).slice(1);
  const meta = lines.map((line) => {
    const cols = line.trim().split(/\t+/);
    return {
      id: cols[0],
      group: (cols[0] || '').replace(/\d+$/, '').toLowerCase(),
      age: parseFloat(cols[2]),
      height: parseFloat(cols[3]),
      weight: parseFloat(cols[4]),
      gender: cols[5],
      gaitSpeed: parseFloat(cols[6]),
      severity: parseFloat(cols[7])
    };
  }).filter((m) => m.id && m.group);

  console.log(`Loaded metadata for ${meta.length} humans.`);

  const scales = [4, 6, 8, 12, 16, 24, 32, 48];
  const subjects = [];

  for (const m of meta) {
    const res = await fetch(`${BASE_URL}/${m.id}.ts`);
    if (!res.ok) continue;
    const txt = await res.text();
    const left = [], right = [];
    for (const ln of txt.trim().split(/\r?\n/)) {
      const c = ln.trim().split(/\s+/);
      if (c.length >= 3) {
        left.push(parseFloat(c[1]));
        right.push(parseFloat(c[2]));
      }
    }
    const cL = cleanStrides(left);
    const cR = cleanStrides(right);
    if (cL.length < 128 || cR.length < 128) continue;

    const dfaL = computeDFA(cL, scales), dfaR = computeDFA(cR, scales);
    const slpL = computeSlopeBeatDomain(cL, 128, 0.02, 0.25);
    const slpR = computeSlopeBeatDomain(cR, 128, 0.02, 0.25);
    const dfa = 0.5 * (dfaL + dfaR);
    const slope = 0.5 * (slpL + slpR);
    const wkPred = -(2 * dfa - 1);
    const deltaWK = slope + (2 * dfa - 1);
    const meanStride = cL.reduce((a, b) => a + b, 0) / cL.length;
    const cvStride = Math.sqrt(cL.reduce((a, b) => a + (b - meanStride) ** 2, 0) / cL.length) / meanStride;

    if (Number.isFinite(dfa) && Number.isFinite(slope)) {
      subjects.push({
        ...m,
        nStrides: Math.min(cL.length, cR.length),
        dfa,
        slope,
        wkPred,
        deltaWK,
        meanStride,
        cvStride
      });
    }
  }

  console.log(`Successfully analyzed N = ${subjects.length} humans.`);

  // 1. Universal Wiener-Khinchin Law on Human Locomotion (all N)
  const slopes = subjects.map((s) => s.slope);
  const wkPreds = subjects.map((s) => s.wkPred);
  const rWK = pearsonR(slopes, wkPreds);
  const pWK = permPValCorr(slopes, wkPreds, 10000);
  console.log(`\n[1] UNIVERSAL WIENER-KHINCHIN LAW ON HUMAN GAIT (N=${subjects.length}):`);
  console.log(`    slope vs -(2*DFA - 1): r = ${rWK.toFixed(4)}, R^2 = ${(rWK * rWK * 100).toFixed(1)}%, perm p = ${pWK.toExponential(2)}`);

  // 2. Group comparisons: Neurodegenerative vs Controls
  const ctrl = subjects.filter((s) => s.group === 'control');
  const groups = ['hunt', 'park', 'als'];
  const groupComparisons = {};
  console.log(`\n[2] NEURODEGENERATIVE LOCOMOTION vs HEALTHY CONTROLS (Control n=${ctrl.length}):`);
  for (const g of groups) {
    const grp = subjects.filter((s) => s.group === g);
    const resDfa = cohenDAndPermP(grp.map((s) => s.dfa), ctrl.map((s) => s.dfa));
    const resSlp = cohenDAndPermP(grp.map((s) => s.slope), ctrl.map((s) => s.slope));
    const resWK = cohenDAndPermP(grp.map((s) => s.deltaWK), ctrl.map((s) => s.deltaWK));
    const resCV = cohenDAndPermP(grp.map((s) => s.cvStride), ctrl.map((s) => s.cvStride));
    const aucDfa = computeAUC(ctrl.map((s) => s.dfa), grp.map((s) => s.dfa));
    const aucWK = computeAUC(grp.map((s) => s.deltaWK), ctrl.map((s) => s.deltaWK));
    groupComparisons[g] = { n: grp.length, dfa: resDfa, slope: resSlp, deltaWK: resWK, cvStride: resCV, aucDfaLow: aucDfa, aucWK };
    console.log(`  ${g.toUpperCase()} (n=${grp.length}) vs CTRL:`);
    console.log(`    DFA_alpha: ${resDfa.meanA.toFixed(3)} vs ${resDfa.meanB.toFixed(3)} | d=${resDfa.d.toFixed(3)}, p=${resDfa.p.toFixed(5)}, AUC=${aucDfa.toFixed(3)}`);
    console.log(`    Slope:     ${resSlp.meanA.toFixed(3)} vs ${resSlp.meanB.toFixed(3)} | d=${resSlp.d.toFixed(3)}, p=${resSlp.p.toFixed(5)}`);
    console.log(`    Delta_WK:  ${resWK.meanA.toFixed(3)} vs ${resWK.meanB.toFixed(3)} | d=${resWK.d.toFixed(3)}, p=${resWK.p.toFixed(5)}, AUC=${Math.max(aucWK, 1 - aucWK).toFixed(3)}`);
    console.log(`    CV_Stride: ${resCV.meanA.toFixed(4)} vs ${resCV.meanB.toFixed(4)} | d=${resCV.d.toFixed(3)}, p=${resCV.p.toFixed(5)}`);
  }

  // All Neurodegenerative pooled vs Controls
  const ndd = subjects.filter((s) => s.group !== 'control');
  const poolDfa = cohenDAndPermP(ndd.map((s) => s.dfa), ctrl.map((s) => s.dfa));
  const poolSlp = cohenDAndPermP(ndd.map((s) => s.slope), ctrl.map((s) => s.slope));
  const poolWK = cohenDAndPermP(ndd.map((s) => s.deltaWK), ctrl.map((s) => s.deltaWK));
  const aucPoolDfa = computeAUC(ctrl.map((s) => s.dfa), ndd.map((s) => s.dfa));
  console.log(`  ALL NDD POOLED (n=${ndd.length}) vs CTRL (n=${ctrl.length}):`);
  console.log(`    DFA_alpha: d=${poolDfa.d.toFixed(3)}, p=${poolDfa.p.toFixed(5)}, AUC=${aucPoolDfa.toFixed(3)}`);
  console.log(`    Slope:     d=${poolSlp.d.toFixed(3)}, p=${poolSlp.p.toFixed(5)}`);
  console.log(`    Delta_WK:  d=${poolWK.d.toFixed(3)}, p=${poolWK.p.toFixed(5)}`);

  // 3. Healthy Aging in Controls (n = 16, ages 20-74)
  const ctrlAges = ctrl.map((s) => s.age);
  const rAgeWK = pearsonR(ctrlAges, ctrl.map((s) => s.deltaWK));
  const pAgeWK = permPValCorr(ctrlAges, ctrl.map((s) => s.deltaWK));
  const rAgeDFA = pearsonR(ctrlAges, ctrl.map((s) => s.dfa));
  const pAgeDFA = permPValCorr(ctrlAges, ctrl.map((s) => s.dfa));
  console.log(`\n[3] HEALTHY AGING IN CONTROLS (n=${ctrl.length}, ages ${Math.min(...ctrlAges)}-${Math.max(...ctrlAges)}):`);
  console.log(`    Age vs Delta_WK: r=${rAgeWK.toFixed(4)}, p=${pAgeWK.toFixed(4)}`);
  console.log(`    Age vs DFA:      r=${rAgeDFA.toFixed(4)}, p=${pAgeDFA.toFixed(4)}`);

  const out = {
    lab: 'Lab #23 — 4th Human Organ System (Locomotion / Gait Stride Intervals, PhysioNet gaitndd)',
    nTotal: subjects.length,
    wienerKhinchinLaw: { r: rWK, r2: rWK * rWK, permP: pWK },
    groupComparisons,
    pooledNDDvsCtrl: { nNDD: ndd.length, nCtrl: ctrl.length, dfa: poolDfa, slope: poolSlp, deltaWK: poolWK, aucDfaLow: aucPoolDfa },
    healthyControlAging: { n: ctrl.length, ageRange: [Math.min(...ctrlAges), Math.max(...ctrlAges)], deltaWK: { r: rAgeWK, p: pAgeWK }, dfa: { r: rAgeDFA, p: pAgeDFA } },
    subjects
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
  console.log(`\nSaved -> ${OUT_PATH}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
