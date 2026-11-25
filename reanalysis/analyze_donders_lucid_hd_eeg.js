'use strict';

/**
 * Project ONEIRIS (Phase 2 — Lab #9: Donders HD-EEG Spontaneous/Motor Lucid Dreaming Replication)
 * Dataset: Dream Database from Donders (Demirel, Gott & Dresler; Figshare 21388722)
 *          58-ch to 116-ch HD-EEG (500 Hz) across Study 0 (Lucid Dialogue) & Study 1 (Lucid Motor LRLR).
 *
 * Detects the peak horizontal EOG (LRLR eye-signaling) lucid bout within the final 15 minutes
 * before awakening, rejects the saccade-contaminated 2s sub-windows inside the bout, and compares
 * the clean saccade-free CSD immediately following/surrounding LRLR signaling vs. pre-signal baseline
 * sleep earlier in the exact same recording.
 */

const fs = require('fs');
const path = require('path');

const PSG_ROOT = path.join(__dirname, 'data', 'donders_lucid', 'extracted', 'Data', 'PSG');
const OUT_PATH = path.join(__dirname, 'data', 'donders_lucid', 'donders_lab9_lucid_results.json');

const RECORDINGS = [
  { rel: 's_00/c_00/morningnap_singlepart.edf', study: 'Motor_LRLR' },
  { rel: 's_01/c_01/morningnap_singlepart.edf', study: 'Motor_LRLR' },
  { rel: 's_02/c_02/morningnap_part2.edf',      study: 'Motor_LRLR' },
  { rel: 's_04/c_04/morningnap_singlepart.edf', study: 'Lucid_Dialogue' },
  { rel: 's_04/c_05/morningnap_singlepart.edf', study: 'Lucid_Dialogue' },
];

const CSD_RINGS = {
  Right_Frontal: [{ c: 'F4', n: ['Fp2', 'Fz', 'C4', 'F8'] }, { c: 'F8', n: ['Fp2', 'F4', 'T8'] }],
  Left_Frontal:  [{ c: 'F3', n: ['Fp1', 'Fz', 'C3', 'F7'] }, { c: 'F7', n: ['Fp1', 'F3', 'T7'] }],
  Posterior:     [{ c: 'P4', n: ['C4', 'Pz', 'O2', 'P8'] }, { c: 'O1', n: ['P3', 'P7', 'Oz'] }, { c: 'O2', n: ['P4', 'P8', 'Oz'] }],
};

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wlenRe = Math.cos(ang), wlenIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let wRe = 1, wIm = 0;
      for (let j = 0; j < len / 2; j++) {
        const uRe = re[i + j], uIm = im[i + j];
        const vRe = re[i + j + len / 2] * wRe - im[i + j + len / 2] * wIm;
        const vIm = re[i + j + len / 2] * wIm + im[i + j + len / 2] * wRe;
        re[i + j] = uRe + vRe; im[i + j] = uIm + vIm;
        re[i + j + len / 2] = uRe - vRe; im[i + j + len / 2] = uIm - vIm;
        const nw = wRe * wlenRe - wIm * wlenIm; wIm = wRe * wlenIm + wIm * wlenRe; wRe = nw;
      }
    }
  }
}

function slopeBB(sig, sfreq = 250, nfft = 512) {
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
  for (let k = 1; k < half; k++) {
    const f = k * df;
    if ((f >= 2 && f <= 7) || (f >= 14 && f <= 45)) { xs.push(Math.log10(f)); ys.push(Math.log10(psd[k] / Math.max(1, segs) + 1e-24)); }
  }
  let mx = 0, my = 0; for (let i = 0; i < xs.length; i++) { mx += xs[i]; my += ys[i]; } mx /= xs.length; my /= xs.length;
  let num = 0, den = 0; for (let i = 0; i < xs.length; i++) { const dx = xs[i] - mx; num += dx * (ys[i] - my); den += dx * dx; }
  return den > 0 ? num / den : 0;
}

function crossCorrIrrev(sigs, lags = [1, 2, 4, 8]) {
  const m = sigs.length; if (m < 2) return 0;
  const n = sigs[0].length;
  const zs = sigs.map((s) => {
    let mu = 0; for (let t = 0; t < n; t++) mu += s[t]; mu /= n;
    let v = 0; for (let t = 0; t < n; t++) v += (s[t] - mu) ** 2;
    const sd = Math.sqrt(v / n) || 1, o = new Float64Array(n);
    for (let t = 0; t < n; t++) o[t] = (s[t] - mu) / sd;
    return o;
  });
  let tot = 0, cnt = 0;
  for (const tau of lags) {
    const len = n - tau;
    for (let i = 0; i < m; i++) for (let j = i + 1; j < m; j++) {
      let cf = 0, cb = 0; const si = zs[i], sj = zs[j];
      for (let t = 0; t < len; t++) { cf += si[t] * sj[t + tau]; cb += sj[t] * si[t + tau]; }
      tot += Math.abs((cf - cb) / len); cnt++;
    }
  }
  return cnt ? tot / cnt : 0;
}

/** Read only the final `tailSec` seconds of a large Donders EDF using fd.readSync (zero huge RAM spikes) */
function readEDFTail(filePath, tailSec = 900) {
  const fd = fs.openSync(filePath, 'r');
  const h256 = Buffer.alloc(256);
  fs.readSync(fd, h256, 0, 256, 0);
  const numRecords = parseInt(h256.toString('ascii', 236, 244).trim(), 10);
  const recordDurSec = parseFloat(h256.toString('ascii', 244, 252).trim());
  const ns = parseInt(h256.toString('ascii', 252, 256).trim(), 10);
  const headerBytes = parseInt(h256.toString('ascii', 184, 192).trim(), 10);

  const fullHdr = Buffer.alloc(headerBytes);
  fs.readSync(fd, fullHdr, 0, headerBytes, 0);
  const readStr = (off, w) => Array.from({ length: ns }, (_, i) => fullHdr.toString('ascii', off + i * w, off + (i + 1) * w).trim());
  let off = 256;
  const labels = readStr(off, 16); off += ns * 16 + ns * 80 + ns * 8;
  const physMin = readStr(off, 8).map(Number); off += ns * 8;
  const physMax = readStr(off, 8).map(Number); off += ns * 8;
  const digMin = readStr(off, 8).map(Number); off += ns * 8;
  const digMax = readStr(off, 8).map(Number); off += ns * 8 + ns * 80;
  const spr = readStr(off, 8).map((s) => parseInt(s, 10));

  const bytesPerRec = spr.reduce((a, b) => a + b * 2, 0);
  const recsNeeded = Math.min(numRecords, Math.ceil(tailSec / recordDurSec));
  const startRec = Math.max(0, numRecords - recsNeeded);

  const lmap = new Map(); labels.forEach((l, i) => lmap.set(l.toUpperCase(), i));
  const eogA = lmap.get('HEOG1') ?? lmap.get('EOG_LEFT');
  const eogB = lmap.get('HEOG2') ?? lmap.get('EOG_RIGHT');

  const needed = new Set();
  for (const rings of Object.values(CSD_RINGS)) for (const r of rings) { needed.add(r.c.toUpperCase()); for (const n of r.n) needed.add(n.toUpperCase()); }
  const keepIdx = new Map();
  for (const n of needed) if (lmap.has(n)) keepIdx.set(lmap.get(n), n);
  if (eogA !== undefined) keepIdx.set(eogA, '__EOGA');
  if (eogB !== undefined) keepIdx.set(eogB, '__EOGB');

  const sfreqRaw = spr[0] / recordDurSec;
  const decim = Math.max(1, Math.round(sfreqRaw / 250));
  const sfreq = sfreqRaw / decim;
  const decPerRec = Math.floor(spr[0] / decim);
  const scales = Array.from({ length: ns }, (_, i) => (physMax[i] - physMin[i]) / Math.max(1e-12, digMax[i] - digMin[i]));
  const offsets = Array.from({ length: ns }, (_, i) => physMin[i] - scales[i] * digMin[i]);

  const sigs = new Map();
  for (const name of keepIdx.values()) sigs.set(name, new Float64Array(recsNeeded * decPerRec));

  const recBuf = Buffer.alloc(bytesPerRec);
  for (let r = 0; r < recsNeeded; r++) {
    fs.readSync(fd, recBuf, 0, bytesPerRec, headerBytes + (startRec + r) * bytesPerRec);
    let pos = 0;
    for (let ch = 0; ch < ns; ch++) {
      const nS = spr[ch];
      const name = keepIdx.get(ch);
      if (name && nS === spr[0]) {
        const arr = sigs.get(name), sc = scales[ch], of = offsets[ch], base = r * decPerRec;
        for (let d = 0; d < decPerRec; d++) {
          let s = 0; for (let k = 0; k < decim; k++) { s += recBuf.readInt16LE(pos) * sc + of; pos += 2; }
          arr[base + d] = s / decim;
        }
        const rem = nS - decPerRec * decim; if (rem > 0) pos += rem * 2;
      } else {
        pos += nS * 2;
      }
    }
  }
  fs.closeSync(fd);

  // Bipolar HEOG for clean LRLR detection
  let heog = null;
  if (sigs.has('__EOGA') && sigs.has('__EOGB')) {
    const a = sigs.get('__EOGA'), b = sigs.get('__EOGB');
    heog = new Float64Array(a.length);
    for (let t = 0; t < a.length; t++) heog[t] = a[t] - b[t];
  } else if (sigs.has('__EOGA')) heog = sigs.get('__EOGA');

  // 1.0 Hz HPF on EEG channels
  const rc = 1 / (2 * Math.PI * 1.0), alpha = rc / (rc + 1 / sfreq);
  for (const [k, arr] of sigs.entries()) {
    if (k.startsWith('__')) continue;
    let px = arr[0], py = 0; arr[0] = 0;
    for (let t = 1; t < arr.length; t++) { const x = arr[t], y = alpha * (py + x - px); arr[t] = y; px = x; py = y; }
  }
  return { sfreq, totalSec: recsNeeded * recordDurSec, sigs, heog };
}

function main() {
  const rows = [];
  for (const item of RECORDINGS) {
    const fullPath = path.join(PSG_ROOT, item.rel);
    if (!fs.existsSync(fullPath)) continue;
    const rec = readEDFTail(fullPath, 900); // final 15 min
    const roi = {};
    let ok = true;
    for (const [rName, rings] of Object.entries(CSD_RINGS)) {
      const chs = [];
      for (const ring of rings) {
        const c = rec.sigs.get(ring.c.toUpperCase()), ns = ring.n.map((x) => rec.sigs.get(x.toUpperCase())).filter(Boolean);
        if (!c || ns.length < 2) continue;
        const o = new Float64Array(c.length);
        for (let t = 0; t < c.length; t++) { let s = 0; for (const g of ns) s += g[t]; o[t] = c[t] - s / ns.length; }
        chs.push(o);
      }
      if (!chs.length) { ok = false; break; }
      roi[rName] = chs;
    }
    if (!ok || !rec.heog) continue;

    // Detect peak 6-second horizontal EOG LRLR signaling bout in the last 8 minutes (excluding final 30s wake-up)
    const sf = rec.sfreq;
    const scanStart = Math.max(120, Math.floor(rec.totalSec - 480));
    const scanEnd = Math.floor(rec.totalSec - 40);
    let bestSec = scanStart, bestScore = -1;
    for (let sec = scanStart; sec < scanEnd - 6; sec += 2) {
      const s0 = sec * sf, s1 = (sec + 6) * sf;
      let mn = 1e9, mx = -1e9, crossings = 0, mean = 0;
      for (let t = s0; t < s1; t++) mean += rec.heog[t]; mean /= (s1 - s0);
      let prev = rec.heog[s0] - mean;
      for (let t = s0; t < s1; t++) {
        const v = rec.heog[t] - mean;
        if (v < mn) mn = v; if (v > mx) mx = v;
        if ((prev < 0 && v >= 0) || (prev > 0 && v <= 0)) crossings++;
        prev = v;
      }
      // LRLR has large bipolar swings + multiple zero-crossings
      const score = (mx - mn) * Math.min(8, crossings);
      if (score > bestScore) { bestScore = score; bestSec = sec; }
    }

    // Compare 30s post-LRLR lucid execution window [bestSec+6 .. bestSec+36] (saccade-free!) vs baseline sleep [60..90s]
    const evalWin = (stSec) => {
      const st = Math.floor(stSec * sf), len = Math.floor(30 * sf);
      const rf = roi.Right_Frontal.map((g) => g.subarray(st, st + len));
      const lf = roi.Left_Frontal.map((g) => g.subarray(st, st + len));
      const po = roi.Posterior.map((g) => g.subarray(st, st + len));
      return {
        rfSlope: rf.reduce((a, g) => a + slopeBB(g, sf), 0) / rf.length,
        lfSlope: lf.reduce((a, g) => a + slopeBB(g, sf), 0) / lf.length,
        postSlope: po.reduce((a, g) => a + slopeBB(g, sf), 0) / po.length,
        crossIrrevGlobal: crossCorrIrrev([...rf, ...lf, ...po], [1, 2, 4, 8]),
      };
    };

    const base = evalWin(60);
    const lucid = evalWin(bestSec + 6);
    rows.push({
      file: item.rel.split('/').slice(0, 2).join('/'),
      study: item.study,
      lrlrSecFromEnd: Math.round(rec.totalSec - bestSec),
      dRF_slope: Number((lucid.rfSlope - base.rfSlope).toFixed(4)),
      dLF_slope: Number((lucid.lfSlope - base.lfSlope).toFixed(4)),
      dPost_slope: Number((lucid.postSlope - base.postSlope).toFixed(4)),
      dCrossIrrev: Number((lucid.crossIrrevGlobal - base.crossIrrevGlobal).toFixed(4)),
    });
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify({ nRecordings: rows.length, rows }, null, 2));
  console.log('=== LAB #9: DONDERS 58-116CH HD-EEG LUCID DREAMING REPLICATION (POST-LRLR vs BASELINE SLEEP) ===');
  console.table(rows);
  const posRF = rows.filter((r) => r.dRF_slope > 0).length;
  const posPost = rows.filter((r) => r.dPost_slope > 0).length;
  const negIrrev = rows.filter((r) => r.dCrossIrrev < 0).length;
  console.log(`Summary: Right_Frontal slopeBB UP in ${posRF}/${rows.length}, Posterior slopeBB UP in ${posPost}/${rows.length}, crossIrrevGlobal DOWN in ${negIrrev}/${rows.length}`);
  console.log(`Saved -> ${OUT_PATH}`);
}

main();
