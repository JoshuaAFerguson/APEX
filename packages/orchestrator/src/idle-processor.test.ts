import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IdleProcessor, IdleTask, ProjectAnalysis } from './idle-processor';
import { TaskStore } from './store';
import { DaemonConfig, Task, TaskStatus } from '@apexcli/core';
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

describe('IdleProcessor', () => {
  let idleProcessor: IdleProcessor;
  let mockStore: TaskStore;
  let mockConfig: DaemonConfig;
  let mockProjectPath: string;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockProjectPath = '/test/project';
    mockConfig = {
      idleProcessing: {
        enabled: true,
        idleThreshold: 300000, // 5 minutes
        taskGenerationInterval: 3600000, // 1 hour
        maxIdleTasks: 3,
      },
    };

    mockStore = {
      createTask: vi.fn(),
      getTasksByStatus: vi.fn(),
      getAllTasks: vi.fn(),
    } as any;

    idleProcessor = new IdleProcessor(mockProjectPath, mockConfig, mockStore);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('start', () => {
    it('should not start when idle processing is disabled', async () => {
      mockConfig.idleProcessing!.enabled = false;
      idleProcessor = new IdleProcessor(mockProjectPath, mockConfig, mockStore);

      const spy = vi.spyOn(idleProcessor, 'processIdleTime');
      await idleProcessor.start();

      expect(spy).not.toHaveBeenCalled();
    });

    it('should set up idle detection when enabled', async () => {
      vi.mocked(mockStore.getTasksByStatus).mockResolvedValue([]);
      vi.mocked(mockStore.getAllTasks).mockResolvedValue([
        {
          id: 'task1',
          completedAt: new Date(Date.now() - 400000), // 6+ minutes ago
        } as Task,
      ]);

      await idleProcessor.start();

      // Fast forward past idle threshold
      vi.advanceTimersByTime(60000); // Check interval

      // Should have detected idle time and started processing
      expect(mockStore.getTasksByStatus).toHaveBeenCalledWith('in-progress');
    });
  });

  describe('processIdleTime', () => {
    beforeEach(() => {
      // Mock exec commands
      const mockExec = vi.fn();
      mockExec.mockImplementation((command: string, options: any) => {
        const callback = arguments[2] || arguments[1];

        if (command.includes('find . -type f')) {
          callback(null, { stdout: './src/file1.ts\n./src/file2.js\n' });
        } else if (command.includes('wc -l')) {
          callback(null, { stdout: '100' });
        } else if (command.includes('package.json')) {
          callback(null, { stdout: '' });
        } else {
          callback(null, { stdout: '' });
        }
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      // Mock file system
      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        if (path.includes('package.json')) {
          return Promise.resolve(JSON.stringify({
            dependencies: { 'old-lib': '^0.1.0' },
            devDependencies: { 'test-lib': '~0.5.0' },
          }));
        }
        return Promise.resolve('line 1\nline 2\nline 3\n');
      });
    });

    it('should perform project analysis and generate tasks', async () => {
      const analysisStartedSpy = vi.fn();
      const analysisCompletedSpy = vi.fn();
      const tasksGeneratedSpy = vi.fn();
      const taskSuggestedSpy = vi.fn();

      idleProcessor.on('analysis:started', analysisStartedSpy);
      idleProcessor.on('analysis:completed', analysisCompletedSpy);
      idleProcessor.on('tasks:generated', tasksGeneratedSpy);
      idleProcessor.on('task:suggested', taskSuggestedSpy);

      await idleProcessor.processIdleTime();

      expect(analysisStartedSpy).toHaveBeenCalled();
      expect(analysisCompletedSpy).toHaveBeenCalled();
      expect(tasksGeneratedSpy).toHaveBeenCalled();
      expect(taskSuggestedSpy).toHaveBeenCalled();

      const analysis = idleProcessor.getLastAnalysis();
      expect(analysis).toBeDefined();
      expect(analysis?.codebaseSize.files).toBeGreaterThan(0);
    });

    it('should not process if already processing', async () => {
      const processingPromise1 = idleProcessor.processIdleTime();
      const processingPromise2 = idleProcessor.processIdleTime();

      await Promise.all([processingPromise1, processingPromise2]);

      // Second call should return immediately
      expect(processingPromise2).resolves.toBeUndefined();
    });
  });

  describe('project analysis', () => {
    beforeEach(() => {
      // Mock successful exec commands
      const mockExec = vi.fn().mockImplementation((command: string, options: any) => {
        const callback = arguments[2] || arguments[1];

        if (command.includes('find . -type f')) {
          callback(null, { stdout: './src/component.ts\n./src/utils.js\n./test/component.test.ts\n' });
        } else if (command.includes('*.test.*')) {
          callback(null, { stdout: '1' });
        } else if (command.includes('eslint')) {
          callback(null, { stdout: JSON.stringify([
            { errorCount: 2, warningCount: 3 },
            { errorCount: 1, warningCount: 0 },
          ]) });
        } else if (command.includes('wc -l')) {
          callback(null, { stdout: '150' });
        } else if (command.includes('xargs wc -l')) {
          callback(null, { stdout: '600 ./large-file.ts\n200 ./small-file.ts\n800 total' });
        } else {
          callback(null, { stdout: '' });
        }
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        if (path.includes('package.json')) {
          return Promise.resolve(JSON.stringify({
            dependencies: { 'react': '^18.0.0', 'old-lib': '^0.1.0' },
            devDependencies: { 'typescript': '^5.0.0', 'old-test': '~0.5.0' },
          }));
        }
        return Promise.resolve('line 1\nline 2\nline 3\n');
      });
    });

    it('should analyze codebase size correctly', async () => {
      await idleProcessor.processIdleTime();

      const analysis = idleProcessor.getLastAnalysis();
      expect(analysis?.codebaseSize.files).toBeGreaterThan(0);
      expect(analysis?.codebaseSize.languages).toHaveProperty('ts');
      expect(analysis?.codebaseSize.languages).toHaveProperty('js');
    });

    it('should calculate test coverage', async () => {
      await idleProcessor.processIdleTime();

      const analysis = idleProcessor.getLastAnalysis();
      expect(analysis?.testCoverage).toBeDefined();
      expect(analysis?.testCoverage?.percentage).toBeGreaterThan(0);
      expect(analysis?.testCoverage?.uncoveredFiles).toBeDefined();
    });

    it('should identify outdated dependencies', async () => {
      await idleProcessor.processIdleTime();

      const analysis = idleProcessor.getLastAnalysis();
      expect(analysis?.dependencies.outdated.length).toBeGreaterThan(0);
      expect(analysis?.dependencies.outdated).toContain('old-lib@^0.1.0');
      expect(analysis?.dependencies.outdated).toContain('old-test@~0.5.0');
    });

    it('should analyze code quality', async () => {
      await idleProcessor.processIdleTime();

      const analysis = idleProcessor.getLastAnalysis();
      expect(analysis?.codeQuality.lintIssues).toBe(6); // 2+3+1+0
      expect(analysis?.codeQuality.complexityHotspots).toContain('./large-file.ts');
    });

    it('should analyze documentation coverage', async () => {
      await idleProcessor.processIdleTime();

      const analysis = idleProcessor.getLastAnalysis();
      expect(analysis?.documentation.coverage).toBeDefined();
      expect(analysis?.documentation.missingDocs).toBeDefined();
    });
  });

  describe('task generation', () => {
    let mockAnalysis: ProjectAnalysis;

    beforeEach(() => {
      mockAnalysis = {
        codebaseSize: { files: 10, lines: 1000, languages: { ts: 8, js: 2 } },
        testCoverage: { percentage: 45, uncoveredFiles: ['src/utils.ts'] },
        dependencies: {
          outdated: ['old-lib@^0.1.0', 'outdated-dep@^0.2.0'],
          security: []
        },
        codeQuality: {
          lintIssues: 75,
          duplicatedCode: [],
          complexityHotspots: ['src/complex.ts']
        },
        documentation: { coverage: 30, missingDocs: ['src/core.ts'] },
        performance: {
          slowTests: ['test/slow.test.ts'],
          bottlenecks: ['src/heavy.ts']
        },
      };

      // Mock successful project analysis
      const mockExec = vi.fn().mockResolvedValue({ stdout: '', stderr: '' });
      const childProcess = require('child_process');
      childProcess.exec = mockExec;
    });

    it('should generate test coverage improvement task', async () => {
      const processorWithMockAnalysis = Object.create(idleProcessor);
      processorWithMockAnalysis.lastAnalysis = mockAnalysis;

      await processorWithMockAnalysis.processIdleTime();

      const tasks = idleProcessor.getGeneratedTasks();
      const testCoverageTask = tasks.find(t => t.type === 'improvement' && t.title.includes('Test Coverage'));

      expect(testCoverageTask).toBeDefined();
      expect(testCoverageTask?.description).toContain('45.0%');
      expect(testCoverageTask?.priority).toBe('normal');
    });

    it('should generate documentation improvement task', async () => {
      const processorWithMockAnalysis = Object.create(idleProcessor);
      processorWithMockAnalysis.lastAnalysis = mockAnalysis;

      await processorWithMockAnalysis.processIdleTime();

      const tasks = idleProcessor.getGeneratedTasks();
      const docTask = tasks.find(t => t.type === 'documentation');

      expect(docTask).toBeDefined();
      expect(docTask?.title).toBe('Add Missing Documentation');
      expect(docTask?.priority).toBe('low');
    });

    it('should generate dependency update task', async () => {
      const processorWithMockAnalysis = Object.create(idleProcessor);
      processorWithMockAnalysis.lastAnalysis = mockAnalysis;

      await processorWithMockAnalysis.processIdleTime();

      const tasks = idleProcessor.getGeneratedTasks();
      const depTask = tasks.find(t => t.type === 'maintenance');

      expect(depTask).toBeDefined();
      expect(depTask?.description).toContain('2 outdated dependencies');
      expect(depTask?.priority).toBe('normal');
    });

    it('should generate lint fixing task', async () => {
      const processorWithMockAnalysis = Object.create(idleProcessor);
      processorWithMockAnalysis.lastAnalysis = mockAnalysis;

      await processorWithMockAnalysis.processIdleTime();

      const tasks = idleProcessor.getGeneratedTasks();
      const lintTask = tasks.find(t => t.title.includes('Linting Issues'));

      expect(lintTask).toBeDefined();
      expect(lintTask?.description).toContain('75 linting issues');
    });

    it('should generate performance optimization task', async () => {
      const processorWithMockAnalysis = Object.create(idleProcessor);
      processorWithMockAnalysis.lastAnalysis = mockAnalysis;

      await processorWithMockAnalysis.processIdleTime();

      const tasks = idleProcessor.getGeneratedTasks();
      const perfTask = tasks.find(t => t.type === 'optimization');

      expect(perfTask).toBeDefined();
      expect(perfTask?.estimatedEffort).toBe('high');
    });

    it('should prioritize security updates', async () => {
      mockAnalysis.dependencies.security = ['vulnerable-lib@1.0.0'];

      const processorWithMockAnalysis = Object.create(idleProcessor);
      processorWithMockAnalysis.lastAnalysis = mockAnalysis;

      await processorWithMockAnalysis.processIdleTime();

      const tasks = idleProcessor.getGeneratedTasks();
      const depTask = tasks.find(t => t.type === 'maintenance');

      expect(depTask?.priority).toBe('high');
    });
  });

  describe('implementIdleTask', () => {
    let mockIdleTask: IdleTask;

    beforeEach(() => {
      mockIdleTask = {
        id: 'idle-123-test-task',
        type: 'improvement',
        title: 'Test Task',
        description: 'A test improvement task',
        priority: 'normal',
        estimatedEffort: 'medium',
        suggestedWorkflow: 'testing',
        rationale: 'For testing purposes',
        createdAt: new Date(),
        implemented: false,
      };
    });

    it('should convert idle task to real task', async () => {
      const mockTask = { id: 'real-task-456' } as Task;
      vi.mocked(mockStore.createTask).mockResolvedValue(mockTask);

      // Add idle task to processor
      idleProcessor['generatedTasks'].set(mockIdleTask.id, mockIdleTask);

      const realTaskId = await idleProcessor.implementIdleTask(mockIdleTask.id);

      expect(realTaskId).toBe('real-task-456');
      expect(mockStore.createTask).toHaveBeenCalledWith({
        description: mockIdleTask.description,
        acceptanceCriteria: `Implement ${mockIdleTask.title}. ${mockIdleTask.rationale}`,
        workflow: mockIdleTask.suggestedWorkflow,
        priority: mockIdleTask.priority,
        projectPath: mockProjectPath,
      });

      // Idle task should be marked as implemented
      const updatedIdleTask = idleProcessor['generatedTasks'].get(mockIdleTask.id);
      expect(updatedIdleTask?.implemented).toBe(true);
    });

    it('should throw error for non-existent idle task', async () => {
      await expect(idleProcessor.implementIdleTask('non-existent')).rejects.toThrow(
        'Idle task non-existent not found'
      );
    });

    it('should throw error for already implemented task', async () => {
      mockIdleTask.implemented = true;
      idleProcessor['generatedTasks'].set(mockIdleTask.id, mockIdleTask);

      await expect(idleProcessor.implementIdleTask(mockIdleTask.id)).rejects.toThrow(
        `Idle task ${mockIdleTask.id} has already been implemented`
      );
    });
  });

  describe('dismissIdleTask', () => {
    it('should remove idle task from suggestions', () => {
      const mockIdleTask: IdleTask = {
        id: 'idle-123-test',
        type: 'improvement',
        title: 'Test Task',
        description: 'Test description',
        priority: 'normal',
        estimatedEffort: 'low',
        suggestedWorkflow: 'testing',
        rationale: 'Test rationale',
        createdAt: new Date(),
        implemented: false,
      };

      idleProcessor['generatedTasks'].set(mockIdleTask.id, mockIdleTask);
      expect(idleProcessor.getGeneratedTasks()).toHaveLength(1);

      idleProcessor.dismissIdleTask(mockIdleTask.id);
      expect(idleProcessor.getGeneratedTasks()).toHaveLength(0);
    });
  });

  describe('getLastActivityTime', () => {
    it('should return current time when tasks are in progress', async () => {
      vi.mocked(mockStore.getTasksByStatus).mockResolvedValue([
        { id: 'active-task', status: 'in-progress' } as Task,
      ]);

      // Access private method for testing
      const lastActivity = await idleProcessor['getLastActivityTime']();
      const timeDiff = Math.abs(Date.now() - lastActivity.getTime());

      expect(timeDiff).toBeLessThan(100); // Should be very recent
    });

    it('should return last completed task time when no active tasks', async () => {
      const completedTime = new Date(Date.now() - 3600000); // 1 hour ago

      vi.mocked(mockStore.getTasksByStatus).mockResolvedValue([]);
      vi.mocked(mockStore.getAllTasks).mockResolvedValue([
        { id: 'completed-task', completedAt: completedTime } as Task,
      ]);

      const lastActivity = await idleProcessor['getLastActivityTime']();

      expect(lastActivity).toEqual(completedTime);
    });

    it('should return default time when no tasks exist', async () => {
      vi.mocked(mockStore.getTasksByStatus).mockResolvedValue([]);
      vi.mocked(mockStore.getAllTasks).mockResolvedValue([]);

      const lastActivity = await idleProcessor['getLastActivityTime']();
      const timeDiff = Date.now() - lastActivity.getTime();

      expect(timeDiff).toBeGreaterThan(86400000 - 1000); // ~24 hours ago
    });
  });

  describe('error handling', () => {
    it('should handle exec command failures gracefully', async () => {
      const mockExec = vi.fn().mockRejectedValue(new Error('Command failed'));
      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      await expect(idleProcessor.processIdleTime()).resolves.toBeUndefined();

      const analysis = idleProcessor.getLastAnalysis();
      expect(analysis?.codebaseSize.files).toBe(0);
    });

    it('should handle file read failures gracefully', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));

      const mockExec = vi.fn().mockResolvedValue({ stdout: 'file1.ts\n', stderr: '' });
      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      await idleProcessor.processIdleTime();

      const analysis = idleProcessor.getLastAnalysis();
      expect(analysis?.dependencies.outdated).toHaveLength(0);
    });
  });

  describe('configuration handling', () => {
    it('should respect maxIdleTasks limit', async () => {
      mockConfig.idleProcessing!.maxIdleTasks = 1;
      idleProcessor = new IdleProcessor(mockProjectPath, mockConfig, mockStore);

      // Generate multiple tasks
      const mockAnalysis: ProjectAnalysis = {
        codebaseSize: { files: 10, lines: 1000, languages: { ts: 10 } },
        testCoverage: { percentage: 30, uncoveredFiles: [] },
        dependencies: { outdated: ['old-lib@0.1.0'], security: [] },
        codeQuality: { lintIssues: 100, duplicatedCode: [], complexityHotspots: [] },
        documentation: { coverage: 20, missingDocs: [] },
        performance: { slowTests: [], bottlenecks: ['slow-file.ts'] },
      };

      idleProcessor['lastAnalysis'] = mockAnalysis;
      await idleProcessor['generateImprovementTasks']();

      expect(idleProcessor.getGeneratedTasks()).toHaveLength(1);
    });

    it('should use default thresholds when config is missing', () => {
      const minimalConfig: DaemonConfig = {
        idleProcessing: { enabled: true },
      };

      const processor = new IdleProcessor(mockProjectPath, minimalConfig, mockStore);
      expect(processor).toBeDefined();
    });
  });
});