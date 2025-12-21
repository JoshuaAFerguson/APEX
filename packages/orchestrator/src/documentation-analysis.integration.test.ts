/**
 * Documentation Analysis Integration Tests
 *
 * End-to-end integration tests for the complete documentation analysis workflow,
 * including IdleProcessor analysis, DocsAnalyzer task generation, and
 * IdleTaskGenerator integration with enhanced documentation metrics.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { IdleProcessor } from './idle-processor';
import { IdleTaskGenerator } from './idle-task-generator';
import { DocsAnalyzer } from './analyzers/docs-analyzer';
import { TaskStore } from './store';
import type { DaemonConfig, ApexConfig } from '@apexcli/core';

// Mock filesystem and child_process
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
  },
}));

vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

describe('Documentation Analysis Integration', () => {
  let idleProcessor: IdleProcessor;
  let idleTaskGenerator: IdleTaskGenerator;
  let docsAnalyzer: DocsAnalyzer;
  let mockTaskStore: TaskStore;
  let mockConfig: DaemonConfig;
  const testProjectPath = '/test/project';

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock configuration
    mockConfig = {
      pollInterval: 5000,
      autoStart: false,
      logLevel: 'info',
      idleProcessing: {
        enabled: true,
        idleThreshold: 300000,
        taskGenerationInterval: 3600000,
        maxIdleTasks: 5,
        strategyWeights: {
          maintenance: 0.2,
          refactoring: 0.2,
          docs: 0.4, // Higher weight for docs in these tests
          tests: 0.2
        }
      }
    };

    // Mock TaskStore
    mockTaskStore = {
      getTasksByStatus: vi.fn().mockResolvedValue([]),
      getAllTasks: vi.fn().mockResolvedValue([]),
      createTask: vi.fn().mockImplementation((req) => ({
        id: 'task_' + Math.random().toString(36).substr(2, 9),
        ...req,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        retryCount: 0,
        maxRetries: 3,
        resumeAttempts: 0,
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0 },
        logs: [],
        artifacts: []
      })),
    } as any;

    idleProcessor = new IdleProcessor(testProjectPath, mockConfig, mockTaskStore);
    idleTaskGenerator = new IdleTaskGenerator(mockConfig.idleProcessing?.strategyWeights);
    docsAnalyzer = new DocsAnalyzer();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Full Workflow Integration Tests
  // ============================================================================

  describe('complete documentation analysis workflow', () => {
    it('should perform end-to-end analysis and generate documentation tasks', async () => {
      // Setup comprehensive mock project data
      await setupMockProjectWithDocumentationIssues();

      // Trigger the full analysis
      const processor = idleProcessor as any;
      const analysis = await processor.analyzeProject();

      // Validate enhanced documentation analysis structure
      expect(analysis.documentation).toHaveProperty('coverage');
      expect(analysis.documentation).toHaveProperty('missingDocs');
      expect(analysis.documentation).toHaveProperty('undocumentedExports');
      expect(analysis.documentation).toHaveProperty('outdatedDocs');
      expect(analysis.documentation).toHaveProperty('missingReadmeSections');
      expect(analysis.documentation).toHaveProperty('apiCompleteness');

      // Enhanced fields should contain actual data
      expect(analysis.documentation.undocumentedExports).toBeInstanceOf(Array);
      expect(analysis.documentation.outdatedDocs).toBeInstanceOf(Array);
      expect(analysis.documentation.missingReadmeSections).toBeInstanceOf(Array);
      expect(typeof analysis.documentation.apiCompleteness).toBe('object');

      // Use DocsAnalyzer to generate tasks from the analysis
      const candidates = docsAnalyzer.analyze(analysis);

      // Should generate meaningful documentation tasks
      expect(candidates.length).toBeGreaterThan(0);

      // Validate generated candidates
      candidates.forEach(candidate => {
        expect(candidate.candidateId).toMatch(/^docs-/);
        expect(candidate.suggestedWorkflow).toBe('documentation');
        expect(['low', 'normal', 'high']).toContain(candidate.priority);
        expect(['low', 'medium', 'high']).toContain(candidate.estimatedEffort);
        expect(candidate.score).toBeGreaterThan(0);
        expect(candidate.score).toBeLessThanOrEqual(1);
        expect(candidate.title).toBeTruthy();
        expect(candidate.description).toBeTruthy();
        expect(candidate.rationale).toBeTruthy();
      });
    });

    it('should integrate with IdleTaskGenerator weighted selection', async () => {
      await setupMockProjectWithDocumentationIssues();

      const processor = idleProcessor as any;
      const analysis = await processor.analyzeProject();

      // Generate tasks using the IdleTaskGenerator
      const tasks = [];
      for (let i = 0; i < 3; i++) {
        const task = idleTaskGenerator.generateTask(analysis);
        if (task) {
          tasks.push(task);
        }
      }

      // With docs weight at 0.4, should generate some documentation tasks
      expect(tasks.length).toBeGreaterThan(0);

      // At least some tasks should be documentation-related
      const docsTasks = tasks.filter(t =>
        t.type === 'documentation' || t.suggestedWorkflow === 'documentation'
      );
      expect(docsTasks.length).toBeGreaterThan(0);

      // Validate task structure
      docsTasks.forEach(task => {
        expect(task.id).toBeTruthy();
        expect(task.title).toBeTruthy();
        expect(task.description).toBeTruthy();
        expect(task.rationale).toBeTruthy();
        expect(['low', 'medium', 'high']).toContain(task.estimatedEffort);
        expect(['low', 'normal', 'high', 'urgent']).toContain(task.priority);
        expect(task.createdAt).toBeInstanceOf(Date);
        expect(task.implemented).toBe(false);
      });
    });

    it('should handle projects with excellent documentation gracefully', async () => {
      await setupMockProjectWithExcellentDocumentation();

      const processor = idleProcessor as any;
      const analysis = await processor.analyzeProject();

      // Should show high coverage
      expect(analysis.documentation.coverage).toBeGreaterThan(80);
      expect(analysis.documentation.missingDocs.length).toBeLessThan(3);
      expect(analysis.documentation.apiCompleteness.percentage).toBeGreaterThan(85);

      // DocsAnalyzer should generate few or no tasks
      const candidates = docsAnalyzer.analyze(analysis);
      expect(candidates.length).toBeLessThanOrEqual(1);

      // IdleTaskGenerator should prefer other types of tasks
      const tasks = [];
      for (let i = 0; i < 5; i++) {
        const task = idleTaskGenerator.generateTask(analysis);
        if (task) {
          tasks.push(task);
        }
      }

      // Should generate tasks, but preferably not docs tasks
      if (tasks.length > 0) {
        const docsTasks = tasks.filter(t => t.type === 'documentation');
        expect(docsTasks.length).toBeLessThanOrEqual(tasks.length * 0.5);
      }
    });

    it('should prioritize critical documentation issues appropriately', async () => {
      await setupMockProjectWithCriticalDocumentationIssues();

      const processor = idleProcessor as any;
      const analysis = await processor.analyzeProject();

      // Should have critical documentation metrics
      expect(analysis.documentation.coverage).toBeLessThan(20);
      expect(analysis.documentation.undocumentedExports.length).toBeGreaterThan(5);
      expect(analysis.documentation.apiCompleteness.percentage).toBeLessThan(30);

      // DocsAnalyzer should generate high-priority tasks
      const candidates = docsAnalyzer.analyze(analysis);
      expect(candidates.length).toBeGreaterThan(0);

      const highPriorityTasks = candidates.filter(c => c.priority === 'high');
      expect(highPriorityTasks.length).toBeGreaterThan(0);

      // Critical documentation task should have highest score
      const criticalTask = candidates.find(c => c.title.includes('Critical'));
      expect(criticalTask).toBeDefined();
      expect(criticalTask?.priority).toBe('high');
      expect(criticalTask?.score).toBeGreaterThan(0.8);

      // IdleTaskGenerator should heavily favor docs tasks
      const tasks = [];
      for (let i = 0; i < 5; i++) {
        const task = idleTaskGenerator.generateTask(analysis);
        if (task) {
          tasks.push(task);
        }
      }

      if (tasks.length > 0) {
        const docsTasks = tasks.filter(t => t.type === 'documentation');
        expect(docsTasks.length).toBeGreaterThan(0);
      }
    });
  });

  // ============================================================================
  // Error Handling and Edge Cases
  // ============================================================================

  describe('error handling and edge cases', () => {
    it('should handle filesystem errors gracefully during analysis', async () => {
      // Make filesystem operations fail
      const { exec } = await import('child_process');
      const mockExec = exec as any;
      mockExec.mockImplementation((command: string, options: any, callback: any) => {
        callback(new Error('Filesystem error'), null);
      });

      const mockReadFile = fs.readFile as any;
      mockReadFile.mockRejectedValue(new Error('Cannot read file'));

      // Should not crash and return default structure
      const processor = idleProcessor as any;
      const analysis = await processor.analyzeProject();

      expect(analysis.documentation).toEqual({
        coverage: 0,
        missingDocs: [],
        undocumentedExports: [],
        outdatedDocs: [],
        missingReadmeSections: [],
        apiCompleteness: {
          percentage: 0,
          details: {
            totalEndpoints: 0,
            documentedEndpoints: 0,
            undocumentedItems: [],
            wellDocumentedExamples: [],
            commonIssues: []
          }
        }
      });

      // DocsAnalyzer should handle empty analysis
      const candidates = docsAnalyzer.analyze(analysis);
      expect(Array.isArray(candidates)).toBe(true);
    });

    it('should handle malformed source files during export analysis', async () => {
      const { exec } = await import('child_process');
      const mockExec = exec as any;

      // Mock finding files
      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: './src/malformed.ts\n', stderr: '' });
      });

      // Mock malformed file content
      const mockReadFile = fs.readFile as any;
      mockReadFile.mockResolvedValueOnce(`
// Malformed TypeScript file with syntax errors
export function incompleteFunction(
// Missing closing parenthesis and body

export class {
  // Missing class name
}

export // Incomplete export statement
      `);

      // Should handle parsing errors gracefully
      const processor = idleProcessor as any;
      const undocumentedExports = await processor.findUndocumentedExports();

      expect(Array.isArray(undocumentedExports)).toBe(true);
      // Should return empty array or handle gracefully, not crash
    });

    it('should handle empty project with no source files', async () => {
      const { exec } = await import('child_process');
      const mockExec = exec as any;

      // Mock empty project
      mockExec.mockImplementation((command: string, options: any, callback: any) => {
        if (command.includes('find')) {
          callback(null, { stdout: '', stderr: '' });
        } else if (command.includes('wc -l')) {
          callback(null, { stdout: '0\n', stderr: '' });
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      const processor = idleProcessor as any;
      const analysis = await processor.analyzeProject();

      // Should handle empty project gracefully
      expect(analysis.codebaseSize.files).toBe(0);
      expect(analysis.codebaseSize.lines).toBe(0);
      expect(analysis.documentation.coverage).toBe(0);
      expect(analysis.documentation.undocumentedExports).toHaveLength(0);

      // DocsAnalyzer should not generate tasks for empty project
      const candidates = docsAnalyzer.analyze(analysis);
      expect(candidates).toHaveLength(0);
    });

    it('should handle projects with only test files', async () => {
      const { exec } = await import('child_process');
      const mockExec = exec as any;

      // Mock project with only test files
      mockExec
        .mockImplementationOnce((command: string, options: any, callback: any) => {
          if (command.includes('find') && command.includes('ts')) {
            callback(null, { stdout: './src/app.test.ts\n./src/utils.spec.ts\n', stderr: '' });
          }
        })
        .mockImplementationOnce((command: string, options: any, callback: any) => {
          if (command.includes('find') && !command.includes('test')) {
            callback(null, { stdout: '', stderr: '' }); // No non-test files
          }
        });

      const mockReadFile = fs.readFile as any;
      mockReadFile
        .mockResolvedValueOnce('// test file content')
        .mockResolvedValueOnce('// spec file content');

      const processor = idleProcessor as any;
      const analysis = await processor.analyzeProject();

      // Should indicate need for source files documentation
      expect(analysis.documentation.undocumentedExports).toHaveLength(0);
      expect(analysis.documentation.apiCompleteness.details.totalEndpoints).toBe(0);

      // DocsAnalyzer might not generate tasks since there are no source files to document
      const candidates = docsAnalyzer.analyze(analysis);
      // Could be empty or have README-related tasks
      expect(Array.isArray(candidates)).toBe(true);
    });
  });

  // ============================================================================
  // Performance and Scalability Tests
  // ============================================================================

  describe('performance and scalability', () => {
    it('should handle large codebases efficiently', async () => {
      // Mock large project with many files
      const largeFileList = Array.from({ length: 100 }, (_, i) => `./src/file${i}.ts`).join('\n');

      const { exec } = await import('child_process');
      const mockExec = exec as any;

      mockExec
        .mockImplementationOnce((command: string, options: any, callback: any) => {
          callback(null, { stdout: largeFileList, stderr: '' });
        });

      // Mock file reading to return reasonable content
      const mockReadFile = fs.readFile as any;
      mockReadFile.mockImplementation(() => Promise.resolve(`
export function testFunction() {
  return 'test';
}

/**
 * Documented function
 */
export function documentedFunction() {
  return 'documented';
}
      `));

      const processor = idleProcessor as any;

      const startTime = Date.now();
      const undocumentedExports = await processor.findUndocumentedExports();
      const endTime = Date.now();

      // Should complete in reasonable time (under 5 seconds for 100 files)
      expect(endTime - startTime).toBeLessThan(5000);

      // Should limit results to reasonable number
      expect(undocumentedExports.length).toBeLessThanOrEqual(50);

      // Results should be valid
      undocumentedExports.forEach((item: any) => {
        expect(item.file).toBeTruthy();
        expect(item.name).toBeTruthy();
        expect(item.type).toBeTruthy();
        expect(typeof item.line).toBe('number');
        expect(typeof item.isPublic).toBe('boolean');
      });
    });

    it('should limit analysis scope to prevent performance issues', async () => {
      // Mock project with excessive number of documentation files
      const manyDocFiles = Array.from({ length: 50 }, (_, i) => `./docs/file${i}.md`).join('\n');

      const { exec } = await import('child_process');
      const mockExec = exec as any;

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: manyDocFiles, stderr: '' });
      });

      const mockReadFile = fs.readFile as any;
      mockReadFile.mockImplementation(() => Promise.resolve(`
# Documentation

This API is @deprecated.
Version 1.0.0 is referenced here.
      `));

      const processor = idleProcessor as any;
      const outdatedDocs = await processor.findOutdatedDocumentation();

      // Should limit results even with many input files
      expect(outdatedDocs.length).toBeLessThanOrEqual(30);

      // Results should be valid
      outdatedDocs.forEach((item: any) => {
        expect(item.file).toBeTruthy();
        expect(item.type).toBeTruthy();
        expect(item.description).toBeTruthy();
        expect(['low', 'medium', 'high']).toContain(item.severity);
      });
    });
  });

  // ============================================================================
  // Helper Functions
  // ============================================================================

  async function setupMockProjectWithDocumentationIssues() {
    const { exec } = await import('child_process');
    const mockExec = exec as any;

    // Mock project structure analysis
    mockExec
      // Codebase size analysis
      .mockImplementationOnce((command: string, options: any, callback: any) => {
        if (command.includes('find') && command.includes('ts')) {
          callback(null, {
            stdout: './src/utils.ts\n./src/api.ts\n./src/core.ts\n./src/main.ts\n./src/service.ts\n',
            stderr: ''
          });
        }
      })
      // Documentation coverage
      .mockImplementationOnce((command: string, options: any, callback: any) => {
        if (command.includes('md')) {
          callback(null, { stdout: '1\n', stderr: '' }); // Low doc count
        }
      })
      .mockImplementationOnce((command: string, options: any, callback: any) => {
        if (command.includes('ts') && command.includes('wc')) {
          callback(null, { stdout: '5\n', stderr: '' }); // Source file count
        }
      })
      // Undocumented files
      .mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, {
          stdout: './src/utils.ts\n./src/api.ts\n./src/core.ts\n./src/main.ts\n',
          stderr: ''
        });
      })
      // README files
      .mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: '', stderr: '' }); // No README
      });

    // Mock file reading for export analysis
    const mockReadFile = fs.readFile as any;
    mockReadFile
      .mockResolvedValue(`
export function undocumentedFunction() {
  return 'no docs';
}

/**
 * Documented function
 */
export function documentedFunction() {
  return 'has docs';
}

export class UndocumentedClass {
  method() {}
}
      `);
  }

  async function setupMockProjectWithExcellentDocumentation() {
    const { exec } = await import('child_process');
    const mockExec = exec as any;

    mockExec
      // High documentation file count
      .mockImplementationOnce((command: string, options: any, callback: any) => {
        if (command.includes('md') || command.includes('doc')) {
          callback(null, { stdout: '8\n', stderr: '' });
        }
      })
      // Source file count
      .mockImplementationOnce((command: string, options: any, callback: any) => {
        if (command.includes('ts') && command.includes('wc')) {
          callback(null, { stdout: '8\n', stderr: '' });
        }
      })
      // Very few undocumented files
      .mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: './src/helper.ts\n', stderr: '' });
      })
      // README exists
      .mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: './README.md\n', stderr: '' });
      });

    const mockReadFile = fs.readFile as any;
    mockReadFile
      .mockResolvedValueOnce(`
/**
 * Well documented function
 * @param data Input data
 * @returns Processed result
 * @example
 * const result = processData({ id: 1 });
 */
export function processData(data: any) {
  return data;
}
      `)
      .mockResolvedValueOnce(`
# Excellent Project

Complete description here.

## Installation
npm install

## Usage
How to use this

## API Reference
Complete API docs

## Contributing
How to contribute

## License
MIT License

## Testing
How to run tests
      `);
  }

  async function setupMockProjectWithCriticalDocumentationIssues() {
    const { exec } = await import('child_process');
    const mockExec = exec as any;

    mockExec
      // Very low documentation coverage
      .mockImplementationOnce((command: string, options: any, callback: any) => {
        if (command.includes('md')) {
          callback(null, { stdout: '0\n', stderr: '' }); // No docs
        }
      })
      .mockImplementationOnce((command: string, options: any, callback: any) => {
        if (command.includes('ts')) {
          callback(null, { stdout: '15\n', stderr: '' }); // Many source files
        }
      })
      // Many undocumented files
      .mockImplementationOnce((command: string, options: any, callback: any) => {
        const manyFiles = Array.from({ length: 12 }, (_, i) => `./src/file${i}.ts`).join('\n');
        callback(null, { stdout: manyFiles, stderr: '' });
      })
      // No README
      .mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: '', stderr: '' });
      });

    const mockReadFile = fs.readFile as any;
    mockReadFile.mockResolvedValue(`
// Critical file with no documentation
export function criticalFunction() {
  return 'critical';
}

export class CriticalClass {
  method() {}
}

export interface CriticalInterface {
  prop: string;
}
    `);
  }
});