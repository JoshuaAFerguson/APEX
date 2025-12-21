import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApexApiClient, ApiError } from '../api-client';
import type {
  CreateTaskRequest,
  UpdateTaskStatusRequest,
  ApproveGateRequest,
  ApexConfig,
} from '@apex/core';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ApexApiClient', () => {
  let client: ApexApiClient;

  beforeEach(() => {
    client = new ApexApiClient('http://test-api.com');
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should use provided base URL', () => {
      const customClient = new ApexApiClient('http://custom.com');
      expect(customClient['baseUrl']).toBe('http://custom.com');
    });

    it('should use NEXT_PUBLIC_APEX_API_URL from env if no URL provided', () => {
      process.env.NEXT_PUBLIC_APEX_API_URL = 'http://env-url.com';
      const envClient = new ApexApiClient();
      expect(envClient['baseUrl']).toBe('http://env-url.com');
      delete process.env.NEXT_PUBLIC_APEX_API_URL;
    });

    it('should default to localhost:3000 if no URL provided', () => {
      delete process.env.NEXT_PUBLIC_APEX_API_URL;
      const defaultClient = new ApexApiClient();
      expect(defaultClient['baseUrl']).toBe('http://localhost:3000');
    });
  });

  describe('health', () => {
    it('should fetch health status', async () => {
      const mockResponse = { status: 'ok', version: '1.0.0' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.health();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/health',
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
          },
        })
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('createTask', () => {
    it('should create a new task', async () => {
      const request: CreateTaskRequest = {
        description: 'Test task',
        workflow: 'feature-development',
        autonomy: 'review-before-merge',
        priority: 'normal',
      };

      const mockResponse = {
        taskId: 'task_123_456',
        status: 'pending' as const,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.createTask(request);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/tasks',
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

  describe('getTask', () => {
    it('should get a task by ID', async () => {
      const mockTask = {
        id: 'task_123',
        description: 'Test task',
        status: 'in-progress' as const,
        workflow: 'test',
        autonomy: 'manual' as const,
        priority: 'normal' as const,
        projectPath: '/test',
        retryCount: 0,
        maxRetries: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
        usage: {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
          estimatedCost: 0.01,
        },
        logs: [],
        artifacts: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTask,
      });

      const result = await client.getTask('task_123');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/tasks/task_123',
        expect.any(Object)
      );
      expect(result).toEqual(mockTask);
    });
  });

  describe('listTasks', () => {
    it('should list all tasks without filters', async () => {
      const mockResponse = {
        tasks: [],
        total: 0,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.listTasks();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/tasks',
        expect.any(Object)
      );
      expect(result).toEqual(mockResponse);
    });

    it('should list tasks with filters', async () => {
      const mockResponse = {
        tasks: [],
        total: 0,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await client.listTasks({
        status: 'completed',
        workflow: 'feature-development',
        limit: 10,
        offset: 0,
      });

      // Note: offset=0 is skipped since 0 is falsy
      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/tasks?status=completed&workflow=feature-development&limit=10',
        expect.any(Object)
      );
    });

    it('should build URL with only provided filters', async () => {
      const mockResponse = { tasks: [], total: 0 };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await client.listTasks({ status: 'pending' });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/tasks?status=pending',
        expect.any(Object)
      );
    });
  });

  describe('updateTaskStatus', () => {
    it('should update task status', async () => {
      const request: UpdateTaskStatusRequest = {
        status: 'completed',
      };

      const mockTask = {
        id: 'task_123',
        status: 'completed' as const,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTask,
      });

      const result = await client.updateTaskStatus('task_123', request);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/tasks/task_123/status',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify(request),
        })
      );
      expect(result).toEqual(mockTask);
    });
  });

  describe('cancelTask', () => {
    it('should cancel a task', async () => {
      const mockTask = {
        id: 'task_123',
        status: 'cancelled' as const,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTask,
      });

      const result = await client.cancelTask('task_123');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/tasks/task_123/cancel',
        expect.objectContaining({
          method: 'POST',
        })
      );
      expect(result).toEqual(mockTask);
    });
  });

  describe('retryTask', () => {
    it('should retry a failed task', async () => {
      const mockTask = {
        id: 'task_123',
        status: 'pending' as const,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTask,
      });

      const result = await client.retryTask('task_123');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/tasks/task_123/retry',
        expect.objectContaining({
          method: 'POST',
        })
      );
      expect(result).toEqual(mockTask);
    });
  });

  describe('approveGate', () => {
    it('should approve a gate', async () => {
      const request: ApproveGateRequest = {
        approved: true,
        comment: 'Looks good',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await client.approveGate('task_123', 'code-review', request);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/tasks/task_123/gates/code-review/approve',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(request),
        })
      );
    });
  });

  describe('rejectGate', () => {
    it('should reject a gate', async () => {
      const request: ApproveGateRequest = {
        approved: false,
        comment: 'Need changes',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await client.rejectGate('task_123', 'code-review', request);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/tasks/task_123/gates/code-review/reject',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(request),
        })
      );
    });
  });

  describe('listAgents', () => {
    it('should list all agents', async () => {
      const mockAgents = [
        {
          name: 'planner',
          description: 'Task planning agent',
          prompt: 'You are a planner',
          model: 'opus' as const,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAgents,
      });

      const result = await client.listAgents();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/agents',
        expect.any(Object)
      );
      expect(result).toEqual(mockAgents);
    });
  });

  describe('getAgent', () => {
    it('should get an agent by name', async () => {
      const mockAgent = {
        name: 'developer',
        description: 'Code development agent',
        prompt: 'You are a developer',
        model: 'sonnet' as const,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAgent,
      });

      const result = await client.getAgent('developer');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/agents/developer',
        expect.any(Object)
      );
      expect(result).toEqual(mockAgent);
    });
  });

  describe('getConfig', () => {
    it('should get project configuration', async () => {
      const mockConfig: Partial<ApexConfig> = {
        version: '1.0',
        project: {
          name: 'test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockConfig,
      });

      const result = await client.getConfig();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/config',
        expect.any(Object)
      );
      expect(result).toEqual(mockConfig);
    });
  });

  describe('updateConfig', () => {
    it('should update project configuration', async () => {
      const configUpdate: Partial<ApexConfig> = {
        autonomy: {
          default: 'full',
        },
      };

      const mockResponse: Partial<ApexConfig> = {
        version: '1.0',
        autonomy: {
          default: 'full',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.updateConfig(configUpdate);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/config',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify(configUpdate),
        })
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('error handling', () => {
    it('should throw ApiError on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ message: 'Task not found' }),
      });

      await expect(client.getTask('invalid')).rejects.toThrow('Task not found');
    });

    it('should use error field from response if message is not available', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: 'Server error occurred' }),
      });

      await expect(client.health()).rejects.toThrow('Server error occurred');
    });

    it('should use default error message if response is not JSON', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => {
          throw new Error('Not JSON');
        },
      });

      await expect(client.health()).rejects.toThrow('API request failed: 500 Internal Server Error');
    });

    it('should throw ApiError with statusCode', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({ message: 'Access denied' }),
      });

      try {
        await client.health();
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(403);
        expect((error as ApiError).message).toBe('Access denied');
      }
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(client.health()).rejects.toThrow('Network error');
    });

    it('should handle unknown errors', async () => {
      mockFetch.mockRejectedValueOnce('unknown error type');

      try {
        await client.health();
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(0);
        expect((error as ApiError).message).toBe('Unknown error occurred');
      }
    });

    it('should rethrow ApiError instances', async () => {
      const apiError = new ApiError('Custom error', 400);
      mockFetch.mockRejectedValueOnce(apiError);

      try {
        await client.health();
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBe(apiError);
        expect((error as ApiError).statusCode).toBe(400);
      }
    });
  });

  describe('fetch wrapper', () => {
    it('should include Content-Type header by default', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'ok', version: '1.0.0' }),
      });

      await client.health();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should merge custom headers with default headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await client['fetch']('/test', {
        headers: {
          'X-Custom-Header': 'test-value',
        },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
            'X-Custom-Header': 'test-value',
          },
        })
      );
    });

    it('should construct full URL from base URL and path', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await client['fetch']('/test/path');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/test/path',
        expect.any(Object)
      );
    });
  });
});

describe('ApiError', () => {
  it('should create an error with message and status code', () => {
    const error = new ApiError('Test error', 404);

    expect(error.message).toBe('Test error');
    expect(error.statusCode).toBe(404);
    expect(error.name).toBe('ApiError');
  });

  it('should be instance of Error', () => {
    const error = new ApiError('Test error', 500);

    expect(error).toBeInstanceOf(Error);
  });

  it('should preserve error stack', () => {
    const error = new ApiError('Test error', 500);

    expect(error.stack).toBeDefined();
  });
});
