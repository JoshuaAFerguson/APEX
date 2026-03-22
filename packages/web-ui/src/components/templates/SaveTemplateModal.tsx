'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { apiClient } from '@/lib/api-client'
import { X, Save, FileText, Tag, Layers, AlertCircle } from 'lucide-react'
import type { CreateTemplateRequest, TemplateCategory } from '@/types/task-template'
import type { AutonomyLevel } from '@apexcli/core'

export interface SaveTemplateModalProps {
  /** Whether the modal is visible */
  isOpen: boolean
  /** Callback when modal is closed */
  onClose: () => void
  /** Callback when template is successfully saved */
  onSaved?: (templateId: string) => void
  /** Task data to pre-fill the template */
  taskData: {
    description: string
    acceptanceCriteria?: string
    workflow: string
    autonomy: AutonomyLevel
  }
}

const TEMPLATE_CATEGORIES = [
  { value: 'feature', label: 'Feature', description: 'New feature implementation' },
  { value: 'bugfix', label: 'Bug Fix', description: 'Bug fixes and patches' },
  { value: 'refactoring', label: 'Refactoring', description: 'Code refactoring tasks' },
  { value: 'testing', label: 'Testing', description: 'Test creation and improvements' },
  { value: 'documentation', label: 'Documentation', description: 'Documentation tasks' },
  { value: 'maintenance', label: 'Maintenance', description: 'Maintenance and chores' },
  { value: 'deployment', label: 'Deployment', description: 'Deployment and release tasks' },
  { value: 'custom', label: 'Custom', description: 'User-defined category' },
] as const

export function SaveTemplateModal({ isOpen, onClose, onSaved, taskData }: SaveTemplateModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<TemplateCategory>('custom')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setName('')
      setDescription('')
      setCategory('custom')
      setTags([])
      setTagInput('')
      setError(null)
      setSuccess(false)
    }
  }, [isOpen])

  const handleAddTag = () => {
    const trimmedTag = tagInput.trim().toLowerCase()
    if (trimmedTag && !tags.includes(trimmedTag) && tags.length < 10) {
      setTags([...tags, trimmedTag])
      setTagInput('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove))
  }

  const handleTagInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTag()
    } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      // Remove last tag on backspace when input is empty
      setTags(tags.slice(0, -1))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      setError('Template name is required')
      return
    }

    if (!description.trim()) {
      setError('Template description is required')
      return
    }

    if (name.length > 100) {
      setError('Template name cannot exceed 100 characters')
      return
    }

    if (description.length > 500) {
      setError('Template description cannot exceed 500 characters')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const request: CreateTemplateRequest = {
        name: name.trim(),
        description: description.trim(),
        category,
        workflow: taskData.workflow,
        autonomy: taskData.autonomy,
        descriptionTemplate: taskData.description,
        acceptanceCriteriaTemplate: taskData.acceptanceCriteria || undefined,
        tags: tags.length > 0 ? tags : undefined,
        isQuickAction: false,
        priority: 'normal',
        effort: 'medium',
      }

      const template = await apiClient.createTemplate(request)

      setSuccess(true)
      onSaved?.(template.id)

      // Auto-close after a short delay to show success message
      setTimeout(() => {
        onClose()
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Dialog */}
      <div className="relative bg-background-secondary border border-border rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto" role="dialog" aria-labelledby="modal-title">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-apex-500/10">
              <FileText className="w-5 h-5 text-apex-500" />
            </div>
            <h2 id="modal-title" className="text-lg font-semibold">Save as Template</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="p-1 rounded hover:bg-background-tertiary transition-colors disabled:opacity-50"
            aria-label="Close modal"
          >
            <X className="w-5 h-5 text-foreground-secondary" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4" role="form">
          {/* Success Message */}
          {success && (
            <Alert className="border-green-200 bg-green-50">
              <FileText className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700">
                Template saved successfully! Closing in a moment...
              </AlertDescription>
            </Alert>
          )}

          {/* Template Name */}
          <div>
            <label htmlFor="template-name" className="block text-sm font-medium mb-2">
              Template Name <span className="text-red-500">*</span>
            </label>
            <input
              id="template-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (error) setError(null) // Clear error on new input
              }}
              placeholder="e.g., Feature Implementation Template"
              className="w-full px-3 py-2 bg-background-tertiary border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-apex-500"
              maxLength={100}
              autoFocus
              disabled={loading || success}
            />
            <div className="mt-1 text-xs text-foreground-secondary">
              {name.length}/100 characters
            </div>
          </div>

          {/* Template Description */}
          <div>
            <label htmlFor="template-description" className="block text-sm font-medium mb-2">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              id="template-description"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value)
                if (error) setError(null)
              }}
              placeholder="Briefly describe what this template is for..."
              className="w-full px-3 py-2 bg-background-tertiary border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-apex-500 resize-none"
              rows={3}
              maxLength={500}
              disabled={loading || success}
            />
            <div className="mt-1 text-xs text-foreground-secondary">
              {description.length}/500 characters
            </div>
          </div>

          {/* Category Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">
              <Layers className="w-4 h-4 inline mr-1" />
              Category
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {TEMPLATE_CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  disabled={loading || success}
                  className={`p-3 rounded-lg border text-left transition-colors disabled:opacity-50 ${
                    category === cat.value
                      ? 'border-apex-500 bg-apex-500/10'
                      : 'border-border hover:border-apex-500/50 hover:bg-background-tertiary'
                  }`}
                >
                  <div className="font-medium text-sm">{cat.label}</div>
                  <div className="text-xs text-foreground-secondary">{cat.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label htmlFor="template-tags" className="block text-sm font-medium mb-2">
              <Tag className="w-4 h-4 inline mr-1" />
              Tags <span className="text-foreground-secondary">(optional)</span>
            </label>

            {/* Tag Display */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-apex-500/10 text-apex-500 rounded-md text-sm"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      disabled={loading || success}
                      className="hover:text-apex-700 disabled:opacity-50"
                      aria-label={`Remove ${tag} tag`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Tag Input */}
            <div className="flex gap-2">
              <input
                id="template-tags"
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagInputKeyDown}
                placeholder="Add tags to help organize this template..."
                className="flex-1 px-3 py-2 bg-background-tertiary border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-apex-500"
                maxLength={30}
                disabled={loading || success || tags.length >= 10}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={handleAddTag}
                disabled={!tagInput.trim() || tags.length >= 10 || loading || success}
                className="px-3"
              >
                Add
              </Button>
            </div>
            <div className="mt-1 text-xs text-foreground-secondary">
              {tags.length}/10 tags • Press Enter to add
            </div>
          </div>

          {/* Template Preview */}
          <div className="p-3 rounded-md bg-background-tertiary border border-border">
            <div className="text-sm font-medium mb-2 text-foreground-secondary">Template Preview</div>
            <div className="text-sm space-y-2">
              <div>
                <span className="font-medium">Task Description:</span>
                <div className="mt-1 text-foreground-secondary italic">
                  {taskData.description || 'No description provided'}
                </div>
              </div>
              {taskData.acceptanceCriteria && (
                <div>
                  <span className="font-medium">Acceptance Criteria:</span>
                  <div className="mt-1 text-foreground-secondary italic">
                    {taskData.acceptanceCriteria}
                  </div>
                </div>
              )}
              <div className="flex gap-4 text-xs">
                <span><strong>Workflow:</strong> {taskData.workflow}</span>
                <span><strong>Autonomy:</strong> {taskData.autonomy}</span>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-700">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="secondary"
              onClick={handleClose}
              disabled={loading || success}
            >
              {success ? 'Done' : 'Cancel'}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={loading || success || !name.trim() || !description.trim()}
            >
              {loading ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Template
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}