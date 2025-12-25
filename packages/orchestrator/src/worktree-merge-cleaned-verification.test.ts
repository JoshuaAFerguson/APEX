import { describe, it, expect } from 'vitest';
import { OrchestratorEvents } from './index';

/**
 * Simple verification test for OrchestratorEvents worktree:merge-cleaned signature
 */

describe('OrchestratorEvents worktree:merge-cleaned Verification', () => {
  it('should verify OrchestratorEvents signature for worktree:merge-cleaned', () => {
    // This test will fail at compile-time if the signature is not correct
    const handler: OrchestratorEvents['worktree:merge-cleaned'] = (
      taskId: string,
      worktreePath: string,
      prUrl: string
    ) => {
      expect(typeof taskId).toBe('string');
      expect(typeof worktreePath).toBe('string');
      expect(typeof prUrl).toBe('string');
    };

    // Test the handler
    handler('test_task_id', '/test/worktree/path', 'https://github.com/test/repo/pull/123');
  });

  it('should verify handler can be used in EventEmitter pattern', () => {
    // Mock EventEmitter-like usage
    const eventHandlers: Partial<OrchestratorEvents> = {
      'worktree:merge-cleaned': (taskId, worktreePath, prUrl) => {
        console.log(`Cleaned ${worktreePath} for task ${taskId} (${prUrl})`);
      }
    };

    expect(typeof eventHandlers['worktree:merge-cleaned']).toBe('function');

    // Test calling the handler
    if (eventHandlers['worktree:merge-cleaned']) {
      eventHandlers['worktree:merge-cleaned']('task123', '/path/to/worktree', 'https://test.com/pull/456');
    }
  });
});