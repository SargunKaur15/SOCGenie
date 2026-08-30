"""
CSE-CIC-IDS2018 training pipeline — Phase 13-B.

    python -m ml.train --data datasets/CSE-CIC-IDS2018 --out models

WRITTEN, NEVER EXECUTED. The environment where this was authored has no dataset
and no network. Every number it prints comes from a real run on YOUR machine —
nothing is hardcoded, defaulted or estimated. If a step cannot run it raises
rather than continuing with a partial result.
"""
from __future__ import annotations

import argparse, hashlib, json, sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.metrics import (accuracy_score, classification_report, confusion_matrix,
                             f1_score, precision_score, recall_score)
from sklearn.model_selection import train_test_split

from .features.schema import (DATASET_NAME, FEATURE_ORDER, SCHEMA_VERSION,
                              TRAINABLE_CLASSES, ENGINEERED_FEATURE_NAMES, RAW_FEATURE_NAMES)
from .preprocess import load_directory

SEED = 42
MODEL_VERSION = "rf-1.0.0+if-1.0.0"


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def majority_baseline(y: pd.Series) -> dict:
    """Always-predict-the-largest-class. Mandatory context: at ~82% BENIGN a
    trivial predictor scores 82% accuracy, so accuracy alone proves nothing."""
    majority = y.value_counts().idxmax()
    pred = pd.Series([majority] * len(y), index=y.index)
    return {
        "majority_class": str(majority),
        "accuracy": float(accuracy_score(y, pred)),
        "macro_f1": float(f1_score(y, pred, average="macro", zero_division=0)),
        "weighted_f1": float(f1_score(y, pred, average="weighted", zero_division=0)),
    }


def evaluate(y_true, y_pred, labels: list[str]) -> dict:
    return {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "macro_precision": float(precision_score(y_true, y_pred, average="macro", zero_division=0)),
        "macro_recall": float(recall_score(y_true, y_pred, average="macro", zero_division=0)),
        "macro_f1": float(f1_score(y_true, y_pred, average="macro", zero_division=0)),
        "weighted_f1": float(f1_score(y_true, y_pred, average="weighted", zero_division=0)),
        "per_class": classification_report(y_true, y_pred, labels=labels, output_dict=True, zero_division=0),
        "confusion_matrix": {"labels": labels, "matrix": confusion_matrix(y_true, y_pred, labels=labels).tolist()},
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True)
    ap.add_argument("--out", default="models")
    ap.add_argument("--chunksize", type=int, default=500_000)
    ap.add_argument("--rf-estimators", type=int, default=150)
    ap.add_argument("--if-estimators", type=int, default=200)
    args = ap.parse_args()

    out = Path(args.out)
    (out / "random_forest").mkdir(parents=True, exist_ok=True)
    (out / "isolation_forest").mkdir(parents=True, exist_ok=True)
    (out / "metadata").mkdir(parents=True, exist_ok=True)

    print("=" * 70)
    print("STEP 1-11  LOADING AND CLEANING")
    print("=" * 70)
    df, per_file, total = load_directory(args.data, chunksize=args.chunksize)

    for name, r in per_file.items():
        print(f"\n  {name}")
        print(f"    rows in {r.rows_in:,} -> out {r.rows_out:,}")
        print(f"    header rows removed   : {r.header_rows_removed:,}")
        print(f"    negative duration     : {r.invalid_duration_rows:,}")
        print(f"    Inf rows              : {r.inf_rows_dropped:,}")
        print(f"    NaN rows              : {r.nan_rows_dropped:,}")
        print(f"    duplicates            : {r.duplicates_removed:,}")
        print(f"    excluded labels       : {r.labels_excluded}")

    print("\n  COMBINED")
    for k, v in total.as_dict().items():
        print(f"    {k}: {v}")

    unexpected = set(df["label"].unique()) - set(TRAINABLE_CLASSES)
    if unexpected:
        print(f"\n  STOP: unexpected class(es) after mapping: {sorted(unexpected)}")
        return 2

    present = sorted(df["label"].unique())
    missing = [c for c in TRAINABLE_CLASSES if c not in present]
    if missing:
        print(f"\n  WARNING: no rows for {missing}. Training on {len(present)} classes.")

    X = df[list(FEATURE_ORDER)].to_numpy(dtype="float64")
    y = df["label"]

    print("\n" + "=" * 70)
    print("STEP 18  MAJORITY-CLASS BASELINE")
    print("=" * 70)
    base = majority_baseline(y)
    for k, v in base.items():
        print(f"  {k}: {v}")

    print("\n" + "=" * 70)
    print("STEP 12-15  RANDOM FOREST")
    print("=" * 70)
    # Stratified, NOT temporal. BOTNET, DDOS and BRUTE_FORCE each occur in a
    # single capture day, so a day-based holdout would delete those classes
    # from training entirely. Claiming a temporal holdout here would be false.
    X_tr, X_tmp, y_tr, y_tmp = train_test_split(X, y, test_size=0.30, stratify=y, random_state=SEED)
    X_val, X_te, y_val, y_te = train_test_split(X_tmp, y_tmp, test_size=0.50, stratify=y_tmp, random_state=SEED)
    print(f"  train {len(y_tr):,}  val {len(y_val):,}  test {len(y_te):,}")

    rf = RandomForestClassifier(
        n_estimators=args.rf_estimators, min_samples_leaf=2,
        class_weight="balanced_subsample", n_jobs=-1, random_state=SEED,
    )
    rf.fit(X_tr, y_tr)

    labels = sorted(y.unique())
    val_metrics = evaluate(y_val, rf.predict(X_val), labels)
    test_metrics = evaluate(y_te, rf.predict(X_te), labels)
    print(f"\n  VALIDATION macro-F1 {val_metrics['macro_f1']:.4f}  accuracy {val_metrics['accuracy']:.4f}")
    print(f"  TEST       macro-F1 {test_metrics['macro_f1']:.4f}  accuracy {test_metrics['accuracy']:.4f}")
    print(f"  baseline   macro-F1 {base['macro_f1']:.4f}")
    print(f"  improvement over baseline: {test_metrics['macro_f1'] - base['macro_f1']:+.4f}")
    print("\n  PER-CLASS (test):")
    for cls in labels:
        m = test_metrics["per_class"].get(cls, {})
        print(f"    {cls:12} P {m.get('precision',0):.4f}  R {m.get('recall',0):.4f}  "
              f"F1 {m.get('f1-score',0):.4f}  support {int(m.get('support',0)):,}")
    print("\n  CONFUSION MATRIX (rows=true, cols=pred):")
    print("    " + " ".join(f"{c[:9]:>10}" for c in labels))
    for i, row in enumerate(test_metrics["confusion_matrix"]["matrix"]):
        print(f"    {labels[i][:11]:11} " + " ".join(f"{v:>10,}" for v in row))

    print("\n" + "=" * 70)
    print("STEP 16, 20  ISOLATION FOREST (BENIGN only)")
    print("=" * 70)
    benign = df[df["label"] == "BENIGN"]
    Xb = benign[list(FEATURE_ORDER)].to_numpy(dtype="float64")
    Xb_tr, Xb_ho = train_test_split(Xb, test_size=0.20, random_state=SEED)

    iso = IsolationForest(n_estimators=args.if_estimators, max_samples="auto",
                          contamination="auto", n_jobs=-1, random_state=SEED)
    iso.fit(Xb_tr)

    # Normalisation percentiles come from BENIGN TRAINING scores, never from an
    # uploaded batch. Batch-relative scaling would make a flow's score depend on
    # what else was in the file, destroying determinism.
    train_scores = iso.score_samples(Xb_tr)
    p01, p05, p50 = (float(np.percentile(train_scores, q)) for q in (1, 5, 50))
    threshold = p05

    ho_scores = iso.score_samples(Xb_ho)
    fp = int((ho_scores < threshold).sum())
    attacks = df[df["label"] != "BENIGN"]
    atk_scores = iso.score_samples(attacks[list(FEATURE_ORDER)].to_numpy(dtype="float64")) if len(attacks) else np.array([])
    det = int((atk_scores < threshold).sum()) if len(atk_scores) else 0

    if_metrics = {
        "trained_on_benign_rows": int(len(Xb_tr)),
        "holdout_benign_rows": int(len(Xb_ho)),
        "threshold_percentile": 5,
        "threshold_score": threshold,
        "normalisation": {"p01": p01, "p50": p50},
        "false_positive_rate_holdout": float(fp / len(Xb_ho)) if len(Xb_ho) else None,
        "false_positives": fp,
        "attack_detection_rate": float(det / len(atk_scores)) if len(atk_scores) else None,
        "attack_rows_scored": int(len(atk_scores)),
    }
    for k, v in if_metrics.items():
        print(f"  {k}: {v}")

    print("\n" + "=" * 70)
    print("STEP 21-24  ARTIFACTS")
    print("=" * 70)
    import joblib
    rf_path = out / "random_forest" / "rf.joblib"
    if_path = out / "isolation_forest" / "isolation_forest.joblib"
    joblib.dump({"model": rf, "feature_order": list(FEATURE_ORDER), "classes": list(rf.classes_)}, rf_path)
    joblib.dump({"model": iso, "feature_order": list(FEATURE_ORDER),
                 "p01": p01, "p50": p50, "threshold": threshold}, if_path)

    card = {
        "model_version": MODEL_VERSION,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "random_seed": SEED,
        "dataset": {
            "name": DATASET_NAME,
            "files_used": sorted(per_file.keys()),
            "per_file_reports": {k: v.as_dict() for k, v in per_file.items()},
            "combined": total.as_dict(),
        },
        "features": {
            "count": len(FEATURE_ORDER), "order": list(FEATURE_ORDER),
            "raw": list(RAW_FEATURE_NAMES), "engineered": list(ENGINEERED_FEATURE_NAMES),
            "schema_version": SCHEMA_VERSION,
        },
        "classes": labels,
        "classes_not_trainable": ["PORT_SCAN"],
        "split": {
            "strategy": "stratified 70/15/15",
            "temporal_holdout": False,
            "why_not_temporal": ("BOTNET, DDOS and BRUTE_FORCE each occur in a single capture day; "
                                 "a day-based holdout would remove those classes from training."),
            "deduplicated_before_split": True,
        },
        "random_forest": {
            "params": rf.get_params(), "validation": val_metrics, "test": test_metrics,
        },
        "isolation_forest": {"params": iso.get_params(), "metrics": if_metrics},
        "majority_baseline": base,
        "checksums": {"random_forest/rf.joblib": sha256(rf_path),
                      "isolation_forest/isolation_forest.joblib": sha256(if_path)},
        "limitations": [
            "Network-flow detections only. Cannot score R-001 to R-004 (host telemetry absent from CSE-CIC-IDS2018).",
            "PORT_SCAN has no training data in this dataset and is not ML-supported.",
            "Infilteration rows excluded: not in SECURITY_CLASSES.",
            "Stratified split, not temporal. See split.why_not_temporal.",
            "2018 laboratory capture; not representative of current production traffic.",
        ],
    }
    card_path = out / "model_card.json"
    card_path.write_text(json.dumps(card, indent=2, default=str))
    print(f"  {rf_path}\n  {if_path}\n  {card_path}")
    print(f"\n  SHA-256 rf: {card['checksums']['random_forest/rf.joblib']}")
    print(f"  SHA-256 if: {card['checksums']['isolation_forest/isolation_forest.joblib']}")
    print("\nDONE. Paste the output above and the model_card.json.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
