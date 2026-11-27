'use strict';

/**
 * Project ONEIRIS — Lab #24:
 *   1. Independent 2nd-Lab Replication of the 5-Minute Smartwatch Heart-Age Clock
 *      (PhysioNet autonomic-aging-cardiovascular v1.0.0, Schumann & Bar, Germany;
 *       age-stratified N ~ 120 healthy humans across ages 18-92, controlling for Sex & BMI)
 *   2. 5th Human Organ System — Vascular / Continuous Arterial Blood Pressure (NIBP)
 *      Tests Universal Wiener-Khinchin Law slope = -(2*DFA - 1) and Delta_WK_BP aging
 *   3. Gold-Standard Physics Proof — Fourier Phase-Randomized Surrogates (Theiler et al. 1992)
 *      Preserves exact power spectrum (slope) while destroying nonlinear/non-stationary phase structure
 *
 * Output: reanalysis/data/lab24_autonomic_aging_ecg_bp_results.json
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://physionet.org/files/autonomic-aging-cardiovascular/1.0.0';
const OUT_PATH = path.join(__dirname, 'data', 'lab24_autonomic_aging_ecg_bp_results.json');

const AGE_MIDPOINTS = {
  1: 18.5, 2: 22.0, 3: 27.0, 4: 32.0, 5: 37.0,
  6: 42.0, 7: 47.0, 8: 52.0, 9: 57.0, 10: 62.0,
  11: 67.0, 12: 72.0, 13: 77.0, 14: 82.0, 15: 88.5
};

function fft(re, im, inverse = false) {
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
    const ang = ((inverse ? 2 : -2) * Math.PI) / len;
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
  if (inverse) {
    for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
  }
}

function phaseRandomizedSurrogate(sig, seedVal) {
  let n = 1;
  while (n * 2 <= sig.length) n <<= 1;
  const re = new Float64Array(n), im = new Float64Array(n);
  let m = 0;
  for (let i = 0; i < n; i++) m += sig[i];
  m /= n;
  for (let i = 0; i < n; i++) re[i] = sig[i] - m;
  fft(re, im, false);
  let seed = (seedVal >>> 0) || 1234567;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let k = 1; k < n / 2; k++) {
    const mag = Math.hypot(re[k], im[k]);
    const phi = 2 * Math.PI * rand();
    re[k] = mag * Math.cos(phi);
    im[k] = mag * Math.sin(phi);
    re[n - k] = re[k];
    im[n - k] = -im[k];
  }
  im[0] = 0; im[n / 2] = 0;
  fft(re, im, true);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = re[i] + m;
  return out;
}

function computeDFA(sig, scales) {
  const N = sig.length;
  let mean = 0;
  for (let i = 0; i < N; i++) mean += sig[i];
  mean /= N;
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
  const n = xs.length;
  if (n < 3) return NaN;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den > 0 ? num / den : NaN;
}

function computeSlopeUniform(u, fs, fLow, fHigh, nfft = 256) {
  if (u.length < nfft) return NaN;
  const step = nfft / 2, half = nfft / 2 + 1;
  const win = new Float64Array(nfft);
  for (let i = 0; i < nfft; i++) win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (nfft - 1)));
  const psd = new Float64Array(half);
  let segs = 0;
  for (let st = 0; st + nfft <= u.length; st += step) {
    let m = 0;
    for (let i = 0; i < nfft; i++) m += u[st + i];
    m /= nfft;
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

/**
 * Fast, robust Pan-Tompkins-style R-peak detector on 250 Hz downsampled ECG
 */
function detectRPeaks250Hz(ecg250) {
  const N = ecg250.length;
  // 1. Simple high-pass (subtract 0.2s moving average) + derivative + squaring + 0.12s moving integration
  const hp = new Float64Array(N);
  const wHp = 50; // 200 ms
  let sum = 0;
  for (let i = 0; i < N; i++) {
    sum += ecg250[i];
    if (i >= wHp) sum -= ecg250[i - wHp];
    hp[i] = ecg250[i] - sum / Math.min(i + 1, wHp);
  }
  const sq = new Float64Array(N);
  for (let i = 1; i < N; i++) {
    const d = hp[i] - hp[i - 1];
    sq[i] = d * d;
  }
  const env = new Float64Array(N);
  const wInt = 30; // 120 ms
  sum = 0;
  for (let i = 0; i < N; i++) {
    sum += sq[i];
    if (i >= wInt) sum -= sq[i - wInt];
    env[i] = sum / Math.min(i + 1, wInt);
  }
  // Adaptive threshold using 90th percentile of envelope in 10s chunks
  const peaks = [];
  const refractory = 75; // 300 ms
  const chunk = 2500; // 10 s
  for (let c = 0; c < N; c += chunk) {
    const end = Math.min(N, c + chunk);
    const sub = [];
    for (let i = c; i < end; i += 4) sub.push(env[i]);
    sub.sort((a, b) => a - b);
    const p95 = sub[Math.floor(sub.length * 0.95)] || 0;
    const p50 = sub[Math.floor(sub.length * 0.50)] || 0;
    const thr = p50 + 0.28 * (p95 - p50);
    if (thr <= 0) continue;
    let i = c + 1;
    while (i < end - 1) {
      if (env[i] > thr && env[i] >= env[i - 1] && env[i] >= env[i + 1]) {
        // Refine to local extreme of |hp| within +-25 samples
        let best = i, bestV = Math.abs(hp[i]);
        for (let k = Math.max(c, i - 20); k <= Math.min(end - 1, i + 20); k++) {
          if (Math.abs(hp[k]) > bestV) { bestV = Math.abs(hp[k]); best = k; }
        }
        if (peaks.length === 0 || best - peaks[peaks.length - 1] >= refractory) {
          peaks.push(best);
        }
        i += refractory;
      } else {
        i++;
      }
    }
  }
  return peaks.map((p) => p / 250.0);
}

function analyzeUniformSeries(u, fs, fLow, fHigh, seed) {
  const scales = [8, 12, 16, 24, 32, 48, 64, 96, 128];
  const dfa = computeDFA(u, scales);
  const slope = computeSlopeUniform(u, fs, fLow, fHigh, 256);
  const deltaWK = slope + (2 * dfa - 1);
  // Phase-randomized surrogate (exact same power spectrum!)
  const surr = phaseRandomizedSurrogate(u, seed);
  const dfaSurr = computeDFA(surr, scales);
  const slopeSurr = computeSlopeUniform(surr, fs, fLow, fHigh, 256);
  const deltaWKSurr = slopeSurr + (2 * dfaSurr - 1);
  return { dfa, slope, wkPred: -(2 * dfa - 1), deltaWK, dfaSurr, slopeSurr, deltaWKSurr };
}

function rrTimesToMetrics(beatTimes, seed) {
  const raw = [];
  for (let i = 1; i < beatTimes.length; i++) {
    const dt = beatTimes[i] - beatTimes[i - 1];
    if (dt >= 0.35 && dt <= 1.80) raw.push(dt);
  }
  if (raw.length < 180) return null;
  const sorted = [...raw].sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)];
  const rr = raw.filter((v) => Math.abs(v - med) <= 0.25 * med);
  if (rr.length < 160) return null;

  const meanRR = rr.reduce((a, b) => a + b, 0) / rr.length;
  const sdnn = Math.sqrt(rr.reduce((a, b) => a + (b - meanRR) ** 2, 0) / rr.length) * 1000;
  let diff2 = 0;
  for (let i = 1; i < rr.length; i++) diff2 += (rr[i] - rr[i - 1]) ** 2;
  const rmssd = Math.sqrt(diff2 / (rr.length - 1)) * 1000;

  // Resample to uniform 4 Hz
  const tCum = [0];
  for (let i = 0; i < rr.length; i++) tCum.push(tCum[i] + rr[i]);
  const dur = tCum[tCum.length - 1];
  const fs = 4, N = Math.floor(dur * fs);
  if (N < 512) return null;
  const u = new Float64Array(N);
  let idx = 0;
  for (let i = 0; i < N; i++) {
    const t = i / fs;
    while (idx + 1 < rr.length && tCum[idx + 1] < t) idx++;
    const t0 = tCum[idx], t1 = tCum[idx + 1];
    const frac = t1 > t0 ? (t - t0) / (t1 - t0) : 0;
    u[i] = rr[idx] + frac * ((rr[Math.min(idx + 1, rr.length - 1)]) - rr[idx]);
  }
  const wk = analyzeUniformSeries(u, fs, 0.04, 0.40, seed);
  return { nBeats: rr.length, meanHR: 60 / meanRR, sdnn, rmssd, ...wk };
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

function residualize(y, covs) {
  // OLS residual of y on [1, cov1, cov2, ...]
  const n = y.length, p = covs.length + 1;
  const X = Array.from({ length: n }, (_, i) => [1, ...covs.map((c) => c[i])]);
  const XtX = Array.from({ length: p }, () => new Float64Array(p));
  const Xty = new Float64Array(p);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < p; j++) {
      Xty[j] += X[i][j] * y[i];
      for (let k = 0; k < p; k++) XtX[j][k] += X[i][j] * X[i][k];
    }
  }
  // Gaussian elimination
  const A = XtX.map((row, i) => [...row, Xty[i]]);
  for (let i = 0; i < p; i++) {
    let maxR = i;
    for (let r = i + 1; r < p; r++) if (Math.abs(A[r][i]) > Math.abs(A[maxR][i])) maxR = r;
    [A[i], A[maxR]] = [A[maxR], A[i]];
    const piv = A[i][i] || 1e-12;
    for (let j = i; j <= p; j++) A[i][j] /= piv;
    for (let r = 0; r < p; r++) {
      if (r === i) continue;
      const f = A[r][i];
      for (let j = i; j <= p; j++) A[r][j] -= f * A[i][j];
    }
  }
  const beta = A.map((row) => row[p]);
  return y.map((yi, i) => yi - X[i].reduce((s, xij, j) => s + xij * beta[j], 0));
}

function permPValCorr(x, y, nPerm = 10000) {
  const rObs = Math.abs(pearsonR(x, y));
  const yy = [...y];
  let ge = 0, seed = 202624;
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

function pairedDiffP(a, b, nPerm = 10000) {
  const diffs = a.map((v, i) => v - b[i]);
  const meanDiff = diffs.reduce((s, v) => s + v, 0) / diffs.length;
  const sd = Math.sqrt(diffs.reduce((s, v) => s + (v - meanDiff) ** 2, 0) / (diffs.length - 1));
  const t = meanDiff / (sd / Math.sqrt(diffs.length));
  let ge = 0, seed = 2026249;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let p = 0; p < nPerm; p++) {
    let s = 0;
    for (let i = 0; i < diffs.length; i++) s += (rand() < 0.5 ? 1 : -1) * diffs[i];
    if (Math.abs(s / diffs.length) >= Math.abs(meanDiff)) ge++;
  }
  return { meanA: a.reduce((x, y) => x + y, 0) / a.length, meanB: b.reduce((x, y) => x + y, 0) / b.length, meanDiff, t, p: (ge + 1) / (nPerm + 1) };
}

function fiveFoldLinearCV(x, y) {
  const n = x.length;
  const preds = new Float64Array(n);
  for (let fold = 0; fold < 5; fold++) {
    const trX = [], trY = [], teIdx = [];
    for (let i = 0; i < n; i++) {
      if (i % 5 === fold) teIdx.push(i);
      else { trX.push(x[i]); trY.push(y[i]); }
    }
    const mx = trX.reduce((a, b) => a + b, 0) / trX.length;
    const my = trY.reduce((a, b) => a + b, 0) / trY.length;
    let num = 0, den = 0;
    for (let i = 0; i < trX.length; i++) { num += (trX[i] - mx) * (trY[i] - my); den += (trX[i] - mx) ** 2; }
    const b = den > 0 ? num / den : 0, a = my - b * mx;
    for (const idx of teIdx) preds[idx] = a + b * x[idx];
  }
  const r = pearsonR(Array.from(preds), y);
  const mae = preds.reduce((s, p, i) => s + Math.abs(p - y[i]), 0) / n;
  const pVal = permPValCorr(Array.from(preds), y, 10000);
  return { r, r2: r * r, mae, permP: pVal };
}

async function processSubject(sub) {
  try {
    const heaRes = await fetch(`${BASE_URL}/${sub.id}.hea`);
    if (!heaRes.ok) return null;
    const heaLines = (await heaRes.text()).trim().split(/\r?\n/);
    const hdr = heaLines[0].trim().split(/\s+/);
    const nSig = parseInt(hdr[1], 10);
    const fs = parseFloat(hdr[2]);
    if (!Number.isFinite(nSig) || !Number.isFinite(fs) || nSig < 2) return null;

    let ecgIdx = -1, bpIdx = -1, bpGain = 1, bpBase = 0;
    for (let ch = 0; ch < nSig; ch++) {
      const ln = heaLines[ch + 1] || '';
      const parts = ln.trim().split(/\s+/);
      const name = (parts[parts.length - 1] || '').toUpperCase();
      if (ecgIdx === -1 && name.includes('ECG')) ecgIdx = ch;
      if (bpIdx === -1 && (name.includes('NIBP') || name.includes('BP'))) {
        bpIdx = ch;
        const gMatch = (parts[2] || '').match(/^([0-9.+-]+)(?:\(([0-9.+-]+)\))?/);
        if (gMatch) {
          bpGain = parseFloat(gMatch[1]) || 1;
          bpBase = gMatch[2] ? parseFloat(gMatch[2]) : 0;
        }
      }
    }
    if (ecgIdx === -1) return null;

    // Fetch exactly 5 minutes (300 s) starting at minute 2 (skip initial 120 s settling)
    const startSec = 120, durSec = 300;
    const bytesPerFrame = nSig * 2;
    const startByte = Math.floor(startSec * fs) * bytesPerFrame;
    const nSamples = Math.floor(durSec * fs);
    const endByte = startByte + nSamples * bytesPerFrame - 1;

    const datRes = await fetch(`${BASE_URL}/${sub.id}.dat`, {
      headers: { Range: `bytes=${startByte}-${endByte}` }
    });
    if (!datRes.ok && datRes.status !== 206) return null;
    const buf = Buffer.from(await datRes.arrayBuffer());
    const availFrames = Math.floor(buf.length / bytesPerFrame);
    if (availFrames < Math.floor(240 * fs)) return null;

    // Downsample ECG to 250 Hz and BP to 4 Hz
    const decEcg = Math.max(1, Math.round(fs / 250));
    const nEcg = Math.floor(availFrames / decEcg);
    const ecg250 = new Float64Array(nEcg);
    for (let i = 0; i < nEcg; i++) {
      const f = i * decEcg;
      ecg250[i] = buf.readInt16LE((f * nSig + ecgIdx) * 2);
    }

    const seed = parseInt(sub.id, 10) * 7919 + 17;
    const peaks = detectRPeaks250Hz(ecg250);
    const hrv = rrTimesToMetrics(peaks, seed);
    if (!hrv || !Number.isFinite(hrv.deltaWK)) return null;

    let bp = null;
    if (bpIdx !== -1) {
      const decBp = Math.max(1, Math.round(fs / 4));
      const nBp = Math.floor(availFrames / decBp);
      const bp4 = new Float64Array(nBp);
      let meanBP = 0;
      for (let i = 0; i < nBp; i++) {
        // Boxcar average over decBp samples for clean anti-aliased 4 Hz BP envelope
        let acc = 0;
        const baseF = i * decBp;
        for (let k = 0; k < decBp; k += 5) {
          acc += (buf.readInt16LE(((baseF + k) * nSig + bpIdx) * 2) - bpBase) / bpGain;
        }
        bp4[i] = acc / Math.ceil(decBp / 5);
        meanBP += bp4[i];
      }
      meanBP /= nBp;
      if (Number.isFinite(meanBP) && meanBP > 40 && meanBP < 180) {
        const wkBP = analyzeUniformSeries(bp4, 4, 0.04, 0.40, seed + 999);
        if (Number.isFinite(wkBP.deltaWK)) {
          bp = { meanBP, ...wkBP };
        }
      }
    }

    return { ...sub, hrv, bp };
  } catch {
    return null;
  }
}

async function main() {
  console.log('=== Project ONEIRIS — Lab #24: Independent 2nd-Lab Heart-Age Replication + 5th Organ (Arterial BP) + Phase-Randomized Surrogates ===');
  const csvText = await (await fetch(`${BASE_URL}/subject-info.csv`)).text();
  const rows = csvText.trim().split(/\r?\n/).slice(1).map((ln) => {
    const c = ln.split(',');
    const ag = parseInt(c[1], 10);
    return {
      id: c[0].trim(),
      ageGroup: ag,
      age: AGE_MIDPOINTS[ag] || NaN,
      sex: parseInt(c[2], 10),
      bmi: parseFloat(c[3]),
      lengthMin: parseFloat(c[4])
    };
  }).filter((r) => Number.isFinite(r.age) && Number.isFinite(r.sex) && Number.isFinite(r.bmi) && r.lengthMin >= 10);

  // Age-stratified selection: up to 10 subjects per age group (1..15) for uniform coverage across 18-92 yrs!
  const byGroup = new Map();
  for (const r of rows) {
    if (!byGroup.has(r.ageGroup)) byGroup.set(r.ageGroup, []);
    byGroup.get(r.ageGroup).push(r);
  }
  const selected = [];
  for (let ag = 1; ag <= 15; ag++) {
    const list = byGroup.get(ag) || [];
    selected.push(...list.slice(0, 9));
  }
  console.log(`Selected N = ${selected.length} age-stratified humans across groups 1..15 (ages 18-92). Downloading 5-min windows...`);

  // Process in parallel batches of 6
  const results = [];
  for (let i = 0; i < selected.length; i += 6) {
    const batch = selected.slice(i, i + 6);
    const res = await Promise.all(batch.map(processSubject));
    for (const r of res) if (r) results.push(r);
    if ((i + 6) % 30 === 0 || i + 6 >= selected.length) {
      console.log(`  Progress: ${Math.min(i + 6, selected.length)}/${selected.length} fetched -> ${results.length} valid`);
    }
  }

  console.log(`\nSuccessfully analyzed N = ${results.length} independent humans (ages ${Math.min(...results.map((r) => r.age))}-${Math.max(...results.map((r) => r.age))}).`);

  // 1. HEART (2nd-Lab Independent Replication)
  const ages = results.map((r) => r.age);
  const sexes = results.map((r) => r.sex);
  const bmis = results.map((r) => r.bmi);
  const hSlp = results.map((r) => r.hrv.slope);
  const hWkPred = results.map((r) => r.hrv.wkPred);
  const hDwk = results.map((r) => r.hrv.deltaWK);
  const hDwkSurr = results.map((r) => r.hrv.deltaWKSurr);
  const hSdnn = results.map((r) => r.hrv.sdnn);
  const hRmssd = results.map((r) => r.hrv.rmssd);

  const rHeartLaw = pearsonR(hSlp, hWkPred);
  const pHeartLaw = permPValCorr(hSlp, hWkPred);
  const rHeartAge = pearsonR(hDwk, ages);
  const pHeartAge = permPValCorr(hDwk, ages);
  const rHeartAgePart = pearsonR(residualize(hDwk, [sexes, bmis]), residualize(ages, [sexes, bmis]));
  const pHeartAgePart = permPValCorr(residualize(hDwk, [sexes, bmis]), residualize(ages, [sexes, bmis]));
  const rSdnnAge = pearsonR(hSdnn, ages);
  const pSdnnAge = permPValCorr(hSdnn, ages);
  const rRmssdAge = pearsonR(hRmssd, ages);
  const pRmssdAge = permPValCorr(hRmssd, ages);
  const cvHeart = fiveFoldLinearCV(hDwk, ages);

  // Surrogate Null Proof (Heart)
  const rHeartSurrAge = pearsonR(hDwkSurr, ages);
  const pHeartSurrAge = permPValCorr(hDwkSurr, ages);
  const heartRealVsSurrAbs = pairedDiffP(hDwk.map(Math.abs), hDwkSurr.map(Math.abs));
  const heartRealVsSurrSigned = pairedDiffP(hDwk, hDwkSurr);

  console.log(`\n[1] INDEPENDENT 2ND-LAB HEART REPLICATION (5-min ECG, N=${results.length}, Germany):`);
  console.log(`    WK Law (slope vs -(2*DFA-1)): r = ${rHeartLaw.toFixed(4)} (R^2=${(rHeartLaw * rHeartLaw * 100).toFixed(1)}%), p = ${pHeartLaw.toExponential(2)}`);
  console.log(`    Delta_WK_HRV vs Age:          r = ${rHeartAge.toFixed(4)}, p = ${pHeartAge.toExponential(2)} | Partial(Sex,BMI) r = ${rHeartAgePart.toFixed(4)}, p = ${pHeartAgePart.toExponential(2)}`);
  console.log(`    5-Fold Out-of-Sample CV:      r = ${cvHeart.r.toFixed(4)}, R^2 = ${(cvHeart.r2 * 100).toFixed(1)}%, MAE = ${cvHeart.mae.toFixed(2)} yrs, p = ${cvHeart.permP.toExponential(2)}`);
  console.log(`    Baselines: SDNN r = ${rSdnnAge.toFixed(4)} (p=${pSdnnAge.toExponential(2)}) | RMSSD r = ${rRmssdAge.toFixed(4)} (p=${pRmssdAge.toExponential(2)})`);
  console.log(`    PHASE-RANDOMIZED SURROGATE:   Surr Delta_WK vs Age r = ${rHeartSurrAge.toFixed(4)} (p=${pHeartSurrAge.toFixed(4)})`);
  console.log(`    Real |Delta_WK| vs Surr:      ${heartRealVsSurrAbs.meanA.toFixed(4)} vs ${heartRealVsSurrAbs.meanB.toFixed(4)} (t=${heartRealVsSurrAbs.t.toFixed(2)}, p=${heartRealVsSurrAbs.p.toExponential(2)})`);

  // 2. 5TH HUMAN ORGAN SYSTEM: VASCULAR / CONTINUOUS ARTERIAL BLOOD PRESSURE (NIBP)
  const bpSubs = results.filter((r) => r.bp !== null);
  const bpAges = bpSubs.map((r) => r.age);
  const bpSex = bpSubs.map((r) => r.sex);
  const bpBmi = bpSubs.map((r) => r.bmi);
  const bpSlp = bpSubs.map((r) => r.bp.slope);
  const bpWkPred = bpSubs.map((r) => r.bp.wkPred);
  const bpDwk = bpSubs.map((r) => r.bp.deltaWK);
  const bpDwkSurr = bpSubs.map((r) => r.bp.deltaWKSurr);
  const bpMean = bpSubs.map((r) => r.bp.meanBP);

  const rBpLaw = pearsonR(bpSlp, bpWkPred);
  const pBpLaw = permPValCorr(bpSlp, bpWkPred);
  const rBpAge = pearsonR(bpDwk, bpAges);
  const pBpAge = permPValCorr(bpDwk, bpAges);
  const rBpAgePart = pearsonR(residualize(bpDwk, [bpSex, bpBmi]), residualize(bpAges, [bpSex, bpBmi]));
  const pBpAgePart = permPValCorr(residualize(bpDwk, [bpSex, bpBmi]), residualize(bpAges, [bpSex, bpBmi]));
  const rMeanBpAge = pearsonR(bpMean, bpAges);
  const pMeanBpAge = permPValCorr(bpMean, bpAges);
  const rBpSurrAge = pearsonR(bpDwkSurr, bpAges);
  const pBpSurrAge = permPValCorr(bpDwkSurr, bpAges);
  const bpRealVsSurrAbs = pairedDiffP(bpDwk.map(Math.abs), bpDwkSurr.map(Math.abs));
  const rHeartBpCoupling = pearsonR(bpSubs.map((r) => r.hrv.deltaWK), bpDwk);
  const pHeartBpCoupling = permPValCorr(bpSubs.map((r) => r.hrv.deltaWK), bpDwk);

  console.log(`\n[2] 5TH HUMAN ORGAN SYSTEM — ARTERIAL BLOOD PRESSURE (NIBP, N=${bpSubs.length}):`);
  console.log(`    WK Law (slope vs -(2*DFA-1)): r = ${rBpLaw.toFixed(4)} (R^2=${(rBpLaw * rBpLaw * 100).toFixed(1)}%), p = ${pBpLaw.toExponential(2)}`);
  console.log(`    Delta_WK_BP vs Age:           r = ${rBpAge.toFixed(4)}, p = ${pBpAge.toExponential(2)} | Partial(Sex,BMI) r = ${rBpAgePart.toFixed(4)}, p = ${pBpAgePart.toExponential(2)}`);
  console.log(`    Mean Arterial BP vs Age:      r = ${rMeanBpAge.toFixed(4)}, p = ${pMeanBpAge.toExponential(2)}`);
  console.log(`    PHASE-RANDOMIZED SURROGATE:   Surr Delta_WK_BP vs Age r = ${rBpSurrAge.toFixed(4)} (p=${pBpSurrAge.toFixed(4)})`);
  console.log(`    Real |Delta_WK_BP| vs Surr:   ${bpRealVsSurrAbs.meanA.toFixed(4)} vs ${bpRealVsSurrAbs.meanB.toFixed(4)} (t=${bpRealVsSurrAbs.t.toFixed(2)}, p=${bpRealVsSurrAbs.p.toExponential(2)})`);
  console.log(`    Within-Human Heart-BP dWK:    r = ${rHeartBpCoupling.toFixed(4)}, p = ${pHeartBpCoupling.toExponential(2)}`);

  const out = {
    lab: 'Lab #24 — Independent 2nd-Lab Heart Replication + 5th Organ (Arterial BP) + Phase-Randomized Surrogates',
    nHeart: results.length,
    nBP: bpSubs.length,
    heart: {
      wkLaw: { r: rHeartLaw, r2: rHeartLaw * rHeartLaw, permP: pHeartLaw },
      deltaWKvsAge: { r: rHeartAge, permP: pHeartAge, rPartialSexBMI: rHeartAgePart, pPartialSexBMI: pHeartAgePart },
      cv5Fold: cvHeart,
      baselines: { sdnn: { r: rSdnnAge, p: pSdnnAge }, rmssd: { r: rRmssdAge, p: pRmssdAge } },
      surrogateNull: { rSurrVsAge: rHeartSurrAge, pSurrVsAge: pHeartSurrAge, realVsSurrAbs: heartRealVsSurrAbs, realVsSurrSigned: heartRealVsSurrSigned }
    },
    vascularBP: {
      wkLaw: { r: rBpLaw, r2: rBpLaw * rBpLaw, permP: pBpLaw },
      deltaWKvsAge: { r: rBpAge, permP: pBpAge, rPartialSexBMI: rBpAgePart, pPartialSexBMI: pBpAgePart },
      meanBPvsAge: { r: rMeanBpAge, permP: pMeanBpAge },
      surrogateNull: { rSurrVsAge: rBpSurrAge, pSurrVsAge: pBpSurrAge, realVsSurrAbs: bpRealVsSurrAbs },
      withinHumanHeartBPCoupling: { r: rHeartBpCoupling, permP: pHeartBpCoupling }
    },
    subjects: results
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
  console.log(`\nSaved -> ${OUT_PATH}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
