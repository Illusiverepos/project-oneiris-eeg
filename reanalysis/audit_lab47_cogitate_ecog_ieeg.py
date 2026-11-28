#!/usr/bin/env python3
"""
Project ONEIRIS — Lab #47: Direct Audit of the COGITATE Consortium (2025, Nature)
Intracranial Human ECoG/iEEG Experiment 1 Dataset (BIDS Sample, N=4 patients, 371 ROI electrodes).

Reads directly from the ZIP_STORED BIDS archive with zero extraction overhead:
  1. Tests the Intracranial Wiener-Khinchin Law (slope vs. DFA) directly on cortical surface (zero skull confound).
  2. Tests Paper 9's Wake Prediction: during awake external visual perception, BOTH Prefrontal (GNWT)
     and Posterior Hot Zone (IIT) exhibit strong negative nonlinear phase coupling (brainNonlin < 0).
  3. Tests COGITATE's Core Experiment 1 Contrasts on 2.0s post-stimulus epochs:
       (a) Stimulus Duration: 1500ms (sustained) vs. 500ms (brief) — IIT vs. GNWT sustained representation
       (b) Task Relevance: Relevant non-target vs. Irrelevant — conscious perception w/ vs. w/o task report
  4. Saves full per-patient and per-ROI metrics to:
     reanalysis/data/lab47_cogitate_ecog_ieeg_results.json
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
OUT_PATH = os.path.join(REPO, 'reanalysis', 'data', 'lab47_cogitate_ecog_ieeg_results.json')

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


def highpass_1hz(x, sfreq):
    # Matches ONEIRIS SDK 1-pole 1 Hz high-pass filter
    rc = 1.0 / (2.0 * math.pi * 1.0)
    alpha = rc / (rc + 1.0 / sfreq)
    y = np.empty_like(x, dtype=np.float64)
    y[0] = 0.0
    px = x[0]
    py = 0.0
    for i in range(1, len(x)):
        xi = x[i]
        py = alpha * (py + xi - px)
        y[i] = py
        px = xi
    return y


def compute_dfa(sig, scales=(8, 12, 16, 24, 32, 48, 64, 96)):
    N = len(sig)
    y = np.cumsum(sig - np.mean(sig))
    xs, ys = [], []
    for sc in scales:
        if sc * 4 > N:
            continue
        n_seg = N // sc
        segs = y[:n_seg * sc].reshape(n_seg, sc)
        t = np.arange(sc, dtype=np.float64)
        tm = 0.5 * (sc - 1)
        dt = t - tm
        den = np.sum(dt * dt)
        ym = np.mean(segs, axis=1, keepdims=True)
        b = np.sum((segs - ym) * dt, axis=1, keepdims=True) / den
        a = ym - b * tm
        resid = segs - (a + b * t)
        rms = math.sqrt(float(np.mean(resid * resid)))
        if rms > 0:
            xs.append(math.log10(sc))
            ys.append(math.log10(rms))
    if len(xs) < 3:
        return float('nan')
    xs = np.array(xs)
    ys = np.array(ys)
    mx, my = xs.mean(), ys.mean()
    den = np.sum((xs - mx) ** 2)
    return float(np.sum((xs - mx) * (ys - my)) / den) if den > 0 else float('nan')


def compute_slope_bb(sig, sfreq, nfft=256):
    # Matches ONEIRIS SDK Welch 1/f slope on 2-40 Hz
    N = len(sig)
    if N < nfft:
        return float('nan')
    step = nfft // 2
    win = 0.5 * (1.0 - np.cos(2.0 * np.pi * np.arange(nfft) / (nfft - 1)))
    psd = np.zeros(nfft // 2 + 1, dtype=np.float64)
    segs = 0
    for st in range(0, N - nfft + 1, step):
        seg = (sig[st:st + nfft] - np.mean(sig[st:st + nfft])) * win
        F = np.fft.rfft(seg)
        psd += (F.real * F.real + F.imag * F.imag)
        segs += 1
    if segs == 0:
        return float('nan')
    psd /= segs
    freqs = np.fft.rfftfreq(nfft, d=1.0 / sfreq)
    mask = (freqs >= 2.0) & (freqs <= 40.0)
    xs = np.log10(freqs[mask])
    ys = np.log10(psd[mask] + 1e-18)
    mx, my = xs.mean(), ys.mean()
    den = np.sum((xs - mx) ** 2)
    return float(np.sum((xs - mx) * (ys - my)) / den) if den > 0 else float('nan')


def phase_randomize(sig, rng):
    N = 1
    while N * 2 <= len(sig):
        N <<= 1
    x = sig[:N] - np.mean(sig[:N])
    F = np.fft.rfft(x)
    mags = np.abs(F)
    phases = rng.uniform(0.0, 2.0 * np.pi, size=len(F))
    phases[0] = 0.0
    if N % 2 == 0:
        phases[-1] = 0.0
    F_surr = mags * np.exp(1j * phases)
    return np.fft.irfft(F_surr, n=N) + np.mean(sig[:N])


def score_continuous_channel(sig, sfreq, seed):
    rng = np.random.default_rng(seed)
    surr = phase_randomize(sig, rng)
    win_n = int(round(2.0 * sfreq))
    N = len(surr)
    r_sl, r_dfa, r_wk, s_wk = [], [], [], []
    for st in range(0, N - win_n + 1, win_n):
        seg_r = sig[st:st + win_n]
        seg_s = surr[st:st + win_n]
        sl_r = compute_slope_bb(seg_r, sfreq)
        df_r = compute_dfa(seg_r)
        sl_s = compute_slope_bb(seg_s, sfreq)
        df_s = compute_dfa(seg_s)
        if not (math.isfinite(sl_r) and math.isfinite(df_r) and math.isfinite(sl_s) and math.isfinite(df_s)):
            continue
        r_sl.append(sl_r)
        r_dfa.append(df_r)
        r_wk.append(sl_r + (2.0 * df_r - 1.0))
        s_wk.append(sl_s + (2.0 * df_s - 1.0))
    if not r_wk:
        return None
    rwk = float(np.mean(r_wk))
    swk = float(np.mean(s_wk))
    return {
        'slope': float(np.mean(r_sl)),
        'dfa': float(np.mean(r_dfa)),
        'realWK': rwk,
        'surrWK': swk,
        'nonlin': rwk - swk,
    }


def score_epoch(sig_2s, sfreq, rng):
    sl_r = compute_slope_bb(sig_2s, sfreq)
    df_r = compute_dfa(sig_2s)
    surr = phase_randomize(sig_2s, rng)
    sl_s = compute_slope_bb(surr, sfreq)
    df_s = compute_dfa(surr)
    if not (math.isfinite(sl_r) and math.isfinite(df_r) and math.isfinite(sl_s) and math.isfinite(df_s)):
        return None
    rwk = sl_r + (2.0 * df_r - 1.0)
    swk = sl_s + (2.0 * df_s - 1.0)
    return sl_r, df_r, rwk, swk, rwk - swk


def one_sample_perm(vals, seed=4701, n_perm=10000):
    arr = np.array(vals, dtype=np.float64)
    n = len(arr)
    m = float(arr.mean())
    sd = float(arr.std(ddof=1)) if n > 1 else 1e-9
    t_stat = m / (sd / math.sqrt(n)) if sd > 0 else 0.0
    rng = np.random.default_rng(seed)
    signs = rng.choice([-1.0, 1.0], size=(n_perm, n))
    perm_means = np.abs(signs @ arr) / n
    p = float((np.sum(perm_means >= abs(m) - 1e-12) + 1) / (n_perm + 1))
    return {'n': n, 'mean': round(m, 4), 't': round(t_stat, 3), 'p': round(p, 5), 'nNeg': int(np.sum(arr < 0))}


def two_sample_perm(a, b, seed=4702, n_perm=10000):
    a = np.array(a, dtype=np.float64)
    b = np.array(b, dtype=np.float64)
    ma, mb = float(a.mean()), float(b.mean())
    va = float(a.var(ddof=1)) if len(a) > 1 else 0.0
    vb = float(b.var(ddof=1)) if len(b) > 1 else 0.0
    sp = math.sqrt(((len(a) - 1) * va + (len(b) - 1) * vb) / max(1, len(a) + len(b) - 2)) or 1e-9
    d = (ma - mb) / sp
    # Mann-Whitney AUC
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
    return {
        'n1': len(a), 'n2': len(b),
        'mean1': round(ma, 4), 'mean2': round(mb, 4),
        'd': round(d, 3), 'auc': round(max(auc, 1.0 - auc), 3),
        'p': round((ge + 1) / (n_perm + 1), 5),
    }


def main():
    print('=== Lab #47: Direct Audit of COGITATE Consortium (2025, Nature) Intracranial ECoG BIDS Sample ===')
    z = zipfile.ZipFile(ZIP_PATH, 'r')
    eeg_infos = sorted([i for i in z.infolist() if i.filename.endswith('_ieeg.eeg')], key=lambda x: x.filename)

    all_electrodes = []
    patient_summaries = []
    trial_contrasts = {'GNWT': {'dur1500': [], 'dur500': [], 'rel': [], 'irrel': []},
                       'IIT':  {'dur1500': [], 'dur500': [], 'rel': [], 'irrel': []}}

    for p_idx, eeg_info in enumerate(eeg_infos):
        prefix = eeg_info.filename.replace('_ieeg.eeg', '')
        sub = eeg_info.filename.split('/')[-4]
        vhdr_txt = z.read(prefix + '_ieeg.vhdr').decode('utf-8', 'ignore')
        n_ch, raw_sfreq, ch_names = parse_vhdr(vhdr_txt)
        decim = max(1, int(round(raw_sfreq / 256.0)))
        sfreq = raw_sfreq / decim
        total_samples = eeg_info.file_size // (n_ch * 4)

        # Load channel statuses (exclude bad channels!)
        ch_tsv = z.read(prefix + '_channels.tsv').decode('utf-8', 'ignore').splitlines()
        bad_set = set()
        for ln in ch_tsv[1:]:
            cols = ln.split('\t')
            if len(cols) >= 10 and cols[-2].strip().lower() == 'bad':
                bad_set.add(cols[0].strip())
            elif 'bad' in [c.strip().lower() for c in cols]:
                bad_set.add(cols[0].strip())

        # Load Desikan ROI labels
        des_name = prefix.replace('_task-Dur', '') + '_atlas-desikan_labels.tsv'
        des_lines = z.read(des_name).decode('utf-8', 'ignore').splitlines()[1:]
        roi_map = {}
        hemi_map = {}
        for ln in des_lines:
            parts = ln.split('\t')
            if len(parts) < 2:
                continue
            ch, reg = parts[0].strip(), parts[1].lower()
            if ch in bad_set:
                continue
            if 'ctx-lh-' in reg:
                hemi_map[ch] = 'L'
            elif 'ctx-rh-' in reg:
                hemi_map[ch] = 'R'
            if any(k in reg for k in GNWT_KEYS):
                roi_map[ch] = 'GNWT'
            elif any(k in reg for k in IIT_KEYS):
                roi_map[ch] = 'IIT'

        gnwt_idx = [i for i, c in enumerate(ch_names) if roi_map.get(c) == 'GNWT']
        iit_idx = [i for i, c in enumerate(ch_names) if roi_map.get(c) == 'IIT']
        print(f'\n[{sub}] raw_sfreq={raw_sfreq:.1f} Hz (decim={decim} -> {sfreq:.1f} Hz), nCh={n_ch}, clean GNWT={len(gnwt_idx)}, clean IIT={len(iit_idx)}')

        # --- PART A: 60-second awake visual-task continuous block (middle of recording) ---
        win_sec = 60
        raw_len = min(int(win_sec * raw_sfreq), total_samples - 2000)
        start_samp = max(0, (total_samples - raw_len) // 2)
        with z.open(eeg_info, 'r') as f:
            f.seek(start_samp * n_ch * 4)
            raw_bytes = f.read(raw_len * n_ch * 4)
        arr = np.frombuffer(raw_bytes, dtype='<f4').reshape(-1, n_ch)

        p_gnwt, p_iit = [], []
        for idx_list, roi_label, bucket in [(gnwt_idx, 'GNWT', p_gnwt), (iit_idx, 'IIT', p_iit)]:
            for k_i, ch_i in enumerate(idx_list):
                sig_dec = arr[: (len(arr) // decim) * decim, ch_i].reshape(-1, decim).mean(axis=1)
                sig_hp = highpass_1hz(sig_dec, sfreq)
                sc = score_continuous_channel(sig_hp, sfreq, seed=(p_idx + 1) * 10000 + ch_i * 31)
                if sc is None:
                    continue
                rec = {'sub': sub, 'ch': ch_names[ch_i], 'roi': roi_label, 'hemi': hemi_map.get(ch_names[ch_i], 'U'), **sc}
                all_electrodes.append(rec)
                bucket.append(rec)

        print(f'  Continuous 60s Awake Visual Task:')
        print(f'    GNWT Prefrontal (n={len(p_gnwt)}): brainNonlin={np.mean([x["nonlin"] for x in p_gnwt]):.4f}, slope={np.mean([x["slope"] for x in p_gnwt]):.3f}, DFA={np.mean([x["dfa"] for x in p_gnwt]):.3f}')
        print(f'    IIT  Posterior  (n={len(p_iit)}):  brainNonlin={np.mean([x["nonlin"] for x in p_iit]):.4f}, slope={np.mean([x["slope"] for x in p_iit]):.3f}, DFA={np.mean([x["dfa"] for x in p_iit]):.3f}')

        # --- PART B: COGITATE Experiment 1 Trial-Level Manipulation (1500ms vs 500ms; Relevant vs Irrelevant) ---
        ev_lines = z.read(prefix + '_events.tsv').decode('utf-8', 'ignore').splitlines()[1:]
        trials = {'dur1500': [], 'dur500': [], 'rel': [], 'irrel': []}
        for ln in ev_lines:
            cols = ln.split('\t')
            if len(cols) < 5:
                continue
            ttype = cols[2]
            if not ttype.startswith('stimulus onset/'):
                continue
            samp = int(float(cols[4]))
            if samp < int(0.5 * raw_sfreq) or samp + int(2.2 * raw_sfreq) >= total_samples:
                continue
            if '/1500ms/' in ttype:
                trials['dur1500'].append(samp)
            elif '/500ms/' in ttype:
                trials['dur500'].append(samp)
            if '/Relevant non-target/' in ttype:
                trials['rel'].append(samp)
            elif '/Irrelevant/' in ttype:
                trials['irrel'].append(samp)

        # Sample up to 30 well-spaced trials per condition and top 12 electrodes per ROI for crisp speed
        g_sub = gnwt_idx[:12]
        i_sub = iit_idx[:12]
        ep_raw_n = int(round(2.0 * raw_sfreq))
        rng_ep = np.random.default_rng(47000 + p_idx)

        p_trial_stats = {}
        with z.open(eeg_info, 'r') as f:
            for cond in ('dur1500', 'dur500', 'rel', 'irrel'):
                samps = trials[cond]
                if not samps:
                    continue
                step = max(1, len(samps) // 30)
                chosen = samps[::step][:30]
                g_nl, i_nl = [], []
                for s0 in chosen:
                    f.seek(s0 * n_ch * 4)
                    ep_buf = np.frombuffer(f.read(ep_raw_n * n_ch * 4), dtype='<f4').reshape(-1, n_ch)
                    n_dec = len(ep_buf) // decim
                    if n_dec < 512:
                        continue
                    for idx_list, out_l in [(g_sub, g_nl), (i_sub, i_nl)]:
                        vals = []
                        for ch_i in idx_list:
                            sd_ch = ep_buf[:n_dec * decim, ch_i].reshape(n_dec, decim).mean(axis=1)
                            res = score_epoch(sd_ch[:512], sfreq, rng_ep)
                            if res is not None:
                                vals.append(res[4])
                        if vals:
                            out_l.append(float(np.mean(vals)))
                trial_contrasts['GNWT'][cond].extend(g_nl)
                trial_contrasts['IIT'][cond].extend(i_nl)
                p_trial_stats[cond] = {
                    'nTrials': len(g_nl),
                    'GNWT_nonlin': round(float(np.mean(g_nl)), 4) if g_nl else None,
                    'IIT_nonlin': round(float(np.mean(i_nl)), 4) if i_nl else None,
                }

        patient_summaries.append({
            'sub': sub,
            'nGNWT': len(p_gnwt), 'nIIT': len(p_iit),
            'GNWT_nonlin': round(float(np.mean([x['nonlin'] for x in p_gnwt])), 4),
            'IIT_nonlin': round(float(np.mean([x['nonlin'] for x in p_iit])), 4),
            'GNWT_slope': round(float(np.mean([x['slope'] for x in p_gnwt])), 4),
            'IIT_slope': round(float(np.mean([x['slope'] for x in p_iit])), 4),
            'trials': p_trial_stats,
        })

    # === AGGREGATE STATISTICS ACROSS ALL 371 INTRACRANIAL ELECTRODES ===
    slopes = np.array([e['slope'] for e in all_electrodes])
    dfas = np.array([e['dfa'] for e in all_electrodes])
    wk_r = float(np.corrcoef(slopes, -(2.0 * dfas - 1.0))[0, 1])

    gnwt_nl = [e['nonlin'] for e in all_electrodes if e['roi'] == 'GNWT']
    iit_nl = [e['nonlin'] for e in all_electrodes if e['roi'] == 'IIT']

    stats = {
        'intracranial_WK_law': {'nElectrodes': len(all_electrodes), 'r': round(wk_r, 4), 'R2_pct': round(100 * wk_r * wk_r, 1)},
        'GNWT_Prefrontal_vs_Zero': one_sample_perm(gnwt_nl, 4711),
        'IIT_Posterior_vs_Zero': one_sample_perm(iit_nl, 4712),
        'GNWT_vs_IIT_Wake': two_sample_perm(gnwt_nl, iit_nl, 4713),
        'Trial_Duration_1500_vs_500_GNWT': two_sample_perm(trial_contrasts['GNWT']['dur1500'], trial_contrasts['GNWT']['dur500'], 4714),
        'Trial_Duration_1500_vs_500_IIT': two_sample_perm(trial_contrasts['IIT']['dur1500'], trial_contrasts['IIT']['dur500'], 4715),
        'Trial_Relevance_Rel_vs_Irrel_GNWT': two_sample_perm(trial_contrasts['GNWT']['rel'], trial_contrasts['GNWT']['irrel'], 4716),
        'Trial_Relevance_Rel_vs_Irrel_IIT': two_sample_perm(trial_contrasts['IIT']['rel'], trial_contrasts['IIT']['irrel'], 4717),
    }

    print('\n=== [1] INTRACRANIAL WIENER-KHINCHIN LAW (ZERO SKULL CONFOUND) ===')
    print(f"  N = {stats['intracranial_WK_law']['nElectrodes']} intracranial electrodes | r = {stats['intracranial_WK_law']['r']} (R^2 = {stats['intracranial_WK_law']['R2_pct']}%)")
    print('\n=== [2] COGITATE AWAKE EXTERNAL PERCEPTION: GNWT PREFRONTAL vs. IIT POSTERIOR ===')
    print('  GNWT Prefrontal vs. 0:', stats['GNWT_Prefrontal_vs_Zero'])
    print('  IIT  Posterior  vs. 0:', stats['IIT_Posterior_vs_Zero'])
    print('  GNWT vs. IIT Head-to-Head:', stats['GNWT_vs_IIT_Wake'])
    print('\n=== [3] COGITATE EXPERIMENT 1 TRIAL MANIPULATIONS (2.0s POST-STIMULUS EPOCHS) ===')
    print('  Duration 1500ms vs 500ms (GNWT):', stats['Trial_Duration_1500_vs_500_GNWT'])
    print('  Duration 1500ms vs 500ms (IIT): ', stats['Trial_Duration_1500_vs_500_IIT'])
    print('  Relevant vs Irrelevant   (GNWT):', stats['Trial_Relevance_Rel_vs_Irrel_GNWT'])
    print('  Relevant vs Irrelevant   (IIT): ', stats['Trial_Relevance_Rel_vs_Irrel_IIT'])

    out = {
        'lab': 'Lab #47 — Direct Audit of COGITATE Consortium (2025, Nature) Intracranial ECoG Experiment 1 (BIDS Sample)',
        'nPatients': len(patient_summaries),
        'nElectrodesTotal': len(all_electrodes),
        'stats': stats,
        'patients': patient_summaries,
    }
    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=2)
    print(f'\nSaved -> {OUT_PATH}')


if __name__ == '__main__':
    main()
