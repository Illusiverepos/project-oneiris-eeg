'use strict';

/**
 * Project ONEIRIS — Lab #11 Clinical PTSD Wearable EEG Audit
 * Dataset: Mendeley Data 10.17632/gsxphk87mc (Du Bois, Korik, Coyle et al., 2021/2022)
 *   - 20 real human clinical PTSD participants with longitudinal wearable EEG (250 Hz):
 *       * Neurofeedback (NF) arm: n = 10 (P16, P17, P18, P19, P20, P22, P23, P24, P25, P27) -> Mean PCL-5: 38.9 -> 11.0 (-27.9)
 *       * Motor-Imagery (MI) arm: n = 10 (P08, P09, P10, P11, P12, P13, P14, P15, P26, P28) -> Mean PCL-5: 39.2 -> 35.3 (-3.9)
 *   - Zero-dependency pure-Node MAT v5 parser (handles both 8-ch FlexEEG and 32-ch g.Nautilus).
 *
 * Tests ONEIRIS Phase 3 PTSD Hypotheses on Pure Resting-State Baselines (`relax1`, First vs. Last Session):
 *   1. Does clinical PTSD recovery (NF remission vs. MI non-remission) steepen 1/f slopeBB,
 *      reduce Beta (13-25 Hz) hyperarousal, increase Alpha (8-12 Hz) rebound, and shift DFA alpha?
 *   2. Right-Frontal (FC4/F4/F8) vs. Left-Frontal (FC3/F3/F7) vs. Posterior Hot Zone topography.
 *   3. Across all n = 20 PTSD patients, do longitudinal ONEIRIS EEG shifts correlate with
 *      clinical PCL-5 PTSD symptom reduction (Delta PCL-5)?
 *
 * Output: reanalysis/data/lab11_mendeley_ptsd_eeg_results.json
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const EXT_DIR = path.join(__dirname, 'data', 'mendeley_ptsd', 'extracted');
const DATA_DIR = path.join(EXT_DIR, 'UU_UR_PTSD_data');
const OUT_PATH = path.join(__dirname, 'data', 'lab11_mendeley_ptsd_eeg_results.json');

const SFREQ = 250;

// Exact channel maps from authors' `cf_TA_EEG_prep.m`
const CH_FLEX8 = ['FC3', 'FCZ', 'FC4', 'P3', 'O1', 'P7', 'OZ', 'PZ'];
const CH_GTECH16 = ['FP1', 'FP2', 'F3', 'FZ', 'F4', 'T7', 'C3', 'CZ', 'C4', 'T8', 'P3', 'PZ', 'P4', 'PO7', 'PO8', 'OZ'];
const CH_GTECH32 = [
  'FP1', 'FP2', 'AF3', 'AF4', 'F7', 'F3', 'FZ', 'F4', 'F8',
  'FC5', 'FC1', 'FC2', 'FC6', 'T7', 'C3', 'CZ', 'C4', 'T8',
  'CP5', 'CP1', 'CP2', 'CP6', 'P7', 'P3', 'PZ', 'P4', 'P8',
  'PO7', 'PO3', 'PO4', 'PO8', 'OZ',
];

// Exact PCL-5 Pre & Post scores from `CI_raw-data-scores.xlsx` (Sheet 3: PCL-5, matched in participant order to Sheet 1)
const PCL5_TABLE = {
  // MI group (rows 15-24 in Sheet 3, corresponding to P08..P15, P26, P28 in Sheet 1)
  'MI_8':  { group: 'MI', pid: 'P08', pre: 43, post: 33 },
  'MI_9':  { group: 'MI', pid: 'P09', pre: 39, post: 30 },
  'MI_10': { group: 'MI', pid: 'P10', pre: 39, post: 40 },
  'MI_11': { group: 'MI', pid: 'P11', pre: 25, post: 23 },
  'MI_12': { group: 'MI', pid: 'P12', pre: 40, post: 54 },
  'MI_13': { group: 'MI', pid: 'P13', pre: 43, post: 39 },
  'MI_14': { group: 'MI', pid: 'P14', pre: 55, post: 52 },
  'MI_15': { group: 'MI', pid: 'P15', pre: 55, post: 48 },
  'MI_26': { group: 'MI', pid: 'P26', pre: 36, post: 27 },
  'MI_28': { group: 'MI', pid: 'P28', pre: 17, post: 7  },
  // NF group (rows 29-38 in Sheet 3, corresponding to P16..P20, P22..P25, P27 in Sheet 1)
  'NF_16': { group: 'NF', pid: 'P16', pre: 61, post: 6  },
  'NF_17': { group: 'NF', pid: 'P17', pre: 29, post: 9  },
  'NF_18': { group: 'NF', pid: 'P18', pre: 61, post: 22 },
  'NF_19': { group: 'NF', pid: 'P19', pre: 9,  post: 4  },
  'NF_20': { group: 'NF', pid: 'P20', pre: 51, post: 17 },
  'NF_22': { group: 'NF', pid: 'P22', pre: 41, post: 12 },
  'NF_23': { group: 'NF', pid: 'P23', pre: 28, post: 9  },
  'NF_24': { group: 'NF', pid: 'P24', pre: 46, post: 15 },
  'NF_25': { group: 'NF', pid: 'P25', pre: 39, post: 8  },
  'NF_27': { group: 'NF', pid: 'P27', pre: 24, post: 8  },
};

// ======================== PURE-NODE MAT v5 READER ========================

function readTag(buf, off) {
  const w0 = buf.readUInt32LE(off);
  if ((w0 >>> 16) !== 0) {
    return { dt: w0 & 0xFFFF, nb: w0 >>> 16, dataOff: off + 4, nextOff: off + 8 };
  }
  const dt = w0, nb = buf.readUInt32LE(off + 4);
  return { dt, nb, dataOff: off + 8, nextOff: off + 8 + Math.ceil(nb / 8) * 8 };
}

function readNumericArray(buf, vT) {
  const n = vT.dt === 9 ? vT.nb / 8 : vT.dt === 7 ? vT.nb / 4 : 0;
  const out = new Float64Array(n);
  if (vT.dt === 9) {
    for (let i = 0; i < n; i++) out[i] = buf.readDoubleLE(vT.dataOff + i * 8);
  } else if (vT.dt === 7) {
    for (let i = 0; i < n; i++) out[i] = buf.readFloatLE(vT.dataOff + i * 4);
  }
  return out;
}

function parseMatElement(buf, off) {
  const t = readTag(buf, off);
  if (t.dt === 15) {
    const inf = zlib.inflateSync(buf.subarray(t.dataOff, t.dataOff + t.nb));
    return { val: parseMatElement(inf, 0).val, nextOff: t.nextOff };
  }
  if (t.dt !== 14) return { val: null, nextOff: t.nextOff };
  let p = t.dataOff;
  const fT = readTag(buf, p); const cls = buf.readUInt32LE(fT.dataOff) & 0xFF; p = fT.nextOff;
  const dT = readTag(buf, p); const dims = []; for (let i = 0; i < dT.nb; i += 4) dims.push(buf.readInt32LE(dT.dataOff + i)); p = dT.nextOff;
  const nT = readTag(buf, p); const name = buf.subarray(nT.dataOff, nT.dataOff + nT.nb).toString('ascii'); p = nT.nextOff;

  if (cls === 2) { // mxSTRUCT_CLASS
    const flT = readTag(buf, p); const fieldLen = buf.readInt32LE(flT.dataOff); p = flT.nextOff;
    const fnT = readTag(buf, p); const nFields = fnT.nb / fieldLen;
    const fields = [];
    for (let i = 0; i < nFields; i++) fields.push(buf.subarray(fnT.dataOff + i * fieldLen, fnT.dataOff + (i + 1) * fieldLen).toString('ascii').replace(/\0.*$/, ''));
    p = fnT.nextOff;
    const nElem = dims.reduce((a, b) => a * b, 1);
    const items = [];
    for (let e = 0; e < nElem; e++) {
      const obj = {};
      for (const fn of fields) {
        const r = parseMatElement(buf, p);
        obj[fn] = r.val;
        p = r.nextOff;
      }
      items.push(obj);
    }
    return { val: { name, cls: 'struct', dims, items }, nextOff: t.nextOff };
  }
  if (cls === 6 || cls === 7) {
    const vT = readTag(buf, p);
    return { val: { name, cls: 'numeric', dims, data: readNumericArray(buf, vT) }, nextOff: t.nextOff };
  }
  return { val: { name, cls, dims }, nextOff: t.nextOff };
}

function loadMatEEG(filePath) {
  const buf = fs.readFileSync(filePath);
  const root = parseMatElement(buf, 128).val;
  if (!root || !root.items || !root.items[0] || !root.items[0].signals) return null;
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
    if (!raw || raw.length < SFREQ * 15) return null;
    const arr = new Float64Array(raw.length);
    for (let t = 0; t < raw.length; t++) {
      let v = raw[t] * rescale;
      if (v > 300) v = 300; else if (v < -300) v = -300;
      arr[t] = v;
    }
    // 1 Hz high-pass filter
    const rc = 1 / (2 * Math.PI * 1.0), a = rc / (rc + 1 / SFREQ);
    let px = arr[0], py = 0; arr[0] = 0;
    for (let t = 1; t < arr.length; t++) { const x = arr[t], y = a * (py + x - px); arr[t] = y; px = x; py = y; }
    chMap.set(chNames[i], arr);
  }
  return { chNames, chMap, nSamples: sigItems[0].values.data.length, device };
}

// ======================== DSP METRICS (ONEIRIS PIPELINE) ========================

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

function spectralFeatures(sig, sfreq = SFREQ, nfft = 512) {
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
  const df = sfreq / nfft, xs = [], ys = [];
  let deltaP = 0, thetaP = 0, alphaP = 0, betaP = 0, totalP = 0;
  for (let k = 1; k < half; k++) {
    const f = k * df, p = psd[k] / Math.max(1, segs);
    if (f >= 1 && f <= 45) totalP += p * df;
    if (f >= 1 && f <= 4) deltaP += p * df;
    if (f >= 4 && f <= 8) thetaP += p * df;
    if (f >= 8 && f <= 12) alphaP += p * df;
    if (f >= 13 && f <= 25) betaP += p * df;
    if ((f >= 2 && f <= 7) || (f >= 14 && f <= 45)) { xs.push(Math.log10(f)); ys.push(Math.log10(p + 1e-24)); }
  }
  let mx = 0, my = 0; for (let i = 0; i < xs.length; i++) { mx += xs[i]; my += ys[i]; } mx /= xs.length; my /= xs.length;
  let num = 0, den = 0; for (let i = 0; i < xs.length; i++) { const dx = xs[i] - mx; num += dx * (ys[i] - my); den += dx * dx; }
  return {
    slopeBB: den > 0 ? num / den : 0,
    deltaFrac: deltaP / Math.max(1e-24, totalP),
    thetaFrac: thetaP / Math.max(1e-24, totalP),
    alphaFrac: alphaP / Math.max(1e-24, totalP),
    betaFrac: betaP / Math.max(1e-24, totalP),
    logAlpha: Math.log10(alphaP + 1e-12),
    logBeta: Math.log10(betaP + 1e-12),
  };
}

function computeDFA(sig) {
  const n = Math.min(sig.length, 4000), start = Math.floor((sig.length - n) / 2);
  let mean = 0; for (let i = 0; i < n; i++) mean += sig[start + i]; mean /= n;
  const y = new Float64Array(n); let cum = 0;
  for (let i = 0; i < n; i++) { cum += sig[start + i] - mean; y[i] = cum; }
  const scales = [10, 16, 25, 40, 64, 100, 160, 250].filter((s) => s * 4 <= n);
  const lx = [], ly = [];
  for (const s of scales) {
    const nWin = Math.floor(n / s); let f2 = 0; const mx = (s - 1) / 2;
    let varX = 0; for (let k = 0; k < s; k++) varX += (k - mx) ** 2;
    for (let w = 0; w < nWin; w++) {
      const off = w * s; let my = 0; for (let k = 0; k < s; k++) my += y[off + k]; my /= s;
      let cov = 0; for (let k = 0; k < s; k++) cov += (k - mx) * (y[off + k] - my);
      const sl = cov / varX, ic = my - sl * mx;
      for (let k = 0; k < s; k++) { const r = y[off + k] - (ic + sl * k); f2 += r * r; }
    }
    const rms = Math.sqrt(f2 / (nWin * s));
    if (rms > 0) { lx.push(Math.log10(s)); ly.push(Math.log10(rms)); }
  }
  let mx = 0, my = 0; for (let i = 0; i < lx.length; i++) { mx += lx[i]; my += ly[i]; } mx /= lx.length; my /= lx.length;
  let num = 0, den = 0; for (let i = 0; i < lx.length; i++) { const dx = lx[i] - mx; num += dx * (ly[i] - my); den += dx * dx; }
  return den > 0 ? num / den : 0;
}

function analyzeRecording(rec) {
  // Take clean central 60-second resting window (skip first 15s & last 10s if long enough)
  const N = rec.nSamples;
  const start = N > SFREQ * 90 ? Math.min(SFREQ * 20, Math.floor((N - SFREQ * 60) / 2)) : Math.floor(N * 0.15);
  const len = Math.min(SFREQ * 60, N - start - Math.floor(N * 0.05));
  if (len < SFREQ * 10) return null;

  const roiDefs = {
    global: rec.chNames,
    posterior: rec.chNames.filter((c) => ['OZ', 'PZ', 'P3', 'P4', 'O1', 'P7', 'P8', 'PO7', 'PO8', 'PO3', 'PO4'].includes(c)),
    rightFrontal: rec.chNames.filter((c) => ['FC4', 'F4', 'F8', 'FC6', 'AF4'].includes(c)),
    leftFrontal: rec.chNames.filter((c) => ['FC3', 'F3', 'F7', 'FC5', 'AF3'].includes(c)),
  };

  const out = { device: rec.device, durSec: +(N / SFREQ).toFixed(1) };
  for (const [roi, chs] of Object.entries(roiDefs)) {
    if (!chs.length) continue;
    const ms = chs.map((c) => {
      const seg = rec.chMap.get(c).subarray(start, start + len);
      return { ...spectralFeatures(seg), dfa: computeDFA(seg) };
    });
    const avg = (k) => +(ms.reduce((a, x) => a + x[k], 0) / ms.length).toFixed(4);
    out[roi] = {
      slopeBB: avg('slopeBB'),
      alphaFrac: avg('alphaFrac'),
      betaFrac: avg('betaFrac'),
      deltaFrac: avg('deltaFrac'),
      logAlpha: avg('logAlpha'),
      logBeta: avg('logBeta'),
      dfa: avg('dfa'),
    };
  }
  return out;
}

// ======================== STATS HELPERS ========================

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
  const dz = mean / sd;
  // Normal approx two-sided p (and exact sign count)
  const p = erfc(Math.abs(t) / Math.SQRT2);
  const nPos = diffs.filter((x) => x > 0).length;
  return { n, mean: +mean.toFixed(4), dz: +dz.toFixed(3), t: +t.toFixed(3), pApprox: +p.toFixed(4), nPos, nNeg: n - nPos };
}

function spearman(xs, ys) {
  const rank = (arr) => {
    const idx = arr.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
    const r = new Array(arr.length);
    for (let i = 0; i < idx.length; i++) r[idx[i][1]] = i + 1;
    return r;
  };
  const rx = rank(xs), ry = rank(ys), n = xs.length;
  const mx = (n + 1) / 2, my = (n + 1) / 2;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) { num += (rx[i] - mx) * (ry[i] - my); dx += (rx[i] - mx) ** 2; dy += (ry[i] - my) ** 2; }
  const rho = num / Math.sqrt(dx * dy);
  const t = rho * Math.sqrt((n - 2) / Math.max(1e-9, 1 - rho * rho));
  const p = erfc(Math.abs(t) / Math.SQRT2);
  return { n, rho: +rho.toFixed(3), pApprox: +p.toFixed(4) };
}

// ======================== MAIN AUDIT ========================

function findRelax1File(sessDir) {
  const dirs = [path.join(sessDir, 'EEG'), sessDir].filter((d) => fs.existsSync(d));
  for (const dir of dirs) {
    const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.mat'));
    const exact = files.find((f) => /^relax[_ ]?1\.mat$/i.test(f));
    if (exact) return path.join(dir, exact);
    const resting = files.find((f) => /^(resting|relax_\d+_\d+)\.mat$/i.test(f));
    if (resting) return path.join(dir, resting);
    const combined = files.find((f) => /relax[_ ]?1/i.test(f) && !/relax[_ ]?2/i.test(f));
    if (combined) return path.join(dir, combined);
  }
  return null;
}

function main() {
  const arms = [
    { dir: path.join(DATA_DIR, 'chap1_MI_PTSD'), prefix: 'MI' },
    { dir: path.join(DATA_DIR, 'chap2_NF_PTSD'), prefix: 'NF' },
  ];

  const subjects = [];
  for (const arm of arms) {
    const folders = fs.readdirSync(arm.dir).filter((f) => fs.statSync(path.join(arm.dir, f)).isDirectory());
    for (const folder of folders) {
      const key = folder.replace(/\s+/g, ''); // e.g. 'MI_ 10' -> 'MI_10'
      const pcl = PCL5_TABLE[key];
      if (!pcl) continue;

      const subDir = path.join(arm.dir, folder);
      const sessDirs = fs.readdirSync(subDir)
        .filter((s) => /^session\s*\d+/i.test(s) && fs.statSync(path.join(subDir, s)).isDirectory())
        .sort((a, b) => parseInt(a.replace(/\D/g, ''), 10) - parseInt(b.replace(/\D/g, ''), 10));

      // Load all valid relax1 sessions and group by device to guarantee 100% same-device pairing!
      const byDevice = new Map();
      for (const sName of sessDirs) {
        const f = findRelax1File(path.join(subDir, sName));
        if (!f) continue;
        const rec = loadMatEEG(f);
        if (!rec) continue;
        const m = analyzeRecording(rec);
        if (!m) continue;
        if (!byDevice.has(rec.device)) byDevice.set(rec.device, []);
        byDevice.get(rec.device).push({ session: sName, metrics: m });
      }

      // Pick the device with the most sessions (>= 2) for strict zero-confound within-device longitudinal comparison
      let bestList = null;
      for (const list of byDevice.values()) {
        if (list.length >= 2 && (!bestList || list.length > bestList.length)) bestList = list;
      }
      if (!bestList) continue;

      const first = bestList[0];
      const last = bestList[bestList.length - 1];

      subjects.push({
        key,
        pid: pcl.pid,
        group: pcl.group,
        pclPre: pcl.pre,
        pclPost: pcl.post,
        pclDrop: pcl.pre - pcl.post, // positive = clinical PTSD improvement
        firstSession: first.session,
        lastSession: last.session,
        first: first.metrics,
        last: last.metrics,
      });
    }
  }

  const nf = subjects.filter((s) => s.group === 'NF');
  const mi = subjects.filter((s) => s.group === 'MI');

  const metrics = ['slopeBB', 'alphaFrac', 'betaFrac', 'deltaFrac', 'dfa'];
  const rois = ['global', 'posterior', 'rightFrontal', 'leftFrontal'];

  const longitudinal = { NF: {}, MI: {} };
  const correlations = {};

  for (const roi of rois) {
    longitudinal.NF[roi] = {};
    longitudinal.MI[roi] = {};
    correlations[roi] = {};
    for (const m of metrics) {
      const nfDiffs = nf.map((s) => s.last[roi][m] - s.first[roi][m]);
      const miDiffs = mi.map((s) => s.last[roi][m] - s.first[roi][m]);
      longitudinal.NF[roi][m] = pairedStats(nfDiffs);
      longitudinal.MI[roi][m] = pairedStats(miDiffs);
      const allDiffs = subjects.map((s) => s.last[roi][m] - s.first[roi][m]);
      const allDrops = subjects.map((s) => s.pclDrop);
      correlations[roi][m] = spearman(allDiffs, allDrops);
    }
  }

  // Right-Frontal minus Left-Frontal Asymmetry shift
  const asymNF = nf.map((s) => (s.last.rightFrontal.slopeBB - s.last.leftFrontal.slopeBB) - (s.first.rightFrontal.slopeBB - s.first.leftFrontal.slopeBB));
  const asymMI = mi.map((s) => (s.last.rightFrontal.slopeBB - s.last.leftFrontal.slopeBB) - (s.first.rightFrontal.slopeBB - s.first.leftFrontal.slopeBB));
  const asymBetaNF = nf.map((s) => (s.last.rightFrontal.betaFrac - s.last.leftFrontal.betaFrac) - (s.first.rightFrontal.betaFrac - s.first.leftFrontal.betaFrac));
  const asymBetaMI = mi.map((s) => (s.last.rightFrontal.betaFrac - s.last.leftFrontal.betaFrac) - (s.first.rightFrontal.betaFrac - s.first.leftFrontal.betaFrac));

  const out = {
    generatedAt: new Date().toISOString(),
    dataset: 'Mendeley Data 10.17632/gsxphk87mc (Du Bois et al., 2021/2022)',
    nSubjects: subjects.length,
    nNF: nf.length,
    nMI: mi.length,
    pclSummary: {
      NF_meanPre: +(nf.reduce((a, s) => a + s.pclPre, 0) / nf.length).toFixed(2),
      NF_meanPost: +(nf.reduce((a, s) => a + s.pclPost, 0) / nf.length).toFixed(2),
      NF_meanDrop: +(nf.reduce((a, s) => a + s.pclDrop, 0) / nf.length).toFixed(2),
      MI_meanPre: +(mi.reduce((a, s) => a + s.pclPre, 0) / mi.length).toFixed(2),
      MI_meanPost: +(mi.reduce((a, s) => a + s.pclPost, 0) / mi.length).toFixed(2),
      MI_meanDrop: +(mi.reduce((a, s) => a + s.pclDrop, 0) / mi.length).toFixed(2),
    },
    longitudinal,
    rightMinusLeftFrontalAsymmetry: {
      slopeBB_NF: pairedStats(asymNF),
      slopeBB_MI: pairedStats(asymMI),
      betaFrac_NF: pairedStats(asymBetaNF),
      betaFrac_MI: pairedStats(asymBetaMI),
    },
    correlationsWithPCL5Drop: correlations,
    subjects: subjects.map((s) => ({
      key: s.key, pid: s.pid, group: s.group,
      pclPre: s.pclPre, pclPost: s.pclPost, pclDrop: s.pclDrop,
      firstSession: s.firstSession, lastSession: s.lastSession,
      deviceFirst: s.first.device, deviceLast: s.last.device,
      dPostSlope: +(s.last.posterior.slopeBB - s.first.posterior.slopeBB).toFixed(3),
      dRFSlope: +(s.last.rightFrontal.slopeBB - s.first.rightFrontal.slopeBB).toFixed(3),
      dRFBeta: +(s.last.rightFrontal.betaFrac - s.first.rightFrontal.betaFrac).toFixed(3),
      dPostAlpha: +(s.last.posterior.alphaFrac - s.first.posterior.alphaFrac).toFixed(3),
    })),
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
  console.log(`=== LAB #11 CLINICAL PTSD WEARABLE EEG AUDIT (n=${subjects.length}: NF=${nf.length}, MI=${mi.length}) ===`);
  console.log('PCL-5 Summary:', out.pclSummary);
  console.log('\n--- LONGITUDINAL SHIFT (LAST - FIRST SESSION RESTING BASELINE): NF GROUP (REMISSION) ---');
  console.table(Object.fromEntries(rois.map((r) => [r, Object.fromEntries(metrics.map((m) => [m, `${longitudinal.NF[r][m].mean} (dz=${longitudinal.NF[r][m].dz}, p=${longitudinal.NF[r][m].pApprox})`]))])));
  console.log('\n--- LONGITUDINAL SHIFT (LAST - FIRST SESSION RESTING BASELINE): MI GROUP (NON-REMISSION) ---');
  console.table(Object.fromEntries(rois.map((r) => [r, Object.fromEntries(metrics.map((m) => [m, `${longitudinal.MI[r][m].mean} (dz=${longitudinal.MI[r][m].dz}, p=${longitudinal.MI[r][m].pApprox})`]))])));
  console.log('\n--- SPEARMAN CORRELATION WITH CLINICAL PCL-5 DROP (ALL n=20 HUMANS) ---');
  console.table(Object.fromEntries(rois.map((r) => [r, Object.fromEntries(metrics.map((m) => [m, `rho=${correlations[r][m].rho} (p=${correlations[r][m].pApprox})`]))])));
  console.log('\n--- RIGHT MINUS LEFT FRONTAL ASYMMETRY SHIFT ---');
  console.table(out.rightMinusLeftFrontalAsymmetry);
  console.log(`\nSaved -> ${OUT_PATH}`);
}

main();
