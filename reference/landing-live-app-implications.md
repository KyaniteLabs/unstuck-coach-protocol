# Landing And Live App Implications

This document keeps the public-facing surfaces aligned while offline Unstuck is merged into Innerscape.

## Bottom Line

Online Unstuck stays exactly where it is. Do not touch it during this merge.

Offline Unstuck should merge 100% into Innerscape. Innerscape becomes the life OS and context layer. Unstuck becomes the summonable coaching mode inside Innerscape that reads that context and returns one next humane move.

Innerscape is now taken down behind a merge hold screen until the merge is complete.

The important split is:

- **Online Unstuck:** protected public demo/app. Keep it up and unchanged.
- **Offline Unstuck:** local coaching protocol, prompts, safety boundaries, examples, and verifier contracts. Move these into Innerscape until there is no separate offline product to maintain.
- **Innerscape:** the merged home after the merge. Keep the public surface paused while offline Unstuck is absorbed.

## Online Unstuck Page

The online Unstuck page should stay focused on immediate relief and should not become the merge workspace:

- "I am stuck right now."
- "Give me one humane next move."
- "Hold the rest outside my head."

Do not add integration status clutter to the online Unstuck app. Its job is to keep working.

Recommended online message:

```text
Unstuck is the coach you summon when the next move will not appear.
```

Primary CTA should remain a stuck-loop action, not a platform tour.

## Innerscape Landing Page

The Innerscape page is taken down for the merge. The current surface should be a hold screen, not a product promise.

Hold-screen message:

```text
Innerscape is offline.
Unstuck is being merged into Innerscape.
```

The hold screen can say only:

- online Unstuck stays up and untouched
- offline Unstuck is merging into Innerscape
- calendar and inbox are not live connectors yet

Do not restore a normal Innerscape landing/app surface until the built-in Unstuck mode, receipts, and consent boundaries are ready enough to be true.

## Current Innerscape Merge State

As of June 2, 2026, the Innerscape `codex/innerscape-unstuck-context` worktree has:

- a root app hold screen at `apps/mobile/components/MergeHoldScreen.tsx`
- imported offline Unstuck protocol docs under `docs/unstuck/`
- shared deterministic Unstuck coach logic at `packages/shared/src/unstuck-coach.ts`
- a context-aware coach route at `POST /api/v1/hub/unstuck/coach`
- a merge verifier at `scripts/verify-unstuck-merge.mjs`

## Live Unstuck App

The live online Unstuck app should stay up and should not be modified during this offline merge.

It is the working proof that the coaching behavior is sharp. It is not the merge target.

Parked local implementation status on June 2, 2026:

- The EF-COACH local branch `codex/innerscape-unstuck-context` adds an optional Innerscape context bridge for the literal live app.
- The bridge is opt-in with `INNERSCAPE_CONTEXT_ENABLED=true` plus `INNERSCAPE_CONTEXT_URL`.
- `/api/context-status` returns only redacted availability and count-level context.
- `/api/coach` can add redacted read-only Innerscape context to the model prompt when the bridge is available.
- The bridge is not deployed, not pushed, and not connected to production Google Calendar or Gmail.

Recommended live-app state:

- Keep the existing standalone app/demo available.
- Do not deploy the local bridge unless explicitly approved later.
- Do not use the online app as the place to track the merge.
- Keep the fallback behavior and current online app intact.

## Merge Rule

The offline merge moves in this order:

1. Online Unstuck stays live and untouched.
2. Innerscape stays paused behind a hold screen until the merge is complete.
3. Offline Unstuck coaching protocol, examples, safety boundaries, and verifier contracts move into Innerscape.
4. Calendar and inbox read-only connectors add hard anchors and live obligations.
5. Coaching receipts write back to Innerscape.
6. Offline Unstuck stops being a separate maintained product once Innerscape has the full mode.

## Public Copy Boundary

Do not claim calendar or inbox integration is live until the connector and consent flow actually work.

Allowed now:

- "Designed to use calendar and inbox context."
- "Integration path in progress."
- "Unstuck will stay useful even without connected accounts."

Not allowed yet:

- "Connect Gmail and Google Calendar now."
- "Unstuck reads your inbox."
- "The app automatically handles your email."
- "Innerscape is fully merged with offline Unstuck" until the full offline merge is actually complete.

## Decision Default

Default to this split:

- Online Unstuck remains untouched.
- Offline Unstuck merges 100% into Innerscape.
- Innerscape remains paused behind a hold screen until the built-in Unstuck mode is complete enough to use honestly.
