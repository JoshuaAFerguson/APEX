/**
 * Integration Tests for Iterate Command with Persistence
 * Tests the iterate command with real persistence, history tracking, and session recovery
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import { commands } from '../index.js';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { Task, TaskStatus, IterationHistory, IterationDiff } from '@apexcli/core';

describe('Iterate Command Integration with Persistence', () => {
  let tempDir: string;
  let orchestrator: ApexOrchestrator;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let readlineSpy: ReturnType<typeof vi.spyOn>;

  // Helper to create a test task in the database
  const createTestTask = async (
    taskId: string,
    status: TaskStatus = 'in-progress',
    stage?: string
  ): Promise<Task> => {
    const task: Task = {
      id: taskId,
      title: 'Test Iterate Task',
      description: 'A task for testing iteration functionality',
      status,
      priority: 'normal',
      effort: 'medium',
      currentStage: stage || 'implementation',
      workflowName: 'feature',
      branchName: `apex/${taskId}`,
      projectPath: tempDir,
      createdAt: new Date(),
      updatedAt: new Date(),
      usage: {
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
        estimatedCost: 0.075,
      },
      logs: [
        {
          timestamp: new Date(),
          level: 'info',
          stage: 'implementation',
          message: 'Starting implementation phase',
          agent: 'developer',
        },
      ],
      artifacts: [
        {
          type: 'file',
          path: 'src/feature.ts',
          name: 'Initial implementation',
          content: 'export function newFeature() {\n  return "hello";\n}',
        },
      ],
      dependsOn: [],
      blockedBy: [],
      iterationHistory: {
        entries: [],
        totalIterations: 0,
      },
    };

    const store = orchestrator.getTaskStore();
    await store.createTask(task);
    return task;
  };

  beforeEach(async () => {
    // Create temporary directory for test project
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-iterate-test-'));

    // Set up basic project structure
    await fs.ensureDir(path.join(tempDir, '.apex'));

    // Create minimal config
    const configContent = `
project:
  name: test-iterate-project
  version: 1.0.0

agents:
  developer:
    model: haiku
    autonomy: high
  planner:
    model: haiku
    autonomy: medium
  tester:
    model: haiku
    autonomy: medium

workflows:
  feature:
    stages:
      - name: planning
        agent: planner
      - name: implementation
        agent: developer
      - name: testing
        agent: tester

limits:
  maxTokens: 50000
  maxCost: 5.0
  timeout: 300000
`;

    await fs.writeFile(path.join(tempDir, '.apex', 'config.yaml'), configContent);

    // Create agent and workflow files
    await fs.ensureDir(path.join(tempDir, '.apex', 'agents'));
    await fs.writeFile(
      path.join(tempDir, '.apex', 'agents', 'developer.md'),
      '# Developer Agent\n\nYou are a software developer responsible for implementing features.'
    );

    await fs.ensureDir(path.join(tempDir, '.apex', 'workflows'));
    await fs.writeFile(
      path.join(tempDir, '.apex', 'workflows', 'feature.yaml'),
      'name: feature\nstages:\n  - name: planning\n    agent: planner\n  - name: implementation\n    agent: developer\n  - name: testing\n    agent: tester\n'
    );

    // Initialize orchestrator
    orchestrator = new ApexOrchestrator({ projectPath: tempDir });

    // Mock console.log to capture output
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Mock readline for interactive tests
    readlineSpy = vi.spyOn(require('readline'), 'createInterface').mockImplementation(() => ({
      question: vi.fn((query, callback) => callback('Automated test feedback')),
      close: vi.fn(),
    }));
  });

  afterEach(async () => {
    consoleSpy.mockRestore();
    readlineSpy.mockRestore();
    vi.clearAllMocks();

    // Clean up temp directory
    if (tempDir && await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  describe('Basic Iteration Functionality', () => {
    it('should successfully iterate on an in-progress task', async () => {
      const task = await createTestTask('task-iterate-001');
      const iterateCommand = commands.find(cmd => cmd.name === 'iterate');
      expect(iterateCommand).toBeDefined();

      const mockContext = {
        orchestrator,
        cwd: tempDir,
        initialized: true,
        config: null,
        apiProcess: null,
        webUIProcess: null,
        apiPort: 3000,
        webUIPort: 3001,
      };

      // Mock iterateTask to avoid actual Claude API calls
      const mockIterationId = 'task-iterate-001-iter-123456789';
      const iterateTaskSpy = vi.spyOn(orchestrator, 'iterateTask').mockResolvedValue(mockIterationId);

      await iterateCommand!.handler(mockContext, ['task-iterate-001', 'Please add error handling']);

      expect(iterateTaskSpy).toHaveBeenCalledWith('task-iterate-001', 'Please add error handling');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔄 Processing feedback for task task-iterate-001...')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Feedback: "Please add error handling"')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(`✅ Iteration started with ID: ${mockIterationId}`)
      );

      iterateTaskSpy.mockRestore();
    });

    it('should handle interactive mode with user input', async () => {
      await createTestTask('task-interact-001');
      const iterateCommand = commands.find(cmd => cmd.name === 'iterate');

      const mockReadline = {
        question: vi.fn((query, callback) => {
          expect(query).toContain('Enter your feedback for task task-interact-001');
          setTimeout(() => callback('Interactive feedback from test'), 0);
        }),
        close: vi.fn(),
      };

      readlineSpy.mockReturnValue(mockReadline);

      const mockContext = {
        orchestrator,
        cwd: tempDir,
        initialized: true,
        config: null,
        apiProcess: null,
        webUIProcess: null,
        apiPort: 3000,
        webUIPort: 3001,
      };

      const mockIterationId = 'task-interact-001-iter-987654321';
      const iterateTaskSpy = vi.spyOn(orchestrator, 'iterateTask').mockResolvedValue(mockIterationId);

      await iterateCommand!.handler(mockContext, ['task-interact-001']);

      await new Promise(resolve => setTimeout(resolve, 10)); // Wait for async operations

      expect(mockReadline.question).toHaveBeenCalled();
      expect(iterateTaskSpy).toHaveBeenCalledWith('task-interact-001', 'Interactive feedback from test');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(`✅ Iteration started with ID: ${mockIterationId}`)
      );

      iterateTaskSpy.mockRestore();
    });

    it('should reject iteration on non-existent tasks', async () => {
      const iterateCommand = commands.find(cmd => cmd.name === 'iterate');

      const mockContext = {
        orchestrator,
        cwd: tempDir,
        initialized: true,
        config: null,
        apiProcess: null,
        webUIProcess: null,
        apiPort: 3000,
        webUIPort: 3001,
      };

      await iterateCommand!.handler(mockContext, ['nonexistent-task', 'feedback']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Task nonexistent-task not found')
      );
    });

    it('should reject iteration on completed tasks', async () => {
      await createTestTask('completed-task-001', 'completed');
      const iterateCommand = commands.find(cmd => cmd.name === 'iterate');

      const mockContext = {
        orchestrator,
        cwd: tempDir,
        initialized: true,
        config: null,
        apiProcess: null,
        webUIProcess: null,
        apiPort: 3000,
        webUIPort: 3001,
      };

      await iterateCommand!.handler(mockContext, ['completed-task-001', 'feedback']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Task completed-task-001 is not in progress (status: completed)')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Only in-progress tasks can be iterated')
      );
    });
  });

  describe('Iteration History Persistence', () => {
    it('should persist iteration entries in the database', async () => {
      await createTestTask('persist-task-001');

      // Create iteration through InteractionManager
      const interactionManager = orchestrator.getInteractionManager();

      // Mock the actual orchestrator iteration process
      const iterationId = await interactionManager.iterateTask(
        'persist-task-001',
        'Add comprehensive logging'
      );

      expect(iterationId).toMatch(/^persist-task-001-iter-\d+$/);

      // Verify iteration was stored
      const history = await orchestrator.getIterationHistory('persist-task-001');
      expect(history.entries).toHaveLength(1);
      expect(history.totalIterations).toBe(1);
      expect(history.entries[0]).toMatchObject({
        id: iterationId,
        feedback: 'Add comprehensive logging',
        stage: 'implementation',
      });
    });

    it('should track multiple iterations with proper ordering', async () => {
      await createTestTask('multi-iter-001');
      const interactionManager = orchestrator.getInteractionManager();

      // Create multiple iterations
      const firstIteration = await interactionManager.iterateTask(
        'multi-iter-001',
        'First iteration feedback'
      );

      // Wait a bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      const secondIteration = await interactionManager.iterateTask(
        'multi-iter-001',
        'Second iteration feedback'
      );

      const history = await orchestrator.getIterationHistory('multi-iter-001');
      expect(history.entries).toHaveLength(2);
      expect(history.totalIterations).toBe(2);

      // Verify chronological ordering
      expect(history.entries[0].id).toBe(firstIteration);
      expect(history.entries[1].id).toBe(secondIteration);
      expect(history.entries[0].timestamp.getTime()).toBeLessThan(
        history.entries[1].timestamp.getTime()
      );
    });

    it('should maintain iteration history across orchestrator restarts', async () => {
      await createTestTask('restart-test-001');
      const interactionManager = orchestrator.getInteractionManager();

      // Create iteration with first orchestrator instance
      const iterationId = await interactionManager.iterateTask(
        'restart-test-001',
        'Iteration before restart'
      );

      // Create new orchestrator instance (simulating restart)
      const newOrchestrator = new ApexOrchestrator({ projectPath: tempDir });

      // Verify history persists
      const history = await newOrchestrator.getIterationHistory('restart-test-001');
      expect(history.entries).toHaveLength(1);
      expect(history.entries[0]).toMatchObject({
        id: iterationId,
        feedback: 'Iteration before restart',
      });

      // Add another iteration with new instance
      const newInteractionManager = newOrchestrator.getInteractionManager();
      const secondIterationId = await newInteractionManager.iterateTask(
        'restart-test-001',
        'Iteration after restart'
      );

      // Verify both iterations exist
      const updatedHistory = await newOrchestrator.getIterationHistory('restart-test-001');
      expect(updatedHistory.entries).toHaveLength(2);
      expect(updatedHistory.totalIterations).toBe(2);
    });

    it('should store iteration snapshots with before and after states', async () => {
      await createTestTask('snapshot-test-001');
      const interactionManager = orchestrator.getInteractionManager();

      const iterationId = await interactionManager.iterateTask(
        'snapshot-test-001',
        'Add snapshot testing'
      );

      // Simulate completion of iteration with after state
      await interactionManager.completeIteration('snapshot-test-001', iterationId);

      const history = await orchestrator.getIterationHistory('snapshot-test-001');
      const iteration = history.entries.find(e => e.id === iterationId);

      expect(iteration).toBeDefined();
      expect(iteration!.beforeState).toBeDefined();
      expect(iteration!.afterState).toBeDefined();
      expect(iteration!.beforeState!.stage).toBe('implementation');
      expect(iteration!.beforeState!.status).toBe('in-progress');
    });
  });

  describe('Iteration Diff Functionality', () => {
    it('should generate and display iteration diff using --diff flag', async () => {
      await createTestTask('diff-test-001');
      const interactionManager = orchestrator.getInteractionManager();

      // Create iteration and complete it
      const iterationId = await interactionManager.iterateTask(
        'diff-test-001',
        'Add diff testing'
      );
      await interactionManager.completeIteration('diff-test-001', iterationId);

      // Mock getIterationDiff to return predictable data
      const mockDiff: IterationDiff = {
        iterationId,
        previousIterationId: undefined,
        stageChange: undefined,
        statusChange: undefined,
        filesChanged: {
          added: ['src/test-diff.ts'],
          modified: ['src/feature.ts'],
          removed: [],
        },
        tokenUsageDelta: 200,
        costDelta: 0.01,
        summary: '1 files added, 1 files modified, 200 tokens used',
      };

      const getDiffSpy = vi.spyOn(orchestrator, 'getIterationDiff').mockResolvedValue(mockDiff);

      const iterateCommand = commands.find(cmd => cmd.name === 'iterate');
      const mockContext = {
        orchestrator,
        cwd: tempDir,
        initialized: true,
        config: null,
        apiProcess: null,
        webUIProcess: null,
        apiPort: 3000,
        webUIPort: 3001,
      };

      await iterateCommand!.handler(mockContext, ['diff-test-001', '--diff']);

      expect(getDiffSpy).toHaveBeenCalledWith('diff-test-001');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📊 Getting iteration diff for task diff-test-001...')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📈 Iteration Diff:')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Iteration: ${iterationId}`)
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Files Changed:')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Added: src/test-diff.ts')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Modified: src/feature.ts')
      );

      getDiffSpy.mockRestore();
    });

    it('should display detailed diff information with stage changes', async () => {
      await createTestTask('stage-change-001');

      const mockDiff: IterationDiff = {
        iterationId: 'stage-change-001-iter-123',
        previousIterationId: 'stage-change-001-iter-122',
        stageChange: { from: 'implementation', to: 'testing' },
        statusChange: undefined,
        filesChanged: {
          added: ['tests/feature.test.ts'],
          modified: ['src/feature.ts'],
          removed: [],
        },
        tokenUsageDelta: 350,
        costDelta: 0.0175,
        summary: 'Stage: implementation → testing; 1 files added, 1 files modified, 350 tokens used',
      };

      const getDiffSpy = vi.spyOn(orchestrator, 'getIterationDiff').mockResolvedValue(mockDiff);

      const iterateCommand = commands.find(cmd => cmd.name === 'iterate');
      const mockContext = {
        orchestrator,
        cwd: tempDir,
        initialized: true,
        config: null,
        apiProcess: null,
        webUIProcess: null,
        apiPort: 3000,
        webUIPort: 3001,
      };

      await iterateCommand!.handler(mockContext, ['stage-change-001', '--diff']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Stage: implementation → testing')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Token Usage: +350')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cost: +$0.02')
      );

      getDiffSpy.mockRestore();
    });

    it('should handle diff errors gracefully', async () => {
      await createTestTask('diff-error-001');

      const getDiffSpy = vi.spyOn(orchestrator, 'getIterationDiff')
        .mockRejectedValue(new Error('No iterations found for task diff-error-001'));

      const iterateCommand = commands.find(cmd => cmd.name === 'iterate');
      const mockContext = {
        orchestrator,
        cwd: tempDir,
        initialized: true,
        config: null,
        apiProcess: null,
        webUIProcess: null,
        apiPort: 3000,
        webUIPort: 3001,
      };

      await iterateCommand!.handler(mockContext, ['diff-error-001', '--diff']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Failed to get diff: Error: No iterations found for task diff-error-001')
      );

      getDiffSpy.mockRestore();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle database connection errors gracefully', async () => {
      // Create orchestrator with invalid path to trigger errors
      const invalidOrchestrator = new ApexOrchestrator({ projectPath: '/invalid/nonexistent/path' });

      const iterateCommand = commands.find(cmd => cmd.name === 'iterate');
      const mockContext = {
        orchestrator: invalidOrchestrator,
        cwd: '/invalid/nonexistent/path',
        initialized: false,
        config: null,
        apiProcess: null,
        webUIProcess: null,
        apiPort: 3000,
        webUIPort: 3001,
      };

      await iterateCommand!.handler(mockContext, ['any-task', 'feedback']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/❌.*(failed|error)/i)
      );
    });

    it('should handle empty feedback in interactive mode', async () => {
      await createTestTask('empty-feedback-001');

      const mockReadline = {
        question: vi.fn((query, callback) => {
          setTimeout(() => callback(''), 0); // Empty feedback
        }),
        close: vi.fn(),
      };

      readlineSpy.mockReturnValue(mockReadline);

      const iterateCommand = commands.find(cmd => cmd.name === 'iterate');
      const mockContext = {
        orchestrator,
        cwd: tempDir,
        initialized: true,
        config: null,
        apiProcess: null,
        webUIProcess: null,
        apiPort: 3000,
        webUIPort: 3001,
      };

      await iterateCommand!.handler(mockContext, ['empty-feedback-001']);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️  No feedback provided, iteration cancelled')
      );
    });

    it('should handle concurrent iteration attempts', async () => {
      await createTestTask('concurrent-001');
      const interactionManager = orchestrator.getInteractionManager();

      // Create concurrent iterations
      const [firstResult, secondResult] = await Promise.all([
        interactionManager.iterateTask('concurrent-001', 'First concurrent iteration'),
        interactionManager.iterateTask('concurrent-001', 'Second concurrent iteration'),
      ]);

      expect(firstResult).toMatch(/^concurrent-001-iter-\d+$/);
      expect(secondResult).toMatch(/^concurrent-001-iter-\d+$/);
      expect(firstResult).not.toBe(secondResult);

      const history = await orchestrator.getIterationHistory('concurrent-001');
      expect(history.entries).toHaveLength(2);
      expect(history.totalIterations).toBe(2);
    });
  });

  describe('Real Database Integration', () => {
    it('should use SQLite database correctly', async () => {
      // Verify the database file is created
      const dbPath = path.join(tempDir, '.apex', 'apex.db');
      await createTestTask('db-verify-001');

      expect(await fs.pathExists(dbPath)).toBe(true);

      // Verify the task exists in database
      const task = await orchestrator.getTask('db-verify-001');
      expect(task).toBeDefined();
      expect(task!.id).toBe('db-verify-001');
    });

    it('should maintain data integrity across operations', async () => {
      await createTestTask('integrity-001');
      const interactionManager = orchestrator.getInteractionManager();

      // Perform series of operations
      const iteration1 = await interactionManager.iterateTask('integrity-001', 'First change');
      await interactionManager.completeIteration('integrity-001', iteration1);

      const iteration2 = await interactionManager.iterateTask('integrity-001', 'Second change');
      await interactionManager.completeIteration('integrity-001', iteration2);

      // Verify data integrity
      const history = await orchestrator.getIterationHistory('integrity-001');
      expect(history.entries).toHaveLength(2);
      expect(history.totalIterations).toBe(2);

      // Verify task still exists and is valid
      const task = await orchestrator.getTask('integrity-001');
      expect(task).toBeDefined();
      expect(task!.status).toBe('in-progress');

      // Verify iteration ordering
      expect(history.entries[0].timestamp.getTime()).toBeLessThan(
        history.entries[1].timestamp.getTime()
      );
    });
  });
});