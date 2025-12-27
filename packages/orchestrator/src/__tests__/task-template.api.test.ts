import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from '../index.js';
import { TaskTemplate } from '@apexcli/core';

describe('ApexOrchestrator Template API Tests', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-api-template-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });

    // Create basic config files
    await fs.writeFile(
      path.join(testDir, '.apex', 'config.yaml'),
      `
project:
  name: "Template API Test"
agents: {}
workflows: {}
`
    );

    orchestrator = new ApexOrchestrator();
    await orchestrator.initialize(testDir);
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.close();
    }
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Template Lifecycle Management', () => {
    it('should complete full template lifecycle: create task → save as template → use template → delete template', async () => {
      // 1. Create a task
      const originalTask = await orchestrator.createTask({
        description: 'Template lifecycle test task',
        workflow: 'feature',
        acceptanceCriteria: 'Should support full lifecycle',
        priority: 'high',
        effort: 'medium',
      });

      expect(originalTask.id).toMatch(/^task_/);

      // 2. Save task as template
      const savedTemplate = await orchestrator.saveTemplate(originalTask.id, 'Lifecycle Test Template');

      expect(savedTemplate.id).toMatch(/^template_/);
      expect(savedTemplate.name).toBe('Lifecycle Test Template');
      expect(savedTemplate.description).toBe(originalTask.description);
      expect(savedTemplate.workflow).toBe(originalTask.workflow);
      expect(savedTemplate.acceptanceCriteria).toBe(originalTask.acceptanceCriteria);

      // 3. List templates and verify it exists
      const allTemplates = await orchestrator.listTemplates();
      const foundTemplate = allTemplates.find(t => t.id === savedTemplate.id);
      expect(foundTemplate).toBeDefined();

      // 4. Use template to create new tasks
      const newTask1 = await orchestrator.useTemplate(savedTemplate.id);
      const newTask2 = await orchestrator.useTemplate(savedTemplate.id, {
        description: 'Modified from template',
        priority: 'urgent',
      });

      expect(newTask1.id).toMatch(/^task_/);
      expect(newTask1.id).not.toBe(originalTask.id);
      expect(newTask1.description).toBe(savedTemplate.description);
      expect(newTask1.priority).toBe(savedTemplate.priority);

      expect(newTask2.id).toMatch(/^task_/);
      expect(newTask2.description).toBe('Modified from template');
      expect(newTask2.priority).toBe('urgent');
      expect(newTask2.workflow).toBe(savedTemplate.workflow); // Should not override

      // 5. Delete template
      await orchestrator.deleteTemplate(savedTemplate.id);

      // 6. Verify template is gone but tasks remain
      const templatesAfterDelete = await orchestrator.listTemplates();
      expect(templatesAfterDelete.find(t => t.id === savedTemplate.id)).toBeUndefined();

      const task1AfterDelete = await orchestrator.getTask(newTask1.id);
      const task2AfterDelete = await orchestrator.getTask(newTask2.id);
      expect(task1AfterDelete).toBeDefined();
      expect(task2AfterDelete).toBeDefined();
    });
  });

  describe('Template Creation Edge Cases', () => {
    it('should handle template creation with minimal task data', async () => {
      const minimalTask = await orchestrator.createTask({
        description: 'Minimal task for template',
        workflow: 'bugfix',
      });

      const template = await orchestrator.saveTemplate(minimalTask.id, 'Minimal Template');

      expect(template.priority).toBe('normal'); // Default value
      expect(template.effort).toBe('medium'); // Default value
      expect(template.acceptanceCriteria).toBeUndefined();
      expect(template.tags).toEqual([]);
    });

    it('should handle template creation with all optional fields', async () => {
      const fullTask = await orchestrator.createTask({
        description: 'Complete task for template',
        workflow: 'feature',
        acceptanceCriteria: 'All fields should be preserved',
        priority: 'urgent',
        effort: 'xl',
        tags: ['test', 'template', 'comprehensive'],
      });

      const template = await orchestrator.saveTemplate(fullTask.id, 'Complete Template');

      expect(template.description).toBe(fullTask.description);
      expect(template.workflow).toBe(fullTask.workflow);
      expect(template.acceptanceCriteria).toBe(fullTask.acceptanceCriteria);
      expect(template.priority).toBe(fullTask.priority);
      expect(template.effort).toBe(fullTask.effort);
      expect(template.tags).toEqual(fullTask.tags);
    });

    it('should trim whitespace from template names', async () => {
      const task = await orchestrator.createTask({
        description: 'Test task',
        workflow: 'test',
      });

      const template = await orchestrator.saveTemplate(task.id, '  Whitespace Template  ');
      expect(template.name).toBe('Whitespace Template');
    });

    it('should handle special characters in template names', async () => {
      const task = await orchestrator.createTask({
        description: 'Special chars task',
        workflow: 'test',
      });

      const specialName = 'Template with "quotes" & symbols! 🚀';
      const template = await orchestrator.saveTemplate(task.id, specialName);
      expect(template.name).toBe(specialName);
    });
  });

  describe('Template Usage Edge Cases', () => {
    let templateId: string;

    beforeEach(async () => {
      const task = await orchestrator.createTask({
        description: 'Base template task',
        workflow: 'feature',
        acceptanceCriteria: 'Base acceptance criteria',
        priority: 'high',
        effort: 'large',
        tags: ['base', 'template'],
      });

      const template = await orchestrator.saveTemplate(task.id, 'Edge Case Template');
      templateId = template.id;
    });

    it('should handle empty overrides object', async () => {
      const newTask = await orchestrator.useTemplate(templateId, {});

      const template = await orchestrator.listTemplates();
      const sourceTemplate = template.find(t => t.id === templateId)!;

      expect(newTask.description).toBe(sourceTemplate.description);
      expect(newTask.workflow).toBe(sourceTemplate.workflow);
      expect(newTask.priority).toBe(sourceTemplate.priority);
    });

    it('should handle partial overrides', async () => {
      const newTask = await orchestrator.useTemplate(templateId, {
        description: 'Partially overridden task',
        effort: 'small',
      });

      const template = await orchestrator.listTemplates();
      const sourceTemplate = template.find(t => t.id === templateId)!;

      expect(newTask.description).toBe('Partially overridden task');
      expect(newTask.effort).toBe('small');
      expect(newTask.workflow).toBe(sourceTemplate.workflow); // Not overridden
      expect(newTask.priority).toBe(sourceTemplate.priority); // Not overridden
    });

    it('should handle overrides with undefined values', async () => {
      const newTask = await orchestrator.useTemplate(templateId, {
        acceptanceCriteria: undefined,
        tags: [],
      });

      expect(newTask.acceptanceCriteria).toBeUndefined();
      expect(newTask.tags).toEqual([]);
    });

    it('should preserve projectPath from orchestrator context', async () => {
      const newTask = await orchestrator.useTemplate(templateId);
      expect(newTask.projectPath).toBe(testDir);
    });

    it('should allow overriding projectPath', async () => {
      const customPath = '/custom/project/path';
      const newTask = await orchestrator.useTemplate(templateId, {
        projectPath: customPath,
      });
      expect(newTask.projectPath).toBe(customPath);
    });

    it('should generate unique task IDs for multiple template uses', async () => {
      const task1 = await orchestrator.useTemplate(templateId);
      const task2 = await orchestrator.useTemplate(templateId);
      const task3 = await orchestrator.useTemplate(templateId);

      expect(task1.id).not.toBe(task2.id);
      expect(task1.id).not.toBe(task3.id);
      expect(task2.id).not.toBe(task3.id);

      expect(task1.id).toMatch(/^task_/);
      expect(task2.id).toMatch(/^task_/);
      expect(task3.id).toMatch(/^task_/);
    });
  });

  describe('Template Listing and Querying', () => {
    beforeEach(async () => {
      // Create multiple templates for testing
      const templates = [
        { name: 'Alpha Template', description: 'First template', workflow: 'feature', priority: 'high' },
        { name: 'Beta Template', description: 'Second template', workflow: 'bugfix', priority: 'normal' },
        { name: 'Gamma Template', description: 'Third template', workflow: 'docs', priority: 'low' },
      ];

      for (const templateData of templates) {
        const task = await orchestrator.createTask({
          description: templateData.description,
          workflow: templateData.workflow,
          priority: templateData.priority as any,
        });
        await orchestrator.saveTemplate(task.id, templateData.name);
      }
    });

    it('should return templates sorted by name', async () => {
      const templates = await orchestrator.listTemplates();
      expect(templates.length).toBeGreaterThanOrEqual(3);

      const names = templates.map(t => t.name);
      const sortedNames = [...names].sort();
      expect(names).toEqual(sortedNames);
    });

    it('should return empty array when no templates exist', async () => {
      // Delete all templates
      const allTemplates = await orchestrator.listTemplates();
      for (const template of allTemplates) {
        await orchestrator.deleteTemplate(template.id);
      }

      const templatesAfterDelete = await orchestrator.listTemplates();
      expect(templatesAfterDelete).toEqual([]);
    });

    it('should handle concurrent template listing', async () => {
      const promises = Array.from({ length: 10 }, () => orchestrator.listTemplates());
      const results = await Promise.all(promises);

      // All results should be identical
      const firstResult = results[0];
      for (const result of results.slice(1)) {
        expect(result).toEqual(firstResult);
      }
    });
  });

  describe('Error Handling and Validation', () => {
    it('should throw error when saving template for non-existent task', async () => {
      await expect(
        orchestrator.saveTemplate('non-existent-task-id', 'Invalid Template')
      ).rejects.toThrow('Task not found: non-existent-task-id');
    });

    it('should throw error when using non-existent template', async () => {
      await expect(
        orchestrator.useTemplate('non-existent-template-id')
      ).rejects.toThrow('Template not found: non-existent-template-id');
    });

    it('should throw error when deleting non-existent template', async () => {
      await expect(
        orchestrator.deleteTemplate('non-existent-template-id')
      ).rejects.toThrow('Template not found: non-existent-template-id');
    });

    it('should handle concurrent operations gracefully', async () => {
      const task = await orchestrator.createTask({
        description: 'Concurrent test task',
        workflow: 'test',
      });

      const template = await orchestrator.saveTemplate(task.id, 'Concurrent Template');

      // Try to delete the same template multiple times
      const deletePromises = Array.from({ length: 5 }, () =>
        orchestrator.deleteTemplate(template.id).catch(() => {
          // Ignore subsequent deletion errors
        })
      );

      await Promise.allSettled(deletePromises);

      // Template should be gone
      const templates = await orchestrator.listTemplates();
      expect(templates.find(t => t.id === template.id)).toBeUndefined();
    });

    it('should handle template name validation', async () => {
      const task = await orchestrator.createTask({
        description: 'Name validation test',
        workflow: 'test',
      });

      // Very long name should be handled appropriately
      const longName = 'A'.repeat(200);
      const template = await orchestrator.saveTemplate(task.id, longName);
      expect(template.name).toBe(longName);
    });
  });

  describe('Template Metadata and Timestamps', () => {
    it('should set appropriate timestamps on template creation', async () => {
      const task = await orchestrator.createTask({
        description: 'Timestamp test',
        workflow: 'test',
      });

      const beforeCreate = new Date();
      const template = await orchestrator.saveTemplate(task.id, 'Timestamp Template');
      const afterCreate = new Date();

      expect(template.createdAt).toBeInstanceOf(Date);
      expect(template.updatedAt).toBeInstanceOf(Date);
      expect(template.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
      expect(template.createdAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
      expect(template.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
      expect(template.updatedAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
    });

    it('should include template ID with correct prefix', async () => {
      const task = await orchestrator.createTask({
        description: 'ID test',
        workflow: 'test',
      });

      const template = await orchestrator.saveTemplate(task.id, 'ID Template');
      expect(template.id).toMatch(/^template_/);
      expect(template.id.length).toBeGreaterThan(10); // Should have meaningful ID
    });

    it('should preserve all task metadata in template', async () => {
      const task = await orchestrator.createTask({
        description: 'Metadata preservation test',
        workflow: 'feature',
        acceptanceCriteria: 'Should preserve all metadata',
        priority: 'urgent',
        effort: 'xl',
        tags: ['metadata', 'preservation', 'test'],
      });

      const template = await orchestrator.saveTemplate(task.id, 'Metadata Template');

      expect(template.description).toBe(task.description);
      expect(template.workflow).toBe(task.workflow);
      expect(template.acceptanceCriteria).toBe(task.acceptanceCriteria);
      expect(template.priority).toBe(task.priority);
      expect(template.effort).toBe(task.effort);
      expect(template.tags).toEqual(task.tags);
    });
  });
});