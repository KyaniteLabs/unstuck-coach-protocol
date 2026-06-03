import { readFileSync } from 'node:fs';

const checks = [
  {
    file: 'reference/innerscape-integration.md',
    phrases: [
      'Innerscape is the system of record',
      'Offline Unstuck merges 100% into Innerscape',
      'Online Unstuck is not the merge target',
      'Do not host a combined Innerscape + Unstuck product',
      'Current Innerscape Merge State',
      'clone-and-run users',
      'persisted coaching receipts',
      'local Postgres setup',
      'configurable DB port',
      'complete migration history',
      'CI migration verification',
      'security posture verifier',
      'production secret/CORS guards',
      '140 backend integration tests',
      'Hub connector controls',
      'Real Google OAuth sync is still a gated future step',
      'Current Live-App Bridge',
      'What Is Real Right Now',
      'Calendar and inbox are reality inputs',
      'External writes require explicit approval',
      'The receipt exists to reduce repeat tax',
    ],
  },
  {
    file: 'PROJECT_INSTRUCTIONS.md',
    phrases: [
      'reference/innerscape-integration.md',
      'reference/landing-live-app-implications.md',
      'reference/secure-open-source-release.md',
      'Innerscape is the system of record',
      'Calendar and inbox are reality inputs',
      'External writes require explicit approval',
    ],
  },
  {
    file: 'reference/landing-live-app-implications.md',
    phrases: [
      'Online Unstuck stays exactly where it is',
      'Offline Unstuck should merge 100% into Innerscape',
      'Innerscape does not need to be hosted as a combined product',
      'The live online Unstuck app should stay up and should not be modified during this offline merge',
      'optional Innerscape context bridge',
      'security release posture',
      'not deployed, not pushed',
      'Do not claim calendar or inbox integration is live',
      'Default to this split',
    ],
  },
  {
    file: 'docs/integration-dashboard.html',
    phrases: [
      'Unstuck + Innerscape Integration Dashboard',
      'Freeze online Unstuck',
      'Merge offline Unstuck into Innerscape 100%',
      'Repository separation',
      'Fresh repos, separate products.',
      'KyaniteLabs/unstuck-coach-live',
      'KyaniteLabs/unstuck-coach-protocol',
      'KyaniteLabs/dev-learning-archaeologist',
      'do not host a combined Innerscape product',
      'Offline merge target',
      'Literal app that is up',
      'Hosted combo',
      'Local Postgres path',
      'configurable DB port',
      'Nucbox DB-backed tests',
      'Security posture',
      'Connector controls',
      'OAuth sync',
      'Publisher safety',
      'Receipts write back',
      'Decision queue',
    ],
  },
  {
    file: 'docs/repository-separation.md',
    phrases: [
      'Keep online Unstuck as the existing hosted product',
      'Merge offline Unstuck 100% into Innerscape',
      'Keep Dev Learning Archaeologist separate',
      'KyaniteLabs/unstuck-coach-live',
      'KyaniteLabs/unstuck-coach-protocol',
      'KyaniteLabs/Innerscape',
      'KyaniteLabs/dev-learning-archaeologist',
      'Do not rename or repurpose',
      'Do not deploy the live app while doing this repo split',
      'Do not publish `reports/`',
    ],
  },
  {
    file: 'reference/secure-open-source-release.md',
    phrases: [
      'local-first open source',
      'no shared public Google OAuth client',
      'https://www.googleapis.com/auth/calendar.events.readonly',
      'https://www.googleapis.com/auth/gmail.metadata',
      'Blocked first-release scopes',
      'production secret/CORS guards',
      '140 backend integration tests',
    ],
  },
];

let failed = false;

for (const check of checks) {
  const text = readFileSync(check.file, 'utf8');
  for (const phrase of check.phrases) {
    if (!text.includes(phrase)) {
      console.error(`${check.file} missing phrase: ${phrase}`);
      failed = true;
    }
  }
}

if (failed) {
  process.exit(1);
}

console.log('Innerscape integration contract verified.');
