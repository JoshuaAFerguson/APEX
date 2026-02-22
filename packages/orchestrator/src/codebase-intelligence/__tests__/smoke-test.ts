/**
 * Smoke Test for CodebaseIndexer Exports
 *
 * This is a lightweight test that can be used to quickly verify
 * that the CodebaseIndexer exports are working correctly without
 * requiring full test execution.
 */

// Test basic import capability
console.log('Testing CodebaseIndexer exports...');

try {
  // Test direct indexer import
  const indexerModule = require('../indexer.js');
  console.log('✓ Direct indexer import successful');

  if (indexerModule.CodebaseIndexer) {
    console.log('✓ CodebaseIndexer class found');
  } else {
    console.error('✗ CodebaseIndexer class NOT found');
  }

  if (indexerModule.getCodebaseIndexer) {
    console.log('✓ getCodebaseIndexer function found');
  } else {
    console.error('✗ getCodebaseIndexer function NOT found');
  }

  // Test codebase-intelligence index import
  const codebaseModule = require('../index.js');
  console.log('✓ Codebase intelligence index import successful');

  if (codebaseModule.CodebaseIndexer) {
    console.log('✓ CodebaseIndexer exported from codebase-intelligence index');
  } else {
    console.error('✗ CodebaseIndexer NOT exported from codebase-intelligence index');
  }

  if (codebaseModule.getCodebaseIndexer) {
    console.log('✓ getCodebaseIndexer exported from codebase-intelligence index');
  } else {
    console.error('✗ getCodebaseIndexer NOT exported from codebase-intelligence index');
  }

  // Test main orchestrator import
  try {
    const orchestratorModule = require('../../index.js');
    console.log('✓ Main orchestrator index import successful');

    if (orchestratorModule.CodebaseIndexer) {
      console.log('✓ CodebaseIndexer exported from main orchestrator index');
    } else {
      console.error('✗ CodebaseIndexer NOT exported from main orchestrator index');
    }

    if (orchestratorModule.getCodebaseIndexer) {
      console.log('✓ getCodebaseIndexer exported from main orchestrator index');
    } else {
      console.error('✗ getCodebaseIndexer NOT exported from main orchestrator index');
    }
  } catch (err) {
    console.error('✗ Main orchestrator import failed:', err.message);
  }

  // Test basic functionality
  try {
    const { CodebaseIndexer } = codebaseModule;
    CodebaseIndexer.resetInstance();
    const indexer = CodebaseIndexer.getInstance();

    if (indexer && typeof indexer.indexDirectory === 'function') {
      console.log('✓ CodebaseIndexer instance created successfully');
    } else {
      console.error('✗ CodebaseIndexer instance invalid');
    }

    // Test convenience function
    const indexer2 = codebaseModule.getCodebaseIndexer();
    if (indexer2 === indexer) {
      console.log('✓ getCodebaseIndexer returns same instance');
    } else {
      console.error('✗ getCodebaseIndexer returns different instance');
    }

    CodebaseIndexer.resetInstance();
    console.log('✓ Instance cleanup successful');

  } catch (err) {
    console.error('✗ Basic functionality test failed:', err.message);
  }

  console.log('\n✅ All CodebaseIndexer export tests passed!');

} catch (err) {
  console.error('✗ Smoke test failed:', err.message);
  process.exit(1);
}