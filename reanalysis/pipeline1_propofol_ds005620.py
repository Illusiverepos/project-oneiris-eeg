"""
Project ONEIRIS — Phase IX Reanalysis Pipeline 1
Dataset: OpenNeuro ds005620 (Bajwa et al., Propofol Repeated Awakening HD-EEG + TMS-EEG)
Goal: Test whether posterior cortical hot-zone gamma/delta ratio, multichannel mLZc,
      and TMS-evoked alpha power (8-12 Hz ERSP) separate dreaming vs. no-experience
      awakenings during moderate propofol sedation.

Requirements: mne, mne-bids, numpy, scipy, pandas, scikit-learn
Usage:
    python pipeline1_propofol_ds005620.py --bids-root /path/to/ds005620 --out results_p1.csv
"""

import argparse
from pathlib import Path
import numpy as np
import pandas as pd


POSTERIOR_ROI = ["P3", "P4", "Pz", "PO3", "PO4", "POz", "O1", "O2", "Oz"]


def lempel_ziv_complexity(binary_seq: np.ndarray) -> float:
    """Normalized Lempel-Ziv complexity (LZ76) of a 1D binary sequence."""
    s = "".join("1" if b else "0" for b in binary_seq)
    n = len(s)
    if n <= 1:
        return 0.0
    i, k, l = 0, 1, 1
    c = 1
    k_max = 1
    while True:
        if s[i + k - 1] == s[l + k - 1]:
            k += 1
            if l + k > n:
                c += 1
                break
        else:
            if k > k_max:
                k_max = k
            i += 1
            if i == l:
                c += 1
                l += k_max
                if l + 1 > n:
                    break
                i, k, k_max = 0, 1, 1
            else:
                k = 1
    return float(c * np.log2(n) / n)


def compute_multichannel_mlzc(data: np.ndarray) -> float:
    """Hilbert-envelope binarized multichannel LZc across ROI channels (channels x time)."""
    from scipy.signal import hilbert

    analytic = hilbert(data, axis=-1)
    amp = np.abs(analytic)
    medians = np.median(amp, axis=-1, keepdims=True)
    binarized = (amp > medians).astype(np.uint8)
    # Interleave channels along time axis for multichannel mLZc
    interleaved = binarized.T.reshape(-1)
    return lempel_ziv_complexity(interleaved)


def extract_epoch_features(raw, t_end: float, window_sec: float = 60.0) -> dict:
    """Extracts posterior gamma/delta log-ratio and mLZc from pre-awakening window."""
    import mne

    picks = [ch for ch in POSTERIOR_ROI if ch in raw.ch_names]
    if not picks:
        picks = mne.pick_types(raw.info, eeg=True)
    seg = raw.copy().crop(tmin=max(0.0, t_end - window_sec), tmax=t_end).pick(picks)
    seg.filter(1.0, 45.0, verbose=False)
    seg.set_eeg_reference("average", projection=False, verbose=False)

    psd = seg.compute_psd(method="welch", fmin=1.0, fmax=45.0, verbose=False)
    freqs = psd.freqs
    pxx = psd.get_data()  # (n_ch, n_freqs)

    delta_mask = (freqs >= 1.0) & (freqs <= 4.0)
    alpha_mask = (freqs >= 8.0) & (freqs <= 12.0)
    gamma_mask = (freqs >= 25.0) & (freqs <= 45.0)

    p_delta = float(np.mean(pxx[:, delta_mask]))
    p_alpha = float(np.mean(pxx[:, alpha_mask]))
    p_gamma = float(np.mean(pxx[:, gamma_mask]))

    data = seg.get_data()
    # Subsample to 100 Hz for fast LZ76 calculation
    step = max(1, int(round(seg.info["sfreq"] / 100.0)))
    mlzc = compute_multichannel_mlzc(data[:, ::step])

    return {
        "p_delta": p_delta,
        "p_alpha": p_alpha,
        "p_gamma": p_gamma,
        "log_gamma_delta": float(np.log10((p_gamma + 1e-18) / (p_delta + 1e-18))),
        "posterior_mlzc": mlzc,
        "n_roi_channels": len(picks),
    }


def evaluate_auc(df: pd.DataFrame) -> dict:
    """Subject-grouped cross-validated ROC AUC separating dreaming vs. no-experience."""
    from sklearn.model_selection import GroupKFold
    from sklearn.linear_model import LogisticRegression
    from sklearn.preprocessing import StandardScaler
    from sklearn.pipeline import make_pipeline
    from sklearn.metrics import roc_auc_score

    features = ["log_gamma_delta", "posterior_mlzc", "p_alpha"]
    X = df[features].to_numpy()
    y = df["dream_report"].to_numpy().astype(int)
    groups = df["subject"].to_numpy()

    n_splits = min(5, len(np.unique(groups)))
    gkf = GroupKFold(n_splits=n_splits)
    aucs = []
    for train_idx, test_idx in gkf.split(X, y, groups):
        if len(np.unique(y[test_idx])) < 2:
            continue
        clf = make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000))
        clf.fit(X[train_idx], y[train_idx])
        probs = clf.predict_proba(X[test_idx])[:, 1]
        aucs.append(roc_auc_score(y[test_idx], probs))

    mean_auc = float(np.mean(aucs)) if aucs else float("nan")
    return {
        "mean_cv_auc": mean_auc,
        "fold_aucs": aucs,
        "falsifies_liminal_propofol_marker": bool(mean_auc <= 0.55),
    }


def main():
    parser = argparse.ArgumentParser(description="ONEIRIS Pipeline 1: ds005620 Propofol Analysis")
    parser.add_argument("--bids-root", type=Path, required=True, help="Local path to OpenNeuro ds005620")
    parser.add_argument("--out", type=Path, default=Path("results_p1_ds005620.csv"))
    args = parser.parse_args()

    import mne

    rows = []
    for sub_dir in sorted(args.bids_root.glob("sub-*")):
        eeg_files = list(sub_dir.rglob("*_eeg.set")) + list(sub_dir.rglob("*_eeg.edf")) + list(sub_dir.rglob("*_eeg.vhdr"))
        for eeg_path in eeg_files:
            events_path = eeg_path.with_name(eeg_path.name.replace("_eeg" + eeg_path.suffix, "_events.tsv"))
            if not events_path.exists():
                continue
            raw = mne.io.read_raw(eeg_path, preload=True, verbose=False)
            events_df = pd.read_csv(events_path, sep="\t")
            for _, ev in events_df.iterrows():
                trial_type = str(ev.get("trial_type", "")).lower()
                if "dream" in trial_type or "experience" in trial_type:
                    label = 0 if ("no_experience" in trial_type or "no_dream" in trial_type) else 1
                    feats = extract_epoch_features(raw, t_end=float(ev["onset"]))
                    rows.append({"subject": sub_dir.name, "file": eeg_path.name, "dream_report": label, **feats})

    out_df = pd.DataFrame(rows)
    out_df.to_csv(args.out, index=False)
    print(f"Saved {len(out_df)} epochs to {args.out}")
    if len(out_df) >= 10 and out_df["dream_report"].nunique() == 2:
        summary = evaluate_auc(out_df)
        print("Cross-validated AUC summary:", summary)


if __name__ == "__main__":
    main()
