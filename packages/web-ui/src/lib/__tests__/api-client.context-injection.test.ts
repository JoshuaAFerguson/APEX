import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApexApiClient } from '../api-client'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('ApexApiClient - Context Injection', () => {
  let apiClient: ApexApiClient
  const baseUrl = 'http://localhost:3000/api'

  beforeEach(() => {
    vi.clearAllMocks()
    apiClient = new ApexApiClient(baseUrl)
  })

  describe('injectContext', () => {
    const taskId = 'test-task-123'
    const validRequest = {
      context: 'This is test context information',
      source: 'user-input',
      priority: 'normal' as const,
    }

    const mockSuccessResponse = {
      ok: true,
      taskId,
      contextInjected: true,
      timestamp: new Date('2024-01-01T10:00:00Z'),
    }

    it('makes POST request to correct endpoint with proper headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessResponse),
      })

      await apiClient.injectContext(taskId, validRequest)

      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/tasks/${taskId}/context`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(validRequest),
        }
      )
    })

    it('successfully injects context with all fields', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessResponse),
      })

      const result = await apiClient.injectContext(taskId, validRequest)

      expect(result).toEqual(mockSuccessResponse)
    })

    it('successfully injects context with minimal fields', async () => {
      const minimalRequest = {
        context: 'Minimal context',
        priority: 'high' as const,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessResponse),
      })

      const result = await apiClient.injectContext(taskId, minimalRequest)

      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/tasks/${taskId}/context`,
        expect.objectContaining({
          body: JSON.stringify(minimalRequest),
        })
      )
      expect(result).toEqual(mockSuccessResponse)
    })

    it('handles different priority levels', async () => {
      const priorityRequests = [
        { ...validRequest, priority: 'low' as const },
        { ...validRequest, priority: 'normal' as const },
        { ...validRequest, priority: 'high' as const },
      ]

      // Mock fetch for each request
      priorityRequests.forEach(() => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSuccessResponse),
        })
      })

      for (const request of priorityRequests) {
        await apiClient.injectContext(taskId, request)
        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            body: JSON.stringify(request),
          })
        )
      }

      expect(mockFetch).toHaveBeenCalledTimes(3)
    })

    it('handles special characters in task ID', async () => {
      const specialTaskId = 'task-with-special-chars_123-abc'
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ...mockSuccessResponse, taskId: specialTaskId }),
      })

      await apiClient.injectContext(specialTaskId, validRequest)

      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/tasks/${specialTaskId}/context`,
        expect.any(Object)
      )
    })

    it('handles context with special characters and Unicode', async () => {
      const unicodeRequest = {
        context: 'Context with émojis 🚀 and special chars: <>&"',
        source: 'unicode-test',
        priority: 'normal' as const,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessResponse),
      })

      await apiClient.injectContext(taskId, unicodeRequest)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify(unicodeRequest),
        })
      )
    })

    it('handles large context payloads', async () => {
      const largeContext = 'a'.repeat(90000) // Large but under 100k limit
      const largeRequest = {
        context: largeContext,
        priority: 'normal' as const,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessResponse),
      })

      await apiClient.injectContext(taskId, largeRequest)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify(largeRequest),
        })
      )
    })
  })

  describe('Error Handling', () => {
    const taskId = 'test-task-123'
    const validRequest = {
      context: 'Test context',
      priority: 'normal' as const,
    }

    it('throws ApiError for 400 Bad Request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: () => Promise.resolve({
          message: 'Context is required',
        }),
      })

      await expect(apiClient.injectContext(taskId, validRequest)).rejects.toThrow(
        'Context is required'
      )
    })

    it('throws ApiError for 401 Unauthorized', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () => Promise.resolve({
          error: 'Authentication required',
        }),
      })

      await expect(apiClient.injectContext(taskId, validRequest)).rejects.toThrow(
        'Authentication required'
      )
    })

    it('throws ApiError for 403 Forbidden', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: () => Promise.resolve({
          message: 'Invalid API key',
        }),
      })

      await expect(apiClient.injectContext(taskId, validRequest)).rejects.toThrow(
        'Invalid API key'
      )
    })

    it('throws ApiError for 404 Task Not Found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({
          message: 'Task not found',
        }),
      })

      await expect(apiClient.injectContext(taskId, validRequest)).rejects.toThrow(
        'Task not found'
      )
    })

    it('throws ApiError for 500 Internal Server Error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({
          error: 'Database connection failed',
        }),
      })

      await expect(apiClient.injectContext(taskId, validRequest)).rejects.toThrow(
        'Database connection failed'
      )
    })

    it('falls back to status text when no error message in response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        statusText: 'Unprocessable Entity',
        json: () => Promise.resolve({}),
      })

      await expect(apiClient.injectContext(taskId, validRequest)).rejects.toThrow(
        'API request failed: 422 Unprocessable Entity'
      )
    })

    it('handles non-JSON error responses gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        json: () => Promise.reject(new Error('Not JSON')),
      })

      await expect(apiClient.injectContext(taskId, validRequest)).rejects.toThrow(
        'API request failed: 503 Service Unavailable'
      )
    })

    it('handles network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await expect(apiClient.injectContext(taskId, validRequest)).rejects.toThrow(
        'Network error'
      )
    })

    it('handles timeout errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Request timeout'))

      await expect(apiClient.injectContext(taskId, validRequest)).rejects.toThrow(
        'Request timeout'
      )
    })

    it('preserves original error types', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Invalid URL'))

      try {
        await apiClient.injectContext(taskId, validRequest)
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect(error).toHaveProperty('message', 'Invalid URL')
      }
    })
  })

  describe('Response Parsing', () => {
    const taskId = 'test-task-123'
    const validRequest = {
      context: 'Test context',
      priority: 'normal' as const,
    }

    it('correctly parses successful response', async () => {
      const mockResponse = {
        ok: true,
        taskId: 'test-task-123',
        contextInjected: true,
        timestamp: '2024-01-01T10:00:00Z',
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const result = await apiClient.injectContext(taskId, validRequest)

      expect(result).toEqual(mockResponse)
      expect(result.ok).toBe(true)
      expect(result.taskId).toBe(taskId)
      expect(result.contextInjected).toBe(true)
      expect(result.timestamp).toBe('2024-01-01T10:00:00Z')
    })

    it('handles response with minimal fields', async () => {
      const minimalResponse = {
        ok: true,
        taskId: 'test-task-123',
        contextInjected: true,
        timestamp: '2024-01-01T10:00:00Z',
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(minimalResponse),
      })

      const result = await apiClient.injectContext(taskId, validRequest)
      expect(result).toEqual(minimalResponse)
    })

    it('handles malformed JSON response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      })

      await expect(apiClient.injectContext(taskId, validRequest)).rejects.toThrow(
        'Invalid JSON'
      )
    })
  })

  describe('Base URL Configuration', () => {
    it('uses provided base URL in constructor', async () => {
      const customUrl = 'https://api.example.com/v1'
      const customClient = new ApexApiClient(customUrl)

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      })

      await customClient.injectContext('task-123', {
        context: 'Test',
        priority: 'normal',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        `${customUrl}/tasks/task-123/context`,
        expect.any(Object)
      )
    })

    it('uses updated base URL after setBaseUrl call', async () => {
      const newUrl = 'https://new-api.example.com'
      apiClient.setBaseUrl(newUrl)

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      })

      await apiClient.injectContext('task-123', {
        context: 'Test',
        priority: 'normal',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        `${newUrl}/tasks/task-123/context`,
        expect.any(Object)
      )
    })
  })

  describe('Concurrent Requests', () => {
    const taskId = 'test-task-123'

    it('handles multiple concurrent context injections', async () => {
      const requests = [
        { context: 'Context 1', priority: 'low' as const },
        { context: 'Context 2', priority: 'normal' as const },
        { context: 'Context 3', priority: 'high' as const },
      ]

      // Mock responses for each request
      requests.forEach((_, index) => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            ok: true,
            taskId: `${taskId}-${index}`,
            contextInjected: true,
            timestamp: new Date().toISOString(),
          }),
        })
      })

      // Make concurrent requests
      const promises = requests.map(request =>
        apiClient.injectContext(taskId, request)
      )

      const results = await Promise.all(promises)

      expect(results).toHaveLength(3)
      expect(mockFetch).toHaveBeenCalledTimes(3)

      // Verify each request was made with correct data
      requests.forEach((request, index) => {
        expect(mockFetch).toHaveBeenNthCalledWith(
          index + 1,
          `${baseUrl}/tasks/${taskId}/context`,
          expect.objectContaining({
            body: JSON.stringify(request),
          })
        )
      })
    })

    it('handles mixed success and failure responses', async () => {
      const requests = [
        { context: 'Success context', priority: 'normal' as const },
        { context: 'Failure context', priority: 'high' as const },
      ]

      // First request succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          ok: true,
          taskId,
          contextInjected: true,
          timestamp: new Date().toISOString(),
        }),
      })

      // Second request fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: () => Promise.resolve({
          message: 'Invalid context',
        }),
      })

      const promises = requests.map(request =>
        apiClient.injectContext(taskId, request)
      )

      const results = await Promise.allSettled(promises)

      expect(results[0].status).toBe('fulfilled')
      expect(results[1].status).toBe('rejected')
    })
  })
})