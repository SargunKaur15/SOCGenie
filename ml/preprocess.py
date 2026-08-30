"""
Dataset preprocessing — SOCGenie Phase 13-A.

WRITTEN WITHOUT THE DATASET. Every step is implemented and unit-tested against
synthetic frames, but this module has NEVER been run against real CIC-IDS2017
data. Column resolution is delegated to schema.resolve_schema, which raises
rather than guessing.

ORDER MATTERS and is enforced by `prepare`:

    strip column whitespace
      -> resolve schema (raises if any feature is unmapped)
      -> drop leakage columns
      -> normalise labels, drop excluded classes
      -> coerce numerics
      -> replace Inf with NaN, drop those rows
      -> drop NaN rows
      -> DEDUPLICATE
      -> (caller splits AFTER this point)

Deduplication precedes splitting deliberately: splitting first leaves identical
flows on both sides and inflates every metric. That is the classic CIC-IDS2017
leakage failure.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

import numpy as np
import pandas as pd

from .features.engineer import compute_engineered
from .features.schema import (
    FEATURE_ORDER, LEAKAGE_COLUMNS, RAW_FEATURE_NAMES, SchemaError,
    normalise_label, resolve_schema,
)

LABEL_CANDIDATES = ("Label", "label", "Attack", " Label")


@dataclass
class PreprocessReport:
    """Measured counts. Every field is filled from the actual run — a value
    that stays None means the step did not execute."""
    rows_in: int = 0
    rows_out: int = 0
    leakage_columns_dropped: list[str] = field(default_factory=list)
    inf_rows_dropped: int = 0
    nan_rows_dropped: int = 0
    duplicates_removed: int = 0
    header_rows_removed: int = 0
    invalid_duration_rows: int = 0
    labels_excluded: dict[str, int] = field(default_factory=dict)
    class_distribution: dict[str, int] = field(default_factory=dict)

    def as_dict(self) -> dict:
        return {
            "rows_in": self.rows_in,
            "rows_out": self.rows_out,
            "leakage_columns_dropped": self.leakage_columns_dropped,
            "inf_rows_dropped": self.inf_rows_dropped,
            "nan_rows_dropped": self.nan_rows_dropped,
            "duplicates_removed": self.duplicates_removed,
            "header_rows_removed": self.header_rows_removed,
            "invalid_duration_rows": self.invalid_duration_rows,
            "labels_excluded": self.labels_excluded,
            "class_distribution": self.class_distribution,
        }


def strip_columns(df: pd.DataFrame) -> pd.DataFrame:
    """CIC-IDS2017 column names carry leading whitespace. Everything downstream
    assumes this has run."""
    out = df.copy()
    out.columns = [" ".join(str(c).split()) for c in out.columns]
    return out


def find_label_column(df: pd.DataFrame) -> str:
    for candidate in LABEL_CANDIDATES:
        if candidate in df.columns:
            return candidate
    raise SchemaError(
        f"No label column found. Tried: {', '.join(LABEL_CANDIDATES)}. "
        "Inspect df.columns.tolist() and extend LABEL_CANDIDATES."
    )


def drop_header_rows(df: pd.DataFrame, label_col: str, report: PreprocessReport) -> pd.DataFrame:
    """Removes repeated CSV header rows.

    Several CSE-CIC-IDS2018 exports were produced by concatenating per-hour
    captures without suppressing the header, so the header line reappears
    mid-file as a data row. Such a row has the literal string "Label" in the
    label column and non-numeric text in every feature column.

    Left in place they would either raise in `normalise_label` (an unrecognised
    label) or, worse, survive as a bogus class. They are dropped HERE — before
    label mapping and before numeric coercion — so the count is reported
    separately rather than being hidden inside the NaN total.

    Matching is exact on the trimmed, case-folded value. Only the literal word
    "Label" qualifies: every genuine class name, including "Benign",
    "Bot", "DoS attacks-Hulk", "Brute Force -Web" and "Infilteration",
    is left untouched.
    """
    values = df[label_col].astype(str).str.strip().str.casefold()
    header_mask = values == "label"
    count = int(header_mask.sum())
    report.header_rows_removed = count
    return df.loc[~header_mask].copy() if count else df


def drop_leakage(df: pd.DataFrame, report: PreprocessReport) -> pd.DataFrame:
    present = [c for c in LEAKAGE_COLUMNS if c in df.columns]
    report.leakage_columns_dropped = present
    return df.drop(columns=present) if present else df


def map_labels(df: pd.DataFrame, label_col: str, report: PreprocessReport) -> pd.DataFrame:
    """Maps to SOCGenie classes; excluded labels are dropped and counted.
    An unrecognised label raises — a dataset surprise must be looked at."""
    mapped = df[label_col].map(normalise_label)
    excluded_mask = mapped.isna()
    if excluded_mask.any():
        counts = df.loc[excluded_mask, label_col].value_counts().to_dict()
        report.labels_excluded = {str(k): int(v) for k, v in counts.items()}
    out = df.loc[~excluded_mask].copy()
    out["label"] = mapped.loc[~excluded_mask]
    return out.drop(columns=[label_col])


def clean_numeric(df: pd.DataFrame, feature_cols: list[str], report: PreprocessReport) -> pd.DataFrame:
    """Coerces features to numeric, then removes Inf and NaN rows.

    Inf is NOT clipped to a large constant: Flow Bytes/s is Inf when duration is
    zero, and substituting a number would invent a measurement.
    """
    out = df.copy()
    for col in feature_cols:
        out[col] = pd.to_numeric(out[col], errors="coerce")

    before = len(out)
    inf_mask = np.isinf(out[feature_cols].to_numpy(dtype="float64", na_value=np.nan)).any(axis=1)
    out = out.loc[~inf_mask]
    report.inf_rows_dropped = before - len(out)

    before = len(out)
    out = out.dropna(subset=feature_cols)
    report.nan_rows_dropped = before - len(out)
    return out


def drop_invalid_duration(df: pd.DataFrame, report: PreprocessReport) -> pd.DataFrame:
    """Removes rows with a negative Flow Duration.

    A flow cannot last a negative time. Such rows appear in CICFlowMeter output
    where the capture clock stepped backwards. They are counted SEPARATELY from
    NaN and Inf so the report distinguishes "sensor produced nonsense" from
    "value could not be computed" — two different data-quality stories.

    Zero duration is KEPT: an instantaneous single-packet flow is real, and it
    is precisely what makes Flow Byts/s infinite, which the Inf step handles.
    """
    if "flow_duration" not in df.columns:
        return df
    duration = pd.to_numeric(df["flow_duration"], errors="coerce")
    invalid = duration < 0
    count = int(invalid.fillna(False).sum())
    report.invalid_duration_rows = count
    return df.loc[~invalid.fillna(False)].copy() if count else df


def deduplicate(df: pd.DataFrame, subset: list[str], report: PreprocessReport) -> pd.DataFrame:
    """MUST run before any train/test split."""
    before = len(df)
    out = df.drop_duplicates(subset=subset)
    report.duplicates_removed = before - len(out)
    return out


def add_engineered(df: pd.DataFrame) -> pd.DataFrame:
    """Uses the same function as inference — never a vectorised re-implementation."""
    out = df.copy()
    computed = [compute_engineered(row) for row in out[list(RAW_FEATURE_NAMES)].to_dict("records")]
    for name in computed[0].keys() if computed else []:
        out[name] = [c[name] for c in computed]
    return out


def prepare(df: pd.DataFrame, label_col: Optional[str] = None) -> tuple[pd.DataFrame, PreprocessReport]:
    """Full pipeline. Returns the cleaned frame plus a measured report."""
    report = PreprocessReport(rows_in=len(df))

    work = strip_columns(df)
    mapping = resolve_schema(work.columns.tolist())          # raises if unmapped
    work = work.rename(columns={src: name for name, src in mapping.items()})

    label = label_col or find_label_column(work)
    # Repeated headers are removed FIRST: they are not data, and every later
    # step (label mapping, numeric coercion) would misinterpret them.
    work = drop_header_rows(work, label, report)
    work = drop_leakage(work, report)
    work = map_labels(work, label, report)
    work = drop_invalid_duration(work, report)
    work = clean_numeric(work, list(RAW_FEATURE_NAMES), report)
    work = deduplicate(work, list(RAW_FEATURE_NAMES) + ["label"], report)
    work = add_engineered(work)

    work = work[list(FEATURE_ORDER) + ["label"]]
    report.rows_out = len(work)
    report.class_distribution = {str(k): int(v) for k, v in work["label"].value_counts().items()}
    return work, report


__all__ = [
    "PreprocessReport", "prepare", "strip_columns", "find_label_column",
    "drop_header_rows", "drop_leakage", "map_labels", "clean_numeric",
    "drop_invalid_duration", "load_directory",
    "deduplicate", "add_engineered",
]


# ── Multi-file loading ──────────────────────────────────────────────────────

def load_directory(
    directory: str | Path,
    pattern: str = "*.csv",
    chunksize: int | None = 500_000,
) -> tuple[pd.DataFrame, dict[str, PreprocessReport], PreprocessReport]:
    """Cleans every CSV in a directory and concatenates the results.

    Files are processed ONE AT A TIME and optionally in chunks, because the
    full CSE-CIC-IDS2018 set is several GB and loading it whole will exhaust
    memory on a laptop.

    Deduplication runs per file here AND again across the combined frame in
    `prepare_dataset`, because identical flows can appear in two capture days.

    Returns (combined frame, per-file reports, combined report). Every count is
    measured — nothing is estimated.
    """
    from pathlib import Path as _Path

    root = _Path(directory)
    files = sorted(root.glob(pattern))
    if not files:
        raise SchemaError(f"No CSV files matched {pattern} in {root}")

    per_file: dict[str, PreprocessReport] = {}
    frames: list[pd.DataFrame] = []

    for path in files:
        reports: list[PreprocessReport] = []
        pieces: list[pd.DataFrame] = []
        reader = pd.read_csv(path, chunksize=chunksize, low_memory=False) if chunksize else [pd.read_csv(path, low_memory=False)]
        for chunk in reader:
            cleaned, rep = prepare(chunk)
            pieces.append(cleaned)
            reports.append(rep)

        merged = PreprocessReport()
        for r in reports:
            merged.rows_in += r.rows_in
            merged.rows_out += r.rows_out
            merged.header_rows_removed += r.header_rows_removed
            merged.invalid_duration_rows += r.invalid_duration_rows
            merged.inf_rows_dropped += r.inf_rows_dropped
            merged.nan_rows_dropped += r.nan_rows_dropped
            merged.duplicates_removed += r.duplicates_removed
            merged.leakage_columns_dropped = r.leakage_columns_dropped
            for k, v in r.labels_excluded.items():
                merged.labels_excluded[k] = merged.labels_excluded.get(k, 0) + v
            for k, v in r.class_distribution.items():
                merged.class_distribution[k] = merged.class_distribution.get(k, 0) + v

        per_file[path.name] = merged
        if pieces:
            frames.append(pd.concat(pieces, ignore_index=True))

    combined = pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()

    total = PreprocessReport()
    for r in per_file.values():
        total.rows_in += r.rows_in
        total.header_rows_removed += r.header_rows_removed
        total.invalid_duration_rows += r.invalid_duration_rows
        total.inf_rows_dropped += r.inf_rows_dropped
        total.nan_rows_dropped += r.nan_rows_dropped
        total.duplicates_removed += r.duplicates_removed
        for k, v in r.labels_excluded.items():
            total.labels_excluded[k] = total.labels_excluded.get(k, 0) + v

    # Cross-file deduplication: the same flow can appear in two capture days.
    before = len(combined)
    if before:
        combined = combined.drop_duplicates(subset=list(FEATURE_ORDER) + ["label"])
        total.duplicates_removed += before - len(combined)

    total.rows_out = len(combined)
    total.class_distribution = (
        {str(k): int(v) for k, v in combined["label"].value_counts().items()} if len(combined) else {}
    )
    return combined, per_file, total
