#!/usr/bin/env node

import { execSync } from 'child_process';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const cliDir = resolve(__dirname, 'packages/cli');

try {
  process.chdir(cliDir);
  console.log('Running session management integration tests...');

  const result = execSync('npx vitest run src/__tests__/v030-features.integration.test.tsx --reporter=basic', {
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  console.log('Test Output:');
  console.log(result);
} catch (error) {
  console.error('Test failed:');
  console.error(error.stdout);
  console.error(error.stderr);
  process.exit(1);
}