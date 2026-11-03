# SOCGenie Architecture

This document describes how SOCGenie is put together, with diagrams drawn from the
actual source. For setup and usage see the [README](../README.md); for endpoint
details see [API.md](API.md); for the ML pipeline see
[MACHINE_LEARNING.md](MACHINE_LEARNING.md).

## 1. System architecture

```mermaid
flowchart TB
    subgraph Browser["Browser: React 18 + TypeScript (Vite)"]
        direction TB
        PAGES["Pages<br/>Command Center, Alerts, Incidents, Log Explorer,<br/>Investigation, MITRE ATT&CK, Detection & ML,<br/>Analytics, Simulation Lab, SOCGenie Assist, Settings"]
        subgraph LIB["src/lib"]
            DETECT["detection/<br/>parser, flowParser, rules, risk"]
            AIL["ai/ and rag/<br/>chat engine, intelligence engine,<br/>knowledge base"]
            AUTOM["automation/<br/>advisory playbooks"]
            APIL["api/<br/>data layer, fixtures in demo mode"]
        end
        STORES["mocks/<br/>alert, incident, investigation,<br/>automation stores (in memory)"]
        PAGES --> LIB
        DETECT --> STORES
        PAGES --> STORES
    end

    subgraph Server["Node.js server :8787 (TypeScript, no npm dependencies)"]
        direction TB
        SEC["security.ts<br/>origin policy, headers, JSON checks"]
        AUTHM["auth.ts<br/>HMAC tokens, demo credentials"]
        HANDLER["handler.ts<br/>validate, RAG, fence, redact, guard"]
        MLPROV["mlProvider.ts<br/>ML client, response validation"]
    end

    subgraph MLS["Python ML service 127.0.0.1"]
        direction TB
        APP["ml/service/app.py<br/>FastAPI"]
        FEAT["ml/features/<br/>schema, engineer"]
        ARTS["models/<br/>rf.joblib, isolation_forest.joblib,<br/>model_card.json"]
        APP --> FEAT
        APP --> ARTS
    end

    LLM[("OpenRouter / Anthropic")]

    Browser -- "/api via Vite proxy" --> Server
    HANDLER --> LLM
    MLPROV -- "HTTP, loopback only" --> APP
```

Two boundaries matter:

- **Browser to server.** The Vite dev server proxies `/api` to the Node server. The
  browser holds no provider key and never learns the provider host.
- **Server to ML service.** The Node server calls `127.0.0.1` only. The ML port is
  configurable through `SOCGENIE_ML_PORT`; the host is hard-coded so a configuration
  value cannot point the server at an arbitrary address.

The data layer in `src/lib/api/` resolves every resource against local fixtures when
`VITE_API_BASE_URL` is unset. The Node server does not implement alert, incident or
analytics resources, so those screens always run on seed data plus whatever is
ingested in the browser. AI chat, ML scoring, login and health use same-origin
`/api` routes that the Node server does implement.

## 2. Data flow

How data moves from an uploaded file to the screens an analyst uses.

```mermaid
sequenceDiagram
    actor A as Analyst
    participant LE as Log Explorer
    participant DE as Detection engine (browser)
    participant GW as Node server
    participant ML as ML service
    participant ST as Alert store (memory)
    participant UI as Alerts / Investigation / MITRE / Assist

    A->>LE: Choose file, Run detection
    alt Host log (CSV, JSON Lines, key=value)
        LE->>DE: parse and normalise events
        DE->>DE: evaluate R-001..R-007
        DE->>DE: seven-factor risk score
        DE->>LE: matches with evidence
        A->>LE: Send alerts to the queue
        LE->>ST: ingest alerts
    else CICFlowMeter flow CSV
        LE->>GW: POST /api/ml/score (bearer token)
        GW->>ML: POST /score (18 raw features per flow)
        ML-->>GW: label, confidence, anomaly score per flow
        GW-->>LE: predictions, or available:false
        LE->>ST: non-benign predictions become alerts
    end
    ST-->>UI: alerts appear in every screen
```

Host logs and flow files take different paths because the classifier was trained on
network-flow features; host-telemetry rules `R-001`–`R-004` are rule-only.

## 3. Alert processing

```mermaid
flowchart LR
    F["Uploaded file"] --> D{"Format"}
    D -- "CSV / JSONL / key=value" --> PA["parser.ts<br/>normalise events,<br/>count skipped lines"]
    D -- "CICFlowMeter CSV" --> FP["flowParser.ts<br/>map columns, count rejected rows"]
    PA --> RU["rules.ts<br/>R-001 .. R-007"]
    RU --> RI["risk.ts<br/>seven factors, 0..100"]
    FP --> SC["POST /api/ml/score"]
    SC --> CL{"Class"}
    CL -- "BENIGN" --> NO["No alert,<br/>zero ML confidence"]
    CL -- "DDOS DOS BOTNET<br/>BRUTE_FORCE WEB_ATTACK" --> FA["flowsToAlerts<br/>severity + ATT&CK technique"]
    RI --> AL["SocAlert"]
    FA --> AL
    AL --> QU["Alert queue<br/>triage, filters, notes"]
    QU --> INV["Investigation"]
    QU --> MIT["MITRE ATT&CK map"]
    QU --> ASS["SOCGenie Assist"]
    QU --> INC["Incident"]
```

## 4. ML training and inference

```mermaid
flowchart TB
    subgraph Training["Offline training: python -m ml.train"]
        direction TB
        T1["Load every *.csv in the data directory"] --> T2["preprocess.py<br/>drop header and invalid rows,<br/>remove infinite values, deduplicate,<br/>drop leakage columns, map labels"]
        T2 --> T3["Feature schema: 18 raw + 4 engineered"]
        T3 --> T4["Stratified split 70 / 15 / 15, seed 42"]
        T4 --> T5["RandomForestClassifier<br/>150 trees, balanced_subsample"]
        T3 --> T6["IsolationForest<br/>200 trees, own 80/20 split of benign rows"]
        T5 --> T7["Validation + test metrics,<br/>majority-class baseline"]
        T6 --> T7
        T7 --> T8["Write .joblib artifacts<br/>+ model_card.json with SHA-256"]
    end

    subgraph Serving["Serving: python -m ml.service.app"]
        direction TB
        S1["Read model_card.json"] --> S2{"Checksums match?"}
        S2 -- "no" --> S3["Refuse to load<br/>available:false with reason"]
        S2 -- "yes" --> S4["joblib.load artifacts"]
        S4 --> S5{"Feature order matches schema?"}
        S5 -- "no" --> S3
        S5 -- "yes" --> S6["Ready"]
        S6 --> S7["POST /score<br/>validate, engineer features,<br/>predict_proba + score_samples,<br/>normalise anomaly, apply BENIGN rule"]
    end

    T8 --> S1
```

## 5. AI analysis workflow (SOCGenie Assist)

```mermaid
sequenceDiagram
    actor A as Analyst
    participant UI as Assist (browser)
    participant H as Node /api/ai/chat
    participant K as Knowledge base (18 docs)
    participant P as LLM provider
    participant D as Deterministic engine

    A->>UI: Select an alert, pick an action or ask
    UI->>H: POST message, intent, alert context (bearer token)
    alt no token, no provider key, or request rejected
        UI->>D: answer locally
        D-->>UI: deterministic answer, labelled as such
    else provider configured
        H->>H: validate schema, limits, rate budgets
        H->>K: retrieve relevant documents
        H->>H: neutralise and fence untrusted values
        H->>H: redact credential material
        H->>P: one request, abort timeout, no retry loop
        P-->>H: JSON answer
        H->>H: guard output: strip ATT&CK IDs not in context,<br/>separate assessed vs contextual techniques
        H-->>UI: answer, sources, warnings, redactionApplied
        opt provider error, timeout or unparseable output
            H-->>UI: failure with fallback:true
            UI->>D: answer locally
        end
    end
    UI-->>A: Answer with confidence, observed vs inferred, sources
```

The Investigation screen also has an **Automated Analysis** panel. It does not use
this path: it runs the local deterministic engine in the browser and contacts no
external service.

## 6. SOC analyst investigation workflow

```mermaid
flowchart TB
    S["Alert raised<br/>(rule match or ML prediction)"] --> T["Triage in the Alert queue<br/>severity, status, source, technique filters"]
    T --> Q{"Worth investigating?"}
    Q -- "false positive" --> FP["Mark false positive"]
    Q -- "yes" --> O["Open Investigation workspace"]
    O --> E["Review evidence, timeline,<br/>related alerts, network activity"]
    E --> M["Check MITRE ATT&CK mapping<br/>and the attack path"]
    M --> R["Read risk breakdown<br/>and Automated Analysis"]
    R --> AS["Ask SOCGenie Assist<br/>(optional, alert-scoped)"]
    AS --> D["Record decision and notes"]
    R --> D
    D --> W["Advance investigation:<br/>New, Triaged, Investigating, Contained, Resolved"]
    D --> ES{"Escalate?"}
    ES -- "yes" --> I["Incident workflow:<br/>New, Investigating, Contained, Resolved"]
    ES -- "no" --> W
    I --> PB["Advisory response playbooks<br/>high-impact actions: approved, not executed"]
```

Response actions are advisory. SOCGenie has no execution backend, so approving a
high-impact action records the approval and labels it "approved, not executed".

## 7. Design principles

- **Honesty contract.** A status, metric or prediction is shown only if code can
  produce it. Absent capabilities are reported as absent.
- **Fail closed.** No demo password configured: logins refused. Checksum mismatch:
  model not loaded. Unrecognised ML label: rejected, not coerced.
- **Same code at training and serving** for engineered features, so they cannot
  diverge.
- **Evidence-only visuals.** The attack path and technique map use fields the alert
  actually carries; missing stages are omitted rather than invented.
- **Untrusted by default.** Log content, retrieved text, model output and model
  files are all treated as untrusted input at their boundary.
