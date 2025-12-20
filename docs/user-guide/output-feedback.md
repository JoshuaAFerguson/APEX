# Output & Feedback User Guide

APEX provides comprehensive output and feedback through three main components: **Activity Log**, **Error Display**, and **Success Celebration**. These components work together to keep you informed about task progress, help you troubleshoot issues, and celebrate successful completions.

## Overview

| Component | Purpose | When It Appears |
|-----------|---------|-----------------|
| **Activity Log** | Real-time activity tracking and debugging | Verbose mode, task execution |
| **Error Display** | Intelligent error feedback with suggestions | When errors occur |
| **Success Celebration** | Celebratory feedback with performance metrics | Task completion |

## Activity Log

Real-time activity logging with filtering, search capabilities, and collapsible entries to track what's happening during task execution.

### What's Shown

The Activity Log displays:
- **Log Entries**: System messages, tool usage, agent communications
- **Timestamps**: When each activity occurred
- **Log Levels**: Different types of messages (debug, info, warn, error, success)
- **Agent Information**: Which agent performed each action
- **Categories**: Type of activity (task, tool, system)
- **Duration Tracking**: How long operations take

### Log Entry Types

| Level | Icon | Description | Example |
|-------|------|-------------|---------|
| **debug** | 🔍 | Detailed debugging information | Agent internal reasoning |
| **info** | ℹ️ | General informational messages | Task started, file read |
| **warn** | ⚠️ | Warning messages | Deprecated usage, potential issues |
| **error** | ❌ | Error messages | Failed operations, exceptions |
| **success** | ✅ | Success confirmations | Task completed, tests passed |

### Visual Example

```
┌─ Activity Log ──────────────────────────────────────── 12 entries ┐
│ Filter: error | Level: info+                                       │
├─────────────────────────────────────────────────────────────────────┤
│ [10:30:45] ✅ [developer] (task) Implementation started (0.5s)      │
│ [10:31:00] ℹ️ [developer] (tool) Reading file: src/auth/login.ts   │
│ [10:31:15] ⚠️ [developer] (validation) Deprecated API usage found   │
│ [10:31:30] ❌ [tester] (test) Unit tests failed                     │
│   > error: { code: 'TEST_FAILURE', failures: 3 }                   │
│ [10:32:00] ✅ [developer] (fix) Issues resolved (2.3s)             │
├─────────────────────────────────────────────────────────────────────┤
│ ↑↓: Navigate | Enter: Toggle details | c: Collapse panel           │
└─────────────────────────────────────────────────────────────────────┘
```

### Interactive Controls

#### Navigation
- **↑↓ Arrow Keys**: Move between log entries
- **Enter**: Expand/collapse entry details
- **c**: Collapse the entire panel

#### Filtering
- **Search Filter**: Type to filter entries by content
- **Level Filter**: Show entries at or above selected level

### Display Modes

#### Normal Mode
- Standard activity logging
- Shows during task execution when enabled
- Moderate detail level

#### Verbose Mode
The Activity Log appears automatically in verbose mode:

```bash
/verbose
```

- **Automatic Display**: Shows without manual activation
- **Debug Level Default**: Includes all debug-level messages
- **Full Timestamps**: Complete time information including milliseconds
- **Maximum Detail**: All metadata and context shown

#### Compact Mode
- **Hidden**: Activity log is not shown to save space
- **Essential Only**: Focus on core task progress

### Activity Log Variants

#### Full Activity Log
Complete interactive logging with all features:
```typescript
// Full feature set
- Collapsible entries with metadata
- Search and level filtering
- Navigation controls
- Duration tracking
```

#### Log Stream
Real-time streaming display:
```typescript
// Streaming features
- Pause/scroll controls
- Live updates as they happen
- Minimal interaction required
```

#### Compact Log
Space-efficient display:
```typescript
// Compact features
- Maximum 5 lines shown
- Essential information only
- Minimal screen usage
```

### When Activity Log Appears

1. **Verbose Mode**: Always visible during task execution
2. **Task Debugging**: When troubleshooting issues
3. **Long-Running Tasks**: For monitoring progress
4. **Agent Coordination**: To see inter-agent communication

### Best Practices

#### Use for Monitoring
```bash
# Enable verbose mode for detailed tracking
/verbose

# Execute a complex task
implement user authentication with OAuth and session management

# Monitor the activity log to see:
# - Which files are being read/written
# - Agent decision-making process
# - Tool usage and API calls
# - Performance metrics
```

#### Debugging with Activity Log
```bash
# When a task fails, enable verbose mode
/verbose

# Re-run the failed command
fix the authentication bug in login flow

# Use the activity log to:
# - Identify where the failure occurred
# - See error details and context
# - Track agent reasoning
# - Find performance bottlenecks
```

#### Filtering for Focus
```bash
# Filter to see only errors and warnings
# In Activity Log: Set Level filter to "warn+"

# Search for specific content
# In Activity Log: Type "auth" to see only authentication-related entries
```

## Error Display

Intelligent error feedback system that provides detailed error information along with actionable suggestions for resolution.

### What's Shown

Error displays include:
- **Error Message**: Clear description of what went wrong
- **Context Information**: Relevant details about the situation
- **Stack Traces**: Technical details for debugging (when available)
- **Intelligent Suggestions**: Auto-generated solutions based on error patterns
- **Action Buttons**: Quick actions to resolve or dismiss

### Error Categories

The system recognizes and provides specific suggestions for:

| Error Type | Detection Pattern | Auto Suggestions |
|------------|------------------|------------------|
| **Permission Issues** | "permission denied" | Check file permissions with `ls -la` |
| **Missing Commands** | "command not found" | Install missing dependencies |
| **Network Issues** | "network timeout", "connection" | Retry operation, check connectivity |
| **API Key Problems** | "unauthorized", "api key" | Verify configuration settings |
| **Syntax Errors** | "syntax error", "parse" | Review input format and syntax |
| **File Not Found** | "no such file", "ENOENT" | Check file paths and existence |

### Visual Example

```
┌─ ❌ Authentication Error ────────────────────────────────────┐
│ Failed to authenticate with GitHub API: Invalid credentials  │
│                                                              │
│ Context:                                                     │
│   endpoint: https://api.github.com/user                     │
│   method: GET                                                │
│   status: 401                                                │
│   timestamp: 2024-01-15T10:30:45Z                           │
│                                                              │
│ Stack Trace (5 lines):                                       │
│   AuthError: Invalid credentials                             │
│     at authenticate (auth.js:23:15)                          │
│     at GitHubAPI.request (github.js:45:12)                   │
│     at Task.execute (task.js:89:8)                           │
│     at Orchestrator.run (orchestrator.js:156:20)            │
│                                                              │
│ 💡 Suggestions:                                              │
│   🔴 API Key Issue                                           │
│     Your GitHub token may be expired or invalid             │
│     Action: Check your .env file and regenerate token       │
│     Try: apex config set github.token YOUR_NEW_TOKEN        │
│                                                              │
│   🟡 Configuration                                           │
│     Verify your GitHub configuration is correct             │
│     Try: apex config show github                            │
│                                                              │
│   🟢 Documentation                                           │
│     See GitHub API authentication guide                     │
│     Link: https://docs.github.com/en/rest/authentication    │
│                                                              │
│                                            [D] [R]           │
│                                      Dismiss  Retry         │
└──────────────────────────────────────────────────────────────┘
```

### Suggestion Priority Levels

Suggestions are prioritized to help you focus on the most likely solutions:

#### 🔴 High Priority
- Most likely cause of the error
- Common issues with known solutions
- Critical problems that block progress

#### 🟡 Medium Priority
- Alternative explanations
- Configuration or setup issues
- Less common but possible causes

#### 🟢 Low Priority
- Documentation references
- General troubleshooting steps
- Additional resources for learning

### Error Display Variants

#### Full Error Display
Complete error information with all details:
```typescript
// Full feature set
- Detailed error messages
- Context information
- Stack traces (responsive to terminal width)
- Intelligent suggestions with priorities
- Action buttons for next steps
```

#### Error Summary
Compact overview for multiple errors:
```typescript
// Summary features
- List of error counts by type
- Quick overview of issues
- Links to detailed views
```

#### Validation Error
Field-specific error feedback:
```typescript
// Validation features
- Specific field highlighting
- Input format guidance
- Real-time validation feedback
```

### Stack Trace Display

Stack traces adapt to your terminal width and display mode:

| Terminal Width | Normal Mode | Verbose Mode |
|----------------|-------------|--------------|
| **Narrow** (<60) | Hidden | 3 lines |
| **Compact** (60-100) | Hidden | 5 lines |
| **Normal** (100-160) | 5 lines | 10 lines |
| **Wide** (≥160) | 8 lines | Full trace |

### Interactive Actions

#### Dismiss (D)
- Closes the error display
- Returns to normal interface
- Error is logged but no longer prominently displayed

#### Retry (R)
- Attempts the failed operation again
- Available for retryable operations
- May include automatic fixes based on suggestions

### Best Practices

#### Reading Error Messages
1. **Start with the main message**: Understand what failed
2. **Check the context**: Look for relevant details
3. **Review suggestions**: Focus on high-priority items first
4. **Try suggested actions**: Follow the specific commands or steps

#### Troubleshooting Workflow
```bash
# When an error occurs:
# 1. Read the error message completely
# 2. Check high-priority suggestions first
# 3. Try suggested commands
# 4. Use retry if the issue might be temporary
# 5. Enable verbose mode for more details if needed

/verbose
# Re-run the failed command to see detailed activity log
```

## Success Celebration

Celebratory feedback system that provides positive reinforcement and performance metrics when tasks complete successfully.

### What's Shown

Success celebrations include:
- **Celebration Animation**: Visual effects and emojis
- **Success Message**: Confirmation of what was accomplished
- **Performance Metrics**: Timing, cost, and resource usage
- **Code Changes**: Statistics about files and lines modified
- **Achievement Information**: Milestones and accomplishments

### Celebration Types

Different types of successes trigger different celebration styles:

| Type | Title | Animation | Use Case |
|------|-------|-----------|----------|
| **task** | "Task Completed!" | 🎉 → ✨ → 🎊 → ✅ | General task completion |
| **milestone** | "Milestone Achieved!" | 🏆 | Major progress markers |
| **achievement** | "Achievement Unlocked!" | 👑 | Special accomplishments |
| **simple** | "Success!" | ✅ | Quick confirmations |

### Visual Example

```
          ✨ 🎉 ✨ 🎉 ✨
       🎊 🏆 🎈 🎉 🎆 🎊 🎊

╔════════════════════════════════════════════╗
║ 🎉 Task Completed! 🎉                      ║
║                                            ║
║ Successfully implemented user              ║
║ authentication with JWT tokens!            ║
║                                            ║
║ ══════ Performance Summary ══════           ║
║ Duration:        4m 32s                    ║
║ Tokens Used:     2,847                     ║
║ Cost:            $0.12                     ║
║ Files Changed:   7                         ║
║ Lines Added:     +234                      ║
║ Lines Removed:   -18                       ║
║                                            ║
║ ════════════════════════════════════════   ║
╚════════════════════════════════════════════╝

           💫 ✨ 💫
```

### Performance Metrics

#### Duration
- **Format**: Human-readable time (e.g., "4m 32s", "1.5s")
- **Includes**: Total time from task start to completion
- **Helps**: Understand task complexity and performance

#### Token Usage
- **Format**: Formatted with comma separators (e.g., "2,847")
- **Includes**: Total tokens consumed during task execution
- **Helps**: Monitor resource usage and cost

#### Cost Information
- **Format**: Currency format (e.g., "$0.12")
- **Includes**: Total cost for the task execution
- **Helps**: Track spending and budget management

#### Code Changes
- **Files Changed**: Number of files modified
- **Lines Added**: New lines of code (shown in green)
- **Lines Removed**: Deleted lines of code (shown in red)
- **Helps**: Understand scope of changes made

### Success Celebration Variants

#### Full Celebration
Complete celebration with animations and full metrics:
```typescript
// Full feature set
- Frame-based animations with confetti
- Performance summary with all metrics
- Typewriter effect for messages
- Auto-dismiss after specified duration
```

#### Milestone Badge
Achievement-style display for special accomplishments:
```typescript
// Milestone features
- Rarity levels (common, rare, epic, legendary)
- Special badge styling
- Achievement descriptions
```

#### Progress Celebration
Progress milestone with animated indicators:
```typescript
// Progress features
- Animated progress bars
- Milestone markers
- Incremental achievement display
```

#### Quick Success
Minimal one-line success indicator:
```typescript
// Quick features
- Single line confirmation
- Minimal screen usage
- Fast feedback for small tasks
```

### Animation Effects

#### Confetti Particles
- 🎊 🎉 🎈 🎆 (confetti effects)
- 300ms frame intervals
- Multiple animation cycles

#### Sparkle Effects
- ✨ 💫 ⭐ 🌟 💥 (sparkle particles)
- Floating and twinkling animations
- Dynamic positioning

#### Achievement Badges
Milestone celebrations include rarity-based styling:

| Rarity | Badge | Color | Description |
|--------|-------|-------|-------------|
| **Common** | 🏅 ACHIEVEMENT 🏅 | Gray | Standard accomplishments |
| **Rare** | ⭐ RARE ⭐ | Green Bright | Notable achievements |
| **Epic** | 💎 EPIC 💎 | Blue Bright | Significant milestones |
| **Legendary** | ✨ LEGENDARY ✨ | Magenta Bright | Exceptional accomplishments |

### When Success Celebrations Appear

1. **Task Completion**: When any task finishes successfully
2. **Milestone Achievements**: Major progress markers
3. **Perfect Execution**: Zero errors or warnings
4. **Performance Targets**: Meeting time or cost goals
5. **Code Quality**: High-quality implementations

### Best Practices

#### Enjoying Success Feedback
- **Let animations play**: The celebration is designed to provide positive reinforcement
- **Review metrics**: Check performance data to learn and improve
- **Celebrate milestones**: Acknowledge progress and achievements

#### Learning from Metrics
```bash
# Use success metrics to:
# - Understand task complexity (duration, tokens)
# - Track improvement over time (cost, efficiency)
# - Measure code impact (files changed, lines)
# - Identify patterns in successful tasks
```

## How Output & Feedback Components Work Together

### Integrated Workflow

The three components provide comprehensive feedback throughout the task lifecycle:

```
Task Starts
    ↓
Activity Log: Real-time tracking (in verbose mode)
    ↓
If Error Occurs → Error Display: Intelligent suggestions
    ↓
If Resolved → Continue Activity Tracking
    ↓
Task Completes → Success Celebration: Metrics and animation
```

### Display Mode Integration

All output and feedback components respect your chosen display mode:

| Component | Normal | Compact | Verbose |
|-----------|--------|---------|---------|
| **Activity Log** | On demand | Hidden | Always shown |
| **Error Display** | Full display | Condensed | Enhanced with stack traces |
| **Success Celebration** | Standard animation | Quick confirmation | Full metrics |

### Terminal Width Adaptation

All components automatically adapt to your terminal width:

- **Narrow** (<60 chars): Abbreviated content, essential info only
- **Compact** (60-100 chars): Moderate truncation, key elements visible
- **Normal** (100-160 chars): Standard display, most features shown
- **Wide** (≥160 chars): Full information, no truncation

## Tips and Best Practices

### Effective Monitoring

#### Use Verbose Mode for Complex Tasks
```bash
/verbose
implement microservices architecture with Docker and Kubernetes
# Activity log will show detailed progress and decisions
```

#### Filter Activity Logs for Focus
```bash
# When debugging specific issues:
# 1. Enable verbose mode
# 2. Set activity log filter level to "error"
# 3. Search for specific keywords (e.g., "auth", "database")
```

### Error Resolution Strategy

#### Follow the Suggestion Hierarchy
1. **Try high-priority (🔴) suggestions first**
2. **Use provided commands exactly as shown**
3. **Check medium-priority (🟡) items if high-priority doesn't work**
4. **Reference low-priority (🟢) documentation for learning**

#### Document Solutions
```bash
# When you find a solution:
# 1. Note which suggestion worked
# 2. Keep the solution for future reference
# 3. Share with team if it's a common issue
```

### Celebrating Success

#### Review Performance Trends
- **Track token usage** to understand task complexity
- **Monitor duration** to identify optimization opportunities
- **Observe cost patterns** for budget planning
- **Analyze code changes** to measure productivity

#### Share Achievements
- **Screenshot milestone celebrations** for team sharing
- **Document successful approaches** for reuse
- **Celebrate learning milestones** with the team

## Troubleshooting

### Activity Log Issues

#### Log Not Appearing
1. **Enable verbose mode**: `/verbose`
2. **Check display mode**: Compact mode hides activity log
3. **Start a new task**: Some logs appear only during execution

#### Too Much Information
1. **Adjust filter level**: Set to "info" or "warn" to reduce noise
2. **Use search filter**: Type keywords to focus on specific content
3. **Switch to normal mode**: `/verbose` to toggle off

#### Navigation Not Working
1. **Check terminal focus**: Click in the terminal window
2. **Try different keys**: Some terminals handle arrow keys differently
3. **Use mouse**: Click on entries if keyboard navigation fails

### Error Display Issues

#### Missing Error Details
1. **Enable verbose mode**: For full stack traces
2. **Increase terminal width**: Wider terminals show more information
3. **Use retry**: Some errors provide more details on retry

#### Suggestions Not Helpful
1. **Try all priority levels**: Don't skip medium and low priority items
2. **Check error context**: Additional details may provide clues
3. **Enable activity log**: Verbose mode shows more debugging information

### Success Celebration Issues

#### Animation Not Playing
1. **Wait for completion**: Animations play after task finishes
2. **Check terminal capabilities**: Some terminals don't support all Unicode
3. **Terminal width**: Very narrow terminals may not show animations

#### Missing Metrics
1. **Ensure task completion**: Partial tasks may not show full metrics
2. **Check permissions**: Some metrics require file system access
3. **Try verbose mode**: Enhanced metrics in verbose display

## Related Features

- **[Display Modes](display-modes.md)**: Customize how output components are shown
- **[Input Preview](input-preview.md)**: Preview commands before execution
- **[Session Management](../sessions.md)**: Output and feedback work with session commands
- **[Agent Workflows](../agents.md)**: Component behavior during agent coordination
- **[Command Reference](../commands.md)**: Commands that trigger output and feedback

## Advanced Usage

### Custom Error Handling
```bash
# For persistent errors:
# 1. Enable verbose mode for detailed tracking
# 2. Document error patterns you encounter
# 3. Create custom solutions based on suggestions
# 4. Share solutions with your team
```

### Performance Optimization
```bash
# Use success metrics to optimize:
# 1. Track token usage patterns
# 2. Identify high-cost operations
# 3. Monitor duration trends
# 4. Optimize based on feedback data
```

### Debugging Complex Workflows
```bash
# For multi-agent workflows:
# 1. Enable verbose mode before starting
# 2. Monitor activity log for agent handoffs
# 3. Track error patterns across agents
# 4. Use success celebrations to confirm progress
```