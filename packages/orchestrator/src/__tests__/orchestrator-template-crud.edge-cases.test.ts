import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from '../index';
import type { TaskTemplate } from '@apexcli/core';

describe('ApexOrchestrator - Template CRUD Edge Cases', () => {
  let orchestrator: ApexOrchestrator;
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-template-edge-test-'));
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

  describe('createTemplate input validation', () => {
    it('should handle template with empty string fields', async () => {
      const templateData = {
        name: '',
        description: '',
        workflow: 'feature',
        acceptanceCriteria: '',
        tags: [] as string[],
      };

      const template = await orchestrator.createTemplate(templateData);

      expect(template.name).toBe('');
      expect(template.description).toBe('');
      expect(template.acceptanceCriteria).toBe('');
      expect(template.tags).toEqual([]);
    });

    it('should handle template with very long strings', async () => {
      const longString = 'x'.repeat(10000);
      const templateData = {
        name: longString,
        description: longString,
        workflow: 'feature',
        acceptanceCriteria: longString,
        tags: Array.from({ length: 100 }, (_, i) => `tag-${i}`),
      };

      const template = await orchestrator.createTemplate(templateData);

      expect(template.name).toBe(longString);
      expect(template.description).toBe(longString);
      expect(template.acceptanceCriteria).toBe(longString);
      expect(template.tags).toHaveLength(100);
    });

    it('should handle template with special characters', async () => {
      const templateData = {
        name: 'Template with "quotes" & symbols!',
        description: 'Description with\nnewlines\nand\ttabs',
        workflow: 'feature',
        acceptanceCriteria: "Criteria with 'single quotes' and emoji 🚀",
        tags: ['tag-with-spaces ', ' tag-with-quotes"', "tag-with-apostrophe's"],
      };

      const template = await orchestrator.createTemplate(templateData);

      expect(template.name).toBe('Template with "quotes" & symbols!');
      expect(template.description).toBe('Description with\nnewlines\nand\ttabs');
      expect(template.acceptanceCriteria).toBe("Criteria with 'single quotes' and emoji 🚀");
      expect(template.tags).toEqual(['tag-with-spaces ', ' tag-with-quotes"', "tag-with-apostrophe's"]);
    });

    it('should handle template with undefined optional fields', async () => {
      const templateData = {
        name: 'Minimal Template',
        description: 'Description',
        workflow: 'feature',
        acceptanceCriteria: undefined,
        tags: undefined,
      } as any;

      const template = await orchestrator.createTemplate(templateData);

      expect(template.acceptanceCriteria).toBeUndefined();
      expect(template.tags).toEqual([]);
    });

    it('should generate unique template IDs for concurrent creates', async () => {
      const templateData = {
        name: 'Concurrent Template',
        description: 'Template for testing concurrent creation',
        workflow: 'feature',
      };

      const promises = Array.from({ length: 10 }, () =>
        orchestrator.createTemplate({ ...templateData })
      );

      const templates = await Promise.all(promises);
      const ids = templates.map(t => t.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(10);
      templates.forEach(template => {
        expect(template.id).toMatch(/^template_/);
      });
    });
  });

  describe('getTemplate edge cases', () => {
    it('should handle malformed template IDs', async () => {
      const malformedIds = [
        '',
        ' ',
        'template_',
        'not_a_template_id',
        'template_with_very_long_suffix_that_exceeds_normal_length',
        'template_with-special!@#$%^&*()characters',
        null as any,
        undefined as any,
      ];

      for (const id of malformedIds) {
        const template = await orchestrator.getTemplate(id);
        expect(template).toBeNull();
      }
    });

    it('should handle concurrent get requests for same template', async () => {
      const template = await orchestrator.createTemplate({
        name: 'Concurrent Get Template',
        description: 'Template for testing concurrent gets',
        workflow: 'feature',
      });

      const promises = Array.from({ length: 20 }, () =>
        orchestrator.getTemplate(template.id)
      );

      const results = await Promise.all(promises);

      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result!.id).toBe(template.id);
        expect(result!.name).toBe('Concurrent Get Template');
      });
    });
  });

  describe('updateTemplate edge cases', () => {
    let templateId: string;

    beforeEach(async () => {
      const template = await orchestrator.createTemplate({
        name: 'Edge Case Template',
        description: 'Template for testing edge cases',
        workflow: 'feature',
        priority: 'normal',
        effort: 'medium',
        acceptanceCriteria: 'Original criteria',
        tags: ['original'],
      });
      templateId = template.id;
    });

    it('should handle empty updates object', async () => {
      const originalTemplate = await orchestrator.getTemplate(templateId);
      const updatedTemplate = await orchestrator.updateTemplate(templateId, {});

      expect(updatedTemplate.name).toBe(originalTemplate!.name);
      expect(updatedTemplate.description).toBe(originalTemplate!.description);
      expect(updatedTemplate.workflow).toBe(originalTemplate!.workflow);
      expect(updatedTemplate.priority).toBe(originalTemplate!.priority);
      expect(updatedTemplate.effort).toBe(originalTemplate!.effort);
      expect(updatedTemplate.acceptanceCriteria).toBe(originalTemplate!.acceptanceCriteria);
      expect(updatedTemplate.tags).toEqual(originalTemplate!.tags);
      expect(updatedTemplate.updatedAt.getTime()).toBeGreaterThan(originalTemplate!.updatedAt.getTime());
    });

    it('should handle updates with undefined values', async () => {
      const updates = {
        acceptanceCriteria: undefined,
        tags: undefined,
      } as any;

      const updatedTemplate = await orchestrator.updateTemplate(templateId, updates);

      expect(updatedTemplate.acceptanceCriteria).toBeUndefined();
      expect(updatedTemplate.tags).toEqual([]);
    });

    it('should handle very long update values', async () => {
      const longString = 'y'.repeat(15000);
      const manyTags = Array.from({ length: 200 }, (_, i) => `updated-tag-${i}`);

      const updates = {
        name: longString,
        description: longString,
        acceptanceCriteria: longString,
        tags: manyTags,
      };

      const updatedTemplate = await orchestrator.updateTemplate(templateId, updates);

      expect(updatedTemplate.name).toBe(longString);
      expect(updatedTemplate.description).toBe(longString);
      expect(updatedTemplate.acceptanceCriteria).toBe(longString);
      expect(updatedTemplate.tags).toEqual(manyTags);
    });

    it('should handle concurrent updates to same template', async () => {
      const updatePromises = Array.from({ length: 10 }, (_, i) =>
        orchestrator.updateTemplate(templateId, {
          name: `Updated Name ${i}`,
          description: `Updated description ${i}`,
        })
      );

      // All updates should complete without error
      await Promise.all(updatePromises);

      // Final template should have been updated
      const finalTemplate = await orchestrator.getTemplate(templateId);
      expect(finalTemplate).toBeDefined();
      expect(finalTemplate!.name).toMatch(/^Updated Name \d+$/);
    });

    it('should handle rapid successive updates', async () => {
      const updates = Array.from({ length: 5 }, (_, i) => ({
        name: `Rapid Update ${i}`,
        priority: i % 2 === 0 ? 'high' as const : 'normal' as const,
      }));

      for (const update of updates) {
        await orchestrator.updateTemplate(templateId, update);
      }

      const finalTemplate = await orchestrator.getTemplate(templateId);
      expect(finalTemplate!.name).toBe('Rapid Update 4');
      expect(finalTemplate!.priority).toBe('normal');
    });

    it('should throw error when updating with invalid template ID patterns', async () => {
      const invalidIds = [
        '',
        ' ',
        'not-a-template-id',
        'template_nonexistent',
        'TEMPLATE_UPPERCASE',
      ];

      for (const id of invalidIds) {
        await expect(
          orchestrator.updateTemplate(id, { name: 'New Name' })
        ).rejects.toThrow(`Template not found: ${id}`);
      }
    });
  });

  describe('template CRUD with events', () => {
    it('should emit events in correct order during CRUD operations', async () => {
      const events: string[] = [];

      orchestrator.on('template:created', () => events.push('created'));
      orchestrator.on('template:updated', () => events.push('updated'));
      orchestrator.on('template:deleted', () => events.push('deleted'));

      // Create
      const template = await orchestrator.createTemplate({
        name: 'Event Test Template',
        description: 'Testing event order',
        workflow: 'feature',
      });

      // Update
      await orchestrator.updateTemplate(template.id, { name: 'Updated Event Template' });

      // Delete
      await orchestrator.deleteTemplate(template.id);

      expect(events).toEqual(['created', 'updated', 'deleted']);
    });

    it('should emit events with correct template data', async () => {
      let createdTemplate: TaskTemplate | undefined;
      let updatedTemplate: TaskTemplate | undefined;
      let deletedTemplateId: string | undefined;

      orchestrator.on('template:created', (template) => {
        createdTemplate = template;
      });
      orchestrator.on('template:updated', (template) => {
        updatedTemplate = template;
      });
      orchestrator.on('template:deleted', (templateId) => {
        deletedTemplateId = templateId;
      });

      const templateData = {
        name: 'Event Data Test',
        description: 'Testing event data',
        workflow: 'feature',
        priority: 'normal' as const,
      };

      // Create
      const template = await orchestrator.createTemplate(templateData);

      expect(createdTemplate).toBeDefined();
      expect(createdTemplate!.id).toBe(template.id);
      expect(createdTemplate!.name).toBe('Event Data Test');
      expect(createdTemplate!.priority).toBe('normal');

      // Update
      const updates = { name: 'Updated Event Data Test', priority: 'high' as const };
      await orchestrator.updateTemplate(template.id, updates);

      expect(updatedTemplate).toBeDefined();
      expect(updatedTemplate!.id).toBe(template.id);
      expect(updatedTemplate!.name).toBe('Updated Event Data Test');
      expect(updatedTemplate!.priority).toBe('high');

      // Delete
      await orchestrator.deleteTemplate(template.id);

      expect(deletedTemplateId).toBe(template.id);
    });
  });

  describe('template CRUD error resilience', () => {
    it('should handle database connection issues gracefully', async () => {
      // Create a template first
      const template = await orchestrator.createTemplate({
        name: 'Connection Test Template',
        description: 'Testing connection issues',
        workflow: 'feature',
      });

      // Close the orchestrator to simulate connection issues
      orchestrator.close();

      // Operations should now throw errors
      await expect(
        orchestrator.createTemplate({
          name: 'Should Fail',
          description: 'Should fail',
          workflow: 'feature',
        })
      ).rejects.toThrow();

      await expect(
        orchestrator.getTemplate(template.id)
      ).rejects.toThrow();

      await expect(
        orchestrator.updateTemplate(template.id, { name: 'Should Fail' })
      ).rejects.toThrow();
    });

    it('should maintain data consistency during partial failures', async () => {
      const template = await orchestrator.createTemplate({
        name: 'Consistency Test',
        description: 'Testing data consistency',
        workflow: 'feature',
        tags: ['consistency'],
      });

      // Attempt multiple operations with potential failure points
      try {
        await orchestrator.updateTemplate(template.id, {
          name: 'Updated Consistency Test',
          tags: ['consistency', 'updated'],
        });
      } catch (error) {
        // If update fails, template should still exist in original state
      }

      const retrievedTemplate = await orchestrator.getTemplate(template.id);
      expect(retrievedTemplate).toBeDefined();
      expect(retrievedTemplate!.id).toBe(template.id);
      // Either original or updated state should be consistent
      expect(['Consistency Test', 'Updated Consistency Test']).toContain(retrievedTemplate!.name);
    });
  });

  describe('template creation with validation', () => {
    it('should apply default values correctly', async () => {
      const templateData = {
        name: 'Defaults Test',
        description: 'Testing default values',
        workflow: 'feature',
      };

      const template = await orchestrator.createTemplate(templateData);

      expect(template.priority).toBe('normal');
      expect(template.effort).toBe('medium');
      expect(template.tags).toEqual([]);
      expect(template.acceptanceCriteria).toBeUndefined();
      expect(template.createdAt).toBeInstanceOf(Date);
      expect(template.updatedAt).toBeInstanceOf(Date);
      expect(template.createdAt.getTime()).toBeLessThanOrEqual(template.updatedAt.getTime());
    });

    it('should preserve timestamp precision', async () => {
      const beforeCreate = Date.now();

      const template = await orchestrator.createTemplate({
        name: 'Timestamp Test',
        description: 'Testing timestamp precision',
        workflow: 'feature',
      });

      const afterCreate = Date.now();

      expect(template.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate);
      expect(template.createdAt.getTime()).toBeLessThanOrEqual(afterCreate);
      expect(template.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeCreate);
      expect(template.updatedAt.getTime()).toBeLessThanOrEqual(afterCreate);
    });
  });
});