#!/usr/bin/env node
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

try {
  console.log('Running MCP Error Broadcasting Integration Test...');

  // Run the test directly with node and vitest
  execSync(`npx vitest run --config=packages/api/vitest.config.ts --run packages/api/src/__tests__/mcp-error-broadcasting.integration.test.ts`, {
    cwd: __dirname,
    stdio: 'inherit'
  });

  console.log('✓ Test completed successfully');
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}