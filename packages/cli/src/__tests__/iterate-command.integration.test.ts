/**
 * Integration Tests for Iterate Command
 * Tests the iterate command with real orchestrator interactions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import { commands } from '../index.js';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

describe('Iterate Command Integration', () => {
  let tempDir: string;
  let orchestrator: ApexOrchestrator;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    // Create temporary directory for test project
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-test-'));

    // Set up basic project structure
    await fs.ensureDir(path.join(tempDir, '.apex'));

    // Create minimal config
    const config = {
      project: {
        name: 'test-project',
        version: '1.0.0',
      },
      agents: {
        developer: { model: 'haiku', autonomy: 'high' },
        tester: { model: 'haiku', autonomy: 'medium' },
      },
      limits: {
        maxTokens: 10000,
        maxCost: 1.0,
        timeout: 300000,
      },
    };

    await fs.writeFile(
      path.join(tempDir, '.apex', 'config.yaml'),
      `project:\n  name: ${config.project.name}\n  version: ${config.project.version}\n\nagents:\n  developer:\n    model: haiku\n    autonomy: high\n  tester:\n    model: haiku\n    autonomy: medium\n\nlimits:\n  maxTokens: ${config.limits.maxTokens}\n  maxCost: ${config.limits.maxCost}\n  timeout: ${config.limits.timeout}\n`
    );

    // Create a basic agent file
    await fs.ensureDir(path.join(tempDir, '.apex', 'agents'));
    await fs.writeFile(
      path.join(tempDir, '.apex', 'agents', 'developer.md'),
      '# Developer Agent\n\nYou are a software developer.'
    );

    // Create a basic workflow file
    await fs.ensureDir(path.join(tempDir, '.apex', 'workflows'));
    await fs.writeFile(
      path.join(tempDir, '.apex', 'workflows', 'feature.yaml'),
      'name: feature\nstages:\n  - name: planning\n    agent: planner\n  - name: implementation\n    agent: developer\n  - name: testing\n    agent: tester\n'
    );

    // Initialize orchestrator
    orchestrator = new ApexOrchestrator({ projectPath: tempDir });

    // Mock console.log to capture output
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    consoleSpy.mockRestore();

    // Clean up temp directory
    if (tempDir && await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  it('should be able to import ApexOrchestrator with iteration methods', async () => {
    try {
      const { ApexOrchestrator } = await import('@apexcli/orchestrator');
      expect(ApexOrchestrator).toBeDefined();
      expect(typeof ApexOrchestrator).toBe('function');

      // Check that the orchestrator has the iteration methods we need
      const testOrchestrator = new ApexOrchestrator({ projectPath: tempDir });
      expect(typeof testOrchestrator.iterateTask).toBe('function');
      expect(typeof testOrchestrator.getIterationDiff).toBe('function');
      expect(typeof testOrchestrator.getIterationHistory).toBe('function');
      expect(typeof testOrchestrator.getInteractionManager).toBe('function');
    } catch (error) {
      console.error('Failed to import ApexOrchestrator with iteration methods:', error);
      throw error;
    }
  });

  it('should handle orchestrator initialization properly', async () => {
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

    // Test with non-existent task
    await iterateCommand!.handler(mockContext, ['nonexistent-task', 'feedback']);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('❌ Task nonexistent-task not found')
    );
  });

  it('should validate task existence before iteration', async () => {
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

    // Try to iterate on a non-existent task
    await iterateCommand!.handler(mockContext, ['task-does-not-exist', 'Some feedback']);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('❌ Task task-does-not-exist not found')
    );
  });

  it('should handle orchestrator errors gracefully', async () => {
    const iterateCommand = commands.find(cmd => cmd.name === 'iterate');

    // Create orchestrator with invalid project path to trigger errors
    const invalidOrchestrator = new ApexOrchestrator({ projectPath: '/invalid/path' });

    const mockContext = {
      orchestrator: invalidOrchestrator,
      cwd: '/invalid/path',
      initialized: false,
      config: null,
      apiProcess: null,
      webUIProcess: null,
      apiPort: 3000,
      webUIPort: 3001,
    };

    // This should handle the error gracefully
    await iterateCommand!.handler(mockContext, ['task-123', 'feedback']);

    // The exact error message may vary, but it should show an error
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringMatching(/❌.*(failed|error)/i)
    );
  });

  it('should display proper diff information when available', async () => {
    const iterateCommand = commands.find(cmd => cmd.name === 'iterate');

    // Mock the getIterationDiff method to return sample data
    const mockDiff = {
      iterationId: 'iter-123',
      previousIterationId: 'iter-122',
      stageChange: { from: 'planning', to: 'implementation' },
      filesChanged: {
        added: ['new-feature.ts'],
        modified: ['existing-file.ts'],
        removed: [],
      },
      metricsChange: {
        tokenUsage: { before: 1000, after: 1200, delta: 200 },
        cost: { before: 0.05, after: 0.07, delta: 0.02 },
        duration: { before: 5000, after: 7000, delta: 2000 },
      },
      summary: 'Added new feature implementation',
    };

    // Spy on the getIterationDiff method
    const diffSpy = vi.spyOn(orchestrator, 'getIterationDiff').mockResolvedValue(mockDiff);

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

    await iterateCommand!.handler(mockContext, ['task-123', '--diff']);

    expect(diffSpy).toHaveBeenCalledWith('task-123');
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('📊 Getting iteration diff for task task-123...')
    );

    diffSpy.mockRestore();
  });

  it('should handle interaction manager availability', async () => {
    const interactionManager = orchestrator.getInteractionManager();
    expect(interactionManager).toBeDefined();
    expect(typeof interactionManager.iterateTask).toBe('function');
    expect(typeof interactionManager.getIterationDiff).toBe('function');
  });

  describe('Real Orchestrator Workflow', () => {
    it('should handle the complete iterate workflow', async () => {
      // This test verifies that the iterate command can interact with real orchestrator methods
      // without actually creating tasks (which would require Claude API calls)

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

      // Test basic command structure and error handling
      await iterateCommand!.handler(mockContext, []);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Usage: /iterate <task-id>')
      );

      // Clear previous calls
      consoleSpy.mockClear();

      // Test with invalid task
      await iterateCommand!.handler(mockContext, ['invalid-task', 'test']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Task invalid-task not found')
      );
    });
  });

  describe('Command Validation', () => {
    it('should properly validate command arguments', async () => {
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

      // Test different argument combinations
      const testCases = [
        { args: [], expectedOutput: 'Usage: /iterate <task-id>' },
        { args: ['task-123', '--diff'], expectedOutput: '📊 Getting iteration diff' },
        { args: ['task-123', 'feedback'], expectedOutput: '❌ Task task-123 not found' },
      ];

      for (const testCase of testCases) {
        consoleSpy.mockClear();
        await iterateCommand!.handler(mockContext, testCase.args);

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining(testCase.expectedOutput)
        );
      }
    });
  });
});