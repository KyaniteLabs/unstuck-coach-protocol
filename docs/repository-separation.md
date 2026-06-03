# Repository Separation

This file is the repo map. It exists to prevent Unstuck, Innerscape, and Dev Learning Archaeologist from being treated as one project.

## BLUF

- Keep online Unstuck as the existing hosted product. Do not deploy or refactor it during the offline merge.
- Merge offline Unstuck 100% into Innerscape for local/open-source clone-and-run users.
- Keep Dev Learning Archaeologist separate. It is not Unstuck, and it should not contain the old `EF-COACH/` subtree.
- Do not host a combined Innerscape + Unstuck service.

## Repos

| Repo | Owner | Purpose | Boundary |
| --- | --- | --- | --- |
| `KyaniteLabs/unstuck-coach-live` | KyaniteLabs | Hosted Unstuck product code: landing, chat demo, coach contract, and deployment assets. | Extracted from the former `EF-COACH/` subtree. No Innerscape bridge. No deploy in this split. |
| `KyaniteLabs/unstuck-coach-protocol` | KyaniteLabs | This folder: protocol docs, publication evidence, verifier scripts, and integration planning. | Not the hosted app. Not the Innerscape app. Not Dev Learning Archaeologist. |
| `KyaniteLabs/Innerscape` | KyaniteLabs | Local/open-source life OS where offline Unstuck becomes a built-in coaching mode. | Clone-and-run target. No hosted combined service. |
| `KyaniteLabs/dev-learning-archaeologist` | KyaniteLabs | Forensic git-history learning diagnostic. | Separate product. The cleanup branch removes the accidental Unstuck subtree. |
| `simongonzalezdc/unstuck-coach` | Simon legacy namespace | Existing public Unstuck protocol repository. | Do not overwrite it with the extracted live app. |

## What Moves

The former `EF-COACH/` subtree splits two ways:

- Live app code goes to `KyaniteLabs/unstuck-coach-live`.
- Offline coaching protocol and integration planning remain here and are copied into Innerscape-owned docs/code until Innerscape owns the local mode.

The optional local EF-COACH branch that added an Innerscape context bridge stays parked. It is not part of the live extraction and is not a production claim.

## What Does Not Move

- Do not rename or repurpose `KyaniteLabs/dev-learning-archaeologist`.
- Do not push the live app extraction into `simongonzalezdc/unstuck-coach`.
- Do not deploy the live app while doing this repo split.
- Do not publish `reports/` unless a report has been reviewed and sanitized for public release.
- Do not claim Calendar/Gmail OAuth sync is live until self-hosted token exchange and sync are implemented and verified.

## Current Cleanup Flow

1. Push `KyaniteLabs/unstuck-coach-live` from the extracted live app repo.
2. Push `KyaniteLabs/unstuck-coach-protocol` from this protocol/docs repo.
3. Push the Dev Learning Archaeologist cleanup branch that removes `EF-COACH/`.
4. Leave Dev Learning Archaeologist `main` untouched until that cleanup branch is reviewed and merged.

## Product Rule

Online Unstuck stays protected and available. Offline Unstuck is absorbed by Innerscape. The published repo target is source code users can run themselves, not a hosted user-data service operated by Simon or Kyanite.
