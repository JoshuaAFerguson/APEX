# DaemonScheduler

The `DaemonScheduler` class provides intelligent task scheduling capabilities for the APEX daemon based on time windows and usage capacity thresholds.

## Features

- **Time Window Management**: Supports day/night/off-hours modes with configurable time ranges
- **Capacity Thresholds**: Automatically pauses tasks when usage exceeds configured thresholds
- **Provider Pattern**: Abstracts usage statistics via the `UsageStatsProvider` interface
- **Comprehensive Reporting**: Provides detailed scheduling decisions with recommendations

## Key Classes

### DaemonScheduler

Main scheduler class that determines whether tasks should be paused based on:
- Current time window (day/night/off-hours)
- Usage capacity relative to thresholds
- Daily budget limits

### UsageStatsProvider

Interface for providing usage statistics to the scheduler. Includes:
- Daily usage statistics (tokens, cost, tasks)
- Active task count
- Daily budget limit

### UsageManagerProvider

Adapter that implements `UsageStatsProvider` using the existing `UsageManager` class.

## Usage Example

```typescript
import { DaemonScheduler, UsageManagerProvider } from './daemon-scheduler';
import { UsageManager } from './usage-manager';

// Create usage provider from existing UsageManager
const usageProvider = new UsageManagerProvider(usageManager);

// Create scheduler with configuration
const scheduler = new DaemonScheduler(daemonConfig, limitsConfig, usageProvider);

// Check if tasks should be paused
const decision = scheduler.shouldPauseTasks();

if (decision.shouldPause) {
  console.log(`Pausing tasks: ${decision.reason}`);
  console.log(`Next check at: ${decision.timeWindow.nextTransition}`);
}

// Get usage statistics
const stats = scheduler.getUsageStats();
console.log(`Current capacity: ${(stats.capacity.currentPercentage * 100).toFixed(1)}%`);
```

## Configuration

The scheduler uses the `timeBasedUsage` configuration from `DaemonConfig`:

```typescript
{
  timeBasedUsage: {
    enabled: true,
    dayModeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17], // 9 AM - 5 PM
    nightModeHours: [22, 23, 0, 1, 2, 3, 4, 5, 6], // 10 PM - 6 AM
    dayModeCapacityThreshold: 0.80, // Pause at 80% during day
    nightModeCapacityThreshold: 0.95, // Pause at 95% during night
    dayModeThresholds: {
      maxTokensPerTask: 100000,
      maxCostPerTask: 5.0,
      maxConcurrentTasks: 2,
    },
    nightModeThresholds: {
      maxTokensPerTask: 1000000,
      maxCostPerTask: 20.0,
      maxConcurrentTasks: 5,
    },
  }
}
```

## Time Windows

### Day Mode
- Active during configured `dayModeHours`
- Lower capacity threshold (typically 80-90%)
- Conservative task limits
- Used during regular business hours

### Night Mode
- Active during configured `nightModeHours`
- Higher capacity threshold (typically 95-98%)
- More aggressive task limits
- Used during off-hours when higher usage is acceptable

### Off-Hours Mode
- When `timeBasedUsage` is disabled or outside configured hours
- No active task execution
- Tasks are paused until next active window

## Scheduling Decision

The `shouldPauseTasks()` method returns a `SchedulingDecision` with:
- `shouldPause`: Whether to pause task execution
- `reason`: Human-readable explanation
- `timeWindow`: Current time window information
- `capacity`: Current capacity usage and threshold info
- `nextResetTime`: When daily stats reset (midnight)
- `recommendations`: Helpful suggestions for optimization

## Integration Points

The scheduler integrates with existing APEX components:
- **UsageManager**: Provides usage statistics via adapter pattern
- **DaemonConfig**: Configuration source for time windows and thresholds
- **LimitsConfig**: Base limits and daily budget configuration

## Testing

Comprehensive unit tests cover:
- Time window detection for all modes
- Capacity calculation and threshold logic
- Scheduling decisions under various scenarios
- Edge cases (midnight transitions, custom configurations)
- Recommendation generation

Run tests with:
```bash
npm test --workspace=@apex/orchestrator -- daemon-scheduler
```