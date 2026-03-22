'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'

import { useTemplates } from '@/hooks/useTemplates'
import {
  TemplateSearchInput,
  TemplateCard,
  TemplatePreviewPanel,
  TemplateCategoryFilter
} from '@/components/templates'

import type { TaskTemplate, TemplateFilters, TemplateCategory } from '@/types/task-template'
import { templateHasRequiredVariables } from '@/types/task-template'

import { X, FileText, AlertCircle } from 'lucide-react'

export interface TemplateSelectionModalProps {
  /** Whether the modal is open */
  isOpen: boolean

  /** Callback when modal is closed */
  onClose: () => void

  /** Callback when a template is selected and confirmed */
  onTemplateSelected: (template: TaskTemplate) => void

  /** Initial filters to apply */
  initialFilters?: TemplateFilters

  /** Whether to auto-confirm on selection (skip preview) */
  quickSelect?: boolean

  /** Custom className for styling */
  className?: string
}

/**
 * Modal for selecting task templates with search, filtering, and preview capabilities
 *
 * Features:
 * - Search templates by name, description, or tags
 * - Filter by category with counts
 * - Template preview panel with details
 * - Keyboard navigation support
 * - Responsive layout (stacked on mobile, side-by-side on desktop)
 */
export function TemplateSelectionModal({
  isOpen,
  onClose,
  onTemplateSelected,
  initialFilters = {},
  quickSelect = false,
  className
}: TemplateSelectionModalProps) {
  // Local state
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'all'>('all')

  // Modal refs for focus management
  const modalRef = useRef<HTMLDivElement>(null)

  // Templates hook
  const {
    filteredTemplates,
    isLoading,
    error,
    categoryCounts,
    setFilters,
    refresh
  } = useTemplates({
    initialFilters,
    autoFetch: true
  })

  // Update filters when search or category changes
  useEffect(() => {
    setFilters({
      search: searchQuery || undefined,
      category: selectedCategory === 'all' ? undefined : selectedCategory,
      ...initialFilters
    })
  }, [searchQuery, selectedCategory, initialFilters, setFilters])

  // Focus management and cleanup
  useEffect(() => {
    if (!isOpen) {
      // Clear selections when modal closes
      setSelectedTemplate(null)
      setSearchQuery('')
      setSelectedCategory('all')
    }
  }, [isOpen])

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return

    switch (e.key) {
      case 'Escape':
        e.preventDefault()
        onClose()
        break

      case 'Enter':
        if (selectedTemplate) {
          e.preventDefault()
          onTemplateSelected(selectedTemplate)
        }
        break

      case 'ArrowDown':
      case 'ArrowUp':
        // Navigate to first template in list
        e.preventDefault()
        const firstTemplate = modalRef.current?.querySelector('[data-template-card]') as HTMLElement
        firstTemplate?.focus()
        break
    }
  }, [isOpen, selectedTemplate, onClose, onTemplateSelected, modalRef])

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, handleKeyDown])

  // Template selection handlers
  const handleTemplateClick = (template: TaskTemplate) => {
    setSelectedTemplate(template)

    // If quickSelect is enabled and template has no required variables, auto-confirm
    if (quickSelect && !templateHasRequiredVariables(template)) {
      onTemplateSelected(template)
    }
  }

  const handleTemplateDoubleClick = (template: TaskTemplate) => {
    setSelectedTemplate(template)
    onTemplateSelected(template)
  }

  const handleTemplateConfirm = () => {
    if (selectedTemplate) {
      onTemplateSelected(selectedTemplate)
    }
  }

  // Search handlers
  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
  }

  const handleCategoryChange = (category: TemplateCategory | 'all') => {
    setSelectedCategory(category)
  }

  // Error retry handler
  const handleRetry = () => {
    refresh()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          'max-w-6xl w-full h-[80vh] flex flex-col',
          className
        )}
        ref={modalRef}
      >
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Select Template
          </DialogTitle>
        </DialogHeader>

        {/* Search and Filters */}
        <div className="flex-shrink-0 space-y-4">
          {/* Search Input */}
          <TemplateSearchInput
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search templates by name or tags..."
            className="w-full"
          />

          {/* Category Filter */}
          <TemplateCategoryFilter
            selectedCategory={selectedCategory}
            categoryCounts={categoryCounts}
            onCategoryChange={handleCategoryChange}
            hideEmpty={false}
          />
        </div>

        {/* Main Content */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4">
          {/* Templates List */}
          <div className="flex-1 lg:w-1/2 min-h-0">
            <div className="h-full overflow-y-auto space-y-3 pr-2">
              {/* Loading State */}
              {isLoading && (
                <div className="flex items-center justify-center py-12">
                  <div className="flex items-center gap-2 text-foreground-secondary">
                    <Spinner size="sm" />
                    Loading templates...
                  </div>
                </div>
              )}

              {/* Error State */}
              {error && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-700">
                    {error}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRetry}
                      className="ml-2 text-red-600 hover:text-red-700 hover:bg-red-100"
                    >
                      Try again
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {/* No Results */}
              {!isLoading && !error && filteredTemplates.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="w-12 h-12 text-foreground-secondary/50 mb-3" />
                  <p className="text-foreground-secondary">
                    No templates found
                  </p>
                  <p className="text-sm text-foreground-secondary mt-1">
                    Try adjusting your search or filters
                  </p>
                </div>
              )}

              {/* Templates */}
              {!isLoading && !error && filteredTemplates.map(template => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  isSelected={selectedTemplate?.id === template.id}
                  onClick={handleTemplateClick}
                  onDoubleClick={handleTemplateDoubleClick}
                  data-template-card
                  tabIndex={0}
                  className="focus:ring-2 focus:ring-apex-500 focus:outline-none"
                />
              ))}
            </div>
          </div>

          {/* Preview Panel */}
          <div className="flex-1 lg:w-1/2 min-h-0">
            <div className="h-full">
              <TemplatePreviewPanel
                template={selectedTemplate}
                className="h-full"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="flex-shrink-0">
          <div className="flex items-center justify-between w-full">
            {/* Template count info */}
            <div className="text-sm text-foreground-secondary">
              {isLoading ? (
                'Loading...'
              ) : (
                `${filteredTemplates.length} template${filteredTemplates.length !== 1 ? 's' : ''}`
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                onClick={handleTemplateConfirm}
                disabled={!selectedTemplate}
                className="min-w-[120px]"
              >
                {selectedTemplate && templateHasRequiredVariables(selectedTemplate)
                  ? 'Configure & Use'
                  : 'Use Template'
                }
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}