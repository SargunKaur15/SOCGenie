"""
Engineered feature computation — SOCGenie Phase 13-A.

SERVER-SIDE ONLY. The browser sends the 18 raw values; these 4 are derived
here. If a client could supply them, training and serving could diverge with no
way to detect it.

The SAME function is used by training and by inference. That is the whole point
of the module — divergence between the two is undetectable at runtime and
produces confident nonsense.
"""

from __future__ import annotations

import math
from typing import Mapping

from .schema import ENGINEERED_FEATURE_NAMES, FEATURE_ORDER, RAW_FEATURE_NAMES, SchemaError

SHORT_FLOW_MICROSECONDS = 1_000_000
"""Sub-second. CIC-IDS2017 flow_duration is in microseconds."""


class FeatureError(ValueError):
    """Raised when input features are missing, non-numeric or non-finite."""


def _finite(value: object, field: str) -> float:
    """Coerces to a finite float or raises.

    NaN and Inf are rejected rather than substituted: `Flow Bytes/s` is Inf
    whenever duration is zero, and silently replacing that with 0 would teach
    the model that instantaneous flows are ordinary.
    """
    try:
        out = float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        raise FeatureError(f"{field} is not numeric: {value!r}") from None
    if math.isnan(out):
        raise FeatureError(f"{field} is NaN")
    if math.isinf(out):
        raise FeatureError(f"{field} is infinite")
    return out


def compute_engineered(raw: Mapping[str, object]) -> dict[str, float]:
    """Computes the 4 engineered features from the 18 raw values.

    Deterministic: identical input always yields identical output, with no
    dependence on other rows. That property is what lets an uploaded flow score
    the same regardless of what else was in the file.
    """
    missing = [name for name in RAW_FEATURE_NAMES if name not in raw]
    if missing:
        raise FeatureError(f"Missing raw feature(s): {', '.join(missing)}")

    syn = _finite(raw["syn_flag_count"], "syn_flag_count")
    ack = _finite(raw["ack_flag_count"], "ack_flag_count")
    fwd_bytes = _finite(raw["fwd_bytes"], "fwd_bytes")
    fwd_packets = _finite(raw["fwd_packets"], "fwd_packets")
    bwd_packets = _finite(raw["bwd_packets"], "bwd_packets")
    duration = _finite(raw["flow_duration"], "flow_duration")

    # +1 denominators avoid division by zero without discarding the row.
    return {
        "syn_to_ack_ratio": syn / (ack + 1.0),
        "bytes_per_packet_fwd": fwd_bytes / (fwd_packets + 1.0),
        "pkt_rate_asymmetry": (fwd_packets - bwd_packets) / (fwd_packets + bwd_packets + 1.0),
        "is_short_flow": 1.0 if duration < SHORT_FLOW_MICROSECONDS else 0.0,
    }


def build_feature_vector(raw: Mapping[str, object]) -> list[float]:
    """Returns the 22 features in FEATURE_ORDER.

    Ordering is taken from the schema, never from dict iteration order, because
    a reordered vector produces confident wrong predictions with no error.
    """
    values = {name: _finite(raw[name], name) for name in RAW_FEATURE_NAMES if name in raw}
    missing = [n for n in RAW_FEATURE_NAMES if n not in values]
    if missing:
        raise FeatureError(f"Missing raw feature(s): {', '.join(missing)}")

    values.update(compute_engineered(values))

    vector = [values[name] for name in FEATURE_ORDER]
    if len(vector) != len(FEATURE_ORDER):
        raise SchemaError("Feature vector length does not match FEATURE_ORDER.")
    return vector


def assert_feature_order(candidate: list[str]) -> None:
    """Guards a loaded model's expected order against the schema."""
    if tuple(candidate) != FEATURE_ORDER:
        raise SchemaError(
            "Feature order mismatch between the model artifact and schema.py.\n"
            f"  schema: {FEATURE_ORDER}\n  model : {tuple(candidate)}"
        )


__all__ = [
    "FeatureError", "compute_engineered", "build_feature_vector",
    "assert_feature_order", "ENGINEERED_FEATURE_NAMES", "SHORT_FLOW_MICROSECONDS",
]
