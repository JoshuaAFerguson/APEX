/**
 * Undo Command Integration Tests
 * Tests the integration between the CLI command and the orchestrator
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import { commands } from '../index.js';
import { Task, UndoOperationResult } from '@apexcli/core';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

describe('Undo Command Integration', () => {
  let tempDir: string;
  let orchestrator: ApexOrchestrator;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  const createMockContext = () => ({
    orchestrator,
    cwd: tempDir,
    initialized: true,
    config: null,
    apiProcess: null,
    webUIProcess: null,
    apiPort: 3000,
    webUIPort: 3001,
  });

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-undo-integration-'));

    await fs.ensureDir(path.join(tempDir, '.apex'));

    const configContent = `
project:
  name: undo-integration-test
  version: 1.0.0
agents:
  developer:
    model: haiku
    autonomy: high
workflows:
  feature:
    stages:
      - name: implementation
        agent: developer
limits:
  maxTokens: 10000
  maxCost: 1.0
`;

    await fs.writeFile(path.join(tempDir, '.apex', 'config.yaml'), configContent);

    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
    orchestrator = new ApexOrchestrator({ projectPath: tempDir });
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    consoleSpy.mockRestore();
    cwdSpy.mockRestore();
    vi.clearAllMocks();

    if (tempDir && await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  it('should find the undo command with correct properties', () => {
    const undoCommand = commands.find(cmd => cmd.name === 'undo');

    expect(undoCommand).toBeDefined();
    expect(undoCommand!.name).toBe('undo');
    expect(undoCommand!.aliases).toContain('u');
    expect(undoCommand!.description).toContain('Undo the last tool action');
    expect(undoCommand!.usage).toContain('--task-id');
    expect(undoCommand!.usage).toContain('--count');
    expect(undoCommand!.handler).toBeTypeOf('function');
  });

  it('should call handleUndoCommand when executed', async () => {
    const undoCommand = commands.find(cmd => cmd.name === 'undo');

    // This will test the actual command structure
    expect(undoCommand).toBeDefined();
    expect(typeof undoCommand!.handler).toBe('function');

    // Test that the handler can be called (even if it shows usage)
    await expect(undoCommand!.handler(createMockContext(), ['--help'])).resolves.not.toThrow();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Usage: /undo')
    );
  });

  it('should validate orchestrator integration', async () => {
    const undoCommand = commands.find(cmd => cmd.name === 'undo');
    const context = {
      ...createMockContext(),
      initialized: false,
      orchestrator: null,
    };

    await undoCommand!.handler(context, []);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('APEX not initialized')
    );
  });

  it('should handle orchestrator method calls', async () => {
    // Mock the orchestrator methods that the undo command uses
    const getCurrentTaskSpy = vi.spyOn(orchestrator, 'getCurrentTask')
      .mockResolvedValue({
        id: 'test-task',
        description: 'Test task',
        workflow: 'feature',
        autonomy: 'high',
        status: 'completed',
        priority: 'normal',
        effort: 'medium',
        projectPath: tempDir,
        branchName: 'test-branch',
        retryCount: 0,
        maxRetries: 3,
        resumeAttempts: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        usage: {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          estimatedCost: 0.075,
        },
        logs: [],
        artifacts: [],
        iterationHistory: {
          taskId: 'test-task',
          entries: [],
        },
      } as Task);

    const getUndoableActionsSpy = vi.spyOn(orchestrator['toolActionStore'], 'getUndoableActions')
      .mockResolvedValue([]);

    const undoCommand = commands.find(cmd => cmd.name === 'undo');
    await undoCommand!.handler(createMockContext(), []);

    expect(getCurrentTaskSpy).toHaveBeenCalled();
    expect(getUndoableActionsSpy).toHaveBeenCalledWith('test-task');

    getCurrentTaskSpy.mockRestore();
    getUndoableActionsSpy.mockRestore();
  });
});