import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IdleProcessor } from '../idle-processor';
import { TaskStore } from '../store';
import { DaemonConfig, TestingAntiPattern } from '@apexcli/core';
import { promises as fs } from 'fs';

// Mock dependencies
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
  },
}));

vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

describe('Test Anti-Patterns Integration - analyzeTestAnalysis() Integration', () => {
  let idleProcessor: IdleProcessor;
  let mockStore: TaskStore;
  let mockConfig: DaemonConfig;
  let mockProjectPath: string;
  let mockExecAsync: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockProjectPath = '/test/project';
    mockConfig = {
      pollInterval: 5000,
      autoStart: false,
      logLevel: 'info',
      installAsService: false,
      serviceName: 'apex-daemon',
      idleProcessing: {
        enabled: true,
        idleThreshold: 300000,
        taskGenerationInterval: 3600000,
        maxIdleTasks: 3,
      },
    };

    mockStore = {
      createTask: vi.fn(),
      getTasksByStatus: vi.fn().mockResolvedValue([]),
      getAllTasks: vi.fn().mockResolvedValue([]),
    } as any;

    idleProcessor = new IdleProcessor(mockProjectPath, mockConfig, mockStore);

    // Set up common mock exec that works for most tests
    mockExecAsync = vi.fn();
    const mockExec = vi.fn((cmd: string, options: any, callback: Function) => {
      mockExecAsync(cmd, options).then((result: any) => {
        callback(null, result);
      }).catch((error: any) => {
        callback(error);
      });
    });

    const childProcess = require('child_process');
    childProcess.exec = mockExec;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('analyzeTestAnalysis() Integration with Anti-Pattern Detection', () => {
    it('should call both detectTestingAntiPatterns() and analyzeTestAntiPatterns() and merge results', async () => {
      // Spy on the individual methods to verify they're called
      const detectTestingAntiPatternsSpy = vi.spyOn(idleProcessor as any, 'detectTestingAntiPatterns');
      const analyzeTestAntiPatternsSpy = vi.spyOn(idleProcessor, 'analyzeTestAntiPatterns');

      // Mock the responses for both methods
      const existingAntiPatterns: TestingAntiPattern[] = [
        {
          file: 'src/legacy.test.ts',
          line: 10,
          type: 'brittle-test',
          description: 'Test depends on external timing',
          severity: 'high',
          suggestion: 'Use mocked timers'
        }
      ];

      const additionalAntiPatterns: TestingAntiPattern[] = [
        {
          file: 'src/new.test.ts',
          line: 25,
          type: 'no-assertion',
          description: 'Test has no assertions',
          severity: 'high',
          suggestion: 'Add expect() statements'
        },
        {
          file: 'src/new.test.ts',
          line: 40,
          type: 'console-only',
          description: 'Test only contains console.log',
          severity: 'medium',
          suggestion: 'Replace with proper assertions'
        }
      ];

      detectTestingAntiPatternsSpy.mockResolvedValue(existingAntiPatterns);
      analyzeTestAntiPatternsSpy.mockResolvedValue(additionalAntiPatterns);

      // Mock basic exec commands for other parts of the analysis
      mockExecAsync.mockImplementation((command: string) => {
        if (command.includes('grep -r')) {
          return Promise.resolve({ stdout: 'src/test.ts:10:if (condition) {', stderr: '' });
        }
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      // Mock file reads
      vi.mocked(fs.readFile).mockResolvedValue('export function testFunction() {}');

      const testAnalysis = await (idleProcessor as any).analyzeTestAnalysis();

      // Verify both methods were called
      expect(detectTestingAntiPatternsSpy).toHaveBeenCalledTimes(1);
      expect(analyzeTestAntiPatternsSpy).toHaveBeenCalledTimes(1);

      // Verify that the results were merged in the antiPatterns array
      expect(testAnalysis.antiPatterns).toBeDefined();
      expect(Array.isArray(testAnalysis.antiPatterns)).toBe(true);
      expect(testAnalysis.antiPatterns).toHaveLength(3);

      // Verify both sets of anti-patterns are included
      const antiPatternTypes = testAnalysis.antiPatterns.map((ap: TestingAntiPattern) => ap.type);
      expect(antiPatternTypes).toContain('brittle-test');  // from detectTestingAntiPatterns
      expect(antiPatternTypes).toContain('no-assertion');  // from analyzeTestAntiPatterns
      expect(antiPatternTypes).toContain('console-only');  // from analyzeTestAntiPatterns

      // Verify the exact merged content
      const brittleTest = testAnalysis.antiPatterns.find((ap: TestingAntiPattern) => ap.type === 'brittle-test');
      const noAssertion = testAnalysis.antiPatterns.find((ap: TestingAntiPattern) => ap.type === 'no-assertion');
      const consoleOnly = testAnalysis.antiPatterns.find((ap: TestingAntiPattern) => ap.type === 'console-only');

      expect(brittleTest).toEqual(existingAntiPatterns[0]);
      expect(noAssertion).toEqual(additionalAntiPatterns[0]);
      expect(consoleOnly).toEqual(additionalAntiPatterns[1]);

      detectTestingAntiPatternsSpy.mockRestore();
      analyzeTestAntiPatternsSpy.mockRestore();
    });

    it('should handle empty results from both anti-pattern detection methods', async () => {
      // Spy on the methods
      const detectTestingAntiPatternsSpy = vi.spyOn(idleProcessor as any, 'detectTestingAntiPatterns');
      const analyzeTestAntiPatternsSpy = vi.spyOn(idleProcessor, 'analyzeTestAntiPatterns');

      // Mock empty results
      detectTestingAntiPatternsSpy.mockResolvedValue([]);
      analyzeTestAntiPatternsSpy.mockResolvedValue([]);

      // Mock basic exec commands
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });
      vi.mocked(fs.readFile).mockResolvedValue('export function clean() {}');

      const testAnalysis = await (idleProcessor as any).analyzeTestAnalysis();

      // Both methods should be called
      expect(detectTestingAntiPatternsSpy).toHaveBeenCalledTimes(1);
      expect(analyzeTestAntiPatternsSpy).toHaveBeenCalledTimes(1);

      // Anti-patterns array should exist but be empty
      expect(testAnalysis.antiPatterns).toBeDefined();
      expect(Array.isArray(testAnalysis.antiPatterns)).toBe(true);
      expect(testAnalysis.antiPatterns).toHaveLength(0);

      detectTestingAntiPatternsSpy.mockRestore();
      analyzeTestAntiPatternsSpy.mockRestore();
    });

    it('should handle errors from detectTestingAntiPatterns gracefully', async () => {
      // Spy on the methods
      const detectTestingAntiPatternsSpy = vi.spyOn(idleProcessor as any, 'detectTestingAntiPatterns');
      const analyzeTestAntiPatternsSpy = vi.spyOn(idleProcessor, 'analyzeTestAntiPatterns');

      // Mock detectTestingAntiPatterns to throw an error
      detectTestingAntiPatternsSpy.mockRejectedValue(new Error('detectTestingAntiPatterns failed'));

      // Mock analyzeTestAntiPatterns to succeed
      const successfulPatterns: TestingAntiPattern[] = [
        {
          file: 'src/good.test.ts',
          line: 15,
          type: 'empty-test',
          description: 'Test is empty',
          severity: 'medium',
          suggestion: 'Implement the test'
        }
      ];
      analyzeTestAntiPatternsSpy.mockResolvedValue(successfulPatterns);

      // Mock other commands
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });
      vi.mocked(fs.readFile).mockResolvedValue('export function test() {}');

      const testAnalysis = await (idleProcessor as any).analyzeTestAnalysis();

      // analyzeTestAntiPatterns should still be called
      expect(analyzeTestAntiPatternsSpy).toHaveBeenCalledTimes(1);

      // Should contain only results from the successful method
      expect(testAnalysis.antiPatterns).toBeDefined();
      expect(Array.isArray(testAnalysis.antiPatterns)).toBe(true);
      expect(testAnalysis.antiPatterns).toHaveLength(1);
      expect(testAnalysis.antiPatterns[0]).toEqual(successfulPatterns[0]);

      detectTestingAntiPatternsSpy.mockRestore();
      analyzeTestAntiPatternsSpy.mockRestore();
    });

    it('should handle errors from analyzeTestAntiPatterns gracefully', async () => {
      // Spy on the methods
      const detectTestingAntiPatternsSpy = vi.spyOn(idleProcessor as any, 'detectTestingAntiPatterns');
      const analyzeTestAntiPatternsSpy = vi.spyOn(idleProcessor, 'analyzeTestAntiPatterns');

      // Mock detectTestingAntiPatterns to succeed
      const existingPatterns: TestingAntiPattern[] = [
        {
          file: 'src/legacy.test.ts',
          line: 5,
          type: 'slow-test',
          description: 'Test is very slow',
          severity: 'medium',
          suggestion: 'Optimize test performance'
        }
      ];
      detectTestingAntiPatternsSpy.mockResolvedValue(existingPatterns);

      // Mock analyzeTestAntiPatterns to throw an error
      analyzeTestAntiPatternsSpy.mockRejectedValue(new Error('analyzeTestAntiPatterns failed'));

      // Mock other commands
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });
      vi.mocked(fs.readFile).mockResolvedValue('export function test() {}');

      const testAnalysis = await (idleProcessor as any).analyzeTestAnalysis();

      // detectTestingAntiPatterns should still have been called
      expect(detectTestingAntiPatternsSpy).toHaveBeenCalledTimes(1);

      // Should contain only results from the successful method
      expect(testAnalysis.antiPatterns).toBeDefined();
      expect(Array.isArray(testAnalysis.antiPatterns)).toBe(true);
      expect(testAnalysis.antiPatterns).toHaveLength(1);
      expect(testAnalysis.antiPatterns[0]).toEqual(existingPatterns[0]);

      detectTestingAntiPatternsSpy.mockRestore();
      analyzeTestAntiPatternsSpy.mockRestore();
    });

    it('should preserve order of anti-patterns (existing first, then additional)', async () => {
      // Spy on the methods
      const detectTestingAntiPatternsSpy = vi.spyOn(idleProcessor as any, 'detectTestingAntiPatterns');
      const analyzeTestAntiPatternsSpy = vi.spyOn(idleProcessor, 'analyzeTestAntiPatterns');

      // Create ordered patterns with different types
      const existingPatterns: TestingAntiPattern[] = [
        {
          file: 'src/old.test.ts',
          line: 10,
          type: 'brittle-test',
          description: 'First pattern',
          severity: 'high',
          suggestion: 'Fix this first'
        },
        {
          file: 'src/old.test.ts',
          line: 20,
          type: 'test-pollution',
          description: 'Second pattern',
          severity: 'medium',
          suggestion: 'Fix this second'
        }
      ];

      const additionalPatterns: TestingAntiPattern[] = [
        {
          file: 'src/new.test.ts',
          line: 5,
          type: 'no-assertion',
          description: 'Third pattern',
          severity: 'high',
          suggestion: 'Fix this third'
        },
        {
          file: 'src/new.test.ts',
          line: 15,
          type: 'hardcoded-timeout',
          description: 'Fourth pattern',
          severity: 'medium',
          suggestion: 'Fix this fourth'
        }
      ];

      detectTestingAntiPatternsSpy.mockResolvedValue(existingPatterns);
      analyzeTestAntiPatternsSpy.mockResolvedValue(additionalPatterns);

      // Mock other commands
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });
      vi.mocked(fs.readFile).mockResolvedValue('export function test() {}');

      const testAnalysis = await (idleProcessor as any).analyzeTestAnalysis();

      expect(testAnalysis.antiPatterns).toHaveLength(4);

      // Verify the order: existing patterns first, then additional patterns
      expect(testAnalysis.antiPatterns[0]).toEqual(existingPatterns[0]);
      expect(testAnalysis.antiPatterns[1]).toEqual(existingPatterns[1]);
      expect(testAnalysis.antiPatterns[2]).toEqual(additionalPatterns[0]);
      expect(testAnalysis.antiPatterns[3]).toEqual(additionalPatterns[1]);

      // Verify descriptions to confirm order
      const descriptions = testAnalysis.antiPatterns.map((ap: TestingAntiPattern) => ap.description);
      expect(descriptions[0]).toBe('First pattern');
      expect(descriptions[1]).toBe('Second pattern');
      expect(descriptions[2]).toBe('Third pattern');
      expect(descriptions[3]).toBe('Fourth pattern');

      detectTestingAntiPatternsSpy.mockRestore();
      analyzeTestAntiPatternsSpy.mockRestore();
    });

    it('should maintain existing functionality while adding new anti-pattern detection', async () => {
      // This test verifies that the integration doesn't break existing functionality

      // Mock real-world data for existing detectTestingAntiPatterns
      const existingPatterns: TestingAntiPattern[] = [
        {
          file: 'src/user.test.ts',
          line: 45,
          type: 'mystery-guest',
          description: 'Test has hidden dependency',
          severity: 'medium',
          suggestion: 'Make dependencies explicit'
        }
      ];

      // Mock new analyzeTestAntiPatterns results
      const newPatterns: TestingAntiPattern[] = [
        {
          file: 'src/auth.test.ts',
          line: 12,
          type: 'empty-test',
          description: 'Test block is empty',
          severity: 'medium',
          suggestion: 'Implement the test'
        }
      ];

      const detectTestingAntiPatternsSpy = vi.spyOn(idleProcessor as any, 'detectTestingAntiPatterns');
      const analyzeTestAntiPatternsSpy = vi.spyOn(idleProcessor, 'analyzeTestAntiPatterns');

      detectTestingAntiPatternsSpy.mockResolvedValue(existingPatterns);
      analyzeTestAntiPatternsSpy.mockResolvedValue(newPatterns);

      // Mock the other parts of test analysis
      mockExecAsync.mockImplementation((command: string) => {
        if (command.includes('grep -r')) {
          return Promise.resolve({ stdout: 'src/utils.ts:15:if (condition) {\nsrc/auth.ts:22:} else {', stderr: '' });
        }
        if (command.includes('find . -name "*.ts"') && command.includes('grep -v test')) {
          return Promise.resolve({ stdout: 'src/utils.ts\nsrc/auth.ts', stderr: '' });
        }
        return Promise.resolve({ stdout: 'src/utils.test.ts\nsrc/auth.test.ts', stderr: '' });
      });

      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        if (path.includes('utils.ts')) {
          return Promise.resolve('export function formatDate(date: Date) { return date.toString(); }');
        }
        return Promise.resolve('export function authenticate(token: string) { return true; }');
      });

      const testAnalysis = await (idleProcessor as any).analyzeTestAnalysis();

      // Verify all components of test analysis are present
      expect(testAnalysis).toBeDefined();
      expect(testAnalysis.branchCoverage).toBeDefined();
      expect(testAnalysis.untestedExports).toBeDefined();
      expect(testAnalysis.missingIntegrationTests).toBeDefined();
      expect(testAnalysis.antiPatterns).toBeDefined();

      // Verify anti-patterns were merged correctly
      expect(testAnalysis.antiPatterns).toHaveLength(2);

      const types = testAnalysis.antiPatterns.map((ap: TestingAntiPattern) => ap.type);
      expect(types).toContain('mystery-guest');  // from existing
      expect(types).toContain('empty-test');      // from new

      // Verify both detection methods were called
      expect(detectTestingAntiPatternsSpy).toHaveBeenCalledTimes(1);
      expect(analyzeTestAntiPatternsSpy).toHaveBeenCalledTimes(1);

      detectTestingAntiPatternsSpy.mockRestore();
      analyzeTestAntiPatternsSpy.mockRestore();
    });

    it('should handle large numbers of anti-patterns from both methods', async () => {
      const detectTestingAntiPatternsSpy = vi.spyOn(idleProcessor as any, 'detectTestingAntiPatterns');
      const analyzeTestAntiPatternsSpy = vi.spyOn(idleProcessor, 'analyzeTestAntiPatterns');

      // Create many anti-patterns from both methods
      const existingPatterns: TestingAntiPattern[] = Array.from({ length: 20 }, (_, i) => ({
        file: `src/existing${i}.test.ts`,
        line: i + 1,
        type: 'brittle-test' as const,
        description: `Existing pattern ${i}`,
        severity: 'medium' as const,
        suggestion: `Fix existing pattern ${i}`
      }));

      const additionalPatterns: TestingAntiPattern[] = Array.from({ length: 30 }, (_, i) => ({
        file: `src/new${i}.test.ts`,
        line: i + 1,
        type: 'no-assertion' as const,
        description: `New pattern ${i}`,
        severity: 'high' as const,
        suggestion: `Fix new pattern ${i}`
      }));

      detectTestingAntiPatternsSpy.mockResolvedValue(existingPatterns);
      analyzeTestAntiPatternsSpy.mockResolvedValue(additionalPatterns);

      // Mock other commands
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });
      vi.mocked(fs.readFile).mockResolvedValue('export function test() {}');

      const testAnalysis = await (idleProcessor as any).analyzeTestAnalysis();

      // Should merge all patterns
      expect(testAnalysis.antiPatterns).toHaveLength(50);

      // Verify order is preserved (existing first, then additional)
      expect(testAnalysis.antiPatterns[0].description).toBe('Existing pattern 0');
      expect(testAnalysis.antiPatterns[19].description).toBe('Existing pattern 19');
      expect(testAnalysis.antiPatterns[20].description).toBe('New pattern 0');
      expect(testAnalysis.antiPatterns[49].description).toBe('New pattern 29');

      detectTestingAntiPatternsSpy.mockRestore();
      analyzeTestAntiPatternsSpy.mockRestore();
    });
  });

  describe('Edge Cases and Error Handling in Integration', () => {
    it('should handle null/undefined results from anti-pattern methods', async () => {
      const detectTestingAntiPatternsSpy = vi.spyOn(idleProcessor as any, 'detectTestingAntiPatterns');
      const analyzeTestAntiPatternsSpy = vi.spyOn(idleProcessor, 'analyzeTestAntiPatterns');

      // Mock one method returning undefined (simulating error state)
      detectTestingAntiPatternsSpy.mockResolvedValue(undefined as any);
      analyzeTestAntiPatternsSpy.mockResolvedValue([{
        file: 'src/test.test.ts',
        line: 1,
        type: 'no-assertion',
        description: 'Valid pattern',
        severity: 'high',
        suggestion: 'Add assertions'
      }]);

      // Mock other commands
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });
      vi.mocked(fs.readFile).mockResolvedValue('export function test() {}');

      const testAnalysis = await (idleProcessor as any).analyzeTestAnalysis();

      // Should handle undefined gracefully
      expect(testAnalysis.antiPatterns).toBeDefined();
      expect(Array.isArray(testAnalysis.antiPatterns)).toBe(true);
      expect(testAnalysis.antiPatterns).toHaveLength(1);
      expect(testAnalysis.antiPatterns[0].description).toBe('Valid pattern');

      detectTestingAntiPatternsSpy.mockRestore();
      analyzeTestAntiPatternsSpy.mockRestore();
    });

    it('should handle both methods throwing errors', async () => {
      const detectTestingAntiPatternsSpy = vi.spyOn(idleProcessor as any, 'detectTestingAntiPatterns');
      const analyzeTestAntiPatternsSpy = vi.spyOn(idleProcessor, 'analyzeTestAntiPatterns');

      // Both methods throw errors
      detectTestingAntiPatternsSpy.mockRejectedValue(new Error('detectTestingAntiPatterns error'));
      analyzeTestAntiPatternsSpy.mockRejectedValue(new Error('analyzeTestAntiPatterns error'));

      // Mock other commands
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });
      vi.mocked(fs.readFile).mockResolvedValue('export function test() {}');

      const testAnalysis = await (idleProcessor as any).analyzeTestAnalysis();

      // Should return empty anti-patterns array when both methods fail
      expect(testAnalysis.antiPatterns).toBeDefined();
      expect(Array.isArray(testAnalysis.antiPatterns)).toBe(true);
      expect(testAnalysis.antiPatterns).toHaveLength(0);

      detectTestingAntiPatternsSpy.mockRestore();
      analyzeTestAntiPatternsSpy.mockRestore();
    });
  });
});