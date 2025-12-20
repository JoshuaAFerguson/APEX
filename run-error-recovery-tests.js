#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const cliDir = join(__dirname, 'packages', 'cli');
const testFile = 'src/services/__tests__/SessionAutoSaver.error-recovery.integration.test.ts';

console.log('Running error recovery integration tests...');
console.log(`Working directory: ${cliDir}`);
console.log(`Test file: ${testFile}`);

const child = spawn('npx', ['vitest', 'run', testFile], {
  cwd: cliDir,
  stdio: 'inherit',
  shell: true
});

child.on('close', (code) => {
  console.log(`Tests completed with exit code: ${code}`);
  process.exit(code);
});

child.on('error', (error) => {
  console.error('Error running tests:', error);
  process.exit(1);
});