import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IdleProcessor, ProjectAnalysis } from './idle-processor';
import { TaskStore } from './store';
import { DaemonConfig, Task, TaskStatus, DetectorFinding, IdleTask } from '@apexcli/core';
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
      listIdleTasks: vi.fn(),
      getIdleTask: vi.fn(),
      deleteIdleTask: vi.fn(),
      createIdleTask: vi.fn(),
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

  describe('getGeneratedTasks', () => {
    it('should return tasks from store', async () => {
      const mockTasks = [
        {
          id: 'idle-123-test',
          type: 'improvement',
          title: 'Test Coverage',
          description: 'Improve test coverage',
          priority: 'normal',
          estimatedEffort: 'medium',
          suggestedWorkflow: 'testing',
          rationale: 'Low test coverage detected',
          createdAt: new Date(),
          implemented: false,
        }
      ];

      vi.mocked(mockStore.listIdleTasks).mockResolvedValue(mockTasks);

      const tasks = await idleProcessor.getGeneratedTasks();

      expect(tasks).toEqual(mockTasks);
      expect(mockStore.listIdleTasks).toHaveBeenCalled();
    });

    it('should handle empty task list', async () => {
      vi.mocked(mockStore.listIdleTasks).mockResolvedValue([]);

      const tasks = await idleProcessor.getGeneratedTasks();

      expect(tasks).toEqual([]);
      expect(mockStore.listIdleTasks).toHaveBeenCalled();
    });

    it('should handle store errors gracefully', async () => {
      vi.mocked(mockStore.listIdleTasks).mockRejectedValue(new Error('Store error'));

      await expect(idleProcessor.getGeneratedTasks()).rejects.toThrow('Store error');
    });
  });

  describe('dismissIdleTask', () => {
    it('should delete task from store', async () => {
      const taskId = 'idle-123-test';

      await idleProcessor.dismissIdleTask(taskId);

      expect(mockStore.deleteIdleTask).toHaveBeenCalledWith(taskId);
    });

    it('should handle store deletion errors', async () => {
      const taskId = 'idle-123-test';
      vi.mocked(mockStore.deleteIdleTask).mockRejectedValue(new Error('Deletion failed'));

      await expect(idleProcessor.dismissIdleTask(taskId)).rejects.toThrow('Deletion failed');
    });
  });

  describe('analyzeCodebaseSize', () => {
    beforeEach(() => {
      const mockExec = vi.fn().mockImplementation((command: string, options: any) => {
        const callback = arguments[2] || arguments[1];

        if (command.includes('find . -type f')) {
          callback(null, { stdout: './src/file1.ts\n./src/file2.js\n./src/file3.py\n./src/file4.md\n' });
        } else if (command.includes('wc -l')) {
          callback(null, { stdout: '250' });
        } else {
          callback(null, { stdout: '' });
        }
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;
    });

    it('should analyze codebase size and language distribution', async () => {
      const result = await (idleProcessor as any).analyzeCodebaseSize();

      expect(result.files).toBe(4);
      expect(result.lines).toBe(250);
      expect(result.languages.ts).toBe(1);
      expect(result.languages.js).toBe(1);
      expect(result.languages.py).toBe(1);
      expect(result.languages.md).toBe(1);
    });

    it('should handle exec errors gracefully', async () => {
      const mockExec = vi.fn().mockImplementation((command: string, options: any) => {
        const callback = arguments[2] || arguments[1];
        callback(new Error('Command failed'), null);
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      const result = await (idleProcessor as any).analyzeCodebaseSize();

      expect(result.files).toBe(0);
      expect(result.lines).toBe(0);
      expect(result.languages).toEqual({});
    });
  });

  describe('analyzeDependencies', () => {
    beforeEach(() => {
      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        if (path.includes('package.json')) {
          return Promise.resolve(JSON.stringify({
            dependencies: {
              'react': '^18.0.0',
              'lodash': '^4.17.15',
              'old-lib': '^0.1.0'
            },
            devDependencies: {
              'typescript': '^5.0.0',
              'jest': '^28.0.0',
              'old-dev-lib': '~0.5.0'
            },
          }));
        }
        return Promise.resolve('');
      });

      const mockExec = vi.fn().mockImplementation((command: string, options: any) => {
        const callback = arguments[2] || arguments[1];

        if (command.includes('npm audit')) {
          callback(null, { stdout: JSON.stringify({
            vulnerabilities: {
              'lodash': {
                severity: 'moderate',
                via: ['CVE-2021-44228']
              }
            }
          }) });
        } else {
          callback(null, { stdout: '' });
        }
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;
    });

    it('should analyze dependencies and identify outdated packages', async () => {
      const result = await (idleProcessor as any).analyzeDependencies();

      expect(result.outdated).toContain('old-lib@^0.1.0');
      expect(result.outdated).toContain('old-dev-lib@~0.5.0');
      expect(result.security).toBeDefined();
    });

    it('should handle package.json read errors', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));

      const result = await (idleProcessor as any).analyzeDependencies();

      expect(result.outdated).toEqual([]);
      expect(result.security).toEqual([]);
    });

    it('should handle malformed package.json', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('invalid json');

      const result = await (idleProcessor as any).analyzeDependencies();

      expect(result.outdated).toEqual([]);
      expect(result.security).toEqual([]);
    });
  });

  describe('analyzeDocumentation advanced features', () => {
    beforeEach(() => {
      const mockExec = vi.fn().mockImplementation((command: string, options: any) => {
        const callback = arguments[2] || arguments[1];

        if (command.includes('find . -name "README*"')) {
          callback(null, { stdout: './README.md\n' });
        } else if (command.includes('find . -name "*.md"')) {
          callback(null, { stdout: './README.md\n./docs/guide.md\n' });
        } else if (command.includes('find . -name "*.ts"')) {
          callback(null, { stdout: './src/component.ts\n./src/utils.ts\n' });
        } else {
          callback(null, { stdout: '' });
        }
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        if (path.includes('README.md')) {
          return Promise.resolve(`
            # Project Title
            ## Installation
            npm install
            ## Usage
            Basic usage instructions
          `);
        }
        if (path.includes('component.ts')) {
          return Promise.resolve(`
            /**
             * Component description
             */
            export function Component() {}

            export function UndocumentedFunction() {}
          `);
        }
        return Promise.resolve('');
      });
    });

    it('should analyze documentation completeness', async () => {
      const result = await (idleProcessor as any).analyzeDocumentation();

      expect(result.coverage).toBeGreaterThanOrEqual(0);
      expect(result.missingDocs).toBeDefined();
      expect(result.undocumentedExports).toBeDefined();
      expect(result.readmeSections).toBeDefined();
    });

    it('should detect undocumented exports', async () => {
      const undocumented = await (idleProcessor as any).findUndocumentedExports();

      expect(Array.isArray(undocumented)).toBe(true);
      expect(undocumented.some(item => item.name === 'UndocumentedFunction')).toBe(true);
    });

    it('should analyze missing README sections', async () => {
      const missingSections = await (idleProcessor as any).findMissingReadmeSections();

      expect(Array.isArray(missingSections)).toBe(true);
      expect(missingSections.some(section => section.section === 'Contributing')).toBe(true);
    });
  });

  describe('analyzePerformance', () => {
    beforeEach(() => {
      const mockExec = vi.fn().mockImplementation((command: string, options: any) => {
        const callback = arguments[2] || arguments[1];

        if (command.includes('find . -name "*.test.*"')) {
          callback(null, { stdout: './slow.test.ts\n./fast.test.ts\n' });
        } else if (command.includes('find . -name "*.ts"') && command.includes('xargs wc -l')) {
          callback(null, { stdout: '500 ./src/large-file.ts\n100 ./src/small-file.ts\n600 total' });
        } else {
          callback(null, { stdout: '' });
        }
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;
    });

    it('should identify performance issues', async () => {
      const result = await (idleProcessor as any).analyzePerformance();

      expect(result.slowTests).toBeDefined();
      expect(result.bottlenecks).toBeDefined();
      expect(result.bottlenecks).toContain('./src/large-file.ts');
    });

    it('should handle exec errors in performance analysis', async () => {
      const mockExec = vi.fn().mockImplementation((command: string, options: any) => {
        const callback = arguments[2] || arguments[1];
        callback(new Error('Command failed'), null);
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      const result = await (idleProcessor as any).analyzePerformance();

      expect(result.slowTests).toEqual([]);
      expect(result.bottlenecks).toEqual([]);
    });
  });

  describe('strategy configuration and task generation', () => {
    let mockAnalysis: ProjectAnalysis;

    beforeEach(() => {
      mockAnalysis = {
        codebaseSize: { files: 50, lines: 5000, languages: { ts: 40, js: 10 } },
        testCoverage: { percentage: 65, uncoveredFiles: ['src/utils.ts', 'src/service.ts'] },
        dependencies: {
          outdated: ['react@^16.0.0', 'lodash@^3.0.0'],
          security: ['vulnerable-package@1.0.0']
        },
        codeQuality: {
          lintIssues: 25,
          duplicatedCode: [],
          complexityHotspots: ['src/complex.ts', 'src/heavy.ts']
        },
        documentation: {
          coverage: 40,
          missingDocs: ['src/core.ts', 'src/api.ts'],
          undocumentedExports: [],
          outdatedDocs: [],
          readmeSections: [],
          apiCompleteness: { coverage: 70, undocumentedItems: [] }
        },
        performance: {
          slowTests: ['test/integration.test.ts'],
          bottlenecks: ['src/data-processor.ts']
        },
        testAnalysis: {
          branchCoverage: { percentage: 55, uncoveredBranches: [] },
          untestedExports: [],
          missingIntegrationTests: [],
          antiPatterns: []
        }
      };
    });

    it('should generate prioritized tasks based on analysis', async () => {
      idleProcessor['lastAnalysis'] = mockAnalysis;
      await idleProcessor['generateImprovementTasks']();

      // Should have called store to create tasks
      expect(mockStore.createIdleTask).toHaveBeenCalled();
    });

    it('should respect max task limit configuration', async () => {
      mockConfig.idleProcessing!.maxIdleTasks = 2;
      idleProcessor = new IdleProcessor(mockProjectPath, mockConfig, mockStore);
      idleProcessor['lastAnalysis'] = mockAnalysis;

      const tasks = await idleProcessor['generateTasksFromAnalysis'](mockAnalysis);

      expect(tasks.length).toBeLessThanOrEqual(2);
    });

    it('should prioritize security vulnerabilities', async () => {
      const securityAnalysis = {
        ...mockAnalysis,
        dependencies: {
          outdated: ['react@^16.0.0'],
          security: ['critical-vuln@1.0.0', 'medium-vuln@2.0.0']
        }
      };

      const tasks = await idleProcessor['generateTasksFromAnalysis'](securityAnalysis);
      const securityTask = tasks.find(t => t.title.includes('Security'));

      expect(securityTask).toBeDefined();
      expect(securityTask?.priority).toBe('high');
    });

    it('should generate different task types based on analysis', async () => {
      const tasks = await idleProcessor['generateTasksFromAnalysis'](mockAnalysis);

      const taskTypes = tasks.map(t => t.type);
      expect(taskTypes).toContain('improvement');
      expect(taskTypes).toContain('maintenance');
      expect(taskTypes).toContain('documentation');
    });
  });

  describe('implementIdleTask with store integration', () => {
    beforeEach(() => {
      const mockIdleTask = {
        id: 'idle-123-test',
        type: 'improvement',
        title: 'Test Coverage',
        description: 'Improve test coverage for components',
        priority: 'normal',
        estimatedEffort: 'medium',
        suggestedWorkflow: 'testing',
        rationale: 'Current coverage is below target',
        createdAt: new Date(),
        implemented: false,
      };

      vi.mocked(mockStore.getIdleTask).mockResolvedValue(mockIdleTask);
      vi.mocked(mockStore.createTask).mockResolvedValue({ id: 'real-task-456' } as Task);
    });

    it('should convert idle task to real task and mark as implemented', async () => {
      const realTaskId = await idleProcessor.implementIdleTask('idle-123-test');

      expect(realTaskId).toBe('real-task-456');
      expect(mockStore.createTask).toHaveBeenCalledWith({
        description: 'Improve test coverage for components',
        acceptanceCriteria: 'Implement Test Coverage. Current coverage is below target',
        workflow: 'testing',
        priority: 'normal',
        projectPath: mockProjectPath,
      });
    });

    it('should handle already implemented tasks', async () => {
      const implementedTask = {
        id: 'idle-123-test',
        type: 'improvement',
        title: 'Test Coverage',
        description: 'Improve test coverage',
        priority: 'normal',
        estimatedEffort: 'medium',
        suggestedWorkflow: 'testing',
        rationale: 'Coverage too low',
        createdAt: new Date(),
        implemented: true, // Already implemented
      };

      vi.mocked(mockStore.getIdleTask).mockResolvedValue(implementedTask);

      await expect(idleProcessor.implementIdleTask('idle-123-test'))
        .rejects.toThrow('Idle task idle-123-test has already been implemented');
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

  describe('duplicate code detection', () => {
    beforeEach(() => {
      const mockExec = vi.fn().mockImplementation((command: string, options: any) => {
        const callback = arguments[2] || arguments[1];

        if (command.includes('find . -name "*.ts"')) {
          callback(null, { stdout: './src/file1.ts\n./src/file2.ts\n./src/file3.ts\n' });
        } else {
          callback(null, { stdout: '' });
        }
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        if (path.includes('file1.ts')) {
          return Promise.resolve(`
            function validateInput(input: string) {
              if (!input) return false;
              return input.length > 0;
            }
            import { Component } from 'react';
          `);
        }
        if (path.includes('file2.ts')) {
          return Promise.resolve(`
            function validateData(data: string) {
              if (!data) return false;
              return data.length > 0;
            }
            import { Component } from 'react';
          `);
        }
        if (path.includes('file3.ts')) {
          return Promise.resolve(`
            // TODO: refactor this method
            function processData(data: any) {
              return data;
            }
          `);
        }
        return Promise.resolve('');
      });
    });

    it('should detect duplicate function patterns', async () => {
      const duplicates = await (idleProcessor as any).detectDuplicateFunctions(['./src/file1.ts', './src/file2.ts']);

      expect(Array.isArray(duplicates)).toBe(true);
      if (duplicates.length > 0) {
        expect(duplicates[0]).toHaveProperty('pattern');
        expect(duplicates[0]).toHaveProperty('locations');
        expect(duplicates[0]).toHaveProperty('similarity');
      }
    });

    it('should detect duplicate import patterns', async () => {
      const duplicates = await (idleProcessor as any).detectDuplicateImports(['./src/file1.ts', './src/file2.ts']);

      expect(Array.isArray(duplicates)).toBe(true);
      if (duplicates.length > 0) {
        expect(duplicates[0]).toHaveProperty('pattern');
        expect(duplicates[0]).toHaveProperty('locations');
        expect(duplicates[0].pattern).toContain('react');
      }
    });

    it('should detect duplicate TODO comments', async () => {
      const mockExec = vi.fn().mockImplementation((command: string, options: any) => {
        const callback = arguments[2] || arguments[1];

        if (command.includes('grep -r')) {
          callback(null, { stdout: './src/file1.ts:1:// TODO: refactor this method\n./src/file2.ts:1:// TODO: refactor this method\n' });
        } else {
          callback(null, { stdout: '' });
        }
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      const duplicates = await (idleProcessor as any).detectDuplicateTodos();

      expect(Array.isArray(duplicates)).toBe(true);
    });

    it('should handle errors in duplicate detection gracefully', async () => {
      const mockExec = vi.fn().mockImplementation((command: string, options: any) => {
        const callback = arguments[2] || arguments[1];
        callback(new Error('Command failed'), null);
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      const duplicates = await (idleProcessor as any).detectDuplicateCodePatterns();

      expect(Array.isArray(duplicates)).toBe(true);
      expect(duplicates).toEqual([]);
    });
  });

  describe('deep nesting detection', () => {
    beforeEach(() => {
      const mockExec = vi.fn().mockImplementation((command: string, options: any) => {
        const callback = arguments[2] || arguments[1];

        if (command.includes('find . -name "*.ts"')) {
          callback(null, { stdout: './src/nested.ts\n' });
        } else {
          callback(null, { stdout: '' });
        }
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        if (path.includes('nested.ts')) {
          return Promise.resolve(`
            function deeplyNested() {
              if (condition1) {
                for (let i = 0; i < 10; i++) {
                  if (condition2) {
                    for (let j = 0; j < 5; j++) {
                      if (condition3) {
                        if (condition4) {
                          // This is deeply nested
                          console.log('deep');
                        }
                      }
                    }
                  }
                }
              }
            }
          `);
        }
        return Promise.resolve('');
      });
    });

    it('should detect deep nesting patterns', async () => {
      const codeSmells = await (idleProcessor as any).detectDeepNesting();

      expect(Array.isArray(codeSmells)).toBe(true);
      if (codeSmells.length > 0) {
        expect(codeSmells[0]).toHaveProperty('file');
        expect(codeSmells[0]).toHaveProperty('type');
        expect(codeSmells[0]).toHaveProperty('severity');
        expect(codeSmells[0].type).toBe('deep-nesting');
      }
    });

    it('should analyze file nesting levels', async () => {
      const nesting = await (idleProcessor as any).analyzeFileNesting('./src/nested.ts');

      expect(Array.isArray(nesting)).toBe(true);
      if (nesting.length > 0) {
        expect(nesting[0]).toHaveProperty('level');
        expect(nesting[0]).toHaveProperty('line');
        expect(nesting[0]).toHaveProperty('context');
      }
    });

    it('should extract nesting context correctly', () => {
      const ifContext = (idleProcessor as any).extractNestingContext('  if (condition) {');
      expect(ifContext).toBe('if');

      const forContext = (idleProcessor as any).extractNestingContext('    for (let i = 0; i < 10; i++) {');
      expect(forContext).toBe('for');

      const whileContext = (idleProcessor as any).extractNestingContext('      while (true) {');
      expect(whileContext).toBe('while');
    });
  });

  describe('long method detection', () => {
    beforeEach(() => {
      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        if (path.includes('long-method.ts')) {
          // Create a file with a long method (>50 lines)
          const longMethod = Array(60).fill('  console.log("line");').join('\n');
          return Promise.resolve(`
            function longMethod() {
            ${longMethod}
            }

            function shortMethod() {
              return 'short';
            }
          `);
        }
        return Promise.resolve('');
      });
    });

    it('should detect long methods', async () => {
      const longMethods = await (idleProcessor as any).detectLongMethods('src/long-method.ts');

      expect(Array.isArray(longMethods)).toBe(true);
      if (longMethods.length > 0) {
        expect(longMethods[0]).toHaveProperty('name');
        expect(longMethods[0]).toHaveProperty('lines');
        expect(longMethods[0]).toHaveProperty('startLine');
        expect(longMethods[0].lines).toBeGreaterThan(50);
      }
    });

    it('should estimate method count correctly', async () => {
      const methodCount = await (idleProcessor as any).estimateMethodCount('src/long-method.ts');

      expect(typeof methodCount).toBe('number');
      expect(methodCount).toBeGreaterThanOrEqual(0);
    });

    it('should handle file read errors in method detection', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));

      const longMethods = await (idleProcessor as any).detectLongMethods('src/nonexistent.ts');
      expect(longMethods).toEqual([]);

      const methodCount = await (idleProcessor as any).estimateMethodCount('src/nonexistent.ts');
      expect(methodCount).toBe(0);
    });
  });

  describe('API completeness analysis', () => {
    beforeEach(() => {
      const mockExec = vi.fn().mockImplementation((command: string, options: any) => {
        const callback = arguments[2] || arguments[1];

        if (command.includes('find . -name "*.ts"')) {
          callback(null, { stdout: './src/api.ts\n./src/service.ts\n' });
        } else {
          callback(null, { stdout: '' });
        }
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        if (path.includes('api.ts')) {
          return Promise.resolve(`
            /**
             * API endpoint for user management
             */
            export class UserAPI {
              getUser() { }
              createUser() { }
              updateUser() { }
              deleteUser() { }
            }

            export class UndocumentedAPI {
              getData() { }
            }
          `);
        }
        if (path.includes('service.ts')) {
          return Promise.resolve(`
            export function processData() { }
            export function validateInput() { }
          `);
        }
        return Promise.resolve('');
      });
    });

    it('should analyze API completeness', async () => {
      const apiCompleteness = await (idleProcessor as any).analyzeAPICompleteness();

      expect(apiCompleteness).toBeDefined();
      expect(apiCompleteness).toHaveProperty('coverage');
      expect(apiCompleteness).toHaveProperty('undocumentedItems');
      expect(typeof apiCompleteness.coverage).toBe('number');
      expect(Array.isArray(apiCompleteness.undocumentedItems)).toBe(true);
    });

    it('should identify undocumented API items', async () => {
      const apiCompleteness = await (idleProcessor as any).analyzeAPICompleteness();

      expect(apiCompleteness.undocumentedItems.length).toBeGreaterThan(0);
      expect(apiCompleteness.undocumentedItems.some(item => item.name === 'UndocumentedAPI')).toBe(true);
    });
  });

  describe('security analysis integration', () => {
    beforeEach(() => {
      const mockExec = vi.fn().mockImplementation((command: string, options: any) => {
        const callback = arguments[2] || arguments[1];

        if (command.includes('npm audit')) {
          callback(null, {
            stdout: JSON.stringify({
              vulnerabilities: {
                'vulnerable-package': {
                  severity: 'high',
                  via: [{
                    title: 'Critical vulnerability in vulnerable-package',
                    cwe: ['CWE-89'],
                    cvss: { score: 9.8 }
                  }]
                }
              }
            })
          });
        } else {
          callback(null, { stdout: '' });
        }
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;
    });

    it('should detect security vulnerabilities', async () => {
      const dependencies = await (idleProcessor as any).analyzeDependencies();

      expect(dependencies.security).toBeDefined();
      expect(Array.isArray(dependencies.security)).toBe(true);
    });

    it('should handle npm audit command failures', async () => {
      const mockExec = vi.fn().mockImplementation((command: string, options: any) => {
        const callback = arguments[2] || arguments[1];

        if (command.includes('npm audit')) {
          callback(new Error('npm audit failed'), null);
        } else {
          callback(null, { stdout: '' });
        }
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      const dependencies = await (idleProcessor as any).analyzeDependencies();

      expect(dependencies.security).toEqual([]);
    });
  });

  describe('getLastAnalysis', () => {
    it('should return undefined initially', () => {
      const analysis = idleProcessor.getLastAnalysis();
      expect(analysis).toBeUndefined();
    });

    it('should return analysis after processIdleTime', async () => {
      const mockExec = vi.fn().mockImplementation((command: string, options: any) => {
        const callback = arguments[2] || arguments[1];
        if (command.includes('find . -type f')) {
          callback(null, { stdout: './src/file1.ts\n' });
        } else if (command.includes('wc -l')) {
          callback(null, { stdout: '100' });
        } else {
          callback(null, { stdout: '' });
        }
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      vi.mocked(fs.readFile).mockResolvedValue('{}');

      await idleProcessor.processIdleTime();

      const analysis = idleProcessor.getLastAnalysis();
      expect(analysis).toBeDefined();
      expect(analysis?.codebaseSize).toBeDefined();
    });
  });

  describe('event emission validation', () => {
    it('should emit correct events during processing', async () => {
      const events: string[] = [];

      idleProcessor.on('analysis:started', () => events.push('analysis:started'));
      idleProcessor.on('analysis:completed', () => events.push('analysis:completed'));
      idleProcessor.on('tasks:generated', () => events.push('tasks:generated'));

      const mockExec = vi.fn().mockImplementation((command: string, options: any) => {
        const callback = arguments[2] || arguments[1];
        callback(null, { stdout: '' });
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      vi.mocked(fs.readFile).mockResolvedValue('{}');

      await idleProcessor.processIdleTime();

      expect(events).toContain('analysis:started');
      expect(events).toContain('analysis:completed');
      expect(events).toContain('tasks:generated');
    });
  });

  describe('configuration edge cases', () => {
    it('should handle missing idleProcessing config', () => {
      const minimalConfig: DaemonConfig = {};
      const processor = new IdleProcessor(mockProjectPath, minimalConfig, mockStore);

      expect(processor).toBeDefined();
    });

    it('should handle partial idleProcessing config', () => {
      const partialConfig: DaemonConfig = {
        idleProcessing: {
          enabled: true
          // Missing other properties
        }
      };
      const processor = new IdleProcessor(mockProjectPath, partialConfig, mockStore);

      expect(processor).toBeDefined();
    });

    it('should use default values for missing config properties', async () => {
      const processor = new IdleProcessor(mockProjectPath, { idleProcessing: { enabled: true } }, mockStore);

      // Should not throw when accessing configuration with default values
      await expect(processor.start()).resolves.toBeUndefined();
    });
  });

  describe('analyzeTestAntiPatterns', () => {
    it('should return an array of TestingAntiPattern objects', async () => {
      // Mock child_process exec to return test files
      const mockExec = vi.fn((cmd: string, callback: Function) => {
        if (cmd.includes('find')) {
          callback(null, { stdout: './test1.test.ts\n./test2.spec.js\n' });
        } else {
          callback(null, { stdout: '' });
        }
      });

      // Mock file content with various anti-patterns
      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        if (path.includes('test1.test.ts')) {
          return Promise.resolve(`
            describe('Sample test', () => {
              it('test without assertions', () => {
                const value = 42;
              });

              // it('commented out test', () => {
              //   expect(true).toBe(true);
              // });

              it('test with only console.log', () => {
                console.log('testing something');
              });

              it('empty test', () => {
              });

              it('test with hardcoded timeout', () => {
                setTimeout(() => {
                  expect(true).toBe(true);
                }, 1000);
              });
            });
          `);
        }
        return Promise.resolve('');
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      const antiPatterns = await idleProcessor.analyzeTestAntiPatterns();

      expect(Array.isArray(antiPatterns)).toBe(true);
      expect(antiPatterns.length).toBeGreaterThan(0);

      // Check that all required anti-patterns are detected
      const patternTypes = antiPatterns.map(p => p.type);
      expect(patternTypes).toContain('no-assertion');
      expect(patternTypes).toContain('commented-out');
      expect(patternTypes).toContain('console-only');
      expect(patternTypes).toContain('empty-test');
      expect(patternTypes).toContain('hardcoded-timeout');
    });

    it('should handle empty test files gracefully', async () => {
      const mockExec = vi.fn((cmd: string, callback: Function) => {
        if (cmd.includes('find')) {
          callback(null, { stdout: './empty.test.ts\n' });
        } else {
          callback(null, { stdout: '' });
        }
      });

      vi.mocked(fs.readFile).mockResolvedValue('');

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      const antiPatterns = await idleProcessor.analyzeTestAntiPatterns();

      expect(Array.isArray(antiPatterns)).toBe(true);
      expect(antiPatterns).toEqual([]);
    });

    it('should limit results for performance', async () => {
      const mockExec = vi.fn((cmd: string, callback: Function) => {
        if (cmd.includes('find')) {
          const manyFiles = Array.from({ length: 100 }, (_, i) => `./test${i}.test.ts`).join('\n');
          callback(null, { stdout: manyFiles });
        } else {
          callback(null, { stdout: '' });
        }
      });

      vi.mocked(fs.readFile).mockResolvedValue(`
        describe('test', () => {
          it('test without assertions', () => {
            const value = 42;
          });
        });
      `);

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      const antiPatterns = await idleProcessor.analyzeTestAntiPatterns();

      expect(antiPatterns.length).toBeLessThanOrEqual(50);
    });

    it('should handle file read errors gracefully', async () => {
      const mockExec = vi.fn((cmd: string, callback: Function) => {
        if (cmd.includes('find')) {
          callback(null, { stdout: './error.test.ts\n' });
        } else {
          callback(null, { stdout: '' });
        }
      });

      vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      const antiPatterns = await idleProcessor.analyzeTestAntiPatterns();

      expect(Array.isArray(antiPatterns)).toBe(true);
    });

    it('should handle exec errors gracefully', async () => {
      const mockExec = vi.fn((cmd: string, callback: Function) => {
        callback(new Error('Command failed'));
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      const antiPatterns = await idleProcessor.analyzeTestAntiPatterns();

      expect(Array.isArray(antiPatterns)).toBe(true);
      expect(antiPatterns).toEqual([]);
    });
  });

  describe('utility methods', () => {
    describe('getDefaultIndicators', () => {
      it('should return correct indicators for standard sections', () => {
        // Test all the standard sections defined in the implementation
        expect(idleProcessor['getDefaultIndicators']('title')).toEqual(['#', 'title']);
        expect(idleProcessor['getDefaultIndicators']('description')).toEqual(['description', 'about', 'overview']);
        expect(idleProcessor['getDefaultIndicators']('installation')).toEqual(['install', 'setup', 'getting started']);
        expect(idleProcessor['getDefaultIndicators']('usage')).toEqual(['usage', 'how to use', 'example', 'getting started']);
        expect(idleProcessor['getDefaultIndicators']('api')).toEqual(['api', 'reference', 'methods', 'functions', 'documentation']);
        expect(idleProcessor['getDefaultIndicators']('contributing')).toEqual(['contribut', 'develop', 'contribution']);
        expect(idleProcessor['getDefaultIndicators']('license')).toEqual(['license', 'copyright', 'legal']);
        expect(idleProcessor['getDefaultIndicators']('testing')).toEqual(['test', 'testing', 'spec']);
        expect(idleProcessor['getDefaultIndicators']('troubleshooting')).toEqual(['troubleshoot', 'problem', 'issue', 'debug']);
        expect(idleProcessor['getDefaultIndicators']('faq')).toEqual(['faq', 'question', 'frequently asked']);
        expect(idleProcessor['getDefaultIndicators']('changelog')).toEqual(['changelog', 'changes', 'history', 'release']);
        expect(idleProcessor['getDefaultIndicators']('dependencies')).toEqual(['depend', 'requirement']);
        expect(idleProcessor['getDefaultIndicators']('examples')).toEqual(['example', 'demo', 'sample']);
        expect(idleProcessor['getDefaultIndicators']('deployment')).toEqual(['deploy', 'build', 'production']);
      });

      it('should return the section name as fallback for unknown sections', () => {
        expect(idleProcessor['getDefaultIndicators']('custom-section')).toEqual(['custom-section']);
        expect(idleProcessor['getDefaultIndicators']('unknown')).toEqual(['unknown']);
        expect(idleProcessor['getDefaultIndicators']('weird-name')).toEqual(['weird-name']);
      });

      it('should handle empty string', () => {
        expect(idleProcessor['getDefaultIndicators']('')).toEqual(['']);
      });

      it('should handle case sensitivity properly', () => {
        expect(idleProcessor['getDefaultIndicators']('TITLE')).toEqual(['TITLE']);
        expect(idleProcessor['getDefaultIndicators']('Title')).toEqual(['Title']);
      });
    });

    describe('getDefaultDescription', () => {
      it('should return correct descriptions for standard sections', () => {
        expect(idleProcessor['getDefaultDescription']('title')).toBe('Project title and brief description');
        expect(idleProcessor['getDefaultDescription']('description')).toBe('Detailed project description and overview');
        expect(idleProcessor['getDefaultDescription']('installation')).toBe('Installation and setup instructions');
        expect(idleProcessor['getDefaultDescription']('usage')).toBe('Usage examples and basic instructions');
        expect(idleProcessor['getDefaultDescription']('api')).toBe('API documentation and reference');
        expect(idleProcessor['getDefaultDescription']('contributing')).toBe('Contributing guidelines for developers');
        expect(idleProcessor['getDefaultDescription']('license')).toBe('License information and copyright');
        expect(idleProcessor['getDefaultDescription']('testing')).toBe('Testing instructions and guidelines');
        expect(idleProcessor['getDefaultDescription']('troubleshooting')).toBe('Common issues and solutions');
        expect(idleProcessor['getDefaultDescription']('faq')).toBe('Frequently asked questions');
        expect(idleProcessor['getDefaultDescription']('changelog')).toBe('Version history and changes');
        expect(idleProcessor['getDefaultDescription']('dependencies')).toBe('Project dependencies and requirements');
        expect(idleProcessor['getDefaultDescription']('examples')).toBe('Usage examples and code samples');
        expect(idleProcessor['getDefaultDescription']('deployment')).toBe('Deployment and build instructions');
      });

      it('should generate fallback description for unknown sections', () => {
        expect(idleProcessor['getDefaultDescription']('custom-section')).toBe('Custom-section section');
        expect(idleProcessor['getDefaultDescription']('unknown')).toBe('Unknown section');
        expect(idleProcessor['getDefaultDescription']('my-custom-readme')).toBe('My-custom-readme section');
      });

      it('should handle empty string correctly', () => {
        expect(idleProcessor['getDefaultDescription']('')).toBe(' section');
      });

      it('should handle single character correctly', () => {
        expect(idleProcessor['getDefaultDescription']('x')).toBe('X section');
      });

      it('should properly capitalize first character', () => {
        expect(idleProcessor['getDefaultDescription']('hello')).toBe('Hello section');
        expect(idleProcessor['getDefaultDescription']('ABC')).toBe('ABC section');
      });
    });

    describe('calculateMismatchSeverity', () => {
      it('should return high severity for major version differences', () => {
        expect(idleProcessor['calculateMismatchSeverity']('1.0.0', '2.0.0')).toBe('high');
        expect(idleProcessor['calculateMismatchSeverity']('2.5.3', '1.0.0')).toBe('high');
        expect(idleProcessor['calculateMismatchSeverity']('0.1.0', '1.0.0')).toBe('high');
      });

      it('should return medium severity for minor version differences', () => {
        expect(idleProcessor['calculateMismatchSeverity']('1.0.0', '1.1.0')).toBe('medium');
        expect(idleProcessor['calculateMismatchSeverity']('1.5.0', '1.0.0')).toBe('medium');
        expect(idleProcessor['calculateMismatchSeverity']('2.0.0', '2.3.0')).toBe('medium');
      });

      it('should return low severity for patch version differences', () => {
        expect(idleProcessor['calculateMismatchSeverity']('1.0.0', '1.0.1')).toBe('low');
        expect(idleProcessor['calculateMismatchSeverity']('1.0.5', '1.0.2')).toBe('low');
        expect(idleProcessor['calculateMismatchSeverity']('2.3.1', '2.3.0')).toBe('low');
      });

      it('should return low severity for identical versions', () => {
        expect(idleProcessor['calculateMismatchSeverity']('1.0.0', '1.0.0')).toBe('low');
        expect(idleProcessor['calculateMismatchSeverity']('2.5.3', '2.5.3')).toBe('low');
      });

      it('should return medium severity for malformed versions', () => {
        expect(idleProcessor['calculateMismatchSeverity']('invalid', '1.0.0')).toBe('medium');
        expect(idleProcessor['calculateMismatchSeverity']('1.0.0', 'invalid')).toBe('medium');
        expect(idleProcessor['calculateMismatchSeverity']('1.0', '1.0.0')).toBe('medium');
        expect(idleProcessor['calculateMismatchSeverity']('1', '1.0.0')).toBe('medium');
      });

      it('should handle version strings with prefixes and suffixes', () => {
        expect(idleProcessor['calculateMismatchSeverity']('v1.0.0', '2.0.0')).toBe('medium'); // Can't parse "v1.0.0"
        expect(idleProcessor['calculateMismatchSeverity']('1.0.0-alpha', '1.0.0')).toBe('medium'); // Can't parse with suffix
        expect(idleProcessor['calculateMismatchSeverity']('^1.0.0', '1.1.0')).toBe('medium'); // Can't parse with caret
      });

      it('should handle empty strings gracefully', () => {
        expect(idleProcessor['calculateMismatchSeverity']('', '1.0.0')).toBe('medium');
        expect(idleProcessor['calculateMismatchSeverity']('1.0.0', '')).toBe('medium');
        expect(idleProcessor['calculateMismatchSeverity']('', '')).toBe('medium');
      });

      it('should handle exceptions gracefully', () => {
        // Test with problematic input that might throw during regex or parsing
        expect(idleProcessor['calculateMismatchSeverity'](null as any, '1.0.0')).toBe('medium');
        expect(idleProcessor['calculateMismatchSeverity']('1.0.0', null as any)).toBe('medium');
        expect(idleProcessor['calculateMismatchSeverity'](undefined as any, '1.0.0')).toBe('medium');
      });
    });

    describe('normalizeExportType', () => {
      it('should normalize variable declarations correctly', () => {
        expect(idleProcessor['normalizeExportType']('let')).toBe('variable');
        expect(idleProcessor['normalizeExportType']('var')).toBe('variable');
        expect(idleProcessor['normalizeExportType']('LET')).toBe('variable');
        expect(idleProcessor['normalizeExportType']('VAR')).toBe('variable');
      });

      it('should handle const correctly', () => {
        expect(idleProcessor['normalizeExportType']('const')).toBe('const');
        expect(idleProcessor['normalizeExportType']('CONST')).toBe('const');
      });

      it('should handle all standard types correctly', () => {
        expect(idleProcessor['normalizeExportType']('function')).toBe('function');
        expect(idleProcessor['normalizeExportType']('FUNCTION')).toBe('function');
        expect(idleProcessor['normalizeExportType']('class')).toBe('class');
        expect(idleProcessor['normalizeExportType']('CLASS')).toBe('class');
        expect(idleProcessor['normalizeExportType']('interface')).toBe('interface');
        expect(idleProcessor['normalizeExportType']('INTERFACE')).toBe('interface');
        expect(idleProcessor['normalizeExportType']('type')).toBe('type');
        expect(idleProcessor['normalizeExportType']('TYPE')).toBe('type');
        expect(idleProcessor['normalizeExportType']('enum')).toBe('enum');
        expect(idleProcessor['normalizeExportType']('ENUM')).toBe('enum');
        expect(idleProcessor['normalizeExportType']('namespace')).toBe('namespace');
        expect(idleProcessor['normalizeExportType']('NAMESPACE')).toBe('namespace');
      });

      it('should default unknown types to function', () => {
        expect(idleProcessor['normalizeExportType']('unknown')).toBe('function');
        expect(idleProcessor['normalizeExportType']('module')).toBe('function');
        expect(idleProcessor['normalizeExportType']('something-else')).toBe('function');
        expect(idleProcessor['normalizeExportType']('')).toBe('function');
      });

      it('should handle mixed case properly', () => {
        expect(idleProcessor['normalizeExportType']('Function')).toBe('function');
        expect(idleProcessor['normalizeExportType']('Class')).toBe('class');
        expect(idleProcessor['normalizeExportType']('Interface')).toBe('interface');
      });
    });

    describe('isExportPublic', () => {
      it('should return false for internal/private file paths', () => {
        expect(idleProcessor['isExportPublic']('someFunction', '/src/internal/utils.ts')).toBe(false);
        expect(idleProcessor['isExportPublic']('someFunction', '/src/private/helpers.ts')).toBe(false);
        expect(idleProcessor['isExportPublic']('someFunction', '/src/__tests__/test-utils.ts')).toBe(false);
        expect(idleProcessor['isExportPublic']('someFunction', '/src/types.d.ts')).toBe(false);
      });

      it('should return false for private export names', () => {
        expect(idleProcessor['isExportPublic']('_privateFunction', '/src/utils.ts')).toBe(false);
        expect(idleProcessor['isExportPublic']('__internalHelper', '/src/utils.ts')).toBe(false);
        expect(idleProcessor['isExportPublic']('internalUtility', '/src/utils.ts')).toBe(false);
        expect(idleProcessor['isExportPublic']('privateMethod', '/src/utils.ts')).toBe(false);
        expect(idleProcessor['isExportPublic']('Internal_Function', '/src/utils.ts')).toBe(false);
        expect(idleProcessor['isExportPublic']('PRIVATE_CONSTANT', '/src/utils.ts')).toBe(false);
      });

      it('should return true for public exports', () => {
        expect(idleProcessor['isExportPublic']('publicFunction', '/src/utils.ts')).toBe(true);
        expect(idleProcessor['isExportPublic']('SomeClass', '/src/component.ts')).toBe(true);
        expect(idleProcessor['isExportPublic']('API_ENDPOINT', '/src/constants.ts')).toBe(true);
        expect(idleProcessor['isExportPublic']('helper', '/src/lib/helpers.ts')).toBe(true);
      });

      it('should handle edge cases correctly', () => {
        // Edge case: underscore in middle of name should be public
        expect(idleProcessor['isExportPublic']('is_valid', '/src/utils.ts')).toBe(true);
        expect(idleProcessor['isExportPublic']('calculate_total', '/src/utils.ts')).toBe(true);

        // Edge case: contains but doesn't start with underscore
        expect(idleProcessor['isExportPublic']('some_internal_function', '/src/utils.ts')).toBe(false); // contains "internal"
        expect(idleProcessor['isExportPublic']('some_private_method', '/src/utils.ts')).toBe(false); // contains "private"

        // Edge case: partial path matches
        expect(idleProcessor['isExportPublic']('publicFunction', '/src/helpers/internal-utils.ts')).toBe(false); // path contains "internal"
      });

      it('should handle empty strings and special characters', () => {
        expect(idleProcessor['isExportPublic']('', '/src/utils.ts')).toBe(true);
        expect(idleProcessor['isExportPublic']('normalFunction', '')).toBe(true);
        expect(idleProcessor['isExportPublic']('', '')).toBe(true);
      });
    });

    describe('escapeRegex', () => {
      it('should escape all regex special characters', () => {
        expect(idleProcessor['escapeRegex']('.')).toBe('\\.');
        expect(idleProcessor['escapeRegex']('*')).toBe('\\*');
        expect(idleProcessor['escapeRegex']('+')).toBe('\\+');
        expect(idleProcessor['escapeRegex']('?')).toBe('\\?');
        expect(idleProcessor['escapeRegex']('^')).toBe('\\^');
        expect(idleProcessor['escapeRegex']('$')).toBe('\\$');
        expect(idleProcessor['escapeRegex']('{')).toBe('\\{');
        expect(idleProcessor['escapeRegex']('}')).toBe('\\}');
        expect(idleProcessor['escapeRegex']('(')).toBe('\\(');
        expect(idleProcessor['escapeRegex'](')')).toBe('\\)');
        expect(idleProcessor['escapeRegex']('|')).toBe('\\|');
        expect(idleProcessor['escapeRegex']('[')).toBe('\\[');
        expect(idleProcessor['escapeRegex'](']')).toBe('\\]');
        expect(idleProcessor['escapeRegex']('\\')).toBe('\\\\');
      });

      it('should escape multiple special characters in one string', () => {
        expect(idleProcessor['escapeRegex']('hello.world*')).toBe('hello\\.world\\*');
        expect(idleProcessor['escapeRegex']('test[0-9]+')).toBe('test\\[0-9\\]\\+');
        expect(idleProcessor['escapeRegex']('(function|class)')).toBe('\\(function\\|class\\)');
        expect(idleProcessor['escapeRegex']('$^.*+?{}()[]|\\')).toBe('\\$\\^\\.\\*\\+\\?\\{\\}\\(\\)\\[\\]\\|\\\\');
      });

      it('should leave normal characters unchanged', () => {
        expect(idleProcessor['escapeRegex']('hello')).toBe('hello');
        expect(idleProcessor['escapeRegex']('test123')).toBe('test123');
        expect(idleProcessor['escapeRegex']('MyClass_name')).toBe('MyClass_name');
        expect(idleProcessor['escapeRegex']('function-name')).toBe('function-name');
        expect(idleProcessor['escapeRegex']('API_ENDPOINT')).toBe('API_ENDPOINT');
      });

      it('should handle empty string', () => {
        expect(idleProcessor['escapeRegex']('')).toBe('');
      });

      it('should handle strings with mixed special and normal characters', () => {
        expect(idleProcessor['escapeRegex']('api.v1.users.*.get()')).toBe('api\\.v1\\.users\\.\\*\\.get\\(\\)');
        expect(idleProcessor['escapeRegex']('config.test[env]')).toBe('config\\.test\\[env\\]');
        expect(idleProcessor['escapeRegex']('pattern: /test+/')).toBe('pattern: /test\\+/');
      });

      it('should work correctly when used in actual regex', () => {
        // This test verifies the escaped strings work correctly in real regex patterns
        const testString = 'find myFunc() in code';
        const searchTerm = 'myFunc()';
        const escaped = idleProcessor['escapeRegex'](searchTerm);
        const regex = new RegExp(escaped);

        expect(regex.test(testString)).toBe(true);

        // Without escaping, this would fail because () are regex special characters
        const unescapedRegex = new RegExp(searchTerm);
        // This would actually work because () creates an empty capturing group, but the point is to show the difference
        expect(escaped).toBe('myFunc\\(\\)');
      });
    });
  });

  describe('duplicate code detection', () => {
    describe('detectDuplicateFunctions', () => {
      beforeEach(() => {
        // Mock file system for function detection tests
        vi.mocked(fs.readFile).mockImplementation((path: any) => {
          const filePath = path.toString();
          if (filePath.includes('file1.ts')) {
            return Promise.resolve(`
              function calculateTotal(items) {
                return items.reduce((sum, item) => sum + item.price, 0);
              }

              const validateEmail = (email) => /\w+@\w+\.\w+/.test(email);

              async function processData(data) {
                return await validateAndTransform(data);
              }
            `);
          } else if (filePath.includes('file2.ts')) {
            return Promise.resolve(`
              function calculateTotal(products) {
                return products.reduce((sum, product) => sum + product.price, 0);
              }

              const formatDate = (date) => new Date(date).toISOString();

              function shortFunc() {
                return 1;
              }
            `);
          } else if (filePath.includes('file3.ts')) {
            return Promise.resolve(`
              export const validateEmail = (input) => /\w+@\w+\.\w+/.test(input);

              class Calculator {
                add(a, b) { return a + b; }
              }
            `);
          }
          return Promise.resolve('');
        });
      });

      it('should detect duplicate function signatures', async () => {
        const files = ['./file1.ts', './file2.ts', './file3.ts'];
        const duplicates = await idleProcessor['detectDuplicateFunctions'](files);

        expect(Array.isArray(duplicates)).toBe(true);

        // Should find the duplicate calculateTotal function
        const calculateTotalDupe = duplicates.find(d => d.pattern.includes('calculatetotal'));
        expect(calculateTotalDupe).toBeDefined();
        expect(calculateTotalDupe?.locations).toContain('file1.ts');
        expect(calculateTotalDupe?.locations).toContain('file2.ts');
        expect(calculateTotalDupe?.similarity).toBe(0.95);

        // Should find the duplicate validateEmail function
        const validateEmailDupe = duplicates.find(d => d.pattern.includes('validateemail'));
        expect(validateEmailDupe).toBeDefined();
        expect(validateEmailDupe?.locations).toContain('file1.ts');
        expect(validateEmailDupe?.locations).toContain('file3.ts');
      });

      it('should limit results to avoid performance issues', async () => {
        const files = Array.from({length: 20}, (_, i) => `./file${i}.ts`);
        const duplicates = await idleProcessor['detectDuplicateFunctions'](files);

        expect(duplicates.length).toBeLessThanOrEqual(3);
      });

      it('should handle file read errors gracefully', async () => {
        vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));

        const files = ['./nonexistent.ts'];
        const duplicates = await idleProcessor['detectDuplicateFunctions'](files);

        expect(duplicates).toEqual([]);
      });

      it('should skip very simple patterns', async () => {
        vi.mocked(fs.readFile).mockResolvedValue('const x = 1; function a() {}');

        const files = ['./simple.ts'];
        const duplicates = await idleProcessor['detectDuplicateFunctions'](files);

        // Should not detect the very short functions
        expect(duplicates).toEqual([]);
      });

      it('should normalize function signatures correctly', async () => {
        vi.mocked(fs.readFile).mockImplementation((path: any) => {
          if (path.includes('file1.ts')) {
            return Promise.resolve('function  calculateTotal  (  items  )  {');
          } else if (path.includes('file2.ts')) {
            return Promise.resolve('function calculateTotal(items) {');
          }
          return Promise.resolve('');
        });

        const files = ['./file1.ts', './file2.ts'];
        const duplicates = await idleProcessor['detectDuplicateFunctions'](files);

        // Should detect these as duplicates despite different whitespace
        expect(duplicates.length).toBeGreaterThan(0);
        const duplicate = duplicates[0];
        expect(duplicate.locations).toEqual(['file1.ts', 'file2.ts']);
      });

      it('should handle empty files', async () => {
        vi.mocked(fs.readFile).mockResolvedValue('');

        const files = ['./empty1.ts', './empty2.ts'];
        const duplicates = await idleProcessor['detectDuplicateFunctions'](files);

        expect(duplicates).toEqual([]);
      });

      it('should handle catch block gracefully', async () => {
        // Force an exception in the main try block
        vi.mocked(fs.readFile).mockImplementation(() => {
          throw new Error('Unexpected error');
        });

        const files = ['./file1.ts'];
        const duplicates = await idleProcessor['detectDuplicateFunctions'](files);

        expect(duplicates).toEqual([]);
      });
    });

    describe('detectDuplicateImports', () => {
      beforeEach(() => {
        vi.mocked(fs.readFile).mockImplementation((path: any) => {
          const filePath = path.toString();
          if (filePath.includes('file1.ts')) {
            return Promise.resolve(`
              import { readFile } from 'fs';
              import * as lodash from 'lodash';
              import { v4 as uuid } from 'uuid';
              import { Component } from 'react';
            `);
          } else if (filePath.includes('file2.ts')) {
            return Promise.resolve(`
              import { promises as fs } from 'fs';
              import _ from 'lodash';
              import { generateUUID } from 'uuid';
              import { useState } from 'react';
            `);
          } else if (filePath.includes('file3.ts')) {
            return Promise.resolve(`
              import path from 'path';
              import { pick, omit } from 'lodash';
              import crypto from 'crypto';
            `);
          } else if (filePath.includes('file4.ts')) {
            return Promise.resolve(`
              import lodash from 'lodash';
              import { createHash } from 'crypto';
            `);
          }
          return Promise.resolve('');
        });
      });

      it('should detect duplicate import patterns', async () => {
        const files = ['./file1.ts', './file2.ts', './file3.ts', './file4.ts'];
        const duplicates = await idleProcessor['detectDuplicateImports'](files);

        expect(Array.isArray(duplicates)).toBe(true);

        // Should find the lodash imports
        const lodashImport = duplicates.find(d => d.pattern.includes('lodash'));
        expect(lodashImport).toBeDefined();
        expect(lodashImport?.locations.length).toBeGreaterThan(3);
        expect(lodashImport?.similarity).toBe(0.85);
      });

      it('should only detect patterns with sufficient usage', async () => {
        vi.mocked(fs.readFile).mockImplementation((path: any) => {
          if (path.includes('file1.ts')) {
            return Promise.resolve('import { readFile } from "fs";');
          } else if (path.includes('file2.ts')) {
            return Promise.resolve('import { writeFile } from "fs";');
          }
          return Promise.resolve('');
        });

        const files = ['./file1.ts', './file2.ts']; // Only 2 files, need > 3
        const duplicates = await idleProcessor['detectDuplicateImports'](files);

        expect(duplicates).toEqual([]); // Should not detect with only 2 files
      });

      it('should normalize import statements correctly', async () => {
        vi.mocked(fs.readFile).mockImplementation((path: any) => {
          if (path.includes('file1.ts')) {
            return Promise.resolve('import   {  readFile  }  from   "fs"  ;');
          } else if (path.includes('file2.ts')) {
            return Promise.resolve("import {readFile} from 'fs';");
          } else if (path.includes('file3.ts')) {
            return Promise.resolve('import { writeFile } from "fs";');
          } else if (path.includes('file4.ts')) {
            return Promise.resolve('import fs from "fs";');
          }
          return Promise.resolve('');
        });

        const files = ['./file1.ts', './file2.ts', './file3.ts', './file4.ts'];
        const duplicates = await idleProcessor['detectDuplicateImports'](files);

        // Should normalize whitespace and quotes properly
        expect(duplicates.length).toBeGreaterThan(0);
      });

      it('should focus on specific utility imports', async () => {
        vi.mocked(fs.readFile).mockImplementation((path: any) => {
          if (path.includes('file1.ts')) {
            return Promise.resolve(`
              import React from 'react';
              import { Component } from '@angular/core';
              import { customFunction } from './utils';
            `);
          }
          return Promise.resolve('');
        });

        const files = ['./file1.ts', './file2.ts', './file3.ts', './file4.ts'];
        const duplicates = await idleProcessor['detectDuplicateImports'](files);

        // Should not detect non-utility imports
        expect(duplicates).toEqual([]);
      });

      it('should limit results appropriately', async () => {
        const files = Array.from({length: 25}, (_, i) => `./file${i}.ts`); // More than 20
        const duplicates = await idleProcessor['detectDuplicateImports'](files);

        expect(duplicates.length).toBeLessThanOrEqual(2);
      });

      it('should handle file read errors gracefully', async () => {
        vi.mocked(fs.readFile).mockRejectedValue(new Error('Permission denied'));

        const files = ['./protected.ts'];
        const duplicates = await idleProcessor['detectDuplicateImports'](files);

        expect(duplicates).toEqual([]);
      });

      it('should handle catch block gracefully', async () => {
        // Force an exception to test outer catch block
        const files = ['./file1.ts'];

        // Mock to throw error in join or other operation
        const originalJoin = require('path').join;
        require('path').join = vi.fn().mockImplementation(() => {
          throw new Error('Path error');
        });

        const duplicates = await idleProcessor['detectDuplicateImports'](files);

        expect(duplicates).toEqual([]);

        // Restore original function
        require('path').join = originalJoin;
      });
    });

    describe('detectDuplicateUtilities', () => {
      beforeEach(() => {
        vi.mocked(fs.readFile).mockImplementation((path: any) => {
          const filePath = path.toString();
          if (filePath.includes('auth.ts')) {
            return Promise.resolve(`
              function validateEmail(email) { return /\w+@\w+/.test(email); }
              function checkEmailFormat(email) { return validateEmail(email); }
              function isValidEmail(email) { return email.includes('@'); }
            `);
          } else if (filePath.includes('user.ts')) {
            return Promise.resolve(`
              const validatePassword = (password) => password.length > 8;
              function checkPasswordStrength(password) { return validatePassword(password); }
              function isStrongPassword(pwd) { return pwd.length > 10; }
            `);
          } else if (filePath.includes('utils.ts')) {
            return Promise.resolve(`
              function formatDate(date) { return date.toISOString(); }
              const formatDateTime = (dt) => formatDate(dt);
              function dateFormat(d) { return d.toString(); }
            `);
          } else if (filePath.includes('logger.ts')) {
            return Promise.resolve(`
              console.log('Starting process');
              logger.info('Process running');
              console.error('Error occurred');
              console.log('Process complete');
            `);
          } else if (filePath.includes('security.ts')) {
            return Promise.resolve(`
              function sanitizeInput(input) { return input.trim(); }
              const inputSanitizer = (data) => sanitizeInput(data);
              function sanitizeUserInput(user) { return user.name.trim(); }
            `);
          }
          return Promise.resolve('');
        });
      });

      it('should detect duplicate email validation patterns', async () => {
        const files = ['./auth.ts', './user.ts'];
        const duplicates = await idleProcessor['detectDuplicateUtilities'](files);

        const emailPattern = duplicates.find(d => d.pattern.includes('email validation'));
        expect(emailPattern).toBeDefined();
        expect(emailPattern?.locations).toContain('auth.ts');
        expect(emailPattern?.similarity).toBe(0.80);
      });

      it('should detect duplicate password validation patterns', async () => {
        const files = ['./user.ts'];
        const duplicates = await idleProcessor['detectDuplicateUtilities'](files);

        const passwordPattern = duplicates.find(d => d.pattern.includes('password validation'));
        expect(passwordPattern).toBeDefined();
        expect(passwordPattern?.locations).toContain('user.ts');
      });

      it('should detect duplicate date formatting patterns', async () => {
        const files = ['./utils.ts'];
        const duplicates = await idleProcessor['detectDuplicateUtilities'](files);

        const datePattern = duplicates.find(d => d.pattern.includes('date formatting'));
        expect(datePattern).toBeDefined();
        expect(datePattern?.locations).toContain('utils.ts');
      });

      it('should detect duplicate logging patterns', async () => {
        const files = ['./logger.ts'];
        const duplicates = await idleProcessor['detectDuplicateUtilities'](files);

        const loggingPattern = duplicates.find(d => d.pattern.includes('logging patterns'));
        expect(loggingPattern).toBeDefined();
        expect(loggingPattern?.locations).toContain('logger.ts');
      });

      it('should detect duplicate sanitization patterns', async () => {
        const files = ['./security.ts'];
        const duplicates = await idleProcessor['detectDuplicateUtilities'](files);

        const sanitizePattern = duplicates.find(d => d.pattern.includes('input sanitization'));
        expect(sanitizePattern).toBeDefined();
        expect(sanitizePattern?.locations).toContain('security.ts');
      });

      it('should not detect patterns with insufficient matches', async () => {
        vi.mocked(fs.readFile).mockResolvedValue(`
          function validateEmail(email) { return true; }
          function doSomething() { return false; }
        `);

        const files = ['./sparse.ts'];
        const duplicates = await idleProcessor['detectDuplicateUtilities'](files);

        // Should not detect with only 1 match per pattern
        expect(duplicates).toEqual([]);
      });

      it('should limit results to avoid excessive output', async () => {
        const files = Array.from({length: 20}, (_, i) => `./file${i}.ts`);
        const duplicates = await idleProcessor['detectDuplicateUtilities'](files);

        expect(duplicates.length).toBeLessThanOrEqual(2);
      });

      it('should limit file processing for performance', async () => {
        const files = Array.from({length: 20}, (_, i) => `./file${i}.ts`); // More than 15

        // Mock to count how many files were actually processed
        let readCount = 0;
        vi.mocked(fs.readFile).mockImplementation(() => {
          readCount++;
          return Promise.resolve('console.log("test"); console.log("test2"); console.log("test3");');
        });

        await idleProcessor['detectDuplicateUtilities'](files);

        expect(readCount).toBeLessThanOrEqual(15); // Should limit to 15 files
      });

      it('should handle file read errors gracefully', async () => {
        vi.mocked(fs.readFile).mockRejectedValue(new Error('Access denied'));

        const files = ['./protected.ts'];
        const duplicates = await idleProcessor['detectDuplicateUtilities'](files);

        expect(duplicates).toEqual([]);
      });

      it('should remove duplicate locations', async () => {
        // Mock a pattern that would generate the same file multiple times
        vi.mocked(fs.readFile).mockResolvedValue(`
          console.log('test1'); console.log('test2'); console.log('test3');
          logger.info('info1'); logger.info('info2'); logger.info('info3');
        `);

        const files = ['./multi-pattern.ts'];
        const duplicates = await idleProcessor['detectDuplicateUtilities'](files);

        if (duplicates.length > 0) {
          const loggingPattern = duplicates[0];
          // Should not have duplicate locations
          const uniqueLocations = [...new Set(loggingPattern.locations)];
          expect(loggingPattern.locations).toEqual(uniqueLocations);
        }
      });

      it('should handle catch block gracefully', async () => {
        // Force an exception to test outer catch block
        const originalJoin = require('path').join;
        require('path').join = vi.fn().mockImplementation(() => {
          throw new Error('Path join error');
        });

        const files = ['./file.ts'];
        const duplicates = await idleProcessor['detectDuplicateUtilities'](files);

        expect(duplicates).toEqual([]);

        // Restore original function
        require('path').join = originalJoin;
      });
    });

    describe('detectDuplicateTodos', () => {
      beforeEach(() => {
        // Mock exec command for grep TODO/FIXME/HACK
        const mockExec = vi.fn();
        const childProcess = require('child_process');
        childProcess.exec = mockExec;
      });

      it('should detect multiple TODO comments', async () => {
        const mockExec = vi.fn().mockImplementation((command: string, callback: Function) => {
          if (command.includes('TODO\\|FIXME\\|HACK')) {
            callback(null, {
              stdout: `./src/auth.ts:15:// TODO: Add password validation
./src/user.ts:25:// FIXME: Handle edge case
./src/api.ts:10:// TODO: Implement caching
./src/utils.ts:5:// HACK: Temporary solution
./src/config.ts:8:// TODO: Move to environment variables`
            });
          } else {
            callback(null, { stdout: '' });
          }
        });

        const childProcess = require('child_process');
        childProcess.exec = mockExec;

        const duplicates = await idleProcessor['detectDuplicateTodos']();

        expect(duplicates).toHaveLength(1);
        const todoPattern = duplicates[0];
        expect(todoPattern.pattern).toBe('TODO/FIXME comments');
        expect(todoPattern.similarity).toBe(1.0);
        expect(todoPattern.locations).toHaveLength(5);
        expect(todoPattern.locations).toContain('./src/auth.ts:15');
        expect(todoPattern.locations).toContain('./src/user.ts:25');
      });

      it('should not detect when there are few TODO comments', async () => {
        const mockExec = vi.fn().mockImplementation((command: string, callback: Function) => {
          callback(null, {
            stdout: `./src/auth.ts:15:// TODO: Add validation
./src/user.ts:25:// FIXME: Handle case`
          });
        });

        const childProcess = require('child_process');
        childProcess.exec = mockExec;

        const duplicates = await idleProcessor['detectDuplicateTodos']();

        expect(duplicates).toEqual([]); // Only 2 todos, need > 3
      });

      it('should handle empty grep output', async () => {
        const mockExec = vi.fn().mockImplementation((command: string, callback: Function) => {
          callback(null, { stdout: '' });
        });

        const childProcess = require('child_process');
        childProcess.exec = mockExec;

        const duplicates = await idleProcessor['detectDuplicateTodos']();

        expect(duplicates).toEqual([]);
      });

      it('should limit results to 5 locations', async () => {
        const mockExec = vi.fn().mockImplementation((command: string, callback: Function) => {
          callback(null, {
            stdout: `./file1.ts:1:// TODO: task 1
./file2.ts:2:// TODO: task 2
./file3.ts:3:// TODO: task 3
./file4.ts:4:// TODO: task 4
./file5.ts:5:// TODO: task 5
./file6.ts:6:// TODO: task 6
./file7.ts:7:// TODO: task 7`
          });
        });

        const childProcess = require('child_process');
        childProcess.exec = mockExec;

        const duplicates = await idleProcessor['detectDuplicateTodos']();

        expect(duplicates).toHaveLength(1);
        expect(duplicates[0].locations).toHaveLength(5); // Should limit to 5
      });

      it('should parse file paths correctly', async () => {
        const mockExec = vi.fn().mockImplementation((command: string, callback: Function) => {
          callback(null, {
            stdout: `./src/complex/path/file.ts:42:// TODO: complex task
./simple.ts:1:// FIXME: simple task
./another/path/file.js:123:// HACK: another task
./final.ts:999:// TODO: final task`
          });
        });

        const childProcess = require('child_process');
        childProcess.exec = mockExec;

        const duplicates = await idleProcessor['detectDuplicateTodos']();

        expect(duplicates).toHaveLength(1);
        const locations = duplicates[0].locations;
        expect(locations).toContain('./src/complex/path/file.ts:42');
        expect(locations).toContain('./simple.ts:1');
        expect(locations).toContain('./another/path/file.js:123');
        expect(locations).toContain('./final.ts:999');
      });

      it('should handle exec command errors gracefully', async () => {
        const mockExec = vi.fn().mockImplementation((command: string, callback: Function) => {
          callback(new Error('Command failed'));
        });

        const childProcess = require('child_process');
        childProcess.exec = mockExec;

        const duplicates = await idleProcessor['detectDuplicateTodos']();

        expect(duplicates).toEqual([]);
      });

      it('should handle catch block gracefully', async () => {
        // Force an exception in the main try block
        const originalExecAsync = idleProcessor['execAsync'];
        idleProcessor['execAsync'] = vi.fn().mockImplementation(() => {
          throw new Error('Unexpected error');
        });

        const duplicates = await idleProcessor['detectDuplicateTodos']();

        expect(duplicates).toEqual([]);

        // Restore original method
        idleProcessor['execAsync'] = originalExecAsync;
      });
    });
  });

  describe('integration analysis', () => {
    describe('identifyCriticalPaths', () => {
      beforeEach(() => {
        // Mock exec commands for finding critical paths
        const mockExec = vi.fn();
        const childProcess = require('child_process');
        childProcess.exec = mockExec;

        // Mock readFileContent method
        vi.spyOn(idleProcessor as any, 'readFileContent').mockImplementation(async (filePath: string) => {
          if (filePath.includes('auth.ts')) {
            return 'function authenticate(user) { return jwt.sign(user); } function login() { /* login logic */ }';
          } else if (filePath.includes('payment.ts')) {
            return 'const stripe = require("stripe"); function processPayment() { /* payment logic */ }';
          } else if (filePath.includes('data-processor.ts')) {
            return 'function processData(data) { return transform(data); } function importCsv() {}';
          } else if (filePath.includes('api.ts')) {
            return 'app.get("/users", handler); app.post("/login", authHandler);';
          } else if (filePath.includes('db.ts')) {
            return 'const user = await User.findOne({id}); await user.save();';
          } else if (filePath.includes('service.ts')) {
            return 'const response = await fetch("https://api.example.com"); const result = await axios.get(url);';
          }
          return '';
        });
      });

      it('should identify authentication critical paths', async () => {
        const mockExec = vi.fn().mockImplementation((command: string, callback: Function) => {
          if (command.includes('auth\\|login\\|password\\|jwt')) {
            callback(null, { stdout: './src/auth.ts\n./src/login.ts' });
          } else {
            callback(null, { stdout: '' });
          }
        });

        const childProcess = require('child_process');
        childProcess.exec = mockExec;

        const criticalPaths = await idleProcessor['identifyCriticalPaths']();

        const authPaths = criticalPaths.filter(p => p.type === 'authentication');
        expect(authPaths.length).toBeGreaterThan(0);

        const authPath = authPaths[0];
        expect(authPath.type).toBe('authentication');
        expect(authPath.file).toContain('auth.ts');
        expect(authPath.description).toContain('authentication');
        expect(authPath.criticality).toBe('critical');
        expect(authPath.keywords).toContain('auth');
        expect(authPath.keywords).toContain('jwt');
      });

      it('should identify payment critical paths', async () => {
        const mockExec = vi.fn().mockImplementation((command: string, callback: Function) => {
          if (command.includes('payment\\|billing\\|stripe')) {
            callback(null, { stdout: './src/payment.ts' });
          } else {
            callback(null, { stdout: '' });
          }
        });

        const childProcess = require('child_process');
        childProcess.exec = mockExec;

        const criticalPaths = await idleProcessor['identifyCriticalPaths']();

        const paymentPaths = criticalPaths.filter(p => p.type === 'payment');
        expect(paymentPaths.length).toBeGreaterThan(0);

        const paymentPath = paymentPaths[0];
        expect(paymentPath.type).toBe('payment');
        expect(paymentPath.file).toContain('payment.ts');
        expect(paymentPath.criticality).toBe('critical');
        expect(paymentPath.keywords).toContain('payment');
      });

      it('should identify data processing critical paths', async () => {
        const mockExec = vi.fn().mockImplementation((command: string, callback: Function) => {
          if (command.includes('process.*data\\|import.*csv')) {
            callback(null, { stdout: './src/data-processor.ts' });
          } else {
            callback(null, { stdout: '' });
          }
        });

        const childProcess = require('child_process');
        childProcess.exec = mockExec;

        const criticalPaths = await idleProcessor['identifyCriticalPaths']();

        const dataPaths = criticalPaths.filter(p => p.type === 'data_processing');
        expect(dataPaths.length).toBeGreaterThan(0);

        const dataPath = dataPaths[0];
        expect(dataPath.type).toBe('data_processing');
        expect(dataPath.file).toContain('data-processor.ts');
        expect(dataPath.criticality).toBe('high');
        expect(dataPath.keywords).toContain('data');
      });

      it('should identify API endpoint critical paths', async () => {
        const mockExec = vi.fn().mockImplementation((command: string, callback: Function) => {
          if (command.includes('app\\.')) {
            callback(null, { stdout: './src/api.ts' });
          } else {
            callback(null, { stdout: '' });
          }
        });

        const childProcess = require('child_process');
        childProcess.exec = mockExec;

        const criticalPaths = await idleProcessor['identifyCriticalPaths']();

        const apiPaths = criticalPaths.filter(p => p.type === 'api_endpoint');
        expect(apiPaths.length).toBeGreaterThan(0);

        const apiPath = apiPaths[0];
        expect(apiPath.type).toBe('api_endpoint');
        expect(apiPath.file).toContain('api.ts');
        expect(apiPath.keywords).toContain('express');
      });

      it('should identify database operation critical paths', async () => {
        const mockExec = vi.fn().mockImplementation((command: string, callback: Function) => {
          if (command.includes('query\\|execute\\|findOne')) {
            callback(null, { stdout: './src/db.ts' });
          } else {
            callback(null, { stdout: '' });
          }
        });

        const childProcess = require('child_process');
        childProcess.exec = mockExec;

        const criticalPaths = await idleProcessor['identifyCriticalPaths']();

        const dbPaths = criticalPaths.filter(p => p.type === 'database_operation');
        expect(dbPaths.length).toBeGreaterThan(0);

        const dbPath = dbPaths[0];
        expect(dbPath.type).toBe('database_operation');
        expect(dbPath.file).toContain('db.ts');
        expect(dbPath.keywords).toContain('database');
      });

      it('should identify external service critical paths', async () => {
        const mockExec = vi.fn().mockImplementation((command: string, callback: Function) => {
          if (command.includes('fetch\\|axios\\|http')) {
            callback(null, { stdout: './src/service.ts' });
          } else {
            callback(null, { stdout: '' });
          }
        });

        const childProcess = require('child_process');
        childProcess.exec = mockExec;

        const criticalPaths = await idleProcessor['identifyCriticalPaths']();

        const servicePaths = criticalPaths.filter(p => p.type === 'external_service');
        expect(servicePaths.length).toBeGreaterThan(0);

        const servicePath = servicePaths[0];
        expect(servicePath.type).toBe('external_service');
        expect(servicePath.file).toContain('service.ts');
        expect(servicePath.keywords).toContain('http');
      });

      it('should handle exec command errors gracefully', async () => {
        const mockExec = vi.fn().mockImplementation((command: string, callback: Function) => {
          callback(new Error('Command failed'));
        });

        const childProcess = require('child_process');
        childProcess.exec = mockExec;

        const criticalPaths = await idleProcessor['identifyCriticalPaths']();

        expect(Array.isArray(criticalPaths)).toBe(true);
        expect(criticalPaths).toEqual([]);
      });

      it('should handle file read errors gracefully', async () => {
        const mockExec = vi.fn().mockImplementation((command: string, callback: Function) => {
          callback(null, { stdout: './src/auth.ts' });
        });

        const childProcess = require('child_process');
        childProcess.exec = mockExec;

        // Mock readFileContent to throw error
        vi.spyOn(idleProcessor as any, 'readFileContent').mockRejectedValue(new Error('File not found'));

        const criticalPaths = await idleProcessor['identifyCriticalPaths']();

        // Should still return array, just empty due to file read errors
        expect(Array.isArray(criticalPaths)).toBe(true);
      });

      it('should assign correct criticality levels', async () => {
        const mockExec = vi.fn().mockImplementation((command: string, callback: Function) => {
          if (command.includes('app\\.')) {
            callback(null, { stdout: './src/auth-api.ts\n./src/payment-api.ts\n./src/user-api.ts\n./src/general-api.ts' });
          } else {
            callback(null, { stdout: '' });
          }
        });

        const childProcess = require('child_process');
        childProcess.exec = mockExec;

        // Mock different file contents to test criticality assignment
        vi.spyOn(idleProcessor as any, 'readFileContent').mockImplementation(async (filePath: string) => {
          if (filePath.includes('auth-api.ts')) {
            return 'app.post("/login", authenticate); const jwt = require("jsonwebtoken");';
          } else if (filePath.includes('payment-api.ts')) {
            return 'app.post("/charge", processPayment); const stripe = require("stripe");';
          } else if (filePath.includes('user-api.ts')) {
            return 'app.get("/users", getUsers); app.post("/users", createUser);';
          } else if (filePath.includes('general-api.ts')) {
            return 'app.get("/health", healthCheck);';
          }
          return '';
        });

        const criticalPaths = await idleProcessor['identifyCriticalPaths']();

        const authApi = criticalPaths.find(p => p.file.includes('auth-api.ts'));
        const paymentApi = criticalPaths.find(p => p.file.includes('payment-api.ts'));
        const userApi = criticalPaths.find(p => p.file.includes('user-api.ts'));
        const generalApi = criticalPaths.find(p => p.file.includes('general-api.ts'));

        expect(authApi?.criticality).toBe('critical');
        expect(paymentApi?.criticality).toBe('critical');
        expect(userApi?.criticality).toBe('high');
        expect(generalApi?.criticality).toBe('high'); // default for API endpoints
      });
    });

    describe('checkIntegrationTestCoverage', () => {
      const mockCriticalPaths = [
        {
          type: 'authentication' as const,
          file: 'src/auth.ts',
          description: 'Auth logic',
          keywords: ['auth', 'login', 'jwt'],
          criticality: 'critical' as const
        },
        {
          type: 'payment' as const,
          file: 'src/payment.ts',
          description: 'Payment logic',
          keywords: ['payment', 'stripe'],
          criticality: 'critical' as const
        },
        {
          type: 'api_endpoint' as const,
          file: 'src/api.ts',
          description: 'API endpoints',
          keywords: ['express', 'router'],
          criticality: 'high' as const
        }
      ];

      beforeEach(() => {
        const mockExec = vi.fn();
        const childProcess = require('child_process');
        childProcess.exec = mockExec;

        // Mock readFileContent method
        vi.spyOn(idleProcessor as any, 'readFileContent').mockImplementation(async (filePath: string) => {
          if (filePath.includes('auth.integration.test.ts')) {
            return 'describe("Auth Integration", () => { test("login flow", () => {}); });';
          } else if (filePath.includes('api.spec.ts')) {
            return 'describe("API Tests", () => { test("express routes", () => {}); });';
          }
          return '';
        });
      });

      it('should detect integration test coverage by file name match', async () => {
        const mockExec = vi.fn().mockImplementation((command: string, callback: Function) => {
          if (command.includes('integration\\|e2e')) {
            callback(null, {
              stdout: './tests/auth.integration.test.ts\n./tests/api.spec.ts\n./tests/payment.e2e.test.ts'
            });
          } else {
            callback(null, { stdout: '' });
          }
        });

        const childProcess = require('child_process');
        childProcess.exec = mockExec;

        const coverageMap = await idleProcessor['checkIntegrationTestCoverage'](mockCriticalPaths);

        expect(coverageMap.get('src/auth.ts')).toBe(true); // has auth.integration.test.ts
        expect(coverageMap.get('src/payment.ts')).toBe(true); // has payment.e2e.test.ts
        expect(coverageMap.get('src/api.ts')).toBe(true); // has api.spec.ts
      });

      it('should detect integration test coverage by keyword match', async () => {
        const mockExec = vi.fn().mockImplementation((command: string, callback: Function) => {
          callback(null, { stdout: './tests/integration.test.ts' });
        });

        const childProcess = require('child_process');
        childProcess.exec = mockExec;

        // Mock test file content that contains keywords
        vi.spyOn(idleProcessor as any, 'readFileContent').mockImplementation(async (filePath: string) => {
          return 'describe("Integration Tests", () => { test("auth login flow", () => {}); test("payment processing", () => {}); });';
        });

        const coverageMap = await idleProcessor['checkIntegrationTestCoverage'](mockCriticalPaths);

        expect(coverageMap.get('src/auth.ts')).toBe(true); // test content contains 'auth'
        expect(coverageMap.get('src/payment.ts')).toBe(true); // test content contains 'payment'
      });

      it('should detect missing integration test coverage', async () => {
        const mockExec = vi.fn().mockImplementation((command: string, callback: Function) => {
          callback(null, { stdout: './tests/unit.test.ts' }); // No integration test files
        });

        const childProcess = require('child_process');
        childProcess.exec = mockExec;

        vi.spyOn(idleProcessor as any, 'readFileContent').mockResolvedValue('describe("Unit Tests", () => {});');

        const coverageMap = await idleProcessor['checkIntegrationTestCoverage'](mockCriticalPaths);

        expect(coverageMap.get('src/auth.ts')).toBe(false);
        expect(coverageMap.get('src/payment.ts')).toBe(false);
        expect(coverageMap.get('src/api.ts')).toBe(false);
      });

      it('should handle exec command errors gracefully', async () => {
        const mockExec = vi.fn().mockImplementation((command: string, callback: Function) => {
          callback(new Error('Command failed'));
        });

        const childProcess = require('child_process');
        childProcess.exec = mockExec;

        const coverageMap = await idleProcessor['checkIntegrationTestCoverage'](mockCriticalPaths);

        expect(coverageMap instanceof Map).toBe(true);
        expect(coverageMap.size).toBe(0);
      });

      it('should handle file read errors gracefully', async () => {
        const mockExec = vi.fn().mockImplementation((command: string, callback: Function) => {
          callback(null, { stdout: './tests/auth.test.ts' });
        });

        const childProcess = require('child_process');
        childProcess.exec = mockExec;

        vi.spyOn(idleProcessor as any, 'readFileContent').mockRejectedValue(new Error('File not found'));

        const coverageMap = await idleProcessor['checkIntegrationTestCoverage'](mockCriticalPaths);

        // Should still complete and mark as not covered due to read error
        expect(coverageMap.get('src/auth.ts')).toBe(false);
      });
    });

    describe('detectUncoveredComponentInteractions', () => {
      beforeEach(() => {
        const mockExec = vi.fn();
        const childProcess = require('child_process');
        childProcess.exec = mockExec;

        // Mock readFileContent method
        vi.spyOn(idleProcessor as any, 'readFileContent').mockImplementation(async (filePath: string) => {
          if (filePath.includes('complex-component.ts')) {
            return `
              import React from 'react';
              import { Service1 } from './service1';
              import { Service2 } from './service2';
              import { Utils } from './utils';
              import { API } from './api';
              import { Database } from './db';
              import { Logger } from './logger';

              class ComplexComponent {
                method1() {}
                method2() {}
                method3() {}
              }

              function helper1() {}
              function helper2() {}
              function helper3() {}
            `;
          } else if (filePath.includes('simple-component.ts')) {
            return `
              import React from 'react';
              function SimpleComponent() { return <div>Hello</div>; }
            `;
          }
          return '';
        });
      });

      it('should detect complex component interactions without test coverage', async () => {
        const mockExec = vi.fn().mockImplementation((command: string, callback: Function) => {
          if (command.includes('find . -name')) {
            // First call - find component files
            callback(null, { stdout: './src/complex-component.ts\n./src/simple-component.ts' });
          } else if (command.includes('complex-component')) {
            // Second call - check for test coverage of complex component
            callback(null, { stdout: '' }); // No test coverage
          } else if (command.includes('simple-component')) {
            // Third call - check for test coverage of simple component
            callback(null, { stdout: './tests/simple-component.test.ts' }); // Has test coverage
          } else {
            callback(null, { stdout: '' });
          }
        });

        const childProcess = require('child_process');
        childProcess.exec = mockExec;

        const uncoveredInteractions = await idleProcessor['detectUncoveredComponentInteractions']();

        expect(Array.isArray(uncoveredInteractions)).toBe(true);

        const complexComponentReport = uncoveredInteractions.find(
          report => report.criticalPath.includes('complex-component.ts')
        );

        expect(complexComponentReport).toBeDefined();
        expect(complexComponentReport?.description).toContain('6 imports');
        expect(complexComponentReport?.description).toContain('6 definitions'); // 3 methods + 3 functions
        expect(complexComponentReport?.priority).toBe('medium'); // 6 imports <= 10
        expect(complexComponentReport?.relatedFiles).toContain('src/complex-component.ts');
      });

      it('should assign high priority for components with many imports', async () => {
        vi.spyOn(idleProcessor as any, 'readFileContent').mockImplementation(async (filePath: string) => {
          return `
            import A from './a';
            import B from './b';
            import C from './c';
            import D from './d';
            import E from './e';
            import F from './f';
            import G from './g';
            import H from './h';
            import I from './i';
            import J from './j';
            import K from './k';
            import L from './l';

            function component() {}
          `;
        });

        const mockExec = vi.fn().mockImplementation((command: string, callback: Function) => {
          if (command.includes('find . -name')) {
            callback(null, { stdout: './src/high-complexity.ts' });
          } else {
            callback(null, { stdout: '' }); // No test coverage
          }
        });

        const childProcess = require('child_process');
        childProcess.exec = mockExec;

        const uncoveredInteractions = await idleProcessor['detectUncoveredComponentInteractions']();

        expect(uncoveredInteractions.length).toBeGreaterThan(0);
        expect(uncoveredInteractions[0].priority).toBe('high'); // > 10 imports
      });

      it('should not detect simple components without complex interactions', async () => {
        const mockExec = vi.fn().mockImplementation((command: string, callback: Function) => {
          if (command.includes('find . -name')) {
            callback(null, { stdout: './src/simple.ts' });
          } else {
            callback(null, { stdout: '' });
          }
        });

        const childProcess = require('child_process');
        childProcess.exec = mockExec;

        // Mock simple component with few imports and definitions
        vi.spyOn(idleProcessor as any, 'readFileContent').mockResolvedValue(`
          import React from 'react';
          function SimpleComponent() { return <div>Hello</div>; }
        `);

        const uncoveredInteractions = await idleProcessor['detectUncoveredComponentInteractions']();

        expect(uncoveredInteractions).toEqual([]); // Should not detect simple components
      });

      it('should skip components that have test coverage', async () => {
        const mockExec = vi.fn().mockImplementation((command: string, callback: Function) => {
          if (command.includes('find . -name')) {
            callback(null, { stdout: './src/tested-component.ts' });
          } else {
            callback(null, { stdout: './tests/tested-component.test.ts' }); // Has test coverage
          }
        });

        const childProcess = require('child_process');
        childProcess.exec = mockExec;

        // Mock complex component (but it has tests)
        vi.spyOn(idleProcessor as any, 'readFileContent').mockResolvedValue(`
          import A from './a';
          import B from './b';
          import C from './c';
          import D from './d';
          import E from './e';
          import F from './f';

          class Component {
            method1() {}
            method2() {}
            method3() {}
          }
        `);

        const uncoveredInteractions = await idleProcessor['detectUncoveredComponentInteractions']();

        expect(uncoveredInteractions).toEqual([]); // Should skip components with test coverage
      });

      it('should limit results to 5 interactions', async () => {
        // Mock many complex components without tests
        const componentFiles = Array.from({length: 10}, (_, i) => `./src/complex${i}.ts`).join('\n');

        const mockExec = vi.fn().mockImplementation((command: string, callback: Function) => {
          if (command.includes('find . -name')) {
            callback(null, { stdout: componentFiles });
          } else {
            callback(null, { stdout: '' }); // No test coverage for any
          }
        });

        const childProcess = require('child_process');
        childProcess.exec = mockExec;

        // Mock all components as complex
        vi.spyOn(idleProcessor as any, 'readFileContent').mockImplementation(async () => {
          return Array.from({length: 10}, (_, i) => `import Dep${i} from './dep${i}';`).join('\n') +
                 '\nclass Component { method1() {} method2() {} method3() {} }';
        });

        const uncoveredInteractions = await idleProcessor['detectUncoveredComponentInteractions']();

        expect(uncoveredInteractions.length).toBeLessThanOrEqual(5); // Should limit to 5
      });

      it('should handle exec command errors gracefully', async () => {
        const mockExec = vi.fn().mockImplementation((command: string, callback: Function) => {
          callback(new Error('Command failed'));
        });

        const childProcess = require('child_process');
        childProcess.exec = mockExec;

        const uncoveredInteractions = await idleProcessor['detectUncoveredComponentInteractions']();

        expect(uncoveredInteractions).toEqual([]);
      });

      it('should handle file read errors gracefully', async () => {
        const mockExec = vi.fn().mockImplementation((command: string, callback: Function) => {
          callback(null, { stdout: './src/component.ts' });
        });

        const childProcess = require('child_process');
        childProcess.exec = mockExec;

        vi.spyOn(idleProcessor as any, 'readFileContent').mockRejectedValue(new Error('File not found'));

        const uncoveredInteractions = await idleProcessor['detectUncoveredComponentInteractions']();

        expect(uncoveredInteractions).toEqual([]); // Should handle errors gracefully
      });
    });

    describe('buildMissingTestReports', () => {
      const mockCriticalPaths = [
        {
          type: 'authentication' as const,
          file: 'src/auth.ts',
          description: 'Auth logic',
          keywords: ['auth', 'login'],
          criticality: 'high' as const
        },
        {
          type: 'payment' as const,
          file: 'src/payment.ts',
          description: 'Payment logic',
          keywords: ['payment'],
          criticality: 'medium' as const
        },
        {
          type: 'api_endpoint' as const,
          file: 'src/api.ts',
          description: 'API endpoints',
          keywords: ['express'],
          criticality: 'high' as const
        },
        {
          type: 'database_operation' as const,
          file: 'src/db.ts',
          description: 'DB operations',
          keywords: ['database'],
          criticality: 'critical' as const
        }
      ];

      it('should build missing test reports for uncovered critical paths', async () => {
        const mockCoverageMap = new Map([
          ['src/auth.ts', false],
          ['src/payment.ts', false],
          ['src/api.ts', true], // Has coverage
          ['src/db.ts', false]
        ]);

        const reports = idleProcessor['buildMissingTestReports'](mockCriticalPaths, mockCoverageMap);

        expect(reports).toHaveLength(3); // Only 3 without coverage

        // Check auth report
        const authReport = reports.find(r => r.criticalPath.includes('auth.ts'));
        expect(authReport).toBeDefined();
        expect(authReport?.priority).toBe('critical'); // Always critical for auth
        expect(authReport?.description).toContain('authentication logic');
        expect(authReport?.description).toContain('login flows');

        // Check payment report
        const paymentReport = reports.find(r => r.criticalPath.includes('payment.ts'));
        expect(paymentReport).toBeDefined();
        expect(paymentReport?.priority).toBe('critical'); // Always critical for payment
        expect(paymentReport?.description).toContain('payment processing');
        expect(paymentReport?.description).toContain('transaction flows');

        // Check db report
        const dbReport = reports.find(r => r.criticalPath.includes('db.ts'));
        expect(dbReport).toBeDefined();
        expect(dbReport?.priority).toBe('critical'); // From input criticality
        expect(dbReport?.description).toContain('database operations');
        expect(dbReport?.description).toContain('transaction integrity');

        // Should NOT include api.ts (has coverage)
        const apiReport = reports.find(r => r.criticalPath.includes('api.ts'));
        expect(apiReport).toBeUndefined();
      });

      it('should sort reports by priority (critical > high > medium > low)', async () => {
        const mixedPaths = [
          { type: 'component_interaction' as const, file: 'low.ts', description: '', keywords: [], criticality: 'low' as const },
          { type: 'api_endpoint' as const, file: 'high.ts', description: '', keywords: [], criticality: 'high' as const },
          { type: 'authentication' as const, file: 'critical.ts', description: '', keywords: [], criticality: 'high' as const }, // Will become critical
          { type: 'data_processing' as const, file: 'medium.ts', description: '', keywords: [], criticality: 'medium' as const }
        ];

        const mockCoverageMap = new Map([
          ['low.ts', false],
          ['high.ts', false],
          ['critical.ts', false],
          ['medium.ts', false]
        ]);

        const reports = idleProcessor['buildMissingTestReports'](mixedPaths, mockCoverageMap);

        expect(reports).toHaveLength(4);

        // Should be sorted by priority
        expect(reports[0].priority).toBe('critical');
        expect(reports[1].priority).toBe('high');
        expect(reports[2].priority).toBe('medium');
        expect(reports[3].priority).toBe('low');
      });

      it('should generate type-specific descriptions', async () => {
        const typedPaths = [
          { type: 'authentication' as const, file: 'auth.ts', description: '', keywords: [], criticality: 'high' as const },
          { type: 'payment' as const, file: 'pay.ts', description: '', keywords: [], criticality: 'high' as const },
          { type: 'data_processing' as const, file: 'data.ts', description: '', keywords: [], criticality: 'high' as const },
          { type: 'api_endpoint' as const, file: 'api.ts', description: '', keywords: [], criticality: 'high' as const },
          { type: 'database_operation' as const, file: 'db.ts', description: '', keywords: [], criticality: 'high' as const },
          { type: 'external_service' as const, file: 'service.ts', description: '', keywords: [], criticality: 'high' as const },
          { type: 'component_interaction' as const, file: 'comp.ts', description: '', keywords: [], criticality: 'high' as const }
        ];

        const mockCoverageMap = new Map(typedPaths.map(p => [p.file, false]));
        const reports = idleProcessor['buildMissingTestReports'](typedPaths, mockCoverageMap);

        // Check type-specific descriptions
        expect(reports.find(r => r.criticalPath.includes('auth.ts'))?.description).toContain('authentication logic');
        expect(reports.find(r => r.criticalPath.includes('pay.ts'))?.description).toContain('payment processing');
        expect(reports.find(r => r.criticalPath.includes('data.ts'))?.description).toContain('data processing');
        expect(reports.find(r => r.criticalPath.includes('api.ts'))?.description).toContain('API endpoints');
        expect(reports.find(r => r.criticalPath.includes('db.ts'))?.description).toContain('database operations');
        expect(reports.find(r => r.criticalPath.includes('service.ts'))?.description).toContain('external service calls');
        expect(reports.find(r => r.criticalPath.includes('comp.ts'))?.description).toContain('component interactions');
      });

      it('should include related files in reports', async () => {
        const mockCoverageMap = new Map([['src/auth.ts', false]]);

        const reports = idleProcessor['buildMissingTestReports'](
          [mockCriticalPaths[0]], // Just auth path
          mockCoverageMap
        );

        expect(reports).toHaveLength(1);
        expect(reports[0].relatedFiles).toEqual(['src/auth.ts']);
      });

      it('should handle empty critical paths', async () => {
        const reports = idleProcessor['buildMissingTestReports']([], new Map());
        expect(reports).toEqual([]);
      });

      it('should handle all paths having coverage', async () => {
        const mockCoverageMap = new Map([
          ['src/auth.ts', true],
          ['src/payment.ts', true]
        ]);

        const reports = idleProcessor['buildMissingTestReports'](
          mockCriticalPaths.slice(0, 2),
          mockCoverageMap
        );

        expect(reports).toEqual([]); // No missing tests
      });
    });

    describe('readFileContent', () => {
      it('should read file content successfully', async () => {
        const mockContent = 'export function test() { return true; }';
        vi.mocked(fs.readFile).mockResolvedValue(mockContent);

        const content = await idleProcessor['readFileContent']('test.ts');

        expect(content).toBe(mockContent);
        expect(fs.readFile).toHaveBeenCalledWith(
          expect.stringContaining('test.ts'),
          'utf-8'
        );
      });

      it('should return empty string on file read error', async () => {
        vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));

        const content = await idleProcessor['readFileContent']('nonexistent.ts');

        expect(content).toBe('');
      });

      it('should construct correct file path', async () => {
        vi.mocked(fs.readFile).mockResolvedValue('content');

        await idleProcessor['readFileContent']('src/components/test.ts');

        expect(fs.readFile).toHaveBeenCalledWith(
          expect.stringContaining('/test/project/src/components/test.ts'),
          'utf-8'
        );
      });
    });
  });

  describe('strategy configuration', () => {
    describe('IdleTaskGenerator integration', () => {
      let mockAnalysis: ProjectAnalysis;

      beforeEach(() => {
        mockAnalysis = {
          codebaseSize: { files: 50, lines: 5000, languages: { ts: 40, js: 10 } },
          testCoverage: { percentage: 60, uncoveredFiles: ['src/utils.ts', 'src/helpers.ts'] },
          dependencies: {
            outdated: ['lodash@^4.17.15', 'moment@^2.29.1'],
            security: ['lodash@^4.17.15']
          },
          codeQuality: {
            lintIssues: 25,
            duplicatedCode: [],
            complexityHotspots: ['src/complex.ts', 'src/large.ts']
          },
          documentation: {
            coverage: 40,
            missingDocs: ['src/core.ts', 'src/utils.ts']
          },
          performance: {
            slowTests: ['test/slow.test.ts'],
            bottlenecks: ['src/heavy.ts']
          },
        };
      });

      it('should initialize IdleTaskGenerator with custom strategy weights', () => {
        const customWeights = {
          maintenance: 0.4,
          refactoring: 0.3,
          docs: 0.2,
          tests: 0.1
        };

        const customConfig = {
          idleProcessing: {
            enabled: true,
            idleThreshold: 300000,
            taskGenerationInterval: 3600000,
            maxIdleTasks: 5,
            strategyWeights: customWeights
          }
        };

        const processor = new IdleProcessor('/test/project', customConfig, mockStore);

        // Verify the task generator was initialized with custom weights
        const taskGenerator = processor['taskGenerator'];
        expect(taskGenerator).toBeDefined();
        expect(taskGenerator.getWeights()).toEqual(customWeights);
      });

      it('should use default weights when none are provided', () => {
        const defaultConfig = {
          idleProcessing: {
            enabled: true,
            idleThreshold: 300000,
            taskGenerationInterval: 3600000,
            maxIdleTasks: 3
            // No strategyWeights provided
          }
        };

        const processor = new IdleProcessor('/test/project', defaultConfig, mockStore);

        const taskGenerator = processor['taskGenerator'];
        const weights = taskGenerator.getWeights();

        // Should use default equal weights
        expect(weights.maintenance).toBe(0.25);
        expect(weights.refactoring).toBe(0.25);
        expect(weights.docs).toBe(0.25);
        expect(weights.tests).toBe(0.25);
      });

      it('should reset task generator between cycles', async () => {
        // Mock successful project analysis
        vi.spyOn(idleProcessor as any, 'analyzeProject').mockResolvedValue(mockAnalysis);

        // Mock task generation to return tasks
        vi.spyOn(idleProcessor['taskGenerator'], 'generateTask')
          .mockReturnValueOnce({
            id: 'task1',
            type: 'maintenance',
            title: 'Update dependencies',
            description: 'Update outdated packages',
            priority: 'medium',
            estimatedEffort: 'small',
            suggestedWorkflow: 'maintenance',
            rationale: 'Security and stability',
            createdAt: new Date(),
            implemented: false
          })
          .mockReturnValueOnce(null); // Second call returns null

        const resetSpy = vi.spyOn(idleProcessor['taskGenerator'], 'reset');

        await idleProcessor.processIdleTime();

        // Should call reset before generating tasks
        expect(resetSpy).toHaveBeenCalled();
      });

      it('should generate tasks using weighted strategy selection', async () => {
        const maintenanceBiasedWeights = {
          maintenance: 0.7,
          refactoring: 0.1,
          docs: 0.1,
          tests: 0.1
        };

        const biasedConfig = {
          idleProcessing: {
            enabled: true,
            idleThreshold: 300000,
            taskGenerationInterval: 3600000,
            maxIdleTasks: 10,
            strategyWeights: maintenanceBiasedWeights
          }
        };

        const processor = new IdleProcessor('/test/project', biasedConfig, mockStore);

        // Mock successful project analysis
        vi.spyOn(processor as any, 'analyzeProject').mockResolvedValue(mockAnalysis);

        // Track task generation calls
        const generateTaskSpy = vi.spyOn(processor['taskGenerator'], 'generateTask');

        // Mock task generation to return tasks of different types
        generateTaskSpy
          .mockReturnValueOnce({
            id: 'task1',
            type: 'maintenance',
            title: 'Update dependencies',
            description: 'Update lodash',
            priority: 'high',
            estimatedEffort: 'small',
            suggestedWorkflow: 'maintenance',
            rationale: 'Security fix',
            createdAt: new Date(),
            implemented: false
          })
          .mockReturnValueOnce({
            id: 'task2',
            type: 'maintenance',
            title: 'Fix security issue',
            description: 'Update vulnerable package',
            priority: 'high',
            estimatedEffort: 'small',
            suggestedWorkflow: 'maintenance',
            rationale: 'Security fix',
            createdAt: new Date(),
            implemented: false
          })
          .mockReturnValue(null); // Subsequent calls return null

        await processor.processIdleTime();

        // Should call generateTask multiple times with the analysis
        expect(generateTaskSpy).toHaveBeenCalledWith(mockAnalysis);
        expect(generateTaskSpy).toHaveBeenCalledTimes(2); // Called until null or max reached
      });

      it('should respect maxIdleTasks limit', async () => {
        const limitedConfig = {
          idleProcessing: {
            enabled: true,
            idleThreshold: 300000,
            taskGenerationInterval: 3600000,
            maxIdleTasks: 2 // Limited to 2 tasks
          }
        };

        const processor = new IdleProcessor('/test/project', limitedConfig, mockStore);

        // Mock successful project analysis
        vi.spyOn(processor as any, 'analyzeProject').mockResolvedValue(mockAnalysis);

        // Mock task generation to always return tasks
        const generateTaskSpy = vi.spyOn(processor['taskGenerator'], 'generateTask');
        generateTaskSpy.mockImplementation(() => ({
          id: `task-${Date.now()}-${Math.random()}`,
          type: 'maintenance',
          title: 'Sample task',
          description: 'Sample description',
          priority: 'medium',
          estimatedEffort: 'small',
          suggestedWorkflow: 'maintenance',
          rationale: 'Sample rationale',
          createdAt: new Date(),
          implemented: false
        }));

        await processor.processIdleTime();

        // Should limit generation to maxIdleTasks
        expect(generateTaskSpy).toHaveBeenCalledTimes(2); // Only called 2 times due to limit
      });

      it('should handle zero weights gracefully', () => {
        const zeroWeights = {
          maintenance: 0,
          refactoring: 0,
          docs: 0,
          tests: 0
        };

        const zeroConfig = {
          idleProcessing: {
            enabled: true,
            idleThreshold: 300000,
            taskGenerationInterval: 3600000,
            maxIdleTasks: 3,
            strategyWeights: zeroWeights
          }
        };

        // Should not throw error with zero weights
        const processor = new IdleProcessor('/test/project', zeroConfig, mockStore);

        const taskGenerator = processor['taskGenerator'];
        expect(taskGenerator).toBeDefined();
        expect(taskGenerator.getWeights()).toEqual(zeroWeights);

        // selectTaskType should fall back to uniform distribution
        const taskType = taskGenerator.selectTaskType();
        expect(['maintenance', 'refactoring', 'docs', 'tests']).toContain(taskType);
      });

      it('should handle partial weights configuration', () => {
        const partialWeights = {
          maintenance: 0.6,
          tests: 0.4
          // refactoring and docs not specified
        };

        const partialConfig = {
          idleProcessing: {
            enabled: true,
            idleThreshold: 300000,
            taskGenerationInterval: 3600000,
            maxIdleTasks: 3,
            strategyWeights: partialWeights
          }
        };

        const processor = new IdleProcessor('/test/project', partialConfig, mockStore);

        const taskGenerator = processor['taskGenerator'];
        const weights = taskGenerator.getWeights();

        // Should merge with defaults
        expect(weights.maintenance).toBe(0.6);
        expect(weights.tests).toBe(0.4);
        expect(weights.refactoring).toBe(0.25); // Default value
        expect(weights.docs).toBe(0.25); // Default value
      });

      it('should track used candidates to avoid duplicates', async () => {
        // Mock successful project analysis
        vi.spyOn(idleProcessor as any, 'analyzeProject').mockResolvedValue(mockAnalysis);

        const taskGenerator = idleProcessor['taskGenerator'];
        const getUsedCandidatesSpy = vi.spyOn(taskGenerator, 'getUsedCandidates');

        // Mock task generation to return the same task multiple times
        const mockTask = {
          id: 'task1',
          type: 'maintenance',
          title: 'Update lodash',
          description: 'Update to latest version',
          priority: 'high',
          estimatedEffort: 'small',
          suggestedWorkflow: 'maintenance',
          rationale: 'Security fix',
          createdAt: new Date(),
          implemented: false
        };

        let callCount = 0;
        vi.spyOn(taskGenerator, 'generateTask').mockImplementation(() => {
          callCount++;
          if (callCount <= 2) {
            return mockTask;
          }
          return null;
        });

        await idleProcessor.processIdleTime();

        // Should track used candidates
        expect(getUsedCandidatesSpy).toHaveBeenCalled();
      });

      it('should handle task generation errors gracefully', async () => {
        // Mock successful project analysis
        vi.spyOn(idleProcessor as any, 'analyzeProject').mockResolvedValue(mockAnalysis);

        // Mock task generation to throw error
        vi.spyOn(idleProcessor['taskGenerator'], 'generateTask').mockImplementation(() => {
          throw new Error('Task generation failed');
        });

        // Should not throw error, should continue processing
        await expect(idleProcessor.processIdleTime()).resolves.not.toThrow();
      });

      it('should create enhanced task generator with project path', () => {
        const projectPath = '/test/custom/project';
        const processor = new IdleProcessor(projectPath, mockConfig, mockStore);

        const taskGenerator = processor['taskGenerator'];
        expect(taskGenerator).toBeDefined();

        // Enhanced generator should be created with enhanced capabilities
        // We can't directly test the internal projectPath, but we can verify it was created
        expect(taskGenerator.getWeights()).toBeDefined();
      });

      it('should select different task types based on weights', () => {
        // Test with heavily biased weights
        const biasedWeights = {
          maintenance: 0.9,
          refactoring: 0.05,
          docs: 0.03,
          tests: 0.02
        };

        const biasedConfig = {
          idleProcessing: {
            enabled: true,
            idleThreshold: 300000,
            taskGenerationInterval: 3600000,
            maxIdleTasks: 3,
            strategyWeights: biasedWeights
          }
        };

        const processor = new IdleProcessor('/test/project', biasedConfig, mockStore);
        const taskGenerator = processor['taskGenerator'];

        // Mock Math.random to control selection
        const originalRandom = Math.random;

        // Test selection with different random values
        Math.random = vi.fn(() => 0.1); // Should select maintenance (weight 0.9)
        expect(taskGenerator.selectTaskType()).toBe('maintenance');

        Math.random = vi.fn(() => 0.95); // Should select refactoring (cumulative 0.95)
        expect(taskGenerator.selectTaskType()).toBe('refactoring');

        Math.random = vi.fn(() => 0.98); // Should select docs (cumulative 0.98)
        expect(taskGenerator.selectTaskType()).toBe('docs');

        Math.random = vi.fn(() => 0.99); // Should select tests (cumulative 1.0)
        expect(taskGenerator.selectTaskType()).toBe('tests');

        // Restore original Math.random
        Math.random = originalRandom;
      });

      it('should handle edge case when random equals total weight', () => {
        const processor = idleProcessor;
        const taskGenerator = processor['taskGenerator'];

        // Mock Math.random to return exactly the total weight
        const originalRandom = Math.random;
        Math.random = vi.fn(() => 1.0);

        // Should fall back to last task type
        const taskType = taskGenerator.selectTaskType();
        expect(taskType).toBe('tests'); // Last in the array

        // Restore original Math.random
        Math.random = originalRandom;
      });
    });
  });

  describe('error handling and edge cases', () => {
    describe('execAsync error handling', () => {
      it('should handle exec command timeouts gracefully', async () => {
        // Mock execAsync to simulate timeout
        const originalExecAsync = idleProcessor['execAsync'];
        idleProcessor['execAsync'] = vi.fn().mockRejectedValue(new Error('Command timed out'));

        await expect(idleProcessor.processIdleTime()).resolves.not.toThrow();

        // Restore original method
        idleProcessor['execAsync'] = originalExecAsync;
      });

      it('should handle malformed command output', async () => {
        const mockExec = vi.fn().mockImplementation((command: string, callback: Function) => {
          // Return malformed JSON for eslint command
          if (command.includes('eslint')) {
            callback(null, { stdout: 'invalid json {not json}' });
          } else {
            callback(null, { stdout: '0' });
          }
        });

        const childProcess = require('child_process');
        childProcess.exec = mockExec;

        await expect(idleProcessor.processIdleTime()).resolves.not.toThrow();
      });

      it('should handle empty command output', async () => {
        const mockExec = vi.fn().mockImplementation((command: string, callback: Function) => {
          callback(null, { stdout: '' });
        });

        const childProcess = require('child_process');
        childProcess.exec = mockExec;

        await expect(idleProcessor.processIdleTime()).resolves.not.toThrow();
      });
    });

    describe('file system edge cases', () => {
      it('should handle permission denied errors', async () => {
        vi.mocked(fs.readFile).mockRejectedValue(new Error('EACCES: permission denied'));

        await expect(idleProcessor.processIdleTime()).resolves.not.toThrow();
      });

      it('should handle file not found errors', async () => {
        vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT: no such file or directory'));

        await expect(idleProcessor.processIdleTime()).resolves.not.toThrow();
      });

      it('should handle extremely large files', async () => {
        // Mock a very large file content
        const largeContent = 'x'.repeat(1000000);
        vi.mocked(fs.readFile).mockResolvedValue(largeContent);

        await expect(idleProcessor.processIdleTime()).resolves.not.toThrow();
      });

      it('should handle binary files', async () => {
        // Mock binary file content
        const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xFF, 0xFE, 0xFD]).toString();
        vi.mocked(fs.readFile).mockResolvedValue(binaryContent);

        await expect(idleProcessor.processIdleTime()).resolves.not.toThrow();
      });

      it('should handle files with special characters', async () => {
        const specialContent = 'content with special chars: \u0000 \uFFFF 🚀 \n\r\t';
        vi.mocked(fs.readFile).mockResolvedValue(specialContent);

        await expect(idleProcessor.processIdleTime()).resolves.not.toThrow();
      });
    });

    describe('task store edge cases', () => {
      it('should handle store create task errors', async () => {
        vi.mocked(mockStore.createIdleTask).mockRejectedValue(new Error('Database connection failed'));

        // Mock successful analysis
        const mockAnalysis = {
          codebaseSize: { files: 10, lines: 1000, languages: { ts: 10 } },
          dependencies: { outdated: [], security: [] },
          codeQuality: { lintIssues: 0, duplicatedCode: [], complexityHotspots: [] },
          documentation: { coverage: 50, missingDocs: [] },
          performance: { slowTests: [], bottlenecks: [] },
        };

        vi.spyOn(idleProcessor as any, 'analyzeProject').mockResolvedValue(mockAnalysis);

        await expect(idleProcessor.processIdleTime()).resolves.not.toThrow();
      });

      it('should handle store query errors', async () => {
        vi.mocked(mockStore.listIdleTasks).mockRejectedValue(new Error('Database query failed'));

        const tasks = await idleProcessor.getGeneratedTasks();
        expect(tasks).toEqual([]);
      });

      it('should handle store delete errors', async () => {
        vi.mocked(mockStore.deleteIdleTask).mockRejectedValue(new Error('Delete failed'));

        await expect(idleProcessor.dismissIdleTask('task-id')).resolves.not.toThrow();
      });
    });

    describe('configuration edge cases', () => {
      it('should handle missing config properties', () => {
        const minimalConfig = {} as any;

        expect(() => new IdleProcessor('/test', minimalConfig, mockStore)).not.toThrow();
      });

      it('should handle negative thresholds', () => {
        const negativeConfig = {
          idleProcessing: {
            enabled: true,
            idleThreshold: -1000,
            taskGenerationInterval: -500,
            maxIdleTasks: -5
          }
        };

        expect(() => new IdleProcessor('/test', negativeConfig, mockStore)).not.toThrow();
      });

      it('should handle extremely large configuration values', () => {
        const extremeConfig = {
          idleProcessing: {
            enabled: true,
            idleThreshold: Number.MAX_SAFE_INTEGER,
            taskGenerationInterval: Number.MAX_SAFE_INTEGER,
            maxIdleTasks: 1000000
          }
        };

        expect(() => new IdleProcessor('/test', extremeConfig, mockStore)).not.toThrow();
      });

      it('should handle zero thresholds', () => {
        const zeroConfig = {
          idleProcessing: {
            enabled: true,
            idleThreshold: 0,
            taskGenerationInterval: 0,
            maxIdleTasks: 0
          }
        };

        expect(() => new IdleProcessor('/test', zeroConfig, mockStore)).not.toThrow();
      });
    });

    describe('regex pattern edge cases', () => {
      it('should handle malformed regex patterns in code analysis', async () => {
        // Mock content with problematic regex patterns
        vi.mocked(fs.readFile).mockResolvedValue('const regex = /[unclosed; another = /malformed*/;');

        await expect(idleProcessor.processIdleTime()).resolves.not.toThrow();
      });

      it('should handle very long lines in files', async () => {
        // Mock content with extremely long lines
        const longLine = 'x'.repeat(10000);
        vi.mocked(fs.readFile).mockResolvedValue(`short line\n${longLine}\nanother short line`);

        await expect(idleProcessor.processIdleTime()).resolves.not.toThrow();
      });

      it('should handle empty lines and whitespace-only content', async () => {
        vi.mocked(fs.readFile).mockResolvedValue('\n\n   \n\t\t\n   \n\n');

        await expect(idleProcessor.processIdleTime()).resolves.not.toThrow();
      });
    });

    describe('event emission edge cases', () => {
      it('should handle listener errors gracefully', async () => {
        // Add a listener that throws an error
        idleProcessor.on('analysis:started', () => {
          throw new Error('Listener error');
        });

        await expect(idleProcessor.processIdleTime()).resolves.not.toThrow();
      });

      it('should handle multiple listeners with mixed success', async () => {
        let successCount = 0;
        let errorCount = 0;

        idleProcessor.on('analysis:completed', () => {
          successCount++;
        });

        idleProcessor.on('analysis:completed', () => {
          errorCount++;
          throw new Error('Listener error');
        });

        idleProcessor.on('analysis:completed', () => {
          successCount++;
        });

        await idleProcessor.processIdleTime();

        expect(successCount).toBe(2);
        expect(errorCount).toBe(1);
      });
    });

    describe('concurrent processing edge cases', () => {
      it('should handle multiple concurrent processIdleTime calls', async () => {
        const promises = Array.from({length: 5}, () => idleProcessor.processIdleTime());

        await expect(Promise.all(promises)).resolves.not.toThrow();
      });

      it('should handle rapid successive calls', async () => {
        // Make rapid successive calls
        const rapidCalls = [];
        for (let i = 0; i < 10; i++) {
          rapidCalls.push(idleProcessor.processIdleTime());
        }

        await expect(Promise.all(rapidCalls)).resolves.not.toThrow();
      });
    });

    describe('memory and performance edge cases', () => {
      it('should handle large number of files', async () => {
        // Mock a large number of files
        const manyFiles = Array.from({length: 1000}, (_, i) => `./src/file${i}.ts`).join('\n');

        const mockExec = vi.fn().mockImplementation((command: string, callback: Function) => {
          if (command.includes('find')) {
            callback(null, { stdout: manyFiles });
          } else {
            callback(null, { stdout: '0' });
          }
        });

        const childProcess = require('child_process');
        childProcess.exec = mockExec;

        await expect(idleProcessor.processIdleTime()).resolves.not.toThrow();
      });

      it('should handle large code quality analysis results', async () => {
        // Mock large analysis results
        const largeHotspots = Array.from({length: 500}, (_, i) => `./src/complex${i}.ts`);

        const mockAnalysis = {
          codebaseSize: { files: 1000, lines: 100000, languages: { ts: 800, js: 200 } },
          dependencies: {
            outdated: Array.from({length: 100}, (_, i) => `package${i}@1.0.0`),
            security: Array.from({length: 50}, (_, i) => `vuln-package${i}@1.0.0`)
          },
          codeQuality: {
            lintIssues: 5000,
            duplicatedCode: [],
            complexityHotspots: largeHotspots
          },
          documentation: {
            coverage: 30,
            missingDocs: Array.from({length: 200}, (_, i) => `./src/undocumented${i}.ts`)
          },
          performance: {
            slowTests: Array.from({length: 50}, (_, i) => `./test/slow${i}.test.ts`),
            bottlenecks: Array.from({length: 100}, (_, i) => `./src/slow${i}.ts`)
          },
        };

        vi.spyOn(idleProcessor as any, 'analyzeProject').mockResolvedValue(mockAnalysis);

        await expect(idleProcessor.processIdleTime()).resolves.not.toThrow();
      });
    });

    describe('unicode and encoding edge cases', () => {
      it('should handle unicode file names and content', async () => {
        const unicodeContent = 'function 测试() { return "тест"; } // 🚀 emoji test';
        vi.mocked(fs.readFile).mockResolvedValue(unicodeContent);

        await expect(idleProcessor.processIdleTime()).resolves.not.toThrow();
      });

      it('should handle mixed encoding scenarios', async () => {
        // Simulate mixed encoding issues
        const mixedContent = 'normal text\x80\x81\x82invalid utf8\u0000null char\uFFFFreplacement char';
        vi.mocked(fs.readFile).mockResolvedValue(mixedContent);

        await expect(idleProcessor.processIdleTime()).resolves.not.toThrow();
      });
    });

    describe('task implementation edge cases', () => {
      it('should handle missing idle task during implementation', async () => {
        vi.mocked(mockStore.getIdleTask).mockResolvedValue(null);

        const result = await idleProcessor.implementIdleTask('nonexistent-task');

        expect(result).toBeNull();
      });

      it('should handle task creation failure during implementation', async () => {
        const mockIdleTask = {
          id: 'task-1',
          type: 'maintenance' as const,
          title: 'Test task',
          description: 'Test description',
          priority: 'medium' as const,
          estimatedEffort: 'small' as const,
          suggestedWorkflow: 'maintenance',
          rationale: 'Test rationale',
          createdAt: new Date(),
          implemented: false
        };

        vi.mocked(mockStore.getIdleTask).mockResolvedValue(mockIdleTask);
        vi.mocked(mockStore.createTask).mockRejectedValue(new Error('Task creation failed'));

        const result = await idleProcessor.implementIdleTask('task-1');

        expect(result).toBeNull();
      });

      it('should handle task already implemented scenario', async () => {
        const implementedTask = {
          id: 'task-1',
          type: 'maintenance' as const,
          title: 'Test task',
          description: 'Test description',
          priority: 'medium' as const,
          estimatedEffort: 'small' as const,
          suggestedWorkflow: 'maintenance',
          rationale: 'Test rationale',
          createdAt: new Date(),
          implemented: true,
          implementedTaskId: 'existing-task-id'
        };

        vi.mocked(mockStore.getIdleTask).mockResolvedValue(implementedTask);

        const result = await idleProcessor.implementIdleTask('task-1');

        expect(result).toBe('existing-task-id');
        expect(mockStore.createTask).not.toHaveBeenCalled();
      });
    });

    describe('analyzer integration edge cases', () => {
      it('should handle dynamic import failures gracefully', async () => {
        // Mock dynamic import to fail
        const originalImport = global.import;
        global.import = vi.fn().mockRejectedValue(new Error('Module not found'));

        await expect(idleProcessor.processIdleTime()).resolves.not.toThrow();

        // Restore original import
        if (originalImport) {
          global.import = originalImport;
        }
      });
    });

    describe('extreme input validation', () => {
      it('should handle null and undefined inputs gracefully', async () => {
        // Test utility methods with null inputs
        expect(idleProcessor['getDefaultIndicators']('')).toEqual(['']);
        expect(idleProcessor['getDefaultDescription']('')).toBe(' section');
        expect(idleProcessor['normalizeExportType']('')).toBe('function');
        expect(idleProcessor['isExportPublic']('', '')).toBe(true);
        expect(idleProcessor['escapeRegex']('')).toBe('');
      });

      it('should handle very long strings in utility methods', async () => {
        const longString = 'x'.repeat(10000);

        expect(idleProcessor['getDefaultIndicators'](longString)).toEqual([longString]);
        expect(idleProcessor['getDefaultDescription'](longString)).toContain('section');
        expect(idleProcessor['normalizeExportType'](longString)).toBe('function');
        expect(typeof idleProcessor['isExportPublic'](longString, longString)).toBe('boolean');
        expect(typeof idleProcessor['escapeRegex'](longString)).toBe('string');
      });

      it('should handle special characters in all utility methods', async () => {
        const specialChars = '\n\r\t\x00\uFFFF🚀';

        expect(() => idleProcessor['getDefaultIndicators'](specialChars)).not.toThrow();
        expect(() => idleProcessor['getDefaultDescription'](specialChars)).not.toThrow();
        expect(() => idleProcessor['normalizeExportType'](specialChars)).not.toThrow();
        expect(() => idleProcessor['isExportPublic'](specialChars, specialChars)).not.toThrow();
        expect(() => idleProcessor['escapeRegex'](specialChars)).not.toThrow();
      });
    });
  });
});