# SOCGenie — Intelligent Security Operations Platform

**Investigate Faster. Respond Smarter.**

![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?logo=python&logoColor=white)
![scikit-learn](https://img.shields.io/badge/scikit--learn-1.7.0-F7931E?logo=scikitlearn&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-ML%20service-009688?logo=fastapi&logoColor=white)

SOCGenie is a Security Operations Center (SOC) console built around the workflow an
analyst actually follows: telemetry is ingested, evaluated by a rule engine and a
machine-learning classifier, triaged as alerts, investigated with evidence and a
risk score, mapped to MITRE ATT&CK, and handled as an incident. It was built as a
B.Tech Computer Science Engineering (Cyber Security) minor project to show how
detection, triage, investigation and AI assistance fit together as one coherent
system rather than a set of disconnected demos.

> **Status: academic prototype.** The core analyst workflow is implemented and
> runs end to end, but SOCGenie is not a production security product. Bundled
> alerts, incidents and hosts are synthetic, application state lives in browser
> memory, and there is no database. See [Limitations](#limitations).

![SOCGenie Command Center](docs/screenshots/dashboard.png)

## Table of Contents

1. [Overview](#overview)
2. [Problem Statement](#problem-statement)
3. [Objectives](#objectives)
4. [Key Features](#key-features)
5. [Implementation Coverage](#implementation-coverage)
6. [Architecture](#architecture)
7. [Technology Stack](#technology-stack)
8. [System Requirements](#system-requirements)
9. [Project Structure](#project-structure)
10. [Installation and Setup](#installation-and-setup)
11. [Environment Variables](#environment-variables)
12. [Running SOCGenie](#running-socgenie)
13. [AI Integration](#ai-integration)
14. [Machine Learning](#machine-learning)
15. [Detection Engine](#detection-engine)
16. [Alert, Incident and Investigation Management](#alert-incident-and-investigation-management)
17. [Log Analysis](#log-analysis)
18. [Analytics](#analytics)
19. [API Documentation](#api-documentation)
20. [Security Considerations](#security-considerations)
21. [Screenshots](#screenshots)
22. [Testing and Validation](#testing-and-validation)
23. [Troubleshooting](#troubleshooting)
24. [Limitations](#limitations)
25. [Future Enhancements](#future-enhancements)
26. [Contributing and Community](#contributing-and-community)
27. [Contributors](#contributors)
28. [License](#license)

---

## Overview

SOCGenie is made of three cooperating parts:

| Part | Location | Role |
|---|---|---|
| **SOC console** | `frontend/` | React + TypeScript single-page app: 11 screens, a client-side detection engine, risk scoring, MITRE ATT&CK mapping, an alert-scoped AI assistant and WebGL visualisations. |
| **Node backend** | `server/` | Dependency-free TypeScript HTTP server: login and role-bearing tokens, an AI chat proxy with redaction and output guarding, and a gateway to the ML service. |
| **ML service** | `ml/`, `models/` | Python pipeline that trains a Random Forest and an Isolation Forest on CSE-CIC-IDS2018, plus a FastAPI service that serves the verified artifacts. |

The console runs on its own with no backend. The Node server and the ML service
are optional layers that switch on live AI responses and live ML scoring of
network-flow files.

A design rule runs through the whole project, the **honesty contract**: the UI
never shows a status, metric or prediction that the code cannot produce. If the
ML service is not running, the ML Engine indicator says so; if no LLM provider is
configured, the assistant says it is using its deterministic engine.

## Problem Statement

SOC analysts receive more alerts than they can read in full, and many are false
positives. Enterprise SIEM platforms address this but are costly and
infrastructure-heavy, which makes realistic hands-on practice hard for students
and small teams. Academic machine-learning work on intrusion detection also tends
to stop at a notebook and a metrics table, never connected to the workflow an
analyst would use. And adding a large language model to security tooling raises a
specific risk: trusting a fluent answer the evidence does not support.

## Objectives

- Provide one console that takes an analyst from raw log to triaged, investigated
  alert without switching tools.
- Make detection real and auditable: every alert traceable to a named rule or
  model prediction and to the evidence that triggered it.
- Train and evaluate a supervised classifier and an anomaly detector on a public
  intrusion dataset, and report the metrics exactly as measured.
- Serve the trained models behind an integrity-checked service that the console
  can use.
- Use an LLM only as an alert-scoped assistant, with redaction on the way out and
  validation on the way back, and a deterministic fallback.

## Key Features

| Area | What is implemented |
|---|---|
| **Command Center** | KPI cards, live-event stream, severity distribution, security-events timeline, and a 3D "security universe" graph built from the current alerts, incidents, hosts and techniques. |
| **Rule-based detection** | Seven deterministic rules (`R-001`–`R-007`) over uploaded logs in CSV, JSON Lines or `key=value` format. |
| **ML detection** | Random Forest classifier and Isolation Forest anomaly score applied to CICFlowMeter flow files; non-benign predictions become alerts. |
| **Risk scoring** | Seven-factor deterministic score (0–100) with a per-factor breakdown and risk bands. |
| **Alert management** | Search, severity/status/source/technique filters, sorting, detail panel with evidence and MITRE context, status changes, notes and advisory response playbooks. |
| **Investigation** | Evidence chain, correlated alerts, timeline, 3D attack path built only from fields the alert actually carries, and an automated analysis panel (local deterministic engine). |
| **Incident management** | Incident queue, KPIs, affected assets, correlation summary, status workflow and notes. |
| **MITRE ATT&CK** | 14 curated techniques across 10 tactics, shown as an interactive 3D map tied to alert evidence. |
| **SOCGenie Assist** | Alert-scoped assistant with five quick actions plus free-text questions, an 18-document retrieval knowledge base, optional LLM provider, and a rule-based fallback. |
| **Detection & ML console** | Rule inventory, trained-model registry, evaluation metrics from the model card, and the 22-feature schema. |
| **Analytics** | Session metrics computed from the current alert store: severity, detection source, risk band, triage status, technique ranking and ML class distribution. |
| **Usability** | Dark and light themes, keyboard navigation (`G` + letter, `T`, `?`), `prefers-reduced-motion` support and 2D fallbacks when WebGL is unavailable. |

## Implementation Coverage

What exists, what is partial, and what does not exist. Nothing marked as missing
is described elsewhere in this repository as a capability.

| Capability | Status | Notes |
|---|---|---|
| Log ingestion and rule-based detection | Implemented | Browser-side, on demand; files are uploaded, not streamed. |
| ML classification of network flows | Implemented | Needs the Node server, the ML service and trained artifacts running locally. |
| Alert, incident and investigation workflows | Implemented | In browser memory; resets on reload. |
| MITRE ATT&CK mapping | Implemented | Curated subset (14 techniques), not the full matrix. |
| AI assistant | Implemented | LLM through the Node proxy when a provider key is set; deterministic fallback otherwise. |
| Authentication | Partial | Server-signed tokens with a server-derived role; demo credentials only, no identity provider. The UI session itself is client-side. |
| Threat intelligence | Partial | Rule `R-006` matches a small curated indicator list; there is no lookup page and no live feed. |
| Simulation Lab | Partial | Scenario catalog is shown; the Run buttons are disabled. |
| Persistence / database | Not implemented | Health endpoint reports `db: "unavailable"`. |
| IOC investigation (IP / URL / hash lookup) | Not implemented | |
| DNS and domain intelligence | Not implemented | |
| Report generation or export | Not implemented | A "copy handoff summary" action exists in the investigation panel only. |
| Real-time telemetry and agents | Not implemented | |

## Architecture

```mermaid
flowchart LR
    subgraph Browser["Browser — React 18 + TypeScript (Vite)"]
        UI["SOC console<br/>11 screens"]
        DET["Detection engine<br/>parser, 7 rules, risk scoring"]
        STORE["In-memory stores<br/>alerts, incidents, investigations"]
        API["src/lib/api<br/>data layer (fixture-backed)"]
        UI --> DET --> STORE
        UI --> API
    end

    subgraph Node["Node.js + TypeScript server (:8787)"]
        AUTH["Auth<br/>HMAC-signed tokens"]
        CHAT["AI chat proxy<br/>validate, RAG, redact, guard"]
        MLGW["ML gateway<br/>status and score"]
    end

    subgraph ML["Python ML service (127.0.0.1)"]
        FAST["FastAPI<br/>/health /status /score"]
        ART["Verified artifacts<br/>rf.joblib, isolation_forest.joblib"]
        FAST --> ART
    end

    LLM[("LLM provider<br/>OpenRouter or Anthropic")]

    UI -- "/api/auth/login" --> AUTH
    UI -- "/api/ai/chat" --> CHAT
    UI -- "/api/ml/score, /api/ml/status" --> MLGW
    CHAT --> LLM
    MLGW --> FAST
```

The Vite dev server proxies `/api` to the Node server, so the browser never learns
the provider host and never holds a provider key. The Node server calls the ML
service only on `127.0.0.1`.

More diagrams (data flow, alert processing, AI analysis, analyst investigation
workflow) are in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18.3, TypeScript 5.5, Vite 5.4, Tailwind CSS 3.4, Three.js 0.169 with `@react-three/fiber` and `@react-three/drei`, Framer Motion 11 (page transitions), TanStack Query 5, Recharts 2 (Command Center timeline), lucide-react |
| Backend | Node.js with TypeScript, no runtime npm dependencies (Node `http`, `crypto`, `fetch`) |
| ML | Python, scikit-learn 1.7.0 (Random Forest, Isolation Forest), pandas, NumPy, joblib |
| ML service | FastAPI and Uvicorn |
| AI | OpenRouter or Anthropic through the Node proxy (optional); local deterministic engine and retrieval knowledge base |

## System Requirements

| Requirement | Version |
|---|---|
| Node.js | 20.6 or newer (the `--env-file` flag is required; developed on v24) |
| npm | Bundled with Node.js |
| Python | 3.10 or newer (developed on 3.12) — only for the ML pipeline and service |
| Browser | A current Chromium-based browser (the one used in development); WebGL recommended |
| Resources | The frontend and Node server are light. Training reads 8.28 million rows; see [Training and evaluation](#training-and-evaluation) for the `--chunksize` option. |

## Project Structure

```text
SOCGenie/
├── frontend/                    # React + TypeScript SOC console (Vite)
│   ├── src/
│   │   ├── pages/               # Command Center, Alerts, Incidents, Log Explorer, ...
│   │   ├── components/          # ui, layout, alerts, incidents, investigation, ai, 3d, ...
│   │   ├── lib/
│   │   │   ├── api/             # data layer; fixtures when VITE_API_BASE_URL is unset
│   │   │   ├── detection/       # parser, flow parser, rules R-001..R-007, risk scoring
│   │   │   ├── ai/              # chat engine, intelligence engine, backend client
│   │   │   ├── rag/             # retrieval over the 18-document knowledge base
│   │   │   └── automation/      # advisory response playbooks and triage
│   │   ├── hooks/  mocks/       # React hooks; observable in-memory stores
│   ├── public/samples/          # sample logs for the detection engine
│   ├── tests/                   # Node test scripts (see Testing and Validation)
│   └── package.json
├── server/src/                  # Node server: auth, AI proxy, ML gateway, validation
├── ml/                          # features/, preprocess.py, train.py, service/, tests/
├── models/model_card.json       # training and evaluation record for the trained models
├── docs/                        # architecture, API and ML documentation, screenshots
├── .github/                     # CI workflow, issue and pull request templates
├── .env.example                 # server and ML environment variables (no secrets)
└── README.md
```

Trained model binaries (`*.joblib`) and the dataset (`datasets/`) are not
committed. See [Machine Learning](#machine-learning) for how to regenerate them.

## Installation and Setup

```bash
git clone https://github.com/SargunKaur15/SOCGenie.git
cd SOCGenie
```

### Option A: console only (demo mode, no backend)

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

Sign in with either demo button on the login screen. In this mode the console
runs on its bundled seed data plus anything you ingest through the Log Explorer.
Rule-based detection works fully; AI responses use the deterministic engine and
the ML Engine indicator reports that no service is reachable.

### Option B: full stack (Node server, AI proxy, ML service)

1. **Create the environment file** at the repository root.

   ```bash
   cp .env.example .env        # Windows: copy .env.example .env
   ```

   Edit `.env` as described in [Environment Variables](#environment-variables).
   Leaving the AI keys blank is a valid configuration.

2. **Start the Node server.**

   ```bash
   cd frontend
   npm install
   npm run server:dev          # compiles ../server and starts it on :8787
   ```

3. **Set up the ML service** (from the repository root).

   ```bash
   python -m venv .venv
   # Linux/macOS: source .venv/bin/activate     Windows: .venv\Scripts\activate
   pip install -r ml/requirements.txt
   ```

   The service needs trained artifacts in `models/`. They are not in the
   repository; generate them with the steps in
   [Training and evaluation](#training-and-evaluation), then check them:

   ```bash
   python -m ml.verify_artifacts --models models
   ```

4. **Start the ML service** from the repository root, in its own terminal.

   ```bash
   python -m ml.service.app     # 127.0.0.1:8000, or SOCGENIE_ML_PORT if set
   ```

5. **Start the console** in a third terminal.

   ```bash
   cd frontend
   npm run dev                  # http://localhost:5173, proxies /api to :8787
   ```

If the ML service starts without artifacts, it still runs and reports
`available: false`; nothing in the console breaks.

## Environment Variables

All variables are read by the server process (or the ML service) from `.env`.
None are `VITE_` variables, so none reach the browser bundle. `.env` is ignored
by Git; never commit it.

| Variable | Default | Purpose |
|---|---|---|
| `LLM_PROVIDER` | blank | `openrouter`, `anthropic`, or blank for the deterministic engine only. |
| `OPENROUTER_API_KEY` | blank | OpenRouter key. Server-side only. |
| `ANTHROPIC_API_KEY` | blank | Anthropic key. Server-side only. |
| `LLM_MODEL` | provider default | Model identifier; blank uses the provider default. |
| `PORT` | `8787` | Node server port. |
| `SOCGENIE_ML_PORT` | `8000` | ML service port. Read by both the service and the Node gateway; the host is fixed to `127.0.0.1`. |
| `AUTH_SECRET` | random per boot | HMAC key for session tokens. Blank means sessions end on restart. |
| `TOKEN_TTL_SECONDS` | `28800` | Token lifetime. |
| `DEMO_ANALYST_PASSWORD` | in `.env.example` | Demo analyst password. Development only. |
| `DEMO_ADMIN_PASSWORD` | in `.env.example` | Demo admin password. Must differ from the analyst password. |
| `ALLOWED_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Browser origins allowed to call the API. |
| `MAX_MESSAGE_CHARS` | `4000` | Maximum chat message length. |
| `PROVIDER_TIMEOUT_MS` | `25000` | Upstream LLM timeout. |
| `MAX_PROVIDER_BYTES` | `262144` | Ceiling on an upstream response body. |
| `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS` | `20`, `60000` | General request budget per client. |
| `AI_RATE_LIMIT_MAX` | `8` | Stricter budget for LLM calls. |

Optional (present, commented out, at the end of `.env.example`):

| Variable | Used by | Purpose |
|---|---|---|
| `SOCGENIE_API_URL` | Vite dev server | Backend target for the `/api` proxy (default `http://localhost:8787`). |
| `SOCGENIE_MODELS_DIR` | ML service | Directory containing `model_card.json` and the artifacts (default `models`, relative to the working directory). |

If both demo passwords are blank the server refuses every login. If they are
equal, admin demo login is disabled and the server logs a warning at start-up.

## Running SOCGenie

| Command | Run from | What it does |
|---|---|---|
| `npm run dev` | `frontend/` | Vite dev server on `http://localhost:5173`. |
| `npm run server:dev` | `frontend/` | Compiles the Node server and starts it. |
| `npm run build:server` then `npm run server` | `frontend/` | Same, in two steps. |
| `python -m ml.service.app` | repository root | Starts the ML service. |
| `npm run typecheck` / `npm run typecheck:server` | `frontend/` | Type-check the frontend / the server. |
| `npm run build` | `frontend/` | Type-check and produce a production build in `frontend/dist/`. |

**Signing in.** The login screen's demo buttons fill an email address. The UI
session is client-side. When the Node server is running, the same sign-in also
asks it for a signed token, which is required for AI chat and ML scoring. To get
one, enter the value of `DEMO_ANALYST_PASSWORD` (or `DEMO_ADMIN_PASSWORD` for the
admin address) from your `.env`. A wrong password still opens the console, but AI
and ML calls then fall back or report unavailable.

## AI Integration

SOCGenie has two separate AI-style components. They should not be confused.

**1. SOCGenie Assist** (`Assist` screen, and the drawer). A chat assistant scoped
to one selected alert. Five quick actions (Analyze Alert, Explain Alert, MITRE
ATT&CK Mapping, Investigate Alert, Recommended Response) plus free-text questions.

```mermaid
flowchart LR
    Q["Question + selected alert"] --> V["Validate request"]
    V --> R["Retrieve from knowledge base<br/>(18 documents)"]
    R --> G["Assemble grounded context<br/>fence untrusted evidence"]
    G --> X["Redact credential material"]
    X --> P["LLM provider<br/>OpenRouter / Anthropic"]
    P --> O["Guard model output<br/>strip unsupported ATT&CK IDs"]
    O --> A["Answer with sources and warnings"]
    V -. "no provider key, 401, or error" .-> F["Deterministic engine"]
    P -. "failure or unparseable output" .-> F
    F --> A
```

- **Redaction** removes credential material (provider keys, tokens, passwords) from
  the assembled prompt immediately before the provider call. Hostnames, IP
  addresses, usernames and process names are deliberately **not** redacted,
  because they are the evidence the model needs.
- **Output guarding** is code, not instruction: any MITRE ATT&CK ID in the model's
  answer that is not present in the grounded context is stripped and recorded as
  a warning.
- **Fallback.** Without a provider key, or when the provider fails, the
  deterministic engine answers and the UI states which engine responded.
- **Prompt-injection handling.** Untrusted alert values are neutralised and wrapped
  in explicit `UNTRUSTED_DATA` fences that the text itself cannot close.
- **Budget controls.** JSON-only requests, a message length cap, per-client rate
  limits and a stricter limit for LLM calls.

**2. Automated Analysis** (inside an investigation). A structured assessment of
the selected alert — summary, scorecard, confidence breakdown, evidence chain,
recommended actions — produced by a **local deterministic engine**
(`frontend/src/lib/ai/intelligenceEngine.ts`). It contacts no external service
and trains no model; its output is for the analyst to validate. Nothing it
recommends is executed.

## Machine Learning

The ML component is a **real, trained and evaluated pipeline**: a Random Forest
multi-class classifier and an Isolation Forest anomaly detector, trained on
CSE-CIC-IDS2018 network-flow captures.

```mermaid
flowchart TB
    D["CSE-CIC-IDS2018<br/>9 CICFlowMeter CSV files<br/>8,284,254 rows"] --> P["Preprocess<br/>drop header and invalid rows,<br/>deduplicate, remove leakage columns"]
    P --> F["Feature schema<br/>18 raw + 4 engineered = 22"]
    F --> S["Stratified 70 / 15 / 15 split"]
    S --> RF["Random Forest<br/>150 trees, balanced_subsample"]
    F --> IF["Isolation Forest<br/>200 trees, fitted on 80% of benign rows"]
    RF --> E["Validation and test evaluation<br/>vs majority-class baseline"]
    IF --> E
    E --> M["Artifacts + model_card.json<br/>SHA-256 checksums"]
    M --> SV["FastAPI service<br/>verify checksums, then load"]
    SV --> C["Node gateway /api/ml/score"]
    C --> UI["Log Explorer<br/>per-flow prediction, anomaly score, alerts"]
```

### Dataset

[CSE-CIC-IDS2018](https://www.unb.ca/cic/datasets/ids-2018.html) (Sharafaldin,
Lashkari and Ghorbani, ICISSP 2018) is a public intrusion-detection dataset of
labelled CICFlowMeter flows. SOCGenie uses its nine daily CSV files. The dataset
is **not redistributed** here; download it yourself.

| Stage | Rows |
|---|---|
| Read | 8,284,254 |
| After preprocessing | 5,248,179 |
| Removed as duplicates | 2,839,056 |
| Dropped as infinite values | 35,012 |
| Excluded label (`Infilteration`) | 161,934 |

After preprocessing the class distribution is `BENIGN` 4,611,533, `DDOS` 200,591,
`DOS` 196,568, `BOTNET` 144,535, `BRUTE_FORCE` 94,091 and `WEB_ATTACK` 861. The
split is stratified rather than temporal because `BOTNET`, `DDOS` and
`BRUTE_FORCE` each occur on only one capture day.

### Features

22 features per flow: 18 raw CICFlowMeter fields (duration, packet and byte
counts, rates, inter-arrival statistics, TCP flag counts, packet-length
statistics, initial window size) and 4 engineered features computed by
`ml/features/engineer.py` (SYN-to-ACK ratio, forward bytes per packet, packet-rate
asymmetry and a short-flow flag) — the same code at training and at serving, so
the two cannot diverge. The ordered list is in `models/model_card.json` and
`ml/features/schema.py`.

### Training and evaluation

Place the nine daily CSV files in `datasets/CSE-CIC-IDS2018/`. Training loads
every `*.csv` in that directory, so keep only the dataset files there.

```bash
pip install -r ml/requirements.txt
python ml/tests/test_phase13a.py        # schema and service-contract tests; no dataset needed
python -m ml.train --data datasets/CSE-CIC-IDS2018 --out models
python -m ml.verify_artifacts --models models
```

`ml.train` accepts `--chunksize` (rows per read, default 500,000),
`--rf-estimators` (default 150) and `--if-estimators` (default 200), and writes
the two `.joblib` artifacts and `models/model_card.json`. Training takes a long
time on a laptop; use a smaller `--chunksize` if memory is tight. The random seed
is 42.

### Results

Offline evaluation on the held-out test split, taken directly from
[`models/model_card.json`](models/model_card.json) (trained 2026-08-22,
`rf-1.0.0+if-1.0.0`).

| Metric | Random Forest | Majority-class baseline |
|---|---|---|
| Accuracy | 99.97% (0.99966) | 87.9% (0.87869) |
| Macro F1 | 0.9612 | 0.1559 |
| Macro precision | 0.9728 | — |
| Macro recall | 0.9515 | — |
| Weighted F1 | 0.9997 | 0.8220 |

| Class | Precision | Recall | F1 | Test support |
|---|---|---|---|---|
| BENIGN | 0.9999 | 0.9998 | 0.9998 | 691,730 |
| DDOS | 1.0000 | 1.0000 | 1.0000 | 30,088 |
| BRUTE_FORCE | 0.9993 | 0.9992 | 0.9993 | 14,113 |
| DOS | 0.9989 | 0.9993 | 0.9991 | 29,486 |
| BOTNET | 0.9948 | 0.9975 | 0.9961 | 21,681 |
| WEB_ATTACK | 0.8440 | 0.7132 | 0.7731 | 129 |

`WEB_ATTACK` is the weakest class: it has only 861 rows after preprocessing. The
Isolation Forest was fitted on benign flows only (3,689,226 rows, its own random
80/20 benign split); on 922,307 held-out benign flows it flags 5.01% as anomalous, and on 636,646 attack flows it
flags 2.06%. At its 5th-percentile threshold it is a weak standalone detector, and
is used as an anomaly score alongside the classifier, not as a verdict.

These figures describe the models on this dataset's test split. They are not a
production benchmark. The model card records its own limits: network-flow
detections only (host-telemetry rules `R-001`–`R-004` are outside this dataset),
no `PORT_SCAN` class, a stratified rather than temporal split, and a 2018
laboratory capture that does not represent current production traffic.

### Serving and integration

`ml/service/app.py` is a FastAPI service bound to `127.0.0.1`. Before loading,
it verifies both artifacts against the SHA-256 checksums in `model_card.json` and
refuses to load on any mismatch, because `joblib.load` executes pickle and a model
file is untrusted input. It also checks each artifact's feature order against the
schema. If anything is missing or invalid the service still starts and reports
`available: false`; it never fabricates a prediction.

In the console, uploading a CICFlowMeter CSV in the **Log Explorer** sends the
flows through the Node gateway to the ML service. Each flow gets a class, a
confidence and an anomaly score; non-benign predictions become alerts with a
severity and ATT&CK technique (`DDOS` → T1498, `DOS` → T1499, `BOTNET` → T1071,
`BRUTE_FORCE` → T1110, `WEB_ATTACK` → T1190). A confident `BENIGN` flow contributes
zero ML confidence. The bundled sample `08-flows-cicflowmeter.csv` exercises this
path; it is a small illustrative file, not an evaluation, and some rows labelled as
attacks in it are classified `BENIGN` (visible in the
[ML prediction screenshot](docs/screenshots/ml-prediction.png)).

Details: [`docs/MACHINE_LEARNING.md`](docs/MACHINE_LEARNING.md).

## Detection Engine

Rule evaluation runs in the browser (`frontend/src/lib/detection/`). A file is
parsed and normalised (format auto-detected; lines without a usable timestamp are
skipped and counted), each rule is evaluated against its published threshold, and
every match becomes an alert that flows through triage, investigation, MITRE
mapping and the AI assistant like any other.

| Rule | Name | Severity | ATT&CK | Condition |
|---|---|---|---|---|
| R-001 | Authentication Failure Burst | Medium | T1110 | 5 or more failures for one account within 120 seconds |
| R-002 | Failure-Then-Success | High | T1078 | 10 or more failures followed by a success for the same account within 300 seconds |
| R-003 | Suspicious PowerShell | Critical | T1059.001 | Encoded or obfuscated flags, or spawned by an Office or browser process |
| R-004 | Privilege Escalation Indicator | Critical | T1068 | Token elevation or admin-group addition within 300 seconds of a non-admin session start |
| R-005 | Anomalous Outbound Volume | High | T1041 | Outbound bytes above five times the host baseline to an external destination |
| R-006 | Threat Intelligence Match | High | — | Address matches a curated indicator with confidence 70 or above |
| R-007 | Beaconing Regularity | Medium | T1071 | 6 or more connections to one destination with inter-arrival std/mean below 0.15 over 30 minutes |

**Risk score.** Each detection gets a 0–100 score:
`25·ml_confidence + 20·anomaly + 20·rule_severity + 10·correlation +
10·asset_criticality + 8·privileged_account + 7·threat_intel`. Without an ML
contribution the attainable maximum is 75. Bands: Critical ≥ 75, High 50–74,
Medium 25–49, Low below 25. The privileged-account factor is a heuristic from the
account name, labelled as such.

## Alert, Incident and Investigation Management

- **Alerts** — triage queue with search and severity, status, source and technique
  filters; detail panel with evidence and MITRE context; status changes, notes and
  advisory response playbooks (high-impact actions are shown as
  *approved, not executed*; nothing is executed).
- **Investigation** — evidence tabs, correlated alerts, event timeline, network
  activity, a 3D attack path built from fields the alert carries (missing stages are
  omitted, not invented), the automated analysis panel, and a decision log.
- **Incidents** — queue with KPIs, affected assets, correlation summary and a
  New → Investigating → Contained → Resolved workflow with notes.

All of this state is held in browser memory and resets on reload.

## Log Analysis

The **Log Explorer** ingests a file, shows it in Raw, Structured and Analysis
views, and runs detection. Accepted: CSV with a header row, JSON Lines and
`key=value` lines; and CICFlowMeter CSVs for ML scoring. Sample files are in
`frontend/public/samples/`:

| File | Result when run through the Log Explorer |
|---|---|
| `01-brute-force.csv` | 3 alerts: `R-001`, `R-002`, `R-006` |
| `02-powershell.csv` | 1 alert: `R-003` |
| `03-privilege-escalation.csv` | 1 alert: `R-004` |
| `04-exfiltration.csv` | 3 alerts: `R-005`, `R-006`, `R-007` |
| `05-beaconing.jsonl` | 2 alerts: `R-006`, `R-007` |
| `07-benign.csv` | 0 alerts (negative control) |
| `08-flows-cicflowmeter.csv` | CICFlowMeter flow file: 14 flows parsed, 5 rows rejected, scored by the ML model |

These results were observed by running each file through the application.

## Analytics

The Analytics screen shows live session metrics computed from the current alert
store: total alerts, open incidents, false-positive count, severity distribution,
detection source (rule / ML / combined), risk band, triage status, MITRE technique
ranking and ML class distribution. MTTD and MTTR are shown as "not measurable"
because alerts carry no detection or acknowledgement timestamp. There are no
trend charts: no store persists across reloads. There is no report generation or
export.

## API Documentation

The Node server exposes a small JSON API. Summary:

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/health` | none | Service health with the real ML engine state |
| GET | `/api/ai/status` | none | Non-secret AI provider status |
| POST | `/api/auth/login` | none | Exchange demo credentials for a signed token |
| GET | `/api/admin/config` | admin | Non-secret server configuration and limits |
| GET | `/api/ml/status` | none | Model metadata and metrics (read-only) |
| POST | `/api/ml/score` | bearer | Score 1–500 CICFlowMeter flows |
| POST | `/api/ai/chat` | bearer | Alert-scoped AI request |

The ML service (`127.0.0.1` only) exposes `GET /health`, `GET /status` and
`POST /score`. Full request and response shapes, error codes and examples:
[`docs/API.md`](docs/API.md).

## Security Considerations

SOCGenie is defensive in purpose; it contains no offensive tooling. Controls that
are implemented in code:

- **Secrets stay on the server.** Provider keys are read from `.env` by the Node
  process only; the browser never receives them and `.env` is not tracked.
- **Signed, role-bearing tokens.** HMAC-SHA256 tokens carry the role, which the
  server derives and verifies; the browser cannot raise its own privileges. Token
  comparison is constant-time. The token is held in memory only, never in web
  storage.
- **Fail-closed credentials.** No demo password configured means every login is
  refused; identical analyst and admin passwords disable admin login.
- **Request hardening.** Origin allow-list (never `*`), JSON-only content type,
  body size cap, schema validation that rejects unknown fields, per-client rate
  limits and a stricter LLM budget, and security headers on every response.
- **Redaction and output guarding** on the AI path, as described above.
- **Fail-closed model loading.** SHA-256 verification before `joblib.load`;
  loopback-only binding; the ML port is configurable but the host is not, to avoid
  creating an SSRF sink.
- **Safe log rendering.** Log content is attacker-controlled. A single `CodeBlock`
  component renders it, strips control characters and truncates long lines; `dangerouslySetInnerHTML` is
  not used anywhere in the code.

This is a security-conscious course project, not a claim of compliance or of
enterprise-grade assurance. To report a vulnerability see [`SECURITY.md`](SECURITY.md).

## Screenshots

All screenshots were captured from the running application at 1440 × 900.

| | |
|---|---|
| ![Login](docs/screenshots/login.png) **Login** | ![Command Center](docs/screenshots/dashboard.png) **Command Center** |
| ![Security overview](docs/screenshots/security-overview.png) **Security overview** | ![Alerts](docs/screenshots/alerts.png) **Alert queue** |
| ![Alert details](docs/screenshots/alert-details.png) **Alert detail** | ![Investigation list](docs/screenshots/investigation.png) **Investigations** |
| ![Automated analysis](docs/screenshots/ai-threat-analysis.png) **Investigation with automated analysis** | ![AI assistant](docs/screenshots/ai-assistant.png) **SOCGenie Assist** |
| ![MITRE ATT&CK](docs/screenshots/mitre-attack.png) **MITRE ATT&CK map** | ![Incidents](docs/screenshots/incidents.png) **Incident management** |
| ![Log Explorer](docs/screenshots/log-explorer.png) **Log Explorer** | ![Log analysis](docs/screenshots/log-analysis.png) **Rule-based detection results** |
| ![ML prediction](docs/screenshots/ml-prediction.png) **ML scoring of a flow file** | ![ML evaluation](docs/screenshots/ml-evaluation.png) **Trained-model registry and metrics** |
| ![Detection rules](docs/screenshots/detection-rules.png) **Detection rules** | ![Analytics](docs/screenshots/analytics.png) **Analytics** |
| ![Simulation Lab](docs/screenshots/simulation-lab.png) **Simulation Lab (catalog only)** | ![Settings](docs/screenshots/settings.png) **Settings** |

## Testing and Validation

| Check | Command | Status |
|---|---|---|
| ML schema, preprocessing and service-contract tests (137 assertions, no dataset or model needed) | `python ml/tests/test_phase13a.py` | Passing |
| Frontend type-check | `cd frontend && npm run typecheck` | Passing |
| Server type-check | `cd frontend && npm run typecheck:server` | Passing |
| Production build | `cd frontend && npm run build` | Passing |
| Artifact integrity | `python -m ml.verify_artifacts --models models` | Passing with local artifacts |
| Node test scripts | `node frontend/tests/<file>.cjs` | **Partly stale**, see below |

`frontend/tests/` holds twelve standalone Node scripts. Two
(`assignee-label-test.cjs`, `persist-wiring.cjs`) are self-contained and pass. The
other ten load compiled modules (`assignmentStore`, `sqliteStorage`, `socData`,
`socRoutes`) from an earlier persistence and assignment prototype that is not part
of this repository's server, so they fail with a module-not-found error. They are
kept for history and should not be read as coverage of the current server. There is
no frontend unit-test framework and no automated end-to-end suite; the UI was
verified by manual use and browser automation during development.

A GitHub Actions workflow (`.github/workflows/ci.yml`) runs the type-checks, the
production build and the Python tests on every push and pull request.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| ML Engine shows "not loaded" | The ML service is not running, or `models/` has no verified artifacts. Start it with `python -m ml.service.app` from the repository root and check `http://127.0.0.1:<port>/status`. |
| `[Errno 10048]` / port already in use on 8000 | Another process holds the port. Set `SOCGENIE_ML_PORT` in `.env` and start the service with the same value, e.g. `SOCGENIE_ML_PORT=8010 python -m ml.service.app`. |
| `Checksum mismatch ... Refusing to load` | Artifacts do not match `model_card.json`. Re-run training, or restore the matching files. This is intentional fail-closed behaviour. |
| scikit-learn version warning on load | The service ran under a different interpreter than the one the model was trained with. Use the project virtual environment (`scikit-learn==1.7.0`). |
| `python -m ml.service.app` says no trained model | It resolves `models/` relative to the working directory. Run it from the repository root, or set `SOCGENIE_MODELS_DIR`. |
| AI answers say they are from the deterministic engine | No provider key is configured, or no signed token was obtained. Set `LLM_PROVIDER` and a key in `.env`, restart the Node server, and sign in with the demo password from `.env`. |
| Free OpenRouter model returns 404 | The free-model list changes. Pick a current `:free` model and set `LLM_MODEL`. |
| `npm run server` fails with an unknown flag | Node is older than 20.6; upgrade Node.js. |
| Login accepted but ML scoring says unauthorised | The UI session accepts any password; the backend token does not. Use the exact demo password from `.env`. |
| Blank 3D panels | WebGL is unavailable; the app shows 2D fallbacks. |

## Limitations

- **Academic prototype**, not a production security product.
- **No database or persistence.** Alerts, incidents, notes and decisions live in
  browser memory and reset on reload. The Node server does not implement alert,
  incident or analytics endpoints; those screens run on seed data and your ingested
  files.
- **Synthetic seed data.** Bundled alerts, incidents and hosts are illustrative.
- **Demo-grade authentication.** Shared demo passwords and no identity provider;
  the UI session is client-side.
- **On-demand detection.** Files are uploaded and analysed in the browser; there is
  no agent, streaming or production log pipeline.
- **ML scope.** Flow-based classes only, trained on a 2018 laboratory capture;
  `WEB_ATTACK` is weak (F1 0.77); the Isolation Forest has a low attack-detection
  rate (2.06%) at its threshold. Model binaries are not in the repository.
- **Threat intelligence is a small curated list**, not a live feed, and there is no
  IOC, DNS or domain lookup.
- **Curated MITRE subset** (14 techniques), not the full Enterprise matrix.
- **Simulation Lab scenarios are not runnable** yet; the Run buttons are disabled.
- **Stale banner text.** After a host-log detection run, a banner reads "ML ENGINE — NOT
  LOADED … No model is trained". That wording is out of date: host logs are never
  scored by the model (it is flow-based), and a trained model exists. It does not
  reflect the ML service state shown in the top bar and on the Detection & ML screen.
- **No report export.**
- **Test coverage is limited** as described in [Testing and Validation](#testing-and-validation).

## Future Enhancements

Not implemented; listed as directions only.

- Persistent storage and server-side alert, incident and analytics APIs.
- A real identity provider in place of demo credentials.
- Streaming or agent-based telemetry ingestion.
- Threat-intelligence and IOC lookup, and DNS/domain enrichment.
- Runnable Simulation Lab scenarios driving the real detection pipeline.
- Threshold tuning and better handling of rare classes such as `WEB_ATTACK`; a
  temporal evaluation on newer data.
- Report generation and export.
- Frontend unit tests and an end-to-end suite.

## Contributing and Community

- [`CONTRIBUTING.md`](CONTRIBUTING.md) — how to set up, branch, commit and open a pull request
- [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) — expected behaviour
- [`SECURITY.md`](SECURITY.md) — reporting vulnerabilities
- Issue and pull-request templates are in [`.github/`](.github/)

## Contributors

- **Sargun Kaur** — author and repository owner ([@SargunKaur15](https://github.com/SargunKaur15))

## License

No license file has been added to this repository yet. Until the author selects and
adds one, the code is not licensed for reuse; all rights are reserved by default.
