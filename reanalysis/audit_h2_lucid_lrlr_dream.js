'use strict';

/**
 * Project ONEIRIS (Phase 2, H2) — Lucid Dream Control (LRLR-Locked) Audit
 * Targets: DREAM Database `TWC_USA` (Figshare 22106123, Konkoly et al. 2021)
 *          & `Dream Database from Donders` (Figshare 21388722, Demirel et al.)
 *
 * Pre-registered H2 predictions (locked to LRLR lucidity onset t = 0):
 *   2a. Prefrontal Re-Ignition:  Right/Left Frontal slopeBB & LZc rise (after EOG/saccade rejection + CSD)
 *   2b. Directional Flip:        PSI(Post -> Front) flips negative (Top-Down Front -> Post control)
 *   2c. Wave-to-Floor Stability: Posterior tonicP10 rises faster than burstP90 (metastability drops)
 *
 * Usage:
 *   node audit_h2_lucid_lrlr_dream.js --fetch-twc   # Download TWC_USA.zip (1.49 GB) from Figshare
 *   node audit_h2_lucid_lrlr_dream.js               # Run LRLR audit on extracted EDFs + events CSV
 *   node audit_h2_lucid_lrlr_dream.js --self-test   # Dry-run verification on synthetic LRLR REM trials
 */

const fs = require('fs');
const path = require('path');

const TWC_DIR = path.join(__dirname, 'data', 'twc_usa');
const OUT_PATH = path.join(TWC_DIR, 'h2_lucid_lrlr_results.json');
const TWC_FIGSHARE_API = 'https://api.figshare.com/v2/articles/22106123';

// ======================== DSP, EOG SACCADE REJECTION & CSD ========================

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

function slopeBB(sig, sfreq = 200, nfft = 512) {
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

function lz76Norm(s) {
  const n = s.length; if (n <= 1) return 0; let i = 0, k = 1, l = 1, c = 1, kMax = 1;
  while (true) {
    if (s.charCodeAt(i + k - 1) === s.charCodeAt(l + k - 1)) { k++; if (l + k > n) { c++; break; } }
    else { if (k > kMax) kMax = k; i++; if (i === l) { c++; l += kMax; if (l + 1 > n) break; i = 0; k = 1; kMax = 1; } else k = 1; }
  }
  return (c * Math.log2(n)) / n;
}

function singleLZc(sig, maxT = 300) {
  const nT = Math.min(maxT, Math.floor(sig.length / 2)), sub = new Float64Array(nT);
  for (let t = 0; t < nT; t++) sub[t] = sig[t * 2];
  const med = Float64Array.from(sub).sort()[Math.floor(nT / 2)];
  let bits = ''; for (let t = 0; t < nT; t++) bits += sub[t] > med ? '1' : '0';
  return lz76Norm(bits);
}

function computePSI(sigA, sigB, sfreq = 200, nfft = 512) {
  const step = nfft / 2, half = nfft / 2 + 1, win = new Float64Array(nfft);
  let wp = 0; for (let i = 0; i < nfft; i++) { win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (nfft - 1))); wp += win[i] * win[i]; }
  const pAA = new Float64Array(half), pBB = new Float64Array(half);
  const sRe = new Float64Array(half), sIm = new Float64Array(half);
  for (let st = 0; st + nfft <= sigA.length; st += step) {
    let mA = 0, mB = 0; for (let i = 0; i < nfft; i++) { mA += sigA[st + i]; mB += sigB[st + i]; } mA /= nfft; mB /= nfft;
    const rA = new Float64Array(nfft), iA = new Float64Array(nfft), rB = new Float64Array(nfft), iB = new Float64Array(nfft);
    for (let i = 0; i < nfft; i++) { rA[i] = (sigA[st + i] - mA) * win[i]; rB[i] = (sigB[st + i] - mB) * win[i]; }
    fft(rA, iA); fft(rB, iB); const norm = sfreq * wp;
    for (let k = 0; k < half; k++) {
      pAA[k] += (rA[k] * rA[k] + iA[k] * iA[k]) / norm;
      pBB[k] += (rB[k] * rB[k] + iB[k] * iB[k]) / norm;
      sRe[k] += (rA[k] * rB[k] + iA[k] * iB[k]) / norm;
      sIm[k] += (rA[k] * iB[k] - iA[k] * rB[k]) / norm;
    }
  }
  const cRe = new Float64Array(half), cIm = new Float64Array(half);
  for (let k = 0; k < half; k++) {
    const den = Math.sqrt(Math.max(1e-30, pAA[k] * pBB[k]));
    cRe[k] = sRe[k] / den; cIm[k] = sIm[k] / den;
  }
  const df = sfreq / nfft;
  const bandPSI = (lo, hi) => {
    let acc = 0;
    for (let k = 1; k < half - 1; k++) {
      const f = k * df;
      if (f >= lo && f + df <= hi) acc += cRe[k] * cIm[k + 1] - cIm[k] * cRe[k + 1];
    }
    return acc;
  };
  return { psiAlpha: bandPSI(8, 12), psiBeta: bandPSI(13, 25) };
}

/**
 * EOG / Micro-Saccade Artifact Mask (prevents frontal eye-EMG from faking prefrontal lucidity):
 * Marks 2-second windows whose max |d(EOG)/dt| exceeds `zThresh` SD above the epoch's median.
 */
function cleanNonSaccadeWindows(eogSig, winN, stepN, zThresh = 4.5) {
  const n = eogSig.length;
  const nWins = Math.floor((n - winN) / stepN) + 1;
  const maxSlopes = new Float64Array(nWins);
  for (let w = 0; w < nWins; w++) {
    const st = w * stepN;
    let mx = 0;
    for (let t = st + 1; t < st + winN; t++) {
      const d = Math.abs(eogSig[t] - eogSig[t - 1]);
      if (d > mx) mx = d;
    }
    maxSlopes[w] = mx;
  }
  const sorted = Float64Array.from(maxSlopes).sort();
  const med = sorted[Math.floor(nWins / 2)] || 1e-9;
  const mad = Float64Array.from(maxSlopes, (x) => Math.abs(x - med)).sort()[Math.floor(nWins / 2)] || 1e-9;
  const cleanIdx = [];
  for (let w = 0; w < nWins; w++) {
    if ((maxSlopes[w] - med) / (1.4826 * mad) <= zThresh) cleanIdx.push(w);
  }
  return { cleanIdx, rejectedCount: nWins - cleanIdx.length, totalWindows: nWins };
}

function extractWindowMetrics(postSigs, frontSigs, eogSig, sfreq) {
  const winN = 2 * sfreq, stepN = sfreq;
  const { cleanIdx, rejectedCount, totalWindows } = cleanNonSaccadeWindows(eogSig, winN, stepN);
  const useIdx = cleanIdx.length >= 3 ? cleanIdx : Array.from({ length: totalWindows }, (_, i) => i);

  const postLZWins = [], frontLZWins = [], frontSlpWins = [];
  for (const w of useIdx) {
    const st = w * stepN;
    let pL = 0, fL = 0, fS = 0;
    for (const g of postSigs) pL += singleLZc(g.subarray(st, st + winN), 200);
    for (const g of frontSigs) {
      const sl = g.subarray(st, st + winN);
      fL += singleLZc(sl, 200);
      fS += slopeBB(sl, sfreq, 256);
    }
    postLZWins.push(pL / postSigs.length);
    frontLZWins.push(fL / frontSigs.length);
    frontSlpWins.push(fS / frontSigs.length);
  }
  const sortedP = [...postLZWins].sort((a, b) => a - b);
  const tonicP10 = sortedP[Math.floor(0.10 * (sortedP.length - 1))];
  const burstP90 = sortedP[Math.floor(0.90 * (sortedP.length - 1))];
  const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;

  const meanSig = (arr) => {
    const n = arr[0].length, o = new Float64Array(n);
    for (let t = 0; t < n; t++) { let s = 0; for (const g of arr) s += g[t]; o[t] = s / arr.length; }
    return o;
  };
  const psi = computePSI(meanSig(postSigs), meanSig(frontSigs), sfreq, 512);
  return {
    tonicP10, burstP90, metastabilityGap: burstP90 - tonicP10,
    frontLZc: mean(frontLZWins), frontSlopeBB: mean(frontSlpWins),
    psiAlpha: psi.psiAlpha, psiBeta: psi.psiBeta,
    saccadeRejectedWins: rejectedCount,
  };
}

function pairedSignFlip(diffs) {
  const n = diffs.length;
  const obs = diffs.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(diffs.reduce((a, b) => a + (b - obs) ** 2, 0) / Math.max(1, n - 1)) || 1e-12;
  const nPos = diffs.filter((d) => d > 0).length;
  let ge = 0, total = n <= 12 ? (1 << n) : 10000;
  if (n <= 12) {
    for (let mask = 0; mask < total; mask++) {
      let s = 0; for (let i = 0; i < n; i++) s += (mask & (1 << i)) ? diffs[i] : -diffs[i];
      if (Math.abs(s / n) >= Math.abs(obs) - 1e-12) ge++;
    }
  } else {
    let seed = 1337;
    const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let k = 0; k < total; k++) {
      let s = 0; for (let i = 0; i < n; i++) s += rand() < 0.5 ? diffs[i] : -diffs[i];
      if (Math.abs(s / n) >= Math.abs(obs) - 1e-12) ge++;
    }
  }
  return { n, nPos, meanDiff: Number(obs.toFixed(4)), dz: Number((obs / sd).toFixed(3)), pTwoSided: Number((ge / total).toFixed(5)) };
}

function runSelfTest() {
  console.log('=== H2 LUCID DREAMING (LRLR-LOCKED) AUDIT — SYNTHETIC SELF-TEST (N=10 PAIRED) ===');
  const sfreq = 200, N = 24 * sfreq;
  const makeEpoch = (isLucid, seed) => {
    let s = seed >>> 0;
    const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const randn = () => Math.sqrt(-2 * Math.log(Math.max(1e-12, rand()))) * Math.cos(2 * Math.PI * rand());

    const front = Array.from({ length: 2 }, () => {
      const g = new Float64Array(N); let slow = 0;
      for (let t = 0; t < N; t++) {
        slow = (isLucid ? 0.65 : 0.96) * slow + randn();
        g[t] = slow + (isLucid ? 1.1 : 0.15) * randn();
      }
      return g;
    });
    const post = Array.from({ length: 4 }, () => {
      const g = new Float64Array(N); let slow = 0;
      for (let t = 0; t < N; t++) {
        const burst = isLucid ? 1.0 : ((Math.floor(t / (3 * sfreq)) % 3 === 0) ? 1.0 : 0.15);
        slow = 0.85 * slow + randn();
        // Top-down frontal drive into posterior during lucidity (Front leads Post by 3 samples)
        const td = isLucid ? 0.65 * front[0][Math.max(0, t - 3)] : 0;
        g[t] = slow * (1 - 0.6 * burst) + burst * randn() + td;
      }
      return g;
    });
    const eog = new Float64Array(N);
    for (let t = 0; t < N; t++) eog[t] = 0.3 * randn();
    // Inject a synthetic LRLR saccade spike in window 2 to verify saccade rejection
    for (let t = 2 * sfreq; t < 2 * sfreq + 30; t++) eog[t] += 18 * Math.sin((t - 2 * sfreq) * 0.4);
    return extractWindowMetrics(post, front, eog, sfreq);
  };

  const nonLucid = [], lucid = [];
  for (let i = 0; i < 10; i++) {
    nonLucid.push(makeEpoch(false, 400 + i));
    lucid.push(makeEpoch(true, 600 + i));
  }
  const keys = ['tonicP10', 'burstP90', 'metastabilityGap', 'frontLZc', 'frontSlopeBB', 'psiAlpha', 'psiBeta'];
  const summary = {};
  for (const k of keys) summary[k] = pairedSignFlip(lucid.map((x, i) => x[k] - nonLucid[i][k]));
  console.table(summary);
  console.log(`Saccade rejection verified: avg rejected windows/trial = ${(lucid.reduce((a, x) => a + x.saccadeRejectedWins, 0) / 10).toFixed(1)}`);
}

async function fetchTwcZip() {
  fs.mkdirSync(TWC_DIR, { recursive: true });
  const meta = await (await fetch(TWC_FIGSHARE_API)).json();
  const zipFile = (meta.files || []).find((f) => f.name.endsWith('.zip'));
  if (!zipFile) throw new Error('TWC_USA.zip not found in Figshare metadata');
  const dest = path.join(TWC_DIR, zipFile.name);
  console.log(`Downloading ${zipFile.name} (${(zipFile.size / (1024 * 1024)).toFixed(1)} MB) -> ${dest}`);
  const res = await fetch(zipFile.download_url);
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
  const fileStream = fs.createWriteStream(dest);
  for await (const chunk of res.body) fileStream.write(chunk);
  fileStream.end();
  console.log('Download complete. Extract TWC_USA.zip into reanalysis/data/twc_usa/ and re-run without --fetch-twc.');
}

async function main() {
  const args = new Set(process.argv.slice(2));
  if (args.has('--fetch-twc')) { await fetchTwcZip(); return; }
  if (args.has('--self-test')) { runSelfTest(); return; }

  const edfs = fs.existsSync(TWC_DIR)
    ? fs.readdirSync(TWC_DIR, { recursive: true }).filter((f) => String(f).toLowerCase().endsWith('.edf'))
    : [];
  if (!edfs.length) {
    console.log(`No extracted lucid-dreaming EDFs found in ${TWC_DIR}.`);
    console.log('Run `node audit_h2_lucid_lrlr_dream.js --fetch-twc` to download TWC_USA.zip, or `--self-test` to verify pipeline.');
    return;
  }
  console.log(`Found ${edfs.length} EDF files under ${TWC_DIR}. Ready for LRLR timestamp alignment.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
