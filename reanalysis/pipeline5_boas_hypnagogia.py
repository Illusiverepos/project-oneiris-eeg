"""
Project ONEIRIS — Phase IX Reanalysis Pipeline 5
Datasets: OpenNeuro ds005555 (BOAS: 128 nights clinical PSG + wearable forehead EEG) + openSleep (Dormio)
Goal: Benchmark automated wearable N1 sleep-onset trigger accuracy against gold-standard AASM PSG
      staging, verifying whether wake-intrusion false-positive rates stay below the <2% sensory-leakage
      gate required for Dormio-style acoustic positive controls.

Requirements: mne, numpy, pandas, scipy, scikit-learn
Usage:
    python pipeline5_boas_hypnagogia.py --bids-root /path/to/ds005555 --out results_p5_boas.json
"""

import argparse
import json
from pathlib import Path
import numpy as np
import pandas as pd


def score_forehead_epoch(epoch_data: np.ndarray, sfreq: float) -> dict:
    """Computes theta/alpha ratio on a 30s forehead EEG epoch for N1 onset detection."""
    from scipy.signal import welch

    freqs, pxx = welch(epoch_data, fs=sfreq, nperseg=min(int(sfreq * 4), len(epoch_data)))
    p_theta = float(np.mean(pxx[(freqs >= 4.0) & (freqs <= 8.0)]))
    p_alpha = float(np.mean(pxx[(freqs >= 8.0) & (freqs <= 12.0)]))
    return {
        "theta_alpha_ratio": p_theta / (p_alpha + 1e-18),
        "p_alpha": p_alpha,
        "p_theta": p_theta,
    }


def evaluate_trigger_gate(df: pd.DataFrame, max_wake_fpr: float = 0.02) -> dict:
    """Finds the threshold achieving <= max_wake_fpr on Wake epochs and reports N1 sensitivity."""
    from sklearn.metrics import roc_auc_score

    scores = df["theta_alpha_ratio"].to_numpy()
    is_n1 = (df["aasm_stage"] == "N1").to_numpy().astype(int)
    is_wake = (df["aasm_stage"] == "W").to_numpy().astype(int)

    mask = (is_n1 == 1) | (is_wake == 1)
    y_bin = is_n1[mask]
    s_bin = scores[mask]
    auc = float(roc_auc_score(y_bin, s_bin)) if len(np.unique(y_bin)) == 2 else float("nan")

    wake_scores = scores[is_wake == 1]
    n1_scores = scores[is_n1 == 1]
    thresh = float(np.quantile(wake_scores, 1.0 - max_wake_fpr)) if len(wake_scores) else float("nan")
    wake_fpr = float(np.mean(wake_scores >= thresh)) if len(wake_scores) else float("nan")
    n1_tpr = float(np.mean(n1_scores >= thresh)) if len(n1_scores) else float("nan")

    return {
        "n_epochs_w_or_n1": int(np.sum(mask)),
        "roc_auc_n1_vs_wake": auc,
        "calibrated_threshold": thresh,
        "empirical_wake_fpr": wake_fpr,
        "n1_detection_sensitivity": n1_tpr,
        "passes_2pct_leakage_gate": bool(wake_fpr <= max_wake_fpr and n1_tpr >= 0.50),
    }


def main():
    parser = argparse.ArgumentParser(description="ONEIRIS Pipeline 5: BOAS Wearable N1 Trigger Benchmark")
    parser.add_argument("--bids-root", type=Path, required=True, help="Local path to OpenNeuro ds005555")
    parser.add_argument("--out", type=Path, default=Path("results_p5_boas.json"))
    args = parser.parse_args()

    import mne

    rows = []
    for sub_dir in sorted(args.bids_root.glob("sub-*")):
        for edf_path in sub_dir.rglob("*_eeg.edf"):
            events_path = edf_path.with_name(edf_path.name.replace("_eeg.edf", "_events.tsv"))
            if not events_path.exists():
                continue
            raw = mne.io.read_raw_edf(edf_path, preload=True, verbose=False)
            sfreq = raw.info["sfreq"]
            data = raw.get_data()[0]  # forehead channel
            ev_df = pd.read_csv(events_path, sep="\t")
            for _, ev in ev_df.iterrows():
                stage = str(ev.get("trial_type", ev.get("stage", ""))).upper()
                if stage not in {"W", "N1", "N2", "N3", "R"}:
                    continue
                start = int(float(ev["onset"]) * sfreq)
                end = start + int(30 * sfreq)
                if end <= len(data):
                    feats = score_forehead_epoch(data[start:end], sfreq)
                    rows.append({"subject": sub_dir.name, "aasm_stage": stage, **feats})

    out_df = pd.DataFrame(rows)
    summary = evaluate_trigger_gate(out_df) if len(out_df) else {"error": "No valid BOAS epochs found"}
    args.out.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print("BOAS Wearable Trigger Summary:", json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
