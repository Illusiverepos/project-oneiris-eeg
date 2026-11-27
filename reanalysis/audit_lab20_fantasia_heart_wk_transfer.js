'use strict';

/**
 * Project ONEIRIS — Lab #20: BRAIN-TO-HEART WIENER–KHINCHIN TRANSFER TEST (HRV / Smartwatches!)
 * Dataset: PhysioNet Fantasia Database (40 humans: 20 Young 21–34 yrs vs. 20 Older 68–85 yrs, 250 Hz ECG)
 *
 * Streams a 15-minute raw ECG slice per human via HTTP Range, extracts beat-to-beat RR intervals,
 * and computes the EXACT SAME Wiener–Khinchin scaling triad used in our 18-lab brain atlas:
 *   - slopeRR (1/f log-log power-law slope of RR interval spectrum, 0.01–0.15 Hz)
 *   - DFA α_RR (Detrended Fluctuation Analysis scaling exponent of RR intervals)
 *   - Δ_WK_HRV = slopeRR + (2 * DFA_RR - 1) (Wiener-Khinchin Violation Index on the HUMAN HEART!)
 *   - Plus standard RMSSD & SDNN for head-to-head comparison.
 *
 * Tests:
 *   1. Does the Wiener-Khinchin law slopeRR = -(2*DFA_RR - 1) hold on the human heart?
 *   2. Does Heart Aging (Young 21–34 vs. Older 68–85) shift slopeRR, DFA_RR, and Δ_WK_HRV
 *      — unlocking smartwatch/smart-ring (Apple Watch, Oura, Whoop) applications?
 *
 * Output: reanalysis/data/lab20_fantasia_heart_wk_transfer_results.json
 */

const fs = require('fs');
const path = require('path');

const PHYSIO_BASE = 'https://physionet.org/files/fantasia/1.0.0/';
const OUT_PATH = path.join(__dirname, 'data', 'lab20_fantasia_heart_wk_transfer_results.json');

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

function detectRR(ecg, sfreq = 250) {
  // Simple robust Pan-Tompkins-style derivative + squared moving average R-peak detector
  const N = ecg.length;
  const energy = new Float64Array(N);
  for (let i = 2; i < N - 2; i++) {
    const d = ecg[i + 1] - ecg[i - 1];
    energy[i] = d * d;
  }
  // Smooth energy over 60 ms (15 samples)
  const sm = new Float64Array(N);
  let acc = 0;
  for (let i = 0; i < N; i++) {
    acc += energy[i];
    if (i >= 15) acc -= energy[i - 15];
    sm[i] = acc / 15;
  }
  // Adaptive threshold: 85th percentile * 1.4 or robust mean
  const sorted = Array.from(sm.subarray(250, Math.min(N, 25000))).sort((a, b) => a - b);
  const thr = Math.max(sorted[Math.floor(sorted.length * 0.94)] * 0.6, 1e-6);
  const minDist = Math.round(0.35 * sfreq); // max ~170 bpm
  const peaks = [];
  for (let i = 250; i < N - 250; i++) {
    if (sm[i] > thr && sm[i] >= sm[i - 1] && sm[i] >= sm[i + 1]) {
      if (!peaks.length || i - peaks[peaks.length - 1] >= minDist) {
        // Refine to local max of raw ECG within +-12 samples
        let best = i, bestV = Math.abs(ecg[i]);
        for (let k = i - 12; k <= i + 12; k++) if (Math.abs(ecg[k]) > bestV) { bestV = Math.abs(ecg[k]); best = k; }
        peaks.push(best);
        i += minDist - 1;
      }
    }
  }
  const rr = [];
  for (let i = 1; i < peaks.length; i++) {
    const dt = (peaks[i] - peaks[i - 1]) / sfreq;
    if (dt >= 0.40 && dt <= 1.80) rr.push(dt); // physiological RR (33..150 bpm)
  }
  // Remove ectopic outliers (> 25% jump from local median)
  const clean = [];
  for (let i = 1; i < rr.length - 1; i++) {
    const med = (rr[i - 1] + rr[i + 1]) / 2;
    if (Math.abs(rr[i] - med) / med < 0.25) clean.push(rr[i]);
  }
  return clean;
}

function computeDFA_RR(rr) {
  const N = rr.length;
  const mean = rr.reduce((a, b) => a + b, 0) / N;
  const y = new Float64Array(N);
  let s = 0; for (let i = 0; i < N; i++) { s += rr[i] - mean; y[i] = s; }
  const scales = [4, 6, 8, 12, 16, 24, 32, 48, 64, 96].filter((sc) => sc * 4 <= N);
  const xs = [], ys = [];
  for (const sc of scales) {
    const nSeg = Math.floor(N / sc);
    let f2 = 0;
    for (let seg = 0; seg < nSeg; seg++) {
      const off = seg * sc;
      const mx = (sc - 1) / 2;
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
  return den > 0 ? num / den : 1.0;
}

function computeSlopeRR(rr) {
  // Resample RR uniformly at 2 Hz for clean PSD 1/f slope (0.01..0.15 Hz)
  const fs = 2.0, nfft = 256;
  const ts = [0]; for (let i = 0; i < rr.length; i++) ts.push(ts[i] + rr[i]);
  const totalT = ts[ts.length - 1];
  const nU = Math.floor(totalT * fs);
  if (nU < nfft) return -1.0;
  const u = new Float64Array(nU);
  let j = 0;
  for (let i = 0; i < nU; i++) {
    const t = i / fs;
    while (j + 1 < rr.length && ts[j + 1] < t) j++;
    u[i] = rr[j];
  }
  const step = nfft / 2, half = nfft / 2 + 1;
  const win = new Float64Array(nfft);
  for (let i = 0; i < nfft; i++) win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (nfft - 1)));
  const psd = new Float64Array(half);
  let segs = 0;
  for (let st = 0; st + nfft <= nU; st += step) {
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
    if (f >= 0.01 && f <= 0.15) { xs.push(Math.log10(f)); ys.push(Math.log10(psd[k] / segs + 1e-18)); }
  }
  const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  return den > 0 ? num / den : -1.0;
}

function erfc(x) {
  const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
    t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}

function twoSample(g1, g2) {
  const m1 = g1.reduce((a, b) => a + b, 0) / g1.length, m2 = g2.reduce((a, b) => a + b, 0) / g2.length;
  const v1 = g1.reduce((a, b) => a + (b - m1) ** 2, 0) / Math.max(1, g1.length - 1);
  const v2 = g2.reduce((a, b) => a + (b - m2) ** 2, 0) / Math.max(1, g2.length - 1);
  const psd = Math.sqrt(((g1.length - 1) * v1 + (g2.length - 1) * v2) / Math.max(1, g1.length + g2.length - 2)) || 1e-9;
  const t = (m1 - m2) / (Math.sqrt(v1 / g1.length + v2 / g2.length) || 1e-9);
  let w = 0; for (const a of g1) for (const b of g2) if (a > b) w++; else if (a === b) w += 0.5;
  const auc = w / (g1.length * g2.length);
  return { meanOld: +m1.toFixed(4), meanYoung: +m2.toFixed(4), d: +((m1 - m2) / psd).toFixed(3), auc: +Math.max(auc, 1 - auc).toFixed(3), p: +erfc(Math.abs(t) / Math.SQRT2).toFixed(6) };
}

async function processRecord(rec) {
  const hea = await fetch(`${PHYSIO_BASE}${rec}.hea`).then((r) => r.text());
  const lines = hea.trim().split('\n');
  const first = lines[0].trim().split(/\s+/);
  const nCh = parseInt(first[1], 10), sfreq = parseInt(first[2], 10);
  const ecgCh = lines.slice(1, 1 + nCh).findIndex((l) => /ECG/i.test(l));
  const ageM = hea.match(/Age:\s*(\d+)/i);
  const age = ageM ? parseInt(ageM[1], 10) : (rec.includes('o') ? 75 : 27);
  const group = rec.includes('o') ? 'Older' : 'Young';

  // Stream 15 minutes (900s * 250 Hz = 225,000 samples) from minute 10..25 via HTTP Range
  const nSamp = 900 * sfreq;
  const startSamp = 600 * sfreq;
  const byteStart = startSamp * nCh * 2;
  const byteEnd = byteStart + nSamp * nCh * 2 - 1;
  const r = await fetch(`${PHYSIO_BASE}${rec}.dat`, { headers: { Range: `bytes=${byteStart}-${byteEnd}` } });
  if (!r.ok) return null;
  const buf = Buffer.from(await r.arrayBuffer());
  const actualN = Math.floor(buf.length / (nCh * 2));
  const ecg = new Float64Array(actualN);
  const chIdx = ecgCh >= 0 ? ecgCh : 1;
  for (let i = 0; i < actualN; i++) ecg[i] = buf.readInt16LE((i * nCh + chIdx) * 2);

  const rr = detectRR(ecg, sfreq);
  if (rr.length < 300) return null;

  const meanRR = rr.reduce((a, b) => a + b, 0) / rr.length;
  const sdnnMs = Math.sqrt(rr.reduce((a, b) => a + (b - meanRR) ** 2, 0) / rr.length) * 1000;
  let sqDiff = 0; for (let i = 1; i < rr.length; i++) sqDiff += (rr[i] - rr[i - 1]) ** 2;
  const rmssdMs = Math.sqrt(sqDiff / (rr.length - 1)) * 1000;

  const slopeRR = computeSlopeRR(rr);
  const dfaRR = computeDFA_RR(rr);
  const wkHRV = slopeRR + (2 * dfaRR - 1);

  return { rec, group, age, nBeats: rr.length, sdnnMs: +sdnnMs.toFixed(1), rmssdMs: +rmssdMs.toFixed(1), slopeRR: +slopeRR.toFixed(4), dfaRR: +dfaRR.toFixed(4), wkHRV: +wkHRV.toFixed(4) };
}

async function main() {
  const recs = (await fetch(`${PHYSIO_BASE}RECORDS`).then((r) => r.text())).trim().split('\n').map((s) => s.trim()).filter(Boolean);
  console.log(`Streaming Lab #20 Brain-to-Heart Transfer (PhysioNet Fantasia, ${recs.length} humans: 20 Young vs 20 Older, 15-min ECG)...`);
  const done = [];
  let cursor = 0;
  async function worker() {
    while (cursor < recs.length) {
      const rec = recs[cursor++];
      try { const r = await processRecord(rec); if (r) done.push(r); } catch {}
    }
  }
  await Promise.all(Array.from({ length: 8 }, () => worker()));

  const oldG = done.filter((x) => x.group === 'Older');
  const yngG = done.filter((x) => x.group === 'Young');
  const stats = {};
  for (const k of ['slopeRR', 'dfaRR', 'wkHRV', 'sdnnMs', 'rmssdMs']) {
    stats[k] = twoSample(oldG.map((x) => x[k]), yngG.map((x) => x[k]));
  }
  // Check exact Wiener-Khinchin scaling correlation between slopeRR and -(2*dfaRR - 1) across all 40 hearts!
  const xs = done.map((x) => -(2 * x.dfaRR - 1)), ys = done.map((x) => x.slopeRR);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < xs.length; i++) { num += (xs[i] - mx) * (ys[i] - my); dx += (xs[i] - mx) ** 2; dy += (ys[i] - my) ** 2; }
  const wkLawR = +(num / Math.max(1e-12, Math.sqrt(dx * dy))).toFixed(4);
  const wkLawT = wkLawR * Math.sqrt((xs.length - 2) / Math.max(1e-9, 1 - wkLawR * wkLawR));
  const wkLawP = +erfc(Math.abs(wkLawT) / Math.SQRT2).toFixed(7);

  const out = {
    generatedAt: new Date().toISOString(),
    dataset: 'PhysioNet Fantasia Database (Lab #20 — 40 Humans: 20 Young 21–34 vs 20 Older 68–85, 15-min RR Intervals)',
    counts: { older: oldG.length, young: yngG.length, total: done.length },
    wienerKhinchinLawOnHumanHeart: { r_slopeVsPredicted: wkLawR, p: wkLawP, meanAbsWKViolation: +(done.reduce((a, x) => a + Math.abs(x.wkHRV), 0) / done.length).toFixed(4) },
    Older_vs_Young_HRV: stats,
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));

  console.log(`\n=== LAB #20 BRAIN-TO-HEART TRANSFER (PhysioNet Fantasia, N=${done.length}: ${oldG.length} Older vs ${yngG.length} Young) ===`);
  console.log('Wiener-Khinchin Law on Human Heartbeats (slopeRR vs -(2*dfaRR - 1)):', out.wienerKhinchinLawOnHumanHeart);
  console.table(stats);
  console.log(`Saved -> ${OUT_PATH}`);
}
main();
