/**
 * Workflow Properties Form Component
 *
 * Form for editing workflow metadata including name, description,
 * triggers, and isolation settings.
 */

'use client'

import React, { useState, useEffect } from 'react'
import { Plus, X } from 'lucide-react'
import type { WorkflowDefinition } from '@apexcli/core'

interface WorkflowPropertiesFormProps {
  workflow: WorkflowDefinition
  onUpdate: (updates: Partial<WorkflowDefinition>) => void
}

/**
 * Workflow Properties Form Component
 *
 * Form for editing workflow-level properties and metadata.
 */
export function WorkflowPropertiesForm({
  workflow,
  onUpdate,
}: WorkflowPropertiesFormProps) {
  // Form state
  const [formData, setFormData] = useState<WorkflowDefinition>(workflow)
  const [newTrigger, setNewTrigger] = useState('')

  // Update form data when workflow changes
  useEffect(() => {
    setFormData(workflow)
  }, [workflow])

  // Handle field changes
  const handleChange = (field: keyof WorkflowDefinition, value: any) => {
    const updates = { ...formData, [field]: value }
    setFormData(updates)
    onUpdate({ [field]: value })
  }

  // Add trigger
  const addTrigger = () => {
    if (!newTrigger.trim() || formData.trigger?.includes(newTrigger)) return

    const newTriggers = [...(formData.trigger || []), newTrigger]
    handleChange('trigger', newTriggers)
    setNewTrigger('')
  }

  // Remove trigger
  const removeTrigger = (trigger: string) => {
    const newTriggers = formData.trigger?.filter(t => t !== trigger) || []
    handleChange('trigger', newTriggers)
  }

  return (
    <form className="p-4 space-y-6" onSubmit={(e) => e.preventDefault()}>
      {/* Basic Information */}
      <div className="space-y-4">
        <h3 className="font-medium text-gray-900">Basic Information</h3>

        {/* Workflow Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Workflow Name *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-apex-500"
            placeholder="Enter workflow name"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            A unique name for this workflow
          </p>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description *
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-apex-500"
            rows={4}
            placeholder="Describe what this workflow accomplishes"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Explain the purpose and goals of this workflow
          </p>
        </div>
      </div>

      {/* Triggers */}
      <div className="space-y-4">
        <h3 className="font-medium text-gray-900">Triggers</h3>
        <p className="text-sm text-gray-600">
          Events that can initiate this workflow
        </p>

        {/* Current triggers */}
        {formData.trigger && formData.trigger.length > 0 && (
          <div className="space-y-2">
            {formData.trigger.map((trigger, index) => (
              <div
                key={index}
                className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-md"
              >
                <span className="text-sm text-gray-700">{trigger}</span>
                <button
                  type="button"
                  onClick={() => removeTrigger(trigger)}
                  className="text-red-500 hover:text-red-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add trigger */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newTrigger}
            onChange={(e) => setNewTrigger(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addTrigger()}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-apex-500"
            placeholder="e.g., push:main, pull_request, schedule:daily"
          />
          <button
            type="button"
            onClick={addTrigger}
            disabled={!newTrigger}
            className="px-3 py-2 bg-apex-500 text-white rounded-md hover:bg-apex-600 disabled:bg-gray-300"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-blue-50 p-3 rounded-md">
          <h4 className="text-sm font-medium text-blue-900 mb-1">
            Common Trigger Examples:
          </h4>
          <ul className="text-xs text-blue-800 space-y-1">
            <li>• <code>push:main</code> - Triggers on pushes to main branch</li>
            <li>• <code>pull_request</code> - Triggers on pull request events</li>
            <li>• <code>schedule:daily</code> - Triggers on daily schedule</li>
            <li>• <code>manual</code> - Manual trigger only</li>
          </ul>
        </div>
      </div>

      {/* Workflow Statistics */}
      <div className="space-y-4">
        <h3 className="font-medium text-gray-900">Workflow Statistics</h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 p-3 rounded-md">
            <div className="text-sm font-medium text-gray-700">Total Stages</div>
            <div className="text-2xl font-bold text-gray-900">
              {formData.stages?.length || 0}
            </div>
          </div>

          <div className="bg-gray-50 p-3 rounded-md">
            <div className="text-sm font-medium text-gray-700">Total Gates</div>
            <div className="text-2xl font-bold text-gray-900">
              {formData.gates?.length || 0}
            </div>
          </div>
        </div>
      </div>

      {/* Isolation Settings (Advanced) */}
      <div className="space-y-4">
        <h3 className="font-medium text-gray-900">Advanced Settings</h3>

        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
          <h4 className="text-sm font-medium text-yellow-800 mb-1">
            Isolation Configuration
          </h4>
          <p className="text-xs text-yellow-700">
            Isolation settings control the execution environment for this workflow.
            This is an advanced feature that typically doesn't need configuration.
          </p>
          {formData.isolation && (
            <div className="mt-2 text-xs text-yellow-700">
              <strong>Current:</strong> {JSON.stringify(formData.isolation)}
            </div>
          )}
        </div>
      </div>

      {/* Help */}
      <div className="bg-gray-50 p-4 rounded-md">
        <h4 className="text-sm font-medium text-gray-900 mb-2">
          💡 Tips for Better Workflows
        </h4>
        <ul className="text-xs text-gray-700 space-y-1">
          <li>• Use descriptive names that clearly indicate the workflow's purpose</li>
          <li>• Add triggers that match your deployment and development process</li>
          <li>• Keep descriptions concise but informative for team members</li>
          <li>• Consider using semantic versioning in workflow names for versions</li>
        </ul>
      </div>
    </form>
  )
}