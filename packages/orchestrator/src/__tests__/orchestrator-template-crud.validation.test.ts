import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from '../index';
import type { TaskTemplate } from '@apexcli/core';

describe('ApexOrchestrator - Template CRUD Validation', () => {
  let orchestrator: ApexOrchestrator;
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-template-validation-test-'));
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

  describe('createTemplate validation', () => {
    it('should validate required fields presence', async () => {
      // Missing name
      await expect(
        orchestrator.createTemplate({
          description: 'Missing name',
          workflow: 'feature',
        } as any)
      ).rejects.toThrow();

      // Missing description
      await expect(
        orchestrator.createTemplate({
          name: 'Missing description',
          workflow: 'feature',
        } as any)
      ).rejects.toThrow();

      // Missing workflow
      await expect(
        orchestrator.createTemplate({
          name: 'Missing workflow',
          description: 'Missing workflow',
        } as any)
      ).rejects.toThrow();
    });

    it('should validate enum field values', async () => {
      // Invalid priority
      await expect(
        orchestrator.createTemplate({
          name: 'Invalid Priority',
          description: 'Testing invalid priority',
          workflow: 'feature',
          priority: 'invalid' as any,
        })
      ).rejects.toThrow();

      // Invalid effort
      await expect(
        orchestrator.createTemplate({
          name: 'Invalid Effort',
          description: 'Testing invalid effort',
          workflow: 'feature',
          effort: 'invalid' as any,
        })
      ).rejects.toThrow();
    });

    it('should validate field types', async () => {
      // Non-string name
      await expect(
        orchestrator.createTemplate({
          name: 123 as any,
          description: 'Non-string name',
          workflow: 'feature',
        })
      ).rejects.toThrow();

      // Non-array tags
      await expect(
        orchestrator.createTemplate({
          name: 'Non-array tags',
          description: 'Testing non-array tags',
          workflow: 'feature',
          tags: 'not-an-array' as any,
        })
      ).rejects.toThrow();

      // Non-string array elements in tags
      await expect(
        orchestrator.createTemplate({
          name: 'Invalid tag elements',
          description: 'Testing invalid tag elements',
          workflow: 'feature',
          tags: ['valid', 123, 'another-valid'] as any,
        })
      ).rejects.toThrow();
    });

    it('should handle null and undefined values appropriately', async () => {
      // Null values for required fields should fail
      await expect(
        orchestrator.createTemplate({
          name: null as any,
          description: 'Null name',
          workflow: 'feature',
        })
      ).rejects.toThrow();

      // Null values for optional fields should be handled
      const template = await orchestrator.createTemplate({
        name: 'Null optionals',
        description: 'Testing null optionals',
        workflow: 'feature',
        acceptanceCriteria: null as any,
        tags: null as any,
      });

      expect(template.acceptanceCriteria).toBeUndefined();
      expect(template.tags).toEqual([]);
    });

    it('should enforce business rules', async () => {
      // Test valid combinations
      const validTemplate = await orchestrator.createTemplate({
        name: 'Valid Template',
        description: 'Valid template description',
        workflow: 'feature',
        priority: 'urgent',
        effort: 'large',
        acceptanceCriteria: 'Must meet all requirements',
        tags: ['feature', 'urgent', 'backend'],
      });

      expect(validTemplate).toBeDefined();
      expect(validTemplate.priority).toBe('urgent');
      expect(validTemplate.effort).toBe('large');
    });
  });

  describe('updateTemplate validation', () => {
    let templateId: string;

    beforeEach(async () => {
      const template = await orchestrator.createTemplate({
        name: 'Validation Test Template',
        description: 'Template for validation testing',
        workflow: 'feature',
        priority: 'normal',
        effort: 'medium',
      });
      templateId = template.id;
    });

    it('should validate enum values in updates', async () => {
      // Invalid priority update
      await expect(
        orchestrator.updateTemplate(templateId, {
          priority: 'invalid' as any,
        })
      ).rejects.toThrow();

      // Invalid effort update
      await expect(
        orchestrator.updateTemplate(templateId, {
          effort: 'invalid' as any,
        })
      ).rejects.toThrow();
    });

    it('should validate field types in updates', async () => {
      // Non-string name
      await expect(
        orchestrator.updateTemplate(templateId, {
          name: 123 as any,
        })
      ).rejects.toThrow();

      // Non-string description
      await expect(
        orchestrator.updateTemplate(templateId, {
          description: false as any,
        })
      ).rejects.toThrow();

      // Non-array tags
      await expect(
        orchestrator.updateTemplate(templateId, {
          tags: 'not-an-array' as any,
        })
      ).rejects.toThrow();
    });

    it('should not allow updating protected fields', async () => {
      const originalTemplate = await orchestrator.getTemplate(templateId);

      // Attempt to update protected fields (should be ignored or error)
      const updatedTemplate = await orchestrator.updateTemplate(templateId, {
        id: 'new-id',
        createdAt: new Date('2020-01-01'),
        updatedAt: new Date('2020-01-01'),
      } as any);

      // Protected fields should remain unchanged
      expect(updatedTemplate.id).toBe(originalTemplate!.id);
      expect(updatedTemplate.createdAt.getTime()).toBe(originalTemplate!.createdAt.getTime());
      expect(updatedTemplate.updatedAt.getTime()).toBeGreaterThan(originalTemplate!.updatedAt.getTime());
    });

    it('should validate workflow changes', async () => {
      // Workflow updates should be allowed
      const updatedTemplate = await orchestrator.updateTemplate(templateId, {
        workflow: 'bugfix',
      });

      expect(updatedTemplate.workflow).toBe('bugfix');

      // Invalid workflow should fail
      await expect(
        orchestrator.updateTemplate(templateId, {
          workflow: 'invalid-workflow',
        })
      ).rejects.toThrow();
    });

    it('should handle edge cases in partial updates', async () => {
      // Empty string updates
      const emptyUpdates = await orchestrator.updateTemplate(templateId, {
        name: '',
        description: '',
        acceptanceCriteria: '',
      });

      expect(emptyUpdates.name).toBe('');
      expect(emptyUpdates.description).toBe('');
      expect(emptyUpdates.acceptanceCriteria).toBe('');

      // Undefined updates (should be converted appropriately)
      const undefinedUpdates = await orchestrator.updateTemplate(templateId, {
        acceptanceCriteria: undefined,
        tags: undefined,
      } as any);

      expect(undefinedUpdates.acceptanceCriteria).toBeUndefined();
      expect(undefinedUpdates.tags).toEqual([]);
    });
  });

  describe('template data integrity', () => {
    it('should maintain referential integrity with tasks', async () => {
      // Create template
      const template = await orchestrator.createTemplate({
        name: 'Integrity Template',
        description: 'Testing referential integrity',
        workflow: 'feature',
      });

      // Create task from template
      const task = await orchestrator.useTemplate(template.id);

      // Update template
      await orchestrator.updateTemplate(template.id, {
        name: 'Updated Integrity Template',
        priority: 'high',
      });

      // Task should remain unchanged
      const retrievedTask = await orchestrator.getTask(task.id);
      expect(retrievedTask).toBeDefined();
      expect(retrievedTask!.name).toBe('Integrity Template'); // Original name
      expect(retrievedTask!.priority).toBe('normal'); // Original priority

      // Template should be updated
      const retrievedTemplate = await orchestrator.getTemplate(template.id);
      expect(retrievedTemplate!.name).toBe('Updated Integrity Template');
      expect(retrievedTemplate!.priority).toBe('high');
    });

    it('should handle cascade operations properly', async () => {
      // Create template
      const template = await orchestrator.createTemplate({
        name: 'Cascade Template',
        description: 'Testing cascade operations',
        workflow: 'feature',
      });

      // Create multiple tasks from template
      const task1 = await orchestrator.useTemplate(template.id, {
        description: 'First task from template',
      });
      const task2 = await orchestrator.useTemplate(template.id, {
        description: 'Second task from template',
      });

      // Delete template
      await orchestrator.deleteTemplate(template.id);

      // Template should be deleted
      const deletedTemplate = await orchestrator.getTemplate(template.id);
      expect(deletedTemplate).toBeNull();

      // Tasks should still exist
      const remainingTask1 = await orchestrator.getTask(task1.id);
      const remainingTask2 = await orchestrator.getTask(task2.id);
      expect(remainingTask1).toBeDefined();
      expect(remainingTask2).toBeDefined();
    });

    it('should validate cross-field dependencies', async () => {
      // High priority with small effort should be allowed
      const template1 = await orchestrator.createTemplate({
        name: 'High Priority Small Effort',
        description: 'Testing cross-field validation',
        workflow: 'feature',
        priority: 'urgent',
        effort: 'small',
      });

      expect(template1.priority).toBe('urgent');
      expect(template1.effort).toBe('small');

      // Low priority with large effort should be allowed
      const template2 = await orchestrator.createTemplate({
        name: 'Low Priority Large Effort',
        description: 'Testing cross-field validation',
        workflow: 'feature',
        priority: 'low',
        effort: 'large',
      });

      expect(template2.priority).toBe('low');
      expect(template2.effort).toBe('large');
    });
  });

  describe('concurrent validation', () => {
    it('should handle concurrent validations correctly', async () => {
      const templatePromises = Array.from({ length: 5 }, (_, i) =>
        orchestrator.createTemplate({
          name: `Concurrent Template ${i}`,
          description: `Concurrent validation test ${i}`,
          workflow: i % 2 === 0 ? 'feature' : 'bugfix',
          priority: i % 3 === 0 ? 'urgent' : 'normal',
          effort: i % 2 === 0 ? 'medium' : 'large',
          tags: [`tag-${i}`, 'concurrent'],
        })
      );

      const templates = await Promise.all(templatePromises);

      expect(templates).toHaveLength(5);
      templates.forEach((template, i) => {
        expect(template.name).toBe(`Concurrent Template ${i}`);
        expect(template.workflow).toBe(i % 2 === 0 ? 'feature' : 'bugfix');
        expect(template.priority).toBe(i % 3 === 0 ? 'urgent' : 'normal');
        expect(template.tags).toContain(`tag-${i}`);
        expect(template.tags).toContain('concurrent');
      });
    });

    it('should prevent race conditions in template updates', async () => {
      const template = await orchestrator.createTemplate({
        name: 'Race Condition Test',
        description: 'Testing race conditions',
        workflow: 'feature',
      });

      // Create multiple concurrent update operations
      const updatePromises = Array.from({ length: 10 }, (_, i) =>
        orchestrator.updateTemplate(template.id, {
          description: `Updated by operation ${i}`,
          tags: [`update-${i}`],
        })
      );

      // All updates should complete successfully
      const results = await Promise.all(updatePromises);

      // All results should be valid templates
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.id).toBe(template.id);
        expect(result.description).toMatch(/^Updated by operation \d+$/);
        expect(result.tags).toHaveLength(1);
        expect(result.tags[0]).toMatch(/^update-\d+$/);
      });

      // Final state should be consistent
      const finalTemplate = await orchestrator.getTemplate(template.id);
      expect(finalTemplate).toBeDefined();
      expect(finalTemplate!.description).toMatch(/^Updated by operation \d+$/);
    });
  });
});