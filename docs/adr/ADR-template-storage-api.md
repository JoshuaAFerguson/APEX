# ADR: Task Template Storage and API Implementation

## Status: Implemented

## Context

The system requires the ability to create, store, retrieve, update, and delete task templates. Templates allow users to save reusable task configurations that can be quickly instantiated as new tasks, improving workflow efficiency and ensuring consistency across similar task types.

## Decision

We have implemented a three-layer architecture for task template management:

### 1. Core Types Layer (`@apexcli/core`)

**Location**: `packages/core/src/types.ts`

```typescript
export const TaskTemplateSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  description: z.string().min(1),
  workflow: z.string().min(1),
  priority: TaskPrioritySchema.default('normal'),
  effort: TaskEffortSchema.default('medium'),
  acceptanceCriteria: z.string().optional(),
  tags: z.array(z.string()).default([]),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type TaskTemplate = z.infer<typeof TaskTemplateSchema>;
```

**Location**: `packages/core/src/utils.ts`

```typescript
export function generateTaskTemplateId(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString('hex');
  return `template_${timestamp}_${random}`;
}
```

### 2. Persistence Layer (`@apexcli/orchestrator`)

**Location**: `packages/orchestrator/src/store.ts`

The TaskStore class implements all CRUD operations for templates using SQLite:

**Database Schema:**
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

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_task_templates_name ON task_templates(name);
CREATE INDEX IF NOT EXISTS idx_task_templates_workflow ON task_templates(workflow);
```

**Store Methods:**
- `createTemplate(template)` - Create a new template
- `getTemplate(id)` - Retrieve a single template by ID
- `getAllTemplates()` - List all templates (sorted by name)
- `getTemplatesByWorkflow(workflow)` - Filter templates by workflow
- `searchTemplates(query)` - Full-text search on name/description
- `updateTemplate(id, updates)` - Partial updates with automatic timestamp
- `deleteTemplate(id)` - Remove a template
- `createTaskFromTemplate(templateId, overrides)` - Instantiate a task from template

### 3. API Layer (`@apexcli/api`)

**Location**: `packages/api/src/index.ts`

REST endpoints follow standard CRUD patterns:

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/templates` | Create a new template |
| GET | `/templates` | List all templates |
| GET | `/templates/:id` | Get template by ID |
| PUT | `/templates/:id` | Update template by ID |
| DELETE | `/templates/:id` | Delete template by ID |
| POST | `/templates/:id/create-task` | Create task from template |

**Request/Response Types:**

```typescript
interface CreateTemplateRequest {
  name: string;
  description: string;
  workflow: string;
  priority?: string;
  effort?: string;
  acceptanceCriteria?: string;
  tags?: string[];
}

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

### 4. Orchestrator Layer

**Location**: `packages/orchestrator/src/index.ts`

The ApexOrchestrator class provides high-level methods that delegate to the store:

- `createTemplate(data)` - Creates template with generated ID
- `getTemplate(id)` - Retrieves template
- `listTemplates()` - Lists all templates
- `updateTemplate(id, updates)` - Updates template
- `deleteTemplate(id)` - Deletes template
- `useTemplate(templateId, overrides)` - Creates task from template
- `saveAsTemplate(taskId, name)` - Saves existing task as template

Events emitted:
- `template:created` - When a new template is created
- `template:updated` - When a template is modified

## Architecture Diagram

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   REST API      │────▶│  ApexOrchestrator │────▶│   TaskStore     │
│  (Fastify)      │     │                  │     │   (SQLite)      │
├─────────────────┤     ├──────────────────┤     ├─────────────────┤
│ POST /templates │     │ createTemplate() │     │ createTemplate()│
│ GET /templates  │     │ listTemplates()  │     │ getAllTemplates │
│ GET /:id        │     │ getTemplate()    │     │ getTemplate()   │
│ PUT /:id        │     │ updateTemplate() │     │ updateTemplate()│
│ DELETE /:id     │     │ deleteTemplate() │     │ deleteTemplate()│
│ POST /:id/task  │     │ useTemplate()    │     │ createTask()    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                  │
                                  ▼
                        ┌──────────────────┐
                        │  Event Emitter   │
                        │ template:created │
                        │ template:updated │
                        └──────────────────┘
```

## Consequences

### Positive
- **Consistency**: Templates ensure tasks are created with consistent configurations
- **Efficiency**: Users can quickly create tasks from saved templates
- **Flexibility**: Templates support partial overrides during instantiation
- **Searchability**: Full-text search and workflow filtering for easy discovery
- **Persistence**: SQLite storage with proper indexing for performance
- **Type Safety**: Zod schema validation ensures data integrity

### Negative
- **Complexity**: Additional layer of abstraction to maintain
- **Storage**: Templates add to database size (minimal impact)

## Testing

Template functionality is covered by:
- `packages/core/src/__tests__/task-template.schema.test.ts` - Schema validation
- `packages/orchestrator/src/store.test.ts` - Store CRUD operations
- API integration tests via endpoint testing

## Related ADRs
- ADR-001: Task persistence with SQLite
- ADR-002: Workflow system architecture

## Implementation Checklist

- [x] TaskTemplateSchema defined in @apexcli/core
- [x] generateTaskTemplateId utility in @apexcli/core
- [x] task_templates table in SQLite schema
- [x] TaskStore CRUD methods implemented
- [x] ApexOrchestrator template methods
- [x] REST API endpoints (POST, GET, PUT, DELETE)
- [x] POST /templates/:id/create-task endpoint
- [x] Event emission for template lifecycle
- [x] Unit tests for store operations
