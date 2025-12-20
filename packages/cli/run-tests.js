#!/usr/bin/env node

/**
 * Test runner script for agent handoff animation tests
 * Validates test structure and runs basic validation
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

const testFiles = [
  'src/ui/components/agents/__tests__/AgentPanel.test.tsx',
  'src/ui/components/agents/__tests__/AgentPanel.integration.test.tsx',
  'src/ui/components/agents/__tests__/HandoffIndicator.test.tsx',
  'src/ui/components/agents/__tests__/HandoffIndicator.edge-cases.test.tsx',
  'src/ui/hooks/__tests__/useAgentHandoff.test.ts',
  'src/ui/hooks/__tests__/useAgentHandoff.performance.test.ts',
  'src/ui/__tests__/agent-handoff-integration.test.tsx',
];

function validateTestFiles() {
  console.log('🔍 Validating test files...');
  let allExists = true;

  testFiles.forEach(file => {
    if (existsSync(file)) {
      console.log(`✅ ${file}`);
    } else {
      console.log(`❌ ${file} - File not found`);
      allExists = false;
    }
  });

  return allExists;
}

function runTests() {
  console.log('\n🧪 Running test suite...');

  const vitest = spawn('npx', ['vitest', 'run', '--reporter=verbose'], {
    stdio: 'inherit',
    shell: true
  });

  vitest.on('close', (code) => {
    if (code === 0) {
      console.log('\n✅ All tests passed!');
    } else {
      console.log(`\n❌ Tests failed with code ${code}`);
    }
    process.exit(code);
  });

  vitest.on('error', (err) => {
    console.error('❌ Failed to run tests:', err);
    process.exit(1);
  });
}

function runCoverage() {
  console.log('\n📊 Running coverage analysis...');

  const vitest = spawn('npx', ['vitest', 'run', '--coverage'], {
    stdio: 'inherit',
    shell: true
  });

  vitest.on('close', (code) => {
    if (code === 0) {
      console.log('\n✅ Coverage analysis complete!');
    } else {
      console.log(`\n❌ Coverage analysis failed with code ${code}`);
    }
    process.exit(code);
  });
}

function main() {
  const command = process.argv[2];

  console.log('🎯 Agent Handoff Animation Test Suite');
  console.log('=====================================\n');

  // Validate test files exist
  if (!validateTestFiles()) {
    console.log('\n❌ Some test files are missing. Please ensure all files are created.');
    process.exit(1);
  }

  switch (command) {
    case 'coverage':
      runCoverage();
      break;
    case 'validate':
      console.log('\n✅ All test files are present and accounted for!');
      break;
    default:
      runTests();
  }
}

main();