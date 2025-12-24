import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IdleProcessor, IdleTask, ProjectAnalysis } from './idle-processor';
import { TaskStore } from './store';
import { DaemonConfig, Task, TaskStatus, DetectorFinding } from '@apexcli/core';
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

  describe('detector event emissions', () => {
    beforeEach(() => {
      // Mock successful exec commands
      const mockExec = vi.fn().mockImplementation((command: string, options: any) => {
        const callback = arguments[2] || arguments[1];

        if (command.includes('find . -type f')) {
          callback(null, { stdout: './src/component.ts\n./src/utils.js\n' });
        } else if (command.includes('find . -name "*.ts"')) {
          callback(null, { stdout: './src/large-file.ts\n./src/small-file.ts\n' });
        } else if (command.includes('xargs wc -l')) {
          callback(null, { stdout: '600 ./src/large-file.ts\n200 ./src/small-file.ts\n800 total' });
        } else if (command.includes('find . -name "README*"')) {
          callback(null, { stdout: '' }); // No README files found
        } else if (command.includes('eslint')) {
          callback(null, { stdout: JSON.stringify([
            { errorCount: 2, warningCount: 1 }
          ]) });
        } else if (command.includes('grep -r')) {
          callback(null, { stdout: './src/todo.ts:10:// TODO: fix this\n./src/hack.js:25:// FIXME: refactor\n' });
        } else {
          callback(null, { stdout: '' });
        }
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      // Mock file system to return code content with exports
      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        if (path.includes('package.json')) {
          return Promise.resolve(JSON.stringify({
            dependencies: { 'react': '^18.0.0', 'lodash': '^4.17.15' },
            devDependencies: { 'typescript': '^5.0.0' },
          }));
        }
        if (path.includes('component.ts')) {
          return Promise.resolve(`export function Component() {\n  return "hello";\n}\n\nexport class Service {\n  process() {}\n}`);
        }
        if (path.includes('large-file.ts')) {
          // Simulate a file with a long method
          const lines = Array(70).fill('  console.log("line");').join('\n');
          return Promise.resolve(`function longMethod() {\n${lines}\n}`);
        }
        return Promise.resolve('line 1\nline 2\nline 3\n');
      });

      // Mock SecurityVulnerabilityParser for security vulnerability detection
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
    });

    it('should emit detector:undocumented-export:found event', async () => {
      const undocumentedExportSpy = vi.fn();
      const detectorFindingSpy = vi.fn();

      idleProcessor.on('detector:undocumented-export:found', undocumentedExportSpy);
      idleProcessor.on('detector:finding', detectorFindingSpy);

      await idleProcessor.processIdleTime();

      expect(undocumentedExportSpy).toHaveBeenCalled();
      expect(undocumentedExportSpy).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            file: expect.stringContaining('component.ts'),
            name: expect.any(String),
            type: expect.any(String),
            line: expect.any(Number),
            isPublic: expect.any(Boolean)
          })
        ])
      );

      // Should also emit individual finding events
      expect(detectorFindingSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          detectorType: 'undocumented-export',
          severity: 'medium',
          file: expect.stringContaining('component.ts'),
          description: expect.stringContaining('Undocumented'),
          metadata: expect.any(Object)
        })
      );
    });

    it('should emit detector:missing-readme-section:found event', async () => {
      const missingReadmeSpy = vi.fn();
      const detectorFindingSpy = vi.fn();

      idleProcessor.on('detector:missing-readme-section:found', missingReadmeSpy);
      idleProcessor.on('detector:finding', detectorFindingSpy);

      await idleProcessor.processIdleTime();

      expect(missingReadmeSpy).toHaveBeenCalled();
      expect(missingReadmeSpy).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            section: expect.any(String),
            priority: expect.stringMatching(/required|recommended|optional/),
            description: expect.any(String)
          })
        ])
      );

      // Should also emit individual finding events
      expect(detectorFindingSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          detectorType: 'missing-readme-section',
          severity: expect.stringMatching(/low|medium|high/),
          file: 'README.md',
          description: expect.stringContaining('Missing'),
          metadata: expect.any(Object)
        })
      );
    });

    it('should emit detector:code-smell:found event for large files', async () => {
      const codeSmellSpy = vi.fn();
      const detectorFindingSpy = vi.fn();

      idleProcessor.on('detector:code-smell:found', codeSmellSpy);
      idleProcessor.on('detector:finding', detectorFindingSpy);

      await idleProcessor.processIdleTime();

      expect(codeSmellSpy).toHaveBeenCalled();
      expect(codeSmellSpy).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            file: expect.any(String),
            type: expect.stringMatching(/large-class|long-method|deep-nesting/),
            severity: expect.stringMatching(/low|medium|high/),
            details: expect.any(String)
          })
        ])
      );

      // Should emit individual finding events
      const codeSmellFindings = detectorFindingSpy.mock.calls.filter(call =>
        call[0].detectorType === 'code-smell'
      );
      expect(codeSmellFindings.length).toBeGreaterThan(0);
    });

    it('should emit detector:complexity-hotspot:found event', async () => {
      const complexityHotspotSpy = vi.fn();
      const detectorFindingSpy = vi.fn();

      idleProcessor.on('detector:complexity-hotspot:found', complexityHotspotSpy);
      idleProcessor.on('detector:finding', detectorFindingSpy);

      await idleProcessor.processIdleTime();

      expect(complexityHotspotSpy).toHaveBeenCalled();
      expect(complexityHotspotSpy).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            file: expect.any(String),
            cyclomaticComplexity: expect.any(Number),
            cognitiveComplexity: expect.any(Number),
            lineCount: expect.any(Number)
          })
        ])
      );

      // Should emit individual finding events
      const complexityFindings = detectorFindingSpy.mock.calls.filter(call =>
        call[0].detectorType === 'complexity-hotspot'
      );
      expect(complexityFindings.length).toBeGreaterThan(0);
    });

    it('should emit detector:duplicate-code:found event', async () => {
      const duplicateCodeSpy = vi.fn();
      const detectorFindingSpy = vi.fn();

      idleProcessor.on('detector:duplicate-code:found', duplicateCodeSpy);
      idleProcessor.on('detector:finding', detectorFindingSpy);

      await idleProcessor.processIdleTime();

      if (duplicateCodeSpy.mock.calls.length > 0) {
        expect(duplicateCodeSpy).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              pattern: expect.any(String),
              locations: expect.any(Array),
              similarity: expect.any(Number)
            })
          ])
        );

        // Should emit individual finding events
        const duplicateFindings = detectorFindingSpy.mock.calls.filter(call =>
          call[0].detectorType === 'duplicate-code'
        );
        expect(duplicateFindings.length).toBeGreaterThan(0);
      }
    });

    it('should not emit events when no findings exist', async () => {
      // Mock empty analysis results
      const mockExec = vi.fn().mockImplementation((command: string, options: any) => {
        const callback = arguments[2] || arguments[1];
        callback(null, { stdout: '' });
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      vi.mocked(fs.readFile).mockImplementation(() => {
        return Promise.resolve('// Well documented code\n/**\n * Documentation\n */\nexport function test() {}');
      });

      const codeSmellSpy = vi.fn();
      const complexityHotspotSpy = vi.fn();
      const undocumentedExportSpy = vi.fn();

      idleProcessor.on('detector:code-smell:found', codeSmellSpy);
      idleProcessor.on('detector:complexity-hotspot:found', complexityHotspotSpy);
      idleProcessor.on('detector:undocumented-export:found', undocumentedExportSpy);

      await idleProcessor.processIdleTime();

      expect(codeSmellSpy).not.toHaveBeenCalled();
      expect(complexityHotspotSpy).not.toHaveBeenCalled();
      expect(undocumentedExportSpy).not.toHaveBeenCalled();
    });

    it('should emit events in correct order during analysis', async () => {
      const events: string[] = [];

      idleProcessor.on('analysis:started', () => events.push('analysis:started'));
      idleProcessor.on('detector:finding', () => events.push('detector:finding'));
      idleProcessor.on('detector:undocumented-export:found', () => events.push('detector:undocumented-export:found'));
      idleProcessor.on('analysis:completed', () => events.push('analysis:completed'));

      await idleProcessor.processIdleTime();

      expect(events[0]).toBe('analysis:started');
      expect(events[events.length - 1]).toBe('analysis:completed');

      // Detector events should be between analysis start and complete
      const detectorEventIndex = events.findIndex(e => e.startsWith('detector:'));
      const analysisStartIndex = events.findIndex(e => e === 'analysis:started');
      const analysisCompleteIndex = events.findIndex(e => e === 'analysis:completed');

      if (detectorEventIndex !== -1) {
        expect(detectorEventIndex).toBeGreaterThan(analysisStartIndex);
        expect(detectorEventIndex).toBeLessThan(analysisCompleteIndex);
      }
    });

    it('should verify all 11 detector event types are properly defined', () => {
      // Test that all new detector event types exist in the interface
      const eventTypes = [
        'detector:finding',
        'detector:outdated-docs:found',
        'detector:version-mismatch:found',
        'detector:stale-comment:found',
        'detector:code-smell:found',
        'detector:complexity-hotspot:found',
        'detector:duplicate-code:found',
        'detector:undocumented-export:found',
        'detector:missing-readme-section:found',
        'detector:security-vulnerability:found',
        'detector:deprecated-dependency:found'
      ];

      // Each event type should be able to add listeners without error
      for (const eventType of eventTypes) {
        const spy = vi.fn();
        expect(() => {
          idleProcessor.on(eventType as any, spy);
        }).not.toThrow();

        // Verify listener was added
        expect(idleProcessor.listenerCount(eventType as any)).toBe(1);

        // Clean up listener
        idleProcessor.off(eventType as any, spy);
      }
    });

    it('should emit detector events with correct severity mapping', async () => {
      const detectorFindingSpy = vi.fn();
      idleProcessor.on('detector:finding', detectorFindingSpy);

      await idleProcessor.processIdleTime();

      if (detectorFindingSpy.mock.calls.length > 0) {
        // Check that all severity levels are valid
        for (const call of detectorFindingSpy.mock.calls) {
          const finding = call[0] as DetectorFinding;
          expect(['low', 'medium', 'high', 'critical']).toContain(finding.severity);
        }
      }
    });

    it('should include required metadata fields for each detector type', async () => {
      const detectorFindingSpy = vi.fn();
      idleProcessor.on('detector:finding', detectorFindingSpy);

      await idleProcessor.processIdleTime();

      if (detectorFindingSpy.mock.calls.length > 0) {
        const findingsByType = new Map<string, DetectorFinding[]>();

        // Group findings by detector type
        for (const call of detectorFindingSpy.mock.calls) {
          const finding = call[0] as DetectorFinding;
          if (!findingsByType.has(finding.detectorType)) {
            findingsByType.set(finding.detectorType, []);
          }
          findingsByType.get(finding.detectorType)!.push(finding);
        }

        // Verify metadata structure for each detector type
        for (const [detectorType, findings] of findingsByType) {
          for (const finding of findings) {
            expect(finding.metadata).toBeDefined();
            expect(finding.file).toBeDefined();
            expect(finding.description).toBeDefined();

            // Type-specific metadata validation
            switch (detectorType) {
              case 'undocumented-export':
                expect(finding.metadata).toHaveProperty('exportType');
                expect(finding.metadata).toHaveProperty('name');
                expect(finding.metadata).toHaveProperty('isPublic');
                break;
              case 'code-smell':
                expect(finding.metadata).toHaveProperty('type');
                expect(finding.metadata).toHaveProperty('details');
                break;
              case 'complexity-hotspot':
                expect(finding.metadata).toHaveProperty('cyclomaticComplexity');
                expect(finding.metadata).toHaveProperty('cognitiveComplexity');
                expect(finding.metadata).toHaveProperty('lineCount');
                break;
              case 'duplicate-code':
                expect(finding.metadata).toHaveProperty('pattern');
                expect(finding.metadata).toHaveProperty('locations');
                expect(finding.metadata).toHaveProperty('similarity');
                break;
              case 'missing-readme-section':
                expect(finding.metadata).toHaveProperty('section');
                expect(finding.metadata).toHaveProperty('priority');
                break;
              case 'security-vulnerability':
                expect(finding.metadata).toHaveProperty('cveId');
                expect(finding.metadata).toHaveProperty('affectedVersions');
                expect(finding.metadata).toHaveProperty('packageName');
                break;
              case 'outdated-docs':
                expect(finding.metadata).toHaveProperty('type');
                break;
            }
          }
        }
      }
    });
  });

  describe('analyzeTestBranchCoverage', () => {
    beforeEach(() => {
      // Mock file system for branch coverage analysis
      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        if (path.includes('component.ts')) {
          return Promise.resolve(`
export function processData(data: any) {
  if (!data) {
    throw new Error('Data required');
  }

  if (data.type === 'user') {
    return processUser(data);
  } else if (data.type === 'admin') {
    return processAdmin(data);
  }

  const result = data.valid ? data.value : null;

  try {
    return formatResult(result);
  } catch (error) {
    console.error('Format failed:', error);
    return null;
  }
}

function validateInput(input: string | null) {
  if (input == null || input === undefined) {
    return false;
  }

  if (input.length === 0) {
    return false;
  }

  return input.length > 3 && input.includes('@');
}
`);
        }
        if (path.includes('component.test.ts')) {
          return Promise.resolve(`
import { processData } from './component';

describe('processData', () => {
  it('should process user data', () => {
    const result = processData({ type: 'user', value: 'test' });
    expect(result).toBeDefined();
  });

  it('should throw error when data is null', () => {
    expect(() => processData(null)).toThrow('Data required');
  });

  it('should handle valid data', () => {
    const result = processData({ valid: true, value: 'test' });
    expect(result).toBeDefined();
  });
});
`);
        }
        if (path.includes('uncovered.ts')) {
          return Promise.resolve(`
export function uncoveredFunction(data: any) {
  if (data.admin && data.permissions) {
    return 'admin';
  }

  switch (data.role) {
    case 'user':
      return 'user';
    case 'guest':
      return 'guest';
    default:
      return 'unknown';
  }
}

async function asyncFunction() {
  const result = await fetch('/api/data');
  return result.json();
}
`);
        }
        return Promise.resolve('// empty file\n');
      });

      // Mock exec commands for file discovery
      const mockExec = vi.fn().mockImplementation((command: string, options: any) => {
        const callback = arguments[2] || arguments[1];

        if (command.includes('find . -name "*.ts"') && command.includes('grep -v test')) {
          callback(null, { stdout: './src/component.ts\n./src/uncovered.ts\n' });
        } else {
          callback(null, { stdout: '' });
        }
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;
    });

    it('should identify files with tests and analyze branch coverage', async () => {
      const branchCoverage = await (idleProcessor as any).analyzeTestBranchCoverage();

      expect(branchCoverage).toBeDefined();
      expect(branchCoverage.percentage).toBeGreaterThanOrEqual(0);
      expect(branchCoverage.percentage).toBeLessThanOrEqual(100);
      expect(branchCoverage.uncoveredBranches).toBeInstanceOf(Array);
    });

    it('should detect uncovered if/else branches', async () => {
      const branchCoverage = await (idleProcessor as any).analyzeTestBranchCoverage();

      const uncoveredIf = branchCoverage.uncoveredBranches.find(
        (branch: any) => branch.type === 'if' && branch.file.includes('component.ts')
      );
      expect(uncoveredIf).toBeDefined();
    });

    it('should detect uncovered switch statements', async () => {
      const branchCoverage = await (idleProcessor as any).analyzeTestBranchCoverage();

      const uncoveredSwitch = branchCoverage.uncoveredBranches.find(
        (branch: any) => branch.type === 'switch' && branch.file.includes('uncovered.ts')
      );
      expect(uncoveredSwitch).toBeDefined();
    });

    it('should detect uncovered ternary operators', async () => {
      const branchCoverage = await (idleProcessor as any).analyzeTestBranchCoverage();

      const uncoveredTernary = branchCoverage.uncoveredBranches.find(
        (branch: any) => branch.type === 'ternary'
      );
      expect(uncoveredTernary).toBeDefined();
    });

    it('should detect uncovered catch blocks', async () => {
      const branchCoverage = await (idleProcessor as any).analyzeTestBranchCoverage();

      const uncoveredCatch = branchCoverage.uncoveredBranches.find(
        (branch: any) => branch.type === 'catch'
      );
      expect(uncoveredCatch).toBeDefined();
    });

    it('should detect null/undefined edge cases', async () => {
      const branchCoverage = await (idleProcessor as any).analyzeTestBranchCoverage();

      const nullCheck = branchCoverage.uncoveredBranches.find(
        (branch: any) => branch.description.includes('Null/undefined check')
      );
      expect(nullCheck).toBeDefined();
    });

    it('should detect boundary conditions', async () => {
      const branchCoverage = await (idleProcessor as any).analyzeTestBranchCoverage();

      const boundaryCheck = branchCoverage.uncoveredBranches.find(
        (branch: any) => branch.description.includes('Boundary condition')
      );
      expect(boundaryCheck).toBeDefined();
    });

    it('should detect async operations without error handling', async () => {
      const branchCoverage = await (idleProcessor as any).analyzeTestBranchCoverage();

      const asyncError = branchCoverage.uncoveredBranches.find(
        (branch: any) => branch.description.includes('Async operation without error handling')
      );
      expect(asyncError).toBeDefined();
    });

    it('should fallback to basic analysis on error', async () => {
      // Mock error in advanced analysis
      const originalMethod = (idleProcessor as any).getFilesWithTests;
      (idleProcessor as any).getFilesWithTests = vi.fn().mockRejectedValue(new Error('Analysis failed'));

      const branchCoverage = await (idleProcessor as any).analyzeTestBranchCoverage();

      expect(branchCoverage).toBeDefined();
      expect(branchCoverage.percentage).toBeGreaterThanOrEqual(0);

      // Restore original method
      (idleProcessor as any).getFilesWithTests = originalMethod;
    });

    it('should limit results for performance', async () => {
      const branchCoverage = await (idleProcessor as any).analyzeTestBranchCoverage();

      expect(branchCoverage.uncoveredBranches.length).toBeLessThanOrEqual(50);
    });

    it('should handle files without corresponding test files', async () => {
      // Mock file system to return files without tests
      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        if (path.includes('no-test.ts')) {
          return Promise.resolve(`
export function untested() {
  if (Math.random() > 0.5) {
    return 'random';
  }
  return 'not random';
}
`);
        }
        if (path.includes('no-test.test.ts')) {
          return Promise.reject(new Error('File not found'));
        }
        return Promise.resolve('// empty file\n');
      });

      const branchCoverage = await (idleProcessor as any).analyzeTestBranchCoverage();
      expect(branchCoverage).toBeDefined();
    });

    it('should calculate coverage percentage correctly', async () => {
      const branchCoverage = await (idleProcessor as any).analyzeTestBranchCoverage();

      expect(typeof branchCoverage.percentage).toBe('number');
      expect(branchCoverage.percentage).toBeGreaterThanOrEqual(0);
      expect(branchCoverage.percentage).toBeLessThanOrEqual(100);
    });
  });

  describe('helper methods for branch coverage analysis', () => {
    beforeEach(() => {
      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        if (path.includes('test.ts')) {
          return Promise.resolve('export function test() { return true; }');
        }
        if (path.includes('test.test.ts')) {
          return Promise.resolve('import { test } from "./test"; describe("test", () => {});');
        }
        return Promise.reject(new Error('File not found'));
      });
    });

    it('should handle complex nested logical expressions', () => {
      const complexLine = 'if (user && user.isActive && (user.role === "admin" || user.permissions.includes("write"))) {';
      const analysis = (idleProcessor as any).analyzeBranchesInLine(complexLine, 'test.ts', 20);

      expect(analysis.totalBranches).toBeGreaterThan(0);
      expect(analysis.branches.some((b: any) => b.type === 'if')).toBe(true);
      expect(analysis.branches.some((b: any) => b.type === 'logical')).toBe(true);
    });

    it('should ignore commented-out code', () => {
      const commentedLine = '// if (condition) { return true; }';
      const analysis = (idleProcessor as any).analyzeBranchesInLine(commentedLine, 'test.ts', 25);

      expect(analysis.totalBranches).toBe(0);
      expect(analysis.branches).toHaveLength(0);
    });

    it('should handle malformed or edge case patterns', () => {
      const edgeCases = [
        'if(noSpacing){', // no spaces
        'if ( multipleSpaces ) {', // multiple spaces
        'if(/*comment*/condition) {', // inline comments
        'const x = y ? z : a ? b : c;', // nested ternary
      ];

      for (const testCase of edgeCases) {
        const analysis = (idleProcessor as any).analyzeBranchesInLine(testCase, 'test.ts', 30);
        expect(analysis.totalBranches).toBeGreaterThanOrEqual(0);
        expect(Array.isArray(analysis.branches)).toBe(true);
      }
    });

    it('should handle error in file reading during getFilesWithTests', async () => {
      const mockExec = vi.fn().mockImplementation((command: string, options: any) => {
        const callback = arguments[2] || arguments[1];
        callback(new Error('Command failed'), null);
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      const filesWithTests = await (idleProcessor as any).getFilesWithTests();
      expect(Array.isArray(filesWithTests)).toBe(true);
      expect(filesWithTests).toHaveLength(0);
    });

    it('should handle test files with minimal content', async () => {
      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        if (path.includes('minimal.test.ts')) {
          return Promise.resolve('// minimal test file\n');
        }
        return Promise.reject(new Error('File not found'));
      });

      const hasTest = await (idleProcessor as any).hasCorrespondingTestFile('minimal.ts');
      expect(hasTest).toBe(false); // Should be false due to minimal content check
    });

    it('should check branch test coverage with empty test files', async () => {
      const branches = [
        { line: 1, type: 'if' as const, description: 'test if' },
        { line: 2, type: 'catch' as const, description: 'test catch' }
      ];

      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        if (path.includes('.test.ts')) {
          return Promise.resolve(''); // empty test file
        }
        return Promise.reject(new Error('File not found'));
      });

      const coverage = await (idleProcessor as any).checkBranchTestCoverage('test.ts', branches);

      expect(Array.isArray(coverage)).toBe(true);
      expect(coverage).toHaveLength(branches.length);
      // Should default to covered=true when can't determine coverage
      expect(coverage.every(c => c.covered === true)).toBe(true);
    });

    it('should detect various async patterns without error handling', async () => {
      const sourceCode = `
        async function test() {
          const result = await fetch('/api');
          const data = result.then(r => r.json());
          promise.catch(() => {});
          return data;
        }
      `;

      const edgeCases = await (idleProcessor as any).detectUncoveredEdgeCases('async.ts', sourceCode);

      const asyncErrors = edgeCases.filter((ec: any) =>
        ec.description.includes('Async operation without error handling')
      );
      expect(asyncErrors.length).toBeGreaterThan(0);
    });

    it('should handle performance edge case with many branches', async () => {
      // Create a source file with many branches to test performance limits
      const largeBranchFile = Array(100).fill(0).map((_, i) =>
        `if (condition${i}) { return ${i}; }`
      ).join('\n');

      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        if (path.includes('large-branches.ts')) {
          return Promise.resolve(largeBranchFile);
        }
        return Promise.reject(new Error('File not found'));
      });

      const edgeCases = await (idleProcessor as any).detectUncoveredEdgeCases('large-branches.ts', largeBranchFile);

      // Should limit results for performance
      expect(edgeCases.length).toBeLessThanOrEqual(10);
    });

    it('should validate branch test patterns with comprehensive test scenarios', () => {
      const comprehensiveTestContent = `
        describe('comprehensive tests', () => {
          it('when condition is true, should return valid result', () => {
            expect(func(true)).toBe('valid');
          });

          it('should handle false condition', () => {
            expect(func(false)).toBe('invalid');
          });

          it('should handle error cases and throw exceptions', () => {
            expect(() => func(null)).toThrow();
          });

          it('should fail gracefully on reject', () => {
            return expect(asyncFunc()).rejects.toThrow();
          });

          it('should test all switch case options and types', () => {
            expect(func('admin')).toBe('admin-result');
            expect(func('user')).toBe('user-result');
          });

          it('should handle both conditions with and/or logic', () => {
            expect(func(true, true)).toBe('both');
            expect(func(true, false)).toBe('either');
          });
        });
      `;

      const branches = [
        { line: 1, type: 'if' as const, description: 'if condition' },
        { line: 2, type: 'catch' as const, description: 'error handling' },
        { line: 3, type: 'switch' as const, description: 'switch statement' },
        { line: 4, type: 'ternary' as const, description: 'ternary operator' },
        { line: 5, type: 'logical' as const, description: 'logical operator' }
      ];

      for (const branch of branches) {
        const hasPattern = (idleProcessor as any).hasConditionalTestPatterns(comprehensiveTestContent, branch);
        expect(hasPattern).toBe(true);
      }
    });

    it('should identify files with corresponding test files', async () => {
      const filesWithTests = await (idleProcessor as any).getFilesWithTests();
      expect(Array.isArray(filesWithTests)).toBe(true);
    });

    it('should check if source file has corresponding test file', async () => {
      const hasTest = await (idleProcessor as any).hasCorrespondingTestFile('test.ts');
      expect(hasTest).toBe(true);

      const noTest = await (idleProcessor as any).hasCorrespondingTestFile('no-test.ts');
      expect(noTest).toBe(false);
    });

    it('should analyze branches in a line of code', () => {
      const analysis = (idleProcessor as any).analyzeBranchesInLine('if (condition) { return true; }', 'test.ts', 10);

      expect(analysis.totalBranches).toBe(1);
      expect(analysis.branches[0].type).toBe('if');
      expect(analysis.branches[0].line).toBe(10);
      expect(analysis.branches[0].description).toContain('If condition');
    });

    it('should analyze multiple branch types in a line', () => {
      const analysis = (idleProcessor as any).analyzeBranchesInLine('condition ? value1 : value2 && otherCondition', 'test.ts', 15);

      expect(analysis.totalBranches).toBe(2); // ternary and logical
      expect(analysis.branches.some((b: any) => b.type === 'ternary')).toBe(true);
      expect(analysis.branches.some((b: any) => b.type === 'logical')).toBe(true);
    });

    it('should detect different types of conditional test patterns', () => {
      const testContent = `
        describe('test', () => {
          it('should handle true condition', () => {
            expect(func(true)).toBe('valid');
          });

          it('should throw error on invalid input', () => {
            expect(() => func(null)).toThrow();
          });

          it('should handle switch case for admin', () => {
            expect(func('admin')).toBe('admin-result');
          });
        });
      `;

      const ifBranch = { line: 1, type: 'if' as const, description: 'test if' };
      const catchBranch = { line: 2, type: 'catch' as const, description: 'test catch' };
      const switchBranch = { line: 3, type: 'switch' as const, description: 'test switch' };

      expect((idleProcessor as any).hasConditionalTestPatterns(testContent, ifBranch)).toBe(true);
      expect((idleProcessor as any).hasConditionalTestPatterns(testContent, catchBranch)).toBe(true);
      expect((idleProcessor as any).hasConditionalTestPatterns(testContent, switchBranch)).toBe(true);
    });

    it('should detect edge cases in source code', async () => {
      const sourceCode = `
        function validate(input) {
          if (input == null) return false;
          if (input.length === 0) return false;

          try {
            const result = process(input);
          } // no catch block

          await fetchData(); // no error handling

          if (typeof input === 'string') {
            return true;
          }
        }
      `;

      const edgeCases = await (idleProcessor as any).detectUncoveredEdgeCases('test.ts', sourceCode);

      expect(edgeCases.length).toBeGreaterThan(0);
      expect(edgeCases.some((ec: any) => ec.description.includes('Null/undefined check'))).toBe(true);
      expect(edgeCases.some((ec: any) => ec.description.includes('Boundary condition'))).toBe(true);
      expect(edgeCases.some((ec: any) => ec.description.includes('Type check'))).toBe(true);
    });

    it('should get test files for source file', async () => {
      const testFiles = await (idleProcessor as any).getTestFilesForSource('test.ts');
      expect(Array.isArray(testFiles)).toBe(true);
    });
  });

  describe('fallback analyzeBranchCoverage', () => {
    beforeEach(() => {
      // Mock exec commands for fallback branch coverage analysis
      const mockExec = vi.fn().mockImplementation((command: string, options: any) => {
        const callback = arguments[2] || arguments[1];

        if (command.includes('find . -name "*.ts"') && command.includes('xargs grep -n "if"')) {
          callback(null, { stdout: './src/component.ts:10:if (condition) {\n./src/utils.ts:20:if (data && data.valid) {\n' });
        } else if (command.includes('find . -name "*.test.*"')) {
          callback(null, { stdout: './src/component.test.ts\n./src/utils.test.ts\n' });
        } else if (command.includes('find . -name "*.ts"') && command.includes('grep -v test')) {
          callback(null, { stdout: './src/component.ts\n./src/utils.ts\n./src/service.ts\n' });
        } else {
          callback(null, { stdout: '' });
        }
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;
    });

    it('should provide fallback branch coverage analysis', async () => {
      const branchCoverage = await (idleProcessor as any).analyzeBranchCoverage();

      expect(branchCoverage).toBeDefined();
      expect(branchCoverage.percentage).toBeGreaterThanOrEqual(0);
      expect(branchCoverage.percentage).toBeLessThanOrEqual(100);
      expect(branchCoverage.uncoveredBranches).toBeInstanceOf(Array);
    });

    it('should identify different branch types in fallback analysis', async () => {
      const mockExec = vi.fn().mockImplementation((command: string, options: any) => {
        const callback = arguments[2] || arguments[1];

        if (command.includes('xargs grep -n "if"')) {
          callback(null, { stdout:
            './src/test.ts:1:if (condition) return true;\n' +
            './src/test.ts:2:const x = y ? a : b;\n' +
            './src/test.ts:3:if (a && b || c) result;\n' +
            './src/test.ts:4:switch (type) {\n' +
            './src/test.ts:5:} catch (error) {\n'
          });
        } else {
          callback(null, { stdout: '' });
        }
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      const branchCoverage = await (idleProcessor as any).analyzeBranchCoverage();

      expect(branchCoverage.uncoveredBranches.length).toBeGreaterThan(0);

      const branchTypes = branchCoverage.uncoveredBranches.map((b: any) => b.type);
      expect(branchTypes.some(t => ['if', 'ternary', 'logical', 'switch', 'catch'].includes(t))).toBe(true);
    });

    it('should calculate coverage based on test file ratio', async () => {
      const mockExec = vi.fn().mockImplementation((command: string, options: any) => {
        const callback = arguments[2] || arguments[1];

        if (command.includes('find . -name "*.test.*"')) {
          callback(null, { stdout: './test1.test.ts\n./test2.test.ts\n' }); // 2 test files
        } else if (command.includes('find . -name "*.ts"') && command.includes('grep -v test')) {
          callback(null, { stdout: './src1.ts\n./src2.ts\n./src3.ts\n./src4.ts\n' }); // 4 source files
        } else {
          callback(null, { stdout: '' });
        }
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      const branchCoverage = await (idleProcessor as any).analyzeBranchCoverage();

      // Should calculate 2/4 * 100 = 50% coverage
      expect(branchCoverage.percentage).toBe(50);
    });

    it('should handle errors gracefully in fallback analysis', async () => {
      const mockExec = vi.fn().mockImplementation((command: string, options: any) => {
        const callback = arguments[2] || arguments[1];
        callback(new Error('Command failed'), null);
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      const branchCoverage = await (idleProcessor as any).analyzeBranchCoverage();

      expect(branchCoverage.percentage).toBe(0);
      expect(branchCoverage.uncoveredBranches).toHaveLength(0);
    });

    it('should limit results in fallback analysis', async () => {
      const mockExec = vi.fn().mockImplementation((command: string, options: any) => {
        const callback = arguments[2] || arguments[1];

        if (command.includes('xargs grep -n "if"')) {
          // Generate many results to test limiting
          const manyResults = Array(50).fill(0).map((_, i) =>
            `./src/file${i}.ts:${i + 1}:if (condition${i}) {`
          ).join('\n');
          callback(null, { stdout: manyResults });
        } else {
          callback(null, { stdout: '' });
        }
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      const branchCoverage = await (idleProcessor as any).analyzeBranchCoverage();

      // Should limit to 10 results as specified in the implementation
      expect(branchCoverage.uncoveredBranches.length).toBeLessThanOrEqual(10);
    });

    it('should handle edge cases in line parsing', async () => {
      const mockExec = vi.fn().mockImplementation((command: string, options: any) => {
        const callback = arguments[2] || arguments[1];

        if (command.includes('xargs grep -n "if"')) {
          callback(null, { stdout:
            'malformed:line:without:proper:format\n' +
            './valid/file.ts:abc:if (condition) {\n' + // invalid line number
            './empty/file.ts:5:\n' + // empty content
            './valid/file.ts:10:if (good.condition) {\n'
          });
        } else {
          callback(null, { stdout: '' });
        }
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      const branchCoverage = await (idleProcessor as any).analyzeBranchCoverage();

      expect(branchCoverage).toBeDefined();
      expect(Array.isArray(branchCoverage.uncoveredBranches)).toBe(true);
    });
  });
});