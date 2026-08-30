"""
SOCGenie ML inference service — Phase 13-C.

Loads the REAL Phase 13-B artifacts and scores flows. Binds 127.0.0.1 only;
the browser never reaches it, the Node proxy does.

FAIL-CLOSED ON INTEGRITY. joblib.load executes pickle, so a model file is
untrusted input. Both artifacts are SHA-256 verified against model_card.json
BEFORE loading. On mismatch the service refuses to load and reports why — it
never proceeds anyway.

If anything is missing, corrupt or mismatched the service still STARTS and
reports available:false, so SOCGenie keeps working on Phase 12 rules alone.
It never fabricates a prediction.
"""


import hashlib
import json
import os
from pathlib import Path
from typing import Any, Optional

from ..features.schema import SCHEMA_VERSION
from ..features.engineer import FeatureError, build_feature_vector
from .schemas import (ValidationError, normalise_anomaly, prediction, success_response,
                      unavailable_response, validate_score_request)

MODELS_DIR = Path(os.environ.get("SOCGENIE_MODELS_DIR", "models"))
MODEL_CARD = MODELS_DIR / "model_card.json"

_state: dict[str, Any] = {
    "loaded": False, "reason": "No trained model present.", "model_version": None,
    "rf": None, "iso": None, "classes": [], "p01": None, "p50": None,
    "threshold": None, "card": None,
}


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verify_artifacts(card: dict) -> Optional[str]:
    """Checksum gate. joblib.load executes pickle, so a model file is untrusted
    input. On mismatch the service refuses to load — it does not proceed anyway."""
    checksums = card.get("checksums") or {}
    if not checksums:
        return "model_card.json contains no checksums."
    for filename, expected in checksums.items():
        path = MODELS_DIR / filename
        if not path.exists():
            return f"Artifact missing: {filename}"
        if sha256_of(path) != expected:
            return f"Checksum mismatch for {filename}. Refusing to load."
    return None


def load_models() -> None:
    """Attempts to load artifacts. Absence is a normal, expected state."""
    if not MODEL_CARD.exists():
        _state.update(loaded=False, reason="No trained model present.", model_version=None)
        return
    try:
        card = json.loads(MODEL_CARD.read_text())
    except (OSError, json.JSONDecodeError):
        _state.update(loaded=False, reason="model_card.json is unreadable.", model_version=None)
        return

    problem = verify_artifacts(card)
    if problem:
        _state.update(loaded=False, reason=problem, model_version=None)
        return

    # Integrity verified above. Only now is pickle executed.
    try:
        import joblib
        from ..features.engineer import assert_feature_order

        rf_bundle = joblib.load(MODELS_DIR / "random_forest" / "rf.joblib")
        if_bundle = joblib.load(MODELS_DIR / "isolation_forest" / "isolation_forest.joblib")

        # A reordered vector yields confident, silently wrong predictions, so
        # both artifacts are checked against the schema before use.
        assert_feature_order(list(rf_bundle["feature_order"]))
        assert_feature_order(list(if_bundle["feature_order"]))

        p01, p50 = float(if_bundle["p01"]), float(if_bundle["p50"])
        if p50 == p01:
            _state.update(loaded=False, reason="Isolation Forest percentiles are degenerate.", model_version=None)
            return

        _state.update(
            loaded=True, reason=None, model_version=card.get("model_version"),
            rf=rf_bundle["model"], iso=if_bundle["model"],
            classes=list(rf_bundle.get("classes", [])),
            p01=p01, p50=p50, threshold=float(if_bundle["threshold"]),
            card=card,
        )
    except Exception as exc:  # noqa: BLE001 - any failure must fail closed
        # Type only. A path or pickle internals must never reach the client.
        _state.update(loaded=False, reason=f"Artifact load failed ({type(exc).__name__}).", model_version=None)


def build_app():  # pragma: no cover - requires fastapi
    from fastapi import FastAPI, Request
    from fastapi.responses import JSONResponse

    app = FastAPI(title="SOCGenie ML", docs_url=None, redoc_url=None)
    load_models()

    @app.get("/health")
    def health() -> dict:
        return {"status": "ok", "model_loaded": _state["loaded"], "schema_version": SCHEMA_VERSION}

    @app.get("/status")
    def status() -> dict:
        card = _state.get("card") or {}
        rf = (card.get("random_forest") or {}).get("test") or {}
        iso = (card.get("isolation_forest") or {}).get("metrics") or {}
        # Non-secret metadata only. No filesystem path is ever exposed.
        return {
            "available": _state["loaded"],
            "reason": _state["reason"],
            "model_version": _state["model_version"],
            "schema_version": SCHEMA_VERSION,
            "classes": _state["classes"],
            "dataset": (card.get("dataset") or {}).get("name"),
            "trained_at": card.get("trained_at"),
            "feature_count": (card.get("features") or {}).get("count"),
            "macro_f1": rf.get("macro_f1"),
            "accuracy": rf.get("accuracy"),
            "benign_holdout_fpr": iso.get("false_positive_rate_holdout"),
            "checksums_verified": _state["loaded"],
        }

    @app.post("/score")
    async def score(request: Request) -> JSONResponse:
        try:
            body = await request.json()
            validate_score_request(body)
        except ValidationError as exc:
            return JSONResponse(status_code=400, content={"error": str(exc), "code": "VALIDATION_ERROR"})
        except Exception:
            return JSONResponse(status_code=400, content={"error": "Malformed JSON.", "code": "VALIDATION_ERROR"})

        if not _state["loaded"]:
            # Controlled unavailable response. Never a fabricated prediction.
            return JSONResponse(status_code=200, content=unavailable_response(_state["reason"], SCHEMA_VERSION))

        try:
            flows = validate_score_request(body)
            # Engineered features are computed HERE by the same code training
            # used. A client cannot supply them, so train/serve cannot diverge.
            matrix = [build_feature_vector(flow) for flow in flows]
        except (ValidationError, FeatureError) as exc:
            return JSONResponse(status_code=400, content={"error": str(exc), "code": "VALIDATION_ERROR"})

        try:
            import numpy as np

            X = np.asarray(matrix, dtype="float64")
            proba = _state["rf"].predict_proba(X)
            classes = list(_state["rf"].classes_)
            raw_scores = _state["iso"].score_samples(X)

            predictions = []
            for i in range(len(matrix)):
                idx = int(proba[i].argmax())
                label = str(classes[idx])
                confidence = float(proba[i][idx])
                anomaly = normalise_anomaly(float(raw_scores[i]), _state["p01"], _state["p50"])
                # prediction() applies the BENIGN rule: a confident benign flow
                # contributes zero ML confidence.
                predictions.append(prediction(i, label, confidence, anomaly))

            return JSONResponse(
                status_code=200,
                content=success_response(predictions, str(_state["model_version"]), SCHEMA_VERSION),
            )
        except Exception as exc:  # noqa: BLE001
            return JSONResponse(status_code=200, content=unavailable_response(f"Scoring failed ({type(exc).__name__}).", SCHEMA_VERSION))

    return app


if __name__ == "__main__":  # pragma: no cover
    import uvicorn
    uvicorn.run(build_app(), host="127.0.0.1", port=8000)
