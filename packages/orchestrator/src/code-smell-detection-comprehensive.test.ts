/**
 * Comprehensive Code Smell Detection and Refactoring Suggestions Tests
 *
 * This test file provides comprehensive coverage for:
 * 1. IdleProcessor detecting all three smell types correctly
 * 2. RefactoringAnalyzer generating candidates for each smell type
 * 3. Priority/effort mapping based on severity levels
 * 4. Edge cases (empty smells, mixed severities, multiple smells in same file)
 *
 * Ensures all tests pass and fulfill the acceptance criteria.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IdleProcessor, ProjectAnalysis } from './idle-processor';
import { RefactoringAnalyzer } from './analyzers/refactoring-analyzer';
import { TaskStore } from './store';
import { DaemonConfig } from '@apexcli/core';
import type { CodeSmell, ComplexityHotspot, DuplicatePattern } from '@apexcli/core';
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

describe('Comprehensive Code Smell Detection and Refactoring Tests', () => {
  let idleProcessor: IdleProcessor;
  let refactoringAnalyzer: RefactoringAnalyzer;
  let mockStore: TaskStore;
  let mockConfig: DaemonConfig;
  let mockProjectPath: string;
  let baseProjectAnalysis: ProjectAnalysis;

  beforeEach(() => {
    vi.clearAllMocks();

    mockProjectPath = '/test/project';
    mockConfig = {
      idleProcessing: {
        enabled: true,
        idleThreshold: 300000,
        taskGenerationInterval: 3600000,
        maxIdleTasks: 3,
      },
    };

    mockStore = {
      createTask: vi.fn(),
      getTasksByStatus: vi.fn(),
      getAllTasks: vi.fn(),
    } as any;

    idleProcessor = new IdleProcessor(mockProjectPath, mockConfig, mockStore);
    refactoringAnalyzer = new RefactoringAnalyzer();

    baseProjectAnalysis = {
      codebaseSize: {
        files: 50,
        lines: 5000,
        languages: { 'ts': 40, 'js': 10 }
      },
      dependencies: {
        outdated: [],
        security: []
      },
      codeQuality: {
        lintIssues: 0,
        duplicatedCode: [],
        complexityHotspots: [],
        codeSmells: []
      },
      documentation: {
        coverage: 50,
        missingDocs: [],
        undocumentedExports: [],
        outdatedDocs: [],
        missingReadmeSections: [],
        apiCompleteness: {
          percentage: 70,
          details: {
            totalEndpoints: 20,
            documentedEndpoints: 14,
            undocumentedItems: [],
            wellDocumentedExamples: [],
            commonIssues: []
          }
        }
      },
      performance: {
        slowTests: [],
        bottlenecks: []
      }
    };

    // Mock file system and command execution for IdleProcessor
    setupMocksForIdleProcessor();
  });

  function setupMocksForIdleProcessor() {
    // Mock exec commands for IdleProcessor analysis
    const mockExec = vi.fn().mockImplementation((command: string, options: any) => {
      const callback = arguments[2] || arguments[1];

      if (command.includes('find . -name "*.ts"') && command.includes('xargs wc -l')) {
        // Mock large files that would trigger complexity hotspots
        callback(null, {
          stdout: '650 ./src/large-service.ts\n800 ./src/complex-manager.ts\n400 ./src/normal-file.ts\n1850 total'
        });
      } else if (command.includes('find . -name "*.ts"') && !command.includes('xargs')) {
        callback(null, {
          stdout: './src/service.ts\n./src/manager.ts\n./src/parser.ts\n./src/auth.ts\n./src/legacy.ts\n'
        });
      } else if (command.includes('eslint')) {
        callback(null, {
          stdout: JSON.stringify([
            { errorCount: 3, warningCount: 5 },
            { errorCount: 2, warningCount: 1 },
          ])
        });
      } else if (command.includes('grep -r -n "TODO\\|FIXME"')) {
        callback(null, {
          stdout: './src/auth.ts:45:// TODO: Fix this later\n./src/service.ts:120:// FIXME: Handle edge case\n'
        });
      } else {
        callback(null, { stdout: '' });
      }
    });

    const childProcess = require('child_process');
    childProcess.exec = mockExec;

    // Mock file reading to simulate code analysis
    vi.mocked(fs.readFile).mockImplementation((path: any) => {
      const pathStr = path.toString();

      if (pathStr.includes('large-service.ts')) {
        // Simulate a large file with long methods
        const largeMethods = Array.from({ length: 30 }, (_, i) =>
          `  function processData${i}() {\n` +
          Array.from({ length: 80 }, (_, j) => `    console.log('line ${j}');\n`).join('') +
          '  }\n'
        ).join('\n');
        return Promise.resolve(largeMethods);
      }

      if (pathStr.includes('complex-manager.ts')) {
        // Simulate complex file with deep nesting
        const deepNesting = `
class Manager {
  processRequest(request) {
    if (request) {
      if (request.valid) {
        if (request.authorized) {
          if (request.data) {
            if (request.data.items) {
              if (request.data.items.length > 0) {
                console.log('Deep nesting detected');
              }
            }
          }
        }
      }
    }
  }
}`;
        return Promise.resolve(deepNesting);
      }

      if (pathStr.includes('package.json')) {
        return Promise.resolve(JSON.stringify({
          dependencies: { 'react': '^18.0.0' },
          devDependencies: { 'typescript': '^5.0.0' },
        }));
      }

      // Default file content
      return Promise.resolve('line 1\nline 2\nline 3\n');
    });
  }

  // ============================================================================
  // 1. IdleProcessor Code Smell Detection Tests
  // ============================================================================

  describe('IdleProcessor Code Smell Detection', () => {
    it('should detect all three main code smell types correctly', async () => {
      await idleProcessor.processIdleTime();

      const analysis = idleProcessor.getLastAnalysis();
      expect(analysis).toBeDefined();
      expect(analysis!.codeQuality.codeSmells).toBeDefined();

      const codeSmells = analysis!.codeQuality.codeSmells;

      // Should detect large-class smells for files > 500 lines
      const largeClassSmells = codeSmells.filter(smell => smell.type === 'large-class');
      expect(largeClassSmells.length).toBeGreaterThanOrEqual(1);

      const largeClassSmell = largeClassSmells.find(smell => smell.file.includes('large-service.ts'));
      expect(largeClassSmell).toBeDefined();
      expect(largeClassSmell!.severity).toBe('high');
      expect(largeClassSmell!.details).toContain('650 lines');

      // Should detect long-method smells
      const longMethodSmells = codeSmells.filter(smell => smell.type === 'long-method');
      expect(longMethodSmells.length).toBeGreaterThanOrEqual(1);

      // Should detect deep-nesting smells
      const deepNestingSmells = codeSmells.filter(smell => smell.type === 'deep-nesting');
      expect(deepNestingSmells.length).toBeGreaterThanOrEqual(1);

      const nestingSmell = deepNestingSmells.find(smell => smell.file.includes('complex-manager.ts'));
      expect(nestingSmell).toBeDefined();
      expect(nestingSmell!.severity).toMatch(/medium|high/);
      expect(nestingSmell!.details).toContain('nesting');
    });

    it('should properly categorize complexity hotspots from file analysis', async () => {
      await idleProcessor.processIdleTime();

      const analysis = idleProcessor.getLastAnalysis();
      expect(analysis).toBeDefined();

      const complexityHotspots = analysis!.codeQuality.complexityHotspots;
      expect(complexityHotspots.length).toBeGreaterThanOrEqual(2);

      // Check that large files are identified as complexity hotspots
      const largeServiceHotspot = complexityHotspots.find(h =>
        (h as ComplexityHotspot).file?.includes('large-service.ts') ||
        (typeof h === 'string' && h.includes('large-service.ts'))
      );
      expect(largeServiceHotspot).toBeDefined();

      const complexManagerHotspot = complexityHotspots.find(h =>
        (h as ComplexityHotspot).file?.includes('complex-manager.ts') ||
        (typeof h === 'string' && h.includes('complex-manager.ts'))
      );
      expect(complexManagerHotspot).toBeDefined();
    });

    it('should detect duplicate patterns from analysis', async () => {
      await idleProcessor.processIdleTime();

      const analysis = idleProcessor.getLastAnalysis();
      expect(analysis).toBeDefined();

      const duplicatedCode = analysis!.codeQuality.duplicatedCode;

      // Should detect TODO/FIXME patterns as duplicated code
      const todoPattern = duplicatedCode.find(pattern =>
        pattern.pattern.includes('TODO') || pattern.pattern.includes('FIXME')
      );
      expect(todoPattern).toBeDefined();
      if (todoPattern) {
        expect(todoPattern.locations.length).toBeGreaterThanOrEqual(2);
        expect(todoPattern.similarity).toBe(1.0);
      }
    });

    it('should handle file analysis errors gracefully', async () => {
      // Mock file read failure for one file
      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        if (path.toString().includes('large-service.ts')) {
          return Promise.reject(new Error('File access denied'));
        }
        return Promise.resolve('normal content\n');
      });

      await expect(idleProcessor.processIdleTime()).resolves.not.toThrow();

      const analysis = idleProcessor.getLastAnalysis();
      expect(analysis).toBeDefined();
      expect(analysis!.codeQuality).toBeDefined();
    });
  });

  // ============================================================================
  // 2. RefactoringAnalyzer Candidate Generation Tests
  // ============================================================================

  describe('RefactoringAnalyzer Candidate Generation', () => {
    it('should generate candidates for all detected smell types', () => {
      const testCodeSmells: CodeSmell[] = [
        {
          file: 'src/service.ts',
          type: 'long-method',
          severity: 'high',
          details: "Method 'processComplexData' has 150 lines (starting at line 42)"
        },
        {
          file: 'src/Manager.ts',
          type: 'large-class',
          severity: 'high',
          details: 'Class has 800 lines and 35 methods, consider breaking into smaller modules'
        },
        {
          file: 'src/parser.ts',
          type: 'deep-nesting',
          severity: 'medium',
          details: 'Deep nesting detected: 6 levels at line 45 (if > for > while)'
        },
        {
          file: 'src/auth.ts',
          type: 'duplicate-code',
          severity: 'medium',
          details: 'Duplicate validation logic found in multiple methods'
        },
        {
          file: 'src/legacy.ts',
          type: 'dead-code',
          severity: 'low',
          details: 'Unused function detectLegacyPattern never called'
        },
        {
          file: 'src/config.ts',
          type: 'magic-numbers',
          severity: 'medium',
          details: 'Magic number 42 used without explanation at line 15'
        },
        {
          file: 'src/service.ts',
          type: 'feature-envy',
          severity: 'medium',
          details: 'Method uses more properties from User class than its own'
        },
        {
          file: 'src/api.ts',
          type: 'data-clumps',
          severity: 'medium',
          details: 'Parameters firstName, lastName, email always passed together'
        }
      ];

      baseProjectAnalysis.codeQuality.codeSmells = testCodeSmells;

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      // Should generate one candidate per smell type
      expect(candidates).toHaveLength(8);

      const expectedCandidateIds = [
        'refactoring-code-smell-long-method',
        'refactoring-code-smell-large-class',
        'refactoring-code-smell-deep-nesting',
        'refactoring-code-smell-duplicate-code',
        'refactoring-code-smell-dead-code',
        'refactoring-code-smell-magic-numbers',
        'refactoring-code-smell-feature-envy',
        'refactoring-code-smell-data-clumps'
      ];

      const actualCandidateIds = candidates.map(c => c.candidateId).sort();
      expect(actualCandidateIds).toEqual(expectedCandidateIds.sort());

      // Verify all candidates have valid structure
      candidates.forEach(candidate => {
        expect(candidate.candidateId).toMatch(/^refactoring-code-smell-/);
        expect(candidate.suggestedWorkflow).toBe('refactoring');
        expect(['low', 'normal', 'high', 'urgent']).toContain(candidate.priority);
        expect(['low', 'medium', 'high']).toContain(candidate.estimatedEffort);
        expect(candidate.score).toBeGreaterThan(0);
        expect(candidate.score).toBeLessThanOrEqual(1);
        expect(candidate.rationale).toBeTruthy();
        expect(candidate.description).toBeTruthy();
        expect(candidate.title).toBeTruthy();
      });
    });

    it('should provide specific recommendations for each smell type', () => {
      const testSmells: CodeSmell[] = [
        { file: 'src/method.ts', type: 'long-method', severity: 'medium', details: 'Long method detected' },
        { file: 'src/class.ts', type: 'large-class', severity: 'medium', details: 'Large class detected' },
        { file: 'src/nested.ts', type: 'deep-nesting', severity: 'medium', details: 'Deep nesting detected' },
        { file: 'src/dup.ts', type: 'duplicate-code', severity: 'medium', details: 'Duplicate code detected' },
        { file: 'src/dead.ts', type: 'dead-code', severity: 'medium', details: 'Dead code detected' },
        { file: 'src/magic.ts', type: 'magic-numbers', severity: 'medium', details: 'Magic numbers detected' },
        { file: 'src/envy.ts', type: 'feature-envy', severity: 'medium', details: 'Feature envy detected' },
        { file: 'src/clumps.ts', type: 'data-clumps', severity: 'medium', details: 'Data clumps detected' }
      ];

      baseProjectAnalysis.codeQuality.codeSmells = testSmells;
      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      // Test specific recommendations for each smell type
      const longMethodTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-long-method');
      expect(longMethodTask!.rationale).toContain('Break long methods into smaller');
      expect(longMethodTask!.rationale).toContain('Single Responsibility Principle');

      const largeClassTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-large-class');
      expect(largeClassTask!.rationale).toContain('Apply Single Responsibility Principle');
      expect(largeClassTask!.rationale).toContain('Extract related functionality');

      const deepNestingTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-deep-nesting');
      expect(deepNestingTask!.rationale).toContain('Use early returns to reduce');
      expect(deepNestingTask!.rationale).toContain('Extract nested logic');

      const duplicateCodeTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-duplicate-code');
      expect(duplicateCodeTask!.rationale).toContain('Extract common code into reusable functions');
      expect(duplicateCodeTask!.rationale).toContain('DRY');

      const deadCodeTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-dead-code');
      expect(deadCodeTask!.rationale).toContain('Remove unused functions');
      expect(deadCodeTask!.rationale).toContain('Clean up commented-out code');

      const magicNumbersTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-magic-numbers');
      expect(magicNumbersTask!.rationale).toContain('Replace numbers with named constants');
      expect(magicNumbersTask!.rationale).toContain('Use enums for related constant values');

      const featureEnvyTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-feature-envy');
      expect(featureEnvyTask!.rationale).toContain('Move methods closer to the data');
      expect(featureEnvyTask!.rationale).toContain('delegation pattern');

      const dataClumpsTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-data-clumps');
      expect(dataClumpsTask!.rationale).toContain('Create parameter objects');
      expect(dataClumpsTask!.rationale).toContain('value objects');
    });

    it('should generate candidates for complexity hotspots with proper scoring', () => {
      const complexityHotspots: ComplexityHotspot[] = [
        {
          file: 'src/critical.ts',
          cyclomaticComplexity: 60,
          cognitiveComplexity: 70,
          lineCount: 2500
        },
        {
          file: 'src/high.ts',
          cyclomaticComplexity: 35,
          cognitiveComplexity: 45,
          lineCount: 1200
        },
        {
          file: 'src/medium.ts',
          cyclomaticComplexity: 25,
          cognitiveComplexity: 30,
          lineCount: 600
        },
        {
          file: 'src/low.ts',
          cyclomaticComplexity: 8,
          cognitiveComplexity: 12,
          lineCount: 200
        }
      ];

      baseProjectAnalysis.codeQuality.complexityHotspots = complexityHotspots;

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      // Should generate individual hotspot tasks for top 3 + aggregate task
      const hotspotTasks = candidates.filter(c => c.candidateId.includes('complexity-hotspot-'));
      const sweepTask = candidates.find(c => c.candidateId === 'refactoring-complexity-sweep');

      expect(hotspotTasks).toHaveLength(3); // Top 3 individual tasks
      expect(sweepTask).toBeDefined(); // Aggregate task for all 4 hotspots

      // Tasks should be sorted by priority score (critical first)
      expect(hotspotTasks[0].description).toContain('critical.ts');
      expect(hotspotTasks[0].priority).toBe('urgent');

      expect(hotspotTasks[1].description).toContain('high.ts');
      expect(hotspotTasks[1].priority).toBe('high');

      expect(hotspotTasks[2].description).toContain('medium.ts');
      expect(hotspotTasks[2].priority).toBe('normal');

      // Scores should be ordered by complexity
      expect(hotspotTasks[0].score).toBeGreaterThan(hotspotTasks[1].score);
      expect(hotspotTasks[1].score).toBeGreaterThan(hotspotTasks[2].score);
    });
  });

  // ============================================================================
  // 3. Priority/Effort Mapping Tests
  // ============================================================================

  describe('Priority and Effort Mapping Based on Severity', () => {
    it('should map severity levels to correct priority and effort', () => {
      const severityTestCases: Array<{
        severity: 'critical' | 'high' | 'medium' | 'low',
        expectedPriority: 'urgent' | 'high' | 'normal' | 'low',
        expectedEffort: 'high' | 'medium' | 'low'
      }> = [
        { severity: 'critical', expectedPriority: 'urgent', expectedEffort: 'high' },
        { severity: 'high', expectedPriority: 'high', expectedEffort: 'high' },
        { severity: 'medium', expectedPriority: 'normal', expectedEffort: 'medium' },
        { severity: 'low', expectedPriority: 'low', expectedEffort: 'low' }
      ];

      severityTestCases.forEach(({ severity, expectedPriority, expectedEffort }, index) => {
        const testSmell: CodeSmell = {
          file: `src/test${index}.ts`,
          type: 'long-method',
          severity,
          details: `Test smell with ${severity} severity`
        };

        baseProjectAnalysis.codeQuality.codeSmells = [testSmell];

        const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);
        const task = candidates.find(c => c.candidateId === 'refactoring-code-smell-long-method');

        expect(task).toBeDefined();
        expect(task!.priority).toBe(expectedPriority);
        expect(task!.estimatedEffort).toBe(expectedEffort);

        // Score should reflect priority (critical > high > medium > low)
        if (severity === 'critical') expect(task!.score).toBeGreaterThan(0.8);
        if (severity === 'high') expect(task!.score).toBeGreaterThan(0.7);
        if (severity === 'medium') expect(task!.score).toBeGreaterThan(0.5);
        if (severity === 'low') expect(task!.score).toBeGreaterThan(0.3);
      });
    });

    it('should handle mixed severity levels and prioritize by highest', () => {
      const mixedSeveritySmells: CodeSmell[] = [
        { file: 'src/critical.ts', type: 'long-method', severity: 'critical', details: 'Critical method' },
        { file: 'src/high1.ts', type: 'long-method', severity: 'high', details: 'High method 1' },
        { file: 'src/high2.ts', type: 'long-method', severity: 'high', details: 'High method 2' },
        { file: 'src/medium.ts', type: 'long-method', severity: 'medium', details: 'Medium method' },
        { file: 'src/low.ts', type: 'long-method', severity: 'low', details: 'Low method' }
      ];

      baseProjectAnalysis.codeQuality.codeSmells = mixedSeveritySmells;

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);
      const longMethodTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-long-method');

      // Should prioritize based on highest severity (critical)
      expect(longMethodTask!.priority).toBe('urgent');
      expect(longMethodTask!.estimatedEffort).toBe('high');

      // Description should include count and file listing
      expect(longMethodTask!.description).toContain('5 long methods');
      expect(longMethodTask!.description).toContain('critical.ts, high1.ts, high2.ts, and 2 more');
    });

    it('should adjust scores based on smell count bonuses', () => {
      // Test few smells vs many smells for score adjustment
      const fewSmells: CodeSmell[] = [
        { file: 'src/file1.ts', type: 'dead-code', severity: 'medium', details: 'Dead code 1' },
        { file: 'src/file2.ts', type: 'dead-code', severity: 'medium', details: 'Dead code 2' }
      ];

      const manySmells: CodeSmell[] = Array.from({ length: 12 }, (_, i) => ({
        file: `src/file${i}.ts`,
        type: 'dead-code' as const,
        severity: 'medium' as const,
        details: `Dead code ${i}`
      }));

      // Test few smells
      baseProjectAnalysis.codeQuality.codeSmells = fewSmells;
      let candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);
      const fewSmellsTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-dead-code');

      // Test many smells
      baseProjectAnalysis.codeQuality.codeSmells = manySmells;
      candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);
      const manySmellsTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-dead-code');

      // Many smells should have higher score due to count bonuses
      expect(manySmellsTask!.score).toBeGreaterThan(fewSmellsTask!.score);
      expect(manySmellsTask!.score).toBeGreaterThan(0.8); // Should get bonuses for >10 items
    });
  });

  // ============================================================================
  // 4. Edge Cases Tests
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle empty code smells gracefully', () => {
      baseProjectAnalysis.codeQuality.codeSmells = [];

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);
      const codeSmellTasks = candidates.filter(c => c.candidateId.includes('code-smell-'));

      expect(codeSmellTasks).toHaveLength(0);
    });

    it('should handle undefined code smells gracefully', () => {
      baseProjectAnalysis.codeQuality.codeSmells = undefined as any;

      expect(() => {
        const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);
        const codeSmellTasks = candidates.filter(c => c.candidateId.includes('code-smell-'));
        expect(codeSmellTasks).toHaveLength(0);
      }).not.toThrow();
    });

    it('should handle multiple smells in the same file correctly', () => {
      const multipleSmellsInSameFile: CodeSmell[] = [
        {
          file: 'src/problematic.ts',
          type: 'long-method',
          severity: 'high',
          details: 'Method processData has 150 lines'
        },
        {
          file: 'src/problematic.ts',
          type: 'large-class',
          severity: 'high',
          details: 'Class has 800 lines and 30 methods'
        },
        {
          file: 'src/problematic.ts',
          type: 'deep-nesting',
          severity: 'medium',
          details: 'Found 6 levels of nesting at line 45'
        },
        {
          file: 'src/problematic.ts',
          type: 'magic-numbers',
          severity: 'low',
          details: 'Magic number 42 at line 10'
        }
      ];

      baseProjectAnalysis.codeQuality.codeSmells = multipleSmellsInSameFile;

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      // Should generate separate tasks for each smell type
      expect(candidates).toHaveLength(4);

      const expectedTypes = ['long-method', 'large-class', 'deep-nesting', 'magic-numbers'];
      expectedTypes.forEach(type => {
        const task = candidates.find(c => c.candidateId === `refactoring-code-smell-${type}`);
        expect(task).toBeDefined();
        expect(task!.description).toContain('problematic.ts');
      });
    });

    it('should handle malformed code smell objects', () => {
      const malformedSmells = [
        {
          file: 'src/malformed1.ts',
          type: 'invalid-type' as any,
          severity: 'medium',
          details: 'Invalid smell type'
        },
        {
          file: 'src/malformed2.ts',
          type: 'long-method',
          severity: 'invalid-severity' as any,
          details: 'Invalid severity level'
        },
        {
          file: '', // Empty file path
          type: 'dead-code',
          severity: 'low',
          details: 'Empty file path'
        }
      ];

      baseProjectAnalysis.codeQuality.codeSmells = malformedSmells;

      expect(() => {
        const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

        // Should handle invalid types with fallback
        const invalidTypeTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-invalid-type');
        expect(invalidTypeTask).toBeDefined();
        expect(invalidTypeTask!.title).toBe('Fix invalid-type Code Smells');

        // Should handle valid smell with invalid severity
        const longMethodTask = candidates.find(c => c.candidateId === 'refactoring-code-smell-long-method');
        expect(longMethodTask).toBeDefined();
      }).not.toThrow();
    });

    it('should handle very long file paths and details', () => {
      const longPath = 'src/' + 'very-long-directory-name/'.repeat(30) + 'deeply-nested-file.ts';
      const longDetails = 'Very '.repeat(100) + 'long details about the code smell that should be handled gracefully';

      const smellWithLongPath: CodeSmell = {
        file: longPath,
        type: 'feature-envy',
        severity: 'medium',
        details: longDetails
      };

      baseProjectAnalysis.codeQuality.codeSmells = [smellWithLongPath];

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);
      const task = candidates.find(c => c.candidateId === 'refactoring-code-smell-feature-envy');

      expect(task).toBeDefined();
      // Should extract filename from long path
      expect(task!.description).toContain('deeply-nested-file.ts');
      // Should include original details in rationale
      expect(task!.rationale).toContain(longDetails);
    });

    it('should handle complexity hotspots with zero or negative values', () => {
      const edgeCaseHotspots: ComplexityHotspot[] = [
        {
          file: 'src/zero.ts',
          cyclomaticComplexity: 0,
          cognitiveComplexity: 0,
          lineCount: 0
        },
        {
          file: 'src/negative.ts',
          cyclomaticComplexity: -5,
          cognitiveComplexity: -10,
          lineCount: -100
        },
        {
          file: 'src/extreme.ts',
          cyclomaticComplexity: Number.MAX_SAFE_INTEGER,
          cognitiveComplexity: Number.MAX_SAFE_INTEGER,
          lineCount: Number.MAX_SAFE_INTEGER
        }
      ];

      baseProjectAnalysis.codeQuality.complexityHotspots = edgeCaseHotspots;

      expect(() => {
        const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

        const hotspotTasks = candidates.filter(c => c.candidateId.includes('complexity-hotspot-'));
        expect(hotspotTasks.length).toBeGreaterThanOrEqual(0);

        // All tasks should have valid priority and score values
        hotspotTasks.forEach(task => {
          expect(['low', 'normal', 'high', 'urgent']).toContain(task.priority);
          expect(task.score).toBeGreaterThan(0);
          expect(task.score).toBeLessThanOrEqual(1);
        });
      }).not.toThrow();
    });

    it('should handle empty duplicate patterns', () => {
      baseProjectAnalysis.codeQuality.duplicatedCode = [];

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);
      const duplicateTask = candidates.find(c => c.candidateId === 'refactoring-duplicated-code');

      expect(duplicateTask).toBeUndefined();
    });
  });

  // ============================================================================
  // 5. Integration Tests
  // ============================================================================

  describe('Integration Tests', () => {
    it('should work end-to-end from IdleProcessor to RefactoringAnalyzer', async () => {
      // Run IdleProcessor to generate real analysis
      await idleProcessor.processIdleTime();
      const analysis = idleProcessor.getLastAnalysis();

      expect(analysis).toBeDefined();

      // Use the analysis with RefactoringAnalyzer
      const candidates = refactoringAnalyzer.analyze(analysis!);

      // Should generate some candidates based on mocked large files
      expect(candidates.length).toBeGreaterThan(0);

      // Should have various types of refactoring tasks
      const candidateTypes = candidates.map(c => c.candidateId);
      const hasCodeSmellTasks = candidateTypes.some(id => id.includes('code-smell-'));
      const hasComplexityTasks = candidateTypes.some(id => id.includes('complexity-'));

      expect(hasCodeSmellTasks || hasComplexityTasks).toBe(true);
    });

    it('should maintain task prioritization across all refactoring issue types', () => {
      baseProjectAnalysis.codeQuality = {
        lintIssues: 25,
        duplicatedCode: ['src/dup.ts'] as DuplicatePattern[],
        complexityHotspots: [{
          file: 'src/critical.ts',
          cyclomaticComplexity: 60,
          cognitiveComplexity: 70,
          lineCount: 2500
        }],
        codeSmells: [{
          file: 'src/critical-smell.ts',
          type: 'long-method',
          severity: 'critical',
          details: 'Critical method smell'
        }]
      };

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);
      const prioritized = refactoringAnalyzer.prioritize(candidates);

      expect(prioritized).toBeDefined();

      // Should prioritize duplicated code (highest fixed score of 0.9)
      expect(prioritized!.candidateId).toBe('refactoring-duplicated-code');
    });

    it('should provide comprehensive task structure for each candidate', () => {
      const comprehensiveSmells: CodeSmell[] = [
        { file: 'src/comprehensive.ts', type: 'long-method', severity: 'high', details: 'Detailed method analysis' },
        { file: 'src/comprehensive.ts', type: 'magic-numbers', severity: 'medium', details: 'Magic numbers found' }
      ];

      baseProjectAnalysis.codeQuality.codeSmells = comprehensiveSmells;
      baseProjectAnalysis.codeQuality.lintIssues = 50;
      baseProjectAnalysis.codeQuality.duplicatedCode = [
        { pattern: 'common pattern', locations: ['file1.ts:10', 'file2.ts:20'], similarity: 0.95 }
      ];

      const candidates = refactoringAnalyzer.analyze(baseProjectAnalysis);

      // Verify all candidates have complete structure
      candidates.forEach(candidate => {
        // Required fields
        expect(candidate.candidateId).toBeTruthy();
        expect(candidate.title).toBeTruthy();
        expect(candidate.description).toBeTruthy();
        expect(candidate.suggestedWorkflow).toBe('refactoring');
        expect(candidate.rationale).toBeTruthy();

        // Valid enum values
        expect(['low', 'normal', 'high', 'urgent']).toContain(candidate.priority);
        expect(['low', 'medium', 'high']).toContain(candidate.estimatedEffort);

        // Valid numeric ranges
        expect(candidate.score).toBeGreaterThan(0);
        expect(candidate.score).toBeLessThanOrEqual(1);

        // Content quality
        expect(candidate.rationale.length).toBeGreaterThan(20);
        expect(candidate.description.length).toBeGreaterThan(10);
      });
    });
  });
});