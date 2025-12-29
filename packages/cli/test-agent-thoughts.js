#!/usr/bin/env node

// Simple test runner for AgentThoughts component
const { spawn } = require('child_process');
const path = require('path');
const { resolveExecutable } = require('@apexcli/core');

console.log('Running AgentThoughts tests...');

const testFile = 'src/ui/components/__tests__/AgentThoughts.test.tsx';
const vitestCommand = path.join(__dirname, 'node_modules', '.bin', 'vitest');

const vitest = spawn(resolveExecutable('npx'), ['vitest', 'run', testFile], {
  stdio: 'inherit',
  cwd: __dirname
});

vitest.on('close', (code) => {
  console.log(`\nTest execution completed with exit code: ${code}`);
  process.exit(code);
});

vitest.on('error', (err) => {
  console.error('Error running tests:', err);
  process.exit(1);
});