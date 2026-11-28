#!/usr/bin/env python3
"""
Project ONEIRIS — Lab #48b: Exact 500ms-Trial COGITATE Human MEG (Planar Gradiometers)
& Common-Average-Referenced (CAR) Scalp EEG Replication!

Fixes the two confounds from Lab #48's raw magnetometer pass:
  1. Uses hardware noise-canceling MEG Planar Gradiometers (MEGxxxx2/3, 204 sensors/brain)
     instead of drift-prone magnetometers, plus 1 Hz high-pass & CAR on Scalp EEG.
  2. Selects STRICTLY 500ms brief trials (onset -> offset trigger dt in [450, 560] ms),
     matching Lab #47c/47d ECoG 1-to-1 so [0..1s] is StimON and [1..2s] is strictly PostOFF!
  3. Tests BOTH Raw AND Exact Per-Sensor ERP-Subtracted (`X_trial - ERP`)!

Output: reanalysis/data/lab48b_cogitate_meeg_500ms_gradiometers_results.json
"""

import os
import json
import math
import zipfile
import numpy as np

from audit_lab47c_cogitate_crossref_papers1to10 import (
    batch_metrics_and_hga, batch_phase_rand, paired_perm, corr_perm
)
from audit_lab48_cogitate_meeg_replication import ZIP_PATH, read_fiff_segment

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_PATH = os.path.join(REPO, 'reanalysis', 'data', 'lab48b_cogitate_meeg_500ms_gradiometers_results.json')


def hp_filter_epochs(X, sfreq, f_cut=1.0):
    """Zero-phase FFT 1 Hz high-pass on X of shape (n_tr, n_ch, N)."""
    N = X.shape[-1]
    X0 = X - X.mean(axis=-1, keepdims=True)
    F = np.fft.rfft(X0, axis=-1)
    freqs = np.fft.rfftfreq(N, d=1.0 / sfreq)
    F[..., freqs < f_cut] = 0.0
    return np.fft.irfft(F, n=N, axis=-1)


def find_500ms_onsets(sti, sf):
    """
    In COGITATE Exp 1 STI101, every Stimulus onset trigger is followed by a Fixation (offset)
    trigger at +500ms, +1000ms, or +1500ms. We select strictly 500ms trials where the next
    rising edge occurs 450..560ms later and the trial has >= 2.05s of data!
    """
    s = np.round(sti).astype(np.int32)
    edges = np.where((np.diff(s, prepend=0) > 0) & (s > 0))[0]
    onsets = []
    last = -99999
    for i in range(len(edges) - 1):
        t0, t1 = int(edges[i]), int(edges[i + 1])
        dt_ms = 1000.0 * (t1 - t0) / sf
        # Stimulus triggers are typically 1..80 or 101..160; fixation offset is ~96/97 or similar
        if 450.0 <= dt_ms <= 560.0 and (t0 - last) >= int(1.8 * sf) and (t0 + int(2.05 * sf)) < len(s):
            onsets.append(t0)
            last = t0
    return onsets


def main():
    print('=== Lab #48b: Exact 500ms COGITATE Trials — MEG Planar Gradiometers + CAR Scalp EEG ===')
    z = zipfile.ZipFile(ZIP_PATH, 'r')
    subjects = ['CA124', 'CA140', 'CB013', 'CB072']

    meg_raw_f_on, meg_raw_f_off, meg_ind_f_on, meg_ind_f_off = [], [], [], []
    meg_ind_p_on, meg_ind_p_off = [], []
    meg_ind_f_wk_on, meg_ind_f_wk_off, meg_ind_p_wk_on, meg_ind_p_wk_off = [], [], [], []
    eeg_raw_f_on, eeg_raw_f_off, eeg_ind_f_on, eeg_ind_f_off = [], [], [], []
    eeg_ind_p_on, eeg_ind_p_off = [], []
    per_subject = []

    for s_idx, sub in enumerate(subjects):
        rng = np.random.default_rng(48800 + s_idx)
        # Read DurR1 + DurR2 (240s each) to get ~60 clean 500ms trials per subject
        meg_trials_list, eeg_trials_list = [], []
        n_mf = n_mp = n_ef = n_ep = 0
        sf_use = 1000.0

        for run_id in ('DurR1', 'DurR2'):
            dur_path = f'COG_MEEG_EXP1_RELEASE/{sub}/{sub}_EXP1_MEEG/{sub}_MEEG_1_{run_id}.fif'
            sf_d, ch_d, dat_d = read_fiff_segment(z, dur_path, max_buffers=240, skip_buffers=15)
            sf_use = sf_d
            # Planar gradiometers: kind==1 and name ends with '2' or '3'
            grad = [c for c in ch_d if c['kind'] == 1 and (c['name'].endswith('2') or c['name'].endswith('3'))]
            eeg_all = [c for c in ch_d if c['kind'] == 2]
            mf_idx = [c['idx'] for c in grad if c['y'] > 0.03]
            mp_idx = [c['idx'] for c in grad if c['y'] < -0.03]
            ef_idx = [c['idx'] for c in eeg_all if c['y'] > 0.03]
            ep_idx = [c['idx'] for c in eeg_all if c['y'] < -0.03]
            n_mf, n_mp, n_ef, n_ep = len(mf_idx), len(mp_idx), len(ef_idx), len(ep_idx)
            meg_roi = np.array(mf_idx + mp_idx, dtype=np.int32)
            eeg_roi = np.array(ef_idx + ep_idx, dtype=np.int32)

            sti_idx = next((c['idx'] for c in ch_d if c['name'] == 'STI101'), -1)
            if sti_idx < 0:
                continue
            onsets = find_500ms_onsets(dat_d[:, sti_idx], sf_d)
            for s0 in onsets:
                if len(meg_trials_list) >= 60:
                    break
                seg = dat_d[s0:s0 + 2000]
                meg_trials_list.append(seg[:, meg_roi].reshape(1000, 2, -1).mean(axis=1).T)
                eeg_ep = seg[:, eeg_roi].reshape(1000, 2, -1).mean(axis=1).T
                # Common-average reference (CAR) across all ROI scalp electrodes
                eeg_ep = eeg_ep - eeg_ep.mean(axis=0, keepdims=True)
                eeg_trials_list.append(eeg_ep)
            if len(meg_trials_list) >= 60:
                break

        n_tr = len(meg_trials_list)
        if n_tr < 10:
            print(f'[{sub}] skipped (only {n_tr} 500ms trials found)')
            continue

        sf500 = sf_use / 2.0
        X_meg = hp_filter_epochs(np.stack(meg_trials_list, axis=0).astype(np.float64), sf500, 1.0)
        X_eeg = hp_filter_epochs(np.stack(eeg_trials_list, axis=0).astype(np.float64), sf500, 1.0)
        X_meg_ind = X_meg - X_meg.mean(axis=0, keepdims=True)
        X_eeg_ind = X_eeg - X_eeg.mean(axis=0, keepdims=True)

        pm_fon, pm_foff, pm_pon, pm_poff = [], [], [], []
        pe_fon, pe_foff, pe_pon, pe_poff = [], [], [], []

        for ti in range(n_tr):
            # Raw MEG
            _, _, rwk_on, _ = batch_metrics_and_hga(X_meg[ti, :, :500], sf500)
            _, _, rwk_off, _ = batch_metrics_and_hga(X_meg[ti, :, 500:1000], sf500)
            _, _, swk_on, _ = batch_metrics_and_hga(batch_phase_rand(X_meg[ti, :, :500], rng), sf500)
            _, _, swk_off, _ = batch_metrics_and_hga(batch_phase_rand(X_meg[ti, :, 500:1000], rng), sf500)
            meg_raw_f_on.append(float((rwk_on - swk_on)[:n_mf].mean()))
            meg_raw_f_off.append(float((rwk_off - swk_off)[:n_mf].mean()))

            # ERP-Subtracted MEG
            _, _, rwk_on, _ = batch_metrics_and_hga(X_meg_ind[ti, :, :500], sf500)
            _, _, rwk_off, _ = batch_metrics_and_hga(X_meg_ind[ti, :, 500:1000], sf500)
            _, _, swk_on, _ = batch_metrics_and_hga(batch_phase_rand(X_meg_ind[ti, :, :500], rng), sf500)
            _, _, swk_off, _ = batch_metrics_and_hga(batch_phase_rand(X_meg_ind[ti, :, 500:1000], rng), sf500)
            nl_on, nl_off = rwk_on - swk_on, rwk_off - swk_off
            pm_fon.append(float(nl_on[:n_mf].mean())); pm_foff.append(float(nl_off[:n_mf].mean()))
            pm_pon.append(float(nl_on[n_mf:].mean())); pm_poff.append(float(nl_off[n_mf:].mean()))
            meg_ind_f_wk_on.append(float(rwk_on[:n_mf].mean())); meg_ind_f_wk_off.append(float(rwk_off[:n_mf].mean()))
            meg_ind_p_wk_on.append(float(rwk_on[n_mf:].mean())); meg_ind_p_wk_off.append(float(rwk_off[n_mf:].mean()))

            # Raw EEG
            _, _, rwk_on, _ = batch_metrics_and_hga(X_eeg[ti, :, :500], sf500)
            _, _, rwk_off, _ = batch_metrics_and_hga(X_eeg[ti, :, 500:1000], sf500)
            _, _, swk_on, _ = batch_metrics_and_hga(batch_phase_rand(X_eeg[ti, :, :500], rng), sf500)
            _, _, swk_off, _ = batch_metrics_and_hga(batch_phase_rand(X_eeg[ti, :, 500:1000], rng), sf500)
            eeg_raw_f_on.append(float((rwk_on - swk_on)[:n_ef].mean()))
            eeg_raw_f_off.append(float((rwk_off - swk_off)[:n_ef].mean()))

            # ERP-Subtracted EEG
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

        rec = {
            'sub': sub, 'n500msTrials': n_tr,
            'MEG_ERP_SUB_F': paired_perm(pm_fon, pm_foff, 4881 + s_idx),
            'MEG_ERP_SUB_P': paired_perm(pm_pon, pm_poff, 4891 + s_idx),
            'EEG_ERP_SUB_F': paired_perm(pe_fon, pe_foff, 4901 + s_idx),
            'EEG_ERP_SUB_P': paired_perm(pe_pon, pe_poff, 4911 + s_idx),
        }
        per_subject.append(rec)
        print(f"[{sub}] n500ms={n_tr} | MEG_F: {rec['MEG_ERP_SUB_F']['mA']}->{rec['MEG_ERP_SUB_F']['mB']} (t={rec['MEG_ERP_SUB_F']['t']}, p={rec['MEG_ERP_SUB_F']['p']}) | EEG_F: {rec['EEG_ERP_SUB_F']['mA']}->{rec['EEG_ERP_SUB_F']['mB']} (t={rec['EEG_ERP_SUB_F']['t']}, p={rec['EEG_ERP_SUB_F']['p']})")

    pooled = {
        'MEG_RAW_Frontal_500ms_ON_vs_OFF': paired_perm(meg_raw_f_on, meg_raw_f_off, 4961),
        'MEG_ERP_SUB_Frontal_500ms_ON_vs_OFF': paired_perm(meg_ind_f_on, meg_ind_f_off, 4962),
        'MEG_ERP_SUB_Posterior_500ms_ON_vs_OFF': paired_perm(meg_ind_p_on, meg_ind_p_off, 4963),
        'MEG_ERP_SUB_Frontal_WK_ON_vs_OFF': paired_perm(meg_ind_f_wk_on, meg_ind_f_wk_off, 4964),
        'MEG_ERP_SUB_Posterior_WK_ON_vs_OFF': paired_perm(meg_ind_p_wk_on, meg_ind_p_wk_off, 4965),
        'MEG_ERP_SUB_F_vs_P_r': corr_perm(meg_ind_f_on, meg_ind_p_on, 4966),
        'EEG_RAW_Frontal_500ms_ON_vs_OFF': paired_perm(eeg_raw_f_on, eeg_raw_f_off, 4967),
        'EEG_ERP_SUB_Frontal_500ms_ON_vs_OFF': paired_perm(eeg_ind_f_on, eeg_ind_f_off, 4968),
        'EEG_ERP_SUB_Posterior_500ms_ON_vs_OFF': paired_perm(eeg_ind_p_on, eeg_ind_p_off, 4969),
        'EEG_ERP_SUB_F_vs_P_r': corr_perm(eeg_ind_f_on, eeg_ind_p_on, 4970),
    }

    print('\n=== POOLED STRICTLY-500ms PLANAR GRADIOMETER MEG & CAR SCALP EEG ===')
    for k, v in pooled.items():
        star = ' *SIG*' if v['p'] < 0.05 else ''
        print(f'  {k.ljust(40)} {v}{star}')

    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump({'lab': 'Lab #48b — COGITATE 500ms Planar Gradiometer MEG & CAR Scalp EEG', 'pooled': pooled, 'per_subject': per_subject}, f, indent=2)
    print(f'\nSaved -> {OUT_PATH}')


if __name__ == '__main__':
    main()
