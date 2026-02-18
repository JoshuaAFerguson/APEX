# ADR-016: Grep Tool Architecture

## Status

Proposed

## Date

2024-12-30

## Context

APEX needs a content search tool (Grep) that provides ripgrep-like functionality for searching code content. This tool will complement the existing Glob tool (file pattern matching) by enabling content-based search across files.

### Requirements from Acceptance Criteria

1. **Regex pattern matching** - Support full regular expression syntax
2. **File type filtering** - Filter by file types (e.g., `--type js`) and glob patterns
3. **Context lines** - Support `-A` (after), `-B` (before), `-C` (context) options
4. **Multiple output modes**:
   - `content` - Show matching lines with content
   - `files_with_matches` - Show only file paths
   - `count` - Show match counts per file
5. **Tests for search accuracy and performance**

### Existing Architecture Patterns

The tool system follows established patterns:
- `BaseTool<TInput, TOutput>` abstract class with template method pattern
- `ToolRegistry` singleton for centralized management
- Tools organized by category in subdirectories (`filesystem/`, `shell/`)
- Zod schemas in `types.ts` define `ToolCategory` including `'search'`

## Decision

### 1. Tool Location and Organization

Create a new `search/` subdirectory for search-related tools:

```
packages/core/src/tools/search/
├── index.ts           # Module exports
├── register.ts        # Registration utilities
├── grep-tool.ts       # GrepTool implementation
└── __tests__/
    ├── grep-tool.test.ts
    ├── grep-tool.integration.test.ts
    └── grep-tool.performance.test.ts
```

**Rationale**: The `'search'` category is already defined in `ToolCategorySchema`. Having a dedicated directory allows future search tools (e.g., semantic search, AST search) to be added.

### 2. GrepTool Interface Design

```typescript
/**
 * Input parameters for the Grep tool
 */
export interface GrepToolInput {
  /** The regex pattern to search for in file contents */
  pattern: string;

  /** File or directory to search in (defaults to cwd) */
  path?: string;

  /** Glob pattern to filter files (e.g., "*.js", "*.{ts,tsx}") */
  glob?: string;

  /** File type to search (e.g., "js", "py", "rust") - maps to rg --type */
  type?: string;

  /**
   * Output mode:
   * - "content": Show matching lines (default)
   * - "files_with_matches": Show only file paths
   * - "count": Show match counts per file
   */
  output_mode?: 'content' | 'files_with_matches' | 'count';

  /** Lines to show after each match (rg -A) */
  '-A'?: number;

  /** Lines to show before each match (rg -B) */
  '-B'?: number;

  /** Lines to show before and after each match (rg -C) */
  '-C'?: number;

  /** Case insensitive search (rg -i) */
  '-i'?: boolean;

  /** Show line numbers in output (rg -n) */
  '-n'?: boolean;

  /** Enable multiline mode (rg -U --multiline-dotall) */
  multiline?: boolean;

  /** Limit output to first N lines/entries */
  head_limit?: number;

  /** Skip first N lines/entries before applying head_limit */
  offset?: number;
}
```

### 3. GrepTool Output Design

```typescript
/**
 * A single grep match result
 */
export interface GrepMatch {
  /** Absolute path to the file */
  path: string;
  /** Line number (1-based) */
  line: number;
  /** Column number (1-based) */
  column: number;
  /** The matching line content */
  content: string;
  /** Context lines before the match */
  contextBefore?: string[];
  /** Context lines after the match */
  contextAfter?: string[];
}

/**
 * Match count for a single file
 */
export interface GrepFileCount {
  /** Absolute path to the file */
  path: string;
  /** Number of matches in this file */
  count: number;
}

/**
 * Output from the Grep tool (discriminated union based on output_mode)
 */
export interface GrepToolOutput {
  /** Output mode that was used */
  mode: 'content' | 'files_with_matches' | 'count';

  /** Pattern that was searched */
  pattern: string;

  /** Directory/file that was searched */
  searchPath: string;

  /** Time taken for the search in milliseconds */
  searchTime: number;

  /** Total number of matches found */
  totalMatches: number;

  /** Total number of files with matches */
  totalFiles: number;

  /** Whether results were truncated due to limits */
  truncated: boolean;

  // Mode-specific outputs (only one will be populated)

  /** Matches with content (when mode = 'content') */
  matches?: GrepMatch[];

  /** Files with matches (when mode = 'files_with_matches') */
  files?: string[];

  /** Match counts per file (when mode = 'count') */
  counts?: GrepFileCount[];
}
```

### 4. Implementation Strategy

#### 4.1 Ripgrep Integration

Use ripgrep (`rg`) as the underlying search engine for performance. The tool will:

1. **Check ripgrep availability** - Validate `rg` is installed at tool initialization
2. **Build command arguments** - Translate GrepToolInput into `rg` command-line arguments
3. **Execute via child process** - Use `child_process.spawn` for streaming output
4. **Parse JSON output** - Use `rg --json` for structured parsing

**Why ripgrep?**
- Industry-standard performance (faster than grep, ag)
- JSON output mode for structured parsing
- Built-in file type detection
- Unicode and binary file handling
- Already commonly available in development environments

**Fallback Strategy**:
If ripgrep is not available, emit a warning and provide graceful degradation with a pure JavaScript implementation using:
- `fast-glob` for file discovery (already in use by GlobTool)
- Node.js `readline` for streaming line-by-line search
- Built-in `RegExp` for pattern matching

#### 4.2 Key Implementation Patterns

Following `GlobTool` patterns:

```typescript
export class GrepTool extends BaseTool<GrepToolInput, GrepToolOutput> {
  /** Maximum number of results to return */
  private static readonly MAX_RESULTS = 10000;

  /** Maximum time to spend on search in milliseconds */
  private static readonly MAX_SEARCH_TIME = 60000; // 60 seconds

  /** Cache ripgrep availability check */
  private ripgrepAvailable: boolean | null = null;

  constructor() {
    super({
      name: 'Grep',
      description: 'A powerful search tool built on ripgrep for searching file contents...',
      category: 'search' as ToolCategory,
      permissions: ['read' as ToolPermission],
      dangerous: false,
      parameters: { /* ... */ },
      examples: [ /* ... */ ],
      version: '1.0.0',
      tags: ['search', 'content', 'regex', 'ripgrep'],
    });
  }

  validate(params: GrepToolInput, context?: ToolExecutionContext): ValidationResult {
    // 1. Call super.validate() for base validation
    // 2. Validate pattern is not empty
    // 3. Validate regex syntax
    // 4. Validate context line numbers are positive
    // 5. Warn about potentially slow patterns
  }

  protected async executeImpl(
    params: GrepToolInput,
    context?: ToolExecutionContext
  ): Promise<GrepToolOutput> {
    // 1. Check cancellation signal
    // 2. Resolve search path
    // 3. Check ripgrep availability (cached)
    // 4. Build and execute ripgrep command
    // 5. Parse JSON output
    // 6. Apply head_limit and offset
    // 7. Return structured output
  }
}
```

#### 4.3 Ripgrep Command Mapping

| GrepToolInput | ripgrep flag |
|---------------|--------------|
| `pattern` | Positional argument |
| `path` | Positional argument |
| `glob` | `--glob` |
| `type` | `--type` |
| `output_mode: 'files_with_matches'` | `--files-with-matches` |
| `output_mode: 'count'` | `--count` |
| `-A` | `-A` |
| `-B` | `-B` |
| `-C` | `-C` |
| `-i` | `-i` |
| `-n` | `-n` (default for content mode) |
| `multiline` | `-U --multiline-dotall` |

Always use `--json` for structured output parsing.

### 5. Error Handling

| Error Type | Handling |
|------------|----------|
| Invalid regex | Validate regex syntax before execution, return validation error |
| Directory not found | Check with `fs.stat`, throw descriptive error |
| Permission denied | Catch EACCES, throw descriptive error |
| Ripgrep not found | Fall back to JS implementation or throw with install instructions |
| Search timeout | Kill process, return partial results with `truncated: true` |
| Pattern matches binary | Respect rg default binary handling, skip binary files |

### 6. Security Considerations

1. **Path traversal** - Validate paths don't escape allowed directories
2. **Dangerous patterns** - Warn about `.*` catastrophic backtracking patterns
3. **Resource limits** - Enforce MAX_RESULTS and MAX_SEARCH_TIME
4. **System directory access** - Warn when accessing `/etc`, `/proc`, etc.
5. **Cancellation support** - Respect AbortSignal for long-running searches

### 7. Test Strategy

#### Unit Tests (`grep-tool.test.ts`)
- Pattern validation (valid regex, empty pattern, invalid regex)
- Parameter validation (context lines, output modes)
- Path resolution (absolute, relative, with context)
- Security validation (path traversal, system directories)

#### Integration Tests (`grep-tool.integration.test.ts`)
- Actual file system search with temp directories
- All output modes (content, files_with_matches, count)
- Context lines (-A, -B, -C)
- File type filtering
- Glob pattern filtering
- Multiline matching
- Case insensitive search
- Large file handling
- Cancellation via AbortSignal

#### Performance Tests (`grep-tool.performance.test.ts`)
- Large directory search
- Many small files
- Large files with many matches
- Complex regex patterns
- Memory usage under limits

## Consequences

### Positive

1. **High Performance** - Ripgrep integration provides industry-leading search speed
2. **Familiar API** - Parameters mirror ripgrep CLI for developer familiarity
3. **Consistent Patterns** - Follows established BaseTool patterns
4. **Multiple Output Modes** - Flexible output for different use cases
5. **Robust Fallback** - JS implementation ensures availability

### Negative

1. **External Dependency** - Optimal performance requires ripgrep installation
2. **Complexity** - Command-line argument translation adds complexity
3. **Platform Differences** - Must handle ripgrep behavior differences across OS

### Neutral

1. **New Directory Structure** - Creates `search/` directory for future expansion
2. **JSON Parsing Overhead** - Small overhead from ripgrep JSON output parsing

## Implementation Phases

### Phase 1: Core Implementation
- [ ] Create `search/` directory structure
- [ ] Implement `GrepTool` class with ripgrep integration
- [ ] Add to tool registry exports
- [ ] Basic unit tests

### Phase 2: Full Feature Set
- [ ] All output modes
- [ ] Context lines support
- [ ] File type and glob filtering
- [ ] Multiline matching
- [ ] Integration tests

### Phase 3: Polish and Fallback
- [ ] JavaScript fallback implementation
- [ ] Performance tests
- [ ] Documentation
- [ ] Edge case handling

## Related ADRs

- ADR-014: BaseTool abstract class design
- ADR-015: ToolRegistry singleton pattern

## References

- [Ripgrep User Guide](https://github.com/BurntSushi/ripgrep/blob/master/GUIDE.md)
- [Ripgrep JSON Output Format](https://docs.rs/grep-printer/latest/grep_printer/struct.JSON.html)
