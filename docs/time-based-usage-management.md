# Time-Based Usage Management Configuration Guide

APEX provides sophisticated time-based usage management that allows you to configure different usage patterns, thresholds, and behavior for day, night, and off-hours periods. This enables automatic task pausing and resumption based on time windows and usage levels.

## Overview

Time-based usage management enables:

- **Adaptive resource limits** - Different capacity thresholds for day vs night
- **Configurable time windows** - Define when day/night/off-hours occur
- **Automatic task management** - Auto-pause and auto-resume based on time and capacity
- **Budget distribution** - Spread usage across different periods optimally
- **Cost optimization** - Run expensive tasks during less constrained periods

## Configuration Location

Time-based usage is configured in the `daemon` section of your `.apex/config.yaml`:

```yaml
daemon:
  timeBasedUsage:
    enabled: true
    # ... configuration options below
```

## Basic Configuration

### Enabling Time-Based Usage

```yaml
daemon:
  timeBasedUsage:
    enabled: true  # Enable time-based usage management
```

When disabled (default), all hours are treated as "off-hours" with conservative limits.

### Time Window Configuration

Define when day and night modes are active:

```yaml
daemon:
  timeBasedUsage:
    enabled: true
    dayModeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17]    # 9 AM - 5 PM
    nightModeHours: [22, 23, 0, 1, 2, 3, 4, 5, 6]       # 10 PM - 6 AM
```

**Time Modes:**
- **Day Mode**: Active working hours (typically 9 AM - 5 PM)
- **Night Mode**: Off-peak hours with relaxed limits (typically 10 PM - 6 AM)
- **Off-Hours**: Any time not in day or night mode (weekends, gaps between modes)

**Important Notes:**
- Hours are specified in 24-hour format (0-23)
- Hours can span midnight (e.g., `[22, 23, 0, 1, 2]`)
- Off-hours are automatically calculated as times not in day or night modes
- Time zones are based on the system's local time

### Capacity Thresholds

Configure when tasks should pause based on daily budget usage:

```yaml
daemon:
  timeBasedUsage:
    enabled: true
    dayModeCapacityThreshold: 0.80    # Pause at 80% of daily budget during day
    nightModeCapacityThreshold: 0.95  # Pause at 95% of daily budget during night
```

**How Capacity Thresholds Work:**
- Values are percentages (0.0 to 1.0) of your daily budget
- Day mode typically has lower thresholds to preserve budget for night processing
- Night mode allows higher usage for expensive tasks
- When threshold is exceeded, new tasks are paused until next time window or budget reset

## Advanced Configuration

### Per-Mode Resource Limits

Configure different limits for each time period:

```yaml
daemon:
  timeBasedUsage:
    enabled: true
    dayModeThresholds:
      maxTokensPerTask: 100000      # Smaller tasks during day
      maxCostPerTask: 5.0           # Lower cost limit
      maxConcurrentTasks: 2         # Conservative concurrency
    nightModeThresholds:
      maxTokensPerTask: 1000000     # Larger tasks at night
      maxCostPerTask: 20.0          # Higher cost allowance
      maxConcurrentTasks: 5         # More aggressive parallelism
```

**Resource Limit Types:**
- `maxTokensPerTask`: Maximum tokens consumed per individual task
- `maxCostPerTask`: Maximum cost (USD) per individual task
- `maxConcurrentTasks`: Maximum tasks running simultaneously

## Complete Configuration Example

```yaml
version: "1.0"

project:
  name: "my-project"
  language: "typescript"

limits:
  dailyBudget: 100.00              # $100 daily budget
  maxTokensPerTask: 500000         # Default token limit
  maxCostPerTask: 10.00           # Default cost limit
  maxConcurrentTasks: 3            # Default concurrency

daemon:
  timeBasedUsage:
    enabled: true

    # Time Windows
    dayModeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17]    # 9 AM - 5 PM
    nightModeHours: [22, 23, 0, 1, 2, 3, 4, 5, 6]       # 10 PM - 6 AM

    # Capacity Thresholds (percentage of daily budget)
    dayModeCapacityThreshold: 0.80    # Pause at 80% during business hours
    nightModeCapacityThreshold: 0.95  # Pause at 95% during night

    # Per-Mode Resource Limits
    dayModeThresholds:
      maxTokensPerTask: 100000        # Conservative token usage
      maxCostPerTask: 5.0             # Lower cost per task
      maxConcurrentTasks: 2           # Limited parallelism

    nightModeThresholds:
      maxTokensPerTask: 1000000       # Allow expensive tasks
      maxCostPerTask: 20.0            # Higher cost allowance
      maxConcurrentTasks: 5           # Aggressive parallelism
```

## Auto-Pause and Auto-Resume Behavior

### When Tasks Are Auto-Paused

Tasks are automatically paused when:

1. **Capacity threshold exceeded**: Daily budget usage exceeds the threshold for current time mode
2. **Mode transition**: Switching to a more restrictive time mode
3. **Daily budget exhausted**: Reaching 100% of daily budget limit

### When Tasks Are Auto-Resumed

Tasks are automatically resumed when:

1. **Mode switch to higher limits**: Day → Night transition with higher thresholds
2. **Budget reset**: Daily budget resets at midnight
3. **Capacity drops**: Current usage falls below threshold due to task completion

### Auto-Resume Prioritization

When multiple paused tasks can be resumed:

1. **Priority**: Higher priority tasks resume first (`urgent` > `high` > `normal` > `low`)
2. **Creation time**: Older tasks resume before newer ones
3. **Resource requirements**: Tasks fitting current mode limits resume first

## Configuration Patterns

### Development Environment

Conservative limits for development work:

```yaml
daemon:
  timeBasedUsage:
    enabled: true
    dayModeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17]
    nightModeHours: []  # No night mode, keep conservative limits
    dayModeCapacityThreshold: 0.70
    dayModeThresholds:
      maxTokensPerTask: 50000
      maxCostPerTask: 2.0
      maxConcurrentTasks: 1
```

### Production Environment

Optimized for 24/7 operation:

```yaml
daemon:
  timeBasedUsage:
    enabled: true
    dayModeHours: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]  # 6 AM - 7 PM
    nightModeHours: [22, 23, 0, 1, 2, 3, 4, 5]                         # 10 PM - 5 AM
    dayModeCapacityThreshold: 0.60      # Reserve budget for night processing
    nightModeCapacityThreshold: 0.95    # Use most of remaining budget
    dayModeThresholds:
      maxTokensPerTask: 200000
      maxCostPerTask: 8.0
      maxConcurrentTasks: 3
    nightModeThresholds:
      maxTokensPerTask: 2000000
      maxCostPerTask: 50.0
      maxConcurrentTasks: 8
```

### Cost-Optimized Pattern

Maximize night processing for expensive tasks:

```yaml
daemon:
  timeBasedUsage:
    enabled: true
    dayModeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17]
    nightModeHours: [20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6, 7]  # Longer night window
    dayModeCapacityThreshold: 0.30      # Very conservative during day
    nightModeCapacityThreshold: 0.98    # Aggressive night usage
    dayModeThresholds:
      maxTokensPerTask: 25000           # Small tasks only
      maxCostPerTask: 1.0
      maxConcurrentTasks: 1
    nightModeThresholds:
      maxTokensPerTask: 5000000         # Large tasks at night
      maxCostPerTask: 100.0
      maxConcurrentTasks: 10
```

## Monitoring and Troubleshooting

### Checking Current Status

Monitor time-based usage with the daemon status command:

```bash
apex daemon status
```

Output includes:
- Current time mode (day/night/off-hours)
- Capacity usage and thresholds
- Next mode transition time
- Auto-pause status and reason

### Common Configuration Issues

**Issue: Tasks never run at night**
```yaml
# Problem: Night mode hours not configured
nightModeHours: []

# Solution: Add night mode hours
nightModeHours: [22, 23, 0, 1, 2, 3, 4, 5, 6]
```

**Issue: Tasks paused too frequently**
```yaml
# Problem: Capacity threshold too low
dayModeCapacityThreshold: 0.30

# Solution: Increase threshold
dayModeCapacityThreshold: 0.80
```

**Issue: Expensive tasks never get resources**
```yaml
# Problem: No night mode or limits too restrictive
dayModeThresholds:
  maxCostPerTask: 1.0    # Too low for expensive tasks

# Solution: Configure night mode with higher limits
nightModeThresholds:
  maxCostPerTask: 20.0
```

### Debugging Time Zones

If time windows seem incorrect:

1. Check system time zone: `date`
2. Verify daemon time zone in status output
3. Adjust hours for your local time zone
4. Consider using UTC and converting hours appropriately

## Integration with Other Limits

Time-based usage works alongside other limit configurations:

### Daily Budget Integration

```yaml
limits:
  dailyBudget: 100.00    # Total daily budget

daemon:
  timeBasedUsage:
    dayModeCapacityThreshold: 0.60    # $60 during day
    nightModeCapacityThreshold: 0.95  # $95 total (including day usage)
```

### Global Limits Override

Per-mode limits cannot exceed global limits:

```yaml
limits:
  maxCostPerTask: 15.00    # Global maximum

daemon:
  timeBasedUsage:
    nightModeThresholds:
      maxCostPerTask: 20.0   # Reduced to 15.0 (global limit)
```

## Migration and Rollback

### Enabling Time-Based Usage

To enable on an existing project:

1. Add configuration to `.apex/config.yaml`
2. Start with conservative thresholds
3. Monitor usage patterns for a few days
4. Adjust thresholds based on actual usage

### Disabling Time-Based Usage

To disable and return to simple limits:

```yaml
daemon:
  timeBasedUsage:
    enabled: false    # Disables all time-based features
```

When disabled:
- All hours treated as "off-hours"
- Uses global limits from `limits` section
- No automatic pause/resume based on time
- Capacity management still active based on daily budget

## Best Practices

1. **Start Conservative**: Begin with lower thresholds and increase gradually
2. **Monitor Patterns**: Track actual usage to optimize time windows
3. **Test Mode Transitions**: Verify auto-pause/resume works as expected
4. **Document Changes**: Keep track of threshold adjustments and their effects
5. **Consider Time Zones**: Account for team distribution and system time zones
6. **Plan for Weekends**: Decide if weekend hours should be day, night, or off-hours
7. **Budget Distribution**: Balance day/night usage to maximize productivity
8. **Emergency Access**: Keep manual override capabilities for urgent tasks

## Related Configuration

- [Configuration Reference](./configuration.md) - Complete config documentation
- [Best Practices](./best-practices.md) - General configuration best practices
- [Troubleshooting](./troubleshooting.md) - Common issues and solutions
- [CLI Guide](./cli-guide.md) - Command line usage and monitoring
