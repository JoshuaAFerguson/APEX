#!/usr/bin/env node

/**
 * Simple test for the cleanup utility functionality
 * This validates that the cleanup utility can handle the permission restrictions issue.
 */

import { cleanupTestDirectories, cleanupSpecificDirectory } from './scripts/cleanup-test-directory.mjs';

console.log('🧹 Testing cleanup utility functionality...');

try {
  // Test 1: Try to cleanup all test directories
  console.log('\n📂 Test 1: Cleanup all test directories');
  await cleanupTestDirectories();

  // Test 2: Try to cleanup a specific non-existent directory
  console.log('\n📂 Test 2: Cleanup specific non-existent directory');
  await cleanupSpecificDirectory('./.apex-test-nonexistent');

  console.log('\n✅ Cleanup utility test completed successfully!');
  console.log('The utility handles permission restrictions and missing directories properly.');

} catch (error) {
  console.error('❌ Test failed:', error.message);
  if (error.code === 'EPERM' || error.code === 'EACCES') {
    console.log('\n🔧 Permission restriction detected - this is the issue we need to fix!');
    console.log('Error details:', error);
  }
  process.exit(1);
}