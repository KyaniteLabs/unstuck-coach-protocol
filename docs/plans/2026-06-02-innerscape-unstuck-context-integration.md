# Innerscape Unstuck Context Integration Implementation Plan

**Goal:** Build the first integrated "What is real right now?" flow where Unstuck Coach pulls Innerscape context plus calendar and inbox reality signals, then returns one humane next move and writes the outcome back to Innerscape.

**Architecture:** Innerscape remains the system of record for user state, captures, tasks, projects, body signals, and coaching outcomes. Unstuck becomes a state-aware coaching engine with read adapters for Innerscape, calendar, and inbox, plus explicit approval gates before any external mutation such as sending email, deleting messages, or editing calendar events. The first release should be read-mostly: aggregate context, route through Unstuck's coaching rules, return one move, and persist a coaching receipt.

**Tech Stack:** Unstuck Coach markdown protocol files and verification scripts; Innerscape TypeScript monorepo with Fastify, Prisma, PostgreSQL, Zod, Expo/React Native, TanStack Query; future Google Calendar/Gmail connectors through the Codex connector or OAuth-backed app adapters.

---

## Product Boundary

Unstuck and Innerscape should be both:

- **Innerscape:** the life OS and memory layer.
- **Unstuck:** the summonable coaching layer that decides the next humane move.

The product promise is:

> When you are stuck, Unstuck gives one next move. Over time, Innerscape learns enough context to make that move better.

Calendar and inbox are not dashboards of guilt. They are reality inputs that help Unstuck identify hard anchors, live obligations, and safe parking moves.

Human review surface:

- `docs/integration-dashboard.html` turns this plan and the integration reference docs into a filterable HTML/CSS decision dashboard with scorecards, timelines, matrices, and source links.
- `reference/landing-live-app-implications.md` keeps the Unstuck landing page, Innerscape landing page, and live Unstuck app aligned while the merge is incomplete.

## Implementation Status: June 2, 2026

Completed locally:

- Unstuck integration contract, landing/live-app implications, verifier, and HTML decision dashboard exist on `codex/innerscape-unstuck-context`.
- Innerscape shared context contract, backend Hub route, and calendar/inbox consent plan exist on the Innerscape `codex/innerscape-unstuck-context` worktree.
- The literal EF-COACH live app branch `codex/innerscape-unstuck-context` adds an optional Innerscape context bridge:
  - `GET /api/context-status` returns redacted disabled, available, or unavailable status.
  - `POST /api/coach` can append redacted read-only Innerscape context when `INNERSCAPE_CONTEXT_ENABLED=true` and `INNERSCAPE_CONTEXT_URL` are configured.
  - Non-local context URLs require `INNERSCAPE_CONTEXT_ALLOWLIST`.
  - Usage events stay count-level and must not include raw prompts, tokens, user ids, calendar titles, inbox subjects, evidence, or histories.

Not completed yet:

- The EF-COACH bridge is local only; it has not been pushed, deployed, or configured on the live host.
- Google Calendar and Gmail are not connected in production.
- Coaching receipts are not yet persisted back into Innerscape.
- Innerscape DB-backed Hub route tests still need a local PostgreSQL-backed verification pass.

## First Feature: What Is Real Right Now?

The user opens Unstuck from inside Innerscape and says something like:

```text
I am frozen.
```

The system gathers:

- Latest Innerscape emotional context: energy, valence, body state, recent check-ins.
- Active Flow context: tasks, habits, goals, unfinished next steps.
- Hub context: captures, projects, shutdown/re-entry notes.
- Calendar reality: next hard anchor, start time, meeting link if available, buffer window.
- Inbox reality: unread or recent messages that match the live-obligation filter.

The system returns exactly one coaching move:

```text
The meeting is the hard anchor. Inbox, bill, and food are parked for the next five minutes.
Open the meeting link now. If water is within reach, put it beside you.
Reply: link open.
```

Then it stores a receipt in Innerscape:

- prompt
- inferred state
- sources consulted
- selected move
- parked items
- proof requested
- user proof/result
- whether any external action was approved

## Data Contract

Create a shared contract before implementation so Unstuck and Innerscape do not drift.

```ts
export type ContextSource = 'innerscape' | 'calendar' | 'inbox' | 'user_prompt';

export type UserCapacityState = {
  energy: 'high' | 'low' | 'unknown';
  valence: 'pleasant' | 'unpleasant' | 'mixed' | 'neutral' | 'unknown';
  confidence: number;
  evidence: string[];
};

export type HardAnchor = {
  id: string;
  title: string;
  startsAt: string;
  endsAt?: string;
  location?: string;
  meetingUrl?: string;
  minutesUntilStart: number;
  source: 'calendar';
};

export type LiveInboxObligation = {
  id: string;
  from: string;
  subject: string;
  receivedAt: string;
  reason: 'time' | 'money' | 'safety' | 'legal' | 'relationship' | 'person_waiting';
  literalAsk?: string;
  source: 'inbox';
};

export type InnerscapeContextSnapshot = {
  userId: string;
  capturedAt: string;
  capacity: UserCapacityState;
  openTasks: Array<{ id: string; title: string; dueAt?: string; source: 'innerscape' }>;
  activeProjects: Array<{ id: string; title: string; nextStep?: string; source: 'innerscape' }>;
  recentCaptures: Array<{ id: string; text: string; createdAt: string; source: 'innerscape' }>;
  hardAnchors: HardAnchor[];
  liveInboxObligations: LiveInboxObligation[];
};

export type CoachingMove = {
  reflection: string;
  nextMove: string;
  proofRequest: string;
  parked: string[];
  sourceIds: string[];
  requiresApproval: boolean;
};

export type CoachingReceipt = {
  id: string;
  userId: string;
  createdAt: string;
  userPrompt: string;
  snapshot: InnerscapeContextSnapshot;
  move: CoachingMove;
  result?: 'done' | 'parked' | 'needs_follow_up';
  proofText?: string;
};
```

## Approval Boundary

Read-only actions may happen automatically after the user connects accounts:

- Read latest Innerscape context.
- Read upcoming calendar anchors.
- Read inbox metadata and snippets needed for live-obligation detection.

External writes require explicit user approval:

- Send or schedule an email.
- Archive, delete, mark read, label, or move inbox items.
- Create, edit, delete, or RSVP to calendar events.
- Share data outside Innerscape.

The coach may draft actions without approval, but must ask before executing them.

## Implementation Tasks

### Task 1: Document The Integration Contract In Unstuck

**Files:**
- Create: `/Users/simongonzalezdecruz/Documents/Unstuck Coach/reference/innerscape-integration.md`
- Modify: `/Users/simongonzalezdecruz/Documents/Unstuck Coach/PROJECT_INSTRUCTIONS.md`
- Test: `/Users/simongonzalezdecruz/Documents/Unstuck Coach/scripts/verify-innerscape-integration.mjs`

**Step 1: Write the failing verifier**

Create `scripts/verify-innerscape-integration.mjs`:

```js
import { readFileSync } from 'node:fs';

const requiredFiles = [
  'reference/innerscape-integration.md',
  'PROJECT_INSTRUCTIONS.md',
];

const requiredPhrases = [
  'Innerscape is the system of record',
  'Unstuck is the coaching layer',
  'What is real right now',
  'Calendar and inbox are reality inputs',
  'External writes require explicit approval',
];

let failed = false;

for (const file of requiredFiles) {
  const text = readFileSync(file, 'utf8');
  for (const phrase of requiredPhrases) {
    if (!text.includes(phrase)) {
      console.error(`${file} missing phrase: ${phrase}`);
      failed = true;
    }
  }
}

if (failed) process.exit(1);
console.log('Innerscape integration contract verified.');
```

**Step 2: Run verifier to verify it fails**

Run:

```bash
node scripts/verify-innerscape-integration.mjs
```

Expected: FAIL because `reference/innerscape-integration.md` does not exist yet.

**Step 3: Write the contract doc**

Create `reference/innerscape-integration.md` with:

```markdown
# Innerscape Integration

Innerscape is the system of record for user state, captures, tasks, projects, body signals, reviews, and coaching receipts.

Unstuck is the coaching layer that turns visible context into one humane next move.

## What Is Real Right Now

When the user asks for help, Unstuck may pull:

- latest Innerscape emotional/body/task/capture context
- next calendar hard anchor
- inbox items matching the live-obligation filter

Calendar and inbox are reality inputs, not guilt dashboards.

## Write Boundary

External writes require explicit approval.

Unstuck may draft a reply, calendar block, label, or park action, but it must not send, delete, archive, label, RSVP, or edit external systems without confirmation.
```

**Step 4: Reference it from project instructions**

Add `reference/innerscape-integration.md` to the list of operating files in `PROJECT_INSTRUCTIONS.md`.

**Step 5: Run verifier**

Run:

```bash
node scripts/verify-innerscape-integration.mjs
```

Expected: PASS with `Innerscape integration contract verified.`

**Step 6: Run existing public-bundle verification**

Run:

```bash
node scripts/verify-public-bundle.mjs
```

Expected: PASS.

**Step 7: Commit**

```bash
git add PROJECT_INSTRUCTIONS.md reference/innerscape-integration.md scripts/verify-innerscape-integration.mjs docs/plans/2026-06-02-innerscape-unstuck-context-integration.md
git commit -m "docs: plan innerscape unstuck context integration"
```

### Task 2: Add The Shared Context Types To Innerscape

**Files:**
- Modify: `/Users/simongonzalezdecruz/workspaces/kyanite-labs/Innerscape/packages/shared/src/index.ts`
- Create: `/Users/simongonzalezdecruz/workspaces/kyanite-labs/Innerscape/packages/shared/src/unstuck.ts`
- Test: `/Users/simongonzalezdecruz/workspaces/kyanite-labs/Innerscape/packages/shared/src/unstuck.test.ts`

**Step 1: Write the failing type test**

Create `packages/shared/src/unstuck.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { CoachingReceipt, InnerscapeContextSnapshot } from './unstuck';

describe('Unstuck context contract', () => {
  it('represents a read-mostly context snapshot and coaching receipt', () => {
    const snapshot: InnerscapeContextSnapshot = {
      userId: 'user-1',
      capturedAt: '2026-06-02T12:00:00.000Z',
      capacity: {
        energy: 'low',
        valence: 'unpleasant',
        confidence: 0.8,
        evidence: ['latest check-in'],
      },
      openTasks: [],
      activeProjects: [],
      recentCaptures: [],
      hardAnchors: [],
      liveInboxObligations: [],
    };

    const receipt: CoachingReceipt = {
      id: 'receipt-1',
      userId: 'user-1',
      createdAt: '2026-06-02T12:00:00.000Z',
      userPrompt: 'I am frozen.',
      snapshot,
      move: {
        reflection: 'This is overload, not failure.',
        nextMove: 'Open the meeting link.',
        proofRequest: 'Reply: link open.',
        parked: ['inbox'],
        sourceIds: [],
        requiresApproval: false,
      },
    };

    expect(receipt.move.requiresApproval).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
cd /Users/simongonzalezdecruz/workspaces/kyanite-labs/Innerscape
npx vitest packages/shared/src/unstuck.test.ts --run
```

Expected: FAIL because `./unstuck` is missing.

**Step 3: Add shared types**

Create `packages/shared/src/unstuck.ts` using the Data Contract section above.

Export it from `packages/shared/src/index.ts`:

```ts
export * from './unstuck';
```

**Step 4: Run test**

Run:

```bash
npx vitest packages/shared/src/unstuck.test.ts --run
```

Expected: PASS.

**Step 5: Run shared typecheck**

Run:

```bash
npx tsc --noEmit
```

Expected: PASS.

**Step 6: Commit**

```bash
git add packages/shared/src/unstuck.ts packages/shared/src/unstuck.test.ts packages/shared/src/index.ts
git commit -m "feat: add unstuck context contract"
```

### Task 3: Add A Read-Only Context Snapshot Endpoint In Innerscape

**Files:**
- Modify: `/Users/simongonzalezdecruz/workspaces/kyanite-labs/Innerscape/apps/backend/src/routes/hub.ts`
- Modify: `/Users/simongonzalezdecruz/workspaces/kyanite-labs/Innerscape/apps/backend/src/server.ts` if route registration needs adjustment
- Test: `/Users/simongonzalezdecruz/workspaces/kyanite-labs/Innerscape/apps/backend/tests/integration/hub-routes.test.ts`

**Step 1: Write failing integration test**

Add a test that authenticates as a user and requests:

```ts
GET /api/v1/hub/unstuck/context
```

Expected response shape:

```ts
expect(response.statusCode).toBe(200);
expect(body).toHaveProperty('userId');
expect(body).toHaveProperty('capturedAt');
expect(body).toHaveProperty('capacity');
expect(body).toHaveProperty('openTasks');
expect(body).toHaveProperty('activeProjects');
expect(body).toHaveProperty('recentCaptures');
expect(body).toHaveProperty('hardAnchors');
expect(body).toHaveProperty('liveInboxObligations');
```

**Step 2: Run test to verify it fails**

Run:

```bash
cd /Users/simongonzalezdecruz/workspaces/kyanite-labs/Innerscape/apps/backend
npm test -- tests/integration/hub-routes.test.ts
```

Expected: FAIL with 404 or missing route.

**Step 3: Implement minimal endpoint**

Add a read-only route that returns current Innerscape-only context first:

```ts
app.get('/unstuck/context', { preHandler: [authenticate] }, async (request) => {
  const userId = request.user.id;

  return {
    userId,
    capturedAt: new Date().toISOString(),
    capacity: {
      energy: 'unknown',
      valence: 'unknown',
      confidence: 0,
      evidence: [],
    },
    openTasks: [],
    activeProjects: [],
    recentCaptures: [],
    hardAnchors: [],
    liveInboxObligations: [],
  };
});
```

Then replace empty arrays with real Innerscape reads in later commits.

**Step 4: Run test**

Run:

```bash
npm test -- tests/integration/hub-routes.test.ts
```

Expected: PASS.

**Step 5: Run backend typecheck**

Run:

```bash
npx tsc --noEmit
```

Expected: PASS.

**Step 6: Commit**

```bash
git add apps/backend/src/routes/hub.ts apps/backend/tests/integration/hub-routes.test.ts
git commit -m "feat: expose unstuck context snapshot"
```

### Task 4: Add Calendar And Inbox Adapter Interfaces

**Files:**
- Create: `/Users/simongonzalezdecruz/workspaces/kyanite-labs/Innerscape/apps/backend/src/services/reality-adapters.ts`
- Test: `/Users/simongonzalezdecruz/workspaces/kyanite-labs/Innerscape/apps/backend/tests/unit/reality-adapters.test.ts`

**Step 1: Write failing unit tests**

Test that the no-op adapters return empty arrays and preserve read-only behavior:

```ts
import { describe, expect, it } from 'vitest';
import { createNoopRealityAdapters } from '../../src/services/reality-adapters';

describe('reality adapters', () => {
  it('returns empty read-only context when connectors are not configured', async () => {
    const adapters = createNoopRealityAdapters();
    await expect(adapters.calendar.listHardAnchors('user-1')).resolves.toEqual([]);
    await expect(adapters.inbox.listLiveObligations('user-1')).resolves.toEqual([]);
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
cd /Users/simongonzalezdecruz/workspaces/kyanite-labs/Innerscape/apps/backend
npx vitest tests/unit/reality-adapters.test.ts --run
```

Expected: FAIL because service does not exist.

**Step 3: Implement interfaces**

```ts
import type { HardAnchor, LiveInboxObligation } from '@innerscape/shared';

export type CalendarRealityAdapter = {
  listHardAnchors(userId: string): Promise<HardAnchor[]>;
};

export type InboxRealityAdapter = {
  listLiveObligations(userId: string): Promise<LiveInboxObligation[]>;
};

export type RealityAdapters = {
  calendar: CalendarRealityAdapter;
  inbox: InboxRealityAdapter;
};

export function createNoopRealityAdapters(): RealityAdapters {
  return {
    calendar: {
      async listHardAnchors() {
        return [];
      },
    },
    inbox: {
      async listLiveObligations() {
        return [];
      },
    },
  };
}
```

**Step 4: Wire adapters into the context endpoint**

The first pass may use no-op adapters so the endpoint remains stable before OAuth/connector work.

**Step 5: Run tests and typecheck**

Run:

```bash
npx vitest tests/unit/reality-adapters.test.ts --run
npm test -- tests/integration/hub-routes.test.ts
npx tsc --noEmit
```

Expected: PASS.

**Step 6: Commit**

```bash
git add apps/backend/src/services/reality-adapters.ts apps/backend/tests/unit/reality-adapters.test.ts apps/backend/src/routes/hub.ts
git commit -m "feat: add read-only reality adapters"
```

### Task 5: Add The Unstuck Coaching Route

**Files:**
- Create: `/Users/simongonzalezdecruz/workspaces/kyanite-labs/Innerscape/apps/backend/src/services/unstuck-coach.ts`
- Modify: `/Users/simongonzalezdecruz/workspaces/kyanite-labs/Innerscape/apps/backend/src/routes/hub.ts`
- Test: `/Users/simongonzalezdecruz/workspaces/kyanite-labs/Innerscape/apps/backend/tests/integration/hub-routes.test.ts`

**Step 1: Write failing test**

Test:

```ts
POST /api/v1/hub/unstuck/coach
{ "prompt": "I am frozen." }
```

Expected:

```ts
expect(response.statusCode).toBe(200);
expect(body.move).toHaveProperty('reflection');
expect(body.move).toHaveProperty('nextMove');
expect(body.move).toHaveProperty('proofRequest');
expect(body.move.requiresApproval).toBe(false);
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/integration/hub-routes.test.ts
```

Expected: FAIL because route does not exist.

**Step 3: Implement deterministic first-pass coach service**

Start rules-based before model-backed generation:

```ts
import type { CoachingMove, InnerscapeContextSnapshot } from '@innerscape/shared';

export function chooseUnstuckMove(
  prompt: string,
  snapshot: InnerscapeContextSnapshot,
): CoachingMove {
  const imminentAnchor = snapshot.hardAnchors
    .filter((anchor) => anchor.minutesUntilStart >= 0 && anchor.minutesUntilStart < 10)
    .sort((a, b) => a.minutesUntilStart - b.minutesUntilStart)[0];

  if (imminentAnchor) {
    return {
      reflection: `${imminentAnchor.title} is the hard anchor.`,
      nextMove: imminentAnchor.meetingUrl
        ? 'Open the meeting link now.'
        : 'Put the meeting surface in front of you now.',
      proofRequest: imminentAnchor.meetingUrl ? 'Reply: link open.' : 'Reply: surface open.',
      parked: ['inbox', 'task pile'],
      sourceIds: [imminentAnchor.id],
      requiresApproval: false,
    };
  }

  if (snapshot.capacity.energy === 'low' && snapshot.capacity.valence === 'unpleasant') {
    return {
      reflection: 'This reads like low-capacity overload, not failure.',
      nextMove: 'Take the smallest available body support: water, food, bathroom, or feet on floor.',
      proofRequest: 'Reply with one word: reset.',
      parked: ['task pile'],
      sourceIds: [],
      requiresApproval: false,
    };
  }

  return {
    reflection: 'The field is too wide, so I am narrowing it.',
    nextMove: 'Send or select the messiest three items. I will sort them outside your head.',
    proofRequest: 'Reply with any three fragments.',
    parked: [],
    sourceIds: [],
    requiresApproval: false,
  };
}
```

**Step 4: Add Zod validation**

The route should reject empty prompts:

```ts
const CoachRequestSchema = z.object({
  prompt: z.string().trim().min(1),
});
```

**Step 5: Run tests and typecheck**

Run:

```bash
npm test -- tests/integration/hub-routes.test.ts
npx tsc --noEmit
```

Expected: PASS.

**Step 6: Commit**

```bash
git add apps/backend/src/services/unstuck-coach.ts apps/backend/src/routes/hub.ts apps/backend/tests/integration/hub-routes.test.ts
git commit -m "feat: add unstuck coaching route"
```

### Task 6: Persist Coaching Receipts

**Files:**
- Modify: `/Users/simongonzalezdecruz/workspaces/kyanite-labs/Innerscape/apps/backend/prisma/schema.prisma`
- Add migration under: `/Users/simongonzalezdecruz/workspaces/kyanite-labs/Innerscape/apps/backend/prisma/migrations/`
- Modify: `/Users/simongonzalezdecruz/workspaces/kyanite-labs/Innerscape/apps/backend/src/routes/hub.ts`
- Test: `/Users/simongonzalezdecruz/workspaces/kyanite-labs/Innerscape/apps/backend/tests/integration/hub-routes.test.ts`

**Step 1: Write failing receipt persistence test**

After calling `/unstuck/coach`, assert a receipt is returned with an `id` and can be listed:

```ts
expect(body).toHaveProperty('id');
expect(body).toHaveProperty('createdAt');
```

Then:

```ts
GET /api/v1/hub/unstuck/receipts
```

Expected: includes the created receipt.

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/integration/hub-routes.test.ts
```

Expected: FAIL because persistence does not exist.

**Step 3: Add Prisma model**

```prisma
model CoachingReceipt {
  id        String   @id @default(uuid())
  userId    String
  createdAt DateTime @default(now())
  prompt    String
  snapshot  Json
  move      Json
  result    String?
  proofText String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
}
```

Add the matching relation to `User`:

```prisma
coachingReceipts CoachingReceipt[]
```

**Step 4: Generate migration**

Run:

```bash
npx prisma migrate dev --name add_coaching_receipts
```

Expected: migration created and Prisma client updated.

**Step 5: Persist receipts from coach route**

Store:

- prompt
- snapshot JSON
- move JSON
- userId

**Step 6: Add list endpoint**

```ts
GET /api/v1/hub/unstuck/receipts
```

Return latest 20 receipts by `createdAt desc`.

**Step 7: Run tests and typecheck**

Run:

```bash
npm test -- tests/integration/hub-routes.test.ts
npx tsc --noEmit
```

Expected: PASS.

**Step 8: Commit**

```bash
git add apps/backend/prisma/schema.prisma apps/backend/prisma/migrations apps/backend/src/routes/hub.ts apps/backend/tests/integration/hub-routes.test.ts
git commit -m "feat: persist unstuck coaching receipts"
```

### Task 7: Add Mobile Entry Point

**Files:**
- Create: `/Users/simongonzalezdecruz/workspaces/kyanite-labs/Innerscape/apps/mobile/hooks/useUnstuckCoach.ts`
- Create: `/Users/simongonzalezdecruz/workspaces/kyanite-labs/Innerscape/apps/mobile/components/hub/UnstuckCoachPanel.tsx`
- Modify: `/Users/simongonzalezdecruz/workspaces/kyanite-labs/Innerscape/apps/mobile/app/(tabs)/hub.tsx`

**Step 1: Add hook**

```ts
import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { CoachingReceipt } from '@innerscape/shared';

export function useUnstuckCoach() {
  return useMutation({
    mutationFn: (prompt: string) =>
      api.post<CoachingReceipt>('/api/v1/hub/unstuck/coach', { prompt }),
  });
}
```

**Step 2: Add panel**

The panel should contain:

- One compact prompt input.
- A primary action labeled `What is real right now?`.
- Result display with reflection, next move, proof request, and parked items.
- No long dashboards or full inbox/calendar lists.

**Step 3: Add panel to Hub**

Place near quick capture, because it is an immediate support surface.

**Step 4: Typecheck mobile**

Run:

```bash
cd /Users/simongonzalezdecruz/workspaces/kyanite-labs/Innerscape/apps/mobile
npx tsc --noEmit
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/mobile/hooks/useUnstuckCoach.ts apps/mobile/components/hub/UnstuckCoachPanel.tsx "apps/mobile/app/(tabs)/hub.tsx"
git commit -m "feat: add unstuck coach hub panel"
```

### Task 8: Add Connector Consent And Future OAuth Notes

**Files:**
- Create: `/Users/simongonzalezdecruz/workspaces/kyanite-labs/Innerscape/docs/plans/2026-06-02-calendar-inbox-consent.md`
- Modify: `/Users/simongonzalezdecruz/workspaces/kyanite-labs/Innerscape/PRD.md`

**Step 1: Document consent model**

The doc must say:

- Calendar and inbox are optional.
- Read-only context powers "What is real right now?"
- External writes require explicit approval.
- Message content should be minimized: metadata and snippets first, full body only when the user selects a message or asks to draft.
- The system must show which sources informed a coaching move.

**Step 2: Update PRD**

Add a short section under AI communication or Hub:

```markdown
### Unstuck Coach Context Layer

Unstuck Coach is the summonable coaching layer inside Innerscape. It uses Innerscape state, optional calendar hard anchors, and optional inbox live obligations to return one next humane move. Calendar and inbox are reality inputs, not dashboards. External writes require explicit approval.
```

**Step 3: Commit**

```bash
git add docs/plans/2026-06-02-calendar-inbox-consent.md PRD.md
git commit -m "docs: define calendar inbox consent for unstuck"
```

## Verification Checklist

Run from Unstuck:

```bash
cd /Users/simongonzalezdecruz/Documents/Unstuck\ Coach
node scripts/verify-innerscape-integration.mjs
node scripts/verify-public-bundle.mjs
```

Run from Innerscape:

```bash
cd /Users/simongonzalezdecruz/workspaces/kyanite-labs/Innerscape
npx vitest packages/shared/src/unstuck.test.ts --run
cd apps/backend && npm test -- tests/integration/hub-routes.test.ts
cd apps/backend && npx tsc --noEmit
cd ../mobile && npx tsc --noEmit
```

Manual smoke:

1. Start the Innerscape backend.
2. Open the mobile/web app.
3. Navigate to Hub.
4. Type `I am frozen.`
5. Tap `What is real right now?`
6. Confirm the response has one reflection, one next move, one proof request, and no long dashboard.

## Non-Goals For First Release

- No automatic email sending.
- No inbox archiving or labeling.
- No calendar edits.
- No model-backed freeform agent actions.
- No broad dashboard of calendar and inbox items.
- No clinical claims from body, inbox, or calendar context.

## Recommended Execution Order

1. Finish Task 1 in Unstuck to lock the coaching/product contract.
2. Finish Tasks 2-6 in Innerscape backend.
3. Keep the EF-COACH bridge local until the deployment endpoint, allowlist, timeout, and rollback plan are reviewed.
4. Finish Task 7 in Innerscape mobile.
5. Finish Task 8 before any real Google Calendar or Gmail OAuth work.
6. Keep `docs/integration-dashboard.html` updated whenever the merge status, landing-page recommendation, live-app state, or decision queue changes.

This order keeps the sharp Unstuck behavior intact while letting Innerscape become the context layer that makes the coach smarter.
