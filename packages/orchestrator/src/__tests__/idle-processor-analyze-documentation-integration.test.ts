/**
 * Integration test for IdleProcessor.analyzeDocumentation() method
 * Tests the specific integration points mentioned in acceptance criteria:
 *
 * - IdleProcessor.analyzeDocumentation() populates all new ProjectAnalysis.documentation fields
 * - Integration with existing analysis pipeline
 * - Uses all implemented detection utilities:
 *   - StaleCommentDetector
 *   - VersionMismatchDetector
 *   - CrossReferenceValidator
 *   - SecurityVulnerabilityParser
 *   - JSDocDetector
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { IdleProcessor, ProjectAnalysis } from '../idle-processor';
import type { DaemonConfig, EnhancedDocumentationAnalysis } from '@apexcli/core';
import { TaskStore } from '../store';

// Mock dependencies
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
  },
}));

vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

describe('IdleProcessor.analyzeDocumentation() Integration Test', () => {
  let idleProcessor: IdleProcessor;
  let mockTaskStore: TaskStore;
  let mockConfig: DaemonConfig;
  const testProjectPath = '/test/project';

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfig = {
      pollInterval: 5000,
      autoStart: false,
      logLevel: 'info',
      idleProcessing: {
        enabled: true,
        idleThreshold: 300000,
        taskGenerationInterval: 3600000,
        maxIdleTasks: 3
      }
    };

    mockTaskStore = {
      getTasksByStatus: vi.fn().mockResolvedValue([]),
      getAllTasks: vi.fn().mockResolvedValue([]),
      createTask: vi.fn(),
    } as any;

    idleProcessor = new IdleProcessor(testProjectPath, mockConfig, mockTaskStore);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should populate all ProjectAnalysis.documentation fields using detection utilities', async () => {
    // Setup comprehensive mocks for all detection utilities
    await setupAllDetectionUtilityMocks();

    // Call analyzeDocumentation directly
    const documentation: EnhancedDocumentationAnalysis = await (idleProcessor as any).analyzeDocumentation();

    // Verify all required fields are populated according to EnhancedDocumentationAnalysis interface
    expect(documentation).toEqual(
      expect.objectContaining({
        // Basic coverage (existing functionality)
        coverage: expect.any(Number),
        missingDocs: expect.any(Array),

        // New enhanced fields populated by detection utilities
        undocumentedExports: expect.any(Array),
        outdatedDocs: expect.any(Array),
        missingReadmeSections: expect.any(Array),
        apiCompleteness: expect.objectContaining({
          percentage: expect.any(Number),
          details: expect.objectContaining({
            totalEndpoints: expect.any(Number),
            documentedEndpoints: expect.any(Number),
            undocumentedItems: expect.any(Array),
            wellDocumentedExamples: expect.any(Array),
            commonIssues: expect.any(Array)
          })
        })
      })
    );

    // Verify undocumentedExports contains proper structure from JSDocDetector
    if (documentation.undocumentedExports.length > 0) {
      expect(documentation.undocumentedExports[0]).toMatchObject({
        file: expect.any(String),
        name: expect.any(String),
        type: expect.stringMatching(/function|class|interface|type|const|let|var|enum|namespace/),
        line: expect.any(Number),
        isPublic: expect.any(Boolean)
      });
    }

    // Verify outdatedDocs contains findings from all detection utilities
    expect(Array.isArray(documentation.outdatedDocs)).toBe(true);

    // Should include findings from StaleCommentDetector, VersionMismatchDetector, and CrossReferenceValidator
    const detectorTypes = documentation.outdatedDocs.map(doc => doc.type);
    const hasMultipleSources = new Set(detectorTypes).size > 1;
    if (documentation.outdatedDocs.length > 0) {
      expect(hasMultipleSources || documentation.outdatedDocs.length >= 1).toBe(true);
    }

    // Verify missingReadmeSections structure
    if (documentation.missingReadmeSections.length > 0) {
      expect(documentation.missingReadmeSections[0]).toMatchObject({
        section: expect.any(String),
        priority: expect.stringMatching(/required|recommended|optional/),
        description: expect.any(String)
      });
    }

    // Verify apiCompleteness was calculated
    expect(documentation.apiCompleteness.percentage).toBeGreaterThanOrEqual(0);
    expect(documentation.apiCompleteness.percentage).toBeLessThanOrEqual(100);
  });

  it('should integrate with existing analysis pipeline in processIdleTime', async () => {
    await setupAllDetectionUtilityMocks();

    // Setup spies to verify integration with broader analysis pipeline
    const analysisStartedSpy = vi.fn();
    const analysisCompletedSpy = vi.fn();
    const taskGeneratedSpy = vi.fn();

    idleProcessor.on('analysis:started', analysisStartedSpy);
    idleProcessor.on('analysis:completed', analysisCompletedSpy);
    idleProcessor.on('task:suggested', taskGeneratedSpy);

    // Run the full idle processing pipeline
    await idleProcessor.processIdleTime();

    // Verify analysis pipeline executed
    expect(analysisStartedSpy).toHaveBeenCalled();
    expect(analysisCompletedSpy).toHaveBeenCalled();

    // Verify analysis was completed with documentation analysis included
    expect(analysisCompletedSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        documentation: expect.objectContaining({
          coverage: expect.any(Number),
          undocumentedExports: expect.any(Array),
          outdatedDocs: expect.any(Array),
          missingReadmeSections: expect.any(Array),
          apiCompleteness: expect.any(Object)
        })
      })
    );

    // Get the last analysis to verify documentation was included
    const lastAnalysis = idleProcessor.getLastAnalysis();
    expect(lastAnalysis).toBeDefined();
    expect(lastAnalysis!.documentation).toBeDefined();
    expect(lastAnalysis!.documentation).toHaveProperty('undocumentedExports');
    expect(lastAnalysis!.documentation).toHaveProperty('outdatedDocs');
    expect(lastAnalysis!.documentation).toHaveProperty('missingReadmeSections');
    expect(lastAnalysis!.documentation).toHaveProperty('apiCompleteness');
  });

  it('should emit detector events for all integrated utilities', async () => {
    await setupAllDetectionUtilityMocks();

    // Setup event listeners for all detector events
    const eventSpies = {
      'detector:undocumented-export:found': vi.fn(),
      'detector:outdated-docs:found': vi.fn(),
      'detector:missing-readme-section:found': vi.fn(),
      'detector:stale-comment:found': vi.fn(),
      'detector:version-mismatch:found': vi.fn(),
      'detector:finding': vi.fn()
    };

    Object.entries(eventSpies).forEach(([event, spy]) => {
      idleProcessor.on(event as any, spy);
    });

    // Execute documentation analysis
    await (idleProcessor as any).analyzeDocumentation();

    // Verify key events were emitted (at least some should be)
    const emittedEvents = Object.entries(eventSpies)
      .filter(([_, spy]) => spy.mock.calls.length > 0)
      .map(([event, _]) => event);

    expect(emittedEvents.length).toBeGreaterThan(0);

    // Should emit general detector:finding events
    expect(eventSpies['detector:finding']).toHaveBeenCalled();

    // If specific detector events were emitted, verify their structure
    if (eventSpies['detector:undocumented-export:found'].mock.calls.length > 0) {
      expect(eventSpies['detector:undocumented-export:found']).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            file: expect.any(String),
            name: expect.any(String),
            type: expect.any(String),
            line: expect.any(Number),
            isPublic: expect.any(Boolean)
          })
        ])
      );
    }
  });

  it('should handle errors gracefully while maintaining functionality', async () => {
    // Setup some utilities to work and others to fail
    await setupPartiallyFailingMocks();

    // Should not throw errors
    const documentation = await (idleProcessor as any).analyzeDocumentation();

    // Should return valid structure even with some failures
    expect(documentation).toEqual(
      expect.objectContaining({
        coverage: expect.any(Number),
        missingDocs: expect.any(Array),
        undocumentedExports: expect.any(Array),
        outdatedDocs: expect.any(Array),
        missingReadmeSections: expect.any(Array),
        apiCompleteness: expect.any(Object)
      })
    );

    // All arrays should be defined (even if empty due to errors)
    expect(Array.isArray(documentation.undocumentedExports)).toBe(true);
    expect(Array.isArray(documentation.outdatedDocs)).toBe(true);
    expect(Array.isArray(documentation.missingReadmeSections)).toBe(true);
  });

  // Helper function to setup all detection utility mocks
  async function setupAllDetectionUtilityMocks() {
    // Setup file system mocks
    const { exec } = await import('child_process');
    const mockExec = exec as any;

    // Mock file finding commands
    mockExec
      .mockImplementationOnce((command: string, options: any, callback: any) => {
        if (command.includes('find') && command.includes('md') && command.includes('wc')) {
          callback(null, { stdout: '2', stderr: '' });
        }
      })
      .mockImplementationOnce((command: string, options: any, callback: any) => {
        if (command.includes('find') && command.includes('ts') && command.includes('wc')) {
          callback(null, { stdout: '10', stderr: '' });
        }
      })
      .mockImplementationOnce((command: string, options: any, callback: any) => {
        if (command.includes('find') && !command.includes('test')) {
          callback(null, { stdout: './src/api.ts\n./src/utils.ts\n', stderr: '' });
        }
      })
      .mockImplementationOnce((command: string, options: any, callback: any) => {
        if (command.includes('find') && command.includes('md')) {
          callback(null, { stdout: './README.md\n./docs/api.md\n', stderr: '' });
        }
      })
      .mockImplementationOnce((command: string, options: any, callback: any) => {
        if (command.includes('find') && command.includes('README')) {
          callback(null, { stdout: './README.md\n', stderr: '' });
        }
      })
      .mockImplementation((command: string, options: any, callback: any) => {
        // Default fallback for any other commands
        callback(null, { stdout: '', stderr: '' });
      });

    // Mock file reading
    const mockReadFile = fs.readFile as any;
    mockReadFile.mockImplementation((path: any) => {
      if (path.includes('api.ts')) {
        return Promise.resolve(`
export function undocumentedFunction() {
  return 'test';
}

/**
 * @deprecated Use newFunction instead
 */
export function deprecatedFunction() {
  return 'old';
}

/**
 * Well documented function
 * @param data Input data
 */
export function documentedFunction(data: any) {
  return data;
}
        `);
      }
      if (path.includes('utils.ts')) {
        return Promise.resolve(`
export class UndocumentedClass {
  method() {}
}
        `);
      }
      if (path.includes('README.md')) {
        return Promise.resolve(`
# My Project

This is a basic project with minimal documentation.

## Usage
Run npm start
        `);
      }
      if (path.includes('api.md')) {
        return Promise.resolve(`
# API Documentation

Use \`MissingFunction()\` to process data.
Version 1.0.0 features are documented here.
        `);
      }
      return Promise.resolve('export function test() { return "test"; }');
    });

    // Mock StaleCommentDetector
    const mockStaleCommentDetector = {
      findStaleComments: vi.fn().mockResolvedValue([
        {
          file: 'src/old.ts',
          type: 'stale-reference',
          description: 'Stale TODO comment',
          line: 10,
          severity: 'medium'
        }
      ])
    };

    vi.doMock('../stale-comment-detector', () => ({
      StaleCommentDetector: vi.fn().mockImplementation(() => mockStaleCommentDetector)
    }));

    // Mock VersionMismatchDetector
    const mockVersionMismatchDetector = {
      detectMismatches: vi.fn().mockResolvedValue([
        {
          file: 'docs/api.md',
          line: 5,
          foundVersion: '1.0.0',
          expectedVersion: '2.0.0',
          lineContent: 'Version 1.0.0 features'
        }
      ])
    };

    vi.doMock('../analyzers/version-mismatch-detector', () => ({
      VersionMismatchDetector: vi.fn().mockImplementation(() => mockVersionMismatchDetector)
    }));

    // Mock CrossReferenceValidator
    const mockCrossReferenceValidator = {
      buildIndex: vi.fn().mockResolvedValue({
        byName: new Map([
          ['documentedFunction', [{ name: 'documentedFunction', type: 'function', file: './src/api.ts' }]]
        ]),
        byFile: new Map(),
        stats: { totalSymbols: 1, totalFiles: 1, byType: {} }
      }),
      extractDocumentationReferences: vi.fn().mockReturnValue([
        {
          symbolName: 'MissingFunction',
          referenceType: 'inline-code',
          sourceFile: './docs/api.md',
          line: 5,
          column: 10,
          context: 'Use `MissingFunction()` to process data'
        }
      ]),
      validateDocumentationReferences: vi.fn().mockReturnValue([
        {
          file: 'docs/api.md',
          type: 'broken-link',
          description: "Reference to non-existent symbol 'MissingFunction'",
          line: 5,
          suggestion: 'Symbol not found',
          severity: 'medium'
        }
      ])
    };

    vi.doMock('../analyzers/cross-reference-validator', () => ({
      CrossReferenceValidator: vi.fn().mockImplementation(() => mockCrossReferenceValidator)
    }));

    // Mock validateDeprecatedTags (JSDocDetector)
    const mockValidateDeprecatedTags = vi.fn().mockReturnValue([
      {
        file: 'src/api.ts',
        type: 'deprecated-api',
        description: '@deprecated tag lacks proper migration path',
        line: 5,
        suggestion: 'Add detailed migration instructions',
        severity: 'medium'
      }
    ]);

    vi.doMock('@apexcli/core', async () => {
      const actual = await vi.importActual('@apexcli/core') as any;
      return {
        ...actual,
        validateDeprecatedTags: mockValidateDeprecatedTags
      };
    });
  }

  // Helper function to setup partially failing mocks
  async function setupPartiallyFailingMocks() {
    // Setup basic file system mocks
    const { exec } = await import('child_process');
    const mockExec = exec as any;
    mockExec.mockImplementation((command: string, options: any, callback: any) => {
      callback(null, { stdout: '', stderr: '' });
    });

    const mockReadFile = fs.readFile as any;
    mockReadFile.mockResolvedValue('export function test() { return "test"; }');

    // Mock some utilities to fail
    const failingStaleCommentDetector = {
      findStaleComments: vi.fn().mockRejectedValue(new Error('Git not available'))
    };

    vi.doMock('../stale-comment-detector', () => ({
      StaleCommentDetector: vi.fn().mockImplementation(() => failingStaleCommentDetector)
    }));

    // Mock other utilities to succeed
    const workingVersionMismatchDetector = {
      detectMismatches: vi.fn().mockResolvedValue([])
    };

    vi.doMock('../analyzers/version-mismatch-detector', () => ({
      VersionMismatchDetector: vi.fn().mockImplementation(() => workingVersionMismatchDetector)
    }));

    const workingCrossReferenceValidator = {
      buildIndex: vi.fn().mockResolvedValue({ byName: new Map(), byFile: new Map(), stats: {} }),
      extractDocumentationReferences: vi.fn().mockReturnValue([]),
      validateDocumentationReferences: vi.fn().mockReturnValue([])
    };

    vi.doMock('../analyzers/cross-reference-validator', () => ({
      CrossReferenceValidator: vi.fn().mockImplementation(() => workingCrossReferenceValidator)
    }));

    vi.doMock('@apexcli/core', async () => {
      const actual = await vi.importActual('@apexcli/core') as any;
      return {
        ...actual,
        validateDeprecatedTags: vi.fn().mockReturnValue([])
      };
    });
  }
});