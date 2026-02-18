#!/usr/bin/env node

/**
 * Quick test to verify error handling implementation
 */

const { createServer } = require('./dist/index.js');
const path = require('path');
const { tmpdir } = require('os');
const { mkdtempSync, writeFileSync, mkdirSync } = require('fs');

async function testErrorHandling() {
  console.log('🔍 Testing API error response security...');

  // Create a temporary directory for the project
  const tempDir = mkdtempSync(path.join(tmpdir(), 'apex-security-test-'));

  try {
    // Create .apex directory structure
    mkdirSync(path.join(tempDir, '.apex'), { recursive: true });

    // Create basic config file
    const configPath = path.join(tempDir, '.apex', 'config.yaml');
    writeFileSync(configPath, `
project:
  name: test-project
  version: "1.0.0"

autonomy:
  level: "supervised"
  autoApprove: false

limits:
  maxConcurrentTasks: 3
  maxCostPerTask: 10.0
  dailyCostLimit: 100.0
`);

    // Test production mode
    process.env.NODE_ENV = 'production';
    const app = await createServer({
      projectPath: tempDir,
      port: 0,
      silent: true,
    });

    // Test error endpoint
    const response = await app.inject({
      method: 'POST',
      url: '/tasks',
      payload: {}
    });

    const body = JSON.parse(response.body);

    console.log('✓ Response status:', response.statusCode);
    console.log('✓ Response body:', JSON.stringify(body, null, 2));

    // Basic security checks
    const hasStackTrace = body.stack || body.stackTrace || JSON.stringify(body).includes(' at ');

    if (hasStackTrace) {
      console.error('❌ SECURITY ISSUE: Response contains stack trace information');
      process.exit(1);
    } else {
      console.log('✅ SECURITY OK: No stack traces found in error response');
    }

    if (body.error && typeof body.error === 'string') {
      console.log('✅ STRUCTURE OK: Error field is present and is a string');
    } else {
      console.error('❌ STRUCTURE ISSUE: Error field is missing or malformed');
      process.exit(1);
    }

    await app.close();
    console.log('🎉 All security tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  testErrorHandling().catch(console.error);
}