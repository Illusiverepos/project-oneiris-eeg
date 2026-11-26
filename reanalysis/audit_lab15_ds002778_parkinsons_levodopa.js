'use strict';

/**
 * Project ONEIRIS — Lab #15 Blind Clinical Pharmacology Audit:
 * Parkinson's Disease OFF vs. ON Levodopa (n = 15 paired) & Healthy Controls (n = 16)
 * Dataset: OpenNeuro ds002778 (UC San Diego, 512 Hz BioSemi .bdf)
 *
 * Uses ONLY the 4-channel Muse S equivalent montage (Fp1/Fp2 + P7/P8 = AF7/AF8 + TP9/TP10)
 * fed directly through `sdk/oneiris_wearable_sdk.js` (`computeFrameMetrics`):
 *   1. PD OFF Medication (n=15) vs. Healthy Controls (n=16): Case-Control AUC, Cohen's d, p
 *   2. PD OFF -> ON Levodopa (n=15 WITHIN-SUBJECT PAIRED): Does dopamine medication shift
 *      the brain along the +46.17° Wiener-Khinchin geodesic or restore Δ_WK?
 *
 * Output: reanalysis/data/lab15_ds002778_parkinsons_levodopa_results.json
 */

const fs = require('fs');
const path = require('path');
const sdk = require('../sdk/oneiris_wearable_sdk.js');

const S3_BASE = 'https://s3.amazonaws.com/openneuro.org/ds002778/';
const OUT_PATH = path.join(__dirname, 'data', 'lab15_ds002778_parkinsons_levodopa_results.json');

function parseMuse4ChBDF(buf) {
  const numRec = parseInt(buf.toString('ascii', 236, 244).trim(), 10);
  const recDur = parseFloat(buf.toString('ascii', 244, 252).trim());
  const ns = parseInt(buf.toString('ascii', 252, 256).trim(), 10);
  const hdrB = parseInt(buf.toString('ascii', 184, 192).trim(), 10);
  const rStr = (o, w) => Array.from({ length: ns }, (_, i) => buf.toString('ascii', o + i * w, o + (i + 1) * w).trim());
  let o = 256;
  const labels = rStr(o, 16); o += ns * 16 + ns * 80 + ns * 8;
  const pMin = rStr(o, 8).map(Number); o += ns * 8;
  const pMax = rStr(o, 8).map(Number); o += ns * 8;
  const dMin = rStr(o, 8).map(Number); o += ns * 8;
  const dMax = rStr(o, 8).map(Number); o += ns * 8 + ns * 80;
  const spr = rStr(o, 8).map((s) => parseInt(s, 10));

  const findCh = (re) => labels.findIndex((l) => re.test(l));
  const iFp1 = findCh(/^Fp1$/i), iFp2 = findCh(/^Fp2$/i), iP7 = findCh(/^P7$/i), iP8 = findCh(/^P8$/i);
  const iCz = findCh(/^Cz$/i); // local reference (BioSemi is raw CMS-referenced!)
  if ([iFp1, iFp2, iP7, iP8, iCz].some((x) => x < 0)) return null;

  const rawSfreq = spr[iFp1] / recDur;
  const decim = Math.max(1, Math.round(rawSfreq / 256));
  const sfreq = rawSfreq / decim;
  const sc = Array.from({ length: ns }, (_, i) => (pMax[i] - pMin[i]) / Math.max(1e-12, dMax[i] - dMin[i]));
  const of = Array.from({ length: ns }, (_, i) => pMin[i] - sc[i] * dMin[i]);

  // Read up to 90 seconds from the middle of the recording
  const recNeed = Math.min(numRec, Math.ceil(90 / recDur));
  const recStart = Math.max(0, Math.floor((numRec - recNeed) / 2));
  const recBytes = spr.reduce((a, b) => a + b * 3, 0);
  const decPerRec = Math.floor(spr[iFp1] / decim);
  const N = recNeed * decPerRec;

  const sigs = { [iFp1]: new Float64Array(N), [iFp2]: new Float64Array(N), [iP7]: new Float64Array(N), [iP8]: new Float64Array(N), [iCz]: new Float64Array(N) };
  let pos = hdrB + recStart * recBytes;
  for (let r = 0; r < recNeed; r++) {
    for (let ch = 0; ch < ns; ch++) {
      const nS = spr[ch];
      if (sigs[ch]) {
        const arr = sigs[ch], sC = sc[ch], oF = of[ch], base = r * decPerRec;
        for (let d = 0; d < decPerRec; d++) {
          let sum = 0;
          for (let k = 0; k < decim; k++) {
            let v = buf[pos] | (buf[pos + 1] << 8) | (buf[pos + 2] << 16);
            if (v & 0x800000) v |= 0xff000000;
            sum += v * sC + oF;
            pos += 3;
          }
          arr[base + d] = sum / decim;
        }
        const rem = nS - decPerRec * decim; if (rem > 0) pos += rem * 3;
      } else pos += nS * 3;
    }
  }

  // Re-reference to Cz (BioSemi raw CMS-referenced channels have massive common-mode drift) + 1 Hz high-pass
  const ref = sigs[iCz];
  const out = {};
  const rc = 1 / (2 * Math.PI * 1.0), al = rc / (rc + 1 / sfreq);
  for (const [nm, idx] of [['fp1', iFp1], ['fp2', iFp2], ['p7', iP7], ['p8', iP8]]) {
    const a = new Float64Array(N);
    for (let t = 0; t < N; t++) a[t] = sigs[idx][t] - ref[t];
    let px = a[0], py = 0; a[0] = 0;
    for (let t = 1; t < N; t++) { const x = a[t], y = al * (py + x - px); a[t] = y; px = x; py = y; }
    out[nm] = a;
  }
  return { sfreq, ...out, N };
}

async function analyzeSession(sub, ses) {
  const url = `${S3_BASE}${sub}/${ses}/eeg/${sub}_${ses}_task-rest_eeg.bdf`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  const parsed = parseMuse4ChBDF(buf);
  if (!parsed) return null;
  const { sfreq, fp1, fp2, p7, p8, N } = parsed;
  const winN = Math.round(2 * sfreq);
  const fFrames = [], pFrames = [];
  for (let s = 0; s + winN <= N; s += winN) {
    fFrames.push(sdk.computeFrameMetrics(fp1.subarray(s, s + winN), fp2.subarray(s, s + winN), sfreq));
    pFrames.push(sdk.computeFrameMetrics(p7.subarray(s, s + winN),  p8.subarray(s, s + winN),  sfreq));
  }
  const avg = (arr, k) => +(arr.reduce((a, f) => a + f[k], 0) / arr.length).toFixed(4);
  return {
    fSlope: avg(fFrames, 'slopeBB'), fDFA: avg(fFrames, 'dfa'), fWK: avg(fFrames, 'wkViolation'),
    fBeta: avg(fFrames, 'betaFrac'), fAlpha: avg(fFrames, 'alphaFrac'), fDelta: avg(fFrames, 'deltaFrac'),
    pSlope: avg(pFrames, 'slopeBB'), pDFA: avg(pFrames, 'dfa'), pWK: avg(pFrames, 'wkViolation'),
    pBeta: avg(pFrames, 'betaFrac'), pAlpha: avg(pFrames, 'alphaFrac'),
  };
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
  return { mean1: +m1.toFixed(4), mean2: +m2.toFixed(4), d: +((m1 - m2) / psd).toFixed(3), auc: +Math.max(auc, 1 - auc).toFixed(3), p: +erfc(Math.abs(t) / Math.SQRT2).toFixed(5) };
}
function paired(diffs) {
  const n = diffs.length, m = diffs.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(diffs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, n - 1)) || 1e-9;
  const t = m / (sd / Math.sqrt(n));
  return { n, meanDiff: +m.toFixed(4), dz: +(m / sd).toFixed(3), t: +t.toFixed(3), p: +erfc(Math.abs(t) / Math.SQRT2).toFixed(5), nPos: diffs.filter((x) => x > 0).length, nNeg: diffs.filter((x) => x < 0).length };
}

async function main() {
  const txt = await fetch(`${S3_BASE}participants.tsv`).then((r) => r.text());
  const subs = txt.trim().split('\n').slice(1).map((l) => l.split('\t')[0].trim());
  console.log(`Streaming Lab #15 (OpenNeuro ds002778 Parkinson's ON/OFF Levodopa + HC, ${subs.length} humans) on 4-ch Muse montage...`);

  const hc = [], pdPaired = [];
  let cursor = 0;
  async function worker() {
    while (cursor < subs.length) {
      const s = subs[cursor++];
      try {
        if (s.startsWith('sub-hc')) {
          const r = await analyzeSession(s, 'ses-hc');
          if (r) hc.push({ sub: s, ...r });
        } else {
          const [offR, onR] = await Promise.all([analyzeSession(s, 'ses-off'), analyzeSession(s, 'ses-on')]);
          if (offR && onR) pdPaired.push({ sub: s, off: offR, on: onR });
        }
      } catch {}
    }
  }
  await Promise.all(Array.from({ length: 8 }, () => worker()));

  const keys = ['fSlope', 'fDFA', 'fWK', 'fBeta', 'fAlpha', 'pSlope', 'pDFA', 'pWK', 'pBeta', 'pAlpha'];
  const pdOffVsHC = {}, pdOnVsOff = {};
  for (const k of keys) {
    pdOffVsHC[k] = twoSample(pdPaired.map((x) => x.off[k]), hc.map((x) => x[k]));
    pdOnVsOff[k] = paired(pdPaired.map((x) => x.on[k] - x.off[k]));
  }
  const dS_onOff = pdOnVsOff.pSlope.meanDiff, dD_onOff = pdOnVsOff.pDFA.meanDiff;
  const levodopaAngle = +(Math.atan2(-dD_onOff / 0.12, dS_onOff / 0.25) * (180 / Math.PI)).toFixed(1);

  const out = {
    generatedAt: new Date().toISOString(),
    dataset: 'OpenNeuro ds002778 (Lab #15 — UC San Diego Parkinson\'s ON/OFF Levodopa & HC, 4-ch Muse Montage Fp1/Fp2 + P7/P8)',
    counts: { pdPaired: pdPaired.length, healthyControls: hc.length },
    PD_OFF_vs_HealthyControls: pdOffVsHC,
    PD_ON_minus_OFF_Levodopa_Paired: pdOnVsOff,
    levodopaPosteriorVector: { dSlope: dS_onOff, dDFA: dD_onOff, angleDeg: levodopaAngle },
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));

  console.log(`\n=== LAB #15 PARKINSON'S DISEASE (n=${pdPaired.length} Paired ON/OFF, n=${hc.length} HC) — 4-ch MUSE MONTAGE ===`);
  console.log('1. Parkinson\'s OFF Medication vs. Healthy Controls:'); console.table(pdOffVsHC);
  console.log('\n2. WITHIN-SUBJECT Levodopa Medication Effect (ON minus OFF, n=' + pdPaired.length + '):'); console.table(pdOnVsOff);
  console.log('Levodopa Posterior 2x2 Vector:', out.levodopaPosteriorVector);
  console.log(`Saved -> ${OUT_PATH}`);
}
main();
