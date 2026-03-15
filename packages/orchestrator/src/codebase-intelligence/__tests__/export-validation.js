#!/usr/bin/env node
/**
 * Export Validation Script
 *
 * This script performs basic validation that the CodebaseIndexer exports
 * are working correctly. It's designed to run without external test frameworks
 * to provide quick validation feedback.
 */

const path = require('path');

// Helper function to test an import
async function testImport(modulePath, exportName) {
  try {
    const module = await import(modulePath);
    if (module[exportName]) {
      console.log(`✓ ${exportName} successfully exported from ${modulePath}`);
      return true;
    } else {
      console.error(`✗ ${exportName} NOT found in exports from ${modulePath}`);
      return false;
    }
  } catch (error) {
    console.error(`✗ Failed to import from ${modulePath}: ${error.message}`);
    return false;
  }
}

// Helper function to test basic functionality
async function testFunctionality(modulePath) {
  try {
    const module = await import(modulePath);
    const { CodebaseIndexer, getCodebaseIndexer } = module;

    if (!CodebaseIndexer || !getCodebaseIndexer) {
      console.error(`✗ Required exports missing from ${modulePath}`);
      return false;
    }

    // Reset any existing instance
    if (typeof CodebaseIndexer.resetInstance === 'function') {
      CodebaseIndexer.resetInstance();
    }

    // Test getInstance
    const instance1 = CodebaseIndexer.getInstance();
    if (!instance1) {
      console.error(`✗ CodebaseIndexer.getInstance() returned null/undefined`);
      return false;
    }

    // Test convenience function
    const instance2 = getCodebaseIndexer();
    if (!instance2) {
      console.error(`✗ getCodebaseIndexer() returned null/undefined`);
      return false;
    }

    // Should be same instance
    if (instance1 !== instance2) {
      console.error(`✗ getInstance() and getCodebaseIndexer() return different instances`);
      return false;
    }

    // Test basic methods exist
    if (typeof instance1.indexDirectory !== 'function') {
      console.error(`✗ indexDirectory method not found`);
      return false;
    }

    if (typeof instance1.indexFile !== 'function') {
      console.error(`✗ indexFile method not found`);
      return false;
    }

    if (typeof instance1.getSupportedExtensions !== 'function') {
      console.error(`✗ getSupportedExtensions method not found`);
      return false;
    }

    // Test getSupportedExtensions
    const extensions = instance1.getSupportedExtensions();
    if (!Array.isArray(extensions) || extensions.length === 0) {
      console.error(`✗ getSupportedExtensions() returned invalid result`);
      return false;
    }

    // Clean up
    if (typeof CodebaseIndexer.resetInstance === 'function') {
      CodebaseIndexer.resetInstance();
    }

    console.log(`✓ Basic functionality test passed for ${modulePath}`);
    return true;

  } catch (error) {
    console.error(`✗ Functionality test failed for ${modulePath}: ${error.message}`);
    return false;
  }
}

async function validateExports() {
  console.log('🧪 Validating CodebaseIndexer Exports...\n');

  const results = [];

  // Test paths relative to this script
  const codebaseIndexPath = '../index.js';
  const mainIndexPath = '../../index.js';

  // Test 1: Codebase Intelligence Index Exports
  console.log('📦 Testing codebase-intelligence/index.js exports...');
  results.push(await testImport(codebaseIndexPath, 'CodebaseIndexer'));
  results.push(await testImport(codebaseIndexPath, 'getCodebaseIndexer'));
  results.push(await testFunctionality(codebaseIndexPath));

  console.log('\n📦 Testing main orchestrator/index.js exports...');
  results.push(await testImport(mainIndexPath, 'CodebaseIndexer'));
  results.push(await testImport(mainIndexPath, 'getCodebaseIndexer'));
  results.push(await testFunctionality(mainIndexPath));

  // Test consistency between exports
  console.log('\n🔄 Testing export consistency...');
  try {
    const codebaseModule = await import(codebaseIndexPath);
    const mainModule = await import(mainIndexPath);

    if (codebaseModule.CodebaseIndexer === mainModule.CodebaseIndexer) {
      console.log('✓ CodebaseIndexer class is consistently exported');
      results.push(true);
    } else {
      console.error('✗ CodebaseIndexer class differs between exports');
      results.push(false);
    }

    if (codebaseModule.getCodebaseIndexer === mainModule.getCodebaseIndexer) {
      console.log('✓ getCodebaseIndexer function is consistently exported');
      results.push(true);
    } else {
      console.error('✗ getCodebaseIndexer function differs between exports');
      results.push(false);
    }

  } catch (error) {
    console.error(`✗ Consistency test failed: ${error.message}`);
    results.push(false);
  }

  // Summary
  const passed = results.filter(Boolean).length;
  const total = results.length;

  console.log(`\n📊 Results: ${passed}/${total} tests passed`);

  if (passed === total) {
    console.log('🎉 All CodebaseIndexer export validations passed!');
    return true;
  } else {
    console.log('❌ Some validations failed');
    return false;
  }
}

// Run validation if called directly
if (require.main === module) {
  validateExports()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      console.error('💥 Validation failed with error:', error.message);
      process.exit(1);
    });
}

module.exports = { validateExports };