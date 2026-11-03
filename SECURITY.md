# Security Policy

SOCGenie is an academic prototype maintained by a student on a best-effort basis.
This page explains how to report a vulnerability and what to expect.

## Supported versions

Only the latest commit on the `main` branch is supported. There are no versioned
releases or backported fixes.

| Version | Supported |
|---|---|
| `main` (latest) | Yes |
| Anything else | No |

## Reporting a vulnerability

**Please do not open a public issue, pull request or discussion for a suspected
vulnerability.**

Report it privately:

1. **Preferred:** if GitHub private vulnerability reporting is enabled for this
   repository, use *Security → Report a vulnerability*. (If you do not see that
   option, it is not enabled.)
2. **Otherwise:** contact the maintainer, [@SargunKaur15](https://github.com/SargunKaur15),
   through their GitHub profile and ask for a private way to send the details. Do not
   include exploit details in a public message.

Please include, where you can:

- a description of the issue and its impact;
- the affected file, endpoint or component;
- steps to reproduce, or a proof of concept that stays within your own environment;
- the commit you tested.

No security email address is published for this project; please do not guess one.

## What to expect

This is a volunteer, academic project, so there is no service-level agreement and
no bug bounty. The maintainer will aim to acknowledge a report, assess it, and fix
valid issues as time allows, and to credit reporters who want credit. Please allow a
reasonable time before any public disclosure, and act in good faith: no data
destruction, no access to data that is not yours, no denial-of-service testing against
infrastructure you do not own.

## Scope

In scope, for the code in this repository:

- the Node server (`server/src/`): authentication, token handling, origin policy,
  input validation, rate limiting, AI proxy, redaction and output guarding, ML gateway;
- the ML service (`ml/service/`): artifact verification and request handling;
- the frontend where it renders untrusted content (logs, model output) or handles
  tokens.

Known and intentional, not vulnerabilities by themselves:

- **Demo credentials.** The values in `.env.example` are development placeholders.
  The login screen advertises demo accounts, and the server verifies their passwords
  only to issue a role-bearing demo token. This is not an identity provider.
- **Client-side session.** The UI session is client state and is not treated as
  authentication; the server relies only on its signed token.
- **No persistence.** There is no database; application data lives in browser memory.
- **Synthetic data.** Bundled alerts and hosts are illustrative.

Out of scope: vulnerabilities in third-party dependencies with no demonstrated impact
on SOCGenie (please report those upstream), social engineering, and physical attacks.

## Security measures in the code

A summary of implemented controls is in the README under
[Security Considerations](README.md#security-considerations): origin allow-list,
JSON-only requests, input validation, rate limits, HMAC-signed tokens held in memory,
fail-closed credentials, redaction of credential material before LLM calls, output
guarding, and SHA-256 verification of model artifacts before loading.

SOCGenie makes no claim of compliance certification or production-grade assurance.

## If you find a secret in the repository

Secrets must not be committed. If you find one (an API key, token or password that is
not a documented placeholder), report it privately as above so it can be revoked and
removed.
