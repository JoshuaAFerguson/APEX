/**
 * Comprehensive tests for Task Template types, interfaces, and utility functions
 * Tests type safety, validation, type guards, edge cases, and template interpolation
 */

import { describe, it, expect, beforeEach } from 'vitest'
import type {
  TaskTemplate,
  TemplateVariable,
  TemplateVariableType,
  TemplateCategory,
  TemplateVariableOption,
  TemplateVariableValues,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  CreateTaskFromTemplateRequest,
  TemplateListResponse,
  TemplateSearchResponse,
  TemplateFilters,
  TemplateSortOptions,
  TemplatePaginationOptions,
  TemplateListProps,
  TemplateFormProps,
  TemplateVariableInputProps,
  TemplatePreviewProps,
  UseTaskTemplatesReturn,
  UseTemplateFormReturn,
  UseTemplateVariablesReturn,
  InterpolationResult,
  TemplateValidationResult,
  TemplateValidationError
} from '../task-template'
import {
  isTemplateCategory,
  isTemplateVariableType,
  isTemplateVariable,
  isTaskTemplate,
  DEFAULT_TEMPLATE_VALUES,
  TEMPLATE_CATEGORY_CONFIG,
  VARIABLE_TYPE_CONFIG
} from '../task-template'

// ============================================================================
// Mock Data Factories
// ============================================================================

const createMockTemplateVariable = (
  overrides: Partial<TemplateVariable> = {}
): TemplateVariable => ({
  name: 'testVariable',
  label: 'Test Variable',
  type: 'string',
  required: true,
  defaultValue: 'default',
  placeholder: 'Enter value...',
  description: 'A test variable for validation',
  ...overrides,
})

const createMockTemplateVariableOption = (
  overrides: Partial<TemplateVariableOption> = {}
): TemplateVariableOption => ({
  label: 'Option 1',
  value: 'option1',
  description: 'First option',
  disabled: false,
  ...overrides,
})

const createMockTaskTemplate = (
  overrides: Partial<TaskTemplate> = {}
): TaskTemplate => ({
  id: 'template_test',
  name: 'Test Template',
  description: 'A test template for unit tests',
  category: 'feature',
  workflow: 'development',
  autonomy: 'review-before-commit',
  descriptionTemplate: 'Create {{componentName}} component',
  acceptanceCriteriaTemplate: 'Component {{componentName}} should:\n- Render correctly\n- Have proper types',
  variables: [
    createMockTemplateVariable({
      name: 'componentName',
      label: 'Component Name',
      type: 'string',
      required: true,
    }),
  ],
  tags: ['react', 'component'],
  isQuickAction: true,
  priority: 'normal',
  effort: 'medium',
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-02T00:00:00.000Z'),
  icon: 'plus',
  color: 'blue',
  archived: false,
  usageCount: 5,
  createdBy: 'user123',
  isSystem: false,
  ...overrides,
})

const createMockCreateTemplateRequest = (
  overrides: Partial<CreateTemplateRequest> = {}
): CreateTemplateRequest => ({
  name: 'New Template',
  description: 'A new template for testing',
  category: 'feature',
  workflow: 'development',
  autonomy: 'review-before-commit',
  descriptionTemplate: 'Create new feature: {{featureName}}',
  acceptanceCriteriaTemplate: 'Feature should be implemented correctly',
  variables: [],
  tags: ['test'],
  isQuickAction: false,
  priority: 'normal',
  effort: 'medium',
  icon: 'star',
  color: 'green',
  ...overrides,
})

// ============================================================================
// Type Guard Tests
// ============================================================================

describe('Type Guards', () => {
  describe('isTemplateCategory', () => {
    it('should return true for valid template categories', () => {
      const validCategories: TemplateCategory[] = [
        'feature', 'bugfix', 'refactoring', 'testing',
        'documentation', 'maintenance', 'deployment', 'custom'
      ]

      validCategories.forEach(category => {
        expect(isTemplateCategory(category)).toBe(true)
      })
    })

    it('should return false for invalid template categories', () => {
      const invalidCategories = [
        'invalid',
        'FEATURE',  // Case sensitive
        '',
        null,
        undefined,
        123,
        {},
        []
      ]

      invalidCategories.forEach(category => {
        expect(isTemplateCategory(category)).toBe(false)
      })
    })
  })

  describe('isTemplateVariableType', () => {
    it('should return true for valid variable types', () => {
      const validTypes: TemplateVariableType[] = [
        'string', 'text', 'number', 'boolean',
        'select', 'multiselect', 'file', 'directory'
      ]

      validTypes.forEach(type => {
        expect(isTemplateVariableType(type)).toBe(true)
      })
    })

    it('should return false for invalid variable types', () => {
      const invalidTypes = [
        'invalid',
        'STRING',  // Case sensitive
        '',
        null,
        undefined,
        123,
        {},
        []
      ]

      invalidTypes.forEach(type => {
        expect(isTemplateVariableType(type)).toBe(false)
      })
    })
  })

  describe('isTemplateVariable', () => {
    it('should return true for valid template variables', () => {
      const validVariable = createMockTemplateVariable()
      expect(isTemplateVariable(validVariable)).toBe(true)
    })

    it('should return true for minimal valid variable', () => {
      const minimal = {
        name: 'test',
        label: 'Test',
        type: 'string',
        required: false
      }
      expect(isTemplateVariable(minimal)).toBe(true)
    })

    it('should return false for invalid template variables', () => {
      const invalidVariables = [
        null,
        undefined,
        'string',
        123,
        [],
        {},
        { name: 'test' }, // Missing required fields
        { name: 'test', label: 'Test' }, // Missing type and required
        { name: 'test', label: 'Test', type: 'string' }, // Missing required
        { name: 'test', label: 'Test', type: 'invalid', required: true }, // Invalid type
        { name: 123, label: 'Test', type: 'string', required: true }, // Invalid name type
        { name: 'test', label: 123, type: 'string', required: true }, // Invalid label type
        { name: 'test', label: 'Test', type: 'string', required: 'true' }, // Invalid required type
      ]

      invalidVariables.forEach(variable => {
        expect(isTemplateVariable(variable)).toBe(false)
      })
    })
  })

  describe('isTaskTemplate', () => {
    it('should return true for valid task templates', () => {
      const validTemplate = createMockTaskTemplate()
      expect(isTaskTemplate(validTemplate)).toBe(true)
    })

    it('should return true for minimal valid template', () => {
      const minimal = {
        id: 'test',
        name: 'Test',
        description: 'Test template',
        category: 'feature',
        workflow: 'test',
        autonomy: 'review-before-commit',
        descriptionTemplate: 'Test template',
        tags: [],
        isQuickAction: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        priority: 'normal',
        effort: 'medium'
      }
      expect(isTaskTemplate(minimal)).toBe(true)
    })

    it('should return false for invalid task templates', () => {
      const invalidTemplates = [
        null,
        undefined,
        'string',
        123,
        [],
        {},
        { id: 'test' }, // Missing required fields
        createMockTaskTemplate({ id: 123 as any }), // Invalid id type
        createMockTaskTemplate({ name: 123 as any }), // Invalid name type
        createMockTaskTemplate({ category: 'invalid' as any }), // Invalid category
        createMockTaskTemplate({ tags: 'string' as any }), // Invalid tags type
        createMockTaskTemplate({ isQuickAction: 'true' as any }), // Invalid isQuickAction type
        createMockTaskTemplate({ createdAt: 'date' as any }), // Invalid createdAt type
        createMockTaskTemplate({ updatedAt: 'date' as any }), // Invalid updatedAt type
      ]

      invalidTemplates.forEach(template => {
        expect(isTaskTemplate(template)).toBe(false)
      })
    })
  })
})

// ============================================================================
// Interface Structure Tests
// ============================================================================

describe('Interface Structure', () => {
  describe('TemplateVariable', () => {
    it('should have all required properties', () => {
      const variable = createMockTemplateVariable()

      expect(variable).toHaveProperty('name')
      expect(variable).toHaveProperty('label')
      expect(variable).toHaveProperty('type')
      expect(variable).toHaveProperty('required')

      expect(typeof variable.name).toBe('string')
      expect(typeof variable.label).toBe('string')
      expect(typeof variable.required).toBe('boolean')
      expect(isTemplateVariableType(variable.type)).toBe(true)
    })

    it('should support all optional properties', () => {
      const variable = createMockTemplateVariable({
        defaultValue: 'default',
        placeholder: 'placeholder',
        description: 'description',
        options: [createMockTemplateVariableOption()],
        validationPattern: '^[a-zA-Z]+$',
        validationMessage: 'Only letters allowed',
        min: 1,
        max: 100,
        minLength: 2,
        maxLength: 50
      })

      expect(variable.defaultValue).toBe('default')
      expect(variable.placeholder).toBe('placeholder')
      expect(variable.description).toBe('description')
      expect(Array.isArray(variable.options)).toBe(true)
      expect(variable.validationPattern).toBe('^[a-zA-Z]+$')
      expect(variable.validationMessage).toBe('Only letters allowed')
      expect(variable.min).toBe(1)
      expect(variable.max).toBe(100)
      expect(variable.minLength).toBe(2)
      expect(variable.maxLength).toBe(50)
    })

    it('should support different default value types', () => {
      const stringVar = createMockTemplateVariable({
        type: 'string',
        defaultValue: 'text'
      })
      const numberVar = createMockTemplateVariable({
        type: 'number',
        defaultValue: 42
      })
      const booleanVar = createMockTemplateVariable({
        type: 'boolean',
        defaultValue: true
      })
      const multiselectVar = createMockTemplateVariable({
        type: 'multiselect',
        defaultValue: ['option1', 'option2']
      })

      expect(typeof stringVar.defaultValue).toBe('string')
      expect(typeof numberVar.defaultValue).toBe('number')
      expect(typeof booleanVar.defaultValue).toBe('boolean')
      expect(Array.isArray(multiselectVar.defaultValue)).toBe(true)
    })
  })

  describe('TaskTemplate', () => {
    it('should have all required properties', () => {
      const template = createMockTaskTemplate()

      const requiredProps = [
        'id', 'name', 'description', 'category', 'workflow',
        'autonomy', 'descriptionTemplate', 'tags', 'isQuickAction',
        'priority', 'effort', 'createdAt', 'updatedAt'
      ]

      requiredProps.forEach(prop => {
        expect(template).toHaveProperty(prop)
      })

      expect(typeof template.id).toBe('string')
      expect(typeof template.name).toBe('string')
      expect(typeof template.description).toBe('string')
      expect(isTemplateCategory(template.category)).toBe(true)
      expect(typeof template.workflow).toBe('string')
      expect(typeof template.autonomy).toBe('string')
      expect(typeof template.descriptionTemplate).toBe('string')
      expect(Array.isArray(template.tags)).toBe(true)
      expect(typeof template.isQuickAction).toBe('boolean')
      expect(template.createdAt).toBeInstanceOf(Date)
      expect(template.updatedAt).toBeInstanceOf(Date)
    })

    it('should support all optional properties', () => {
      const template = createMockTaskTemplate({
        acceptanceCriteriaTemplate: 'Acceptance criteria',
        variables: [createMockTemplateVariable()],
        icon: 'star',
        color: 'blue',
        archived: true,
        usageCount: 10,
        createdBy: 'user123',
        isSystem: true
      })

      expect(template.acceptanceCriteriaTemplate).toBe('Acceptance criteria')
      expect(Array.isArray(template.variables)).toBe(true)
      expect(template.icon).toBe('star')
      expect(template.color).toBe('blue')
      expect(template.archived).toBe(true)
      expect(template.usageCount).toBe(10)
      expect(template.createdBy).toBe('user123')
      expect(template.isSystem).toBe(true)
    })
  })

  describe('CreateTemplateRequest', () => {
    it('should have all required properties', () => {
      const request = createMockCreateTemplateRequest()

      const requiredProps = [
        'name', 'description', 'category', 'workflow',
        'autonomy', 'descriptionTemplate'
      ]

      requiredProps.forEach(prop => {
        expect(request).toHaveProperty(prop)
      })
    })

    it('should support all optional properties', () => {
      const request = createMockCreateTemplateRequest({
        acceptanceCriteriaTemplate: 'criteria',
        variables: [createMockTemplateVariable()],
        tags: ['tag1', 'tag2'],
        isQuickAction: true,
        priority: 'high',
        effort: 'large',
        icon: 'icon',
        color: 'red'
      })

      expect(request.acceptanceCriteriaTemplate).toBe('criteria')
      expect(Array.isArray(request.variables)).toBe(true)
      expect(Array.isArray(request.tags)).toBe(true)
      expect(request.isQuickAction).toBe(true)
      expect(request.priority).toBe('high')
      expect(request.effort).toBe('large')
      expect(request.icon).toBe('icon')
      expect(request.color).toBe('red')
    })
  })
})

// ============================================================================
// Constants and Default Values Tests
// ============================================================================

describe('Constants and Defaults', () => {
  describe('DEFAULT_TEMPLATE_VALUES', () => {
    it('should provide sensible defaults', () => {
      expect(DEFAULT_TEMPLATE_VALUES.category).toBe('custom')
      expect(DEFAULT_TEMPLATE_VALUES.autonomy).toBe('review-before-commit')
      expect(DEFAULT_TEMPLATE_VALUES.priority).toBe('normal')
      expect(DEFAULT_TEMPLATE_VALUES.effort).toBe('medium')
      expect(DEFAULT_TEMPLATE_VALUES.isQuickAction).toBe(false)
      expect(Array.isArray(DEFAULT_TEMPLATE_VALUES.tags)).toBe(true)
      expect(Array.isArray(DEFAULT_TEMPLATE_VALUES.variables)).toBe(true)
      expect(DEFAULT_TEMPLATE_VALUES.tags).toHaveLength(0)
      expect(DEFAULT_TEMPLATE_VALUES.variables).toHaveLength(0)
    })
  })

  describe('TEMPLATE_CATEGORY_CONFIG', () => {
    it('should have configuration for all categories', () => {
      const categories: TemplateCategory[] = [
        'feature', 'bugfix', 'refactoring', 'testing',
        'documentation', 'maintenance', 'deployment', 'custom'
      ]

      categories.forEach(category => {
        expect(TEMPLATE_CATEGORY_CONFIG).toHaveProperty(category)
        const config = TEMPLATE_CATEGORY_CONFIG[category]
        expect(config).toHaveProperty('label')
        expect(config).toHaveProperty('icon')
        expect(config).toHaveProperty('color')
        expect(typeof config.label).toBe('string')
        expect(typeof config.icon).toBe('string')
        expect(typeof config.color).toBe('string')
      })
    })

    it('should have meaningful labels', () => {
      expect(TEMPLATE_CATEGORY_CONFIG.feature.label).toBe('Feature')
      expect(TEMPLATE_CATEGORY_CONFIG.bugfix.label).toBe('Bug Fix')
      expect(TEMPLATE_CATEGORY_CONFIG.refactoring.label).toBe('Refactoring')
      expect(TEMPLATE_CATEGORY_CONFIG.testing.label).toBe('Testing')
      expect(TEMPLATE_CATEGORY_CONFIG.documentation.label).toBe('Documentation')
      expect(TEMPLATE_CATEGORY_CONFIG.maintenance.label).toBe('Maintenance')
      expect(TEMPLATE_CATEGORY_CONFIG.deployment.label).toBe('Deployment')
      expect(TEMPLATE_CATEGORY_CONFIG.custom.label).toBe('Custom')
    })
  })

  describe('VARIABLE_TYPE_CONFIG', () => {
    it('should have configuration for all variable types', () => {
      const types: TemplateVariableType[] = [
        'string', 'text', 'number', 'boolean',
        'select', 'multiselect', 'file', 'directory'
      ]

      types.forEach(type => {
        expect(VARIABLE_TYPE_CONFIG).toHaveProperty(type)
        const config = VARIABLE_TYPE_CONFIG[type]
        expect(config).toHaveProperty('label')
        expect(config).toHaveProperty('icon')
        expect(typeof config.label).toBe('string')
        expect(typeof config.icon).toBe('string')
      })
    })

    it('should have meaningful labels', () => {
      expect(VARIABLE_TYPE_CONFIG.string.label).toBe('Text')
      expect(VARIABLE_TYPE_CONFIG.text.label).toBe('Multi-line Text')
      expect(VARIABLE_TYPE_CONFIG.number.label).toBe('Number')
      expect(VARIABLE_TYPE_CONFIG.boolean.label).toBe('Toggle')
      expect(VARIABLE_TYPE_CONFIG.select.label).toBe('Select')
      expect(VARIABLE_TYPE_CONFIG.multiselect.label).toBe('Multi-select')
      expect(VARIABLE_TYPE_CONFIG.file.label).toBe('File Path')
      expect(VARIABLE_TYPE_CONFIG.directory.label).toBe('Directory')
    })
  })
})

// ============================================================================
// Template Variable Type Tests
// ============================================================================

describe('Template Variable Types', () => {
  describe('TemplateVariableValues', () => {
    it('should support string values', () => {
      const values: TemplateVariableValues = {
        stringVar: 'test value',
        textVar: 'multi-line\ntext content'
      }

      expect(values.stringVar).toBe('test value')
      expect(values.textVar).toBe('multi-line\ntext content')
    })

    it('should support number values', () => {
      const values: TemplateVariableValues = {
        numberVar: 42,
        decimalVar: 3.14
      }

      expect(values.numberVar).toBe(42)
      expect(values.decimalVar).toBe(3.14)
    })

    it('should support boolean values', () => {
      const values: TemplateVariableValues = {
        enabledVar: true,
        disabledVar: false
      }

      expect(values.enabledVar).toBe(true)
      expect(values.disabledVar).toBe(false)
    })

    it('should support string array values', () => {
      const values: TemplateVariableValues = {
        multiselectVar: ['option1', 'option2', 'option3']
      }

      expect(Array.isArray(values.multiselectVar)).toBe(true)
      expect(values.multiselectVar).toEqual(['option1', 'option2', 'option3'])
    })
  })

  describe('TemplateVariableOption', () => {
    it('should support all properties', () => {
      const option: TemplateVariableOption = {
        label: 'Option Label',
        value: 'option_value',
        description: 'Optional description',
        disabled: false
      }

      expect(option.label).toBe('Option Label')
      expect(option.value).toBe('option_value')
      expect(option.description).toBe('Optional description')
      expect(option.disabled).toBe(false)
    })

    it('should work with minimal properties', () => {
      const option: TemplateVariableOption = {
        label: 'Simple Option',
        value: 'simple'
      }

      expect(option.label).toBe('Simple Option')
      expect(option.value).toBe('simple')
      expect(option.description).toBeUndefined()
      expect(option.disabled).toBeUndefined()
    })
  })
})

// ============================================================================
// Request and Response Type Tests
// ============================================================================

describe('Request and Response Types', () => {
  describe('UpdateTemplateRequest', () => {
    it('should only require id', () => {
      const minimal: UpdateTemplateRequest = {
        id: 'template_123'
      }

      expect(minimal.id).toBe('template_123')
    })

    it('should support updating any field', () => {
      const update: UpdateTemplateRequest = {
        id: 'template_123',
        name: 'Updated Name',
        description: 'Updated description',
        category: 'bugfix',
        workflow: 'hotfix',
        autonomy: 'autonomous',
        descriptionTemplate: 'Updated template',
        acceptanceCriteriaTemplate: 'Updated criteria',
        variables: [createMockTemplateVariable()],
        tags: ['updated', 'tags'],
        isQuickAction: true,
        priority: 'urgent',
        effort: 'small',
        icon: 'new-icon',
        color: 'new-color',
        archived: true
      }

      expect(update.id).toBe('template_123')
      expect(update.name).toBe('Updated Name')
      expect(update.category).toBe('bugfix')
      expect(update.archived).toBe(true)
    })
  })

  describe('CreateTaskFromTemplateRequest', () => {
    it('should have required properties', () => {
      const request: CreateTaskFromTemplateRequest = {
        templateId: 'template_123',
        variables: {
          componentName: 'UserProfile',
          description: 'A user profile component'
        }
      }

      expect(request.templateId).toBe('template_123')
      expect(request.variables).toEqual({
        componentName: 'UserProfile',
        description: 'A user profile component'
      })
    })

    it('should support overriding template defaults', () => {
      const request: CreateTaskFromTemplateRequest = {
        templateId: 'template_123',
        variables: {},
        priority: 'urgent',
        effort: 'large',
        autonomy: 'autonomous',
        projectPath: '/path/to/project'
      }

      expect(request.priority).toBe('urgent')
      expect(request.effort).toBe('large')
      expect(request.autonomy).toBe('autonomous')
      expect(request.projectPath).toBe('/path/to/project')
    })
  })

  describe('TemplateListResponse', () => {
    it('should structure pagination data correctly', () => {
      const response: TemplateListResponse = {
        templates: [createMockTaskTemplate()],
        total: 1,
        page: 1,
        pageSize: 10
      }

      expect(Array.isArray(response.templates)).toBe(true)
      expect(response.total).toBe(1)
      expect(response.page).toBe(1)
      expect(response.pageSize).toBe(10)
    })
  })

  describe('TemplateSearchResponse', () => {
    it('should structure search data correctly', () => {
      const response: TemplateSearchResponse = {
        results: [createMockTaskTemplate()],
        query: 'react component',
        total: 1
      }

      expect(Array.isArray(response.results)).toBe(true)
      expect(response.query).toBe('react component')
      expect(response.total).toBe(1)
    })
  })
})

// ============================================================================
// Filter and Query Type Tests
// ============================================================================

describe('Filter and Query Types', () => {
  describe('TemplateFilters', () => {
    it('should support single category filter', () => {
      const filters: TemplateFilters = {
        category: 'feature'
      }

      expect(filters.category).toBe('feature')
    })

    it('should support multiple category filter', () => {
      const filters: TemplateFilters = {
        category: ['feature', 'bugfix']
      }

      expect(Array.isArray(filters.category)).toBe(true)
      expect(filters.category).toEqual(['feature', 'bugfix'])
    })

    it('should support all filter options', () => {
      const filters: TemplateFilters = {
        category: ['feature', 'bugfix'],
        workflow: ['development', 'hotfix'],
        tags: ['react', 'typescript'],
        isQuickAction: true,
        includeArchived: false,
        search: 'component'
      }

      expect(filters.category).toEqual(['feature', 'bugfix'])
      expect(filters.workflow).toEqual(['development', 'hotfix'])
      expect(filters.tags).toEqual(['react', 'typescript'])
      expect(filters.isQuickAction).toBe(true)
      expect(filters.includeArchived).toBe(false)
      expect(filters.search).toBe('component')
    })
  })

  describe('TemplateSortOptions', () => {
    it('should support all sort fields', () => {
      const sortOptions: TemplateSortOptions[] = [
        { field: 'name', direction: 'asc' },
        { field: 'createdAt', direction: 'desc' },
        { field: 'updatedAt', direction: 'asc' },
        { field: 'usageCount', direction: 'desc' },
        { field: 'category', direction: 'asc' }
      ]

      sortOptions.forEach(option => {
        expect(['name', 'createdAt', 'updatedAt', 'usageCount', 'category']).toContain(option.field)
        expect(['asc', 'desc']).toContain(option.direction)
      })
    })
  })

  describe('TemplatePaginationOptions', () => {
    it('should validate pagination structure', () => {
      const pagination: TemplatePaginationOptions = {
        page: 2,
        pageSize: 20
      }

      expect(pagination.page).toBe(2)
      expect(pagination.pageSize).toBe(20)
    })
  })
})

// ============================================================================
// Component Props Type Tests
// ============================================================================

describe('Component Props Types', () => {
  describe('TemplateListProps', () => {
    it('should support minimal props', () => {
      const props: TemplateListProps = {
        templates: [createMockTaskTemplate()]
      }

      expect(Array.isArray(props.templates)).toBe(true)
    })

    it('should support all optional props', () => {
      const mockTemplate = createMockTaskTemplate()
      const props: TemplateListProps = {
        templates: [mockTemplate],
        selectedId: 'template_123',
        loading: true,
        error: 'Error loading templates',
        onSelect: (template) => console.log('Selected:', template.id),
        onEdit: (template) => console.log('Edit:', template.id),
        onDelete: (template) => console.log('Delete:', template.id),
        onUse: (template) => console.log('Use:', template.id),
        quickActionsOnly: true,
        compact: false,
        className: 'custom-class'
      }

      expect(props.selectedId).toBe('template_123')
      expect(props.loading).toBe(true)
      expect(props.error).toBe('Error loading templates')
      expect(typeof props.onSelect).toBe('function')
      expect(typeof props.onEdit).toBe('function')
      expect(typeof props.onDelete).toBe('function')
      expect(typeof props.onUse).toBe('function')
      expect(props.quickActionsOnly).toBe(true)
      expect(props.compact).toBe(false)
      expect(props.className).toBe('custom-class')
    })
  })

  describe('TemplateFormProps', () => {
    it('should require onSubmit and mode', () => {
      const props: TemplateFormProps = {
        onSubmit: async (data) => console.log('Submit:', data),
        mode: 'create'
      }

      expect(typeof props.onSubmit).toBe('function')
      expect(props.mode).toBe('create')
    })

    it('should support edit mode with initial data', () => {
      const props: TemplateFormProps = {
        initialData: createMockTaskTemplate(),
        workflows: ['development', 'hotfix'],
        isSubmitting: true,
        error: 'Validation error',
        onSubmit: async (data) => console.log('Submit:', data),
        onCancel: () => console.log('Cancel'),
        mode: 'edit',
        className: 'form-class'
      }

      expect(props.mode).toBe('edit')
      expect(props.initialData).toBeDefined()
      expect(Array.isArray(props.workflows)).toBe(true)
      expect(props.isSubmitting).toBe(true)
      expect(props.error).toBe('Validation error')
      expect(typeof props.onCancel).toBe('function')
      expect(props.className).toBe('form-class')
    })
  })

  describe('TemplateVariableInputProps', () => {
    it('should require variable and onChange', () => {
      const props: TemplateVariableInputProps = {
        variable: createMockTemplateVariable(),
        value: 'test value',
        onChange: (value) => console.log('Change:', value)
      }

      expect(props.variable).toBeDefined()
      expect(props.value).toBe('test value')
      expect(typeof props.onChange).toBe('function')
    })

    it('should support all optional props', () => {
      const props: TemplateVariableInputProps = {
        variable: createMockTemplateVariable(),
        value: undefined,
        onChange: (value) => console.log('Change:', value),
        disabled: true,
        error: 'Validation error',
        className: 'input-class'
      }

      expect(props.value).toBeUndefined()
      expect(props.disabled).toBe(true)
      expect(props.error).toBe('Validation error')
      expect(props.className).toBe('input-class')
    })
  })

  describe('TemplatePreviewProps', () => {
    it('should require template', () => {
      const props: TemplatePreviewProps = {
        template: createMockTaskTemplate()
      }

      expect(props.template).toBeDefined()
    })

    it('should support all optional props', () => {
      const props: TemplatePreviewProps = {
        template: createMockTaskTemplate(),
        variableValues: {
          componentName: 'UserProfile'
        },
        showInterpolated: true,
        className: 'preview-class'
      }

      expect(props.variableValues).toBeDefined()
      expect(props.showInterpolated).toBe(true)
      expect(props.className).toBe('preview-class')
    })
  })
})

// ============================================================================
// Hook Return Type Tests
// ============================================================================

describe('Hook Return Types', () => {
  describe('UseTaskTemplatesReturn', () => {
    it('should define all required properties and methods', () => {
      // We can't test the actual hook, but we can test the type structure
      const mockReturn: UseTaskTemplatesReturn = {
        templates: [createMockTaskTemplate()],
        isLoading: false,
        error: null,
        refresh: async () => {},
        createTemplate: async (request) => createMockTaskTemplate(),
        updateTemplate: async (request) => createMockTaskTemplate(),
        deleteTemplate: async (id) => {},
        getTemplate: (id) => createMockTaskTemplate(),
        searchTemplates: (query) => [createMockTaskTemplate()],
        filterTemplates: (filters) => [createMockTaskTemplate()]
      }

      expect(Array.isArray(mockReturn.templates)).toBe(true)
      expect(typeof mockReturn.isLoading).toBe('boolean')
      expect(typeof mockReturn.refresh).toBe('function')
      expect(typeof mockReturn.createTemplate).toBe('function')
      expect(typeof mockReturn.updateTemplate).toBe('function')
      expect(typeof mockReturn.deleteTemplate).toBe('function')
      expect(typeof mockReturn.getTemplate).toBe('function')
      expect(typeof mockReturn.searchTemplates).toBe('function')
      expect(typeof mockReturn.filterTemplates).toBe('function')
    })
  })

  describe('UseTemplateFormReturn', () => {
    it('should define all required properties and methods', () => {
      const mockReturn: UseTemplateFormReturn = {
        values: createMockCreateTemplateRequest(),
        errors: {},
        isValid: true,
        isDirty: false,
        setField: (field, value) => {},
        setFields: (values) => {},
        addVariable: (variable) => {},
        removeVariable: (name) => {},
        updateVariable: (name, updates) => {},
        reset: () => {},
        validate: () => true,
        getSubmitData: () => createMockCreateTemplateRequest()
      }

      expect(typeof mockReturn.values).toBe('object')
      expect(typeof mockReturn.errors).toBe('object')
      expect(typeof mockReturn.isValid).toBe('boolean')
      expect(typeof mockReturn.isDirty).toBe('boolean')
      expect(typeof mockReturn.setField).toBe('function')
      expect(typeof mockReturn.setFields).toBe('function')
      expect(typeof mockReturn.addVariable).toBe('function')
      expect(typeof mockReturn.removeVariable).toBe('function')
      expect(typeof mockReturn.updateVariable).toBe('function')
      expect(typeof mockReturn.reset).toBe('function')
      expect(typeof mockReturn.validate).toBe('function')
      expect(typeof mockReturn.getSubmitData).toBe('function')
    })
  })

  describe('UseTemplateVariablesReturn', () => {
    it('should define all required properties and methods', () => {
      const mockReturn: UseTemplateVariablesReturn = {
        values: { componentName: 'UserProfile' },
        errors: {},
        isComplete: true,
        isDirty: false,
        setValue: (name, value) => {},
        setValues: (values) => {},
        reset: () => {},
        validate: () => true,
        interpolate: (template) => 'interpolated string'
      }

      expect(typeof mockReturn.values).toBe('object')
      expect(typeof mockReturn.errors).toBe('object')
      expect(typeof mockReturn.isComplete).toBe('boolean')
      expect(typeof mockReturn.isDirty).toBe('boolean')
      expect(typeof mockReturn.setValue).toBe('function')
      expect(typeof mockReturn.setValues).toBe('function')
      expect(typeof mockReturn.reset).toBe('function')
      expect(typeof mockReturn.validate).toBe('function')
      expect(typeof mockReturn.interpolate).toBe('function')
    })
  })
})

// ============================================================================
// Utility Type Tests
// ============================================================================

describe('Utility Types', () => {
  describe('InterpolationResult', () => {
    it('should structure interpolation results correctly', () => {
      const result: InterpolationResult = {
        result: 'Create UserProfile component',
        replaced: ['componentName'],
        missing: ['description'],
        complete: false
      }

      expect(result.result).toBe('Create UserProfile component')
      expect(Array.isArray(result.replaced)).toBe(true)
      expect(Array.isArray(result.missing)).toBe(true)
      expect(typeof result.complete).toBe('boolean')
    })
  })

  describe('TemplateValidationResult', () => {
    it('should structure validation results correctly', () => {
      const error: TemplateValidationError = {
        field: 'name',
        message: 'Name is required',
        severity: 'error'
      }

      const warning: TemplateValidationError = {
        field: 'description',
        message: 'Description could be more detailed',
        severity: 'warning'
      }

      const result: TemplateValidationResult = {
        isValid: false,
        errors: [error],
        warnings: [warning]
      }

      expect(typeof result.isValid).toBe('boolean')
      expect(Array.isArray(result.errors)).toBe(true)
      expect(Array.isArray(result.warnings)).toBe(true)
      expect(result.errors[0].severity).toBe('error')
      expect(result.warnings[0].severity).toBe('warning')
    })
  })
})

// ============================================================================
// Edge Cases and Error Handling Tests
// ============================================================================

describe('Edge Cases and Error Handling', () => {
  describe('Empty and null values', () => {
    it('should handle empty arrays gracefully', () => {
      const template = createMockTaskTemplate({
        variables: [],
        tags: []
      })

      expect(template.variables).toEqual([])
      expect(template.tags).toEqual([])
    })

    it('should handle undefined optional properties', () => {
      const template = createMockTaskTemplate({
        acceptanceCriteriaTemplate: undefined,
        variables: undefined,
        icon: undefined,
        color: undefined,
        archived: undefined,
        usageCount: undefined,
        createdBy: undefined,
        isSystem: undefined
      })

      expect(template.acceptanceCriteriaTemplate).toBeUndefined()
      expect(template.variables).toBeUndefined()
      expect(template.icon).toBeUndefined()
      expect(template.color).toBeUndefined()
      expect(template.archived).toBeUndefined()
      expect(template.usageCount).toBeUndefined()
      expect(template.createdBy).toBeUndefined()
      expect(template.isSystem).toBeUndefined()
    })
  })

  describe('Boundary values', () => {
    it('should handle very long strings', () => {
      const longString = 'a'.repeat(10000)
      const template = createMockTaskTemplate({
        name: longString,
        description: longString,
        descriptionTemplate: longString
      })

      expect(template.name).toHaveLength(10000)
      expect(template.description).toHaveLength(10000)
      expect(template.descriptionTemplate).toHaveLength(10000)
    })

    it('should handle empty strings', () => {
      const variable = createMockTemplateVariable({
        name: '',
        label: '',
        placeholder: '',
        description: '',
        validationPattern: '',
        validationMessage: ''
      })

      expect(variable.name).toBe('')
      expect(variable.label).toBe('')
      expect(variable.placeholder).toBe('')
      expect(variable.description).toBe('')
      expect(variable.validationPattern).toBe('')
      expect(variable.validationMessage).toBe('')
    })
  })

  describe('Type compatibility', () => {
    it('should allow valid category strings', () => {
      const categories: TemplateCategory[] = [
        'feature', 'bugfix', 'refactoring', 'testing',
        'documentation', 'maintenance', 'deployment', 'custom'
      ]

      categories.forEach(category => {
        const template = createMockTaskTemplate({ category })
        expect(template.category).toBe(category)
      })
    })

    it('should allow valid variable types', () => {
      const types: TemplateVariableType[] = [
        'string', 'text', 'number', 'boolean',
        'select', 'multiselect', 'file', 'directory'
      ]

      types.forEach(type => {
        const variable = createMockTemplateVariable({ type })
        expect(variable.type).toBe(type)
      })
    })
  })
})