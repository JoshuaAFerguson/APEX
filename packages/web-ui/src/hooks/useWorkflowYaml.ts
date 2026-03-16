/**
 * useWorkflowYaml Hook
 *
 * Provides YAML import/export functionality for workflow definitions.
 * Handles file operations, validation, and live YAML preview generation.
 */

import { useMemo, useCallback } from 'react'
import type { WorkflowDefinition } from '@apexcli/core'
import type { UseWorkflowYamlOptions, UseWorkflowYamlReturn, ValidationError } from '@/types/workflow-editor'
import {
  workflowToYaml,
  yamlToWorkflow,
  validateYamlSyntax,
  createYamlDownload,
} from '@/lib/workflow-editor'

/**
 * Hook for handling YAML import/export operations
 *
 * @param options - Configuration options
 * @returns YAML operations and utilities
 */
export function useWorkflowYaml({
  workflow,
  onImport,
}: UseWorkflowYamlOptions): UseWorkflowYamlReturn {
  /**
   * Generate YAML preview from current workflow
   */
  const yamlPreview = useMemo(() => {
    try {
      return workflowToYaml(workflow)
    } catch (error) {
      console.error('Failed to generate YAML preview:', error)
      return '# Error generating YAML preview'
    }
  }, [workflow])

  /**
   * Export workflow as YAML string
   */
  const exportYaml = useCallback((): string => {
    return workflowToYaml(workflow)
  }, [workflow])

  /**
   * Import workflow from YAML string
   */
  const importYaml = useCallback(
    (yaml: string): { success: boolean; errors: ValidationError[] } => {
      const result = yamlToWorkflow(yaml)

      if (result.workflow && onImport) {
        onImport(result.workflow)
        return { success: true, errors: [] }
      }

      return { success: false, errors: result.errors }
    },
    [onImport]
  )

  /**
   * Download workflow as YAML file
   */
  const downloadYaml = useCallback(
    (filename?: string): void => {
      const yaml = exportYaml()
      const download = createYamlDownload(yaml, filename)

      // Create temporary link and trigger download
      const link = document.createElement('a')
      link.href = download.url
      link.download = download.filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // Clean up the object URL
      download.cleanup()
    },
    [exportYaml]
  )

  /**
   * Import workflow from file
   */
  const importFromFile = useCallback(
    async (file: File): Promise<{ success: boolean; errors: ValidationError[] }> => {
      try {
        const content = await readFileAsText(file)
        return importYaml(content)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        return {
          success: false,
          errors: [{ path: '', message: `Failed to read file: ${message}`, type: 'error' }],
        }
      }
    },
    [importYaml]
  )

  /**
   * Validate YAML string without importing
   */
  const validateYaml = useCallback((yaml: string): ValidationError[] => {
    // First check syntax
    const syntaxErrors = validateYamlSyntax(yaml)
    if (syntaxErrors.length > 0) {
      return syntaxErrors
    }

    // Then check workflow validity
    const result = yamlToWorkflow(yaml)
    return result.errors
  }, [])

  return {
    yamlPreview,
    exportYaml,
    importYaml,
    downloadYaml,
    importFromFile,
    validateYaml,
  }
}

/**
 * Read file content as text
 */
function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        resolve(event.target.result)
      } else {
        reject(new Error('Failed to read file as text'))
      }
    }

    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }

    reader.readAsText(file)
  })
}