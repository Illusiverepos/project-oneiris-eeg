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
  let deltaP = 0, alphaP = 0, betaP = 0, totalP = 0;
  for (let k = 1; k < half; k++) {
    const f = k * df, p = psd[k] / Math.max(1, segs);
    if (f >= 1 && f <= 45) totalP += p * df;
    if (f >= 1 && f <= 4) deltaP += p * df;
    if (f >= 8 && f <= 12) alphaP += p * df;
    if (f >= 13 && f <= 25) betaP += p * df;
    if ((f >= 2 && f <= 7) || (f >= 14 && f <= 45)) { xs.push(Math.log10(f)); ys.push(Math.log10(p + 1e-24)); }
  }
  let mx = 0, my = 0; for (let i = 0; i < xs.length; i++) { mx += xs[i]; my += ys[i]; } mx /= xs.length; my /= xs.length;
  let num = 0, den = 0; for (let i = 0; i < xs.length; i++) { const dx = xs[i] - mx; num += dx * (ys[i] - my); den += dx * dx; }
  return {
    slopeBB: den > 0 ? num / den : 0,
    deltaFrac: deltaP / Math.max(1e-24, totalP),
    alphaFrac: alphaP / Math.max(1e-24, totalP),
    betaFrac: betaP / Math.max(1e-24, totalP),
    dfa: fastDFA(sig),
  };
}

/** Fast 2-second DFA alpha for real-time CEWR early-warning detection (Report 45) */
function fastDFA(sig) {
  const n = sig.length;
  let mean = 0; for (let i = 0; i < n; i++) mean += sig[i]; mean /= n;
  const y = new Float64Array(n); let cum = 0;
  for (let i = 0; i < n; i++) { cum += sig[i] - mean; y[i] = cum; }
  const scales = [10, 16, 25, 40, 64, 100].filter((s) => s * 4 <= n);
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
  return den > 0 ? num / den : 1.0;
}

// ======================== GOLDILOCKS CLOSED-LOOP CONTROLLER ========================

class GoldilocksCueController {
  constructor(opts = {}) {
    this.mode = opts.mode || 'tlr'; // 'tlr' (lucid dreaming) | 'irt-tmr' (Veteran-safe anti-startle IRT+TMR)
    this.sfreq = opts.sfreq || 200;
    this.minCueIntervalSec = opts.minCueIntervalSec || (this.mode === 'irt-tmr' ? 60 : 35);
    this.wakeLockoutSec = opts.wakeLockoutSec || (this.mode === 'irt-tmr' ? 120 : 90);
    this.warmupSec = opts.warmupSec || 60;

    // Rolling baseline stats (Welford-like sliding buffer of last 120 windows = 60 s)
    this.histPostSlp = [];
    this.histRFSlp = [];
    this.histDelta = [];
    this.histDFA = [];
    this.maxHist = 120;

    this.lastCueSec = -999;
    this.lockoutUntilSec = 0;
    this.cueGain = this.mode === 'irt-tmr' ? 0.15 : 0.25; // extra-gentle start for IRT+TMR
    this.cueCount = 0;
    this.lucidHoldSec = 0;
    this.antiStartleVetoes = 0;
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
    const dfaSt = this._stats(this.histDFA);
    const zPost = (pM.slopeBB - pSt.mean) / pSt.sd;
    const zRF = (rfM.slopeBB - rfSt.mean) / rfSt.sd;
    const zDFA = (pM.dfa - dfaSt.mean) / dfaSt.sd;

    // Update rolling baseline only when not contaminated by EOG artifact
    if (!eogArtifact) {
      this.histPostSlp.push(pM.slopeBB); if (this.histPostSlp.length > this.maxHist) this.histPostSlp.shift();
      this.histRFSlp.push(rfM.slopeBB);  if (this.histRFSlp.length > this.maxHist) this.histRFSlp.shift();
      this.histDelta.push(pM.deltaFrac); if (this.histDelta.length > this.maxHist) this.histDelta.shift();
      this.histDFA.push(pM.dfa);         if (this.histDFA.length > this.maxHist) this.histDFA.shift();
    }

    let state = 'WARMUP';
    let action = 'WAIT';

    if (tSec < this.warmupSec) {
      state = 'WARMUP';
    } else if (tSec < this.lockoutUntilSec) {
      state = 'WAKE_LOCKOUT';
    } else if (
      this.mode === 'irt-tmr'
        ? (pM.alphaFrac > 0.36 || rfM.betaFrac > 0.28 || zRF > 1.4)
        : (pM.alphaFrac > 0.42 && zRF > 1.8)
    ) {
      // Upper Goldilocks / R_tether anti-startle boundary breached -> back off & lower volume!
      state = 'WAKE_GUARD';
      action = 'ABORT_AND_LOCKOUT';
      this.lockoutUntilSec = tSec + this.wakeLockoutSec;
      this.cueGain = Math.max(0.08, this.cueGain * (this.mode === 'irt-tmr' ? 0.65 : 0.75));
      this.antiStartleVetoes++;
    } else if (eogArtifact) {
      state = 'EOG_SACCADE_SKIP';
    } else if (this.mode === 'irt-tmr' && (pM.deltaFrac > 0.45 || (pM.deltaFrac > 0.30 && zRF > 0.5))) {
      // PTSD Inverted-Switch NREM Guard: never cue during hyperaroused NREM right-frontal watchtower
      state = 'PTSD_NREM_WATCHTOWER_HOLD';
    } else if (pM.deltaFrac > 0.55) {
      // Stage 1 Gate closed (deep NREM slow-wave inhibition)
      state = 'NREM_GATE_CLOSED';
    } else if (zRF >= 0.65 && zRF <= 1.8 && zPost >= 0.0) {
      // Inside Right-Frontal inverted-U lucidity corridor! Do NOT disturb!
      state = 'LUCID_CORRIDOR';
      action = 'HOLD_SILENT';
      this.lucidHoldSec += 0.5;
    } else if (pM.deltaFrac <= 0.45 && (zPost >= -0.25 || zDFA <= -0.65) && zRF < 0.65) {
      // Prime REM / open-gate target OR CEWR DFA-alpha early-warning release (Report 45)
      state = zPost >= -0.25 ? 'REM_TARGET' : 'CEWR_DFA_EARLY_GATE';
      if (tSec - this.lastCueSec >= this.minCueIntervalSec) {
        action = this.mode === 'irt-tmr' ? 'FIRE_GENTLE_IRT_CHORD' : 'FIRE_TLR_CHIME';
        this.lastCueSec = tSec;
        this.cueCount++;
      }
    } else {
      state = 'SLEEP_TRANSITION';
    }

    return {
      tSec: Number(tSec.toFixed(1)),
      mode: this.mode,
      state, action,
      postSlope: Number(pM.slopeBB.toFixed(3)),
      rfSlope: Number(rfM.slopeBB.toFixed(3)),
      postDFA: Number(pM.dfa.toFixed(3)),
      zPost: Number(zPost.toFixed(2)),
      zRF: Number(zRF.toFixed(2)),
      zDFA: Number(zDFA.toFixed(2)),
      deltaFrac: Number(pM.deltaFrac.toFixed(2)),
      alphaFrac: Number(pM.alphaFrac.toFixed(2)),
      rfBetaFrac: Number(rfM.betaFrac.toFixed(2)),
      cueGain: Number(this.cueGain.toFixed(2)),
    };
  }
}

// ======================== REAL TWC_USA EDF REPLAY VERIFIER ========================

function replayEDF(edfPath, mode = 'tlr') {
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

  const ctrl = new GoldilocksCueController({ sfreq, mode, minCueIntervalSec: mode === 'irt-tmr' ? 60 : 40 });
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
    if (res.action === 'FIRE_TLR_CHIME' || res.action === 'FIRE_GENTLE_IRT_CHORD' || res.action === 'ABORT_AND_LOCKOUT') cueEvents.push(res);
  }

  console.log(`\n=== CLOSED-LOOP ENGINE REPLAY [${mode.toUpperCase()}]: ${path.basename(edfPath)} (${Math.round(N / sfreq)}s real human REM) ===`);
  console.log('State distribution (0.5s ticks):', stateCounts);
  console.log(`Total cues fired: ${ctrl.cueCount} | Anti-startle vetoes: ${ctrl.antiStartleVetoes} | Time held silent in LUCID_CORRIDOR: ${ctrl.lucidHoldSec.toFixed(1)}s`);
  console.table(cueEvents.slice(0, 12));
}

// ======================== LOCAL SERVER FOR LIVE WEB UI & EEG STREAM ========================

function serve(port = 8787) {
  const ctrl = new GoldilocksCueController({ sfreq: 200 });
  const htmlPath = path.join(__dirname, 'tlr_trainer.html');
  const labPath = path.join(__dirname, 'neurochemistry_dream_lab.html');
  const irtPath = path.join(__dirname, 'irt_tmr_prototype.html');
  const bridgePath = path.join(__dirname, 'dual_dream_bridge.html');
  let tickSec = 0;

  // Dual-Dream Bridge 20-minute Store-and-Forward "Dream Baton" Queue (Report 48)
  const bridgeState = {
    worldSeed: 'Quiet Pine Cabin by a Calm Lake',
    queueAtoB: [], // messages from Dreamer A waiting for Dreamer B's REM
    queueBtoA: [], // messages from Dreamer B waiting for Dreamer A's REM
    history: [],
    sleeperA: { state: 'IDLE', lastSeen: 0 },
    sleeperB: { state: 'IDLE', lastSeen: 0 },
  };
  const BATON_TTL_MS = 20 * 60 * 1000;

  const server = http.createServer((req, res) => {
    const urlObj = new URL(req.url, `http://127.0.0.1:${port}`);
    if (req.method === 'GET' && (urlObj.pathname === '/' || urlObj.pathname === '/index.html')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(htmlPath));
      return;
    }
    if (req.method === 'GET' && urlObj.pathname === '/lab') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(labPath));
      return;
    }
    if (req.method === 'GET' && urlObj.pathname === '/irt') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(irtPath));
      return;
    }
    if (req.method === 'GET' && urlObj.pathname === '/bridge') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(bridgePath));
      return;
    }
    if (req.method === 'GET' && urlObj.pathname === '/bridge/poll') {
      const role = urlObj.searchParams.get('role') || 'A';
      const state = urlObj.searchParams.get('state') || 'REM_TARGET';
      const now = Date.now();
      if (role === 'A') bridgeState.sleeperA = { state, lastSeen: now };
      else bridgeState.sleeperB = { state, lastSeen: now };
      // Expire stale batons (>20 min)
      bridgeState.queueAtoB = bridgeState.queueAtoB.filter((m) => now - m.ts <= BATON_TTL_MS);
      bridgeState.queueBtoA = bridgeState.queueBtoA.filter((m) => now - m.ts <= BATON_TTL_MS);
      // Deliver queued baton ONLY when recipient is in safe REM_TARGET
      let delivered = null;
      const q = role === 'B' ? bridgeState.queueAtoB : bridgeState.queueBtoA;
      if (state === 'REM_TARGET' && q.length > 0) {
        delivered = q.shift();
        bridgeState.history.unshift({ ...delivered, deliveredAt: now, deliveredTo: role });
        bridgeState.history = bridgeState.history.slice(0, 30);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        worldSeed: bridgeState.worldSeed,
        delivered,
        pendingAtoB: bridgeState.queueAtoB.length,
        pendingBtoA: bridgeState.queueBtoA.length,
        sleeperA: bridgeState.sleeperA,
        sleeperB: bridgeState.sleeperB,
        history: bridgeState.history.slice(0, 10),
      }));
      return;
    }
    if (req.method === 'POST' && urlObj.pathname === '/bridge/send') {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        try {
          const msg = JSON.parse(body);
          if (msg.worldSeed) bridgeState.worldSeed = String(msg.worldSeed).slice(0, 160);
          if (msg.symbol) {
            const item = { from: msg.from || 'A', symbol: msg.symbol, label: msg.label || msg.symbol, ts: Date.now() };
            if (item.from === 'A') bridgeState.queueAtoB.push(item);
            else bridgeState.queueBtoA.push(item);
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, pendingAtoB: bridgeState.queueAtoB.length, pendingBtoA: bridgeState.queueBtoA.length }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
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
  const modeIdx = args.indexOf('--mode');
  const mode = modeIdx >= 0 && args[modeIdx + 1] ? args[modeIdx + 1] : 'tlr';
  if (args[0] === '--replay' && args[1]) replayEDF(args[1], mode);
  else if (args[0] === '--serve') serve(parseInt(args[1] || '8787', 10));
  else {
    console.log('Usage:');
    console.log('  node closed_loop_engine.js --replay <path-to-edf> [--mode tlr|irt-tmr]');
    console.log('  node closed_loop_engine.js --serve [port]');
  }
}

module.exports = { GoldilocksCueController, windowMetrics };
