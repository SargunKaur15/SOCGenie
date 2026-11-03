# Contributing to SOCGenie

Thanks for your interest in SOCGenie. It is an academic project maintained on a
best-effort basis, and contributions that improve accuracy, clarity or
correctness are welcome. Please read this page and the
[Code of Conduct](CODE_OF_CONDUCT.md) first.

To report a security vulnerability, do **not** open an issue; follow
[SECURITY.md](SECURITY.md).

## The one rule that matters most: the honesty contract

SOCGenie never shows a status, metric, prediction or capability that the code cannot
produce. When you change behaviour, keep the UI and the documentation true to it:

- Do not add placeholder numbers, fabricated model output or "coming soon" claims
  presented as working features.
- If something is unavailable (no ML service, no provider key), say so plainly.
- Report evaluation results exactly as measured, including weak results.
- Describe planned work as planned, never as done.

## Getting set up

Follow [Installation and Setup](README.md#installation-and-setup). In short:

```bash
git clone https://github.com/SargunKaur15/SOCGenie.git
cd SOCGenie/frontend
npm install
npm run dev
```

For the Node server and ML service, copy `.env.example` to `.env` at the
repository root and see the README. Never commit `.env`, API keys, model binaries
(`*.joblib`) or the dataset.

## Repository layout

| Path | What lives there |
|---|---|
| `frontend/src/` | React + TypeScript console |
| `frontend/src/lib/detection/` | Parser, flow parser, rules `R-001`–`R-007`, risk scoring |
| `server/src/` | Node server: auth, AI proxy, ML gateway |
| `ml/` | Feature schema, preprocessing, training, FastAPI service, Python tests |
| `docs/` | Architecture, API and ML documentation, README screenshots |

## Workflow

1. **Open or find an issue** describing the change, especially for anything larger
   than a small fix.
2. **Fork** the repository and **branch** from `main`.
3. **Make a focused change.** One logical change per pull request.
4. **Check it** (see below), then **open a pull request** using the template.

### Branch names

Use a short, lowercase, hyphenated name with a type prefix:

| Prefix | Use |
|---|---|
| `feature/` | New capability, e.g. `feature/rule-dns-tunnelling` |
| `fix/` | Bug fix, e.g. `fix/alert-filter-reset` |
| `docs/` | Documentation only |
| `refactor/` | Behaviour-preserving restructuring |
| `test/` | Tests only |
| `chore/` | Tooling, CI, dependencies |

### Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/) style, matching the
existing history (for example `docs: update README for final SOCGenie release`):

```text
<type>: <short imperative summary, 72 characters or fewer>

Optional body: what changed and why, wrapped at about 72 columns.
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`. Reference an
issue in the body or footer when there is one (`Closes #12`).

## Testing expectations

Run what applies to your change before opening a pull request. CI runs the same
commands.

| Area | Commands |
|---|---|
| Frontend | `cd frontend && npm run typecheck && npm run build` |
| Node server | `cd frontend && npm run typecheck:server` |
| ML / schema / service contract | `python ml/tests/test_phase13a.py` (needs `pip install -r ml/requirements.txt`; no dataset or model required) |
| ML artifacts (if you retrain) | `python -m ml.verify_artifacts --models models` |

Expectations:

- A change to detection rules, risk scoring, validation or authentication should
  come with a test or a clear manual verification note in the pull request. There is
  no frontend unit-test framework yet; adding one is a welcome contribution.
- A change to the ML pipeline must keep `python ml/tests/test_phase13a.py` passing
  and must not hard-code metrics. If you retrain, include the new `model_card.json`
  values in the pull request description; do not commit `*.joblib` files.
- UI changes: attach a screenshot, and try both themes and a narrow viewport.
- Note that most scripts in `frontend/tests/*.cjs` currently fail because they target
  a persistence prototype that is not in this repository (see the README, "Testing
  and Validation"). Do not rely on them as coverage.

## Code guidelines

- **TypeScript:** the project type-checks cleanly; keep it that way. Prefer small
  pure functions for detection logic (`lib/detection/` has no React imports on
  purpose).
- **Network access:** UI components do not call `fetch` directly; data goes through
  `src/lib/api/`. The existing AI, ML and login calls are the documented exceptions.
- **Untrusted content:** render logs and model output only through the existing safe
  components (`CodeBlock`); never use `dangerouslySetInnerHTML`.
- **Server:** the Node server has no runtime npm dependencies; discuss before adding
  one. Validate and bound every input; fail closed.
- **Python:** keep the feature schema and `engineer.py` as the single source of
  feature logic for both training and serving.
- **Secrets:** read from environment on the server only; no `VITE_` variable may
  hold a secret.

## Adding a detection rule

1. Add the rule definition and its evaluation function in
   `frontend/src/lib/detection/rules.ts` with an explicit threshold and, where one
   applies, an ATT&CK technique already present in the curated set.
2. Make sure it flows through `engine.ts` and `risk.ts` unchanged: a rule produces a
   match with the evidence that satisfied it; scoring is separate.
3. Add a sample file in `frontend/public/samples/` that triggers it, and confirm the
   benign sample still produces no alerts.
4. Update the rule table in the README.

## Pull request process

1. Fill in the [pull request template](.github/PULL_REQUEST_TEMPLATE.md).
2. Make sure CI passes.
3. Keep the pull request focused; unrelated changes will be asked to move to
   another one.
4. Address review comments with new commits; the maintainer may squash on merge.
5. Documentation should match the code in the same pull request.

## Documentation contributions

Documentation fixes are very welcome. Verify any command you document by running it,
and any claim about behaviour against the source. Use relative links, and
screenshots only from the real running application.
