import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TaskStore } from '../store.js';
import { TaskTemplate } from '@apexcli/core';
import { generateTaskTemplateId } from '@apexcli/core';

describe('TaskTemplate Edge Cases and Error Scenarios', () => {
  let testDir: string;
  let store: TaskStore;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-template-edge-cases-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
    store = new TaskStore(testDir);
    await store.initialize();
  });

  afterEach(async () => {
    store.close();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Database Constraint Violations', () => {
    it('should handle duplicate template IDs gracefully', async () => {
      const templateId = generateTaskTemplateId();
      const template1: TaskTemplate = {
        id: templateId,
        name: 'First Template',
        description: 'First template description',
        workflow: 'test',
        priority: 'normal',
        effort: 'medium',
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const template2: TaskTemplate = {
        id: templateId, // Same ID
        name: 'Second Template',
        description: 'Second template description',
        workflow: 'test',
        priority: 'normal',
        effort: 'medium',
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await store.createTemplate(template1);

      // Creating a template with duplicate ID should throw
      await expect(store.createTemplate(template2)).rejects.toThrow();
    });
  });

  describe('Malformed Data Handling', () => {
    it('should handle extremely long string fields', async () => {
      const template: TaskTemplate = {
        id: generateTaskTemplateId(),
        name: 'A'.repeat(1000), // Very long name
        description: 'B'.repeat(100000), // Extremely long description
        workflow: 'test',
        priority: 'normal',
        effort: 'medium',
        acceptanceCriteria: 'C'.repeat(50000), // Very long criteria
        tags: Array.from({ length: 1000 }, (_, i) => `tag-${i}`.repeat(100)), // Many long tags
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Should either succeed or fail gracefully
      try {
        await store.createTemplate(template);
        const retrieved = await store.getTemplate(template.id);
        expect(retrieved).toBeTruthy();
      } catch (error) {
        // If it fails, it should be a meaningful error
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should handle templates with null/undefined fields correctly', async () => {
      const template = {
        id: generateTaskTemplateId(),
        name: 'Test Template',
        description: 'Test description',
        workflow: 'test',
        priority: 'normal',
        effort: 'medium',
        acceptanceCriteria: null, // null instead of undefined
        tags: undefined, // undefined instead of array
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;

      await store.createTemplate(template);
      const retrieved = await store.getTemplate(template.id);

      expect(retrieved).toBeTruthy();
      expect(retrieved?.acceptanceCriteria).toBeUndefined();
      expect(retrieved?.tags).toEqual([]); // Should default to empty array
    });

    it('should handle invalid date objects', async () => {
      const template = {
        id: generateTaskTemplateId(),
        name: 'Test Template',
        description: 'Test description',
        workflow: 'test',
        priority: 'normal',
        effort: 'medium',
        tags: [],
        createdAt: new Date('invalid-date'), // Invalid date
        updatedAt: new Date(),
      } as TaskTemplate;

      // This should either handle the invalid date or throw a meaningful error
      try {
        await store.createTemplate(template);
        const retrieved = await store.getTemplate(template.id);
        expect(retrieved?.createdAt).toBeInstanceOf(Date);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('Concurrency and Race Conditions', () => {
    it('should handle concurrent updates to the same template', async () => {
      const template: TaskTemplate = {
        id: generateTaskTemplateId(),
        name: 'Concurrent Test Template',
        description: 'Template for testing concurrent updates',
        workflow: 'test',
        priority: 'normal',
        effort: 'medium',
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await store.createTemplate(template);

      // Perform concurrent updates
      const updatePromises = Array.from({ length: 10 }, (_, i) =>
        store.updateTemplate(template.id, {
          name: `Updated Name ${i}`,
          description: `Updated description ${i}`
        })
      );

      await Promise.all(updatePromises);

      // Verify template still exists and has been updated
      const finalTemplate = await store.getTemplate(template.id);
      expect(finalTemplate).toBeTruthy();
      expect(finalTemplate?.name).toMatch(/^Updated Name \d+$/);
    });

    it('should handle concurrent deletions', async () => {
      const template: TaskTemplate = {
        id: generateTaskTemplateId(),
        name: 'Template to Delete Concurrently',
        description: 'This template will be deleted multiple times',
        workflow: 'test',
        priority: 'normal',
        effort: 'medium',
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await store.createTemplate(template);

      // Try to delete the same template multiple times concurrently
      const deletePromises = Array.from({ length: 5 }, () =>
        store.deleteTemplate(template.id).catch(() => {
          // Ignore errors from subsequent delete attempts
        })
      );

      await Promise.allSettled(deletePromises);

      // Template should be deleted
      const retrieved = await store.getTemplate(template.id);
      expect(retrieved).toBeNull();
    });
  });

  describe('Search Edge Cases', () => {
    it('should handle search with SQL injection attempts', async () => {
      const template: TaskTemplate = {
        id: generateTaskTemplateId(),
        name: 'Normal Template',
        description: 'A normal template for testing',
        workflow: 'test',
        priority: 'normal',
        effort: 'medium',
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await store.createTemplate(template);

      // Test various SQL injection attempts
      const maliciousQueries = [
        "'; DROP TABLE task_templates; --",
        "' OR 1=1 --",
        "' UNION SELECT * FROM tasks --",
        "%'; DELETE FROM task_templates; --",
        "'; INSERT INTO task_templates VALUES (1, 'hack', 'hack', 'hack', 'hack', 'hack', 'hack', 'hack', 'hack', 'hack'); --"
      ];

      for (const query of maliciousQueries) {
        const results = await store.searchTemplates(query);

        // Should return empty results and not break the database
        expect(Array.isArray(results)).toBe(true);

        // Verify our original template still exists
        const stillExists = await store.getTemplate(template.id);
        expect(stillExists).toBeTruthy();
      }
    });

    it('should handle search with unicode and special characters', async () => {
      const template: TaskTemplate = {
        id: generateTaskTemplateId(),
        name: 'Üñíçödë Template 🚀',
        description: 'Template with émojis 📝 and spëcial chars äöü',
        workflow: 'test',
        priority: 'normal',
        effort: 'medium',
        tags: ['🏷️', 'üñíçödë', 'émojis'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await store.createTemplate(template);

      // Search for unicode content
      const results1 = await store.searchTemplates('Üñíçödë');
      expect(results1).toHaveLength(1);

      const results2 = await store.searchTemplates('émojis');
      expect(results2).toHaveLength(1);

      const results3 = await store.searchTemplates('🚀');
      expect(results3).toHaveLength(1);
    });

    it('should handle very long search queries', async () => {
      const template: TaskTemplate = {
        id: generateTaskTemplateId(),
        name: 'Searchable Template',
        description: 'This template can be found',
        workflow: 'test',
        priority: 'normal',
        effort: 'medium',
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await store.createTemplate(template);

      // Test with very long search query
      const longQuery = 'Searchable'.repeat(1000);
      const results = await store.searchTemplates(longQuery);

      // Should handle gracefully without crashing
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('should handle many templates efficiently', async () => {
      const templateCount = 1000;
      const templates: TaskTemplate[] = [];

      // Create many templates
      for (let i = 0; i < templateCount; i++) {
        templates.push({
          id: generateTaskTemplateId(),
          name: `Performance Test Template ${i}`,
          description: `Description for template ${i}`,
          workflow: `workflow-${i % 10}`, // 10 different workflows
          priority: i % 2 === 0 ? 'high' : 'normal',
          effort: i % 3 === 0 ? 'large' : 'medium',
          tags: [`tag-${i}`, `category-${i % 5}`],
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // Batch create templates
      const startTime = Date.now();

      for (const template of templates) {
        await store.createTemplate(template);
      }

      const createTime = Date.now() - startTime;

      // Should complete in reasonable time
      expect(createTime).toBeLessThan(30000); // Less than 30 seconds

      // Test query performance
      const queryStartTime = Date.now();
      const allTemplates = await store.getAllTemplates();
      const queryTime = Date.now() - queryStartTime;

      expect(allTemplates).toHaveLength(templateCount);
      expect(queryTime).toBeLessThan(5000); // Less than 5 seconds

      // Test search performance
      const searchStartTime = Date.now();
      const searchResults = await store.searchTemplates('Performance');
      const searchTime = Date.now() - searchStartTime;

      expect(searchResults.length).toBeGreaterThan(0);
      expect(searchTime).toBeLessThan(5000); // Less than 5 seconds
    });
  });

  describe('Database Recovery and Resilience', () => {
    it('should handle template operations after database reconnection', async () => {
      const template: TaskTemplate = {
        id: generateTaskTemplateId(),
        name: 'Resilience Test Template',
        description: 'Template for testing database resilience',
        workflow: 'test',
        priority: 'normal',
        effort: 'medium',
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await store.createTemplate(template);

      // Close and reinitialize the store
      store.close();
      store = new TaskStore(testDir);
      await store.initialize();

      // Should be able to retrieve the template
      const retrieved = await store.getTemplate(template.id);
      expect(retrieved).toBeTruthy();
      expect(retrieved?.name).toBe(template.name);

      // Should be able to perform operations
      await store.updateTemplate(template.id, { name: 'Updated Name' });
      const updated = await store.getTemplate(template.id);
      expect(updated?.name).toBe('Updated Name');
    });
  });

  describe('Data Consistency', () => {
    it('should maintain referential integrity when creating tasks from templates', async () => {
      const template: TaskTemplate = {
        id: generateTaskTemplateId(),
        name: 'Integrity Test Template',
        description: 'Template for testing referential integrity',
        workflow: 'test',
        priority: 'high',
        effort: 'large',
        acceptanceCriteria: 'Should maintain data integrity',
        tags: ['integrity', 'test'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await store.createTemplate(template);

      // Create multiple tasks from the same template
      const task1 = await store.createTaskFromTemplate(template.id);
      const task2 = await store.createTaskFromTemplate(template.id);

      // Verify both tasks have correct data
      expect(task1.description).toBe(template.description);
      expect(task2.description).toBe(template.description);
      expect(task1.id).not.toBe(task2.id); // Should have different IDs

      // Delete the template
      await store.deleteTemplate(template.id);

      // Tasks should still exist and be retrievable
      const retrievedTask1 = await store.getTask(task1.id);
      const retrievedTask2 = await store.getTask(task2.id);

      expect(retrievedTask1).toBeTruthy();
      expect(retrievedTask2).toBeTruthy();

      // But creating new tasks from the deleted template should fail
      await expect(store.createTaskFromTemplate(template.id)).rejects.toThrow();
    });
  });
});