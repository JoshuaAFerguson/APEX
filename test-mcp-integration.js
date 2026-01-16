#!/usr/bin/env node
/**
 * Test runner for MCP integration tests
 * Validates that all MCP integration tests are functioning correctly
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const testFiles = [
  'packages/orchestrator/src/__tests__/mcp-connection-lifecycle.integration.test.ts',
  'packages/orchestrator/src/__tests__/mcp-event-forwarding.integration.test.ts',
  'packages/orchestrator/src/__tests__/apex-orchestrator.mcp-integration.test.ts',
];

console.log('🧪 Running MCP Integration Test Verification...\n');

async function runTest(testFile) {
  return new Promise((resolve, reject) => {
    console.log(`📋 Testing: ${testFile}`);

    const process = spawn('npx', ['vitest', 'run', testFile, '--reporter=verbose'], {
      cwd: __dirname,
      stdio: 'pipe'
    });

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${testFile} - PASSED\n`);
        resolve({ file: testFile, status: 'passed', output: stdout });
      } else {
        console.log(`❌ ${testFile} - FAILED\n`);
        console.log('STDERR:', stderr);
        resolve({ file: testFile, status: 'failed', output: stdout, error: stderr });
      }
    });

    process.on('error', (err) => {
      console.log(`🚨 ${testFile} - ERROR: ${err.message}\n`);
      resolve({ file: testFile, status: 'error', error: err.message });
    });
  });
}

// Run tests sequentially to avoid conflicts
async function runAllTests() {
  const results = [];

  for (const testFile of testFiles) {
    const result = await runTest(testFile);
    results.push(result);
  }

  // Summary
  console.log('\n📊 Test Results Summary:');
  console.log('========================');

  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status === 'failed').length;
  const errors = results.filter(r => r.status === 'error').length;

  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`🚨 Errors: ${errors}`);
  console.log(`📁 Total:  ${results.length}\n`);

  if (failed > 0 || errors > 0) {
    console.log('❌ Some tests failed. Check the output above for details.');
    process.exit(1);
  } else {
    console.log('🎉 All MCP integration tests are passing!');
    console.log('✨ MCP connection lifecycle testing is complete and verified.');
    process.exit(0);
  }
}

runAllTests().catch(console.error);