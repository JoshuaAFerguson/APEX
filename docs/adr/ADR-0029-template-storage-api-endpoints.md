# ADR-0029: Template Storage and API Endpoints Architecture

## Status
Accepted

## Date
2024-03-16

## Context

The APEX system requires REST API endpoints for CRUD operations on task templates, enabling users to:
- Create reusable task templates with predefined properties
- List, retrieve, update, and delete templates
- Create tasks from templates with optional overrides

This ADR documents the technical design for the template storage and API endpoints in the orchestrator.

## Decision

### Architecture Overview

The template system follows a three-layer architecture:

```
┌─────────────────────────────────────────────────────────────────┐
│                        API Layer                                 │
│                    (packages/api/src/index.ts)                  │
│   REST Endpoints: POST/GET/PUT/DELETE /templates                │
│                   POST /templates/:id/create-task               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Orchestrator Layer                            │
│               (packages/orchestrator/src/index.ts)              │
│   Methods: createTemplate, listTemplates, getTemplate,          │
│            updateTemplate, deleteTemplate, useTemplate          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Store Layer                                 │
│               (packages/orchestrator/src/store.ts)              │
│   SQLite: task_templates table                                  │
│   Methods: createTemplate, getTemplate, getAllTemplates,        │
│            updateTemplate, deleteTemplate, createTaskFromTemplate│
└─────────────────────────────────────────────────────────────────┘
```

### API Endpoints

#### 1. POST /templates
Creates a new task template.

**Request Body:**
```typescript
interface CreateTemplateRequest {
  name: string;           // Required, max 100 chars
  description: string;    // Required
  workflow: string;       // Required
  priority?: string;      // Optional: 'low' | 'normal' | 'high' | 'urgent'
  effort?: string;        // Optional: 'xs' | 'small' | 'medium' | 'large' | 'xl'
  acceptanceCriteria?: string;  // Optional
  tags?: string[];        // Optional
}
```

**Response (201):**
```typescript
interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  workflow: string;
  priority: string;
  effort: string;
  acceptanceCriteria?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}
```

**Validation:**
- Name is required and cannot be empty or whitespace only
- Name must be 100 characters or less
- Description is required and cannot be empty
- Workflow is required and cannot be empty
- Priority must be one of: low, normal, high, urgent
- Effort must be one of: xs, small, medium, large, xl
- All string fields are trimmed of whitespace
- Default values: priority='normal', effort='medium', tags=[]

#### 2. GET /templates
Lists all templates.

**Response (200):**
```typescript
{
  templates: TaskTemplate[];
  count: number;
}
```

#### 3. GET /templates/:id
Gets a template by ID.

**Response (200):** `TaskTemplate`
**Response (404):** `{ error: 'Template not found' }`

#### 4. PUT /templates/:id
Updates a template.

**Request Body:**
```typescript
interface UpdateTemplateRequest {
  name?: string;
  description?: string;
  workflow?: string;
  priority?: string;
  effort?: string;
  acceptanceCriteria?: string;
  tags?: string[];
}
```

**Validation:**
- At least one field must be provided
- Same validation rules as POST for each field
- Empty string clears optional fields like acceptanceCriteria
- Empty array clears tags
- Fields not provided are preserved

**Response (200):** Updated `TaskTemplate`
**Response (404):** `{ error: 'Template not found' }`

#### 5. DELETE /templates/:id
Deletes a template.

**Response (200):** `{ ok: true, message: 'Template deleted' }`
**Response (404):** `{ error: 'Template not found' }`

#### 6. POST /templates/:id/create-task (To Be Implemented)
Creates a task from a template.

**Request Body:**
```typescript
interface CreateTaskFromTemplateRequest {
  description?: string;         // Override template description
  acceptanceCriteria?: string;  // Override acceptance criteria
  workflow?: string;            // Override workflow
  priority?: string;            // Override priority
  effort?: string;              // Override effort
  projectPath?: string;         // Project path for task
}
```

**Response (201):** Created `Task` object
**Response (404):** `{ error: 'Template not found' }`

### Data Model

The `task_templates` table in SQLite:

```sql
CREATE TABLE IF NOT EXISTS task_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  workflow TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal',
  effort TEXT NOT NULL DEFAULT 'medium',
  acceptance_criteria TEXT,
  tags TEXT,  -- JSON array stored as string
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### Store Layer Methods

All methods are implemented in `store.ts`:

1. **createTemplate(template)** - Inserts new template with timestamps
2. **getTemplate(id)** - Retrieves template by ID
3. **getAllTemplates()** - Lists all templates ordered by name
4. **getTemplatesByWorkflow(workflow)** - Filters by workflow
5. **searchTemplates(query)** - Full-text search on name/description
6. **updateTemplate(id, updates)** - Partial updates with timestamp
7. **deleteTemplate(id)** - Removes template
8. **createTaskFromTemplate(templateId, overrides)** - Creates task from template

### Orchestrator Layer Methods

Methods in `ApexOrchestrator` class:

1. **createTemplate(data)** - Generates ID and delegates to store
2. **listTemplates()** - Returns all templates
3. **getTemplate(id)** - Returns template or null
4. **updateTemplate(id, updates)** - Validates existence before update
5. **deleteTemplate(id)** - Validates existence before delete
6. **useTemplate(templateId, overrides)** - Creates task with logging

### Error Handling

Consistent error response format:
```typescript
{ error: string }
```

HTTP Status Codes:
- 200: Success
- 201: Created
- 400: Validation error
- 404: Not found
- 500: Server error

### Events

The orchestrator emits events for template operations:
- `template:created` - When a new template is created
- `template:updated` - When a template is updated

## Implementation Status

### Completed
- Store layer: All methods implemented and tested
- Orchestrator layer: All methods implemented
- API endpoints: POST, GET, PUT, DELETE for /templates

### Remaining Work
- **POST /templates/:id/create-task** endpoint needs to be added to the API layer
- The orchestrator's `useTemplate()` method exists and can be called from the new endpoint

### Implementation Plan for Missing Endpoint

Add to `packages/api/src/index.ts`:

```typescript
// Create task from template
app.post<{
  Params: { id: string };
  Body: CreateTaskFromTemplateRequest
}>('/templates/:id/create-task', async (request, reply) => {
  const { id } = request.params;
  const overrides = request.body;

  if (!id || !id.trim()) {
    return reply.status(400).send({ error: 'Template ID is required' });
  }

  try {
    const task = await orchestrator.useTemplate(id, overrides);
    return reply.status(201).send(task);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return reply.status(404).send({ error: 'Template not found' });
    }
    return reply.status(500).send({
      error: error instanceof Error ? error.message : 'Failed to create task from template'
    });
  }
});
```

## Consequences

### Positive
- Follows existing patterns established in the codebase
- Clean separation of concerns across layers
- Comprehensive validation at API layer
- Events enable reactive UI updates
- Templates are persisted to SQLite with full CRUD support

### Negative
- No built-in template versioning
- No template categories/folders structure
- Limited search capabilities (name/description only)

### Risks
- Large number of templates may impact list performance
- No pagination implemented for template listing

## References

- Existing task CRUD patterns in API
- Store layer patterns for tasks
- SQLite storage patterns
