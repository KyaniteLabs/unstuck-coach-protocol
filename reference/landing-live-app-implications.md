# Landing And Live App Implications

This document keeps the public-facing surfaces aligned while Unstuck and Innerscape merge.

## Bottom Line

Unstuck should not disappear into Innerscape.

Innerscape should become the life OS and context layer. Unstuck should become the summonable coaching layer that reads that context and returns one next humane move.

The landing pages and the live app should explain that relationship without making users learn the architecture.

## Unstuck Landing Page

The Unstuck landing page should stay focused on immediate relief:

- "I am stuck right now."
- "Give me one humane next move."
- "Hold the rest outside my head."
- "Calendar, inbox, body, and task context can make the next move better."

The page should introduce Innerscape as the context system behind the coach, not as a replacement for the coach.

Recommended landing message:

```text
Unstuck is the coach you summon when the next move will not appear.
Innerscape is the life OS that helps Unstuck know what is real.
```

Primary CTA should remain a stuck-loop action, not a platform tour.

## Innerscape Landing Page

The Innerscape landing page should lead with the broader system:

- life OS
- emotional/body context
- capture and memory
- calendar and inbox reality
- Unstuck as the "I am stuck" mode

Recommended landing message:

```text
Innerscape is the context layer for a neurodivergent life.
Unstuck is the one-button coaching mode that turns that context into a next move.
```

Primary CTA can be the app/home-base promise. Secondary CTA should be "Try Unstuck mode" or "What is real right now?"

## Live Unstuck App

The live Unstuck app should stay up during the merge.

It is the working proof that the coaching behavior is sharp. Do not retire it until the Innerscape-hosted mode reaches behavior parity and can pass the same first-reply acceptance checks.

Current implementation status on June 2, 2026:

- The EF-COACH local branch `codex/innerscape-unstuck-context` adds an optional Innerscape context bridge for the literal live app.
- The bridge is opt-in with `INNERSCAPE_CONTEXT_ENABLED=true` plus `INNERSCAPE_CONTEXT_URL`.
- `/api/context-status` returns only redacted availability and count-level context.
- `/api/coach` can add redacted read-only Innerscape context to the model prompt when the bridge is available.
- The bridge is not deployed, not pushed, and not connected to production Google Calendar or Gmail.

Recommended live-app state:

- Keep the existing standalone app/demo available.
- Add a small integration notice only after the Innerscape context endpoint is usable from the deployed live app.
- Add "context connected" states later, not before they are real.
- Keep the fallback behavior: if Innerscape, calendar, or inbox is unavailable, Unstuck still coaches from the visible prompt.

## Merge Rule

The live app moves in this order:

1. Standalone Unstuck stays live.
2. Innerscape exposes read-only context.
3. Unstuck can optionally pull redacted context from Innerscape on a local branch.
4. Calendar and inbox read-only connectors add hard anchors and live obligations.
5. Coaching receipts write back to Innerscape.
6. Only after parity, decide whether Unstuck remains a separate public app, becomes an Innerscape mode, or stays both.

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
- "Innerscape is fully merged with Unstuck."

## Decision Default

Default to both:

- Unstuck remains the immediate-access coaching surface.
- Innerscape becomes the durable context and memory system.
- The live app remains available until Innerscape-hosted Unstuck passes the same behavior checks.
