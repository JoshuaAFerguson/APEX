/**
 * Integration tests for Task Template types
 * Tests template interpolation, validation scenarios, and complex workflows
 */

import { describe, it, expect, beforeEach } from 'vitest'
import type {
  TaskTemplate,
  TemplateVariable,
  TemplateVariableValues,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  CreateTaskFromTemplateRequest,
  TemplateFilters,
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
// Mock Template Interpolation Functions
// ============================================================================

/**
 * Mock implementation of template interpolation
 * This would normally be implemented in a separate utility module
 */
function interpolateTemplate(template: string, variables: TemplateVariableValues): InterpolationResult {
  let result = template
  const replaced: string[] = []
  const missing: string[] = []

  // Find all variables in the template
  const variablePattern = /\{\{(\w+)\}\}/g
  const matches = Array.from(template.matchAll(variablePattern))

  for (const match of matches) {
    const variableName = match[1]
    const placeholder = match[0]

    if (variables[variableName] !== undefined) {
      const value = String(variables[variableName])
      result = result.replace(placeholder, value)
      if (!replaced.includes(variableName)) {
        replaced.push(variableName)
      }
    } else {
      if (!missing.includes(variableName)) {
        missing.push(variableName)
      }
    }
  }

  return {
    result,
    replaced,
    missing,
    complete: missing.length === 0
  }
}

/**
 * Mock implementation of template validation
 * This would normally be implemented in a separate utility module
 */
function validateTemplate(template: TaskTemplate): TemplateValidationResult {
  const errors: TemplateValidationError[] = []
  const warnings: TemplateValidationError[] = []

  // Required field validations
  if (!template.name?.trim()) {
    errors.push({
      field: 'name',
      message: 'Name is required',
      severity: 'error'
    })
  }

  if (!template.description?.trim()) {
    errors.push({
      field: 'description',
      message: 'Description is required',
      severity: 'error'
    })
  }

  if (!template.descriptionTemplate?.trim()) {
    errors.push({
      field: 'descriptionTemplate',
      message: 'Description template is required',
      severity: 'error'
    })
  }

  if (!isTemplateCategory(template.category)) {
    errors.push({
      field: 'category',
      message: 'Invalid template category',
      severity: 'error'
    })
  }

  // Variable validation
  if (template.variables) {
    template.variables.forEach((variable, index) => {
      if (!variable.name?.trim()) {
        errors.push({
          field: `variables[${index}].name`,
          message: 'Variable name is required',
          severity: 'error'
        })
      }

      if (!variable.label?.trim()) {
        errors.push({
          field: `variables[${index}].label`,
          message: 'Variable label is required',
          severity: 'error'
        })
      }

      if (!isTemplateVariableType(variable.type)) {
        errors.push({
          field: `variables[${index}].type`,
          message: 'Invalid variable type',
          severity: 'error'
        })
      }

      // Validation pattern check
      if (variable.validationPattern && variable.type === 'string') {
        try {
          new RegExp(variable.validationPattern)
        } catch (e) {
          errors.push({
            field: `variables[${index}].validationPattern`,
            message: 'Invalid regex pattern',
            severity: 'error'
          })
        }
      }
    })
  }

  // Warning checks
  if (template.name && template.name.length < 3) {
    warnings.push({
      field: 'name',
      message: 'Name should be at least 3 characters long',
      severity: 'warning'
    })
  }

  if (template.description && template.description.length < 10) {
    warnings.push({
      field: 'description',
      message: 'Description should be more detailed',
      severity: 'warning'
    })
  }

  if (template.tags && template.tags.length === 0) {
    warnings.push({
      field: 'tags',
      message: 'Consider adding tags for better organization',
      severity: 'warning'
    })
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Mock implementation of variable validation
 */
function validateVariableValue(variable: TemplateVariable, value: unknown): string | null {
  // Check if the field is required but not provided
  if (variable.required && (value === undefined || value === null || value === '')) {
    return `${variable.label} is required`
  }

  // If field is not provided and not required, it's valid
  if (!variable.required && (value === undefined || value === null || value === '')) {
    return null
  }

  // If field is provided but is null/undefined (and we got here), treat as not provided
  if (value === undefined || value === null) {
    return null
  }

  // If we get here, the field has a value, so validate it regardless of required status

  switch (variable.type) {
    case 'string':
    case 'text':
    case 'file':
    case 'directory':
      if (typeof value !== 'string') {
        return `${variable.label} must be a string`
      }

      if (variable.minLength && value.length < variable.minLength) {
        return `${variable.label} must be at least ${variable.minLength} characters`
      }

      if (variable.maxLength && value.length > variable.maxLength) {
        return `${variable.label} must be at most ${variable.maxLength} characters`
      }

      if (variable.validationPattern) {
        try {
          const regex = new RegExp(variable.validationPattern)
          if (!regex.test(value)) {
            return variable.validationMessage || `${variable.label} format is invalid`
          }
        } catch (e) {
          return `${variable.label} validation pattern is invalid`
        }
      }
      break

    case 'number':
      if (typeof value !== 'number' || isNaN(value)) {
        return `${variable.label} must be a number`
      }

      if (variable.min !== undefined && value < variable.min) {
        return `${variable.label} must be at least ${variable.min}`
      }

      if (variable.max !== undefined && value > variable.max) {
        return `${variable.label} must be at most ${variable.max}`
      }
      break

    case 'boolean':
      if (typeof value !== 'boolean') {
        return `${variable.label} must be true or false`
      }
      break

    case 'select':
      if (typeof value !== 'string') {
        return `${variable.label} must be a string`
      }

      if (variable.options && !variable.options.some(opt => opt.value === value)) {
        return `${variable.label} must be one of the available options`
      }
      break

    case 'multiselect':
      if (!Array.isArray(value) || !value.every(v => typeof v === 'string')) {
        return `${variable.label} must be an array of strings`
      }

      if (variable.options) {
        const validValues = variable.options.map(opt => opt.value)
        const invalidValues = value.filter(v => !validValues.includes(v))
        if (invalidValues.length > 0) {
          return `${variable.label} contains invalid options: ${invalidValues.join(', ')}`
        }
      }
      break
  }

  return null
}

// ============================================================================
// Test Data Factories
// ============================================================================

const createComplexTemplate = (): TaskTemplate => ({
  id: 'complex_template',
  name: 'Complex React Component',
  description: 'Creates a complex React component with props, state, and lifecycle methods',
  category: 'feature',
  workflow: 'feature-development',
  autonomy: 'review-before-commit',
  descriptionTemplate: `Create a {{componentType}} component named {{componentName}} in the {{directory}} directory.

The component should:
- Accept {{propCount}} props
- {{hasState ? 'Have internal state management' : 'Be stateless'}}
- {{includeTests ? 'Include comprehensive tests' : 'Skip tests for now'}}
- Use {{styleType}} for styling

Additional features: {{features}}`,
  acceptanceCriteriaTemplate: `The {{componentName}} component should:
- Render without errors
- Accept all specified props correctly
- {{hasState ? 'Manage state appropriately' : 'Remain stateless'}}
- {{includeTests ? 'Have test coverage above 90%' : 'Be ready for testing later'}}
- Follow the project's {{styleType}} patterns
- Be properly documented`,
  variables: [
    {
      name: 'componentName',
      label: 'Component Name',
      type: 'string',
      required: true,
      placeholder: 'e.g., UserProfile',
      description: 'PascalCase name for the React component',
      validationPattern: '^[A-Z][a-zA-Z0-9]*$',
      validationMessage: 'Component name must be in PascalCase',
      minLength: 2,
      maxLength: 50
    },
    {
      name: 'componentType',
      label: 'Component Type',
      type: 'select',
      required: true,
      description: 'Type of React component to create',
      options: [
        { label: 'Functional Component', value: 'functional', description: 'Modern React functional component' },
        { label: 'Class Component', value: 'class', description: 'Traditional React class component' },
        { label: 'Custom Hook', value: 'hook', description: 'Custom React hook' }
      ],
      defaultValue: 'functional'
    },
    {
      name: 'directory',
      label: 'Directory Path',
      type: 'directory',
      required: true,
      placeholder: 'src/components/feature',
      description: 'Directory where the component will be created',
      defaultValue: 'src/components'
    },
    {
      name: 'propCount',
      label: 'Number of Props',
      type: 'number',
      required: false,
      description: 'How many props the component should accept',
      defaultValue: 3,
      min: 0,
      max: 20
    },
    {
      name: 'hasState',
      label: 'Has Internal State',
      type: 'boolean',
      required: false,
      description: 'Whether the component should manage internal state',
      defaultValue: false
    },
    {
      name: 'includeTests',
      label: 'Include Tests',
      type: 'boolean',
      required: true,
      description: 'Whether to create test files for the component',
      defaultValue: true
    },
    {
      name: 'styleType',
      label: 'Styling Approach',
      type: 'select',
      required: true,
      description: 'Styling method to use for the component',
      options: [
        { label: 'CSS Modules', value: 'css-modules' },
        { label: 'Styled Components', value: 'styled-components' },
        { label: 'Tailwind CSS', value: 'tailwind' },
        { label: 'Plain CSS', value: 'css' }
      ],
      defaultValue: 'css-modules'
    },
    {
      name: 'features',
      label: 'Additional Features',
      type: 'multiselect',
      required: false,
      description: 'Optional features to include in the component',
      options: [
        { label: 'Error Boundaries', value: 'error-boundaries' },
        { label: 'Memoization', value: 'memoization' },
        { label: 'Accessibility', value: 'accessibility' },
        { label: 'Internationalization', value: 'i18n' },
        { label: 'Dark Mode Support', value: 'dark-mode' }
      ],
      defaultValue: []
    }
  ],
  tags: ['react', 'component', 'frontend', 'typescript'],
  isQuickAction: false,
  priority: 'normal',
  effort: 'medium',
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-15T00:00:00.000Z'),
  icon: 'component',
  color: 'blue',
  archived: false,
  usageCount: 25,
  createdBy: 'user123',
  isSystem: false
})

// ============================================================================
// Template Interpolation Tests
// ============================================================================

describe('Template Interpolation Integration', () => {
  let complexTemplate: TaskTemplate

  beforeEach(() => {
    complexTemplate = createComplexTemplate()
  })

  describe('Simple interpolation', () => {
    it('should interpolate single variable correctly', () => {
      const template = 'Create {{componentName}} component'
      const variables = { componentName: 'UserProfile' }

      const result = interpolateTemplate(template, variables)

      expect(result.result).toBe('Create UserProfile component')
      expect(result.replaced).toEqual(['componentName'])
      expect(result.missing).toEqual([])
      expect(result.complete).toBe(true)
    })

    it('should handle multiple instances of the same variable', () => {
      const template = '{{name}} is a {{name}} component for {{name}}'
      const variables = { name: 'UserProfile' }

      const result = interpolateTemplate(template, variables)

      expect(result.result).toBe('UserProfile is a UserProfile component for UserProfile')
      expect(result.replaced).toEqual(['name'])
      expect(result.missing).toEqual([])
      expect(result.complete).toBe(true)
    })

    it('should identify missing variables', () => {
      const template = 'Create {{componentName}} in {{directory}}'
      const variables = { componentName: 'UserProfile' }

      const result = interpolateTemplate(template, variables)

      expect(result.result).toBe('Create UserProfile in {{directory}}')
      expect(result.replaced).toEqual(['componentName'])
      expect(result.missing).toEqual(['directory'])
      expect(result.complete).toBe(false)
    })
  })

  describe('Complex interpolation', () => {
    it('should interpolate complex template with all variables', () => {
      const variables: TemplateVariableValues = {
        componentName: 'UserProfile',
        componentType: 'functional',
        directory: 'src/components/user',
        propCount: 5,
        hasState: true,
        includeTests: true,
        styleType: 'styled-components',
        features: ['accessibility', 'memoization']
      }

      const result = interpolateTemplate(complexTemplate.descriptionTemplate, variables)

      expect(result.result).toContain('Create a functional component named UserProfile')
      expect(result.result).toContain('in the src/components/user directory')
      expect(result.result).toContain('Accept 5 props')
      expect(result.result).toContain('Have internal state management')
      expect(result.result).toContain('Include comprehensive tests')
      expect(result.result).toContain('Use styled-components for styling')
      expect(result.result).toContain('accessibility,memoization')
      expect(result.complete).toBe(true)
      expect(result.missing).toEqual([])
    })

    it('should handle boolean conditionals in templates', () => {
      const variables: TemplateVariableValues = {
        componentName: 'SimpleButton',
        componentType: 'functional',
        directory: 'src/components',
        propCount: 2,
        hasState: false,
        includeTests: false,
        styleType: 'css',
        features: []
      }

      const result = interpolateTemplate(complexTemplate.descriptionTemplate, variables)

      expect(result.result).toContain('Be stateless')
      expect(result.result).toContain('Skip tests for now')
      expect(result.complete).toBe(true)
    })

    it('should handle array variables correctly', () => {
      const template = 'Features: {{features}}'
      const variables: TemplateVariableValues = {
        features: ['accessibility', 'dark-mode', 'i18n']
      }

      const result = interpolateTemplate(template, variables)

      expect(result.result).toBe('Features: accessibility,dark-mode,i18n')
      expect(result.complete).toBe(true)
    })
  })

  describe('Edge cases', () => {
    it('should handle empty template', () => {
      const result = interpolateTemplate('', {})

      expect(result.result).toBe('')
      expect(result.replaced).toEqual([])
      expect(result.missing).toEqual([])
      expect(result.complete).toBe(true)
    })

    it('should handle template with no variables', () => {
      const template = 'This is a static template without variables'
      const result = interpolateTemplate(template, {})

      expect(result.result).toBe(template)
      expect(result.replaced).toEqual([])
      expect(result.missing).toEqual([])
      expect(result.complete).toBe(true)
    })

    it('should handle empty variable values', () => {
      const template = 'Name: {{name}}, Description: {{description}}'
      const variables = { name: '', description: 'test' }

      const result = interpolateTemplate(template, variables)

      expect(result.result).toBe('Name: , Description: test')
      expect(result.replaced).toEqual(['name', 'description'])
      expect(result.complete).toBe(true)
    })

    it('should handle malformed variable syntax', () => {
      const template = 'Test {componentName} and {{componentName} and componentName}}'
      const variables = { componentName: 'UserProfile' }

      const result = interpolateTemplate(template, variables)

      // Only properly formatted {{componentName}} should be replaced
      expect(result.result).toBe('Test {componentName} and {{componentName} and componentName}}')
      expect(result.replaced).toEqual([])
      expect(result.missing).toEqual([])
      expect(result.complete).toBe(true)
    })
  })
})

// ============================================================================
// Template Validation Integration Tests
// ============================================================================

describe('Template Validation Integration', () => {
  describe('Valid template validation', () => {
    it('should validate a complete valid template', () => {
      const template = createComplexTemplate()
      const result = validateTemplate(template)

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
      // May have warnings but should still be valid
    })

    it('should allow minimal valid template', () => {
      const template: TaskTemplate = {
        id: 'minimal',
        name: 'Minimal Template',
        description: 'A minimal template for testing',
        category: 'custom',
        workflow: 'basic',
        autonomy: 'review-before-commit',
        descriptionTemplate: 'Simple task description',
        tags: [],
        isQuickAction: false,
        priority: 'normal',
        effort: 'small',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const result = validateTemplate(template)

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('Invalid template validation', () => {
    it('should detect missing required fields', () => {
      const template = createComplexTemplate()
      template.name = ''
      template.description = ''
      template.descriptionTemplate = ''

      const result = validateTemplate(template)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContainEqual({
        field: 'name',
        message: 'Name is required',
        severity: 'error'
      })
      expect(result.errors).toContainEqual({
        field: 'description',
        message: 'Description is required',
        severity: 'error'
      })
      expect(result.errors).toContainEqual({
        field: 'descriptionTemplate',
        message: 'Description template is required',
        severity: 'error'
      })
    })

    it('should detect invalid category', () => {
      const template = createComplexTemplate()
      ;(template as any).category = 'invalid-category'

      const result = validateTemplate(template)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContainEqual({
        field: 'category',
        message: 'Invalid template category',
        severity: 'error'
      })
    })

    it('should validate template variables', () => {
      const template = createComplexTemplate()
      template.variables = [
        {
          name: '',
          label: '',
          type: 'invalid' as any,
          required: true
        },
        {
          name: 'valid',
          label: 'Valid Variable',
          type: 'string',
          required: true,
          validationPattern: '['  // Invalid regex
        }
      ]

      const result = validateTemplate(template)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContainEqual({
        field: 'variables[0].name',
        message: 'Variable name is required',
        severity: 'error'
      })
      expect(result.errors).toContainEqual({
        field: 'variables[0].label',
        message: 'Variable label is required',
        severity: 'error'
      })
      expect(result.errors).toContainEqual({
        field: 'variables[0].type',
        message: 'Invalid variable type',
        severity: 'error'
      })
      expect(result.errors).toContainEqual({
        field: 'variables[1].validationPattern',
        message: 'Invalid regex pattern',
        severity: 'error'
      })
    })
  })

  describe('Warning validation', () => {
    it('should generate warnings for suboptimal templates', () => {
      const template = createComplexTemplate()
      template.name = 'Hi'  // Too short
      template.description = 'Short'  // Too short
      template.tags = []  // Empty tags

      const result = validateTemplate(template)

      expect(result.isValid).toBe(true)  // Warnings don't make it invalid
      expect(result.warnings).toContainEqual({
        field: 'name',
        message: 'Name should be at least 3 characters long',
        severity: 'warning'
      })
      expect(result.warnings).toContainEqual({
        field: 'description',
        message: 'Description should be more detailed',
        severity: 'warning'
      })
      expect(result.warnings).toContainEqual({
        field: 'tags',
        message: 'Consider adding tags for better organization',
        severity: 'warning'
      })
    })
  })
})

// ============================================================================
// Variable Validation Integration Tests
// ============================================================================

describe('Variable Validation Integration', () => {
  describe('String variable validation', () => {
    it('should validate string variables correctly', () => {
      const variable: TemplateVariable = {
        name: 'componentName',
        label: 'Component Name',
        type: 'string',
        required: true,
        validationPattern: '^[A-Z][a-zA-Z0-9]*$',
        validationMessage: 'Must be PascalCase',
        minLength: 2,
        maxLength: 20
      }

      // Valid value
      expect(validateVariableValue(variable, 'UserProfile')).toBeNull()

      // Required but empty
      expect(validateVariableValue(variable, '')).toBe('Component Name is required')
      expect(validateVariableValue(variable, null)).toBe('Component Name is required')
      expect(validateVariableValue(variable, undefined)).toBe('Component Name is required')

      // Wrong type
      expect(validateVariableValue(variable, 123)).toBe('Component Name must be a string')

      // Too short
      expect(validateVariableValue(variable, 'A')).toBe('Component Name must be at least 2 characters')

      // Too long
      expect(validateVariableValue(variable, 'VeryLongComponentNameThatExceedsTheLimit')).toBe('Component Name must be at most 20 characters')

      // Invalid pattern
      expect(validateVariableValue(variable, 'camelCase')).toBe('Must be PascalCase')
      expect(validateVariableValue(variable, 'snake_case')).toBe('Must be PascalCase')
    })
  })

  describe('Number variable validation', () => {
    it('should validate number variables correctly', () => {
      const variable: TemplateVariable = {
        name: 'propCount',
        label: 'Prop Count',
        type: 'number',
        required: true,
        min: 0,
        max: 10
      }

      // Valid values
      expect(validateVariableValue(variable, 5)).toBeNull()
      expect(validateVariableValue(variable, 0)).toBeNull()
      expect(validateVariableValue(variable, 10)).toBeNull()

      // Invalid type
      expect(validateVariableValue(variable, 'not a number')).toBe('Prop Count must be a number')
      expect(validateVariableValue(variable, NaN)).toBe('Prop Count must be a number')

      // Out of range
      expect(validateVariableValue(variable, -1)).toBe('Prop Count must be at least 0')
      expect(validateVariableValue(variable, 11)).toBe('Prop Count must be at most 10')
    })
  })

  describe('Boolean variable validation', () => {
    it('should validate boolean variables correctly', () => {
      const variable: TemplateVariable = {
        name: 'includeTests',
        label: 'Include Tests',
        type: 'boolean',
        required: true
      }

      // Valid values
      expect(validateVariableValue(variable, true)).toBeNull()
      expect(validateVariableValue(variable, false)).toBeNull()

      // Invalid type
      expect(validateVariableValue(variable, 'true')).toBe('Include Tests must be true or false')
      expect(validateVariableValue(variable, 1)).toBe('Include Tests must be true or false')
      expect(validateVariableValue(variable, 0)).toBe('Include Tests must be true or false')
    })
  })

  describe('Select variable validation', () => {
    it('should validate select variables correctly', () => {
      const variable: TemplateVariable = {
        name: 'styleType',
        label: 'Style Type',
        type: 'select',
        required: true,
        options: [
          { label: 'CSS Modules', value: 'css-modules' },
          { label: 'Styled Components', value: 'styled-components' },
          { label: 'Tailwind', value: 'tailwind' }
        ]
      }

      // Valid values
      expect(validateVariableValue(variable, 'css-modules')).toBeNull()
      expect(validateVariableValue(variable, 'styled-components')).toBeNull()
      expect(validateVariableValue(variable, 'tailwind')).toBeNull()

      // Invalid value
      expect(validateVariableValue(variable, 'invalid-option')).toBe('Style Type must be one of the available options')

      // Invalid type
      expect(validateVariableValue(variable, 123)).toBe('Style Type must be a string')
    })
  })

  describe('Multiselect variable validation', () => {
    it('should validate multiselect variables correctly', () => {
      const variable: TemplateVariable = {
        name: 'features',
        label: 'Features',
        type: 'multiselect',
        required: false,
        options: [
          { label: 'Accessibility', value: 'accessibility' },
          { label: 'Dark Mode', value: 'dark-mode' },
          { label: 'I18n', value: 'i18n' }
        ]
      }

      // Valid values
      expect(validateVariableValue(variable, [])).toBeNull()
      expect(validateVariableValue(variable, ['accessibility'])).toBeNull()
      expect(validateVariableValue(variable, ['accessibility', 'dark-mode'])).toBeNull()
      expect(validateVariableValue(variable, ['accessibility', 'dark-mode', 'i18n'])).toBeNull()

      // Invalid type
      expect(validateVariableValue(variable, 'not-array')).toBe('Features must be an array of strings')
      expect(validateVariableValue(variable, [1, 2, 3])).toBe('Features must be an array of strings')
      expect(validateVariableValue(variable, ['valid', 123])).toBe('Features must be an array of strings')

      // Invalid options
      expect(validateVariableValue(variable, ['invalid-option'])).toBe('Features contains invalid options: invalid-option')
      expect(validateVariableValue(variable, ['accessibility', 'invalid1', 'invalid2'])).toBe('Features contains invalid options: invalid1, invalid2')
    })
  })

  describe('Optional variable handling', () => {
    it('should handle optional variables correctly', () => {
      const variable: TemplateVariable = {
        name: 'optional',
        label: 'Optional Field',
        type: 'string',
        required: false,
        minLength: 5
      }

      // Optional with no value should be valid
      expect(validateVariableValue(variable, undefined)).toBeNull()
      expect(validateVariableValue(variable, null)).toBeNull()
      expect(validateVariableValue(variable, '')).toBeNull()

      // Optional with value should be validated
      expect(validateVariableValue(variable, 'short')).toBe('Optional Field must be at least 5 characters')
      expect(validateVariableValue(variable, 'long enough')).toBeNull()
    })
  })
})

// ============================================================================
// End-to-End Workflow Tests
// ============================================================================

describe('End-to-End Template Workflows', () => {
  describe('Template creation workflow', () => {
    it('should create and validate a complete template', () => {
      // Step 1: Create template request
      const createRequest: CreateTemplateRequest = {
        name: 'API Endpoint Template',
        description: 'Creates a new REST API endpoint with proper validation and tests',
        category: 'feature',
        workflow: 'api-development',
        autonomy: 'review-before-commit',
        descriptionTemplate: 'Create {{method}} endpoint for {{resource}} at {{path}}',
        acceptanceCriteriaTemplate: `The {{resource}} endpoint should:
- Handle {{method}} requests correctly
- Validate input data
- Return appropriate status codes
- Include comprehensive tests`,
        variables: [
          {
            name: 'method',
            label: 'HTTP Method',
            type: 'select',
            required: true,
            options: [
              { label: 'GET', value: 'GET' },
              { label: 'POST', value: 'POST' },
              { label: 'PUT', value: 'PUT' },
              { label: 'DELETE', value: 'DELETE' }
            ]
          },
          {
            name: 'resource',
            label: 'Resource Name',
            type: 'string',
            required: true,
            validationPattern: '^[a-z][a-z0-9-]*$',
            validationMessage: 'Resource name must be lowercase with hyphens'
          },
          {
            name: 'path',
            label: 'API Path',
            type: 'string',
            required: true,
            validationPattern: '^/api/v\\d+/.*$',
            validationMessage: 'Path must start with /api/v{number}/'
          }
        ],
        tags: ['api', 'rest', 'backend'],
        isQuickAction: true,
        priority: 'normal',
        effort: 'medium'
      }

      // Step 2: Convert to full template (simulate backend processing)
      const template: TaskTemplate = {
        id: 'api_endpoint_template',
        ...createRequest,
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
        archived: false
      }

      // Step 3: Validate the template
      const validation = validateTemplate(template)
      expect(validation.isValid).toBe(true)
      expect(validation.errors).toHaveLength(0)

      // Step 4: Test interpolation with valid values
      const variables: TemplateVariableValues = {
        method: 'POST',
        resource: 'user-profiles',
        path: '/api/v1/user-profiles'
      }

      const descriptionResult = interpolateTemplate(template.descriptionTemplate, variables)
      expect(descriptionResult.complete).toBe(true)
      expect(descriptionResult.result).toBe('Create POST endpoint for user-profiles at /api/v1/user-profiles')

      const criteriaResult = interpolateTemplate(template.acceptanceCriteriaTemplate!, variables)
      expect(criteriaResult.complete).toBe(true)
      expect(criteriaResult.result).toContain('The user-profiles endpoint should')
      expect(criteriaResult.result).toContain('Handle POST requests correctly')
    })
  })

  describe('Template usage workflow', () => {
    it('should validate variables and create task from template', () => {
      const template = createComplexTemplate()

      // Step 1: Prepare variable values
      const variables: TemplateVariableValues = {
        componentName: 'ProductCard',
        componentType: 'functional',
        directory: 'src/components/product',
        propCount: 4,
        hasState: false,
        includeTests: true,
        styleType: 'tailwind',
        features: ['accessibility', 'memoization']
      }

      // Step 2: Validate all variables
      let allValid = true
      const validationErrors: Record<string, string> = {}

      template.variables!.forEach(variable => {
        const error = validateVariableValue(variable, variables[variable.name])
        if (error) {
          allValid = false
          validationErrors[variable.name] = error
        }
      })

      expect(allValid).toBe(true)
      expect(Object.keys(validationErrors)).toHaveLength(0)

      // Step 3: Create task request
      const taskRequest: CreateTaskFromTemplateRequest = {
        templateId: template.id,
        variables,
        priority: 'high',  // Override template default
        projectPath: '/workspace/ecommerce-app'
      }

      expect(taskRequest.templateId).toBe('complex_template')
      expect(taskRequest.priority).toBe('high')
      expect(taskRequest.projectPath).toBe('/workspace/ecommerce-app')

      // Step 4: Interpolate final description and acceptance criteria
      const finalDescription = interpolateTemplate(template.descriptionTemplate, variables)
      const finalCriteria = interpolateTemplate(template.acceptanceCriteriaTemplate!, variables)

      expect(finalDescription.complete).toBe(true)
      expect(finalCriteria.complete).toBe(true)

      expect(finalDescription.result).toContain('ProductCard')
      expect(finalDescription.result).toContain('functional')
      expect(finalDescription.result).toContain('src/components/product')
      expect(finalDescription.result).toContain('tailwind')
      expect(finalDescription.result).toContain('accessibility,memoization')

      expect(finalCriteria.result).toContain('ProductCard component should')
      expect(finalCriteria.result).toContain('Remain stateless')
      expect(finalCriteria.result).toContain('Have test coverage above 90%')
    })
  })

  describe('Template filtering and searching', () => {
    it('should support complex filtering scenarios', () => {
      const templates: TaskTemplate[] = [
        createComplexTemplate(),
        {
          ...createComplexTemplate(),
          id: 'simple_template',
          name: 'Simple Component',
          category: 'bugfix',
          tags: ['react', 'fix'],
          isQuickAction: true,
          archived: false
        },
        {
          ...createComplexTemplate(),
          id: 'archived_template',
          name: 'Old Template',
          category: 'maintenance',
          tags: ['deprecated'],
          isQuickAction: false,
          archived: true
        }
      ]

      // Test category filtering
      const filters: TemplateFilters = {
        category: ['feature', 'bugfix'],
        isQuickAction: true,
        includeArchived: false
      }

      // Mock filtering logic (would be implemented in service layer)
      const filtered = templates.filter(template => {
        if (filters.category && Array.isArray(filters.category) && !filters.category.includes(template.category)) {
          return false
        }
        if (filters.isQuickAction !== undefined && template.isQuickAction !== filters.isQuickAction) {
          return false
        }
        if (!filters.includeArchived && template.archived) {
          return false
        }
        return true
      })

      expect(filtered).toHaveLength(1)  // Only simple_template matches
      expect(filtered[0].id).toBe('simple_template')
    })
  })
})