"""
Project ONEIRIS — Phase IX Reanalysis Pipeline 2
Datasets: DREAM Database (Nat Commun 2025, DOI 10.1038/s41467-025-61945-1) + NSRR SHHS/MESA
Goal: Calibrate endogenous neural predictors of dream presence and report richness
      (posterior gamma/delta ratio, frontal-posterior coherence, LZc) across labs and stages
      with zero external term X (establishing the Model A explanatory ceiling).

Requirements: mne, numpy, scipy, pandas, statsmodels, scikit-learn
Usage:
    python pipeline2_dream_calibration.py --dream-index /path/to/dream_records.csv --out results_p2.csv
"""

import argparse
from pathlib import Path
import numpy as np
import pandas as pd


def compute_stage_features(raw, t_end: float, window_sec: float = 30.0) -> dict:
    """Computes harmonized -30s pre-awakening EEG features for DREAM records."""
    import mne

    seg = raw.copy().crop(tmin=max(0.0, t_end - window_sec), tmax=t_end)
    seg.pick(mne.pick_types(seg.info, eeg=True))
    seg.filter(1.0, 45.0, verbose=False)
    psd = seg.compute_psd(method="welch", fmin=1.0, fmax=45.0, verbose=False)
    freqs = psd.freqs
    pxx = psd.get_data()

    p_delta = float(np.mean(pxx[:, (freqs >= 1.0) & (freqs <= 4.0)]))
    p_theta = float(np.mean(pxx[:, (freqs >= 4.0) & (freqs <= 8.0)]))
    p_alpha = float(np.mean(pxx[:, (freqs >= 8.0) & (freqs <= 12.0)]))
    p_gamma = float(np.mean(pxx[:, (freqs >= 25.0) & (freqs <= 45.0)]))

    return {
        "p_delta": p_delta,
        "p_theta": p_theta,
        "p_alpha": p_alpha,
        "p_gamma": p_gamma,
        "log_gamma_delta": float(np.log10((p_gamma + 1e-18) / (p_delta + 1e-18))),
    }


def fit_multilab_model(df: pd.DataFrame) -> dict:
    """Fits leave-one-lab-out logistic model predicting binary dream recall (Model A baseline)."""
    from sklearn.model_selection import LeaveOneGroupOut
    from sklearn.linear_model import LogisticRegression
    from sklearn.preprocessing import StandardScaler
    from sklearn.pipeline import make_pipeline
    from sklearn.metrics import roc_auc_score

    X = df[["log_gamma_delta", "p_alpha", "p_theta"]].to_numpy()
    y = df["dream_recall"].to_numpy().astype(int)
    labs = df["lab_id"].to_numpy()

    logo = LeaveOneGroupOut()
    lab_aucs = {}
    for tr, te in logo.split(X, y, labs):
        lab_name = str(labs[te[0]])
        if len(np.unique(y[te])) < 2:
            continue
        clf = make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000))
        clf.fit(X[tr], y[tr])
        lab_aucs[lab_name] = float(roc_auc_score(y[te], clf.predict_proba(X[te])[:, 1]))

    return {
        "mean_lolo_auc": float(np.mean(list(lab_aucs.values()))) if lab_aucs else float("nan"),
        "per_lab_auc": lab_aucs,
    }


def main():
    parser = argparse.ArgumentParser(description="ONEIRIS Pipeline 2: DREAM Multi-Lab Calibration")
    parser.add_argument("--dream-index", type=Path, required=True, help="CSV with columns: lab_id, eeg_path, awakening_sec, sleep_stage, dream_recall")
    parser.add_argument("--out", type=Path, default=Path("results_p2_dream.csv"))
    args = parser.parse_args()

    import mne

    index_df = pd.read_csv(args.dream_index)
    rows = []
    for _, rec in index_df.iterrows():
        raw = mne.io.read_raw(rec["eeg_path"], preload=True, verbose=False)
        feats = compute_stage_features(raw, t_end=float(rec["awakening_sec"]))
        rows.append({
            "lab_id": rec["lab_id"],
            "sleep_stage": rec["sleep_stage"],
            "dream_recall": int(rec["dream_recall"]),
            **feats,
        })

    out_df = pd.DataFrame(rows)
    out_df.to_csv(args.out, index=False)
    print(f"Extracted {len(out_df)} harmonized DREAM epochs -> {args.out}")
    if out_df["lab_id"].nunique() >= 2:
        print("Leave-One-Lab-Out Model A Baseline:", fit_multilab_model(out_df))


if __name__ == "__main__":
    main()
