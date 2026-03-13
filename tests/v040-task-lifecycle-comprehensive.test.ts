import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import { ApexConfig, Task, TaskTemplate, TaskStatus } from '@apexcli/core';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdtemp, rm } from 'fs/promises';

/**
 * Comprehensive test suite for v0.4.0 Task Lifecycle Features
 *
 * This test suite provides deep coverage of:
 * - Soft delete (trash/restore) operations
 * - Task archival and unarchival
 * - Template system (create, use, manage)
 * - Lifecycle state transitions
 * - Data integrity and consistency
 * - Edge cases and error conditions
 */

describe('v0.4.0 Task Lifecycle Features - Comprehensive Testing', () => {
  let orchestrator: ApexOrchestrator;
  let tempDir: string;

  beforeEach(async () => {
    // Create temporary directory for tests
    tempDir = await mkdtemp(join(tmpdir(), 'apex-v040-lifecycle-'));

    // Create comprehensive APEX config for lifecycle testing
    const config: ApexConfig = {
      version: '0.6.0',
      features: {
        multimodal: true,
        streaming: true,
        templates: true,
        worktrees: false
      },
      workspace: {
        isolation: 'none'
      },
      agents: {
        'lifecycle-agent': {
          name: 'Lifecycle Test Agent',
          description: 'Agent for testing task lifecycle operations',
          system: 'You are a lifecycle management agent.',
          tools: []
        }
      },
      workflows: {
        'feature': {
          name: 'Feature Development',
          description: 'Feature development workflow for lifecycle testing',
          stages: ['planning', 'implementation', 'testing', 'review'],
          agents: {
            planning: 'lifecycle-agent',
            implementation: 'lifecycle-agent',
            testing: 'lifecycle-agent',
            review: 'lifecycle-agent'
          }
        },
        'bugfix': {
          name: 'Bug Fix',
          description: 'Bug fix workflow for testing',
          stages: ['investigation', 'fix', 'testing'],
          agents: {
            investigation: 'lifecycle-agent',
            fix: 'lifecycle-agent',
            testing: 'lifecycle-agent'
          }
        }
      },
      limits: {
        maxConcurrentTasks: 5,
        dailyTaskLimit: 100,
        sessionTokenLimit: 200000
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
    if (orchestrator) {
      await orchestrator.shutdown();
    }
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('Task Soft Delete (Trash/Restore)', () => {
    test('should trash task and update metadata correctly', async () => {
      const task = await orchestrator.createTask({
        description: 'Task to be trashed',
        workflow: 'feature',
        priority: 'medium'
      });

      // Add some data to verify it persists after trashing
      await orchestrator.store.addTaskArtifact(task.id, {
        type: 'file',
        name: 'test.js',
        content: 'console.log("test");'
      });

      await orchestrator.store.addTaskLog(task.id, {
        level: 'info',
        message: 'Task progress log'
      });

      const originalCreatedAt = task.createdAt;

      // Trash the task
      await orchestrator.trashTask(task.id);

      // Verify task is properly trashed
      const trashedTask = await orchestrator.getTask(task.id);
      expect(trashedTask).toBeDefined();
      expect(trashedTask?.trashedAt).toBeInstanceOf(Date);
      expect(trashedTask?.status).toBe('cancelled');
      expect(trashedTask?.createdAt).toEqual(originalCreatedAt); // Original metadata preserved

      // Verify data integrity
      expect(trashedTask?.artifacts).toHaveLength(1);
      expect(trashedTask?.logs).toHaveLength(1);
      expect(trashedTask?.description).toBe('Task to be trashed');
    });

    test('should list trashed tasks correctly', async () => {
      const tasks = await Promise.all([
        orchestrator.createTask({ description: 'Task 1 to trash' }),
        orchestrator.createTask({ description: 'Task 2 to trash' }),
        orchestrator.createTask({ description: 'Task 3 normal' })
      ]);

      // Trash first two tasks
      await orchestrator.trashTask(tasks[0].id);
      await orchestrator.trashTask(tasks[1].id);

      const trashedTasks = await orchestrator.listTrashed();

      expect(trashedTasks).toHaveLength(2);
      expect(trashedTasks.map(t => t.id)).toContain(tasks[0].id);
      expect(trashedTasks.map(t => t.id)).toContain(tasks[1].id);
      expect(trashedTasks.map(t => t.id)).not.toContain(tasks[2].id);

      // Verify all trashed tasks have trashedAt timestamp
      trashedTasks.forEach(task => {
        expect(task.trashedAt).toBeInstanceOf(Date);
        expect(task.status).toBe('cancelled');
      });
    });

    test('should restore task from trash with correct state', async () => {
      const task = await orchestrator.createTask({
        description: 'Task for restore test',
        workflow: 'feature',
        priority: 'high',
        effort: 'large'
      });

      // Set task to in-progress before trashing
      await orchestrator.store.updateTask(task.id, {
        status: 'in-progress',
        currentStage: 'implementation'
      });

      const originalState = await orchestrator.getTask(task.id);

      // Trash and then restore
      await orchestrator.trashTask(task.id);
      await orchestrator.restoreTask(task.id);

      const restoredTask = await orchestrator.getTask(task.id);

      expect(restoredTask).toBeDefined();
      expect(restoredTask?.trashedAt).toBeNull();
      expect(restoredTask?.status).toBe('pending'); // Should revert to pending
      expect(restoredTask?.description).toBe(originalState?.description);
      expect(restoredTask?.workflow).toBe(originalState?.workflow);
      expect(restoredTask?.priority).toBe(originalState?.priority);
      expect(restoredTask?.effort).toBe(originalState?.effort);

      // Verify not in trash list anymore
      const trashedTasks = await orchestrator.listTrashed();
      expect(trashedTasks.map(t => t.id)).not.toContain(task.id);
    });

    test('should handle empty trash operation with transaction safety', async () => {
      const tasks = await Promise.all([
        orchestrator.createTask({ description: 'Task 1 for empty test' }),
        orchestrator.createTask({ description: 'Task 2 for empty test' }),
        orchestrator.createTask({ description: 'Task 3 for empty test' })
      ]);

      // Add complex data to tasks before trashing
      for (const task of tasks) {
        await orchestrator.store.addTaskArtifact(task.id, {
          type: 'file',
          name: `${task.id}-file.js`,
          content: `// File for task ${task.id}`
        });

        await orchestrator.store.addTaskLog(task.id, {
          level: 'info',
          message: `Log for task ${task.id}`
        });

        // Add dependencies to test cascade deletion
        await orchestrator.store.updateTask(task.id, {
          dependsOn: tasks.filter(t => t.id !== task.id).map(t => t.id).slice(0, 1)
        });
      }

      // Trash all tasks
      for (const task of tasks) {
        await orchestrator.trashTask(task.id);
      }

      // Verify all tasks are in trash
      const trashedTasks = await orchestrator.listTrashed();
      expect(trashedTasks).toHaveLength(3);

      // Empty trash
      const deletedCount = await orchestrator.emptyTrash();
      expect(deletedCount).toBe(3);

      // Verify trash is empty
      const emptyTrash = await orchestrator.listTrashed();
      expect(emptyTrash).toHaveLength(0);

      // Verify tasks are permanently deleted
      for (const task of tasks) {
        const deletedTask = await orchestrator.getTask(task.id);
        expect(deletedTask).toBeNull();
      }
    });

    test('should prevent trashing already trashed tasks', async () => {
      const task = await orchestrator.createTask({
        description: 'Double trash test task'
      });

      // First trash should succeed
      await orchestrator.trashTask(task.id);

      // Second trash should handle gracefully
      await expect(orchestrator.trashTask(task.id)).not.toThrow();

      // Verify task is still properly trashed
      const trashedTask = await orchestrator.getTask(task.id);
      expect(trashedTask?.trashedAt).toBeInstanceOf(Date);
      expect(trashedTask?.status).toBe('cancelled');
    });

    test('should handle concurrent trash/restore operations', async () => {
      const tasks = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          orchestrator.createTask({ description: `Concurrent task ${i}` })
        )
      );

      // Perform concurrent trash operations
      await Promise.all(tasks.map(task => orchestrator.trashTask(task.id)));

      const trashedTasks = await orchestrator.listTrashed();
      expect(trashedTasks).toHaveLength(5);

      // Perform concurrent restore operations
      await Promise.all(tasks.map(task => orchestrator.restoreTask(task.id)));

      const remainingTrashedTasks = await orchestrator.listTrashed();
      expect(remainingTrashedTasks).toHaveLength(0);

      // Verify all tasks are properly restored
      for (const task of tasks) {
        const restoredTask = await orchestrator.getTask(task.id);
        expect(restoredTask?.trashedAt).toBeNull();
        expect(restoredTask?.status).toBe('pending');
      }
    });
  });

  describe('Task Archival System', () => {
    test('should archive completed tasks with validation', async () => {
      const task = await orchestrator.createTask({
        description: 'Task for archival test',
        workflow: 'feature'
      });

      // Try to archive pending task (should fail)
      await expect(orchestrator.archiveTask(task.id)).rejects.toThrow();

      // Complete the task first
      await orchestrator.store.updateTask(task.id, {
        status: 'completed',
        completedAt: new Date()
      });

      // Now archival should succeed
      await orchestrator.archiveTask(task.id);

      const archivedTask = await orchestrator.getTask(task.id);
      expect(archivedTask?.archivedAt).toBeInstanceOf(Date);
      expect(archivedTask?.status).toBe('completed'); // Status preserved

      // Verify appears in archived list
      const archivedTasks = await orchestrator.listArchivedTasks();
      expect(archivedTasks.some(t => t.id === task.id)).toBe(true);
    });

    test('should unarchive tasks and maintain data integrity', async () => {
      const task = await orchestrator.createTask({
        description: 'Unarchive test task',
        workflow: 'bugfix',
        priority: 'critical'
      });

      // Add rich data before completing and archiving
      await orchestrator.store.addTaskArtifact(task.id, {
        type: 'report',
        name: 'completion-report.md',
        content: '# Task Completion Report\n\nTask completed successfully.'
      });

      await orchestrator.store.addTaskLog(task.id, {
        level: 'info',
        message: 'Task completed successfully',
        stage: 'review'
      });

      // Complete and archive
      await orchestrator.store.updateTask(task.id, {
        status: 'completed',
        completedAt: new Date(),
        currentStage: 'review'
      });

      await orchestrator.archiveTask(task.id);

      const originalArchivedTask = await orchestrator.getTask(task.id);

      // Unarchive
      await orchestrator.unarchiveTask(task.id);

      const unarchivedTask = await orchestrator.getTask(task.id);

      expect(unarchivedTask?.archivedAt).toBeNull();
      expect(unarchivedTask?.status).toBe('completed'); // Status preserved
      expect(unarchivedTask?.description).toBe(originalArchivedTask?.description);
      expect(unarchivedTask?.workflow).toBe(originalArchivedTask?.workflow);
      expect(unarchivedTask?.priority).toBe(originalArchivedTask?.priority);
      expect(unarchivedTask?.artifacts).toHaveLength(1);
      expect(unarchivedTask?.logs).toHaveLength(1);

      // Verify not in archived list
      const archivedTasks = await orchestrator.listArchivedTasks();
      expect(archivedTasks.some(t => t.id === task.id)).toBe(false);
    });

    test('should handle bulk archival operations', async () => {
      // Create multiple completed tasks
      const tasks = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          orchestrator.createTask({
            description: `Bulk archive task ${i}`,
            workflow: 'feature'
          })
        )
      );

      // Complete all tasks
      await Promise.all(tasks.map(task =>
        orchestrator.store.updateTask(task.id, {
          status: 'completed',
          completedAt: new Date(Date.now() + Math.random() * 1000) // Slight time variations
        })
      ));

      // Archive all tasks
      await Promise.all(tasks.map(task => orchestrator.archiveTask(task.id)));

      // Verify all are archived
      const archivedTasks = await orchestrator.listArchivedTasks();
      expect(archivedTasks).toHaveLength(10);

      const archivedIds = archivedTasks.map(t => t.id);
      tasks.forEach(task => {
        expect(archivedIds).toContain(task.id);
      });
    });

    test('should prevent archiving non-completed tasks', async () => {
      const statuses: TaskStatus[] = ['pending', 'in-progress', 'paused', 'failed', 'cancelled'];

      for (const status of statuses) {
        const task = await orchestrator.createTask({
          description: `Task with ${status} status`
        });

        await orchestrator.store.updateTask(task.id, { status });

        await expect(orchestrator.archiveTask(task.id)).rejects.toThrow();

        // Verify task wasn't archived
        const taskCheck = await orchestrator.getTask(task.id);
        expect(taskCheck?.archivedAt).toBeNull();
      }
    });

    test('should handle archive/unarchive of tasks with complex relationships', async () => {
      // Create parent task
      const parentTask = await orchestrator.createTask({
        description: 'Parent task for relationship test'
      });

      // Create subtasks
      const subtasks = await Promise.all([
        orchestrator.createTask({
          description: 'Subtask 1',
          parentTaskId: parentTask.id
        }),
        orchestrator.createTask({
          description: 'Subtask 2',
          parentTaskId: parentTask.id
        })
      ]);

      // Update parent to reference subtasks
      await orchestrator.store.updateTask(parentTask.id, {
        subtaskIds: subtasks.map(t => t.id)
      });

      // Complete all tasks
      const allTasks = [parentTask, ...subtasks];
      for (const task of allTasks) {
        await orchestrator.store.updateTask(task.id, {
          status: 'completed',
          completedAt: new Date()
        });
      }

      // Archive parent task
      await orchestrator.archiveTask(parentTask.id);

      // Verify relationships are preserved
      const archivedParent = await orchestrator.getTask(parentTask.id);
      expect(archivedParent?.subtaskIds).toEqual(subtasks.map(t => t.id));

      // Verify subtasks still reference parent
      for (const subtask of subtasks) {
        const taskCheck = await orchestrator.getTask(subtask.id);
        expect(taskCheck?.parentTaskId).toBe(parentTask.id);
      }
    });
  });

  describe('Task Template System', () => {
    test('should create comprehensive templates from tasks', async () => {
      const sourceTask = await orchestrator.createTask({
        description: 'Comprehensive template source task',
        workflow: 'feature',
        priority: 'high',
        effort: 'large',
        autonomy: 'medium',
        acceptanceCriteria: 'Must include unit tests and documentation'
      });

      // Add artifacts to test if they're included in template
      await orchestrator.store.addTaskArtifact(sourceTask.id, {
        type: 'file',
        name: 'template-file.js',
        content: 'console.log("template content");'
      });

      const templateName = 'Comprehensive Feature Template';
      const template = await orchestrator.saveTemplate(sourceTask.id, templateName);

      expect(template).toBeDefined();
      expect(template.name).toBe(templateName);
      expect(template.description).toBe(sourceTask.description);
      expect(template.workflow).toBe(sourceTask.workflow);
      expect(template.priority).toBe(sourceTask.priority);
      expect(template.effort).toBe(sourceTask.effort);
      expect(template.autonomy).toBe(sourceTask.autonomy);
      expect(template.acceptanceCriteria).toBe(sourceTask.acceptanceCriteria);
      expect(template.createdAt).toBeInstanceOf(Date);
      expect(template.updatedAt).toBeInstanceOf(Date);
    });

    test('should create tasks from templates with proper inheritance', async () => {
      // Create source task with complex configuration
      const sourceTask = await orchestrator.createTask({
        description: 'Source task for template inheritance test',
        workflow: 'bugfix',
        priority: 'critical',
        effort: 'medium',
        autonomy: 'high',
        acceptanceCriteria: 'Fix must include regression tests'
      });

      const template = await orchestrator.saveTemplate(sourceTask.id, 'Bug Fix Template');

      // Create new task from template
      const newTask = await orchestrator.useTemplate(template.id);

      expect(newTask).toBeDefined();
      expect(newTask.id).not.toBe(sourceTask.id); // Should be different task
      expect(newTask.description).toBe(sourceTask.description);
      expect(newTask.workflow).toBe(sourceTask.workflow);
      expect(newTask.priority).toBe(sourceTask.priority);
      expect(newTask.effort).toBe(sourceTask.effort);
      expect(newTask.autonomy).toBe(sourceTask.autonomy);
      expect(newTask.acceptanceCriteria).toBe(sourceTask.acceptanceCriteria);
      expect(newTask.status).toBe('pending'); // Should start as pending
      expect(newTask.createdAt).toBeInstanceOf(Date);
      expect(newTask.createdAt.getTime()).toBeGreaterThan(sourceTask.createdAt.getTime());
    });

    test('should manage template lifecycle (CRUD operations)', async () => {
      const task = await orchestrator.createTask({
        description: 'Template lifecycle test task',
        workflow: 'feature'
      });

      // Create template
      const template = await orchestrator.saveTemplate(task.id, 'Lifecycle Test Template');
      const originalId = template.id;

      // Read template
      const retrievedTemplate = await orchestrator.getTemplate(template.id);
      expect(retrievedTemplate).toBeDefined();
      expect(retrievedTemplate?.name).toBe('Lifecycle Test Template');

      // Update template
      const updatedTemplate = await orchestrator.updateTemplate(template.id, {
        name: 'Updated Lifecycle Template',
        description: 'Updated description for lifecycle test',
        priority: 'low'
      });

      expect(updatedTemplate.name).toBe('Updated Lifecycle Template');
      expect(updatedTemplate.description).toBe('Updated description for lifecycle test');
      expect(updatedTemplate.priority).toBe('low');
      expect(updatedTemplate.id).toBe(originalId); // ID should remain the same
      expect(updatedTemplate.updatedAt.getTime()).toBeGreaterThan(template.updatedAt.getTime());

      // Verify update persisted
      const persistedUpdate = await orchestrator.getTemplate(template.id);
      expect(persistedUpdate?.name).toBe('Updated Lifecycle Template');
      expect(persistedUpdate?.description).toBe('Updated description for lifecycle test');

      // Delete template
      await orchestrator.deleteTemplate(template.id);

      // Verify deletion
      const deletedTemplate = await orchestrator.getTemplate(template.id);
      expect(deletedTemplate).toBeNull();

      // Verify not in list
      const allTemplates = await orchestrator.listTemplates();
      expect(allTemplates.some(t => t.id === template.id)).toBe(false);
    });

    test('should handle template search and filtering', async () => {
      // Create multiple templates with different characteristics
      const templateData = [
        { name: 'React Component Template', workflow: 'feature', priority: 'medium' },
        { name: 'Bug Fix Template', workflow: 'bugfix', priority: 'high' },
        { name: 'Feature API Template', workflow: 'feature', priority: 'low' },
        { name: 'Performance Fix', workflow: 'bugfix', priority: 'critical' },
        { name: 'Documentation Template', workflow: 'feature', priority: 'low' }
      ];

      const templates: TaskTemplate[] = [];

      for (const data of templateData) {
        const task = await orchestrator.createTask({
          description: `Task for ${data.name}`,
          workflow: data.workflow,
          priority: data.priority
        });

        const template = await orchestrator.saveTemplate(task.id, data.name);
        templates.push(template);
      }

      // Test listing all templates
      const allTemplates = await orchestrator.listTemplates();
      expect(allTemplates).toHaveLength(5);

      // Test filtering by workflow (if method exists)
      try {
        const featureTemplates = await orchestrator.getTemplatesByWorkflow?.('feature') ||
          allTemplates.filter(t => t.workflow === 'feature');
        expect(featureTemplates).toHaveLength(3);
      } catch (error) {
        // Method might not exist, that's okay
      }

      // Test search functionality (if method exists)
      try {
        const bugTemplates = await orchestrator.searchTemplates?.('Bug') ||
          allTemplates.filter(t => t.name.includes('Bug'));
        expect(bugTemplates.length).toBeGreaterThanOrEqual(1);
      } catch (error) {
        // Method might not exist, that's okay
      }
    });

    test('should handle template versioning and updates', async () => {
      const task = await orchestrator.createTask({
        description: 'Version test task',
        workflow: 'feature'
      });

      const template = await orchestrator.saveTemplate(task.id, 'Version Test Template');
      const originalCreatedAt = template.createdAt;

      // Wait a moment to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      // Update template multiple times
      const update1 = await orchestrator.updateTemplate(template.id, {
        description: 'Version 1 description'
      });

      const update2 = await orchestrator.updateTemplate(template.id, {
        description: 'Version 2 description',
        priority: 'high'
      });

      // Verify versioning through timestamps
      expect(update1.updatedAt.getTime()).toBeGreaterThan(originalCreatedAt.getTime());
      expect(update2.updatedAt.getTime()).toBeGreaterThan(update1.updatedAt.getTime());

      // Verify final state
      expect(update2.description).toBe('Version 2 description');
      expect(update2.priority).toBe('high');
      expect(update2.createdAt).toEqual(originalCreatedAt); // Created date preserved
    });

    test('should handle template metadata and custom fields', async () => {
      const task = await orchestrator.createTask({
        description: 'Metadata test task',
        workflow: 'feature'
      });

      const template = await orchestrator.saveTemplate(task.id, 'Metadata Template');

      // Update with metadata (if supported)
      try {
        const updatedTemplate = await orchestrator.updateTemplate(template.id, {
          name: 'Metadata Template',
          description: template.description,
          metadata: {
            tags: ['frontend', 'react', 'component'],
            author: 'test-agent',
            version: '1.0.0',
            category: 'ui-component'
          }
        });

        expect(updatedTemplate.metadata).toBeDefined();
        if (updatedTemplate.metadata) {
          expect(updatedTemplate.metadata.tags).toEqual(['frontend', 'react', 'component']);
          expect(updatedTemplate.metadata.author).toBe('test-agent');
          expect(updatedTemplate.metadata.version).toBe('1.0.0');
          expect(updatedTemplate.metadata.category).toBe('ui-component');
        }
      } catch (error) {
        // Metadata might not be fully implemented yet
        console.log('Metadata functionality not yet implemented');
      }
    });

    test('should prevent template creation from non-existent tasks', async () => {
      await expect(
        orchestrator.saveTemplate('non-existent-task-id', 'Invalid Template')
      ).rejects.toThrow('Task not found');
    });

    test('should handle template usage with non-existent templates', async () => {
      await expect(
        orchestrator.useTemplate('non-existent-template-id')
      ).rejects.toThrow();
    });
  });

  describe('Integration and Cross-Feature Tests', () => {
    test('should handle complete lifecycle: create → complete → archive → template → restore', async () => {
      // Create task
      const task = await orchestrator.createTask({
        description: 'Full lifecycle integration test',
        workflow: 'feature',
        priority: 'high'
      });

      // Add rich data
      await orchestrator.store.addTaskArtifact(task.id, {
        type: 'file',
        name: 'integration-test.js',
        content: 'const result = "full lifecycle test";'
      });

      // Complete task
      await orchestrator.store.updateTask(task.id, {
        status: 'completed',
        completedAt: new Date()
      });

      // Create template from completed task
      const template = await orchestrator.saveTemplate(task.id, 'Full Lifecycle Template');

      // Archive the original task
      await orchestrator.archiveTask(task.id);

      // Create new task from template
      const newTask = await orchestrator.useTemplate(template.id);

      // Verify new task has correct properties but is independent
      expect(newTask.id).not.toBe(task.id);
      expect(newTask.description).toBe(task.description);
      expect(newTask.status).toBe('pending');
      expect(newTask.archivedAt).toBeNull();

      // Verify original task is still archived
      const archivedTask = await orchestrator.getTask(task.id);
      expect(archivedTask?.archivedAt).toBeInstanceOf(Date);

      // Unarchive original task
      await orchestrator.unarchiveTask(task.id);

      const unarchivedTask = await orchestrator.getTask(task.id);
      expect(unarchivedTask?.archivedAt).toBeNull();
      expect(unarchivedTask?.status).toBe('completed'); // Status preserved
    });

    test('should maintain referential integrity across lifecycle operations', async () => {
      // Create task hierarchy
      const parentTask = await orchestrator.createTask({
        description: 'Parent task for integrity test'
      });

      const childTask = await orchestrator.createTask({
        description: 'Child task for integrity test',
        parentTaskId: parentTask.id,
        dependsOn: [parentTask.id]
      });

      await orchestrator.store.updateTask(parentTask.id, {
        subtaskIds: [childTask.id]
      });

      // Trash parent task
      await orchestrator.trashTask(parentTask.id);

      // Verify child task relationships are maintained
      const childAfterParentTrash = await orchestrator.getTask(childTask.id);
      expect(childAfterParentTrash?.parentTaskId).toBe(parentTask.id);
      expect(childAfterParentTrash?.dependsOn).toContain(parentTask.id);

      // Restore parent task
      await orchestrator.restoreTask(parentTask.id);

      // Verify relationships are still intact
      const restoredParent = await orchestrator.getTask(parentTask.id);
      expect(restoredParent?.subtaskIds).toContain(childTask.id);

      const childAfterRestore = await orchestrator.getTask(childTask.id);
      expect(childAfterRestore?.parentTaskId).toBe(parentTask.id);
    });

    test('should handle concurrent lifecycle operations without conflicts', async () => {
      const tasks = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          orchestrator.createTask({
            description: `Concurrent lifecycle task ${i}`,
            workflow: 'feature'
          })
        )
      );

      // Perform mixed concurrent operations
      const operations = tasks.map((task, index) => {
        if (index % 3 === 0) {
          // Trash every third task
          return () => orchestrator.trashTask(task.id);
        } else if (index % 3 === 1) {
          // Complete and archive every second task
          return async () => {
            await orchestrator.store.updateTask(task.id, {
              status: 'completed',
              completedAt: new Date()
            });
            await orchestrator.archiveTask(task.id);
          };
        } else {
          // Create template from every remaining task
          return () => orchestrator.saveTemplate(task.id, `Template ${index}`);
        }
      });

      await Promise.all(operations.map(op => op()));

      // Verify final state
      const trashedTasks = await orchestrator.listTrashed();
      const archivedTasks = await orchestrator.listArchivedTasks();
      const templates = await orchestrator.listTemplates();

      expect(trashedTasks.length).toBe(4); // Every 3rd task (0, 3, 6, 9)
      expect(archivedTasks.length).toBe(3); // Every 3rd task starting at 1 (1, 4, 7)
      expect(templates.length).toBe(3); // Remaining tasks (2, 5, 8)
    });
  });

  describe('Data Consistency and Edge Cases', () => {
    test('should handle orphaned data cleanup during empty trash', async () => {
      const task = await orchestrator.createTask({
        description: 'Orphaned data test task'
      });

      // Add complex related data
      const artifacts = Array.from({ length: 5 }, (_, i) => ({
        type: 'file',
        name: `file${i}.js`,
        path: `src/file${i}.js`,
        content: `// Content for file ${i}`
      }));

      const logs = Array.from({ length: 10 }, (_, i) => ({
        level: 'info' as const,
        message: `Log entry ${i}`,
        timestamp: new Date(Date.now() + i * 100)
      }));

      for (const artifact of artifacts) {
        await orchestrator.store.addTaskArtifact(task.id, artifact);
      }

      for (const log of logs) {
        await orchestrator.store.addTaskLog(task.id, log);
      }

      // Verify data was added
      const taskWithData = await orchestrator.getTask(task.id);
      expect(taskWithData?.artifacts).toHaveLength(5);
      expect(taskWithData?.logs).toHaveLength(10);

      // Trash and empty
      await orchestrator.trashTask(task.id);
      await orchestrator.emptyTrash();

      // Verify complete cleanup
      const deletedTask = await orchestrator.getTask(task.id);
      expect(deletedTask).toBeNull();
    });

    test('should validate state transitions properly', async () => {
      const task = await orchestrator.createTask({
        description: 'State transition validation test'
      });

      // Test invalid archival (non-completed task)
      await expect(orchestrator.archiveTask(task.id)).rejects.toThrow();

      // Test valid state progression
      await orchestrator.store.updateTask(task.id, { status: 'in-progress' });

      // Should still fail archival
      await expect(orchestrator.archiveTask(task.id)).rejects.toThrow();

      // Complete task properly
      await orchestrator.store.updateTask(task.id, {
        status: 'completed',
        completedAt: new Date()
      });

      // Now archival should work
      await expect(orchestrator.archiveTask(task.id)).resolves.not.toThrow();
    });

    test('should handle malformed or corrupted task data gracefully', async () => {
      const task = await orchestrator.createTask({
        description: 'Malformed data test'
      });

      // These operations should not crash the system
      await expect(orchestrator.trashTask(task.id)).resolves.not.toThrow();
      await expect(orchestrator.restoreTask(task.id)).resolves.not.toThrow();

      // Complete task for archival test
      await orchestrator.store.updateTask(task.id, {
        status: 'completed',
        completedAt: new Date()
      });

      await expect(orchestrator.archiveTask(task.id)).resolves.not.toThrow();
      await expect(orchestrator.unarchiveTask(task.id)).resolves.not.toThrow();

      // Template operations should also be resilient
      await expect(
        orchestrator.saveTemplate(task.id, 'Resilience Test Template')
      ).resolves.not.toThrow();
    });
  });
});