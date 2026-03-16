/**
 * useWorkflowValidation Hook
 *
 * Provides real-time validation for workflow definitions.
 * Validates the entire workflow and provides utilities to get
 * errors for specific stages and gates.
 */

import { useMemo } from 'react'
import type { WorkflowDefinition } from '@apexcli/core'
import type { UseWorkflowValidationReturn, ValidationError } from '@/types/workflow-editor'
import {
  validateWorkflow,
  getStageValidationErrors,
  getGateValidationErrors,
  hasValidationErrors,
  separateErrorsAndWarnings,
} from '@/lib/workflow-editor'

/**
 * Hook for validating workflow definitions in real-time
 *
 * @param workflow - The workflow definition to validate
 * @returns Validation results and utility functions
 */
export function useWorkflowValidation(
  workflow: WorkflowDefinition
): UseWorkflowValidationReturn {
  // Perform validation
  const allValidationIssues = useMemo(() => {
    return validateWorkflow(workflow)
  }, [workflow])

  // Separate errors and warnings
  const { errors, warnings } = useMemo(() => {
    return separateErrorsAndWarnings(allValidationIssues)
  }, [allValidationIssues])

  // Check if workflow is valid (no errors, warnings are allowed)
  const isValid = useMemo(() => {
    return !hasValidationErrors(allValidationIssues)
  }, [allValidationIssues])

  /**
   * Get validation errors for a specific stage
   */
  const getStageErrors = useMemo(() => {
    return (stageId: string): ValidationError[] => {
      return getStageValidationErrors(allValidationIssues, stageId)
    }
  }, [allValidationIssues])

  /**
   * Get validation errors for a specific gate
   */
  const getGateErrors = useMemo(() => {
    return (gateId: string): ValidationError[] => {
      return getGateValidationErrors(allValidationIssues, gateId)
    }
  }, [allValidationIssues])

  /**
   * Re-validate the workflow (useful for manual validation triggers)
   */
  const validate = useMemo(() => {
    return (): ValidationError[] => {
      return validateWorkflow(workflow)
    }
  }, [workflow])

  return {
    errors,
    warnings,
    isValid,
    validate,
    getStageErrors,
    getGateErrors,
  }
}