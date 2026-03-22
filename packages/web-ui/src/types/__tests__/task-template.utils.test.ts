/**
 * Unit tests for task template utility functions
 */

import { describe, it, expect } from 'vitest'
import {
  templateHasRequiredVariables,
  interpolateTemplateString,
  isTemplateCategory,
  isTemplateVariableType,
  isTemplateVariable,
  isTaskTemplate,
  type TaskTemplate,
  type TemplateVariable,
  type TemplateVariableValues,
} from '../task-template'

describe('Task Template Utility Functions', () => {
  describe('templateHasRequiredVariables', () => {
    it('returns true when template has required variables', () => {
      const template: Partial<TaskTemplate> = {
        variables: [
          {
            name: 'component',
            label: 'Component',
            type: 'string',
            required: true,
          },
          {
            name: 'optional',
            label: 'Optional',
            type: 'string',
            required: false,
          },
        ],
      }

      expect(templateHasRequiredVariables(template as TaskTemplate)).toBe(true)
    })

    it('returns false when template has no required variables', () => {
      const template: Partial<TaskTemplate> = {
        variables: [
          {
            name: 'optional1',
            label: 'Optional 1',
            type: 'string',
            required: false,
          },
          {
            name: 'optional2',
            label: 'Optional 2',
            type: 'string',
            required: false,
          },
        ],
      }

      expect(templateHasRequiredVariables(template as TaskTemplate)).toBe(false)
    })

    it('returns false when template has no variables', () => {
      const template: Partial<TaskTemplate> = {
        variables: [],
      }

      expect(templateHasRequiredVariables(template as TaskTemplate)).toBe(false)
    })

    it('returns false when template has undefined variables', () => {
      const template: Partial<TaskTemplate> = {
        variables: undefined,
      }

      expect(templateHasRequiredVariables(template as TaskTemplate)).toBe(false)
    })
  })

  describe('interpolateTemplateString', () => {
    it('replaces single variable correctly', () => {
      const template = 'Create {{componentName}} component'
      const values: TemplateVariableValues = {
        componentName: 'UserProfile',
      }

      const result = interpolateTemplateString(template, values)
      expect(result).toBe('Create UserProfile component')
    })

    it('replaces multiple variables correctly', () => {
      const template = 'Create {{type}} component named {{name}} in {{directory}}'
      const values: TemplateVariableValues = {
        type: 'React',
        name: 'UserProfile',
        directory: 'src/components',
      }

      const result = interpolateTemplateString(template, values)
      expect(result).toBe('Create React component named UserProfile in src/components')
    })

    it('leaves unreplaced variables as-is when value is undefined', () => {
      const template = 'Create {{componentName}} with {{features}}'
      const values: TemplateVariableValues = {
        componentName: 'UserProfile',
        // features is missing
      }

      const result = interpolateTemplateString(template, values)
      expect(result).toBe('Create UserProfile with {{features}}')
    })

    it('handles array values by joining with commas', () => {
      const template = 'Add features: {{features}}'
      const values: TemplateVariableValues = {
        features: ['authentication', 'profile editing', 'settings'],
      }

      const result = interpolateTemplateString(template, values)
      expect(result).toBe('Add features: authentication, profile editing, settings')
    })

    it('handles number and boolean values', () => {
      const template = 'Priority: {{priority}}, Auto-save: {{autoSave}}'
      const values: TemplateVariableValues = {
        priority: 5,
        autoSave: true,
      }

      const result = interpolateTemplateString(template, values)
      expect(result).toBe('Priority: 5, Auto-save: true')
    })

    it('handles empty string and zero values', () => {
      const template = 'Name: "{{name}}", Count: {{count}}'
      const values: TemplateVariableValues = {
        name: '',
        count: 0,
      }

      const result = interpolateTemplateString(template, values)
      expect(result).toBe('Name: "", Count: 0')
    })

    it('handles template with no variables', () => {
      const template = 'Simple template with no variables'
      const values: TemplateVariableValues = {}

      const result = interpolateTemplateString(template, values)
      expect(result).toBe('Simple template with no variables')
    })

    it('handles same variable used multiple times', () => {
      const template = '{{name}} component: Create {{name}} in the {{name}} directory'
      const values: TemplateVariableValues = {
        name: 'UserProfile',
      }

      const result = interpolateTemplateString(template, values)
      expect(result).toBe('UserProfile component: Create UserProfile in the UserProfile directory')
    })

    it('handles edge cases with special characters', () => {
      const template = 'File: {{filename}}.{{extension}}'
      const values: TemplateVariableValues = {
        filename: 'user-profile.component',
        extension: 'tsx',
      }

      const result = interpolateTemplateString(template, values)
      expect(result).toBe('File: user-profile.component.tsx')
    })
  })

  describe('Type Guards', () => {
    describe('isTemplateCategory', () => {
      it('returns true for valid categories', () => {
        expect(isTemplateCategory('feature')).toBe(true)
        expect(isTemplateCategory('bugfix')).toBe(true)
        expect(isTemplateCategory('refactoring')).toBe(true)
        expect(isTemplateCategory('testing')).toBe(true)
        expect(isTemplateCategory('documentation')).toBe(true)
        expect(isTemplateCategory('maintenance')).toBe(true)
        expect(isTemplateCategory('deployment')).toBe(true)
        expect(isTemplateCategory('custom')).toBe(true)
      })

      it('returns false for invalid categories', () => {
        expect(isTemplateCategory('invalid')).toBe(false)
        expect(isTemplateCategory('')).toBe(false)
        expect(isTemplateCategory(null)).toBe(false)
        expect(isTemplateCategory(undefined)).toBe(false)
        expect(isTemplateCategory(123)).toBe(false)
      })
    })

    describe('isTemplateVariableType', () => {
      it('returns true for valid variable types', () => {
        expect(isTemplateVariableType('string')).toBe(true)
        expect(isTemplateVariableType('text')).toBe(true)
        expect(isTemplateVariableType('number')).toBe(true)
        expect(isTemplateVariableType('boolean')).toBe(true)
        expect(isTemplateVariableType('select')).toBe(true)
        expect(isTemplateVariableType('multiselect')).toBe(true)
        expect(isTemplateVariableType('file')).toBe(true)
        expect(isTemplateVariableType('directory')).toBe(true)
      })

      it('returns false for invalid variable types', () => {
        expect(isTemplateVariableType('invalid')).toBe(false)
        expect(isTemplateVariableType('')).toBe(false)
        expect(isTemplateVariableType(null)).toBe(false)
        expect(isTemplateVariableType(undefined)).toBe(false)
      })
    })

    describe('isTemplateVariable', () => {
      it('returns true for valid template variable', () => {
        const variable: TemplateVariable = {
          name: 'componentName',
          label: 'Component Name',
          type: 'string',
          required: true,
        }

        expect(isTemplateVariable(variable)).toBe(true)
      })

      it('returns true for template variable with optional properties', () => {
        const variable: TemplateVariable = {
          name: 'componentName',
          label: 'Component Name',
          type: 'string',
          required: true,
          placeholder: 'Enter component name',
          description: 'Name of the React component',
          defaultValue: 'MyComponent',
          minLength: 1,
          maxLength: 50,
        }

        expect(isTemplateVariable(variable)).toBe(true)
      })

      it('returns false for invalid template variable', () => {
        // Missing required properties
        expect(isTemplateVariable({
          name: 'test',
          label: 'Test',
          // missing type and required
        })).toBe(false)

        expect(isTemplateVariable({
          name: 'test',
          // missing label, type, and required
        })).toBe(false)

        expect(isTemplateVariable(null)).toBe(false)
        expect(isTemplateVariable(undefined)).toBe(false)
        expect(isTemplateVariable('string')).toBe(false)
        expect(isTemplateVariable(123)).toBe(false)
      })

      it('returns false for variable with invalid type', () => {
        const variable = {
          name: 'componentName',
          label: 'Component Name',
          type: 'invalid-type',
          required: true,
        }

        expect(isTemplateVariable(variable)).toBe(false)
      })
    })

    describe('isTaskTemplate', () => {
      const validTemplate: TaskTemplate = {
        id: 'template-1',
        name: 'Test Template',
        description: 'A test template',
        category: 'feature',
        workflow: 'test-workflow',
        autonomy: 'review-before-commit',
        descriptionTemplate: 'Test {{component}}',
        tags: ['test'],
        isQuickAction: false,
        priority: 'normal',
        effort: 'medium',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      it('returns true for valid task template', () => {
        expect(isTaskTemplate(validTemplate)).toBe(true)
      })

      it('returns true for template with optional properties', () => {
        const templateWithOptional: TaskTemplate = {
          ...validTemplate,
          acceptanceCriteriaTemplate: 'Component works',
          variables: [
            {
              name: 'component',
              label: 'Component',
              type: 'string',
              required: true,
            },
          ],
          icon: 'component',
          color: 'blue',
          archived: false,
          usageCount: 5,
          createdBy: 'user-123',
          isSystem: false,
        }

        expect(isTaskTemplate(templateWithOptional)).toBe(true)
      })

      it('returns false for invalid task template', () => {
        // Missing required properties
        expect(isTaskTemplate({
          id: 'template-1',
          // missing other required properties
        })).toBe(false)

        expect(isTaskTemplate(null)).toBe(false)
        expect(isTaskTemplate(undefined)).toBe(false)
        expect(isTaskTemplate('string')).toBe(false)
        expect(isTaskTemplate(123)).toBe(false)
      })

      it('returns false for template with invalid category', () => {
        const invalidTemplate = {
          ...validTemplate,
          category: 'invalid-category',
        }

        expect(isTaskTemplate(invalidTemplate)).toBe(false)
      })

      it('returns false for template with invalid dates', () => {
        const invalidTemplate = {
          ...validTemplate,
          createdAt: 'not-a-date',
          updatedAt: 'not-a-date',
        }

        expect(isTaskTemplate(invalidTemplate)).toBe(false)
      })

      it('returns false for template with invalid tags', () => {
        const invalidTemplate = {
          ...validTemplate,
          tags: 'not-an-array',
        }

        expect(isTaskTemplate(invalidTemplate)).toBe(false)
      })
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('handles interpolation with malformed variable syntax', () => {
      const template = 'Create {componentName} and {{invalidVar} and {{validVar}}'
      const values: TemplateVariableValues = {
        validVar: 'Valid',
      }

      const result = interpolateTemplateString(template, values)
      // Should only replace properly formatted variables
      expect(result).toBe('Create {componentName} and {{invalidVar} and Valid')
    })

    it('handles empty template string', () => {
      const template = ''
      const values: TemplateVariableValues = {
        unused: 'value',
      }

      const result = interpolateTemplateString(template, values)
      expect(result).toBe('')
    })

    it('handles template with only variable placeholders', () => {
      const template = '{{var1}}{{var2}}'
      const values: TemplateVariableValues = {
        var1: 'Hello',
        var2: 'World',
      }

      const result = interpolateTemplateString(template, values)
      expect(result).toBe('HelloWorld')
    })

    it('handles null and undefined values in interpolation', () => {
      const template = 'Value: {{value}}'
      const values: TemplateVariableValues = {
        value: null as any,
      }

      // Should convert null to string
      const result = interpolateTemplateString(template, values)
      expect(result).toBe('Value: null')
    })
  })
})