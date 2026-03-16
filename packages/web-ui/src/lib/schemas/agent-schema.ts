/**
 * Agent Form Validation Schema
 *
 * Provides Zod validation schemas for agent form data in the web UI.
 * These schemas add UI-specific validation rules (min/max length) while
 * maintaining compatibility with the core AgentDefinition type.
 *
 * @module lib/schemas/agent-schema
 */

import { z } from 'zod'
import type { AgentDefinition, AgentModel } from '@apexcli/core'

// ============================================================================
// Validation Constants
// ============================================================================

/**
 * Validation limits for agent form fields
 */
export const AGENT_VALIDATION_LIMITS = {
  /** Minimum length for agent name */
  NAME_MIN_LENGTH: 1,
  /** Maximum length for agent name */
  NAME_MAX_LENGTH: 100,
  /** Minimum length for agent description */
  DESCRIPTION_MIN_LENGTH: 1,
  /** Maximum length for agent description */
  DESCRIPTION_MAX_LENGTH: 500,
  /** Minimum length for agent prompt */
  PROMPT_MIN_LENGTH: 10,
  /** Maximum length for agent prompt */
  PROMPT_MAX_LENGTH: 50000,
  /** Maximum number of tools an agent can have */
  MAX_TOOLS: 50,
  /** Maximum number of skills an agent can have */
  MAX_SKILLS: 100,
} as const

/**
 * Validation error messages for agent form fields
 */
export const AGENT_VALIDATION_MESSAGES = {
  NAME_REQUIRED: 'Agent name is required',
  NAME_TOO_SHORT: `Name must be at least ${AGENT_VALIDATION_LIMITS.NAME_MIN_LENGTH} character`,
  NAME_TOO_LONG: `Name must be at most ${AGENT_VALIDATION_LIMITS.NAME_MAX_LENGTH} characters`,
  NAME_INVALID_FORMAT: 'Name can only contain lowercase letters, numbers, and hyphens',
  DESCRIPTION_REQUIRED: 'Description is required',
  DESCRIPTION_TOO_LONG: `Description must be at most ${AGENT_VALIDATION_LIMITS.DESCRIPTION_MAX_LENGTH} characters`,
  PROMPT_REQUIRED: 'Prompt is required',
  PROMPT_TOO_SHORT: `Prompt must be at least ${AGENT_VALIDATION_LIMITS.PROMPT_MIN_LENGTH} characters`,
  PROMPT_TOO_LONG: `Prompt must be at most ${AGENT_VALIDATION_LIMITS.PROMPT_MAX_LENGTH} characters`,
  MODEL_INVALID: 'Invalid model selection',
  TOOLS_TOO_MANY: `Maximum ${AGENT_VALIDATION_LIMITS.MAX_TOOLS} tools allowed`,
  SKILLS_TOO_MANY: `Maximum ${AGENT_VALIDATION_LIMITS.MAX_SKILLS} skills allowed`,
} as const

// ============================================================================
// Model Schema
// ============================================================================

/**
 * Valid agent model options
 * Must match AgentModelSchema from @apexcli/core
 */
export const AGENT_MODEL_OPTIONS = ['opus', 'sonnet', 'haiku', 'inherit'] as const
export type AgentModelOption = (typeof AGENT_MODEL_OPTIONS)[number]

/**
 * Schema for validating agent model selection
 */
export const AgentModelFormSchema = z.enum(AGENT_MODEL_OPTIONS, {
  errorMap: () => ({ message: AGENT_VALIDATION_MESSAGES.MODEL_INVALID }),
})

// ============================================================================
// Agent Form Schema
// ============================================================================

/**
 * Regular expression for valid agent names
 * Names must be lowercase, can contain letters, numbers, and hyphens
 */
export const AGENT_NAME_REGEX = /^[a-z][a-z0-9-]*$/

/**
 * Schema for validating agent form data
 *
 * Validates all AgentDefinition fields with appropriate rules:
 * - name: required, min/max length, format validation (lowercase, hyphens allowed)
 * - description: required, max length
 * - model: enum validation (opus, sonnet, haiku, inherit)
 * - tools: optional array of strings
 * - skills: optional array of strings
 * - prompt: required, min length for meaningful instructions
 *
 * @example
 * ```typescript
 * const result = AgentFormSchema.safeParse({
 *   name: 'my-agent',
 *   description: 'A helpful agent',
 *   prompt: 'You are a helpful assistant that...',
 *   model: 'sonnet',
 *   tools: ['Read', 'Write'],
 *   skills: ['typescript', 'react'],
 * })
 *
 * if (result.success) {
 *   const agent = result.data
 * } else {
 *   const errors = result.error.issues
 * }
 * ```
 */
export const AgentFormSchema = z.object({
  /**
   * Agent name - must be unique, lowercase, hyphen-separated
   */
  name: z
    .string({
      required_error: AGENT_VALIDATION_MESSAGES.NAME_REQUIRED,
    })
    .min(AGENT_VALIDATION_LIMITS.NAME_MIN_LENGTH, {
      message: AGENT_VALIDATION_MESSAGES.NAME_TOO_SHORT,
    })
    .max(AGENT_VALIDATION_LIMITS.NAME_MAX_LENGTH, {
      message: AGENT_VALIDATION_MESSAGES.NAME_TOO_LONG,
    })
    .regex(AGENT_NAME_REGEX, {
      message: AGENT_VALIDATION_MESSAGES.NAME_INVALID_FORMAT,
    }),

  /**
   * Agent description - brief explanation of what the agent does
   */
  description: z
    .string({
      required_error: AGENT_VALIDATION_MESSAGES.DESCRIPTION_REQUIRED,
    })
    .min(AGENT_VALIDATION_LIMITS.DESCRIPTION_MIN_LENGTH, {
      message: AGENT_VALIDATION_MESSAGES.DESCRIPTION_REQUIRED,
    })
    .max(AGENT_VALIDATION_LIMITS.DESCRIPTION_MAX_LENGTH, {
      message: AGENT_VALIDATION_MESSAGES.DESCRIPTION_TOO_LONG,
    }),

  /**
   * Model selection - which AI model the agent should use
   */
  model: AgentModelFormSchema.optional().default('sonnet'),

  /**
   * Tools - array of tool names the agent can use
   */
  tools: z
    .array(z.string().min(1))
    .max(AGENT_VALIDATION_LIMITS.MAX_TOOLS, {
      message: AGENT_VALIDATION_MESSAGES.TOOLS_TOO_MANY,
    })
    .optional()
    .default([]),

  /**
   * Skills - array of skill tags for the agent
   */
  skills: z
    .array(z.string().min(1))
    .max(AGENT_VALIDATION_LIMITS.MAX_SKILLS, {
      message: AGENT_VALIDATION_MESSAGES.SKILLS_TOO_MANY,
    })
    .optional()
    .default([]),

  /**
   * Prompt - instructions/system prompt for the agent
   */
  prompt: z
    .string({
      required_error: AGENT_VALIDATION_MESSAGES.PROMPT_REQUIRED,
    })
    .min(AGENT_VALIDATION_LIMITS.PROMPT_MIN_LENGTH, {
      message: AGENT_VALIDATION_MESSAGES.PROMPT_TOO_SHORT,
    })
    .max(AGENT_VALIDATION_LIMITS.PROMPT_MAX_LENGTH, {
      message: AGENT_VALIDATION_MESSAGES.PROMPT_TOO_LONG,
    }),
})

/**
 * Type inferred from AgentFormSchema
 * Compatible with AgentDefinition from @apexcli/core
 */
export type AgentFormData = z.infer<typeof AgentFormSchema>

/**
 * Type for form input (before defaults are applied)
 */
export type AgentFormInput = z.input<typeof AgentFormSchema>

// ============================================================================
// Partial Schema for Edit Forms
// ============================================================================

/**
 * Partial schema for editing existing agents
 * Allows partial updates without requiring all fields
 */
export const AgentFormPartialSchema = AgentFormSchema.partial()

/**
 * Type for partial agent form data (for edit operations)
 */
export type AgentFormPartialData = z.infer<typeof AgentFormPartialSchema>

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validates agent form data and returns a type-safe result
 *
 * @param data - The form data to validate
 * @returns Safe parse result with success flag and data or error
 *
 * @example
 * ```typescript
 * const result = validateAgentForm(formData)
 * if (result.success) {
 *   saveAgent(result.data)
 * } else {
 *   displayErrors(result.error.issues)
 * }
 * ```
 */
export function validateAgentForm(data: unknown): z.SafeParseReturnType<AgentFormInput, AgentFormData> {
  return AgentFormSchema.safeParse(data)
}

/**
 * Validates agent form data and throws on error
 *
 * @param data - The form data to validate
 * @returns Validated and transformed agent data
 * @throws {z.ZodError} If validation fails
 *
 * @example
 * ```typescript
 * try {
 *   const agent = parseAgentForm(formData)
 *   await saveAgent(agent)
 * } catch (error) {
 *   if (error instanceof z.ZodError) {
 *     handleValidationError(error)
 *   }
 * }
 * ```
 */
export function parseAgentForm(data: unknown): AgentFormData {
  return AgentFormSchema.parse(data)
}

/**
 * Validates partial agent form data for edit operations
 *
 * @param data - Partial form data to validate
 * @returns Safe parse result
 */
export function validatePartialAgentForm(
  data: unknown
): z.SafeParseReturnType<Partial<AgentFormInput>, AgentFormPartialData> {
  return AgentFormPartialSchema.safeParse(data)
}

/**
 * Gets the first validation error message for a field
 *
 * @param error - Zod error object
 * @param field - Field name to get error for
 * @returns Error message or undefined
 *
 * @example
 * ```typescript
 * const result = validateAgentForm(data)
 * if (!result.success) {
 *   const nameError = getFieldError(result.error, 'name')
 *   // "Agent name is required"
 * }
 * ```
 */
export function getFieldError(error: z.ZodError, field: keyof AgentFormData): string | undefined {
  const issue = error.issues.find((issue) => issue.path[0] === field)
  return issue?.message
}

/**
 * Gets all validation errors as a record of field -> error message
 *
 * @param error - Zod error object
 * @returns Record mapping field names to error messages
 *
 * @example
 * ```typescript
 * const result = validateAgentForm(data)
 * if (!result.success) {
 *   const errors = getFormErrors(result.error)
 *   // { name: "Agent name is required", prompt: "Prompt is required" }
 * }
 * ```
 */
export function getFormErrors(error: z.ZodError): Partial<Record<keyof AgentFormData, string>> {
  const errors: Partial<Record<keyof AgentFormData, string>> = {}

  for (const issue of error.issues) {
    const field = issue.path[0] as keyof AgentFormData
    if (field && !errors[field]) {
      errors[field] = issue.message
    }
  }

  return errors
}

// ============================================================================
// Type Guards and Converters
// ============================================================================

/**
 * Type guard to check if a value is valid AgentFormData
 *
 * @param value - Value to check
 * @returns True if value is valid AgentFormData
 */
export function isValidAgentFormData(value: unknown): value is AgentFormData {
  return AgentFormSchema.safeParse(value).success
}

/**
 * Converts validated form data to core AgentDefinition type
 * Ensures compatibility with @apexcli/core types
 *
 * @param formData - Validated agent form data
 * @returns AgentDefinition compatible object
 *
 * @example
 * ```typescript
 * const formData = parseAgentForm(data)
 * const agentDefinition = toAgentDefinition(formData)
 * await saveAgentToFile(agentDefinition)
 * ```
 */
export function toAgentDefinition(formData: AgentFormData): AgentDefinition {
  return {
    name: formData.name,
    description: formData.description,
    prompt: formData.prompt,
    model: formData.model as AgentModel,
    tools: formData.tools.length > 0 ? formData.tools : undefined,
    skills: formData.skills.length > 0 ? formData.skills : undefined,
  }
}

/**
 * Converts an AgentDefinition to form data format
 * Useful for populating edit forms
 *
 * @param agent - Agent definition from @apexcli/core
 * @returns Form data with defaults applied
 *
 * @example
 * ```typescript
 * const agent = await loadAgent('developer')
 * const formData = fromAgentDefinition(agent)
 * setFormValues(formData)
 * ```
 */
export function fromAgentDefinition(agent: AgentDefinition): AgentFormData {
  // AgentDefinition has name, description, prompt as required fields
  // but TypeScript may see them as potentially undefined in some contexts
  // We provide fallbacks for safety
  return {
    name: agent.name ?? '',
    description: agent.description ?? '',
    prompt: agent.prompt ?? '',
    model: (agent.model || 'sonnet') as AgentModelOption,
    tools: agent.tools || [],
    skills: agent.skills || [],
  }
}

// ============================================================================
// Schema Export for External Use
// ============================================================================

/**
 * Re-export z for external use with the schema
 */
export { z }
