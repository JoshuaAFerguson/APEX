# ADR-0023: Visual Workflow Editor Architecture

## Status
Proposed

## Context

APEX needs a visual workflow editor that allows users to create and edit workflow YAML configurations through a graphical interface. Currently, users must manually edit YAML files to define workflows, which is error-prone and requires knowledge of the workflow schema.

### Requirements (from Acceptance Criteria)
1. Workflow stages displayed as nodes
2. Drag-and-drop stage reordering
3. Add/remove stages
4. Export to YAML format
5. Import existing workflows

### Existing Infrastructure Analysis

**Available Components & Libraries:**
- `@xyflow/react` (v12.0.0) - Already used for `DependencyGraph` and `TaskDependencyGraph`
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` - Already installed for Kanban board
- `yaml` (v2.3.4) - Available in `@apexcli/core` for parsing/stringifying YAML
- `zod` - Used for schema validation (`WorkflowDefinitionSchema`, `WorkflowStageSchema`)

**Existing Type Definitions:**
```typescript
// From packages/core/src/types.ts
interface WorkflowDefinition {
  name: string;
  description: string;
  trigger?: string[];
  stages: WorkflowStage[];
  gates?: WorkflowGate[];
  isolation?: IsolationConfig;
}

interface WorkflowStage {
  name: string;
  agent: string;
  description?: string;
  dependsOn?: string[];
  parallel?: boolean;
  inputs?: string[];
  outputs?: string[];
  condition?: string;
  actions?: string[];
  gate?: string | null;
  maxRetries?: number;
}
```

**Existing Patterns:**
- `DependencyGraph.tsx`: Base React Flow wrapper with node/edge handling
- `TaskDependencyGraph.tsx`: Specialized graph for task visualization
- `types/dependency-graph.ts`: Typed interfaces for graph nodes/edges
- ADR-0021 Kanban Board: @dnd-kit integration pattern

## Decision

### Library Selection: @xyflow/react (React Flow)

**Chosen: @xyflow/react** for the visual canvas, with **@dnd-kit** for the stage palette.

| Feature | @xyflow/react | Custom Canvas | D3.js |
|---------|---------------|---------------|-------|
| Node-based editing | Built-in | Manual | Manual |
| Connection handling | Built-in | Manual | Manual |
| Zoom/Pan | Built-in | Manual | Partial |
| TypeScript | Excellent | N/A | Good |
| Existing usage | Yes (DependencyGraph) | No | No |
| Learning curve | Low (existing) | High | High |
| Accessibility | Good | Manual | Manual |

**Rationale:**
1. Already used in codebase for `DependencyGraph` and `TaskDependencyGraph`
2. Excellent node/edge connection handling for stage dependencies
3. Built-in zoom, pan, minimap, and controls
4. Team familiarity with the library
5. @dnd-kit complements React Flow for palette drag-to-canvas

### Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                           WorkflowEditor (Main Container)                        │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │                          WorkflowEditorProvider                              │ │
│  │  ┌────────────────────────────────────────────────────────────────────────┐ │ │
│  │  │                     WorkflowEditorContext                               │ │ │
│  │  │  - workflow: WorkflowDefinition                                         │ │ │
│  │  │  - selectedStage: string | null                                         │ │ │
│  │  │  - isDirty: boolean                                                     │ │ │
│  │  │  - validationErrors: ValidationError[]                                  │ │ │
│  │  └────────────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                              │ │
│  │  ┌─────────────┬──────────────────────────────────────┬─────────────────┐  │ │
│  │  │   Toolbar   │           EditorCanvas               │  PropertiesPanel │  │ │
│  │  │  ┌───────┐  │  ┌────────────────────────────────┐  │  ┌─────────────┐ │  │ │
│  │  │  │Import │  │  │       ReactFlowProvider        │  │  │StageDetails │ │  │ │
│  │  │  │Export │  │  │  ┌──────────────────────────┐  │  │  │  - name     │ │  │ │
│  │  │  │Save   │  │  │  │      WorkflowCanvas      │  │  │  │  - agent    │ │  │ │
│  │  │  │Undo   │  │  │  │  ┌─────────┐ ┌─────────┐ │  │  │  │  - deps     │ │  │ │
│  │  │  │Redo   │  │  │  │  │StageNode│→│StageNode│ │  │  │  │  - outputs  │ │  │ │
│  │  │  └───────┘  │  │  │  └─────────┘ └─────────┘ │  │  │  │  - gate     │ │  │ │
│  │  │             │  │  │       ↓                   │  │  │  └─────────────┘ │  │ │
│  │  │  ┌───────┐  │  │  │  ┌─────────┐              │  │  │                  │  │ │
│  │  │  │Stage  │  │  │  │  │StageNode│              │  │  │  ┌─────────────┐ │  │ │
│  │  │  │Palette│  │  │  │  └─────────┘              │  │  │  │GateDetails  │ │  │ │
│  │  │  │(DnD)  │  │  │  └──────────────────────────┘  │  │  └─────────────┘ │  │ │
│  │  │  └───────┘  │  │  MiniMap | Controls | BG      │  │                   │  │ │
│  │  └─────────────┴──────────────────────────────────┴─────────────────────┘  │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │                          YAML Preview Panel                                  │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐ │ │
│  │  │ name: my-workflow                                                        │ │ │
│  │  │ stages:                                                                   │ │ │
│  │  │   - name: planning                                                        │ │ │
│  │  │     agent: planner                                                        │ │ │
│  │  └─────────────────────────────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────┘
```

### Component Structure

```
packages/web-ui/src/
├── components/
│   └── workflow-editor/
│       ├── index.ts                       # Public exports
│       ├── WorkflowEditor.tsx             # Main container component
│       ├── WorkflowEditorProvider.tsx     # Context provider
│       ├── EditorToolbar.tsx              # Import/Export/Save buttons
│       ├── EditorCanvas.tsx               # React Flow canvas wrapper
│       ├── StagePalette.tsx               # Draggable stage templates
│       ├── StageNode.tsx                  # Custom React Flow node
│       ├── DependencyEdge.tsx             # Custom edge with delete
│       ├── PropertiesPanel.tsx            # Stage/Gate property editor
│       ├── StagePropertiesForm.tsx        # Stage editing form
│       ├── GatePropertiesForm.tsx         # Gate editing form
│       ├── WorkflowPropertiesForm.tsx     # Workflow metadata form
│       ├── YamlPreviewPanel.tsx           # Live YAML output
│       └── __tests__/
│           ├── WorkflowEditor.test.tsx
│           ├── WorkflowEditor.integration.test.tsx
│           ├── EditorCanvas.test.tsx
│           ├── StageNode.test.tsx
│           ├── yaml-serialization.test.ts
│           └── workflow-validation.test.ts
├── hooks/
│   ├── useWorkflowEditor.ts               # Editor state management
│   ├── useWorkflowValidation.ts           # Real-time validation
│   ├── useWorkflowYaml.ts                 # YAML import/export
│   └── useWorkflowHistory.ts              # Undo/redo support
├── lib/
│   └── workflow-editor/
│       ├── index.ts
│       ├── serialization.ts               # YAML <-> WorkflowDefinition
│       ├── layout.ts                       # Auto-layout algorithm
│       ├── validation.ts                   # Schema validation
│       └── constants.ts                    # Default configs
├── types/
│   └── workflow-editor.ts                  # Editor-specific types
└── app/
    └── workflows/
        ├── page.tsx                        # Workflow list page
        ├── new/
        │   └── page.tsx                    # Create new workflow
        └── [id]/
            └── edit/
                └── page.tsx                # Edit existing workflow
```

### Type Definitions

```typescript
// types/workflow-editor.ts

import type { Node, Edge } from '@xyflow/react'
import type { WorkflowDefinition, WorkflowStage, WorkflowGate } from '@apexcli/core'

/**
 * Stage node data for React Flow
 */
export interface StageNodeData extends Record<string, unknown> {
  stage: WorkflowStage
  isSelected: boolean
  hasError: boolean
  errorMessage?: string
}

/**
 * Node types for the workflow editor
 */
export type WorkflowEditorNode = Node<StageNodeData>

/**
 * Edge data for dependency connections
 */
export interface DependencyEdgeData extends Record<string, unknown> {
  sourceStage: string
  targetStage: string
  isConditional?: boolean
}

/**
 * Edge types for the workflow editor
 */
export type WorkflowEditorEdge = Edge<DependencyEdgeData>

/**
 * Editor state interface
 */
export interface WorkflowEditorState {
  workflow: WorkflowDefinition
  nodes: WorkflowEditorNode[]
  edges: WorkflowEditorEdge[]
  selectedStageId: string | null
  selectedGateId: string | null
  isDirty: boolean
  validationErrors: ValidationError[]
  yamlPreview: string
}

/**
 * Validation error structure
 */
export interface ValidationError {
  path: string
  message: string
  type: 'error' | 'warning'
  stageId?: string
  gateId?: string
}

/**
 * Stage template for palette
 */
export interface StageTemplate {
  id: string
  name: string
  agent: string
  description: string
  icon: string
  category: 'planning' | 'development' | 'testing' | 'review' | 'deployment'
}

/**
 * Editor action types for undo/redo
 */
export type EditorAction =
  | { type: 'ADD_STAGE'; stage: WorkflowStage; position: { x: number; y: number } }
  | { type: 'REMOVE_STAGE'; stageId: string }
  | { type: 'UPDATE_STAGE'; stageId: string; updates: Partial<WorkflowStage> }
  | { type: 'REORDER_STAGES'; stageIds: string[] }
  | { type: 'ADD_DEPENDENCY'; source: string; target: string }
  | { type: 'REMOVE_DEPENDENCY'; source: string; target: string }
  | { type: 'ADD_GATE'; gate: WorkflowGate }
  | { type: 'REMOVE_GATE'; gateId: string }
  | { type: 'UPDATE_GATE'; gateId: string; updates: Partial<WorkflowGate> }
  | { type: 'UPDATE_WORKFLOW_METADATA'; updates: Partial<WorkflowDefinition> }
  | { type: 'IMPORT_YAML'; yaml: string }

/**
 * Editor context interface
 */
export interface WorkflowEditorContextValue {
  state: WorkflowEditorState
  dispatch: (action: EditorAction) => void

  // Stage operations
  addStage: (template: StageTemplate, position: { x: number; y: number }) => void
  removeStage: (stageId: string) => void
  updateStage: (stageId: string, updates: Partial<WorkflowStage>) => void
  selectStage: (stageId: string | null) => void

  // Dependency operations
  addDependency: (sourceStageId: string, targetStageId: string) => void
  removeDependency: (sourceStageId: string, targetStageId: string) => void

  // Gate operations
  addGate: (gate: WorkflowGate) => void
  removeGate: (gateId: string) => void
  updateGate: (gateId: string, updates: Partial<WorkflowGate>) => void

  // Workflow operations
  updateWorkflowMetadata: (updates: Partial<WorkflowDefinition>) => void

  // Import/Export
  importYaml: (yaml: string) => ValidationError[]
  exportYaml: () => string

  // History
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean

  // Validation
  validate: () => ValidationError[]
  isValid: boolean
}
```

### Hook Interfaces

```typescript
// hooks/useWorkflowEditor.ts

interface UseWorkflowEditorOptions {
  initialWorkflow?: WorkflowDefinition
  onChange?: (workflow: WorkflowDefinition) => void
  onValidationChange?: (errors: ValidationError[]) => void
}

interface UseWorkflowEditorReturn {
  // State
  workflow: WorkflowDefinition
  nodes: WorkflowEditorNode[]
  edges: WorkflowEditorEdge[]
  selectedStageId: string | null
  isDirty: boolean

  // Node handlers for React Flow
  onNodesChange: OnNodesChange
  onEdgesChange: OnEdgesChange
  onConnect: OnConnect
  onNodeClick: NodeMouseHandler
  onEdgeClick: EdgeMouseHandler

  // Stage operations
  addStage: (template: StageTemplate, position: { x: number; y: number }) => void
  removeStage: (stageId: string) => void
  updateStage: (stageId: string, updates: Partial<WorkflowStage>) => void

  // Workflow operations
  getWorkflow: () => WorkflowDefinition
  setWorkflow: (workflow: WorkflowDefinition) => void

  // History
  history: {
    undo: () => void
    redo: () => void
    canUndo: boolean
    canRedo: boolean
  }
}
```

```typescript
// hooks/useWorkflowYaml.ts

interface UseWorkflowYamlOptions {
  workflow: WorkflowDefinition
  onImport?: (workflow: WorkflowDefinition) => void
}

interface UseWorkflowYamlReturn {
  // YAML operations
  yamlPreview: string
  exportYaml: () => string
  importYaml: (yaml: string) => { success: boolean; errors: ValidationError[] }
  downloadYaml: (filename?: string) => void

  // File operations
  importFromFile: (file: File) => Promise<{ success: boolean; errors: ValidationError[] }>

  // Validation
  validateYaml: (yaml: string) => ValidationError[]
}
```

```typescript
// hooks/useWorkflowValidation.ts

interface UseWorkflowValidationReturn {
  errors: ValidationError[]
  warnings: ValidationError[]
  isValid: boolean
  validate: () => ValidationError[]
  getStageErrors: (stageId: string) => ValidationError[]
  getGateErrors: (gateId: string) => ValidationError[]
}
```

```typescript
// hooks/useWorkflowHistory.ts

interface UseWorkflowHistoryOptions<T> {
  initialState: T
  maxHistorySize?: number
}

interface UseWorkflowHistoryReturn<T> {
  state: T
  setState: (state: T | ((prev: T) => T)) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  clear: () => void
}
```

### StageNode Component Design

```typescript
// components/workflow-editor/StageNode.tsx

interface StageNodeProps {
  data: StageNodeData
  selected: boolean
}

/**
 * Custom React Flow node for workflow stages
 *
 * Visual Design:
 * ┌─────────────────────────────────┐
 * │ ○ Planning                   ⋮  │  ← Header with status dot & menu
 * │ ─────────────────────────────── │
 * │ 🤖 planner                      │  ← Agent badge
 * │ Create implementation plan      │  ← Description
 * │ ─────────────────────────────── │
 * │ Outputs: plan, subtasks         │  ← Outputs (collapsed)
 * │ Gate: approval-gate             │  ← Gate indicator
 * └─────────────────────────────────┘
 * ◀────────────────────────────────▶  ← Connection handles
 */
```

### YAML Serialization Strategy

```typescript
// lib/workflow-editor/serialization.ts

import { stringify, parse } from 'yaml'
import { WorkflowDefinitionSchema } from '@apexcli/core'

/**
 * Convert WorkflowDefinition to YAML string
 */
export function workflowToYaml(workflow: WorkflowDefinition): string {
  // Create clean object without undefined values
  const cleanWorkflow = {
    name: workflow.name,
    description: workflow.description,
    ...(workflow.trigger?.length && { trigger: workflow.trigger }),
    stages: workflow.stages.map(stage => ({
      name: stage.name,
      agent: stage.agent,
      ...(stage.description && { description: stage.description }),
      ...(stage.dependsOn?.length && { dependsOn: stage.dependsOn }),
      ...(stage.outputs?.length && { outputs: stage.outputs }),
      ...(stage.inputs?.length && { inputs: stage.inputs }),
      ...(stage.gate && { gate: stage.gate }),
      ...(stage.parallel && { parallel: stage.parallel }),
      ...(stage.condition && { condition: stage.condition }),
      ...(stage.maxRetries !== undefined && stage.maxRetries !== 2 && { maxRetries: stage.maxRetries }),
    })),
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
      })),
    }),
    ...(workflow.isolation && { isolation: workflow.isolation }),
  }

  return stringify(cleanWorkflow, {
    lineWidth: 0,      // No line wrapping
    minContentWidth: 0,
    defaultKeyType: 'PLAIN',
    defaultStringType: 'QUOTE_DOUBLE',
    doubleQuotedAsJSON: false,
    singleQuote: true,
  })
}

/**
 * Parse YAML string to WorkflowDefinition
 */
export function yamlToWorkflow(yaml: string): {
  workflow: WorkflowDefinition | null
  errors: ValidationError[]
} {
  try {
    const parsed = parse(yaml)
    const result = WorkflowDefinitionSchema.safeParse(parsed)

    if (result.success) {
      return { workflow: result.data, errors: [] }
    }

    // Convert Zod errors to ValidationErrors
    const errors: ValidationError[] = result.error.errors.map(err => ({
      path: err.path.join('.'),
      message: err.message,
      type: 'error',
    }))

    return { workflow: null, errors }
  } catch (e) {
    return {
      workflow: null,
      errors: [{ path: '', message: `Invalid YAML: ${e.message}`, type: 'error' }],
    }
  }
}
```

### Auto-Layout Algorithm

```typescript
// lib/workflow-editor/layout.ts

import type { WorkflowStage } from '@apexcli/core'
import type { WorkflowEditorNode } from '@/types/workflow-editor'

interface LayoutConfig {
  nodeWidth: number
  nodeHeight: number
  horizontalSpacing: number
  verticalSpacing: number
  startX: number
  startY: number
}

const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  nodeWidth: 280,
  nodeHeight: 120,
  horizontalSpacing: 80,
  verticalSpacing: 60,
  startX: 50,
  startY: 50,
}

/**
 * Calculate positions for workflow stages using topological sort
 * Stages are arranged in layers based on dependencies
 */
export function calculateStageLayout(
  stages: WorkflowStage[],
  config: LayoutConfig = DEFAULT_LAYOUT_CONFIG
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>()

  // Build dependency graph
  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()

  for (const stage of stages) {
    inDegree.set(stage.name, 0)
    adjacency.set(stage.name, [])
  }

  for (const stage of stages) {
    if (stage.dependsOn) {
      for (const dep of stage.dependsOn) {
        adjacency.get(dep)?.push(stage.name)
        inDegree.set(stage.name, (inDegree.get(stage.name) || 0) + 1)
      }
    }
  }

  // Topological sort into layers
  const layers: string[][] = []
  const remaining = new Set(stages.map(s => s.name))

  while (remaining.size > 0) {
    const layer: string[] = []

    for (const name of remaining) {
      if (inDegree.get(name) === 0) {
        layer.push(name)
      }
    }

    if (layer.length === 0) {
      // Cycle detected - place remaining nodes
      layer.push([...remaining][0])
    }

    for (const name of layer) {
      remaining.delete(name)
      for (const dependent of adjacency.get(name) || []) {
        inDegree.set(dependent, (inDegree.get(dependent) || 0) - 1)
      }
    }

    layers.push(layer)
  }

  // Calculate positions
  for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
    const layer = layers[layerIdx]
    const layerWidth = layer.length * (config.nodeWidth + config.horizontalSpacing) - config.horizontalSpacing
    const startX = config.startX + (layers[0].length * (config.nodeWidth + config.horizontalSpacing) - layerWidth) / 2

    for (let nodeIdx = 0; nodeIdx < layer.length; nodeIdx++) {
      positions.set(layer[nodeIdx], {
        x: startX + nodeIdx * (config.nodeWidth + config.horizontalSpacing),
        y: config.startY + layerIdx * (config.nodeHeight + config.verticalSpacing),
      })
    }
  }

  return positions
}
```

### Stage Palette Templates

```typescript
// lib/workflow-editor/constants.ts

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
]
```

### Validation Rules

```typescript
// lib/workflow-editor/validation.ts

export function validateWorkflow(workflow: WorkflowDefinition): ValidationError[] {
  const errors: ValidationError[] = []

  // 1. Workflow name validation
  if (!workflow.name || workflow.name.trim().length === 0) {
    errors.push({
      path: 'name',
      message: 'Workflow name is required',
      type: 'error',
    })
  }

  // 2. Stage name uniqueness
  const stageNames = new Set<string>()
  for (const stage of workflow.stages) {
    if (stageNames.has(stage.name)) {
      errors.push({
        path: `stages.${stage.name}`,
        message: `Duplicate stage name: ${stage.name}`,
        type: 'error',
        stageId: stage.name,
      })
    }
    stageNames.add(stage.name)
  }

  // 3. Dependency validation
  for (const stage of workflow.stages) {
    if (stage.dependsOn) {
      for (const dep of stage.dependsOn) {
        if (!stageNames.has(dep)) {
          errors.push({
            path: `stages.${stage.name}.dependsOn`,
            message: `Invalid dependency: ${dep} does not exist`,
            type: 'error',
            stageId: stage.name,
          })
        }
        if (dep === stage.name) {
          errors.push({
            path: `stages.${stage.name}.dependsOn`,
            message: 'Stage cannot depend on itself',
            type: 'error',
            stageId: stage.name,
          })
        }
      }
    }
  }

  // 4. Circular dependency detection
  const circularErrors = detectCircularDependencies(workflow.stages)
  errors.push(...circularErrors)

  // 5. Gate validation
  const gateIds = new Set(workflow.gates?.map(g => g.id) || [])
  for (const stage of workflow.stages) {
    if (stage.gate && !gateIds.has(stage.gate)) {
      errors.push({
        path: `stages.${stage.name}.gate`,
        message: `Referenced gate '${stage.gate}' does not exist`,
        type: 'error',
        stageId: stage.name,
      })
    }
  }

  // 6. Agent validation (warning only)
  for (const stage of workflow.stages) {
    if (!AGENT_OPTIONS.includes(stage.agent)) {
      errors.push({
        path: `stages.${stage.name}.agent`,
        message: `Unknown agent type: ${stage.agent}`,
        type: 'warning',
        stageId: stage.name,
      })
    }
  }

  return errors
}

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
          errors.push({
            path: 'stages',
            message: `Circular dependency detected: ${[...path, stageName, dep].join(' → ')}`,
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
```

### Drag-and-Drop from Palette to Canvas

```typescript
// Integration with @dnd-kit for palette dragging

import { DndContext, DragOverlay, useDraggable, useDroppable } from '@dnd-kit/core'

/**
 * The StagePalette contains draggable stage templates.
 * When dropped on the canvas, a new stage is created.
 */

// In StagePalette.tsx
function DraggablePaletteItem({ template }: { template: StageTemplate }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${template.id}`,
    data: { type: 'palette-template', template },
  })

  return (
    <div ref={setNodeRef} {...listeners} {...attributes}>
      <PaletteStageCard template={template} isDragging={isDragging} />
    </div>
  )
}

// In EditorCanvas.tsx
function EditorCanvas() {
  const { setNodeRef, isOver } = useDroppable({ id: 'workflow-canvas' })

  // ... React Flow integration
}

// In WorkflowEditor.tsx
function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event

  if (over?.id === 'workflow-canvas' && active.data.current?.type === 'palette-template') {
    const template = active.data.current.template as StageTemplate
    const position = calculateDropPosition(event) // Calculate based on mouse position

    addStage(template, position)
  }
}
```

### Error Handling & User Feedback

```typescript
interface EditorNotification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  action?: {
    label: string
    onClick: () => void
  }
  duration?: number
}

// Example notifications:
// - "Stage 'planning' added"
// - "Failed to import YAML: Invalid syntax at line 5"
// - "Workflow saved successfully"
// - "Circular dependency detected" (with highlight on affected stages)
// - "Validation warning: Unknown agent 'custom-agent'" (non-blocking)
```

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + S` | Save workflow |
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` | Redo |
| `Ctrl/Cmd + E` | Export YAML |
| `Ctrl/Cmd + I` | Import YAML |
| `Delete/Backspace` | Delete selected stage |
| `Escape` | Deselect / Close panel |
| `Ctrl/Cmd + A` | Select all stages |
| `Arrow keys` | Move selection |

### Accessibility (a11y)

1. **Keyboard Navigation**: Full keyboard support for all operations
2. **Screen Reader**: ARIA labels and announcements for drag operations
3. **Focus Management**: Proper focus trapping in modals/panels
4. **High Contrast**: Support for high contrast themes
5. **Motion Preferences**: Respect `prefers-reduced-motion`

```typescript
const a11yAnnouncements = {
  onDragStart: (template: StageTemplate) =>
    `Picked up ${template.name} stage. Drop on canvas to add.`,
  onDragOver: (isOverCanvas: boolean) =>
    isOverCanvas ? 'Over workflow canvas. Release to add stage.' : 'Not over canvas.',
  onDragEnd: (added: boolean) =>
    added ? 'Stage added to workflow.' : 'Drag cancelled.',
  onStageSelected: (stage: WorkflowStage) =>
    `Selected ${stage.name} stage. Press Delete to remove or Tab to edit properties.`,
  onDependencyCreated: (source: string, target: string) =>
    `Created dependency: ${target} now depends on ${source}.`,
}
```

### Performance Considerations

1. **Memoization**: Heavy use of `useMemo` and `memo` for node/edge components
2. **Debounced Validation**: Validate on input change with 300ms debounce
3. **Lazy YAML Generation**: Generate YAML preview only when visible
4. **Virtualization**: Consider virtualization for workflows with 50+ stages
5. **Optimistic Updates**: Update UI immediately, sync with validation async

### File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `components/workflow-editor/` | New directory | All editor components |
| `hooks/useWorkflowEditor.ts` | New | Editor state management |
| `hooks/useWorkflowValidation.ts` | New | Real-time validation |
| `hooks/useWorkflowYaml.ts` | New | YAML serialization |
| `hooks/useWorkflowHistory.ts` | New | Undo/redo support |
| `lib/workflow-editor/` | New directory | Serialization, layout, validation |
| `types/workflow-editor.ts` | New | Editor type definitions |
| `app/workflows/` | New directory | Workflow routes (list, create, edit) |
| `package.json` | Modified | May need `yaml` dependency |

## Consequences

### Positive
- Visual workflow creation without YAML knowledge
- Real-time validation prevents errors
- Import existing workflows for editing
- Consistent with existing React Flow patterns
- Full undo/redo support
- Accessible to all users
- Reuses existing libraries (@xyflow/react, @dnd-kit)

### Negative
- Increased bundle size (new components)
- Complex state management requirements
- Need to keep validation in sync with core schemas
- More testing surface area

### Risks
- Large workflows may have performance issues
- Complex dependency graphs may be hard to visualize
- YAML round-trip may lose formatting/comments

## Implementation Notes

### Phase 1: Core Editor (MVP)
1. Basic editor layout with canvas and properties panel
2. StageNode component with edit capabilities
3. Add/remove stages via palette drag-and-drop
4. Dependency connections via edge drawing
5. YAML export functionality

### Phase 2: Import & Validation
1. YAML import with error reporting
2. Real-time validation feedback
3. Undo/redo history
4. Workflow metadata editing (name, description, triggers)

### Phase 3: Advanced Features
1. Gate configuration UI
2. Auto-layout algorithm
3. Keyboard shortcuts
4. Workflow templates/presets
5. API integration (save to server)

### Phase 4: Polish
1. Animations and transitions
2. Accessibility improvements
3. Performance optimization
4. Comprehensive test coverage

## Testing Strategy

1. **Unit Tests**: Serialization, validation, layout algorithm
2. **Component Tests**: StageNode, PropertiesPanel, StagePalette
3. **Integration Tests**: Full editor flow (add, edit, connect, export)
4. **E2E Tests**: Create workflow from scratch, edit existing, import/export
5. **Accessibility Tests**: Keyboard navigation, screen reader compatibility
6. **Visual Regression**: Stage node appearance, layout consistency

## References
- [Existing DependencyGraph.tsx](../../packages/web-ui/src/components/graphs/DependencyGraph.tsx)
- [Existing TaskDependencyGraph.tsx](../../packages/web-ui/src/components/tasks/TaskDependencyGraph.tsx)
- [Workflow Types](../../packages/core/src/types.ts) (lines 1999-2013)
- [ADR-0021 Kanban Drag-and-Drop](./ADR-0021-kanban-drag-and-drop-architecture.md)
- [Existing Workflow Templates](../../packages/core/templates/workflows/)
- [@xyflow/react Documentation](https://reactflow.dev/docs/introduction)
- [@dnd-kit Documentation](https://docs.dndkit.com/)
