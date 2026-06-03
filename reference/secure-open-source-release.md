# Secure Open-Source Release

Human review dashboard: `docs/integration-dashboard.html`.

The safe release shape is local-first open source. People can clone or self-host
Innerscape with Unstuck built in, but Simon/Kyanite is not hosting a combined
Innerscape + Unstuck service.

## Publisher-Safety Rule

Publishing the repo is acceptable only while these are true:

- no shared public Google OAuth client is operated for users
- no hosted combined product stores user life, inbox, calendar, journal, or
  coaching data
- production configs require explicit secrets and CORS origins
- local database defaults bind to loopback
- calendar and inbox remain opt-in, read-only, least-privilege connectors
- users control their own credentials, deployment, data deletion, and connector
  revocation

## Current Secure-Release State

As of June 3, 2026, Innerscape has:

- `SECURITY.md`
- `PRIVACY.md`
- `docs/security/open-source-release-gates.md`
- `docs/plans/2026-06-03-secure-open-source-release.md`
- `scripts/verify-security-posture.mjs`
- shared connector scope policy in `packages/shared/src/connectors.ts`
- Hub connector routes for consent, disconnect, and local-context deletion
- Hub Context tab for Calendar/Gmail control visibility
- CI running `npm run verify:security-posture`
- production JWT and CORS checks in backend config
- production secret/CORS guards in the release checklist
- local Postgres bound to `127.0.0.1`
- Nucbox DB-backed verification for 140 backend integration tests

## Connector Rule

Calendar and Gmail have local connector controls, not live OAuth sync claims.

Allowed first scopes:

- Calendar: `https://www.googleapis.com/auth/calendar.events.readonly`
- Gmail: `https://www.googleapis.com/auth/gmail.metadata`

Blocked first-release scopes:

- `https://mail.google.com/`
- `https://www.googleapis.com/auth/gmail.modify`
- `https://www.googleapis.com/auth/gmail.send`
- `https://www.googleapis.com/auth/calendar`
- `https://www.googleapis.com/auth/calendar.events`

## Remaining Gates

1. Implement real Google OAuth token exchange and sync for self-hosted credentials.
2. Keep write actions blocked until explicit per-action approval exists.
3. Keep the online Unstuck app untouched.
4. Stop maintaining offline Unstuck separately once Innerscape fully owns the
   local mode.
