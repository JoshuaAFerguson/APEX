# Autonomy Controls

## Overview

APEX's autonomy controls provide intelligent resource management and safety mechanisms to prevent runaway tasks while enabling efficient automation. The system includes budget limits, token limits, time limits, change limits, and configurable approval gates.

## Core Concepts

### Autonomy Levels

**Full Autonomous**
- No human intervention required
- All operations proceed automatically
- Resource limits still enforced
- Best for trusted, well-defined tasks

**Supervised**
- Automatic operation with approval gates
- Human approval required at checkpoints
- Resource monitoring with warnings
- Best for complex or sensitive tasks

**Manual**
- Human approval required for each significant operation
- Real-time monitoring and control
- Conservative resource limits
- Best for exploratory or high-risk tasks

## Resource Limits

### Budget Limits

Control API costs to prevent unexpected charges:

```yaml
# .apex/config.yaml
autonomy:
  limits:
    budgetLimit: 25.0           # Maximum spend in USD
    warningThreshold: 0.8       # Warn at 80% ($20.00)
```

**Behaviors:**
- Task pauses when budget limit reached
- Warnings emitted at threshold percentage
- Cost tracking includes input/output tokens
- Real-time budget monitoring in dashboard

### Token Limits

Prevent excessive token consumption:

```yaml
autonomy:
  limits:
    tokenLimit: 150000          # Maximum total tokens
    inputTokenLimit: 100000     # Maximum input tokens
    outputTokenLimit: 50000     # Maximum output tokens
    warningThreshold: 0.9       # Warn at 90%
```

**Behaviors:**
- Separate tracking for input and output tokens
- Context window management
- Automatic conversation pruning when approaching limits
- Token usage optimization suggestions

### Time Limits

Control maximum task duration:

```yaml
autonomy:
  limits:
    timeLimit: 7200000          # 2 hours in milliseconds
    idleTimeout: 300000         # 5 minutes idle timeout
    warningThreshold: 0.75      # Warn at 75% time elapsed
```

**Behaviors:**
- Tasks pause when time limit reached
- Idle detection stops inactive tasks
- Checkpointing for task resumption
- Progress tracking and time estimation

### Change Limits

Limit scope of modifications:

```yaml
autonomy:
  limits:
    changeLimit:
      files: 50                 # Maximum files modified
      lines: 2000               # Maximum lines changed
      operations: 100           # Maximum tool operations
    warningThreshold: 0.8       # Warn at 80%
```

**Behaviors:**
- Cumulative tracking across all modifications
- Line-level change detection
- Tool operation counting
- Intelligent batching of related changes

## Approval Gates

### Configuration

```yaml
autonomy:
  approvalGates:
    - budget                    # Approval before budget limit
    - changes                   # Approval before change limit
    - dangerous                 # Approval for dangerous operations
    - external                  # Approval for external API calls
    - sensitive                 # Approval for sensitive file access

  approvalRules:
    budget:
      threshold: 0.9            # Trigger at 90% of budget
      urgency: medium
      timeout: 3600000          # 1 hour timeout

    dangerous:
      operations:
        - bash:rm               # Dangerous bash commands
        - browser:evaluate      # JavaScript execution
        - file:delete           # File deletions
      urgency: high
      timeout: 300000           # 5 minute timeout
```

### Dynamic Approval Gates

```typescript
// Register custom approval gate
apex.autonomy.registerApprovalGate({
  id: 'database-operations',
  name: 'Database Operations',
  description: 'Approval required for database modifications',
  condition: async (context) => {
    return context.tools.some(tool =>
      tool.name.includes('database') && tool.operation === 'write'
    );
  },
  urgency: 'high',
  timeout: 600000  // 10 minutes
});

// Check if approval is required
const approvalRequired = await apex.autonomy.checkApprovalRequired({
  context: taskContext,
  estimatedCost: 2.5,
  estimatedTokens: 10000,
  operations: ['file:write', 'bash:test']
});

if (approvalRequired.required) {
  console.log(`Approval needed for: ${approvalRequired.reasons.join(', ')}`);
}
```

## Configuration Examples

### Development Environment

```yaml
# .apex/config.yaml - Development
autonomy:
  enabled: true
  level: autonomous

  limits:
    budgetLimit: 10.0          # Lower budget for dev
    tokenLimit: 100000         # Reasonable token limit
    timeLimit: 3600000         # 1 hour max
    changeLimit:
      files: 20                # Moderate file changes
      lines: 1000              # Moderate line changes

  warningThreshold: 0.8        # Early warnings

  approvalGates:
    - budget                   # Budget approval
    - dangerous                # Dangerous ops only

  monitoring:
    enabled: true
    dashboard: true
    notifications: false       # Quiet dev environment
```

### Production Environment

```yaml
# .apex/config.yaml - Production
autonomy:
  enabled: true
  level: supervised           # More cautious

  limits:
    budgetLimit: 50.0          # Higher budget for prod tasks
    tokenLimit: 200000         # Higher token limit
    timeLimit: 14400000        # 4 hours max
    changeLimit:
      files: 100               # Allow larger changes
      lines: 5000              # Allow substantial modifications

  warningThreshold: 0.7        # Earlier warnings

  approvalGates:
    - budget                   # All gates enabled
    - changes
    - dangerous
    - external
    - sensitive

  monitoring:
    enabled: true
    dashboard: true
    notifications: true        # Active monitoring
    alerting: true             # Critical alerts
```

### Experimental Environment

```yaml
# .apex/config.yaml - Experimental
autonomy:
  enabled: true
  level: manual               # Maximum oversight

  limits:
    budgetLimit: 5.0           # Very conservative
    tokenLimit: 25000          # Limited tokens
    timeLimit: 1800000         # 30 minutes max
    changeLimit:
      files: 5                 # Minimal changes
      lines: 200               # Small modifications

  warningThreshold: 0.5        # Early warnings

  approvalGates:
    - budget
    - changes
    - dangerous
    - external
    - sensitive
    - experimental             # Custom gate for experiments

  monitoring:
    enabled: true
    dashboard: true
    verbose: true              # Detailed logging
    recordAll: true            # Record everything
```

## Usage Examples

### Monitoring Resource Usage

```typescript
// Get current resource usage
const usage = await apex.autonomy.getResourceUsage();
console.log(`Budget used: $${usage.budget.used} / $${usage.budget.limit}`);
console.log(`Tokens used: ${usage.tokens.used} / ${usage.tokens.limit}`);
console.log(`Time elapsed: ${usage.time.elapsed}ms / ${usage.time.limit}ms`);
console.log(`Files changed: ${usage.changes.files} / ${usage.changes.limit.files}`);

// Check if approaching limits
if (usage.budget.percentage > 0.8) {
  console.warn('Approaching budget limit!');
}

// Get detailed breakdown
const breakdown = await apex.autonomy.getUsageBreakdown();
console.log('Token usage by agent:', breakdown.tokens.byAgent);
console.log('Budget usage by operation:', breakdown.budget.byOperation);
```

### Setting Dynamic Limits

```typescript
// Adjust limits based on task complexity
const taskComplexity = await apex.tasks.analyzeComplexity(taskDescription);

const dynamicLimits = {
  budgetLimit: taskComplexity.estimatedCost * 1.5,
  tokenLimit: taskComplexity.estimatedTokens * 1.2,
  timeLimit: taskComplexity.estimatedDuration * 1.3,
  changeLimit: {
    files: Math.max(10, taskComplexity.estimatedFiles * 2),
    lines: Math.max(500, taskComplexity.estimatedLines * 2)
  }
};

await apex.autonomy.updateLimits(dynamicLimits);
```

### Handling Limit Exceeded Events

```typescript
// Listen for limit warnings
apex.autonomy.on('limit:warning', async (event) => {
  console.warn(`Warning: ${event.limit} at ${event.percentage}%`);

  if (event.limit === 'budget' && event.percentage > 0.9) {
    // Pause task for review
    await apex.tasks.pauseCurrentTask({
      reason: 'Budget limit approaching',
      approvalRequired: true
    });
  }
});

// Listen for limit exceeded events
apex.autonomy.on('limit:exceeded', async (event) => {
  console.error(`Limit exceeded: ${event.limit}`);

  // Automatically save progress and pause
  await apex.tasks.saveCheckpoint();
  await apex.tasks.pauseCurrentTask({
    reason: `${event.limit} limit exceeded`,
    approvalRequired: true,
    resumable: true
  });
});
```

### Approval Gate Management

```typescript
// Request approval for sensitive operation
const approval = await apex.autonomy.requestApproval({
  operation: 'database-modification',
  description: 'Update user permissions table',
  urgency: 'high',
  context: {
    tables: ['users', 'permissions'],
    estimatedRows: 1500,
    backupAvailable: true
  }
});

if (approval.granted) {
  console.log('Approval granted, proceeding with operation');
  await performDatabaseOperation();
} else {
  console.log(`Approval denied: ${approval.reason}`);
}

// Check pending approvals
const pendingApprovals = await apex.autonomy.getPendingApprovals();
console.log(`${pendingApprovals.length} approvals pending`);

// Approve pending request
await apex.autonomy.approve(approvalId, {
  granted: true,
  note: 'Approved after security review'
});
```

## Advanced Features

### Adaptive Limits

```typescript
// Enable adaptive limit adjustment based on task success
apex.autonomy.enableAdaptiveLimits({
  enabled: true,
  learningRate: 0.1,
  factors: {
    taskSuccessRate: 0.4,      // Weight of task success
    resourceEfficiency: 0.3,   // Weight of resource usage
    errorRate: 0.3            // Weight of error frequency
  }
});

// Adaptive limits will automatically adjust based on:
// - Historical task performance
// - Resource utilization patterns
// - Error rates and recovery success
// - User feedback and manual adjustments
```

### Resource Forecasting

```typescript
// Get resource usage forecast
const forecast = await apex.autonomy.forecastResourceUsage({
  taskDescription: 'Implement authentication system',
  horizon: 3600000,  // 1 hour forecast
  confidence: 0.8    // 80% confidence level
});

console.log('Forecasted usage:');
console.log(`Budget: $${forecast.budget.estimated} ± $${forecast.budget.margin}`);
console.log(`Tokens: ${forecast.tokens.estimated} ± ${forecast.tokens.margin}`);
console.log(`Files: ${forecast.changes.files} ± ${forecast.changes.filesMargin}`);

// Use forecast to adjust limits preemptively
if (forecast.budget.estimated > currentLimits.budgetLimit) {
  console.warn('Task may exceed budget limit');
  await requestBudgetIncrease(forecast.budget.estimated * 1.2);
}
```

### Custom Resource Monitors

```typescript
// Register custom resource monitor
apex.autonomy.registerResourceMonitor({
  id: 'api-calls',
  name: 'External API Calls',
  description: 'Monitor external API usage',

  measure: async () => {
    const apiCallCount = await getExternalApiCallCount();
    return {
      value: apiCallCount,
      unit: 'calls',
      timestamp: Date.now()
    };
  },

  limit: {
    value: 100,
    warningThreshold: 0.8,
    resetPeriod: 3600000  // 1 hour
  },

  onWarning: async (usage) => {
    console.warn(`API call usage at ${usage.percentage}%`);
  },

  onExceeded: async (usage) => {
    await pauseTaskForApiLimitExceeded();
  }
});
```

## CLI Commands

### Status and Monitoring

```bash
# Check current autonomy status
apex autonomy status

# View resource usage
apex autonomy usage

# Show resource limits
apex autonomy limits

# View usage history
apex autonomy history --period 7d
```

### Limit Management

```bash
# Update budget limit
apex autonomy set-limit budget 50.0

# Update token limit
apex autonomy set-limit tokens 200000

# Update time limit (in hours)
apex autonomy set-limit time 4h

# Reset all limits to defaults
apex autonomy reset-limits
```

### Approval Management

```bash
# List pending approvals
apex autonomy approvals

# Approve specific request
apex autonomy approve <approval-id>

# Deny specific request
apex autonomy deny <approval-id> --reason "Security concern"

# View approval history
apex autonomy approvals --history
```

## Dashboard and Monitoring

### Real-time Monitoring

```typescript
// Enable real-time monitoring dashboard
const dashboard = apex.autonomy.createDashboard({
  updateInterval: 5000,  // Update every 5 seconds
  metrics: [
    'budget',
    'tokens',
    'time',
    'changes',
    'api-calls'
  ],
  alerts: true,
  historical: true
});

await dashboard.start();
```

### Usage Analytics

```typescript
// Generate usage analytics report
const analytics = await apex.autonomy.generateAnalytics({
  period: '30d',
  metrics: ['all'],
  groupBy: ['task', 'agent', 'date']
});

console.log('Top resource consuming tasks:');
analytics.tasks.byBudgetUsage.slice(0, 5).forEach((task, i) => {
  console.log(`${i+1}. ${task.description}: $${task.budgetUsed}`);
});

console.log('Agent efficiency:');
analytics.agents.byEfficiency.forEach(agent => {
  console.log(`${agent.name}: ${agent.successRate}% success, $${agent.avgCost}/task`);
});
```

## Best Practices

### 1. Start Conservative

```yaml
# Begin with conservative limits and adjust based on experience
autonomy:
  limits:
    budgetLimit: 5.0           # Start small
    tokenLimit: 25000          # Conservative token usage
    timeLimit: 1800000         # 30 minutes max initially
    changeLimit:
      files: 10                # Limit scope of changes
      lines: 500
```

### 2. Use Warning Thresholds

```yaml
# Set early warning thresholds to prevent hard stops
autonomy:
  warningThreshold: 0.75       # Warn at 75%
  warningActions:
    - notify                   # Send notifications
    - checkpoint               # Save progress
    - optimize                 # Trigger optimizations
```

### 3. Implement Graceful Degradation

```typescript
// Implement graceful degradation when approaching limits
apex.autonomy.on('limit:warning', async (event) => {
  if (event.limit === 'tokens' && event.percentage > 0.9) {
    // Switch to more efficient mode
    await apex.config.set('agents.mode', 'efficient');
    await apex.config.set('output.verbosity', 'minimal');
  }

  if (event.limit === 'budget' && event.percentage > 0.8) {
    // Use smaller, less expensive models
    await apex.config.set('models.primary', 'haiku');
    await apex.config.set('models.fallback', 'haiku');
  }
});
```

### 4. Regular Limit Review

```bash
# Schedule regular limit reviews
# Run weekly to adjust based on usage patterns
apex autonomy analyze-usage --period 7d --suggest-limits
```

## Troubleshooting

### Common Issues

**Task Stuck at Approval Gate:**
```bash
# Check pending approvals
apex autonomy approvals

# Check approval timeout settings
apex config get autonomy.approvalRules.*.timeout

# Extend timeout if needed
apex autonomy extend-timeout <approval-id> 1h
```

**Unexpected Limit Exceeded:**
```bash
# Check what caused limit to be exceeded
apex autonomy usage --breakdown

# Review resource usage history
apex autonomy history --limit budget --period 1h

# Adjust limits if appropriate
apex autonomy set-limit budget 25.0
```

**Resource Usage Higher Than Expected:**
```bash
# Analyze resource usage patterns
apex autonomy analyze --verbose

# Check for inefficient operations
apex autonomy optimize-suggestions

# Review agent configuration
apex config get agents.*.resourceUsage
```

For more examples and configuration patterns, see:
- [Autonomy Controls Examples](./examples/autonomy-controls/)
- [Resource Optimization Patterns](./examples/resource-optimization/)
- [Production Configurations](./examples/production-configs/)