'use strict';

/**
 * Project ONEIRIS — Lab #33: REM Sleep Behavior Disorder (RBD, Prodromal Parkinson's/Lewy Body Dementia)
 * vs. Healthy Normal Sleepers during REM Dreaming & Deep NREM!
 * Dataset: PhysioNet CAP Sleep Database (capslpdb v1.0.0 — n1..n16 Healthy vs. rbd1..rbd22 RBD)
 *
 * Tests whether RBD — the #1 prodromal dream disorder in neurology (>80% conversion to Parkinson's /
 * Lewy Body Dementia within 10-15 years) — breaks:
 *   1. REM Dreaming Brain Δ_WK, Nonlinear Phase (Real - Surr), 1/f Slope, DFA, or Cortical Slowing
 *   2. REM Dreaming Heart Δ_WK_HRV, Nonlinear Phase (Real - Surr), or Heart DFA (autonomic synucleinopathy!)
 *   3. The Brain-Heart Sleep Phase-Switching Mirror Law (Deep NREM -> REM)
 *
 * Output: reanalysis/data/lab33_capslpdb_rbd_vs_healthy_rem_results.json
 */

const fs = require('fs');
const path = require('path');
const sdk = require('../sdk/oneiris_wearable_sdk.js');

const BASE_URL = 'https://physionet.org/files/capslpdb/1.0.0';
const OUT_PATH = path.join(__dirname, 'data', 'lab33_capslpdb_rbd_vs_healthy_rem_results.json');

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

function detectRPeaks(ecg, fs) {
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
    const ev = (cols[3] || '').toUpperCase();
    if (!ev.includes('SLEEP-')) continue;
    const st = cols[0].trim().toUpperCase();
    const tSecRaw = hmsToSec(cols[2]);
    if (!Number.isFinite(tSecRaw)) continue;
    let rel = tSecRaw - startSec;
    if (rel < -43200) rel += 86400;
    else if (rel < 0) rel += 86400;
    if (rel < 0 || rel > 43200) continue;
    const macro = st === 'W' ? 'Wake' : st === 'R' ? 'REM' : (st === 'S3' || st === 'S4') ? 'DeepNREM' : null;
    if (macro) epochs.push({ relSec: rel, stage: macro });
  }
  epochs.sort((a, b) => a.relSec - b.relSec);
  return epochs;
}

function findRun(epochs, target, minCount = 5) {
  let bestS = -1, bestL = 0, curS = -1, curL = 0, prevT = -999;
  for (const e of epochs) {
    if (e.stage === target && (curL === 0 || Math.abs(e.relSec - prevT - 30) <= 5)) {
      if (curL === 0) curS = e.relSec;
      curL++;
      if (curL > bestL) { bestL = curL; bestS = curS; }
    } else if (e.stage === target) { curS = e.relSec; curL = 1; }
    else curL = 0;
    prevT = e.relSec;
  }
  return bestL >= minCount ? { startSec: bestS, durSec: Math.min(240, bestL * 30) } : null;
}

async function fetchStageWindow(edfUrl, hdr, iEeg, iEcg, startSec, durSec, seed) {
  const startRec = Math.floor(startSec / hdr.recDur);
  const nRecs = Math.min(Math.floor(durSec / hdr.recDur), hdr.numRec - startRec);
  if (nRecs < Math.floor(120 / hdr.recDur)) return null;
  const recBytes = hdr.spr.reduce((a, b) => a + b, 0) * 2;
  const b0 = hdr.hdrB + startRec * recBytes;
  const b1 = b0 + nRecs * recBytes - 1;
  const res = await fetch(edfUrl, { headers: { Range: `bytes=${b0}-${b1}` } });
  if (!res.ok && res.status !== 206) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  const availRecs = Math.floor(buf.length / recBytes);
  if (availRecs < Math.floor(120 / hdr.recDur)) return null;

  const fsEeg = hdr.spr[iEeg] / hdr.recDur;
  const decEeg = Math.max(1, Math.round(fsEeg / 256));
  const chOff = []; let acc = 0;
  for (let c = 0; c < hdr.ns; c++) { chOff.push(acc); acc += hdr.spr[c] * 2; }

  const eegOut = [], ecgOut = [];
  const fsEcg = iEcg >= 0 ? hdr.spr[iEcg] / hdr.recDur : 0;
  const decEcg = iEcg >= 0 ? Math.max(1, Math.round(fsEcg / 256)) : 1;

  for (let r = 0; r < availRecs; r++) {
    const rBase = r * recBytes;
    const eBase = rBase + chOff[iEeg];
    for (let k = 0; k < hdr.spr[iEeg]; k += decEeg) eegOut.push(buf.readInt16LE(eBase + k * 2));
    if (iEcg >= 0) {
      const cBase = rBase + chOff[iEcg];
      for (let k = 0; k < hdr.spr[iEcg]; k += decEcg) ecgOut.push(buf.readInt16LE(cBase + k * 2));
    }
  }

  const sfEeg = fsEeg / decEeg;
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

  let heartWK = NaN, heartSurrWK = NaN, heartDFA = NaN, heartSlope = NaN;
  if (iEcg >= 0 && ecgOut.length > 0) {
    const sfEcg = fsEcg / decEcg;
    const peaks = detectRPeaks(Float64Array.from(ecgOut), sfEcg);
    const rawRR = [];
    for (let i = 1; i < peaks.length; i++) { const dt = peaks[i] - peaks[i - 1]; if (dt >= 0.35 && dt <= 1.80) rawRR.push(dt); }
    if (rawRR.length >= 90) {
      const sorted = [...rawRR].sort((a, b) => a - b);
      const med = sorted[Math.floor(sorted.length / 2)];
      const rr = rawRR.filter((v) => Math.abs(v - med) <= 0.25 * med);
      if (rr.length >= 80) {
        const tCum = [0]; for (let i = 0; i < rr.length; i++) tCum.push(tCum[i] + rr[i]);
        const N4 = Math.floor(tCum[tCum.length - 1] * 4);
        if (N4 >= 320) {
          const u = new Float64Array(N4); let idx = 0;
          for (let i = 0; i < N4; i++) {
            const t = i / 4; while (idx + 1 < rr.length && tCum[idx + 1] < t) idx++;
            const frac = tCum[idx + 1] > tCum[idx] ? (t - tCum[idx]) / (tCum[idx + 1] - tCum[idx]) : 0;
            u[i] = rr[idx] + frac * (rr[Math.min(idx + 1, rr.length - 1)] - rr[idx]);
          }
          const uSurr = phaseRand(u, seed + 41);
          const scales = [8, 12, 16, 24, 32, 48, 64, 96];
          heartDFA = computeDFA(u, scales);
          heartSlope = computeSlopeUniform(u, 4, 0.04, 0.40, 128);
          heartWK = heartSlope + (2 * heartDFA - 1);
          heartSurrWK = computeSlopeUniform(uSurr, 4, 0.04, 0.40, 128) + (2 * computeDFA(uSurr, scales) - 1);
        }
      }
    }
  }
  return {
    brainWK, brainSurrWK, brainNonlin: brainWK - brainSurrWK,
    brainSlope: avg(bR, 'slopeBB'), brainDFA: avg(bR, 'dfa'),
    brainDelta: avg(bR, 'deltaFrac'), brainAlpha: avg(bR, 'alphaFrac'), brainBeta: avg(bR, 'betaFrac'),
    heartWK, heartSurrWK, heartNonlin: heartWK - heartSurrWK, heartDFA, heartSlope
  };
}

function twoSamplePerm(a, b, nPerm = 10000) {
  const ma = a.reduce((s, v) => s + v, 0) / a.length, mb = b.reduce((s, v) => s + v, 0) / b.length;
  const va = a.reduce((s, v) => s + (v - ma) ** 2, 0) / Math.max(1, a.length - 1);
  const vb = b.reduce((s, v) => s + (v - mb) ** 2, 0) / Math.max(1, b.length - 1);
  const sp = Math.sqrt(((a.length - 1) * va + (b.length - 1) * vb) / Math.max(1, a.length + b.length - 2)) || 1e-9;
  const obs = Math.abs(ma - mb), all = [...a, ...b];
  let ge = 0, seed = 202633;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let p = 0; p < nPerm; p++) {
    for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
    let s1 = 0, s2 = 0;
    for (let i = 0; i < a.length; i++) s1 += all[i];
    for (let i = a.length; i < all.length; i++) s2 += all[i];
    if (Math.abs(s1 / a.length - s2 / b.length) >= obs) ge++;
  }
  let w = 0; for (const x of a) for (const y of b) w += x > y ? 1 : (x === y ? 0.5 : 0);
  const auc = w / (a.length * b.length);
  return { n1: a.length, n2: b.length, meanRBD: +ma.toFixed(4), meanHealthy: +mb.toFixed(4), d: +((ma - mb) / sp).toFixed(3), auc: +Math.max(auc, 1 - auc).toFixed(3), p: +((ge + 1) / (nPerm + 1)).toFixed(5) };
}

async function processRec(rec, idx) {
  try {
    const edfUrl = `${BASE_URL}/${rec}.edf`;
    const [hdrRes, txtRes] = await Promise.all([
      fetch(edfUrl, { headers: { Range: 'bytes=0-16383' } }),
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
    const iEeg = labels.findIndex((l) => /F2-F4|Fp2-F4|F4-C4|C4-A1|F1-F3|F3-C3|C3-A2|F3-A2|F4-A1|C4-P4/i.test(l));
    const iEcg = labels.findIndex((l) => /ECG|EKG/i.test(l));
    if (iEeg < 0) return null;
    const epochs = parseCapTxt(await txtRes.text(), startSec);
    const hdr = { numRec, recDur, ns, hdrB, spr };
    const remRun = findRun(epochs, 'REM', 5);
    if (!remRun) return null;
    const rem = await fetchStageWindow(edfUrl, hdr, iEeg, iEcg, remRun.startSec, remRun.durSec, (idx + 1) * 5381);
    return rem ? { rec, group: rec.startsWith('rbd') ? 'RBD' : 'Healthy', rem } : null;
  } catch { return null; }
}

async function main() {
  const candidates = [
    ...Array.from({ length: 16 }, (_, i) => `n${i + 1}`),
    ...Array.from({ length: 22 }, (_, i) => `rbd${i + 1}`)
  ];
  console.log(`=== Lab #33: REM Sleep Behavior Disorder (RBD, n=22) vs. Healthy Sleepers (n=16) during REM Dreaming ===`);
  const rows = [];
  let cursor = 0;
  async function worker() {
    while (cursor < candidates.length) {
      const idx = cursor++;
      const r = await processRec(candidates[idx], idx);
      if (r) rows.push(r);
    }
  }
  await Promise.all(Array.from({ length: 5 }, () => worker()));

  const rbd = rows.filter((r) => r.group === 'RBD');
  const hc = rows.filter((r) => r.group === 'Healthy');
  console.log(`Analyzed REM dreaming in N=${rows.length} humans (RBD=${rbd.length}, Healthy=${hc.length}):`);

  const brainKeys = ['brainWK', 'brainNonlin', 'brainSlope', 'brainDFA', 'brainDelta', 'brainAlpha', 'brainBeta'];
  const brainRes = {};
  for (const k of brainKeys) brainRes[k] = twoSamplePerm(rbd.map((r) => r.rem[k]), hc.map((r) => r.rem[k]));

  const rbdH = rbd.filter((r) => Number.isFinite(r.rem.heartWK));
  const hcH = hc.filter((r) => Number.isFinite(r.rem.heartWK));
  const heartKeys = ['heartWK', 'heartNonlin', 'heartDFA', 'heartSlope'];
  const heartRes = {};
  if (rbdH.length >= 4 && hcH.length >= 4) {
    for (const k of heartKeys) heartRes[k] = twoSamplePerm(rbdH.map((r) => r.rem[k]), hcH.map((r) => r.rem[k]));
  }

  console.log('\n[1] REM DREAMING BRAIN METRICS (RBD vs. Healthy):');
  console.table(brainRes);
  console.log('\n[2] REM DREAMING HEART METRICS (RBD vs. Healthy):');
  console.table(heartRes);

  const out = { lab: 'Lab #33 — RBD vs Healthy Sleepers during REM Dreaming (capslpdb)', counts: { RBD: rbd.length, Healthy: hc.length, RBD_withECG: rbdH.length, Healthy_withECG: hcH.length }, brainRes, heartRes };
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
  console.log(`Saved -> ${OUT_PATH}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
