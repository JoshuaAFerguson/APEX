#!/usr/bin/env node
import { execSync } from 'child_process';

console.log('🧪 Testing file path completion integration...');

try {
  const result = execSync('npx vitest run packages/cli/src/services/__tests__/CompletionEngine.file-path.integration.test.ts', {
    encoding: 'utf8',
    stdio: 'pipe'
  });

  console.log('✅ File path completion tests passed!');
  console.log(result);
} catch (error) {
  console.error('❌ Tests failed:', error.stdout || error.stderr || error.message);
  process.exit(1);
}