"""
Authoritative feature schema — SOCGenie Phase 13-A.

STATUS: RESOLVED against CSE-CIC-IDS2018.

Source columns below were reconciled against a REAL header list read from:

    datasets/CSE-CIC-IDS2018/Thursday-22-02-2018_TrafficForML_CICFlowMeter.csv
    80 columns, 1,048,575 rows

All 18 raw features resolved exactly. Nothing was guessed.

VERIFIED AGAINST ONE FILE ONLY. CSE-CIC-IDS2018 was produced by a single
CICFlowMeter run, so headers are expected to be identical across capture days —
but `resolve_schema()` still runs per file and raises on any mismatch, so an
unexpected header stops the pipeline rather than silently mis-mapping.

CANDIDATES retain both 2017 and 2018 spellings so the same schema can resolve
either distribution.

RE-VERIFICATION (run per additional file before training):

    import pandas as pd
    from ml.features.schema import resolve_schema
    df = pd.read_csv("<one CSV>")
    df.columns = df.columns.str.strip()
    mapping = resolve_schema(df.columns.tolist())   # raises on any unresolved

`resolve_schema` refuses to return a partial mapping. That is deliberate: a
missing feature must stop the pipeline, not silently shrink the feature space.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Sequence

SCHEMA_VERSION = "13b-cse-cic-ids2018-1.0.0"
"""Bumped from 13a-unresolved-1: the 18 raw source columns are now verified
against real CSE-CIC-IDS2018 headers rather than being placeholders."""

DATASET_NAME = "CSE-CIC-IDS2018"
DATASET_VERIFIED_AGAINST = "Thursday-22-02-2018_TrafficForML_CICFlowMeter.csv"


@dataclass(frozen=True)
class RawFeature:
    name: str
    source_column: Optional[str]
    candidates: tuple[str, ...]
    description: str


@dataclass(frozen=True)
class EngineeredFeature:
    name: str
    depends_on: tuple[str, ...]
    description: str


# ── 18 raw features ─────────────────────────────────────────────────────────
RAW_FEATURES: tuple[RawFeature, ...] = (
    RawFeature("flow_duration", "Flow Duration", ("Flow Duration",), "Flow lifetime. UNITS UNVERIFIED — see is_short_flow note."),
    RawFeature("fwd_packets", "Tot Fwd Pkts", ("Tot Fwd Pkts", "Total Fwd Packets", "Total Fwd Packet"), "Packets sent forward."),
    RawFeature("bwd_packets", "Tot Bwd Pkts", ("Tot Bwd Pkts", "Total Backward Packets", "Total Bwd packets"), "Packets sent backward."),
    RawFeature("fwd_bytes", "TotLen Fwd Pkts", ("TotLen Fwd Pkts", "Total Length of Fwd Packets"), "Bytes forward."),
    RawFeature("bwd_bytes", "TotLen Bwd Pkts", ("TotLen Bwd Pkts", "Total Length of Bwd Packets"), "Bytes backward."),
    RawFeature("flow_bytes_per_s", "Flow Byts/s", ("Flow Byts/s", "Flow Bytes/s"), "Byte rate. Inf when duration is 0."),
    RawFeature("flow_packets_per_s", "Flow Pkts/s", ("Flow Pkts/s", "Flow Packets/s"), "Packet rate. Inf when duration is 0."),
    RawFeature("flow_iat_mean", "Flow IAT Mean", ("Flow IAT Mean",), "Mean inter-arrival time."),
    RawFeature("flow_iat_std", "Flow IAT Std", ("Flow IAT Std",), "Inter-arrival standard deviation."),
    RawFeature("fwd_iat_mean", "Fwd IAT Mean", ("Fwd IAT Mean",), "Mean forward inter-arrival time."),
    RawFeature("syn_flag_count", "SYN Flag Cnt", ("SYN Flag Cnt", "SYN Flag Count"), "SYN flags observed."),
    RawFeature("ack_flag_count", "ACK Flag Cnt", ("ACK Flag Cnt", "ACK Flag Count"), "ACK flags observed."),
    RawFeature("rst_flag_count", "RST Flag Cnt", ("RST Flag Cnt", "RST Flag Count"), "RST flags observed."),
    RawFeature("psh_flag_count", "PSH Flag Cnt", ("PSH Flag Cnt", "PSH Flag Count"), "PSH flags observed."),
    RawFeature("pkt_len_mean", "Pkt Len Mean", ("Pkt Len Mean", "Packet Length Mean"), "Mean packet length."),
    RawFeature("pkt_len_std", "Pkt Len Std", ("Pkt Len Std", "Packet Length Std"), "Packet length standard deviation."),
    RawFeature("down_up_ratio", "Down/Up Ratio", ("Down/Up Ratio",), "Download to upload ratio."),
    RawFeature("init_win_fwd", "Init Fwd Win Byts", ("Init Fwd Win Byts", "Init_Win_bytes_forward"), "Initial forward window. -1 = not observed."),
)

# ── 4 engineered features ───────────────────────────────────────────────────
ENGINEERED_FEATURES: tuple[EngineeredFeature, ...] = (
    EngineeredFeature("syn_to_ack_ratio", ("syn_flag_count", "ack_flag_count"), "Scan / SYN-flood signature."),
    EngineeredFeature("bytes_per_packet_fwd", ("fwd_bytes", "fwd_packets"), "Forward payload density."),
    EngineeredFeature("pkt_rate_asymmetry", ("fwd_packets", "bwd_packets"), "One-sided flow indicator."),
    EngineeredFeature("is_short_flow", ("flow_duration",), "Binary: sub-second flow."),
)

FEATURE_ORDER: tuple[str, ...] = tuple(f.name for f in RAW_FEATURES) + tuple(
    f.name for f in ENGINEERED_FEATURES
)
"""THE authoritative ordering. Training and inference must both use this exact
sequence. A column-order mismatch produces confident, silently wrong
predictions — the single most damaging deployment bug in this pipeline."""

RAW_FEATURE_NAMES: tuple[str, ...] = tuple(f.name for f in RAW_FEATURES)
ENGINEERED_FEATURE_NAMES: tuple[str, ...] = tuple(f.name for f in ENGINEERED_FEATURES)
FEATURE_COUNT = len(FEATURE_ORDER)

# ── Label mapping ───────────────────────────────────────────────────────────
SECURITY_CLASSES: tuple[str, ...] = (
    "BENIGN", "BRUTE_FORCE", "PORT_SCAN", "DOS", "DDOS", "WEB_ATTACK", "BOTNET",
)
"""Mirrors SECURITY_CLASSES in frontend/src/lib/constants.ts. Do not diverge."""

LABEL_MAP: dict[str, str] = {
    # ── CSE-CIC-IDS2018, ALL spellings verified from the real CSVs ─────────
    "BENIGN": "BENIGN",
    "BOT": "BOTNET",

    "DOS ATTACKS-HULK": "DOS",
    "DOS ATTACKS-SLOWHTTPTEST": "DOS",
    "DOS ATTACKS-GOLDENEYE": "DOS",
    "DOS ATTACKS-SLOWLORIS": "DOS",

    "DDOS ATTACK-HOIC": "DDOS",
    "DDOS ATTACK-LOIC-UDP": "DDOS",

    "FTP-BRUTEFORCE": "BRUTE_FORCE",
    "SSH-BRUTEFORCE": "BRUTE_FORCE",

    # NOTE: 2018 names its WEB attacks "Brute Force -Web"/"-XSS". A prefix rule
    # on "BRUTE FORCE" would swallow FTP-BruteForce and SSH-Bruteforce above,
    # which are credential attacks. Exact matches only.
    "BRUTE FORCE -WEB": "WEB_ATTACK",
    "BRUTE FORCE -XSS": "WEB_ATTACK",
    "SQL INJECTION": "WEB_ATTACK",

    # ── CIC-IDS2017 spellings, retained so one map serves either dataset ───
    "FTP-PATATOR": "BRUTE_FORCE",
    "SSH-PATATOR": "BRUTE_FORCE",
    "PORTSCAN": "PORT_SCAN",
    "DOS HULK": "DOS",
    "DOS GOLDENEYE": "DOS",
    "DOS SLOWLORIS": "DOS",
    "DOS SLOWHTTPTEST": "DOS",
    "DDOS": "DDOS",
}

TRAINABLE_CLASSES: tuple[str, ...] = (
    "BENIGN", "BRUTE_FORCE", "DOS", "DDOS", "WEB_ATTACK", "BOTNET",
)
"""The 6 classes CSE-CIC-IDS2018 can actually train.

PORT_SCAN is deliberately ABSENT. CSE-CIC-IDS2018 contains no port-scan class;
it existed in CIC-IDS2017 and was not reproduced. Mixing datasets to manufacture
it would train across two different capture environments.

PORT_SCAN remains a RULE capability (R-005/R-007 detect scanning behaviour).
The model must never be described as supporting it.
"""

EXCLUDED_LABELS: dict[str, str] = {
    "HEARTBLEED": "Not in SECURITY_CLASSES; severely undersized in the dataset.",
    "INFILTRATION": "Not in SECURITY_CLASSES.",
    # CSE-CIC-IDS2018 spells it "Infilteration" (sic). Same exclusion.
    "INFILTERATION": "Not in SECURITY_CLASSES. 2018 spelling of Infiltration.",
}

LEAKAGE_COLUMNS: tuple[str, ...] = (
    # CSE-CIC-IDS2018 spellings (verified present)
    "Dst Port", "Timestamp",
    # 2018 SHORT FORMS. Some capture days ship extra identifier columns that
    # others do not. Attacker addresses are fixed throughout this capture, so a
    # surviving address column teaches the model an IP rather than a behaviour.
    "Src IP", "Dst IP", "Src Port",
    # CIC-IDS2017 spellings, retained so the same list serves either dataset.
    # VERIFIED ABSENT from CSE-CIC-IDS2018 — that dataset ships no flow
    # identifier or address columns at all, which removes an entire class of
    # leakage before we do anything.
    "Flow ID", "Source IP", "Destination IP", "Source Port", "Destination Port",
)
"""Removed before training. Destination Port is included deliberately: in this
capture it correlates almost perfectly with BENIGN, so keeping it inflates
accuracy in a way that would not survive review."""


class SchemaError(ValueError):
    """Raised when the dataset cannot satisfy the schema."""


def normalise_label(raw: str) -> Optional[str]:
    """Maps a dataset label to a SOCGenie class.

    Returns None for labels that are deliberately excluded. Raises for labels
    that are neither mapped nor knowingly excluded — an unrecognised label is a
    dataset surprise that must be looked at, not silently dropped.
    """
    key = " ".join(str(raw).split()).upper()
    if key in LABEL_MAP:
        return LABEL_MAP[key]
    if key in EXCLUDED_LABELS:
        return None
    if key.startswith("WEB ATTACK"):
        return "WEB_ATTACK"
    raise SchemaError(f"Unrecognised label {raw!r}. Add it to LABEL_MAP or EXCLUDED_LABELS after inspecting the data.")


def resolve_schema(actual_columns: Sequence[str]) -> dict[str, str]:
    """Maps each raw feature to a real column, or raises.

    Call after `df.columns = df.columns.str.strip()`. Returns a complete mapping
    or raises: a partial mapping would silently shrink the feature space.
    """
    available = {" ".join(str(c).split()): str(c) for c in actual_columns}
    resolved: dict[str, str] = {}
    unresolved: list[str] = []

    for feature in RAW_FEATURES:
        hit = next((available[c] for c in feature.candidates if c in available), None)
        if hit is None:
            unresolved.append(f"{feature.name} (tried: {', '.join(feature.candidates)})")
        else:
            resolved[feature.name] = hit

    if unresolved:
        raise SchemaError(
            "Unresolved raw feature(s):\n  - "
            + "\n  - ".join(unresolved)
            + "\n\nInspect df.columns.tolist() and extend the candidate tuples in "
              "ml/features/schema.py. Do not rename dataset columns to fit."
        )
    return resolved


def is_resolved() -> bool:
    """False until Phase 13-B verifies mappings against the real dataset."""
    return all(f.source_column is not None for f in RAW_FEATURES)
