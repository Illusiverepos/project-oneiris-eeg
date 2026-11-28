#!/usr/bin/env python3
"""
Project ONEIRIS — Lab #48: Cross-Modality Replication on the COGITATE Consortium (2025, Nature)
Human MEG (306-ch) + Simultaneous Scalp EEG (64-ch) Experiment 1 Dataset (N=4 healthy humans:
CA124, CA140, CB013, CB072) + Empty-Room MEG Noise Control (Rnoise.fif)!

Zero-dependency pure-Python FIFF reader directly out of the ZIP_STORED 31.66 GB archive:
  1. Empty-Room MEG Noise (Rnoise) vs. Living Human Eyes-Open Rest (RestinEO):
     Tests whether brainNonlin is strictly biological (≈ 0 in empty room, non-zero in living brain)
     and whether the Wiener-Khinchin law holds in pure magnetic fields (MEG, zero scalp conduction!).
  2. COGITATE Experiment 1 Visual Trials (STI101 triggers in DurR1.fif) — BOTH Raw AND
     Exact Per-Sensor ERP-Subtracted (`X_trial - ERP`):
       - Frontal MEG (y > +0.04m) vs. Posterior MEG (y < -0.04m)
       - Frontal Scalp EEG (y > +0.04m) vs. Posterior Scalp EEG (y < -0.04m)
       - Trial-by-trial Frontal <-> Posterior co-ignition (r) in BOTH MEG and Scalp EEG!

Output: reanalysis/data/lab48_cogitate_meeg_replication_results.json
"""

import os
import json
import math
import struct
import zipfile
import numpy as np

from audit_lab47c_cogitate_crossref_papers1to10 import (
    batch_metrics_and_hga, batch_phase_rand, paired_perm, corr_perm
)

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ZIP_PATH = os.path.join(
    REPO, 'reanalysis', 'data', 'cogitate',
    '20231231_cog_exp1_raw_meeg_sample_15a870cd-cbfe-4eb5-8e0e-22073006d0c9.zip'
)
OUT_PATH = os.path.join(REPO, 'reanalysis', 'data', 'lab48_cogitate_meeg_replication_results.json')


def read_fiff_segment(z, member_name, max_buffers=90, skip_buffers=20):
    """
    Pure-Python FIFF reader: parses channel info (kind, name, 3D coords x,y,z)
    and reads `max_buffers` 1-second float32 data buffers starting after `skip_buffers`.
    """
    info = z.getinfo(member_name)
    chans = []
    sfreq = 1000.0
    nchan = 0
    bufs = []
    seen_bufs = 0

    with z.open(info, 'r') as f:
        while True:
            hdr = f.read(16)
            if len(hdr) < 16:
                break
            kind, typ, size, nxt = struct.unpack('>4i', hdr)
            if kind == 201 and size == 4:
                sfreq = struct.unpack('>f', f.read(4))[0]
            elif kind == 200 and size == 4:
                nchan = struct.unpack('>i', f.read(4))[0]
            elif kind == 203 and size == 96:
                d = f.read(96)
                scanno, logno, ch_kind = struct.unpack('>3i', d[:12])
                # loc[0..2] = (x, y, z) in meters at offset 24..36
                x, y, zc = struct.unpack('>3f', d[24:36])
                name = d[80:96].split(b'\x00')[0].decode('ascii', 'ignore')
                chans.append({'idx': len(chans), 'name': name, 'kind': ch_kind, 'x': x, 'y': y, 'z': zc})
            elif kind == 300 and nchan > 0:
                if seen_bufs < skip_buffers:
                    f.seek(size, 1)
                elif len(bufs) < max_buffers:
                    raw = f.read(size)
                    if typ == 4:
                        arr = np.frombuffer(raw, dtype='>f4').reshape(-1, nchan)
                    elif typ == 3:
                        arr = np.frombuffer(raw, dtype='>i4').reshape(-1, nchan).astype(np.float32)
                    elif typ == 2:
                        arr = np.frombuffer(raw, dtype='>i2').reshape(-1, nchan).astype(np.float32)
                    else:
                        arr = None
                    if arr is not None:
                        bufs.append(arr)
                else:
                    break
                seen_bufs += 1
            else:
                if size > 0:
                    f.seek(size, 1)

    data = np.vstack(bufs) if bufs else np.empty((0, nchan), dtype=np.float32)
    return sfreq, chans, data


def score_continuous_matrix(X_256hz, sfreq_256, rng):
    """X_256hz: (M, N) continuous matrix -> per-channel slope, dfa, realWK, surrWK, nonlin across 2s windows."""
    M, N = X_256hz.shape
    N2 = 1
    while N2 * 2 <= N:
        N2 <<= 1
    X = X_256hz[:, :N2].astype(np.float64)
    # 1 Hz high-pass via FFT zeroing (< 1 Hz) for fast vectorized match
    F = np.fft.rfft(X - X.mean(axis=1, keepdims=True), axis=1)
    freqs = np.fft.rfftfreq(N2, d=1.0 / sfreq_256)
    F[:, freqs < 1.0] = 0.0
    X = np.fft.irfft(F, n=N2, axis=1)
    Xs = batch_phase_rand(X, rng)

    win_n = int(round(2.0 * sfreq_256))
    n_win = N2 // win_n
    # Use 512 Hz wrapper? No, compute directly at 256 Hz by upsampling/matching or direct 256 Hz:
    # We'll call batch_metrics_and_hga on 2x-repeated or direct 256Hz helper:
    sl_acc = np.zeros(M); df_acc = np.zeros(M); rwk_acc = np.zeros(M); swk_acc = np.zeros(M)
    for w in range(n_win):
        seg_r = np.repeat(X[:, w * win_n:(w + 1) * win_n], 2, axis=1)
        seg_s = np.repeat(Xs[:, w * win_n:(w + 1) * win_n], 2, axis=1)
        sl, df, rwk, _ = batch_metrics_and_hga(seg_r, sfreq_256 * 2.0)
        _, _, swk, _ = batch_metrics_and_hga(seg_s, sfreq_256 * 2.0)
        sl_acc += sl; df_acc += df; rwk_acc += rwk; swk_acc += swk
    sl_acc /= n_win; df_acc /= n_win; rwk_acc /= n_win; swk_acc /= n_win
    return sl_acc, df_acc, rwk_acc, swk_acc, rwk_acc - swk_acc


def main():
    print('=== Lab #48: COGITATE (2025) Human MEG (306-ch) + Scalp EEG (64-ch) + Empty-Room Control ===')
    z = zipfile.ZipFile(ZIP_PATH, 'r')
    subjects = ['CA124', 'CA140', 'CB013', 'CB072']

    # --- PART 1: EMPTY-ROOM NOISE vs. LIVING HUMAN REST (MEG) ---
    all_meg_slopes, all_meg_dfas = [], []
    all_eeg_slopes, all_eeg_dfas = [], []
    rnoise_nonlins, rest_meg_nonlins, rest_eeg_nonlins = [], [], []
    rest_front_meg, rest_post_meg = [], []
    rest_front_eeg, rest_post_eeg = [], []

    # --- PART 2: VISUAL TRIALS (DurR1.fif) RAW & ERP-SUBTRACTED ---
    meg_ind_f_on, meg_ind_f_off, meg_ind_p_on, meg_ind_p_off = [], [], [], []
    eeg_ind_f_on, eeg_ind_f_off, eeg_ind_p_on, eeg_ind_p_off = [], [], [], []
    meg_raw_f_on, meg_raw_f_off = [], []
    eeg_raw_f_on, eeg_raw_f_off = [], []
    meg_f_hga_on, meg_f_hga_off, meg_p_hga_on, meg_p_hga_off = [], [], [], []
    per_subject = []

    for s_idx, sub in enumerate(subjects):
        rng = np.random.default_rng(48000 + s_idx)

        # 1A. Empty-room MEG noise (32s)
        rn_path = f'COG_MEEG_EXP1_RELEASE/{sub}/{sub}_RNoise_MEEG/{sub}_MEEG_1_Rnoise.fif'
        sf_rn, ch_rn, dat_rn = read_fiff_segment(z, rn_path, max_buffers=34, skip_buffers=10)
        meg_rn_idx = [c['idx'] for c in ch_rn if c['kind'] == 1 and c['name'].endswith('1')]  # 102 magnetometers
        X_rn = dat_rn[:(len(dat_rn) // 4) * 4, meg_rn_idx].reshape(-1, 4, len(meg_rn_idx)).mean(axis=1).T
        _, _, _, _, nl_rn = score_continuous_matrix(X_rn, sf_rn / 4.0, rng)
        rnoise_nonlins.extend(nl_rn.tolist())

        # 1B. Living Human Eyes-Open Rest (34s)
        re_path = f'COG_MEEG_EXP1_RELEASE/{sub}/{sub}_RestinEO_MEEG/{sub}_MEEG_1_RestinEO.fif'
        sf_re, ch_re, dat_re = read_fiff_segment(z, re_path, max_buffers=34, skip_buffers=15)
        meg_mag = [c for c in ch_re if c['kind'] == 1 and c['name'].endswith('1')]
        eeg_all = [c for c in ch_re if c['kind'] == 2]
        meg_f_idx = [c['idx'] for c in meg_mag if c['y'] > 0.03]
        meg_p_idx = [c['idx'] for c in meg_mag if c['y'] < -0.03]
        eeg_f_idx = [c['idx'] for c in eeg_all if c['y'] > 0.03]
        eeg_p_idx = [c['idx'] for c in eeg_all if c['y'] < -0.03]

        meg_all_idx = [c['idx'] for c in meg_mag]
        eeg_all_idx = [c['idx'] for c in eeg_all]
        X_re_meg = dat_re[:(len(dat_re) // 4) * 4, meg_all_idx].reshape(-1, 4, len(meg_all_idx)).mean(axis=1).T
        sl_m, df_m, _, _, nl_m = score_continuous_matrix(X_re_meg, sf_re / 4.0, rng)
        all_meg_slopes.extend(sl_m.tolist()); all_meg_dfas.extend(df_m.tolist())
        rest_meg_nonlins.extend(nl_m.tolist())
        rest_front_meg.append(float(np.mean([nl_m[i] for i, c in enumerate(meg_mag) if c['y'] > 0.03])))
        rest_post_meg.append(float(np.mean([nl_m[i] for i, c in enumerate(meg_mag) if c['y'] < -0.03])))

        X_re_eeg = dat_re[:(len(dat_re) // 4) * 4, eeg_all_idx].reshape(-1, 4, len(eeg_all_idx)).mean(axis=1).T
        sl_e, df_e, _, _, nl_e = score_continuous_matrix(X_re_eeg, sf_re / 4.0, rng)
        all_eeg_slopes.extend(sl_e.tolist()); all_eeg_dfas.extend(df_e.tolist())
        rest_eeg_nonlins.extend(nl_e.tolist())
        rest_front_eeg.append(float(np.mean([nl_e[i] for i, c in enumerate(eeg_all) if c['y'] > 0.03])))
        rest_post_eeg.append(float(np.mean([nl_e[i] for i, c in enumerate(eeg_all) if c['y'] < -0.03])))

        # 2. COGITATE Experiment 1 Visual Task (DurR1.fif: read 240s = ~80-100 visual trials!)
        dur_path = f'COG_MEEG_EXP1_RELEASE/{sub}/{sub}_EXP1_MEEG/{sub}_MEEG_1_DurR1.fif'
        sf_d, ch_d, dat_d = read_fiff_segment(z, dur_path, max_buffers=240, skip_buffers=20)
        sti_idx = next((c['idx'] for c in ch_d if c['name'] == 'STI101'), -1)
        onsets = []
        if sti_idx >= 0:
            sti = np.round(dat_d[:, sti_idx]).astype(np.int32)
            # Detect rising edges (stimulus onset codes > 0 separated by >= 1.8s)
            diff = np.diff(sti, prepend=0)
            cand = np.where((diff > 0) & (sti > 0) & (sti < 200))[0]
            last = -99999
            for idx_s in cand:
                if idx_s - last >= int(1.8 * sf_d) and idx_s + int(2.05 * sf_d) < len(sti):
                    onsets.append(int(idx_s))
                    last = int(idx_s)
        chosen = onsets[:60]

        # Extract 2.0s epochs @ 500 Hz (decim=2 from 1000 Hz) for MEG (F+P) and Scalp EEG (F+P)
        meg_roi_idx = np.array(meg_f_idx + meg_p_idx, dtype=np.int32)
        eeg_roi_idx = np.array(eeg_f_idx + eeg_p_idx, dtype=np.int32)
        n_mf, n_ef = len(meg_f_idx), len(eeg_f_idx)

        sub_info = {
            'sub': sub,
            'rnoise_MEG_nonlin': round(float(np.mean(nl_rn)), 4),
            'rest_MEG_nonlin': round(float(np.mean(nl_m)), 4),
            'rest_EEG_nonlin': round(float(np.mean(nl_e)), 4),
            'nTrials_DurR1': len(chosen),
            'nMEG_F': n_mf, 'nMEG_P': len(meg_p_idx), 'nEEG_F': n_ef, 'nEEG_P': len(eeg_p_idx),
        }

        if len(chosen) >= 15:
            # Build trial tensors (n_tr, n_ch, 1000) -> 2.0s @ 500 Hz
            X_meg = np.empty((len(chosen), len(meg_roi_idx), 1000), dtype=np.float64)
            X_eeg = np.empty((len(chosen), len(eeg_roi_idx), 1000), dtype=np.float64)
            for ti, s0 in enumerate(chosen):
                seg = dat_d[s0:s0 + 2000]
                X_meg[ti] = seg[:, meg_roi_idx].reshape(1000, 2, -1).mean(axis=1).T
                X_eeg[ti] = seg[:, eeg_roi_idx].reshape(1000, 2, -1).mean(axis=1).T

            # Exact ERP subtraction!
            X_meg_ind = X_meg - X_meg.mean(axis=0, keepdims=True)
            X_eeg_ind = X_eeg - X_eeg.mean(axis=0, keepdims=True)

            sf500 = sf_d / 2.0
            pm_fon, pm_foff, pm_pon, pm_poff = [], [], [], []
            pe_fon, pe_foff, pe_pon, pe_poff = [], [], [], []

            for ti in range(len(chosen)):
                # Raw MEG frontal
                _, _, rwk_on, hga_on = batch_metrics_and_hga(X_meg[ti, :, :500], sf500)
                _, _, rwk_off, hga_off = batch_metrics_and_hga(X_meg[ti, :, 500:1000], sf500)
                _, _, swk_on, _ = batch_metrics_and_hga(batch_phase_rand(X_meg[ti, :, :500], rng), sf500)
                _, _, swk_off, _ = batch_metrics_and_hga(batch_phase_rand(X_meg[ti, :, 500:1000], rng), sf500)
                meg_raw_f_on.append(float((rwk_on - swk_on)[:n_mf].mean()))
                meg_raw_f_off.append(float((rwk_off - swk_off)[:n_mf].mean()))
                meg_f_hga_on.append(float(hga_on[:n_mf].mean())); meg_f_hga_off.append(float(hga_off[:n_mf].mean()))
                meg_p_hga_on.append(float(hga_on[n_mf:].mean())); meg_p_hga_off.append(float(hga_off[n_mf:].mean()))

                # ERP-Subtracted MEG
                _, _, rwk_on, _ = batch_metrics_and_hga(X_meg_ind[ti, :, :500], sf500)
                _, _, rwk_off, _ = batch_metrics_and_hga(X_meg_ind[ti, :, 500:1000], sf500)
                _, _, swk_on, _ = batch_metrics_and_hga(batch_phase_rand(X_meg_ind[ti, :, :500], rng), sf500)
                _, _, swk_off, _ = batch_metrics_and_hga(batch_phase_rand(X_meg_ind[ti, :, 500:1000], rng), sf500)
                nl_on, nl_off = rwk_on - swk_on, rwk_off - swk_off
                pm_fon.append(float(nl_on[:n_mf].mean())); pm_foff.append(float(nl_off[:n_mf].mean()))
                pm_pon.append(float(nl_on[n_mf:].mean())); pm_poff.append(float(nl_off[n_mf:].mean()))

                # Raw & ERP-Subtracted Scalp EEG
                _, _, rwk_on_r, _ = batch_metrics_and_hga(X_eeg[ti, :, :500], sf500)
                _, _, rwk_off_r, _ = batch_metrics_and_hga(X_eeg[ti, :, 500:1000], sf500)
                _, _, swk_on_r, _ = batch_metrics_and_hga(batch_phase_rand(X_eeg[ti, :, :500], rng), sf500)
                _, _, swk_off_r, _ = batch_metrics_and_hga(batch_phase_rand(X_eeg[ti, :, 500:1000], rng), sf500)
                eeg_raw_f_on.append(float((rwk_on_r - swk_on_r)[:n_ef].mean()))
                eeg_raw_f_off.append(float((rwk_off_r - swk_off_r)[:n_ef].mean()))

                _, _, rwk_on, _ = batch_metrics_and_hga(X_eeg_ind[ti, :, :500], sf500)
                _, _, rwk_off, _ = batch_metrics_and_hga(X_eeg_ind[ti, :, 500:1000], sf500)
                _, _, swk_on, _ = batch_metrics_and_hga(batch_phase_rand(X_eeg_ind[ti, :, :500], rng), sf500)
                _, _, swk_off, _ = batch_metrics_and_hga(batch_phase_rand(X_eeg_ind[ti, :, 500:1000], rng), sf500)
                nl_on, nl_off = rwk_on - swk_on, rwk_off - swk_off
                pe_fon.append(float(nl_on[:n_ef].mean())); pe_foff.append(float(nl_off[:n_ef].mean()))
                pe_pon.append(float(nl_on[n_ef:].mean())); pe_poff.append(float(nl_off[n_ef:].mean()))

            meg_ind_f_on.extend(pm_fon); meg_ind_f_off.extend(pm_foff)
            meg_ind_p_on.extend(pm_pon); meg_ind_p_off.extend(pm_poff)
            eeg_ind_f_on.extend(pe_fon); eeg_ind_f_off.extend(pe_foff)
            eeg_ind_p_on.extend(pe_pon); eeg_ind_p_off.extend(pe_poff)
            sub_info['MEG_ERP_SUB_F_P_r'] = corr_perm(pm_fon, pm_pon, 4810 + s_idx)
            sub_info['EEG_ERP_SUB_F_P_r'] = corr_perm(pe_fon, pe_pon, 4820 + s_idx)

        per_subject.append(sub_info)
        print(f"[{sub}] RNoise={sub_info['rnoise_MEG_nonlin']} | RestMEG={sub_info['rest_MEG_nonlin']} | RestEEG={sub_info['rest_EEG_nonlin']} | trials={len(chosen)}")

    meg_wk_r = float(np.corrcoef(all_meg_slopes, -(2.0 * np.array(all_meg_dfas) - 1.0))[0, 1])
    eeg_wk_r = float(np.corrcoef(all_eeg_slopes, -(2.0 * np.array(all_eeg_dfas) - 1.0))[0, 1])

    summary = {
        'MEG_WK_Law': {'nSensors': len(all_meg_slopes), 'r': round(meg_wk_r, 4), 'R2_pct': round(100 * meg_wk_r * meg_wk_r, 1)},
        'EEG_WK_Law': {'nSensors': len(all_eeg_slopes), 'r': round(eeg_wk_r, 4), 'R2_pct': round(100 * eeg_wk_r * eeg_wk_r, 1)},
        'EmptyRoom_vs_LivingBrain_MEG': {
            'EmptyRoom_mean': round(float(np.mean(rnoise_nonlins)), 4),
            'LivingBrain_mean': round(float(np.mean(rest_meg_nonlins)), 4),
            'paired_sensor_test': paired_perm(rest_meg_nonlins, rnoise_nonlins, 4850),
        },
        'MEG_RAW_Frontal_ON_vs_OFF': paired_perm(meg_raw_f_on, meg_raw_f_off, 4851),
        'MEG_ERP_SUB_Frontal_ON_vs_OFF': paired_perm(meg_ind_f_on, meg_ind_f_off, 4852),
        'MEG_ERP_SUB_Posterior_ON_vs_OFF': paired_perm(meg_ind_p_on, meg_ind_p_off, 4853),
        'MEG_ERP_SUB_Frontal_vs_Posterior_r': corr_perm(meg_ind_f_on, meg_ind_p_on, 4854),
        'MEG_Frontal_HGA_ON_vs_OFF': paired_perm(meg_f_hga_on, meg_f_hga_off, 4855),
        'MEG_Posterior_HGA_ON_vs_OFF': paired_perm(meg_p_hga_on, meg_p_hga_off, 4856),
        'EEG_RAW_Frontal_ON_vs_OFF': paired_perm(eeg_raw_f_on, eeg_raw_f_off, 4857),
        'EEG_ERP_SUB_Frontal_ON_vs_OFF': paired_perm(eeg_ind_f_on, eeg_ind_f_off, 4858),
        'EEG_ERP_SUB_Posterior_ON_vs_OFF': paired_perm(eeg_ind_p_on, eeg_ind_p_off, 4859),
        'EEG_ERP_SUB_Frontal_vs_Posterior_r': corr_perm(eeg_ind_f_on, eeg_ind_p_on, 4860),
    }

    print('\n=== [1] MAGNETIC & SCALP WIENER-KHINCHIN LAW (COGITATE M-EEG) ===')
    print('  MEG (magnetic fields):', summary['MEG_WK_Law'])
    print('  Scalp EEG:            ', summary['EEG_WK_Law'])
    print('\n=== [2] EMPTY-ROOM NOISE vs. LIVING HUMAN BRAIN (MEG, N=408 PAIRED SENSORS) ===')
    print(' ', summary['EmptyRoom_vs_LivingBrain_MEG'])
    print('\n=== [3] COGITATE VISUAL TRIALS: MEG & SCALP EEG (ERP-SUBTRACTED!) ===')
    for k in (
        'MEG_RAW_Frontal_ON_vs_OFF', 'MEG_ERP_SUB_Frontal_ON_vs_OFF', 'MEG_ERP_SUB_Posterior_ON_vs_OFF',
        'MEG_ERP_SUB_Frontal_vs_Posterior_r', 'MEG_Frontal_HGA_ON_vs_OFF', 'MEG_Posterior_HGA_ON_vs_OFF',
        'EEG_RAW_Frontal_ON_vs_OFF', 'EEG_ERP_SUB_Frontal_ON_vs_OFF', 'EEG_ERP_SUB_Posterior_ON_vs_OFF',
        'EEG_ERP_SUB_Frontal_vs_Posterior_r',
    ):
        print(f'  {k.ljust(36)} {summary[k]}')

    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump({'lab': 'Lab #48 — COGITATE M-EEG (MEG + Scalp EEG + Empty-Room Control)', 'summary': summary, 'per_subject': per_subject}, f, indent=2)
    print(f'\nSaved -> {OUT_PATH}')


if __name__ == '__main__':
    main()
