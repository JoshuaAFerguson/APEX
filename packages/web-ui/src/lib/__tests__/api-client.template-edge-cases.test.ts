import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApexApiClient, ApiError } from '../api-client';
import type {
  TaskTemplate,
  CreateTaskFromTemplateRequest,
  TemplateFilters,
  CreateTemplateRequest,
  UpdateTemplateRequest,
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

describe('ApexApiClient - Template Edge Cases and Error Handling', () => {
  let client: ApexApiClient;

  const mockTemplate: TaskTemplate = {
    id: 'template_123',
    name: 'Test Template',
    description: 'A test template',
    category: 'feature',
    workflow: 'feature-development',
    autonomy: 'review-before-commit',
    descriptionTemplate: 'Create {{feature}}',
    acceptanceCriteriaTemplate: '{{feature}} works correctly',
    tags: ['test'],
    isQuickAction: false,
    priority: 'normal',
    effort: 'medium',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    client = new ApexApiClient('http://test-api.com');
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Boundary condition testing', () => {
    it('should handle empty template ID', async () => {
      await expect(client.getTaskTemplate('')).rejects.toThrow();
    });

    it('should handle null/undefined template ID', async () => {
      // @ts-expect-error - Testing runtime behavior
      await expect(client.getTaskTemplate(null)).rejects.toThrow();

      // @ts-expect-error - Testing runtime behavior
      await expect(client.getTaskTemplate(undefined)).rejects.toThrow();
    });

    it('should handle extremely long template ID', async () => {
      const longId = 'a'.repeat(1000);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 414,
        statusText: 'URI Too Long',
        json: async () => ({ message: 'Template ID too long' }),
      });

      await expect(client.getTaskTemplate(longId)).rejects.toThrow('Template ID too long');
    });

    it('should handle special characters in template ID', async () => {
      const specialId = 'template-with-special-chars-!@#$%^&*()';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...mockTemplate, id: specialId }),
      });

      const result = await client.getTaskTemplate(specialId);

      expect(mockFetch).toHaveBeenCalledWith(
        `http://test-api.com/templates/${specialId}`,
        expect.any(Object)
      );
      expect(result.id).toBe(specialId);
    });

    it('should handle Unicode characters in template ID', async () => {
      const unicodeId = 'template-with-unicode-字符-🎯';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...mockTemplate, id: unicodeId }),
      });

      await client.getTaskTemplate(unicodeId);

      expect(mockFetch).toHaveBeenCalledWith(
        `http://test-api.com/templates/${unicodeId}`,
        expect.any(Object)
      );
    });
  });

  describe('Malformed data handling', () => {
    it('should handle malformed JSON response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new SyntaxError('Unexpected token');
        },
      });

      await expect(client.getTaskTemplate('template_123')).rejects.toThrow('Unexpected token');
    });

    it('should handle response with missing required fields', async () => {
      const incompleteTemplate = {
        id: 'template_123',
        // Missing required fields like name, description, etc.
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => incompleteTemplate,
      });

      // Should still return the response even if incomplete
      const result = await client.getTaskTemplate('template_123');
      expect(result).toEqual(incompleteTemplate);
    });

    it('should handle response with extra/unknown fields', async () => {
      const templateWithExtras = {
        ...mockTemplate,
        unknownField: 'unknown value',
        anotherExtra: { nested: 'object' },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => templateWithExtras,
      });

      const result = await client.getTaskTemplate('template_123');
      expect(result).toEqual(templateWithExtras);
    });

    it('should handle null response body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => null,
      });

      const result = await client.getTaskTemplate('template_123');
      expect(result).toBeNull();
    });
  });

  describe('Network and timeout scenarios', () => {
    it('should handle connection timeout', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Request timeout'));

      await expect(client.listTaskTemplates()).rejects.toThrow('Request timeout');
    });

    it('should handle DNS resolution failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('getaddrinfo ENOTFOUND'));

      await expect(client.createTaskTemplate({
        name: 'Test',
        description: 'Test',
        category: 'feature',
        workflow: 'test',
        autonomy: 'manual',
        descriptionTemplate: 'Test',
      })).rejects.toThrow('getaddrinfo ENOTFOUND');
    });

    it('should handle connection refused', async () => {
      mockFetch.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));

      await expect(client.deleteTaskTemplate('template_123')).rejects.toThrow('connect ECONNREFUSED');
    });

    it('should handle SSL certificate errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('CERT_UNTRUSTED'));

      await expect(client.updateTaskTemplate({
        id: 'template_123',
        name: 'Updated',
      })).rejects.toThrow('CERT_UNTRUSTED');
    });
  });

  describe('HTTP status edge cases', () => {
    it('should handle 429 Too Many Requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: async () => ({ message: 'Rate limit exceeded. Try again in 60 seconds.' }),
      });

      await expect(client.listTaskTemplates()).rejects.toThrow('Rate limit exceeded. Try again in 60 seconds.');
    });

    it('should handle 502 Bad Gateway', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        json: async () => {
          throw new Error('HTML response instead of JSON');
        },
      });

      await expect(client.getTaskTemplate('template_123')).rejects.toThrow('API request failed: 502 Bad Gateway');
    });

    it('should handle 204 No Content correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: async () => {
          throw new Error('No content to parse');
        },
      });

      // Should handle empty response gracefully
      await expect(client.getTaskTemplate('template_123')).rejects.toThrow('No content to parse');
    });

    it('should handle unexpected 2xx status codes', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 202,
        statusText: 'Accepted',
        json: async () => ({ message: 'Request accepted for processing' }),
      });

      const result = await client.createTaskTemplate({
        name: 'Test',
        description: 'Test',
        category: 'feature',
        workflow: 'test',
        autonomy: 'manual',
        descriptionTemplate: 'Test',
      });

      expect(result).toEqual({ message: 'Request accepted for processing' });
    });
  });

  describe('Filter parameter edge cases', () => {
    it('should handle empty arrays in filters', async () => {
      const filters: TemplateFilters = {
        category: [],
        tags: [],
        workflow: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ templates: [], count: 0 }),
      });

      await client.listTaskTemplates(filters);

      // Empty arrays should not add query parameters
      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/templates',
        expect.any(Object)
      );
    });

    it('should handle null/undefined filter values', async () => {
      const filters: TemplateFilters = {
        // @ts-expect-error - Testing runtime behavior
        category: null,
        // @ts-expect-error - Testing runtime behavior
        search: undefined,
        isQuickAction: false,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ templates: [], count: 0 }),
      });

      await client.listTaskTemplates(filters);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/templates?isQuickAction=false',
        expect.any(Object)
      );
    });

    it('should handle special characters in search query', async () => {
      const filters: TemplateFilters = {
        search: 'search with spaces & special chars!@#$%',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ templates: [], count: 0 }),
      });

      await client.listTaskTemplates(filters);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/templates?search=search+with+spaces+%26+special+chars%21%40%23%24%25',
        expect.any(Object)
      );
    });

    it('should handle very long filter values', async () => {
      const longSearch = 'a'.repeat(5000);
      const filters: TemplateFilters = {
        search: longSearch,
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 414,
        statusText: 'URI Too Long',
        json: async () => ({ message: 'Query string too long' }),
      });

      await expect(client.listTaskTemplates(filters)).rejects.toThrow('Query string too long');
    });
  });

  describe('Variable interpolation edge cases', () => {
    it('should handle circular variable references', async () => {
      const templateWithCircularRefs: TaskTemplate = {
        ...mockTemplate,
        descriptionTemplate: 'Create {{var1}} with {{var2}}',
        acceptanceCriteriaTemplate: '{{var2}} should work with {{var1}}',
      };

      const request: CreateTaskFromTemplateRequest = {
        templateId: 'template_123',
        variables: {
          var1: '{{var2}}',
          var2: '{{var1}}',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => templateWithCircularRefs,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ taskId: 'task_123', status: 'pending' }),
      });

      await client.createTaskFromTemplate(request);

      // Should interpolate once, leaving circular references
      expect(mockFetch).toHaveBeenNthCalledWith(2,
        'http://test-api.com/tasks',
        expect.objectContaining({
          body: expect.stringContaining('"description":"Create {{var2}} with {{var1}}"'),
        })
      );
    });

    it('should handle malformed variable syntax', async () => {
      const templateWithMalformedVars: TaskTemplate = {
        ...mockTemplate,
        descriptionTemplate: 'Create {{{var1}} and {{var2} and {var3} and {{}}',
      };

      const request: CreateTaskFromTemplateRequest = {
        templateId: 'template_123',
        variables: {
          var1: 'value1',
          var2: 'value2',
          var3: 'value3',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => templateWithMalformedVars,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ taskId: 'task_123', status: 'pending' }),
      });

      await client.createTaskFromTemplate(request);

      // Only properly formatted {{var}} should be replaced
      expect(mockFetch).toHaveBeenNthCalledWith(2,
        'http://test-api.com/tasks',
        expect.objectContaining({
          body: expect.stringContaining('"description":"Create {value1 and {{var2} and {var3} and {{}}"'),
        })
      );
    });

    it('should handle variables with special characters', async () => {
      const request: CreateTaskFromTemplateRequest = {
        templateId: 'template_123',
        variables: {
          feature: 'Feature with special chars: <>&"\'',
          description: 'Multi\nline\tdescription',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTemplate,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ taskId: 'task_123', status: 'pending' }),
      });

      await client.createTaskFromTemplate(request);

      // Special characters should be preserved in JSON
      expect(mockFetch).toHaveBeenNthCalledWith(2,
        'http://test-api.com/tasks',
        expect.objectContaining({
          body: expect.stringContaining('"description":"Create Feature with special chars: <>&\\"\'"'),
        })
      );
    });

    it('should handle very large variable values', async () => {
      const largeValue = 'x'.repeat(10000);
      const request: CreateTaskFromTemplateRequest = {
        templateId: 'template_123',
        variables: {
          feature: largeValue,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTemplate,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ taskId: 'task_123', status: 'pending' }),
      });

      const result = await client.createTaskFromTemplate(request);

      expect(result.taskId).toBe('task_123');
      // Should handle large values without issues
      expect(mockFetch).toHaveBeenNthCalledWith(2,
        'http://test-api.com/tasks',
        expect.objectContaining({
          body: expect.stringContaining(`"description":"Create ${largeValue}"`),
        })
      );
    });
  });

  describe('Concurrent access and race conditions', () => {
    it('should handle template being deleted while creating task from it', async () => {
      const request: CreateTaskFromTemplateRequest = {
        templateId: 'template_123',
        variables: { feature: 'Test' },
      };

      // Template fetch succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTemplate,
      });

      // Task creation fails because template was deleted
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ message: 'Referenced template no longer exists' }),
      });

      await expect(client.createTaskFromTemplate(request)).rejects.toThrow('Referenced template no longer exists');
    });

    it('should handle template being updated while accessing it', async () => {
      // First call returns old version
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTemplate,
      });

      // Second call to same template returns updated version
      const updatedTemplate = { ...mockTemplate, name: 'Updated Template' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => updatedTemplate,
      });

      const result1 = await client.getTaskTemplate('template_123');
      const result2 = await client.getTaskTemplate('template_123');

      expect(result1.name).toBe('Test Template');
      expect(result2.name).toBe('Updated Template');
    });
  });

  describe('Memory and performance edge cases', () => {
    it('should handle response with very large template list', async () => {
      const largeTemplateList = Array.from({ length: 10000 }, (_, i) => ({
        ...mockTemplate,
        id: `template_${i}`,
        name: `Template ${i}`,
      }));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          templates: largeTemplateList,
          count: largeTemplateList.length,
        }),
      });

      const result = await client.listTaskTemplates();

      expect(result.templates).toHaveLength(10000);
      expect(result.total).toBe(10000);
    });

    it('should handle response streaming for large templates', async () => {
      const templateWithLargeContent: TaskTemplate = {
        ...mockTemplate,
        descriptionTemplate: 'x'.repeat(100000),
        acceptanceCriteriaTemplate: 'y'.repeat(100000),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => templateWithLargeContent,
      });

      const result = await client.getTaskTemplate('template_123');

      expect(result.descriptionTemplate).toHaveLength(100000);
      expect(result.acceptanceCriteriaTemplate).toHaveLength(100000);
    });
  });

  describe('Security and validation edge cases', () => {
    it('should handle XSS attempts in template content', async () => {
      const maliciousTemplate: TaskTemplate = {
        ...mockTemplate,
        name: '<script>alert("xss")</script>',
        description: 'javascript:alert("xss")',
        descriptionTemplate: 'Create {{<script>alert("xss")</script>}}',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => maliciousTemplate,
      });

      const result = await client.getTaskTemplate('template_123');

      // Should return the content as-is (XSS protection should be at UI layer)
      expect(result.name).toBe('<script>alert("xss")</script>');
      expect(result.description).toBe('javascript:alert("xss")');
    });

    it('should handle SQL injection attempts in filter parameters', async () => {
      const filters: TemplateFilters = {
        search: "'; DROP TABLE templates; --",
        category: "feature'; DELETE FROM templates; --" as any,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ templates: [], count: 0 }),
      });

      await client.listTaskTemplates(filters);

      // Should URL encode the malicious content
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('search=%27%3B+DROP+TABLE+templates%3B+--'),
        expect.any(Object)
      );
    });

    it('should handle extremely nested object responses', async () => {
      const createNestedObject = (depth: number): any => {
        if (depth === 0) return { value: 'deep' };
        return { nested: createNestedObject(depth - 1) };
      };

      const templateWithDeepNesting = {
        ...mockTemplate,
        metadata: createNestedObject(100),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => templateWithDeepNesting,
      });

      const result = await client.getTaskTemplate('template_123');

      // Should handle deep nesting without stack overflow
      expect(result.metadata).toBeDefined();
    });
  });
});