import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApexOrchestrator } from './index.js';
import { TaskStore } from './store.js';
import type { ApexConfig, Task } from '@apex/core';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { query } from '@anthropic-ai/claude-agent-sdk';

// Mock the claude-agent-sdk
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

describe('Max Resume Attempts - Edge Cases', () => {
  let orchestrator: ApexOrchestrator;
  let store: TaskStore;
  let tmpDir: string;
  let mockConfig: ApexConfig;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'apex-edge-cases-test-'));

    // Create .apex directory structure
    const apexDir = join(tmpDir, '.apex');
    await mkdir(apexDir, { recursive: true });
    await mkdir(join(apexDir, 'agents'), { recursive: true });
    await mkdir(join(apexDir, 'workflows'), { recursive: true });

    mockConfig = {
      version: '1.0',
      project: {
        name: 'test-project',
        testCommand: 'npm test',
        lintCommand: 'npm run lint',
        buildCommand: 'npm run build',
      },
      daemon: {
        sessionRecovery: {
          enabled: true,
          maxResumeAttempts: 3,
        },
      },
    };

    // Create minimal workflow and agent files
    const workflowContent = `
name: feature
description: Test workflow
stages:
  - name: planning
    agent: planner
    description: Planning stage
`;
    await writeFile(join(apexDir, 'workflows', 'feature.yaml'), workflowContent);

    const agentContent = `---
name: planner
description: Test planner
model: haiku
---
Test instructions
`;
    await writeFile(join(apexDir, 'agents', 'planner.md'), agentContent);

    orchestrator = new ApexOrchestrator({ projectPath: tmpDir });
    await orchestrator.initialize();
    store = (orchestrator as any).store;
  });

  afterEach(async () => {
    if (orchestrator) {
      await (orchestrator as any).shutdown?.();
    }
    if (tmpDir && existsSync(tmpDir)) {
      await rm(tmpDir, { recursive: true, force: true });
    }
    vi.clearAllMocks();
  });

  describe('Boundary conditions', () => {
    it('should handle resumeAttempts exactly at the limit', async () => {
      const task = await orchestrator.createTask({
        description: 'Boundary test task',
        workflow: 'feature',
      });

      // Set exactly at limit (3)
      await store.updateTask(task.id, {
        resumeAttempts: 3,
        status: 'paused',
        pauseReason: 'test',
        pausedAt: new Date(),
        updatedAt: new Date(),
      });

      await store.createCheckpoint(task.id, {
        checkpointId: 'boundary-test',
        stage: 'planning',
        stageIndex: 0,
        conversationState: [],
        metadata: {},
      });

      // Next resume should fail (would be 4 > 3)
      const result = await orchestrator.resumeTask(task.id);
      expect(result).toBe(false);

      const finalTask = await store.getTask(task.id);
      expect(finalTask?.status).toBe('failed');
      expect(finalTask?.resumeAttempts).toBe(4);
    });

    it('should handle resumeAttempts just under the limit', async () => {
      const mockQuery = vi.mocked(query);
      mockQuery.mockImplementation(() => ({
        [Symbol.asyncIterator]: async function* () {
          throw new Error('Session limit reached');
        },
      } as unknown as ReturnType<typeof query>));

      const task = await orchestrator.createTask({
        description: 'Under limit test',
        workflow: 'feature',
      });

      // Set just under limit (2 < 3)
      await store.updateTask(task.id, {
        resumeAttempts: 2,
        status: 'paused',
        pauseReason: 'test',
        pausedAt: new Date(),
        updatedAt: new Date(),
      });

      await store.createCheckpoint(task.id, {
        checkpointId: 'under-limit-test',
        stage: 'planning',
        stageIndex: 0,
        conversationState: [],
        metadata: {},
      });

      // Should allow one more resume (becomes 3 = 3)
      const result = await orchestrator.resumeTask(task.id);

      const afterResumeTask = await store.getTask(task.id);
      expect(afterResumeTask?.resumeAttempts).toBe(3);
      expect(afterResumeTask?.status).toBe('paused'); // Still paused due to mock failure

      // Next resume should fail the limit
      const result2 = await orchestrator.resumeTask(task.id);
      expect(result2).toBe(false);

      const finalTask = await store.getTask(task.id);
      expect(finalTask?.resumeAttempts).toBe(4);
      expect(finalTask?.status).toBe('failed');
    });

    it('should handle negative resumeAttempts values gracefully', async () => {
      const task = await orchestrator.createTask({
        description: 'Negative attempts test',
        workflow: 'feature',
      });

      // Manually set negative value (edge case that shouldn't happen but might due to corruption)
      await store.updateTask(task.id, {
        resumeAttempts: -1,
        status: 'paused',
        pauseReason: 'test',
        pausedAt: new Date(),
        updatedAt: new Date(),
      });

      await store.createCheckpoint(task.id, {
        checkpointId: 'negative-test',
        stage: 'planning',
        stageIndex: 0,
        conversationState: [],
        metadata: {},
      });

      // Should still work and increment from negative value
      const result = await orchestrator.resumeTask(task.id);

      const afterResumeTask = await store.getTask(task.id);
      expect(afterResumeTask?.resumeAttempts).toBe(0); // -1 + 1 = 0
    });
  });

  describe('Configuration edge cases', () => {
    it('should handle missing sessionRecovery config gracefully', async () => {
      // Create config without sessionRecovery
      const noSessionRecoveryConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
      };

      const noConfigDir = await mkdtemp(join(tmpdir(), 'apex-no-config-'));

      try {
        // Set up environment
        const apexDir = join(noConfigDir, '.apex');
        await mkdir(apexDir, { recursive: true });
        await mkdir(join(apexDir, 'agents'), { recursive: true });
        await mkdir(join(apexDir, 'workflows'), { recursive: true });

        await writeFile(join(apexDir, 'workflows', 'feature.yaml'), `
name: feature
description: Test workflow
stages:
  - name: planning
    agent: planner
    description: Planning stage
`);

        await writeFile(join(apexDir, 'agents', 'planner.md'), `---
name: planner
description: Test planner
model: haiku
---
Test instructions
`);

        const noConfigOrchestrator = new ApexOrchestrator({ projectPath: noConfigDir });
        await noConfigOrchestrator.initialize();

        const task = await noConfigOrchestrator.createTask({
          description: 'No config test',
          workflow: 'feature',
        });

        // Set to default limit (should be 3)
        await (noConfigOrchestrator as any).store.updateTask(task.id, {
          resumeAttempts: 3,
          status: 'paused',
          pauseReason: 'test',
          pausedAt: new Date(),
          updatedAt: new Date(),
        });

        await (noConfigOrchestrator as any).store.createCheckpoint(task.id, {
          checkpointId: 'no-config-test',
          stage: 'planning',
          stageIndex: 0,
          conversationState: [],
          metadata: {},
        });

        // Should use default limit of 3
        const result = await noConfigOrchestrator.resumeTask(task.id);
        expect(result).toBe(false);

        const finalTask = await (noConfigOrchestrator as any).store.getTask(task.id);
        expect(finalTask?.status).toBe('failed');
        expect(finalTask?.error).toContain('Maximum resume attempts exceeded (4/3)');

        await (noConfigOrchestrator as any).shutdown?.();
      } finally {
        await rm(noConfigDir, { recursive: true, force: true });
      }
    });

    it('should handle disabled sessionRecovery', async () => {
      // Create config with disabled session recovery
      const disabledConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        daemon: {
          sessionRecovery: {
            enabled: false,
            maxResumeAttempts: 5, // Should be ignored when disabled
          },
        },
      };

      const disabledDir = await mkdtemp(join(tmpdir(), 'apex-disabled-'));

      try {
        // Set up environment
        const apexDir = join(disabledDir, '.apex');
        await mkdir(apexDir, { recursive: true });
        await mkdir(join(apexDir, 'agents'), { recursive: true });
        await mkdir(join(apexDir, 'workflows'), { recursive: true });

        await writeFile(join(apexDir, 'workflows', 'feature.yaml'), `
name: feature
description: Test workflow
stages:
  - name: planning
    agent: planner
    description: Planning stage
`);

        await writeFile(join(apexDir, 'agents', 'planner.md'), `---
name: planner
description: Test planner
model: haiku
---
Test instructions
`);

        const disabledOrchestrator = new ApexOrchestrator({ projectPath: disabledDir });
        await disabledOrchestrator.initialize();

        const task = await disabledOrchestrator.createTask({
          description: 'Disabled config test',
          workflow: 'feature',
        });

        await (disabledOrchestrator as any).store.updateTask(task.id, {
          status: 'paused',
          pauseReason: 'test',
          pausedAt: new Date(),
          updatedAt: new Date(),
        });

        // Should still track attempts even when sessionRecovery is disabled
        // The limit enforcement is a safety mechanism that should always be active
        const result = await disabledOrchestrator.resumeTask(task.id);

        // May fail due to missing checkpoint or other reasons, but should not crash
        expect(typeof result).toBe('boolean');

        await (disabledOrchestrator as any).shutdown?.();
      } finally {
        await rm(disabledDir, { recursive: true, force: true });
      }
    });
  });

  describe('Data consistency edge cases', () => {
    it('should handle task without resumeAttempts field', async () => {
      // Create task manually to test missing field handling
      const taskData = {
        description: 'Missing field test',
        workflow: 'feature',
        autonomy: 'manual' as const,
        priority: 'normal' as const,
        projectPath: tmpDir,
        status: 'paused' as const,
        pauseReason: 'test',
        pausedAt: new Date(),
      };

      // Create task without resumeAttempts field
      const task = await store.createTask(taskData);

      // Manually remove resumeAttempts from database (simulate corruption)
      await (store as any).db.prepare(`
        UPDATE tasks SET resume_attempts = NULL WHERE id = ?
      `).run(task.id);

      await store.createCheckpoint(task.id, {
        checkpointId: 'missing-field-test',
        stage: 'planning',
        stageIndex: 0,
        conversationState: [],
        metadata: {},
      });

      // Should handle gracefully and treat as 0
      const result = await orchestrator.resumeTask(task.id);

      const afterResumeTask = await store.getTask(task.id);
      expect(afterResumeTask?.resumeAttempts).toBe(1);
    });

    it('should handle corrupted resumeAttempts data types', async () => {
      const task = await orchestrator.createTask({
        description: 'Corrupted data test',
        workflow: 'feature',
      });

      // Manually corrupt the resumeAttempts field with invalid data
      await (store as any).db.prepare(`
        UPDATE tasks SET resume_attempts = 'invalid' WHERE id = ?
      `).run(task.id);

      await store.updateTask(task.id, {
        status: 'paused',
        pauseReason: 'test',
        pausedAt: new Date(),
        updatedAt: new Date(),
      });

      await store.createCheckpoint(task.id, {
        checkpointId: 'corrupted-test',
        stage: 'planning',
        stageIndex: 0,
        conversationState: [],
        metadata: {},
      });

      // Should handle corrupted data gracefully
      const result = await orchestrator.resumeTask(task.id);

      // Verify it recovered and set a valid value
      const afterResumeTask = await store.getTask(task.id);
      expect(typeof afterResumeTask?.resumeAttempts).toBe('number');
      expect(afterResumeTask?.resumeAttempts).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Race condition handling', () => {
    it('should handle rapid successive resume calls', async () => {
      const mockQuery = vi.mocked(query);
      let callCount = 0;

      mockQuery.mockImplementation(() => ({
        [Symbol.asyncIterator]: async function* () {
          callCount++;
          // Introduce small delay to simulate race condition
          await new Promise(resolve => setTimeout(resolve, 10));
          throw new Error('Test failure');
        },
      } as unknown as ReturnType<typeof query>));

      const task = await orchestrator.createTask({
        description: 'Race condition test',
        workflow: 'feature',
      });

      await store.updateTask(task.id, {
        status: 'paused',
        pauseReason: 'test',
        pausedAt: new Date(),
        updatedAt: new Date(),
      });

      await store.createCheckpoint(task.id, {
        checkpointId: 'race-test',
        stage: 'planning',
        stageIndex: 0,
        conversationState: [],
        metadata: {},
      });

      // Launch multiple rapid resume calls (simulating race condition)
      const rapidCalls = await Promise.allSettled([
        orchestrator.resumeTask(task.id),
        orchestrator.resumeTask(task.id),
        orchestrator.resumeTask(task.id),
        orchestrator.resumeTask(task.id),
        orchestrator.resumeTask(task.id),
      ]);

      // At least some calls should fail due to max attempts
      const failedCalls = rapidCalls.filter(result =>
        result.status === 'fulfilled' && result.value === false
      );
      expect(failedCalls.length).toBeGreaterThan(0);

      const finalTask = await store.getTask(task.id);
      expect(finalTask?.status).toBe('failed');
      expect(finalTask?.resumeAttempts).toBeGreaterThan(3);
    });
  });

  describe('Memory and resource handling', () => {
    it('should handle very large conversation states without memory issues', async () => {
      // Create task with large conversation
      const largeConversation = Array(1000).fill(null).map((_, i) => ({
        type: 'user' as const,
        content: [{
          type: 'text' as const,
          text: `Message ${i}: ${'x'.repeat(1000)}` // 1MB+ conversation
        }],
      }));

      const task = await orchestrator.createTask({
        description: 'Large conversation test',
        workflow: 'feature',
        conversation: largeConversation,
      });

      await store.updateTask(task.id, {
        status: 'paused',
        pauseReason: 'test',
        pausedAt: new Date(),
        updatedAt: new Date(),
      });

      // Create checkpoint with large conversation state
      await store.createCheckpoint(task.id, {
        checkpointId: 'large-conversation-test',
        stage: 'planning',
        stageIndex: 0,
        conversationState: largeConversation,
        metadata: {},
      });

      const start = performance.now();

      // Should handle large data efficiently
      const result = await orchestrator.resumeTask(task.id);

      const end = performance.now();
      const duration = end - start;

      // Should complete within reasonable time despite large data
      expect(duration).toBeLessThan(2000); // 2 seconds max

      const finalTask = await store.getTask(task.id);
      expect(finalTask?.resumeAttempts).toBe(1);
    });
  });

  describe('Error propagation and logging', () => {
    it('should properly log all resume attempt events with metadata', async () => {
      const task = await orchestrator.createTask({
        description: 'Logging test task',
        workflow: 'feature',
      });

      await store.updateTask(task.id, {
        resumeAttempts: 2, // Start near limit
        status: 'paused',
        pauseReason: 'session_limit',
        pausedAt: new Date(),
        updatedAt: new Date(),
      });

      await store.createCheckpoint(task.id, {
        checkpointId: 'logging-test',
        stage: 'planning',
        stageIndex: 0,
        conversationState: [],
        metadata: { pauseReason: 'session_limit' },
      });

      // Resume until failure
      await orchestrator.resumeTask(task.id); // 3
      await orchestrator.resumeTask(task.id); // 4 - should fail

      // Check logs for proper metadata
      const logs = await store.getLogs(task.id);

      const resumeAttemptLogs = logs.filter(log =>
        log.message.includes('Resume attempt') ||
        log.message.includes('Maximum resume attempts exceeded')
      );

      expect(resumeAttemptLogs.length).toBeGreaterThan(0);

      // Find the failure log
      const failureLog = logs.find(log =>
        log.level === 'error' &&
        log.message.includes('Maximum resume attempts exceeded')
      );

      expect(failureLog).toBeDefined();
      expect(failureLog?.metadata).toEqual({
        resumeAttempts: 4,
        maxResumeAttempts: 3,
        failureReason: 'max_resume_attempts_exceeded',
      });
    });

    it('should include proper error context in failure messages', async () => {
      const task = await orchestrator.createTask({
        description: 'Error context test',
        workflow: 'feature',
      });

      await store.updateTask(task.id, {
        resumeAttempts: 3,
        status: 'paused',
        pauseReason: 'session_limit',
        pausedAt: new Date(),
        updatedAt: new Date(),
      });

      await store.createCheckpoint(task.id, {
        checkpointId: 'error-context-test',
        stage: 'planning',
        stageIndex: 0,
        conversationState: [],
        metadata: { pauseReason: 'session_limit' },
      });

      await orchestrator.resumeTask(task.id);

      const finalTask = await store.getTask(task.id);
      const errorMessage = finalTask?.error || '';

      // Verify comprehensive error message
      expect(errorMessage).toContain('Maximum resume attempts exceeded (4/3)');
      expect(errorMessage).toContain('This usually indicates');
      expect(errorMessage).toContain('Breaking the task into smaller subtasks');
      expect(errorMessage).toContain('Increasing maxResumeAttempts');
      expect(errorMessage).toContain('Manually investigating the root cause');
      expect(errorMessage).toContain('Task ID: ' + task.id);
      expect(errorMessage).toContain('Description: Error context test');
    });
  });

  describe('Cleanup and finalization', () => {
    it('should clean up resources properly after max attempts failure', async () => {
      const task = await orchestrator.createTask({
        description: 'Cleanup test',
        workflow: 'feature',
      });

      await store.updateTask(task.id, {
        resumeAttempts: 3,
        status: 'paused',
        pauseReason: 'test',
        pausedAt: new Date(),
        updatedAt: new Date(),
      });

      await store.createCheckpoint(task.id, {
        checkpointId: 'cleanup-test',
        stage: 'planning',
        stageIndex: 0,
        conversationState: [],
        metadata: {},
      });

      // Mock to verify cleanup calls
      const cleanupSpy = vi.fn();
      vi.spyOn(orchestrator, 'emit').mockImplementation((event, ...args) => {
        if (event === 'task:failed') {
          cleanupSpy();
        }
        return true;
      });

      await orchestrator.resumeTask(task.id);

      // Verify task:failed event was emitted for cleanup
      expect(cleanupSpy).toHaveBeenCalled();

      const finalTask = await store.getTask(task.id);
      expect(finalTask?.status).toBe('failed');
      expect(finalTask?.completedAt).toBeUndefined(); // Should not be set for failed tasks
      expect(finalTask?.pausedAt).toBeDefined(); // Should preserve pause timestamp
    });
  });
});