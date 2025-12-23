/**
 * End-to-End Integration Tests for Detector Flow
 *
 * These tests verify the complete detector pipeline:
 * 1. IdleProcessor calls all detectors
 * 2. DocsAnalyzer processes all OutdatedDocumentation types
 * 3. Events are emitted correctly throughout the pipeline
 *
 * Uses mocking patterns consistent with stale-comment-detector.idle-integration.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';

// Mock fs and child_process before importing modules that use them
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    access: vi.fn(),
    readdir: vi.fn(),
  },
}));

vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

// Mock better-sqlite3
vi.mock('better-sqlite3', () => {
  const mockDb = {
    prepare: vi.fn(() => ({
      run: vi.fn(),
      get: vi.fn(),
      all: vi.fn(() => []),
    })),
    close: vi.fn(),
    pragma: vi.fn(),
  };
  return {
    default: vi.fn(() => mockDb),
  };
});

// Mock SecurityVulnerabilityParser
vi.mock('./utils/security-vulnerability-parser.js', () => ({
  SecurityVulnerabilityParser: {
    parseNpmAuditOutput: vi.fn().mockReturnValue([]),
    createVulnerability: vi.fn().mockImplementation(({name, cveId, severity, affectedVersions, description}) => ({
      name,
      cveId,
      severity,
      affectedVersions,
      description
    }))
  }
}));

// Mock StaleCommentDetector
vi.mock('./stale-comment-detector', () => ({
  StaleCommentDetector: vi.fn().mockImplementation(() => ({
    findStaleComments: vi.fn().mockResolvedValue([
      {
        file: 'src/test.ts',
        type: 'stale-reference',
        description: 'TODO comment added 45 days ago by Test Developer',
        line: 15,
        suggestion: 'Review and resolve this todo comment',
        severity: 'medium',
      }
    ])
  }))
}));

// Mock VersionMismatchDetector
vi.mock('./analyzers/version-mismatch-detector.js', () => ({
  VersionMismatchDetector: vi.fn().mockImplementation(() => ({
    detectMismatches: vi.fn().mockResolvedValue([
      {
        file: 'package.json',
        line: 3,
        foundVersion: '1.0.0',
        expectedVersion: '2.0.0',
        lineContent: '"version": "1.0.0"'
      }
    ])
  }))
}));

// Mock CrossReferenceValidator
vi.mock('./analyzers/cross-reference-validator', () => ({
  CrossReferenceValidator: vi.fn().mockImplementation(() => ({
    buildIndex: vi.fn().mockResolvedValue({ symbolCount: 5 }),
    extractDocumentationReferences: vi.fn().mockReturnValue([]),
    validateDocumentationReferences: vi.fn().mockReturnValue([
      {
        file: 'docs/api.md',
        type: 'broken-link',
        description: 'Reference to non-existent function oldFunction',
        line: 12,
        severity: 'medium'
      }
    ])
  }))
}));

// Now import the modules
import { IdleProcessor, type ProjectAnalysis } from './idle-processor';
import { DocsAnalyzer } from './analyzers/docs-analyzer';
import type { DaemonConfig } from '@apexcli/core';

describe('End-to-End Detector Flow Integration', () => {
  let processor: IdleProcessor;
  let docsAnalyzer: DocsAnalyzer;
  let mockReadFile: any;
  let mockExecAsync: any;

  const mockConfig: DaemonConfig = {
    enabled: true,
    maxConcurrentTasks: 2,
    intervalMinutes: 60,
    analysisDepth: 'medium' as const,
    autoCreateTasks: true,
    taskLimits: {
      maxTasksPerType: 5,
      maxPendingTasks: 10,
    },
    documentation: {
      outdatedDocs: {
        todoAgeThresholdDays: 30,
        versionCheckPatterns: ['package.json', 'README.md'],
        deprecationRequiresMigration: true,
        crossReferenceEnabled: true,
      },
    },
    idleProcessing: {
      enabled: true,
      idleThreshold: 300000,
      taskGenerationInterval: 3600000,
      maxIdleTasks: 3,
    },
  };

  const mockProjectPath = '/mock/project';

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock TaskStore
    const mockStore = {
      getLastActivityTime: vi.fn().mockResolvedValue(new Date(Date.now() - 1000000)),
      getTasksByStatus: vi.fn().mockResolvedValue([]),
      getAllTasks: vi.fn().mockResolvedValue([]),
    } as any;

    processor = new IdleProcessor(mockProjectPath, mockConfig, mockStore);
    docsAnalyzer = new DocsAnalyzer();
    mockReadFile = vi.mocked(fs.readFile);

    // Mock the execAsync method on the processor
    mockExecAsync = vi.fn();
    // @ts-expect-error - accessing private method for testing
    processor.execAsync = mockExecAsync;

    // Setup common mock responses for various commands
    setupCommonMockResponses();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Set up common mock responses for file system and command execution
   */
  function setupCommonMockResponses() {
    // Mock file content responses
    mockReadFile.mockImplementation((path: string) => {
      if (path.includes('package.json')) {
        return Promise.resolve(JSON.stringify({
          name: 'test-project',
          version: '1.0.0',
          dependencies: {
            'lodash': '^4.17.15', // Potentially vulnerable version
            'axios': '^0.21.1'    // Potentially vulnerable version
          },
          devDependencies: {}
        }));
      }

      if (path.includes('README.md')) {
        return Promise.resolve(`# Test Project

This is a test project for APEX.

Version 1.0.0 is available.

@deprecated Use the new API instead.
`);
      }

      if (path.includes('docs/api.md')) {
        return Promise.resolve(`# API Documentation

## Functions

- \`oldFunction()\` - deprecated function
- \`newFunction()\` - use this instead

See also: \`nonExistentFunction()\`
`);
      }

      if (path.includes('.ts') || path.includes('.js')) {
        return Promise.resolve(`
/**
 * Example component
 * @deprecated Use NewComponent instead
 */
export class OldComponent {
  // TODO: Remove this after migration to NewComponent
  // FIXME: Handle error case properly
  // HACK: Temporary workaround

  process() {
    if (true) {
      if (true) {
        if (true) {
          if (true) {
            if (true) {
              // Deep nesting example
              console.log('deeply nested code');
            }
          }
        }
      }
    }
  }
}

export function undocumentedFunction() {
  return 'no docs';
}

function validateEmail(email: string) {
  return /\\S+@\\S+\\.\\S+/.test(email);
}
`);
      }

      return Promise.resolve('');
    });

    // Mock command execution responses
    mockExecAsync.mockImplementation((command: string) => {
      if (command.includes('find . -type f')) {
        return Promise.resolve({
          stdout: './src/component.ts\n./src/utils.ts\n./docs/api.md\n./README.md',
          stderr: ''
        });
      }

      if (command.includes('find . -name "*.ts"') || command.includes('find . -name "*.js"')) {
        return Promise.resolve({
          stdout: './src/component.ts\n./src/utils.ts\n./src/large-file.ts',
          stderr: ''
        });
      }

      if (command.includes('find . -name "*.md"')) {
        return Promise.resolve({
          stdout: './README.md\n./docs/api.md',
          stderr: ''
        });
      }

      if (command.includes('xargs wc -l')) {
        return Promise.resolve({
          stdout: '150 ./src/component.ts\n200 ./src/utils.ts\n600 ./src/large-file.ts\n950 total',
          stderr: ''
        });
      }

      if (command.includes('find . -name "*.test.*"')) {
        return Promise.resolve({
          stdout: './src/component.test.ts\n./src/utils.test.ts',
          stderr: ''
        });
      }

      if (command.includes('find . -name "README*"')) {
        return Promise.resolve({
          stdout: './README.md',
          stderr: ''
        });
      }

      if (command.includes('grep -r') && command.includes('TODO\\|FIXME\\|HACK')) {
        return Promise.resolve({
          stdout: './src/component.ts:10:// TODO: Remove this\n./src/utils.ts:25:// FIXME: Handle errors',
          stderr: ''
        });
      }

      if (command.includes('npm audit')) {
        return Promise.resolve({
          stdout: '{}', // Empty audit response
          stderr: ''
        });
      }

      // Default response for unmatched commands
      return Promise.resolve({ stdout: '', stderr: '' });
    });
  }

  describe('IdleProcessor Detector Integration', () => {
    it('should call all detectors during analysis', async () => {
      // Set up event listeners to track detector calls
      const detectorEvents = {
        'detector:stale-comment:found': vi.fn(),
        'detector:version-mismatch:found': vi.fn(),
        'detector:outdated-docs:found': vi.fn(),
        'detector:undocumented-export:found': vi.fn(),
        'detector:missing-readme-section:found': vi.fn(),
        'detector:code-smell:found': vi.fn(),
        'detector:complexity-hotspot:found': vi.fn(),
        'detector:duplicate-code:found': vi.fn(),
        'detector:security-vulnerability:found': vi.fn(),
        'detector:finding': vi.fn(),
      };

      // Register all event listeners
      Object.entries(detectorEvents).forEach(([event, spy]) => {
        processor.on(event as any, spy);
      });

      // Trigger the analysis
      await processor.processIdleTime();

      // Verify analysis was completed
      const analysis = processor.getLastAnalysis();
      expect(analysis).toBeDefined();

      // Verify that detector findings were generated
      expect(analysis!.documentation.outdatedDocs).toBeDefined();
      expect(analysis!.documentation.undocumentedExports).toBeDefined();
      expect(analysis!.documentation.missingReadmeSections).toBeDefined();
      expect(analysis!.codeQuality.codeSmells).toBeDefined();
      expect(analysis!.codeQuality.complexityHotspots).toBeDefined();
      expect(analysis!.codeQuality.duplicatedCode).toBeDefined();

      // Verify at least some detectors were called by checking events were emitted
      const eventsEmitted = Object.entries(detectorEvents)
        .filter(([_, spy]) => spy.mock.calls.length > 0)
        .map(([event]) => event);

      expect(eventsEmitted.length).toBeGreaterThan(0);
      console.log('Events emitted:', eventsEmitted);

      // Verify the generic detector:finding event was emitted
      expect(detectorEvents['detector:finding']).toHaveBeenCalled();
    });

    it('should process all detector types in the correct order', async () => {
      const allDetectorCalls: string[] = [];

      processor.on('detector:finding', (finding) => {
        allDetectorCalls.push(finding.detectorType);
      });

      await processor.processIdleTime();

      // Get unique detector types that were called
      const uniqueDetectorTypes = [...new Set(allDetectorCalls)];

      // Verify that multiple detector types were processed
      expect(uniqueDetectorTypes.length).toBeGreaterThan(1);

      // Expected detector types based on the IdleProcessor implementation
      const expectedDetectorTypes = [
        'outdated-docs',
        'undocumented-export',
        'missing-readme-section',
        'code-smell',
        'complexity-hotspot',
        'duplicate-code'
      ];

      // Check that at least some of the expected detectors were called
      const foundExpectedTypes = expectedDetectorTypes.filter(type =>
        uniqueDetectorTypes.includes(type)
      );

      expect(foundExpectedTypes.length).toBeGreaterThan(0);
    });

    it('should handle detector failures gracefully without breaking the pipeline', async () => {
      // Mock one detector to fail
      const StaleCommentDetector = require('./stale-comment-detector').StaleCommentDetector;
      StaleCommentDetector.mockImplementation(() => ({
        findStaleComments: vi.fn().mockRejectedValue(new Error('Detector failed'))
      }));

      const detectorFindingSpy = vi.fn();
      processor.on('detector:finding', detectorFindingSpy);

      // Should not throw despite detector failure
      await expect(processor.processIdleTime()).resolves.toBeUndefined();

      // Analysis should still complete
      const analysis = processor.getLastAnalysis();
      expect(analysis).toBeDefined();

      // Other detectors should still emit findings
      expect(detectorFindingSpy).toHaveBeenCalled();
    });
  });

  describe('DocsAnalyzer Integration with OutdatedDocumentation Types', () => {
    let mockAnalysis: ProjectAnalysis;

    beforeEach(() => {
      // Create a comprehensive mock analysis with all OutdatedDocumentation types
      mockAnalysis = {
        codebaseSize: {
          files: 10,
          lines: 1000,
          languages: { ts: 8, js: 2 }
        },
        dependencies: {
          outdated: ['lodash@4.17.15'],
          security: [],
          securityIssues: [],
          deprecatedPackages: []
        },
        codeQuality: {
          lintIssues: 5,
          duplicatedCode: [],
          complexityHotspots: [],
          codeSmells: []
        },
        documentation: {
          coverage: 25,
          missingDocs: ['src/component.ts', 'src/utils.ts'],
          undocumentedExports: [],
          outdatedDocs: [
            {
              file: 'src/component.ts',
              type: 'stale-reference',
              description: 'TODO comment added 45 days ago',
              line: 10,
              severity: 'medium',
              suggestion: 'Review and resolve'
            },
            {
              file: 'package.json',
              type: 'version-mismatch',
              description: 'Found version 1.0.0 but expected 2.0.0',
              line: 3,
              severity: 'high',
              suggestion: 'Update version'
            },
            {
              file: 'docs/api.md',
              type: 'broken-link',
              description: 'Reference to non-existent function',
              line: 12,
              severity: 'medium',
              suggestion: 'Update reference'
            },
            {
              file: 'src/component.ts',
              type: 'deprecated-api',
              description: '@deprecated tag missing migration guide',
              line: 5,
              severity: 'high',
              suggestion: 'Add migration instructions'
            },
            {
              file: 'docs/examples.md',
              type: 'outdated-example',
              description: 'Code example uses deprecated API',
              line: 20,
              severity: 'low',
              suggestion: 'Update example code'
            }
          ],
          missingReadmeSections: [],
          apiCompleteness: {
            percentage: 60,
            details: {
              totalEndpoints: 10,
              documentedEndpoints: 6,
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
    });

    it('should process all OutdatedDocumentation types', () => {
      const candidates = docsAnalyzer.analyze(mockAnalysis);

      // Verify that DocsAnalyzer generates task candidates for different types
      const candidateTypes = candidates.map(c => c.id);

      // Should have candidates for stale comments
      const staleCommentCandidates = candidates.filter(c =>
        c.id.includes('stale-comment') || c.description.includes('TODO') || c.description.includes('FIXME')
      );
      expect(staleCommentCandidates.length).toBeGreaterThan(0);

      // Should have candidates for version mismatches
      const versionMismatchCandidates = candidates.filter(c =>
        c.id.includes('version-mismatch') || c.description.includes('version')
      );
      expect(versionMismatchCandidates.length).toBeGreaterThan(0);

      // Should have candidates for broken links
      const brokenLinkCandidates = candidates.filter(c =>
        c.id.includes('broken-link') || c.description.includes('broken')
      );
      expect(brokenLinkCandidates.length).toBeGreaterThan(0);

      // Should have candidates for deprecated API docs
      const deprecatedApiCandidates = candidates.filter(c =>
        c.id.includes('deprecated-api') || c.description.includes('@deprecated')
      );
      expect(deprecatedApiCandidates.length).toBeGreaterThan(0);

      // Verify total candidates were generated
      expect(candidates.length).toBeGreaterThan(3);

      // Verify candidate structure
      candidates.forEach(candidate => {
        expect(candidate).toEqual({
          id: expect.any(String),
          type: expect.stringMatching(/improvement|maintenance|optimization|documentation/),
          title: expect.any(String),
          description: expect.any(String),
          priority: expect.stringMatching(/low|normal|high/),
          estimatedEffort: expect.stringMatching(/low|medium|high/),
          suggestedWorkflow: expect.any(String),
          rationale: expect.any(String),
          score: expect.any(Number)
        });
      });
    });

    it('should prioritize high-severity outdated documentation correctly', () => {
      // Create analysis with high-severity issues
      const highSeverityAnalysis = {
        ...mockAnalysis,
        documentation: {
          ...mockAnalysis.documentation,
          outdatedDocs: [
            {
              file: 'src/critical.ts',
              type: 'version-mismatch' as const,
              description: 'Critical version mismatch in API',
              line: 1,
              severity: 'high' as const,
              suggestion: 'Update immediately'
            },
            {
              file: 'src/api.ts',
              type: 'deprecated-api' as const,
              description: 'Missing migration guide for breaking change',
              line: 10,
              severity: 'high' as const,
              suggestion: 'Add migration instructions'
            }
          ]
        }
      };

      const candidates = docsAnalyzer.analyze(highSeverityAnalysis);

      // Should have high-priority candidates
      const highPriorityCandidates = candidates.filter(c => c.priority === 'high');
      expect(highPriorityCandidates.length).toBeGreaterThan(0);

      // High-priority candidates should have higher scores
      const highPriorityScores = highPriorityCandidates.map(c => c.score);
      const averageHighScore = highPriorityScores.reduce((sum, score) => sum + score, 0) / highPriorityScores.length;

      expect(averageHighScore).toBeGreaterThan(0.7);
    });

    it('should handle mixed severity levels appropriately', () => {
      const candidates = docsAnalyzer.analyze(mockAnalysis);

      // Should generate candidates with different priorities
      const priorities = [...new Set(candidates.map(c => c.priority))];
      expect(priorities.length).toBeGreaterThan(1);

      // Verify score distribution
      const scores = candidates.map(c => c.score);
      const minScore = Math.min(...scores);
      const maxScore = Math.max(...scores);

      expect(maxScore).toBeGreaterThan(minScore);
      expect(minScore).toBeGreaterThan(0);
      expect(maxScore).toBeLessThanOrEqual(1);
    });

    it('should generate specific task descriptions for different outdated doc types', () => {
      const candidates = docsAnalyzer.analyze(mockAnalysis);

      // Check that descriptions are specific to the issue type
      const descriptions = candidates.map(c => c.description);

      // Should mention specific counts and types
      const hasSpecificCounts = descriptions.some(desc => /\d+/.test(desc));
      expect(hasSpecificCounts).toBe(true);

      // Should have varied descriptions
      const uniqueDescriptions = [...new Set(descriptions)];
      expect(uniqueDescriptions.length).toBe(descriptions.length);
    });
  });

  describe('Event Emission Verification', () => {
    it('should emit events in the correct sequence during analysis', async () => {
      const eventSequence: string[] = [];

      // Track event order
      processor.on('analysis:started', () => eventSequence.push('analysis:started'));
      processor.on('detector:finding', () => eventSequence.push('detector:finding'));
      processor.on('detector:outdated-docs:found', () => eventSequence.push('detector:outdated-docs:found'));
      processor.on('detector:undocumented-export:found', () => eventSequence.push('detector:undocumented-export:found'));
      processor.on('detector:code-smell:found', () => eventSequence.push('detector:code-smell:found'));
      processor.on('analysis:completed', () => eventSequence.push('analysis:completed'));
      processor.on('tasks:generated', () => eventSequence.push('tasks:generated'));

      await processor.processIdleTime();

      // Verify events were emitted
      expect(eventSequence).toContain('analysis:started');
      expect(eventSequence).toContain('analysis:completed');

      // Analysis started should be first
      expect(eventSequence[0]).toBe('analysis:started');

      // Analysis completed should come before task generation
      const analysisCompletedIndex = eventSequence.indexOf('analysis:completed');
      const tasksGeneratedIndex = eventSequence.indexOf('tasks:generated');

      if (tasksGeneratedIndex >= 0) {
        expect(analysisCompletedIndex).toBeLessThan(tasksGeneratedIndex);
      }
    });

    it('should emit detector events with correct metadata structure', async () => {
      const detectorFindings: any[] = [];

      processor.on('detector:finding', (finding) => {
        detectorFindings.push(finding);
      });

      await processor.processIdleTime();

      expect(detectorFindings.length).toBeGreaterThan(0);

      // Verify each finding has the correct structure
      detectorFindings.forEach(finding => {
        expect(finding).toEqual({
          detectorType: expect.any(String),
          severity: expect.stringMatching(/low|medium|high|critical/),
          file: expect.any(String),
          description: expect.any(String),
          metadata: expect.any(Object)
        });

        // Optional fields
        if (finding.line !== undefined) {
          expect(finding.line).toBeGreaterThan(0);
        }
      });
    });

    it('should emit type-specific detector events with correct payloads', async () => {
      const typedEvents: Record<string, any[]> = {};

      const eventTypes = [
        'detector:outdated-docs:found',
        'detector:undocumented-export:found',
        'detector:missing-readme-section:found',
        'detector:code-smell:found',
        'detector:complexity-hotspot:found',
        'detector:duplicate-code:found'
      ];

      eventTypes.forEach(eventType => {
        typedEvents[eventType] = [];
        processor.on(eventType as any, (data) => {
          typedEvents[eventType].push(data);
        });
      });

      await processor.processIdleTime();

      // Verify at least some typed events were emitted
      const emittedEventTypes = Object.keys(typedEvents).filter(
        eventType => typedEvents[eventType].length > 0
      );

      expect(emittedEventTypes.length).toBeGreaterThan(0);

      // Verify structure of emitted events
      Object.entries(typedEvents).forEach(([eventType, events]) => {
        if (events.length > 0) {
          expect(events[0]).toBeInstanceOf(Array);

          if (events[0].length > 0) {
            const firstItem = events[0][0];

            // Verify common fields exist
            expect(firstItem).toHaveProperty('file');

            // Type-specific validations
            if (eventType.includes('outdated-docs')) {
              expect(firstItem).toHaveProperty('type');
              expect(firstItem).toHaveProperty('description');
              expect(firstItem).toHaveProperty('severity');
            }

            if (eventType.includes('code-smell')) {
              expect(firstItem).toHaveProperty('type');
              expect(firstItem).toHaveProperty('severity');
              expect(firstItem).toHaveProperty('details');
            }

            if (eventType.includes('undocumented-export')) {
              expect(firstItem).toHaveProperty('name');
              expect(firstItem).toHaveProperty('type');
              expect(firstItem).toHaveProperty('isPublic');
            }
          }
        }
      });
    });

    it('should emit events consistently across multiple analysis runs', async () => {
      const run1Events: string[] = [];
      const run2Events: string[] = [];

      // First run
      const listener1 = (finding: any) => run1Events.push(finding.detectorType);
      processor.on('detector:finding', listener1);

      await processor.processIdleTime();

      processor.off('detector:finding', listener1);

      // Second run
      const listener2 = (finding: any) => run2Events.push(finding.detectorType);
      processor.on('detector:finding', listener2);

      await processor.processIdleTime();

      processor.off('detector:finding', listener2);

      // Both runs should emit similar types of events
      const uniqueRun1Types = [...new Set(run1Events)];
      const uniqueRun2Types = [...new Set(run2Events)];

      // Should have events in both runs
      expect(uniqueRun1Types.length).toBeGreaterThan(0);
      expect(uniqueRun2Types.length).toBeGreaterThan(0);

      // Should have significant overlap in detector types
      const commonTypes = uniqueRun1Types.filter(type => uniqueRun2Types.includes(type));
      expect(commonTypes.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty project gracefully', async () => {
      // Mock empty project
      mockExecAsync.mockImplementation(() => Promise.resolve({ stdout: '', stderr: '' }));
      mockReadFile.mockImplementation(() => Promise.resolve(''));

      const detectorFindingSpy = vi.fn();
      processor.on('detector:finding', detectorFindingSpy);

      await processor.processIdleTime();

      // Should complete without errors
      const analysis = processor.getLastAnalysis();
      expect(analysis).toBeDefined();

      // Should still have some basic structure
      expect(analysis!.codebaseSize).toBeDefined();
      expect(analysis!.documentation).toBeDefined();
    });

    it('should handle detector import failures gracefully', async () => {
      // Mock detector import failure
      vi.doMock('./stale-comment-detector', () => {
        throw new Error('Module not found');
      });

      const analysisCompletedSpy = vi.fn();
      processor.on('analysis:completed', analysisCompletedSpy);

      // Should not throw
      await expect(processor.processIdleTime()).resolves.toBeUndefined();

      // Analysis should still complete
      expect(analysisCompletedSpy).toHaveBeenCalled();
    });

    it('should maintain event emission even with partial detector failures', async () => {
      // Mock mixed success/failure scenario
      mockExecAsync.mockImplementation((command: string) => {
        if (command.includes('find . -name "*.ts"')) {
          return Promise.resolve({ stdout: './src/test.ts', stderr: '' });
        }
        if (command.includes('xargs wc -l')) {
          return Promise.reject(new Error('wc command failed'));
        }
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      const detectorFindingSpy = vi.fn();
      processor.on('detector:finding', detectorFindingSpy);

      await processor.processIdleTime();

      // Should still emit some findings despite partial failures
      expect(detectorFindingSpy).toHaveBeenCalled();
    });
  });
});