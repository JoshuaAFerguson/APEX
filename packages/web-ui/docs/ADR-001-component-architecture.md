# ADR-001: Web Dashboard Component Architecture

**Status:** Proposed
**Date:** 2025-12-11
**Authors:** APEX Architect Agent

## Context

APEX v0.3.0 introduces a web dashboard built with Next.js 14 (App Router), React 18, and Tailwind CSS. The dashboard requires several interconnected components for task management, real-time updates, and user interactions. This ADR documents the technical architecture for the following components:

1. Task Detail Page (`/tasks/[id]`)
2. LogViewer Component
3. GatePanel Component
4. Charts (TokenUsageChart, BudgetGauge)
5. Theme System
6. Notification System

## Decision

### 1. Task Detail Page (`/tasks/[id]`)

#### TypeScript Interfaces

```typescript
// /packages/web-ui/src/types/task-detail.ts

import type { Task, TaskLog, Gate, ApexEvent, TaskUsage } from '@apex/core'

/**
 * Task detail page state
 */
export interface TaskDetailState {
  task: Task | null
  pendingGates: Gate[]
  isLoading: boolean
  error: string | null
  isConnected: boolean
}

/**
 * Real-time update state
 */
export interface TaskStreamState {
  events: ApexEvent[]
  logs: TaskLog[]
  usage: TaskUsage | null
  lastUpdated: Date | null
}

/**
 * Page params from Next.js dynamic route
 */
export interface TaskDetailPageParams {
  params: { id: string }
}
```

#### Component Props

```typescript
// Task detail page is a route component, no external props
// Internal child component props:

export interface TaskHeaderProps {
  task: Task
  onCancel: () => Promise<void>
  onRetry: () => Promise<void>
  isLoading: boolean
}

export interface TaskMetadataProps {
  task: Task
}

export interface TaskProgressProps {
  task: Task
  stages: string[]
  currentStage: string | undefined
}
```

#### Internal State Structure

```typescript
// Page component state
const [state, setState] = useState<TaskDetailState>({
  task: null,
  pendingGates: [],
  isLoading: true,
  error: null,
  isConnected: false,
})

const [streamState, setStreamState] = useState<TaskStreamState>({
  events: [],
  logs: [],
  usage: null,
  lastUpdated: null,
})
```

#### Data Flow Diagram

```
                                   +------------------+
                                   |  Next.js Router  |
                                   |  /tasks/[id]     |
                                   +--------+---------+
                                            |
                                            v
+------------------+              +------------------+
|   API Client     |<------------|  TaskDetailPage  |
|   (REST)         |   initial   |                  |
+------------------+   fetch     +--------+---------+
        ^                                 |
        |                                 | subscribes
        |                                 v
        |                        +------------------+
        |   actions              |  useTaskStream   |
        |   (cancel/retry)       |  (WebSocket)     |
        +------------------------+--------+---------+
                                          |
                        +-----------------+-----------------+
                        |                 |                 |
                        v                 v                 v
               +--------+----+   +--------+----+   +--------+----+
               |  LogViewer  |   |  GatePanel  |   |   Charts    |
               +-------------+   +-------------+   +-------------+
```

#### Key Implementation Notes

1. **Initial Data Fetch**: Use `apiClient.getTask(id)` on mount to get task and gates
2. **WebSocket Subscription**: Use `useTaskStream(taskId)` hook for real-time updates
3. **State Reconciliation**: Merge WebSocket events into local state without full refetch
4. **Error Recovery**: Implement retry logic with exponential backoff for failed fetches
5. **Cleanup**: Unsubscribe from WebSocket on unmount

---

### 2. LogViewer Component

#### TypeScript Interfaces

```typescript
// /packages/web-ui/src/types/log-viewer.ts

import type { TaskLog } from '@apex/core'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry extends TaskLog {
  id: string // Generated client-side for React keys
}

export interface LogFilter {
  levels: Set<LogLevel>
  searchText: string
  stage: string | null
  agent: string | null
}

export interface LogViewerState {
  logs: LogEntry[]
  filteredLogs: LogEntry[]
  filter: LogFilter
  isAutoScroll: boolean
  selectedLogId: string | null
}

export interface VirtualListConfig {
  itemHeight: number
  overscan: number
  bufferSize: number
}
```

#### Component Props

```typescript
export interface LogViewerProps {
  /**
   * Initial logs to display
   */
  logs: TaskLog[]

  /**
   * Whether to show real-time streaming indicator
   */
  isStreaming?: boolean

  /**
   * Maximum height of the log viewer (CSS value)
   */
  maxHeight?: string

  /**
   * Whether to enable auto-scroll to bottom on new logs
   * @default true
   */
  autoScroll?: boolean

  /**
   * Callback when user clicks a log entry
   */
  onLogSelect?: (log: LogEntry) => void

  /**
   * Custom class name for styling
   */
  className?: string
}
```

#### Internal State Structure

```typescript
// State managed via useReducer for complex filtering logic
interface LogViewerReducerState {
  logs: LogEntry[]
  filter: LogFilter
  isAutoScroll: boolean
}

type LogViewerAction =
  | { type: 'ADD_LOGS'; payload: TaskLog[] }
  | { type: 'SET_FILTER'; payload: Partial<LogFilter> }
  | { type: 'TOGGLE_AUTO_SCROLL' }
  | { type: 'CLEAR_LOGS' }

// Refs for virtualization
const containerRef = useRef<HTMLDivElement>(null)
const virtualListRef = useRef<VirtualListHandle>(null)
```

#### Virtualization Strategy

```typescript
// Use @tanstack/react-virtual for efficient rendering

const ITEM_HEIGHT = 32 // Fixed height for each log row
const OVERSCAN = 5     // Number of items to render outside viewport

interface VirtualListHandle {
  scrollToIndex: (index: number, options?: { align: 'start' | 'center' | 'end' }) => void
  scrollToOffset: (offset: number) => void
}

// Virtual list implementation
const rowVirtualizer = useVirtualizer({
  count: filteredLogs.length,
  getScrollElement: () => containerRef.current,
  estimateSize: () => ITEM_HEIGHT,
  overscan: OVERSCAN,
})
```

#### Auto-Scroll Behavior

```typescript
// Auto-scroll logic
useEffect(() => {
  if (!isAutoScroll || filteredLogs.length === 0) return

  const container = containerRef.current
  if (!container) return

  // Only auto-scroll if user is near bottom
  const isNearBottom =
    container.scrollHeight - container.scrollTop - container.clientHeight < 100

  if (isNearBottom) {
    virtualListRef.current?.scrollToIndex(filteredLogs.length - 1, { align: 'end' })
  }
}, [filteredLogs.length, isAutoScroll])

// Detect manual scroll to disable auto-scroll
const handleScroll = useCallback(() => {
  const container = containerRef.current
  if (!container) return

  const isAtBottom =
    container.scrollHeight - container.scrollTop - container.clientHeight < 50

  if (!isAtBottom && isAutoScroll) {
    dispatch({ type: 'TOGGLE_AUTO_SCROLL' })
  }
}, [isAutoScroll])
```

#### Filter/Search Functionality

```typescript
// Memoized filtering for performance
const filteredLogs = useMemo(() => {
  return state.logs.filter(log => {
    // Level filter
    if (!state.filter.levels.has(log.level)) return false

    // Stage filter
    if (state.filter.stage && log.stage !== state.filter.stage) return false

    // Agent filter
    if (state.filter.agent && log.agent !== state.filter.agent) return false

    // Text search (case-insensitive)
    if (state.filter.searchText) {
      const searchLower = state.filter.searchText.toLowerCase()
      return log.message.toLowerCase().includes(searchLower)
    }

    return true
  })
}, [state.logs, state.filter])
```

#### Data Flow Diagram

```
+------------------+
|  Parent (Page)   |
|  logs: TaskLog[] |
+--------+---------+
         |
         | props.logs
         v
+------------------+     +------------------+
|   LogViewer      |---->|  FilterBar       |
|                  |     | (levels, search) |
+--------+---------+     +------------------+
         |
         | filteredLogs
         v
+------------------+     +------------------+
| useVirtualizer   |---->|  VirtualRows     |
| (@tanstack)      |     |  (visible only)  |
+------------------+     +------------------+
         |
         | scrollToIndex
         v
+------------------+
| Auto-scroll      |
| Controller       |
+------------------+
```

---

### 3. GatePanel Component

#### TypeScript Interfaces

```typescript
// /packages/web-ui/src/types/gate-panel.ts

import type { Gate, GateStatus } from '@apex/core'

export interface GateAction {
  type: 'approve' | 'reject'
  gateName: string
  approver: string
  comment?: string
}

export interface GatePanelState {
  isSubmitting: boolean
  submitError: string | null
  comment: string
  showCommentInput: boolean
}
```

#### Component Props

```typescript
export interface GatePanelProps {
  /**
   * Task ID for API calls
   */
  taskId: string

  /**
   * List of pending gates requiring action
   */
  pendingGates: Gate[]

  /**
   * List of resolved gates (for history display)
   */
  resolvedGates?: Gate[]

  /**
   * Current approver identity
   */
  approver: string

  /**
   * Callback after successful gate action
   */
  onGateAction?: (gate: Gate, action: 'approve' | 'reject') => void

  /**
   * Whether the panel is in read-only mode
   */
  readOnly?: boolean

  /**
   * Custom class name
   */
  className?: string
}
```

#### Internal State Structure

```typescript
// Per-gate state for managing multiple pending gates
const [gateStates, setGateStates] = useState<Map<string, GatePanelState>>(() =>
  new Map(pendingGates.map(g => [g.name, {
    isSubmitting: false,
    submitError: null,
    comment: '',
    showCommentInput: false,
  }]))
)

// Optimistic update tracking
const [optimisticGates, setOptimisticGates] = useState<Gate[]>([])
```

#### API Integration

```typescript
// Gate action handlers with optimistic updates
async function handleGateAction(gate: Gate, action: 'approve' | 'reject') {
  const gateState = gateStates.get(gate.name)
  if (!gateState) return

  // Update state to submitting
  setGateStates(prev => new Map(prev).set(gate.name, {
    ...gateState,
    isSubmitting: true,
    submitError: null,
  }))

  // Optimistic update
  setOptimisticGates(prev => [...prev, {
    ...gate,
    status: action === 'approve' ? 'approved' : 'rejected',
  }])

  try {
    const request = { approver, comment: gateState.comment || undefined }

    if (action === 'approve') {
      await apiClient.approveGate(taskId, gate.name, request)
    } else {
      await apiClient.rejectGate(taskId, gate.name, request)
    }

    onGateAction?.(gate, action)
  } catch (error) {
    // Rollback optimistic update
    setOptimisticGates(prev => prev.filter(g => g.name !== gate.name))

    setGateStates(prev => new Map(prev).set(gate.name, {
      ...gateState,
      isSubmitting: false,
      submitError: error instanceof Error ? error.message : 'Action failed',
    }))
  }
}
```

#### User Feedback States

```typescript
// Loading state UI
interface GateLoadingState {
  isSubmitting: boolean
  actionType: 'approve' | 'reject' | null
}

// Success state (temporary, for animation)
interface GateSuccessState {
  gateName: string
  action: 'approve' | 'reject'
  timestamp: Date
}

// Error state with retry capability
interface GateErrorState {
  gateName: string
  error: string
  canRetry: boolean
}
```

#### Data Flow Diagram

```
+------------------+
|  Parent (Page)   |
|  pendingGates[]  |
+--------+---------+
         |
         | props
         v
+------------------+
|   GatePanel      |
|                  |
+--------+---------+
         |
    +----+----+
    |         |
    v         v
+-------+  +-------+
|Pending|  |History|
|Gates  |  |Gates  |
+---+---+  +-------+
    |
    | user action
    v
+------------------+     +------------------+
|  handleAction()  |---->|  API Client      |
|  optimistic      |     |  approve/reject  |
+--------+---------+     +--------+---------+
         |                        |
         |<-----------------------+
         | success/error
         v
+------------------+
|  State Update    |
|  + Notification  |
+------------------+
```

---

### 4. Charts (TokenUsageChart, BudgetGauge)

#### TypeScript Interfaces

```typescript
// /packages/web-ui/src/types/charts.ts

import type { TaskUsage } from '@apex/core'

/**
 * Token usage breakdown by category
 */
export interface TokenBreakdown {
  inputTokens: number
  outputTokens: number
  cacheCreationTokens: number
  cacheReadTokens: number
}

/**
 * Time-series data point for usage over time
 */
export interface UsageDataPoint {
  timestamp: Date
  tokens: number
  cost: number
}

/**
 * Budget thresholds for visual indicators
 */
export interface BudgetThresholds {
  warning: number  // Percentage (e.g., 75)
  danger: number   // Percentage (e.g., 90)
}

/**
 * Chart color scheme (for theming)
 */
export interface ChartColorScheme {
  primary: string
  secondary: string
  warning: string
  danger: string
  background: string
  text: string
  grid: string
}
```

#### TokenUsageChart Props

```typescript
export interface TokenUsageChartProps {
  /**
   * Current task usage data
   */
  usage: TaskUsage

  /**
   * Historical usage data points for trend line
   */
  history?: UsageDataPoint[]

  /**
   * Maximum tokens allowed (for limit indicator)
   */
  maxTokens?: number

  /**
   * Chart display variant
   */
  variant?: 'bar' | 'donut' | 'area'

  /**
   * Whether to show legend
   */
  showLegend?: boolean

  /**
   * Chart height in pixels
   */
  height?: number

  /**
   * Custom class name
   */
  className?: string
}
```

#### BudgetGauge Props

```typescript
export interface BudgetGaugeProps {
  /**
   * Current spent amount
   */
  spent: number

  /**
   * Budget limit
   */
  limit: number

  /**
   * Optional daily budget for secondary indicator
   */
  dailyLimit?: number

  /**
   * Today's spending
   */
  dailySpent?: number

  /**
   * Threshold percentages for color changes
   */
  thresholds?: BudgetThresholds

  /**
   * Whether to show numeric values
   */
  showValues?: boolean

  /**
   * Gauge size
   */
  size?: 'sm' | 'md' | 'lg'

  /**
   * Custom class name
   */
  className?: string
}
```

#### Data Transformation

```typescript
// Transform TaskUsage to chart-friendly format
function transformUsageToChartData(usage: TaskUsage): TokenBreakdown {
  return {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cacheCreationTokens: 0, // From extended usage if available
    cacheReadTokens: 0,
  }
}

// Calculate percentage for gauge
function calculateBudgetPercentage(spent: number, limit: number): number {
  if (limit <= 0) return 0
  return Math.min(100, (spent / limit) * 100)
}

// Get gauge color based on thresholds
function getGaugeColor(
  percentage: number,
  thresholds: BudgetThresholds,
  colors: ChartColorScheme
): string {
  if (percentage >= thresholds.danger) return colors.danger
  if (percentage >= thresholds.warning) return colors.warning
  return colors.primary
}
```

#### Real-time Update Strategy

```typescript
// Use ref for animation frame management
const animationFrameRef = useRef<number>()

// Animate value changes smoothly
function animateValue(from: number, to: number, duration: number) {
  const startTime = performance.now()

  function animate(currentTime: number) {
    const elapsed = currentTime - startTime
    const progress = Math.min(elapsed / duration, 1)

    // Ease-out curve
    const eased = 1 - Math.pow(1 - progress, 3)
    const current = from + (to - from) * eased

    setDisplayValue(current)

    if (progress < 1) {
      animationFrameRef.current = requestAnimationFrame(animate)
    }
  }

  animationFrameRef.current = requestAnimationFrame(animate)
}

// Cleanup on unmount
useEffect(() => {
  return () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
  }
}, [])
```

#### Responsive Design Considerations

```typescript
// Responsive breakpoints for chart sizing
const CHART_SIZES = {
  sm: { height: 120, labelSize: 10, strokeWidth: 8 },
  md: { height: 180, labelSize: 12, strokeWidth: 12 },
  lg: { height: 240, labelSize: 14, strokeWidth: 16 },
} as const

// Use container query or ResizeObserver for responsive sizing
function useChartSize(containerRef: RefObject<HTMLElement>) {
  const [size, setSize] = useState<'sm' | 'md' | 'lg'>('md')

  useEffect(() => {
    if (!containerRef.current) return

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0
      if (width < 200) setSize('sm')
      else if (width < 400) setSize('md')
      else setSize('lg')
    })

    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  return size
}
```

#### Data Flow Diagram

```
+------------------+
|   Task Detail    |
|   task.usage     |
+--------+---------+
         |
         | usage prop
         v
+------------------+     +------------------+
| transformUsage() |     |  WebSocket       |
| (memoized)       |     |  usage:updated   |
+--------+---------+     +--------+---------+
         |                        |
         +------------------------+
         |
         v
+------------------+
|  Chart Component |
|  (SVG/Canvas)    |
+--------+---------+
         |
    +----+----+
    |         |
    v         v
+-------+  +-------+
|Tokens |  |Budget |
|Chart  |  |Gauge  |
+-------+  +-------+
```

---

### 5. Theme System

#### TypeScript Interfaces

```typescript
// /packages/web-ui/src/types/theme.ts

export type ThemeMode = 'light' | 'dark' | 'system'

export interface ThemeColors {
  // Background colors
  background: string
  backgroundSecondary: string
  backgroundTertiary: string

  // Foreground colors
  foreground: string
  foregroundSecondary: string
  foregroundTertiary: string

  // Border colors
  border: string
  borderSecondary: string

  // Brand colors
  apex: {
    50: string
    100: string
    200: string
    300: string
    400: string
    500: string
    600: string
    700: string
    800: string
    900: string
    950: string
  }

  // Semantic colors
  success: string
  warning: string
  error: string
  info: string
}

export interface Theme {
  mode: ThemeMode
  colors: ThemeColors
}

export interface ThemeContextValue {
  theme: Theme
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
  resolvedMode: 'light' | 'dark' // Actual mode after resolving 'system'
}
```

#### Theme Context Structure

```typescript
// /packages/web-ui/src/contexts/ThemeContext.tsx

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('system')
  const [resolvedMode, setResolvedMode] = useState<'light' | 'dark'>('dark')

  // Resolve system preference
  useEffect(() => {
    if (mode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      setResolvedMode(mediaQuery.matches ? 'dark' : 'light')

      const handler = (e: MediaQueryListEvent) => {
        setResolvedMode(e.matches ? 'dark' : 'light')
      }

      mediaQuery.addEventListener('change', handler)
      return () => mediaQuery.removeEventListener('change', handler)
    } else {
      setResolvedMode(mode)
    }
  }, [mode])

  // Apply theme to document
  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark')
    document.documentElement.classList.add(resolvedMode)
  }, [resolvedMode])

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode)
    localStorage.setItem('apex-theme-mode', newMode)
  }, [])

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('apex-theme-mode') as ThemeMode | null
    if (stored && ['light', 'dark', 'system'].includes(stored)) {
      setModeState(stored)
    }
  }, [])

  const theme = resolvedMode === 'dark' ? darkTheme : lightTheme

  return (
    <ThemeContext.Provider value={{ theme, mode, setMode, resolvedMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}
```

#### CSS Variable Strategy

```css
/* /packages/web-ui/src/app/globals.css */

@layer base {
  :root {
    /* Light theme variables */
    --color-background: 255 255 255;
    --color-background-secondary: 249 250 251;
    --color-background-tertiary: 243 244 246;

    --color-foreground: 17 24 39;
    --color-foreground-secondary: 107 114 128;
    --color-foreground-tertiary: 156 163 175;

    --color-border: 229 231 235;
    --color-border-secondary: 209 213 219;

    /* Semantic colors */
    --color-success: 34 197 94;
    --color-warning: 234 179 8;
    --color-error: 239 68 68;
    --color-info: 59 130 246;

    /* Chart colors */
    --chart-primary: var(--color-apex-500);
    --chart-secondary: var(--color-apex-300);
    --chart-background: var(--color-background-secondary);
  }

  .dark {
    --color-background: 10 10 10;
    --color-background-secondary: 20 20 20;
    --color-background-tertiary: 30 30 30;

    --color-foreground: 250 250 250;
    --color-foreground-secondary: 161 161 170;
    --color-foreground-tertiary: 113 113 122;

    --color-border: 39 39 42;
    --color-border-secondary: 63 63 70;

    /* Adjust semantic colors for dark mode */
    --color-success: 74 222 128;
    --color-warning: 250 204 21;
    --color-error: 248 113 113;
    --color-info: 96 165 250;
  }
}
```

#### Tailwind Dark Mode Integration

```javascript
// tailwind.config.js

module.exports = {
  darkMode: 'class', // Use class-based dark mode
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: 'rgb(var(--color-background) / <alpha-value>)',
          secondary: 'rgb(var(--color-background-secondary) / <alpha-value>)',
          tertiary: 'rgb(var(--color-background-tertiary) / <alpha-value>)',
        },
        foreground: {
          DEFAULT: 'rgb(var(--color-foreground) / <alpha-value>)',
          secondary: 'rgb(var(--color-foreground-secondary) / <alpha-value>)',
          tertiary: 'rgb(var(--color-foreground-tertiary) / <alpha-value>)',
        },
        // ... rest of colors
      },
    },
  },
}
```

#### Persistence Mechanism

```typescript
// Theme persistence utilities
const STORAGE_KEY = 'apex-theme-mode'

function saveThemeMode(mode: ThemeMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // localStorage might be unavailable (SSR, private browsing)
  }
}

function loadThemeMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && ['light', 'dark', 'system'].includes(stored)) {
      return stored as ThemeMode
    }
  } catch {
    // Fallback to system
  }
  return 'system'
}

// Prevent flash of wrong theme on page load
// Add this script to <head> before page renders
const THEME_INIT_SCRIPT = `
  (function() {
    const stored = localStorage.getItem('${STORAGE_KEY}');
    const mode = stored || 'system';
    const resolved = mode === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : mode;
    document.documentElement.classList.add(resolved);
  })();
`;
```

---

### 6. Notification System

#### TypeScript Interfaces

```typescript
// /packages/web-ui/src/types/notifications.ts

export type NotificationType = 'success' | 'error' | 'warning' | 'info'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message?: string
  duration?: number // Auto-dismiss in ms, 0 = persistent
  dismissible?: boolean
  action?: {
    label: string
    onClick: () => void
  }
  createdAt: Date
}

export interface NotificationContextValue {
  notifications: Notification[]
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt'>) => string
  removeNotification: (id: string) => void
  clearAll: () => void
}

// Convenience methods
export interface NotificationHelpers {
  success: (title: string, message?: string) => string
  error: (title: string, message?: string) => string
  warning: (title: string, message?: string) => string
  info: (title: string, message?: string) => string
}
```

#### Notification Context/Provider

```typescript
// /packages/web-ui/src/contexts/NotificationContext.tsx

import { createContext, useContext, useCallback, useReducer } from 'react'
import { nanoid } from 'nanoid'

const MAX_NOTIFICATIONS = 5
const DEFAULT_DURATION = 5000

interface NotificationState {
  notifications: Notification[]
}

type NotificationAction =
  | { type: 'ADD'; payload: Notification }
  | { type: 'REMOVE'; payload: string }
  | { type: 'CLEAR_ALL' }

function notificationReducer(
  state: NotificationState,
  action: NotificationAction
): NotificationState {
  switch (action.type) {
    case 'ADD':
      return {
        notifications: [
          action.payload,
          ...state.notifications.slice(0, MAX_NOTIFICATIONS - 1)
        ],
      }
    case 'REMOVE':
      return {
        notifications: state.notifications.filter(n => n.id !== action.payload),
      }
    case 'CLEAR_ALL':
      return { notifications: [] }
    default:
      return state
  }
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(notificationReducer, { notifications: [] })

  const addNotification = useCallback((
    notification: Omit<Notification, 'id' | 'createdAt'>
  ): string => {
    const id = nanoid()
    const fullNotification: Notification = {
      ...notification,
      id,
      createdAt: new Date(),
      duration: notification.duration ?? DEFAULT_DURATION,
      dismissible: notification.dismissible ?? true,
    }

    dispatch({ type: 'ADD', payload: fullNotification })

    // Auto-dismiss if duration is set
    if (fullNotification.duration > 0) {
      setTimeout(() => {
        dispatch({ type: 'REMOVE', payload: id })
      }, fullNotification.duration)
    }

    return id
  }, [])

  const removeNotification = useCallback((id: string) => {
    dispatch({ type: 'REMOVE', payload: id })
  }, [])

  const clearAll = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL' })
  }, [])

  // Convenience methods
  const helpers: NotificationHelpers = {
    success: (title, message) => addNotification({ type: 'success', title, message }),
    error: (title, message) => addNotification({ type: 'error', title, message, duration: 0 }),
    warning: (title, message) => addNotification({ type: 'warning', title, message }),
    info: (title, message) => addNotification({ type: 'info', title, message }),
  }

  return (
    <NotificationContext.Provider value={{
      notifications: state.notifications,
      addNotification,
      removeNotification,
      clearAll,
      ...helpers,
    }}>
      {children}
    </NotificationContext.Provider>
  )
}
```

#### Toast Component Props

```typescript
// /packages/web-ui/src/components/ui/Toast.tsx

export interface ToastProps {
  notification: Notification
  onDismiss: () => void
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center'
}

export interface ToastContainerProps {
  position?: ToastProps['position']
  className?: string
}
```

#### WebSocket Event Integration

```typescript
// /packages/web-ui/src/hooks/useNotificationEvents.ts

import { useEffect } from 'react'
import { useNotifications } from '@/contexts/NotificationContext'
import { useTaskStream } from '@/lib/websocket-client'
import type { ApexEvent } from '@apex/core'

export function useNotificationEvents(taskId?: string) {
  const { events } = useTaskStream(taskId)
  const { success, error, warning, info } = useNotifications()

  useEffect(() => {
    if (events.length === 0) return

    const latestEvent = events[events.length - 1]
    handleEvent(latestEvent)
  }, [events.length])

  function handleEvent(event: ApexEvent) {
    switch (event.type) {
      case 'task:completed':
        success('Task Completed', `Task ${event.taskId.slice(0, 8)} finished successfully`)
        break

      case 'task:failed':
        error('Task Failed', event.data.error as string)
        break

      case 'gate:required':
        warning('Approval Required', `Gate "${event.data.gateName}" needs your attention`)
        break

      case 'gate:approved':
        info('Gate Approved', `Gate "${event.data.gateName}" was approved`)
        break

      case 'usage:updated': {
        const usage = event.data as { estimatedCost: number }
        // Only notify if cost exceeds threshold
        if (usage.estimatedCost > 5) {
          warning('High Cost Alert', `Task cost is now ${formatCost(usage.estimatedCost)}`)
        }
        break
      }
    }
  }
}
```

#### Notification Data Flow Diagram

```
+------------------+     +------------------+
|  WebSocket       |     |  User Actions    |
|  Events          |     |  (UI)            |
+--------+---------+     +--------+---------+
         |                        |
         v                        v
+------------------+     +------------------+
| useNotification  |     |  useNotifications|
| Events()         |     |  hook            |
+--------+---------+     +--------+---------+
         |                        |
         +------------------------+
                    |
                    v
         +------------------+
         |  Notification    |
         |  Context         |
         +--------+---------+
                  |
                  v
         +------------------+
         |  Notification    |
         |  Reducer         |
         +--------+---------+
                  |
                  v
         +------------------+
         |  Toast           |
         |  Container       |
         +--------+---------+
                  |
         +--------+--------+
         |        |        |
         v        v        v
      +----+  +----+  +----+
      |Toast| |Toast| |Toast|
      +----+  +----+  +----+
```

---

## Implementation Order

For optimal dependency management, implement in this order:

1. **Theme System** - Foundation for all styling
2. **Notification System** - Cross-cutting concern used by other components
3. **LogViewer Component** - Can be developed in isolation
4. **Charts** - TokenUsageChart and BudgetGauge
5. **GatePanel Component** - Depends on notifications
6. **Task Detail Page** - Integrates all components

## Dependencies to Add

```json
{
  "dependencies": {
    "@tanstack/react-virtual": "^3.0.0",
    "nanoid": "^5.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0"
  }
}
```

## Consequences

### Positive
- Clear separation of concerns with well-defined interfaces
- Type-safe component contracts
- Efficient rendering with virtualization for large log lists
- Smooth real-time updates with optimistic UI patterns
- Consistent theming across the application

### Negative
- Additional dependencies for virtualization and ID generation
- Complexity in managing multiple contexts (Theme, Notification)
- WebSocket state synchronization requires careful handling

### Risks
- Memory management with large event streams (mitigated by MAX_EVENT_BUFFER_SIZE)
- Theme flash on initial load (mitigated by inline script)
- Network disconnection handling for WebSocket

## Related ADRs

- ADR-002: WebSocket Architecture (existing)
- ADR-003: State Management Strategy (future)
