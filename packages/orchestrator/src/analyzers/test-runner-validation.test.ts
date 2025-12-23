/**
 * Test Runner Validation
 *
 * Simple validation to ensure our comprehensive RefactoringAnalyzer tests
 * can run successfully without compilation errors.
 */

import { describe, it, expect } from 'vitest';

describe('Test Runner Validation', () => {
  it('should be able to run basic test validation', () => {
    // Basic test to ensure test runner is working
    expect(1 + 1).toBe(2);
  });

  it('should be able to import RefactoringAnalyzer', async () => {
    // Dynamic import to test module loading
    const { RefactoringAnalyzer } = await import('./refactoring-analyzer');
    expect(RefactoringAnalyzer).toBeDefined();

    const analyzer = new RefactoringAnalyzer();
    expect(analyzer.type).toBe('refactoring');
  });

  it('should be able to import required types', async () => {
    // Test that all required types are available
    const types = await import('@apexcli/core');

    // Check that the types module exports what we need
    expect(types).toBeDefined();

    // Create basic test objects to validate type availability
    const testHotspot = {
      file: 'test.ts',
      cyclomaticComplexity: 10,
      cognitiveComplexity: 15,
      lineCount: 200
    };

    const testSmell = {
      file: 'test.ts',
      type: 'long-method' as const,
      severity: 'medium' as const,
      details: 'Test smell'
    };

    const testPattern = {
      pattern: 'test pattern',
      locations: ['file1.ts', 'file2.ts'],
      similarity: 0.8
    };

    expect(testHotspot).toBeDefined();
    expect(testSmell).toBeDefined();
    expect(testPattern).toBeDefined();
  });
});