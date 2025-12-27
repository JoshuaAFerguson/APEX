import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from '../index';
import type { TaskTemplate, Task } from '@apexcli/core';

describe('ApexOrchestrator - Template CRUD Integration', () => {
  let orchestrator: ApexOrchestrator;
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-template-integration-test-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
    orchestrator = new ApexOrchestrator(testDir);
    await orchestrator.initialize();
  });

  afterEach(async () => {
    if (orchestrator) {
      orchestrator.close();
    }
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('template-task integration', () => {
    it('should create templates from tasks and vice versa', async () => {
      // Create a task first
      const task = await orchestrator.createTask({
        name: 'Integration Test Task',
        description: 'Task for integration testing',
        workflow: 'feature',
        priority: 'high',
        effort: 'large',
        acceptanceCriteria: 'Should integrate properly',
        tags: ['integration', 'test'],
      });

      // Create template from task
      const templateFromTask = await orchestrator.createTemplateFromTask(
        task.id,
        'Template from Task'
      );

      expect(templateFromTask.name).toBe('Template from Task');
      expect(templateFromTask.description).toBe(task.description);
      expect(templateFromTask.workflow).toBe(task.workflow);
      expect(templateFromTask.priority).toBe(task.priority);
      expect(templateFromTask.effort).toBe(task.effort);
      expect(templateFromTask.acceptanceCriteria).toBe(task.acceptanceCriteria);
      expect(templateFromTask.tags).toEqual(task.tags);

      // Now create a new task from the template
      const taskFromTemplate = await orchestrator.useTemplate(templateFromTask.id, {
        description: 'Task created from template',
      });

      expect(taskFromTemplate.name).toBe('Template from Task');
      expect(taskFromTemplate.description).toBe('Task created from template');
      expect(taskFromTemplate.workflow).toBe(templateFromTask.workflow);
      expect(taskFromTemplate.priority).toBe(templateFromTask.priority);
      expect(taskFromTemplate.effort).toBe(templateFromTask.effort);
      expect(taskFromTemplate.acceptanceCriteria).toBe(templateFromTask.acceptanceCriteria);
      expect(taskFromTemplate.tags).toEqual(templateFromTask.tags);

      // Update template and verify it doesn't affect existing tasks
      const updatedTemplate = await orchestrator.updateTemplate(templateFromTask.id, {
        name: 'Updated Template Name',
        priority: 'urgent',
      });

      const unchangedTask = await orchestrator.getTask(taskFromTemplate.id);
      expect(unchangedTask!.name).toBe('Template from Task'); // Original name
      expect(unchangedTask!.priority).toBe('high'); // Original priority

      expect(updatedTemplate.name).toBe('Updated Template Name');
      expect(updatedTemplate.priority).toBe('urgent');
    });

    it('should handle template updates affecting future task creation', async () => {
      // Create template
      const template = await orchestrator.createTemplate({
        name: 'Dynamic Template',
        description: 'Template for testing updates',
        workflow: 'feature',
        priority: 'normal',
        effort: 'medium',
      });

      // Create task from original template
      const task1 = await orchestrator.useTemplate(template.id);
      expect(task1.priority).toBe('normal');
      expect(task1.effort).toBe('medium');

      // Update template
      await orchestrator.updateTemplate(template.id, {
        priority: 'urgent',
        effort: 'large',
        acceptanceCriteria: 'Updated criteria',
      });

      // Create new task from updated template
      const task2 = await orchestrator.useTemplate(template.id);
      expect(task2.priority).toBe('urgent');
      expect(task2.effort).toBe('large');
      expect(task2.acceptanceCriteria).toBe('Updated criteria');

      // First task should remain unchanged
      const unchangedTask1 = await orchestrator.getTask(task1.id);
      expect(unchangedTask1!.priority).toBe('normal');
      expect(unchangedTask1!.effort).toBe('medium');
      expect(unchangedTask1!.acceptanceCriteria).toBeUndefined();
    });

    it('should handle template deletion with existing tasks', async () => {
      // Create template and tasks
      const template = await orchestrator.createTemplate({
        name: 'Deletion Test Template',
        description: 'Template for testing deletion',
        workflow: 'feature',
      });

      const task1 = await orchestrator.useTemplate(template.id);
      const task2 = await orchestrator.useTemplate(template.id, {
        description: 'Modified task description',
      });

      // Delete template
      await orchestrator.deleteTemplate(template.id);

      // Template should be gone
      const deletedTemplate = await orchestrator.getTemplate(template.id);
      expect(deletedTemplate).toBeNull();

      // Tasks should still exist and be functional
      const existingTask1 = await orchestrator.getTask(task1.id);
      const existingTask2 = await orchestrator.getTask(task2.id);

      expect(existingTask1).toBeDefined();
      expect(existingTask2).toBeDefined();
      expect(existingTask1!.name).toBe('Deletion Test Template');
      expect(existingTask2!.description).toBe('Modified task description');

      // Should not be able to create new tasks from deleted template
      await expect(orchestrator.useTemplate(template.id)).rejects.toThrow(
        `Template not found: ${template.id}`
      );
    });
  });

  describe('template management workflow', () => {
    it('should support complete template lifecycle management', async () => {
      // 1. Create multiple templates for different workflows
      const featureTemplate = await orchestrator.createTemplate({
        name: 'Feature Development Template',
        description: 'Standard template for feature development',
        workflow: 'feature',
        priority: 'normal',
        effort: 'medium',
        acceptanceCriteria: 'Feature must be tested and documented',
        tags: ['feature', 'development'],
      });

      const bugfixTemplate = await orchestrator.createTemplate({
        name: 'Bug Fix Template',
        description: 'Standard template for bug fixes',
        workflow: 'bugfix',
        priority: 'high',
        effort: 'small',
        acceptanceCriteria: 'Bug must be fixed and verified',
        tags: ['bugfix', 'urgent'],
      });

      // 2. List and verify templates
      const allTemplates = await orchestrator.listTemplates();
      expect(allTemplates.length).toBeGreaterThanOrEqual(2);

      const templateNames = allTemplates.map(t => t.name);
      expect(templateNames).toContain('Feature Development Template');
      expect(templateNames).toContain('Bug Fix Template');

      // 3. Create tasks from templates
      const featureTask = await orchestrator.useTemplate(featureTemplate.id, {
        description: 'Add user authentication',
      });

      const bugfixTask = await orchestrator.useTemplate(bugfixTemplate.id, {
        description: 'Fix login validation bug',
      });

      // 4. Update templates based on learnings
      await orchestrator.updateTemplate(featureTemplate.id, {
        acceptanceCriteria: 'Feature must be tested, documented, and reviewed',
        tags: ['feature', 'development', 'reviewed'],
      });

      await orchestrator.updateTemplate(bugfixTemplate.id, {
        effort: 'medium', // Bugs take longer than expected
        acceptanceCriteria: 'Bug must be fixed, tested, and verified with regression tests',
      });

      // 5. Create new tasks from updated templates
      const newFeatureTask = await orchestrator.useTemplate(featureTemplate.id, {
        description: 'Add user permissions system',
      });

      const newBugfixTask = await orchestrator.useTemplate(bugfixTemplate.id, {
        description: 'Fix email notification bug',
      });

      // 6. Verify new tasks have updated template properties
      expect(newFeatureTask.acceptanceCriteria).toBe('Feature must be tested, documented, and reviewed');
      expect(newFeatureTask.tags).toEqual(['feature', 'development', 'reviewed']);

      expect(newBugfixTask.effort).toBe('medium');
      expect(newBugfixTask.acceptanceCriteria).toBe('Bug must be fixed, tested, and verified with regression tests');

      // 7. Old tasks should maintain original properties
      const unchangedFeatureTask = await orchestrator.getTask(featureTask.id);
      const unchangedBugfixTask = await orchestrator.getTask(bugfixTask.id);

      expect(unchangedFeatureTask!.acceptanceCriteria).toBe('Feature must be tested and documented');
      expect(unchangedFeatureTask!.tags).toEqual(['feature', 'development']);

      expect(unchangedBugfixTask!.effort).toBe('small');
      expect(unchangedBugfixTask!.acceptanceCriteria).toBe('Bug must be fixed and verified');
    });

    it('should handle template versioning scenarios', async () => {
      // Create initial template
      const v1Template = await orchestrator.createTemplate({
        name: 'API Endpoint Template v1',
        description: 'Template for creating API endpoints',
        workflow: 'feature',
        priority: 'normal',
        effort: 'medium',
        acceptanceCriteria: 'Endpoint must return correct data',
        tags: ['api', 'endpoint'],
      });

      // Create some tasks from v1
      const v1Task1 = await orchestrator.useTemplate(v1Template.id);
      const v1Task2 = await orchestrator.useTemplate(v1Template.id);

      // Update template to v2 (major change)
      await orchestrator.updateTemplate(v1Template.id, {
        name: 'API Endpoint Template v2',
        acceptanceCriteria: 'Endpoint must return correct data, include error handling, and have security checks',
        effort: 'large',
        tags: ['api', 'endpoint', 'security'],
      });

      // Create tasks from v2
      const v2Task1 = await orchestrator.useTemplate(v1Template.id);
      const v2Task2 = await orchestrator.useTemplate(v1Template.id);

      // Verify v1 tasks maintain original properties
      const checkV1Task1 = await orchestrator.getTask(v1Task1.id);
      const checkV1Task2 = await orchestrator.getTask(v1Task2.id);

      expect(checkV1Task1!.name).toBe('API Endpoint Template v1');
      expect(checkV1Task1!.effort).toBe('medium');
      expect(checkV1Task1!.acceptanceCriteria).toBe('Endpoint must return correct data');
      expect(checkV1Task1!.tags).toEqual(['api', 'endpoint']);

      expect(checkV1Task2!.name).toBe('API Endpoint Template v1');
      expect(checkV1Task2!.effort).toBe('medium');

      // Verify v2 tasks have updated properties
      expect(v2Task1.name).toBe('API Endpoint Template v2');
      expect(v2Task1.effort).toBe('large');
      expect(v2Task1.acceptanceCriteria).toBe('Endpoint must return correct data, include error handling, and have security checks');
      expect(v2Task1.tags).toEqual(['api', 'endpoint', 'security']);

      expect(v2Task2.name).toBe('API Endpoint Template v2');
      expect(v2Task2.effort).toBe('large');

      // Create v3 by major update (simulate breaking change)
      await orchestrator.updateTemplate(v1Template.id, {
        name: 'API Endpoint Template v3',
        workflow: 'feature', // Change workflow requirements
        priority: 'high', // Increase priority
        acceptanceCriteria: 'Endpoint must be REST compliant, include comprehensive error handling, security checks, and monitoring',
        effort: 'large',
        tags: ['api', 'endpoint', 'security', 'monitoring', 'rest'],
      });

      // New tasks should get v3 properties
      const v3Task = await orchestrator.useTemplate(v1Template.id);
      expect(v3Task.name).toBe('API Endpoint Template v3');
      expect(v3Task.priority).toBe('high');
      expect(v3Task.tags).toEqual(['api', 'endpoint', 'security', 'monitoring', 'rest']);
    });
  });

  describe('bulk template operations', () => {
    it('should handle bulk template creation and management', async () => {
      // Create multiple templates for different types of work
      const templateData = [
        {
          name: 'Frontend Component Template',
          description: 'Template for React components',
          workflow: 'feature',
          tags: ['frontend', 'react', 'component'],
        },
        {
          name: 'Backend Service Template',
          description: 'Template for backend services',
          workflow: 'feature',
          tags: ['backend', 'service', 'api'],
        },
        {
          name: 'Database Migration Template',
          description: 'Template for database migrations',
          workflow: 'feature',
          tags: ['database', 'migration'],
          priority: 'high' as const,
        },
        {
          name: 'Security Audit Template',
          description: 'Template for security audits',
          workflow: 'docs',
          tags: ['security', 'audit'],
          priority: 'urgent' as const,
          effort: 'large' as const,
        },
      ];

      // Create all templates
      const createdTemplates = await Promise.all(
        templateData.map(data => orchestrator.createTemplate(data))
      );

      expect(createdTemplates).toHaveLength(4);

      // Verify all templates were created correctly
      createdTemplates.forEach((template, index) => {
        expect(template.name).toBe(templateData[index].name);
        expect(template.description).toBe(templateData[index].description);
        expect(template.workflow).toBe(templateData[index].workflow);
        expect(template.tags).toEqual(templateData[index].tags);
      });

      // Create tasks from each template
      const tasks = await Promise.all(
        createdTemplates.map(template =>
          orchestrator.useTemplate(template.id, {
            description: `Task from ${template.name}`,
          })
        )
      );

      expect(tasks).toHaveLength(4);

      // Verify tasks inherit template properties
      tasks.forEach((task, index) => {
        expect(task.name).toBe(templateData[index].name);
        expect(task.description).toBe(`Task from ${templateData[index].name}`);
        expect(task.workflow).toBe(templateData[index].workflow);
        expect(task.tags).toEqual(templateData[index].tags);
      });

      // Bulk update templates (simulate organization-wide changes)
      const updatePromises = createdTemplates.map(template =>
        orchestrator.updateTemplate(template.id, {
          tags: [...template.tags, 'organization-standard'],
          acceptanceCriteria: 'Must follow organization standards',
        })
      );

      const updatedTemplates = await Promise.all(updatePromises);

      // Verify bulk updates
      updatedTemplates.forEach(template => {
        expect(template.tags).toContain('organization-standard');
        expect(template.acceptanceCriteria).toBe('Must follow organization standards');
      });

      // Create new tasks and verify they inherit updated properties
      const newTasks = await Promise.all(
        updatedTemplates.map(template =>
          orchestrator.useTemplate(template.id, {
            description: `Updated task from ${template.name}`,
          })
        )
      );

      newTasks.forEach(task => {
        expect(task.tags).toContain('organization-standard');
        expect(task.acceptanceCriteria).toBe('Must follow organization standards');
      });

      // Original tasks should not be affected
      const originalTasks = await Promise.all(
        tasks.map(task => orchestrator.getTask(task.id))
      );

      originalTasks.forEach(task => {
        expect(task!.tags).not.toContain('organization-standard');
        expect(task!.acceptanceCriteria).toBeUndefined();
      });
    });
  });

  describe('template search and filtering integration', () => {
    let templates: TaskTemplate[];

    beforeEach(async () => {
      // Create test templates with various properties
      const templateData = [
        {
          name: 'User Authentication Feature',
          description: 'Implement user login and registration',
          workflow: 'feature',
          priority: 'high',
          tags: ['authentication', 'security', 'user'],
        },
        {
          name: 'Payment Integration',
          description: 'Integrate payment processing system',
          workflow: 'feature',
          priority: 'urgent',
          tags: ['payment', 'integration', 'api'],
        },
        {
          name: 'Login Bug Fix',
          description: 'Fix login validation issue',
          workflow: 'bugfix',
          priority: 'high',
          tags: ['bugfix', 'authentication', 'validation'],
        },
        {
          name: 'API Documentation',
          description: 'Update API documentation',
          workflow: 'docs',
          priority: 'normal',
          tags: ['documentation', 'api'],
        },
      ];

      templates = await Promise.all(
        templateData.map(data => orchestrator.createTemplate(data))
      );
    });

    it('should integrate template search with task creation', async () => {
      // Search for authentication templates
      const authTemplates = await orchestrator.searchTemplates('authentication');
      expect(authTemplates.length).toBeGreaterThanOrEqual(2);

      const authTemplateNames = authTemplates.map(t => t.name);
      expect(authTemplateNames).toContain('User Authentication Feature');
      expect(authTemplateNames).toContain('Login Bug Fix');

      // Create tasks from search results
      const authTasks = await Promise.all(
        authTemplates.map(template =>
          orchestrator.useTemplate(template.id, {
            description: `Auth task from ${template.name}`,
          })
        )
      );

      authTasks.forEach(task => {
        expect(task.tags).toContain('authentication');
        expect(task.description).toMatch(/^Auth task from/);
      });
    });

    it('should support filtering templates by workflow and creating tasks', async () => {
      // Get feature templates
      const featureTemplates = await orchestrator.getTemplatesByWorkflow('feature');
      expect(featureTemplates.length).toBeGreaterThanOrEqual(2);

      // Create feature tasks
      const featureTasks = await Promise.all(
        featureTemplates.map(template =>
          orchestrator.useTemplate(template.id, {
            description: `Feature task: ${template.description}`,
          })
        )
      );

      featureTasks.forEach(task => {
        expect(task.workflow).toBe('feature');
        expect(task.description).toMatch(/^Feature task:/);
      });

      // Get bugfix templates
      const bugfixTemplates = await orchestrator.getTemplatesByWorkflow('bugfix');
      expect(bugfixTemplates.length).toBeGreaterThanOrEqual(1);

      // Create bugfix tasks
      const bugfixTasks = await Promise.all(
        bugfixTemplates.map(template =>
          orchestrator.useTemplate(template.id, {
            description: `Bugfix task: ${template.description}`,
          })
        )
      );

      bugfixTasks.forEach(task => {
        expect(task.workflow).toBe('bugfix');
        expect(task.description).toMatch(/^Bugfix task:/);
      });
    });
  });

  describe('error recovery and consistency', () => {
    it('should maintain data consistency during partial failures', async () => {
      // Create template
      const template = await orchestrator.createTemplate({
        name: 'Consistency Test Template',
        description: 'Testing data consistency',
        workflow: 'feature',
      });

      // Create task from template
      const task = await orchestrator.useTemplate(template.id);

      // Simulate partial failure scenario by attempting invalid operations
      try {
        await orchestrator.updateTemplate(template.id, {
          workflow: 'invalid-workflow' as any,
        });
      } catch (error) {
        // Expected to fail
      }

      // Template and task should still be in consistent state
      const consistentTemplate = await orchestrator.getTemplate(template.id);
      const consistentTask = await orchestrator.getTask(task.id);

      expect(consistentTemplate).toBeDefined();
      expect(consistentTask).toBeDefined();
      expect(consistentTemplate!.workflow).toBe('feature'); // Unchanged
      expect(consistentTask!.workflow).toBe('feature'); // Unchanged

      // Should still be able to perform valid operations
      const validUpdate = await orchestrator.updateTemplate(template.id, {
        priority: 'high',
      });

      expect(validUpdate.priority).toBe('high');
    });

    it('should handle concurrent template operations with task creation', async () => {
      // Create template
      const template = await orchestrator.createTemplate({
        name: 'Concurrent Operations Template',
        description: 'Testing concurrent operations',
        workflow: 'feature',
      });

      // Start concurrent operations
      const operations = [
        // Template updates
        orchestrator.updateTemplate(template.id, { priority: 'high' }),
        orchestrator.updateTemplate(template.id, { effort: 'large' }),
        orchestrator.updateTemplate(template.id, { tags: ['concurrent'] }),

        // Task creation from template
        orchestrator.useTemplate(template.id, { description: 'Concurrent task 1' }),
        orchestrator.useTemplate(template.id, { description: 'Concurrent task 2' }),
        orchestrator.useTemplate(template.id, { description: 'Concurrent task 3' }),
      ];

      const results = await Promise.all(operations);

      // All operations should complete successfully
      expect(results).toHaveLength(6);

      // Template should be in consistent final state
      const finalTemplate = await orchestrator.getTemplate(template.id);
      expect(finalTemplate).toBeDefined();

      // Tasks should be created successfully
      const tasks = results.slice(3) as Task[];
      expect(tasks).toHaveLength(3);
      tasks.forEach((task, i) => {
        expect(task.description).toBe(`Concurrent task ${i + 1}`);
        expect(task.workflow).toBe('feature');
      });
    });
  });
});