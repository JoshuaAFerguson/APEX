/**
 * Auto-Fix ApexOrchestrator Integration Tests
 *
 * Tests the actual implementation of auto-fix event emission in ApexOrchestrator.
 * Validates that the orchestrator correctly emits standardized auto-fix events
 * during real workflow execution scenarios.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApexOrchestrator } from '../index';
import { ImportAutoFixer } from '../import-auto-fixer/import-auto-fixer';
import type {
  Task,
  WorkflowStage,
  AutoFixEvent,
  AutoFixStageConfig,
  OrchestratorConfig,
} from '@apexcli/core';
import * as fs from 'fs/promises';

// Mock dependencies
vi.mock('fs/promises');
vi.mock('../import-auto-fixer/import-auto-fixer');
vi.mock('child_process');

const mockFs = vi.mocked(fs);
const MockImportAutoFixer = vi.mocked(ImportAutoFixer);

describe('Auto-Fix ApexOrchestrator Integration Tests', () => {
  let orchestrator: ApexOrchestrator;
  let projectPath: string;
  let capturedEvents: Array<{ eventType: string; payload: AutoFixEvent }>;

  beforeEach(async () => {
    vi.clearAllMocks();
    capturedEvents = [];
    projectPath = '/test/project';

    // Mock file system
    mockFs.readFile.mockImplementation(async (filePath: any) => {
      if (filePath.includes('package.json')) {
        return JSON.stringify({
          name: 'test-project',
          version: '1.0.0',
          dependencies: { react: '^18.0.0', typescript: '^5.0.0' }
        });
      }
      if (filePath.includes('config.yaml')) {
        return `
project:
  name: test-project
codeQuality:
  autoFix:
    enabled: true
    triggerStages: ["implementation", "testing"]
    fileExtensions: [".ts", ".tsx", ".js", ".jsx"]
    maxFilesPerStage: 5
`;
      }
      return 'mock file content';
    });

    mockFs.writeFile.mockResolvedValue();
    mockFs.mkdir.mockResolvedValue();
    mockFs.access.mockResolvedValue();
    mockFs.stat.mockResolvedValue({ isDirectory: () => false } as any);

    // Create orchestrator with comprehensive auto-fix config
    const config: Partial<OrchestratorConfig> = {
      codeQuality: {
        autoFix: {
          enabled: true,
          triggerStages: ['implementation', 'testing'],
          triggerAgents: ['developer', 'tester'],
          fileExtensions: ['.ts', '.tsx', '.js', '.jsx'],
          maxFilesPerStage: 5,
          skipOnStageFailure: false,
        } satisfies AutoFixStageConfig
      }
    };

    orchestrator = new ApexOrchestrator({ projectPath: projectPath, ...config });
    await orchestrator.initialize();

    // Set up comprehensive event capture
    const eventTypes = ['auto-fix-start', 'auto-fix-progress', 'auto-fix-complete', 'auto-fix-error'];
    eventTypes.forEach(eventType => {
      orchestrator.on(eventType, (payload: AutoFixEvent) => {
        capturedEvents.push({ eventType, payload });
      });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    orchestrator?.removeAllListeners();
  });

  describe('Full Workflow Integration', () => {
    it('should emit complete event lifecycle for successful auto-fix workflow', async () => {
      const task = await createTestTask();
      const stage: WorkflowStage = {
        name: 'implementation',
        agent: 'developer',
        outputs: ['code_changes', 'files_modified'],
        description: 'Implement React component with hooks'
      };

      // Mock successful auto-fix workflow
      const mockFixer = createMockAutoFixer({
        files: [
          {
            filePath: '/src/components/Button.tsx',
            success: true,
            importsAdded: [
              { identifier: 'React', source: 'react', originalIdentifier: 'React', importType: 'default' },
              { identifier: 'useState', source: 'react', originalIdentifier: 'useState', importType: 'named' },
              { identifier: 'useEffect', source: 'react', originalIdentifier: 'useEffect', importType: 'named' }
            ]
          }
        ],
        summary: {
          totalFiles: 1,
          successCount: 1,
          errorCount: 0,
          totalImports: 3,
          duration: 2500
        }
      });

      MockImportAutoFixer.mockImplementation(() => mockFixer);

      // Mock tool action store with modified files
      (orchestrator as any).toolActionStore = {
        getToolActions: vi.fn().mockResolvedValue([
          {
            stageName: 'implementation',
            modifiedFiles: ['/src/components/Button.tsx']
          }
        ])
      };

      // Execute the stage
      await (orchestrator as any).executeStage(task.id, stage);

      // Verify complete event lifecycle
      expect(capturedEvents).toHaveLength(3);

      // Check event sequence
      expect(capturedEvents[0].eventType).toBe('auto-fix-start');
      expect(capturedEvents[1].eventType).toBe('auto-fix-progress');
      expect(capturedEvents[2].eventType).toBe('auto-fix-complete');

      // Verify start event
      const startEvent = capturedEvents[0].payload;
      expect(startEvent.taskId).toBe(task.id);
      expect(startEvent.filesModified).toEqual([]);
      expect(startEvent.issuesFixed).toEqual([]);
      expect(startEvent.iterationCount).toBe(0);
      expect(startEvent.currentFile).toBe('/src/components/Button.tsx');
      expect(startEvent.status).toBe('running');

      // Verify progress event
      const progressEvent = capturedEvents[1].payload;
      expect(progressEvent.taskId).toBe(task.id);
      expect(progressEvent.filesModified).toEqual(['/src/components/Button.tsx']);
      expect(progressEvent.issuesFixed).toHaveLength(3);
      expect(progressEvent.iterationCount).toBe(1);
      expect(progressEvent.status).toBe('running');

      // Verify complete event
      const completeEvent = capturedEvents[2].payload;
      expect(completeEvent.taskId).toBe(task.id);
      expect(completeEvent.filesModified).toEqual(['/src/components/Button.tsx']);
      expect(completeEvent.issuesFixed).toHaveLength(3);
      expect(completeEvent.status).toBe('success');
      expect(completeEvent.metadata?.duration).toBe(2500);
      expect(completeEvent.metadata?.totalImports).toBe(3);
    });

    it('should emit error event when auto-fix fails', async () => {
      const task = await createTestTask();
      const stage: WorkflowStage = {
        name: 'implementation',
        agent: 'developer',
        outputs: ['code_changes'],
        description: 'Implement feature with broken syntax'
      };

      // Mock auto-fixer that encounters errors
      const mockFixer = createMockAutoFixer({
        throwError: new Error('TypeScript compilation failed: Unexpected token')
      });

      MockImportAutoFixer.mockImplementation(() => mockFixer);

      // Mock tool action store
      (orchestrator as any).toolActionStore = {
        getToolActions: vi.fn().mockResolvedValue([
          {
            stageName: 'implementation',
            modifiedFiles: ['/src/broken.ts']
          }
        ])
      };

      // Execute the stage
      await (orchestrator as any).executeStage(task.id, stage);

      // Verify error event sequence
      expect(capturedEvents).toHaveLength(2);
      expect(capturedEvents[0].eventType).toBe('auto-fix-start');
      expect(capturedEvents[1].eventType).toBe('auto-fix-error');

      // Verify error event details
      const errorEvent = capturedEvents[1].payload;
      expect(errorEvent.taskId).toBe(task.id);
      expect(errorEvent.currentFile).toBe('/src/broken.ts');
      expect(errorEvent.status).toBe('failed');
      expect(errorEvent.error).toBe('TypeScript compilation failed: Unexpected token');
      expect(errorEvent.metadata?.errorType).toBe('ServiceError');
    });

    it('should handle multiple files with mixed success/failure', async () => {
      const task = await createTestTask();
      const stage: WorkflowStage = {
        name: 'implementation',
        agent: 'developer',
        outputs: ['code_changes'],
        description: 'Implement multiple components'
      };

      // Mock auto-fixer with mixed results
      const mockFixer = createMockAutoFixer({
        files: [
          {
            filePath: '/src/components/Header.tsx',
            success: true,
            importsAdded: [
              { identifier: 'React', source: 'react', originalIdentifier: 'React', importType: 'default' }
            ]
          },
          {
            filePath: '/src/components/Footer.tsx',
            success: false,
            errorMessage: 'Cannot resolve module path'
          },
          {
            filePath: '/src/utils/helpers.ts',
            success: true,
            importsAdded: [
              { identifier: 'lodash', source: 'lodash', originalIdentifier: '_', importType: 'default' }
            ]
          }
        ],
        summary: {
          totalFiles: 3,
          successCount: 2,
          errorCount: 1,
          totalImports: 2,
          duration: 3000
        }
      });

      MockImportAutoFixer.mockImplementation(() => mockFixer);

      // Mock tool action store with multiple files
      (orchestrator as any).toolActionStore = {
        getToolActions: vi.fn().mockResolvedValue([
          {
            stageName: 'implementation',
            modifiedFiles: ['/src/components/Header.tsx', '/src/components/Footer.tsx', '/src/utils/helpers.ts']
          }
        ])
      };

      // Execute the stage
      await (orchestrator as any).executeStage(task.id, stage);

      // Should have start, then progress/complete/error for each file
      expect(capturedEvents.length).toBeGreaterThan(3);
      expect(capturedEvents[0].eventType).toBe('auto-fix-start');

      // Check that we have both complete and error events
      const completeEvents = capturedEvents.filter(e => e.eventType === 'auto-fix-complete');
      const errorEvents = capturedEvents.filter(e => e.eventType === 'auto-fix-error');
      const progressEvents = capturedEvents.filter(e => e.eventType === 'auto-fix-progress');

      expect(completeEvents.length).toBe(2); // Header.tsx and helpers.ts
      expect(errorEvents.length).toBe(1); // Footer.tsx
      expect(progressEvents.length).toBe(2); // Only successful files emit progress

      // Verify error event for Footer.tsx
      const footerErrorEvent = errorEvents.find(e => e.payload.currentFile === '/src/components/Footer.tsx');
      expect(footerErrorEvent).toBeDefined();
      expect(footerErrorEvent!.payload.error).toBe('Cannot resolve module path');
    });
  });

  describe('Event Payload Validation', () => {
    it('should emit events with proper AutoFixEvent schema compliance', async () => {
      const task = await createTestTask();
      const stage: WorkflowStage = {
        name: 'testing',
        agent: 'tester',
        outputs: ['test_files'],
        description: 'Create test files'
      };

      const mockFixer = createMockAutoFixer({
        files: [{
          filePath: '/src/tests/Button.test.tsx',
          success: true,
          importsAdded: [
            { identifier: '@testing-library/react', source: '@testing-library/react', originalIdentifier: 'render', importType: 'named' }
          ]
        }],
        summary: { totalFiles: 1, successCount: 1, errorCount: 0, duration: 1000 }
      });

      MockImportAutoFixer.mockImplementation(() => mockFixer);

      (orchestrator as any).toolActionStore = {
        getToolActions: vi.fn().mockResolvedValue([
          {
            stageName: 'testing',
            modifiedFiles: ['/src/tests/Button.test.tsx']
          }
        ])
      };

      await (orchestrator as any).executeStage(task.id, stage);

      // Validate every event against AutoFixEvent schema requirements
      capturedEvents.forEach(({ payload }) => {
        // Required string fields
        expect(typeof payload.id).toBe('string');
        expect(payload.id.length).toBeGreaterThan(0);
        expect(typeof payload.taskId).toBe('string');
        expect(payload.taskId).toBe(task.id);
        expect(typeof payload.currentFile).toBe('string');
        expect(payload.currentFile.length).toBeGreaterThan(0);

        // Required enum fields
        expect(['auto-fix-start', 'auto-fix-progress', 'auto-fix-complete', 'auto-fix-error']).toContain(payload.eventType);
        expect(['running', 'success', 'failed']).toContain(payload.status);

        // Required array fields
        expect(Array.isArray(payload.filesModified)).toBe(true);
        expect(Array.isArray(payload.issuesFixed)).toBe(true);

        // Required number fields
        expect(typeof payload.iterationCount).toBe('number');
        expect(payload.iterationCount).toBeGreaterThanOrEqual(0);
        expect(typeof payload.totalIterations).toBe('number');
        expect(payload.totalIterations).toBeGreaterThanOrEqual(1);

        // Required date field
        expect(payload.timestamp).toBeInstanceOf(Date);

        // Validate issues fixed structure when present
        payload.issuesFixed.forEach(issue => {
          expect(typeof issue.type).toBe('string');
          expect(typeof issue.description).toBe('string');
          expect(typeof issue.filePath).toBe('string');
          expect(typeof issue.line).toBe('number');
          expect(typeof issue.column).toBe('number');
          if (issue.severity) {
            expect(['error', 'warning', 'info']).toContain(issue.severity);
          }
        });
      });
    });

    it('should generate unique event IDs for concurrent operations', async () => {
      const task1 = await createTestTask('task-1');
      const task2 = await createTestTask('task-2');

      const stage: WorkflowStage = {
        name: 'implementation',
        agent: 'developer',
        outputs: ['code_changes'],
        description: 'Concurrent implementation'
      };

      const mockFixer = createMockAutoFixer({
        files: [{ filePath: '/src/test.ts', success: true, importsAdded: [] }],
        summary: { totalFiles: 1, successCount: 1, errorCount: 0, duration: 500 }
      });

      MockImportAutoFixer.mockImplementation(() => mockFixer);

      (orchestrator as any).toolActionStore = {
        getToolActions: vi.fn().mockResolvedValue([
          { stageName: 'implementation', modifiedFiles: ['/src/test.ts'] }
        ])
      };

      // Execute both tasks
      await Promise.all([
        (orchestrator as any).executeStage(task1.id, stage),
        (orchestrator as any).executeStage(task2.id, stage)
      ]);

      // Verify all event IDs are unique
      const eventIds = capturedEvents.map(e => e.payload.id);
      const uniqueIds = new Set(eventIds);
      expect(uniqueIds.size).toBe(eventIds.length);

      // Verify events for both tasks are present
      const task1Events = capturedEvents.filter(e => e.payload.taskId === 'task-1');
      const task2Events = capturedEvents.filter(e => e.payload.taskId === 'task-2');
      expect(task1Events.length).toBeGreaterThan(0);
      expect(task2Events.length).toBeGreaterThan(0);
    });
  });

  describe('Event Timing and Order', () => {
    it('should emit events in chronological order', async () => {
      const task = await createTestTask();
      const stage: WorkflowStage = {
        name: 'implementation',
        agent: 'developer',
        outputs: ['code_changes'],
        description: 'Timed implementation'
      };

      const mockFixer = createMockAutoFixer({
        files: [{ filePath: '/src/test.ts', success: true, importsAdded: [] }],
        summary: { totalFiles: 1, successCount: 1, errorCount: 0, duration: 1000 },
        delay: 100 // Add artificial delay to test timing
      });

      MockImportAutoFixer.mockImplementation(() => mockFixer);

      (orchestrator as any).toolActionStore = {
        getToolActions: vi.fn().mockResolvedValue([
          { stageName: 'implementation', modifiedFiles: ['/src/test.ts'] }
        ])
      };

      await (orchestrator as any).executeStage(task.id, stage);

      // Verify timestamps are in chronological order
      const timestamps = capturedEvents.map(e => e.payload.timestamp.getTime());
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
      }

      // Verify logical event progression
      const eventTypes = capturedEvents.map(e => e.eventType);
      expect(eventTypes[0]).toBe('auto-fix-start');
      expect(eventTypes[eventTypes.length - 1]).toBe('auto-fix-complete');
    });
  });

  // Helper functions
  async function createTestTask(taskId = 'test-task-integration'): Promise<Task> {
    const task: Task = {
      id: taskId,
      title: `Test Auto-Fix Integration - ${taskId}`,
      description: 'Integration test for auto-fix event emission',
      workflow: 'feature',
      status: 'running',
      currentStage: 0,
      stages: [],
      results: [],
      usage: { totalTokens: 0, totalCost: 0 },
      createdAt: new Date(),
      updatedAt: new Date(),
      startedAt: new Date(),
      branch: 'test-branch',
      gitCommit: 'abc123def'
    };

    await (orchestrator as any).store.createTask(task);
    return task;
  }

  function createMockAutoFixer(options: {
    files?: Array<{
      filePath: string;
      success: boolean;
      importsAdded?: Array<{ identifier: string; source: string; originalIdentifier: string; importType: string }>;
      errorMessage?: string;
    }>;
    summary?: {
      totalFiles: number;
      successCount: number;
      errorCount: number;
      totalImports?: number;
      duration: number;
    };
    throwError?: Error;
    delay?: number;
  } = {}) {
    const { files = [], summary, throwError, delay = 0 } = options;

    return {
      isAvailable: vi.fn().mockResolvedValue(true),
      fix: vi.fn().mockImplementation(async () => {
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        if (throwError) {
          throw throwError;
        }

        return files.map(file => ({
          success: file.success,
          filePath: file.filePath,
          importsAdded: file.importsAdded || [],
          errorMessage: file.errorMessage || null
        }));
      }),
      getSummary: vi.fn().mockReturnValue(summary || {
        totalFiles: files.length,
        successCount: files.filter(f => f.success).length,
        errorCount: files.filter(f => !f.success).length,
        totalImports: files.reduce((sum, f) => sum + (f.importsAdded?.length || 0), 0),
        duration: 1000
      })
    };
  }
});