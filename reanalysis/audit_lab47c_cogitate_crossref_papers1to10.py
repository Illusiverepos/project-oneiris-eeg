#!/usr/bin/env python3
"""
Project ONEIRIS — Lab #47c: Deep Cross-Reference of COGITATE (2025) Intracranial ECoG
Against Papers 1–10:
  1. Per-Patient Noether Geodesic Conservation (IIT Posterior slides ALONG geodesic while
     GNWT Prefrontal breaks Δ_WK symmetry on conscious stimulus ignition!)
  2. Direct Comparison Against COGITATE's Own High-Gamma (70–150 Hz) Band Power:
     Is ONEIRIS brainNonlin redundant with High-Gamma or an orthogonal physical axis?
  3. Simultaneous Trial-by-Trial GNWT Prefrontal <-> IIT Posterior brainNonlin Coupling
  4. Left (ctx-lh) vs. Right (ctx-rh) Hemispheric Intracranial Asymmetry (Paper 2 / Lab #43)

Output: reanalysis/data/lab47c_cogitate_crossref_papers1to10_results.json
"""

import os
import re
import json
import math
import zipfile
import numpy as np

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ZIP_PATH = os.path.join(
    REPO, 'reanalysis', 'data', 'cogitate',
    '20231231_cog_exp1_bids_ecog_sample_8f047505-39e9-4dea-828d-bbd17909ce96.zip'
)
OUT_PATH = os.path.join(REPO, 'reanalysis', 'data', 'lab47c_cogitate_crossref_papers1to10_results.json')

GNWT_KEYS = (
    'rostralmiddlefrontal', 'caudalmiddlefrontal', 'superiorfrontal',
    'parsopercularis', 'parstriangularis', 'parsorbitalis',
    'lateralorbitofrontal', 'medialorbitofrontal', 'frontalpole',
)
IIT_KEYS = (
    'lateraloccipital', 'fusiform', 'inferiortemporal', 'lingual',
    'pericalcarine', 'cuneus', 'inferiorparietal', 'superiorparietal',
    'precuneus', 'supramarginal',
)


def parse_vhdr(txt):
    n_ch = int(re.search(r'NumberOfChannels=(\d+)', txt).group(1))
    si_us = float(re.search(r'SamplingInterval=([\d.]+)', txt).group(1))
    sfreq = 1e6 / si_us
    ch_names = [''] * n_ch
    for m in re.finditer(r'^Ch(\d+)=([^,\r\n]+)', txt, re.M):
        ch_names[int(m.group(1)) - 1] = m.group(2).strip()
    return n_ch, sfreq, ch_names


def batch_metrics_and_hga(X_512hz, sfreq_512, nfft=256):
    """
    Input: X_512hz shape (M, N) at 512 Hz (so Nyquist=256 Hz -> clean High-Gamma 70-150 Hz!).
    Returns: slopeBB (2-40 Hz), dfa, realWK, hga_log10 (70-150 Hz).
    """
    M, N = X_512hz.shape
    step = nfft // 2
    win = 0.5 * (1.0 - np.cos(2.0 * np.pi * np.arange(nfft) / (nfft - 1)))
    psd = np.zeros((M, nfft // 2 + 1), dtype=np.float64)
    segs = 0
    for st in range(0, N - nfft + 1, step):
        seg = X_512hz[:, st:st + nfft]
        seg = (seg - seg.mean(axis=1, keepdims=True)) * win
        F = np.fft.rfft(seg, axis=1)
        psd += (F.real * F.real + F.imag * F.imag)
        segs += 1
    psd /= max(1, segs)
    freqs = np.fft.rfftfreq(nfft, d=1.0 / sfreq_512)

    # 1. High-Gamma (70-150 Hz, excluding 58-62 / 118-122 line noise)
    hga_mask = (freqs >= 70.0) & (freqs <= 150.0) & ~((freqs >= 117.0) & (freqs <= 123.0))
    hga = np.log10(psd[:, hga_mask].mean(axis=1) + 1e-18)

    # 2. Downsample 2x -> 256 Hz for exact SDK slopeBB (2-40 Hz) and DFA
    X256 = X_512hz[:, :(N // 2) * 2].reshape(M, N // 2, 2).mean(axis=2)
    N256 = X256.shape[1]
    nfft2 = min(128, N256)
    step2 = nfft2 // 2
    win2 = 0.5 * (1.0 - np.cos(2.0 * np.pi * np.arange(nfft2) / (nfft2 - 1)))
    psd2 = np.zeros((M, nfft2 // 2 + 1), dtype=np.float64)
    segs2 = 0
    for st in range(0, N256 - nfft2 + 1, step2):
        seg = X256[:, st:st + nfft2]
        seg = (seg - seg.mean(axis=1, keepdims=True)) * win2
        F = np.fft.rfft(seg, axis=1)
        psd2 += (F.real * F.real + F.imag * F.imag)
        segs2 += 1
    psd2 /= max(1, segs2)
    f2 = np.fft.rfftfreq(nfft2, d=1.0 / (sfreq_512 / 2.0))
    m_bb = (f2 >= 2.0) & (f2 <= 40.0)
    xf = np.log10(f2[m_bb])
    yf = np.log10(psd2[:, m_bb] + 1e-18)
    xf_c = xf - xf.mean()
    slopes = (yf @ xf_c) / np.sum(xf_c * xf_c)

    y = np.cumsum(X256 - X256.mean(axis=1, keepdims=True), axis=1)
    scales = [sc for sc in (8, 12, 16, 24, 32, 48, 64) if sc * 4 <= N256]
    lx = np.log10(np.array(scales, dtype=np.float64))
    ly = np.empty((M, len(scales)), dtype=np.float64)
    for si, sc in enumerate(scales):
        n_seg = N256 // sc
        segs_y = y[:, :n_seg * sc].reshape(M, n_seg, sc)
        t = np.arange(sc, dtype=np.float64)
        tm = 0.5 * (sc - 1)
        dt = t - tm
        den = np.sum(dt * dt)
        ym = segs_y.mean(axis=2, keepdims=True)
        b = np.sum((segs_y - ym) * dt, axis=2, keepdims=True) / den
        a = ym - b * tm
        resid = segs_y - (a + b * t)
        ly[:, si] = np.log10(np.sqrt(np.mean(resid * resid, axis=(1, 2)) + 1e-24))
    lx_c = lx - lx.mean()
    dfas = (ly @ lx_c) / np.sum(lx_c * lx_c)
    wk = slopes + (2.0 * dfas - 1.0)
    return slopes, dfas, wk, hga


def batch_phase_rand(X, rng):
    M, N = X.shape
    xm = X.mean(axis=1, keepdims=True)
    F = np.fft.rfft(X - xm, axis=1)
    mags = np.abs(F)
    phases = rng.uniform(0.0, 2.0 * np.pi, size=F.shape)
    phases[:, 0] = 0.0
    if N % 2 == 0:
        phases[:, -1] = 0.0
    return np.fft.irfft(mags * np.exp(1j * phases), n=N, axis=1) + xm


def paired_perm(a, b, seed=4780, n_perm=10000):
    diff = np.asarray(a, dtype=np.float64) - np.asarray(b, dtype=np.float64)
    n = len(diff)
    m = float(diff.mean())
    sd = float(diff.std(ddof=1)) if n > 1 else 1e-9
    t_stat = m / (sd / math.sqrt(n)) if sd > 0 else 0.0
    rng = np.random.default_rng(seed)
    signs = rng.choice([-1.0, 1.0], size=(n_perm, n))
    p = float((np.sum(np.abs(signs @ diff) / n >= abs(m) - 1e-12) + 1) / (n_perm + 1))
    return {'n': n, 'mA': round(float(np.mean(a)), 4), 'mB': round(float(np.mean(b)), 4), 'dz': round(m / sd, 3), 't': round(t_stat, 3), 'p': round(p, 5)}


def corr_perm(x, y, seed=4790, n_perm=10000):
    x = np.asarray(x, dtype=np.float64)
    y = np.asarray(y, dtype=np.float64)
    r = float(np.corrcoef(x, y)[0, 1])
    rng = np.random.default_rng(seed)
    yc = y.copy()
    ge = 0
    for _ in range(n_perm):
        rng.shuffle(yc)
        if abs(float(np.corrcoef(x, yc)[0, 1])) >= abs(r) - 1e-12:
            ge += 1
    return {'n': len(x), 'r': round(r, 4), 'p': round((ge + 1) / (n_perm + 1), 5)}


def main():
    print('=== Lab #47c: Deep Cross-Reference of COGITATE Intracranial ECoG vs. Papers 1–10 ===')
    z = zipfile.ZipFile(ZIP_PATH, 'r')
    eeg_infos = sorted([i for i in z.infolist() if i.filename.endswith('_ieeg.eeg')], key=lambda x: x.filename)

    per_patient = []
    all_g_on_nl, all_g_off_nl, all_g_on_wk, all_g_off_wk, all_g_on_hga, all_g_off_hga = [], [], [], [], [], []
    all_i_on_nl, all_i_off_nl, all_i_on_wk, all_i_off_wk, all_i_on_hga, all_i_off_hga = [], [], [], [], [], []
    all_g_trial_nl, all_i_trial_nl = [], []
    hemi_counts = {}

    for p_idx, eeg_info in enumerate(eeg_infos):
        prefix = eeg_info.filename.replace('_ieeg.eeg', '')
        sub = eeg_info.filename.split('/')[-4]
        vhdr_txt = z.read(prefix + '_ieeg.vhdr').decode('utf-8', 'ignore')
        n_ch, raw_sfreq, ch_names = parse_vhdr(vhdr_txt)
        decim512 = max(1, int(round(raw_sfreq / 512.0)))
        sfreq512 = raw_sfreq / decim512
        total_samples = eeg_info.file_size // (n_ch * 4)

        ch_tsv = z.read(prefix + '_channels.tsv').decode('utf-8', 'ignore').splitlines()
        bad_set = {ln.split('\t')[0].strip() for ln in ch_tsv[1:] if 'bad' in [c.strip().lower() for c in ln.split('\t')]}

        des_name = prefix.replace('_task-Dur', '') + '_atlas-desikan_labels.tsv'
        roi_map, hemi_map = {}, {}
        for ln in z.read(des_name).decode('utf-8', 'ignore').splitlines()[1:]:
            parts = ln.split('\t')
            if len(parts) < 2 or parts[0].strip() in bad_set:
                continue
            ch, reg = parts[0].strip(), parts[1].lower()
            if 'ctx-lh-' in reg:
                hemi_map[ch] = 'L'
            elif 'ctx-rh-' in reg:
                hemi_map[ch] = 'R'
            if any(k in reg for k in GNWT_KEYS):
                roi_map[ch] = 'GNWT'
            elif any(k in reg for k in IIT_KEYS):
                roi_map[ch] = 'IIT'

        gnwt_idx = np.array([i for i, c in enumerate(ch_names) if roi_map.get(c) == 'GNWT'], dtype=np.int32)
        iit_idx = np.array([i for i, c in enumerate(ch_names) if roi_map.get(c) == 'IIT'], dtype=np.int32)
        all_roi_idx = np.concatenate([gnwt_idx, iit_idx])
        n_g = len(gnwt_idx)
        hemi_counts[sub] = {
            'GNWT_L': sum(1 for i in gnwt_idx if hemi_map.get(ch_names[i]) == 'L'),
            'GNWT_R': sum(1 for i in gnwt_idx if hemi_map.get(ch_names[i]) == 'R'),
            'IIT_L': sum(1 for i in iit_idx if hemi_map.get(ch_names[i]) == 'L'),
            'IIT_R': sum(1 for i in iit_idx if hemi_map.get(ch_names[i]) == 'R'),
        }

        ev_lines = z.read(prefix + '_events.tsv').decode('utf-8', 'ignore').splitlines()[1:]
        trials_500 = []
        for ln in ev_lines:
            cols = ln.split('\t')
            if len(cols) >= 5 and cols[2].startswith('stimulus onset/') and '/500ms/' in cols[2]:
                samp = int(float(cols[4]))
                if samp >= int(0.5 * raw_sfreq) and samp + int(2.1 * raw_sfreq) < total_samples:
                    trials_500.append(samp)

        step = max(1, len(trials_500) // 60)
        chosen = trials_500[::step][:60]
        ep_raw_n = 1024 * decim512  # 2.0s @ 512 Hz
        rng = np.random.default_rng(47900 + p_idx)

        g_on_nl, g_off_nl, g_on_wk, g_off_wk, g_on_hga, g_off_hga = [], [], [], [], [], []
        i_on_nl, i_off_nl, i_on_wk, i_off_wk, i_on_hga, i_off_hga = [], [], [], [], [], []

        with z.open(eeg_info, 'r') as f:
            for samp in chosen:
                f.seek(samp * n_ch * 4)
                raw = np.frombuffer(f.read(ep_raw_n * n_ch * 4), dtype='<f4').reshape(1024, decim512, n_ch)
                X = raw[:, :, all_roi_idx].mean(axis=1).T.astype(np.float64)  # (n_roi, 1024)
                X_on, X_off = X[:, :512], X[:, 512:1024]

                _, _, rwk_on, hga_on = batch_metrics_and_hga(X_on, sfreq512)
                _, _, rwk_off, hga_off = batch_metrics_and_hga(X_off, sfreq512)
                _, _, swk_on, _ = batch_metrics_and_hga(batch_phase_rand(X_on, rng), sfreq512)
                _, _, swk_off, _ = batch_metrics_and_hga(batch_phase_rand(X_off, rng), sfreq512)
                nl_on, nl_off = rwk_on - swk_on, rwk_off - swk_off

                g_on_nl.append(float(nl_on[:n_g].mean())); g_off_nl.append(float(nl_off[:n_g].mean()))
                g_on_wk.append(float(rwk_on[:n_g].mean())); g_off_wk.append(float(rwk_off[:n_g].mean()))
                g_on_hga.append(float(hga_on[:n_g].mean())); g_off_hga.append(float(hga_off[:n_g].mean()))

                i_on_nl.append(float(nl_on[n_g:].mean())); i_off_nl.append(float(nl_off[n_g:].mean()))
                i_on_wk.append(float(rwk_on[n_g:].mean())); i_off_wk.append(float(rwk_off[n_g:].mean()))
                i_on_hga.append(float(hga_on[n_g:].mean())); i_off_hga.append(float(hga_off[n_g:].mean()))

        all_g_on_nl.extend(g_on_nl); all_g_off_nl.extend(g_off_nl)
        all_g_on_wk.extend(g_on_wk); all_g_off_wk.extend(g_off_wk)
        all_g_on_hga.extend(g_on_hga); all_g_off_hga.extend(g_off_hga)
        all_i_on_nl.extend(i_on_nl); all_i_off_nl.extend(i_off_nl)
        all_i_on_wk.extend(i_on_wk); all_i_off_wk.extend(i_off_wk)
        all_i_on_hga.extend(i_on_hga); all_i_off_hga.extend(i_off_hga)
        all_g_trial_nl.extend(g_on_nl); all_i_trial_nl.extend(i_on_nl)

        p_rec = {
            'sub': sub, 'nTrials': len(chosen), 'hemi': hemi_counts[sub],
            'GNWT_nonlin_ON_vs_OFF': paired_perm(g_on_nl, g_off_nl, 4701 + p_idx),
            'IIT_nonlin_ON_vs_OFF': paired_perm(i_on_nl, i_off_nl, 4711 + p_idx),
            'GNWT_WK_ON_vs_OFF': paired_perm(g_on_wk, g_off_wk, 4721 + p_idx),
            'IIT_WK_ON_vs_OFF': paired_perm(i_on_wk, i_off_wk, 4731 + p_idx),
            'GNWT_HGA_ON_vs_OFF': paired_perm(g_on_hga, g_off_hga, 4741 + p_idx),
            'IIT_HGA_ON_vs_OFF': paired_perm(i_on_hga, i_off_hga, 4751 + p_idx),
            'WithinPatient_GNWT_vs_IIT_nonlin_r': corr_perm(g_on_nl, i_on_nl, 4761 + p_idx),
            'WithinPatient_GNWT_nonlin_vs_HGA_r': corr_perm(g_on_nl, g_on_hga, 4771 + p_idx),
            'WithinPatient_IIT_nonlin_vs_HGA_r': corr_perm(i_on_nl, i_on_hga, 4781 + p_idx),
        }
        per_patient.append(p_rec)
        print(f"\n[{sub}] hemi={hemi_counts[sub]}")
        print(f"  GNWT nonlin ON->OFF: {p_rec['GNWT_nonlin_ON_vs_OFF']['mA']} -> {p_rec['GNWT_nonlin_ON_vs_OFF']['mB']} (t={p_rec['GNWT_nonlin_ON_vs_OFF']['t']}, p={p_rec['GNWT_nonlin_ON_vs_OFF']['p']})")
        print(f"  IIT  nonlin ON->OFF: {p_rec['IIT_nonlin_ON_vs_OFF']['mA']} -> {p_rec['IIT_nonlin_ON_vs_OFF']['mB']} (t={p_rec['IIT_nonlin_ON_vs_OFF']['t']}, p={p_rec['IIT_nonlin_ON_vs_OFF']['p']})")
        print(f"  GNWT HGA    ON->OFF: t={p_rec['GNWT_HGA_ON_vs_OFF']['t']}, p={p_rec['GNWT_HGA_ON_vs_OFF']['p']} | IIT HGA ON->OFF: t={p_rec['IIT_HGA_ON_vs_OFF']['t']}, p={p_rec['IIT_HGA_ON_vs_OFF']['p']}")
        print(f"  GNWT<->IIT nonlin coupling r={p_rec['WithinPatient_GNWT_vs_IIT_nonlin_r']['r']} (p={p_rec['WithinPatient_GNWT_vs_IIT_nonlin_r']['p']})")
        print(f"  Orthogonality vs High-Gamma: GNWT r={p_rec['WithinPatient_GNWT_nonlin_vs_HGA_r']['r']} (p={p_rec['WithinPatient_GNWT_nonlin_vs_HGA_r']['p']}) | IIT r={p_rec['WithinPatient_IIT_nonlin_vs_HGA_r']['r']} (p={p_rec['WithinPatient_IIT_nonlin_vs_HGA_r']['p']})")

    pooled = {
        'GNWT_nonlin_ON_vs_OFF': paired_perm(all_g_on_nl, all_g_off_nl, 4801),
        'IIT_nonlin_ON_vs_OFF': paired_perm(all_i_on_nl, all_i_off_nl, 4802),
        'GNWT_WK_ON_vs_OFF': paired_perm(all_g_on_wk, all_g_off_wk, 4803),
        'IIT_WK_ON_vs_OFF': paired_perm(all_i_on_wk, all_i_off_wk, 4804),
        'GNWT_HGA_ON_vs_OFF': paired_perm(all_g_on_hga, all_g_off_hga, 4805),
        'IIT_HGA_ON_vs_OFF': paired_perm(all_i_on_hga, all_i_off_hga, 4806),
        'Pooled_GNWT_vs_IIT_nonlin_r': corr_perm(all_g_trial_nl, all_i_trial_nl, 4807),
        'Pooled_GNWT_nonlin_vs_HGA_shift_r': corr_perm(np.array(all_g_on_nl) - np.array(all_g_off_nl), np.array(all_g_on_hga) - np.array(all_g_off_hga), 4808),
        'Pooled_IIT_nonlin_vs_HGA_shift_r': corr_perm(np.array(all_i_on_nl) - np.array(all_i_off_nl), np.array(all_i_on_hga) - np.array(all_i_off_hga), 4809),
    }

    print('\n=== POOLED CROSS-REFERENCE SUMMARY (N=240 PAIRED 500ms TRIALS ACROSS 4 HUMAN BRAINS) ===')
    for k, v in pooled.items():
        print(f'  {k.ljust(36)} {v}')

    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump({'lab': 'Lab #47c — COGITATE Intracranial Cross-Reference vs Papers 1-10', 'pooled': pooled, 'per_patient': per_patient}, f, indent=2)
    print(f'\nSaved -> {OUT_PATH}')


if __name__ == '__main__':
    main()
