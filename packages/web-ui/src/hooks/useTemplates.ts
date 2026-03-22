'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { apiClient } from '@/lib/api-client'
import type { TaskTemplate, TemplateFilters, TemplateCategory } from '@/types/task-template'

export interface UseTemplatesOptions {
  /** Initial filters to apply */
  initialFilters?: TemplateFilters

  /** Whether to include archived templates */
  includeArchived?: boolean

  /** Auto-fetch on mount (default: true) */
  autoFetch?: boolean
}

export interface UseTemplatesReturn {
  /** All fetched templates */
  templates: TaskTemplate[]

  /** Templates after applying local filters */
  filteredTemplates: TaskTemplate[]

  /** Templates grouped by category */
  templatesByCategory: Record<TemplateCategory | 'all', TaskTemplate[]>

  /** Loading state */
  isLoading: boolean

  /** Error state */
  error: string | null

  /** Current active filters */
  filters: TemplateFilters

  /** Update filters */
  setFilters: (filters: TemplateFilters) => void

  /** Set search query (convenience method) */
  setSearchQuery: (query: string) => void

  /** Set category filter (convenience method) */
  setCategoryFilter: (category: TemplateCategory | 'all') => void

  /** Refresh templates from API */
  refresh: () => Promise<void>

  /** Category counts for filter badges */
  categoryCounts: Record<TemplateCategory | 'all', number>
}

/**
 * Hook for fetching and filtering templates
 * Provides local filtering capabilities for better performance
 */
export function useTemplates(options: UseTemplatesOptions = {}): UseTemplatesReturn {
  const {
    initialFilters = {},
    includeArchived = false,
    autoFetch = true
  } = options

  // State
  const [templates, setTemplates] = useState<TaskTemplate[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<TemplateFilters>(initialFilters)

  // Fetch templates from API
  const fetchTemplates = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await apiClient.getTemplates({
        includeArchived,
        // Apply initial filters at API level for optimization
        ...initialFilters
      })

      setTemplates(response.templates)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch templates'
      setError(errorMessage)
      console.error('Failed to fetch templates:', err)
    } finally {
      setIsLoading(false)
    }
  }, [includeArchived, initialFilters])

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch) {
      fetchTemplates()
    }
  }, [autoFetch, fetchTemplates])

  // Apply local filters to templates
  const filteredTemplates = useMemo(() => {
    let filtered = templates.slice()

    // Filter by search query (name, description, tags)
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      filtered = filtered.filter(template =>
        template.name.toLowerCase().includes(searchLower) ||
        template.description.toLowerCase().includes(searchLower) ||
        template.tags.some(tag => tag.toLowerCase().includes(searchLower))
      )
    }

    // Filter by category
    if (filters.category) {
      const categoryFilter = filters.category
      // Support both single category and array of categories
      if (Array.isArray(categoryFilter)) {
        filtered = filtered.filter(template => categoryFilter.includes(template.category))
      } else {
        filtered = filtered.filter(template => template.category === categoryFilter)
      }
    }

    // Filter by tags (exact match)
    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter(template =>
        filters.tags!.some(tag => template.tags.includes(tag))
      )
    }

    // Filter by workflow
    if (filters.workflow) {
      filtered = filtered.filter(template => template.workflow === filters.workflow)
    }

    // Filter by autonomy level
    if (filters.autonomy) {
      filtered = filtered.filter(template => template.autonomy === filters.autonomy)
    }

    // Filter by priority
    if (filters.priority) {
      filtered = filtered.filter(template => template.priority === filters.priority)
    }

    // Filter by effort
    if (filters.effort) {
      filtered = filtered.filter(template => template.effort === filters.effort)
    }

    // Filter archived status (if not explicitly including archived)
    if (!includeArchived) {
      filtered = filtered.filter(template => !template.archived)
    }

    return filtered
  }, [templates, filters, includeArchived])

  // Group templates by category
  const templatesByCategory = useMemo(() => {
    const grouped: Record<TemplateCategory | 'all', TaskTemplate[]> = {
      all: filteredTemplates,
      feature: [],
      bugfix: [],
      refactoring: [],
      testing: [],
      documentation: [],
      maintenance: [],
      deployment: [],
      custom: []
    }

    filteredTemplates.forEach(template => {
      grouped[template.category].push(template)
    })

    return grouped
  }, [filteredTemplates])

  // Calculate category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<TemplateCategory | 'all', number> = {
      all: filteredTemplates.length,
      feature: 0,
      bugfix: 0,
      refactoring: 0,
      testing: 0,
      documentation: 0,
      maintenance: 0,
      deployment: 0,
      custom: 0
    }

    filteredTemplates.forEach(template => {
      counts[template.category]++
    })

    return counts
  }, [filteredTemplates])

  // Convenience methods
  const setSearchQuery = useCallback((query: string) => {
    setFilters(prev => ({ ...prev, search: query || undefined }))
  }, [])

  const setCategoryFilter = useCallback((category: TemplateCategory | 'all') => {
    setFilters(prev => ({
      ...prev,
      category: category === 'all' ? undefined : category
    }))
  }, [])

  return {
    templates,
    filteredTemplates,
    templatesByCategory,
    isLoading,
    error,
    filters,
    setFilters,
    setSearchQuery,
    setCategoryFilter,
    refresh: fetchTemplates,
    categoryCounts
  }
}