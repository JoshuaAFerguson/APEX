import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ApexApiClient } from '../api-client'
import type { ExportDialogOptions, ExportDialogResult } from '@/types/export-dialog'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('ApexApiClient - exportTasks', () => {
  let client: ApexApiClient

  beforeEach(() => {
    client = new ApexApiClient('http://test-api.com')
    mockFetch.mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Export Functionality', () => {
    it('should export tasks with default options', async () => {
      const options: ExportDialogOptions = {
        format: 'json',
        dateRange: { startDate: null, endDate: null },
        datePreset: 'all',
        filterByTasks: false,
        selectedTaskIds: [],
        includeArchived: false,
        includeTrashed: false,
      }

      const mockContent = JSON.stringify([{ id: '1', description: 'Test task' }])

      // Create a proper mock response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: (key: string) => {
            const headers: Record<string, string> = {
              'content-type': 'application/octet-stream',
              'content-disposition': 'attachment; filename="apex-tasks-export-2024-01-01.json"',
              'x-task-count': '1',
            }
            return headers[key.toLowerCase()] || null
          }
        },
        text: () => Promise.resolve(mockContent),
      })

      const result = await client.exportTasks(options)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/tasks/export?format=json',
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
          },
        })
      )

      expect(result).toEqual({
        success: true,
        filename: 'apex-tasks-export-2024-01-01.json',
        content: mockContent,
        mimeType: 'application/octet-stream',
        taskCount: 1,
      })
    })

    it('should export tasks with CSV format', async () => {
      const options: ExportDialogOptions = {
        format: 'csv',
        dateRange: { startDate: null, endDate: null },
        datePreset: 'all',
        filterByTasks: false,
        selectedTaskIds: [],
        includeArchived: false,
        includeTrashed: false,
      }

      const mockContent = 'id,description\n1,Test task\n'

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: (key: string) => {
            const headers: Record<string, string> = {
              'content-type': 'text/csv',
              'content-disposition': 'attachment; filename="apex-tasks-export-2024-01-01.csv"',
              'x-task-count': '1',
            }
            return headers[key.toLowerCase()] || null
          }
        },
        text: () => Promise.resolve(mockContent),
      })

      const result = await client.exportTasks(options)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/tasks/export?format=csv',
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
          },
        })
      )

      expect(result).toEqual({
        success: true,
        filename: 'apex-tasks-export-2024-01-01.csv',
        content: mockContent,
        mimeType: 'text/csv',
        taskCount: 1,
      })
    })

    it('should export tasks with Markdown format', async () => {
      const options: ExportDialogOptions = {
        format: 'markdown',
        dateRange: { startDate: null, endDate: null },
        datePreset: 'all',
        filterByTasks: false,
        selectedTaskIds: [],
        includeArchived: false,
        includeTrashed: false,
      }

      const mockContent = '# Task Export\n\n## Task 1\n\n- **Description**: Test task\n'

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: (key: string) => {
            const headers: Record<string, string> = {
              'content-type': 'text/markdown',
              'content-disposition': 'attachment; filename="apex-tasks-export-2024-01-01.md"',
              'x-task-count': '1',
            }
            return headers[key.toLowerCase()] || null
          }
        },
        text: () => Promise.resolve(mockContent),
      })

      const result = await client.exportTasks(options)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/tasks/export?format=markdown',
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
          },
        })
      )

      expect(result).toEqual({
        success: true,
        filename: 'apex-tasks-export-2024-01-01.md',
        content: mockContent,
        mimeType: 'text/markdown',
        taskCount: 1,
      })
    })
  })

  describe('Date Range Filtering', () => {
    it('should include startDate and endDate in query parameters', async () => {
      const startDate = new Date('2024-01-01T00:00:00Z')
      const endDate = new Date('2024-01-31T23:59:59Z')

      const options: ExportDialogOptions = {
        format: 'json',
        dateRange: { startDate, endDate },
        datePreset: 'custom',
        filterByTasks: false,
        selectedTaskIds: [],
        includeArchived: false,
        includeTrashed: false,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: () => null
        },
        text: () => Promise.resolve('[]'),
      })

      await client.exportTasks(options)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/tasks/export?format=json&startDate=2024-01-01T00%3A00%3A00.000Z&endDate=2024-01-31T23%3A59%3A59.000Z',
        expect.anything()
      )
    })

    it('should handle only startDate', async () => {
      const startDate = new Date('2024-01-01T00:00:00Z')

      const options: ExportDialogOptions = {
        format: 'json',
        dateRange: { startDate, endDate: null },
        datePreset: 'custom',
        filterByTasks: false,
        selectedTaskIds: [],
        includeArchived: false,
        includeTrashed: false,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: () => null
        },
        text: () => Promise.resolve('[]'),
      })

      await client.exportTasks(options)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/tasks/export?format=json&startDate=2024-01-01T00%3A00%3A00.000Z',
        expect.anything()
      )
    })

    it('should handle only endDate', async () => {
      const endDate = new Date('2024-01-31T23:59:59Z')

      const options: ExportDialogOptions = {
        format: 'json',
        dateRange: { startDate: null, endDate },
        datePreset: 'custom',
        filterByTasks: false,
        selectedTaskIds: [],
        includeArchived: false,
        includeTrashed: false,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: () => null
        },
        text: () => Promise.resolve('[]'),
      })

      await client.exportTasks(options)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/tasks/export?format=json&endDate=2024-01-31T23%3A59%3A59.000Z',
        expect.anything()
      )
    })
  })

  describe('Task Selection Filtering', () => {
    it('should include taskIds when filtering by tasks', async () => {
      const options: ExportDialogOptions = {
        format: 'json',
        dateRange: { startDate: null, endDate: null },
        datePreset: 'all',
        filterByTasks: true,
        selectedTaskIds: ['task-1', 'task-2', 'task-3'],
        includeArchived: false,
        includeTrashed: false,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: () => null
        },
        text: () => Promise.resolve('[]'),
      })

      await client.exportTasks(options)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/tasks/export?format=json&taskIds=task-1%2Ctask-2%2Ctask-3',
        expect.anything()
      )
    })

    it('should not include taskIds when not filtering by tasks', async () => {
      const options: ExportDialogOptions = {
        format: 'json',
        dateRange: { startDate: null, endDate: null },
        datePreset: 'all',
        filterByTasks: false,
        selectedTaskIds: ['task-1', 'task-2'],
        includeArchived: false,
        includeTrashed: false,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: () => null
        },
        text: () => Promise.resolve('[]'),
      })

      await client.exportTasks(options)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/tasks/export?format=json',
        expect.anything()
      )
    })

    it('should not include taskIds when filterByTasks is true but selectedTaskIds is empty', async () => {
      const options: ExportDialogOptions = {
        format: 'json',
        dateRange: { startDate: null, endDate: null },
        datePreset: 'all',
        filterByTasks: true,
        selectedTaskIds: [],
        includeArchived: false,
        includeTrashed: false,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: () => null
        },
        text: () => Promise.resolve('[]'),
      })

      await client.exportTasks(options)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/tasks/export?format=json',
        expect.anything()
      )
    })
  })

  describe('Archive and Trash Options', () => {
    it('should include archived tasks when includeArchived is true', async () => {
      const options: ExportDialogOptions = {
        format: 'json',
        dateRange: { startDate: null, endDate: null },
        datePreset: 'all',
        filterByTasks: false,
        selectedTaskIds: [],
        includeArchived: true,
        includeTrashed: false,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: () => null
        },
        text: () => Promise.resolve('[]'),
      })

      await client.exportTasks(options)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/tasks/export?format=json&includeArchived=true',
        expect.anything()
      )
    })

    it('should include trashed tasks when includeTrashed is true', async () => {
      const options: ExportDialogOptions = {
        format: 'json',
        dateRange: { startDate: null, endDate: null },
        datePreset: 'all',
        filterByTasks: false,
        selectedTaskIds: [],
        includeArchived: false,
        includeTrashed: true,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: () => null
        },
        text: () => Promise.resolve('[]'),
      })

      await client.exportTasks(options)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/tasks/export?format=json&includeTrashed=true',
        expect.anything()
      )
    })

    it('should include both archived and trashed when both options are true', async () => {
      const options: ExportDialogOptions = {
        format: 'json',
        dateRange: { startDate: null, endDate: null },
        datePreset: 'all',
        filterByTasks: false,
        selectedTaskIds: [],
        includeArchived: true,
        includeTrashed: true,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: () => null
        },
        text: () => Promise.resolve('[]'),
      })

      await client.exportTasks(options)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/tasks/export?format=json&includeArchived=true&includeTrashed=true',
        expect.anything()
      )
    })
  })

  describe('Response Handling', () => {
    it('should extract filename from Content-Disposition header', async () => {
      const options: ExportDialogOptions = {
        format: 'json',
        dateRange: { startDate: null, endDate: null },
        datePreset: 'all',
        filterByTasks: false,
        selectedTaskIds: [],
        includeArchived: false,
        includeTrashed: false,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: (key: string) => {
            const headers: Record<string, string> = {
              'content-type': 'application/octet-stream',
              'content-disposition': 'attachment; filename="custom-export-name.json"',
              'x-task-count': '0',
            }
            return headers[key.toLowerCase()] || null
          }
        },
        text: () => Promise.resolve('[]'),
      })

      const result = await client.exportTasks(options)

      expect(result.filename).toBe('custom-export-name.json')
    })

    it('should generate filename when no Content-Disposition header', async () => {
      const options: ExportDialogOptions = {
        format: 'json',
        dateRange: { startDate: null, endDate: null },
        datePreset: 'all',
        filterByTasks: false,
        selectedTaskIds: [],
        includeArchived: false,
        includeTrashed: false,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: (key: string) => {
            const headers: Record<string, string> = {
              'content-type': 'application/octet-stream',
              'x-task-count': '0',
            }
            return headers[key.toLowerCase()] || null
          }
        },
        text: () => Promise.resolve('[]'),
      })

      const result = await client.exportTasks(options)

      expect(result.filename).toMatch(/^apex-tasks.*\.json$/)
    })

    it('should extract task count from x-task-count header', async () => {
      const options: ExportDialogOptions = {
        format: 'json',
        dateRange: { startDate: null, endDate: null },
        datePreset: 'all',
        filterByTasks: false,
        selectedTaskIds: [],
        includeArchived: false,
        includeTrashed: false,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: (key: string) => {
            const headers: Record<string, string> = {
              'content-type': 'application/octet-stream',
              'x-task-count': '42',
            }
            return headers[key.toLowerCase()] || null
          }
        },
        text: () => Promise.resolve('[]'),
      })

      const result = await client.exportTasks(options)

      expect(result.taskCount).toBe(42)
    })

    it('should default to 0 tasks when x-task-count header is missing', async () => {
      const options: ExportDialogOptions = {
        format: 'json',
        dateRange: { startDate: null, endDate: null },
        datePreset: 'all',
        filterByTasks: false,
        selectedTaskIds: [],
        includeArchived: false,
        includeTrashed: false,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: () => null
        },
        text: () => Promise.resolve('[]'),
      })

      const result = await client.exportTasks(options)

      expect(result.taskCount).toBe(0)
    })

    it('should use default MIME type when content-type header is missing', async () => {
      const options: ExportDialogOptions = {
        format: 'json',
        dateRange: { startDate: null, endDate: null },
        datePreset: 'all',
        filterByTasks: false,
        selectedTaskIds: [],
        includeArchived: false,
        includeTrashed: false,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: () => null
        },
        text: () => Promise.resolve('[]'),
      })

      const result = await client.exportTasks(options)

      expect(result.mimeType).toBe('application/octet-stream')
    })
  })

  describe('Error Handling', () => {
    it('should throw error when server returns JSON error response', async () => {
      const options: ExportDialogOptions = {
        format: 'json',
        dateRange: { startDate: null, endDate: null },
        datePreset: 'all',
        filterByTasks: false,
        selectedTaskIds: [],
        includeArchived: false,
        includeTrashed: false,
      }

      const errorResponse = { message: 'Export failed due to server error' }

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: {
          get: (key: string) => {
            if (key.toLowerCase() === 'content-type') {
              return 'application/json'
            }
            return null
          }
        },
        json: () => Promise.resolve(errorResponse),
      })

      await expect(client.exportTasks(options)).rejects.toThrow('Export failed due to server error')
    })

    it('should throw generic error when JSON error response has no message', async () => {
      const options: ExportDialogOptions = {
        format: 'json',
        dateRange: { startDate: null, endDate: null },
        datePreset: 'all',
        filterByTasks: false,
        selectedTaskIds: [],
        includeArchived: false,
        includeTrashed: false,
      }

      const errorResponse = { error: 'Some other error format' }

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: {
          get: (key: string) => {
            if (key.toLowerCase() === 'content-type') {
              return 'application/json'
            }
            return null
          }
        },
        json: () => Promise.resolve(errorResponse),
      })

      await expect(client.exportTasks(options)).rejects.toThrow('Export failed')
    })

    it('should handle network errors', async () => {
      const options: ExportDialogOptions = {
        format: 'json',
        dateRange: { startDate: null, endDate: null },
        datePreset: 'all',
        filterByTasks: false,
        selectedTaskIds: [],
        includeArchived: false,
        includeTrashed: false,
      }

      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await expect(client.exportTasks(options)).rejects.toThrow('Network error')
    })
  })
})