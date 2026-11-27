'use strict';

/**
 * Project ONEIRIS — Lab #22: Cross-Organ Smartwatch Validation (5-min vs 30-min Heart-Age Clock,
 * Morning-vs-Night Same-Human Stability, AND 3rd-Organ Human Respiration Δ_WK!)
 *
 * Tests 3 critical questions:
 *   1. SMARTWATCH FEASIBILITY (PhysioNet nsr2db, N=54):
 *      - Does Δ_WK_HRV still track biological age in just 5 MINUTES (~350 beats) vs 15 min vs 30 min?
 *      - What is the strictly out-of-sample 5-fold CV MAE (years) & r of a 1-feature Δ_WK_HRV Heart-Age Clock?
 *   2. SAME-HUMAN RELIABILITY (PhysioNet nsr2db, N=54):
 *      - Comparing Window A (hour 4) vs Window B (hour 16 — 12 hours apart inside the SAME human!),
 *        what is the test-retest correlation r and mean absolute age difference?
 *   3. THIRD ORGAN SYSTEM — HUMAN RESPIRATION (PhysioNet Fantasia, N=40, ch 0 = RESP):
 *      - Does the Wiener-Khinchin scaling law slope = -(2*DFA - 1) & Δ_WK aging hold on HUMAN BREATHING too?!
 *
 * Output: reanalysis/data/lab22_cross_organ_smartwatch_and_respiration_results.json
 */

const fs = require('fs');
const path = require('path');

const OUT_PATH = path.join(__dirname, 'data', 'lab22_cross_organ_smartwatch_and_respiration_results.json');

function parseMitBihBeatTimes(buf, sfreq = 128) {
  const times = [];
  let t = 0, pos = 0;
  while (pos + 2 <= buf.length) {
    const w = buf.readUInt16LE(pos); pos += 2;
    const code = (w >>> 10) & 0x3f, val = w & 0x3ff;
    if (code === 0 && val === 0) break;
    if (code === 59) {
      if (pos + 4 > buf.length) break;
      const hi = buf.readUInt16LE(pos), lo = buf.readUInt16LE(pos + 2); pos += 4;
      t += ((hi << 16) | lo) | 0;
    } else if (code === 63) {
      pos += val + (val % 2);
    } else if (code < 60) {
      t += val;
      if (code >= 1 && code <= 13) times.push(t / sfreq);
    }
  }
  return times;
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
  const N = sig.length, mean = sig.reduce((a, b) => a + b, 0) / N;
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
  return den > 0 ? num / den : 1.0;
}

function computeSlopeUniform(u, fs, fLow, fHigh, nfft = 256) {
  if (u.length < nfft) return -1.0;
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
  return den > 0 ? num / den : -1.0;
}

function rrToWK(beatSlice) {
  const raw = [];
  for (let i = 1; i < beatSlice.length; i++) { const dt = beatSlice[i] - beatSlice[i - 1]; if (dt >= 0.35 && dt <= 1.80) raw.push(dt); }
  const rr = [];
  for (let i = 1; i < raw.length - 1; i++) { const med = (raw[i - 1] + raw[i + 1]) / 2; if (Math.abs(raw[i] - med) / med < 0.20) rr.push(raw[i]); }
  if (rr.length < 180) return null;
  const fs = 2.0, ts = [0]; for (let i = 0; i < rr.length; i++) ts.push(ts[i] + rr[i]);
  const nU = Math.floor(ts[ts.length - 1] * fs);
  const u = new Float64Array(nU); let j = 0;
  for (let i = 0; i < nU; i++) { const t = i / fs; while (j + 1 < rr.length && ts[j + 1] < t) j++; u[i] = rr[j]; }
  const slope = computeSlopeUniform(u, fs, 0.01, 0.15, 256);
  const dfa = computeDFA(rr, [4, 6, 8, 12, 16, 24, 32, 48, 64, 96]);
  return { slope, dfa, wk: slope + (2 * dfa - 1) };
}

function erfc(x) {
  const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
    t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}

function pearson(xs, ys) {
  const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); dx += (xs[i] - mx) ** 2; dy += (ys[i] - my) ** 2; }
  const r = num / Math.max(1e-12, Math.sqrt(dx * dy));
  const t = r * Math.sqrt((n - 2) / Math.max(1e-9, 1 - r * r));
  return { n, r: +r.toFixed(4), R2: +(r * r).toFixed(4), p: +erfc(Math.abs(t) / Math.SQRT2).toFixed(8) };
}

function twoSample(g1, g2) {
  const m1 = g1.reduce((a, b) => a + b, 0) / g1.length, m2 = g2.reduce((a, b) => a + b, 0) / g2.length;
  const v1 = g1.reduce((a, b) => a + (b - m1) ** 2, 0) / Math.max(1, g1.length - 1);
  const v2 = g2.reduce((a, b) => a + (b - m2) ** 2, 0) / Math.max(1, g2.length - 1);
  const psd = Math.sqrt(((g1.length - 1) * v1 + (g2.length - 1) * v2) / Math.max(1, g1.length + g2.length - 2)) || 1e-9;
  const t = (m1 - m2) / (Math.sqrt(v1 / g1.length + v2 / g2.length) || 1e-9);
  return { meanOld: +m1.toFixed(4), meanYoung: +m2.toFixed(4), d: +((m1 - m2) / psd).toFixed(3), p: +erfc(Math.abs(t) / Math.SQRT2).toFixed(6) };
}

function fiveFold1DLinearCV(xs, ys) {
  const n = xs.length, preds = new Array(n);
  for (let f = 0; f < 5; f++) {
    const tx = [], ty = [];
    for (let i = 0; i < n; i++) if (i % 5 !== f) { tx.push(xs[i]); ty.push(ys[i]); }
    const mx = tx.reduce((a, b) => a + b, 0) / tx.length, my = ty.reduce((a, b) => a + b, 0) / ty.length;
    let num = 0, den = 0;
    for (let i = 0; i < tx.length; i++) { num += (tx[i] - mx) * (ty[i] - my); den += (tx[i] - mx) ** 2; }
    const b = num / Math.max(1e-12, den), a = my - b * mx;
    for (let i = 0; i < n; i++) if (i % 5 === f) preds[i] = a + b * xs[i];
  }
  const mae = +(preds.reduce((s, p, i) => s + Math.abs(p - ys[i]), 0) / n).toFixed(2);
  return { ...pearson(ys, preds), MAE_years: mae };
}

async function main() {
  // PART 1 & 2: nsr2db Smartwatch Duration + 12-Hour Within-Human Retest
  const nsrList = (await fetch('https://physionet.org/files/nsr2db/1.0.0/RECORDS').then((r) => r.text())).trim().split('\n').map((s) => s.trim()).filter(Boolean);
  console.log(`Part 1 & 2: Streaming nsr2db (${nsrList.length} healthy hearts) for 5m/15m/30m Smartwatch Clock + 12h Retest...`);
  const hearts = [];
  let c1 = 0;
  async function w1() {
    while (c1 < nsrList.length) {
      const rec = nsrList[c1++];
      try {
        const base = `https://physionet.org/files/nsr2db/1.0.0/${rec}`;
        const [hea, ecgRes] = await Promise.all([fetch(`${base}.hea`).then((r) => r.text()), fetch(`${base}.ecg`)]);
        const sfreq = parseInt(hea.trim().split('\n')[0].trim().split(/\s+/)[2] || '128', 10);
        const ageM = hea.match(/Age:\s*(\d+)/i); if (!ageM) continue;
        const age = parseInt(ageM[1], 10);
        const beats = parseMitBihBeatTimes(Buffer.from(await ecgRes.arrayBuffer()), sfreq);
        if (beats.length < 25000) continue;
        const mid = Math.floor(beats.length / 2);
        const w5m  = rrToWK(beats.slice(mid - 180, mid + 180));     // ~5 min (~360 beats)
        const w15m = rrToWK(beats.slice(mid - 540, mid + 540));     // ~15 min (~1,080 beats)
        const w30m = rrToWK(beats.slice(mid - 1080, mid + 1080));   // ~30 min (~2,160 beats)
        const winA = rrToWK(beats.slice(Math.floor(beats.length * 0.25), Math.floor(beats.length * 0.25) + 1800));
        const winB = rrToWK(beats.slice(Math.floor(beats.length * 0.75), Math.floor(beats.length * 0.75) + 1800));
        if (w5m && w15m && w30m && winA && winB) hearts.push({ rec, age, w5m: w5m.wk, w15m: w15m.wk, w30m: w30m.wk, winA: winA.wk, winB: winB.wk });
      } catch {}
    }
  }
  await Promise.all(Array.from({ length: 8 }, () => w1()));

  const ages = hearts.map((h) => h.age);
  const smartwatchDurations = {
    '5_min_360beats':   fiveFold1DLinearCV(hearts.map((h) => h.w5m), ages),
    '15_min_1080beats': fiveFold1DLinearCV(hearts.map((h) => h.w15m), ages),
    '30_min_2160beats': fiveFold1DLinearCV(hearts.map((h) => h.w30m), ages),
  };
  const retest12h = pearson(hearts.map((h) => h.winA), hearts.map((h) => h.winB));

  // PART 3: THIRD ORGAN — HUMAN RESPIRATION (Fantasia ch 0 = RESP, 250 Hz -> decimate to 5 Hz)
  const fanList = (await fetch('https://physionet.org/files/fantasia/1.0.0/RECORDS').then((r) => r.text())).trim().split('\n').map((s) => s.trim()).filter(Boolean);
  console.log(`Part 3: Streaming 3rd Organ (Human Respiration, Fantasia N=${fanList.length})...`);
  const resps = [];
  let c2 = 0;
  async function w2() {
    while (c2 < fanList.length) {
      const rec = fanList[c2++];
      try {
        const hea = await fetch(`https://physionet.org/files/fantasia/1.0.0/${rec}.hea`).then((r) => r.text());
        const nCh = parseInt(hea.trim().split('\n')[0].trim().split(/\s+/)[1], 10);
        const sfreq = 250, nSamp = 600 * sfreq, startSamp = 600 * sfreq;
        const byteStart = startSamp * nCh * 2, byteEnd = byteStart + nSamp * nCh * 2 - 1;
        const r = await fetch(`https://physionet.org/files/fantasia/1.0.0/${rec}.dat`, { headers: { Range: `bytes=${byteStart}-${byteEnd}` } });
        if (!r.ok) continue;
        const buf = Buffer.from(await r.arrayBuffer());
        // Decimate 250 Hz -> 5 Hz (factor 50) for clean respiratory dynamics (0.05..0.5 Hz)
        const dec = 50, nDec = Math.floor(buf.length / (nCh * 2 * dec));
        const sig = new Float64Array(nDec);
        for (let i = 0; i < nDec; i++) {
          let s = 0; for (let k = 0; k < dec; k++) s += buf.readInt16LE(((i * dec + k) * nCh + 0) * 2);
          sig[i] = s / dec;
        }
        const slope = computeSlopeUniform(sig, 5.0, 0.04, 0.80, 256);
        const dfa = computeDFA(sig, [8, 12, 16, 24, 32, 48, 64, 96, 128]);
        resps.push({ rec, group: rec.includes('o') ? 'Older' : 'Young', slope, dfa, wk: slope + (2 * dfa - 1) });
      } catch {}
    }
  }
  await Promise.all(Array.from({ length: 8 }, () => w2()));

  const respLaw = pearson(resps.map((x) => -(2 * x.dfa - 1)), resps.map((x) => x.slope));
  const oldR = resps.filter((x) => x.group === 'Older'), yngR = resps.filter((x) => x.group === 'Young');
  const respAging = {
    slopeResp: twoSample(oldR.map((x) => x.slope), yngR.map((x) => x.slope)),
    dfaResp:   twoSample(oldR.map((x) => x.dfa),   yngR.map((x) => x.dfa)),
    wkResp:    twoSample(oldR.map((x) => x.wk),    yngR.map((x) => x.wk)),
  };

  const out = {
    generatedAt: new Date().toISOString(),
    smartwatch5FoldCV_1Feature_dWK_HRV: smartwatchDurations,
    withinHuman12HourRetest_dWK_HRV: retest12h,
    thirdOrgan_HumanRespiration_Fantasia: { n: resps.length, wienerKhinchinLaw: respLaw, Older_vs_Young: respAging },
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));

  console.log('\n=== PART 1: 5-FOLD OUT-OF-SAMPLE SMARTWATCH HEART-AGE CLOCK (1 SINGLE NUMBER: Δ_WK_HRV!) ===');
  console.table(smartwatchDurations);
  console.log('\n=== PART 2: SAME-HUMAN 12-HOUR TEST-RETEST RELIABILITY (Hour 4 vs Hour 16) ===');
  console.log(retest12h);
  console.log('\n=== PART 3: 3RD ORGAN — HUMAN RESPIRATION (Fantasia, N=' + resps.length + ') ===');
  console.log('Wiener-Khinchin Law on Human Breathing:', respLaw);
  console.table(respAging);
  console.log(`Saved -> ${OUT_PATH}`);
}
main();
