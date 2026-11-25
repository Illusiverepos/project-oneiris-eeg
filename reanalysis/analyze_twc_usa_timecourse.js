'use strict';

/**
 * Project ONEIRIS (Phase 2) — Time-Resolved [-10s .. +30s] Right-Frontal Executive Switch Curve
 * Locked to first active TWC/Lucid Math prompt (t = 0) across TWC_USA (n = 12 unique humans, 17 sessions).
 * Uses 21-ch Local Hjorth CSD, 4-second windows stepped every 2 seconds, baseline-referenced to [-10..-4s].
 */

const fs = require('fs');
const path = require('path');

const PSG_DIR = path.join(__dirname, 'data', 'twc_usa', 'extracted', 'Data', 'PSG');
const OUT_PATH = path.join(__dirname, 'data', 'twc_usa', 'twc_usa_timecourse_results.json');

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

function exactSignFlip(diffs) {
  const n = diffs.length; if (!n) return { dz: 0, nPos: 0, p: 1 };
  const obs = diffs.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(diffs.reduce((a, b) => a + (b - obs) ** 2, 0) / Math.max(1, n - 1)) || 1e-12;
  const nPos = diffs.filter((d) => d > 0).length;
  const total = 1 << n; let ge = 0;
  for (let mask = 0; mask < total; mask++) {
    let s = 0; for (let i = 0; i < n; i++) s += (mask & (1 << i)) ? diffs[i] : -diffs[i];
    if (Math.abs(s / n) >= Math.abs(obs) - 1e-12) ge++;
  }
  return { nPos, dz: Number((obs / sd).toFixed(3)), p: Number((ge / total).toFixed(4)) };
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
  const needed = new Set();
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
  for (const arr of sigs.values()) {
    let px = arr[0], py = 0; arr[0] = 0;
    for (let t = 1; t < arr.length; t++) { const x = arr[t], y = alpha * (py + x - px); arr[t] = y; px = x; py = y; }
  }
  return { sfreq, totalSec: useRecords * recordDurSec, sigs, events };
}

function main() {
  const edfs = fs.readdirSync(PSG_DIR).filter((f) => f.endsWith('.edf')).sort();
  const binStarts = [-10, -8, -6, -4, -2, 0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26]; // 4s window each
  const perSub = new Map();

  for (const fname of edfs) {
    const rec = readTwcEDF(path.join(PSG_DIR, fname));
    const math = rec.events.filter((e) => e.code >= 1 && e.code <= 20);
    const tlr = rec.events.filter((e) => e.code === 29);
    if (!math.length) continue;
    const t0 = math[0].sec;
    const firstTLR = tlr.length ? tlr[0].sec : t0;
    const baseEnd = firstTLR >= 45 ? firstTLR - 5 : t0 - 10;
    const baseStart = Math.max(10, baseEnd - 30);
    if (baseStart + 30 > t0 - 5 || t0 + 30 > rec.totalSec || t0 < 12) continue;

    // Build CSD per ROI
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
    if (!ok) continue;

    const roiSlp = (name, sSec, durSec) => {
      const st = Math.floor(sSec * rec.sfreq), len = Math.floor(durSec * rec.sfreq);
      return roi[name].reduce((a, g) => a + slopeBB(g.subarray(st, st + len), rec.sfreq, 256), 0) / roi[name].length;
    };

    const baseRF = roiSlp('Right_Frontal', baseStart, 30);
    const baseLF = roiSlp('Left_Frontal', baseStart, 30);
    const baseP  = roiSlp('Posterior', baseStart, 30);

    const curve = binStarts.map((b) => ({
      tStart: b,
      dRF: roiSlp('Right_Frontal', t0 + b, 4) - baseRF,
      dLF: roiSlp('Left_Frontal', t0 + b, 4) - baseLF,
      dP:  roiSlp('Posterior', t0 + b, 4) - baseP,
    }));
    const subId = fname.slice(7, 13);
    if (!perSub.has(subId)) perSub.set(subId, []);
    perSub.get(subId).push(curve);
  }

  // Average curves per subject (n = 12 unique humans)
  const subCurves = [];
  for (const curves of perSub.values()) {
    subCurves.push(binStarts.map((b, bi) => ({
      tStart: b,
      dRF: curves.reduce((a, c) => a + c[bi].dRF, 0) / curves.length,
      dLF: curves.reduce((a, c) => a + c[bi].dLF, 0) / curves.length,
      dP:  curves.reduce((a, c) => a + c[bi].dP, 0) / curves.length,
    })));
  }

  const table = binStarts.map((b, bi) => {
    const rf = exactSignFlip(subCurves.map((c) => c[bi].dRF));
    const lf = exactSignFlip(subCurves.map((c) => c[bi].dLF));
    const po = exactSignFlip(subCurves.map((c) => c[bi].dP));
    return {
      window: `${b >= 0 ? '+' : ''}${b}..${b + 4 >= 0 ? '+' : ''}${b + 4}s`,
      RF_nPos: `${rf.nPos}/${subCurves.length}`, RF_dz: rf.dz, RF_p: rf.p,
      LF_dz: lf.dz, LF_p: lf.p,
      Post_dz: po.dz, Post_p: po.p,
    };
  });

  fs.writeFileSync(OUT_PATH, JSON.stringify({ nSubjects: subCurves.length, table }, null, 2));
  console.log(`=== TIME-RESOLVED RIGHT-FRONTAL SWITCH CURVE (n=${subCurves.length} UNIQUE HUMANS, LOCKED TO t=0 MATH ONSET) ===`);
  console.table(table);
  console.log(`Saved -> ${OUT_PATH}`);
}

main();
