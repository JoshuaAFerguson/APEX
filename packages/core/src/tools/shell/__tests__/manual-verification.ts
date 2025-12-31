/**
 * @fileoverview Manual verification script for sandbox implementation
 * This script tests the core functionality without running formal tests
 */

import { BashTool } from '../bash-tool.js';
import { createStrictSandbox } from '../command-sandbox.js';
import { checkCommandBlocklist } from '../blocklist.js';
import { detectPathTraversal } from '../path-validator.js';

// Test 1: Basic blocklist functionality
console.log('=== Testing Blocklist ===');
const dangerousCommands = ['rm -rf /', 'sudo rm -rf /', 'shutdown -h now'];

dangerousCommands.forEach(cmd => {
  const result = checkCommandBlocklist(cmd);
  console.log(`Command: "${cmd}" - Blocked: ${!result.allowed}`);
  if (!result.allowed) {
    console.log(`  Reason: ${result.blockedReason}`);
  }
});

// Test 2: Path traversal detection
console.log('\n=== Testing Path Traversal ===');
const traversalCommands = ['cat ../../../etc/passwd', 'ls ../../', 'cat file.txt'];

traversalCommands.forEach(cmd => {
  const result = detectPathTraversal(cmd);
  console.log(`Command: "${cmd}" - Traversal detected: ${result.detected}`);
  if (result.detected) {
    console.log(`  Suspicious paths: ${result.suspiciousPaths.join(', ')}`);
  }
});

// Test 3: BashTool integration
console.log('\n=== Testing BashTool Integration ===');
const bashTool = new BashTool();
const testCommands = ['ls -la', 'rm -rf /', 'echo hello'];

testCommands.forEach(cmd => {
  const result = bashTool.validate({ command: cmd });
  console.log(`Command: "${cmd}" - Valid: ${result.valid}`);
  if (!result.valid && result.errors) {
    console.log(`  Errors: ${result.errors.join(', ')}`);
  }
  if (result.warnings) {
    console.log(`  Warnings: ${result.warnings.join(', ')}`);
  }
});

// Test 4: Sandbox modes
console.log('\n=== Testing Sandbox Modes ===');
const strictTool = new BashTool(createStrictSandbox('/tmp').getConfig());
const networkCommand = 'curl http://example.com';

console.log(`Network command with default tool: ${bashTool.validate({ command: networkCommand }).valid}`);
console.log(`Network command with strict tool: ${strictTool.validate({ command: networkCommand }).valid}`);

console.log('\nManual verification completed.');