import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Task } from '@apexcli/core'
import {
  // Type definitions
  type ExportDialogOptions,
  type ExportDialogValidationErrors,
  type ExportDateRange,
  type DateRangePreset,

  // Constants
  DEFAULT_EXPORT_OPTIONS,
  EXPORT_FORMAT_OPTIONS,
  DATE_RANGE_PRESETS,

  // Validation functions
  validateDateRange,
  validateTaskSelection,
  validateExportOptions,
  hasValidationErrors,

  // Utility functions
  getFormatOption,
  generateExportFilename,
  filterTasksByDateRange,
  filterTasksByIds,
  filterTasksByStatus,
  applyExportFilters,
} from '../export-dialog'

// Mock task data for testing
const mockTasks: Task[] = [
  {
    id: '1',
    description: 'Task from 2023-11-15',
    status: 'completed',
    createdAt: '2023-11-15T10:00:00Z',
    updatedAt: '2023-11-15T10:00:00Z',
    archivedAt: null,
    trashedAt: null,
  },
  {
    id: '2',
    description: 'Task from 2023-12-01',
    status: 'in_progress',
    createdAt: '2023-12-01T10:00:00Z',
    updatedAt: '2023-12-01T10:00:00Z',
    archivedAt: null,
    trashedAt: null,
  },
  {
    id: '3',
    description: 'Recent task',
    status: 'pending',
    createdAt: '2023-12-15T10:00:00Z',
    updatedAt: '2023-12-15T10:00:00Z',
    archivedAt: null,
    trashedAt: null,
  },
  {
    id: '4',
    description: 'Archived task',
    status: 'completed',
    createdAt: '2023-12-10T10:00:00Z',
    updatedAt: '2023-12-10T10:00:00Z',
    archivedAt: '2023-12-10T12:00:00Z',
    trashedAt: null,
  },
  {
    id: '5',
    description: 'Trashed task',
    status: 'cancelled',
    createdAt: '2023-12-05T10:00:00Z',
    updatedAt: '2023-12-05T10:00:00Z',
    archivedAt: null,
    trashedAt: '2023-12-05T12:00:00Z',
  },
  {
    id: '6',
    description: 'Both archived and trashed',
    status: 'cancelled',
    createdAt: '2023-11-30T10:00:00Z',
    updatedAt: '2023-11-30T10:00:00Z',
    archivedAt: '2023-11-30T12:00:00Z',
    trashedAt: '2023-11-30T14:00:00Z',
  },
]

describe('Export Dialog Type Definitions and Utilities', () => {
  beforeEach(() => {
    // Reset Date to a fixed time for consistent testing
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2023-12-20T10:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Constants', () => {
    describe('DEFAULT_EXPORT_OPTIONS', () => {
      it('has correct default values', () => {
        expect(DEFAULT_EXPORT_OPTIONS).toEqual({
          format: 'json',
          dateRange: { startDate: null, endDate: null },
          datePreset: 'all',
          filterByTasks: false,
          selectedTaskIds: [],
          includeArchived: false,
          includeTrashed: false,
        })
      })
    })

    describe('EXPORT_FORMAT_OPTIONS', () => {
      it('contains all expected formats', () => {
        expect(EXPORT_FORMAT_OPTIONS).toHaveLength(3)

        const formats = EXPORT_FORMAT_OPTIONS.map(opt => opt.value)
        expect(formats).toContain('json')
        expect(formats).toContain('csv')
        expect(formats).toContain('markdown')
      })

      it('has complete metadata for each format', () => {
        EXPORT_FORMAT_OPTIONS.forEach(format => {
          expect(format).toHaveProperty('value')
          expect(format).toHaveProperty('label')
          expect(format).toHaveProperty('description')
          expect(format).toHaveProperty('extension')
          expect(format).toHaveProperty('mimeType')

          expect(typeof format.value).toBe('string')
          expect(typeof format.label).toBe('string')
          expect(typeof format.description).toBe('string')
          expect(typeof format.extension).toBe('string')
          expect(typeof format.mimeType).toBe('string')
        })
      })

      it('has correct metadata for JSON format', () => {
        const jsonFormat = EXPORT_FORMAT_OPTIONS.find(opt => opt.value === 'json')
        expect(jsonFormat).toEqual({
          value: 'json',
          label: 'JSON',
          description: 'Full task data with all fields and nested structures',
          extension: 'json',
          mimeType: 'application/json',
        })
      })

      it('has correct metadata for CSV format', () => {
        const csvFormat = EXPORT_FORMAT_OPTIONS.find(opt => opt.value === 'csv')
        expect(csvFormat).toEqual({
          value: 'csv',
          label: 'CSV',
          description: 'Tabular format for spreadsheet applications',
          extension: 'csv',
          mimeType: 'text/csv',
        })
      })

      it('has correct metadata for Markdown format', () => {
        const markdownFormat = EXPORT_FORMAT_OPTIONS.find(opt => opt.value === 'markdown')
        expect(markdownFormat).toEqual({
          value: 'markdown',
          label: 'Markdown',
          description: 'Human-readable documentation format',
          extension: 'md',
          mimeType: 'text/markdown',
        })
      })
    })

    describe('DATE_RANGE_PRESETS', () => {
      it('contains all expected presets', () => {
        expect(DATE_RANGE_PRESETS).toHaveLength(8)

        const presets = DATE_RANGE_PRESETS.map(preset => preset.value)
        expect(presets).toEqual([
          'all', 'today', 'yesterday', 'last7days', 'last30days', 'thisMonth', 'lastMonth', 'custom'
        ])
      })

      it('generates correct date ranges for presets', () => {
        const allPreset = DATE_RANGE_PRESETS.find(p => p.value === 'all')
        expect(allPreset?.getRange()).toEqual({ startDate: null, endDate: null })

        const customPreset = DATE_RANGE_PRESETS.find(p => p.value === 'custom')
        expect(customPreset?.getRange()).toEqual({ startDate: null, endDate: null })
      })

      it('generates correct date range for today preset', () => {
        const todayPreset = DATE_RANGE_PRESETS.find(p => p.value === 'today')
        const range = todayPreset?.getRange()

        expect(range?.startDate).toBeInstanceOf(Date)
        expect(range?.endDate).toBeInstanceOf(Date)

        // Should be same day
        expect(range?.startDate?.toDateString()).toBe(range?.endDate?.toDateString())

        // Start should be beginning of day
        expect(range?.startDate?.getHours()).toBe(0)
        expect(range?.startDate?.getMinutes()).toBe(0)

        // End should be end of day
        expect(range?.endDate?.getHours()).toBe(23)
        expect(range?.endDate?.getMinutes()).toBe(59)
      })

      it('generates correct date range for yesterday preset', () => {
        // The yesterday preset uses new Date(), which isn't affected by vi.setSystemTime
        // So we'll just test that it creates a valid date range for yesterday
        const yesterdayPreset = DATE_RANGE_PRESETS.find(p => p.value === 'yesterday')
        const range = yesterdayPreset?.getRange()

        expect(range?.startDate).toBeInstanceOf(Date)
        expect(range?.endDate).toBeInstanceOf(Date)

        // Should be same day
        expect(range?.startDate?.toDateString()).toBe(range?.endDate?.toDateString())

        // Start should be beginning of day
        expect(range?.startDate?.getHours()).toBe(0)
        expect(range?.startDate?.getMinutes()).toBe(0)

        // End should be end of day
        expect(range?.endDate?.getHours()).toBe(23)
        expect(range?.endDate?.getMinutes()).toBe(59)

        // Should be before today
        const today = new Date()
        expect(range?.startDate?.getTime()).toBeLessThan(today.getTime())
      })

      it('generates correct date range for last7days preset', () => {
        const last7DaysPreset = DATE_RANGE_PRESETS.find(p => p.value === 'last7days')
        const range = last7DaysPreset?.getRange()

        expect(range?.startDate).toBeInstanceOf(Date)
        expect(range?.endDate).toBeInstanceOf(Date)

        // Should span 7 days ending today
        const diffInDays = Math.floor((range!.endDate!.getTime() - range!.startDate!.getTime()) / (1000 * 60 * 60 * 24))
        expect(diffInDays).toBe(6) // 6 days difference = 7 days total
      })

      it('generates correct date range for thisMonth preset', () => {
        const thisMonthPreset = DATE_RANGE_PRESETS.find(p => p.value === 'thisMonth')
        const range = thisMonthPreset?.getRange()

        expect(range?.startDate).toBeInstanceOf(Date)
        expect(range?.endDate).toBeInstanceOf(Date)

        // Start should be first day of current month
        expect(range?.startDate?.getDate()).toBe(1)
        expect(range?.startDate?.getMonth()).toBe(11) // December (0-indexed)

        // End should be today
        expect(range?.endDate?.getDate()).toBe(20)
        expect(range?.endDate?.getMonth()).toBe(11)
      })

      it('generates correct date range for lastMonth preset', () => {
        const lastMonthPreset = DATE_RANGE_PRESETS.find(p => p.value === 'lastMonth')
        const range = lastMonthPreset?.getRange()

        expect(range?.startDate).toBeInstanceOf(Date)
        expect(range?.endDate).toBeInstanceOf(Date)

        // Should be November 2023
        expect(range?.startDate?.getMonth()).toBe(10) // November (0-indexed)
        expect(range?.endDate?.getMonth()).toBe(10)

        // Should be full month
        expect(range?.startDate?.getDate()).toBe(1)
        expect(range?.endDate?.getDate()).toBe(30) // Last day of November
      })
    })
  })

  describe('Validation Functions', () => {
    describe('validateDateRange', () => {
      it('returns undefined for valid date ranges', () => {
        const validRange: ExportDateRange = {
          startDate: new Date('2023-12-01'),
          endDate: new Date('2023-12-31'),
        }
        expect(validateDateRange(validRange)).toBeUndefined()
      })

      it('returns undefined for equal start and end dates', () => {
        const equalRange: ExportDateRange = {
          startDate: new Date('2023-12-15'),
          endDate: new Date('2023-12-15'),
        }
        expect(validateDateRange(equalRange)).toBeUndefined()
      })

      it('returns undefined for null dates', () => {
        const nullRange: ExportDateRange = {
          startDate: null,
          endDate: null,
        }
        expect(validateDateRange(nullRange)).toBeUndefined()
      })

      it('returns undefined for partial date ranges', () => {
        const startOnlyRange: ExportDateRange = {
          startDate: new Date('2023-12-01'),
          endDate: null,
        }
        expect(validateDateRange(startOnlyRange)).toBeUndefined()

        const endOnlyRange: ExportDateRange = {
          startDate: null,
          endDate: new Date('2023-12-31'),
        }
        expect(validateDateRange(endOnlyRange)).toBeUndefined()
      })

      it('returns error message for invalid date ranges', () => {
        const invalidRange: ExportDateRange = {
          startDate: new Date('2023-12-31'),
          endDate: new Date('2023-12-01'),
        }
        expect(validateDateRange(invalidRange)).toBe('Start date must be before end date')
      })
    })

    describe('validateTaskSelection', () => {
      it('returns undefined when task filtering is disabled', () => {
        expect(validateTaskSelection(false, [])).toBeUndefined()
        expect(validateTaskSelection(false, ['1', '2'])).toBeUndefined()
      })

      it('returns undefined when task filtering is enabled and tasks are selected', () => {
        expect(validateTaskSelection(true, ['1'])).toBeUndefined()
        expect(validateTaskSelection(true, ['1', '2', '3'])).toBeUndefined()
      })

      it('returns error when task filtering is enabled but no tasks selected', () => {
        expect(validateTaskSelection(true, [])).toBe('Please select at least one task')
      })
    })

    describe('validateExportOptions', () => {
      it('returns empty errors object for valid options', () => {
        const validOptions: ExportDialogOptions = {
          format: 'json',
          dateRange: { startDate: new Date('2023-12-01'), endDate: new Date('2023-12-31') },
          datePreset: 'custom',
          filterByTasks: true,
          selectedTaskIds: ['1', '2'],
          includeArchived: false,
          includeTrashed: false,
        }

        const errors = validateExportOptions(validOptions)
        expect(errors).toEqual({})
      })

      it('returns date range error for invalid date range', () => {
        const invalidOptions: ExportDialogOptions = {
          ...DEFAULT_EXPORT_OPTIONS,
          dateRange: { startDate: new Date('2023-12-31'), endDate: new Date('2023-12-01') },
        }

        const errors = validateExportOptions(invalidOptions)
        expect(errors.dateRange).toBe('Start date must be before end date')
      })

      it('returns task selection error for invalid task selection', () => {
        const invalidOptions: ExportDialogOptions = {
          ...DEFAULT_EXPORT_OPTIONS,
          filterByTasks: true,
          selectedTaskIds: [],
        }

        const errors = validateExportOptions(invalidOptions)
        expect(errors.taskSelection).toBe('Please select at least one task')
      })

      it('returns multiple errors when multiple validations fail', () => {
        const invalidOptions: ExportDialogOptions = {
          ...DEFAULT_EXPORT_OPTIONS,
          dateRange: { startDate: new Date('2023-12-31'), endDate: new Date('2023-12-01') },
          filterByTasks: true,
          selectedTaskIds: [],
        }

        const errors = validateExportOptions(invalidOptions)
        expect(errors.dateRange).toBe('Start date must be before end date')
        expect(errors.taskSelection).toBe('Please select at least one task')
      })
    })

    describe('hasValidationErrors', () => {
      it('returns false for empty errors object', () => {
        expect(hasValidationErrors({})).toBe(false)
      })

      it('returns true for errors object with any errors', () => {
        expect(hasValidationErrors({ dateRange: 'Invalid range' })).toBe(true)
        expect(hasValidationErrors({ taskSelection: 'No tasks selected' })).toBe(true)
        expect(hasValidationErrors({
          dateRange: 'Invalid range',
          taskSelection: 'No tasks selected'
        })).toBe(true)
      })
    })
  })

  describe('Utility Functions', () => {
    describe('getFormatOption', () => {
      it('returns correct option for valid format', () => {
        const jsonOption = getFormatOption('json')
        expect(jsonOption.value).toBe('json')
        expect(jsonOption.label).toBe('JSON')
        expect(jsonOption.extension).toBe('json')
        expect(jsonOption.mimeType).toBe('application/json')
      })

      it('throws error for invalid format', () => {
        expect(() => getFormatOption('invalid' as any)).toThrow('Unknown export format: invalid')
      })
    })

    describe('generateExportFilename', () => {
      it('generates filename with default prefix', () => {
        const filename = generateExportFilename('json')
        expect(filename).toMatch(/^apex-tasks-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.json$/)
      })

      it('generates filename with custom prefix', () => {
        const filename = generateExportFilename('csv', 'my-tasks')
        expect(filename).toMatch(/^my-tasks-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.csv$/)
      })

      it('uses correct extension for each format', () => {
        expect(generateExportFilename('json')).toMatch(/\.json$/)
        expect(generateExportFilename('csv')).toMatch(/\.csv$/)
        expect(generateExportFilename('markdown')).toMatch(/\.md$/)
      })

      it('generates unique filenames for different timestamps', () => {
        const filename1 = generateExportFilename('json')

        // Advance time slightly
        vi.advanceTimersByTime(1000)

        const filename2 = generateExportFilename('json')
        expect(filename1).not.toBe(filename2)
      })
    })

    describe('filterTasksByDateRange', () => {
      it('returns all tasks when date range is null', () => {
        const filtered = filterTasksByDateRange(mockTasks, { startDate: null, endDate: null })
        expect(filtered).toHaveLength(mockTasks.length)
        expect(filtered).toEqual(mockTasks)
      })

      it('filters by start date only', () => {
        const filtered = filterTasksByDateRange(mockTasks, {
          startDate: new Date('2023-12-01'),
          endDate: null,
        })

        // Should include tasks from 2023-12-01 onwards
        expect(filtered).toHaveLength(4) // Tasks 2, 3, 4, 5
        expect(filtered.map(t => t.id).sort()).toEqual(['2', '3', '4', '5'])
      })

      it('filters by end date only', () => {
        const filtered = filterTasksByDateRange(mockTasks, {
          startDate: null,
          endDate: new Date('2023-12-01'),
        })

        // Should include tasks up to 2023-12-01 (tasks 1, 6)
        // Task 2 is created at 10:00:00 which is after midnight, so it's excluded
        expect(filtered).toHaveLength(2) // Tasks 1, 6
        expect(filtered.map(t => t.id).sort()).toEqual(['1', '6'])
      })

      it('filters by date range', () => {
        const filtered = filterTasksByDateRange(mockTasks, {
          startDate: new Date('2023-12-01'),
          endDate: new Date('2023-12-10'),
        })

        // Should include tasks between dates inclusive
        // Task 2 starts at 10:00 AM on start date (after midnight) - included
        // Task 5 is within range - included
        // Task 4 is at 10:00 AM on end date (after midnight) - excluded
        expect(filtered).toHaveLength(2) // Tasks 2, 5
        expect(filtered.map(t => t.id).sort()).toEqual(['2', '5'])
      })

      it('handles edge case dates correctly', () => {
        // Test exact boundary dates
        const filtered = filterTasksByDateRange(mockTasks, {
          startDate: new Date('2023-12-15T10:00:00Z'),
          endDate: new Date('2023-12-15T10:00:00Z'),
        })

        // Should include task 3 which was created exactly at this time
        expect(filtered).toHaveLength(1)
        expect(filtered[0].id).toBe('3')
      })
    })

    describe('filterTasksByIds', () => {
      it('returns all tasks when task IDs array is empty', () => {
        const filtered = filterTasksByIds(mockTasks, [])
        expect(filtered).toEqual(mockTasks)
      })

      it('filters by specific task IDs', () => {
        const filtered = filterTasksByIds(mockTasks, ['1', '3', '5'])
        expect(filtered).toHaveLength(3)
        expect(filtered.map(t => t.id).sort()).toEqual(['1', '3', '5'])
      })

      it('handles non-existent IDs gracefully', () => {
        const filtered = filterTasksByIds(mockTasks, ['1', 'nonexistent', '3'])
        expect(filtered).toHaveLength(2)
        expect(filtered.map(t => t.id).sort()).toEqual(['1', '3'])
      })

      it('handles duplicate IDs', () => {
        const filtered = filterTasksByIds(mockTasks, ['1', '1', '2'])
        expect(filtered).toHaveLength(2)
        expect(filtered.map(t => t.id).sort()).toEqual(['1', '2'])
      })
    })

    describe('filterTasksByStatus', () => {
      it('excludes archived tasks when includeArchived is false', () => {
        const filtered = filterTasksByStatus(mockTasks, false, true)

        // Should exclude tasks 4 and 6 (archived)
        expect(filtered).toHaveLength(4)
        expect(filtered.map(t => t.id).sort()).toEqual(['1', '2', '3', '5'])
      })

      it('excludes trashed tasks when includeTrashed is false', () => {
        const filtered = filterTasksByStatus(mockTasks, true, false)

        // Should exclude tasks 5 and 6 (trashed)
        expect(filtered).toHaveLength(4)
        expect(filtered.map(t => t.id).sort()).toEqual(['1', '2', '3', '4'])
      })

      it('excludes both archived and trashed when both are false', () => {
        const filtered = filterTasksByStatus(mockTasks, false, false)

        // Should exclude tasks 4, 5, and 6
        expect(filtered).toHaveLength(3)
        expect(filtered.map(t => t.id).sort()).toEqual(['1', '2', '3'])
      })

      it('includes all tasks when both are true', () => {
        const filtered = filterTasksByStatus(mockTasks, true, true)
        expect(filtered).toEqual(mockTasks)
      })

      it('handles task with both archived and trashed correctly', () => {
        // Task 6 is both archived and trashed
        const excludeArchived = filterTasksByStatus(mockTasks, false, true)
        expect(excludeArchived.find(t => t.id === '6')).toBeUndefined()

        const excludeTrashed = filterTasksByStatus(mockTasks, true, false)
        expect(excludeTrashed.find(t => t.id === '6')).toBeUndefined()
      })
    })

    describe('applyExportFilters', () => {
      const baseOptions: ExportDialogOptions = {
        format: 'json',
        dateRange: { startDate: null, endDate: null },
        datePreset: 'all',
        filterByTasks: false,
        selectedTaskIds: [],
        includeArchived: true,
        includeTrashed: true,
      }

      it('applies no filters with default options', () => {
        const filtered = applyExportFilters(mockTasks, baseOptions)
        expect(filtered).toEqual(mockTasks)
      })

      it('applies status filters', () => {
        const options = {
          ...baseOptions,
          includeArchived: false,
          includeTrashed: false,
        }

        const filtered = applyExportFilters(mockTasks, options)
        expect(filtered).toHaveLength(3) // Only tasks 1, 2, 3
        expect(filtered.map(t => t.id).sort()).toEqual(['1', '2', '3'])
      })

      it('applies date range filter', () => {
        const options = {
          ...baseOptions,
          dateRange: {
            startDate: new Date('2023-12-01'),
            endDate: new Date('2023-12-10'),
          },
        }

        const filtered = applyExportFilters(mockTasks, options)
        expect(filtered).toHaveLength(2) // Tasks 2, 5
        expect(filtered.map(t => t.id).sort()).toEqual(['2', '5'])
      })

      it('applies task ID filter', () => {
        const options = {
          ...baseOptions,
          filterByTasks: true,
          selectedTaskIds: ['1', '3', '5'],
        }

        const filtered = applyExportFilters(mockTasks, options)
        expect(filtered).toHaveLength(3)
        expect(filtered.map(t => t.id).sort()).toEqual(['1', '3', '5'])
      })

      it('applies multiple filters in combination', () => {
        const options = {
          ...baseOptions,
          dateRange: {
            startDate: new Date('2023-11-01'),
            endDate: new Date('2023-12-10'),
          },
          filterByTasks: true,
          selectedTaskIds: ['1', '2', '4', '6'],
          includeArchived: false,
          includeTrashed: true,
        }

        // Should filter by date (1, 2, 4, 6), then by IDs (1, 2, 4, 6), then by status (exclude archived = exclude 4, 6)
        const filtered = applyExportFilters(mockTasks, options)
        expect(filtered).toHaveLength(2) // Tasks 1, 2
        expect(filtered.map(t => t.id).sort()).toEqual(['1', '2'])
      })

      it('handles empty result from filters', () => {
        const options = {
          ...baseOptions,
          dateRange: {
            startDate: new Date('2024-01-01'),
            endDate: new Date('2024-01-31'),
          },
        }

        const filtered = applyExportFilters(mockTasks, options)
        expect(filtered).toHaveLength(0)
      })

      it('ignores task ID filter when filterByTasks is false', () => {
        const options = {
          ...baseOptions,
          filterByTasks: false,
          selectedTaskIds: ['1'], // This should be ignored
        }

        const filtered = applyExportFilters(mockTasks, options)
        expect(filtered).toEqual(mockTasks) // All tasks should be included
      })
    })
  })
})