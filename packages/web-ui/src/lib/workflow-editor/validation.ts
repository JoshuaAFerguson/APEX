/**
 * Validation utilities for the Visual Workflow Editor
 *
 * Provides comprehensive validation for workflow definitions,
 * including circular dependency detection, stage name uniqueness,
 * and gate reference validation.
 */

import type { WorkflowDefinition, WorkflowStage, WorkflowGate } from '@apexcli/core'
import type { ValidationError } from '@/types/workflow-editor'
import { AGENT_OPTIONS, VALIDATION_MESSAGES, VALIDATION_LIMITS } from './constants'

/**
 * Validate a complete workflow definition
 *
 * Performs comprehensive validation including structure, dependencies,
 * gates, and business rules.
 *
 * @param workflow - The workflow definition to validate
 * @returns Array of validation errors and warnings
 */
export function validateWorkflow(workflow: WorkflowDefinition): ValidationError[] {
  const errors: ValidationError[] = []

  // 1. Basic workflow validation
  errors.push(...validateWorkflowBasics(workflow))

  // 2. Stage validation
  errors.push(...validateStages(workflow.stages))

  // 3. Dependency validation
  errors.push(...validateDependencies(workflow.stages))

  // 4. Gate validation
  if (workflow.gates) {
    errors.push(...validateGates(workflow.gates, workflow.stages))
  }

  return errors
}

/**
 * Validate basic workflow properties
 */
function validateWorkflowBasics(workflow: WorkflowDefinition): ValidationError[] {
  const errors: ValidationError[] = []

  // Workflow name is required
  if (!workflow.name || workflow.name.trim().length === 0) {
    errors.push({
      path: 'name',
      message: VALIDATION_MESSAGES.REQUIRED_NAME,
      type: 'error',
    })
  }

  // Check workflow name length
  if (workflow.name && workflow.name.length > VALIDATION_LIMITS.MAX_STAGE_NAME_LENGTH) {
    errors.push({
      path: 'name',
      message: `Workflow name too long (max ${VALIDATION_LIMITS.MAX_STAGE_NAME_LENGTH} characters)`,
      type: 'warning',
    })
  }

  // Check description length
  if (workflow.description && workflow.description.length > VALIDATION_LIMITS.MAX_DESCRIPTION_LENGTH) {
    errors.push({
      path: 'description',
      message: `Description too long (max ${VALIDATION_LIMITS.MAX_DESCRIPTION_LENGTH} characters)`,
      type: 'warning',
    })
  }

  // Check stage count limit
  if (workflow.stages.length > VALIDATION_LIMITS.MAX_STAGES) {
    errors.push({
      path: 'stages',
      message: `Too many stages (max ${VALIDATION_LIMITS.MAX_STAGES})`,
      type: 'warning',
    })
  }

  return errors
}

/**
 * Validate workflow stages
 */
function validateStages(stages: WorkflowStage[]): ValidationError[] {
  const errors: ValidationError[] = []
  const stageNames = new Set<string>()

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i]
    const stagePrefix = `stages[${i}]`

    // Stage name is required
    if (!stage.name || stage.name.trim().length === 0) {
      errors.push({
        path: `${stagePrefix}.name`,
        message: 'Stage name is required',
        type: 'error',
        stageId: stage.name || `stage-${i}`,
      })
      continue
    }

    // Check for duplicate stage names
    if (stageNames.has(stage.name)) {
      errors.push({
        path: `${stagePrefix}.name`,
        message: VALIDATION_MESSAGES.DUPLICATE_STAGE.replace('{name}', stage.name),
        type: 'error',
        stageId: stage.name,
      })
    }
    stageNames.add(stage.name)

    // Agent is required
    if (!stage.agent || stage.agent.trim().length === 0) {
      errors.push({
        path: `${stagePrefix}.agent`,
        message: 'Agent is required',
        type: 'error',
        stageId: stage.name,
      })
    } else if (!AGENT_OPTIONS.includes(stage.agent as any)) {
      // Unknown agent type (warning only)
      errors.push({
        path: `${stagePrefix}.agent`,
        message: VALIDATION_MESSAGES.UNKNOWN_AGENT.replace('{agent}', stage.agent),
        type: 'warning',
        stageId: stage.name,
      })
    }

    // Check stage name length
    if (stage.name.length > VALIDATION_LIMITS.MAX_STAGE_NAME_LENGTH) {
      errors.push({
        path: `${stagePrefix}.name`,
        message: `Stage name too long (max ${VALIDATION_LIMITS.MAX_STAGE_NAME_LENGTH} characters)`,
        type: 'warning',
        stageId: stage.name,
      })
    }

    // Check description length
    if (stage.description && stage.description.length > VALIDATION_LIMITS.MAX_DESCRIPTION_LENGTH) {
      errors.push({
        path: `${stagePrefix}.description`,
        message: `Description too long (max ${VALIDATION_LIMITS.MAX_DESCRIPTION_LENGTH} characters)`,
        type: 'warning',
        stageId: stage.name,
      })
    }

    // Check dependencies count
    if (stage.dependsOn && stage.dependsOn.length > VALIDATION_LIMITS.MAX_DEPENDENCIES) {
      errors.push({
        path: `${stagePrefix}.dependsOn`,
        message: `Too many dependencies (max ${VALIDATION_LIMITS.MAX_DEPENDENCIES})`,
        type: 'warning',
        stageId: stage.name,
      })
    }
  }

  return errors
}

/**
 * Validate stage dependencies
 */
function validateDependencies(stages: WorkflowStage[]): ValidationError[] {
  const errors: ValidationError[] = []
  const stageNames = new Set(stages.map(s => s.name))

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i]
    const stagePrefix = `stages[${i}]`

    if (!stage.dependsOn) continue

    for (let j = 0; j < stage.dependsOn.length; j++) {
      const dependency = stage.dependsOn[j]

      // Check if dependency exists
      if (!stageNames.has(dependency)) {
        errors.push({
          path: `${stagePrefix}.dependsOn[${j}]`,
          message: VALIDATION_MESSAGES.INVALID_DEPENDENCY.replace('{dependency}', dependency),
          type: 'error',
          stageId: stage.name,
        })
      }

      // Check for self-dependency
      if (dependency === stage.name) {
        errors.push({
          path: `${stagePrefix}.dependsOn[${j}]`,
          message: VALIDATION_MESSAGES.SELF_DEPENDENCY,
          type: 'error',
          stageId: stage.name,
        })
      }
    }
  }

  // Check for circular dependencies
  const circularErrors = detectCircularDependencies(stages)
  errors.push(...circularErrors)

  return errors
}

/**
 * Validate workflow gates
 */
function validateGates(gates: WorkflowGate[], stages: WorkflowStage[]): ValidationError[] {
  const errors: ValidationError[] = []
  const gateIds = new Set<string>()
  const stageNames = new Set(stages.map(s => s.name))

  // Check gate count limit
  if (gates.length > VALIDATION_LIMITS.MAX_GATES) {
    errors.push({
      path: 'gates',
      message: `Too many gates (max ${VALIDATION_LIMITS.MAX_GATES})`,
      type: 'warning',
    })
  }

  for (let i = 0; i < gates.length; i++) {
    const gate = gates[i]
    const gatePrefix = `gates[${i}]`

    // Gate ID is required
    if (!gate.id || gate.id.trim().length === 0) {
      errors.push({
        path: `${gatePrefix}.id`,
        message: 'Gate ID is required',
        type: 'error',
        gateId: gate.id || `gate-${i}`,
      })
      continue
    }

    // Check for duplicate gate IDs
    if (gateIds.has(gate.id)) {
      errors.push({
        path: `${gatePrefix}.id`,
        message: `Duplicate gate ID: ${gate.id}`,
        type: 'error',
        gateId: gate.id,
      })
    }
    gateIds.add(gate.id)

    // Trigger is required
    if (!gate.trigger || gate.trigger.trim().length === 0) {
      errors.push({
        path: `${gatePrefix}.trigger`,
        message: 'Gate trigger is required',
        type: 'error',
        gateId: gate.id,
      })
    }
  }

  // Validate gate references in stages
  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i]
    if (stage.gate && !gateIds.has(stage.gate)) {
      errors.push({
        path: `stages[${i}].gate`,
        message: VALIDATION_MESSAGES.INVALID_GATE.replace('{gate}', stage.gate),
        type: 'error',
        stageId: stage.name,
      })
    }
  }

  return errors
}

/**
 * Detect circular dependencies in workflow stages
 */
function detectCircularDependencies(stages: WorkflowStage[]): ValidationError[] {
  const errors: ValidationError[] = []
  const visited = new Set<string>()
  const recursionStack = new Set<string>()

  function dfs(stageName: string, path: string[]): boolean {
    visited.add(stageName)
    recursionStack.add(stageName)

    const stage = stages.find(s => s.name === stageName)
    if (stage?.dependsOn) {
      for (const dep of stage.dependsOn) {
        if (!visited.has(dep)) {
          if (dfs(dep, [...path, stageName])) {
            return true
          }
        } else if (recursionStack.has(dep)) {
          const cycle = [...path, stageName, dep].join(' → ')
          errors.push({
            path: 'stages',
            message: VALIDATION_MESSAGES.CIRCULAR_DEPENDENCY.replace('{cycle}', cycle),
            type: 'error',
          })
          return true
        }
      }
    }

    recursionStack.delete(stageName)
    return false
  }

  for (const stage of stages) {
    if (!visited.has(stage.name)) {
      dfs(stage.name, [])
    }
  }

  return errors
}

/**
 * Validate a single stage
 */
export function validateStage(stage: WorkflowStage, allStageNames: string[]): ValidationError[] {
  const errors: ValidationError[] = []
  const stageNames = new Set(allStageNames)

  // Name is required
  if (!stage.name || stage.name.trim().length === 0) {
    errors.push({
      path: 'name',
      message: 'Stage name is required',
      type: 'error',
    })
  }

  // Agent is required
  if (!stage.agent || stage.agent.trim().length === 0) {
    errors.push({
      path: 'agent',
      message: 'Agent is required',
      type: 'error',
    })
  } else if (!AGENT_OPTIONS.includes(stage.agent as any)) {
    errors.push({
      path: 'agent',
      message: VALIDATION_MESSAGES.UNKNOWN_AGENT.replace('{agent}', stage.agent),
      type: 'warning',
    })
  }

  // Validate dependencies
  if (stage.dependsOn) {
    for (const dep of stage.dependsOn) {
      if (!stageNames.has(dep)) {
        errors.push({
          path: 'dependsOn',
          message: VALIDATION_MESSAGES.INVALID_DEPENDENCY.replace('{dependency}', dep),
          type: 'error',
        })
      }
      if (dep === stage.name) {
        errors.push({
          path: 'dependsOn',
          message: VALIDATION_MESSAGES.SELF_DEPENDENCY,
          type: 'error',
        })
      }
    }
  }

  return errors
}

/**
 * Validate a gate definition
 */
export function validateGate(gate: WorkflowGate, allGateIds: string[]): ValidationError[] {
  const errors: ValidationError[] = []
  const gateIds = new Set(allGateIds)

  // ID is required
  if (!gate.id || gate.id.trim().length === 0) {
    errors.push({
      path: 'id',
      message: 'Gate ID is required',
      type: 'error',
    })
  } else if (gateIds.has(gate.id)) {
    errors.push({
      path: 'id',
      message: `Duplicate gate ID: ${gate.id}`,
      type: 'error',
    })
  }

  // Trigger is required
  if (!gate.trigger || gate.trigger.trim().length === 0) {
    errors.push({
      path: 'trigger',
      message: 'Gate trigger is required',
      type: 'error',
    })
  }

  return errors
}

/**
 * Get validation errors for a specific stage
 */
export function getStageValidationErrors(
  errors: ValidationError[],
  stageId: string
): ValidationError[] {
  return errors.filter(error => error.stageId === stageId)
}

/**
 * Get validation errors for a specific gate
 */
export function getGateValidationErrors(
  errors: ValidationError[],
  gateId: string
): ValidationError[] {
  return errors.filter(error => error.gateId === gateId)
}

/**
 * Check if validation errors contain any actual errors (not just warnings)
 */
export function hasValidationErrors(errors: ValidationError[]): boolean {
  return errors.some(error => error.type === 'error')
}

/**
 * Separate errors and warnings
 */
export function separateErrorsAndWarnings(errors: ValidationError[]): {
  errors: ValidationError[]
  warnings: ValidationError[]
} {
  return {
    errors: errors.filter(e => e.type === 'error'),
    warnings: errors.filter(e => e.type === 'warning'),
  }
}