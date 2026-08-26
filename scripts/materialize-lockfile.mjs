import { readFileSync, writeFileSync } from 'node:fs';

const parts = ['lock/01.txt', 'lock/02.txt', 'lock/03.txt'];
writeFileSync(
  'pnpm-lock.yaml',
  parts.map((part) => readFileSync(part, 'utf8')).join(''),
);
