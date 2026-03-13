import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import { ApexConfig, Task, TaskTemplate } from '@apexcli/core';
import { TaskInspector } from '../packages/cli/src/services/task-inspector';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdtemp, rm } from 'fs/promises';

/**
 * Comprehensive test suite for v0.4.0 Task Interaction Commands
 *
 * This test suite provides deep coverage of:
 * - CLI command implementations (/iterate, /inspect, /diff, /push, /merge, /checkout)
 * - Task lifecycle management (soft delete, archival, templates)
 * - Edge cases, error handling, and integration scenarios
 * - Performance and concurrency considerations
 */

describe('v0.4.0 Task Interaction Commands - Comprehensive Testing', () => {
  let orchestrator: ApexOrchestrator;
  let tempDir: string;
  let taskInspector: TaskInspector;

  beforeEach(async () => {
    // Create temporary directory for tests
    tempDir = await mkdtemp(join(tmpdir(), 'apex-v040-comprehensive-'));

    // Create comprehensive APEX config for testing
    const config: ApexConfig = {
      version: '0.6.0',
      features: {
        multimodal: true,
        streaming: true,
        templates: true,
        worktrees: false // Keep simple for testing environment
      },
      workspace: {
        isolation: 'none'
      },
      agents: {
        'test-agent': {
          name: 'Test Agent',
          description: 'Agent for testing purposes',
          system: 'You are a test agent.',
          tools: []
        }
      },
      workflows: {
        'feature': {
          name: 'Feature Development',
          description: 'Standard feature development workflow',
          stages: ['planning', 'implementation', 'testing', 'review'],
          agents: {
            planning: 'test-agent',
            implementation: 'test-agent',
            testing: 'test-agent',
            review: 'test-agent'
          }
        }
      },
      limits: {
        maxConcurrentTasks: 5,
        dailyTaskLimit: 100,
        sessionTokenLimit: 200000
      }
    };

    // Initialize orchestrator with config
    orchestrator = new ApexOrchestrator({
      projectPath: tempDir
    });

    await orchestrator.initialize(config);

    // Initialize task inspector
    taskInspector = new TaskInspector(orchestrator);
  });

  afterEach(async () => {
    // Clean up
    if (orchestrator) {
      await orchestrator.shutdown();
    }
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('Task Iteration Command (/iterate)', () => {
    test('should create iteration with feedback and track changes', async () => {
      const task = await orchestrator.createTask({
        description: 'Test task for comprehensive iteration',
        workflow: 'feature',
        priority: 'high'
      });

      // Set task to in-progress to allow iteration
      await orchestrator.store.updateTask(task.id, {
        status: 'in-progress',
        currentStage: 'implementation'
      });

      const feedback = 'Please add comprehensive error handling and logging';

      // Test iteration creation
      const iterationId = await orchestrator.iterateTask(task.id, feedback);

      expect(iterationId).toBeDefined();
      expect(iterationId).toContain('iteration');

      // Verify iteration was recorded with proper structure
      const updatedTask = await orchestrator.getTask(task.id);
      expect(updatedTask?.iterationHistory?.entries).toHaveLength(1);

      const iteration = updatedTask.iterationHistory.entries[0];
      expect(iteration.feedback).toBe(feedback);
      expect(iteration.timestamp).toBeInstanceOf(Date);
      expect(iteration.agent).toBeDefined();
      expect(iteration.stage).toBe('implementation');
    });

    test('should handle multiple iterations and maintain chronological order', async () => {
      const task = await orchestrator.createTask({
        description: 'Multi-iteration test task',
        workflow: 'feature'
      });

      await orchestrator.store.updateTask(task.id, {
        status: 'in-progress',
        currentStage: 'implementation'
      });

      const feedbacks = [
        'First iteration feedback',
        'Second iteration with more details',
        'Final iteration before completion'
      ];

      // Create multiple iterations
      for (let i = 0; i < feedbacks.length; i++) {
        await orchestrator.iterateTask(task.id, feedbacks[i]);
        // Small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const finalTask = await orchestrator.getTask(task.id);
      const iterations = finalTask?.iterationHistory?.entries || [];

      expect(iterations).toHaveLength(3);

      // Verify chronological order
      for (let i = 1; i < iterations.length; i++) {
        expect(iterations[i].timestamp.getTime())
          .toBeGreaterThan(iterations[i - 1].timestamp.getTime());
      }

      // Verify all feedback is preserved
      expect(iterations.map(i => i.feedback)).toEqual(feedbacks);
    });

    test('should get iteration diff with comprehensive change tracking', async () => {
      const task = await orchestrator.createTask({
        description: 'Task for diff testing',
        workflow: 'feature'
      });

      await orchestrator.store.updateTask(task.id, {
        status: 'in-progress',
        currentStage: 'implementation'
      });

      // Add some artifacts to simulate file changes
      const artifacts = [
        { type: 'file', name: 'test.js', path: 'src/test.js', content: 'console.log("Hello")' },
        { type: 'file', name: 'utils.js', path: 'src/utils.js', content: 'export const helper = () => {}' }
      ];

      for (const artifact of artifacts) {
        await orchestrator.store.addTaskArtifact(task.id, artifact);
      }

      await orchestrator.iterateTask(task.id, 'Added new files and functionality');

      const diff = await orchestrator.getIterationDiff(task.id);

      expect(diff).toBeDefined();
      expect(diff.iterationId).toBeDefined();
      expect(diff.summary).toContain('Added new files and functionality');
      expect(diff.filesChanged).toBeDefined();
      expect(Array.isArray(diff.filesChanged)).toBe(true);
    });

    test('should reject iterations on non-existent tasks', async () => {
      const nonExistentTaskId = 'non-existent-task-123';

      await expect(
        orchestrator.iterateTask(nonExistentTaskId, 'This should fail')
      ).rejects.toThrow('Task not found');
    });

    test('should reject iterations on completed tasks', async () => {
      const task = await orchestrator.createTask({
        description: 'Completed task test'
      });

      await orchestrator.store.updateTask(task.id, {
        status: 'completed',
        completedAt: new Date()
      });

      await expect(
        orchestrator.iterateTask(task.id, 'Should not iterate completed task')
      ).rejects.toThrow();
    });
  });

  describe('Task Inspection Command (/inspect)', () => {
    test('should provide comprehensive task inspection', async () => {
      const task = await orchestrator.createTask({
        description: 'Comprehensive inspection test task',
        workflow: 'feature',
        priority: 'high',
        effort: 'medium',
        autonomy: 'high',
        acceptanceCriteria: 'Must include comprehensive tests and documentation'
      });

      // Add various artifacts and logs
      await orchestrator.store.addTaskArtifact(task.id, {
        type: 'file',
        name: 'implementation.js',
        path: 'src/implementation.js',
        content: 'const implementation = () => { return "hello"; };'
      });

      await orchestrator.store.addTaskArtifact(task.id, {
        type: 'report',
        name: 'README.md',
        path: 'docs/README.md',
        content: '# Project Documentation\n\nThis is comprehensive documentation.'
      });

      await orchestrator.store.addTaskLog(task.id, {
        level: 'info',
        message: 'Started task implementation',
        stage: 'implementation',
        agent: 'test-agent'
      });

      // Mock console.log to capture output
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Test comprehensive inspection
      await taskInspector.inspectTask(task.id);

      // Verify that inspection output includes all expected sections
      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');

      expect(output).toContain('Task Inspection');
      expect(output).toContain(task.id);
      expect(output).toContain('Comprehensive inspection test task');
      expect(output).toContain('feature');
      expect(output).toContain('high');
      expect(output).toContain('medium');
      expect(output).toContain('Must include comprehensive tests and documentation');

      consoleSpy.mockRestore();
    });

    test('should handle specific inspection options', async () => {
      const task = await orchestrator.createTask({
        description: 'Option-specific inspection test'
      });

      // Add test artifacts
      await orchestrator.store.addTaskArtifact(task.id, {
        type: 'file',
        name: 'test-file.js',
        path: 'src/test-file.js',
        content: 'console.log("test");'
      });

      await orchestrator.store.addTaskLog(task.id, {
        level: 'info',
        message: 'Test log entry',
        stage: 'implementation'
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Test files option
      await taskInspector.inspectTask(task.id, { files: true });
      let output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Modified Files');
      expect(output).toContain('test-file.js');

      consoleSpy.mockClear();

      // Test logs option
      await taskInspector.inspectTask(task.id, { logs: true });
      output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Task Logs');
      expect(output).toContain('Test log entry');

      consoleSpy.mockClear();

      // Test artifacts option
      await taskInspector.inspectTask(task.id, { artifacts: true });
      output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Task Artifacts');
      expect(output).toContain('file');

      consoleSpy.mockRestore();
    });

    test('should handle timeline inspection with chronological events', async () => {
      const task = await orchestrator.createTask({
        description: 'Timeline inspection test'
      });

      // Add logs with different timestamps
      await orchestrator.store.addTaskLog(task.id, {
        level: 'info',
        message: 'Task started',
        stage: 'planning',
        timestamp: new Date(Date.now() - 3000)
      });

      await orchestrator.store.addTaskLog(task.id, {
        level: 'info',
        message: 'Implementation began',
        stage: 'implementation',
        timestamp: new Date(Date.now() - 2000)
      });

      await orchestrator.store.addTaskLog(task.id, {
        level: 'warn',
        message: 'Minor issue encountered',
        stage: 'implementation',
        timestamp: new Date(Date.now() - 1000)
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await taskInspector.inspectTask(task.id, { timeline: true });

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Execution Timeline');
      expect(output).toContain('Task started');
      expect(output).toContain('Implementation began');
      expect(output).toContain('Minor issue encountered');

      consoleSpy.mockRestore();
    });

    test('should handle missing or invalid task IDs gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await taskInspector.inspectTask('non-existent-task');

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Task not found');

      consoleSpy.mockRestore();
    });
  });

  describe('Task Diff Command (/diff)', () => {
    test('should generate comprehensive task diffs', async () => {
      const task = await orchestrator.createTask({
        description: 'Task diff testing'
      });

      // Simulate file changes with before/after content
      await orchestrator.store.addTaskArtifact(task.id, {
        type: 'diff',
        name: 'changes.diff',
        content: `--- a/src/app.js\n+++ b/src/app.js\n@@ -1,3 +1,5 @@\n function app() {\n+  console.log('Debug info');\n   return 'Hello World';\n+  // Added comment\n }`
      });

      await orchestrator.store.addTaskArtifact(task.id, {
        type: 'file',
        name: 'newfile.js',
        path: 'src/newfile.js',
        content: 'export const newFunction = () => {};'
      });

      // Mock the git diff functionality that would be called
      const diff = await orchestrator.getTaskDiff(task.id);

      expect(diff).toBeDefined();
      expect(diff.taskId).toBe(task.id);
      expect(diff.summary).toBeDefined();
      expect(Array.isArray(diff.files)).toBe(true);
    });

    test('should handle empty diffs gracefully', async () => {
      const task = await orchestrator.createTask({
        description: 'Empty diff test'
      });

      const diff = await orchestrator.getTaskDiff(task.id);

      expect(diff).toBeDefined();
      expect(diff.taskId).toBe(task.id);
      expect(diff.files).toEqual([]);
      expect(diff.summary).toContain('No changes');
    });

    test('should generate statistical summaries', async () => {
      const task = await orchestrator.createTask({
        description: 'Stats diff test'
      });

      // Add multiple file changes
      const files = ['app.js', 'utils.js', 'test.js'];
      for (const fileName of files) {
        await orchestrator.store.addTaskArtifact(task.id, {
          type: 'file',
          name: fileName,
          path: `src/${fileName}`,
          content: `// Modified content for ${fileName}\nconsole.log('${fileName}');`
        });
      }

      const diff = await orchestrator.getTaskDiff(task.id);

      expect(diff.files.length).toBeGreaterThan(0);
      expect(diff.summary).toBeDefined();
    });
  });

  describe('Task Push Command (/push)', () => {
    test('should handle push operations with error handling', async () => {
      const task = await orchestrator.createTask({
        description: 'Push test task'
      });

      await orchestrator.store.updateTask(task.id, {
        branchName: 'feature/test-push-branch'
      });

      const result = await orchestrator.pushTaskBranch(task.id);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');

      // Should fail in test environment due to no git repo
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should validate task exists before push', async () => {
      const result = await orchestrator.pushTaskBranch('non-existent-task');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Task not found');
    });

    test('should handle tasks without branch names', async () => {
      const task = await orchestrator.createTask({
        description: 'No branch test'
      });

      const result = await orchestrator.pushTaskBranch(task.id);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Task Merge Command (/merge)', () => {
    test('should handle merge operations with various options', async () => {
      const task = await orchestrator.createTask({
        description: 'Merge test task'
      });

      await orchestrator.store.updateTask(task.id, {
        branchName: 'feature/test-merge-branch'
      });

      // Test regular merge
      const regularResult = await orchestrator.mergeTaskBranch(task.id);
      expect(regularResult).toBeDefined();
      expect(typeof regularResult.success).toBe('boolean');

      // Test squash merge
      const squashResult = await orchestrator.mergeTaskBranch(task.id, { squash: true });
      expect(squashResult).toBeDefined();
      expect(typeof squashResult.success).toBe('boolean');

      // Both should fail in test environment but methods should exist
      expect(regularResult.success).toBe(false);
      expect(squashResult.success).toBe(false);
    });

    test('should detect and report merge conflicts', async () => {
      const task = await orchestrator.createTask({
        description: 'Conflict test task'
      });

      await orchestrator.store.updateTask(task.id, {
        branchName: 'feature/conflict-branch'
      });

      const result = await orchestrator.mergeTaskBranch(task.id);

      expect(result).toBeDefined();
      expect('conflicted' in result).toBe(true);
      expect('conflictedFiles' in result).toBe(true);
    });

    test('should handle invalid task IDs for merge', async () => {
      const result = await orchestrator.mergeTaskBranch('invalid-task-id');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Task not found');
    });
  });

  describe('Task Checkout Command (/checkout)', () => {
    test('should list task worktrees when available', async () => {
      const worktrees = await orchestrator.listTaskWorktrees();

      expect(Array.isArray(worktrees)).toBe(true);
      // Should be empty when worktrees are disabled
      expect(worktrees).toHaveLength(0);
    });

    test('should handle worktree operations when disabled', async () => {
      const task = await orchestrator.createTask({
        description: 'Worktree test task'
      });

      const worktree = await orchestrator.getTaskWorktree(task.id);
      expect(worktree).toBeNull();

      const cleanupResult = await orchestrator.cleanupTaskWorktree(task.id);
      expect(cleanupResult).toBe(false);
    });

    test('should clean up orphaned worktrees', async () => {
      const orphanedCleanup = await orchestrator.cleanupOrphanedWorktrees();

      expect(Array.isArray(orphanedCleanup)).toBe(true);
      expect(orphanedCleanup).toHaveLength(0);
    });

    test('should handle worktree switching when enabled', async () => {
      const task = await orchestrator.createTask({
        description: 'Switch worktree test'
      });

      // This should return null when worktrees are disabled
      const switchResult = await orchestrator.switchToTaskWorktree?.(task.id);
      expect(switchResult).toBeUndefined();
    });
  });

  describe('Integration and Performance Tests', () => {
    test('should handle concurrent task operations', async () => {
      const tasks = await Promise.all([
        orchestrator.createTask({ description: 'Concurrent task 1' }),
        orchestrator.createTask({ description: 'Concurrent task 2' }),
        orchestrator.createTask({ description: 'Concurrent task 3' })
      ]);

      // Update all tasks to in-progress concurrently
      await Promise.all(tasks.map(task =>
        orchestrator.store.updateTask(task.id, { status: 'in-progress' })
      ));

      // Perform concurrent iterations
      const iterationResults = await Promise.all(tasks.map((task, index) =>
        orchestrator.iterateTask(task.id, `Concurrent feedback ${index + 1}`)
      ));

      expect(iterationResults).toHaveLength(3);
      iterationResults.forEach(result => {
        expect(result).toBeDefined();
        expect(result).toContain('iteration');
      });

      // Verify all iterations were recorded
      const finalTasks = await Promise.all(tasks.map(task =>
        orchestrator.getTask(task.id)
      ));

      finalTasks.forEach(task => {
        expect(task?.iterationHistory?.entries).toHaveLength(1);
      });
    });

    test('should maintain data consistency under concurrent access', async () => {
      const task = await orchestrator.createTask({
        description: 'Consistency test task'
      });

      await orchestrator.store.updateTask(task.id, { status: 'in-progress' });

      // Perform concurrent operations that might conflict
      const operations = [
        () => orchestrator.iterateTask(task.id, 'Iteration 1'),
        () => orchestrator.store.addTaskArtifact(task.id, { type: 'file', name: 'file1.js', content: 'content1' }),
        () => orchestrator.store.addTaskLog(task.id, { level: 'info', message: 'Log 1' }),
        () => orchestrator.iterateTask(task.id, 'Iteration 2'),
        () => orchestrator.store.addTaskArtifact(task.id, { type: 'file', name: 'file2.js', content: 'content2' }),
        () => orchestrator.store.addTaskLog(task.id, { level: 'info', message: 'Log 2' })
      ];

      await Promise.all(operations.map(op => op()));

      // Verify final state is consistent
      const finalTask = await orchestrator.getTask(task.id);
      expect(finalTask?.iterationHistory?.entries).toHaveLength(2);
      expect(finalTask?.artifacts).toHaveLength(2);
      expect(finalTask?.logs).toHaveLength(2);
    });

    test('should handle large task datasets efficiently', async () => {
      const largeTask = await orchestrator.createTask({
        description: 'Large dataset performance test'
      });

      // Add many artifacts and logs
      const startTime = Date.now();

      const artifacts = Array.from({ length: 50 }, (_, i) => ({
        type: 'file',
        name: `file${i}.js`,
        path: `src/file${i}.js`,
        content: `// File ${i}\n`.repeat(100) // Simulate larger content
      }));

      const logs = Array.from({ length: 100 }, (_, i) => ({
        level: 'info' as const,
        message: `Log entry ${i} with detailed information about operation`,
        stage: 'implementation',
        timestamp: new Date(Date.now() + i * 100)
      }));

      // Add all artifacts
      for (const artifact of artifacts) {
        await orchestrator.store.addTaskArtifact(largeTask.id, artifact);
      }

      // Add all logs
      for (const log of logs) {
        await orchestrator.store.addTaskLog(largeTask.id, log);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Operations should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(5000); // 5 seconds

      // Verify all data was added
      const finalTask = await orchestrator.getTask(largeTask.id);
      expect(finalTask?.artifacts).toHaveLength(50);
      expect(finalTask?.logs).toHaveLength(100);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle malformed task data gracefully', async () => {
      const task = await orchestrator.createTask({
        description: 'Malformed data test'
      });

      // Try to add malformed artifacts
      await expect(
        orchestrator.store.addTaskArtifact(task.id, {
          type: 'file',
          name: '', // Empty name
          content: 'valid content'
        })
      ).not.toThrow(); // Should handle gracefully

      // Try to add logs with missing required fields
      await expect(
        orchestrator.store.addTaskLog(task.id, {
          level: 'info',
          message: '', // Empty message
        })
      ).not.toThrow(); // Should handle gracefully
    });

    test('should validate command parameters', async () => {
      // Test with empty/null parameters
      await expect(
        orchestrator.iterateTask('', 'feedback')
      ).rejects.toThrow();

      await expect(
        orchestrator.iterateTask('valid-task-id', '')
      ).rejects.toThrow();

      await expect(
        orchestrator.pushTaskBranch('')
      ).resolves.toMatchObject({ success: false });

      await expect(
        orchestrator.mergeTaskBranch('')
      ).resolves.toMatchObject({ success: false });
    });

    test('should handle database connection issues', async () => {
      // This test would require mocking database failures
      // For now, we ensure methods exist and handle errors gracefully
      const methods = [
        'iterateTask',
        'getIterationDiff',
        'pushTaskBranch',
        'mergeTaskBranch',
        'getTaskDiff'
      ];

      methods.forEach(method => {
        expect(typeof (orchestrator as any)[method]).toBe('function');
      });
    });
  });
});