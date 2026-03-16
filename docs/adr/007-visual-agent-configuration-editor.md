# ADR-007: Visual Agent Configuration Editor Architecture

## Status
Proposed

## Context

APEX needs a Visual Agent Configuration Editor that allows users to create and edit agent definitions through a form-based interface with live YAML/Markdown preview. The acceptance criteria require:

1. Form fields for all agent properties (name, description, prompt, tools, model, skills)
2. Live preview of generated agent file (Markdown with YAML frontmatter)
3. Validation errors shown inline
4. Save creates/updates agent file via API

This feature needs to integrate with the existing APEX web-ui architecture, which uses:
- React 18.3 with Next.js 15 App Router
- Custom hooks for state management (Context + Hooks pattern)
- Existing form components (FormField, Input, Select, MultiSelect)
- Zod schemas for validation (AgentDefinitionSchema)
- API Client pattern for server communication
- YAML serialization utilities (yaml package)

## Decision

### 1. Component Architecture

We will implement a layered component architecture following the existing patterns:

```
packages/web-ui/src/
├── app/agents/
│   └── editor/
│       └── page.tsx              # Route: /agents/editor/:name?
│       └── [name]/
│           └── page.tsx          # Route for editing existing agent
├── components/agent-editor/
│   ├── AgentEditorProvider.tsx   # Context provider
│   ├── AgentEditorForm.tsx       # Main form component
│   ├── AgentEditorPreview.tsx    # Live YAML/MD preview
│   ├── AgentEditorToolbar.tsx    # Save/Cancel actions
│   ├── fields/
│   │   ├── AgentNameField.tsx    # Name input with validation
│   │   ├── AgentDescriptionField.tsx
│   │   ├── AgentPromptField.tsx  # Multi-line textarea
│   │   ├── AgentToolsField.tsx   # Multi-select for tools
│   │   ├── AgentModelField.tsx   # Select for model (opus/sonnet/haiku/inherit)
│   │   └── AgentSkillsField.tsx  # Tag input for skills
│   └── index.ts                  # Barrel export
├── hooks/
│   ├── useAgentEditor.ts         # Main editor state hook
│   ├── useAgentValidation.ts     # Real-time validation
│   └── useAgentMarkdown.ts       # Markdown/YAML generation
├── lib/agent-editor/
│   ├── serialization.ts          # Agent ↔ Markdown conversion
│   ├── validation.ts             # Agent validation rules
│   └── constants.ts              # Editor constants
└── types/
    └── agent-editor.ts           # TypeScript types
```

### 2. Data Flow Architecture

```
                    ┌─────────────────────────────────────┐
                    │      AgentEditorProvider           │
                    │  (Context + State Management)       │
                    └─────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ AgentEditorForm │  │AgentEditorPreview│  │AgentEditorToolbar│
│  (Form Fields)  │  │  (Live Preview)  │  │  (Actions)       │
└─────────────────┘  └─────────────────┘  └─────────────────┘
         │                    ▲                    │
         │                    │                    │
         ▼                    │                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│useAgentEditor   │──▶│useAgentMarkdown│  │   API Client    │
│ (State Mgmt)    │  │(MD Generation)  │  │ (Save/Load)     │
└─────────────────┘  └─────────────────┘  └─────────────────┘
         │
         ▼
┌─────────────────┐
│useAgentValidation│
│ (Real-time)     │
└─────────────────┘
```

### 3. State Management

Following the existing Context + Hooks pattern from workflow editor:

```typescript
// useAgentEditor.ts
interface AgentEditorState {
  agent: AgentDefinition;
  isDirty: boolean;
  isLoading: boolean;
  isSaving: boolean;
  validationErrors: ValidationError[];
  originalAgent: AgentDefinition | null;
}

interface AgentEditorActions {
  updateField: <K extends keyof AgentDefinition>(field: K, value: AgentDefinition[K]) => void;
  resetForm: () => void;
  save: () => Promise<void>;
  loadAgent: (name: string) => Promise<void>;
}
```

### 4. Agent Markdown Format

Agent files use Markdown with YAML frontmatter (matching existing `.apex/agents/*.md` format):

```markdown
---
name: developer
description: Writes and reviews code
tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
model: sonnet
skills:
  - typescript
  - react
  - testing
---

You are a senior software developer working on the APEX project.

Your role is to implement features according to specifications while following best practices.

Key responsibilities:
- Write clean, maintainable code
- Follow project conventions and patterns
- Write comprehensive tests
- Document your implementation decisions
```

### 5. Validation Strategy

Implement real-time validation using:

1. **Zod Schema Validation**: Use existing `AgentDefinitionSchema` for structural validation
2. **Custom Validation Rules**: Additional UX-focused validations
3. **Inline Error Display**: Field-level error messages

```typescript
// Validation error structure (matching workflow editor)
interface ValidationError {
  path: string;      // Field path (e.g., 'name', 'tools')
  message: string;   // Human-readable message
  type: 'error' | 'warning';
}

// Validation rules
const VALIDATION_RULES = {
  name: {
    required: true,
    pattern: /^[a-z][a-z0-9-]*$/,
    maxLength: 50,
  },
  description: {
    required: true,
    maxLength: 200,
  },
  prompt: {
    required: true,
    minLength: 10,
  },
  tools: {
    minItems: 1,  // Warning only
  },
};
```

### 6. API Integration

Extend the API client and server to support agent CRUD operations:

```typescript
// API Client additions
class ApexApiClient {
  async createAgent(agent: AgentDefinition): Promise<AgentDefinition>;
  async updateAgent(name: string, agent: AgentDefinition): Promise<AgentDefinition>;
  async deleteAgent(name: string): Promise<void>;
  async getAgent(name: string): Promise<AgentDefinition>;
}

// API Server endpoints
POST   /api/agents              - Create new agent
PUT    /api/agents/:name        - Update existing agent
DELETE /api/agents/:name        - Delete agent
GET    /api/agents/:name        - Get single agent
GET    /api/agents              - List all agents (existing)
```

### 7. Serialization

Agent serialization follows the established pattern in `packages/core/src/config.ts`:

```typescript
// lib/agent-editor/serialization.ts

/**
 * Convert AgentDefinition to Markdown string with YAML frontmatter
 */
export function agentToMarkdown(agent: AgentDefinition): string;

/**
 * Parse Markdown with YAML frontmatter to AgentDefinition
 */
export function markdownToAgent(markdown: string): {
  agent: AgentDefinition | null;
  errors: ValidationError[];
};
```

### 8. UI Component Design

The editor will use a split-pane layout:

```
┌─────────────────────────────────────────────────────────────┐
│ Agent Editor                                     [Save] [×] │
├────────────────────────────┬────────────────────────────────┤
│ Form Fields                │ Live Preview                   │
│                            │                                │
│ Name: [_______________]    │ ---                            │
│ ⚠ Name is required         │ name: "my-agent"               │
│                            │ description: "..."             │
│ Description: [__________]  │ tools:                         │
│                            │   - Read                       │
│ Model: [sonnet ▼]          │   - Write                      │
│                            │ model: sonnet                  │
│ Tools: [Read, Write, ...]  │ ---                            │
│                            │                                │
│ Prompt:                    │ Your prompt text here...       │
│ ┌──────────────────────┐   │                                │
│ │                      │   │                                │
│ │                      │   │                                │
│ └──────────────────────┘   │                                │
│                            │                                │
│ Skills: [+ Add skill]      │                                │
│ [typescript] [react] [×]   │                                │
│                            │                                │
└────────────────────────────┴────────────────────────────────┘
```

## File Structure Summary

### New Files to Create

```
packages/web-ui/src/
├── app/agents/
│   └── editor/
│       ├── page.tsx                    # New agent editor page
│       └── [name]/
│           └── page.tsx                # Edit existing agent page
├── components/agent-editor/
│   ├── AgentEditorProvider.tsx         # Context provider
│   ├── AgentEditor.tsx                 # Main component (layout)
│   ├── AgentEditorForm.tsx             # Form with all fields
│   ├── AgentEditorPreview.tsx          # Live Markdown preview
│   ├── AgentEditorToolbar.tsx          # Save/Cancel buttons
│   ├── fields/
│   │   ├── AgentNameField.tsx
│   │   ├── AgentDescriptionField.tsx
│   │   ├── AgentPromptField.tsx
│   │   ├── AgentToolsField.tsx
│   │   ├── AgentModelField.tsx
│   │   └── AgentSkillsField.tsx
│   └── index.ts
├── hooks/
│   ├── useAgentEditor.ts
│   ├── useAgentValidation.ts
│   └── useAgentMarkdown.ts
├── lib/agent-editor/
│   ├── serialization.ts
│   ├── validation.ts
│   └── constants.ts
└── types/
    └── agent-editor.ts

packages/api/src/
└── routes/
    └── agents.ts                       # Agent CRUD endpoints

packages/core/src/
└── config.ts                           # Add serializeAgentMarkdown function
```

### Files to Modify

```
packages/web-ui/src/
├── lib/api-client.ts                   # Add agent CRUD methods
└── app/agents/page.tsx                 # Add "Create Agent" button

packages/api/src/
└── index.ts                            # Register agent routes
```

## Consequences

### Positive
- **Consistency**: Follows established patterns from workflow editor
- **Maintainability**: Clear separation of concerns with hooks/components/lib
- **Type Safety**: Full TypeScript integration with Zod validation
- **User Experience**: Real-time validation and live preview
- **Extensibility**: Easy to add new agent properties

### Negative
- **Initial Complexity**: Multiple new files and components
- **API Changes**: Requires new API endpoints

### Risks
- **Breaking Changes**: Agent file format must remain backward compatible
- **Performance**: Live preview updates on every keystroke (mitigated by debouncing)

## Implementation Phases

### Phase 1: Foundation (Developer Agent)
1. Create core hooks (useAgentEditor, useAgentValidation, useAgentMarkdown)
2. Create serialization utilities
3. Create basic form fields components

### Phase 2: UI Components (Developer Agent)
1. Implement AgentEditor main layout
2. Implement form fields with validation
3. Implement live preview panel
4. Implement toolbar with save/cancel

### Phase 3: API Integration (Developer Agent)
1. Add agent CRUD endpoints to API server
2. Update API client with new methods
3. Wire up save/load functionality

### Phase 4: Testing (Tester Agent)
1. Unit tests for hooks and utilities
2. Component tests for form fields
3. Integration tests for API endpoints
4. E2E tests for full workflow

## Related Documents

- ADR-003: Workflow Editor Architecture (pattern reference)
- AgentDefinitionSchema in packages/core/src/types.ts
- Agent file format in .apex/agents/*.md
