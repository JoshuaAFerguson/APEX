#!/usr/bin/env node

// Simple test runner to check the mcp-installer-rollback test
const { exec } = require('child_process');
const path = require('path');

console.log('Running MCPInstaller rollback test...');

const testFile = path.join(__dirname, 'src/__tests__/mcp-installer-rollback.test.ts');
const command = `npx vitest run "${testFile}" --reporter=verbose`;

console.log('Command:', command);
console.log('Current directory:', process.cwd());

exec(command, (error, stdout, stderr) => {
  console.log('STDOUT:');
  console.log(stdout);

  if (stderr) {
    console.log('STDERR:');
    console.log(stderr);
  }

  if (error) {
    console.log('ERROR:');
    console.log(error.message);
    process.exit(1);
  }

  console.log('Test completed successfully!');
});