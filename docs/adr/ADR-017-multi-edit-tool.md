# ADR-017: MultiEdit Tool - Batch File Edits with Atomic Rollback

## Status
Proposed

## Context

APEX agents frequently need to make multiple related edits to a file as part of a single logical operation. Currently, they must use the `Edit` tool multiple times sequentially, which:

1. **Lacks Atomicity**: If one edit fails mid-sequence, partial changes remain in the file
2. **Is Inefficient**: Multiple file reads/writes instead of one
3. **Creates Risk**: No automatic rollback on failure leaves files in inconsistent states
4. **Is Verbose**: Multiple tool calls for related changes

The `MultiEdit` tool is already referenced in the codebase:
- Defined in `AgentToolSchema` in `types.ts` (line 14)
- Referenced in hooks.ts (line 96) for pre-tool-use auditing
- Listed in documentation and agent configurations

## Decision

Implement a `MultiEdit` tool that:

### 1. Interface Design

```typescript
interface MultiEditFileParams {
  /** Absolute path to the file to modify */
  file_path: string;
  /** Array of edits to apply in order */
  edits: MultiEditOperation[];
}

interface MultiEditOperation {
  /** The exact text to find and replace */
  old_string: string;
  /** The text to replace it with */
  new_string: string;
  /** Replace all occurrences (default: false) */
  replace_all?: boolean;
}

interface MultiEditFileOutput {
  /** Absolute path that was modified */
  filePath: string;
  /** Total number of edits applied */
  editsApplied: number;
  /** Results for each edit operation */
  editResults: EditOperationResult[];
  /** File size before and after */
  sizeChange: {
    before: number;
    after: number;
  };
  /** Combined preview of changes */
  changePreview: string;
}

interface EditOperationResult {
  /** Index of the edit (0-based) */
  index: number;
  /** Number of replacements made */
  replacements: number;
  /** Line numbers affected */
  modifiedLines: number[];
  /** Whether this edit was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
}
```

### 2. Atomic Rollback Strategy

The tool uses a **single backup, apply-all-or-nothing** approach:

```
1. Read original file content
2. Create backup: file.ext.backup.{timestamp}
3. Validate ALL edits can be applied (dry-run check):
   - Each old_string exists in current content
   - No ambiguous matches (unless replace_all=true)
   - Edits don't conflict (applying edit N doesn't invalidate edit N+1)
4. If validation passes:
   a. Apply all edits sequentially to in-memory content
   b. Write result to temp file: file.ext.tmp.{timestamp}
   c. Atomically rename temp to target
   d. Delete backup
5. If ANY step fails:
   a. Restore from backup (if file was modified)
   b. Clean up temp file
   c. Return detailed error with which edit failed
```

### 3. Edit Conflict Detection

Edits are applied sequentially on in-memory content. Conflicts are detected by:

1. **Pre-validation**: Before applying any edit, verify all `old_string` values exist in the original content
2. **Sequential Application**: Apply edits in order, updating the working content after each
3. **Overlap Detection**: If edit N changes text that edit M (where M > N) was searching for, detect and report as conflict

Example conflict scenario:
```typescript
edits: [
  { old_string: 'function foo()', new_string: 'function bar()' },
  { old_string: 'foo()', new_string: 'baz()' }  // This would now fail
]
```

The tool will warn about potential conflicts during pre-validation.

### 4. Error Classes

```typescript
// Reuse existing errors from EditTool
export { StringNotFoundError, AmbiguousReplacementError, FileAccessError } from './edit-tool.js';

// New errors for MultiEdit
export class BatchEditError extends Error {
  constructor(
    public failedEditIndex: number,
    public editError: Error,
    public appliedEdits: number
  );
}

export class EditConflictError extends Error {
  constructor(
    public conflictingEdits: [number, number],
    public reason: string
  );
}
```

### 5. Architecture Fit

Following existing patterns from `EditTool`:

```
packages/core/src/tools/filesystem/
├── multi-edit-tool.ts      # Main implementation
├── edit-tool.ts            # Existing (referenced for shared logic)
├── register.ts             # Add registration for MultiEdit
├── index.ts                # Export MultiEdit
└── __tests__/
    └── multi-edit-tool.test.ts  # Comprehensive tests
```

The tool will:
- Extend `BaseTool<MultiEditFileParams, MultiEditFileOutput>`
- Share validation logic with `EditTool` (path validation, sensitive paths)
- Use the same atomic file writing pattern
- Integrate with existing hooks (already configured in hooks.ts)

### 6. Parameter Schema

```typescript
{
  type: 'object',
  properties: {
    file_path: {
      type: 'string',
      description: 'The absolute path to the file to modify',
      minLength: 1
    },
    edits: {
      type: 'array',
      description: 'Array of edit operations to apply in order',
      minItems: 1,
      maxItems: 100,  // Reasonable limit
      items: {
        type: 'object',
        properties: {
          old_string: {
            type: 'string',
            description: 'The exact text to find',
            minLength: 1
          },
          new_string: {
            type: 'string',
            description: 'The text to replace it with'
          },
          replace_all: {
            type: 'boolean',
            description: 'Replace all occurrences',
            default: false
          }
        },
        required: ['old_string', 'new_string']
      }
    }
  },
  required: ['file_path', 'edits'],
  additionalProperties: false
}
```

## Consequences

### Positive
- **Atomic operations**: All edits succeed or none apply
- **Efficient**: Single file read/write for multiple changes
- **Safe**: Automatic rollback on failure
- **Consistent**: Follows established tool patterns
- **Debuggable**: Detailed per-edit results and error reporting

### Negative
- **Complexity**: More complex than single Edit tool
- **Memory**: Must hold entire file in memory (mitigated by MAX_FILE_SIZE)
- **Edit ordering**: Sequential application means order matters

### Neutral
- Same security constraints as EditTool (sensitive paths, file size limits)
- Hooks integration already exists (in hooks.ts)

## Implementation Notes

### Files to Create/Modify

1. **Create**: `packages/core/src/tools/filesystem/multi-edit-tool.ts`
   - Main tool implementation (~400 lines estimated)
   - Extends BaseTool
   - Implements atomic rollback pattern

2. **Create**: `packages/core/src/tools/filesystem/__tests__/multi-edit-tool.test.ts`
   - Unit tests for validation
   - Integration tests for file operations
   - Rollback behavior tests
   - Edge case coverage

3. **Modify**: `packages/core/src/tools/filesystem/register.ts`
   - Add `MultiEditTool` import and registration
   - Add `registerMultiEditTool()` and `createMultiEditTool()` functions

4. **Modify**: `packages/core/src/tools/filesystem/index.ts`
   - Export `MultiEditTool` and related types

5. **Modify**: `packages/core/src/tools/index.ts`
   - Export `MultiEditTool` from top-level tools module

### Key Implementation Patterns to Follow

From `EditTool`:
- Backup file creation pattern: `${resolvedPath}.backup.${Date.now()}`
- Atomic write pattern: temp file + rename
- Path validation with sensitive path check
- Error recovery with backup restoration
- Change preview generation

From `BaseTool`:
- Template method pattern via `executeImpl()`
- Validation via `validate()` override
- Parameter schema definition
- Timing and metadata in results

### Test Scenarios Required

1. **Basic Operations**
   - Single edit (verify it works like Edit)
   - Multiple edits on different parts of file
   - Multiple edits on same line

2. **Rollback Behavior**
   - Fail on second edit, verify original restored
   - Fail on write, verify backup restored
   - Concurrent access simulation

3. **Edge Cases**
   - Empty edits array (validation error)
   - 100 edits (max limit)
   - Large file with many edits
   - Unicode content
   - Mixed line endings

4. **Conflict Detection**
   - Overlapping edit targets
   - Cascading edits
   - Replace_all interactions

## References

- ADR-014: BaseTool abstract class pattern
- ADR-015: ToolRegistry singleton pattern
- EditTool implementation in `packages/core/src/tools/filesystem/edit-tool.ts`
- Hooks configuration in `packages/orchestrator/src/hooks.ts`
