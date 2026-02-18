# ADR-016: Write Tool Implementation

## Status

Proposed

## Context

APEX agents need the ability to create and modify files as part of their development workflows. The platform currently has:
- A robust `BaseTool` abstract class (ADR-014) providing standardized tool lifecycle
- A `ToolRegistry` singleton (ADR-015) for tool management
- Comprehensive type definitions with Zod validation
- The `AgentTool` enum already includes 'Write' as a recognized tool type

We need to implement a Write tool that allows agents to:
1. Create new files with specified content
2. Overwrite existing files when explicitly allowed
3. Automatically create parent directories when needed
4. Validate file paths for security and correctness

## Decision

### 1. Tool Design

Implement `WriteTool` extending `BaseTool` with the following interface:

```typescript
interface WriteFileParams {
  filePath: string;           // Absolute or relative path to write
  content: string;            // Content to write to the file
  encoding?: BufferEncoding;  // File encoding (default: 'utf-8')
  overwrite?: boolean;        // Allow overwriting existing files (default: false)
  createDirectories?: boolean; // Create parent directories (default: true)
  backup?: boolean;           // Create .bak backup before overwrite (default: false)
}

interface WriteFileOutput {
  filePath: string;           // Absolute path that was written
  bytesWritten: number;       // Number of bytes written
  created: boolean;           // true if new file, false if overwritten
  backupPath?: string;        // Path to backup file if created
  directoriesCreated?: string[]; // Directories that were created
}
```

### 2. Overwrite Protection Strategy

The tool implements a multi-layer overwrite protection:

1. **Default Deny**: `overwrite: false` by default prevents accidental overwrites
2. **Explicit Allow**: Setting `overwrite: true` required to modify existing files
3. **Optional Backup**: When `backup: true`, creates `.bak` copy before overwriting
4. **Atomic Write Pattern**: Write to temp file, then rename to avoid corruption

### 3. Path Validation

The tool validates paths to prevent security issues:

1. **Path Normalization**: Resolve relative paths against `workingDirectory` from context
2. **Path Traversal Prevention**: Block paths containing `..` that escape working directory
3. **Special Path Handling**: Block writes to sensitive paths (e.g., `/etc`, `/usr`)
4. **Platform-Aware**: Handle Windows vs Unix path differences

### 4. Directory Creation

When `createDirectories: true` (default):
- Use `fs.mkdir(dirPath, { recursive: true })` to create parent directories
- Track which directories were created for output reporting
- Handle race conditions where directories may be created concurrently

### 5. Error Handling

The tool handles specific error cases with descriptive messages:

| Error Type | Condition | Message |
|------------|-----------|---------|
| `EEXIST` | File exists, overwrite=false | "File already exists: {path}. Set overwrite=true to replace." |
| `ENOENT` | Parent dir missing, createDirectories=false | "Parent directory does not exist: {dir}" |
| `EACCES` | No write permission | "Permission denied writing to: {path}" |
| `ENOSPC` | Disk full | "No space left on device for: {path}" |
| `ENAMETOOLONG` | Path too long | "Path exceeds maximum length: {path}" |
| `PathTraversal` | Escapes working directory | "Path escapes working directory: {path}" |

### 6. Tool Definition

```typescript
{
  name: 'Write',
  description: 'Write content to a file with optional overwrite protection and backup',
  category: 'filesystem',
  permissions: ['write'],
  dangerous: false,  // Protected by overwrite flag
  version: '1.0.0',
  tags: ['file', 'write', 'create', 'filesystem'],
  parameters: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Path to the file (absolute or relative to working directory)'
      },
      content: {
        type: 'string',
        description: 'Content to write to the file'
      },
      encoding: {
        type: 'string',
        description: 'File encoding (default: utf-8)',
        enum: ['utf-8', 'ascii', 'utf16le', 'latin1', 'base64', 'hex']
      },
      overwrite: {
        type: 'boolean',
        description: 'Allow overwriting existing files (default: false)'
      },
      createDirectories: {
        type: 'boolean',
        description: 'Create parent directories if they do not exist (default: true)'
      },
      backup: {
        type: 'boolean',
        description: 'Create backup (.bak) before overwriting (default: false)'
      }
    },
    required: ['filePath', 'content'],
    additionalProperties: false
  },
  examples: [
    {
      name: 'Create new file',
      description: 'Write a new file with default settings',
      input: { filePath: 'src/utils.ts', content: 'export const add = (a, b) => a + b;' }
    },
    {
      name: 'Overwrite with backup',
      description: 'Replace existing file with backup',
      input: { filePath: 'config.json', content: '{}', overwrite: true, backup: true }
    }
  ]
}
```

## Implementation Structure

```
packages/core/src/tools/
├── base-tool.ts         # Existing abstract class
├── tool-registry.ts     # Existing registry
├── write-tool.ts        # NEW: WriteTool implementation
├── __tests__/
│   └── write-tool.test.ts  # NEW: Comprehensive tests
└── index.ts             # Updated exports
```

## Test Strategy

Tests will cover:

1. **Happy Path Tests**
   - Create new file with content
   - Create file in nested directory (with directory creation)
   - Overwrite existing file with permission

2. **Overwrite Protection Tests**
   - Reject overwrite when overwrite=false
   - Allow overwrite when overwrite=true
   - Create backup when backup=true

3. **Directory Creation Tests**
   - Create missing parent directories
   - Skip creation when createDirectories=false
   - Handle existing directories gracefully

4. **Error Handling Tests**
   - Handle permission denied
   - Handle disk full (mock)
   - Handle path traversal attempts
   - Handle invalid encoding

5. **Path Validation Tests**
   - Resolve relative paths correctly
   - Block path traversal attacks
   - Handle special characters in paths

6. **Integration Tests**
   - Register with ToolRegistry
   - Execute through ToolRegistry.getToolInterface()
   - Verify invocation statistics tracked

## Consequences

### Positive
- Agents can safely create and modify files during task execution
- Overwrite protection prevents accidental data loss
- Backup option provides safety net for critical operations
- Path validation prevents security vulnerabilities
- Integrates seamlessly with existing tool infrastructure

### Negative
- Additional complexity for file operations
- Backup files may accumulate if not cleaned up
- Path restrictions may limit some edge case operations

### Mitigations
- Document overwrite behavior clearly
- Consider adding backup cleanup utility
- Provide escape hatch via dangerous flag for restricted paths if needed

## References

- ADR-014: BaseTool Abstract Class
- ADR-015: ToolRegistry Implementation
- Node.js `fs/promises` API documentation
- OWASP Path Traversal Prevention Guidelines
