"""Request/response contracts for the ML service — Phase 13-A."""
from __future__ import annotations
from typing import Any, Optional

MAX_FLOWS_PER_REQUEST = 500


class ValidationError(ValueError):
    pass


def validate_score_request(body: Any) -> list[dict]:
    """Validates a /score payload. Raises ValidationError with a safe message.

    Only the 18 RAW features are accepted. Engineered features are computed
    server-side, so a client cannot influence them.
    """
    from ..features.schema import RAW_FEATURE_NAMES

    if not isinstance(body, dict):
        raise ValidationError("Body must be a JSON object.")
    flows = body.get("flows")
    if not isinstance(flows, list) or not flows:
        raise ValidationError("`flows` must be a non-empty array.")
    if len(flows) > MAX_FLOWS_PER_REQUEST:
        raise ValidationError(f"At most {MAX_FLOWS_PER_REQUEST} flows per request.")

    allowed = set(RAW_FEATURE_NAMES)
    out: list[dict] = []
    for i, flow in enumerate(flows):
        if not isinstance(flow, dict):
            raise ValidationError(f"flows[{i}] must be an object.")
        unexpected = set(flow) - allowed
        if unexpected:
            raise ValidationError(f"flows[{i}] has unexpected field(s): {', '.join(sorted(unexpected))}.")
        missing = allowed - set(flow)
        if missing:
            raise ValidationError(f"flows[{i}] is missing: {', '.join(sorted(missing))}.")
        out.append(flow)
    return out


def unavailable_response(reason: str, schema_version: str) -> dict:
    """The ONLY response shape when no model is loaded. Never a prediction."""
    return {
        "available": False,
        "reason": reason,
        "model_version": None,
        "schema_version": schema_version,
        "predictions": [],
    }


def success_response(
    predictions: list[dict], model_version: str, schema_version: str
) -> dict:
    return {
        "available": True,
        "reason": None,
        "model_version": model_version,
        "schema_version": schema_version,
        "predictions": predictions,
    }


def prediction(
    index: int, label: str, ml_confidence: float, anomaly_score: float
) -> dict:
    """Applies the BENIGN rule at the point of construction.

    predict_proba().max() on a confidently benign flow returns ~0.99. Passed
    through, that would add ~25 risk points to traffic the model just judged
    harmless. When the predicted class is BENIGN, ml_confidence is 0.
    """
    is_benign = label == "BENIGN"
    return {
        "index": index,
        "label": label,
        "ml_confidence": 0.0 if is_benign else max(0.0, min(1.0, float(ml_confidence))),
        "anomaly_score": max(0.0, min(1.0, float(anomaly_score))),
        "is_benign": is_benign,
    }


def normalise_anomaly(raw_score: float, p01: Optional[float], p50: Optional[float]) -> float:
    """Normalises an IsolationForest score using TRAINING-derived percentiles.

    Deliberately not batch-relative: normalising against the uploaded file would
    make a flow's score depend on what else happened to be in it, destroying the
    determinism the detection engine is built on.
    """
    if p01 is None or p50 is None or p50 == p01:
        raise ValidationError("Anomaly normalisation requires p01 and p50 from the model card.")
    return max(0.0, min(1.0, (p50 - raw_score) / (p50 - p01)))
