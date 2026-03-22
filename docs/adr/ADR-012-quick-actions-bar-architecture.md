# ADR-012: QuickActionsBar Dashboard Integration Architecture

## Status
Proposed

## Context

The APEX dashboard needs a **QuickActionsBar** component that displays task templates marked as "quick actions" (`isQuickAction: true`). This allows users to rapidly create tasks from predefined templates without navigating to a separate template selection page.

### Requirements
- Dashboard (`app/page.tsx`) displays QuickActionsBar above the existing 6-metric card row
- Quick actions load on mount and update when templates change
- Empty state handled gracefully when no quick actions exist

### Existing Infrastructure
- **API Endpoint**: `/templates` exists with full CRUD support (packages/api/src/index.ts)
- **Type Definitions**: `TaskTemplate` type with `isQuickAction: boolean` field exists (packages/web-ui/src/types/task-template.ts)
- **API Client**: `ApexApiClient` class exists but lacks template methods (packages/web-ui/src/lib/api-client.ts)
- **Dashboard**: Already imports and uses `apiClient` for data fetching (packages/web-ui/src/app/page.tsx)

## Decision

### 1. Component Architecture

```
packages/web-ui/src/
├── lib/
│   └── api-client.ts              # Add template methods
├── hooks/
│   └── useQuickActions.ts         # NEW: Hook for quick action state management
├── components/
│   └── dashboard/
│       └── QuickActionsBar.tsx    # NEW: Quick actions UI component
└── app/
    └── page.tsx                   # Integrate QuickActionsBar
```

### 2. API Client Extension

Add template API methods to `ApexApiClient`:

```typescript
// packages/web-ui/src/lib/api-client.ts
import type { TaskTemplate } from '@/types/task-template'

export class ApexApiClient {
  // ... existing methods ...

  /**
   * List all templates with optional filters
   */
  async listTemplates(filters?: {
    isQuickAction?: boolean
  }): Promise<{ templates: TaskTemplate[]; count: number }> {
    const params = new URLSearchParams()
    if (filters?.isQuickAction !== undefined) {
      params.set('isQuickAction', filters.isQuickAction.toString())
    }
    const url = `/templates${params.toString() ? `?${params.toString()}` : ''}`
    const response = await this.fetch(url)
    return response.json()
  }

  /**
   * Get a single template by ID
   */
  async getTemplate(id: string): Promise<TaskTemplate> {
    const response = await this.fetch(`/templates/${encodeURIComponent(id)}`)
    return response.json()
  }
}
```

### 3. useQuickActions Hook

Custom hook for managing quick actions state:

```typescript
// packages/web-ui/src/hooks/useQuickActions.ts
interface UseQuickActionsReturn {
  quickActions: TaskTemplate[]
  isLoading: boolean
  error: Error | null
  refresh: () => Promise<void>
  createTaskFromTemplate: (template: TaskTemplate) => void
}

export function useQuickActions(options?: {
  autoRefresh?: boolean
  onTaskCreated?: (taskId: string) => void
}): UseQuickActionsReturn
```

**Features**:
- Fetches templates with `isQuickAction: true` on mount
- Provides `refresh()` for manual refresh
- Tracks loading and error states
- Provides `createTaskFromTemplate()` to trigger task creation dialog

### 4. QuickActionsBar Component

```typescript
// packages/web-ui/src/components/dashboard/QuickActionsBar.tsx
interface QuickActionsBarProps {
  /** Maximum number of quick actions to display */
  maxActions?: number
  /** Callback when a quick action is selected */
  onActionSelect?: (template: TaskTemplate) => void
  /** Callback when a task is created */
  onTaskCreated?: (taskId: string) => void
  /** Whether to show loading skeleton */
  showLoading?: boolean
  /** Custom class name */
  className?: string
}
```

**UI Design**:
- Horizontal scrollable bar with action buttons
- Each button shows template name + category icon
- Hover tooltips with template description
- Click triggers task creation dialog (either CreateTaskDialog with pre-filled values or a simplified quick dialog)
- Empty state: subtle message or hidden entirely

### 5. Dashboard Integration

```tsx
// packages/web-ui/src/app/page.tsx
export default function DashboardPage() {
  // ... existing state ...

  return (
    <div className="p-8">
      <Header ... />

      <div className="mt-8 space-y-8">
        {/* NEW: Quick Actions Bar - Row 0 */}
        <QuickActionsBar
          onTaskCreated={(taskId) => {
            router.push(`/tasks/${taskId}`)
          }}
          maxActions={8}
        />

        {/* Row 1: Task Status Overview - 6 column metrics */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {/* ... existing cards ... */}
        </div>

        {/* ... remaining rows ... */}
      </div>
    </div>
  )
}
```

## Design Decisions

### D1: Client-side Filtering vs API Filtering

**Decision**: Client-side filtering with `isQuickAction` filter

**Rationale**:
- Current API returns all templates; we filter client-side
- Future optimization: Add server-side `isQuickAction` query param
- Simple and works with existing API contract

### D2: Polling vs Real-time Updates

**Decision**: Initial fetch + manual refresh, no real-time subscription

**Rationale**:
- Templates change infrequently
- WebSocket subscriptions for templates would add complexity
- Manual refresh button in UI provides user control
- Future: Add WebSocket event `template:updated` if real-time is needed

### D3: Task Creation Flow

**Decision**: Clicking quick action opens CreateTaskDialog pre-populated with template data

**Rationale**:
- Reuses existing CreateTaskDialog component
- Allows user to customize before submission
- Alternative: Create task immediately with confirmation toast
- Selected approach provides more user control

### D4: Empty State Handling

**Decision**: Hide QuickActionsBar when no quick actions exist

**Rationale**:
- Cleaner dashboard appearance
- No visual noise when feature not in use
- Alternative: Show "Set up quick actions" CTA
- Can add CTA in future iteration

## Implementation Plan

### Phase 1: API Client (Low Risk)
1. Add `listTemplates()` method to `ApexApiClient`
2. Add `getTemplate()` method to `ApexApiClient`
3. Add unit tests for new API methods

### Phase 2: Hook Implementation (Medium Risk)
1. Create `useQuickActions` hook
2. Implement template fetching with loading/error states
3. Add hook tests

### Phase 3: Component Implementation (Medium Risk)
1. Create `QuickActionsBar` component
2. Implement action buttons with category icons
3. Handle empty state gracefully
4. Add component tests

### Phase 4: Dashboard Integration (Low Risk)
1. Import QuickActionsBar in dashboard
2. Position above metric cards
3. Wire up task creation callback
4. Verify responsive behavior

## File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `packages/web-ui/src/lib/api-client.ts` | MODIFY | Add template API methods |
| `packages/web-ui/src/hooks/useQuickActions.ts` | CREATE | Hook for quick actions state |
| `packages/web-ui/src/hooks/index.ts` | MODIFY | Export new hook |
| `packages/web-ui/src/components/dashboard/QuickActionsBar.tsx` | CREATE | Quick actions UI component |
| `packages/web-ui/src/app/page.tsx` | MODIFY | Integrate QuickActionsBar |
| `packages/web-ui/src/components/dashboard/__tests__/QuickActionsBar.test.tsx` | CREATE | Component tests |
| `packages/web-ui/src/hooks/__tests__/useQuickActions.test.ts` | CREATE | Hook tests |
| `packages/web-ui/src/lib/__tests__/api-client.templates.test.ts` | CREATE | API method tests |

## Testing Strategy

### Unit Tests
- `useQuickActions` hook: loading, success, error states
- `QuickActionsBar`: rendering, click handlers, empty state
- API client template methods

### Integration Tests
- Dashboard renders QuickActionsBar
- Quick action click flows through to CreateTaskDialog
- Template data pre-fills correctly

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| API `/templates` doesn't exist or has different contract | Low | High | Verified API exists in packages/api/src/index.ts |
| CreateTaskDialog doesn't support pre-filling | Medium | Medium | Modify dialog to accept initial values |
| Performance with many templates | Low | Low | Limit displayed quick actions (default 8) |

## Consequences

### Positive
- Users can create common tasks in 2 clicks
- Consistent with existing dashboard component patterns
- Reuses existing infrastructure (API, types, dialog)

### Negative
- Adds complexity to dashboard page
- Another network request on page load
- Need to maintain sync between templates and quick actions display

## Related Documents
- `packages/web-ui/src/types/task-template.ts` - TaskTemplate type definitions
- `packages/api/src/index.ts` - Templates API endpoints
- `packages/web-ui/src/components/tasks/CreateTaskDialog.tsx` - Task creation dialog
