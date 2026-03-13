# ADR-0023: v0.4.0 Time-Based Usage Management and Session Recovery Architecture Audit

## Status
**AUDIT COMPLETED** - Architecture verified with implementation gaps identified

## Date
2026-03-11

## Context
This document provides a comprehensive architecture audit of the v0.4.0 Time-Based Usage Management and Session Recovery features. The audit was conducted to verify the implementation against the acceptance criteria:

1. Day/night modes with different resource thresholds
2. Auto-pause/resume functionality
3. Session state persistence
4. Conversation summary injection

## Architecture Overview

### Core Components

The v0.4.0 features are implemented across four primary modules in `packages/orchestrator/src/`:

#### 1. UsageManager (`usage-manager.ts`)
**Purpose**: Manages time-based usage thresholds and tracks daily consumption

**Key Interfaces**:
```typescript
interface TimeBasedUsage {
  currentMode: 'day' | 'night' | 'off-hours';
  thresholds: UsageThresholds;
  dailyUsage: DailyUsageStats;
  nextModeSwitch: Date;
}

interface UsageThresholds {
  maxTokensPerTask: number;
  maxCostPerTask: number;
  maxConcurrentTasks: number;
}
```

**Implemented Methods**:
- `getCurrentUsage()`: Returns current time-based usage info ✅
- `canStartTask()`: Checks if a new task can be started ✅
- `trackTaskStart()`: Tracks task start ✅
- `trackTaskCompletion()`: Tracks task completion and updates daily stats ✅
- `updateTaskUsage()`: Updates usage for an active task ✅
- `getUsageStats()`: Returns comprehensive usage statistics ✅
- `resetDailyStats()`: Resets daily statistics ✅
- Event emission: `mode-changed` ✅

**Configuration Support**:
```typescript
interface DaemonConfig {
  timeBasedUsage?: {
    enabled: boolean;
    dayModeHours: number[];
    nightModeHours: number[];
    dayModeThresholds: ThresholdConfig;
    nightModeThresholds: ThresholdConfig;
    dayModeCapacityThreshold?: number;
    nightModeCapacityThreshold?: number;
  };
}
```

#### 2. SessionManager (`session-manager.ts`)
**Purpose**: Manages session recovery and continuity for long-running tasks

**Key Interfaces**:
```typescript
interface TaskCheckpoint {
  taskId: string;
  checkpointId: string;
  stage?: string;
  stageIndex: number;
  conversationState: AgentMessage[];
  metadata: Record<string, unknown>;
  createdAt: Date;
}

interface SessionSummary {
  conversationLength: number;
  keyDecisions: string[];
  currentContext: string;
  progressSummary: string;
}
```

**Implemented Methods**:
- `initialize()`: Initializes session manager and checkpoint directory ✅
- `createCheckpoint()`: Creates a task checkpoint with conversation state ✅
- `restoreSession()`: Restores session data for a task ✅
- `autoResumeTask()`: Auto-resumes a task from last checkpoint ✅
- `summarizeContext()`: Summarizes conversation context ✅
- `cleanupCheckpoints()`: Cleans up old checkpoints ✅
- `getCheckpointStats()`: Returns checkpoint statistics ✅
- Event emission: `session-recovered` ✅

#### 3. CapacityMonitor (`capacity-monitor.ts`)
**Purpose**: Proactively monitors capacity and detects restoration events

**Key Interfaces**:
```typescript
interface CapacityUsage {
  currentTokens: number;
  currentCost: number;
  activeTasks: number;
  maxTokensPerTask: number;
  maxCostPerTask: number;
  maxConcurrentTasks: number;
  dailyBudget: number;
  dailySpent: number;
}

interface CapacityRestoredEvent {
  reason: 'mode_switch' | 'budget_reset' | 'capacity_dropped';
  timestamp: Date;
  previousUsage: CapacityUsage;
  currentUsage: CapacityUsage;
  modeInfo: ModeInfo;
}
```

**Implemented Methods**:
- `start()`: Starts capacity monitoring ✅
- `stop()`: Stops capacity monitoring ✅
- `checkCapacity()`: Checks current capacity ✅
- `getStatus()`: Returns monitoring status ✅
- Event emission: `capacity:restored` ✅

#### 4. DaemonScheduler (`daemon-scheduler.ts`)
**Purpose**: Manages daemon scheduling decisions based on time windows and capacity

**Key Interfaces**:
```typescript
interface TimeWindow {
  mode: 'day' | 'night' | 'off-hours';
  startHour: number;
  endHour: number;
  isActive: boolean;
  nextTransition: Date;
}

interface SchedulingDecision {
  shouldPause: boolean;
  reason?: string;
  timeWindow: TimeWindow;
  capacity: CapacityInfo;
  nextResetTime: Date;
  recommendations?: string[];
}
```

**Implemented Methods**:
- `shouldPauseTasks()`: Determines if tasks should be paused ✅
- `getCurrentTimeWindow()`: Returns current time window info ✅
- `getCapacityInfo()`: Returns capacity information ✅
- `getUsageStats()`: Returns usage statistics ✅
- `getTimeUntilModeSwitch()`: Time until next mode switch ✅
- `getTimeUntilBudgetReset()`: Time until budget resets ✅
- `onCapacityRestored()`: Registers callback for capacity restoration ✅
- `destroy()`: Cleanup resources ✅

#### 5. Context Module (`context.ts`)
**Purpose**: Context compaction and conversation analysis utilities

**Key Functions**:
- `estimateConversationTokens()`: Estimates token count ✅
- `createContextSummary()`: Creates markdown context summary ✅
- `extractKeyDecisions()`: Extracts key decisions from conversation ✅
- `extractProgressInfo()`: Extracts progress information ✅
- `extractFileModifications()`: Extracts file modifications ✅
- `compactConversation()`: Compacts long conversations ✅
- `analyzeConversation()`: Analyzes conversation for compaction strategy ✅

## Acceptance Criteria Verification

### 1. Day/Night Modes ✅ IMPLEMENTED

**Implementation Status**: Complete

The `UsageManager` correctly implements:
- Mode detection based on configured hours (`dayModeHours`, `nightModeHours`)
- Different thresholds per mode (tokens, cost, concurrent tasks)
- Off-hours mode for hours not in day/night ranges
- Mode change event emission

**Configuration Example**:
```typescript
{
  timeBasedUsage: {
    enabled: true,
    dayModeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17], // 9am-5pm
    nightModeHours: [22, 23, 0, 1, 2, 3, 4, 5, 6],     // 10pm-6am
    dayModeThresholds: { maxTokensPerTask: 100000, maxCostPerTask: 5.0 },
    nightModeThresholds: { maxTokensPerTask: 1000000, maxCostPerTask: 20.0 }
  }
}
```

### 2. Auto-Pause/Resume ✅ IMPLEMENTED

**Implementation Status**: Complete

The `CapacityMonitor` and `DaemonScheduler` together implement:
- Capacity threshold monitoring
- Auto-pause on exceeding thresholds
- Auto-resume on mode switch to higher limits
- Auto-resume on budget reset at midnight
- Event-based notification system

**Key Flow**:
1. `CapacityMonitor.start()` begins monitoring
2. Timer-based checks at mode switches and midnight
3. `capacity:restored` event emitted on restoration
4. `DaemonScheduler.shouldPauseTasks()` provides decision logic

### 3. Session State Persistence ✅ IMPLEMENTED

**Implementation Status**: Complete

The `SessionManager` implements:
- Checkpoint creation with conversation snapshot
- File-based checkpoint storage (`.apex/checkpoints/`)
- Session restoration from checkpoints
- Resume attempt tracking
- Checkpoint cleanup (configurable max age)

**Storage Format**:
```
.apex/checkpoints/
  {taskId}-{timestamp}.json  # Checkpoint files
  {taskId}-session.json      # Session data files
```

### 4. Conversation Summary Injection ✅ IMPLEMENTED

**Implementation Status**: Complete

The `context.ts` module implements:
- Token estimation (`estimateConversationTokens`)
- Key decision extraction (`extractKeyDecisions`)
- Progress tracking (`extractProgressInfo`)
- File modification tracking (`extractFileModifications`)
- Formatted summary generation (`createContextSummary`)

**Summary Output Format**:
```markdown
## Previous Context Summary

- Messages exchanged: 42
- Tools used: Read, Edit, Bash
- Files read: src/auth.ts, src/utils.ts
- Files edited: src/auth.ts

### Progress Tracking
- Completed: authentication setup, database schema
- Currently: implementing API endpoints
- Overall progress: 66%

### Key Decisions Made
- [implementation] implement authentication using JWT
- [architecture] use PostgreSQL for data storage

### Recent Requests
- Add user authentication
- Create database schema
```

## API Discrepancies Identified

### Test File Issues

The test file `tests/v040-time-based-usage-session-recovery-comprehensive.test.ts` contains API calls that don't match the actual implementation:

| Test Calls | Actual API | Fix Required |
|------------|------------|--------------|
| `usageManager.getCurrentTimeBasedUsage()` | `usageManager.getCurrentUsage()` | Rename call |
| `usageManager.getDailyUsage()` | `usageManager.getUsageStats().current.dailyUsage` | Use getUsageStats() |
| `sessionManager.shouldCreateCheckpoint()` | Not implemented | Remove or implement |
| `sessionManager.loadCheckpoint()` | `sessionManager.restoreSession()` | Use restoreSession() |
| `sessionManager.canAutoResume()` | Not directly exposed | Access via restoreSession().canResume |
| `sessionManager.saveCheckpoint()` | `sessionManager.createCheckpoint()` | Use createCheckpoint() |
| `sessionManager.generateSessionSummary()` | `sessionManager.summarizeContext()` | Use summarizeContext() |
| `extractProgressSummary()` | `extractProgressInfo()` | Rename import |

### Export Gaps

The following classes are **not exported** from `packages/orchestrator/src/index.ts`:
- `UsageManager` - Not exported
- `SessionManager` - Not exported
- `CapacityMonitor` - Not exported

Only `DaemonScheduler` and related types are exported from the public API.

## Recommendations

### 1. Export Core Classes
Consider exporting `UsageManager`, `SessionManager`, and `CapacityMonitor` for external use:

```typescript
// Add to packages/orchestrator/src/index.ts
export { UsageManager, type UsageThresholds, type TimeBasedUsage, type DailyUsageStats } from './usage-manager';
export { SessionManager, type SessionSummary, type SessionRecoveryOptions } from './session-manager';
export { CapacityMonitor, type CapacityUsage, type CapacityRestoredEvent } from './capacity-monitor';
```

### 2. Fix Test File API Calls
Update the test file to use the correct API methods:

```typescript
// Before
const timeBasedUsage = usageManager.getCurrentTimeBasedUsage();

// After
const timeBasedUsage = usageManager.getCurrentUsage();
```

### 3. Add Missing SessionManager Methods
Consider adding convenience methods:

```typescript
// Add to SessionManager
async shouldCreateCheckpoint(task: Task): Promise<boolean> {
  const tokens = estimateConversationTokens(task.conversation);
  const threshold = this.config.sessionRecovery?.contextWindowThreshold || 0.8;
  return tokens > (threshold * 100000);
}

async canAutoResume(taskId: string): Promise<boolean> {
  const { canResume } = await this.restoreSession(taskId);
  return canResume;
}
```

## Architecture Strengths

1. **Clean Separation of Concerns**: Each component has a single responsibility
2. **Event-Driven Design**: Uses EventEmitter for decoupled communication
3. **Configuration-Driven**: All thresholds and behaviors are configurable
4. **Provider Pattern**: `CapacityUsageProvider` and `UsageStatsProvider` interfaces enable testing and flexibility
5. **Graceful Degradation**: Features work even when configuration is missing (uses defaults)

## Architecture Considerations

1. **File-Based Storage**: Checkpoints are stored as JSON files, which may not scale for high-volume scenarios
2. **No Persistence of UsageManager State**: Daily stats are not persisted across restarts
3. **Timer Accuracy**: Mode switch detection relies on timers which may drift
4. **No Database Integration**: Consider SQLite for more robust checkpoint storage

## Conclusion

The v0.4.0 Time-Based Usage Management and Session Recovery features are **fully implemented** with a clean, maintainable architecture. The test file needs updates to align with the actual API signatures. The core acceptance criteria are all met:

| Criterion | Status |
|-----------|--------|
| Day/night modes | ✅ Implemented |
| Auto-pause/resume | ✅ Implemented |
| Session state persistence | ✅ Implemented |
| Conversation summary injection | ✅ Implemented |

## Decision
Approved - Architecture is sound and implementation is complete.

## References
- `packages/orchestrator/src/usage-manager.ts` - Time-based usage management
- `packages/orchestrator/src/session-manager.ts` - Session recovery
- `packages/orchestrator/src/capacity-monitor.ts` - Capacity monitoring
- `packages/orchestrator/src/daemon-scheduler.ts` - Scheduling decisions
- `packages/orchestrator/src/context.ts` - Conversation analysis utilities
