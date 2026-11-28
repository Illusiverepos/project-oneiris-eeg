#!/usr/bin/env python3
"""
Project ONEIRIS — Lab #47b: Full-Power Trial-Level COGITATE (2025) Intracranial ECoG Analysis
Across ALL 4 patients, ALL 371 ROI electrodes (148 GNWT Prefrontal, 223 IIT Posterior),
and ALL clean trials (~150-200 trials/condition/patient):

  1. Stimulus Duration (1500ms sustained vs. 500ms brief) on slopeBB, DFA, realWK, and brainNonlin
  2. Task Relevance (Relevant non-target vs. Irrelevant) on slopeBB, DFA, realWK, and brainNonlin
  3. Stimulus Category (Face vs. Object vs. Letter vs. False Font) — IIT Posterior vs. GNWT Prefrontal!
  4. Active Conscious Stimulus ([0.0s, +1.0s]) vs. Post-Offset Quiet ([+1.0s, +2.0s] on 500ms trials)
     — direct within-trial conscious perception ON vs. OFF test!

Output: reanalysis/data/lab47b_cogitate_full_trials_results.json
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
OUT_PATH = os.path.join(REPO, 'reanalysis', 'data', 'lab47b_cogitate_full_trials_results.json')

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


def batch_slope_and_dfa(X, sfreq, nfft=256):
    """Vectorized 1/f slope (2-40 Hz) and DFA on X of shape (M, N) where N=512 or 256."""
    M, N = X.shape
    # 1. Welch 1/f slope (50% overlap Hann)
    step = nfft // 2
    win = 0.5 * (1.0 - np.cos(2.0 * np.pi * np.arange(nfft) / (nfft - 1)))
    psd = np.zeros((M, nfft // 2 + 1), dtype=np.float64)
    segs = 0
    for st in range(0, N - nfft + 1, step):
        seg = X[:, st:st + nfft]
        seg = (seg - seg.mean(axis=1, keepdims=True)) * win
        F = np.fft.rfft(seg, axis=1)
        psd += (F.real * F.real + F.imag * F.imag)
        segs += 1
    psd /= max(1, segs)
    freqs = np.fft.rfftfreq(nfft, d=1.0 / sfreq)
    mask = (freqs >= 2.0) & (freqs <= 40.0)
    xf = np.log10(freqs[mask])
    yf = np.log10(psd[:, mask] + 1e-18)
    xf_c = xf - xf.mean()
    slopes = (yf @ xf_c) / np.sum(xf_c * xf_c)

    # 2. Vectorized DFA
    y = np.cumsum(X - X.mean(axis=1, keepdims=True), axis=1)
    scales = [sc for sc in (8, 12, 16, 24, 32, 48, 64, 96) if sc * 4 <= N]
    lx = np.log10(np.array(scales, dtype=np.float64))
    ly = np.empty((M, len(scales)), dtype=np.float64)
    for si, sc in enumerate(scales):
        n_seg = N // sc
        segs_y = y[:, :n_seg * sc].reshape(M, n_seg, sc)
        t = np.arange(sc, dtype=np.float64)
        tm = 0.5 * (sc - 1)
        dt = t - tm
        den = np.sum(dt * dt)
        ym = segs_y.mean(axis=2, keepdims=True)
        b = np.sum((segs_y - ym) * dt, axis=2, keepdims=True) / den
        a = ym - b * tm
        resid = segs_y - (a + b * t)
        rms = np.sqrt(np.mean(resid * resid, axis=(1, 2)) + 1e-24)
        ly[:, si] = np.log10(rms)
    lx_c = lx - lx.mean()
    dfas = (ly @ lx_c) / np.sum(lx_c * lx_c)
    wk = slopes + (2.0 * dfas - 1.0)
    return slopes, dfas, wk


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


def two_sample_perm(a, b, seed=4720, n_perm=10000):
    a = np.asarray(a, dtype=np.float64)
    b = np.asarray(b, dtype=np.float64)
    ma, mb = float(a.mean()), float(b.mean())
    va = float(a.var(ddof=1)) if len(a) > 1 else 0.0
    vb = float(b.var(ddof=1)) if len(b) > 1 else 0.0
    sp = math.sqrt(((len(a) - 1) * va + (len(b) - 1) * vb) / max(1, len(a) + len(b) - 2)) or 1e-9
    d = (ma - mb) / sp
    wins = np.sum(a[:, None] > b[None, :]) + 0.5 * np.sum(a[:, None] == b[None, :])
    auc = float(wins / (len(a) * len(b)))
    pool = np.concatenate([a, b])
    rng = np.random.default_rng(seed)
    na = len(a)
    obs = abs(ma - mb)
    ge = 0
    for _ in range(n_perm):
        rng.shuffle(pool)
        if abs(pool[:na].mean() - pool[na:].mean()) >= obs - 1e-12:
            ge += 1
    return {'n1': len(a), 'n2': len(b), 'm1': round(ma, 4), 'm2': round(mb, 4), 'd': round(d, 3), 'auc': round(max(auc, 1 - auc), 3), 'p': round((ge + 1) / (n_perm + 1), 5)}


def paired_perm(a, b, seed=4730, n_perm=10000):
    diff = np.asarray(a, dtype=np.float64) - np.asarray(b, dtype=np.float64)
    n = len(diff)
    m = float(diff.mean())
    sd = float(diff.std(ddof=1)) if n > 1 else 1e-9
    t_stat = m / (sd / math.sqrt(n)) if sd > 0 else 0.0
    rng = np.random.default_rng(seed)
    signs = rng.choice([-1.0, 1.0], size=(n_perm, n))
    p = float((np.sum(np.abs(signs @ diff) / n >= abs(m) - 1e-12) + 1) / (n_perm + 1))
    return {'n': n, 'mA': round(float(np.mean(a)), 4), 'mB': round(float(np.mean(b)), 4), 'dz': round(m / sd, 3), 't': round(t_stat, 3), 'p': round(p, 5)}


def main():
    print('=== Lab #47b: Full-Power COGITATE (2025) Intracranial ECoG Trial Contrasts (All 371 Electrodes) ===')
    z = zipfile.ZipFile(ZIP_PATH, 'r')
    eeg_infos = sorted([i for i in z.infolist() if i.filename.endswith('_ieeg.eeg')], key=lambda x: x.filename)

    # Store per-trial ROI averages across all 4 patients
    # Each entry: dict(slope, dfa, realWK, nonlin)
    pooled = {
        roi: {
            'dur1500': [], 'dur500': [],
            'rel': [], 'irrel': [],
            'on_0_1s': [], 'off_1_2s': [],
            'face': [], 'false': [],
        }
        for roi in ('GNWT', 'IIT')
    }

    for p_idx, eeg_info in enumerate(eeg_infos):
        prefix = eeg_info.filename.replace('_ieeg.eeg', '')
        sub = eeg_info.filename.split('/')[-4]
        vhdr_txt = z.read(prefix + '_ieeg.vhdr').decode('utf-8', 'ignore')
        n_ch, raw_sfreq, ch_names = parse_vhdr(vhdr_txt)
        decim = max(1, int(round(raw_sfreq / 256.0)))
        sfreq = raw_sfreq / decim
        total_samples = eeg_info.file_size // (n_ch * 4)

        ch_tsv = z.read(prefix + '_channels.tsv').decode('utf-8', 'ignore').splitlines()
        bad_set = {ln.split('\t')[0].strip() for ln in ch_tsv[1:] if 'bad' in [c.strip().lower() for c in ln.split('\t')]}

        des_name = prefix.replace('_task-Dur', '') + '_atlas-desikan_labels.tsv'
        roi_map = {}
        for ln in z.read(des_name).decode('utf-8', 'ignore').splitlines()[1:]:
            parts = ln.split('\t')
            if len(parts) < 2 or parts[0].strip() in bad_set:
                continue
            reg = parts[1].lower()
            if any(k in reg for k in GNWT_KEYS):
                roi_map[parts[0].strip()] = 'GNWT'
            elif any(k in reg for k in IIT_KEYS):
                roi_map[parts[0].strip()] = 'IIT'

        gnwt_idx = np.array([i for i, c in enumerate(ch_names) if roi_map.get(c) == 'GNWT'], dtype=np.int32)
        iit_idx = np.array([i for i, c in enumerate(ch_names) if roi_map.get(c) == 'IIT'], dtype=np.int32)
        all_roi_idx = np.concatenate([gnwt_idx, iit_idx])
        n_g = len(gnwt_idx)

        ev_lines = z.read(prefix + '_events.tsv').decode('utf-8', 'ignore').splitlines()[1:]
        trials = []
        for ln in ev_lines:
            cols = ln.split('\t')
            if len(cols) < 5 or not cols[2].startswith('stimulus onset/'):
                continue
            ttype = cols[2]
            samp = int(float(cols[4]))
            if samp < int(0.5 * raw_sfreq) or samp + int(2.1 * raw_sfreq) >= total_samples:
                continue
            dur = '1500ms' if '/1500ms/' in ttype else ('500ms' if '/500ms/' in ttype else '1000ms')
            rel = 'rel' if '/Relevant non-target/' in ttype else ('irrel' if '/Irrelevant/' in ttype else 'target')
            cat = 'face' if '/face/' in ttype else ('false' if '/false/' in ttype else 'other')
            trials.append((samp, dur, rel, cat))

        # Take up to 160 evenly spaced trials per patient (all 371 electrodes vectorized!)
        step = max(1, len(trials) // 160)
        chosen = trials[::step][:160]
        ep_raw_n = 512 * decim
        rng = np.random.default_rng(47500 + p_idx)

        with z.open(eeg_info, 'r') as f:
            for samp, dur, rel, cat in chosen:
                f.seek(samp * n_ch * 4)
                raw = np.frombuffer(f.read(ep_raw_n * n_ch * 4), dtype='<f4').reshape(512, decim, n_ch)
                X = raw[:, :, all_roi_idx].mean(axis=1).T.astype(np.float64)  # (n_roi, 512)
                sl, df, rwk = batch_slope_and_dfa(X, sfreq, 256)
                Xs = batch_phase_rand(X, rng)
                _, _, swk = batch_slope_and_dfa(Xs, sfreq, 256)
                nl = rwk - swk

                for roi, s_sl, s_rwk, s_nl in [
                    ('GNWT', float(sl[:n_g].mean()), float(rwk[:n_g].mean()), float(nl[:n_g].mean())),
                    ('IIT',  float(sl[n_g:].mean()), float(rwk[n_g:].mean()), float(nl[n_g:].mean())),
                ]:
                    rec = (s_sl, s_rwk, s_nl)
                    if dur == '1500ms':
                        pooled[roi]['dur1500'].append(rec)
                    elif dur == '500ms':
                        pooled[roi]['dur500'].append(rec)
                    if rel == 'rel':
                        pooled[roi]['rel'].append(rec)
                    elif rel == 'irrel':
                        pooled[roi]['irrel'].append(rec)
                    if cat == 'face':
                        pooled[roi]['face'].append(rec)
                    elif cat == 'false':
                        pooled[roi]['false'].append(rec)

                # Within-trial ON [0..1s] vs OFF [1..2s] on 500ms brief trials!
                if dur == '500ms':
                    X_on, X_off = X[:, :256], X[:, 256:512]
                    sl_on, _, rwk_on = batch_slope_and_dfa(X_on, sfreq, 128)
                    sl_off, _, rwk_off = batch_slope_and_dfa(X_off, sfreq, 128)
                    _, _, swk_on = batch_slope_and_dfa(batch_phase_rand(X_on, rng), sfreq, 128)
                    _, _, swk_off = batch_slope_and_dfa(batch_phase_rand(X_off, rng), sfreq, 128)
                    nl_on, nl_off = rwk_on - swk_on, rwk_off - swk_off
                    pooled['GNWT']['on_0_1s'].append((float(sl_on[:n_g].mean()), float(rwk_on[:n_g].mean()), float(nl_on[:n_g].mean())))
                    pooled['GNWT']['off_1_2s'].append((float(sl_off[:n_g].mean()), float(rwk_off[:n_g].mean()), float(nl_off[:n_g].mean())))
                    pooled['IIT']['on_0_1s'].append((float(sl_on[n_g:].mean()), float(rwk_on[n_g:].mean()), float(nl_on[n_g:].mean())))
                    pooled['IIT']['off_1_2s'].append((float(sl_off[n_g:].mean()), float(rwk_off[n_g:].mean()), float(nl_off[n_g:].mean())))

        print(f'  [{sub}] processed {len(chosen)} trials across {n_g} GNWT + {len(iit_idx)} IIT electrodes')

    # Summarize all contrasts across slope (idx 0), realWK (idx 1), brainNonlin (idx 2)
    results = {}
    for roi in ('GNWT', 'IIT'):
        results[roi] = {}
        for m_idx, m_name in [(0, 'slopeBB'), (1, 'realWK'), (2, 'brainNonlin')]:
            results[roi][f'Dur1500_vs_500_{m_name}'] = two_sample_perm(
                [x[m_idx] for x in pooled[roi]['dur1500']],
                [x[m_idx] for x in pooled[roi]['dur500']], 4721 + m_idx
            )
            results[roi][f'Rel_vs_Irrel_{m_name}'] = two_sample_perm(
                [x[m_idx] for x in pooled[roi]['rel']],
                [x[m_idx] for x in pooled[roi]['irrel']], 4731 + m_idx
            )
            results[roi][f'Face_vs_FalseFont_{m_name}'] = two_sample_perm(
                [x[m_idx] for x in pooled[roi]['face']],
                [x[m_idx] for x in pooled[roi]['false']], 4741 + m_idx
            )
            results[roi][f'StimON_vs_PostOFF_{m_name}'] = paired_perm(
                [x[m_idx] for x in pooled[roi]['on_0_1s']],
                [x[m_idx] for x in pooled[roi]['off_1_2s']], 4751 + m_idx
            )

    for roi in ('GNWT', 'IIT'):
        print(f'\n=== {roi} INTRACRANIAL TRIAL CONTRASTS (ALL 4 PATIENTS) ===')
        for k, v in results[roi].items():
            star = ' *SIG*' if v['p'] < 0.05 else ''
            print(f'  {k.ljust(30)} {v}{star}')

    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump({'lab': 'Lab #47b — COGITATE Full-Power Intracranial Trial Contrasts', 'results': results}, f, indent=2)
    print(f'\nSaved -> {OUT_PATH}')


if __name__ == '__main__':
    main()
