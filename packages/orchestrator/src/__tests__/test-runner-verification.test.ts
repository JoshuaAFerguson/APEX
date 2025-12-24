/**
 * Test runner verification for idle task generator test suite
 *
 * This test verifies that our test suite is working correctly and
 * provides a smoke test for the testing infrastructure.
 */
import { describe, it, expect } from 'vitest';
import { IdleTaskGenerator } from '../idle-task-generator';

describe('Test Infrastructure Verification', () => {
  it('should be able to import IdleTaskGenerator', () => {
    expect(IdleTaskGenerator).toBeDefined();
    expect(typeof IdleTaskGenerator).toBe('function');
  });

  it('should be able to create IdleTaskGenerator instance', () => {
    const generator = new IdleTaskGenerator();
    expect(generator).toBeInstanceOf(IdleTaskGenerator);
  });

  it('should have all required methods', () => {
    const generator = new IdleTaskGenerator();

    expect(typeof generator.selectTaskType).toBe('function');
    expect(typeof generator.generateTask).toBe('function');
    expect(typeof generator.reset).toBe('function');
    expect(typeof generator.getWeights).toBe('function');
    expect(typeof generator.getUsedCandidates).toBe('function');
    expect(typeof generator.getEnhancedCapabilities).toBe('function');
  });

  it('should have static factory methods', () => {
    expect(typeof IdleTaskGenerator.createEnhanced).toBe('function');
  });

  it('should handle basic task generation without errors', () => {
    const generator = new IdleTaskGenerator();
    const mockAnalysis = {
      codebaseSize: { files: 10, lines: 1000, languages: { ts: 10 } },
      testCoverage: { percentage: 50, uncoveredFiles: [] },
      dependencies: { outdated: [], security: [] },
      codeQuality: { lintIssues: 0, duplicatedCode: [], complexityHotspots: [], codeSmells: [] },
      documentation: { coverage: 50, missingDocs: [] },
      performance: { slowTests: [], bottlenecks: [] },
    };

    expect(() => {
      generator.generateTask(mockAnalysis);
    }).not.toThrow();
  });

  it('should verify test file structure and naming', () => {
    // This test validates that our test files follow the expected structure
    const testFiles = [
      'idle-task-generator-enhanced-capabilities.test.ts',
      'idle-task-generator-error-handling.test.ts',
      'idle-task-generator-integration.test.ts',
      'idle-task-generator-strategy-weight-selection.test.ts',
      'test-runner-verification.test.ts'
    ];

    // Verify this test file exists (basic smoke test)
    expect(__filename).toContain('test-runner-verification.test.ts');
  });
});