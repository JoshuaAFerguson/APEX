# ADR-019: JSON Task Export Formatter

## Status
Accepted

## Context

APEX needs a dedicated JSON export formatter for exporting Task data with full details including logs, metrics, artifacts, and metadata. This is essential for:

1. **Data persistence**: Storing task execution history for analysis
2. **Integration**: Sharing task data with external systems
3. **Debugging**: Exporting task state for troubleshooting
4. **Reporting**: Generating task execution reports

The existing export infrastructure (ADR-018) provides the foundational types (`ExportFormatterInterface`, `ExportOptions`, `ExportResult`) but no concrete JSON formatter implementation exists for Task data.

## Decision

Implement a `json-formatter.ts` module that exports:

### Core Function
```typescript
export function formatTasksToJSON(tasks: Task[], options?: ExportOptions): string
```

### Architecture

#### 1. Module Structure
```
packages/core/src/export/
├── json-formatter.ts        # Main JSON formatter implementation
├── __tests__/
│   └── json-formatter.test.ts  # Unit tests (100% coverage target)
└── index.ts                 # Re-export formatTasksToJSON
```

#### 2. Function Signature

```typescript
/**
 * Formats an array of tasks to JSON string with full details
 *
 * @param tasks - Array of Task objects to export
 * @param options - Optional ExportOptions for formatting control
 * @returns JSON string representation of tasks
 * @throws Error if tasks is null/undefined or options validation fails
 */
export function formatTasksToJSON(
  tasks: Task[],
  options?: Partial<ExportOptions>
): string
```

#### 3. Output Schema

The JSON output will have the following structure:

```typescript
interface TaskExportDocument {
  /** Export metadata */
  metadata: {
    exportedAt: string;        // ISO 8601 timestamp
    version: string;           // Export schema version (e.g., "1.0.0")
    taskCount: number;         // Number of tasks exported
    format: "json";            // Export format identifier
  };
  /** Exported task data */
  tasks: ExportedTask[];
}

interface ExportedTask {
  // Core identification
  id: string;
  description: string;
  acceptanceCriteria?: string;

  // Workflow & execution state
  workflow: string;
  autonomy: AutonomyLevel;
  status: TaskStatus;
  priority: TaskPriority;
  effort: TaskEffort;
  currentStage?: string;

  // Project context
  projectPath: string;
  branchName?: string;
  prUrl?: string;

  // Retry & resume state
  retryCount: number;
  maxRetries: number;
  resumeAttempts: number;

  // Dependencies
  dependsOn?: string[];
  blockedBy?: string[];

  // Subtask hierarchy
  parentTaskId?: string;
  subtaskIds?: string[];
  subtaskStrategy?: SubtaskStrategy;

  // Execution flags
  dryRun?: boolean;

  // Timestamps (ISO 8601 format)
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  pausedAt?: string;
  resumeAfter?: string;
  trashedAt?: string;
  archivedAt?: string;
  pauseReason?: string;

  // Metrics & usage
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCost: number;
    totalCostCents: number;
    executionTimeMs: number;
  };

  // Execution logs
  logs: Array<{
    timestamp: string;
    level: 'debug' | 'info' | 'warn' | 'error';
    stage?: string;
    agent?: string;
    message: string;
    metadata?: Record<string, unknown>;
  }>;

  // Generated artifacts
  artifacts: Array<{
    name: string;
    type: 'file' | 'diff' | 'report' | 'log';
    path?: string;
    content?: string;
    createdAt: string;
  }>;

  // Error state
  error?: string;

  // Optional extended data (controlled by includeMetadata option)
  conversation?: AgentMessage[];
  workspace?: WorkspaceConfig;
  sessionData?: TaskSessionData;
  thoughtCaptures?: ThoughtCapture[];
  iterationHistory?: IterationHistory;
  policyCheckResult?: TaskPolicyCheckResult;
  approvalState?: ApprovalState;
  multimodalContext?: MultimodalContext;
}
```

#### 4. Options Handling

The formatter will respect these `ExportOptions` fields:

| Option | Default | Behavior |
|--------|---------|----------|
| `pretty` | `true` | When true, output is indented for readability |
| `indent` | `2` | Number of spaces or string for indentation |
| `includeMetadata` | `false` | When true, includes export metadata wrapper |
| `maxDepth` | `0` (unlimited) | Limits nesting depth in output |
| `maxItems` | `0` (unlimited) | Limits array items (logs, artifacts) |
| `includeFields` | `[]` (all) | Whitelist of fields to include |
| `excludeFields` | `[]` | Blacklist of fields to exclude |
| `sortKeys` | `false` | When true, sort object keys alphabetically |
| `includeNulls` | `true` | When true, include null/undefined values |
| `includeEmpty` | `true` | When true, include empty arrays/objects |
| `dateFormat` | ISO 8601 | Custom date format string |

#### 5. Implementation Approach

```typescript
// json-formatter.ts

import type { Task } from '../types.js';
import type { ExportOptions, PartialExportOptions } from './types.js';
import { createExportOptions } from './types.js';

// Default options for JSON export
const DEFAULT_JSON_OPTIONS: PartialExportOptions = {
  format: 'json',
  pretty: true,
  indent: 2,
  includeMetadata: false,
  sortKeys: false,
  includeNulls: true,
  includeEmpty: true,
};

/**
 * Formats an array of tasks to JSON string
 */
export function formatTasksToJSON(
  tasks: Task[],
  options?: PartialExportOptions
): string {
  // 1. Validate inputs
  validateInput(tasks, options);

  // 2. Merge with defaults
  const mergedOptions = createExportOptions('json', {
    ...DEFAULT_JSON_OPTIONS,
    ...options,
  });

  // 3. Transform tasks
  const transformedTasks = tasks.map(task =>
    transformTask(task, mergedOptions)
  );

  // 4. Build output structure
  const output = mergedOptions.includeMetadata
    ? buildDocumentWithMetadata(transformedTasks, mergedOptions)
    : transformedTasks;

  // 5. Serialize to JSON
  return serializeToJSON(output, mergedOptions);
}

// Internal helper functions...
function validateInput(tasks: Task[], options?: PartialExportOptions): void
function transformTask(task: Task, options: ExportOptions): Record<string, unknown>
function buildDocumentWithMetadata(tasks: unknown[], options: ExportOptions): TaskExportDocument
function serializeToJSON(data: unknown, options: ExportOptions): string
function serializeDates(obj: unknown): unknown
function filterFields(obj: Record<string, unknown>, options: ExportOptions): Record<string, unknown>
function limitArrays(obj: unknown, maxItems: number): unknown
function removeEmptyValues(obj: unknown): unknown
function sortObjectKeys(obj: unknown): unknown
```

#### 6. Error Handling Strategy

| Error Condition | Behavior |
|-----------------|----------|
| `tasks` is null/undefined | Throw `TypeError` with descriptive message |
| `tasks` is not an array | Throw `TypeError` with descriptive message |
| Invalid options | Let Zod validation throw (via `createExportOptions`) |
| Circular references | Use `JSON.stringify` built-in detection |
| Date serialization | Convert to ISO 8601 strings |
| BigInt values | Convert to strings with "n" suffix |
| Undefined values | Exclude from output (or include if `includeNulls: true`) |
| Symbol values | Exclude from output |
| Function values | Exclude from output |

#### 7. Performance Considerations

1. **Streaming for large datasets**: For tasks > 1000, consider adding streaming support in future
2. **Lazy transformation**: Only transform fields that will be included
3. **Memory efficiency**: Avoid deep cloning when possible
4. **Date caching**: Cache date format function if custom format specified

## Test Coverage Strategy

### Test Categories (100% coverage target)

1. **Input Validation**
   - Empty array handling
   - Null/undefined tasks
   - Invalid options
   - Type coercion prevention

2. **Basic Functionality**
   - Single task export
   - Multiple tasks export
   - All Task fields included
   - Default options behavior

3. **Options Handling**
   - `pretty: true/false`
   - `indent: number/string`
   - `includeMetadata: true/false`
   - `maxDepth` limiting
   - `maxItems` limiting
   - `includeFields` filtering
   - `excludeFields` filtering
   - `sortKeys: true/false`
   - `includeNulls: true/false`
   - `includeEmpty: true/false`
   - `dateFormat` custom format

4. **Task Data Transformation**
   - All TaskStatus values
   - All TaskPriority values
   - All TaskEffort values
   - Subtask relationships
   - Logs with all log levels
   - Artifacts with all types
   - Usage metrics
   - Session data
   - Approval state
   - Iteration history
   - Thought captures
   - Multimodal context

5. **Date Handling**
   - Date to ISO string conversion
   - Timezone handling
   - Invalid date handling

6. **Edge Cases**
   - Empty logs/artifacts arrays
   - Tasks with circular references (in metadata)
   - Unicode content
   - Very large tasks
   - Special characters in strings
   - BigInt values
   - Deeply nested objects

7. **Error Scenarios**
   - Serialization failures
   - Maximum call stack exceeded
   - Memory limits

### Test File Structure

```typescript
// json-formatter.test.ts

describe('formatTasksToJSON', () => {
  describe('Input Validation', () => { ... })
  describe('Basic Functionality', () => { ... })
  describe('Options Handling', () => {
    describe('pretty option', () => { ... })
    describe('indent option', () => { ... })
    describe('includeMetadata option', () => { ... })
    describe('maxDepth option', () => { ... })
    describe('maxItems option', () => { ... })
    describe('includeFields option', () => { ... })
    describe('excludeFields option', () => { ... })
    describe('sortKeys option', () => { ... })
    describe('includeNulls option', () => { ... })
    describe('includeEmpty option', () => { ... })
    describe('dateFormat option', () => { ... })
  })
  describe('Task Data Transformation', () => { ... })
  describe('Date Handling', () => { ... })
  describe('Edge Cases', () => { ... })
  describe('Error Scenarios', () => { ... })
})
```

## Consequences

### Positive
- **Consistent output format**: All JSON exports follow the same schema
- **Flexible options**: Users can customize output for their needs
- **Type safety**: Full TypeScript support with proper types
- **Testable**: Pure function design enables comprehensive testing
- **Extensible**: Easy to add new options or fields

### Negative
- **Memory usage**: Large task arrays may require significant memory
- **No streaming**: Initial implementation doesn't support streaming output
- **Date format limited**: Only ISO 8601 and basic formats supported initially

### Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Large export causes OOM | Add `maxItems` option, document limits |
| Breaking changes to Task type | Version output schema, add migration helpers |
| Performance degradation | Profile with large datasets, add benchmarks |

## Implementation Checklist

- [ ] Create `json-formatter.ts` with `formatTasksToJSON` function
- [ ] Implement all helper functions
- [ ] Add comprehensive JSDoc documentation
- [ ] Create `json-formatter.test.ts` with 100% coverage
- [ ] Update `index.ts` to export new function
- [ ] Run build and tests to verify
- [ ] Add usage examples in documentation

## Related

- ADR-018: Export Formatter Types and Interfaces
- Task interface definition in `types.ts`
- Test factories in `factories/task-factory.ts`
