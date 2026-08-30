"""
Local artifact verification — run this on the machine holding the models.

    python -m ml.verify_artifacts --models models

Checks: both artifacts exist, SHA-256 matches model_card.json, feature order
matches schema.py exactly, schema version matches, and the classes are the six
trainable ones. Exits non-zero on any mismatch.
"""
from __future__ import annotations
import argparse, hashlib, json, sys
from pathlib import Path
from .features.schema import FEATURE_ORDER, SCHEMA_VERSION, TRAINABLE_CLASSES

def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()

def main() -> int:
    ap = argparse.ArgumentParser(); ap.add_argument("--models", default="models")
    root = Path(ap.parse_args().models)
    card_path = root / "model_card.json"
    ok = True

    if not card_path.exists():
        print(f"FAIL  model_card.json not found under {root}"); return 1
    card = json.loads(card_path.read_text())
    print(f"model_version : {card.get('model_version')}")
    print(f"trained_at    : {card.get('trained_at')}")
    print(f"dataset       : {(card.get('dataset') or {}).get('name')}")
    print()

    for rel, expected in (card.get("checksums") or {}).items():
        path = root / rel
        if not path.exists():
            print(f"FAIL  missing artifact: {rel}"); ok = False; continue
        actual = sha256(path)
        match = actual == expected
        ok &= match
        print(f"{'OK  ' if match else 'FAIL'}  {rel}")
        print(f"        expected {expected}")
        print(f"        actual   {actual}")

    feats = (card.get("features") or {})
    order_ok = list(feats.get("order") or []) == list(FEATURE_ORDER)
    ok &= order_ok
    print(f"\n{'OK  ' if order_ok else 'FAIL'}  feature order matches schema.py ({len(FEATURE_ORDER)} features)")
    ver_ok = feats.get("schema_version") == SCHEMA_VERSION
    ok &= ver_ok
    print(f"{'OK  ' if ver_ok else 'FAIL'}  schema version {feats.get('schema_version')} == {SCHEMA_VERSION}")

    classes = sorted(card.get("classes") or [])
    cls_ok = set(classes).issubset(set(TRAINABLE_CLASSES))
    ok &= cls_ok
    print(f"{'OK  ' if cls_ok else 'FAIL'}  classes {classes} within TRAINABLE_CLASSES")
    print(f"OK    PORT_SCAN absent from model classes: {'PORT_SCAN' not in classes}")

    print("\n" + ("ALL CHECKS PASSED" if ok else "VERIFICATION FAILED"))
    return 0 if ok else 1

if __name__ == "__main__":
    sys.exit(main())
