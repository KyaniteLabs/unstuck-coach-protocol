# Unstuck protocol architecture

## Parts and data flow

There are two separate experiences, not one hosted agent backend:

```text
protocol Markdown + supplied context -> external AI workspace/model -> coaching reply
                                     -> first-reply/eval scorecards + human review
static landing HTML/CSS -> app.js -> sample comparison / regex console / evidence reader
protocol/evidence files -> Node build/check scripts -> publication artifacts
```

[PROJECT_INSTRUCTIONS.md](PROJECT_INSTRUCTIONS.md) routes the host to identity, rules, examples, coaching/admin/safety references and first-run expectations. It specifies contextual judgment and consent boundaries in prose; the chosen host model/session owns execution, retention and external-tool permissions.

[landing/app.js](landing/app.js) owns navigation/review panels, six canned comparison demos, ordered regex console patterns, output rendering, clipboard controls and evidence-reader hash routing. `coachMoment()` takes the first matching pattern or a calibration fallback; form submission is intercepted and rendered locally with `textContent`. This is a browser rule demo, not a network inference call or persistent coaching history.

[landing/evidence.html](landing/evidence.html) and its reader expose inspection documents. Scripts include a source/VM-based console verifier, static copy/evaluation checks, evidence-page and public-bundle builders, screenshot helpers and staging/publication checks. Read each script before execution: build/stage/publication paths have different side effects from read-only verifiers.

## Risky paths and failure signatures

- **Behavior contract vs implementation:** host models may ignore one-question/one-move, dignity or consent rules. Regex priority can misroute overlapping words, and passing canned cases can preserve behavior that differs from the prose. Evaluate actual replies, not only file markers or console snapshots.
- **Sensitive context:** inbox/calendar/task/body-state inputs can be private. The static console inspected here sends no inference request, but an external host model or connected tools have their own data boundary. Never generalize browser-local demonstration behavior to all integrations.
- **Safety:** accessibility coaching is not professional diagnosis/treatment or crisis handling. Follow the safety reference and human support boundary; successful text generation is not safe outcome evidence.
- **Publication/evidence:** copied transcripts, reports and bundles can leak private context or stale claims. Privacy scans and allowlists are checks, not approval. Do not run staging/publishing scripts merely to verify these docs.
- **Repository confusion:** hosted Unstuck, portable protocol and local Innerscape are distinct. Integration plans are not live sync, a merged feature or authorization to deploy a combined service.
- **Browser failures:** stale hashes/IDs, missing assets, unsupported clipboard behavior or accessibility regressions can leave the page apparently functional but hide evidence or controls. Test rendered navigation and console input, not just JavaScript syntax.

## Verification and rollback

`node scripts/verify-console-behavior.mjs` exercised eleven deterministic cases and six comparison-tab labels with no failures. This is a VM/source harness, not live model/clinical proof. Actual browser console screenshots provide a separate bounded demo check; all host-model, account integration and hosted-product acceptance remains separate. Docs-only rollback is reverting this commit; no protocol behavior, deployment or personal data is changed.
