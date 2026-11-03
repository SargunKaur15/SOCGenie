# SOCGenie API Reference

SOCGenie exposes two HTTP services. Both are verified against the source in
`server/src/` and `ml/service/`.

| Service | Default address | Reachable from | Source |
|---|---|---|---|
| Node server | `http://localhost:8787` (`PORT`) | The browser, through the Vite `/api` proxy | `server/src/index.ts` |
| ML service | `http://127.0.0.1:8000` (`SOCGENIE_ML_PORT`) | The Node server only (loopback) | `ml/service/app.py` |

The Node server implements only the routes below. It does **not** implement alert,
incident, investigation or analytics endpoints: those screens run on seed data and
browser-side state.

## Conventions

- **Content type.** `POST` routes require `Content-Type: application/json`;
  otherwise the response is `415`.
- **Authentication.** Protected routes need `Authorization: Bearer <token>` with a
  token from `POST /api/auth/login`. Tokens are HMAC-SHA256 signed and carry the
  role and an expiry (`TOKEN_TTL_SECONDS`, default 28800).
- **Origins.** A request with an `Origin` header outside `ALLOWED_ORIGINS` gets
  `403`. Requests without an `Origin` (curl, same-origin) are accepted. CORS never
  answers `*`.
- **Errors.** Error responses are JSON, `{ "error": "<message>", "code": "<code>" }`,
  with a stable `code`. On the AI and ML routes they also carry `"fallback": true`,
  telling the client to use its local engine. The server returns messages only,
  never stack traces or provider response bodies.
- **Headers.** Every response carries `nosniff`, `no-referrer`, `X-Frame-Options:
  DENY`, a restrictive `Permissions-Policy`, `Cross-Origin-Resource-Policy:
  same-site` and `Cache-Control: no-store`.
- **Rate limits.** Fixed-window, per client. `429` responses include
  `Retry-After`.

### Error codes

| Code | Typical status | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400, 404, 405, 413, 415 | Malformed request, unknown field, wrong method or content type, body too large |
| `UNAUTHORIZED` | 401, 403 | Missing or invalid token, insufficient role, bad credentials, disallowed origin |
| `RATE_LIMITED` | 429 | Request budget exceeded |
| `PROVIDER_UNAVAILABLE` | 503 | LLM provider failed or is not configured |
| `PROVIDER_TIMEOUT` | 504 | LLM provider did not answer within `PROVIDER_TIMEOUT_MS` |
| `INTERNAL_ERROR` | 500 | Unexpected failure |

---

## Node server

### `GET /api/health`

No authentication. Reports the real state of the ML engine and the assistant
provider.

```json
{
  "status": "ok",
  "db": "unavailable",
  "ml_engine": { "loaded": true, "version": "rf-1.0.0+if-1.0.0" },
  "assist_provider": "llm"
}
```

`db` is always `"unavailable"`: SOCGenie has no database. `assist_provider` is
`"llm"` when a provider key is configured and `"rule_based"` otherwise.
`ml_engine.loaded` is `false` and `version` is `null` when the ML service is
unreachable or has no verified model.

### `GET /api/ai/status`

No authentication. Non-secret provider status (provider name, whether a key is
configured, mode `REAL_MODEL_CONNECTED` or `LOCAL_FALLBACK`, whether
authentication is enabled). It never includes a key.

### `POST /api/auth/login`

No authentication. Rate limited per IP.

```json
{ "email": "analyst@socgenie.demo", "password": "<DEMO_ANALYST_PASSWORD>" }
```

`email` is at most 254 characters and `password` at most 200. The role is derived
on the server: the address with local part exactly `admin` gets `admin`, any other
gets `analyst`. The password is compared in constant time against
`DEMO_ADMIN_PASSWORD` or `DEMO_ANALYST_PASSWORD`.

```json
{ "token": "<payload>.<signature>", "role": "analyst", "expiresIn": 28800 }
```

| Status | Condition |
|---|---|
| 200 | Credentials accepted |
| 400 | Missing or oversized fields |
| 401 | Invalid credentials (identical for unknown account and wrong password), or no demo password is configured (fail closed) |
| 429 | Too many attempts |

### `GET /api/admin/config`

Requires a token with role `admin` (`403` for analysts). Returns non-secret
configuration only:

```json
{
  "provider": { "...": "same shape as /api/ai/status" },
  "limits": {
    "maxMessageChars": 4000,
    "providerTimeoutMs": 25000,
    "rateLimitMax": 20,
    "aiRateLimitMax": 8
  }
}
```

### `GET /api/ml/status`

No authentication. Read-only model metadata, read from `model_card.json` through
the ML service. No file path or artifact name is ever returned.

```json
{
  "model_name": "SOCGenie Attack Classifier",
  "version": "rf-1.0.0+if-1.0.0",
  "status": "active",
  "algorithm": "RandomForestClassifier (scikit-learn)",
  "anomaly_algorithm": "IsolationForest (scikit-learn)",
  "trained_at": "2026-08-22T17:23:41.089013+00:00",
  "dataset_name": "CSE-CIC-IDS2018",
  "dataset_hash": null,
  "feature_count": 22,
  "sklearn_version": null,
  "available": true,
  "reason": null,
  "schema_version": "13b-cse-cic-ids2018-1.0.0",
  "metrics": {
    "classes": ["BENIGN", "BOTNET", "BRUTE_FORCE", "DDOS", "DOS", "WEB_ATTACK"],
    "dataset": "CSE-CIC-IDS2018",
    "trainedAt": "2026-08-22T17:23:41.089013+00:00",
    "featureCount": 22,
    "accuracy": 0.9996557536771478,
    "macroF1": 0.9612393411417055,
    "benignHoldoutFpr": 0.05012213937441654,
    "checksumsVerified": true
  }
}
```

When no model is loaded: `status` is `"not_trained"`, `available` is `false`,
`reason` explains why, and `metrics`, `version` and `trained_at` are `null`.
`dataset_hash` and `sklearn_version` are always `null` (reserved fields).

### `POST /api/ml/score`

Requires a bearer token. Scores 1 to 500 network flows. The body is
`{ "flows": [ ... ] }`, where each flow is an object with exactly the 18 raw
CICFlowMeter-derived features below. Engineered features are computed inside the ML
service; supplying them is rejected.

| Raw features |
|---|
| `flow_duration`, `fwd_packets`, `bwd_packets`, `fwd_bytes`, `bwd_bytes`, `flow_bytes_per_s`, `flow_packets_per_s`, `flow_iat_mean`, `flow_iat_std`, `fwd_iat_mean`, `syn_flag_count`, `ack_flag_count`, `rst_flag_count`, `psh_flag_count`, `pkt_len_mean`, `pkt_len_std`, `down_up_ratio`, `init_win_fwd` |

Success:

```json
{
  "available": true,
  "modelVersion": "rf-1.0.0+if-1.0.0",
  "schemaVersion": "13b-cse-cic-ids2018-1.0.0",
  "predictions": [
    {
      "index": 0,
      "label": "BENIGN",
      "mlConfidence": 0,
      "anomalyScore": 0.771,
      "isBenign": true
    }
  ]
}
```

- `label` is one of `BENIGN`, `BOTNET`, `BRUTE_FORCE`, `DDOS`, `DOS`, `WEB_ATTACK`.
- `mlConfidence` is the classifier's top-class probability, forced to `0` for
  `BENIGN` so a confidently benign flow adds no ML risk.
- `anomalyScore` is the Isolation Forest score normalised to 0..1 with
  percentiles derived from training data, not from the request.

**Model unavailable is not an error.** If the ML service is down, has no verified
model, or fails, the response is `200` with
`{ "available": false, "reason": "..." }` so log ingestion never breaks because a
model is offline. Invalid payloads return `400 VALIDATION_ERROR`.

### `POST /api/ai/chat`

Requires a bearer token. Subject to the general rate limit and a stricter AI
budget (`AI_RATE_LIMIT_MAX`).

Request:

```json
{
  "message": "Map this alert to MITRE ATT&CK",
  "intent": "mitre",
  "context": {
    "alertRef": "ALT-10492",
    "host": "WS-042",
    "techniqueId": "T1059.001",
    "severity": "critical",
    "evidence": [{ "label": "Process", "value": "powershell.exe" }]
  }
}
```

| Field | Rules |
|---|---|
| `message` | Required, non-empty, at most `MAX_MESSAGE_CHARS` (4000) |
| `intent` | Optional: `analyze`, `explain`, `mitre`, `investigate`, `response`, `incident_summary`, `general` |
| `context.alertRef` | Pattern `^[A-Z]{2,5}-\d{1,10}$` |
| `context.techniqueId` | Pattern `^T\d{4}(\.\d{3})?$` |
| `context.host` | Pattern `^[A-Za-z0-9._-]{1,64}$` |
| `context.severity` | `critical`, `high`, `medium` or `low` |
| `context.evidence` | At most 40 items; label up to 120 characters, value up to 600 |

Unknown top-level or context fields are rejected with `400`.

Processing order: validate, retrieve from the knowledge base, assemble grounded
context with untrusted values neutralised and fenced, redact credential material,
call the provider, guard the output.

Success (`200`):

```json
{
  "ok": true,
  "mode": "REAL_MODEL_CONNECTED",
  "model": "<model id>",
  "result": {
    "answer": "...",
    "confidence": 0.7,
    "observed": [], "inferred": [], "recommended": [],
    "mitreTechniques": [], "contextualTechniques": [],
    "citedSources": [], "warnings": [],
    "insufficientEvidence": false,
    "guardWarnings": []
  },
  "sources": [],
  "insufficientKnowledge": null,
  "redactionApplied": []
}
```

`mitreTechniques` holds only techniques the alert itself is mapped to;
`contextualTechniques` holds reference techniques from retrieved knowledge and must
not be shown as an assessment. `guardWarnings` lists any ATT&CK IDs the guard
removed. `redactionApplied` lists the redaction rule names that fired, never the
redacted values.

Failure responses carry `fallback: true`, telling the client to use its
deterministic engine: `503 PROVIDER_UNAVAILABLE`, `504 PROVIDER_TIMEOUT`,
`429 RATE_LIMITED`.

---

## ML service

Bound to `127.0.0.1`; the browser never reaches it. It starts even without
artifacts and then reports `available: false`.

### `GET /health`

```json
{ "status": "ok", "model_loaded": true, "schema_version": "13b-cse-cic-ids2018-1.0.0" }
```

### `GET /status`

Non-secret metadata, no filesystem paths:

```json
{
  "available": true,
  "reason": null,
  "model_version": "rf-1.0.0+if-1.0.0",
  "schema_version": "13b-cse-cic-ids2018-1.0.0",
  "classes": ["BENIGN", "BOTNET", "BRUTE_FORCE", "DDOS", "DOS", "WEB_ATTACK"],
  "dataset": "CSE-CIC-IDS2018",
  "trained_at": "2026-08-22T17:23:41.089013+00:00",
  "feature_count": 22,
  "macro_f1": 0.9612393411417055,
  "accuracy": 0.9996557536771478,
  "benign_holdout_fpr": 0.05012213937441654,
  "checksums_verified": true
}
```

### `POST /score`

Same flow format as the gateway route, with snake_case fields in the response
(values below are illustrative):

```json
{
  "available": true,
  "reason": null,
  "model_version": "rf-1.0.0+if-1.0.0",
  "schema_version": "13b-cse-cic-ids2018-1.0.0",
  "predictions": [
    { "index": 0, "label": "DOS", "ml_confidence": 0.98, "anomaly_score": 0.41, "is_benign": false }
  ]
}
```

| Status | Condition |
|---|---|
| 200 | Scored, or model unavailable (`available: false`, `predictions: []`) |
| 400 | Not an object, `flows` missing or empty, more than 500 flows, missing or unexpected feature, or malformed JSON |

---

## Try it

With the Node server running and a demo password configured:

```bash
curl http://localhost:8787/api/health

curl -X POST http://localhost:8787/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"analyst@socgenie.demo","password":"<DEMO_ANALYST_PASSWORD>"}'

curl http://localhost:8787/api/ml/status
```
