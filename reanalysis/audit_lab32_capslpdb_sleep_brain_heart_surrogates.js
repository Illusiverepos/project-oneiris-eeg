'use strict';

/**
 * Project ONEIRIS — Lab #32 (Option A x Option B Grand Cross-Test):
 *   Large-Scale Full-Night Clinical Sleep Brain + Heart Δ_WK + Fourier Phase-Randomized Surrogates
 *   Dataset: PhysioNet CAP Sleep Database (capslpdb v1.0.0 — Healthy Normal n1..n16 + NFLE + RBD, N ~ 45 humans)
 *
 * Streams ONLY 3-minute contiguous Wake, Deep NREM (S3/S4), and REM windows per human via HTTP Range
 * requests from full-night EDFs, extracting simultaneously:
 *   - Brain Frontal/Central EEG (F2-F4 / F4-C4 / C4-A1): Real Δ_WK & Phase-Randomized Surrogate Δ_WK
 *   - Heart ECG (ECG1-ECG2): Real Δ_WK_HRV & Phase-Randomized Surrogate Δ_WK_HRV
 *
 * Cross-tests Option A x Option B:
 *   1. Does Deep NREM -> REM cardiac Δ_WK_HRV replicate at scale (N >> 7)?
 *   2. Across Wake, Deep NREM, and REM, does Brain vs. Heart Δ_WK shift via linear spectral curvature
 *      (survives surrogates) OR genuine nonlinear phase coupling (collapses in surrogates)?
 *   3. Does within-human Brain <-> Heart Δ_WK coupling hold during Deep NREM and REM?
 *
 * Output: reanalysis/data/lab32_capslpdb_sleep_brain_heart_surrogates_results.json
 */

const fs = require('fs');
const path = require('path');
const sdk = require('../sdk/oneiris_wearable_sdk.js');

const BASE_URL = 'https://physionet.org/files/capslpdb/1.0.0';
const OUT_PATH = path.join(__dirname, 'data', 'lab32_capslpdb_sleep_brain_heart_surrogates_results.json');

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

function computeSlopeUniform(u, fs, fLow, fHigh, nfft = 128) {
  if (u.length < nfft) return NaN;
  const step = nfft / 2, half = nfft / 2 + 1;
  const win = new Float64Array(nfft);
  for (let i = 0; i < nfft; i++) win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (nfft - 1)));
  const psd = new Float64Array(half); let segs = 0;
  for (let st = 0; st + nfft <= u.length; st += step) {
    let m = 0; for (let i = 0; i < nfft; i++) m += u[st + i]; m /= nfft;
    const re = new Float64Array(nfft), im = new Float64Array(nfft);
    for (let i = 0; i < nfft; i++) re[i] = (u[st + i] - m) * win[i];
    fft(re, im, false);
    for (let k = 1; k < half; k++) psd[k] += re[k] * re[k] + im[k] * im[k];
    segs++;
  }
  if (segs === 0) return NaN;
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

function detectRPeaks256Hz(ecg, fs) {
  const N = ecg.length;
  const hp = new Float64Array(N);
  const wHp = Math.round(0.2 * fs); let sum = 0;
  for (let i = 0; i < N; i++) { sum += ecg[i]; if (i >= wHp) sum -= ecg[i - wHp]; hp[i] = ecg[i] - sum / Math.min(i + 1, wHp); }
  const sq = new Float64Array(N);
  for (let i = 1; i < N; i++) { const d = hp[i] - hp[i - 1]; sq[i] = d * d; }
  const env = new Float64Array(N);
  const wInt = Math.round(0.12 * fs); sum = 0;
  for (let i = 0; i < N; i++) { sum += sq[i]; if (i >= wInt) sum -= sq[i - wInt]; env[i] = sum / Math.min(i + 1, wInt); }
  const peaks = [], refractory = Math.round(0.30 * fs), chunk = Math.round(10 * fs);
  for (let c = 0; c < N; c += chunk) {
    const end = Math.min(N, c + chunk), sub = [];
    for (let i = c; i < end; i += 4) sub.push(env[i]);
    sub.sort((a, b) => a - b);
    const thr = (sub[Math.floor(sub.length * 0.5)] || 0) + 0.28 * ((sub[Math.floor(sub.length * 0.95)] || 0) - (sub[Math.floor(sub.length * 0.5)] || 0));
    if (thr <= 0) continue;
    let i = c + 1;
    while (i < end - 1) {
      if (env[i] > thr && env[i] >= env[i - 1] && env[i] >= env[i + 1]) {
        let best = i, bestV = Math.abs(hp[i]);
        const winR = Math.round(0.08 * fs);
        for (let k = Math.max(c, i - winR); k <= Math.min(end - 1, i + winR); k++) if (Math.abs(hp[k]) > bestV) { bestV = Math.abs(hp[k]); best = k; }
        if (!peaks.length || best - peaks[peaks.length - 1] >= refractory) peaks.push(best);
        i += refractory;
      } else i++;
    }
  }
  return peaks.map((p) => p / fs);
}

function hmsToSec(str) {
  const m = str.match(/(\d+)[:.](\d+)[:.](\d+)/);
  return m ? parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseInt(m[3], 10) : NaN;
}

function parseCapTxt(txt, startSec) {
  const epochs = [];
  for (const ln of txt.split(/\r?\n/)) {
    const cols = ln.trim().split('\t');
    if (cols.length < 4) continue;
    const ev = cols[3] || '';
    if (!ev.startsWith('SLEEP-')) continue;
    const st = cols[0].trim().toUpperCase();
    const tSecRaw = hmsToSec(cols[2]);
    if (!Number.isFinite(tSecRaw)) continue;
    let rel = tSecRaw - startSec;
    if (rel < -43200) rel += 86400;
    else if (rel < 0) rel += 86400;
    if (rel < 0 || rel > 43200) continue;
    const macro = st === 'W' ? 'Wake' : st === 'R' ? 'REM' : (st === 'S3' || st === 'S4') ? 'DeepNREM' : (st === 'S1' || st === 'S2') ? 'LightNREM' : null;
    if (macro) epochs.push({ relSec: rel, stage: macro });
  }
  epochs.sort((a, b) => a.relSec - b.relSec);
  return epochs;
}

function findRun(epochs, target, minCount = 6) {
  let bestS = -1, bestL = 0, curS = -1, curL = 0, prevT = -999;
  for (const e of epochs) {
    if (e.stage === target && (curL === 0 || Math.abs(e.relSec - prevT - 30) <= 5)) {
      if (curL === 0) curS = e.relSec;
      curL++;
      if (curL > bestL) { bestL = curL; bestS = curS; }
    } else if (e.stage === target) {
      curS = e.relSec; curL = 1;
    } else curL = 0;
    prevT = e.relSec;
  }
  return bestL >= minCount ? { startSec: bestS, durSec: Math.min(240, bestL * 30) } : null;
}

async function fetchStageWindow(edfUrl, hdr, iEeg, iEcg, startSec, durSec, seed) {
  const startRec = Math.floor(startSec / hdr.recDur);
  const nRecs = Math.min(Math.floor(durSec / hdr.recDur), hdr.numRec - startRec);
  if (nRecs < Math.floor(150 / hdr.recDur)) return null;
  const recBytes = hdr.spr.reduce((a, b) => a + b, 0) * 2;
  const b0 = hdr.hdrB + startRec * recBytes;
  const b1 = b0 + nRecs * recBytes - 1;
  const res = await fetch(edfUrl, { headers: { Range: `bytes=${b0}-${b1}` } });
  if (!res.ok && res.status !== 206) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  const availRecs = Math.floor(buf.length / recBytes);
  if (availRecs < Math.floor(150 / hdr.recDur)) return null;

  const fsEeg = hdr.spr[iEeg] / hdr.recDur;
  const fsEcg = hdr.spr[iEcg] / hdr.recDur;
  const decEeg = Math.max(1, Math.round(fsEeg / 256));
  const decEcg = Math.max(1, Math.round(fsEcg / 256));
  const eegOut = [], ecgOut = [];

  // Offsets within each record
  const chOff = []; let acc = 0;
  for (let c = 0; c < hdr.ns; c++) { chOff.push(acc); acc += hdr.spr[c] * 2; }

  for (let r = 0; r < availRecs; r++) {
    const rBase = r * recBytes;
    const eBase = rBase + chOff[iEeg];
    for (let k = 0; k < hdr.spr[iEeg]; k += decEeg) eegOut.push(buf.readInt16LE(eBase + k * 2));
    const cBase = rBase + chOff[iEcg];
    for (let k = 0; k < hdr.spr[iEcg]; k += decEcg) ecgOut.push(buf.readInt16LE(cBase + k * 2));
  }

  const sfEeg = fsEeg / decEeg, sfEcg = fsEcg / decEcg;
  // 1 Hz HP on EEG
  const eeg = Float64Array.from(eegOut);
  const rc = 1 / (2 * Math.PI * 1.0), al = rc / (rc + 1 / sfEeg);
  let px = eeg[0], py = 0; eeg[0] = 0;
  for (let t = 1; t < eeg.length; t++) { const x = eeg[t], y = al * (py + x - px); eeg[t] = y; px = x; py = y; }
  const eegSurr = phaseRand(eeg, seed + 13);

  const winN = Math.round(2 * sfEeg);
  const bR = [], bS = [];
  for (let s = 0; s + winN <= eegSurr.length; s += winN) {
    bR.push(sdk.computeFrameMetrics(eeg.subarray(s, s + winN), eeg.subarray(s, s + winN), sfEeg));
    bS.push(sdk.computeFrameMetrics(eegSurr.subarray(s, s + winN), eegSurr.subarray(s, s + winN), sfEeg));
  }
  const avg = (a, k) => a.reduce((s, f) => s + f[k], 0) / a.length;
  const brainWK = avg(bR, 'wkViolation'), brainSurrWK = avg(bS, 'wkViolation');
  const brainSlope = avg(bR, 'slopeBB');

  // Heart
  const peaks = detectRPeaks256Hz(Float64Array.from(ecgOut), sfEcg);
  const rawRR = [];
  for (let i = 1; i < peaks.length; i++) { const dt = peaks[i] - peaks[i - 1]; if (dt >= 0.35 && dt <= 1.80) rawRR.push(dt); }
  if (rawRR.length < 100) return null;
  const sorted = [...rawRR].sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)];
  const rr = rawRR.filter((v) => Math.abs(v - med) <= 0.25 * med);
  if (rr.length < 90) return null;
  const tCum = [0]; for (let i = 0; i < rr.length; i++) tCum.push(tCum[i] + rr[i]);
  const N4 = Math.floor(tCum[tCum.length - 1] * 4);
  if (N4 < 384) return null;
  const u = new Float64Array(N4); let idx = 0;
  for (let i = 0; i < N4; i++) {
    const t = i / 4; while (idx + 1 < rr.length && tCum[idx + 1] < t) idx++;
    const frac = tCum[idx + 1] > tCum[idx] ? (t - tCum[idx]) / (tCum[idx + 1] - tCum[idx]) : 0;
    u[i] = rr[idx] + frac * (rr[Math.min(idx + 1, rr.length - 1)] - rr[idx]);
  }
  const uSurr = phaseRand(u, seed + 41);
  const scales = [8, 12, 16, 24, 32, 48, 64, 96];
  const heartDFA = computeDFA(u, scales), heartSlope = computeSlopeUniform(u, 4, 0.04, 0.40, 128);
  const heartWK = heartSlope + (2 * heartDFA - 1);
  const heartSurrWK = computeSlopeUniform(uSurr, 4, 0.04, 0.40, 128) + (2 * computeDFA(uSurr, scales) - 1);

  return { brainWK, brainSurrWK, brainSlope, heartWK, heartSurrWK, heartDFA, heartSlope };
}

function pairedPerm(a, b, nPerm = 10000) {
  const d = a.map((v, i) => v - b[i]), n = d.length;
  const m = d.reduce((s, v) => s + v, 0) / n;
  const sd = Math.sqrt(d.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, n - 1)) || 1e-9;
  let ge = 0, seed = 202632;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let p = 0; p < nPerm; p++) {
    let s = 0; for (let i = 0; i < n; i++) s += (rand() < 0.5 ? 1 : -1) * d[i];
    if (Math.abs(s / n) >= Math.abs(m)) ge++;
  }
  return { n, meanA: +(a.reduce((x, y) => x + y, 0) / n).toFixed(4), meanB: +(b.reduce((x, y) => x + y, 0) / n).toFixed(4), dz: +(m / sd).toFixed(3), t: +(m / (sd / Math.sqrt(n))).toFixed(3), p: +((ge + 1) / (nPerm + 1)).toFixed(5), nPos: d.filter((x) => x > 0).length };
}

function pearsonR(x, y) {
  const n = x.length, mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) { num += (x[i] - mx) * (y[i] - my); dx2 += (x[i] - mx) ** 2; dy2 += (y[i] - my) ** 2; }
  return dx2 > 0 && dy2 > 0 ? num / Math.sqrt(dx2 * dy2) : 0;
}

async function processRec(rec, idx) {
  try {
    const edfUrl = `${BASE_URL}/${rec}.edf`;
    const [hdrRes, txtRes] = await Promise.all([
      fetch(edfUrl, { headers: { Range: 'bytes=0-12287' } }),
      fetch(`${BASE_URL}/${rec}.txt`)
    ]);
    if ((!hdrRes.ok && hdrRes.status !== 206) || !txtRes.ok) return null;
    const b = Buffer.from(await hdrRes.arrayBuffer());
    const startSec = hmsToSec(b.toString('ascii', 176, 184).trim());
    const numRec = parseInt(b.toString('ascii', 236, 244).trim(), 10);
    const recDur = parseFloat(b.toString('ascii', 244, 252).trim());
    const ns = parseInt(b.toString('ascii', 252, 256).trim(), 10);
    const hdrB = parseInt(b.toString('ascii', 184, 192).trim(), 10);
    if (!Number.isFinite(ns) || b.length < hdrB) return null;
    const rStr = (o, w) => Array.from({ length: ns }, (_, i) => b.toString('ascii', o + i * w, o + (i + 1) * w).trim());
    const labels = rStr(256, 16);
    const spr = rStr(256 + ns * (16 + 80 + 8 + 8 + 8 + 8 + 8 + 80), 8).map((s) => parseInt(s, 10));
    const iEeg = labels.findIndex((l) => /F2-F4|Fp2-F4|F4-C4|C4-A1|F1-F3|F3-C3/i.test(l));
    const iEcg = labels.findIndex((l) => /ECG|EKG/i.test(l));
    if (iEeg < 0 || iEcg < 0) return null;

    const epochs = parseCapTxt(await txtRes.text(), startSec);
    const hdr = { numRec, recDur, ns, hdrB, spr };
    const entry = { rec };
    for (const st of ['Wake', 'DeepNREM', 'REM']) {
      const run = findRun(epochs, st, 6);
      if (run) entry[st] = await fetchStageWindow(edfUrl, hdr, iEeg, iEcg, run.startSec, run.durSec, (idx + 1) * 5381 + st.length);
    }
    return (entry.DeepNREM || entry.REM) ? entry : null;
  } catch { return null; }
}

async function main() {
  const candidates = [
    ...Array.from({ length: 16 }, (_, i) => `n${i + 1}`),
    ...Array.from({ length: 20 }, (_, i) => `nfle${i + 1}`),
    ...Array.from({ length: 15 }, (_, i) => `rbd${i + 1}`),
    ...Array.from({ length: 9 }, (_, i) => `ins${i + 1}`)
  ];
  console.log(`=== Lab #32 (Option A x Option B): CAP Sleep Large-N Brain+Heart+Surrogates (${candidates.length} full-night humans) ===`);
  const rows = [];
  let cursor = 0;
  async function worker() {
    while (cursor < candidates.length) {
      const idx = cursor++;
      const r = await processRec(candidates[idx], idx);
      if (r) rows.push(r);
      if ((idx + 1) % 15 === 0 || idx + 1 === candidates.length) console.log(`  Progress: ${idx + 1}/${candidates.length} -> ${rows.length} valid`);
    }
  }
  await Promise.all(Array.from({ length: 5 }, () => worker()));

  const deepRem = rows.filter((r) => r.DeepNREM && r.REM && Number.isFinite(r.DeepNREM.heartWK) && Number.isFinite(r.REM.heartWK));
  const wakeRem = rows.filter((r) => r.Wake && r.REM && Number.isFinite(r.Wake.heartWK) && Number.isFinite(r.REM.heartWK));
  const wakeDeep = rows.filter((r) => r.Wake && r.DeepNREM && Number.isFinite(r.Wake.heartWK) && Number.isFinite(r.DeepNREM.heartWK));

  const out = {
    lab: 'Lab #32 — CAP Sleep Large-N Brain+Heart Sleep-Stage + Fourier Surrogate Cross-Test',
    nTotal: rows.length,
    DeepNREM_vs_REM: deepRem.length >= 5 ? {
      n: deepRem.length,
      brainWK_Real: pairedPerm(deepRem.map((r) => r.DeepNREM.brainWK), deepRem.map((r) => r.REM.brainWK)),
      brainWK_Surr: pairedPerm(deepRem.map((r) => r.DeepNREM.brainSurrWK), deepRem.map((r) => r.REM.brainSurrWK)),
      brainNonlinear_RealVsSurr_Deep: pairedPerm(deepRem.map((r) => r.DeepNREM.brainWK), deepRem.map((r) => r.DeepNREM.brainSurrWK)),
      brainNonlinear_RealVsSurr_REM: pairedPerm(deepRem.map((r) => r.REM.brainWK), deepRem.map((r) => r.REM.brainSurrWK)),
      heartWK_Real: pairedPerm(deepRem.map((r) => r.DeepNREM.heartWK), deepRem.map((r) => r.REM.heartWK)),
      heartWK_Surr: pairedPerm(deepRem.map((r) => r.DeepNREM.heartSurrWK), deepRem.map((r) => r.REM.heartSurrWK)),
      heartDFA: pairedPerm(deepRem.map((r) => r.DeepNREM.heartDFA), deepRem.map((r) => r.REM.heartDFA)),
      heartSlope: pairedPerm(deepRem.map((r) => r.DeepNREM.heartSlope), deepRem.map((r) => r.REM.heartSlope)),
      heartNonlinear_RealVsSurr_Deep: pairedPerm(deepRem.map((r) => r.DeepNREM.heartWK), deepRem.map((r) => r.DeepNREM.heartSurrWK)),
      heartNonlinear_RealVsSurr_REM: pairedPerm(deepRem.map((r) => r.REM.heartWK), deepRem.map((r) => r.REM.heartSurrWK)),
      brainHeartCoupling_DeepNREM_r: +pearsonR(deepRem.map((r) => r.DeepNREM.brainWK), deepRem.map((r) => r.DeepNREM.heartWK)).toFixed(4),
      brainHeartCoupling_REM_r: +pearsonR(deepRem.map((r) => r.REM.brainWK), deepRem.map((r) => r.REM.heartWK)).toFixed(4)
    } : null,
    Wake_vs_DeepNREM: wakeDeep.length >= 5 ? {
      n: wakeDeep.length,
      brainWK_Real: pairedPerm(wakeDeep.map((r) => r.Wake.brainWK), wakeDeep.map((r) => r.DeepNREM.brainWK)),
      heartWK_Real: pairedPerm(wakeDeep.map((r) => r.Wake.heartWK), wakeDeep.map((r) => r.DeepNREM.heartWK))
    } : null,
    Wake_vs_REM: wakeRem.length >= 5 ? {
      n: wakeRem.length,
      brainWK_Real: pairedPerm(wakeRem.map((r) => r.Wake.brainWK), wakeRem.map((r) => r.REM.brainWK)),
      heartWK_Real: pairedPerm(wakeRem.map((r) => r.Wake.heartWK), wakeRem.map((r) => r.REM.heartWK))
    } : null
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
  console.log('\n=== LAB #32 RESULTS ===');
  console.log(JSON.stringify(out, null, 2));
  console.log(`Saved -> ${OUT_PATH}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
