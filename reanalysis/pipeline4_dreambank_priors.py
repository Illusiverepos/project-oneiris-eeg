"""
Project ONEIRIS — Phase IX Reanalysis Pipeline 4
Dataset: DreamBank Historical Dream Corpus (Zenodo record 14781401)
Goal: Compute empirical object incidence priors p_base(o) for the 16-object ATLAS candidate pool
      and measure baseline scene-cut / topological discontinuity rates across ordinary dreams.

Usage:
    python pipeline4_dreambank_priors.py --corpus /path/to/dreambank.jsonl --manifest manifest.json
"""

import argparse
import json
import re
from pathlib import Path


SCENE_CUT_PATTERN = re.compile(
    r"\b(suddenly|then i was in|teleported|scene changed|found myself in|shifted to)\b",
    re.IGNORECASE,
)


def analyze_corpus(corpus_path: Path, candidate_objects: list[str]) -> dict:
    total = 0
    scene_cuts = 0
    counts = {obj: 0 for obj in candidate_objects}

    with corpus_path.open("r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
                text = rec.get("report") or rec.get("content") or rec.get("text") or ""
            except json.JSONDecodeError:
                text = line
            total += 1
            lower = text.lower()
            if SCENE_CUT_PATTERN.search(lower):
                scene_cuts += 1
            for obj in candidate_objects:
                if obj.lower() in lower:
                    counts[obj] += 1

    rates = {obj: (c / total if total else 0.0) for obj, c in counts.items()}
    max_rate = max(rates.values()) if rates else 0.0
    return {
        "total_reports": total,
        "scene_cut_rate": scene_cuts / total if total else 0.0,
        "object_counts": counts,
        "object_rates": rates,
        "max_object_rate": max_rate,
        "passes_one_percent_gate": max_rate < 0.01,
    }


def main():
    parser = argparse.ArgumentParser(description="ONEIRIS Pipeline 4: DreamBank ATLAS Prior Calibration")
    parser.add_argument("--corpus", type=Path, required=True, help="JSONL or plain-text DreamBank export")
    parser.add_argument("--manifest", type=Path, default=Path("manifest.json"))
    parser.add_argument("--out", type=Path, default=Path("results_p4_dreambank_priors.json"))
    args = parser.parse_args()

    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    objects = manifest["atlas_candidate_objects_16"]
    summary = analyze_corpus(args.corpus, objects)
    args.out.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(f"Analyzed {summary['total_reports']} DreamBank reports -> {args.out}")
    print(f"Max candidate object prior: {summary['max_object_rate']:.5f} (Passes <1% gate: {summary['passes_one_percent_gate']})")


if __name__ == "__main__":
    main()
