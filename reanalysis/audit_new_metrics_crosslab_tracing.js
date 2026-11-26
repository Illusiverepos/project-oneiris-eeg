'use strict';

/**
 * Project ONEIRIS — New Parameters, New Metrics & Cross-Lab Tracing (Report 51)
 *
 * Computes 4 BRAND-NEW physical metrics never previously audited on real human EEG in ONEIRIS:
 *   1. Higuchi Fractal Dimension (HFD, kMax = 8): ultra-fast (<0.3 ms) time-domain geometric roughness
 *   2. Spectral Curvature / Aperiodic Knee Proxy (`curv = slopeHigh(14-45Hz) - slopeLow(2-7Hz)`):
 *        direct proxy for cortical intrinsic neural timescale (tau_int, Gao et al. 2020 eLife)
 *   3. Weighted Phase Lag Index (`wPLI` in Theta 4-8 Hz, Alpha 8-12 Hz, Beta 13-25 Hz) between
 *        Right_Frontal and Posterior Hot Zone (volume-conduction-free functional coupling!)
 *   4. Phase-Slope Index (`PSI` in Alpha & Beta) between Posterior -> Right_Frontal (+ = bottom-up,
 *        - = top-down executive drive) + Theta/Beta Ratio (`TBR`, classic prefrontal control index)
 *
 * Cross-references ALL 4 new metrics across TWO independent human domains:
 *   - Domain A: Lab #11 Clinical PTSD Remission (Mendeley gsxphk87mc, n = 20, 100% same-device)
 *               NF Remission (n = 10) vs. MI Control (n = 10)
 *   - Domain B: Lab #8 Lucid REM Control (TWC_USA, real human lucid REM pre-cue vs. +6..+22s post-cue)
 *
 * Output: reanalysis/data/new_metrics_crosslab_tracing_results.json
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const MENDELEY_DIR = path.join(__dirname, 'data', 'mendeley_ptsd', 'extracted', 'UU_UR_PTSD_data');
const TWC_DIR = path.join(__dirname, 'data', 'twc_usa', 'extracted');
const OUT_PATH = path.join(__dirname, 'data', 'new_metrics_crosslab_tracing_results.json');

const CH_FLEX8 = ['FC3', 'FCZ', 'FC4', 'P3', 'O1', 'P7', 'OZ', 'PZ'];
const CH_GTECH16 = ['FP1', 'FP2', 'F3', 'FZ', 'F4', 'T7', 'C3', 'CZ', 'C4', 'T8', 'P3', 'PZ', 'P4', 'PO7', 'PO8', 'OZ'];
const CH_GTECH32 = [
  'FP1', 'FP2', 'AF3', 'AF4', 'F7', 'F3', 'FZ', 'F4', 'F8',
  'FC5', 'FC1', 'FC2', 'FC6', 'T7', 'C3', 'CZ', 'C4', 'T8',
  'CP5', 'CP1', 'CP2', 'CP6', 'P7', 'P3', 'PZ', 'P4', 'P8',
  'PO7', 'PO3', 'PO4', 'PO8', 'OZ',
];

const PCL5_GROUPS = {
  MI_8: 'MI', MI_9: 'MI', MI_10: 'MI', MI_11: 'MI', MI_12: 'MI', MI_13: 'MI', MI_14: 'MI', MI_15: 'MI', MI_26: 'MI', MI_28: 'MI',
  NF_16: 'NF', NF_17: 'NF', NF_18: 'NF', NF_19: 'NF', NF_20: 'NF', NF_22: 'NF', NF_23: 'NF', NF_24: 'NF', NF_25: 'NF', NF_27: 'NF',
};

// ======================== NEW METRIC PRIMITIVES ========================

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

/** 1. Higuchi Fractal Dimension (time-domain geometric roughness, kMax = 8) */
function higuchiFD(sig, kMax = 8) {
  const N = Math.min(sig.length, 4000);
  const lx = [], ly = [];
  for (let k = 1; k <= kMax; k++) {
    let lkSum = 0;
    for (let m = 0; m < k; m++) {
      const nSteps = Math.floor((N - 1 - m) / k);
      if (nSteps < 1) continue;
      let sumDiff = 0;
      for (let i = 1; i <= nSteps; i++) {
        sumDiff += Math.abs(sig[m + i * k] - sig[m + (i - 1) * k]);
      }
      lkSum += (sumDiff * (N - 1)) / (nSteps * k * k);
    }
    const lk = lkSum / k;
    if (lk > 0) { lx.push(Math.log(1 / k)); ly.push(Math.log(lk)); }
  }
  let mx = 0, my = 0; for (let i = 0; i < lx.length; i++) { mx += lx[i]; my += ly[i]; } mx /= lx.length; my /= lx.length;
  let num = 0, den = 0; for (let i = 0; i < lx.length; i++) { const dx = lx[i] - mx; num += dx * (ly[i] - my); den += dx * dx; }
  return den > 0 ? num / den : 1.5;
}

/** 2. Spectral Curvature (aperiodic knee / tau_int proxy) & Theta-Beta Ratio (TBR) */
function spectralKneeAndTBR(sig, sfreq, nfft = 512) {
  const step = nfft / 2, half = nfft / 2 + 1, win = new Float64Array(nfft);
  let wp = 0; for (let i = 0; i < nfft; i++) { win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (nfft - 1))); wp += win[i] * win[i]; }
  const psd = new Float64Array(half); let segs = 0;
  for (let st = 0; st + nfft <= sig.length; st += step) {
    let m = 0; for (let i = 0; i < nfft; i++) m += sig[st + i]; m /= nfft;
    const r = new Float64Array(nfft), im = new Float64Array(nfft);
    for (let i = 0; i < nfft; i++) r[i] = (sig[st + i] - m) * win[i];
    fft(r, im); const norm = sfreq * wp;
    for (let k = 0; k < half; k++) psd[k] += (r[k] * r[k] + im[k] * im[k]) / norm;
    segs++;
  }
  const df = sfreq / nfft;
  const fitSlope = (fLo, fHi) => {
    const xs = [], ys = [];
    for (let k = 1; k < half; k++) {
      const f = k * df;
      if (f >= fLo && f <= fHi) { xs.push(Math.log10(f)); ys.push(Math.log10(psd[k] / Math.max(1, segs) + 1e-24)); }
    }
    let mx = 0, my = 0; for (let i = 0; i < xs.length; i++) { mx += xs[i]; my += ys[i]; } mx /= xs.length; my /= xs.length;
    let num = 0, den = 0; for (let i = 0; i < xs.length; i++) { const dx = xs[i] - mx; num += dx * (ys[i] - my); den += dx * dx; }
    return den > 0 ? num / den : 0;
  };
  let thetaP = 0, betaP = 0;
  for (let k = 1; k < half; k++) {
    const f = k * df, p = psd[k] / Math.max(1, segs);
    if (f >= 4 && f <= 8) thetaP += p * df;
    if (f >= 13 && f <= 25) betaP += p * df;
  }
  const slopeLow = fitSlope(2, 7);
  const slopeHigh = fitSlope(14, 45);
  return {
    slopeLow,
    slopeHigh,
    curvature: slopeHigh - slopeLow, // negative = strong low-freq knee; flatter/less negative = faster tau_int
    logTBR: Math.log10((thetaP + 1e-12) / (betaP + 1e-12)),
  };
}

/** 3 & 4. wPLI (volume-conduction-free phase coupling) & Phase-Slope Index (PSI: + = A->B, - = B->A) */
function computeWPLIandPSI(sigA, sigB, sfreq, nfft = 512) {
  const step = nfft / 2, half = nfft / 2 + 1, win = new Float64Array(nfft);
  let wp = 0; for (let i = 0; i < nfft; i++) { win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (nfft - 1))); wp += win[i] * win[i]; }
  const pAA = new Float64Array(half), pBB = new Float64Array(half);
  const sRe = new Float64Array(half), sIm = new Float64Array(half);
  const absImSum = new Float64Array(half), imSum = new Float64Array(half);

  for (let st = 0; st + nfft <= Math.min(sigA.length, sigB.length); st += step) {
    let mA = 0, mB = 0; for (let i = 0; i < nfft; i++) { mA += sigA[st + i]; mB += sigB[st + i]; } mA /= nfft; mB /= nfft;
    const rA = new Float64Array(nfft), iA = new Float64Array(nfft), rB = new Float64Array(nfft), iB = new Float64Array(nfft);
    for (let i = 0; i < nfft; i++) { rA[i] = (sigA[st + i] - mA) * win[i]; rB[i] = (sigB[st + i] - mB) * win[i]; }
    fft(rA, iA); fft(rB, iB); const norm = sfreq * wp;
    for (let k = 0; k < half; k++) {
      const aa = (rA[k] * rA[k] + iA[k] * iA[k]) / norm;
      const bb = (rB[k] * rB[k] + iB[k] * iB[k]) / norm;
      const cr = (rA[k] * rB[k] + iA[k] * iB[k]) / norm;
      const ci = (rA[k] * iB[k] - iA[k] * rB[k]) / norm;
      pAA[k] += aa; pBB[k] += bb; sRe[k] += cr; sIm[k] += ci;
      imSum[k] += ci; absImSum[k] += Math.abs(ci);
    }
  }

  const cRe = new Float64Array(half), cIm = new Float64Array(half);
  for (let k = 0; k < half; k++) {
    const den = Math.sqrt(Math.max(1e-30, pAA[k] * pBB[k]));
    cRe[k] = sRe[k] / den; cIm[k] = sIm[k] / den;
  }

  const df = sfreq / nfft;
  const bandWPLI = (lo, hi) => {
    let num = 0, den = 0;
    for (let k = 1; k < half; k++) {
      const f = k * df;
      if (f >= lo && f <= hi) { num += Math.abs(imSum[k]); den += absImSum[k]; }
    }
    return den > 0 ? num / den : 0;
  };
  const bandPSI = (lo, hi) => {
    let acc = 0;
    for (let k = 1; k < half - 1; k++) {
      const f = k * df;
      if (f >= lo && f + df <= hi) acc += cRe[k] * cIm[k + 1] - cIm[k] * cRe[k + 1];
    }
    return acc;
  };

  return {
    wpliTheta: bandWPLI(4, 8),
    wpliAlpha: bandWPLI(8, 12),
    wpliBeta:  bandWPLI(13, 25),
    psiAlpha:  bandPSI(8, 12), // + = Post -> RF (bottom-up), - = RF -> Post (top-down)
    psiBeta:   bandPSI(13, 25),
  };
}

function meanChannel(arrs) {
  const n = arrs[0].length, out = new Float64Array(n);
  for (let t = 0; t < n; t++) { let s = 0; for (const a of arrs) s += a[t]; out[t] = s / arrs.length; }
  return out;
}

function evalAllNewMetrics(postSegs, rfSegs, lfSegs, sfreq) {
  const pMean = meanChannel(postSegs), rfMean = meanChannel(rfSegs), lfMean = meanChannel(lfSegs);
  const rfHFD = rfSegs.reduce((a, s) => a + higuchiFD(s), 0) / rfSegs.length;
  const lfHFD = lfSegs.reduce((a, s) => a + higuchiFD(s), 0) / lfSegs.length;
  const postHFD = postSegs.reduce((a, s) => a + higuchiFD(s), 0) / postSegs.length;

  const rfK = spectralKneeAndTBR(rfMean, sfreq);
  const lfK = spectralKneeAndTBR(lfMean, sfreq);
  const postK = spectralKneeAndTBR(pMean, sfreq);
  const conn = computeWPLIandPSI(pMean, rfMean, sfreq); // A = Post, B = RF

  return {
    rfHFD: +rfHFD.toFixed(4),
    rfMinusLfHFD: +(rfHFD - lfHFD).toFixed(4),
    postHFD: +postHFD.toFixed(4),
    rfCurvature: +rfK.curvature.toFixed(4),
    postCurvature: +postK.curvature.toFixed(4),
    rfLogTBR: +rfK.logTBR.toFixed(4),
    rfMinusLfLogTBR: +(rfK.logTBR - lfK.logTBR).toFixed(4),
    wpliTheta_PostRF: +conn.wpliTheta.toFixed(4),
    wpliAlpha_PostRF: +conn.wpliAlpha.toFixed(4),
    wpliBeta_PostRF: +conn.wpliBeta.toFixed(4),
    psiAlpha_PostToRF: +conn.psiAlpha.toFixed(4),
    psiBeta_PostToRF: +conn.psiBeta.toFixed(4),
  };
}

// ======================== STATS ========================

function erfc(x) {
  const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
    t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}
function pairedStats(diffs) {
  const n = diffs.length;
  const mean = diffs.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(diffs.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1)) || 1e-9;
  const t = mean / (sd / Math.sqrt(n));
  return { n, mean: +mean.toFixed(4), dz: +(mean / sd).toFixed(3), pApprox: +erfc(Math.abs(t) / Math.SQRT2).toFixed(4), nPos: diffs.filter((x) => x > 0).length, nNeg: diffs.filter((x) => x < 0).length };
}

// ======================== LAB #11 LOADER (MENDELEY PTSD) ========================

function readTag(buf, off) {
  const w0 = buf.readUInt32LE(off);
  if ((w0 >>> 16) !== 0) return { dt: w0 & 0xFFFF, nb: w0 >>> 16, dataOff: off + 4, nextOff: off + 8 };
  const dt = w0, nb = buf.readUInt32LE(off + 4);
  return { dt, nb, dataOff: off + 8, nextOff: off + 8 + Math.ceil(nb / 8) * 8 };
}
function readNumericArray(buf, vT) {
  const n = vT.dt === 9 ? vT.nb / 8 : vT.dt === 7 ? vT.nb / 4 : 0;
  const out = new Float64Array(n);
  if (vT.dt === 9) for (let i = 0; i < n; i++) out[i] = buf.readDoubleLE(vT.dataOff + i * 8);
  else if (vT.dt === 7) for (let i = 0; i < n; i++) out[i] = buf.readFloatLE(vT.dataOff + i * 4);
  return out;
}
function parseMatElement(buf, off) {
  const t = readTag(buf, off);
  if (t.dt === 15) return { val: parseMatElement(zlib.inflateSync(buf.subarray(t.dataOff, t.dataOff + t.nb)), 0).val, nextOff: t.nextOff };
  if (t.dt !== 14) return { val: null, nextOff: t.nextOff };
  let p = t.dataOff;
  const fT = readTag(buf, p); const cls = buf.readUInt32LE(fT.dataOff) & 0xFF; p = fT.nextOff;
  const dT = readTag(buf, p); const dims = []; for (let i = 0; i < dT.nb; i += 4) dims.push(buf.readInt32LE(dT.dataOff + i)); p = dT.nextOff;
  const nT = readTag(buf, p); const name = buf.subarray(nT.dataOff, nT.dataOff + nT.nb).toString('ascii'); p = nT.nextOff;
  if (cls === 2) {
    const flT = readTag(buf, p); const fieldLen = buf.readInt32LE(flT.dataOff); p = flT.nextOff;
    const fnT = readTag(buf, p); const nFields = fnT.nb / fieldLen;
    const fields = []; for (let i = 0; i < nFields; i++) fields.push(buf.subarray(fnT.dataOff + i * fieldLen, fnT.dataOff + (i + 1) * fieldLen).toString('ascii').replace(/\0.*$/, ''));
    p = fnT.nextOff;
    const nElem = dims.reduce((a, b) => a * b, 1), items = [];
    for (let e = 0; e < nElem; e++) { const obj = {}; for (const fn of fields) { const r = parseMatElement(buf, p); obj[fn] = r.val; p = r.nextOff; } items.push(obj); }
    return { val: { name, cls: 'struct', dims, items }, nextOff: t.nextOff };
  }
  if (cls === 6 || cls === 7) { const vT = readTag(buf, p); return { val: { name, cls: 'numeric', dims, data: readNumericArray(buf, vT) }, nextOff: t.nextOff }; }
  return { val: { name, cls, dims }, nextOff: t.nextOff };
}

function loadMatEEG(filePath) {
  const buf = fs.readFileSync(filePath);
  const root = parseMatElement(buf, 128).val;
  if (!root?.items?.[0]?.signals) return null;
  const sigItems = root.items[0].signals.items;
  const nSig = sigItems.length;
  let chNames, rescale, device;
  if (nSig === 9 || nSig === 10) { chNames = CH_FLEX8; rescale = 0.0224; device = 'Flex8'; }
  else if (nSig === 17 || nSig === 18) { chNames = CH_GTECH16; rescale = 1.0; device = 'GTech16'; }
  else if (nSig === 33 || nSig === 34) { chNames = CH_GTECH32; rescale = 1.0; device = 'GTech32'; }
  else return null;
  const chMap = new Map();
  for (let i = 0; i < chNames.length; i++) {
    const raw = sigItems[i].values?.data;
    if (!raw || raw.length < 250 * 15) return null;
    const arr = new Float64Array(raw.length);
    for (let t = 0; t < raw.length; t++) { let v = raw[t] * rescale; if (v > 300) v = 300; else if (v < -300) v = -300; arr[t] = v; }
    const rc = 1 / (2 * Math.PI * 1.0), a = rc / (rc + 1 / 250);
    let px = arr[0], py = 0; arr[0] = 0;
    for (let t = 1; t < arr.length; t++) { const x = arr[t], y = a * (py + x - px); arr[t] = y; px = x; py = y; }
    chMap.set(chNames[i], arr);
  }
  return { chNames, chMap, nSamples: sigItems[0].values.data.length, device };
}

function findRelax1(sessDir) {
  for (const dir of [path.join(sessDir, 'EEG'), sessDir].filter((d) => fs.existsSync(d))) {
    const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.mat'));
    const f = files.find((x) => /^relax[_ ]?1\.mat$/i.test(x))
      || files.find((x) => /^(resting|relax_\d+_\d+)\.mat$/i.test(x))
      || files.find((x) => /relax[_ ]?1/i.test(x) && !/relax[_ ]?2/i.test(x));
    if (f) return path.join(dir, f);
  }
  return null;
}

function auditLab11() {
  const subjects = [];
  for (const [subFolder, grp] of [['chap1_MI_PTSD', 'MI'], ['chap2_NF_PTSD', 'NF']]) {
    const armDir = path.join(MENDELEY_DIR, subFolder);
    for (const folder of fs.readdirSync(armDir).filter((f) => fs.statSync(path.join(armDir, f)).isDirectory())) {
      const key = folder.replace(/\s+/g, '');
      if (!PCL5_GROUPS[key]) continue;
      const sDirs = fs.readdirSync(path.join(armDir, folder))
        .filter((s) => /^session\s*\d+/i.test(s) && fs.statSync(path.join(armDir, folder, s)).isDirectory())
        .sort((a, b) => parseInt(a.replace(/\D/g, ''), 10) - parseInt(b.replace(/\D/g, ''), 10));
      const byDev = new Map();
      for (const sName of sDirs) {
        const f = findRelax1(path.join(armDir, folder, sName));
        if (!f) continue;
        const rec = loadMatEEG(f);
        if (!rec) continue;
        const N = rec.nSamples;
        const st = N > 250 * 90 ? Math.min(250 * 20, Math.floor((N - 250 * 60) / 2)) : Math.floor(N * 0.15);
        const len = Math.min(250 * 60, N - st - Math.floor(N * 0.05));
        if (len < 250 * 10) continue;
        const pCh = rec.chNames.filter((c) => ['OZ', 'PZ', 'P3', 'P4', 'O1', 'P7', 'P8', 'PO7', 'PO8'].includes(c));
        const rfCh = rec.chNames.filter((c) => ['FC4', 'F4', 'F8', 'FC6', 'AF4'].includes(c));
        const lfCh = rec.chNames.filter((c) => ['FC3', 'F3', 'F7', 'FC5', 'AF3'].includes(c));
        const m = evalAllNewMetrics(
          pCh.map((c) => rec.chMap.get(c).subarray(st, st + len)),
          rfCh.map((c) => rec.chMap.get(c).subarray(st, st + len)),
          lfCh.map((c) => rec.chMap.get(c).subarray(st, st + len)),
          250
        );
        if (!byDev.has(rec.device)) byDev.set(rec.device, []);
        byDev.get(rec.device).push(m);
      }
      let best = null;
      for (const list of byDev.values()) if (list.length >= 2 && (!best || list.length > best.length)) best = list;
      if (best) subjects.push({ key, group: grp, first: best[0], last: best[best.length - 1] });
    }
  }
  const keys = Object.keys(subjects[0].first);
  const out = { NF: {}, MI: {} };
  for (const g of ['NF', 'MI']) {
    const list = subjects.filter((s) => s.group === g);
    for (const k of keys) out[g][k] = pairedStats(list.map((s) => s.last[k] - s.first[k]));
  }
  return { nNF: subjects.filter((s) => s.group === 'NF').length, nMI: subjects.filter((s) => s.group === 'MI').length, ...out };
}

// ======================== LAB #8 LOADER (TWC_USA LUCID REM) ========================

function findAllEDFs(dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(findAllEDFs(p));
    else if (e.name.toLowerCase().endsWith('.edf')) out.push(p);
  }
  return out;
}

function auditLab8Lucid() {
  const edfs = findAllEDFs(TWC_DIR);
  const bySub = new Map();
  for (const p of edfs) {
    const buf = fs.readFileSync(p);
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
    const lmap = new Map(); labels.forEach((l, i) => lmap.set(l.toUpperCase(), i));
    if (!lmap.has('STATUS') || !lmap.has('P4') || !lmap.has('F4') || !lmap.has('F3')) continue;

    const sfreqRaw = spr[0] / recDur, decim = Math.max(1, Math.round(sfreqRaw / 200)), sf = sfreqRaw / decim;
    const useR = Math.max(0, numRec - 1), decR = Math.floor(spr[0] / decim);
    const sc = Array.from({ length: ns }, (_, i) => (pMax[i] - pMin[i]) / Math.max(1e-12, dMax[i] - dMin[i]));
    const of = Array.from({ length: ns }, (_, i) => pMin[i] - sc[i] * dMin[i]);
    const need = ['P4', 'O2', 'PZ', 'F4', 'F8', 'F3', 'F7', 'STATUS'];
    const sigs = new Map(); for (const n of need) if (lmap.has(n)) sigs.set(n, new Float64Array(useR * decR));
    let pos = hdrB;
    for (let r = 0; r < useR; r++) {
      for (let ch = 0; ch < ns; ch++) {
        const nS = spr[ch], lbl = labels[ch].toUpperCase();
        if (sigs.has(lbl)) {
          const arr = sigs.get(lbl), base = r * decR;
          for (let d = 0; d < decR; d++) {
            let s = 0;
            for (let k = 0; k < decim; k++) { const v = buf.readInt16LE(pos); s += lbl === 'STATUS' ? v : v * sc[ch] + of[ch]; pos += 2; }
            arr[base + d] = lbl === 'STATUS' ? Math.round(s / decim) : s / decim;
          }
          const rem = nS - decR * decim; if (rem > 0) pos += rem * 2;
        } else pos += nS * 2;
      }
    }
    const status = sigs.get('STATUS'), N = status.length;
    // Find first post-startup cue (sec >= 5)
    let cueIdx = -1;
    for (let t = Math.floor(5 * sf); t < N; t++) if (status[t] !== status[t - 1] && status[t] !== 0) { cueIdx = t; break; }
    if (cueIdx < Math.floor(20 * sf) || cueIdx + Math.floor(24 * sf) >= N) continue;

    const rc = 1 / (2 * Math.PI * 1.0), al = rc / (rc + 1 / sf);
    for (const [k, arr] of sigs.entries()) {
      if (k === 'STATUS') continue;
      let px = arr[0], py = 0; arr[0] = 0;
      for (let t = 1; t < N; t++) { const x = arr[t], y = al * (py + x - px); arr[t] = y; px = x; py = y; }
    }

    const slice = (stSec, enSec) => {
      const a = cueIdx + Math.floor(stSec * sf), b = cueIdx + Math.floor(enSec * sf);
      const pS = ['P4', 'O2', 'PZ'].filter((c) => sigs.has(c)).map((c) => sigs.get(c).subarray(a, b));
      const rfS = ['F4', 'F8'].filter((c) => sigs.has(c)).map((c) => sigs.get(c).subarray(a, b));
      const lfS = ['F3', 'F7'].filter((c) => sigs.has(c)).map((c) => sigs.get(c).subarray(a, b));
      return evalAllNewMetrics(pS, rfS, lfS, sf);
    };

    const pre = slice(-18, -2);
    const post = slice(6, 22); // Exact Paper 2 16-second Right-Frontal lucidity plateau!
    const mSub = path.basename(p).match(/sub\d+/i);
    const subId = mSub ? mSub[0].toLowerCase() : path.basename(p);
    if (!bySub.has(subId)) bySub.set(subId, []);
    bySub.get(subId).push({ pre, post });
  }

  const keys = Object.keys([...bySub.values()][0][0].pre);
  const out = {};
  for (const k of keys) {
    const diffs = [];
    for (const list of bySub.values()) {
      const d = list.reduce((acc, x) => acc + (x.post[k] - x.pre[k]), 0) / list.length;
      diffs.push(d);
    }
    out[k] = pairedStats(diffs);
  }
  return { nSubjects: bySub.size, postMinusPrePlateau: out };
}

function main() {
  console.log('Auditing 4 brand-new metrics across Lab #11 (PTSD Remission) & Lab #8 (Lucid REM Plateau)...\n');
  const lab11 = auditLab11();
  const lab8 = auditLab8Lucid();

  fs.writeFileSync(OUT_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), lab11_PTSD: lab11, lab8_LucidREM: lab8 }, null, 2));

  console.log('=== LAB #11 CLINICAL PTSD REMISSION (NF n=' + lab11.nNF + ') — 4 NEW METRICS ===');
  console.table(lab11.NF);
  console.log('\n=== LAB #11 MI CONTROL (n=' + lab11.nMI + ') — 4 NEW METRICS ===');
  console.table(lab11.MI);
  console.log('\n=== LAB #8 LUCID REM CONTROL (+6..+22s PLATEAU vs PRE-CUE, n=' + lab8.nSubjects + ' HUMANS) — 4 NEW METRICS ===');
  console.table(lab8.postMinusPrePlateau);
  console.log(`\nSaved -> ${OUT_PATH}`);
}

main();
