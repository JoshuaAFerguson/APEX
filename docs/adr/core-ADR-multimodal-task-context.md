# ADR: Multimodal Task Context Support

## Status
Proposed

## Date
2024-01-15

## Context

APEX agents need the ability to process multimodal inputs (images, web pages, design mockups) as part of task context. The v0.6.0 release includes foundational multimodal input types (`ImageInput`, `WebPageInput`, `DesignMockupInput`, `MultimodalInput`, `MultimodalInputCollection`), but these types are not yet integrated into the task lifecycle.

### Current State
- `MultimodalInput` types already exist in `packages/core/src/types.ts` (lines 11620-12100)
- `CreateTaskRequest` interface does not support multimodal inputs
- `Task` interface does not store processed multimodal context
- No `MultimodalContext` type exists for processed/normalized multimodal data

### Requirements
1. `CreateTaskRequest` must include an optional `multimodalInputs` field
2. `Task` type must include processed multimodal context
3. New `MultimodalContext` type must be defined for storing processed multimodal data
4. All types must have corresponding Zod schemas for validation

## Decision

### 1. New Type: `MultimodalContextSchema` / `MultimodalContext`

Create a new type that represents the **processed** multimodal context attached to a task. This differs from `MultimodalInputCollection` in that it tracks processing status and results.

```typescript
/**
 * Processing status for individual multimodal inputs
 */
export const MultimodalProcessingStatusSchema = z.enum([
  'pending',      // Not yet processed
  'processing',   // Currently being processed
  'completed',    // Successfully processed
  'failed',       // Processing failed
  'skipped',      // Skipped (e.g., unsupported type)
]);
export type MultimodalProcessingStatus = z.infer<typeof MultimodalProcessingStatusSchema>;

/**
 * Processed multimodal input with status and results
 */
export const ProcessedMultimodalInputSchema = z.object({
  /** Original input */
  input: MultimodalInputSchema,

  /** Processing status */
  status: MultimodalProcessingStatusSchema,

  /** When processing started */
  processedAt?: z.date().optional(),

  /** Processing duration in milliseconds */
  processingDurationMs?: z.number().min(0).optional(),

  /** Error message if processing failed */
  error?: z.string().optional(),

  /** Extracted/analyzed content from the input */
  extractedContent?: z.object({
    /** Text content extracted from image/page */
    text?: z.string().optional(),
    /** Structured data extracted */
    structuredData?: z.record(z.string(), z.unknown()).optional(),
    /** Detected entities (e.g., UI components, text regions) */
    entities?: z.array(z.object({
      type: z.string(),
      value: z.string(),
      confidence?: z.number().min(0).max(1).optional(),
      bounds?: z.object({
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number(),
      }).optional(),
    })).optional(),
  }).optional(),
});
export type ProcessedMultimodalInput = z.infer<typeof ProcessedMultimodalInputSchema>;

/**
 * Multimodal context for a task - contains processed multimodal inputs
 * and aggregated context information for agent consumption
 */
export const MultimodalContextSchema = z.object({
  /** Array of processed multimodal inputs */
  inputs: z.array(ProcessedMultimodalInputSchema),

  /** Overall processing status */
  status: MultimodalProcessingStatusSchema,

  /** Combined context summary for agent consumption */
  contextSummary?: z.string().optional(),

  /** Timestamp when context was created */
  createdAt: z.date(),

  /** Timestamp when all processing completed */
  completedAt?: z.date().optional(),

  /** Total processing time across all inputs */
  totalProcessingTimeMs?: z.number().min(0).optional(),

  /** Count of inputs by type for quick reference */
  inputCounts: z.object({
    images: z.number().int().min(0).default(0),
    webPages: z.number().int().min(0).default(0),
    designMockups: z.number().int().min(0).default(0),
  }),

  /** Additional metadata */
  metadata?: z.record(z.string(), z.unknown()).optional(),
});
export type MultimodalContext = z.infer<typeof MultimodalContextSchema>;
```

### 2. Extend `CreateTaskRequest`

Add optional `multimodalInputs` field to the existing interface:

```typescript
export interface CreateTaskRequest {
  description: string;
  acceptanceCriteria?: string;
  workflow?: string;
  autonomy?: AutonomyLevel;
  priority?: TaskPriority;
  effort?: TaskEffort;
  projectPath?: string;

  // NEW: v0.6.0 Multimodal support
  /** Optional multimodal inputs to provide context for the task */
  multimodalInputs?: MultimodalInput[];
}
```

### 3. Extend `Task` Interface

Add `multimodalContext` field to store processed multimodal data:

```typescript
export interface Task {
  // ... existing fields ...

  // v0.6.0 multimodal support
  /** Processed multimodal context for the task */
  multimodalContext?: MultimodalContext;
}
```

### 4. Integration Points

#### 4.1 TaskStore (`packages/orchestrator/src/store.ts`)

The `buildTaskFromRequest` method will need to:
1. Accept multimodal inputs from the request
2. Initialize the `multimodalContext` with `pending` status
3. Store multimodal context in SQLite (JSON serialized)

```typescript
private buildTaskFromRequest(request: CreateTaskRequest): Task {
  const now = new Date();
  // ... existing code ...

  // Initialize multimodal context if inputs provided
  const multimodalContext = request.multimodalInputs?.length
    ? this.initializeMultimodalContext(request.multimodalInputs)
    : undefined;

  return {
    // ... existing fields ...
    multimodalContext,
  };
}
```

#### 4.2 API Server (`packages/api/src/index.ts`)

The POST `/tasks` endpoint accepts `CreateTaskRequest` and will automatically support multimodal inputs once the type is extended.

#### 4.3 Orchestrator (`packages/orchestrator/src/index.ts`)

The orchestrator will need to:
1. Process multimodal inputs before passing to agents
2. Update processing status as inputs are processed
3. Include processed context in agent prompts

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        CreateTaskRequest                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  description    │  │  workflow       │  │ multimodalInputs│ │
│  │  criteria       │  │  autonomy       │  │ (optional)      │ │
│  └─────────────────┘  └─────────────────┘  └────────┬────────┘ │
└───────────────────────────────────────────────────────┬────────┘
                                                        │
                        ┌───────────────────────────────▼────────┐
                        │           TaskStore.createTask()       │
                        │  - Initialize MultimodalContext        │
                        │  - Set status: 'pending'               │
                        └───────────────────────────────┬────────┘
                                                        │
                        ┌───────────────────────────────▼────────┐
                        │              Task                      │
                        │  ┌──────────────────────────────────┐  │
                        │  │      multimodalContext           │  │
                        │  │  - inputs: ProcessedInput[]      │  │
                        │  │  - status: processing status     │  │
                        │  │  - contextSummary: string        │  │
                        │  │  - inputCounts: { images, ... }  │  │
                        │  └──────────────────────────────────┘  │
                        └───────────────────────────────┬────────┘
                                                        │
                        ┌───────────────────────────────▼────────┐
                        │         Orchestrator Processing        │
                        │  - Process each input                  │
                        │  - Extract content                     │
                        │  - Update status                       │
                        │  - Generate context summary            │
                        └───────────────────────────────┬────────┘
                                                        │
                        ┌───────────────────────────────▼────────┐
                        │           Agent Execution              │
                        │  - Receives processed context          │
                        │  - Uses extracted content              │
                        │  - References design mockups           │
                        └────────────────────────────────────────┘
```

## Type Placement

All new types will be added to `packages/core/src/types.ts` immediately after the existing `MultimodalInputCollection` type (around line 12100):

1. `MultimodalProcessingStatusSchema` / `MultimodalProcessingStatus`
2. `ProcessedMultimodalInputSchema` / `ProcessedMultimodalInput`
3. `MultimodalContextSchema` / `MultimodalContext`

Then update:
4. `CreateTaskRequest` interface (line ~5826)
5. `Task` interface (line ~4700)

## Alternatives Considered

### Alternative 1: Embed inputs directly in Task
Store raw `MultimodalInput[]` directly on Task without processing status.

**Rejected because:**
- No way to track processing progress
- No place to store extracted content
- Agents would need to process raw inputs each time

### Alternative 2: Separate multimodal storage
Store multimodal context in a separate SQLite table.

**Rejected because:**
- Adds complexity for initial implementation
- Task context should be co-located with task data
- Can be refactored later if needed for performance

### Alternative 3: Use existing MultimodalInputCollection
Reuse the existing `MultimodalInputCollection` type directly.

**Rejected because:**
- Missing processing status tracking
- Missing extracted content storage
- Different purpose (input vs. processed context)

## Consequences

### Positive
- Clean separation between raw inputs and processed context
- Full processing status tracking
- Extensible for future multimodal types
- Backward compatible (optional fields)
- Strong type safety with Zod schemas

### Negative
- Increases Task object size when multimodal inputs present
- Requires SQLite schema consideration for storage
- Processing logic needs implementation in later stages

### Risks
- Large image data may impact performance
- Consider adding size limits in future iterations
- May need compression for storage efficiency

## Implementation Checklist

- [ ] Add `MultimodalProcessingStatusSchema` and type
- [ ] Add `ProcessedMultimodalInputSchema` and type
- [ ] Add `MultimodalContextSchema` and type
- [ ] Update `CreateTaskRequest` interface with `multimodalInputs`
- [ ] Update `Task` interface with `multimodalContext`
- [ ] Add comprehensive JSDoc documentation
- [ ] Add unit tests for new schemas
- [ ] Export new types from `packages/core/src/index.ts`
- [ ] Update TaskStore to handle multimodal context (future stage)
- [ ] Update Orchestrator to process inputs (future stage)
