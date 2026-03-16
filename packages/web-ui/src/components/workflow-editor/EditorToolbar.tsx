/**
 * Editor Toolbar Component
 *
 * Toolbar with actions for saving, importing, exporting,
 * and managing the workflow. Includes undo/redo functionality.
 */

'use client'

import React from 'react'
import {
  Save,
  Upload,
  Download,
  Undo,
  Redo,
  Play,
  Eye,
  EyeOff,
  Grid,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWorkflowEditorContext } from './WorkflowEditorProvider'

interface EditorToolbarProps {
  onSave?: () => void
  onPreview?: () => void
  showYamlPreview?: boolean
  onToggleYamlPreview?: () => void
  className?: string
}

/**
 * Editor Toolbar Component
 *
 * Main toolbar for workflow editor actions and controls.
 */
export function EditorToolbar({
  onSave,
  onPreview,
  showYamlPreview = true,
  onToggleYamlPreview,
  className,
}: EditorToolbarProps) {
  const {
    state,
    exportYaml,
    importYaml,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useWorkflowEditorContext()

  // Handle save
  const handleSave = () => {
    if (onSave) {
      onSave()
    } else {
      // Default save behavior - download YAML
      const yaml = exportYaml()
      const blob = new Blob([yaml], { type: 'application/yaml' })
      const url = URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.href = url
      link.download = `${(state.workflow.name || 'workflow').replace(/\s+/g, '-').toLowerCase()}.yml`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      URL.revokeObjectURL(url)
    }
  }

  // Handle file import
  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.yml,.yaml'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (event) => {
        const content = event.target?.result as string
        importYaml(content)
      }
      reader.readAsText(file)
    }
    input.click()
  }

  // Handle export
  const handleExport = () => {
    const yaml = exportYaml()
    const blob = new Blob([yaml], { type: 'application/yaml' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = `${(state.workflow.name || 'workflow').replace(/\s+/g, '-').toLowerCase()}.yml`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    URL.revokeObjectURL(url)
  }

  return (
    <div className={cn(
      "flex items-center justify-between p-4 bg-white border-b border-gray-200",
      className
    )}>
      {/* Left side - Main actions */}
      <div className="flex items-center gap-2">
        {/* Save */}
        <button
          onClick={handleSave}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-md font-medium text-sm transition-colors",
            state.isDirty
              ? "bg-apex-500 text-white hover:bg-apex-600"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          )}
          title="Save workflow (Ctrl+S)"
        >
          <Save className="w-4 h-4" />
          Save
          {state.isDirty && (
            <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
          )}
        </button>

        <div className="h-6 w-px bg-gray-300"></div>

        {/* Import/Export */}
        <button
          onClick={handleImport}
          className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          title="Import workflow from YAML (Ctrl+I)"
        >
          <Upload className="w-4 h-4" />
          Import
        </button>

        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          title="Export workflow as YAML (Ctrl+E)"
        >
          <Download className="w-4 h-4" />
          Export
        </button>

        <div className="h-6 w-px bg-gray-300"></div>

        {/* Undo/Redo */}
        <button
          onClick={undo}
          disabled={!canUndo}
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors disabled:text-gray-400 disabled:hover:bg-transparent"
          title="Undo (Ctrl+Z)"
        >
          <Undo className="w-4 h-4" />
        </button>

        <button
          onClick={redo}
          disabled={!canRedo}
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors disabled:text-gray-400 disabled:hover:bg-transparent"
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo className="w-4 h-4" />
        </button>
      </div>

      {/* Center - Workflow info */}
      <div className="flex items-center gap-4">
        <div className="text-center">
          <div className="font-medium text-gray-900">
            {state.workflow.name}
          </div>
          <div className="text-xs text-gray-600">
            {state.workflow.stages?.length || 0} stages
            {state.workflow.gates && state.workflow.gates.length > 0 && (
              <span> • {state.workflow.gates.length} gates</span>
            )}
          </div>
        </div>

        {/* Validation status */}
        <div className="flex items-center gap-2">
          {state.validationErrors.length > 0 ? (
            <div className="flex items-center gap-1 text-red-600">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <span className="text-xs">
                {state.validationErrors.filter(e => e.type === 'error').length} errors
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-green-600">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-xs">Valid</span>
            </div>
          )}
        </div>
      </div>

      {/* Right side - View controls */}
      <div className="flex items-center gap-2">
        {/* Preview button */}
        {onPreview && (
          <button
            onClick={onPreview}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
            title="Preview workflow execution"
          >
            <Play className="w-4 h-4" />
            Preview
          </button>
        )}

        {/* Toggle YAML preview */}
        {onToggleYamlPreview && (
          <button
            onClick={onToggleYamlPreview}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-md transition-colors",
              showYamlPreview
                ? "bg-gray-100 text-gray-900"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            )}
            title="Toggle YAML preview"
          >
            {showYamlPreview ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
            YAML
          </button>
        )}

        {/* Layout controls */}
        <button
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          title="Auto-layout stages"
        >
          <Grid className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}