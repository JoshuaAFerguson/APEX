# ADR-015: Edit Tool Implementation

## Status
Proposed

## Context

APEX needs a surgical file editing tool that enables agents to make precise, targeted changes to files without rewriting entire file contents. This is essential for:
- Safe code modifications during implementation stages
- Refactoring operations that need to preserve context
- Bug fixes that require minimal file changes
- Multi-step implementations that build upon previous edits

The tool must support:
1. **Exact string replacement** - Replace `old_string` with `new_string`
2. **Uniqueness validation** - Ensure `old_string` appears exactly once (when `replace_all` is false)
3. **Replace all option** - Allow replacing all occurrences when explicitly requested
4. **Indentation preservation** - Maintain file's existing whitespace patterns

## Decision

### 1. Tool Location and Structure

The Edit tool will be implemented in `packages/core/src/tools/edit.ts`, extending the existing `BaseTool` abstract class, following patterns established in ADR-014.

```
packages/core/src/tools/
├── base-tool.ts           # Existing - abstract base class
├── tool-registry.ts       # Existing - tool registry
├── edit.ts                # NEW - Edit tool implementation
├── index.ts               # MODIFY - add exports
└── __tests__/
    ├── edit.test.ts           # NEW - unit tests
    └── edit.integration.test.ts # NEW - integration tests
```

### 2. Type Definitions

```typescript
/**
 * Input parameters for the Edit tool
 */
export interface EditParams {
  /** Absolute path to the file to edit */
  file_path: string;
  /** Exact string to find and replace */
  old_string: string;
  /** Replacement string */
  new_string: string;
  /** Replace all occurrences (default: false) */
  replace_all?: boolean;
}

/**
 * Output result from the Edit tool
 */
export interface EditResult {
  /** Whether the edit was successful */
  success: boolean;
  /** Path to the edited file */
  file_path: string;
  /** Number of replacements made */
  occurrences_replaced: number;
  /** File size before edit (bytes) */
  old_size: number;
  /** File size after edit (bytes) */
  new_size: number;
  /** Preview of the change (context around first replacement) */
  preview?: {
    before: string;
    after: string;
    line_number: number;
  };
}
```

### 3. Validation Strategy

The tool implements a two-phase validation approach:

**Phase 1: Parameter Validation (in `validate()` method)**
- Verify `file_path` is provided and non-empty
- Verify `old_string` is provided and non-empty
- Verify `new_string` is provided (can be empty for deletions)
- Verify types are correct

**Phase 2: Business Logic Validation (in `validate()` method with file access)**
- Verify file exists and is readable
- Verify file is writable
- Check that `old_string` exists in the file
- **Uniqueness Check**: If `replace_all` is false, verify `old_string` appears exactly once
  - If it appears 0 times: Error with "old_string not found in file"
  - If it appears >1 times: Error with count and suggestion to use `replace_all` or provide more context

### 4. String Matching Algorithm

The tool uses **literal string matching** (not regex) to ensure predictable behavior:

```typescript
// Escape special regex characters for safe matching
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Count occurrences
function countOccurrences(content: string, searchStr: string): number {
  const escaped = escapeRegex(searchStr);
  const matches = content.match(new RegExp(escaped, 'g'));
  return matches ? matches.length : 0;
}

// Perform replacement
function replaceString(
  content: string,
  oldStr: string,
  newStr: string,
  replaceAll: boolean
): string {
  const escaped = escapeRegex(oldStr);
  if (replaceAll) {
    return content.replace(new RegExp(escaped, 'g'), newStr);
  }
  return content.replace(oldStr, newStr);  // Native replace for first occurrence
}
```

### 5. Indentation Preservation

The tool preserves indentation through these mechanisms:

1. **No automatic indentation adjustment** - The `new_string` is used exactly as provided
2. **Multi-line replacement support** - Users can include newlines and indentation in both `old_string` and `new_string`
3. **Line ending detection** - Detect and preserve the file's line ending style (LF vs CRLF)

```typescript
function detectLineEnding(content: string): '\n' | '\r\n' {
  const crlfCount = (content.match(/\r\n/g) || []).length;
  const lfCount = (content.match(/(?<!\r)\n/g) || []).length;
  return crlfCount > lfCount ? '\r\n' : '\n';
}
```

### 6. File Operations

```typescript
// Atomic write pattern
async function atomicWrite(filePath: string, content: string): Promise<void> {
  const tempPath = `${filePath}.tmp.${Date.now()}`;
  await fs.promises.writeFile(tempPath, content, 'utf-8');
  await fs.promises.rename(tempPath, filePath);
}
```

Key considerations:
- UTF-8 encoding for all file operations
- Atomic writes via temp file + rename to prevent corruption
- No backup files created (user should rely on git for history)

### 7. Preview Generation

For user feedback, generate a preview showing context around the change:

```typescript
interface ChangePreview {
  before: string;  // 3 lines context + old content
  after: string;   // 3 lines context + new content
  line_number: number;  // Line number where change occurs
}

function generatePreview(
  content: string,
  oldStr: string,
  newStr: string,
  contextLines: number = 3
): ChangePreview {
  const index = content.indexOf(oldStr);
  const lineNumber = content.substring(0, index).split('\n').length;

  // Extract context lines before and after
  const lines = content.split('\n');
  const startLine = Math.max(0, lineNumber - contextLines - 1);
  const endLine = Math.min(lines.length, lineNumber + contextLines);

  const beforeContext = lines.slice(startLine, endLine).join('\n');
  const afterContent = content.replace(oldStr, newStr);
  const afterLines = afterContent.split('\n');
  const afterContext = afterLines.slice(startLine, endLine).join('\n');

  return {
    before: beforeContext,
    after: afterContext,
    line_number: lineNumber
  };
}
```

### 8. Error Handling

The tool defines specific error conditions:

| Error Condition | Error Message |
|----------------|---------------|
| File not found | `File not found: {file_path}` |
| File not readable | `Cannot read file: {file_path}` |
| File not writable | `Cannot write to file: {file_path}` |
| old_string not found | `old_string not found in file` |
| Multiple occurrences (replace_all=false) | `old_string appears {N} times. Set replace_all: true or provide more context to make the match unique` |
| old_string equals new_string | `old_string and new_string are identical - no change needed` |
| Write failure | `Failed to write file: {error_message}` |

### 9. Tool Definition

```typescript
{
  name: 'Edit',
  description: 'Performs surgical file edits by replacing exact string matches. Use for precise code modifications, refactoring, and targeted fixes. Validates that old_string exists and is unique before making changes.',
  category: 'filesystem',
  dangerous: true,  // Modifies files
  permissions: ['write'],
  version: '1.0.0',
  parameters: {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: 'Absolute path to the file to edit'
      },
      old_string: {
        type: 'string',
        description: 'Exact string to find and replace (must be unique unless replace_all is true)'
      },
      new_string: {
        type: 'string',
        description: 'Replacement string (can be empty to delete)'
      },
      replace_all: {
        type: 'boolean',
        description: 'Replace all occurrences instead of requiring unique match',
        default: false
      }
    },
    required: ['file_path', 'old_string', 'new_string'],
    additionalProperties: false
  },
  tags: ['files', 'edit', 'refactor'],
  examples: [
    {
      name: 'Simple function rename',
      description: 'Rename a function across the file',
      input: {
        file_path: '/project/src/utils.ts',
        old_string: 'function oldName(',
        new_string: 'function newName(',
        replace_all: true
      }
    },
    {
      name: 'Fix typo',
      description: 'Fix a single unique typo',
      input: {
        file_path: '/project/README.md',
        old_string: 'teh quick brown fox',
        new_string: 'the quick brown fox'
      }
    },
    {
      name: 'Add import statement',
      description: 'Add a new import to existing imports',
      input: {
        file_path: '/project/src/index.ts',
        old_string: "import { foo } from './foo';",
        new_string: "import { foo } from './foo';\nimport { bar } from './bar';"
      }
    }
  ]
}
```

### 10. Integration with Tool Registry

The Edit tool will be:
1. Exported from `packages/core/src/tools/index.ts`
2. Available for registration in the ToolRegistry
3. Listed in `AgentToolSchema` in `types.ts` (already present as 'Edit')

## Consequences

### Positive
- **Safe editing** - Uniqueness validation prevents accidental mass replacements
- **Predictable behavior** - Literal string matching avoids regex complexity
- **Flexible** - `replace_all` option provides escape hatch for intentional bulk changes
- **Debuggable** - Preview output helps users understand what changed
- **Consistent** - Follows established BaseTool patterns from ADR-014

### Negative
- **Literal-only matching** - Cannot use regex patterns (by design, for safety)
- **File size limits** - Very large files may cause memory issues (future: streaming)
- **No merge conflict handling** - Multiple concurrent edits to same file may conflict

### Risks
- **Race conditions** - Concurrent edits to the same file from parallel tasks
  - Mitigation: Atomic writes, consider file locking in future
- **Encoding issues** - Non-UTF-8 files may be corrupted
  - Mitigation: Document UTF-8 requirement, add encoding detection later

## Testing Requirements

### Unit Tests (`edit.test.ts`)
1. Construction and configuration
2. Parameter validation (missing, invalid types)
3. Uniqueness validation (0, 1, N occurrences)
4. Single replacement
5. Replace all functionality
6. Empty new_string (deletion)
7. Multi-line replacements
8. Line ending preservation (LF, CRLF)
9. Error handling (file not found, permission denied)

### Integration Tests (`edit.integration.test.ts`)
1. Real file system operations
2. Atomic write verification
3. Large file handling
4. Concurrent edit handling
5. Context with ToolExecutionContext
6. Integration with ToolRegistry

## Implementation Notes

### File Structure
```
packages/core/src/tools/edit.ts
├── EditParams interface
├── EditResult interface
├── EditTool class
│   ├── constructor()
│   ├── validate() - parameter + business logic validation
│   └── executeImpl() - file read, transform, write
└── Helper functions
    ├── escapeRegex()
    ├── countOccurrences()
    ├── detectLineEnding()
    ├── generatePreview()
    └── atomicWrite()
```

### Dependencies
- `node:fs/promises` - File operations
- `node:path` - Path manipulation
- `BaseTool` from `./base-tool.js`
- Types from `../types.js`

## References
- ADR-014: BaseTool abstract class and ToolInterface
- Claude Code's Edit tool specification
- APEX types.ts AgentToolSchema
