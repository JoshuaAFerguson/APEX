# ADR-0050: In-App Notification Center Architecture

## Status
Proposed

## Date
2026-03-23

## Context

The APEX dashboard needs an In-App Notification Center to provide users with real-time awareness of system events, task updates, and important alerts. This feature must integrate seamlessly with the existing WebSocket infrastructure and follow established UI patterns.

### Acceptance Criteria
1. Notification bell icon with unread count badge
2. Dropdown panel showing recent notifications
3. Mark as read/clear actions
4. Notification preferences page

### Existing Infrastructure Analysis
- **WebSocket Client**: `packages/web-ui/src/lib/websocket-client.ts` - Robust WebSocket implementation with reconnection and health monitoring
- **Notification Types**: `packages/web-ui/src/types/notifications.ts` - Existing toast notification types that can be extended
- **Layout Structure**: `packages/web-ui/src/app/layout.tsx` - Main layout with Sidebar component
- **UI Components**: Established patterns in `packages/web-ui/src/components/ui/` (Button, Card, etc.)
- **Hooks Pattern**: Custom hooks in `packages/web-ui/src/hooks/` for state management
- **API Client**: `packages/web-ui/src/lib/api-client.ts` - REST API integration pattern

## Decision

### Architecture Overview

We will implement a modular notification system with the following components:

```
┌─────────────────────────────────────────────────────────────────┐
│                         Layout Header                            │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  [Logo] [Nav Items]              [NotificationBell] [User] ││
│  │                                       │                     ││
│  │                                  ┌────▼─────────────────┐   ││
│  │                                  │ NotificationPanel    │   ││
│  │                                  │  ├─ Header           │   ││
│  │                                  │  ├─ NotificationList │   ││
│  │                                  │  │   └─ Items...     │   ││
│  │                                  │  └─ Footer (Clear)   │   ││
│  │                                  └──────────────────────┘   ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 1. Type Definitions

Extend `packages/web-ui/src/types/notifications.ts`:

```typescript
// notification-center.ts - New file for notification center types

/**
 * Notification category for filtering and preferences
 */
export type NotificationCategory =
  | 'task'        // Task lifecycle events
  | 'system'      // System status notifications
  | 'approval'    // Approval/gate notifications
  | 'budget'      // Budget alerts
  | 'error'       // Error notifications
  | 'general'     // General notifications

/**
 * Notification priority levels
 */
export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent'

/**
 * In-app notification (persistent, stored)
 */
export interface InAppNotification {
  /** Unique identifier */
  id: string
  /** Notification title */
  title: string
  /** Detailed message */
  message?: string
  /** Notification category */
  category: NotificationCategory
  /** Priority level */
  priority: NotificationPriority
  /** Notification severity/type (reuse existing) */
  type: NotificationType
  /** Read status */
  read: boolean
  /** Associated task ID (if applicable) */
  taskId?: string
  /** Link to navigate when clicked */
  actionUrl?: string
  /** When the notification was created */
  createdAt: Date
  /** When the notification was read (if read) */
  readAt?: Date
}

/**
 * Notification preferences
 */
export interface NotificationPreferences {
  /** Enable/disable all notifications */
  enabled: boolean
  /** Category-specific settings */
  categories: {
    [K in NotificationCategory]: {
      enabled: boolean
      showInPanel: boolean
      playSound: boolean
      showBrowserNotification: boolean
    }
  }
  /** Quiet hours settings */
  quietHours: {
    enabled: boolean
    startTime: string  // HH:mm format
    endTime: string    // HH:mm format
    timezone: string
  }
  /** Maximum notifications to keep */
  maxNotifications: number
  /** Auto-dismiss after N days */
  autoCleanupDays: number
}

/**
 * Notification panel state
 */
export interface NotificationPanelState {
  isOpen: boolean
  notifications: InAppNotification[]
  unreadCount: number
  isLoading: boolean
  error: string | null
}
```

### 2. Component Structure

```
packages/web-ui/src/components/notifications/
├── index.ts                          # Exports
├── NotificationBell.tsx              # Bell icon with badge
├── NotificationPanel.tsx             # Dropdown panel container
├── NotificationList.tsx              # Virtualized list of notifications
├── NotificationItem.tsx              # Individual notification item
├── NotificationCategoryIcon.tsx      # Category icons
├── NotificationPreferencesForm.tsx   # Preferences form component
└── __tests__/
    ├── NotificationBell.test.tsx
    ├── NotificationPanel.test.tsx
    ├── NotificationList.test.tsx
    ├── NotificationItem.test.tsx
    └── NotificationPreferencesForm.test.tsx
```

### 3. Core Components Design

#### NotificationBell Component
```typescript
// NotificationBell.tsx
interface NotificationBellProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

// Features:
// - Bell icon from lucide-react
// - Unread count badge (red dot with number)
// - Animation when new notification arrives
// - Click toggles NotificationPanel
// - Accessible (aria-label, role)
```

#### NotificationPanel Component
```typescript
// NotificationPanel.tsx
interface NotificationPanelProps {
  isOpen: boolean
  onClose: () => void
  anchorRef?: React.RefObject<HTMLElement>
}

// Features:
// - Positioned absolute, top-right below bell
// - Header with "Notifications" title and "Mark all read" button
// - Scrollable notification list (max-height)
// - Footer with "Clear all" and "Settings" link
// - Click outside to close
// - Keyboard navigation (Escape to close)
// - Empty state when no notifications
```

#### NotificationItem Component
```typescript
// NotificationItem.tsx
interface NotificationItemProps {
  notification: InAppNotification
  onMarkRead: (id: string) => void
  onDismiss: (id: string) => void
  onClick?: (notification: InAppNotification) => void
}

// Features:
// - Category icon
// - Title and truncated message
// - Relative timestamp ("2 minutes ago")
// - Unread indicator (dot or background color)
// - Hover actions (mark read, dismiss)
// - Click navigates to actionUrl if present
```

### 4. Hook Design

```typescript
// hooks/useNotificationCenter.ts

interface UseNotificationCenterReturn {
  // State
  notifications: InAppNotification[]
  unreadCount: number
  isLoading: boolean
  error: string | null

  // Panel control
  isPanelOpen: boolean
  openPanel: () => void
  closePanel: () => void
  togglePanel: () => void

  // Actions
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  dismissNotification: (id: string) => Promise<void>
  clearAll: () => Promise<void>

  // Preferences
  preferences: NotificationPreferences
  updatePreferences: (prefs: Partial<NotificationPreferences>) => Promise<void>
}

// Implementation considerations:
// - Uses WebSocket for real-time updates
// - LocalStorage for persistence (until API support)
// - Optimistic updates for better UX
// - Debounced saves
```

### 5. WebSocket Integration

Extend WebSocket client to handle notification events:

```typescript
// New event types to handle:
type NotificationEventType =
  | 'notification:new'        // New notification received
  | 'notification:read'       // Notification marked as read
  | 'notification:dismissed'  // Notification dismissed
  | 'notification:cleared'    // All notifications cleared

// Event handler in websocket-client.ts
// Subscribe: wsClient.on('notification:new', handler)
```

### 6. API Endpoints (Future)

For persistence, the following API endpoints should be implemented:

```
GET    /api/notifications              # List notifications (paginated)
POST   /api/notifications/:id/read     # Mark as read
POST   /api/notifications/read-all     # Mark all as read
DELETE /api/notifications/:id          # Dismiss notification
DELETE /api/notifications              # Clear all
GET    /api/notifications/preferences  # Get preferences
PUT    /api/notifications/preferences  # Update preferences
```

### 7. Layout Integration

Update `packages/web-ui/src/app/layout.tsx`:

```tsx
// Add header bar with notification bell
<div className="flex h-screen overflow-hidden">
  <Sidebar />
  <div className="flex-1 flex flex-col">
    <header className="h-14 border-b border-border flex items-center justify-end px-4 gap-4">
      <NotificationBell />
      <WebSocketConnectionIndicator size="sm" />
    </header>
    <main className="flex-1 overflow-y-auto bg-background">
      {children}
    </main>
  </div>
</div>
```

### 8. Notification Preferences Page

Create new page at `packages/web-ui/src/app/settings/notifications/page.tsx`:

```tsx
// Features:
// - Toggle notifications on/off
// - Per-category settings (toggles)
// - Quiet hours configuration
// - Browser notification permission request
// - Auto-cleanup settings
// - Reset to defaults button
```

### 9. Notification Generation

Map existing events to notifications:

| Event Type | Notification Category | Priority |
|------------|----------------------|----------|
| `task:started` | task | low |
| `task:completed` | task | medium |
| `task:failed` | task | high |
| `gate:approval_required` | approval | high |
| `budget:warning` | budget | high |
| `budget:exceeded` | budget | urgent |
| `mcp:installed` | system | low |
| `mcp:error` | error | high |

### 10. State Management

Use React Context for global notification state:

```typescript
// context/NotificationContext.tsx
const NotificationContext = createContext<UseNotificationCenterReturn | null>(null)

// Wrap in layout.tsx:
<NotificationProvider>
  <ThemeProvider>
    {/* ... */}
  </ThemeProvider>
</NotificationProvider>
```

## Implementation Phases

### Phase 1: Core UI Components
1. Type definitions
2. NotificationBell component
3. NotificationPanel component
4. NotificationItem component
5. Layout integration (header bar)

### Phase 2: State Management
1. useNotificationCenter hook
2. NotificationContext provider
3. LocalStorage persistence
4. WebSocket event handlers

### Phase 3: Preferences
1. NotificationPreferences types
2. Preferences page UI
3. Category filtering
4. Quiet hours logic

### Phase 4: API Integration (Future)
1. Backend endpoints
2. Database schema
3. Migrate from LocalStorage to API

## Consequences

### Positive
- Real-time awareness of system events
- Consistent with existing UI patterns
- Modular, testable components
- Progressive enhancement (works without API, better with it)
- Follows established WebSocket patterns

### Negative
- Initial implementation uses LocalStorage (not synced across devices)
- Adds complexity to layout structure
- May need backend work for full persistence

### Risks
- Performance with many notifications (mitigated by virtualization)
- Browser notification permission handling complexity
- Quiet hours timezone handling

## Technical Notes

### Styling
- Use existing Tailwind classes from theme
- Follow color patterns from existing notification types:
  - `NOTIFICATION_COLORS` from `types/notifications.ts`
- Use `cn()` utility for class merging

### Accessibility
- ARIA labels on bell and panel
- Keyboard navigation (Tab, Escape)
- Screen reader announcements for new notifications
- Focus trap in open panel

### Performance
- Lazy load NotificationPanel (not rendered until opened)
- Virtualize long notification lists
- Debounce preference saves
- Limit stored notifications

## Related ADRs
- ADR-0002: WebSocket Connection Indicator Architecture
- ADR-0003: Active Tasks Panel Realtime Updates
- ADR-0017: Recent Activity Feed Component Architecture

## References
- Existing notification types: `packages/web-ui/src/types/notifications.ts`
- WebSocket client: `packages/web-ui/src/lib/websocket-client.ts`
- ThemeSelector dropdown pattern: `packages/web-ui/src/components/theme/ThemeToggle.tsx`
