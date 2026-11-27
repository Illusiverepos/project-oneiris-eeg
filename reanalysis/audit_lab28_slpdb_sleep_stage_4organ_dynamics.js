'use strict';

/**
 * Project ONEIRIS — Lab #28 (Jumble v5 Collision C5 + Within-Night 4-Organ Sleep Dynamics):
 *   Full-Night Clinical Sleep-Stage (Wake vs. Light NREM vs. Deep NREM vs. REM) 4-Organ Δ_WK Dynamics
 *   Dataset: PhysioNet MIT-BIH Polysomnographic Database (slpdb v1.0.0, N = 18 overnight recordings)
 *
 * Uses clinical 30-second sleep stage annotations (.st: W, 1, 2, 3, 4, R) to test:
 *   1. JUMBLE C5 (EEG-Free Smartwatch Wake/Sleep Gate):
 *      Does 3-minute Cardiac Δ_WK_HRV (or DFA_HRV / slope_HRV) ALONE separate
 *      Wake vs. Deep NREM vs. REM inside real human polysomnography (paired within-human)?
 *   2. 4-ORGAN SLEEP-STAGE ARCHITECTURE:
 *      How do Brain Δ_WK, Heart Δ_WK, Arterial BP Δ_WK, and Respiration Δ_WK shift across
 *      Wake -> NREM -> REM inside the exact same sleeping humans?
 *
 * Output: reanalysis/data/lab28_slpdb_sleep_stage_4organ_results.json
 */

const fs = require('fs');
const path = require('path');
const sdk = require('../sdk/oneiris_wearable_sdk.js');

const BASE_URL = 'https://physionet.org/files/slpdb/1.0.0';
const OUT_PATH = path.join(__dirname, 'data', 'lab28_slpdb_sleep_stage_4organ_results.json');

function decodeFormat212(buf, nSig) {
  const totalTriplets = Math.floor(buf.length / 3);
  const totalSamples = totalTriplets * 2;
  const nFrames = Math.floor(totalSamples / nSig);
  const chans = Array.from({ length: nSig }, () => new Float64Array(nFrames));
  let sIdx = 0;
  for (let t = 0; t < totalTriplets && sIdx + 1 < nFrames * nSig; t++) {
    const b0 = buf[t * 3], b1 = buf[t * 3 + 1], b2 = buf[t * 3 + 2];
    let v0 = b0 | ((b1 & 0x0f) << 8); if (v0 & 0x800) v0 -= 4096;
    let v1 = b2 | ((b1 & 0xf0) << 4); if (v1 & 0x800) v1 -= 4096;
    chans[sIdx % nSig][Math.floor(sIdx / nSig)] = v0; sIdx++;
    chans[sIdx % nSig][Math.floor(sIdx / nSig)] = v1; sIdx++;
  }
  return chans;
}

function parseStAnnotations(buf) {
  const epochs = [];
  let pos = 0, t = 0;
  while (pos + 2 <= buf.length) {
    const w = buf.readUInt16LE(pos); pos += 2;
    const code = (w >>> 10) & 0x3f, val = w & 0x3ff;
    if (code === 0 && val === 0) break;
    if (code === 59) {
      if (pos + 4 > buf.length) break;
      t += ((buf.readUInt16LE(pos) << 16) | buf.readUInt16LE(pos + 2)) | 0;
      pos += 4;
    } else if (code === 63) {
      const aux = buf.toString('ascii', pos, pos + val).trim();
      pos += val + (val % 2);
      const tok = aux.split(/\s+/)[0];
      if (['W', '1', '2', '3', '4', 'R'].includes(tok)) {
        const macro = tok === 'W' ? 'Wake' : tok === 'R' ? 'REM' : (tok === '3' || tok === '4') ? 'DeepNREM' : 'LightNREM';
        epochs.push({ tSec: t / 250, raw: tok, stage: macro });
      }
    } else if (code < 60) t += val;
  }
  return epochs;
}

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
  const n = xs.length;
  if (n < 3) return NaN;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
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
    fft(re, im);
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

function detectRPeaks250Hz(ecg) {
  const N = ecg.length;
  const hp = new Float64Array(N);
  const wHp = 50; let sum = 0;
  for (let i = 0; i < N; i++) { sum += ecg[i]; if (i >= wHp) sum -= ecg[i - wHp]; hp[i] = ecg[i] - sum / Math.min(i + 1, wHp); }
  const sq = new Float64Array(N);
  for (let i = 1; i < N; i++) { const d = hp[i] - hp[i - 1]; sq[i] = d * d; }
  const env = new Float64Array(N);
  const wInt = 30; sum = 0;
  for (let i = 0; i < N; i++) { sum += sq[i]; if (i >= wInt) sum -= sq[i - wInt]; env[i] = sum / Math.min(i + 1, wInt); }
  const peaks = [], refractory = 75, chunk = 2500;
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
        for (let k = Math.max(c, i - 20); k <= Math.min(end - 1, i + 20); k++) if (Math.abs(hp[k]) > bestV) { bestV = Math.abs(hp[k]); best = k; }
        if (!peaks.length || best - peaks[peaks.length - 1] >= refractory) peaks.push(best);
        i += refractory;
      } else i++;
    }
  }
  return peaks.map((p) => p / 250.0);
}

function downsample4Hz(sig250) {
  const step = 62, n = Math.floor(sig250.length / step);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) { let acc = 0; for (let k = 0; k < step; k++) acc += sig250[i * step + k]; out[i] = acc / step; }
  return out;
}

function findStageRun(epochs, targetStage, minEpochs = 6) {
  // Find longest contiguous run of targetStage (>= 3 minutes = 6 x 30s epochs)
  let bestStart = -1, bestLen = 0, curStart = -1, curLen = 0;
  for (let i = 0; i < epochs.length; i++) {
    if (epochs[i].stage === targetStage) {
      if (curLen === 0) curStart = epochs[i].tSec;
      curLen++;
      if (curLen > bestLen) { bestLen = curLen; bestStart = curStart; }
    } else curLen = 0;
  }
  return bestLen >= minEpochs ? { startSec: bestStart, durSec: Math.min(300, bestLen * 30) } : null;
}

async function fetchWindowMetrics(rec, nSig, fs, iEcg, iBp, iEeg, startSec, durSec) {
  const startFrame = Math.floor(startSec * fs / 2) * 2;
  const nFrames = Math.floor(durSec * fs / 2) * 2;
  const startByte = (startFrame * nSig * 3) / 2;
  const endByte = startByte + (nFrames * nSig * 3) / 2 - 1;
  const res = await fetch(`${BASE_URL}/${rec}.dat`, { headers: { Range: `bytes=${startByte}-${endByte}` } });
  if (!res.ok && res.status !== 206) return null;
  const chans = decodeFormat212(Buffer.from(await res.arrayBuffer()), nSig);
  if (chans[0].length < 250 * 150) return null;

  // Brain
  const eeg = chans[iEeg];
  const rc = 1 / (2 * Math.PI * 1.0), al = rc / (rc + 1 / 250);
  let px = eeg[0], py = 0; eeg[0] = 0;
  for (let t = 1; t < eeg.length; t++) { const x = eeg[t], y = al * (py + x - px); eeg[t] = y; px = x; py = y; }
  const bFrames = [];
  for (let s = 0; s + 500 <= eeg.length; s += 500) bFrames.push(sdk.computeFrameMetrics(eeg.subarray(s, s + 500), eeg.subarray(s, s + 500), 250));
  const brainWK = bFrames.reduce((a, f) => a + f.wkViolation, 0) / bFrames.length;
  const brainSlope = bFrames.reduce((a, f) => a + f.slopeBB, 0) / bFrames.length;
  const brainDFA = bFrames.reduce((a, f) => a + f.dfa, 0) / bFrames.length;

  // Heart
  const peaks = detectRPeaks250Hz(chans[iEcg]);
  const rawRR = [];
  for (let i = 1; i < peaks.length; i++) { const dt = peaks[i] - peaks[i - 1]; if (dt >= 0.35 && dt <= 1.80) rawRR.push(dt); }
  const sorted = [...rawRR].sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)] || 0.9;
  const rr = rawRR.filter((v) => Math.abs(v - med) <= 0.25 * med);
  if (rr.length < 100) return null;
  const tCum = [0]; for (let i = 0; i < rr.length; i++) tCum.push(tCum[i] + rr[i]);
  const N4 = Math.floor(tCum[tCum.length - 1] * 4);
  const u = new Float64Array(N4); let idx = 0;
  for (let i = 0; i < N4; i++) {
    const t = i / 4; while (idx + 1 < rr.length && tCum[idx + 1] < t) idx++;
    const frac = tCum[idx + 1] > tCum[idx] ? (t - tCum[idx]) / (tCum[idx + 1] - tCum[idx]) : 0;
    u[i] = rr[idx] + frac * (rr[Math.min(idx + 1, rr.length - 1)] - rr[idx]);
  }
  const scales = [8, 12, 16, 24, 32, 48, 64, 96];
  const heartDFA = computeDFA(u, scales);
  const heartSlope = computeSlopeUniform(u, 4, 0.04, 0.40, 128);
  const heartWK = heartSlope + (2 * heartDFA - 1);

  let bpWK = NaN;
  if (iBp >= 0) {
    const uBp = downsample4Hz(chans[iBp]);
    bpWK = computeSlopeUniform(uBp, 4, 0.04, 0.40, 128) + (2 * computeDFA(uBp, scales) - 1);
  }
  return { brainWK, brainSlope, brainDFA, heartWK, heartSlope, heartDFA, bpWK };
}

function pairedPerm(a, b, nPerm = 10000) {
  const d = a.map((v, i) => v - b[i]);
  const n = d.length;
  const m = d.reduce((s, v) => s + v, 0) / n;
  const sd = Math.sqrt(d.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, n - 1)) || 1e-9;
  const t = m / (sd / Math.sqrt(n));
  let ge = 0, seed = 202628;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let p = 0; p < nPerm; p++) {
    let s = 0; for (let i = 0; i < n; i++) s += (rand() < 0.5 ? 1 : -1) * d[i];
    if (Math.abs(s / n) >= Math.abs(m)) ge++;
  }
  return { n, meanA: +(a.reduce((x, y) => x + y, 0) / n).toFixed(4), meanB: +(b.reduce((x, y) => x + y, 0) / n).toFixed(4), meanDiff: +m.toFixed(4), dz: +(m / sd).toFixed(3), t: +t.toFixed(3), p: +((ge + 1) / (nPerm + 1)).toFixed(5), nPos: d.filter((x) => x > 0).length };
}

async function main() {
  const recs = (await fetch(`${BASE_URL}/RECORDS`).then((r) => r.text())).trim().split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  console.log(`=== Lab #28: Full-Night Sleep-Stage 4-Organ Dynamics (Wake vs. LightNREM vs. DeepNREM vs. REM, slpdb N=${recs.length}) ===`);

  const stageData = [];
  for (const rec of recs) {
    try {
      const [heaRes, stRes] = await Promise.all([fetch(`${BASE_URL}/${rec}.hea`), fetch(`${BASE_URL}/${rec}.st`)]);
      if (!heaRes.ok || !stRes.ok) continue;
      const lines = (await heaRes.text()).trim().split(/\r?\n/);
      const hdr = lines[0].trim().split(/\s+/);
      const nSig = parseInt(hdr[1], 10), fs = parseFloat(hdr[2]);
      let iEcg = -1, iBp = -1, iEeg = -1;
      for (let c = 0; c < nSig; c++) {
        const ln = (lines[c + 1] || '').toUpperCase();
        if (iEcg < 0 && ln.includes('ECG')) iEcg = c;
        if (iBp < 0 && ln.includes('BP')) iBp = c;
        if (iEeg < 0 && ln.includes('EEG')) iEeg = c;
      }
      if (iEcg < 0 || iEeg < 0) continue;
      const epochs = parseStAnnotations(Buffer.from(await stRes.arrayBuffer()));
      const entry = { rec };
      for (const st of ['Wake', 'LightNREM', 'DeepNREM', 'REM']) {
        const run = findStageRun(epochs, st, 6);
        if (run) entry[st] = await fetchWindowMetrics(rec, nSig, fs, iEcg, iBp, iEeg, run.startSec, run.durSec);
      }
      stageData.push(entry);
    } catch {}
  }

  const comparisons = {};
  const pairs = [['Wake', 'LightNREM'], ['Wake', 'DeepNREM'], ['Wake', 'REM'], ['LightNREM', 'REM'], ['DeepNREM', 'REM']];
  console.log(`\nParsed ${stageData.length} full-night recordings. Paired Within-Human Stage Contrasts:`);
  for (const [sA, sB] of pairs) {
    const both = stageData.filter((x) => x[sA] && x[sB] && Number.isFinite(x[sA].heartWK) && Number.isFinite(x[sB].heartWK));
    if (both.length < 5) continue;
    const key = `${sA}_vs_${sB}`;
    comparisons[key] = {
      n: both.length,
      brainSlope: pairedPerm(both.map((x) => x[sA].brainSlope), both.map((x) => x[sB].brainSlope)),
      brainWK: pairedPerm(both.map((x) => x[sA].brainWK), both.map((x) => x[sB].brainWK)),
      heartWK: pairedPerm(both.map((x) => x[sA].heartWK), both.map((x) => x[sB].heartWK)),
      heartDFA: pairedPerm(both.map((x) => x[sA].heartDFA), both.map((x) => x[sB].heartDFA)),
      heartSlope: pairedPerm(both.map((x) => x[sA].heartSlope), both.map((x) => x[sB].heartSlope))
    };
    console.log(`\n  [${key}] (n=${both.length} paired humans):`);
    console.log(`    Brain Slope: ${comparisons[key].brainSlope.meanA} vs ${comparisons[key].brainSlope.meanB} | dz=${comparisons[key].brainSlope.dz}, p=${comparisons[key].brainSlope.p}`);
    console.log(`    Brain dWK:   ${comparisons[key].brainWK.meanA} vs ${comparisons[key].brainWK.meanB} | dz=${comparisons[key].brainWK.dz}, p=${comparisons[key].brainWK.p}`);
    console.log(`    Heart dWK:   ${comparisons[key].heartWK.meanA} vs ${comparisons[key].heartWK.meanB} | dz=${comparisons[key].heartWK.dz}, p=${comparisons[key].heartWK.p} (${comparisons[key].heartWK.nPos}/${both.length})`);
    console.log(`    Heart DFA:   ${comparisons[key].heartDFA.meanA} vs ${comparisons[key].heartDFA.meanB} | dz=${comparisons[key].heartDFA.dz}, p=${comparisons[key].heartDFA.p}`);
    console.log(`    Heart Slope: ${comparisons[key].heartSlope.meanA} vs ${comparisons[key].heartSlope.meanB} | dz=${comparisons[key].heartSlope.dz}, p=${comparisons[key].heartSlope.p}`);
  }

  const out = { lab: 'Lab #28 — Full-Night Sleep-Stage 4-Organ Dynamics & EEG-Free Cardiac Wake Gate (slpdb)', nRecordings: stageData.length, comparisons, stageData };
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
  console.log(`\nSaved -> ${OUT_PATH}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
