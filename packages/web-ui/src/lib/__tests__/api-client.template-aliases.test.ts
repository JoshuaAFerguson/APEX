import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApexApiClient, ApiError } from '../api-client';
import type {
  CreateTemplateRequest,
  UpdateTemplateRequest,
  TemplateFilters,
  TaskTemplate,
  TemplateListResponse,
  CreateTaskFromTemplateRequest,
} from '@/types/task-template';
import type { CreateTaskResponse } from '@apexcli/core';

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

describe('ApexApiClient - Template Alias Methods', () => {
  let client: ApexApiClient;

  const mockTemplate: TaskTemplate = {
    id: 'template_123',
    name: 'Test Template',
    description: 'A test template for unit tests',
    category: 'feature',
    workflow: 'feature-development',
    autonomy: 'review-before-commit',
    descriptionTemplate: 'Create {{feature}} feature',
    acceptanceCriteriaTemplate: '{{feature}} works correctly',
    variables: [
      {
        name: 'feature',
        label: 'Feature Name',
        type: 'string',
        required: true,
      },
    ],
    tags: ['test', 'feature'],
    isQuickAction: false,
    priority: 'normal',
    effort: 'medium',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  };

  beforeEach(() => {
    client = new ApexApiClient('http://test-api.com');
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createTaskTemplate (alias)', () => {
    it('should call createTemplate internally', async () => {
      const request: CreateTemplateRequest = {
        name: 'Test Template',
        description: 'A test template',
        category: 'feature',
        workflow: 'test-workflow',
        autonomy: 'review-before-commit',
        descriptionTemplate: 'Create {{feature}}',
        tags: ['test'],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTemplate,
      });

      const result = await client.createTaskTemplate(request);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/templates',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(request),
          headers: {
            'Content-Type': 'application/json',
          },
        })
      );
      expect(result).toEqual(mockTemplate);
    });

    it('should handle API errors properly', async () => {
      const request: CreateTemplateRequest = {
        name: 'Test Template',
        description: 'A test template',
        category: 'feature',
        workflow: 'test-workflow',
        autonomy: 'review-before-commit',
        descriptionTemplate: 'Create {{feature}}',
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ message: 'Invalid template data' }),
      });

      await expect(client.createTaskTemplate(request)).rejects.toThrow('Invalid template data');
    });

    it('should handle network errors', async () => {
      const request: CreateTemplateRequest = {
        name: 'Test Template',
        description: 'A test template',
        category: 'feature',
        workflow: 'test-workflow',
        autonomy: 'review-before-commit',
        descriptionTemplate: 'Create {{feature}}',
      };

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(client.createTaskTemplate(request)).rejects.toThrow('Network error');
    });
  });

  describe('listTaskTemplates (alias)', () => {
    it('should call getTemplates internally without filters', async () => {
      const mockResponse = {
        templates: [mockTemplate],
        count: 1,
      };

      const expectedResponse: TemplateListResponse = {
        templates: [mockTemplate],
        total: 1,
        page: 1,
        pageSize: 1,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.listTaskTemplates();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/templates',
        expect.any(Object)
      );
      expect(result).toEqual(expectedResponse);
    });

    it('should handle complex filters correctly', async () => {
      const filters: TemplateFilters = {
        category: ['feature', 'bugfix'],
        workflow: ['feature-development', 'hotfix'],
        tags: ['urgent', 'client'],
        isQuickAction: true,
        includeArchived: false,
        search: 'user auth',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ templates: [], count: 0 }),
      });

      await client.listTaskTemplates(filters);

      // Check that multiple category and workflow values are handled correctly
      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/templates?category=feature&category=bugfix&workflow=feature-development&workflow=hotfix&tags=urgent&tags=client&isQuickAction=true&includeArchived=false&search=user+auth',
        expect.any(Object)
      );
    });

    it('should handle empty response correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ templates: [], count: 0 }),
      });

      const result = await client.listTaskTemplates();

      expect(result).toEqual({
        templates: [],
        total: 0,
        page: 1,
        pageSize: 0,
      });
    });

    it('should handle legacy response format', async () => {
      // Some API versions might return just an array
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [mockTemplate],
      });

      const result = await client.listTaskTemplates();

      expect(result).toEqual({
        templates: [mockTemplate],
        total: 1,
        page: 1,
        pageSize: 1,
      });
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: 'Database connection failed' }),
      });

      await expect(client.listTaskTemplates()).rejects.toThrow('Database connection failed');
    });
  });

  describe('getTaskTemplate (alias)', () => {
    it('should call getTemplate internally', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTemplate,
      });

      const result = await client.getTaskTemplate('template_123');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/templates/template_123',
        expect.any(Object)
      );
      expect(result).toEqual(mockTemplate);
    });

    it('should handle template not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ message: 'Template not found' }),
      });

      await expect(client.getTaskTemplate('invalid_id')).rejects.toThrow('Template not found');
    });

    it('should handle malformed template ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ message: 'Invalid template ID format' }),
      });

      await expect(client.getTaskTemplate('invalid-format')).rejects.toThrow('Invalid template ID format');
    });
  });

  describe('updateTaskTemplate (alias)', () => {
    it('should call updateTemplate internally', async () => {
      const request: UpdateTemplateRequest = {
        id: 'template_123',
        name: 'Updated Template',
        description: 'An updated template',
        tags: ['updated', 'test'],
      };

      const updatedTemplate = { ...mockTemplate, ...request };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => updatedTemplate,
      });

      const result = await client.updateTaskTemplate(request);

      // Verify that id is extracted correctly and only update data is sent
      const { id, ...updateData } = request;
      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/templates/template_123',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(updateData),
          headers: {
            'Content-Type': 'application/json',
          },
        })
      );
      expect(result).toEqual(updatedTemplate);
    });

    it('should handle partial updates correctly', async () => {
      const request: UpdateTemplateRequest = {
        id: 'template_123',
        description: 'Only description updated',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...mockTemplate, description: request.description }),
      });

      await client.updateTaskTemplate(request);

      const { id, ...updateData } = request;
      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/templates/template_123',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(updateData),
        })
      );
    });

    it('should handle update conflicts', async () => {
      const request: UpdateTemplateRequest = {
        id: 'template_123',
        name: 'Conflicting Update',
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        statusText: 'Conflict',
        json: async () => ({ message: 'Template was modified by another user' }),
      });

      await expect(client.updateTaskTemplate(request)).rejects.toThrow('Template was modified by another user');
    });

    it('should handle validation errors', async () => {
      const request: UpdateTemplateRequest = {
        id: 'template_123',
        name: '', // Invalid empty name
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        statusText: 'Unprocessable Entity',
        json: async () => ({ message: 'Template name cannot be empty' }),
      });

      await expect(client.updateTaskTemplate(request)).rejects.toThrow('Template name cannot be empty');
    });
  });

  describe('deleteTaskTemplate (alias)', () => {
    it('should call deleteTemplate internally', async () => {
      const mockResponse = {
        ok: true,
        message: 'Template deleted successfully',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.deleteTaskTemplate('template_123');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/templates/template_123',
        expect.objectContaining({
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle template not found during deletion', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ message: 'Template not found' }),
      });

      await expect(client.deleteTaskTemplate('nonexistent_id')).rejects.toThrow('Template not found');
    });

    it('should handle permission denied', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({ message: 'Insufficient permissions to delete template' }),
      });

      await expect(client.deleteTaskTemplate('template_123')).rejects.toThrow('Insufficient permissions to delete template');
    });

    it('should handle template with active dependencies', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        statusText: 'Conflict',
        json: async () => ({ message: 'Cannot delete template: active tasks depend on it' }),
      });

      await expect(client.deleteTaskTemplate('template_123')).rejects.toThrow('Cannot delete template: active tasks depend on it');
    });
  });

  describe('createTaskFromTemplate', () => {
    const createTaskRequest: CreateTaskFromTemplateRequest = {
      templateId: 'template_123',
      variables: {
        feature: 'User Authentication',
      },
      priority: 'high',
      effort: 'large',
      autonomy: 'full-auto',
      projectPath: '/project',
    };

    const mockTaskResponse: CreateTaskResponse = {
      taskId: 'task_456_789',
      status: 'pending',
    };

    it('should fetch template and create task with interpolated values', async () => {
      // First call: get template
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTemplate,
      });

      // Second call: create task
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTaskResponse,
      });

      const result = await client.createTaskFromTemplate(createTaskRequest);

      // Verify template was fetched
      expect(mockFetch).toHaveBeenNthCalledWith(1,
        'http://test-api.com/templates/template_123',
        expect.any(Object)
      );

      // Verify task was created with interpolated values and overrides
      expect(mockFetch).toHaveBeenNthCalledWith(2,
        'http://test-api.com/tasks',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            description: 'Create User Authentication feature',
            acceptanceCriteria: 'User Authentication works correctly',
            workflow: 'feature-development',
            autonomy: 'full-auto', // Overridden from request
            priority: 'high', // Overridden from request
            effort: 'large', // Overridden from request
            projectPath: '/project',
          }),
        })
      );

      expect(result).toEqual(mockTaskResponse);
    });

    it('should handle template without acceptance criteria', async () => {
      const templateWithoutCriteria = {
        ...mockTemplate,
        acceptanceCriteriaTemplate: undefined,
      };

      // First call: get template
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => templateWithoutCriteria,
      });

      // Second call: create task
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTaskResponse,
      });

      await client.createTaskFromTemplate(createTaskRequest);

      expect(mockFetch).toHaveBeenNthCalledWith(2,
        'http://test-api.com/tasks',
        expect.objectContaining({
          body: JSON.stringify({
            description: 'Create User Authentication feature',
            acceptanceCriteria: undefined,
            workflow: 'feature-development',
            autonomy: 'full-auto',
            priority: 'high',
            effort: 'large',
            projectPath: '/project',
          }),
        })
      );
    });

    it('should use template defaults when no overrides provided', async () => {
      const minimalRequest: CreateTaskFromTemplateRequest = {
        templateId: 'template_123',
        variables: { feature: 'Basic Feature' },
      };

      // First call: get template
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTemplate,
      });

      // Second call: create task
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTaskResponse,
      });

      await client.createTaskFromTemplate(minimalRequest);

      expect(mockFetch).toHaveBeenNthCalledWith(2,
        'http://test-api.com/tasks',
        expect.objectContaining({
          body: JSON.stringify({
            description: 'Create Basic Feature feature',
            acceptanceCriteria: 'Basic Feature works correctly',
            workflow: 'feature-development',
            autonomy: 'review-before-commit', // From template
            priority: 'normal', // From template
            effort: 'medium', // From template
            projectPath: undefined,
          }),
        })
      );
    });

    it('should handle missing variables gracefully', async () => {
      const requestWithMissingVar: CreateTaskFromTemplateRequest = {
        templateId: 'template_123',
        variables: {}, // Missing 'feature' variable
      };

      // First call: get template
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTemplate,
      });

      // Second call: create task
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTaskResponse,
      });

      await client.createTaskFromTemplate(requestWithMissingVar);

      // Variables not found should be left as-is in the template
      expect(mockFetch).toHaveBeenNthCalledWith(2,
        'http://test-api.com/tasks',
        expect.objectContaining({
          body: JSON.stringify({
            description: 'Create {{feature}} feature',
            acceptanceCriteria: '{{feature}} works correctly',
            workflow: 'feature-development',
            autonomy: 'review-before-commit',
            priority: 'normal',
            effort: 'medium',
            projectPath: undefined,
          }),
        })
      );
    });

    it('should handle template not found error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ message: 'Template not found' }),
      });

      await expect(
        client.createTaskFromTemplate(createTaskRequest)
      ).rejects.toThrow('Template not found');
    });

    it('should handle task creation failure', async () => {
      // First call: get template (success)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTemplate,
      });

      // Second call: create task (failure)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ message: 'Invalid task data' }),
      });

      await expect(
        client.createTaskFromTemplate(createTaskRequest)
      ).rejects.toThrow('Invalid task data');
    });

    it('should handle template fetch network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

      await expect(
        client.createTaskFromTemplate(createTaskRequest)
      ).rejects.toThrow('Network timeout');
    });

    it('should handle complex variable interpolation', async () => {
      const complexTemplate: TaskTemplate = {
        ...mockTemplate,
        descriptionTemplate: 'Create {{componentName}} {{componentType}} with {{features}} in {{module}}',
        acceptanceCriteriaTemplate: '{{componentName}} should:\n- Support {{features}}\n- Be integrated with {{module}}',
        variables: [
          { name: 'componentName', label: 'Name', type: 'string', required: true },
          { name: 'componentType', label: 'Type', type: 'select', required: true },
          { name: 'features', label: 'Features', type: 'multiselect', required: false },
          { name: 'module', label: 'Module', type: 'string', required: true },
        ],
      };

      const complexRequest: CreateTaskFromTemplateRequest = {
        templateId: 'template_123',
        variables: {
          componentName: 'UserProfile',
          componentType: 'React Component',
          features: ['edit', 'validation', 'real-time updates'],
          module: 'user-management',
        },
      };

      // First call: get template
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => complexTemplate,
      });

      // Second call: create task
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTaskResponse,
      });

      await client.createTaskFromTemplate(complexRequest);

      expect(mockFetch).toHaveBeenNthCalledWith(2,
        'http://test-api.com/tasks',
        expect.objectContaining({
          body: JSON.stringify({
            description: 'Create UserProfile React Component with edit, validation, real-time updates in user-management',
            acceptanceCriteria: 'UserProfile should:\n- Support edit, validation, real-time updates\n- Be integrated with user-management',
            workflow: 'feature-development',
            autonomy: 'review-before-commit',
            priority: 'normal',
            effort: 'medium',
            projectPath: undefined,
          }),
        })
      );
    });
  });

  describe('Error handling across all alias methods', () => {
    it('should preserve ApiError instances', async () => {
      const originalError = new ApiError('Custom API error', 418);
      mockFetch.mockRejectedValueOnce(originalError);

      try {
        await client.createTaskTemplate({
          name: 'Test',
          description: 'Test',
          category: 'feature',
          workflow: 'test',
          autonomy: 'manual',
          descriptionTemplate: 'Test {{var}}',
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBe(originalError);
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(418);
      }
    });

    it('should handle non-JSON error responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        json: async () => {
          throw new Error('Not JSON');
        },
      });

      try {
        await client.listTaskTemplates();
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).message).toBe('API request failed: 503 Service Unavailable');
        expect((error as ApiError).statusCode).toBe(503);
      }
    });

    it('should handle unknown error types', async () => {
      mockFetch.mockRejectedValueOnce('Unknown error type');

      try {
        await client.getTaskTemplate('template_123');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).message).toBe('Unknown error occurred');
        expect((error as ApiError).statusCode).toBe(0);
      }
    });
  });

  describe('URL encoding and special characters', () => {
    it('should properly encode template IDs with special characters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTemplate,
      });

      await client.getTaskTemplate('template with spaces');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/templates/template with spaces',
        expect.any(Object)
      );
    });

    it('should handle URL encoding in filter parameters', async () => {
      const filters: TemplateFilters = {
        search: 'search term with spaces',
        workflow: 'workflow-with-dashes',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ templates: [], count: 0 }),
      });

      await client.listTaskTemplates(filters);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/templates?workflow=workflow-with-dashes&search=search+term+with+spaces',
        expect.any(Object)
      );
    });
  });
});