'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { apiClient } from '@/lib/api-client'
import { X, Plus, Zap } from 'lucide-react'

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
  { value: 'manual', label: 'Manual', description: 'Requires approval at each stage' },
  { value: 'review-before-commit', label: 'Review Before Commit', description: 'Review code before committing' },
  { value: 'review-before-merge', label: 'Review Before Merge', description: 'Review PR before merging (Recommended)' },
  { value: 'full', label: 'Full Autonomy', description: 'Runs without manual approval' },
]

export function CreateTaskDialog({ isOpen, onClose, onCreated }: CreateTaskDialogProps) {
  const [description, setDescription] = useState('')
  const [acceptanceCriteria, setAcceptanceCriteria] = useState('')
  const [workflow, setWorkflow] = useState('feature')
  const [autonomy, setAutonomy] = useState<'full' | 'review-before-commit' | 'review-before-merge' | 'manual'>('review-before-merge')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      // Reset form
      setDescription('')
      setAcceptanceCriteria('')
      setWorkflow('feature')
      setAutonomy('review-before-merge')
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
            <h2 className="text-lg font-semibold">Create New Task</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-background-tertiary transition-colors"
          >
            <X className="w-5 h-5 text-foreground-secondary" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
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
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
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
        </form>
      </div>
    </div>
  )
}
