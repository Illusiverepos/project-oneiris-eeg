'use strict';

/**
 * Project ONEIRIS — Lab #11 Deep Clinical PTSD Dynamics Audit
 * Dataset: Mendeley Data 10.17632/gsxphk87mc (Du Bois, Korik, Coyle et al., 2021/2022)
 *
 * Tests 3 frontier hypotheses on all 20 clinical PTSD survivors (100% same-device controlled):
 *   1. Session-by-Session Trajectory (Early -> Mid -> Late across Sessions 1..7):
 *        When does the Right-Frontal 1/f watchtower power down? Gradual or tipping point?
 *   2. Effective Dimensionality (effDim) & R_tether in Clinical PTSD Remission:
 *        Does PTSD trap the cortex in a rigid low-dimensional attractor, and does
 *        clinical remission (PCL-5 38.9 -> 11.0) expand effDim / release DFA alpha?
 *   3. Acute Within-Session Shift (relax1 Pre -> relax2 Post tail):
 *        Does a single 30-min session acutely shift Right-Frontal 1/f or effDim,
 *        and does Session-1 acute shift predict weeks-later PCL-5 remission?
 *
 * Output: reanalysis/data/lab11_ptsd_deep_dynamics_results.json
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const DATA_DIR = path.join(__dirname, 'data', 'mendeley_ptsd', 'extracted', 'UU_UR_PTSD_data');
const OUT_PATH = path.join(__dirname, 'data', 'lab11_ptsd_deep_dynamics_results.json');
const SFREQ = 250;

const CH_FLEX8 = ['FC3', 'FCZ', 'FC4', 'P3', 'O1', 'P7', 'OZ', 'PZ'];
const CH_GTECH16 = ['FP1', 'FP2', 'F3', 'FZ', 'F4', 'T7', 'C3', 'CZ', 'C4', 'T8', 'P3', 'PZ', 'P4', 'PO7', 'PO8', 'OZ'];
const CH_GTECH32 = [
  'FP1', 'FP2', 'AF3', 'AF4', 'F7', 'F3', 'FZ', 'F4', 'F8',
  'FC5', 'FC1', 'FC2', 'FC6', 'T7', 'C3', 'CZ', 'C4', 'T8',
  'CP5', 'CP1', 'CP2', 'CP6', 'P7', 'P3', 'PZ', 'P4', 'P8',
  'PO7', 'PO3', 'PO4', 'PO8', 'OZ',
];

const PCL5_TABLE = {
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

// ======================== MAT v5 READER ========================

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
  if (t.dt === 15) {
    const inf = zlib.inflateSync(buf.subarray(t.dataOff, t.dataOff + t.nb));
    return { val: parseMatElement(inf, 0).val, nextOff: t.nextOff };
  }
  if (t.dt !== 14) return { val: null, nextOff: t.nextOff };
  let p = t.dataOff;
  const fT = readTag(buf, p); const cls = buf.readUInt32LE(fT.dataOff) & 0xFF; p = fT.nextOff;
  const dT = readTag(buf, p); const dims = []; for (let i = 0; i < dT.nb; i += 4) dims.push(buf.readInt32LE(dT.dataOff + i)); p = dT.nextOff;
  const nT = readTag(buf, p); const name = buf.subarray(nT.dataOff, nT.dataOff + nT.nb).toString('ascii'); p = nT.nextOff;
  if (cls === 2) {
    const flT = readTag(buf, p); const fieldLen = buf.readInt32LE(flT.dataOff); p = flT.nextOff;
    const fnT = readTag(buf, p); const nFields = fnT.nb / fieldLen;
    const fields = [];
    for (let i = 0; i < nFields; i++) fields.push(buf.subarray(fnT.dataOff + i * fieldLen, fnT.dataOff + (i + 1) * fieldLen).toString('ascii').replace(/\0.*$/, ''));
    p = fnT.nextOff;
    const nElem = dims.reduce((a, b) => a * b, 1), items = [];
    for (let e = 0; e < nElem; e++) {
      const obj = {};
      for (const fn of fields) { const r = parseMatElement(buf, p); obj[fn] = r.val; p = r.nextOff; }
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
    const rc = 1 / (2 * Math.PI * 1.0), a = rc / (rc + 1 / SFREQ);
    let px = arr[0], py = 0; arr[0] = 0;
    for (let t = 1; t < arr.length; t++) { const x = arr[t], y = a * (py + x - px); arr[t] = y; px = x; py = y; }
    chMap.set(chNames[i], arr);
  }
  return { chNames, chMap, nSamples: sigItems[0].values.data.length, device };
}

// ======================== DSP + EFFDIM ========================

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
  let alphaP = 0, betaP = 0, totalP = 0;
  for (let k = 1; k < half; k++) {
    const f = k * df, p = psd[k] / Math.max(1, segs);
    if (f >= 1 && f <= 45) totalP += p * df;
    if (f >= 8 && f <= 12) alphaP += p * df;
    if (f >= 13 && f <= 25) betaP += p * df;
    if ((f >= 2 && f <= 7) || (f >= 14 && f <= 45)) { xs.push(Math.log10(f)); ys.push(Math.log10(p + 1e-24)); }
  }
  let mx = 0, my = 0; for (let i = 0; i < xs.length; i++) { mx += xs[i]; my += ys[i]; } mx /= xs.length; my /= xs.length;
  let num = 0, den = 0; for (let i = 0; i < xs.length; i++) { const dx = xs[i] - mx; num += dx * (ys[i] - my); den += dx * dx; }
  return {
    slopeBB: den > 0 ? num / den : 0,
    alphaFrac: alphaP / Math.max(1e-24, totalP),
    betaFrac: betaP / Math.max(1e-24, totalP),
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

/** Participation Ratio Effective Dimensionality: (tr C)^2 / tr(C^2) on correlation matrix (normalized by K) */
function computeEffDim(sigs) {
  const K = sigs.length, N = sigs[0].length;
  if (K < 2) return 1;
  // Standardize each channel -> correlation matrix C (tr(C) = K)
  const zs = sigs.map((s) => {
    let m = 0; for (let t = 0; t < N; t++) m += s[t]; m /= N;
    let v = 0; for (let t = 0; t < N; t++) v += (s[t] - m) ** 2;
    const sd = Math.sqrt(v / N) || 1, o = new Float64Array(N);
    for (let t = 0; t < N; t++) o[t] = (s[t] - m) / sd;
    return o;
  });
  let sumSq = 0;
  for (let i = 0; i < K; i++) {
    sumSq += 1; // diagonal C_ii = 1
    for (let j = i + 1; j < K; j++) {
      let c = 0; const si = zs[i], sj = zs[j];
      for (let t = 0; t < N; t++) c += si[t] * sj[t];
      c /= N;
      sumSq += 2 * c * c;
    }
  }
  return (K * K) / Math.max(1e-9, sumSq); // Raw PR in [1..K]
}

function analyzeSegment(rec, mode = 'center') {
  const N = rec.nSamples;
  let start, len;
  if (mode === 'tail') {
    // Post-session relax2 tail: last 90s minus final 15s
    len = Math.min(SFREQ * 60, Math.floor(N * 0.4));
    start = Math.max(0, N - len - SFREQ * 15);
  } else {
    start = N > SFREQ * 90 ? Math.min(SFREQ * 20, Math.floor((N - SFREQ * 60) / 2)) : Math.floor(N * 0.15);
    len = Math.min(SFREQ * 60, N - start - Math.floor(N * 0.05));
  }
  if (len < SFREQ * 10) return null;

  const postChs = rec.chNames.filter((c) => ['OZ', 'PZ', 'P3', 'P4', 'O1', 'P7', 'P8', 'PO7', 'PO8', 'PO3', 'PO4'].includes(c));
  const rfChs = rec.chNames.filter((c) => ['FC4', 'F4', 'F8', 'FC6', 'AF4'].includes(c));
  const lfChs = rec.chNames.filter((c) => ['FC3', 'F3', 'F7', 'FC5', 'AF3'].includes(c));

  const evalROI = (chs) => {
    const segs = chs.map((c) => rec.chMap.get(c).subarray(start, start + len));
    const ms = segs.map((seg) => ({ ...spectralFeatures(seg), dfa: computeDFA(seg) }));
    const avg = (k) => ms.reduce((a, x) => a + x[k], 0) / ms.length;
    return {
      slopeBB: +avg('slopeBB').toFixed(4),
      alphaFrac: +avg('alphaFrac').toFixed(4),
      betaFrac: +avg('betaFrac').toFixed(4),
      logBeta: +avg('logBeta').toFixed(4),
      dfa: +avg('dfa').toFixed(4),
      effDimNorm: +(computeEffDim(segs) / Math.max(1, chs.length)).toFixed(4),
    };
  };

  const allSegs = rec.chNames.map((c) => rec.chMap.get(c).subarray(start, start + len));
  const post = evalROI(postChs);
  const rf = evalROI(rfChs);
  const lf = evalROI(lfChs);
  return {
    device: rec.device,
    postSlope: post.slopeBB,
    postDFA: post.dfa,
    postAlpha: post.alphaFrac,
    postLogBeta: post.logBeta,
    postEffDimNorm: post.effDimNorm,
    globalEffDimNorm: +(computeEffDim(allSegs) / rec.chNames.length).toFixed(4),
    rfSlope: rf.slopeBB,
    lfSlope: lf.slopeBB,
    rfMinusLfSlope: +(rf.slopeBB - lf.slopeBB).toFixed(4),
    rfBeta: rf.betaFrac,
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
  if (n < 2) return { n, mean: 0, dz: 0, pApprox: 1, nPos: 0, nNeg: 0 };
  const mean = diffs.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(diffs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) || 1e-9;
  const t = mean / (sd / Math.sqrt(n));
  return { n, mean: +mean.toFixed(4), dz: +(mean / sd).toFixed(3), pApprox: +erfc(Math.abs(t) / Math.SQRT2).toFixed(4), nPos: diffs.filter((x) => x > 0).length, nNeg: diffs.filter((x) => x < 0).length };
}

function findFiles(sessDir) {
  const dirs = [path.join(sessDir, 'EEG'), sessDir].filter((d) => fs.existsSync(d));
  let relax1 = null, relax2 = null;
  for (const dir of dirs) {
    const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.mat'));
    if (!relax1) {
      const f1 = files.find((f) => /^relax[_ ]?1\.mat$/i.test(f))
        || files.find((f) => /^(resting|relax_\d+_\d+)\.mat$/i.test(f))
        || files.find((f) => /relax[_ ]?1/i.test(f) && !/relax[_ ]?2/i.test(f));
      if (f1) relax1 = path.join(dir, f1);
    }
    if (!relax2) {
      const f2 = files.find((f) => /^relax[_ ]?2\.mat$/i.test(f))
        || files.find((f) => /relax[_ ]?2/i.test(f));
      if (f2) relax2 = path.join(dir, f2);
    }
  }
  return { relax1, relax2 };
}

function main() {
  const arms = [
    { dir: path.join(DATA_DIR, 'chap1_MI_PTSD'), group: 'MI' },
    { dir: path.join(DATA_DIR, 'chap2_NF_PTSD'), group: 'NF' },
  ];

  const subjects = [];
  for (const arm of arms) {
    const folders = fs.readdirSync(arm.dir).filter((f) => fs.statSync(path.join(arm.dir, f)).isDirectory());
    for (const folder of folders) {
      const key = folder.replace(/\s+/g, '');
      const pcl = PCL5_TABLE[key];
      if (!pcl) continue;
      const subDir = path.join(arm.dir, folder);
      const sessDirs = fs.readdirSync(subDir)
        .filter((s) => /^session\s*\d+/i.test(s) && fs.statSync(path.join(subDir, s)).isDirectory())
        .sort((a, b) => parseInt(a.replace(/\D/g, ''), 10) - parseInt(b.replace(/\D/g, ''), 10));

      const byDevice = new Map();
      for (const sName of sessDirs) {
        const sNum = parseInt(sName.replace(/\D/g, ''), 10);
        const { relax1, relax2 } = findFiles(path.join(subDir, sName));
        if (!relax1) continue;
        const r1 = loadMatEEG(relax1);
        if (!r1) continue;
        const m1 = analyzeSegment(r1, 'center');
        if (!m1) continue;
        let m2 = null;
        if (relax2) {
          const r2 = loadMatEEG(relax2);
          if (r2 && r2.device === r1.device) {
            const isStandalone = /^relax[_ ]?2\.mat$/i.test(path.basename(relax2));
            m2 = analyzeSegment(r2, isStandalone ? 'center' : 'tail');
          }
        }
        if (!byDevice.has(r1.device)) byDevice.set(r1.device, []);
        byDevice.get(r1.device).push({ sNum, m1, m2 });
      }
      let best = null;
      for (const list of byDevice.values()) if (list.length >= 2 && (!best || list.length > best.length)) best = list;
      if (!best) continue;
      subjects.push({ key, pid: pcl.pid, group: pcl.group, pclDrop: pcl.pre - pcl.post, sessions: best });
    }
  }

  // 1. Early / Mid / Late Trajectory (First, Middle, Last same-device session)
  const trajectory = { NF: {}, MI: {} };
  const acute = { NF: {}, MI: {} };
  const metrics = ['rfSlope', 'rfMinusLfSlope', 'postDFA', 'postEffDimNorm', 'globalEffDimNorm', 'postAlpha'];

  for (const grp of ['NF', 'MI']) {
    const list = subjects.filter((s) => s.group === grp);
    for (const m of metrics) {
      const earlyToMid = [], midToLate = [], earlyToLate = [];
      const acuteAll = [];
      for (const s of list) {
        const first = s.sessions[0].m1[m];
        const mid = s.sessions[Math.floor(s.sessions.length / 2)].m1[m];
        const last = s.sessions[s.sessions.length - 1].m1[m];
        earlyToMid.push(mid - first);
        midToLate.push(last - mid);
        earlyToLate.push(last - first);
        // Mean acute within-session shift (relax2 - relax1) across all paired sessions for this subject
        const pairs = s.sessions.filter((x) => x.m2).map((x) => x.m2[m] - x.m1[m]);
        if (pairs.length) acuteAll.push(pairs.reduce((a, b) => a + b, 0) / pairs.length);
      }
      trajectory[grp][m] = {
        earlyToMid: pairedStats(earlyToMid),
        midToLate: pairedStats(midToLate),
        earlyToLate: pairedStats(earlyToLate),
      };
      acute[grp][m] = pairedStats(acuteAll);
    }
  }

  const out = { generatedAt: new Date().toISOString(), nSubjects: subjects.length, trajectory, acuteWithinSession: acute };
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));

  console.log('=== 1. SESSION TRAJECTORY (EARLY -> MID -> LATE): NF CLINICAL REMISSION (n=10) ===');
  console.table(Object.fromEntries(metrics.map((m) => [m, {
    Early_to_Mid: `${trajectory.NF[m].earlyToMid.mean} (dz=${trajectory.NF[m].earlyToMid.dz}, p=${trajectory.NF[m].earlyToMid.pApprox})`,
    Mid_to_Late: `${trajectory.NF[m].midToLate.mean} (dz=${trajectory.NF[m].midToLate.dz}, p=${trajectory.NF[m].midToLate.pApprox})`,
    Full_Span: `${trajectory.NF[m].earlyToLate.mean} (dz=${trajectory.NF[m].earlyToLate.dz}, p=${trajectory.NF[m].earlyToLate.pApprox}, neg=${trajectory.NF[m].earlyToLate.nNeg}/10)`,
  }])));

  console.log('\n=== 2. ACUTE WITHIN-SESSION SHIFT (POST relax2 - PRE relax1): NF vs MI ===');
  console.table(Object.fromEntries(metrics.map((m) => [m, {
    NF_Acute: `${acute.NF[m].mean} (dz=${acute.NF[m].dz}, p=${acute.NF[m].pApprox}, pos=${acute.NF[m].nPos}/${acute.NF[m].n})`,
    MI_Acute: `${acute.MI[m].mean} (dz=${acute.MI[m].dz}, p=${acute.MI[m].pApprox}, pos=${acute.MI[m].nPos}/${acute.MI[m].n})`,
  }])));
  console.log(`\nSaved -> ${OUT_PATH}`);
}

main();
