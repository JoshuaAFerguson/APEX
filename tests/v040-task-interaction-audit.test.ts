import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import { ApexConfig } from '@apexcli/core';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdtemp, rm } from 'fs/promises';

/**
 * Comprehensive test suite for v0.4.0 Task Interaction Commands and Lifecycle features
 *
 * This test suite validates:
 * - Task interaction commands (iterate, inspect, diff, push, merge, checkout)
 * - Task lifecycle features (soft delete, archival, templates)
 * - Real implementation verification
 */

describe('v0.4.0 Task Interaction Commands Audit', () => {
  let orchestrator: ApexOrchestrator;
  let tempDir: string;

  beforeEach(async () => {
    // Create temporary directory for tests
    tempDir = await mkdtemp(join(tmpdir(), 'apex-v040-test-'));

    // Create basic APEX config for testing
    const config: ApexConfig = {
      version: '0.6.0',
      features: {
        multimodal: true,
        streaming: true,
        templates: true,
        worktrees: false // Keep simple for testing
      },
      workspace: {
        isolation: 'none'
      },
      agents: {},
      workflows: {},
      limits: {
        maxConcurrentTasks: 3,
        dailyTaskLimit: 50,
        sessionTokenLimit: 100000
      }
    };

    // Initialize orchestrator
    orchestrator = new ApexOrchestrator({
      projectPath: tempDir
    });

    await orchestrator.initialize(config);
  });

  afterEach(async () => {
    // Clean up
    await orchestrator.shutdown();
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('Task Interaction Commands', () => {
    test('should implement iterateTask method', async () => {
      // Create a task first
      const task = await orchestrator.createTask({
        description: 'Test task for iteration'
      });

      // Update task to in-progress status
      await orchestrator.store.updateTask(task.id, { status: 'in-progress' });

      // Test iterate functionality
      const iterationId = await orchestrator.iterateTask(task.id, 'Test feedback for iteration');

      expect(iterationId).toBeDefined();
      expect(iterationId).toContain(task.id);
      expect(iterationId).toContain('iteration');

      // Verify iteration was recorded
      const updatedTask = await orchestrator.getTask(task.id);
      expect(updatedTask?.iterationHistory?.entries).toHaveLength(1);
      expect(updatedTask?.iterationHistory?.entries[0].feedback).toBe('Test feedback for iteration');
    });

    test('should implement getIterationDiff method', async () => {
      // Create a task and add iteration
      const task = await orchestrator.createTask({
        description: 'Test task for diff'
      });

      await orchestrator.store.updateTask(task.id, { status: 'in-progress' });
      await orchestrator.iterateTask(task.id, 'Test feedback');

      // Test get iteration diff
      const diff = await orchestrator.getIterationDiff(task.id);

      expect(diff).toBeDefined();
      expect(diff.iterationId).toBeDefined();
      expect(diff.filesChanged).toBeDefined();
      expect(diff.summary).toBeDefined();
      expect(diff.summary).toContain('Test feedback');
    });

    test('should implement pushTaskBranch method', async () => {
      // Create a task with a branch name
      const task = await orchestrator.createTask({
        description: 'Test task for push'
      });

      await orchestrator.store.updateTask(task.id, {
        branchName: 'test-branch-push'
      });

      // Test push functionality (will fail without git repo but method should exist)
      const result = await orchestrator.pushTaskBranch(task.id);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      // Should fail because we don't have a git repo, but method should exist
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should implement mergeTaskBranch method', async () => {
      // Create a task with a branch name
      const task = await orchestrator.createTask({
        description: 'Test task for merge'
      });

      await orchestrator.store.updateTask(task.id, {
        branchName: 'test-branch-merge'
      });

      // Test merge functionality (will fail without git repo but method should exist)
      const result = await orchestrator.mergeTaskBranch(task.id, { squash: true });

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      // Should fail because we don't have a git repo, but method should exist
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should implement worktree management methods', async () => {
      // Test listTaskWorktrees (should return empty array when worktrees disabled)
      const worktrees = await orchestrator.listTaskWorktrees();
      expect(Array.isArray(worktrees)).toBe(true);
      expect(worktrees).toHaveLength(0);

      // Test getTaskWorktree (should return null when worktrees disabled)
      const task = await orchestrator.createTask({
        description: 'Test task for worktree'
      });

      const worktree = await orchestrator.getTaskWorktree(task.id);
      expect(worktree).toBeNull();

      // Test cleanupTaskWorktree (should return false when worktrees disabled)
      const cleanupResult = await orchestrator.cleanupTaskWorktree(task.id);
      expect(cleanupResult).toBe(false);

      // Test cleanupOrphanedWorktrees (should return empty array when worktrees disabled)
      const orphanedCleanup = await orchestrator.cleanupOrphanedWorktrees();
      expect(Array.isArray(orphanedCleanup)).toBe(true);
      expect(orphanedCleanup).toHaveLength(0);
    });
  });

  describe('Task Lifecycle Features', () => {
    test('should implement soft delete (trashTask)', async () => {
      // Create a task
      const task = await orchestrator.createTask({
        description: 'Test task for trash'
      });

      // Trash the task
      await orchestrator.trashTask(task.id);

      // Verify task is trashed
      const trashedTask = await orchestrator.getTask(task.id);
      expect(trashedTask?.trashedAt).toBeDefined();
      expect(trashedTask?.status).toBe('cancelled');

      // Verify it appears in trash list
      const trashedTasks = await orchestrator.listTrashed();
      expect(trashedTasks.some(t => t.id === task.id)).toBe(true);
    });

    test('should implement task restoration', async () => {
      // Create and trash a task
      const task = await orchestrator.createTask({
        description: 'Test task for restore'
      });

      await orchestrator.trashTask(task.id);

      // Restore the task
      await orchestrator.restoreTask(task.id);

      // Verify task is restored
      const restoredTask = await orchestrator.getTask(task.id);
      expect(restoredTask?.trashedAt).toBeNull();
      expect(restoredTask?.status).toBe('pending'); // Should be restored to pending
    });

    test('should implement empty trash functionality', async () => {
      // Create multiple tasks and trash them
      const task1 = await orchestrator.createTask({
        description: 'Test task 1 for empty trash'
      });
      const task2 = await orchestrator.createTask({
        description: 'Test task 2 for empty trash'
      });

      await orchestrator.trashTask(task1.id);
      await orchestrator.trashTask(task2.id);

      // Verify tasks are in trash
      const trashedTasks = await orchestrator.listTrashed();
      expect(trashedTasks).toHaveLength(2);

      // Empty trash
      const deletedCount = await orchestrator.emptyTrash();
      expect(deletedCount).toBe(2);

      // Verify trash is empty
      const emptyTrash = await orchestrator.listTrashed();
      expect(emptyTrash).toHaveLength(0);

      // Verify tasks are permanently deleted (should return null)
      const deletedTask1 = await orchestrator.getTask(task1.id);
      const deletedTask2 = await orchestrator.getTask(task2.id);
      expect(deletedTask1).toBeNull();
      expect(deletedTask2).toBeNull();
    });

    test('should implement task archival', async () => {
      // Create a task and mark as completed
      const task = await orchestrator.createTask({
        description: 'Test task for archive'
      });

      await orchestrator.store.updateTask(task.id, {
        status: 'completed',
        completedAt: new Date()
      });

      // Archive the task
      await orchestrator.archiveTask(task.id);

      // Verify task is archived
      const archivedTask = await orchestrator.getTask(task.id);
      expect(archivedTask?.archivedAt).toBeDefined();
      expect(archivedTask?.status).toBe('completed'); // Status should remain completed

      // Verify it appears in archived list
      const archivedTasks = await orchestrator.listArchivedTasks();
      expect(archivedTasks.some(t => t.id === task.id)).toBe(true);
    });

    test('should implement unarchive functionality', async () => {
      // Create, complete, and archive a task
      const task = await orchestrator.createTask({
        description: 'Test task for unarchive'
      });

      await orchestrator.store.updateTask(task.id, {
        status: 'completed',
        completedAt: new Date()
      });

      await orchestrator.archiveTask(task.id);

      // Unarchive the task
      await orchestrator.unarchiveTask(task.id);

      // Verify task is unarchived
      const unarchivedTask = await orchestrator.getTask(task.id);
      expect(unarchivedTask?.archivedAt).toBeNull();
      expect(unarchivedTask?.status).toBe('completed'); // Status should remain completed
    });
  });

  describe('Task Templates', () => {
    test('should implement saveTemplate', async () => {
      // Create a task
      const task = await orchestrator.createTask({
        description: 'Test task for template',
        workflow: 'feature',
        priority: 'medium',
        effort: 'medium'
      });

      // Save as template
      const template = await orchestrator.saveTemplate(task.id, 'Test Template');

      expect(template).toBeDefined();
      expect(template.name).toBe('Test Template');
      expect(template.description).toBe('Test task for template');
      expect(template.workflow).toBe('feature');
      expect(template.priority).toBe('medium');
      expect(template.effort).toBe('medium');
    });

    test('should implement useTemplate', async () => {
      // Create a task and save as template
      const originalTask = await orchestrator.createTask({
        description: 'Original task for template',
        workflow: 'hotfix',
        priority: 'high'
      });

      const template = await orchestrator.saveTemplate(originalTask.id, 'Hotfix Template');

      // Use template to create new task
      const newTask = await orchestrator.useTemplate(template.id);

      expect(newTask).toBeDefined();
      expect(newTask.description).toBe('Original task for template');
      expect(newTask.workflow).toBe('hotfix');
      expect(newTask.priority).toBe('high');
      expect(newTask.id).not.toBe(originalTask.id); // Should be different task
    });

    test('should implement listTemplates', async () => {
      // Create multiple templates
      const task1 = await orchestrator.createTask({
        description: 'Task 1 for templates'
      });
      const task2 = await orchestrator.createTask({
        description: 'Task 2 for templates'
      });

      await orchestrator.saveTemplate(task1.id, 'Template 1');
      await orchestrator.saveTemplate(task2.id, 'Template 2');

      // List templates
      const templates = await orchestrator.listTemplates();

      expect(templates).toHaveLength(2);
      expect(templates.some(t => t.name === 'Template 1')).toBe(true);
      expect(templates.some(t => t.name === 'Template 2')).toBe(true);
    });

    test('should implement deleteTemplate', async () => {
      // Create a template
      const task = await orchestrator.createTask({
        description: 'Task for delete template test'
      });

      const template = await orchestrator.saveTemplate(task.id, 'Template to Delete');

      // Verify template exists
      const allTemplates = await orchestrator.listTemplates();
      expect(allTemplates.some(t => t.id === template.id)).toBe(true);

      // Delete template
      await orchestrator.deleteTemplate(template.id);

      // Verify template is deleted
      const remainingTemplates = await orchestrator.listTemplates();
      expect(remainingTemplates.some(t => t.id === template.id)).toBe(false);

      // Should throw error when trying to get deleted template
      const deletedTemplate = await orchestrator.getTemplate(template.id);
      expect(deletedTemplate).toBeNull();
    });

    test('should implement getTemplate and updateTemplate', async () => {
      // Create a template
      const task = await orchestrator.createTask({
        description: 'Task for update template test'
      });

      const template = await orchestrator.saveTemplate(task.id, 'Template to Update');

      // Get template
      const retrievedTemplate = await orchestrator.getTemplate(template.id);
      expect(retrievedTemplate).toBeDefined();
      expect(retrievedTemplate?.name).toBe('Template to Update');

      // Update template
      const updatedTemplate = await orchestrator.updateTemplate(template.id, {
        name: 'Updated Template Name',
        description: 'Updated description'
      });

      expect(updatedTemplate.name).toBe('Updated Template Name');
      expect(updatedTemplate.description).toBe('Updated description');

      // Verify changes persisted
      const finalTemplate = await orchestrator.getTemplate(template.id);
      expect(finalTemplate?.name).toBe('Updated Template Name');
      expect(finalTemplate?.description).toBe('Updated description');
    });
  });

  describe('Integration Tests', () => {
    test('should handle complete task lifecycle with templates', async () => {
      // 1. Create a task
      const task = await orchestrator.createTask({
        description: 'Full lifecycle test task',
        workflow: 'feature',
        priority: 'high'
      });

      // 2. Save as template while task is pending
      const template = await orchestrator.saveTemplate(task.id, 'Lifecycle Template');

      // 3. Complete the original task
      await orchestrator.store.updateTask(task.id, {
        status: 'completed',
        completedAt: new Date()
      });

      // 4. Archive the completed task
      await orchestrator.archiveTask(task.id);

      // 5. Create new task from template
      const newTask = await orchestrator.useTemplate(template.id);

      // 6. Verify all operations worked
      expect(newTask.description).toBe('Full lifecycle test task');

      const archivedTasks = await orchestrator.listArchivedTasks();
      expect(archivedTasks.some(t => t.id === task.id)).toBe(true);

      const templates = await orchestrator.listTemplates();
      expect(templates.some(t => t.name === 'Lifecycle Template')).toBe(true);
    });

    test('should handle task interaction commands error cases', async () => {
      const nonExistentTaskId = 'non-existent-task-id';

      // Test iterateTask with non-existent task
      await expect(orchestrator.iterateTask(nonExistentTaskId, 'feedback'))
        .rejects.toThrow('Task not found');

      // Test getIterationDiff with non-existent task
      await expect(orchestrator.getIterationDiff(nonExistentTaskId))
        .rejects.toThrow('Task not found');

      // Test pushTaskBranch with non-existent task
      const pushResult = await orchestrator.pushTaskBranch(nonExistentTaskId);
      expect(pushResult.success).toBe(false);
      expect(pushResult.error).toContain('Task not found');

      // Test mergeTaskBranch with non-existent task
      const mergeResult = await orchestrator.mergeTaskBranch(nonExistentTaskId);
      expect(mergeResult.success).toBe(false);
      expect(mergeResult.error).toContain('Task not found');
    });
  });

  describe('CLI Command Availability', () => {
    test('should verify all v0.4.0 CLI commands are implemented', () => {
      // This test verifies that the orchestrator has all methods required by CLI commands
      const requiredMethods = [
        'iterateTask',
        'getIterationDiff',
        'pushTaskBranch',
        'mergeTaskBranch',
        'listTaskWorktrees',
        'getTaskWorktree',
        'switchToTaskWorktree',
        'cleanupTaskWorktree',
        'cleanupOrphanedWorktrees',
        'archiveTask',
        'unarchiveTask',
        'listArchivedTasks',
        'trashTask',
        'restoreTask',
        'listTrashed',
        'emptyTrash',
        'saveTemplate',
        'useTemplate',
        'listTemplates',
        'getTemplate',
        'updateTemplate',
        'deleteTemplate'
      ];

      requiredMethods.forEach(method => {
        expect(typeof (orchestrator as any)[method]).toBe('function');
      });
    });
  });
});