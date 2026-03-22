'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { apiClient } from '@/lib/api-client'
import { TemplateSelectionModal } from '@/components/templates/TemplateSelectionModal'
import { SaveTemplateModal } from '@/components/templates/SaveTemplateModal'
import { QuickActionVariableModal } from '@/components/dashboard/QuickActionVariableModal'
import { templateHasRequiredVariables } from '@/types/task-template'
import type { TaskTemplate } from '@/types/task-template'
import { X, Plus, Zap, FileText, Info, Save } from 'lucide-react'

interface CreateTaskDialogProps {
  isOpen: boolean
  onClose: () => void
  onCreated: (taskId: string) => void
}

const WORKFLOWS = [
  { value: 'feature', label: 'Feature', description: 'Add new functionality' },
  { value: 'bugfix', label: 'Bugfix', description: 'Fix an issue' },
  { value: 'refactor', label: 'Refactor', description: 'Improve code structure' },
  { value: 'docs', label: 'Documentation', description: 'Update documentation' },
  { value: 'test', label: 'Test', description: 'Add or improve tests' },
]

const AUTONOMY_LEVELS = [
  { value: 'review-all', label: 'Review All', description: 'Requires approval at each major decision point' },
  { value: 'review-before-commit', label: 'Review Before Commit', description: 'Review code before committing (Recommended)' },
  { value: 'full-auto', label: 'Full Autonomy', description: 'Runs without manual approval' },
]

export function CreateTaskDialog({ isOpen, onClose, onCreated }: CreateTaskDialogProps) {
  const [description, setDescription] = useState('')
  const [acceptanceCriteria, setAcceptanceCriteria] = useState('')
  const [workflow, setWorkflow] = useState('feature')
  const [autonomy, setAutonomy] = useState<'full-auto' | 'review-before-commit' | 'review-all'>('review-before-commit')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Template-related state
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false)
  const [showVariableModal, setShowVariableModal] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(null)
  const [isFromTemplate, setIsFromTemplate] = useState(false)

  // Template selection handlers
  const handleTemplateSelected = (template: TaskTemplate) => {
    setSelectedTemplate(template)
    setShowTemplateModal(false)

    // Check if template has required variables
    if (templateHasRequiredVariables(template)) {
      // Open variable modal for templates with required variables
      setShowVariableModal(true)
    } else {
      // Pre-fill form with template data for templates without variables
      setDescription(template.descriptionTemplate)
      setAcceptanceCriteria(template.acceptanceCriteriaTemplate || '')
      setWorkflow(template.workflow)
      setAutonomy(template.autonomy)
      setIsFromTemplate(true)
    }
  }

  const handleVariableModalTaskCreated = (taskId: string) => {
    // Task was created directly from variable modal, close everything
    setShowVariableModal(false)
    setSelectedTemplate(null)
    resetForm()
    onCreated(taskId)
    onClose()
  }

  const resetForm = () => {
    setDescription('')
    setAcceptanceCriteria('')
    setWorkflow('feature')
    setAutonomy('review-before-commit')
    setSelectedTemplate(null)
    setIsFromTemplate(false)
  }

  const handleSaveAsTemplate = () => {
    if (!description.trim()) {
      setError('Please enter a task description before saving as template')
      return
    }
    setShowSaveTemplateModal(true)
  }

  const handleTemplateSaved = (templateId: string) => {
    setShowSaveTemplateModal(false)
    // Optional: You could show a success message here or redirect to templates
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!description.trim()) {
      setError('Task description is required')
      return
    }

    try {
      setLoading(true)
      setError(null)
      const response = await apiClient.createTask({
        description: description.trim(),
        acceptanceCriteria: acceptanceCriteria.trim() || undefined,
        workflow,
        autonomy,
      })
      onCreated(response.taskId)
      resetForm()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-background-secondary border border-border rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-apex-500/10">
              <Zap className="w-5 h-5 text-apex-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Create New Task</h2>
              {isFromTemplate && selectedTemplate && (
                <p className="text-sm text-foreground-secondary">
                  From template: {selectedTemplate.name}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowTemplateModal(true)}
              disabled={loading}
            >
              <FileText className="w-4 h-4 mr-2" />
              Use Template
            </Button>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-background-tertiary transition-colors"
            >
              <X className="w-5 h-5 text-foreground-secondary" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Template Info */}
          {isFromTemplate && selectedTemplate && (
            <Alert className="border-blue-200 bg-blue-50">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-700 flex items-center justify-between">
                <span>Form pre-filled from template: <strong>{selectedTemplate.name}</strong></span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    resetForm()
                    setError(null)
                  }}
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-100 h-auto p-1"
                >
                  Clear
                </Button>
              </AlertDescription>
            </Alert>
          )}
          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Task Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what you want to accomplish..."
              className="w-full px-3 py-2 bg-background-tertiary border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-apex-500 resize-none"
              rows={3}
              autoFocus
            />
          </div>

          {/* Acceptance Criteria */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Acceptance Criteria <span className="text-foreground-secondary">(optional)</span>
            </label>
            <textarea
              value={acceptanceCriteria}
              onChange={(e) => setAcceptanceCriteria(e.target.value)}
              placeholder="Define when the task is complete..."
              className="w-full px-3 py-2 bg-background-tertiary border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-apex-500 resize-none"
              rows={2}
            />
          </div>

          {/* Workflow Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Workflow</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {WORKFLOWS.map((w) => (
                <button
                  key={w.value}
                  type="button"
                  onClick={() => setWorkflow(w.value)}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    workflow === w.value
                      ? 'border-apex-500 bg-apex-500/10'
                      : 'border-border hover:border-apex-500/50 hover:bg-background-tertiary'
                  }`}
                >
                  <div className="font-medium text-sm">{w.label}</div>
                  <div className="text-xs text-foreground-secondary">{w.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Autonomy Level */}
          <div>
            <label className="block text-sm font-medium mb-2">Autonomy Level</label>
            <div className="space-y-2">
              {AUTONOMY_LEVELS.map((a) => (
                <button
                  key={a.value}
                  type="button"
                  onClick={() => setAutonomy(a.value as typeof autonomy)}
                  className={`w-full p-3 rounded-lg border text-left transition-colors ${
                    autonomy === a.value
                      ? 'border-apex-500 bg-apex-500/10'
                      : 'border-border hover:border-apex-500/50 hover:bg-background-tertiary'
                  }`}
                >
                  <div className="font-medium text-sm">{a.label}</div>
                  <div className="text-xs text-foreground-secondary">{a.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 rounded-md bg-red-500/10 border border-red-500/30">
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleSaveAsTemplate}
              disabled={loading || !description.trim()}
              className="text-foreground-secondary hover:text-foreground"
            >
              <Save className="w-4 h-4 mr-2" />
              Save as Template
            </Button>
            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={loading || !description.trim()}>
                {loading ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Task
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>

      {/* Template Selection Modal */}
      <TemplateSelectionModal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        onTemplateSelected={handleTemplateSelected}
      />

      {/* Save Template Modal */}
      <SaveTemplateModal
        isOpen={showSaveTemplateModal}
        onClose={() => setShowSaveTemplateModal(false)}
        onSaved={handleTemplateSaved}
        taskData={{
          description,
          acceptanceCriteria: acceptanceCriteria || undefined,
          workflow,
          autonomy,
        }}
      />

      {/* Variable Modal for templates with required variables */}
      {selectedTemplate && showVariableModal && (
        <QuickActionVariableModal
          isOpen={showVariableModal}
          template={selectedTemplate}
          onClose={() => {
            setShowVariableModal(false)
            setSelectedTemplate(null)
          }}
          onTaskCreated={handleVariableModalTaskCreated}
          onError={(error) => setError(error.message)}
        />
      )}
    </div>
  )
}
