import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApexApiClient } from '../api-client';
import type {
  CreateTemplateRequest,
  UpdateTemplateRequest,
  TemplateFilters,
  TaskTemplate,
  TemplateListResponse,
} from '@/types/task-template';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ApexApiClient - Template Methods', () => {
  let client: ApexApiClient;

  beforeEach(() => {
    client = new ApexApiClient('http://test-api.com');
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createTaskTemplate (alias for createTemplate)', () => {
    it('should create a new task template', async () => {
      const request: CreateTemplateRequest = {
        name: 'Test Template',
        description: 'A test template',
        category: 'feature',
        workflow: 'test-workflow',
        autonomy: 'review-before-commit',
        descriptionTemplate: 'Create {{feature}}',
        tags: ['test'],
      };

      const mockResponse: TaskTemplate = {
        id: 'template_123',
        name: 'Test Template',
        description: 'A test template',
        category: 'feature',
        workflow: 'test-workflow',
        autonomy: 'review-before-commit',
        descriptionTemplate: 'Create {{feature}}',
        tags: ['test'],
        isQuickAction: false,
        priority: 'normal',
        effort: 'medium',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
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
      expect(result).toEqual(mockResponse);
    });
  });

  describe('listTaskTemplates (alias for getTemplates)', () => {
    it('should list task templates without filters', async () => {
      const mockResponse: TemplateListResponse = {
        templates: [],
        total: 0,
        page: 1,
        pageSize: 0,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ templates: [], count: 0, length: 0 }),
      });

      const result = await client.listTaskTemplates();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/templates',
        expect.any(Object)
      );
      expect(result).toEqual(mockResponse);
    });

    it('should list task templates with filters', async () => {
      const filters: TemplateFilters = {
        category: 'feature',
        isQuickAction: true,
      };

      const mockResponse = {
        templates: [],
        count: 0,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await client.listTaskTemplates(filters);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/templates?category=feature&isQuickAction=true',
        expect.any(Object)
      );
    });
  });

  describe('getTaskTemplate (alias for getTemplate)', () => {
    it('should get a task template by ID', async () => {
      const mockTemplate: TaskTemplate = {
        id: 'template_123',
        name: 'Test Template',
        description: 'A test template',
        category: 'feature',
        workflow: 'test-workflow',
        autonomy: 'review-before-commit',
        descriptionTemplate: 'Create {{feature}}',
        tags: ['test'],
        isQuickAction: false,
        priority: 'normal',
        effort: 'medium',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

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
  });

  describe('updateTaskTemplate (alias for updateTemplate)', () => {
    it('should update an existing task template', async () => {
      const request: UpdateTemplateRequest = {
        id: 'template_123',
        name: 'Updated Template',
        description: 'An updated template',
      };

      const mockResponse: TaskTemplate = {
        id: 'template_123',
        name: 'Updated Template',
        description: 'An updated template',
        category: 'feature',
        workflow: 'test-workflow',
        autonomy: 'review-before-commit',
        descriptionTemplate: 'Create {{feature}}',
        tags: ['test'],
        isQuickAction: false,
        priority: 'normal',
        effort: 'medium',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.updateTaskTemplate(request);

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
      expect(result).toEqual(mockResponse);
    });
  });

  describe('deleteTaskTemplate (alias for deleteTemplate)', () => {
    it('should delete a task template', async () => {
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
  });

  describe('createTaskFromTemplate', () => {
    it('should create a task from template', async () => {
      const templateMock: TaskTemplate = {
        id: 'template_123',
        name: 'Feature Template',
        description: 'Create new features',
        category: 'feature',
        workflow: 'feature-development',
        autonomy: 'review-before-commit',
        descriptionTemplate: 'Create {{featureName}} feature',
        acceptanceCriteriaTemplate: '- {{featureName}} works correctly',
        tags: ['feature'],
        isQuickAction: false,
        priority: 'normal',
        effort: 'medium',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const request = {
        templateId: 'template_123',
        variables: {
          featureName: 'User Authentication',
        },
        priority: 'high' as const,
      };

      const mockTaskResponse = {
        taskId: 'task_123_456',
        status: 'pending' as const,
      };

      // First call: get template
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => templateMock,
      });

      // Second call: create task
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTaskResponse,
      });

      const result = await client.createTaskFromTemplate(request);

      // Verify template was fetched
      expect(mockFetch).toHaveBeenNthCalledWith(1,
        'http://test-api.com/templates/template_123',
        expect.any(Object)
      );

      // Verify task was created with interpolated values
      expect(mockFetch).toHaveBeenNthCalledWith(2,
        'http://test-api.com/tasks',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            description: 'Create User Authentication feature',
            acceptanceCriteria: '- User Authentication works correctly',
            workflow: 'feature-development',
            autonomy: 'review-before-commit',
            priority: 'high',
            effort: 'medium',
            projectPath: undefined,
          }),
        })
      );

      expect(result).toEqual(mockTaskResponse);
    });
  });
});