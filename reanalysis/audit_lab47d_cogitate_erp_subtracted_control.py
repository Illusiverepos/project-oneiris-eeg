#!/usr/bin/env python3
"""
Project ONEIRIS — Lab #47d: The ERP-Subtracted Killer Control on COGITATE (2025) Intracranial ECoG
Tests whether Prefrontal (GNWT) `brainNonlin` ignition (`t = -5.751, p = 0.0001` in Lab #47c)
and GNWT<->IIT co-ignition (`r = +0.360, p = 0.0001`) are:
  (A) Driven by the stimulus-locked Evoked Response Potential (ERP), OR
  (B) Genuine non-phase-locked INDUCED nonlinear phase coordination that SURVIVES exact
      per-electrode trial-averaged ERP subtraction (`X_induced = X_trial - mean(X_trials)`)!

Output: reanalysis/data/lab47d_cogitate_erp_subtracted_control_results.json
"""

import os
import re
import json
import math
import zipfile
import numpy as np

from audit_lab47c_cogitate_crossref_papers1to10 import (
    ZIP_PATH, GNWT_KEYS, IIT_KEYS, parse_vhdr, batch_metrics_and_hga, batch_phase_rand, paired_perm, corr_perm
)

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_PATH = os.path.join(REPO, 'reanalysis', 'data', 'lab47d_cogitate_erp_subtracted_control_results.json')


def main():
    print('=== Lab #47d: ERP-Subtracted Killer Control on COGITATE (2025) Intracranial ECoG ===')
    z = zipfile.ZipFile(ZIP_PATH, 'r')
    eeg_infos = sorted([i for i in z.infolist() if i.filename.endswith('_ieeg.eeg')], key=lambda x: x.filename)

    raw_g_on, raw_g_off, ind_g_on, ind_g_off = [], [], [], []
    raw_i_on, raw_i_off, ind_i_on, ind_i_off = [], [], [], []
    ind_g_wk_on, ind_g_wk_off, ind_i_wk_on, ind_i_wk_off = [], [], [], []
    per_patient = []

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
        trials_500 = []
        for ln in ev_lines:
            cols = ln.split('\t')
            if len(cols) >= 5 and cols[2].startswith('stimulus onset/') and '/500ms/' in cols[2]:
                samp = int(float(cols[4]))
                if samp >= int(0.5 * raw_sfreq) and samp + int(2.1 * raw_sfreq) < total_samples:
                    trials_500.append(samp)

        step = max(1, len(trials_500) // 60)
        chosen = trials_500[::step][:60]
        ep_raw_n = 1024 * decim512

        # Load all 60 trials into tensor (n_trials, n_roi, 1024)
        X_all = np.empty((len(chosen), len(all_roi_idx), 1024), dtype=np.float64)
        with z.open(eeg_info, 'r') as f:
            for ti, samp in enumerate(chosen):
                f.seek(samp * n_ch * 4)
                raw = np.frombuffer(f.read(ep_raw_n * n_ch * 4), dtype='<f4').reshape(1024, decim512, n_ch)
                X_all[ti] = raw[:, :, all_roi_idx].mean(axis=1).T

        # Exact per-electrode trial-averaged ERP subtraction!
        erp = X_all.mean(axis=0, keepdims=True)
        X_ind = X_all - erp
        erp_var_pct = float(100.0 * np.var(erp) / (np.var(X_all) + 1e-18))

        rng = np.random.default_rng(47990 + p_idx)
        p_raw_g_on, p_raw_g_off, p_ind_g_on, p_ind_g_off = [], [], [], []
        p_raw_i_on, p_raw_i_off, p_ind_i_on, p_ind_i_off = [], [], [], []

        for ti in range(len(chosen)):
            for is_ind, X_src in [(False, X_all[ti]), (True, X_ind[ti])]:
                X_on, X_off = X_src[:, :512], X_src[:, 512:1024]
                _, _, rwk_on, _ = batch_metrics_and_hga(X_on, sfreq512)
                _, _, rwk_off, _ = batch_metrics_and_hga(X_off, sfreq512)
                _, _, swk_on, _ = batch_metrics_and_hga(batch_phase_rand(X_on, rng), sfreq512)
                _, _, swk_off, _ = batch_metrics_and_hga(batch_phase_rand(X_off, rng), sfreq512)
                nl_on, nl_off = rwk_on - swk_on, rwk_off - swk_off
                if not is_ind:
                    p_raw_g_on.append(float(nl_on[:n_g].mean())); p_raw_g_off.append(float(nl_off[:n_g].mean()))
                    p_raw_i_on.append(float(nl_on[n_g:].mean())); p_raw_i_off.append(float(nl_off[n_g:].mean()))
                else:
                    p_ind_g_on.append(float(nl_on[:n_g].mean())); p_ind_g_off.append(float(nl_off[:n_g].mean()))
                    p_ind_i_on.append(float(nl_on[n_g:].mean())); p_ind_i_off.append(float(nl_off[n_g:].mean()))
                    ind_g_wk_on.append(float(rwk_on[:n_g].mean())); ind_g_wk_off.append(float(rwk_off[:n_g].mean()))
                    ind_i_wk_on.append(float(rwk_on[n_g:].mean())); ind_i_wk_off.append(float(rwk_off[n_g:].mean()))

        raw_g_on.extend(p_raw_g_on); raw_g_off.extend(p_raw_g_off)
        ind_g_on.extend(p_ind_g_on); ind_g_off.extend(p_ind_g_off)
        raw_i_on.extend(p_raw_i_on); raw_i_off.extend(p_raw_i_off)
        ind_i_on.extend(p_ind_i_on); ind_i_off.extend(p_ind_i_off)

        rec = {
            'sub': sub, 'erp_variance_pct': round(erp_var_pct, 2),
            'RAW_GNWT': paired_perm(p_raw_g_on, p_raw_g_off, 4901 + p_idx),
            'ERP_SUB_GNWT': paired_perm(p_ind_g_on, p_ind_g_off, 4911 + p_idx),
            'RAW_IIT': paired_perm(p_raw_i_on, p_raw_i_off, 4921 + p_idx),
            'ERP_SUB_IIT': paired_perm(p_ind_i_on, p_ind_i_off, 4931 + p_idx),
            'ERP_SUB_GNWT_IIT_r': corr_perm(p_ind_g_on, p_ind_i_on, 4941 + p_idx),
        }
        per_patient.append(rec)
        print(f"\n[{sub}] ERP variance={rec['erp_variance_pct']}%")
        print(f"  RAW     GNWT ON->OFF: {rec['RAW_GNWT']['mA']} -> {rec['RAW_GNWT']['mB']} (t={rec['RAW_GNWT']['t']}, p={rec['RAW_GNWT']['p']})")
        print(f"  ERP-SUB GNWT ON->OFF: {rec['ERP_SUB_GNWT']['mA']} -> {rec['ERP_SUB_GNWT']['mB']} (t={rec['ERP_SUB_GNWT']['t']}, p={rec['ERP_SUB_GNWT']['p']})")
        print(f"  ERP-SUB IIT  ON->OFF: {rec['ERP_SUB_IIT']['mA']} -> {rec['ERP_SUB_IIT']['mB']} (t={rec['ERP_SUB_IIT']['t']}, p={rec['ERP_SUB_IIT']['p']})")
        print(f"  ERP-SUB GNWT<->IIT r={rec['ERP_SUB_GNWT_IIT_r']['r']} (p={rec['ERP_SUB_GNWT_IIT_r']['p']})")

    pooled = {
        'RAW_GNWT_ON_vs_OFF': paired_perm(raw_g_on, raw_g_off, 4951),
        'ERP_SUB_GNWT_ON_vs_OFF': paired_perm(ind_g_on, ind_g_off, 4952),
        'RAW_IIT_ON_vs_OFF': paired_perm(raw_i_on, raw_i_off, 4953),
        'ERP_SUB_IIT_ON_vs_OFF': paired_perm(ind_i_on, ind_i_off, 4954),
        'ERP_SUB_GNWT_WK_ON_vs_OFF': paired_perm(ind_g_wk_on, ind_g_wk_off, 4955),
        'ERP_SUB_IIT_WK_ON_vs_OFF': paired_perm(ind_i_wk_on, ind_i_wk_off, 4956),
        'ERP_SUB_GNWT_vs_IIT_r': corr_perm(ind_g_on, ind_i_on, 4957),
    }

    print('\n=== POOLED ERP-SUBTRACTED KILLER CONTROL (N=240 PAIRED TRIALS, 4 HUMAN BRAINS) ===')
    for k, v in pooled.items():
        print(f'  {k.ljust(30)} {v}')

    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump({'lab': 'Lab #47d — COGITATE ERP-Subtracted Killer Control', 'pooled': pooled, 'per_patient': per_patient}, f, indent=2)
    print(f'\nSaved -> {OUT_PATH}')


if __name__ == '__main__':
    main()
