# Innerscape Integration

Human review dashboard: `docs/integration-dashboard.html`.

Landing/live-app implications: `reference/landing-live-app-implications.md`.

Innerscape is the system of record for user state, captures, tasks, projects, body signals, reviews, and coaching receipts.

Unstuck is the coaching layer that turns visible context into one humane next move.

## Current Live-App Bridge

As of June 2, 2026, the literal Unstuck live app has a local EF-COACH branch bridge, not a production claim.

- `INNERSCAPE_CONTEXT_ENABLED=true` and `INNERSCAPE_CONTEXT_URL` are both required before the app pulls context.
- Non-local context URLs require `INNERSCAPE_CONTEXT_ALLOWLIST`.
- `/api/context-status` returns redacted availability and count-level summary only.
- `/api/coach` may append a redacted read-only Innerscape context summary to the model prompt.
- Raw user ids, prompts, calendar titles, inbox subjects, evidence, histories, tokens, and API keys must not appear in the public status, prompt context, or usage events.

## What Is Real Right Now

When the user asks for help, Unstuck may pull:

- latest Innerscape emotional, body, task, capture, project, and re-entry context
- next calendar hard anchor
- inbox items matching the live-obligation filter

Calendar and inbox are reality inputs, not guilt dashboards. They help Unstuck identify hard anchors, live obligations, safe parking moves, and body-first constraints.

Unstuck still returns one move. It should not expose a broad calendar or inbox dashboard when the user needs coaching.

## Source Order

Use the smallest useful context set:

1. User prompt and visible conversation.
2. Innerscape state and receipts.
3. Calendar hard anchors.
4. Inbox live obligations.

If a hard calendar anchor is imminent, it can outrank the rest of the pile. If body or capacity context is low, body support can outrank admin cleanup.

## Write Boundary

External writes require explicit approval.

Unstuck may draft a reply, calendar block, label, parking action, or next-step receipt, but it must not send, delete, archive, label, RSVP, or edit external systems without confirmation.

Read-only context may be used to lower working-memory load after the user has connected the source. The coach should name uncertainty when context is inferred and must not turn calendar, inbox, or body facts into hidden character judgments or clinical claims.

## Receipt Boundary

When Unstuck gives a context-aware move, Innerscape should be able to store a receipt:

- user prompt
- sources consulted
- inferred capacity state
- selected next move
- parked items
- proof requested
- result or proof text
- whether any external action was approved

The receipt exists to reduce repeat tax and support re-entry. It is not a scorecard.
