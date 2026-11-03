# SOCGenie Machine Learning

This document describes the machine-learning component as it exists in the
repository. Every number comes from [`models/model_card.json`](../models/model_card.json),
which the training script writes from a real run; nothing here is estimated. For
the short version see the [README](../README.md#machine-learning).

## Scope

| Item | State |
|---|---|
| Random Forest multi-class classifier | Trained and evaluated |
| Isolation Forest anomaly detector | Trained and evaluated |
| Dataset | CSE-CIC-IDS2018 (nine daily CICFlowMeter CSV files) |
| Serving | FastAPI service, checksum-verified loading, used by the console for flow files |
| Model binaries in this repository | **No**: `*.joblib` files are not committed. Regenerate with `ml.train`. |
| Dataset in this repository | **No**: download it from the dataset's publisher. |
| `PORT_SCAN` class | Not supported by the model (no such class in the dataset) |
| Any other model (deep learning, LLM fine-tuning) | None. The AI assistant uses an external LLM through a proxy; no model is trained for it. |

## Code map

```text
ml/
├── features/
│   ├── schema.py       # the 22-feature schema, label mapping, leakage columns, class list
│   └── engineer.py     # the 4 engineered features; same function at train and serve time
├── preprocess.py       # loading, cleaning, deduplication, label mapping
├── train.py            # python -m ml.train : training, evaluation, artifact writing
├── verify_artifacts.py # python -m ml.verify_artifacts : integrity and schema checks
├── service/
│   ├── app.py          # FastAPI service: /health /status /score
│   └── schemas.py      # request validation, response shapes, anomaly normalisation
├── tests/
│   └── test_phase13a.py# 137 assertions; needs no dataset and no model
└── requirements.txt
models/
└── model_card.json     # full record of the run (the .joblib artifacts are generated)
```

## Dataset

CSE-CIC-IDS2018 is a public dataset of labelled network flows extracted with
CICFlowMeter. Source: Canadian Institute for Cybersecurity,
<https://www.unb.ca/cic/datasets/ids-2018.html>; dataset paper: I. Sharafaldin,
A. H. Lashkari and A. A. Ghorbani, "Toward Generating a New Intrusion Detection
Dataset and Intrusion Traffic Characterization," ICISSP 2018, pp. 108–116.

The nine files used (one per capture day) are:
`Wednesday-14-02-2018`, `Thursday-15-02-2018`, `Friday-16-02-2018`,
`Wednesday-21-02-2018`, `Thursday-22-02-2018`, `Friday-23-02-2018`,
`Wednesday-28-02-2018`, `Thursday-01-03-2018` and `Friday-02-03-2018`, each named
`<day>_TrafficForML_CICFlowMeter.csv`.

Place them in `datasets/CSE-CIC-IDS2018/` (ignored by Git). `ml.train` reads every
`*.csv` in the directory, so do not add other CSV files there.

### Preprocessing

`ml/preprocess.py` produced the following on the real data:

| Step | Rows |
|---|---|
| Read (`rows_in`) | 8,284,254 |
| Repeated CSV header rows removed | 59 |
| Rows with infinite values dropped | 35,012 |
| Rows with invalid duration dropped | 14 |
| Duplicates removed | 2,839,056 |
| Label `Infilteration` excluded (not a security class used here) | 161,934 |
| **Rows after preprocessing** | **5,248,179** |

Identifier and time columns (`Dst Port`, `Timestamp`, and IP and port columns when
present) are excluded from the features, because fixed attacker addresses and ports
would teach the model an address instead of a behaviour. Raw labels are mapped to
six classes; an unrecognised label raises an error instead of being guessed.

| Class | Rows after preprocessing |
|---|---|
| BENIGN | 4,611,533 |
| DDOS | 200,591 |
| DOS | 196,568 |
| BOTNET | 144,535 |
| BRUTE_FORCE | 94,091 |
| WEB_ATTACK | 861 |

The data is heavily imbalanced: `WEB_ATTACK` is under 0.02% of the rows.

## Features

22 features, in the fixed order defined by `FEATURE_ORDER` in `ml/features/schema.py`.

**18 raw features** (CICFlowMeter fields): `flow_duration`, `fwd_packets`,
`bwd_packets`, `fwd_bytes`, `bwd_bytes`, `flow_bytes_per_s`, `flow_packets_per_s`,
`flow_iat_mean`, `flow_iat_std`, `fwd_iat_mean`, `syn_flag_count`, `ack_flag_count`,
`rst_flag_count`, `psh_flag_count`, `pkt_len_mean`, `pkt_len_std`, `down_up_ratio`,
`init_win_fwd`.

**4 engineered features** (`ml/features/engineer.py`):

| Feature | Definition |
|---|---|
| `syn_to_ack_ratio` | `syn_flag_count / (ack_flag_count + 1)` |
| `bytes_per_packet_fwd` | `fwd_bytes / (fwd_packets + 1)` |
| `pkt_rate_asymmetry` | `(fwd_packets − bwd_packets) / (fwd_packets + bwd_packets + 1)` |
| `is_short_flow` | `1` if `flow_duration` < 1,000,000 µs, else `0` |

Engineered features are computed only inside the ML service and by training, using
the same function, so a client cannot supply them and training and serving cannot
diverge. Non-numeric, NaN and infinite inputs are rejected rather than replaced.

## Training

```bash
python -m ml.train --data datasets/CSE-CIC-IDS2018 --out models
```

| Option | Default | Meaning |
|---|---|---|
| `--data` | required | Directory of CICFlowMeter CSV files |
| `--out` | `models` | Output directory |
| `--chunksize` | 500000 | Rows read per chunk; lower it if memory is tight |
| `--rf-estimators` | 150 | Random Forest trees |
| `--if-estimators` | 200 | Isolation Forest trees |

- **Split.** Stratified 70 / 15 / 15 (train / validation / test), seed 42,
  deduplicated before splitting. The split is stratified rather than temporal
  because `BOTNET`, `DDOS` and `BRUTE_FORCE` each occur on a single capture day; a
  day-based hold-out would remove those classes from training.
- **Random Forest.** `RandomForestClassifier`, 150 trees, `class_weight=
  "balanced_subsample"` to counter the imbalance, `random_state=42`, six classes.
- **Isolation Forest.** `IsolationForest`, 200 trees, `contamination="auto"`,
  `random_state=42`. It uses its own random 80 / 20 split of the benign rows
  (seed 42), separate from the 70 / 15 / 15 split above: it is fitted on 3,689,226
  benign rows and evaluated on 922,307 held-out benign rows. Its raw scores are
  normalised to 0..1 with the 1st and 50th percentiles of the benign *training*
  scores, stored with the artifact, so a flow's score never depends on the other
  rows in an uploaded file. The anomaly threshold is the 5th percentile of the
  benign training scores.
- **Outputs.** `random_forest/rf.joblib`, `isolation_forest/isolation_forest.joblib`
  and `model_card.json` (parameters, split, metrics, confusion matrices, baseline,
  checksums and limitations). Model version: `rf-1.0.0+if-1.0.0`.

## Evaluation

Results on the held-out **test** split. The validation split gives nearly identical
figures (accuracy 0.99967, macro F1 0.9612).

| Metric | Random Forest | Majority-class baseline |
|---|---|---|
| Accuracy | 0.9996558 | 0.8786920 |
| Macro precision | 0.9728150 | — |
| Macro recall | 0.9514970 | — |
| Macro F1 | 0.9612393 | 0.1559049 |
| Weighted F1 | 0.9996530 | 0.8219544 |

The baseline always predicts `BENIGN`. Accuracy alone is misleading on this data:
the baseline already scores 87.9% while detecting no attack at all, which is why
macro-averaged metrics are reported next to it.

| Class | Precision | Recall | F1 | Support |
|---|---|---|---|---|
| BENIGN | 0.9999 | 0.9998 | 0.9998 | 691,730 |
| BOTNET | 0.9948 | 0.9975 | 0.9961 | 21,681 |
| BRUTE_FORCE | 0.9993 | 0.9992 | 0.9993 | 14,113 |
| DDOS | 1.0000 | 1.0000 | 1.0000 | 30,088 |
| DOS | 0.9989 | 0.9993 | 0.9991 | 29,486 |
| WEB_ATTACK | 0.8440 | 0.7132 | 0.7731 | 129 |

**Test confusion matrix** (rows are the true class, columns the predicted class):

| True \ Predicted | BENIGN | BOTNET | BRUTE_FORCE | DDOS | DOS | WEB_ATTACK |
|---|---|---|---|---|---|---|
| BENIGN | 691,582 | 105 | 1 | 0 | 25 | 17 |
| BOTNET | 54 | 21,627 | 0 | 0 | 0 | 0 |
| BRUTE_FORCE | 5 | 0 | 14,102 | 0 | 6 | 0 |
| DDOS | 0 | 0 | 0 | 30,088 | 0 | 0 |
| DOS | 12 | 0 | 9 | 0 | 29,465 | 0 |
| WEB_ATTACK | 28 | 9 | 0 | 0 | 0 | 92 |

**Isolation Forest** (held-out benign rows and all attack rows, scored at the
5th-percentile threshold):

| Measure | Value |
|---|---|
| False-positive rate on 922,307 held-out benign flows | 5.01% (46,228 flows) |
| Attack detection rate on 636,646 attack flows | 2.06% |

At this threshold the Isolation Forest is a weak standalone attack detector; the
console uses its score as one input (an anomaly factor in the risk score) next to
the classifier, not as a verdict.

### Known limitations (from the model card)

- Network-flow detections only. Host-telemetry rules `R-001`–`R-004` cannot be
  scored by this model.
- `PORT_SCAN` has no training data in this dataset and is not ML-supported.
- `Infilteration` rows are excluded.
- Stratified, not temporal, split.
- A 2018 laboratory capture; not representative of current production traffic.
- `WEB_ATTACK` is weak (F1 0.77, 129 test rows) because it has very few examples.

## Serving

`python -m ml.service.app` (from the repository root) starts a FastAPI service on
`127.0.0.1` at `SOCGENIE_ML_PORT` (default 8000). The models directory defaults to
`models`, relative to the working directory, or `SOCGENIE_MODELS_DIR`.

Start-up sequence:

1. Read `model_card.json`. Missing or unreadable: start with `available: false`.
2. Verify the SHA-256 of both artifacts against `checksums` in the card. A
   mismatch means the service refuses to load, because `joblib.load` executes
   pickle and a model file is untrusted input.
3. Load the artifacts, then check each one's `feature_order` against the schema. A
   reordered vector would give confident, silently wrong predictions.
4. Check that the Isolation Forest percentiles are not degenerate.

Any failure at any step leaves the service running and reporting `available:
false` with a safe reason (never a path or pickle internals). `/score` then
returns a controlled unavailable response and never a fabricated prediction.

Prediction (`POST /score`): validate the request (1 to 500 flows, exactly the 18
raw features), build the 22-feature vector, run `predict_proba` and
`score_samples`, take the top class, normalise the anomaly score, and apply the
**BENIGN rule**: a flow predicted `BENIGN` reports `ml_confidence` 0, so confident
benign traffic adds no ML risk. The Node gateway re-applies this rule and
re-validates every field of the response.

Request and response shapes are in [API.md](API.md).

## Integration with the console

| Predicted class | Alert severity | ATT&CK technique |
|---|---|---|
| DDOS | High | T1498 |
| DOS | High | T1499 |
| BOTNET | High | T1071 |
| BRUTE_FORCE | Medium | T1110 |
| WEB_ATTACK | Medium | T1190 |
| BENIGN | No alert | — |

Severity is the class's inherent seriousness. The risk score is computed separately
by the seven-factor formula, where the ML factor is `25 × ml_confidence` and the
anomaly factor is `20 × anomaly`. A label outside the six trained classes is
rejected, not coerced.

Console behaviour by state:

| State | Result |
|---|---|
| Node server and ML service running, artifacts verified | Flow files are scored; non-benign flows become alerts; Detection & ML shows the model card metrics |
| ML service down, or no artifacts | Flow parsing and rule-based detection still work; the ML panel reports why scoring is unavailable |
| Console only (no backend) | ML Engine indicator reports no reachable service |

## Reproducing the results

```bash
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r ml/requirements.txt                    # pins scikit-learn==1.7.0
python ml/tests/test_phase13a.py                      # 137 passed, 0 failed
python -m ml.train --data datasets/CSE-CIC-IDS2018 --out models
python -m ml.verify_artifacts --models models
```

Re-running training writes a new `model_card.json` with its own checksums and
timestamp. Because the artifacts are regenerated, small numerical differences from
the figures above are possible; the figures in this repository are those of the run
recorded in the committed model card (trained 2026-08-22).
