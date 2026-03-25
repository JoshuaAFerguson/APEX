# ADR-0056: Bulk Export Button Integration Architecture

## Status
Proposed (Architecture Stage: 2026-03-25)

## Context

The APEX web UI needs to add an Export button to the BulkActionToolbar, enabling users to export selected tasks or all visible tasks. This feature should:

1. Add an Export button to BulkActionToolbar alongside Cancel, Retry, Delete
2. Clicking opens the existing ExportDialog component
3. Submitting the dialog triggers an API call and downloads the exported file
4. Extend the API client with an `exportTasks` method
5. Support both bulk-selected tasks and all tasks

### Current State Analysis

**Existing Components:**

1. **BulkActionToolbar** (`packages/web-ui/src/components/tasks/BulkActionToolbar.tsx`)
   - Currently has Cancel, Retry, Delete buttons
   - Uses `useBulkSelection` context to access selected task IDs
   - Action buttons show count of eligible tasks
   - **NO Export button implemented yet**

2. **ExportDialog** (`packages/web-ui/src/components/export/ExportDialog.tsx`)
   - Fully implemented dialog with format selection (JSON, CSV, Markdown)
   - Date range filtering with presets
   - Task selection capability via `availableTasks` prop
   - `onExport` callback receives `ExportDialogOptions`
   - Loading and error states handled

3. **API Server Export Endpoint** (`packages/api/src/index.ts`)
   - `GET /tasks/export?format={json|csv|markdown}&startDate=...&endDate=...&taskIds=...`
   - Returns file with Content-Disposition header for download
   - Supports filtering by date range and specific task IDs

4. **API Client** (`packages/web-ui/src/lib/api-client.ts`)
   - Has bulk operations (bulkCancelTasks, bulkRetryTasks, bulkDeleteTasks)
   - **NO `exportTasks` method implemented yet**

5. **Export Types** (`packages/web-ui/src/types/export-dialog.ts`)
   - Comprehensive type definitions for export options
   - Utility functions for filtering and filename generation

## Decision

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       BulkActionToolbar                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  [Select All] [Cancel (3)] [Retry (2)] [Delete (3)] [Export ↓]     │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ onClick opens dialog
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         ExportDialog                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  Export Tasks                                                   [X] │ │
│  ├─────────────────────────────────────────────────────────────────────┤ │
│  │  Format: [JSON] [CSV] [Markdown]                                    │ │
│  │  Date Range: [All Time ▼]                                           │ │
│  │  [ ] Filter by specific tasks                                       │ │
│  │  [ ] Include archived  [ ] Include trashed                          │ │
│  ├─────────────────────────────────────────────────────────────────────┤ │
│  │  Exporting {selectedCount || allCount} tasks                        │ │
│  │                                    [Cancel] [Export]                │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ onExport callback
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        API Client                                        │
│              exportTasks(options) → GET /tasks/export                    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Response: Blob with Content-Disposition
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     Browser Download                                     │
│              triggerFileDownload(blob, filename)                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

#### D1: Export Button Placement in BulkActionToolbar

**Decision**: Add Export button as the rightmost action button in BulkActionToolbar.

**Rationale**:
- Consistent with existing bulk operation buttons
- Visible when tasks are selected (or always visible with different semantics)
- Downloads don't require confirmation dialogs like destructive actions

**Visual Design**:
- Use `Download` icon from lucide-react
- Show count badge like other buttons (e.g., "Export (5)")
- Always enabled when any task is available (even with 0 selected → exports all visible)

#### D2: Export Button Availability Logic

**Decision**: The Export button should be available in two modes:
1. **With Selection**: When tasks are selected, exports only selected tasks
2. **Without Selection**: When no tasks selected but toolbar visible, exports all visible/filtered tasks

**Rationale**:
- Users may want to export all tasks after filtering without selecting each one
- Consistent UX where "nothing selected" = "apply to all visible"
- The button text/badge indicates the scope: "Export (5 selected)" vs "Export All (42)"

**Interface**:
```typescript
// Export button always shows, count reflects selection or all tasks
const exportCount = selectedCount > 0 ? selectedCount : visibleTaskIds.length
const exportLabel = selectedCount > 0 ? `Export (${selectedCount})` : `Export All (${visibleTaskIds.length})`
```

#### D3: Integration with ExportDialog

**Decision**: The BulkActionToolbar opens ExportDialog with pre-populated task IDs when clicked.

**Data Flow**:
```
BulkActionToolbar clicks Export
        │
        ▼
Opens ExportDialog with:
  - availableTasks: filtered list of tasks
  - Pre-selected taskIds based on current bulk selection
  - or all visible tasks if nothing selected
        │
        ▼
User configures options (format, date range, etc.)
        │
        ▼
User clicks "Export" in dialog
        │
        ▼
onExport callback executes API call
        │
        ▼
File downloads, dialog closes
```

#### D4: API Client exportTasks Method

**Decision**: Add `exportTasks` method to `ApexApiClient` that:
1. Constructs query parameters from `ExportDialogOptions`
2. Calls `GET /tasks/export`
3. Handles the blob response
4. Triggers browser download

**Implementation**:
```typescript
/**
 * Export tasks based on filter options
 * Downloads the exported file automatically
 */
async exportTasks(options: ExportDialogOptions): Promise<{
  success: boolean
  filename: string
  taskCount: number
}> {
  const params = new URLSearchParams()
  params.set('format', options.format)

  if (options.dateRange.startDate) {
    params.set('startDate', options.dateRange.startDate.toISOString())
  }
  if (options.dateRange.endDate) {
    params.set('endDate', options.dateRange.endDate.toISOString())
  }
  if (options.filterByTasks && options.selectedTaskIds.length > 0) {
    params.set('taskIds', options.selectedTaskIds.join(','))
  }

  const response = await fetch(`${this.baseUrl}/tasks/export?${params}`)
  const blob = await response.blob()

  // Extract filename from Content-Disposition header
  const contentDisposition = response.headers.get('Content-Disposition')
  const filename = this.extractFilename(contentDisposition) ||
                   generateExportFilename(options.format)

  // Trigger browser download
  this.downloadBlob(blob, filename)

  return { success: true, filename, taskCount: /* from response */ }
}

private downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
```

#### D5: State Management for Export Dialog

**Decision**: Manage ExportDialog state at the parent component level (ActiveTasksPanel or page component) that wraps BulkActionToolbar.

**Rationale**:
- BulkActionToolbar is a presentational component
- Export dialog visibility and state should be managed by the container
- Allows flexibility in how different pages integrate the export feature

**Props Extension for BulkActionToolbar**:
```typescript
interface BulkActionToolbarProps {
  // ... existing props

  /** Callback for export operation - opens export dialog */
  onExport?: (taskIds: string[]) => void

  /** Whether export is currently in progress */
  isExporting?: boolean
}
```

### Component Modifications

#### 1. BulkActionToolbar.tsx Changes

```typescript
// Add to imports
import { Download } from 'lucide-react'

// Add to props interface
interface BulkActionToolbarProps {
  // ... existing props
  onExport?: (taskIds: string[]) => void
  isExporting?: boolean
}

// Add export button state calculation (export is always available for any task)
const exportableTaskIds = useMemo(() => {
  return selectedCount > 0
    ? Array.from(selectedTaskIds)
    : visibleTaskIds
}, [selectedCount, selectedTaskIds, visibleTaskIds])

// Add handler
const handleExport = () => {
  if (onExport) {
    onExport(exportableTaskIds)
  }
}

// Add Export button in JSX (after Delete button)
{onExport && (
  <Button
    variant="secondary"
    size={compact ? 'sm' : 'md'}
    disabled={exportableTaskIds.length === 0 || isOperating || isExporting}
    onClick={handleExport}
    data-testid={BULK_TEST_IDS.exportButton}
    aria-label={`Export ${exportableTaskIds.length} task${exportableTaskIds.length !== 1 ? 's' : ''}`}
    className="gap-1"
  >
    <Download className="w-4 h-4" />
    {!compact && (selectedCount > 0 ? 'Export' : 'Export All')}
    <span className="px-1.5 py-0.5 text-xs bg-apex-500/20 text-apex-500 rounded">
      {exportableTaskIds.length}
    </span>
  </Button>
)}
```

#### 2. bulk-operations.ts Type Updates

```typescript
// Add to BULK_TEST_IDS
export const BULK_TEST_IDS = {
  // ... existing
  exportButton: 'bulk-export-button',
} as const

// Add to BULK_ARIA_LABELS
export const BULK_ARIA_LABELS = {
  // ... existing
  exportTasks: (count: number) => `Export ${count} task${count !== 1 ? 's' : ''}`,
} as const
```

#### 3. API Client Extension

```typescript
// Add to api-client.ts

import type { ExportDialogOptions, ExportDialogFormat } from '@/types/export-dialog'
import { getFormatOption, generateExportFilename } from '@/types/export-dialog'

export class ApexApiClient {
  // ... existing methods

  /**
   * Export tasks based on filter options
   * Triggers automatic file download
   */
  async exportTasks(options: ExportDialogOptions): Promise<{
    success: boolean
    filename: string
  }> {
    const params = new URLSearchParams()
    params.set('format', options.format)

    if (options.dateRange.startDate) {
      params.set('startDate', options.dateRange.startDate.toISOString())
    }
    if (options.dateRange.endDate) {
      params.set('endDate', options.dateRange.endDate.toISOString())
    }
    if (options.filterByTasks && options.selectedTaskIds.length > 0) {
      params.set('taskIds', options.selectedTaskIds.join(','))
    }

    const url = `/tasks/export?${params.toString()}`
    const response = await this.fetch(url, {
      headers: {
        'Accept': this.getMimeTypeForFormat(options.format),
      }
    })

    const blob = await response.blob()

    // Extract filename from Content-Disposition header or generate default
    const contentDisposition = response.headers.get('content-disposition')
    const filename = this.extractFilenameFromHeader(contentDisposition) ||
                     generateExportFilename(options.format)

    // Trigger browser download
    this.triggerDownload(blob, filename)

    return { success: true, filename }
  }

  /**
   * Get MIME type for export format
   */
  private getMimeTypeForFormat(format: ExportDialogFormat): string {
    const formatOption = getFormatOption(format)
    return formatOption.mimeType
  }

  /**
   * Extract filename from Content-Disposition header
   */
  private extractFilenameFromHeader(header: string | null): string | null {
    if (!header) return null
    const match = header.match(/filename="?([^";\n]+)"?/)
    return match ? match[1] : null
  }

  /**
   * Trigger browser file download
   */
  private triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }
}
```

### Parent Component Integration Pattern

The parent component that uses BulkActionToolbar needs to:

1. Manage ExportDialog open/close state
2. Pass the `onExport` callback to BulkActionToolbar
3. Handle the export callback from ExportDialog

```typescript
// Example integration in ActiveTasksPanel or Tasks Page

import { ExportDialog } from '@/components/export/ExportDialog'
import { apiClient } from '@/lib/api-client'

function TasksPageWithExport() {
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [exportTaskIds, setExportTaskIds] = useState<string[]>([])
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  // Handler for BulkActionToolbar export button
  const handleExportClick = (taskIds: string[]) => {
    setExportTaskIds(taskIds)
    setIsExportDialogOpen(true)
    setExportError(null)
  }

  // Handler for ExportDialog submit
  const handleExport = async (options: ExportDialogOptions) => {
    try {
      setIsExporting(true)
      setExportError(null)

      // Override selectedTaskIds with the pre-determined list
      const exportOptions = {
        ...options,
        filterByTasks: exportTaskIds.length < tasks.length,
        selectedTaskIds: exportTaskIds,
      }

      await apiClient.exportTasks(exportOptions)
      setIsExportDialogOpen(false)
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <>
      <BulkActionToolbar
        // ... existing props
        onExport={handleExportClick}
        isExporting={isExporting}
      />

      <ExportDialog
        isOpen={isExportDialogOpen}
        onClose={() => setIsExportDialogOpen(false)}
        onExport={handleExport}
        availableTasks={tasks.filter(t => exportTaskIds.includes(t.id))}
        isExporting={isExporting}
        error={exportError}
      />
    </>
  )
}
```

### File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `packages/web-ui/src/components/tasks/BulkActionToolbar.tsx` | MODIFY | Add Export button with icon, count badge, and handler |
| `packages/web-ui/src/types/bulk-operations.ts` | MODIFY | Add `exportButton` test ID and `exportTasks` ARIA label |
| `packages/web-ui/src/lib/api-client.ts` | MODIFY | Add `exportTasks` method with download functionality |
| `packages/web-ui/src/components/tasks/__tests__/BulkActionToolbar.test.tsx` | MODIFY | Add tests for Export button |
| Parent component (e.g., ActiveTasksPanel) | MODIFY | Integrate ExportDialog and wire up handlers |

### Testing Requirements

#### Unit Tests

1. **BulkActionToolbar Export Button**:
   - Renders Export button when `onExport` prop provided
   - Button disabled when no tasks available
   - Button shows correct count (selected vs all)
   - Clicking calls `onExport` with correct task IDs

2. **API Client exportTasks**:
   - Constructs correct URL with query parameters
   - Handles format options correctly
   - Triggers browser download
   - Handles errors appropriately

#### Integration Tests

1. **Export Flow**:
   - Click Export → Dialog opens with correct tasks
   - Configure options → Submit → API called
   - File downloads → Dialog closes

#### Accessibility Tests

1. Export button has correct ARIA label
2. Focus management between toolbar and dialog
3. Keyboard navigation works

## Consequences

### Positive

- Leverages existing ExportDialog and API endpoint
- Consistent with existing bulk operation patterns
- Minimal new code required
- Supports both selective and "export all" use cases
- No backend changes needed

### Negative

- Adds complexity to BulkActionToolbar component
- Parent component must manage additional state
- Export button always visible may confuse users

### Risks

- Large exports may time out or fail
  - **Mitigation**: Show progress indicator, handle timeout gracefully
- Browser download may be blocked by popup blocker
  - **Mitigation**: Use standard download link technique (createElement + click)

## Implementation Checklist

- [ ] Add Export button to BulkActionToolbar
- [ ] Add test IDs and ARIA labels to bulk-operations types
- [ ] Add `exportTasks` method to ApexApiClient
- [ ] Update parent component integration
- [ ] Add unit tests for new functionality
- [ ] Add integration tests for export flow
- [ ] Verify accessibility compliance

## References

- ExportDialog component: `packages/web-ui/src/components/export/ExportDialog.tsx`
- Export types: `packages/web-ui/src/types/export-dialog.ts`
- BulkActionToolbar: `packages/web-ui/src/components/tasks/BulkActionToolbar.tsx`
- Bulk operations types: `packages/web-ui/src/types/bulk-operations.ts`
- API client: `packages/web-ui/src/lib/api-client.ts`
- Export endpoint: `packages/api/src/index.ts` (line 553)
- Existing ADR: `docs/adr/ADR-0042-task-export-reporting-architecture.md`
