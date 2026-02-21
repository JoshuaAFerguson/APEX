#!/usr/bin/env node
/**
 * Test script to check file access permissions
 */

const fs = require('fs');
const path = require('path');

// Test accessing one of the problematic test files
const testFile = 'packages/core/src/__tests__/project-context-analyzer-analyze-project-structure.test.ts';

console.log('Testing file access permissions...');
console.log(`File: ${testFile}`);

try {
  // Check if file exists and is accessible
  fs.accessSync(testFile, fs.constants.R_OK);
  console.log('✅ File is readable');

  // Try to read the file
  const content = fs.readFileSync(testFile, 'utf8');
  console.log(`✅ Successfully read file (${content.length} characters)`);

  // Check file stats
  const stats = fs.statSync(testFile);
  const mode = (stats.mode & parseInt('777', 8)).toString(8);
  console.log(`📊 File permissions: ${mode}`);
  console.log(`📊 File size: ${stats.size} bytes`);
  console.log(`📊 Last modified: ${stats.mtime}`);

} catch (error) {
  console.error('❌ Error accessing file:', error.message);
  console.error('Error code:', error.code);

  if (error.code === 'EACCES') {
    console.error('🚫 Permission denied - file permissions too restrictive');
  } else if (error.code === 'ENOENT') {
    console.error('🚫 File not found');
  }
}

// Test directory permissions
const testDir = 'packages/core/src/__tests__/';
console.log(`\nTesting directory: ${testDir}`);

try {
  fs.accessSync(testDir, fs.constants.R_OK | fs.constants.X_OK);
  console.log('✅ Directory is accessible');

  const files = fs.readdirSync(testDir);
  console.log(`✅ Directory contains ${files.length} files`);
} catch (error) {
  console.error('❌ Error accessing directory:', error.message);
}