import { describe, it, expect } from 'vitest';
import { TaskTemplateSchema, TaskTemplate } from '../types.js';
import { generateTaskTemplateId } from '../utils.js';

describe('TaskTemplateSchema', () => {
  const createValidTemplate = (): TaskTemplate => ({
    id: generateTaskTemplateId(),
    name: 'Valid Template',
    description: 'A valid task template description',
    workflow: 'feature',
    priority: 'normal',
    effort: 'medium',
    acceptanceCriteria: 'Template should validate correctly',
    tags: ['template', 'test'],
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  describe('Valid schemas', () => {
    it('should validate a complete template', () => {
      const template = createValidTemplate();
      const result = TaskTemplateSchema.safeParse(template);
      expect(result.success).toBe(true);
    });

    it('should validate template with minimal required fields', () => {
      const template = {
        id: generateTaskTemplateId(),
        name: 'Minimal Template',
        description: 'Minimal description',
        workflow: 'bugfix',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const result = TaskTemplateSchema.safeParse(template);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.priority).toBe('normal'); // default value
        expect(result.data.effort).toBe('medium'); // default value
        expect(result.data.tags).toEqual([]); // default value
      }
    });

    it('should accept undefined acceptanceCriteria', () => {
      const template = {
        ...createValidTemplate(),
        acceptanceCriteria: undefined,
      };
      const result = TaskTemplateSchema.safeParse(template);
      expect(result.success).toBe(true);
    });

    it('should accept empty tags array', () => {
      const template = {
        ...createValidTemplate(),
        tags: [],
      };
      const result = TaskTemplateSchema.safeParse(template);
      expect(result.success).toBe(true);
    });

    it('should accept all valid priority values', () => {
      const priorities = ['low', 'normal', 'high', 'urgent'];

      for (const priority of priorities) {
        const template = {
          ...createValidTemplate(),
          priority,
        };
        const result = TaskTemplateSchema.safeParse(template);
        expect(result.success).toBe(true);
      }
    });

    it('should accept all valid effort values', () => {
      const efforts = ['xs', 'small', 'medium', 'large', 'xl'];

      for (const effort of efforts) {
        const template = {
          ...createValidTemplate(),
          effort,
        };
        const result = TaskTemplateSchema.safeParse(template);
        expect(result.success).toBe(true);
      }
    });

    it('should accept maximum length name', () => {
      const template = {
        ...createValidTemplate(),
        name: 'A'.repeat(100), // exactly 100 characters
      };
      const result = TaskTemplateSchema.safeParse(template);
      expect(result.success).toBe(true);
    });
  });

  describe('Invalid schemas', () => {
    describe('Required field validation', () => {
      it('should reject template without id', () => {
        const template = {
          ...createValidTemplate(),
          id: undefined,
        };
        const result = TaskTemplateSchema.safeParse(template);
        expect(result.success).toBe(false);
      });

      it('should reject template without name', () => {
        const template = {
          ...createValidTemplate(),
          name: undefined,
        };
        const result = TaskTemplateSchema.safeParse(template);
        expect(result.success).toBe(false);
      });

      it('should reject template without description', () => {
        const template = {
          ...createValidTemplate(),
          description: undefined,
        };
        const result = TaskTemplateSchema.safeParse(template);
        expect(result.success).toBe(false);
      });

      it('should reject template without workflow', () => {
        const template = {
          ...createValidTemplate(),
          workflow: undefined,
        };
        const result = TaskTemplateSchema.safeParse(template);
        expect(result.success).toBe(false);
      });

      it('should reject template without createdAt', () => {
        const template = {
          ...createValidTemplate(),
          createdAt: undefined,
        };
        const result = TaskTemplateSchema.safeParse(template);
        expect(result.success).toBe(false);
      });

      it('should reject template without updatedAt', () => {
        const template = {
          ...createValidTemplate(),
          updatedAt: undefined,
        };
        const result = TaskTemplateSchema.safeParse(template);
        expect(result.success).toBe(false);
      });
    });

    describe('Name validation', () => {
      it('should reject empty name', () => {
        const template = {
          ...createValidTemplate(),
          name: '',
        };
        const result = TaskTemplateSchema.safeParse(template);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors[0].message).toBe('Template name is required');
        }
      });

      it('should reject name longer than 100 characters', () => {
        const template = {
          ...createValidTemplate(),
          name: 'A'.repeat(101), // 101 characters
        };
        const result = TaskTemplateSchema.safeParse(template);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors[0].message).toBe('Template name must be 100 characters or less');
        }
      });

      it('should reject whitespace-only name', () => {
        const template = {
          ...createValidTemplate(),
          name: '   ',
        };
        const result = TaskTemplateSchema.safeParse(template);
        expect(result.success).toBe(false);
      });
    });

    describe('Description validation', () => {
      it('should reject empty description', () => {
        const template = {
          ...createValidTemplate(),
          description: '',
        };
        const result = TaskTemplateSchema.safeParse(template);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors[0].message).toBe('Template description is required');
        }
      });

      it('should reject whitespace-only description', () => {
        const template = {
          ...createValidTemplate(),
          description: '   ',
        };
        const result = TaskTemplateSchema.safeParse(template);
        expect(result.success).toBe(false);
      });
    });

    describe('Workflow validation', () => {
      it('should reject empty workflow', () => {
        const template = {
          ...createValidTemplate(),
          workflow: '',
        };
        const result = TaskTemplateSchema.safeParse(template);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors[0].message).toBe('Workflow is required');
        }
      });

      it('should reject whitespace-only workflow', () => {
        const template = {
          ...createValidTemplate(),
          workflow: '   ',
        };
        const result = TaskTemplateSchema.safeParse(template);
        expect(result.success).toBe(false);
      });
    });

    describe('Priority validation', () => {
      it('should reject invalid priority value', () => {
        const template = {
          ...createValidTemplate(),
          priority: 'invalid-priority',
        };
        const result = TaskTemplateSchema.safeParse(template);
        expect(result.success).toBe(false);
      });
    });

    describe('Effort validation', () => {
      it('should reject invalid effort value', () => {
        const template = {
          ...createValidTemplate(),
          effort: 'invalid-effort',
        };
        const result = TaskTemplateSchema.safeParse(template);
        expect(result.success).toBe(false);
      });
    });

    describe('Date validation', () => {
      it('should reject invalid createdAt date', () => {
        const template = {
          ...createValidTemplate(),
          createdAt: 'not-a-date',
        };
        const result = TaskTemplateSchema.safeParse(template);
        expect(result.success).toBe(false);
      });

      it('should reject invalid updatedAt date', () => {
        const template = {
          ...createValidTemplate(),
          updatedAt: 'not-a-date',
        };
        const result = TaskTemplateSchema.safeParse(template);
        expect(result.success).toBe(false);
      });
    });

    describe('Tags validation', () => {
      it('should reject non-array tags', () => {
        const template = {
          ...createValidTemplate(),
          tags: 'not-an-array',
        };
        const result = TaskTemplateSchema.safeParse(template);
        expect(result.success).toBe(false);
      });

      it('should reject tags array with non-string values', () => {
        const template = {
          ...createValidTemplate(),
          tags: ['valid-tag', 123, 'another-valid-tag'],
        };
        const result = TaskTemplateSchema.safeParse(template);
        expect(result.success).toBe(false);
      });
    });

    describe('Type validation', () => {
      it('should reject non-string id', () => {
        const template = {
          ...createValidTemplate(),
          id: 123,
        };
        const result = TaskTemplateSchema.safeParse(template);
        expect(result.success).toBe(false);
      });

      it('should reject non-string acceptanceCriteria', () => {
        const template = {
          ...createValidTemplate(),
          acceptanceCriteria: 123,
        };
        const result = TaskTemplateSchema.safeParse(template);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle template with null acceptanceCriteria', () => {
      const template = {
        ...createValidTemplate(),
        acceptanceCriteria: null,
      };
      // This should be converted to undefined by Zod
      const result = TaskTemplateSchema.safeParse(template);
      expect(result.success).toBe(true);
    });

    it('should handle template with very long description', () => {
      const template = {
        ...createValidTemplate(),
        description: 'A'.repeat(10000), // Very long description
      };
      const result = TaskTemplateSchema.safeParse(template);
      expect(result.success).toBe(true);
    });

    it('should handle template with many tags', () => {
      const template = {
        ...createValidTemplate(),
        tags: Array.from({ length: 100 }, (_, i) => `tag-${i}`),
      };
      const result = TaskTemplateSchema.safeParse(template);
      expect(result.success).toBe(true);
    });

    it('should handle template with empty string in tags array', () => {
      const template = {
        ...createValidTemplate(),
        tags: ['valid-tag', '', 'another-valid-tag'],
      };
      const result = TaskTemplateSchema.safeParse(template);
      expect(result.success).toBe(true);
    });

    it('should handle template with whitespace tags', () => {
      const template = {
        ...createValidTemplate(),
        tags: ['  tag-with-spaces  ', 'normal-tag'],
      };
      const result = TaskTemplateSchema.safeParse(template);
      expect(result.success).toBe(true);
    });

    it('should handle template with special characters in workflow', () => {
      const template = {
        ...createValidTemplate(),
        workflow: 'feature-2024_v1.0-beta',
      };
      const result = TaskTemplateSchema.safeParse(template);
      expect(result.success).toBe(true);
    });
  });

  describe('Default values', () => {
    it('should apply default priority when not provided', () => {
      const template = {
        id: generateTaskTemplateId(),
        name: 'Test Template',
        description: 'Test description',
        workflow: 'test',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const result = TaskTemplateSchema.parse(template);
      expect(result.priority).toBe('normal');
    });

    it('should apply default effort when not provided', () => {
      const template = {
        id: generateTaskTemplateId(),
        name: 'Test Template',
        description: 'Test description',
        workflow: 'test',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const result = TaskTemplateSchema.parse(template);
      expect(result.effort).toBe('medium');
    });

    it('should apply default tags when not provided', () => {
      const template = {
        id: generateTaskTemplateId(),
        name: 'Test Template',
        description: 'Test description',
        workflow: 'test',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const result = TaskTemplateSchema.parse(template);
      expect(result.tags).toEqual([]);
    });

    it('should not override provided values with defaults', () => {
      const template = {
        id: generateTaskTemplateId(),
        name: 'Test Template',
        description: 'Test description',
        workflow: 'test',
        priority: 'high' as const,
        effort: 'xl' as const,
        tags: ['custom-tag'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const result = TaskTemplateSchema.parse(template);
      expect(result.priority).toBe('high');
      expect(result.effort).toBe('large');
      expect(result.tags).toEqual(['custom-tag']);
    });
  });
});