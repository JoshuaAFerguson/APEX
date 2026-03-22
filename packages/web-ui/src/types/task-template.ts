/**
 * Task Template Types for Web UI
 *
 * Type definitions for the task template system, including interfaces
 * for template creation, management, and variable interpolation.
 *
 * This module extends the core TaskTemplate type with additional
 * UI-specific fields and provides types for template-based task creation.
 *
 * @packageDocumentation
 */

import type { TaskPriority, TaskEffort, AutonomyLevel } from '@apexcli/core'

// ============================================================================
// Template Category Types
// ============================================================================

/**
 * Categories for organizing task templates
 * Used for filtering and grouping templates in the UI
 */
export type TemplateCategory =
  | 'feature'       // New feature implementation
  | 'bugfix'        // Bug fixes and patches
  | 'refactoring'   // Code refactoring tasks
  | 'testing'       // Test creation and improvements
  | 'documentation' // Documentation tasks
  | 'maintenance'   // Maintenance and chores
  | 'deployment'    // Deployment and release tasks
  | 'custom'        // User-defined category

/**
 * Template variable types for interpolation
 */
export type TemplateVariableType =
  | 'string'    // Free-form text input
  | 'text'      // Multi-line text input
  | 'number'    // Numeric input
  | 'boolean'   // Toggle/checkbox
  | 'select'    // Single selection from options
  | 'multiselect' // Multiple selection from options
  | 'file'      // File path input
  | 'directory' // Directory path input

// ============================================================================
// Template Variable Types
// ============================================================================

/**
 * Represents a variable placeholder within a template
 * Used for dynamic content substitution in description and acceptance criteria templates
 *
 * @example
 * ```typescript
 * const componentVar: TemplateVariable = {
 *   name: 'componentName',
 *   label: 'Component Name',
 *   type: 'string',
 *   required: true,
 *   placeholder: 'e.g., UserProfile',
 *   description: 'Name of the React component to create'
 * }
 * ```
 */
export interface TemplateVariable {
  /** Unique variable name used in template interpolation (e.g., {{variableName}}) */
  name: string

  /** Human-readable label displayed in the UI */
  label: string

  /** Type of input control to render */
  type: TemplateVariableType

  /** Whether this variable is required */
  required: boolean

  /** Default value if not provided */
  defaultValue?: string | number | boolean | string[]

  /** Placeholder text for input fields */
  placeholder?: string

  /** Help text describing the variable */
  description?: string

  /** Available options for select/multiselect types */
  options?: TemplateVariableOption[]

  /** Validation pattern (regex string) for string types */
  validationPattern?: string

  /** Validation error message */
  validationMessage?: string

  /** Minimum value for number types */
  min?: number

  /** Maximum value for number types */
  max?: number

  /** Minimum length for string types */
  minLength?: number

  /** Maximum length for string types */
  maxLength?: number
}

/**
 * Option for select/multiselect template variables
 */
export interface TemplateVariableOption {
  /** Display label */
  label: string

  /** Actual value used in interpolation */
  value: string

  /** Optional description for the option */
  description?: string

  /** Whether this option is disabled */
  disabled?: boolean
}

/**
 * Values for template variables keyed by variable name
 */
export type TemplateVariableValues = Record<string, string | number | boolean | string[]>

// ============================================================================
// Task Template Types
// ============================================================================

/**
 * Extended TaskTemplate interface for the Web UI
 *
 * Extends the core TaskTemplate with additional fields for:
 * - Category-based organization
 * - Autonomy level configuration
 * - Template interpolation with variables
 * - Quick action support
 *
 * @example
 * ```typescript
 * const template: TaskTemplate = {
 *   id: 'template_feature_component',
 *   name: 'Create React Component',
 *   description: 'Template for creating new React components',
 *   category: 'feature',
 *   workflow: 'feature',
 *   autonomy: 'review-before-commit',
 *   descriptionTemplate: 'Create a new {{componentType}} component named {{componentName}}',
 *   acceptanceCriteriaTemplate: '- Component renders correctly\n- Props are properly typed',
 *   variables: [
 *     { name: 'componentName', label: 'Component Name', type: 'string', required: true },
 *     { name: 'componentType', label: 'Type', type: 'select', required: true, options: [...] }
 *   ],
 *   tags: ['react', 'component', 'frontend'],
 *   isQuickAction: true,
 *   priority: 'normal',
 *   effort: 'small',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface TaskTemplate {
  /** Unique identifier for the template */
  id: string

  /** Human-readable name of the template */
  name: string

  /** Brief description of what this template is for */
  description: string

  /** Category for organizing templates */
  category: TemplateCategory

  /** Associated workflow identifier */
  workflow: string

  /** Default autonomy level for tasks created from this template */
  autonomy: AutonomyLevel

  /**
   * Template string for task description with variable placeholders
   * Uses Mustache-style syntax: {{variableName}}
   */
  descriptionTemplate: string

  /**
   * Template string for acceptance criteria with variable placeholders
   * Uses Mustache-style syntax: {{variableName}}
   */
  acceptanceCriteriaTemplate?: string

  /** Template variables for dynamic content */
  variables?: TemplateVariable[]

  /** Tags for filtering and searching templates */
  tags: string[]

  /**
   * Whether this template should appear in quick actions
   * Quick actions are shown in the task creation UI for fast access
   */
  isQuickAction: boolean

  /** Default priority for tasks created from this template */
  priority: TaskPriority

  /** Default effort estimate for tasks created from this template */
  effort: TaskEffort

  /** When the template was created */
  createdAt: Date

  /** When the template was last updated */
  updatedAt: Date

  /** Optional icon identifier for UI display */
  icon?: string

  /** Optional color for UI display (hex or CSS color name) */
  color?: string

  /** Whether the template is archived/disabled */
  archived?: boolean

  /** Usage count for analytics */
  usageCount?: number

  /** User ID of template creator (if applicable) */
  createdBy?: string

  /** Whether this is a system template (non-editable) */
  isSystem?: boolean
}

// ============================================================================
// Request Types
// ============================================================================

/**
 * Request payload for creating a new task template
 *
 * @example
 * ```typescript
 * const request: CreateTemplateRequest = {
 *   name: 'Bug Fix Template',
 *   description: 'Standard template for bug fixes',
 *   category: 'bugfix',
 *   workflow: 'bugfix',
 *   autonomy: 'review-before-commit',
 *   descriptionTemplate: 'Fix bug: {{bugTitle}}',
 *   acceptanceCriteriaTemplate: '- Bug is resolved\n- No regression',
 *   variables: [{ name: 'bugTitle', label: 'Bug Title', type: 'string', required: true }],
 *   tags: ['bug', 'fix'],
 *   isQuickAction: false
 * }
 * ```
 */
export interface CreateTemplateRequest {
  /** Human-readable name of the template */
  name: string

  /** Brief description of what this template is for */
  description: string

  /** Category for organizing templates */
  category: TemplateCategory

  /** Associated workflow identifier */
  workflow: string

  /** Default autonomy level for tasks created from this template */
  autonomy: AutonomyLevel

  /** Template string for task description with variable placeholders */
  descriptionTemplate: string

  /** Template string for acceptance criteria with variable placeholders */
  acceptanceCriteriaTemplate?: string

  /** Template variables for dynamic content */
  variables?: TemplateVariable[]

  /** Tags for filtering and searching templates */
  tags?: string[]

  /** Whether this template should appear in quick actions */
  isQuickAction?: boolean

  /** Default priority for tasks created from this template */
  priority?: TaskPriority

  /** Default effort estimate for tasks created from this template */
  effort?: TaskEffort

  /** Optional icon identifier for UI display */
  icon?: string

  /** Optional color for UI display */
  color?: string
}

/**
 * Request payload for updating an existing template
 * All fields are optional except id
 */
export interface UpdateTemplateRequest {
  /** Template ID to update */
  id: string

  /** Updated name */
  name?: string

  /** Updated description */
  description?: string

  /** Updated category */
  category?: TemplateCategory

  /** Updated workflow */
  workflow?: string

  /** Updated autonomy level */
  autonomy?: AutonomyLevel

  /** Updated description template */
  descriptionTemplate?: string

  /** Updated acceptance criteria template */
  acceptanceCriteriaTemplate?: string

  /** Updated variables */
  variables?: TemplateVariable[]

  /** Updated tags */
  tags?: string[]

  /** Updated quick action status */
  isQuickAction?: boolean

  /** Updated priority */
  priority?: TaskPriority

  /** Updated effort */
  effort?: TaskEffort

  /** Updated icon */
  icon?: string

  /** Updated color */
  color?: string

  /** Archive status */
  archived?: boolean
}

/**
 * Request payload for creating a task from a template
 */
export interface CreateTaskFromTemplateRequest {
  /** Template ID to use */
  templateId: string

  /** Variable values for template interpolation */
  variables: TemplateVariableValues

  /** Override the template's default priority */
  priority?: TaskPriority

  /** Override the template's default effort */
  effort?: TaskEffort

  /** Override the template's default autonomy level */
  autonomy?: AutonomyLevel

  /** Project path for the task */
  projectPath?: string
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Response from template list endpoint
 */
export interface TemplateListResponse {
  /** List of templates */
  templates: TaskTemplate[]

  /** Total count (for pagination) */
  total: number

  /** Current page (1-indexed) */
  page: number

  /** Page size */
  pageSize: number
}

/**
 * Response from template search endpoint
 */
export interface TemplateSearchResponse {
  /** Matching templates */
  results: TaskTemplate[]

  /** Search query used */
  query: string

  /** Total matches */
  total: number
}

// ============================================================================
// Filter and Query Types
// ============================================================================

/**
 * Filters for querying templates
 */
export interface TemplateFilters {
  /** Filter by category */
  category?: TemplateCategory | TemplateCategory[]

  /** Filter by workflow */
  workflow?: string | string[]

  /** Filter by tags (any match) */
  tags?: string[]

  /** Filter by quick action status */
  isQuickAction?: boolean

  /** Include archived templates */
  includeArchived?: boolean

  /** Search query for name/description */
  search?: string

  /** Filter by autonomy level (for local filtering) */
  autonomy?: AutonomyLevel

  /** Filter by priority (for local filtering) */
  priority?: TaskPriority

  /** Filter by effort (for local filtering) */
  effort?: TaskEffort
}

/**
 * Sort options for template lists
 */
export interface TemplateSortOptions {
  /** Field to sort by */
  field: 'name' | 'createdAt' | 'updatedAt' | 'usageCount' | 'category'

  /** Sort direction */
  direction: 'asc' | 'desc'
}

/**
 * Pagination options for template queries
 */
export interface TemplatePaginationOptions {
  /** Page number (1-indexed) */
  page: number

  /** Items per page */
  pageSize: number
}

// ============================================================================
// Component Props Types
// ============================================================================

/**
 * Props for template list component
 */
export interface TemplateListProps {
  /** Templates to display */
  templates: TaskTemplate[]

  /** Currently selected template ID */
  selectedId?: string

  /** Loading state */
  loading?: boolean

  /** Error state */
  error?: string | null

  /** Callback when template is selected */
  onSelect?: (template: TaskTemplate) => void

  /** Callback when template is edited */
  onEdit?: (template: TaskTemplate) => void

  /** Callback when template is deleted */
  onDelete?: (template: TaskTemplate) => void

  /** Callback when template is used to create task */
  onUse?: (template: TaskTemplate) => void

  /** Whether to show quick actions only */
  quickActionsOnly?: boolean

  /** Whether in compact mode */
  compact?: boolean

  /** Custom className */
  className?: string
}

/**
 * Props for template form component
 */
export interface TemplateFormProps {
  /** Initial template data (for editing) */
  initialData?: Partial<TaskTemplate>

  /** Available workflows */
  workflows?: string[]

  /** Whether form is submitting */
  isSubmitting?: boolean

  /** Submit error */
  error?: string | null

  /** Callback when form is submitted */
  onSubmit: (data: CreateTemplateRequest | UpdateTemplateRequest) => void | Promise<void>

  /** Callback when form is cancelled */
  onCancel?: () => void

  /** Form mode */
  mode: 'create' | 'edit'

  /** Custom className */
  className?: string
}

/**
 * Props for template variable input component
 */
export interface TemplateVariableInputProps {
  /** Variable definition */
  variable: TemplateVariable

  /** Current value */
  value: string | number | boolean | string[] | undefined

  /** Callback when value changes */
  onChange: (value: string | number | boolean | string[]) => void

  /** Whether input is disabled */
  disabled?: boolean

  /** Validation error message */
  error?: string

  /** Custom className */
  className?: string
}

/**
 * Props for template preview component
 */
export interface TemplatePreviewProps {
  /** Template to preview */
  template: TaskTemplate

  /** Variable values for interpolation */
  variableValues?: TemplateVariableValues

  /** Whether to show interpolated result */
  showInterpolated?: boolean

  /** Custom className */
  className?: string
}

// ============================================================================
// Hook Return Types
// ============================================================================

/**
 * Return type for useTaskTemplates hook
 */
export interface UseTaskTemplatesReturn {
  /** List of templates */
  templates: TaskTemplate[]

  /** Loading state */
  isLoading: boolean

  /** Error state */
  error: string | null

  /** Refresh templates list */
  refresh: () => Promise<void>

  /** Create a new template */
  createTemplate: (request: CreateTemplateRequest) => Promise<TaskTemplate>

  /** Update an existing template */
  updateTemplate: (request: UpdateTemplateRequest) => Promise<TaskTemplate>

  /** Delete a template */
  deleteTemplate: (id: string) => Promise<void>

  /** Get a single template by ID */
  getTemplate: (id: string) => TaskTemplate | undefined

  /** Search templates */
  searchTemplates: (query: string) => TaskTemplate[]

  /** Filter templates */
  filterTemplates: (filters: TemplateFilters) => TaskTemplate[]
}

/**
 * Return type for useTemplateForm hook
 */
export interface UseTemplateFormReturn {
  /** Form values */
  values: Partial<CreateTemplateRequest>

  /** Form errors */
  errors: Record<string, string>

  /** Whether form is valid */
  isValid: boolean

  /** Whether form has been modified */
  isDirty: boolean

  /** Set a form field value */
  setField: <K extends keyof CreateTemplateRequest>(
    field: K,
    value: CreateTemplateRequest[K]
  ) => void

  /** Set multiple form field values */
  setFields: (values: Partial<CreateTemplateRequest>) => void

  /** Add a variable to the template */
  addVariable: (variable: TemplateVariable) => void

  /** Remove a variable from the template */
  removeVariable: (name: string) => void

  /** Update a variable in the template */
  updateVariable: (name: string, updates: Partial<TemplateVariable>) => void

  /** Reset form to initial values */
  reset: () => void

  /** Validate the form */
  validate: () => boolean

  /** Get form submission data */
  getSubmitData: () => CreateTemplateRequest
}

/**
 * Return type for useTemplateVariables hook
 */
export interface UseTemplateVariablesReturn {
  /** Current variable values */
  values: TemplateVariableValues

  /** Variable validation errors */
  errors: Record<string, string>

  /** Whether all required variables are filled */
  isComplete: boolean

  /** Whether values have been modified */
  isDirty: boolean

  /** Set a variable value */
  setValue: (name: string, value: string | number | boolean | string[]) => void

  /** Set multiple variable values */
  setValues: (values: TemplateVariableValues) => void

  /** Reset to default values */
  reset: () => void

  /** Validate all variables */
  validate: () => boolean

  /** Interpolate template with current values */
  interpolate: (template: string) => string
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Template interpolation result
 */
export interface InterpolationResult {
  /** Interpolated string */
  result: string

  /** Variables that were replaced */
  replaced: string[]

  /** Variables that were not found in values */
  missing: string[]

  /** Whether all variables were successfully replaced */
  complete: boolean
}

/**
 * Template validation result
 */
export interface TemplateValidationResult {
  /** Whether the template is valid */
  isValid: boolean

  /** Validation errors */
  errors: TemplateValidationError[]

  /** Validation warnings */
  warnings: TemplateValidationError[]
}

/**
 * Template validation error
 */
export interface TemplateValidationError {
  /** Field path that has the error */
  field: string

  /** Error message */
  message: string

  /** Error severity */
  severity: 'error' | 'warning'
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a value is a valid TemplateCategory
 */
export function isTemplateCategory(value: unknown): value is TemplateCategory {
  return (
    typeof value === 'string' &&
    ['feature', 'bugfix', 'refactoring', 'testing', 'documentation', 'maintenance', 'deployment', 'custom'].includes(value)
  )
}

/**
 * Type guard to check if a value is a valid TemplateVariableType
 */
export function isTemplateVariableType(value: unknown): value is TemplateVariableType {
  return (
    typeof value === 'string' &&
    ['string', 'text', 'number', 'boolean', 'select', 'multiselect', 'file', 'directory'].includes(value)
  )
}

/**
 * Type guard to check if an object is a valid TemplateVariable
 */
export function isTemplateVariable(value: unknown): value is TemplateVariable {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  return (
    typeof obj.name === 'string' &&
    typeof obj.label === 'string' &&
    isTemplateVariableType(obj.type) &&
    typeof obj.required === 'boolean'
  )
}

/**
 * Type guard to check if an object is a valid TaskTemplate
 */
export function isTaskTemplate(value: unknown): value is TaskTemplate {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  return (
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.description === 'string' &&
    isTemplateCategory(obj.category) &&
    typeof obj.workflow === 'string' &&
    typeof obj.autonomy === 'string' &&
    typeof obj.descriptionTemplate === 'string' &&
    Array.isArray(obj.tags) &&
    typeof obj.isQuickAction === 'boolean' &&
    obj.createdAt instanceof Date &&
    obj.updatedAt instanceof Date
  )
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default template values
 */
export const DEFAULT_TEMPLATE_VALUES: Partial<CreateTemplateRequest> = {
  category: 'custom',
  autonomy: 'review-before-commit',
  priority: 'normal',
  effort: 'medium',
  tags: [],
  isQuickAction: false,
  variables: [],
}

/**
 * Template category display configuration
 */
export const TEMPLATE_CATEGORY_CONFIG: Record<TemplateCategory, { label: string; icon: string; color: string }> = {
  feature: { label: 'Feature', icon: 'plus', color: 'green' },
  bugfix: { label: 'Bug Fix', icon: 'bug', color: 'red' },
  refactoring: { label: 'Refactoring', icon: 'refresh', color: 'blue' },
  testing: { label: 'Testing', icon: 'check', color: 'purple' },
  documentation: { label: 'Documentation', icon: 'book', color: 'orange' },
  maintenance: { label: 'Maintenance', icon: 'wrench', color: 'gray' },
  deployment: { label: 'Deployment', icon: 'rocket', color: 'cyan' },
  custom: { label: 'Custom', icon: 'star', color: 'yellow' },
}

/**
 * Variable type display configuration
 */
export const VARIABLE_TYPE_CONFIG: Record<TemplateVariableType, { label: string; icon: string }> = {
  string: { label: 'Text', icon: 'type' },
  text: { label: 'Multi-line Text', icon: 'align-left' },
  number: { label: 'Number', icon: 'hash' },
  boolean: { label: 'Toggle', icon: 'toggle-left' },
  select: { label: 'Select', icon: 'list' },
  multiselect: { label: 'Multi-select', icon: 'check-square' },
  file: { label: 'File Path', icon: 'file' },
  directory: { label: 'Directory', icon: 'folder' },
}

// ============================================================================
// QuickActionsBar Component Props
// ============================================================================

/**
 * Props for QuickActionsBar component
 *
 * The QuickActionsBar displays templates marked as isQuickAction=true
 * as buttons for rapid task creation.
 *
 * @example
 * ```tsx
 * <QuickActionsBar
 *   onTaskCreated={(taskId, templateId) => {
 *     console.log(`Task ${taskId} created from template ${templateId}`)
 *   }}
 *   maxActions={6}
 *   compact={false}
 * />
 * ```
 */
export interface QuickActionsBarProps {
  /** Callback when a task is created successfully */
  onTaskCreated?: (taskId: string, templateId: string) => void

  /** Callback when task creation fails */
  onError?: (error: Error, templateId: string) => void

  /** Maximum number of quick actions to display (default: 8) */
  maxActions?: number

  /** Whether to show action icons (default: true) */
  showIcons?: boolean

  /** Whether component is in compact mode (default: false) */
  compact?: boolean

  /** Custom className */
  className?: string
}

/**
 * Props for QuickActionButton component
 *
 * Represents a single quick action button within the QuickActionsBar.
 */
export interface QuickActionButtonProps {
  /** The template to render as a button */
  template: TaskTemplate

  /** Callback when button is clicked */
  onClick: (template: TaskTemplate) => void

  /** Whether the button is in loading state */
  loading?: boolean

  /** Whether to show the template icon (default: true) */
  showIcon?: boolean

  /** Whether in compact mode (default: false) */
  compact?: boolean

  /** Custom className */
  className?: string
}

/**
 * Props for QuickActionVariableModal component
 *
 * Modal for collecting variable values when creating a task
 * from a template that has required variables.
 */
export interface QuickActionVariableModalProps {
  /** Whether the modal is open */
  isOpen: boolean

  /** The template to create task from */
  template: TaskTemplate

  /** Callback when modal is closed */
  onClose: () => void

  /** Callback when task is created successfully */
  onTaskCreated: (taskId: string) => void

  /** Callback when task creation fails */
  onError?: (error: Error) => void

  /**
   * Alternative callback for returning interpolated values
   * instead of creating task directly.
   * Used when modal is opened from CreateTaskDialog.
   */
  onVariablesSubmitted?: (interpolatedValues: {
    description: string
    acceptanceCriteria?: string
    workflow: string
    autonomy: AutonomyLevel
  }) => void
}

/**
 * Return type for useQuickActionTemplates hook
 *
 * Provides quick action templates and utilities for creating tasks.
 */
export interface UseQuickActionTemplatesReturn {
  /** Quick action templates (filtered by isQuickAction=true) */
  templates: TaskTemplate[]

  /** Loading state */
  isLoading: boolean

  /** Error state */
  error: string | null

  /** Refresh templates */
  refresh: () => Promise<void>

  /**
   * Create task from template
   * For templates without variables, creates immediately.
   * For templates with variables, returns false to indicate modal should open.
   */
  createTaskFromTemplate: (
    template: TaskTemplate,
    variables?: TemplateVariableValues
  ) => Promise<string>

  /** Check if template requires variable input */
  hasRequiredVariables: (template: TaskTemplate) => boolean
}

/**
 * Helper function to check if a template has required variables
 */
export function templateHasRequiredVariables(template: TaskTemplate): boolean {
  return (
    Array.isArray(template.variables) &&
    template.variables.some((v) => v.required)
  )
}

/**
 * Interpolates a template string with variable values
 *
 * @param template - Template string with {{variableName}} placeholders
 * @param values - Object mapping variable names to their values
 * @returns Interpolated string with placeholders replaced
 *
 * @example
 * ```typescript
 * const result = interpolateTemplateString(
 *   'Fix bug: {{bugTitle}} in {{component}}',
 *   { bugTitle: 'Login fails', component: 'AuthService' }
 * )
 * // result: 'Fix bug: Login fails in AuthService'
 * ```
 */
export function interpolateTemplateString(
  template: string,
  values: TemplateVariableValues
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    const value = values[varName]
    if (value === undefined) return match
    if (Array.isArray(value)) return value.join(', ')
    return String(value)
  })
}
