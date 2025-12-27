import { describe, it, expect } from 'vitest';
import { TaskTemplate, TaskTemplateSchema, generateTaskTemplateId } from '@apexcli/core';

describe('TaskTemplate Schema Validation Tests', () => {
  describe('Valid TaskTemplate Objects', () => {
    it('should validate a complete template with all fields', () => {
      const template: TaskTemplate = {
        id: generateTaskTemplateId(),
        name: 'Complete Test Template',
        description: 'A template with all possible fields',
        workflow: 'feature',
        priority: 'high',
        effort: 'large',
        acceptanceCriteria: 'All fields should be validated correctly',
        tags: ['test', 'schema', 'validation'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = TaskTemplateSchema.safeParse(template);
      expect(result.success).toBe(true);
    });

    it('should validate minimal template with required fields only', () => {
      const template = {
        id: generateTaskTemplateId(),
        name: 'Minimal Template',
        description: 'A minimal template',
        workflow: 'bugfix',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = TaskTemplateSchema.safeParse(template);
      expect(result.success).toBe(true);

      if (result.success) {
        // Should apply defaults
        expect(result.data.priority).toBe('normal');
        expect(result.data.effort).toBe('medium');
        expect(result.data.tags).toEqual([]);
      }
    });

    it('should validate template with empty tags array', () => {
      const template = {
        id: generateTaskTemplateId(),
        name: 'Template with Empty Tags',
        description: 'Template with explicitly empty tags',
        workflow: 'test',
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = TaskTemplateSchema.safeParse(template);
      expect(result.success).toBe(true);
    });

    it('should validate template with undefined acceptanceCriteria', () => {
      const template = {
        id: generateTaskTemplateId(),
        name: 'Template Without Criteria',
        description: 'Template without acceptance criteria',
        workflow: 'docs',
        acceptanceCriteria: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = TaskTemplateSchema.safeParse(template);
      expect(result.success).toBe(true);
    });
  });

  describe('Invalid TaskTemplate Objects', () => {
    it('should reject template with missing required fields', () => {
      const invalidTemplates = [
        // Missing id
        {
          name: 'Template',
          description: 'Description',
          workflow: 'test',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        // Missing name
        {
          id: generateTaskTemplateId(),
          description: 'Description',
          workflow: 'test',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        // Missing description
        {
          id: generateTaskTemplateId(),
          name: 'Template',
          workflow: 'test',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        // Missing workflow
        {
          id: generateTaskTemplateId(),
          name: 'Template',
          description: 'Description',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        // Missing createdAt
        {
          id: generateTaskTemplateId(),
          name: 'Template',
          description: 'Description',
          workflow: 'test',
          updatedAt: new Date(),
        },
        // Missing updatedAt
        {
          id: generateTaskTemplateId(),
          name: 'Template',
          description: 'Description',
          workflow: 'test',
          createdAt: new Date(),
        },
      ];

      for (const template of invalidTemplates) {
        const result = TaskTemplateSchema.safeParse(template);
        expect(result.success).toBe(false);
      }
    });

    it('should reject template with empty required string fields', () => {
      const invalidTemplates = [
        // Empty name
        {
          id: generateTaskTemplateId(),
          name: '',
          description: 'Description',
          workflow: 'test',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        // Empty description
        {
          id: generateTaskTemplateId(),
          name: 'Template',
          description: '',
          workflow: 'test',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        // Empty workflow
        {
          id: generateTaskTemplateId(),
          name: 'Template',
          description: 'Description',
          workflow: '',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      for (const template of invalidTemplates) {
        const result = TaskTemplateSchema.safeParse(template);
        expect(result.success).toBe(false);
      }
    });

    it('should reject template with name longer than 100 characters', () => {
      const template = {
        id: generateTaskTemplateId(),
        name: 'A'.repeat(101), // 101 characters
        description: 'Description',
        workflow: 'test',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = TaskTemplateSchema.safeParse(template);
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.issues.some(issue =>
          issue.path.includes('name') &&
          issue.message.includes('100 characters')
        )).toBe(true);
      }
    });

    it('should reject template with invalid priority values', () => {
      const invalidPriorities = ['invalid', 'URGENT', 'Normal', 123, null];

      for (const priority of invalidPriorities) {
        const template = {
          id: generateTaskTemplateId(),
          name: 'Template',
          description: 'Description',
          workflow: 'test',
          priority,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const result = TaskTemplateSchema.safeParse(template);
        expect(result.success).toBe(false);
      }
    });

    it('should reject template with invalid effort values', () => {
      const invalidEfforts = ['invalid', 'LARGE', 'Medium', 123, null];

      for (const effort of invalidEfforts) {
        const template = {
          id: generateTaskTemplateId(),
          name: 'Template',
          description: 'Description',
          workflow: 'test',
          effort,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const result = TaskTemplateSchema.safeParse(template);
        expect(result.success).toBe(false);
      }
    });

    it('should reject template with invalid date fields', () => {
      const invalidDates = ['2023-01-01', '2023-01-01T00:00:00Z', 'invalid-date', 123, null];

      for (const date of invalidDates) {
        const template = {
          id: generateTaskTemplateId(),
          name: 'Template',
          description: 'Description',
          workflow: 'test',
          createdAt: date,
          updatedAt: new Date(),
        };

        const result = TaskTemplateSchema.safeParse(template);
        expect(result.success).toBe(false);
      }
    });

    it('should reject template with invalid tags field', () => {
      const invalidTags = [
        'string-instead-of-array',
        123,
        null,
        ['valid', 'tag', 123], // Array with non-string values
        ['valid', null, 'tag'], // Array with null value
      ];

      for (const tags of invalidTags) {
        const template = {
          id: generateTaskTemplateId(),
          name: 'Template',
          description: 'Description',
          workflow: 'test',
          tags,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const result = TaskTemplateSchema.safeParse(template);
        expect(result.success).toBe(false);
      }
    });

    it('should reject template with invalid acceptanceCriteria type', () => {
      const invalidCriteria = [123, [], {}, new Date()];

      for (const acceptanceCriteria of invalidCriteria) {
        const template = {
          id: generateTaskTemplateId(),
          name: 'Template',
          description: 'Description',
          workflow: 'test',
          acceptanceCriteria,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const result = TaskTemplateSchema.safeParse(template);
        expect(result.success).toBe(false);
      }
    });
  });

  describe('Edge Cases and Special Values', () => {
    it('should handle Unicode characters in string fields', () => {
      const template = {
        id: generateTaskTemplateId(),
        name: 'Template with émojis 🚀 and üñíçödë',
        description: 'Description with special chars: ñáéíóú àòùèì äöü',
        workflow: 'test',
        acceptanceCriteria: 'Criteria with symbols: © ® ™ € £ ¥',
        tags: ['émoji-🏷️', 'üñíçödë-tag'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = TaskTemplateSchema.safeParse(template);
      expect(result.success).toBe(true);
    });

    it('should handle maximum valid name length (100 characters)', () => {
      const template = {
        id: generateTaskTemplateId(),
        name: 'A'.repeat(100), // Exactly 100 characters
        description: 'Description',
        workflow: 'test',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = TaskTemplateSchema.safeParse(template);
      expect(result.success).toBe(true);
    });

    it('should validate all valid priority values', () => {
      const validPriorities = ['low', 'normal', 'high', 'urgent'];

      for (const priority of validPriorities) {
        const template = {
          id: generateTaskTemplateId(),
          name: `Template Priority ${priority}`,
          description: 'Description',
          workflow: 'test',
          priority,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const result = TaskTemplateSchema.safeParse(template);
        expect(result.success).toBe(true);
      }
    });

    it('should validate all valid effort values', () => {
      const validEfforts = ['xs', 'small', 'medium', 'large', 'xl'];

      for (const effort of validEfforts) {
        const template = {
          id: generateTaskTemplateId(),
          name: `Template Effort ${effort}`,
          description: 'Description',
          workflow: 'test',
          effort,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const result = TaskTemplateSchema.safeParse(template);
        expect(result.success).toBe(true);
      }
    });

    it('should handle large tags arrays', () => {
      const template = {
        id: generateTaskTemplateId(),
        name: 'Template with Many Tags',
        description: 'Template with a large number of tags',
        workflow: 'test',
        tags: Array.from({ length: 100 }, (_, i) => `tag-${i}`),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = TaskTemplateSchema.safeParse(template);
      expect(result.success).toBe(true);
    });

    it('should handle long description text', () => {
      const template = {
        id: generateTaskTemplateId(),
        name: 'Template with Long Description',
        description: 'A'.repeat(10000), // Very long description
        workflow: 'test',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = TaskTemplateSchema.safeParse(template);
      expect(result.success).toBe(true);
    });

    it('should handle long acceptance criteria text', () => {
      const template = {
        id: generateTaskTemplateId(),
        name: 'Template with Long Criteria',
        description: 'Template with very long acceptance criteria',
        workflow: 'test',
        acceptanceCriteria: 'B'.repeat(5000), // Very long criteria
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = TaskTemplateSchema.safeParse(template);
      expect(result.success).toBe(true);
    });
  });

  describe('Data Transformation and Defaults', () => {
    it('should apply default values for optional fields', () => {
      const template = {
        id: generateTaskTemplateId(),
        name: 'Template with Defaults',
        description: 'Template to test default values',
        workflow: 'test',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = TaskTemplateSchema.safeParse(template);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.priority).toBe('normal');
        expect(result.data.effort).toBe('medium');
        expect(result.data.tags).toEqual([]);
        expect(result.data.acceptanceCriteria).toBeUndefined();
      }
    });

    it('should preserve explicitly set values over defaults', () => {
      const template = {
        id: generateTaskTemplateId(),
        name: 'Template with Explicit Values',
        description: 'Template with explicitly set values',
        workflow: 'test',
        priority: 'high',
        effort: 'xl',
        tags: ['explicit', 'values'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = TaskTemplateSchema.safeParse(template);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.priority).toBe('high');
        expect(result.data.effort).toBe('xl');
        expect(result.data.tags).toEqual(['explicit', 'values']);
      }
    });

    it('should handle mixed valid and default values', () => {
      const template = {
        id: generateTaskTemplateId(),
        name: 'Mixed Template',
        description: 'Template with mixed explicit and default values',
        workflow: 'feature',
        priority: 'urgent', // Explicit
        // effort should default to 'medium'
        tags: ['mixed'], // Explicit
        acceptanceCriteria: 'Mixed values test', // Explicit
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = TaskTemplateSchema.safeParse(template);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.priority).toBe('urgent');
        expect(result.data.effort).toBe('medium'); // Default
        expect(result.data.tags).toEqual(['mixed']);
        expect(result.data.acceptanceCriteria).toBe('Mixed values test');
      }
    });
  });
});