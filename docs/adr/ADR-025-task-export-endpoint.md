# ADR-025: Task Export Endpoint Design

## Status
**Proposed** - Architecture Stage

## Context

APEX needs a REST API endpoint to export task data in multiple formats (JSON, CSV, Markdown) with support for date filtering and task ID selection. This endpoint enables:

- Exporting task data for external reporting and analysis tools
- Generating human-readable reports in Markdown format
- Creating CSV exports for spreadsheet applications
- Date-range filtered exports for specific time periods
- Selective export of specific tasks by ID

## Decision

### Endpoint Design

**Route:** `GET /tasks/export`

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `format` | `'json' \| 'csv' \| 'markdown'` | Yes | Output format |
| `startDate` | ISO 8601 string | No | Filter tasks created on or after this date |
| `endDate` | ISO 8601 string | No | Filter tasks created on or before this date |
| `taskIds` | string[] | No | Specific task IDs to export (comma-separated or repeated param) |

### Response Headers

Based on format, return appropriate Content-Type and Content-Disposition headers:

| Format | Content-Type | Content-Disposition |
|--------|-------------|---------------------|
| json | `application/json` | `attachment; filename=tasks-export-{timestamp}.json` |
| csv | `text/csv` | `attachment; filename=tasks-export-{timestamp}.csv` |
| markdown | `text/markdown` | `attachment; filename=tasks-export-{timestamp}.md` |

### Implementation Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     GET /tasks/export                            │
│                                                                  │
│  Query Params: format, startDate, endDate, taskIds[]            │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Parameter Validation                           │
│                                                                  │
│  1. Validate format is 'json' | 'csv' | 'markdown'              │
│  2. Parse and validate ISO 8601 dates (startDate, endDate)      │
│  3. Parse taskIds array (comma-separated or repeated param)     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│               orchestrator.listTasks()                           │
│                                                                  │
│  Options:                                                        │
│  - lightweight: false (need full data for export)               │
│  - No status filter (export all statuses)                       │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│               Apply Filters (in-memory)                          │
│                                                                  │
│  1. Filter by taskIds if provided                               │
│  2. Filter by startDate (task.createdAt >= startDate)           │
│  3. Filter by endDate (task.createdAt <= endDate)               │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│               Format Tasks (@apexcli/core)                       │
│                                                                  │
│  Switch on format:                                               │
│  - json:     formatTasksToJSON(tasks)                           │
│  - csv:      formatTasksToCSV(tasks)                            │
│  - markdown: formatTasksToMarkdown(tasks)                       │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│               Set Headers & Return Response                      │
│                                                                  │
│  1. Set Content-Type based on format                            │
│  2. Set Content-Disposition with filename                       │
│  3. Return formatted content                                    │
└─────────────────────────────────────────────────────────────────┘
```

### File Modifications

**File: `packages/api/src/index.ts`**

Add the following after the existing `/tasks` listing endpoint (around line 547):

```typescript
// Import formatters from @apexcli/core (add to existing imports)
import {
  formatTasksToJSON,
  formatTasksToCSV,
  formatTasksToMarkdown,
  FORMAT_MIME_TYPES,
  FORMAT_EXTENSIONS,
  type ExportFormat,
} from '@apexcli/core';

// Add type for query params
interface ExportTasksQuery {
  format: 'json' | 'csv' | 'markdown';
  startDate?: string;
  endDate?: string;
  taskIds?: string | string[];
}

// Export tasks endpoint
app.get<{ Querystring: ExportTasksQuery }>(
  '/tasks/export',
  {
    schema: {
      querystring: {
        type: 'object',
        required: ['format'],
        properties: {
          format: {
            type: 'string',
            enum: ['json', 'csv', 'markdown'],
            description: 'Export format'
          },
          startDate: {
            type: 'string',
            format: 'date-time',
            description: 'Filter tasks created on or after this date (ISO 8601)'
          },
          endDate: {
            type: 'string',
            format: 'date-time',
            description: 'Filter tasks created on or before this date (ISO 8601)'
          },
          taskIds: {
            oneOf: [
              { type: 'string' },
              { type: 'array', items: { type: 'string' } }
            ],
            description: 'Specific task IDs to export'
          }
        }
      }
    }
  },
  async (request, reply) => {
    const { format, startDate, endDate, taskIds } = request.query;

    // Validate format
    const validFormats = ['json', 'csv', 'markdown'] as const;
    if (!validFormats.includes(format)) {
      return reply.status(400).send({
        error: 'Invalid format',
        message: `Format must be one of: ${validFormats.join(', ')}`
      });
    }

    // Parse and validate dates
    let startDateParsed: Date | undefined;
    let endDateParsed: Date | undefined;

    if (startDate) {
      startDateParsed = new Date(startDate);
      if (isNaN(startDateParsed.getTime())) {
        return reply.status(400).send({
          error: 'Invalid startDate',
          message: 'startDate must be a valid ISO 8601 date string'
        });
      }
    }

    if (endDate) {
      endDateParsed = new Date(endDate);
      if (isNaN(endDateParsed.getTime())) {
        return reply.status(400).send({
          error: 'Invalid endDate',
          message: 'endDate must be a valid ISO 8601 date string'
        });
      }
    }

    // Parse taskIds (handle both comma-separated string and array)
    let taskIdArray: string[] | undefined;
    if (taskIds) {
      if (Array.isArray(taskIds)) {
        taskIdArray = taskIds;
      } else {
        taskIdArray = taskIds.split(',').map(id => id.trim()).filter(Boolean);
      }
    }

    try {
      // Fetch all tasks (not lightweight - need full data for export)
      let tasks = await orchestrator.listTasks({ lightweight: false });

      // Apply filters
      if (taskIdArray && taskIdArray.length > 0) {
        const taskIdSet = new Set(taskIdArray);
        tasks = tasks.filter(task => taskIdSet.has(task.id));
      }

      if (startDateParsed) {
        tasks = tasks.filter(task => task.createdAt >= startDateParsed!);
      }

      if (endDateParsed) {
        tasks = tasks.filter(task => task.createdAt <= endDateParsed!);
      }

      // Format tasks based on requested format
      let content: string;
      let contentType: string;
      let fileExtension: string;

      switch (format) {
        case 'json':
          content = formatTasksToJSON(tasks, { pretty: true, includeMetadata: true });
          contentType = 'application/json';
          fileExtension = 'json';
          break;
        case 'csv':
          content = formatTasksToCSV(tasks, { includeHeader: true });
          contentType = 'text/csv';
          fileExtension = 'csv';
          break;
        case 'markdown':
          content = formatTasksToMarkdown(tasks, {
            layout: 'detailed',
            includeHeader: true,
            includeSummary: true
          });
          contentType = 'text/markdown';
          fileExtension = 'md';
          break;
      }

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `tasks-export-${timestamp}.${fileExtension}`;

      // Set headers and return content
      return reply
        .type(contentType)
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(content);

    } catch (error) {
      app.log.error({ err: error }, 'Task export error');
      return reply.status(500).send({
        error: 'Export failed',
        message: error instanceof Error ? error.message : 'Unknown error during export'
      });
    }
  }
);
```

### Import Additions

Add to the existing imports at the top of `packages/api/src/index.ts`:

```typescript
// Add to existing @apexcli/core imports
import {
  // ... existing imports ...
  formatTasksToJSON,
  formatTasksToCSV,
  formatTasksToMarkdown,
} from '@apexcli/core';
```

### Verification that @apexcli/core exports formatters

The formatters are exported from `packages/core/src/export/index.ts`. Need to verify they are re-exported from the main `@apexcli/core` package. If not, add to `packages/core/src/index.ts`:

```typescript
// Export formatters
export {
  formatTasksToJSON,
  formatTasksToCSV,
  formatTasksToMarkdown,
  FORMAT_MIME_TYPES,
  FORMAT_EXTENSIONS,
  type ExportFormat,
} from './export/index.js';
```

## Consequences

### Positive
- Clean, RESTful API design following existing patterns
- Leverages existing formatter infrastructure from `@apexcli/core`
- Supports flexible filtering (date range, specific task IDs)
- Proper Content-Type and Content-Disposition headers for download
- Consistent error handling with existing endpoints

### Negative
- In-memory filtering for date ranges (could be optimized with SQL if needed)
- Full task data loaded for export (no lightweight mode)

### Neutral
- Export endpoint is separate from list endpoint to keep concerns separated
- Date filtering uses task.createdAt (could be extended to other dates)

## Implementation Notes

1. **Schema Validation**: Use Fastify's built-in schema validation with JSON Schema
2. **Error Handling**: Follow existing patterns for 400/404/500 responses
3. **Content-Disposition**: Use `attachment` to trigger download in browsers
4. **Timestamp in filename**: ISO format with colons replaced for filesystem compatibility
5. **Format validation**: Strict enum check before processing

## Testing Considerations

1. Test all three formats (json, csv, markdown)
2. Test date filtering with various ISO 8601 formats
3. Test taskIds as both comma-separated string and array
4. Test with empty results
5. Test with invalid date formats (expect 400)
6. Test with invalid format parameter (expect 400)
7. Verify Content-Type headers for each format
8. Verify Content-Disposition headers with filename

## Related ADRs

- ADR-018: Export Formatter Types (defines base types)
- ADR-019: JSON Formatter Implementation
- ADR-020: CSV Formatter Implementation
- ADR-021: Markdown Formatter Implementation
