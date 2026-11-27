'use strict';

/**
 * Project ONEIRIS — Lab #27 (Jumble v5 Collision C2):
 *   SIMULTANEOUS 4-ORGAN OVERNIGHT SLEEP COUPLING (Brain EEG + Heart ECG + Arterial BP + Respiration)
 *   Dataset: PhysioNet MIT-BIH Polysomnographic Database (slpdb v1.0.0, 18 overnight human recordings)
 *
 * Inside the EXACT SAME sleeping humans (fixed supine sleep posture!), extracts simultaneously:
 *   1. Brain (EEG, 250 Hz -> 2s frame average slopeBB, DFA, Δ_WK_Brain)
 *   2. Heart (ECG, 250 Hz -> Pan-Tompkins R-peaks -> 4 Hz uniform RR -> Δ_WK_Heart)
 *   3. Vascular (Arterial BP, 250 Hz -> 4 Hz uniform -> Δ_WK_BP)
 *   4. Lungs (Respiration, 250 Hz -> 4 Hz uniform -> Δ_WK_Resp)
 *
 * Tests:
 *   - Within-human 4-organ Δ_WK coupling matrix during overnight sleep (Brain <-> Heart <-> BP <-> Resp)
 *   - Unified Brain + Heart Sleep-Age Clock vs single-organ clocks (using exact header ages)
 *
 * Output: reanalysis/data/lab27_slpdb_4organ_simultaneous_sleep_results.json
 */

const fs = require('fs');
const path = require('path');
const sdk = require('../sdk/oneiris_wearable_sdk.js');

const BASE_URL = 'https://physionet.org/files/slpdb/1.0.0';
const OUT_PATH = path.join(__dirname, 'data', 'lab27_slpdb_4organ_simultaneous_sleep_results.json');

function decodeFormat212(buf, nSig) {
  // Format 212: every 3 bytes encodes TWO 12-bit signed integers
  const totalTriplets = Math.floor(buf.length / 3);
  const totalSamples = totalTriplets * 2;
  const nFrames = Math.floor(totalSamples / nSig);
  const chans = Array.from({ length: nSig }, () => new Float64Array(nFrames));
  let sIdx = 0;
  for (let t = 0; t < totalTriplets && sIdx + 1 < nFrames * nSig; t++) {
    const b0 = buf[t * 3], b1 = buf[t * 3 + 1], b2 = buf[t * 3 + 2];
    let v0 = b0 | ((b1 & 0x0f) << 8);
    if (v0 & 0x800) v0 -= 4096;
    let v1 = b2 | ((b1 & 0xf0) << 4);
    if (v1 & 0x800) v1 -= 4096;
    chans[sIdx % nSig][Math.floor(sIdx / nSig)] = v0; sIdx++;
    chans[sIdx % nSig][Math.floor(sIdx / nSig)] = v1; sIdx++;
  }
  return chans;
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

function computeSlopeUniform(u, fs, fLow, fHigh, nfft = 256) {
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
  const step = 62; // ~4.03 Hz
  const n = Math.floor(sig250.length / step);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let acc = 0; for (let k = 0; k < step; k++) acc += sig250[i * step + k];
    out[i] = acc / step;
  }
  return out;
}

function pearsonR(x, y) {
  const n = x.length;
  const mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) { num += (x[i] - mx) * (y[i] - my); dx2 += (x[i] - mx) ** 2; dy2 += (y[i] - my) ** 2; }
  return dx2 > 0 && dy2 > 0 ? num / Math.sqrt(dx2 * dy2) : 0;
}

function permP(x, y, nPerm = 10000) {
  const rObs = Math.abs(pearsonR(x, y)), yy = [...y];
  let ge = 0, seed = 202627;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let p = 0; p < nPerm; p++) {
    for (let i = yy.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [yy[i], yy[j]] = [yy[j], yy[i]]; }
    if (Math.abs(pearsonR(x, yy)) >= rObs) ge++;
  }
  return (ge + 1) / (nPerm + 1);
}

async function processRec(rec) {
  const heaTxt = await fetch(`${BASE_URL}/${rec}.hea`).then((r) => (r.ok ? r.text() : null));
  if (!heaTxt) return null;
  const lines = heaTxt.trim().split(/\r?\n/);
  const hdr = lines[0].trim().split(/\s+/);
  const nSig = parseInt(hdr[1], 10);
  const fs = parseFloat(hdr[2]);
  const ageLine = lines.find((l) => l.startsWith('#')) || '';
  const ageMatch = ageLine.match(/#\s*(\d+)/);
  const age = ageMatch ? parseInt(ageMatch[1], 10) : NaN;

  let iEcg = -1, iBp = -1, iEeg = -1, iResp = -1;
  for (let c = 0; c < nSig; c++) {
    const ln = (lines[c + 1] || '').toUpperCase();
    if (iEcg < 0 && ln.includes('ECG')) iEcg = c;
    if (iBp < 0 && ln.includes('BP')) iBp = c;
    if (iEeg < 0 && ln.includes('EEG')) iEeg = c;
    if (iResp < 0 && ln.includes('RESP')) iResp = c;
  }
  if (iEcg < 0 || iEeg < 0) return null;

  // Fetch 10 minutes (600 s) starting at minute 30 into overnight sleep (deep settled sleep!)
  const startSec = 1800, durSec = 600;
  // Format 212: 3 bytes per 2 samples -> align startSample to even multiple of nSig*2
  const startFrame = Math.floor(startSec * fs / 2) * 2;
  const nFrames = Math.floor(durSec * fs / 2) * 2;
  const startByte = (startFrame * nSig * 3) / 2;
  const endByte = startByte + (nFrames * nSig * 3) / 2 - 1;

  const res = await fetch(`${BASE_URL}/${rec}.dat`, { headers: { Range: `bytes=${startByte}-${endByte}` } });
  if (!res.ok && res.status !== 206) return null;
  const chans = decodeFormat212(Buffer.from(await res.arrayBuffer()), nSig);
  if (chans[0].length < 250 * 300) return null;

  // 1. BRAIN (EEG 250 Hz, 1 Hz highpass -> 2s frames via SDK)
  const eeg = chans[iEeg];
  const rc = 1 / (2 * Math.PI * 1.0), al = rc / (rc + 1 / 250);
  let px = eeg[0], py = 0; eeg[0] = 0;
  for (let t = 1; t < eeg.length; t++) { const x = eeg[t], y = al * (py + x - px); eeg[t] = y; px = x; py = y; }
  const winN = 500;
  const bFrames = [];
  for (let s = 0; s + winN <= eeg.length; s += winN) {
    bFrames.push(sdk.computeFrameMetrics(eeg.subarray(s, s + winN), eeg.subarray(s, s + winN), 250));
  }
  const brainWK = bFrames.reduce((a, f) => a + f.wkViolation, 0) / bFrames.length;
  const brainSlope = bFrames.reduce((a, f) => a + f.slopeBB, 0) / bFrames.length;
  const brainDFA = bFrames.reduce((a, f) => a + f.dfa, 0) / bFrames.length;

  // 2. HEART (ECG 250 Hz -> R-peaks -> 4 Hz RR -> WK)
  const peaks = detectRPeaks250Hz(chans[iEcg]);
  const rawRR = [];
  for (let i = 1; i < peaks.length; i++) { const dt = peaks[i] - peaks[i - 1]; if (dt >= 0.35 && dt <= 1.80) rawRR.push(dt); }
  const sorted = [...rawRR].sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)] || 0.9;
  const rr = rawRR.filter((v) => Math.abs(v - med) <= 0.25 * med);
  let heartWK = NaN, heartSlope = NaN, heartDFA = NaN;
  if (rr.length >= 200) {
    const tCum = [0]; for (let i = 0; i < rr.length; i++) tCum.push(tCum[i] + rr[i]);
    const dur = tCum[tCum.length - 1], N4 = Math.floor(dur * 4);
    const u = new Float64Array(N4); let idx = 0;
    for (let i = 0; i < N4; i++) {
      const t = i / 4; while (idx + 1 < rr.length && tCum[idx + 1] < t) idx++;
      const frac = tCum[idx + 1] > tCum[idx] ? (t - tCum[idx]) / (tCum[idx + 1] - tCum[idx]) : 0;
      u[i] = rr[idx] + frac * (rr[Math.min(idx + 1, rr.length - 1)] - rr[idx]);
    }
    const scales = [8, 12, 16, 24, 32, 48, 64, 96, 128];
    heartDFA = computeDFA(u, scales);
    heartSlope = computeSlopeUniform(u, 4, 0.04, 0.40, 256);
    heartWK = heartSlope + (2 * heartDFA - 1);
  }

  // 3. ARTERIAL BP (4 Hz)
  let bpWK = NaN;
  if (iBp >= 0) {
    const uBp = downsample4Hz(chans[iBp]);
    const bpDFA = computeDFA(uBp, [8, 12, 16, 24, 32, 48, 64, 96, 128]);
    const bpSlp = computeSlopeUniform(uBp, 4, 0.04, 0.40, 256);
    bpWK = bpSlp + (2 * bpDFA - 1);
  }

  // 4. RESPIRATION (4 Hz)
  let respWK = NaN;
  if (iResp >= 0) {
    const uR = downsample4Hz(chans[iResp]);
    const rDFA = computeDFA(uR, [8, 12, 16, 24, 32, 48, 64, 96, 128]);
    const rSlp = computeSlopeUniform(uR, 4, 0.04, 0.40, 256);
    respWK = rSlp + (2 * rDFA - 1);
  }

  return { rec, age, brainWK, brainSlope, brainDFA, heartWK, heartSlope, heartDFA, bpWK, respWK };
}

async function main() {
  const recsTxt = await fetch(`${BASE_URL}/RECORDS`).then((r) => r.text());
  const recs = recsTxt.trim().split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  console.log(`=== Lab #27 (Jumble C2): Simultaneous 4-Organ Overnight Sleep (slpdb, ${recs.length} recordings) ===`);
  const rows = (await Promise.all(recs.map((r) => processRec(r).catch(() => null)))).filter((x) => x && Number.isFinite(x.heartWK));
  console.log(`Analyzed N = ${rows.length} simultaneous overnight sleep recordings (ages ${Math.min(...rows.map((r) => r.age))}-${Math.max(...rows.map((r) => r.age))}).`);

  const pairs = [
    ['Brain_WK vs Heart_WK', rows.map((r) => r.brainWK), rows.map((r) => r.heartWK)],
    ['Heart_WK vs BP_WK', rows.filter((r) => Number.isFinite(r.bpWK)).map((r) => r.heartWK), rows.filter((r) => Number.isFinite(r.bpWK)).map((r) => r.bpWK)],
    ['Brain_WK vs BP_WK', rows.filter((r) => Number.isFinite(r.bpWK)).map((r) => r.brainWK), rows.filter((r) => Number.isFinite(r.bpWK)).map((r) => r.bpWK)],
    ['Brain_WK vs Resp_WK', rows.filter((r) => Number.isFinite(r.respWK)).map((r) => r.brainWK), rows.filter((r) => Number.isFinite(r.respWK)).map((r) => r.respWK)],
    ['Heart_WK vs Resp_WK', rows.filter((r) => Number.isFinite(r.respWK)).map((r) => r.heartWK), rows.filter((r) => Number.isFinite(r.respWK)).map((r) => r.respWK)],
    ['Brain_WK vs Age', rows.filter((r) => Number.isFinite(r.age)).map((r) => r.brainWK), rows.filter((r) => Number.isFinite(r.age)).map((r) => r.age)],
    ['Heart_WK vs Age', rows.filter((r) => Number.isFinite(r.age)).map((r) => r.heartWK), rows.filter((r) => Number.isFinite(r.age)).map((r) => r.age)],
    ['(Brain+Heart)_WK vs Age', rows.filter((r) => Number.isFinite(r.age)).map((r) => r.brainWK + r.heartWK), rows.filter((r) => Number.isFinite(r.age)).map((r) => r.age)]
  ];

  const summary = {};
  console.log('\n[WITHIN-HUMAN 4-ORGAN OVERNIGHT SLEEP COUPLING & AGE MATRIX]:');
  for (const [label, a, b] of pairs) {
    const r = pearsonR(a, b), p = permP(a, b, 10000);
    summary[label] = { n: a.length, r: +r.toFixed(4), p: +p.toFixed(5) };
    console.log(`  ${label.padEnd(26)} n=${a.length} | r = ${r.toFixed(4)}, perm p = ${p.toFixed(5)}`);
  }

  const out = { lab: 'Lab #27 — Simultaneous 4-Organ Overnight Sleep Coupling (PhysioNet slpdb)', nRecordings: rows.length, summary, recordings: rows };
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
  console.log(`\nSaved -> ${OUT_PATH}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
