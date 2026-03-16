/**
 * YAML serialization utilities for the Visual Workflow Editor
 *
 * Handles conversion between WorkflowDefinition objects and YAML strings,
 * with proper validation and error reporting.
 */

import { stringify, parse } from 'yaml'
import { WorkflowDefinitionSchema } from '@apexcli/core'
import type { WorkflowDefinition } from '@apexcli/core'
import type { ValidationError } from '@/types/workflow-editor'

/**
 * Convert WorkflowDefinition to YAML string
 *
 * Creates a clean YAML representation of the workflow,
 * omitting undefined values and using consistent formatting.
 *
 * @param workflow - The workflow definition to convert
 * @returns YAML string representation
 */
export function workflowToYaml(workflow: WorkflowDefinition): string {
  // Create clean object without undefined values
  const cleanWorkflow = {
    name: workflow.name,
    description: workflow.description,
    ...(workflow.trigger?.length && { trigger: workflow.trigger }),
    stages: workflow.stages?.map(stage => ({
      name: stage.name,
      agent: stage.agent,
      ...(stage.description && { description: stage.description }),
      ...(stage.dependsOn?.length && { dependsOn: stage.dependsOn }),
      ...(stage.outputs?.length && { outputs: stage.outputs }),
      ...(stage.inputs?.length && { inputs: stage.inputs }),
      ...(stage.gate && { gate: stage.gate }),
      ...(stage.parallel && { parallel: stage.parallel }),
      ...(stage.condition && { condition: stage.condition }),
      ...(stage.actions?.length && { actions: stage.actions }),
      ...(stage.maxRetries !== undefined && stage.maxRetries !== 2 && { maxRetries: stage.maxRetries }),
    })) ?? [],
    ...(workflow.gates?.length && {
      gates: workflow.gates.map(gate => ({
        id: gate.id,
        name: gate.name,
        trigger: gate.trigger,
        ...(gate.description && { description: gate.description }),
        ...(gate.required !== undefined && !gate.required && { required: gate.required }),
        ...(gate.autoApprove && { autoApprove: gate.autoApprove }),
        ...(gate.approvers?.length && { approvers: gate.approvers }),
        ...(gate.timeout && { timeout: gate.timeout }),
        ...(gate.tags?.length && { tags: gate.tags }),
      })),
    }),
    ...(workflow.isolation && { isolation: workflow.isolation }),
  }

  return stringify(cleanWorkflow, {
    lineWidth: 0,        // No line wrapping
    minContentWidth: 0,
    defaultKeyType: 'PLAIN',
    defaultStringType: 'QUOTE_DOUBLE',
    doubleQuotedAsJSON: false,
    singleQuote: false,  // Use double quotes consistently
    indent: 2,           // Use 2-space indentation
  })
}

/**
 * Parse YAML string to WorkflowDefinition
 *
 * Validates the parsed YAML against the WorkflowDefinition schema
 * and returns both the workflow and any validation errors.
 *
 * @param yaml - YAML string to parse
 * @returns Object containing the workflow (if valid) and any errors
 */
export function yamlToWorkflow(yaml: string): {
  workflow: WorkflowDefinition | null
  errors: ValidationError[]
} {
  try {
    // Parse the YAML
    const parsed = parse(yaml)

    if (parsed === null || parsed === undefined) {
      return {
        workflow: null,
        errors: [{ path: '', message: 'YAML is empty or invalid', type: 'error' }],
      }
    }

    // Validate against schema
    const result = WorkflowDefinitionSchema.safeParse(parsed)

    if (result.success) {
      return { workflow: result.data, errors: [] }
    }

    // Convert Zod errors to ValidationErrors
    const errors: ValidationError[] = result.error.errors.map(err => ({
      path: err.path.join('.'),
      message: err.message,
      type: 'error' as const,
    }))

    return { workflow: null, errors }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown parsing error'
    return {
      workflow: null,
      errors: [{ path: '', message: `Invalid YAML: ${message}`, type: 'error' }],
    }
  }
}

/**
 * Validate YAML string without parsing to workflow
 *
 * Quick validation to check if a YAML string is syntactically correct.
 *
 * @param yaml - YAML string to validate
 * @returns Array of syntax errors, empty if valid
 */
export function validateYamlSyntax(yaml: string): ValidationError[] {
  try {
    parse(yaml)
    return []
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown parsing error'
    return [{ path: '', message: `YAML syntax error: ${message}`, type: 'error' }]
  }
}

/**
 * Pretty-format a YAML string
 *
 * Parses and re-stringifies YAML to ensure consistent formatting.
 *
 * @param yaml - YAML string to format
 * @returns Formatted YAML string, or original if parsing fails
 */
export function formatYaml(yaml: string): string {
  try {
    const parsed = parse(yaml)
    if (parsed === null || parsed === undefined) {
      return yaml
    }
    return stringify(parsed, {
      lineWidth: 0,
      minContentWidth: 0,
      defaultKeyType: 'PLAIN',
      defaultStringType: 'QUOTE_DOUBLE',
      doubleQuotedAsJSON: false,
      singleQuote: false,
      indent: 2,
    })
  } catch {
    return yaml
  }
}

/**
 * Create a downloadable file from YAML content
 *
 * Generates a Blob and download URL for the YAML content.
 *
 * @param yaml - YAML content to download
 * @param filename - Name for the downloaded file
 * @returns Object with download URL and cleanup function
 */
export function createYamlDownload(yaml: string, filename = 'workflow.yml') {
  const blob = new Blob([yaml], { type: 'application/yaml' })
  const url = URL.createObjectURL(blob)

  return {
    url,
    filename,
    cleanup: () => URL.revokeObjectURL(url),
  }
}

/**
 * Extract workflow metadata from YAML for quick preview
 *
 * Parses just enough of the YAML to get basic workflow info
 * without full validation.
 *
 * @param yaml - YAML string to analyze
 * @returns Basic workflow metadata or null if parsing fails
 */
export function extractWorkflowMetadata(yaml: string): {
  name?: string
  description?: string
  stageCount?: number
  gateCount?: number
} | null {
  try {
    const parsed = parse(yaml)

    if (!parsed || typeof parsed !== 'object') {
      return null
    }

    const obj = parsed as Record<string, unknown>

    return {
      name: typeof obj.name === 'string' ? obj.name : undefined,
      description: typeof obj.description === 'string' ? obj.description : undefined,
      stageCount: Array.isArray(obj.stages) ? obj.stages.length : undefined,
      gateCount: Array.isArray(obj.gates) ? obj.gates.length : undefined,
    }
  } catch {
    return null
  }
}