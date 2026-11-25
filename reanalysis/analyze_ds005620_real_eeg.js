'use strict';

/**
 * Project ONEIRIS — Live Real Human EEG Analysis on OpenNeuro ds005620
 * (Bajwa et al., Propofol Repeated Awakening 65-Channel HD-EEG, 5000 Hz)
 *
 * Pure zero-dependency DSP in Node.js:
 *   - Reads raw IEEE_FLOAT_32 multiplexed 65-channel BrainVision slices (10 s @ 5000 Hz)
 *   - Decimates with 25-sample boxcar anti-aliasing -> 200 Hz (Nyquist = 100 Hz)
 *   - Applies common-average reference across all 62 cortical EEG channels (excluding VEOG/HEOG/EMG)
 *   - Computes Hann-windowed Welch PSD (2.56 s = 512-sample Radix-2 FFT, 50% overlap)
 *   - Extracts Posterior Hot-Zone (O1/O2/Oz/PO3/PO4/POz/P3/P4/Pz) vs Frontal (F3/F4/Fz/AF3/AF4/AFz)
 *     band powers: Delta (1-4 Hz), Theta (4-8 Hz), Alpha (8-12 Hz), Beta (13-25 Hz), Gamma (25-45 Hz)
 *   - Computes Posterior log10(Gamma/Delta) (Siclari hot-zone index), Alpha Anteriorization Ratio
 *     (Frontal Alpha / Posterior Alpha), and Posterior vs Frontal Multichannel Lempel-Ziv Complexity (mLZc).
 */

const fs = require('fs');
const path = require('path');

const SLICE_DIR = path.join(__dirname, 'data', 'ds005620', 'slices');
const OUT_PATH = path.join(__dirname, 'data', 'ds005620', 'ds005620_real_eeg_results.json');
const SUBJECTS = ['sub-1010', 'sub-1016', 'sub-1022', 'sub-1024', 'sub-1033'];

const N_CH = 65;
const N_CORTICAL = 62; // channels 0..61 (excludes 62=VEOG, 63=HEOG, 64=EMG)
const SFREQ_RAW = 5000;
const DECIM = 25;
const SFREQ = SFREQ_RAW / DECIM; // 200 Hz

// 0-based channel indices from sub-1010_channels.tsv
const POSTERIOR_IDX = [1, 2, 3, 5, 6, 7, 11, 13, 15]; // O2, Oz, O1, PO4, POz, PO3, P4, Pz, P3
const FRONTAL_IDX = [49, 51, 53, 56, 57, 58];         // F4, Fz, F3, AF4, AFz, AF3

/** In-place iterative Radix-2 Cooley-Tukey FFT */
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wlenRe = Math.cos(ang), wlenIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let wRe = 1, wIm = 0;
      for (let j = 0; j < len / 2; j++) {
        const uRe = re[i + j], uIm = im[i + j];
        const vRe = re[i + j + len / 2] * wRe - im[i + j + len / 2] * wIm;
        const vIm = re[i + j + len / 2] * wIm + im[i + j + len / 2] * wRe;
        re[i + j] = uRe + vRe;
        im[i + j] = uIm + vIm;
        re[i + j + len / 2] = uRe - vRe;
        im[i + j + len / 2] = uIm - vIm;
        const nextWRe = wRe * wlenRe - wIm * wlenIm;
        wIm = wRe * wlenIm + wIm * wlenRe;
        wRe = nextWRe;
      }
    }
  }
}

function welchPSD(signal, sfreq = SFREQ, nfft = 512) {
  const step = nfft / 2;
  const psd = new Float64Array(nfft / 2 + 1);
  const win = new Float64Array(nfft);
  let winPower = 0;
  for (let i = 0; i < nfft; i++) {
    win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (nfft - 1)));
    winPower += win[i] * win[i];
  }
  let segs = 0;
  for (let start = 0; start + nfft <= signal.length; start += step) {
    let mean = 0;
    for (let i = 0; i < nfft; i++) mean += signal[start + i];
    mean /= nfft;

    const re = new Float64Array(nfft);
    const im = new Float64Array(nfft);
    for (let i = 0; i < nfft; i++) re[i] = (signal[start + i] - mean) * win[i];
    fft(re, im);

    for (let k = 0; k <= nfft / 2; k++) {
      psd[k] += (re[k] * re[k] + im[k] * im[k]) / (sfreq * winPower);
    }
    segs++;
  }
  for (let k = 0; k < psd.length; k++) psd[k] /= Math.max(1, segs);
  return psd;
}

function bandPower(psd, fLo, fHi, sfreq = SFREQ, nfft = 512) {
  const df = sfreq / nfft;
  let sum = 0, cnt = 0;
  for (let k = 0; k < psd.length; k++) {
    const f = k * df;
    if (f >= fLo && f <= fHi) { sum += psd[k]; cnt++; }
  }
  return cnt ? sum / cnt : 0;
}

/** Normalized LZ76 complexity on binary string */
function lz76Normalized(binStr) {
  const n = binStr.length;
  if (n <= 1) return 0;
  let i = 0, k = 1, l = 1, c = 1, kMax = 1;
  while (true) {
    if (binStr.charCodeAt(i + k - 1) === binStr.charCodeAt(l + k - 1)) {
      k++;
      if (l + k > n) { c++; break; }
    } else {
      if (k > kMax) kMax = k;
      i++;
      if (i === l) {
        c++;
        l += kMax;
        if (l + 1 > n) break;
        i = 0; k = 1; kMax = 1;
      } else {
        k = 1;
      }
    }
  }
  return (c * Math.log2(n)) / n;
}

function computeMultichannelMLZc(roiSignals) {
  // Demean & binarize each channel around its median, subsample to 100 Hz (every 2nd sample), interleave
  const nCh = roiSignals.length;
  const nT = Math.min(800, Math.floor(roiSignals[0].length / 2)); // 8s @ 100 Hz
  const bins = roiSignals.map((sig) => {
    const sub = new Float64Array(nT);
    for (let t = 0; t < nT; t++) sub[t] = sig[t * 2];
    const sorted = Float64Array.from(sub).sort();
    const med = sorted[Math.floor(nT / 2)];
    return { sub, med };
  });
  let bits = '';
  for (let t = 0; t < nT; t++) {
    for (let c = 0; c < nCh; c++) bits += bins[c].sub[t] > bins[c].med ? '1' : '0';
  }
  return lz76Normalized(bits);
}

function loadAndDecimate(binPath) {
  const buf = fs.readFileSync(binPath);
  const f32 = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
  const rawSamples = Math.floor(f32.length / N_CH);
  const nDec = Math.floor(rawSamples / DECIM);

  const chData = Array.from({ length: N_CORTICAL }, () => new Float64Array(nDec));
  for (let t = 0; t < nDec; t++) {
    const baseRaw = t * DECIM;
    // Boxcar average over DECIM samples + common average reference across 62 cortical channels
    let carSum = 0;
    const vals = new Float64Array(N_CORTICAL);
    for (let c = 0; c < N_CORTICAL; c++) {
      let s = 0;
      for (let d = 0; d < DECIM; d++) s += f32[(baseRaw + d) * N_CH + c];
      vals[c] = s / DECIM;
      carSum += vals[c];
    }
    const car = carSum / N_CORTICAL;
    for (let c = 0; c < N_CORTICAL; c++) chData[c][t] = vals[c] - car;
  }
  return chData;
}

function analyzeFile(binPath) {
  const chData = loadAndDecimate(binPath);

  const avgRoiBands = (indices) => {
    let d = 0, th = 0, a = 0, b = 0, g = 0;
    for (const idx of indices) {
      const psd = welchPSD(chData[idx]);
      d += bandPower(psd, 1, 4);
      th += bandPower(psd, 4, 8);
      a += bandPower(psd, 8, 12);
      b += bandPower(psd, 13, 25);
      g += bandPower(psd, 25, 45);
    }
    const k = indices.length;
    return { delta: d / k, theta: th / k, alpha: a / k, beta: b / k, gamma: g / k };
  };

  const post = avgRoiBands(POSTERIOR_IDX);
  const front = avgRoiBands(FRONTAL_IDX);

  const postMLZc = computeMultichannelMLZc(POSTERIOR_IDX.map((i) => chData[i]));
  const frontMLZc = computeMultichannelMLZc(FRONTAL_IDX.map((i) => chData[i]));

  return {
    postLogGammaDelta: Number(Math.log10((post.gamma + 1e-18) / (post.delta + 1e-18)).toFixed(3)),
    frontLogGammaDelta: Number(Math.log10((front.gamma + 1e-18) / (front.delta + 1e-18)).toFixed(3)),
    alphaAnteriorizationRatio: Number(((front.alpha + 1e-18) / (post.alpha + 1e-18)).toFixed(3)),
    postAlphaPower: Number(post.alpha.toFixed(4)),
    frontAlphaPower: Number(front.alpha.toFixed(4)),
    postDeltaPower: Number(post.delta.toFixed(4)),
    postMLZc: Number(postMLZc.toFixed(4)),
    frontMLZc: Number(frontMLZc.toFixed(4)),
  };
}

function main() {
  const rows = [];
  for (const sub of SUBJECTS) {
    const awakePath = path.join(SLICE_DIR, `${sub}_awake_EC_10s.bin`);
    const sedPath = path.join(SLICE_DIR, `${sub}_sed2_run1_10s.bin`);
    if (!fs.existsSync(awakePath) || !fs.existsSync(sedPath)) continue;

    const awake = analyzeFile(awakePath);
    const sed = analyzeFile(sedPath);
    rows.push({
      subject: sub,
      awake_postGammaDelta: awake.postLogGammaDelta,
      sed_postGammaDelta: sed.postLogGammaDelta,
      delta_postGammaDelta: Number((sed.postLogGammaDelta - awake.postLogGammaDelta).toFixed(3)),
      awake_alphaAnt: awake.alphaAnteriorizationRatio,
      sed_alphaAnt: sed.alphaAnteriorizationRatio,
      awake_postMLZc: awake.postMLZc,
      sed_postMLZc: sed.postMLZc,
      delta_postMLZc: Number((sed.postMLZc - awake.postMLZc).toFixed(4)),
      awake_frontMLZc: awake.frontMLZc,
      sed_frontMLZc: sed.frontMLZc,
    });
  }

  const mean = (arr) => Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(4));
  const summary = {
    dataset: 'OpenNeuro ds005620 (Bajwa et al., Real 65-Channel Human HD-EEG)',
    nSubjects: rows.length,
    meanAwakePostGammaDelta: mean(rows.map((r) => r.awake_postGammaDelta)),
    meanSedPostGammaDelta: mean(rows.map((r) => r.sed_postGammaDelta)),
    meanAwakeAlphaAnteriorization: mean(rows.map((r) => r.awake_alphaAnt)),
    meanSedAlphaAnteriorization: mean(rows.map((r) => r.sed_alphaAnt)),
    meanAwakePostMLZc: mean(rows.map((r) => r.awake_postMLZc)),
    meanSedPostMLZc: mean(rows.map((r) => r.sed_postMLZc)),
    subjects: rows,
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(summary, null, 2), 'utf8');
  console.log('=== OpenNeuro ds005620 Live Real Human 65-ch EEG Results ===');
  console.table(rows);
  console.log('\nGroup Means:', {
    postGammaDelta: `${summary.meanAwakePostGammaDelta} (Awake) -> ${summary.meanSedPostGammaDelta} (Propofol Pre-Awakening)`,
    alphaAnteriorization: `${summary.meanAwakeAlphaAnteriorization} (Awake) -> ${summary.meanSedAlphaAnteriorization} (Propofol)`,
    postMLZc: `${summary.meanAwakePostMLZc} (Awake) -> ${summary.meanSedPostMLZc} (Propofol)`,
  });
}

main();
