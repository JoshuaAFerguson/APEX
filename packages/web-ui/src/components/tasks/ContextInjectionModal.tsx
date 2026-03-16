'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { apiClient } from '@/lib/api-client'
import { X, MessageSquarePlus, Send } from 'lucide-react'
import type { InjectContextRequest, InjectContextResponse } from '@apexcli/core'

export interface ContextInjectionModalProps {
  /** Whether the modal is visible */
  isOpen: boolean
  /** The task ID to inject context into */
  taskId: string
  /** Callback when modal is closed */
  onClose: () => void
  /** Callback when context is successfully injected */
  onInjected?: (response: InjectContextResponse) => void
}

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', description: 'Background information' },
  { value: 'normal', label: 'Normal', description: 'Standard context (Recommended)' },
  { value: 'high', label: 'High', description: 'Important context' },
] as const

export function ContextInjectionModal({ isOpen, taskId, onClose, onInjected }: ContextInjectionModalProps) {
  const [context, setContext] = useState('')
  const [source, setSource] = useState('')
  const [priority, setPriority] = useState<'low' | 'normal' | 'high'>('normal')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!context.trim()) {
      setError('Context is required')
      return
    }

    if (context.length > 100000) {
      setError('Context cannot exceed 100,000 characters')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const request: InjectContextRequest = {
        context: context.trim(),
        ...(source.trim() && { source: source.trim() }),
        priority,
      }

      const response = await apiClient.injectContext(taskId, request)
      onInjected?.(response)

      // Reset form
      setContext('')
      setSource('')
      setPriority('normal')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to inject context')
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

  const remainingChars = 100000 - context.length

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
              <MessageSquarePlus className="w-5 h-5 text-apex-500" />
            </div>
            <h2 id="modal-title" className="text-lg font-semibold">Inject Context</h2>
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
          {/* Context */}
          <div>
            <label htmlFor="context-input" className="block text-sm font-medium mb-2">
              Context <span className="text-red-500">*</span>
            </label>
            <textarea
              id="context-input"
              value={context}
              onChange={(e) => {
                setContext(e.target.value)
                if (error) setError(null) // Clear error on new input
              }}
              placeholder="Enter context information to inject into the task..."
              className="w-full px-3 py-2 bg-background-tertiary border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-apex-500 resize-none"
              rows={6}
              autoFocus
              disabled={loading}
            />
            <div className="mt-1 text-xs text-foreground-secondary">
              {remainingChars >= 0 ? (
                `${remainingChars.toLocaleString()} characters remaining`
              ) : (
                <span className="text-red-500">Exceeds limit by {Math.abs(remainingChars).toLocaleString()} characters</span>
              )}
            </div>
          </div>

          {/* Source (optional) */}
          <div>
            <label htmlFor="source-input" className="block text-sm font-medium mb-2">
              Source <span className="text-foreground-secondary">(optional)</span>
            </label>
            <input
              id="source-input"
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="e.g., documentation, meeting notes, user feedback..."
              className="w-full px-3 py-2 bg-background-tertiary border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-apex-500"
              maxLength={50}
              disabled={loading}
            />
            <div className="mt-1 text-xs text-foreground-secondary">
              {source.length}/50 characters
            </div>
          </div>

          {/* Priority Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Priority</label>
            <div className="space-y-2">
              {PRIORITY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPriority(option.value)}
                  disabled={loading}
                  className={`w-full p-3 rounded-lg border text-left transition-colors disabled:opacity-50 ${
                    priority === option.value
                      ? 'border-apex-500 bg-apex-500/10'
                      : 'border-border hover:border-apex-500/50 hover:bg-background-tertiary'
                  }`}
                >
                  <div className="font-medium text-sm">{option.label}</div>
                  <div className="text-xs text-foreground-secondary">{option.description}</div>
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
            <Button type="button" variant="secondary" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={loading || !context.trim() || context.length > 100000}
            >
              {loading ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Injecting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Inject Context
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}