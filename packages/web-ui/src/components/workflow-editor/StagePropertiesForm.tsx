/**
 * Stage Properties Form Component
 *
 * Form for editing workflow stage properties including name,
 * agent, description, dependencies, outputs, and other configuration.
 */

'use client'

import React, { useState, useEffect } from 'react'
import { Trash2, Plus, X } from 'lucide-react'
import type { WorkflowStage } from '@apexcli/core'
import { cn } from '@/lib/utils'
import { AGENT_OPTIONS } from '@/lib/workflow-editor/constants'

interface StagePropertiesFormProps {
  stage: WorkflowStage
  onUpdate: (updates: Partial<WorkflowStage>) => void
  allStageNames: string[]
}

/**
 * Stage Properties Form Component
 *
 * Comprehensive form for editing all stage properties with validation.
 */
export function StagePropertiesForm({
  stage,
  onUpdate,
  allStageNames,
}: StagePropertiesFormProps) {
  // Form state
  const [formData, setFormData] = useState<WorkflowStage>(stage)
  const [newDependency, setNewDependency] = useState('')
  const [newOutput, setNewOutput] = useState('')
  const [newInput, setNewInput] = useState('')

  // Update form data when stage changes
  useEffect(() => {
    setFormData(stage)
  }, [stage])

  // Handle field changes
  const handleChange = (field: keyof WorkflowStage, value: any) => {
    const updates = { ...formData, [field]: value }
    setFormData(updates)
    onUpdate({ [field]: value })
  }

  // Handle array field changes
  const handleArrayChange = (field: 'dependsOn' | 'outputs' | 'inputs', newArray: string[]) => {
    const updates = { ...formData, [field]: newArray }
    setFormData(updates)
    onUpdate({ [field]: newArray })
  }

  // Add dependency
  const addDependency = () => {
    if (!newDependency.trim() || formData.dependsOn?.includes(newDependency)) return

    const newDependencies = [...(formData.dependsOn || []), newDependency]
    handleArrayChange('dependsOn', newDependencies)
    setNewDependency('')
  }

  // Remove dependency
  const removeDependency = (dep: string) => {
    const newDependencies = formData.dependsOn?.filter(d => d !== dep) || []
    handleArrayChange('dependsOn', newDependencies)
  }

  // Add output
  const addOutput = () => {
    if (!newOutput.trim() || formData.outputs?.includes(newOutput)) return

    const newOutputs = [...(formData.outputs || []), newOutput]
    handleArrayChange('outputs', newOutputs)
    setNewOutput('')
  }

  // Remove output
  const removeOutput = (output: string) => {
    const newOutputs = formData.outputs?.filter(o => o !== output) || []
    handleArrayChange('outputs', newOutputs)
  }

  // Add input
  const addInput = () => {
    if (!newInput.trim() || formData.inputs?.includes(newInput)) return

    const newInputs = [...(formData.inputs || []), newInput]
    handleArrayChange('inputs', newInputs)
    setNewInput('')
  }

  // Remove input
  const removeInput = (input: string) => {
    const newInputs = formData.inputs?.filter(i => i !== input) || []
    handleArrayChange('inputs', newInputs)
  }

  // Available stages for dependencies (excluding current stage)
  const availableStages = allStageNames.filter(name => name !== stage.name)

  return (
    <form className="p-4 space-y-6" onSubmit={(e) => e.preventDefault()}>
      {/* Basic Information */}
      <div className="space-y-4">
        <h3 className="font-medium text-gray-900">Basic Information</h3>

        {/* Stage Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Stage Name
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-apex-500"
            placeholder="Enter stage name"
          />
        </div>

        {/* Agent */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Agent
          </label>
          <select
            value={formData.agent}
            onChange={(e) => handleChange('agent', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-apex-500"
          >
            {AGENT_OPTIONS.map(agent => (
              <option key={agent} value={agent}>
                {agent}
              </option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            value={formData.description || ''}
            onChange={(e) => handleChange('description', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-apex-500"
            rows={3}
            placeholder="Describe what this stage does"
          />
        </div>
      </div>

      {/* Dependencies */}
      <div className="space-y-4">
        <h3 className="font-medium text-gray-900">Dependencies</h3>

        {/* Current dependencies */}
        {formData.dependsOn && formData.dependsOn.length > 0 && (
          <div className="space-y-2">
            {formData.dependsOn.map((dep) => (
              <div
                key={dep}
                className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-md"
              >
                <span className="text-sm text-gray-700">{dep}</span>
                <button
                  type="button"
                  onClick={() => removeDependency(dep)}
                  className="text-red-500 hover:text-red-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add dependency */}
        <div className="flex gap-2">
          <select
            value={newDependency}
            onChange={(e) => setNewDependency(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-apex-500"
          >
            <option value="">Select stage dependency</option>
            {availableStages.map(stageName => (
              <option key={stageName} value={stageName}>
                {stageName}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={addDependency}
            disabled={!newDependency}
            className="px-3 py-2 bg-apex-500 text-white rounded-md hover:bg-apex-600 disabled:bg-gray-300"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Outputs */}
      <div className="space-y-4">
        <h3 className="font-medium text-gray-900">Outputs</h3>

        {/* Current outputs */}
        {formData.outputs && formData.outputs.length > 0 && (
          <div className="space-y-2">
            {formData.outputs.map((output) => (
              <div
                key={output}
                className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-md"
              >
                <span className="text-sm text-gray-700">{output}</span>
                <button
                  type="button"
                  onClick={() => removeOutput(output)}
                  className="text-red-500 hover:text-red-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add output */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newOutput}
            onChange={(e) => setNewOutput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addOutput()}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-apex-500"
            placeholder="Output name"
          />
          <button
            type="button"
            onClick={addOutput}
            disabled={!newOutput}
            className="px-3 py-2 bg-apex-500 text-white rounded-md hover:bg-apex-600 disabled:bg-gray-300"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Inputs */}
      <div className="space-y-4">
        <h3 className="font-medium text-gray-900">Inputs</h3>

        {/* Current inputs */}
        {formData.inputs && formData.inputs.length > 0 && (
          <div className="space-y-2">
            {formData.inputs.map((input) => (
              <div
                key={input}
                className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-md"
              >
                <span className="text-sm text-gray-700">{input}</span>
                <button
                  type="button"
                  onClick={() => removeInput(input)}
                  className="text-red-500 hover:text-red-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newInput}
            onChange={(e) => setNewInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addInput()}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-apex-500"
            placeholder="Input name"
          />
          <button
            type="button"
            onClick={addInput}
            disabled={!newInput}
            className="px-3 py-2 bg-apex-500 text-white rounded-md hover:bg-apex-600 disabled:bg-gray-300"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Advanced Options */}
      <div className="space-y-4">
        <h3 className="font-medium text-gray-900">Advanced Options</h3>

        {/* Parallel execution */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="parallel"
            checked={formData.parallel || false}
            onChange={(e) => handleChange('parallel', e.target.checked)}
            className="h-4 w-4 text-apex-600 focus:ring-apex-500 border-gray-300 rounded"
          />
          <label htmlFor="parallel" className="ml-2 text-sm text-gray-700">
            Allow parallel execution
          </label>
        </div>

        {/* Condition */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Condition (optional)
          </label>
          <input
            type="text"
            value={formData.condition || ''}
            onChange={(e) => handleChange('condition', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-apex-500"
            placeholder="Conditional expression"
          />
        </div>

        {/* Max Retries */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Max Retries
          </label>
          <input
            type="number"
            min="0"
            max="10"
            value={formData.maxRetries || 2}
            onChange={(e) => handleChange('maxRetries', parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-apex-500"
          />
        </div>

        {/* Gate */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Gate (optional)
          </label>
          <input
            type="text"
            value={formData.gate || ''}
            onChange={(e) => handleChange('gate', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-apex-500"
            placeholder="Gate ID"
          />
        </div>
      </div>
    </form>
  )
}