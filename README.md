# SOCGenie — Intelligent Security Operations Platform

**Investigate Faster. Respond Smarter.**

An academic cybersecurity operations platform prototype with a custom machine
learning detection pipeline. B.Tech Computer Science (Cyber Security) minor project.

> SOCGenie is **not production-ready**. All data shipped with the project is
> synthetic or lab-generated and is labelled as such.

---

## Current status — Phase 1 complete

| Phase | Scope | Status |
|-------|-------|--------|
| P0 | Dataset acquisition and verification | In progress |
| **P1** | **Design system, theme, app shell, 11 screen stubs, API layer** | ✅ **Complete** |
| P2 | Backend + database + auth | Next |
| P3–P6 | Ingestion → rules → risk → MITRE → Investigation Workspace | Pending |
| P7–P11 | Dataset prep → features → training → evaluation → inference | Pending |
| P12–P18 | Fusion, correlation, simulation, Assist, analytics, testing, polish | Pending |

Phase 1 is frontend only. There is **no backend and no trained model** — and the
interface says so rather than showing placeholder values.

## Running it

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

Sign in with either demo button; any password is accepted in Phase 1 (client-side
state only — real JWT auth arrives in Phase 2).

## What works right now

- All 11 screens navigable, in **both dark and light themes**
- Theme persists across reloads and applies before first paint (no flash)
- Alerts table with search, severity filter, sort, and distinct empty states for
  "no data" versus "no matches"
- Command Center with pipeline throughput, priority queue, and event stream
- Detection & ML screen listing the 7 rules and reporting the model as **not trained**
- MITRE matrix over 10 curated real techniques
- Keyboard navigation (`G` then `C`/`A`/`I`/`L`/`D`/`M`/`S`/`N`, `T` for theme, `?` for shortcuts)
- Reduced-motion support and visible focus rings throughout

## Architecture notes

`src/lib/api/` is the **sole network boundary** — no component calls `fetch`
directly. With `VITE_API_BASE_URL` unset, every request resolves against local
fixtures in `src/lib/data/fixtures.ts`. Setting that variable in Phase 2 switches
the whole app to live services without editing a single page component.

Two invariants enforced from Phase 1, both verified by grep in CI later:

1. **No fabricated model output.** `mlApi.predict()` rejects with
   `MODEL_NOT_TRAINED` rather than returning a plausible classification, and
   `mlApi.metrics()` returns `NO_TRAINED_MODEL` rather than zeros. The Detection
   & ML screen renders an honest empty state.
2. **No unsafe log rendering.** Log content is attacker-controlled by definition.
   `CodeBlock` is the only approved way to display it — it strips ANSI and
   control characters and truncates long lines. `dangerouslySetInnerHTML` is
   banned repo-wide.

## Design system

Dark-first, dual theme, driven by CSS custom properties in
`src/styles/tokens.css`. Tokens are stored as RGB channels so Tailwind opacity
modifiers work against them. Severity colours darken in light mode to hold
WCAG AA contrast, and **colour is never the only signal** — every severity
indicator also renders a text label.

Type: Inter for UI, JetBrains Mono for identifiers, IPs, timestamps and metrics.

## Security posture

Defensive only. No offensive or exploitation tooling. The Simulation Lab
generates synthetic events inside the platform and never touches a real system.
Credentials live in environment variables read server-side; the frontend never
holds a provider key.

## Documentation

- `docs/PRD.md` — locked product requirements (v2.0)
- `docs/BLUEPRINT.md` — implementation blueprint

## Phase 12 — Detection Engine

SOCGenie now performs **real rule-based detection** over uploaded log files.

**Log Explorer → Log ingestion and rule execution** → choose a file → Run detection
→ send the results to the alert queue. Detected alerts then behave exactly like any
other alert: triage, investigation, MITRE mapping, risk breakdown and AI SOCGenie
all work on them without special handling.

**Formats:** CSV with a header row, JSON Lines, key=value syslog-style.
Format is auto-detected. Rows without a parseable timestamp are skipped and counted.

**Rules:** R-001 to R-007, evaluated with their published thresholds.
Sample logs in `frontend/public/samples/` trigger specific rules deterministically;
`07-benign.csv` is a negative control that must produce zero alerts.

### What this is not

- **Not real-time.** Files are uploaded and analysed on demand, in the browser.
  There is no agent, no streaming and no production log pipeline.
- **Not ML.** No model is trained. The machine-learning risk factor contributes 0,
  so the attainable risk score maxes at 75/100 under the seven-factor formula.
  Rule severity and calculated riskScore are deliberately kept distinct and are
  not forced to agree.
- **Not live threat intelligence.** R-006 uses a curated local list of four
  indicators.
- **Not persistent.** Detected alerts, notes and incidents are in memory and reset
  on reload.
- The 12 seeded alerts remain so the UI is populated before any upload. Detected
  alerts are appended, never replacing them.

Full detail: `docs/PHASE12-DETECTION-ENGINE.md`.

## Phase 13-A — ML Integration Layer

**ML ENGINE — NOT LOADED.** No model is trained and CIC-IDS2017 is not present.
No accuracy, F1, precision or recall figure appears anywhere in this project,
because none has been produced.

Phase 13-A adds the integration layer around the future model: an authoritative
22-feature schema (18 raw + 4 engineered, raw source columns deliberately
**unresolved** until verified against the real dataset), deterministic
preprocessing, a Python service that starts and reports unavailable, a Node
client, and the ML slot in the risk engine.

With ML absent — the current and default state — Phase 12 behaviour is
unchanged and risk scores are bit-identical. Training is Phase 13-B and requires
the dataset.

Detail: `docs/PHASE13A-ML-INTEGRATION.md`.
