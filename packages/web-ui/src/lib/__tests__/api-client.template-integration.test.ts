import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApexApiClient, ApiError } from '../api-client';
import type {
  TaskTemplate,
  CreateTaskFromTemplateRequest,
  TemplateVariable,
  TemplateFilters,
} from '@/types/task-template';
import type { CreateTaskResponse, Task } from '@apexcli/core';

// Mock the dynamic import in the API client
vi.mock('@/types/task-template', async () => {
  const actual = await vi.importActual('@/types/task-template');
  return {
    ...actual,
    interpolateTemplateString: (template: string, values: Record<string, any>) => {
      if (typeof template !== 'string') return template;
      return template.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
        const value = values[varName];
        if (value === undefined) return match;
        if (Array.isArray(value)) return value.join(', ');
        return String(value);
      });
    },
  };
});

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ApexApiClient - Template Integration Tests', () => {
  let client: ApexApiClient;

  // Real-world template examples
  const featureTemplate: TaskTemplate = {
    id: 'feature_react_component',
    name: 'React Component Feature',
    description: 'Create a new React component with full functionality',
    category: 'feature',
    workflow: 'feature-development',
    autonomy: 'review-before-commit',
    descriptionTemplate: 'Create a {{componentType}} component named {{componentName}} in the {{module}} module',
    acceptanceCriteriaTemplate: `- {{componentName}} component renders correctly
- Component accepts the following props: {{props}}
- Component follows accessibility best practices
- Unit tests are written with {{testCoverage}}% coverage
- Component is documented in Storybook`,
    variables: [
      {
        name: 'componentName',
        label: 'Component Name',
        type: 'string',
        required: true,
        placeholder: 'e.g., UserProfile',
        validationPattern: '^[A-Z][a-zA-Z0-9]*$',
        validationMessage: 'Must be PascalCase',
        minLength: 3,
        maxLength: 50,
      },
      {
        name: 'componentType',
        label: 'Component Type',
        type: 'select',
        required: true,
        options: [
          { label: 'Functional Component', value: 'functional', description: 'Modern React functional component with hooks' },
          { label: 'Form Component', value: 'form', description: 'Component with form handling' },
          { label: 'Display Component', value: 'display', description: 'Pure display component' },
        ],
        defaultValue: 'functional',
      },
      {
        name: 'module',
        label: 'Module',
        type: 'select',
        required: true,
        options: [
          { label: 'User Management', value: 'user-management' },
          { label: 'Authentication', value: 'auth' },
          { label: 'Dashboard', value: 'dashboard' },
          { label: 'Settings', value: 'settings' },
        ],
      },
      {
        name: 'props',
        label: 'Component Props',
        type: 'multiselect',
        required: false,
        options: [
          { label: 'className', value: 'className' },
          { label: 'children', value: 'children' },
          { label: 'onClick', value: 'onClick' },
          { label: 'disabled', value: 'disabled' },
          { label: 'variant', value: 'variant' },
        ],
        defaultValue: ['className', 'children'],
      },
      {
        name: 'testCoverage',
        label: 'Test Coverage (%)',
        type: 'number',
        required: false,
        min: 80,
        max: 100,
        defaultValue: 90,
      },
    ],
    tags: ['react', 'frontend', 'component'],
    isQuickAction: true,
    priority: 'normal',
    effort: 'medium',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    icon: 'component',
    color: 'blue',
    usageCount: 25,
  };

  const bugfixTemplate: TaskTemplate = {
    id: 'bugfix_standard',
    name: 'Standard Bug Fix',
    description: 'Template for fixing bugs with proper investigation and testing',
    category: 'bugfix',
    workflow: 'hotfix',
    autonomy: 'review-before-commit',
    descriptionTemplate: 'Fix: {{bugTitle}} - {{bugDescription}}',
    acceptanceCriteriaTemplate: `- Root cause identified and documented
- Bug is reproducibly fixed
- No regression in related functionality
- {{testType}} tests updated/added
- Fix is verified in {{environment}} environment`,
    variables: [
      {
        name: 'bugTitle',
        label: 'Bug Title',
        type: 'string',
        required: true,
        placeholder: 'Brief description of the bug',
        maxLength: 100,
      },
      {
        name: 'bugDescription',
        label: 'Bug Description',
        type: 'text',
        required: true,
        placeholder: 'Detailed description of the bug and its impact',
        maxLength: 500,
      },
      {
        name: 'testType',
        label: 'Test Type',
        type: 'select',
        required: true,
        options: [
          { label: 'Unit Tests', value: 'unit' },
          { label: 'Integration Tests', value: 'integration' },
          { label: 'End-to-End Tests', value: 'e2e' },
          { label: 'Manual Testing', value: 'manual' },
        ],
        defaultValue: 'unit',
      },
      {
        name: 'environment',
        label: 'Test Environment',
        type: 'multiselect',
        required: true,
        options: [
          { label: 'Development', value: 'dev' },
          { label: 'Staging', value: 'staging' },
          { label: 'Production', value: 'prod' },
        ],
        defaultValue: ['dev', 'staging'],
      },
    ],
    tags: ['bugfix', 'urgent'],
    isQuickAction: true,
    priority: 'high',
    effort: 'small',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  };

  const quickActionTemplate: TaskTemplate = {
    id: 'qa_code_review',
    name: 'Code Review',
    description: 'Quick action for requesting code reviews',
    category: 'maintenance',
    workflow: 'review',
    autonomy: 'manual',
    descriptionTemplate: 'Code review for {{prTitle}} ({{prNumber}})',
    acceptanceCriteriaTemplate: undefined, // No acceptance criteria for quick actions
    variables: [
      {
        name: 'prTitle',
        label: 'PR Title',
        type: 'string',
        required: true,
      },
      {
        name: 'prNumber',
        label: 'PR Number',
        type: 'number',
        required: true,
        min: 1,
      },
    ],
    tags: ['review', 'quick'],
    isQuickAction: true,
    priority: 'normal',
    effort: 'small',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  };

  beforeEach(() => {
    client = new ApexApiClient('http://test-api.com');
    mockFetch.mockClear();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('End-to-end template workflow', () => {
    it('should create feature task with complex variable interpolation', async () => {
      const request: CreateTaskFromTemplateRequest = {
        templateId: 'feature_react_component',
        variables: {
          componentName: 'UserProfileCard',
          componentType: 'functional',
          module: 'user-management',
          props: ['className', 'children', 'onClick', 'variant'],
          testCoverage: 95,
        },
        priority: 'high',
        projectPath: '/src/components',
      };

      const expectedTaskResponse: CreateTaskResponse = {
        taskId: 'task_user_profile_card_123',
        status: 'pending',
      };

      // Mock template fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => featureTemplate,
      });

      // Mock task creation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => expectedTaskResponse,
      });

      const result = await client.createTaskFromTemplate(request);

      // Verify template was fetched
      expect(mockFetch).toHaveBeenNthCalledWith(1,
        'http://test-api.com/templates/feature_react_component',
        expect.any(Object)
      );

      // Verify task creation with fully interpolated values
      expect(mockFetch).toHaveBeenNthCalledWith(2,
        'http://test-api.com/tasks',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            description: 'Create a functional component named UserProfileCard in the user-management module',
            acceptanceCriteria: `- UserProfileCard component renders correctly
- Component accepts the following props: className, children, onClick, variant
- Component follows accessibility best practices
- Unit tests are written with 95% coverage
- Component is documented in Storybook`,
            workflow: 'feature-development',
            autonomy: 'review-before-commit',
            priority: 'high', // Overridden
            effort: 'medium', // From template
            projectPath: '/src/components',
          }),
        })
      );

      expect(result).toEqual(expectedTaskResponse);
    });

    it('should handle bugfix workflow with validation', async () => {
      const request: CreateTaskFromTemplateRequest = {
        templateId: 'bugfix_standard',
        variables: {
          bugTitle: 'Login form validation fails',
          bugDescription: 'Email validation allows invalid email formats, causing backend errors',
          testType: 'integration',
          environment: ['dev', 'staging', 'prod'],
        },
        autonomy: 'full-auto',
      };

      const expectedTaskResponse: CreateTaskResponse = {
        taskId: 'task_login_bugfix_456',
        status: 'pending',
      };

      // Mock template fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => bugfixTemplate,
      });

      // Mock task creation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => expectedTaskResponse,
      });

      const result = await client.createTaskFromTemplate(request);

      expect(mockFetch).toHaveBeenNthCalledWith(2,
        'http://test-api.com/tasks',
        expect.objectContaining({
          body: JSON.stringify({
            description: 'Fix: Login form validation fails - Email validation allows invalid email formats, causing backend errors',
            acceptanceCriteria: `- Root cause identified and documented
- Bug is reproducibly fixed
- No regression in related functionality
- integration tests updated/added
- Fix is verified in dev, staging, prod environment`,
            workflow: 'hotfix',
            autonomy: 'full-auto', // Overridden
            priority: 'high', // From template
            effort: 'small', // From template
            projectPath: undefined,
          }),
        })
      );

      expect(result).toEqual(expectedTaskResponse);
    });

    it('should handle quick action template without acceptance criteria', async () => {
      const request: CreateTaskFromTemplateRequest = {
        templateId: 'qa_code_review',
        variables: {
          prTitle: 'Add user authentication system',
          prNumber: 142,
        },
      };

      const expectedTaskResponse: CreateTaskResponse = {
        taskId: 'task_code_review_789',
        status: 'pending',
      };

      // Mock template fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => quickActionTemplate,
      });

      // Mock task creation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => expectedTaskResponse,
      });

      const result = await client.createTaskFromTemplate(request);

      expect(mockFetch).toHaveBeenNthCalledWith(2,
        'http://test-api.com/tasks',
        expect.objectContaining({
          body: JSON.stringify({
            description: 'Code review for Add user authentication system (142)',
            acceptanceCriteria: undefined,
            workflow: 'review',
            autonomy: 'manual',
            priority: 'normal',
            effort: 'small',
            projectPath: undefined,
          }),
        })
      );

      expect(result).toEqual(expectedTaskResponse);
    });
  });

  describe('Template filtering and discovery', () => {
    it('should filter templates by multiple criteria', async () => {
      const filters: TemplateFilters = {
        category: ['feature', 'bugfix'],
        isQuickAction: true,
        tags: ['react', 'frontend'],
        search: 'component',
      };

      const mockResponse = {
        templates: [featureTemplate],
        count: 1,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.listTaskTemplates(filters);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/templates?category=feature&category=bugfix&tags=react&tags=frontend&isQuickAction=true&search=component',
        expect.any(Object)
      );

      expect(result).toEqual({
        templates: [featureTemplate],
        total: 1,
        page: 1,
        pageSize: 1,
      });
    });

    it('should get quick action templates only', async () => {
      const mockResponse = {
        templates: [quickActionTemplate],
        count: 1,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.getQuickActionTemplates();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/templates?isQuickAction=true',
        expect.any(Object)
      );

      expect(result).toEqual([quickActionTemplate]);
    });
  });

  describe('Error scenarios and resilience', () => {
    it('should handle template interpolation with missing required variables', async () => {
      const request: CreateTaskFromTemplateRequest = {
        templateId: 'feature_react_component',
        variables: {
          // Missing required 'componentName' and 'componentType'
          module: 'user-management',
        },
      };

      const expectedTaskResponse: CreateTaskResponse = {
        taskId: 'task_incomplete_123',
        status: 'pending',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => featureTemplate,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => expectedTaskResponse,
      });

      const result = await client.createTaskFromTemplate(request);

      // Should create task with unreplaced placeholders
      expect(mockFetch).toHaveBeenNthCalledWith(2,
        'http://test-api.com/tasks',
        expect.objectContaining({
          body: JSON.stringify({
            description: 'Create a {{componentType}} component named {{componentName}} in the user-management module',
            acceptanceCriteria: `- {{componentName}} component renders correctly
- Component accepts the following props: {{props}}
- Component follows accessibility best practices
- Unit tests are written with {{testCoverage}}% coverage
- Component is documented in Storybook`,
            workflow: 'feature-development',
            autonomy: 'review-before-commit',
            priority: 'normal',
            effort: 'medium',
            projectPath: undefined,
          }),
        })
      );

      expect(result).toEqual(expectedTaskResponse);
    });

    it('should handle template service unavailable during peak usage', async () => {
      const request: CreateTaskFromTemplateRequest = {
        templateId: 'feature_react_component',
        variables: { componentName: 'Test', componentType: 'functional', module: 'test' },
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        json: async () => ({ message: 'Template service temporarily unavailable' }),
      });

      await expect(client.createTaskFromTemplate(request)).rejects.toThrow('Template service temporarily unavailable');
    });

    it('should handle task creation service failure after successful template fetch', async () => {
      const request: CreateTaskFromTemplateRequest = {
        templateId: 'feature_react_component',
        variables: { componentName: 'Test', componentType: 'functional', module: 'test' },
      };

      // Template fetch succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => featureTemplate,
      });

      // Task creation fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ message: 'Task creation service unavailable' }),
      });

      await expect(client.createTaskFromTemplate(request)).rejects.toThrow('Task creation service unavailable');
    });

    it('should handle multiple sequential template operations', async () => {
      const request: CreateTaskFromTemplateRequest = {
        templateId: 'feature_react_component',
        variables: { componentName: 'SequentialTest', componentType: 'functional', module: 'test' },
      };

      // First operation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...featureTemplate }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ taskId: 'task_seq_1', status: 'pending' }),
      });

      const result1 = await client.createTaskFromTemplate(request);
      expect(result1.taskId).toBe('task_seq_1');

      // Second operation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...featureTemplate }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ taskId: 'task_seq_2', status: 'pending' }),
      });

      const result2 = await client.createTaskFromTemplate(request);
      expect(result2.taskId).toBe('task_seq_2');

      // Should have made 4 calls total (2 template fetches + 2 task creations)
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });
  });

  describe('Performance and optimization scenarios', () => {
    it('should handle large template with many variables efficiently', async () => {
      const largeTemplate: TaskTemplate = {
        ...featureTemplate,
        id: 'large_template',
        variables: Array.from({ length: 20 }, (_, i) => ({
          name: `var${i}`,
          label: `Variable ${i}`,
          type: 'string' as const,
          required: i < 5, // First 5 are required
          defaultValue: i >= 5 ? `default${i}` : undefined,
        })),
        descriptionTemplate: Array.from({ length: 20 }, (_, i) => `{{var${i}}}`).join(' '),
      };

      const variables = Object.fromEntries(
        Array.from({ length: 20 }, (_, i) => [`var${i}`, `value${i}`])
      );

      const request: CreateTaskFromTemplateRequest = {
        templateId: 'large_template',
        variables,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => largeTemplate,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ taskId: 'task_large_123', status: 'pending' }),
      });

      const result = await client.createTaskFromTemplate(request);

      expect(result.taskId).toBe('task_large_123');

      // Verify interpolation worked correctly
      const expectedDescription = Array.from({ length: 20 }, (_, i) => `value${i}`).join(' ');
      expect(mockFetch).toHaveBeenNthCalledWith(2,
        'http://test-api.com/tasks',
        expect.objectContaining({
          body: expect.stringContaining(`"description":"${expectedDescription}"`),
        })
      );
    });

    it('should handle template with nested variable references', async () => {
      const nestedTemplate: TaskTemplate = {
        ...featureTemplate,
        id: 'nested_template',
        descriptionTemplate: 'Create {{componentType}} called {{componentName}} in {{module}} with {{{{featureType}}_config}} settings',
        variables: [
          { name: 'componentType', label: 'Type', type: 'string', required: true },
          { name: 'componentName', label: 'Name', type: 'string', required: true },
          { name: 'module', label: 'Module', type: 'string', required: true },
          { name: 'featureType', label: 'Feature Type', type: 'string', required: true },
          { name: 'advanced_config', label: 'Advanced Config', type: 'string', required: false },
          { name: 'basic_config', label: 'Basic Config', type: 'string', required: false },
        ],
      };

      const request: CreateTaskFromTemplateRequest = {
        templateId: 'nested_template',
        variables: {
          componentType: 'React Component',
          componentName: 'NestedTest',
          module: 'test-module',
          featureType: 'advanced',
          advanced_config: 'full configuration',
          basic_config: 'simple config',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => nestedTemplate,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ taskId: 'task_nested_123', status: 'pending' }),
      });

      await client.createTaskFromTemplate(request);

      // The double braces should be partially interpolated
      expect(mockFetch).toHaveBeenNthCalledWith(2,
        'http://test-api.com/tasks',
        expect.objectContaining({
          body: expect.stringContaining('"description":"Create React Component called NestedTest in test-module with {{advanced_config}} settings"'),
        })
      );
    });
  });
});