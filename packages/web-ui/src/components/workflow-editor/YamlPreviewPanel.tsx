/**
 * YAML Preview Panel Component
 *
 * Panel that shows live YAML output of the current workflow
 * with syntax highlighting and copy/download functionality.
 */

'use client'

import React, { useState } from 'react'
import { Copy, Download, FileText, Check, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWorkflowEditorContext } from './WorkflowEditorProvider'

interface YamlPreviewPanelProps {
  className?: string
  onImport?: (yaml: string) => void
}

/**
 * YAML Preview Panel Component
 *
 * Shows the current workflow as YAML with import/export functionality.
 */
export function YamlPreviewPanel({
  className,
  onImport,
}: YamlPreviewPanelProps) {
  const { state, exportYaml, importYaml } = useWorkflowEditorContext()
  const [copied, setCopied] = useState(false)
  const [importText, setImportText] = useState('')
  const [showImport, setShowImport] = useState(false)

  // Handle copy to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(state.yamlPreview)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
    }
  }

  // Handle download
  const handleDownload = () => {
    const yaml = exportYaml()
    const blob = new Blob([yaml], { type: 'application/yaml' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = `${state.workflow.name.replace(/\s+/g, '-').toLowerCase()}.yml`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    URL.revokeObjectURL(url)
  }

  // Handle import
  const handleImport = () => {
    if (!importText.trim()) return

    const result = importYaml(importText)
    if (result.success) {
      setImportText('')
      setShowImport(false)
      onImport?.(importText)
    } else {
      // Show errors - in a real implementation, you'd show these in the UI
      console.error('Import failed:', result.errors)
    }
  }

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      setImportText(content)
    }
    reader.readAsText(file)
  }

  return (
    <div className={cn(
      "h-96 bg-white border border-gray-200 rounded-lg flex flex-col",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-600" />
          <h3 className="font-medium text-gray-900">YAML Preview</h3>
          {state.isDirty && (
            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
              Modified
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Import button */}
          <button
            onClick={() => setShowImport(!showImport)}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
            title="Import YAML"
          >
            <Upload className="w-4 h-4" />
          </button>

          {/* Copy button */}
          <button
            onClick={handleCopy}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
            title="Copy to clipboard"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-600" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>

          {/* Download button */}
          <button
            onClick={handleDownload}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
            title="Download YAML"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Import section */}
      {showImport && (
        <div className="p-3 border-b border-gray-200 bg-blue-50">
          <div className="space-y-2">
            {/* File upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Upload YAML file
              </label>
              <input
                type="file"
                accept=".yml,.yaml"
                onChange={handleFileUpload}
                className="text-sm text-gray-500 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
              />
            </div>

            {/* Text area for import */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Or paste YAML content
              </label>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="Paste YAML content here..."
                className="w-full h-24 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Import actions */}
            <div className="flex gap-2">
              <button
                onClick={handleImport}
                disabled={!importText.trim()}
                className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 disabled:bg-gray-300"
              >
                Import
              </button>
              <button
                onClick={() => {
                  setShowImport(false)
                  setImportText('')
                }}
                className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* YAML content */}
      <div className="flex-1 overflow-auto">
        <pre className="p-4 text-sm font-mono text-gray-800 leading-relaxed whitespace-pre-wrap">
          <code>{state.yamlPreview}</code>
        </pre>
      </div>

      {/* Footer with validation status */}
      <div className="border-t border-gray-200 px-3 py-2 bg-gray-50">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <span className="text-gray-600">
              {state.workflow.stages?.length || 0} stages
            </span>
            <span className="text-gray-600">
              {state.workflow.gates?.length || 0} gates
            </span>
          </div>

          <div className="flex items-center gap-2">
            {state.validationErrors.length > 0 ? (
              <>
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span className="text-red-600">
                  {state.validationErrors.filter(e => e.type === 'error').length} errors
                  {state.validationErrors.filter(e => e.type === 'warning').length > 0 &&
                    `, ${state.validationErrors.filter(e => e.type === 'warning').length} warnings`
                  }
                </span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-green-600">Valid</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}