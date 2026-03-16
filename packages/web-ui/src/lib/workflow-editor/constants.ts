/**
 * Constants and templates for the Visual Workflow Editor
 */

import type { StageTemplate, LayoutConfig } from '@/types/workflow-editor'

/**
 * Default layout configuration for stage positioning
 */
export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  nodeWidth: 280,
  nodeHeight: 120,
  horizontalSpacing: 80,
  verticalSpacing: 60,
  startX: 50,
  startY: 50,
}

/**
 * Pre-defined stage templates for the palette
 */
export const STAGE_TEMPLATES: StageTemplate[] = [
  {
    id: 'planning',
    name: 'Planning',
    agent: 'planner',
    description: 'Create implementation plan and analyze requirements',
    icon: 'clipboard-list',
    category: 'planning',
  },
  {
    id: 'architecture',
    name: 'Architecture',
    agent: 'architect',
    description: 'Design technical solution and system architecture',
    icon: 'building-2',
    category: 'planning',
  },
  {
    id: 'implementation',
    name: 'Implementation',
    agent: 'developer',
    description: 'Write code and implement features',
    icon: 'code',
    category: 'development',
  },
  {
    id: 'testing',
    name: 'Testing',
    agent: 'tester',
    description: 'Create and run tests',
    icon: 'flask-conical',
    category: 'testing',
  },
  {
    id: 'review',
    name: 'Code Review',
    agent: 'reviewer',
    description: 'Review code quality and security',
    icon: 'search-code',
    category: 'review',
  },
  {
    id: 'deployment',
    name: 'Deployment',
    agent: 'devops',
    description: 'Deploy to production environment',
    icon: 'rocket',
    category: 'deployment',
  },
  {
    id: 'documentation',
    name: 'Documentation',
    agent: 'technical-writer',
    description: 'Create or update documentation',
    icon: 'book-open',
    category: 'development',
  },
  {
    id: 'investigation',
    name: 'Investigation',
    agent: 'developer',
    description: 'Investigate issues or research solutions',
    icon: 'search',
    category: 'planning',
  },
]

/**
 * Available agent options for stage configuration
 */
export const AGENT_OPTIONS = [
  'planner',
  'architect',
  'developer',
  'tester',
  'reviewer',
  'devops',
  'technical-writer',
  'researcher',
  'security',
  'debugger',
] as const

/**
 * Valid status transitions for workflow validation
 */
export const VALID_STAGE_TRANSITIONS: Record<string, string[]> = {
  // All stages can transition to any other stage for now
  // This can be extended with more specific rules later
}

/**
 * Color scheme for different stage categories
 */
export const STAGE_CATEGORY_COLORS = {
  planning: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-800',
    icon: 'text-blue-600',
  },
  development: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-800',
    icon: 'text-green-600',
  },
  testing: {
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    text: 'text-purple-800',
    icon: 'text-purple-600',
  },
  review: {
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    text: 'text-orange-800',
    icon: 'text-orange-600',
  },
  deployment: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-800',
    icon: 'text-red-600',
  },
} as const

/**
 * Default workflow template for new workflows
 */
export const DEFAULT_WORKFLOW: {
  name: string
  description: string
  stages: []
  gates: []
} = {
  name: 'New Workflow',
  description: 'A new workflow created with the visual editor',
  stages: [],
  gates: [],
}

/**
 * Keyboard shortcuts for the editor
 */
export const KEYBOARD_SHORTCUTS = {
  save: { key: 'ctrl+s', mac: 'cmd+s', label: 'Save workflow' },
  undo: { key: 'ctrl+z', mac: 'cmd+z', label: 'Undo' },
  redo: { key: 'ctrl+shift+z', mac: 'cmd+shift+z', label: 'Redo' },
  export: { key: 'ctrl+e', mac: 'cmd+e', label: 'Export YAML' },
  import: { key: 'ctrl+i', mac: 'cmd+i', label: 'Import YAML' },
  delete: { key: 'delete', mac: 'delete', label: 'Delete selected stage' },
  escape: { key: 'escape', mac: 'escape', label: 'Deselect / Close panel' },
  selectAll: { key: 'ctrl+a', mac: 'cmd+a', label: 'Select all stages' },
} as const

/**
 * Validation error messages
 */
export const VALIDATION_MESSAGES = {
  REQUIRED_NAME: 'Workflow name is required',
  DUPLICATE_STAGE: 'Duplicate stage name: {name}',
  INVALID_DEPENDENCY: 'Invalid dependency: {dependency} does not exist',
  SELF_DEPENDENCY: 'Stage cannot depend on itself',
  CIRCULAR_DEPENDENCY: 'Circular dependency detected: {cycle}',
  INVALID_GATE: 'Referenced gate \'{gate}\' does not exist',
  UNKNOWN_AGENT: 'Unknown agent type: {agent}',
} as const

/**
 * Maximum limits for validation
 */
export const VALIDATION_LIMITS = {
  MAX_STAGES: 100,
  MAX_STAGE_NAME_LENGTH: 100,
  MAX_DESCRIPTION_LENGTH: 500,
  MAX_DEPENDENCIES: 20,
  MAX_GATES: 50,
} as const