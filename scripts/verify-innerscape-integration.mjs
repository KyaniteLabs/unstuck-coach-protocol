import { readFileSync } from 'node:fs';

const checks = [
  {
    file: 'reference/innerscape-integration.md',
    phrases: [
      'Innerscape is the system of record',
      'Unstuck is the coaching layer',
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
      'Innerscape is the system of record',
      'Calendar and inbox are reality inputs',
      'External writes require explicit approval',
    ],
  },
  {
    file: 'reference/landing-live-app-implications.md',
    phrases: [
      'Unstuck should not disappear into Innerscape',
      'The live Unstuck app should stay up during the merge',
      'Do not claim calendar or inbox integration is live',
      'Default to both',
    ],
  },
  {
    file: 'docs/integration-dashboard.html',
    phrases: [
      'Unstuck + Innerscape Integration Dashboard',
      'Keep both public surfaces',
      'Landing pages',
      'Literal app that is up',
      'Decision queue',
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
