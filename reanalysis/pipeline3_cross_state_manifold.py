"""
Project ONEIRIS — Phase IX Reanalysis Pipeline 3
Datasets: timmer500/DMT_Imaging (Timmermann 2023), OpenNeuro ds003768 (Sleep EEG-fMRI),
          ds006644 (DMT+harmine), ds003059 (LSD), ds005917 (Ketamine)
Goal: Test whether DMT, ketamine, LSD, and REM/NREM sleep share a single discrete
      "liminal gateway" attractor or separate along continuous, receptor-specific
      cortical connectivity and entropy axes.

Requirements: numpy, pandas, scipy, scikit-learn
Usage:
    python pipeline3_cross_state_manifold.py --features cross_state_features.csv --out results_p3.json
"""

import argparse
import json
from pathlib import Path
import numpy as np
import pandas as pd


FEATURE_COLS = [
    "dmn_visual_fc",
    "principal_gradient_span",
    "alpha_power_change",
    "lzc_norm",
]


def evaluate_manifold_geometry(df: pd.DataFrame) -> dict:
    """Compares single-gateway vs. multi-state receptor-specific structure via GMM BIC and LDA."""
    from sklearn.preprocessing import StandardScaler
    from sklearn.mixture import GaussianMixture
    from sklearn.discriminant_analysis import LinearDiscriminantAnalysis
    from sklearn.model_selection import StratifiedKFold, cross_val_score

    X = StandardScaler().fit_transform(df[FEATURE_COLS].to_numpy())
    y = df["state_label"].to_numpy()
    n_states = len(np.unique(y))

    # 1. GMM BIC across K = 1 .. n_states + 1
    bic_by_k = {}
    for k in range(1, min(len(X), n_states + 2)):
        gmm = GaussianMixture(n_components=k, covariance_type="full", random_state=42)
        gmm.fit(X)
        bic_by_k[str(k)] = float(gmm.bic(X))

    best_k = int(min(bic_by_k, key=lambda k: bic_by_k[k]))

    # 2. Cross-validated LDA separability across pharmacological/sleep states
    cv = StratifiedKFold(n_splits=min(5, int(pd.Series(y).value_counts().min())), shuffle=True, random_state=42)
    lda = LinearDiscriminantAnalysis()
    lda_scores = cross_val_score(lda, X, y, cv=cv, scoring="balanced_accuracy")
    mean_acc = float(np.mean(lda_scores))

    return {
        "n_samples": int(len(df)),
        "n_states": int(n_states),
        "gmm_bic_by_k": bic_by_k,
        "best_k_by_bic": best_k,
        "lda_balanced_accuracy": mean_acc,
        "supports_receptor_specific_separation": bool(mean_acc > 0.75 and best_k >= min(3, n_states)),
    }


def main():
    parser = argparse.ArgumentParser(description="ONEIRIS Pipeline 3: Cross-State Manifold Analysis")
    parser.add_argument("--features", type=Path, required=True, help="Harmonized CSV with state_label and FEATURE_COLS")
    parser.add_argument("--out", type=Path, default=Path("results_p3_manifold.json"))
    args = parser.parse_args()

    df = pd.read_csv(args.features).dropna(subset=FEATURE_COLS + ["state_label"])
    summary = evaluate_manifold_geometry(df)
    args.out.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print("Cross-State Manifold Summary:", json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
