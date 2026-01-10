/**
 * Auto-Fix Execution Hook Integration Tests
 *
 * Tests the integration between ApexOrchestrator and AutoFixService for the
 * auto-fix execution hook feature. Validates that auto-fix is properly triggered
 * after code generation workflow stages and integrates with stage results.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApexOrchestrator } from '../index';
import { TaskStore } from '../store';
import { ImportAutoFixer } from '../import-auto-fixer/import-auto-fixer';
import type {
  Task,
  WorkflowStage,
  StageResult,
  AutoFixStageResults,
  AutoFixStageConfig,
  OrchestratorConfig,
} from '@apexcli/core';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock dependencies
vi.mock('fs/promises');
vi.mock('../import-auto-fixer/import-auto-fixer');
vi.mock('child_process');

const mockFs = vi.mocked(fs);
const MockImportAutoFixer = vi.mocked(ImportAutoFixer);

describe('Auto-Fix Execution Hook Integration', () => {
  let orchestrator: ApexOrchestrator;
  let mockStore: TaskStore;
  let projectPath: string;

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();

    projectPath = '/test/project';

    // Mock file system
    mockFs.readFile.mockImplementation(async (filePath: any) => {
      if (filePath.includes('package.json')) {
        return JSON.stringify({
          name: 'test-project',
          version: '1.0.0',
          dependencies: { react: '^18.0.0' }
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
`;
      }
      return 'mock file content';
    });

    mockFs.writeFile.mockResolvedValue();
    mockFs.mkdir.mockResolvedValue();
    mockFs.access.mockResolvedValue();
    mockFs.stat.mockResolvedValue({ isDirectory: () => false } as any);

    // Create orchestrator with auto-fix enabled config
    const config: Partial<OrchestratorConfig> = {
      codeQuality: {
        autoFix: {
          enabled: true,
          triggerStages: ['implementation', 'testing'],
          triggerAgents: ['developer', 'tester'],
          fileExtensions: ['.ts', '.tsx', '.js', '.jsx'],
          maxFilesPerStage: 10,
          skipOnStageFailure: false,
        } satisfies AutoFixStageConfig
      }
    };

    orchestrator = new ApexOrchestrator(projectPath, config);
    await orchestrator.initialize();
    mockStore = (orchestrator as any).store;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Auto-Fix Detection and Triggering', () => {
    it('should detect code generation stages that should trigger auto-fix', () => {
      const developerStage: WorkflowStage = {
        name: 'implementation',
        agent: 'developer',
        outputs: ['code_changes', 'files_modified'],
        description: 'Implement the feature'
      };

      const testerStage: WorkflowStage = {
        name: 'testing',
        agent: 'tester',
        outputs: ['test_files'],
        description: 'Create tests'
      };

      const plannerStage: WorkflowStage = {
        name: 'planning',
        agent: 'planner',
        outputs: ['plan', 'requirements'],
        description: 'Plan the work'
      };

      // Import the function to test it
      const { isCodeGenerationStage } = require('../prompts');

      expect(isCodeGenerationStage(developerStage)).toBe(true);
      expect(isCodeGenerationStage(testerStage)).toBe(true);
      expect(isCodeGenerationStage(plannerStage)).toBe(false);
    });

    it('should trigger auto-fix when stage configuration matches', async () => {
      const task = await createTestTask();
      const stage: WorkflowStage = {
        name: 'implementation',
        agent: 'developer',
        outputs: ['code_changes'],
        description: 'Implement feature'
      };

      // Mock the orchestrator's executeAutoFixForStage method
      const executeAutoFixSpy = vi.spyOn(orchestrator as any, 'executeAutoFixForStage');
      executeAutoFixSpy.mockResolvedValue({
        applied: true,
        filesProcessed: ['src/test.ts'],
        filesModified: ['src/test.ts'],
        totalImportsAdded: 2,
        totalDuration: 1000,
        details: 'Auto-fix applied successfully',
        summary: 'Added 2 imports to 1 file'
      } satisfies AutoFixStageResults);

      // Execute stage
      await (orchestrator as any).executeStage(task.id, stage);

      // Verify auto-fix was called
      expect(executeAutoFixSpy).toHaveBeenCalledWith(
        task.id,
        stage,
        expect.objectContaining({
          stageName: 'implementation',
          status: 'completed'
        })
      );
    });

    it('should skip auto-fix when disabled in configuration', async () => {
      // Create orchestrator with auto-fix disabled
      const disabledConfig: Partial<OrchestratorConfig> = {
        codeQuality: {
          autoFix: {
            enabled: false,
          } satisfies Partial<AutoFixStageConfig>
        }
      };

      const disabledOrchestrator = new ApexOrchestrator(projectPath, disabledConfig);
      await disabledOrchestrator.initialize();

      const task = await createTestTask(disabledOrchestrator);
      const stage: WorkflowStage = {
        name: 'implementation',
        agent: 'developer',
        outputs: ['code_changes'],
        description: 'Implement feature'
      };

      const executeAutoFixSpy = vi.spyOn(disabledOrchestrator as any, 'executeAutoFixForStage');

      await (disabledOrchestrator as any).executeStage(task.id, stage);

      // Should still be called but return early with applied: false
      expect(executeAutoFixSpy).toHaveBeenCalled();
      const result = await executeAutoFixSpy.mock.results[0].value;
      expect(result.applied).toBe(false);
      expect(result.summary).toContain('disabled');
    });
  });

  describe('Auto-Fix Service Integration', () => {
    it('should create ImportAutoFixer with correct configuration', async () => {
      const task = await createTestTask();
      const stage: WorkflowStage = {
        name: 'implementation',
        agent: 'developer',
        outputs: ['code_changes'],
        description: 'Implement feature'
      };

      // Mock git status to return modified files
      vi.doMock('child_process', () => ({
        exec: vi.fn((cmd, callback) => {
          if (cmd.includes('git status --porcelain')) {
            callback(null, { stdout: 'M  src/test.ts\nA  src/new.ts' });
          }
        })
      }));

      // Mock ImportAutoFixer
      const mockFixer = {
        isAvailable: vi.fn().mockResolvedValue(true),
        fix: vi.fn().mockResolvedValue([
          {
            success: true,
            filePath: 'src/test.ts',
            importsAdded: [
              {
                identifier: 'React',
                source: 'react',
                originalIdentifier: 'React',
                importType: 'default'
              }
            ],
            errorMessage: null
          }
        ]),
        getSummary: vi.fn().mockReturnValue({
          totalFiles: 1,
          successCount: 1,
          errorCount: 0,
          totalImports: 1,
          duration: 500
        })
      };

      MockImportAutoFixer.mockImplementation(() => mockFixer as any);

      await (orchestrator as any).executeStage(task.id, stage);

      // Verify ImportAutoFixer was created with correct options
      expect(MockImportAutoFixer).toHaveBeenCalledWith({
        projectPath: projectPath,
        detector: 'auto'
      });

      // Verify auto-fix methods were called
      expect(mockFixer.isAvailable).toHaveBeenCalled();
      expect(mockFixer.fix).toHaveBeenCalledWith(['src/test.ts', 'src/new.ts']);
      expect(mockFixer.getSummary).toHaveBeenCalled();
    });

    it('should handle auto-fix service unavailable gracefully', async () => {
      const task = await createTestTask();
      const stage: WorkflowStage = {
        name: 'implementation',
        agent: 'developer',
        outputs: ['code_changes'],
        description: 'Implement feature'
      };

      // Mock ImportAutoFixer as unavailable
      const mockFixer = {
        isAvailable: vi.fn().mockResolvedValue(false),
        fix: vi.fn(),
        getSummary: vi.fn()
      };

      MockImportAutoFixer.mockImplementation(() => mockFixer as any);

      const result = await (orchestrator as any).executeAutoFixForStage(task.id, stage, {} as StageResult);

      expect(result.applied).toBe(false);
      expect(result.summary).toContain('not available');
      expect(mockFixer.isAvailable).toHaveBeenCalled();
      expect(mockFixer.fix).not.toHaveBeenCalled();
    });

    it('should handle auto-fix errors gracefully', async () => {
      const task = await createTestTask();
      const stage: WorkflowStage = {
        name: 'implementation',
        agent: 'developer',
        outputs: ['code_changes'],
        description: 'Implement feature'
      };

      // Mock ImportAutoFixer to throw error
      const mockFixer = {
        isAvailable: vi.fn().mockResolvedValue(true),
        fix: vi.fn().mockRejectedValue(new Error('Auto-fix failed')),
        getSummary: vi.fn()
      };

      MockImportAutoFixer.mockImplementation(() => mockFixer as any);

      const result = await (orchestrator as any).executeAutoFixForStage(task.id, stage, {} as StageResult);

      expect(result.applied).toBe(false);
      expect(result.errorMessage).toContain('Auto-fix failed');
      expect(result.filesProcessed).toEqual([]);
    });
  });

  describe('Event Emission', () => {
    it('should emit correct auto-fix events during execution', async () => {
      const task = await createTestTask();
      const stage: WorkflowStage = {
        name: 'implementation',
        agent: 'developer',
        outputs: ['code_changes'],
        description: 'Implement feature'
      };

      // Capture emitted events
      const events: Array<{ event: string; data: any }> = [];

      orchestrator.on('autofix:requested', (data) => events.push({ event: 'autofix:requested', data }));
      orchestrator.on('autofix:completed', (data) => events.push({ event: 'autofix:completed', data }));
      orchestrator.on('autofix:failed', (data) => events.push({ event: 'autofix:failed', data }));
      orchestrator.on('autofix:skipped', (data) => events.push({ event: 'autofix:skipped', data }));

      // Mock successful auto-fix
      const mockFixer = {
        isAvailable: vi.fn().mockResolvedValue(true),
        fix: vi.fn().mockResolvedValue([
          {
            success: true,
            filePath: 'src/test.ts',
            importsAdded: [{ identifier: 'React', source: 'react' }]
          }
        ]),
        getSummary: vi.fn().mockReturnValue({ totalFiles: 1, successCount: 1 })
      };

      MockImportAutoFixer.mockImplementation(() => mockFixer as any);

      await (orchestrator as any).executeStage(task.id, stage);

      // Verify events were emitted
      expect(events.some(e => e.event === 'autofix:requested')).toBe(true);
      expect(events.some(e => e.event === 'autofix:completed')).toBe(true);
    });

    it('should emit failed event when auto-fix fails', async () => {
      const task = await createTestTask();
      const stage: WorkflowStage = {
        name: 'implementation',
        agent: 'developer',
        outputs: ['code_changes'],
        description: 'Implement feature'
      };

      const events: Array<{ event: string; data: any }> = [];
      orchestrator.on('autofix:failed', (data) => events.push({ event: 'autofix:failed', data }));

      // Mock failed auto-fix
      const mockFixer = {
        isAvailable: vi.fn().mockResolvedValue(true),
        fix: vi.fn().mockResolvedValue([
          {
            success: false,
            filePath: 'src/test.ts',
            errorMessage: 'Import resolution failed'
          }
        ]),
        getSummary: vi.fn().mockReturnValue({ totalFiles: 1, errorCount: 1 })
      };

      MockImportAutoFixer.mockImplementation(() => mockFixer as any);

      await (orchestrator as any).executeStage(task.id, stage);

      expect(events.some(e => e.event === 'autofix:failed')).toBe(true);
      const failedEvent = events.find(e => e.event === 'autofix:failed');
      expect(failedEvent?.data.filePath).toBe('src/test.ts');
    });
  });

  describe('File Processing', () => {
    it('should correctly identify modified files from git status', async () => {
      const task = await createTestTask();
      const stage: WorkflowStage = {
        name: 'implementation',
        agent: 'developer',
        outputs: ['code_changes'],
        description: 'Implement feature'
      };

      // Mock git status output with various file states
      vi.doMock('child_process', () => ({
        exec: vi.fn((cmd, callback) => {
          if (cmd.includes('git status --porcelain')) {
            callback(null, { stdout: ' M src/modified.ts\nA  src/added.tsx\n?? src/untracked.js\nD  src/deleted.ts' });
          }
        })
      }));

      const mockFixer = {
        isAvailable: vi.fn().mockResolvedValue(true),
        fix: vi.fn().mockResolvedValue([]),
        getSummary: vi.fn().mockReturnValue({ totalFiles: 0 })
      };

      MockImportAutoFixer.mockImplementation(() => mockFixer as any);

      await (orchestrator as any).executeStage(task.id, stage);

      // Should process modified, added, and untracked files but not deleted files
      expect(mockFixer.fix).toHaveBeenCalledWith([
        'src/modified.ts',
        'src/added.tsx',
        'src/untracked.js'
      ]);
    });

    it('should filter files by configured extensions', async () => {
      const task = await createTestTask();
      const stage: WorkflowStage = {
        name: 'implementation',
        agent: 'developer',
        outputs: ['code_changes'],
        description: 'Implement feature'
      };

      // Mock git status with mixed file types
      vi.doMock('child_process', () => ({
        exec: vi.fn((cmd, callback) => {
          if (cmd.includes('git status --porcelain')) {
            callback(null, { stdout: 'A  src/code.ts\nA  src/test.py\nA  docs/readme.md\nA  src/component.tsx' });
          }
        })
      }));

      const mockFixer = {
        isAvailable: vi.fn().mockResolvedValue(true),
        fix: vi.fn().mockResolvedValue([]),
        getSummary: vi.fn().mockReturnValue({ totalFiles: 0 })
      };

      MockImportAutoFixer.mockImplementation(() => mockFixer as any);

      await (orchestrator as any).executeStage(task.id, stage);

      // Should only process TypeScript/JavaScript files based on configuration
      expect(mockFixer.fix).toHaveBeenCalledWith([
        'src/code.ts',
        'src/component.tsx'
      ]);
    });

    it('should respect maxFilesPerStage limit', async () => {
      // Create orchestrator with low file limit
      const limitedConfig: Partial<OrchestratorConfig> = {
        codeQuality: {
          autoFix: {
            enabled: true,
            maxFilesPerStage: 2
          } satisfies Partial<AutoFixStageConfig>
        }
      };

      const limitedOrchestrator = new ApexOrchestrator(projectPath, limitedConfig);
      await limitedOrchestrator.initialize();

      const task = await createTestTask(limitedOrchestrator);
      const stage: WorkflowStage = {
        name: 'implementation',
        agent: 'developer',
        outputs: ['code_changes'],
        description: 'Implement feature'
      };

      // Mock git status with many files
      vi.doMock('child_process', () => ({
        exec: vi.fn((cmd, callback) => {
          if (cmd.includes('git status --porcelain')) {
            callback(null, { stdout: 'A  file1.ts\nA  file2.ts\nA  file3.ts\nA  file4.ts\nA  file5.ts' });
          }
        })
      }));

      const mockFixer = {
        isAvailable: vi.fn().mockResolvedValue(true),
        fix: vi.fn().mockResolvedValue([]),
        getSummary: vi.fn().mockReturnValue({ totalFiles: 0 })
      };

      MockImportAutoFixer.mockImplementation(() => mockFixer as any);

      await (limitedOrchestrator as any).executeStage(task.id, stage);

      // Should only process up to maxFilesPerStage files
      expect(mockFixer.fix).toHaveBeenCalledWith(['file1.ts', 'file2.ts']);
    });
  });

  describe('Stage Result Integration', () => {
    it('should include auto-fix results in stage result', async () => {
      const task = await createTestTask();
      const stage: WorkflowStage = {
        name: 'implementation',
        agent: 'developer',
        outputs: ['code_changes'],
        description: 'Implement feature'
      };

      // Mock successful auto-fix
      const mockFixer = {
        isAvailable: vi.fn().mockResolvedValue(true),
        fix: vi.fn().mockResolvedValue([
          {
            success: true,
            filePath: 'src/test.ts',
            importsAdded: [
              { identifier: 'React', source: 'react' },
              { identifier: 'useState', source: 'react' }
            ]
          }
        ]),
        getSummary: vi.fn().mockReturnValue({
          totalFiles: 1,
          successCount: 1,
          errorCount: 0,
          totalImports: 2,
          duration: 1000
        })
      };

      MockImportAutoFixer.mockImplementation(() => mockFixer as any);

      // Execute stage and get result
      const stageResult = await (orchestrator as any).executeStage(task.id, stage);

      // Verify auto-fix results are included
      expect(stageResult.autoFixResults).toBeDefined();
      expect(stageResult.autoFixResults.applied).toBe(true);
      expect(stageResult.autoFixResults.filesProcessed).toEqual(['src/test.ts']);
      expect(stageResult.autoFixResults.filesModified).toEqual(['src/test.ts']);
      expect(stageResult.autoFixResults.totalImportsAdded).toBe(2);
      expect(stageResult.autoFixResults.totalDuration).toBe(1000);
    });

    it('should continue stage execution even if auto-fix fails', async () => {
      const task = await createTestTask();
      const stage: WorkflowStage = {
        name: 'implementation',
        agent: 'developer',
        outputs: ['code_changes'],
        description: 'Implement feature'
      };

      // Mock auto-fix failure
      MockImportAutoFixer.mockImplementation(() => {
        throw new Error('Auto-fix service crashed');
      });

      // Stage should still complete successfully
      const stageResult = await (orchestrator as any).executeStage(task.id, stage);

      expect(stageResult.status).toBe('completed');
      expect(stageResult.autoFixResults).toBeDefined();
      expect(stageResult.autoFixResults.applied).toBe(false);
      expect(stageResult.autoFixResults.errorMessage).toContain('Auto-fix service crashed');
    });
  });

  // Helper function to create test task
  async function createTestTask(orch: ApexOrchestrator = orchestrator): Promise<Task> {
    const task: Task = {
      id: 'test-task-1',
      title: 'Test Auto-Fix Feature',
      description: 'Test the auto-fix execution hook',
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
      gitCommit: 'abc123'
    };

    await (orch as any).store.createTask(task);
    return task;
  }
});