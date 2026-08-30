# SOCGenie — Intelligent Security Operations Platform

**Investigate Faster. Respond Smarter.**

SOCGenie is an academic cybersecurity platform prototype built around a real
Security Operations Center (SOC) workflow: telemetry comes in, gets triaged as
alerts, gets investigated with context and risk scoring, gets mapped against
MITRE ATT&CK, and is acted on by an analyst. It was built as a B.Tech Computer
Science (Cyber Security) minor project to explore how a modern SOC console —
detection, triage, investigation, and machine-learning-assisted risk scoring —
fits together as one coherent system rather than a collection of disconnected
demos.

The frontend is a fully working React/TypeScript SOC console with real
rule-based log detection, MITRE ATT&CK mapping, incident and investigation
workflows, and a risk-scoring engine. Alongside it, a Python ML pipeline has
been trained and evaluated on a real network-intrusion dataset, with an
integration layer ready to serve it — kept deliberately separate from the live
demo so the UI never shows a claim it can't back up.

> ⚠️ **SOCGenie is an academic research prototype and is not production-ready.**
> Bundled security events and telemetry are synthetic or lab-generated unless
> explicitly stated otherwise. There is no live backend, no real authentication,
> and no production data pipeline behind the deployed demo.

---

## ✨ Project Highlights

- A working **SOC console** — 11 screens, dark/light theme, keyboard-driven navigation
- A **real rule-based detection engine** (7 rules) that turns uploaded logs into live alerts
- A **MITRE ATT&CK technique map** (14 techniques across 10 tactics) rendered as an interactive 3D visualization
- A **trained and evaluated ML model** (Random Forest + Isolation Forest on CSE-CIC-IDS2018, 99.97% test accuracy, 0.96 macro-F1) — see [`models/model_card.json`](models/model_card.json)
- A strict **"never fake it" honesty contract**: the UI never shows a metric, prediction, or status that isn't backed by real code — see [Security Posture](#-security-posture)

---

## 🛡️ What is SOCGenie?

SOCGenie is built around the workflow a SOC analyst actually follows, not
around a dashboard layout:

```
Security Telemetry
        │
        ▼
   Log Explorer            ← upload logs, run detection
        │
        ▼
 Detection Engine          ← 7 deterministic rules, risk scoring
        │
        ▼
   Alert Queue              ← severity, triage, search/filter
        │
        ▼
  Investigation             ← evidence chain, attack path, AI assist
        │
        ▼
  Risk Analysis              ← seven-factor risk score
        │
        ▼
  MITRE ATT&CK                ← technique/tactic mapping
        │
        ▼
 SOC Analyst Response        ← incident workflow, notes, escalation
```

| Stage | Status |
|---|---|
| Log Explorer → Detection Engine → Alert Queue | ✅ Implemented, functional end to end |
| Investigation, risk scoring, MITRE mapping | ✅ Implemented |
| ML-assisted risk factor | ✅ Trained & evaluated offline · 🔜 not yet wired into the live demo |
| Real-time streaming telemetry / live agents | 🔜 Not implemented — out of scope for this prototype |
| Backend persistence, authentication, database | 🔜 Future work — outside the current academic scope |

---

## 🔍 Key Capabilities

| Capability | Detail |
|---|---|
| **SOC Command Center** | Operational overview: KPIs, live event feed, a 3D "security universe" graph of real alerts/incidents/hosts/techniques |
| **Alert monitoring & triage** | Search, severity filter, status filter, sort, distinct empty states for "no data" vs "no matches" |
| **Incident management** | Incident queue, KPIs, affected-asset tracking, status workflow (New → Investigating → Contained → Resolved) |
| **Rule-based log detection** | Upload a log file, auto-detect format, run 7 deterministic rules, push results into the real alert queue |
| **MITRE ATT&CK mapping** | Interactive 3D technique map, 14 curated techniques across 10 real tactics, tied to actual alert evidence |
| **Investigation workflow** | Evidence chain, 3D attack-path visualization built only from fields a given alert actually carries |
| **Risk scoring** | Seven-factor deterministic risk engine; the ML factor is present but contributes 0 until a model is live |
| **Detection & ML console** | Rule inventory, ML engine status, feature schema — reports its real state, never a placeholder |
| **AI SOCGenie Assist** | Alert-scoped chat assistant with a small retrieval knowledge base, rule-based fallback when no LLM provider is configured |
| **Threat visualizations** | Three.js/WebGL: MITRE map, SOC "universe" graph, threat radar, attack-path chain — all driven by real data, with 2D fallbacks when WebGL is unavailable |
| **Dark / light theme** | Persists across reloads, applies before first paint |
| **Keyboard navigation** | `G` then a letter to jump screens, `T` to toggle theme, `?` for the shortcuts overlay |
| **Accessibility** | `prefers-reduced-motion` respected throughout, visible focus rings, meaningful empty states |
| **API abstraction** | Every request goes through `src/lib/api/`; with no backend configured it resolves against local fixtures instead of failing |

---

## 🚀 Project Status

**SOCGenie — Academic SOC Platform Prototype — Complete**

The implementation is complete for its current academic/minor-project scope.
That means every major SOC workflow described in this README is real and
working end to end in the repository:

- A full SOC console (Command Center, Alerts, Incidents, Investigation, Log
  Explorer, MITRE ATT&CK, Detection & ML, Analytics, Simulation Lab, Assist,
  Settings)
- A functional rule-based detection engine (`R-001`–`R-007`) that turns
  uploaded logs into real alerts, triage, and investigation
- A MITRE ATT&CK technique map with real data-driven mapping
- A seven-factor risk-scoring engine and 3D/WebGL security visualizations
- An offline-trained and evaluated ML pipeline (Random Forest + Isolation
  Forest on CSE-CIC-IDS2018), with a serving layer built and ready to load it

What "complete" does **not** mean here:

- **Not a claim of production readiness.** There is no live backend,
  database, or real authentication behind the deployed demo — that's
  explicitly out of scope for this academic project, not an oversight.
- **Not 100% enterprise feature coverage.** Some capabilities (live model
  serving in the running app, real-time streaming telemetry, persistent
  storage) are built or partially built but remain future work beyond this
  project's scope.

**On the ML state specifically:** a Random Forest and an Isolation Forest model
have been trained and evaluated offline against a real dataset, with real,
disclosed metrics — nothing here is fabricated. What's still future work is
*serving* that model live: the trained artifacts are intentionally excluded
from version control (standard practice for large, regenerable binaries), and
the deployed demo runs in a fixture-backed mode that never calls a live model.
So the running app's **ML Engine status correctly reports "not loaded"** —
that refers to live/demo serving state only, not to the absence of a trained
model. The offline training and evaluation work is done; see
[Machine Learning Pipeline](#-machine-learning-pipeline) for the real numbers.

---

## 🖥️ Platform Areas

| Screen | Purpose |
|---|---|
| **Command Center** | SOC overview: KPIs, live event feed, real-data 3D network graph |
| **Alerts** | Alert triage and severity-based monitoring |
| **Incidents** | Incident queue, affected assets, status workflow |
| **Log Explorer** | Log ingestion and rule-based detection |
| **Investigation** | Evidence, risk breakdown, and attack-path view for a selected alert |
| **MITRE ATT&CK** | Interactive technique/tactic map |
| **Detection & ML** | Detection rule inventory and ML engine/integration status |
| **Analytics** | Security analytics and trend visualization |
| **Simulation Lab** | Catalog of attack scenarios describing what the pipeline *would* detect — execution is a planned future step, not yet wired up |
| **SOCGenie Assist** | Alert-scoped AI assistant |
| **Settings** | Theme, provider/session status, environment info |

---

## 🏗️ Architecture

At the highest level, a request flows through the system like this:

```
Frontend / SOC Interface
        │
        ▼
API Abstraction Layer (src/lib/api/)
        │
        ▼
Detection / Risk / Investigation Workflows
        │
        ▼
ML Integration Layer (client + risk-engine slot)
        │
        ▼
Python ML Service (FastAPI, ml/service/)
        │
        ▼
Trained Model / Evaluation Pipeline (ml/, models/model_card.json)
```

The ML service and trained-model steps are real, implemented components — but
they sit behind the "not loaded" state described above in this demo, since the
frontend runs in fixture mode rather than calling them live. In more detail:

```
Frontend (React + TypeScript, Vite)
  │
  ├── SOC UI (Command Center, Alerts, Incidents, Investigation, …)
  ├── Detection Engine (client-side rule evaluation)
  ├── MITRE ATT&CK mapping
  ├── Risk engine (seven-factor scoring)
  │
  └── src/lib/api/  ← the SOLE network boundary
          │
          ├── DEMO_MODE (no VITE_API_BASE_URL): every request
          │   resolves against local fixtures (src/lib/data/fixtures.ts)
          │
          └── VITE_API_BASE_URL set: the same calls hit a live backend
              instead — no page component changes

Node/TypeScript backend (server/)          Python ML service (ml/)
  ├── AI chat proxy (provider routing,       ├── FastAPI inference service
  │   never exposes provider keys to           ├── loads trained artifacts,
  │   the browser)                             │  SHA-256-verified against
  ├── Response guarding / redaction            │  model_card.json (fail-closed)
  └── Auth scaffolding                         └── reports honest "not loaded"
                                                   state when artifacts aren't present
```

No component ever calls `fetch()` directly — every request goes through
`src/lib/api/`. With `VITE_API_BASE_URL` unset (the default for this demo),
every call resolves against local fixtures instead of hitting a network at
all; setting that variable is meant to be the *only* change needed to point
the whole app at a live backend.

---

## 🧪 Rule-Based Detection Engine

SOCGenie performs real rule-based detection over uploaded log files — this is
not a mock.

**Flow:** Log Explorer → choose a file → run detection → push results to the
alert queue. From there, detected alerts behave exactly like any other alert:
triage, investigation, MITRE mapping, and risk scoring all work on them
without special-casing.

- **Formats:** CSV with a header row, JSON Lines, and key=value syslog-style —
  auto-detected. Rows without a parseable timestamp are skipped and counted.
- **Rules:** `R-001`–`R-007`, evaluated deterministically against their
  published thresholds. Sample logs in `frontend/public/samples/` trigger
  specific rules; one sample is a benign negative control that must produce
  zero alerts.

**What this is not:**
- **Not real-time.** Files are uploaded and analysed on demand, in the
  browser. There is no agent, no streaming, and no production log pipeline.
- **Not live threat intelligence.** The indicator-matching rule uses a small,
  curated local list — not a live feed.
- **Not persistent.** Detected alerts, notes, and incidents live in memory and
  reset on reload.

---

## 🤖 Machine Learning Pipeline

The ML story here has two honestly-separated halves: **offline training**
(done, with real results) and **live serving** (built, but intentionally not
turned on in this deployed demo).

```
Dataset (CSE-CIC-IDS2018)
        │
        ▼
Feature Processing (22-feature schema — ml/features/)
        │
        ▼
Preprocessing (dedup, leakage-column removal, split)
        │
        ▼
Random Forest  +  Isolation Forest  (ml/train.py)
        │
        ▼
Evaluation (validation + held-out test, vs. majority baseline)
        │
        ▼
Model Artifact (checksummed, models/model_card.json)
        │
        ▼
ML Service Integration (FastAPI, ml/service/app.py)
```

The metrics below are an **offline evaluation result**, produced by this
pipeline against a held-out test split of a public research dataset — they
describe the trained model's own performance on that data, not the
performance of anything running in the live demo, and should not be read as a
production benchmark.

**Offline — trained and evaluated:**

A Random Forest classifier and an Isolation Forest anomaly detector were
trained on **CSE-CIC-IDS2018** (real CICFlowMeter network-flow captures), using
a stratified 70/15/15 split and a 22-feature schema (18 raw + 4 engineered).
Full metadata, methodology, and metrics are in
[`models/model_card.json`](models/model_card.json). Headline test-set results:

| Metric | Value |
|---|---|
| Accuracy | 99.97% |
| Macro F1 | 0.961 |
| Macro precision | 0.973 |
| Macro recall | 0.951 |
| Majority-class baseline (for comparison) | 87.9% accuracy, 0.156 macro F1 |

The model card also honestly documents its own limits: it only scores
network-flow-style attacks (`BENIGN`, `BOTNET`, `BRUTE_FORCE`, `DDOS`, `DOS`,
`WEB_ATTACK`) — host-telemetry rules `R-001`–`R-004` and `PORT_SCAN` aren't
covered by this dataset and aren't ML-supported; the split is stratified, not
temporal, because three attack classes each occur on a single capture day; and
the source data is a 2018 lab capture, not current production traffic. The
weakest class (`WEB_ATTACK`) sits around 0.77 F1 — reported here rather than
smoothed over.

**Serving layer — built, deliberately dormant in this demo:**

`ml/service/` is a FastAPI service that loads the trained `.joblib` artifacts,
verifies their SHA-256 checksums against `model_card.json` before trusting
them (fail-closed — a model file is untrusted input), and serves predictions
through a defined schema. A Node client and a slot in the risk engine
(`frontend/src/lib/api/ml.ts`) are wired up on the frontend side.

The trained model binaries are **not committed to this repository** — that's
standard practice for large, regenerable artifacts — and the deployed demo
runs in a fixture-backed mode that never calls the Python service at all. So
`mlApi.predict()` correctly rejects with `MODEL_NOT_TRAINED`, `mlApi.metrics()`
correctly returns `NO_TRAINED_MODEL`, and the Detection & ML screen shows an
honest "not loaded" state — never a fabricated prediction or invented metric.
**No accuracy, F1, precision, or recall figure is displayed anywhere inside
the running application** — the real numbers above live only in the model
card, as verifiable evidence, not as an in-app claim.

---

## 🎯 MITRE ATT&CK

The MITRE ATT&CK view maps **14 curated techniques across 10 real tactics**
(Initial Access through Impact) to actual alert evidence — the map is built
from the same alert data the rest of the app uses, not a separate fictional
dataset. Technique-to-tactic placement is deterministic and data-driven; zone
and connection layout use real membership facts (which technique belongs to
which tactic, which alerts evidence which technique), never a fabricated
relationship.

This is a curated subset for analyst context and investigation, not a claim
of comprehensive Enterprise ATT&CK coverage.

---

## ⚙️ Tech Stack

**Frontend**
- React 18 + TypeScript, built with Vite
- Tailwind CSS (dark/light design-token system)
- Three.js via `@react-three/fiber` and `@react-three/drei` (MITRE map, SOC graph, threat radar, attack-path visualizations)
- Framer Motion (UI transitions)
- TanStack Query (data fetching/caching against `src/lib/api/`)
- Recharts (analytics charts)

**Backend / services**
- Node.js + TypeScript (`server/`) — AI chat proxy, response guarding, auth scaffolding
- Python + FastAPI (`ml/service/`) — ML inference service
- scikit-learn, pandas, numpy (`ml/`) — feature engineering, training, evaluation

---

## 🔐 Security Posture

SOCGenie is **defensive and academic in purpose** — there is no offensive or
exploitation tooling anywhere in the project. The Simulation Lab's scenarios
describe synthetic events for the detection pipeline; they never touch a real
system or network.

Concrete principles enforced in code, not just described here:

- **No fabricated model output.** `mlApi.predict()`/`mlApi.metrics()` reject
  with explicit `MODEL_NOT_TRAINED`/`NO_TRAINED_MODEL` codes rather than
  returning a plausible-looking value.
- **No unsafe log rendering.** Log content is attacker-controlled by
  definition. A single `CodeBlock` component is the only approved way to
  display it — it strips ANSI/control characters and truncates long lines.
  `dangerouslySetInnerHTML` is banned repository-wide (verified: the only
  usage in the codebase is inside `CodeBlock` itself).
- **Secrets stay server-side.** Credentials and provider keys are read from
  environment variables on the server; the frontend never holds or exposes a
  provider key.
- **Fail-closed model loading.** The ML service checksum-verifies model
  artifacts against `model_card.json` before loading them, since
  `joblib.load` executes arbitrary code — a model file is treated as
  untrusted input.

This is a security-conscious architecture built for a course project — not a
claim of any compliance certification or enterprise-grade security posture.

---

## ♿ UX & Accessibility

- Dark/light theme, persisted across reloads, applied before first paint (no flash of unstyled content)
- Full keyboard navigation (`G` + letter to jump screens, `T` to toggle theme, `?` for a shortcuts overlay)
- Visible focus rings throughout
- `prefers-reduced-motion` respected across the UI and every Three.js/WebGL scene
- Responsive layout across common desktop widths
- Meaningful, distinct empty states (e.g. "no data" vs. "no matches" on filtered views)
- Severity is never colour-only — every severity indicator also renders a text label

---

## ▶️ Running Locally

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

Sign in with either demo button on the login screen — in this prototype, any
password is accepted (client-side session state only; there is no real
authentication backend yet, and the UI does not claim otherwise). Copy
`.env.example` to `.env` if you want to exercise the optional AI-proxy/server
path locally; no secrets are required to run the core SOC console.

Other available scripts (see `frontend/package.json`):

```bash
npm run typecheck   # tsc --noEmit
npm run build        # production build
```

---

## 📚 Documentation

This README is the primary technical reference for the project. Where deeper
rationale exists, it's kept close to the code it explains rather than in a
separate document that can drift out of date:

- `frontend/src/lib/api/client.ts` — the network-boundary contract described above
- `frontend/src/lib/detection/` — the rule-based detection engine
- `ml/` and `models/model_card.json` — the ML training pipeline and its real, disclosed evaluation results

---

## ⚠️ Current Limitations

- **Academic prototype**, not a production security product
- **No live backend or database** — the frontend runs against local fixtures unless `VITE_API_BASE_URL` is configured
- **No real authentication** — sign-in is client-side session state only
- **ML model is trained but not live-served** in this demo (see [Machine Learning Pipeline](#-machine-learning-pipeline))
- **Synthetic/lab data** — bundled alerts, incidents, and hosts are illustrative, not from a real environment
- **No real-time telemetry** — detection is file-upload/on-demand, not a streaming pipeline
- **In-memory persistence only** — detected alerts, notes, and incidents reset on reload
- **Curated, not comprehensive, threat intelligence** — 14 MITRE techniques and a small local indicator list, not full Enterprise ATT&CK or a live feed
- **Simulation Lab scenarios are not yet executable** — they document what the pipeline would detect; running them is a planned future step

---

## 📁 Project Structure

```
SOCGenie/
├── frontend/
│   ├── src/
│   │   ├── pages/          # Command Center, Alerts, Investigation, MITRE, …
│   │   ├── components/     # UI, 3D visualizations, detection, incidents, …
│   │   ├── lib/             # api/ (network boundary), detection/, ai/, data/
│   │   ├── hooks/
│   │   └── mocks/           # observable demo alert/incident stores
│   ├── public/               # static assets, sample logs for the detection engine
│   ├── tests/                 # persistence/assignment test scripts
│   └── package.json
├── server/                    # Node/TypeScript AI proxy & auth scaffolding
├── ml/                         # Python ML pipeline (features, training, FastAPI service)
├── models/
│   └── model_card.json         # real training/evaluation metadata and metrics
├── .env.example                # documents required env vars — no real secrets
└── README.md
```
