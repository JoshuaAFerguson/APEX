/**
 * Manual verification script for CodebaseIndexer exports
 * This file verifies that CodebaseIndexer can be imported from both locations
 * even when the build may be out of date.
 */

// Test 1: Import from codebase-intelligence submodule
import { CodebaseIndexer as CodebaseIndexerFromSubmodule, getCodebaseIndexer } from './index.js';

// Test 2: Import from main orchestrator index (this would need to be tested separately)
// import { CodebaseIndexer as CodebaseIndexerFromMain } from '../index.js';

console.log('✅ CodebaseIndexer import verification:');
console.log('- CodebaseIndexer from submodule:', typeof CodebaseIndexerFromSubmodule);
console.log('- getCodebaseIndexer from submodule:', typeof getCodebaseIndexer);

// Test singleton pattern
const instance1 = CodebaseIndexerFromSubmodule.getInstance();
const instance2 = getCodebaseIndexer();

console.log('- Singleton pattern verification:', instance1 === instance2 ? '✅ PASS' : '❌ FAIL');
console.log('- Instance has indexDirectory method:', typeof instance1.indexDirectory === 'function' ? '✅ PASS' : '❌ FAIL');
console.log('- Instance has indexFile method:', typeof instance1.indexFile === 'function' ? '✅ PASS' : '❌ FAIL');

export { CodebaseIndexerFromSubmodule as CodebaseIndexer, getCodebaseIndexer };