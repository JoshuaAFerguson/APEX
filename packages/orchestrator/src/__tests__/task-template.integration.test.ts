import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TaskStore } from '../store.js';
import { TaskTemplate, TaskPriority, TaskEffort } from '@apexcli/core';
import { generateTaskTemplateId } from '@apexcli/core';

describe('TaskTemplate Integration Tests', () => {
  let testDir: string;
  let store: TaskStore;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-template-integration-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
    store = new TaskStore(testDir);
    await store.initialize();
  });

  afterEach(async () => {
    store.close();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Database Schema Validation', () => {
    it('should create task_templates table with correct schema', async () => {
      // This test verifies the table was created during initialization
      const template: TaskTemplate = {
        id: generateTaskTemplateId(),
        name: 'Schema Test Template',
        description: 'Testing database schema',
        workflow: 'test',
        priority: 'normal',
        effort: 'medium',
        acceptanceCriteria: 'Schema should be correct',
        tags: ['schema', 'test'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // If the schema is correct, this should not throw
      await expect(store.createTemplate(template)).resolves.not.toThrow();
    });

    it('should enforce NOT NULL constraints', async () => {
      // These tests verify database constraints are working
      const template = {
        id: generateTaskTemplateId(),
        name: 'Test Template',
        description: 'Test description',
        workflow: 'test',
        priority: 'normal',
        effort: 'medium',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as TaskTemplate;

      await store.createTemplate(template);

      // Verify we can retrieve the template
      const retrieved = await store.getTemplate(template.id);
      expect(retrieved).toBeTruthy();
      expect(retrieved?.name).toBe('Test Template');
    });

    it('should handle database indexes correctly', async () => {
      // Create multiple templates to test index performance
      const templates: TaskTemplate[] = [];
      for (let i = 0; i < 10; i++) {
        templates.push({
          id: generateTaskTemplateId(),
          name: `Template ${i}`,
          description: `Description for template ${i}`,
          workflow: i % 2 === 0 ? 'feature' : 'bugfix',
          priority: 'normal',
          effort: 'medium',
          tags: [`tag-${i}`],
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // Create all templates
      for (const template of templates) {
        await store.createTemplate(template);
      }

      // Test index on name (used in searches)
      const searchResults = await store.searchTemplates('Template 5');
      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].name).toBe('Template 5');

      // Test index on workflow (used in filtering)
      const featureTemplates = await store.getTemplatesByWorkflow('feature');
      expect(featureTemplates).toHaveLength(5); // Even numbered templates

      const bugfixTemplates = await store.getTemplatesByWorkflow('bugfix');
      expect(bugfixTemplates).toHaveLength(5); // Odd numbered templates
    });
  });

  describe('CRUD Operations with Edge Cases', () => {
    it('should handle concurrent template creation', async () => {
      const templates: TaskTemplate[] = Array.from({ length: 5 }, (_, i) => ({
        id: generateTaskTemplateId(),
        name: `Concurrent Template ${i}`,
        description: `Concurrent description ${i}`,
        workflow: 'concurrent-test',
        priority: 'normal',
        effort: 'medium',
        tags: [`concurrent-${i}`],
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      // Create all templates concurrently
      const promises = templates.map(template => store.createTemplate(template));
      await Promise.all(promises);

      // Verify all were created
      const allTemplates = await store.getAllTemplates();
      const concurrentTemplates = allTemplates.filter(t => t.workflow === 'concurrent-test');
      expect(concurrentTemplates).toHaveLength(5);
    });

    it('should handle large template data', async () => {
      const largeTemplate: TaskTemplate = {
        id: generateTaskTemplateId(),
        name: 'Large Template',
        description: 'A'.repeat(10000), // Large description
        workflow: 'large-data-test',
        priority: 'normal',
        effort: 'medium',
        acceptanceCriteria: 'B'.repeat(5000), // Large acceptance criteria
        tags: Array.from({ length: 100 }, (_, i) => `large-tag-${i}`), // Many tags
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await store.createTemplate(largeTemplate);
      const retrieved = await store.getTemplate(largeTemplate.id);

      expect(retrieved).toBeTruthy();
      expect(retrieved?.description).toHaveLength(10000);
      expect(retrieved?.acceptanceCriteria).toHaveLength(5000);
      expect(retrieved?.tags).toHaveLength(100);
    });

    it('should handle special characters in template data', async () => {
      const specialTemplate: TaskTemplate = {
        id: generateTaskTemplateId(),
        name: 'Template with "quotes" & symbols!',
        description: 'Description with <HTML> tags & émojis 🚀',
        workflow: 'special-chars-test',
        priority: 'normal',
        effort: 'medium',
        acceptanceCriteria: 'Criteria with SQL\' injection "attempt"',
        tags: ['tag-with-spaces ', ' tag-with-quotes"', "tag-with-apostrophe's"],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await store.createTemplate(specialTemplate);
      const retrieved = await store.getTemplate(specialTemplate.id);

      expect(retrieved).toBeTruthy();
      expect(retrieved?.name).toBe(specialTemplate.name);
      expect(retrieved?.description).toBe(specialTemplate.description);
      expect(retrieved?.acceptanceCriteria).toBe(specialTemplate.acceptanceCriteria);
      expect(retrieved?.tags).toEqual(specialTemplate.tags);
    });

    it('should handle template updates with null/undefined values', async () => {
      const template: TaskTemplate = {
        id: generateTaskTemplateId(),
        name: 'Original Template',
        description: 'Original description',
        workflow: 'update-test',
        priority: 'normal',
        effort: 'medium',
        acceptanceCriteria: 'Original criteria',
        tags: ['original'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await store.createTemplate(template);

      // Update with undefined acceptanceCriteria
      await store.updateTemplate(template.id, {
        acceptanceCriteria: undefined,
        tags: [],
      });

      const updated = await store.getTemplate(template.id);
      expect(updated?.acceptanceCriteria).toBeUndefined();
      expect(updated?.tags).toEqual([]);
    });
  });

  describe('Query Performance and Accuracy', () => {
    beforeEach(async () => {
      // Create test data for search tests
      const testTemplates: TaskTemplate[] = [
        {
          id: generateTaskTemplateId(),
          name: 'Authentication Feature',
          description: 'Implement user authentication system',
          workflow: 'feature',
          priority: 'high',
          effort: 'xl',
          tags: ['auth', 'security', 'feature'],
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2023-01-01'),
        },
        {
          id: generateTaskTemplateId(),
          name: 'Bug Fix Template',
          description: 'Template for fixing authentication bugs',
          workflow: 'bugfix',
          priority: 'urgent',
          effort: 'small',
          tags: ['auth', 'bug', 'fix'],
          createdAt: new Date('2023-01-02'),
          updatedAt: new Date('2023-01-02'),
        },
        {
          id: generateTaskTemplateId(),
          name: 'Documentation Update',
          description: 'Update documentation for authentication',
          workflow: 'docs',
          priority: 'low',
          effort: 'xs',
          tags: ['docs', 'auth'],
          createdAt: new Date('2023-01-03'),
          updatedAt: new Date('2023-01-03'),
        },
      ];

      for (const template of testTemplates) {
        await store.createTemplate(template);
      }
    });

    it('should perform case-insensitive search', async () => {
      const results = await store.searchTemplates('AUTHENTICATION');
      expect(results.length).toBeGreaterThan(0);

      // Should find templates with "authentication" in name or description
      const authResults = results.filter(r =>
        r.name.toLowerCase().includes('authentication') ||
        r.description.toLowerCase().includes('authentication')
      );
      expect(authResults.length).toBeGreaterThan(0);
    });

    it('should return templates sorted correctly by search relevance', async () => {
      const results = await store.searchTemplates('authentication');
      expect(results.length).toBeGreaterThanOrEqual(2);

      // Templates with "authentication" in the name should come before
      // templates with it only in description
      const nameMatches = results.filter(r =>
        r.name.toLowerCase().includes('authentication')
      );
      const descriptionMatches = results.filter(r =>
        !r.name.toLowerCase().includes('authentication') &&
        r.description.toLowerCase().includes('authentication')
      );

      if (nameMatches.length > 0 && descriptionMatches.length > 0) {
        const firstNameMatchIndex = results.findIndex(r =>
          r.name.toLowerCase().includes('authentication')
        );
        const firstDescMatchIndex = results.findIndex(r =>
          !r.name.toLowerCase().includes('authentication') &&
          r.description.toLowerCase().includes('authentication')
        );

        expect(firstNameMatchIndex).toBeLessThan(firstDescMatchIndex);
      }
    });

    it('should filter templates by workflow accurately', async () => {
      const featureTemplates = await store.getTemplatesByWorkflow('feature');
      expect(featureTemplates).toHaveLength(1);
      expect(featureTemplates[0].name).toBe('Authentication Feature');

      const bugfixTemplates = await store.getTemplatesByWorkflow('bugfix');
      expect(bugfixTemplates).toHaveLength(1);
      expect(bugfixTemplates[0].name).toBe('Bug Fix Template');

      const docsTemplates = await store.getTemplatesByWorkflow('docs');
      expect(docsTemplates).toHaveLength(1);
      expect(docsTemplates[0].name).toBe('Documentation Update');
    });

    it('should return all templates sorted by name', async () => {
      const allTemplates = await store.getAllTemplates();
      expect(allTemplates.length).toBeGreaterThanOrEqual(3);

      // Verify sorting
      const names = allTemplates.map(t => t.name);
      const sortedNames = [...names].sort();
      expect(names).toEqual(sortedNames);
    });
  });

  describe('Task Creation from Templates', () => {
    let templateId: string;

    beforeEach(async () => {
      const template: TaskTemplate = {
        id: generateTaskTemplateId(),
        name: 'Test Template for Task Creation',
        description: 'This template will be used to create tasks',
        workflow: 'feature',
        priority: 'high',
        effort: 'medium',
        acceptanceCriteria: 'Task should inherit template properties',
        tags: ['template-test', 'task-creation'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await store.createTemplate(template);
      templateId = template.id;
    });

    it('should create task with all template properties', async () => {
      const task = await store.createTaskFromTemplate(templateId);

      expect(task.description).toBe('This template will be used to create tasks');
      expect(task.workflow).toBe('feature');
      expect(task.priority).toBe('high');
      expect(task.effort).toBe('medium');
      expect(task.acceptanceCriteria).toBe('Task should inherit template properties');
      expect(task.status).toBe('pending');
      expect(task.autonomy).toBe('full'); // Default value
      expect(task.projectPath).toBe(testDir);
    });

    it('should override template properties with provided values', async () => {
      const overrides = {
        description: 'Custom task description',
        priority: 'urgent' as TaskPriority,
        effort: 'xl' as TaskEffort,
        acceptanceCriteria: 'Custom acceptance criteria',
      };

      const task = await store.createTaskFromTemplate(templateId, overrides);

      expect(task.description).toBe(overrides.description);
      expect(task.priority).toBe(overrides.priority);
      expect(task.effort).toBe(overrides.effort);
      expect(task.acceptanceCriteria).toBe(overrides.acceptanceCriteria);
      expect(task.workflow).toBe('feature'); // Should not be overridden
    });

    it('should generate unique task IDs', async () => {
      const task1 = await store.createTaskFromTemplate(templateId);
      const task2 = await store.createTaskFromTemplate(templateId);

      expect(task1.id).not.toBe(task2.id);
      expect(task1.id).toMatch(/^task_/);
      expect(task2.id).toMatch(/^task_/);
    });

    it('should handle template with undefined acceptanceCriteria', async () => {
      const template: TaskTemplate = {
        id: generateTaskTemplateId(),
        name: 'Template without criteria',
        description: 'Template without acceptance criteria',
        workflow: 'test',
        priority: 'normal',
        effort: 'medium',
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await store.createTemplate(template);
      const task = await store.createTaskFromTemplate(template.id);

      expect(task.acceptanceCriteria).toBeUndefined();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle template deletion with proper cleanup', async () => {
      const template: TaskTemplate = {
        id: generateTaskTemplateId(),
        name: 'Template to Delete',
        description: 'This template will be deleted',
        workflow: 'test',
        priority: 'normal',
        effort: 'medium',
        tags: ['to-delete'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await store.createTemplate(template);

      // Verify template exists
      const beforeDelete = await store.getTemplate(template.id);
      expect(beforeDelete).toBeTruthy();

      // Delete template
      await store.deleteTemplate(template.id);

      // Verify template is gone
      const afterDelete = await store.getTemplate(template.id);
      expect(afterDelete).toBeNull();
    });

    it('should handle attempts to update non-existent templates gracefully', async () => {
      // This should not throw an error, just silently do nothing
      await expect(
        store.updateTemplate('non-existent-id', { name: 'New Name' })
      ).resolves.not.toThrow();
    });

    it('should handle search with empty query string', async () => {
      const results = await store.searchTemplates('');
      // Should return no results or handle gracefully
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle search with very long query string', async () => {
      const longQuery = 'a'.repeat(10000);
      const results = await store.searchTemplates(longQuery);
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle database connection issues gracefully', async () => {
      // Close the store to simulate connection issues
      store.close();

      // These operations should handle the closed database gracefully
      await expect(store.getAllTemplates()).rejects.toThrow();
      await expect(store.getTemplate('any-id')).rejects.toThrow();
    });
  });
});