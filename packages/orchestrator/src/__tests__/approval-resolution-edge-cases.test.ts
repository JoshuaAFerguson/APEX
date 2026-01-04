/**
 * Edge case tests for approval resolution and task resume mechanism
 *
 * Tests comprehensive error scenarios and edge cases including:
 * - Concurrent approval attempts
 * - Malformed event data
 * - Database operation failures
 * - Network/timeout scenarios
 * - Memory and performance edge cases
 * - Race conditions
 */

import { beforeEach, describe, it, expect, vi } from 'vitest';
import { ApexOrchestrator } from '../index';
import { TaskStore } from '../store';
import * as fs from 'fs';
import * as path from 'path';

// Mock the query function
const mockQuery = vi.fn();
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: mockQuery,
}));

// Mock fs operations
vi.mock('fs', () => ({
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(() => ''),
  readdirSync: vi.fn(() => []),
}));

describe('Approval Resolution Edge Cases', () => {
  let orchestrator: ApexOrchestrator;
  let projectPath: string;

  beforeEach(async () => {
    vi.clearAllMocks();

    projectPath = '/tmp/test-approval-edge-cases';

    // Mock configuration files
    (fs.existsSync as any).mockReturnValue(true);
    (fs.readFileSync as any).mockImplementation((filePath: string) => {
      if (filePath.includes('config.yaml')) {
        return `
name: test-project
agents:
  - ./agents
workflows:
  - ./workflows
`;
      }
      if (filePath.includes('feature.yaml')) {
        return `
name: Feature Workflow
stages:
  - name: implementation
    agent: developer
    gate: test-gate

gates:
  - id: test-gate
    name: Test Gate
    required: true
    autoApprove: false
    timeout: 1 # Very short timeout for testing
`;
      }
      return '';
    });

    (fs.readdirSync as any).mockReturnValue(['feature.yaml']);

    orchestrator = new ApexOrchestrator({ projectPath });
    await orchestrator.initialize();
  });

  describe('Concurrent Approval Scenarios', () => {
    it('should handle rapid concurrent approval attempts', async () => {
      const taskId = await orchestrator.createTask('Test concurrent approvals', 'feature');

      mockQuery.mockResolvedValueOnce({
        requestId: 'test-request-1',
        content: [{ type: 'text', text: 'Stage completed' }],
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      let approvalId: string;
      orchestrator.on('approval:required', (event) => {
        approvalId = event.approvalId;
      });

      await orchestrator.runTask(taskId);

      // Attempt multiple concurrent approvals
      const approvalPromises = [
        orchestrator.grantApproval(approvalId!, 'user1', 'First approval'),
        orchestrator.grantApproval(approvalId!, 'user2', 'Second approval'),
        orchestrator.grantApproval(approvalId!, 'user3', 'Third approval'),
      ];

      const results = await Promise.allSettled(approvalPromises);

      // Only one should succeed
      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      expect(successful).toHaveLength(1);
      expect(failed).toHaveLength(2);

      // Verify error messages
      failed.forEach(result => {
        if (result.status === 'rejected') {
          expect(result.reason.message).toContain('Approval request is not pending');
        }
      });

      // Verify final state
      const approvalState = await orchestrator.getApprovalStateById(approvalId!);
      expect(approvalState?.status).toBe('approved');
      expect(['user1', 'user2', 'user3']).toContain(approvalState?.approver);
    });

    it('should handle concurrent event-based and method-based approval', async () => {
      const taskId = await orchestrator.createTask('Test mixed concurrent approval', 'feature');

      mockQuery.mockResolvedValueOnce({
        requestId: 'test-request-1',
        content: [{ type: 'text', text: 'Stage completed' }],
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      let approvalId: string;
      orchestrator.on('approval:required', (event) => {
        approvalId = event.approvalId;
      });

      await orchestrator.runTask(taskId);

      // Attempt concurrent approval via different methods
      const methodPromise = orchestrator.grantApproval(approvalId!, 'method-user', 'Method approval');

      // Slight delay to ensure race condition
      setTimeout(() => {
        orchestrator.emit('approval:decision', {
          approvalId: approvalId!,
          decision: 'approved' as const,
          approver: 'event-user',
          comment: 'Event approval'
        });
      }, 50);

      await methodPromise;
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify only one approval succeeded
      const approvalState = await orchestrator.getApprovalStateById(approvalId!);
      expect(approvalState?.status).toBe('approved');
      expect(approvalState?.approver).toBe('method-user'); // Method call should win
    });
  });

  describe('Malformed Event Data', () => {
    it('should handle approval:decision events with missing required fields', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Missing approvalId
      orchestrator.emit('approval:decision', {
        decision: 'approved' as const,
        approver: 'test-user',
      } as any);

      // Missing decision
      orchestrator.emit('approval:decision', {
        approvalId: 'test-id',
        approver: 'test-user',
      } as any);

      // Missing approver
      orchestrator.emit('approval:decision', {
        approvalId: 'test-id',
        decision: 'approved' as const,
      } as any);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(consoleErrorSpy).toHaveBeenCalledTimes(3);
      consoleErrorSpy.mockRestore();
    });

    it('should handle invalid decision values', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      orchestrator.emit('approval:decision', {
        approvalId: 'test-id',
        decision: 'invalid-decision' as any,
        approver: 'test-user',
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Error processing approval decision event/),
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should handle extremely long approval IDs and comments', async () => {
      const taskId = await orchestrator.createTask('Test long data', 'feature');

      mockQuery.mockResolvedValueOnce({
        requestId: 'test-request-1',
        content: [{ type: 'text', text: 'Stage completed' }],
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      let approvalId: string;
      orchestrator.on('approval:required', (event) => {
        approvalId = event.approvalId;
      });

      await orchestrator.runTask(taskId);

      // Create extremely long comment (10KB)
      const longComment = 'A'.repeat(10000);

      await expect(orchestrator.grantApproval(approvalId!, 'user', longComment))
        .resolves.not.toThrow();

      const approvalState = await orchestrator.getApprovalStateById(approvalId!);
      expect(approvalState?.comment).toHaveLength(10000);
    });
  });

  describe('Database Operation Failures', () => {
    it('should handle database save failures during approval resolution', async () => {
      const taskId = await orchestrator.createTask('Test db save failure', 'feature');

      mockQuery.mockResolvedValueOnce({
        requestId: 'test-request-1',
        content: [{ type: 'text', text: 'Stage completed' }],
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      let approvalId: string;
      orchestrator.on('approval:required', (event) => {
        approvalId = event.approvalId;
      });

      await orchestrator.runTask(taskId);

      // Mock database update to fail
      const originalUpdateApprovalState = orchestrator.store.updateApprovalState.bind(orchestrator.store);
      orchestrator.store.updateApprovalState = vi.fn().mockRejectedValueOnce(new Error('Database write failed'));

      await expect(orchestrator.grantApproval(approvalId!, 'user', 'comment'))
        .rejects.toThrow('Database write failed');

      // Restore original method
      orchestrator.store.updateApprovalState = originalUpdateApprovalState;
    });

    it('should handle database read failures during approval lookup', async () => {
      // Mock database read to fail
      const originalGetApprovalStateById = orchestrator.store.getApprovalStateById.bind(orchestrator.store);
      orchestrator.store.getApprovalStateById = vi.fn().mockRejectedValueOnce(new Error('Database read failed'));

      await expect(orchestrator.grantApproval('test-id', 'user', 'comment'))
        .rejects.toThrow('Database read failed');

      // Restore original method
      orchestrator.store.getApprovalStateById = originalGetApprovalStateById;
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('should handle large numbers of approval events efficiently', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Create many approval decision events with invalid IDs
      const startTime = Date.now();

      for (let i = 0; i < 1000; i++) {
        orchestrator.emit('approval:decision', {
          approvalId: `invalid-id-${i}`,
          decision: 'approved' as const,
          approver: `user-${i}`,
        });
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Should handle 1000 events within reasonable time (< 5 seconds)
      expect(processingTime).toBeLessThan(5000);

      consoleErrorSpy.mockRestore();
    });

    it('should handle approval state with deeply nested metadata', async () => {
      const taskId = await orchestrator.createTask('Test deep metadata', 'feature');

      mockQuery.mockResolvedValueOnce({
        requestId: 'test-request-1',
        content: [{ type: 'text', text: 'Stage completed' }],
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      let approvalId: string;
      orchestrator.on('approval:required', (event) => {
        approvalId = event.approvalId;
      });

      await orchestrator.runTask(taskId);

      // Create deeply nested metadata
      const deepMetadata = JSON.stringify({
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  data: 'deep nested value',
                  array: Array(1000).fill('large array item'),
                  object: Object.fromEntries(Array(100).fill(0).map((_, i) => [`key${i}`, `value${i}`]))
                }
              }
            }
          }
        }
      });

      await expect(orchestrator.grantApproval(approvalId!, 'user', deepMetadata))
        .resolves.not.toThrow();

      const approvalState = await orchestrator.getApprovalStateById(approvalId!);
      expect(approvalState?.comment).toContain('deep nested value');
    });
  });

  describe('Race Conditions and Timing Issues', () => {
    it('should handle rapid approval resolution followed by task deletion', async () => {
      const taskId = await orchestrator.createTask('Test rapid resolution', 'feature');

      mockQuery.mockResolvedValueOnce({
        requestId: 'test-request-1',
        content: [{ type: 'text', text: 'Stage completed' }],
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      let approvalId: string;
      orchestrator.on('approval:required', (event) => {
        approvalId = event.approvalId;
      });

      await orchestrator.runTask(taskId);

      // Rapid approval followed by task deletion
      const approvalPromise = orchestrator.grantApproval(approvalId!, 'user', 'Quick approval');
      const deletePromise = orchestrator.deleteTask(taskId);

      const [approvalResult, deleteResult] = await Promise.allSettled([
        approvalPromise,
        deletePromise
      ]);

      // At least one operation should complete successfully
      expect([approvalResult.status, deleteResult.status]).toContain('fulfilled');
    });

    it('should handle orchestrator shutdown during approval processing', async () => {
      const taskId = await orchestrator.createTask('Test shutdown timing', 'feature');

      mockQuery.mockResolvedValueOnce({
        requestId: 'test-request-1',
        content: [{ type: 'text', text: 'Stage completed' }],
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      let approvalId: string;
      orchestrator.on('approval:required', (event) => {
        approvalId = event.approvalId;
      });

      await orchestrator.runTask(taskId);

      // Start approval process
      const approvalPromise = orchestrator.grantApproval(approvalId!, 'user', 'Approval during shutdown');

      // Simulate shutdown (though we can't actually test full shutdown in unit test)
      orchestrator.removeAllListeners();

      // Approval should still complete
      await expect(approvalPromise).resolves.not.toThrow();
    });
  });

  describe('Error Recovery', () => {
    it('should handle transient database errors with retry logic', async () => {
      const taskId = await orchestrator.createTask('Test error recovery', 'feature');

      mockQuery.mockResolvedValueOnce({
        requestId: 'test-request-1',
        content: [{ type: 'text', text: 'Stage completed' }],
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      let approvalId: string;
      orchestrator.on('approval:required', (event) => {
        approvalId = event.approvalId;
      });

      await orchestrator.runTask(taskId);

      // Mock database to fail twice, then succeed
      let callCount = 0;
      const originalUpdateApprovalState = orchestrator.store.updateApprovalState.bind(orchestrator.store);
      orchestrator.store.updateApprovalState = vi.fn().mockImplementation((...args) => {
        callCount++;
        if (callCount <= 2) {
          return Promise.reject(new Error('Transient DB error'));
        }
        return originalUpdateApprovalState(...args);
      });

      // This would normally require retry logic in the implementation
      // For now, we expect it to fail on first attempt
      await expect(orchestrator.grantApproval(approvalId!, 'user', 'Retry test'))
        .rejects.toThrow('Transient DB error');

      // Restore original method
      orchestrator.store.updateApprovalState = originalUpdateApprovalState;
    });

    it('should maintain data consistency after partial failures', async () => {
      const taskId = await orchestrator.createTask('Test data consistency', 'feature');

      mockQuery.mockResolvedValueOnce({
        requestId: 'test-request-1',
        content: [{ type: 'text', text: 'Stage completed' }],
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      let approvalId: string;
      orchestrator.on('approval:required', (event) => {
        approvalId = event.approvalId;
      });

      await orchestrator.runTask(taskId);

      // Mock task resume to fail after approval is granted
      const originalRunTask = orchestrator.runTask.bind(orchestrator);
      orchestrator.runTask = vi.fn().mockRejectedValueOnce(new Error('Resume failed'));

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await orchestrator.grantApproval(approvalId!, 'user', 'Consistency test');

      await new Promise(resolve => setTimeout(resolve, 100));

      // Approval state should still be updated even if task resume failed
      const approvalState = await orchestrator.getApprovalStateById(approvalId!);
      expect(approvalState?.status).toBe('approved');
      expect(approvalState?.approver).toBe('user');

      // Error should be logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Failed to resume task/),
        expect.any(Error)
      );

      // Restore original method
      orchestrator.runTask = originalRunTask;
      consoleErrorSpy.mockRestore();
    });
  });
});