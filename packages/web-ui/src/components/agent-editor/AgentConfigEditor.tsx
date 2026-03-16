/**
 * AgentConfigEditor Component
 *
 * Main editor component that combines AgentForm and AgentPreview
 * in a split-pane layout with save/cancel actions. Supports both
 * creating new agents and editing existing ones.
 */

'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { AgentForm } from '@/components/forms/AgentForm'
import { AgentPreview } from './AgentPreview'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { apiClient } from '@/lib/api-client'
import {
  type AgentFormData,
  validateAgentForm,
  toAgentDefinition,
  fromAgentDefinition,
} from '@/lib/schemas/agent-schema'
import type { MultiSelectOption } from '@/components/ui/MultiSelect'
import type { AgentDefinition } from '@apexcli/core'

interface AgentConfigEditorProps {
  /** Agent ID for edit mode - if provided, loads and edits existing agent */
  agentId?: string
  /** Additional CSS class names */
  className?: string
}

/**
 * AgentConfigEditor Component
 *
 * Provides a complete agent editing experience with:
 * - Split-pane layout (form on left, preview on right)
 * - Create and edit modes
 * - Real-time form validation
 * - Live preview with syntax highlighting
 * - Save/cancel actions with API integration
 * - Loading states and error handling
 */
export function AgentConfigEditor({ agentId, className }: AgentConfigEditorProps) {
  const router = useRouter()

  // Form state
  const [formData, setFormData] = useState<AgentFormData>({
    name: '',
    description: '',
    prompt: '',
    model: 'sonnet',
    tools: [],
    skills: [],
  })
  const [isFormValid, setIsFormValid] = useState(false)

  // UI state
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Editor mode
  const isEditMode = Boolean(agentId)
  const pageTitle = isEditMode ? 'Edit Agent' : 'Create Agent'

  // Mock data for available tools and skills - in a real app this would come from API
  const availableTools: MultiSelectOption[] = [
    { value: 'web-search', label: 'Web Search' },
    { value: 'file-read', label: 'File Read' },
    { value: 'file-write', label: 'File Write' },
    { value: 'bash', label: 'Bash' },
    { value: 'code-analysis', label: 'Code Analysis' },
  ]

  const availableSkills: MultiSelectOption[] = [
    { value: 'problem-solving', label: 'Problem Solving' },
    { value: 'code-review', label: 'Code Review' },
    { value: 'documentation', label: 'Documentation' },
    { value: 'testing', label: 'Testing' },
    { value: 'debugging', label: 'Debugging' },
  ]

  // Load existing agent data if in edit mode
  useEffect(() => {
    if (isEditMode && agentId) {
      loadAgent()
    }
  }, [isEditMode, agentId])

  const loadAgent = async () => {
    if (!agentId) return

    setIsLoading(true)
    setLoadError(null)

    try {
      const agent = await apiClient.getAgent(agentId)
      const formData = fromAgentDefinition(agent)
      setFormData(formData)

      // Validate the loaded data
      const validation = validateAgentForm(formData)
      setIsFormValid(validation.success)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load agent'
      setLoadError(message)
    } finally {
      setIsLoading(false)
    }
  }

  // Handle form data changes and validation
  const handleFormChange = useCallback((data: AgentFormData) => {
    setFormData(data)

    // Validate form data
    const validation = validateAgentForm(data)
    setIsFormValid(validation.success)

    // Clear any previous save errors/success
    setSaveError(null)
    setSaveSuccess(false)
  }, [])

  // Handle form submission
  const handleSubmit = async (data: AgentFormData) => {
    setIsSubmitting(true)
    setSaveError(null)
    setSaveSuccess(false)

    try {
      // Convert form data to agent definition
      const agentDefinition = toAgentDefinition(data)

      if (isEditMode && agentId) {
        // Update existing agent
        await apiClient.updateAgent(agentId, agentDefinition)
      } else {
        // Create new agent
        await apiClient.createAgent(agentDefinition)
      }

      setSaveSuccess(true)

      // Navigate back to agents list after a brief delay
      setTimeout(() => {
        router.push('/agents')
      }, 1500)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save agent'
      setSaveError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle form cancellation
  const handleCancel = () => {
    router.push('/agents')
  }

  // Loading state for initial load
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" className="mb-4" />
          <p className="text-foreground-secondary">Loading agent...</p>
        </div>
      </div>
    )
  }

  // Error state for load failure
  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-red-500 mb-4">{loadError}</p>
              <div className="space-x-2">
                <Button variant="secondary" onClick={() => router.push('/agents')}>
                  Back to Agents
                </Button>
                <Button onClick={loadAgent}>
                  Retry
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={cn('min-h-screen flex flex-col bg-background', className)}>
      {/* Header */}
      <div className="border-b border-border-secondary bg-background-secondary">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold">{pageTitle}</h1>
              {isEditMode && agentId && (
                <Badge variant="info">Editing: {agentId}</Badge>
              )}
            </div>

            {/* Success/Error Messages */}
            {saveSuccess && (
              <Badge variant="success">
                Agent saved successfully! Redirecting...
              </Badge>
            )}
            {saveError && (
              <Badge variant="error">
                {saveError}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Main Content - Split Pane Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Agent Form */}
        <div className="w-1/2 border-r border-border-secondary overflow-auto">
          <div className="p-6">
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold">Agent Configuration</h2>
                <p className="text-sm text-foreground-secondary">
                  Configure your agent's behavior, capabilities, and settings.
                </p>
              </CardHeader>
              <CardContent>
                <AgentForm
                  initialData={formData}
                  onSubmit={handleSubmit}
                  onCancel={handleCancel}
                  availableTools={availableTools}
                  availableSkills={availableSkills}
                  isSubmitting={isSubmitting}
                  onChange={handleFormChange}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right Panel - Live Preview */}
        <div className="w-1/2 overflow-auto">
          <div className="p-6">
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold">Live Preview</h2>
                <p className="text-sm text-foreground-secondary">
                  Real-time preview of your agent definition file.
                </p>
              </CardHeader>
              <CardContent>
                <AgentPreview
                  data={formData}
                  isValid={isFormValid}
                  showValidationStatus={true}
                  showCopyButton={true}
                  showDownloadButton={true}
                  maxHeight="calc(100vh - 300px)"
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="border-t border-border-secondary bg-background-secondary">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <span className="text-sm text-foreground-secondary">
                {isEditMode ? 'Editing' : 'Creating'} agent configuration
              </span>
              {!isFormValid && (
                <Badge variant="warning">
                  Form contains validation errors
                </Badge>
              )}
            </div>

            <div className="flex items-center space-x-3">
              <Button
                variant="secondary"
                onClick={handleCancel}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleSubmit(formData)}
                disabled={!isFormValid || isSubmitting}
                className="min-w-24"
              >
                {isSubmitting ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Saving...
                  </>
                ) : (
                  isEditMode ? 'Update Agent' : 'Create Agent'
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}