import { cpSync, mkdirSync } from 'node:fs';
const destination = new URL(process.argv.includes('--seed') ? '../dist-seed/src/modules/crop-knowledge/data/' : '../dist/modules/crop-knowledge/data/', import.meta.url);
mkdirSync(destination, { recursive: true });
cpSync(new URL('../src/modules/crop-knowledge/data/', import.meta.url), destination, { recursive: true });
