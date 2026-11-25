'use strict';

/**
 * Project ONEIRIS (Phase 2 — Test B: Post-Cue Executive Agency Test in Lucid REM)
 * Dataset: TWC_USA (Konkoly et al., 2021 — 276 real TLR + Math cues across 20 paired recordings)
 *
 * Tests whether POST-CUE [+4..+14 s] Right_Frontal 1/f slopeBB (after EOG saccade rejection)
 * separates RESPONDED cues (where the dreamer actively signaled back with R-HEOG eye movements)
 * vs. MISSED cues (where the cue played but the dreamer failed to respond) inside the EXACT SAME
 * sleep recordings!
 */

const fs = require('fs');
const path = require('path');

const PSG_DIR = path.join(__dirname, 'data', 'twc_usa', 'extracted', 'Data', 'PSG');
const OUT_PATH = path.join(__dirname, 'data', 'twc_usa', 'twc_usa_postcue_agency_results.json');

const CSD_RINGS = {
  Right_Frontal: [{ c: 'F4', n: ['Fp2', 'Fz', 'C4', 'F8'] }, { c: 'F8', n: ['Fp2', 'F4', 'T4'] }],
  Left_Frontal:  [{ c: 'F3', n: ['Fp1', 'Fz', 'C3', 'F7'] }, { c: 'F7', n: ['Fp1', 'F3', 'T3'] }],
  Posterior:     [{ c: 'P4', n: ['C4', 'Pz', 'O2', 'T6'] }, { c: 'O1', n: ['P3', 'T5', 'Oz'] }, { c: 'O2', n: ['P4', 'T6', 'Oz'] }],
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

function slopeBB(sig, sfreq = 200, nfft = 256) {
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

function pairedSignFlip(diffs) {
  const n = diffs.length; if (!n) return { n: 0, nPos: '0/0', dz: 0, p: 1 };
  const obs = diffs.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(diffs.reduce((a, b) => a + (b - obs) ** 2, 0) / Math.max(1, n - 1)) || 1e-12;
  const nPos = diffs.filter((d) => d > 0).length;
  let ge = 0, seed = 2026;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let k = 0; k < 10000; k++) {
    let s = 0; for (let i = 0; i < n; i++) s += rand() < 0.5 ? diffs[i] : -diffs[i];
    if (Math.abs(s / n) >= Math.abs(obs) - 1e-12) ge++;
  }
  return { n, nPos: `${nPos}/${n}`, meanDiff: Number(obs.toFixed(4)), dz: Number((obs / sd).toFixed(3)), p: Number((ge / 10000).toFixed(4)) };
}

function readTwcEDF(filePath) {
  const buf = fs.readFileSync(filePath);
  const numRecords = parseInt(buf.toString('ascii', 236, 244).trim(), 10);
  const recordDurSec = parseFloat(buf.toString('ascii', 244, 252).trim());
  const ns = parseInt(buf.toString('ascii', 252, 256).trim(), 10);
  const headerBytes = parseInt(buf.toString('ascii', 184, 192).trim(), 10);
  const readStr = (off, w) => Array.from({ length: ns }, (_, i) => buf.toString('ascii', off + i * w, off + (i + 1) * w).trim());
  let off = 256;
  const labels = readStr(off, 16); off += ns * 16 + ns * 80 + ns * 8;
  const physMin = readStr(off, 8).map(Number); off += ns * 8;
  const physMax = readStr(off, 8).map(Number); off += ns * 8;
  const digMin = readStr(off, 8).map(Number); off += ns * 8;
  const digMax = readStr(off, 8).map(Number); off += ns * 8 + ns * 80;
  const spr = readStr(off, 8).map((s) => parseInt(s, 10));
  const sfreqRaw = spr[0] / recordDurSec, decim = Math.max(1, Math.round(sfreqRaw / 200)), sfreq = sfreqRaw / decim;
  const useRecords = Math.max(0, numRecords - 1), decPerRec = Math.floor(spr[0] / decim);
  const scales = Array.from({ length: ns }, (_, i) => (physMax[i] - physMin[i]) / Math.max(1e-12, digMax[i] - digMin[i]));
  const offsets = Array.from({ length: ns }, (_, i) => physMin[i] - scales[i] * digMin[i]);
  const lmap = new Map(); for (let ch = 0; ch < ns; ch++) lmap.set(labels[ch].toUpperCase(), ch);
  const statusCh = lmap.get('STATUS');
  const needed = new Set(['R-HEOG']);
  for (const rings of Object.values(CSD_RINGS)) for (const r of rings) { needed.add(r.c.toUpperCase()); for (const n of r.n) needed.add(n.toUpperCase()); }
  const sigs = new Map(); for (const n of needed) if (lmap.has(n)) sigs.set(n, new Float64Array(useRecords * decPerRec));
  const events = [];
  let pos = headerBytes, prevCode = 0;
  for (let r = 0; r < useRecords; r++) {
    for (let ch = 0; ch < ns; ch++) {
      const nS = spr[ch], sc = scales[ch], of = offsets[ch], lbl = labels[ch].toUpperCase();
      if (ch === statusCh) {
        for (let s = 0; s < nS; s++) {
          const val = Math.round(buf.readInt16LE(pos) * sc + of); pos += 2;
          const sec = r * recordDurSec + s / sfreqRaw;
          if (sec >= 5 && val !== prevCode && val > 0 && val !== 32 && val !== 64 && val !== 65) events.push({ sec, code: val });
          prevCode = val;
        }
      } else if (sigs.has(lbl)) {
        const arr = sigs.get(lbl), base = r * decPerRec;
        for (let d = 0; d < decPerRec; d++) { let s = 0; for (let k = 0; k < decim; k++) { s += buf.readInt16LE(pos) * sc + of; pos += 2; } arr[base + d] = s / decim; }
        const rem = nS - decPerRec * decim; if (rem > 0) pos += rem * 2;
      } else pos += nS * 2;
    }
  }
  const rc = 1 / (2 * Math.PI * 1.0), alpha = rc / (rc + 1 / sfreq);
  for (const [k, arr] of sigs.entries()) {
    if (k === 'R-HEOG') continue;
    let px = arr[0], py = 0; arr[0] = 0;
    for (let t = 1; t < arr.length; t++) { const x = arr[t], y = alpha * (py + x - px); arr[t] = y; px = x; py = y; }
  }
  return { sfreq, totalSec: useRecords * recordDurSec, sigs, events };
}

function main() {
  const edfs = fs.readdirSync(PSG_DIR).filter((f) => f.endsWith('.edf')).sort();
  const byFile = [];

  for (const fname of edfs) {
    const rec = readTwcEDF(path.join(PSG_DIR, fname));
    const heog = rec.sigs.get('R-HEOG');
    const cues = rec.events.filter((e) => e.code === 29 || (e.code >= 1 && e.code <= 20));
    if (!heog || cues.length < 2) continue;

    const roi = {}; let ok = true;
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
    if (!ok) continue;

    const sf = rec.sfreq;
    const p2pAll = [];
    for (let t = 0; t + sf <= heog.length; t += sf) {
      let mn = 1e9, mx = -1e9;
      for (let k = t; k < t + sf; k++) { if (heog[k] < mn) mn = heog[k]; if (heog[k] > mx) mx = heog[k]; }
      p2pAll.push(mx - mn);
    }
    const medP2P = [...p2pAll].sort((a, b) => a - b)[Math.floor(p2pAll.length / 2)] || 1;

    const resp = [], miss = [];
    for (const ev of cues) {
      if (ev.sec < 5 || ev.sec + 16 > rec.totalSec) continue;
      const s0 = Math.floor((ev.sec + 1) * sf), s1 = Math.floor((ev.sec + 10) * sf);
      let mn = 1e9, mx = -1e9;
      for (let k = s0; k < s1; k++) { if (heog[k] < mn) mn = heog[k]; if (heog[k] > mx) mx = heog[k]; }
      const isResp = (mx - mn) > 3.0 * medP2P;

      // Measure POST-RESPONSE quiet window [+10..+16 s] (strictly AFTER the [+1..+10s] eye signal!)
      // AND pre-response executive deliberation [+2..+6 s]
      const evalSlp = (name, aSec, bSec) => {
        const a = Math.floor((ev.sec + aSec) * sf), b = Math.floor((ev.sec + bSec) * sf);
        return roi[name].reduce((acc, g) => acc + slopeBB(g.subarray(a, b), sf, 256), 0) / roi[name].length;
      };
      const row = {
        delib_RF: evalSlp('Right_Frontal', 2, 6),
        delib_LF: evalSlp('Left_Frontal', 2, 6),
        delib_Post: evalSlp('Posterior', 2, 6),
        postSig_RF: evalSlp('Right_Frontal', 10, 16),
        postSig_LF: evalSlp('Left_Frontal', 10, 16),
        postSig_Post: evalSlp('Posterior', 10, 16),
      };
      (isResp ? resp : miss).push(row);
    }
    if (resp.length >= 1 && miss.length >= 1) byFile.push({ fname, resp, miss });
  }

  const keys = ['delib_RF', 'delib_LF', 'delib_Post', 'postSig_RF', 'postSig_LF', 'postSig_Post'];
  const stats = {};
  for (const k of keys) {
    const diffs = byFile.map((f) => {
      const mR = f.resp.reduce((a, x) => a + x[k], 0) / f.resp.length;
      const mM = f.miss.reduce((a, x) => a + x[k], 0) / f.miss.length;
      return mR - mM;
    });
    stats[k] = pairedSignFlip(diffs);
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify({ nPairedRecordings: byFile.length, stats }, null, 2));
  console.log(`=== TEST B: RESPONDED vs MISSED CUES INSIDE REM (n=${byFile.length} PAIRED RECORDINGS, 21-ch CSD) ===`);
  console.table(stats);
  console.log(`Saved -> ${OUT_PATH}`);
}

main();
