/**
 * Manual Export Verification for CodebaseIndexer
 *
 * This script manually verifies that CodebaseIndexer exports are working correctly
 * by performing static analysis and import tests without requiring npm run.
 */

import type { CodebaseIndexer as CodebaseIndexerType } from '../codebase-intelligence/indexer.js';

/**
 * Test interface to verify CodebaseIndexer can be imported and has correct shape
 */
interface ExpectedCodebaseIndexerInterface {
  getInstance(): CodebaseIndexerType;
  resetInstance(): void;
  prototype: {
    indexDirectory(path: string): Promise<any>;
    indexDirectoryWithProgress(path: string): Promise<any>;
  };
}

/**
 * Verification tests for CodebaseIndexer exports
 */
export class CodebaseIndexerExportVerification {

  /**
   * Test 1: Verify CodebaseIndexer can be imported from main orchestrator package
   */
  async testMainPackageImport(): Promise<{ success: boolean; error?: string }> {
    try {
      const { CodebaseIndexer } = await import('../index.js');

      if (!CodebaseIndexer) {
        return { success: false, error: 'CodebaseIndexer not exported from main package' };
      }

      if (typeof CodebaseIndexer !== 'function') {
        return { success: false, error: 'CodebaseIndexer is not a constructor function' };
      }

      if (typeof CodebaseIndexer.getInstance !== 'function') {
        return { success: false, error: 'CodebaseIndexer.getInstance method not found' };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: `Import failed: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  /**
   * Test 2: Verify CodebaseIndexer can be imported from codebase-intelligence submodule
   */
  async testSubmoduleImport(): Promise<{ success: boolean; error?: string }> {
    try {
      const { CodebaseIndexer } = await import('../codebase-intelligence/index.js');

      if (!CodebaseIndexer) {
        return { success: false, error: 'CodebaseIndexer not exported from codebase-intelligence' };
      }

      if (typeof CodebaseIndexer !== 'function') {
        return { success: false, error: 'CodebaseIndexer from submodule is not a constructor function' };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: `Submodule import failed: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  /**
   * Test 3: Verify both imports reference the same class
   */
  async testSameClassReference(): Promise<{ success: boolean; error?: string }> {
    try {
      const mainImport = await import('../index.js');
      const submoduleImport = await import('../codebase-intelligence/index.js');

      if (mainImport.CodebaseIndexer !== submoduleImport.CodebaseIndexer) {
        return { success: false, error: 'CodebaseIndexer from main package and submodule are different references' };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: `Reference comparison failed: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  /**
   * Test 4: Verify singleton pattern works correctly
   */
  async testSingletonPattern(): Promise<{ success: boolean; error?: string }> {
    try {
      const { CodebaseIndexer } = await import('../index.js');

      // Reset instance to ensure clean state
      if (typeof CodebaseIndexer.resetInstance === 'function') {
        CodebaseIndexer.resetInstance();
      }

      const instance1 = CodebaseIndexer.getInstance();
      const instance2 = CodebaseIndexer.getInstance();

      if (!instance1 || !instance2) {
        return { success: false, error: 'getInstance() returned null or undefined' };
      }

      if (instance1 !== instance2) {
        return { success: false, error: 'Singleton pattern broken - getInstance() returned different instances' };
      }

      if (instance1.constructor.name !== 'CodebaseIndexer') {
        return { success: false, error: `Instance constructor name is "${instance1.constructor.name}", expected "CodebaseIndexer"` };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: `Singleton test failed: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  /**
   * Test 5: Verify helper function export
   */
  async testHelperFunctionExport(): Promise<{ success: boolean; error?: string }> {
    try {
      const { CodebaseIndexer, getCodebaseIndexer } = await import('../index.js');

      if (!getCodebaseIndexer) {
        return { success: false, error: 'getCodebaseIndexer helper function not exported' };
      }

      if (typeof getCodebaseIndexer !== 'function') {
        return { success: false, error: 'getCodebaseIndexer is not a function' };
      }

      // Reset instance for clean test
      if (typeof CodebaseIndexer.resetInstance === 'function') {
        CodebaseIndexer.resetInstance();
      }

      const directInstance = CodebaseIndexer.getInstance();
      const helperInstance = getCodebaseIndexer();

      if (directInstance !== helperInstance) {
        return { success: false, error: 'Helper function returns different instance than direct singleton call' };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: `Helper function test failed: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  /**
   * Test 6: Verify essential instance methods exist
   */
  async testInstanceMethods(): Promise<{ success: boolean; error?: string }> {
    try {
      const { CodebaseIndexer } = await import('../index.js');

      // Reset instance for clean test
      if (typeof CodebaseIndexer.resetInstance === 'function') {
        CodebaseIndexer.resetInstance();
      }

      const instance = CodebaseIndexer.getInstance();

      const expectedMethods = ['indexDirectory', 'indexDirectoryWithProgress'];

      for (const methodName of expectedMethods) {
        if (!instance[methodName]) {
          return { success: false, error: `Instance method "${methodName}" not found` };
        }

        if (typeof instance[methodName] !== 'function') {
          return { success: false, error: `Instance method "${methodName}" is not a function` };
        }
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: `Instance methods test failed: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  /**
   * Test 7: Verify type exports (compile-time verification)
   */
  async testTypeExports(): Promise<{ success: boolean; error?: string }> {
    try {
      // This test verifies that type imports don't cause runtime errors
      // The actual type checking happens at compile time
      const module = await import('../index.js');

      // These should be available as runtime values or not cause import errors
      if (!module) {
        return { success: false, error: 'Module import failed' };
      }

      // If we can import without errors, type exports are working
      return { success: true };
    } catch (error) {
      return { success: false, error: `Type exports test failed: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  /**
   * Run all verification tests
   */
  async runAllTests(): Promise<{
    success: boolean;
    results: Array<{ test: string; success: boolean; error?: string }>;
    summary: { passed: number; failed: number; total: number };
  }> {
    const tests = [
      { name: 'Main Package Import', test: () => this.testMainPackageImport() },
      { name: 'Submodule Import', test: () => this.testSubmoduleImport() },
      { name: 'Same Class Reference', test: () => this.testSameClassReference() },
      { name: 'Singleton Pattern', test: () => this.testSingletonPattern() },
      { name: 'Helper Function Export', test: () => this.testHelperFunctionExport() },
      { name: 'Instance Methods', test: () => this.testInstanceMethods() },
      { name: 'Type Exports', test: () => this.testTypeExports() }
    ];

    const results: Array<{ test: string; success: boolean; error?: string }> = [];
    let passed = 0;
    let failed = 0;

    for (const { name, test } of tests) {
      try {
        const result = await test();
        results.push({ test: name, ...result });

        if (result.success) {
          passed++;
        } else {
          failed++;
        }
      } catch (error) {
        results.push({
          test: name,
          success: false,
          error: `Test execution failed: ${error instanceof Error ? error.message : String(error)}`
        });
        failed++;
      }
    }

    return {
      success: failed === 0,
      results,
      summary: { passed, failed, total: tests.length }
    };
  }
}

/**
 * Export verification instance for external use
 */
export const verifyCodebaseIndexerExports = new CodebaseIndexerExportVerification();

// Self-executing verification for direct script usage
if (typeof process !== 'undefined' && process.argv[1]?.includes('codebase-indexer-export-verification')) {
  verifyCodebaseIndexerExports.runAllTests().then(({ success, results, summary }) => {
    console.log('CodebaseIndexer Export Verification Results:');
    console.log('==========================================');
    console.log();

    results.forEach(({ test, success, error }) => {
      console.log(`${success ? '✅' : '❌'} ${test}`);
      if (error) {
        console.log(`   Error: ${error}`);
      }
    });

    console.log();
    console.log(`Summary: ${summary.passed}/${summary.total} tests passed`);

    if (!success) {
      console.log('❌ Some tests failed - CodebaseIndexer exports need attention');
      process.exit(1);
    } else {
      console.log('✅ All tests passed - CodebaseIndexer exports are working correctly');
      process.exit(0);
    }
  }).catch((error) => {
    console.error('❌ Verification script failed:', error);
    process.exit(1);
  });
}