# Architecture Decision Record: ExportDialog Component

**Status**: Proposed
**Date**: 2024-01-XX
**Author**: Architecture Agent
**ADR Number**: ADR-020

## Context

The APEX web UI needs a user-friendly way to export task data in various formats. Users should be able to:
- Select export format (JSON, CSV, Markdown)
- Filter by date range (preset or custom)
- Optionally select specific tasks to export
- Handle archived and trashed tasks appropriately

### Current State

1. **@apexcli/core Export Formatters** - Existing formatters for JSON, CSV, and Markdown
2. **Dialog.tsx** - Base dialog primitives used across the application
3. **CreateTaskDialog.tsx** - Pattern for complex dialogs with forms
4. **BulkActionConfirmationDialog.tsx** - Pattern for task selection and confirmation
5. **ChangelogFilters.tsx** - Pattern for date range filtering with presets
6. **Select.tsx** - Dropdown select component
7. **MultiSelect.tsx** - Multi-select component for task selection
8. **Input.tsx** - Input component with date type support

## Decision

### Architecture Overview

```
+----------------------------------------------------------------------+
|                          ExportDialog                                 |
|  +----------------------------------------------------------------+  |
|  |  DialogHeader                                                  |  |
|  |  "Export Tasks" + [X] Close                                    |  |
|  +----------------------------------------------------------------+  |
|                                                                       |
|  +----------------------------------------------------------------+  |
|  |  Format Selection (RadioGroup)                                 |  |
|  |  [x] JSON  - Full task data with all fields                    |  |
|  |  [ ] CSV   - Tabular format for spreadsheets                   |  |
|  |  [ ] Markdown - Human-readable documentation                   |  |
|  +----------------------------------------------------------------+  |
|                                                                       |
|  +----------------------------------------------------------------+  |
|  |  Date Range                                                    |  |
|  |  +------------------+  +------------+  +------------+          |  |
|  |  | Select Preset  v |  | From Date  |  |  To Date   |          |  |
|  |  +------------------+  +------------+  +------------+          |  |
|  +----------------------------------------------------------------+  |
|                                                                       |
|  +----------------------------------------------------------------+  |
|  |  [ ] Filter by specific tasks                                  |  |
|  |  +--------------------------------------------------+          |  |
|  |  | MultiSelect: Select tasks to export... (disabled)|          |  |
|  |  +--------------------------------------------------+          |  |
|  +----------------------------------------------------------------+  |
|                                                                       |
|  +----------------------------------------------------------------+  |
|  |  Options                                                       |  |
|  |  [ ] Include archived tasks                                    |  |
|  |  [ ] Include trashed tasks                                     |  |
|  +----------------------------------------------------------------+  |
|                                                                       |
|  +----------------------------------------------------------------+  |
|  |  [Error message if any]                                        |  |
|  +----------------------------------------------------------------+  |
|                                                                       |
|  +----------------------------------------------------------------+  |
|  |  DialogFooter                                                  |  |
|  |                               [Cancel]  [Export (12 tasks)]    |  |
|  +----------------------------------------------------------------+  |
+----------------------------------------------------------------------+
```

### Component Structure

```
packages/web-ui/src/components/export/
├── ExportDialog.tsx              # Main dialog component
├── ExportDialog.architecture.md  # This document
├── index.ts                      # Module exports
└── __tests__/
    ├── ExportDialog.test.tsx           # Unit tests
    ├── ExportDialog.integration.test.tsx # Integration tests
    └── ExportDialog.accessibility.test.tsx # A11y tests

packages/web-ui/src/types/
└── export-dialog.ts              # Type definitions (created)

packages/web-ui/src/hooks/
└── useExportTasks.ts             # Export hook (to be created by implementation)
```

### Key Design Decisions

#### D1: Use RadioGroup for Format Selection

**Decision**: Use RadioGroup component for format selection instead of a dropdown.

**Rationale**:
- Three options are easily visible at once
- Descriptions help users choose the right format
- Follows existing patterns in CreateTaskDialog
- Better accessibility with clear visual selection

**Interface**:
```typescript
const FORMAT_OPTIONS: RadioOption[] = [
  { value: 'json', label: 'JSON', description: 'Full task data with all fields' },
  { value: 'csv', label: 'CSV', description: 'Tabular format for spreadsheets' },
  { value: 'markdown', label: 'Markdown', description: 'Human-readable documentation' },
]
```

#### D2: Date Range with Presets and Custom Option

**Decision**: Provide preset date ranges with a custom option for flexibility.

**Rationale**:
- Most users want common ranges (last 7/30 days, this month)
- Custom option covers edge cases
- Follows ChangelogFilters pattern
- Reduces cognitive load

**Presets**:
```typescript
const DATE_RANGE_PRESETS = [
  'all',        // No date filter
  'today',      // Today only
  'yesterday',  // Yesterday only
  'last7days',  // Last 7 days
  'last30days', // Last 30 days
  'thisMonth',  // Start of current month to now
  'lastMonth',  // Previous full month
  'custom',     // Shows date pickers
]
```

#### D3: Optional Task Selection via MultiSelect

**Decision**: Task selection is optional, controlled by a checkbox toggle.

**Rationale**:
- Most exports will be date-range based, not task-specific
- Checkbox clearly indicates this is an optional feature
- MultiSelect only enabled when checkbox is checked
- Prevents confusion about the default behavior

**Flow**:
1. By default, all tasks matching date range are exported
2. User can check "Filter by specific tasks"
3. MultiSelect becomes enabled
4. User selects specific tasks
5. Only selected tasks are exported

#### D4: Integration with Core Export Formatters

**Decision**: Use existing formatters from @apexcli/core for actual export.

**Rationale**:
- DRY principle - don't duplicate formatting logic
- Consistency with CLI exports
- Already tested and documented
- Type-safe interfaces

**Integration**:
```typescript
import { formatTasksToJSON } from '@apexcli/core/export/json-formatter'
import { formatTasksToCSV } from '@apexcli/core/export/csv-formatter'
import { formatTasksToMarkdown } from '@apexcli/core/export/markdown-formatter'
```

#### D5: Client-Side File Download

**Decision**: Generate and download file client-side using Blob API.

**Rationale**:
- No backend changes required
- Immediate feedback
- Works offline (for cached task data)
- Simple implementation

**Implementation**:
```typescript
function downloadExport(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
```

### Data Flow

```
User opens ExportDialog
        |
        v
Component fetches available tasks (if not provided)
        |
        v
User configures export options:
  - Format selection
  - Date range preset/custom
  - Optional task filtering
  - Include archived/trashed
        |
        v
User clicks "Export"
        |
        v
validateExportOptions(options)
        |
        +---> Validation errors? Display errors, stay on form
        |
        v
applyExportFilters(tasks, options)
        |
        v
filteredTasks (count shown in button)
        |
        v
formatTasksTo{JSON|CSV|Markdown}(filteredTasks, formatOptions)
        |
        v
generateExportFilename(format)
        |
        v
downloadExport(content, filename, mimeType)
        |
        v
Close dialog / show success
```

### Component Props Interface

```typescript
interface ExportDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean
  /** Callback when dialog should close */
  onClose: () => void
  /** Callback when export is initiated */
  onExport: (options: ExportDialogOptions) => Promise<void>
  /** Available tasks for selection (optional - can be fetched internally) */
  availableTasks?: Task[]
  /** Whether export is currently in progress */
  isExporting?: boolean
  /** Error message to display */
  error?: string | null
  /** Optional className for styling */
  className?: string
}
```

### State Management

```typescript
interface ExportDialogState {
  options: ExportDialogOptions
  validationErrors: ExportDialogValidationErrors
  hasSubmitted: boolean
}

// Managed via useReducer or useState composition
```

### Accessibility Considerations

1. **Keyboard Navigation**:
   - Tab through all form controls
   - Enter to submit
   - Escape to cancel/close
   - Arrow keys for radio selection

2. **Screen Reader Support**:
   - Clear labels for all form controls
   - Error messages linked to inputs via aria-describedby
   - Live region for task count updates
   - Dialog title announced on open

3. **Focus Management**:
   - Focus first control on dialog open
   - Return focus to trigger on close
   - Focus trap within dialog

### Error Handling

1. **Validation Errors**:
   - Date range validation (start <= end)
   - Task selection (at least one if filtering)
   - Display inline with affected fields

2. **Export Errors**:
   - Formatter errors (malformed data)
   - Browser download failures
   - Show error banner with retry option

3. **No Tasks Found**:
   - Show informative message
   - Disable export button
   - Suggest adjusting filters

### Testing Strategy

1. **Unit Tests** (`__tests__/ExportDialog.test.tsx`):
   - Format selection changes
   - Date range preset application
   - Task filter toggle
   - Validation logic
   - Options state management

2. **Integration Tests** (`__tests__/ExportDialog.integration.test.tsx`):
   - End-to-end export flow
   - File download verification
   - Error handling scenarios

3. **Accessibility Tests** (`__tests__/ExportDialog.accessibility.test.tsx`):
   - Keyboard navigation
   - Screen reader announcements
   - Focus management

### Visual Design

The ExportDialog follows existing dialog patterns:

1. **Header**:
   - Icon + "Export Tasks" title
   - Close (X) button

2. **Content**:
   - Sections separated by spacing
   - Labels above inputs
   - Descriptions in muted text
   - Error messages in red below inputs

3. **Footer**:
   - Cancel button (secondary variant)
   - Export button (primary variant)
   - Export button shows task count: "Export (12 tasks)"
   - Loading state on export button

4. **Styling**:
   - Uses existing Tailwind classes
   - Consistent with BulkActionConfirmationDialog
   - Max-width: 32rem (max-w-lg)
   - Backdrop blur effect

### File Structure Summary

```
packages/web-ui/src/
├── components/export/
│   ├── ExportDialog.tsx              # NEW - Main component
│   ├── ExportDialog.architecture.md  # NEW - This document
│   ├── index.ts                      # NEW - Module exports
│   └── __tests__/
│       ├── ExportDialog.test.tsx           # NEW
│       ├── ExportDialog.integration.test.tsx # NEW
│       └── ExportDialog.accessibility.test.tsx # NEW
├── hooks/
│   └── useExportTasks.ts             # NEW - Export hook
└── types/
    ├── index.ts                      # MODIFIED - Add export
    └── export-dialog.ts              # NEW - Type definitions
```

### Implementation Plan

1. **Phase 1**: Create type definitions (COMPLETED)
   - ExportDialogFormat, ExportDateRange, ExportDialogOptions
   - Validation functions
   - Test IDs and ARIA labels

2. **Phase 2**: Create ExportDialog component
   - Format selection with RadioGroup
   - Date range with Select and Input[type="date"]
   - Task filter with Checkbox and MultiSelect
   - Include options checkboxes

3. **Phase 3**: Create useExportTasks hook
   - Task filtering logic
   - Format conversion
   - File download handling

4. **Phase 4**: Integration
   - Connect to API for task fetching
   - Wire up export formatters from @apexcli/core
   - Handle loading and error states

5. **Phase 5**: Testing
   - Unit tests for all interactions
   - Integration tests for full flow
   - Accessibility audit

## Consequences

### Positive

- Clean, reusable export functionality
- Consistent with existing dialog patterns
- Leverages existing @apexcli/core formatters
- Full accessibility support
- Type-safe configuration

### Negative

- Client-side export may be slow for very large datasets
- Limited by browser memory for large exports
- Requires task data to be available client-side

### Risks

- Large exports may cause browser performance issues
  - **Mitigation**: Add warning for >1000 tasks, consider pagination

- Export formatters may change in @apexcli/core
  - **Mitigation**: Version lock, integration tests

## References

- Export formatters: `packages/core/src/export/`
- Existing dialogs: `CreateTaskDialog.tsx`, `BulkActionConfirmationDialog.tsx`
- Date filtering pattern: `ChangelogFilters.tsx`
- UI components: `Select.tsx`, `RadioGroup.tsx`, `MultiSelect.tsx`, `Checkbox.tsx`
