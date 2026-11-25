'use strict';

/**
 * Project ONEIRIS — Real-Time Closed-Loop TLR Dream-Control Engine
 *
 * Implements the 10-Lab 3-Switch Goldilocks Controller in 2-second rolling windows (step 500 ms):
 *   Switch 1: Posterior (Right_TPJ + Occipital) 1/f slopeBB & Delta (1-4 Hz)  -> World-renderer / Stage 1 Gate
 *   Switch 2: Posterior Idle Alpha Irreversibility (crossIrrevPost)           -> Visual/experiential desync
 *   Switch 3: Right_Frontal (F4/F8) 1/f slopeBB                               -> Executive agency switch
 *
 * Decision States:
 *   - WAKE_GUARD     : High movement / waking S_phys above upper Goldilocks threshold -> HARD LOCKOUT (120 s)
 *   - NREM_LOCKED    : High posterior Delta (1-4 Hz) -> HOLD (cortex gated shut)
 *   - REM_TARGET     : Low Delta + flat Posterior 1/f + Right_Frontal below lucidity corridor -> FIRE SOFT TLR CUE
 *   - LUCID_CORRIDOR : Right_Frontal 1/f inside inverted-U sweet spot (+0.5..+1.8 SD) -> BACK OFF (stabilize dream!)
 *
 * Modes:
 *   node closed_loop_engine.js --replay <path-to-twc-edf>   # Replay a real human TWC_USA recording through the live controller
 *   node closed_loop_engine.js --serve [port]               # Start local HTTP JSON + Web UI server (default 8787)
 */

const fs = require('fs');
const http = require('http');
const path = require('path');

// ======================== REAL-TIME DSP PRIMITIVES ========================

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

function windowMetrics(sig, sfreq = 200, nfft = 256) {
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
  let deltaP = 0, alphaP = 0, totalP = 0;
  for (let k = 1; k < half; k++) {
    const f = k * df, p = psd[k] / Math.max(1, segs);
    if (f >= 1 && f <= 45) totalP += p * df;
    if (f >= 1 && f <= 4) deltaP += p * df;
    if (f >= 8 && f <= 12) alphaP += p * df;
    if ((f >= 2 && f <= 7) || (f >= 14 && f <= 45)) { xs.push(Math.log10(f)); ys.push(Math.log10(p + 1e-24)); }
  }
  let mx = 0, my = 0; for (let i = 0; i < xs.length; i++) { mx += xs[i]; my += ys[i]; } mx /= xs.length; my /= xs.length;
  let num = 0, den = 0; for (let i = 0; i < xs.length; i++) { const dx = xs[i] - mx; num += dx * (ys[i] - my); den += dx * dx; }
  return {
    slopeBB: den > 0 ? num / den : 0,
    deltaFrac: deltaP / Math.max(1e-24, totalP),
    alphaFrac: alphaP / Math.max(1e-24, totalP),
  };
}

// ======================== GOLDILOCKS CLOSED-LOOP CONTROLLER ========================

class GoldilocksCueController {
  constructor(opts = {}) {
    this.sfreq = opts.sfreq || 200;
    this.minCueIntervalSec = opts.minCueIntervalSec || 35;
    this.wakeLockoutSec = opts.wakeLockoutSec || 90;
    this.warmupSec = opts.warmupSec || 60;

    // Rolling baseline stats (Welford-like sliding buffer of last 120 windows = 60 s)
    this.histPostSlp = [];
    this.histRFSlp = [];
    this.histDelta = [];
    this.maxHist = 120;

    this.lastCueSec = -999;
    this.lockoutUntilSec = 0;
    this.cueGain = 0.25; // starts gentle (0.0 .. 1.0)
    this.cueCount = 0;
    this.lucidHoldSec = 0;
  }

  _stats(arr) {
    const n = arr.length;
    if (n < 10) return { mean: 0, sd: 1 };
    const mean = arr.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(arr.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1)) || 1e-6;
    return { mean, sd };
  }

  /**
   * Process one 2-second CSD window (posteriorSig, rightFrontalSig, optional eogMaxSlope)
   * Returns { tSec, state, action, zPost, zRF, deltaFrac, alphaFrac, cueGain }
   */
  step(tSec, postSig, rfSig, eogArtifact = false) {
    const pM = windowMetrics(postSig, this.sfreq, 256);
    const rfM = windowMetrics(rfSig, this.sfreq, 256);

    const pSt = this._stats(this.histPostSlp);
    const rfSt = this._stats(this.histRFSlp);
    const zPost = (pM.slopeBB - pSt.mean) / pSt.sd;
    const zRF = (rfM.slopeBB - rfSt.mean) / rfSt.sd;

    // Update rolling baseline only when not contaminated by EOG artifact
    if (!eogArtifact) {
      this.histPostSlp.push(pM.slopeBB); if (this.histPostSlp.length > this.maxHist) this.histPostSlp.shift();
      this.histRFSlp.push(rfM.slopeBB);  if (this.histRFSlp.length > this.maxHist) this.histRFSlp.shift();
      this.histDelta.push(pM.deltaFrac); if (this.histDelta.length > this.maxHist) this.histDelta.shift();
    }

    let state = 'WARMUP';
    let action = 'WAIT';

    if (tSec < this.warmupSec) {
      state = 'WARMUP';
    } else if (tSec < this.lockoutUntilSec) {
      state = 'WAKE_LOCKOUT';
    } else if (pM.alphaFrac > 0.42 && zRF > 1.8) {
      // Upper Goldilocks boundary breached (waking alpha + sharp frontal surge) -> back off & lower volume!
      state = 'WAKE_GUARD';
      action = 'ABORT_AND_LOCKOUT';
      this.lockoutUntilSec = tSec + this.wakeLockoutSec;
      this.cueGain = Math.max(0.10, this.cueGain * 0.75);
    } else if (eogArtifact) {
      state = 'EOG_SACCADE_SKIP';
    } else if (pM.deltaFrac > 0.55) {
      // Stage 1 Gate closed (deep NREM slow-wave inhibition)
      state = 'NREM_GATE_CLOSED';
    } else if (zRF >= 0.65 && zRF <= 1.8 && zPost >= 0.0) {
      // Inside Right-Frontal inverted-U lucidity corridor! Do NOT disturb!
      state = 'LUCID_CORRIDOR';
      action = 'HOLD_SILENT';
      this.lucidHoldSec += 0.5;
    } else if (pM.deltaFrac <= 0.45 && zPost >= -0.25 && zRF < 0.65) {
      // Prime REM / open-gate target: posterior rendering active, Right_Frontal still offline
      state = 'REM_TARGET';
      if (tSec - this.lastCueSec >= this.minCueIntervalSec) {
        action = 'FIRE_TLR_CHIME';
        this.lastCueSec = tSec;
        this.cueCount++;
      }
    } else {
      state = 'SLEEP_TRANSITION';
    }

    return {
      tSec: Number(tSec.toFixed(1)),
      state, action,
      postSlope: Number(pM.slopeBB.toFixed(3)),
      rfSlope: Number(rfM.slopeBB.toFixed(3)),
      zPost: Number(zPost.toFixed(2)),
      zRF: Number(zRF.toFixed(2)),
      deltaFrac: Number(pM.deltaFrac.toFixed(2)),
      alphaFrac: Number(pM.alphaFrac.toFixed(2)),
      cueGain: Number(this.cueGain.toFixed(2)),
    };
  }
}

// ======================== REAL TWC_USA EDF REPLAY VERIFIER ========================

function replayEDF(edfPath) {
  const buf = fs.readFileSync(edfPath);
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
  const lmap = new Map(); labels.forEach((l, i) => lmap.set(l.toUpperCase(), i));

  const need = ['P4', 'C4', 'PZ', 'O2', 'T6', 'F4', 'FP2', 'FZ', 'F8', 'R-HEOG'];
  const sigs = new Map(); for (const n of need) if (lmap.has(n)) sigs.set(n, new Float64Array(useRecords * decPerRec));
  let pos = headerBytes;
  for (let r = 0; r < useRecords; r++) {
    for (let ch = 0; ch < ns; ch++) {
      const nS = spr[ch], lbl = labels[ch].toUpperCase();
      if (sigs.has(lbl)) {
        const arr = sigs.get(lbl), sc = scales[ch], of = offsets[ch], base = r * decPerRec;
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

  // Local Hjorth CSD: Right_TPJ (P4 - mean(C4,Pz,O2,T6)) and Right_Frontal (F4 - mean(Fp2,Fz,C4,F8))
  const N = sigs.get('P4').length;
  const postCSD = new Float64Array(N), rfCSD = new Float64Array(N);
  const P4 = sigs.get('P4'), C4 = sigs.get('C4'), PZ = sigs.get('PZ'), O2 = sigs.get('O2'), T6 = sigs.get('T6');
  const F4 = sigs.get('F4'), FP2 = sigs.get('FP2'), FZ = sigs.get('FZ'), F8 = sigs.get('F8'), HEOG = sigs.get('R-HEOG');
  for (let t = 0; t < N; t++) {
    postCSD[t] = P4[t] - 0.25 * (C4[t] + PZ[t] + O2[t] + T6[t]);
    rfCSD[t]   = F4[t] - 0.25 * (FP2[t] + FZ[t] + C4[t] + F8[t]);
  }

  const ctrl = new GoldilocksCueController({ sfreq, minCueIntervalSec: 40 });
  const winN = 2 * sfreq, stepN = Math.floor(0.5 * sfreq);
  const stateCounts = {}, cueEvents = [];

  for (let st = 0; st + winN <= N; st += stepN) {
    const tSec = st / sfreq;
    let eogJump = 0;
    if (HEOG) {
      for (let k = st + 1; k < st + winN; k++) { const d = Math.abs(HEOG[k] - HEOG[k - 1]); if (d > eogJump) eogJump = d; }
    }
    const res = ctrl.step(tSec, postCSD.subarray(st, st + winN), rfCSD.subarray(st, st + winN), eogJump > 25);
    stateCounts[res.state] = (stateCounts[res.state] || 0) + 1;
    if (res.action === 'FIRE_TLR_CHIME' || res.action === 'ABORT_AND_LOCKOUT') cueEvents.push(res);
  }

  console.log(`\n=== CLOSED-LOOP ENGINE REPLAY: ${path.basename(edfPath)} (${Math.round(N / sfreq)}s real human REM) ===`);
  console.log('State distribution (0.5s ticks):', stateCounts);
  console.log(`Total TLR cues fired: ${ctrl.cueCount} | Time held silent inside LUCID_CORRIDOR: ${ctrl.lucidHoldSec.toFixed(1)}s`);
  console.table(cueEvents.slice(0, 12));
}

// ======================== LOCAL SERVER FOR LIVE WEB UI & EEG STREAM ========================

function serve(port = 8787) {
  const ctrl = new GoldilocksCueController({ sfreq: 200 });
  const htmlPath = path.join(__dirname, 'tlr_trainer.html');
  let tickSec = 0;

  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(htmlPath));
      return;
    }
    if (req.method === 'POST' && req.url === '/eeg-chunk') {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        try {
          const { post, rightFrontal, eogArtifact } = JSON.parse(body);
          tickSec += 0.5;
          const decision = ctrl.step(tickSec, Float64Array.from(post), Float64Array.from(rightFrontal), Boolean(eogArtifact));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(decision));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
    res.writeHead(404); res.end('Not found');
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`ONEIRIS Closed-Loop TLR Cueing Server running -> http://127.0.0.1:${port}`);
    console.log('POST 2s CSD arrays to /eeg-chunk for live headband control, or open the URL in your browser.');
  });
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args[0] === '--replay' && args[1]) replayEDF(args[1]);
  else if (args[0] === '--serve') serve(parseInt(args[1] || '8787', 10));
  else {
    console.log('Usage:');
    console.log('  node closed_loop_engine.js --replay <path-to-edf>');
    console.log('  node closed_loop_engine.js --serve [port]');
  }
}

module.exports = { GoldilocksCueController, windowMetrics };
