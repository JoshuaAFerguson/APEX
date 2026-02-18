# ADR-016: NotebookEdit Tool Architecture

## Status
**Proposed** - Ready for Implementation

## Date
2024-12-30

## Context

APEX agents need the ability to edit Jupyter notebook (.ipynb) files to modify cell contents during automated development workflows. Unlike regular text files, Jupyter notebooks have a complex JSON structure with cells, metadata, and outputs that must be preserved during editing.

### Current State
- APEX has a robust tool framework with `BaseTool`, `EditTool`, `WriteTool`, etc.
- No existing notebook manipulation capabilities exist in the codebase
- Agents currently cannot modify Jupyter notebooks without using external tools

### Requirements (from Acceptance Criteria)
1. **Cell Replacement**: Replace entire cell content with new content
2. **Cell Insertion**: Add new cells at specified positions
3. **Cell Deletion**: Remove cells from the notebook
4. **Cell Type Support**: Handle code, markdown, and raw cell types
5. **Format Preservation**: Maintain notebook structure, metadata, and outputs
6. **Comprehensive Tests**: Verify notebook manipulation and format preservation

## Decision

Implement a `NotebookEditTool` following the established `BaseTool` pattern with specialized logic for Jupyter notebook cell manipulation.

### Architecture Overview

```
packages/core/src/tools/filesystem/
├── notebook-edit-tool.ts    # Main tool implementation
├── __tests__/
│   └── notebook-edit-tool.test.ts
├── index.ts                 # Update exports
└── register.ts              # Update registration
```

### 1. Input Parameters Interface

```typescript
/**
 * Edit modes for notebook cell operations
 */
export type NotebookEditMode = 'replace' | 'insert' | 'delete';

/**
 * Cell types supported in Jupyter notebooks
 */
export type NotebookCellType = 'code' | 'markdown' | 'raw';

/**
 * Input parameters for the NotebookEditTool
 */
export interface NotebookEditParams {
  /** Absolute path to the .ipynb file to modify */
  notebook_path: string;

  /** New source content for the cell (ignored for delete mode) */
  new_source: string;

  /**
   * Optional cell ID to identify which cell to edit.
   * When inserting, the new cell is inserted AFTER the cell with this ID.
   * If not specified during insert, the cell is added at the beginning.
   */
  cell_id?: string;

  /**
   * Cell type for the operation (required for insert mode).
   * For replace mode, if not specified, keeps the existing cell type.
   */
  cell_type?: NotebookCellType;

  /**
   * Edit mode: replace (default), insert, or delete
   * - replace: Replace the content of an existing cell
   * - insert: Add a new cell (after cell_id if specified, or at beginning)
   * - delete: Remove the cell (new_source is ignored)
   */
  edit_mode?: NotebookEditMode;
}
```

### 2. Output Interface

```typescript
/**
 * Output from NotebookEditTool execution
 */
export interface NotebookEditOutput {
  /** Path to the modified notebook */
  notebookPath: string;

  /** ID of the affected cell (new ID for insert, existing ID for replace/delete) */
  cellId: string;

  /** Index of the affected cell (0-based) */
  cellIndex: number;

  /** Type of the affected cell */
  cellType: NotebookCellType;

  /** The edit mode that was performed */
  editMode: NotebookEditMode;

  /** Total number of cells in the notebook after the operation */
  totalCells: number;

  /** Size of notebook file before and after */
  sizeChange: {
    before: number;
    after: number;
  };

  /** Preview of the cell content (first N lines) */
  contentPreview: string;
}
```

### 3. Error Classes

```typescript
/**
 * Error thrown when cell ID is not found in the notebook
 */
export class CellNotFoundError extends Error {
  constructor(cellId: string, notebookPath: string);
}

/**
 * Error thrown when notebook JSON is malformed
 */
export class InvalidNotebookError extends Error {
  constructor(notebookPath: string, reason: string);
}

/**
 * Error thrown when cell index is out of bounds
 */
export class CellIndexOutOfBoundsError extends Error {
  constructor(index: number, totalCells: number, notebookPath: string);
}

/**
 * Error thrown when required cell_type is missing for insert mode
 */
export class MissingCellTypeError extends Error {
  constructor();
}

/**
 * Error thrown when notebook file cannot be accessed
 */
export class NotebookAccessError extends Error {
  constructor(notebookPath: string, operation: string, originalError: Error);
}
```

### 4. Jupyter Notebook JSON Structure

The tool must understand and preserve this structure:

```typescript
interface JupyterNotebook {
  cells: JupyterCell[];
  metadata: Record<string, unknown>;
  nbformat: number;
  nbformat_minor: number;
}

interface JupyterCell {
  cell_type: 'code' | 'markdown' | 'raw';
  id?: string;  // Cell ID (nbformat 4.5+)
  source: string | string[];  // Content (may be string or array of lines)
  metadata: Record<string, unknown>;
  execution_count?: number | null;  // Only for code cells
  outputs?: unknown[];  // Only for code cells
}
```

### 5. Implementation Strategy

#### 5.1 Core Algorithm

```
1. VALIDATE parameters (path, mode, cell_type requirements)
2. READ and PARSE notebook JSON
3. VALIDATE notebook structure (nbformat, cells array)
4. LOCATE target cell by cell_id (or handle insertion position)
5. PERFORM operation:
   - replace: Update cell source, optionally cell_type
   - insert: Create new cell with ID, insert at position
   - delete: Remove cell from array
6. PRESERVE metadata and outputs (for code cells on replace)
7. WRITE notebook atomically (backup → temp → rename)
8. RETURN result with cell info and size changes
```

#### 5.2 Cell ID Handling

- **nbformat 4.5+**: Cells have unique `id` fields
- **Older notebooks**: Auto-generate UUIDs for cells missing IDs
- **ID Generation**: Use `crypto.randomUUID()` for new cells

#### 5.3 Source Format Normalization

Jupyter notebooks can store source as either:
- A single string: `"source": "line1\nline2\nline3"`
- An array of strings: `"source": ["line1\n", "line2\n", "line3"]`

The tool will:
- Accept input as a single string
- Normalize internal storage to array format for consistency with most tools
- Preserve existing format during replace to minimize diff noise

#### 5.4 Atomic Operations Pattern

Follow the same pattern as EditTool:
```typescript
1. Create backup: ${notebook_path}.backup.${timestamp}
2. Write to temp: ${notebook_path}.tmp.${timestamp}
3. Atomic rename: temp → original
4. Clean up backup on success
5. Restore backup on failure
```

### 6. Parameter Schema (JSON Schema)

```json
{
  "type": "object",
  "properties": {
    "notebook_path": {
      "type": "string",
      "description": "The absolute path to the Jupyter notebook file to edit (must be absolute, not relative)",
      "minLength": 1
    },
    "new_source": {
      "type": "string",
      "description": "The new source content for the cell"
    },
    "cell_id": {
      "type": "string",
      "description": "The ID of the cell to edit. When inserting a new cell, the new cell will be inserted after the cell with this ID, or at the beginning if not specified."
    },
    "cell_type": {
      "type": "string",
      "enum": ["code", "markdown"],
      "description": "The type of the cell (code or markdown). Required when inserting a new cell. If not specified for replace, keeps existing cell type."
    },
    "edit_mode": {
      "type": "string",
      "enum": ["replace", "insert", "delete"],
      "description": "The type of edit to make: replace (default), insert a new cell, or delete an existing cell",
      "default": "replace"
    }
  },
  "required": ["notebook_path", "new_source"],
  "additionalProperties": false
}
```

### 7. Validation Rules

1. **Path Validation**:
   - Must not be empty
   - Must not contain null bytes
   - Must have `.ipynb` extension (warning if not)
   - Must not be in sensitive system paths

2. **Mode-Specific Validation**:
   - `replace`: Requires either `cell_id` or notebook with single cell
   - `insert`: Requires `cell_type`
   - `delete`: Requires `cell_id`, `new_source` is ignored

3. **Structural Validation**:
   - Notebook must have valid `nbformat` (3 or 4)
   - Cells array must exist and be non-empty for replace/delete
   - Cell ID must exist in notebook for replace/delete

### 8. Security Considerations

1. **Path Traversal**: Use same validation as EditTool
2. **JSON Injection**: Use `JSON.parse/stringify` safely
3. **Large Files**: Limit notebook size (default 50MB like EditTool)
4. **Metadata Preservation**: Never modify cell metadata unexpectedly

### 9. Tool Registration

Add to `packages/core/src/tools/filesystem/`:

```typescript
// In register.ts
export function registerNotebookEditTool(): void {
  const registry = getToolRegistry();
  registry.register(new NotebookEditTool());
}

export function createNotebookEditTool(): NotebookEditTool {
  return new NotebookEditTool();
}

// Update registerFilesystemTools() to include NotebookEditTool
```

### 10. Type Updates

Add `'NotebookEdit'` to `AgentToolSchema` in `types.ts`:

```typescript
export const AgentToolSchema = z.enum([
  'Read',
  'Write',
  'Edit',
  'MultiEdit',
  'NotebookEdit',  // Add this
  'Bash',
  'Grep',
  'Glob',
  'WebFetch',
  'WebSearch',
]);
```

## Consequences

### Positive
- Follows established tool patterns for consistency
- Atomic operations ensure data safety
- Comprehensive error handling with domain-specific errors
- Cell ID-based targeting is more robust than index-based
- Format preservation maintains notebook compatibility

### Negative
- JSON parsing adds overhead compared to text replacement
- Must maintain compatibility with multiple nbformat versions
- Cell ID requirement may need education for users

### Risks
- Notebooks with non-standard structure may fail validation
- Large notebooks with many outputs could impact performance

## Implementation Files

1. `packages/core/src/tools/filesystem/notebook-edit-tool.ts` - Main implementation
2. `packages/core/src/tools/filesystem/__tests__/notebook-edit-tool.test.ts` - Unit tests
3. `packages/core/src/tools/filesystem/index.ts` - Export updates
4. `packages/core/src/tools/filesystem/register.ts` - Registration updates
5. `packages/core/src/types.ts` - Add 'NotebookEdit' to AgentToolSchema

## Test Categories

1. **Tool Definition Tests**: Verify definition structure, parameters, examples
2. **Parameter Validation Tests**: Valid params, missing fields, invalid types
3. **Cell Operations Tests**:
   - Replace cell content (code and markdown)
   - Insert new cell at beginning, middle, end
   - Delete cell by ID
   - Cell type change on replace
4. **Format Preservation Tests**:
   - Metadata preservation
   - Output preservation (for code cells)
   - Source format handling (string vs array)
5. **Error Handling Tests**:
   - File not found
   - Invalid notebook JSON
   - Cell not found
   - Cell index out of bounds
6. **Edge Cases Tests**:
   - Empty notebooks
   - Single-cell notebooks
   - Very large notebooks
   - Unicode content

## References

- [Jupyter Notebook Format](https://nbformat.readthedocs.io/en/latest/format_description.html)
- ADR-014: BaseTool Architecture
- `packages/core/src/tools/filesystem/edit-tool.ts` - Reference implementation
