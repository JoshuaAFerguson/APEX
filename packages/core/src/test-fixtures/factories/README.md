# Test Fixture Factories

This directory contains factory functions for creating test fixtures with sensible defaults. Factories help create consistent test data across the codebase.

## Available Factories

### Task Factory (`task-factory.ts`)

Creates `Task` fixtures with various configurations:

```typescript
import { createTask, TaskPresets } from '@apexcli/core/test-fixtures';

// Basic task with defaults
const task = createTask({
  description: 'My test task',
  autonomy: 'full-auto'
});

// Use presets for common scenarios
const completedTask = TaskPresets.basic.completed();
const highPriorityTask = TaskPresets.priorities.high();
```

### Tool Factory (`tool-factory.ts`)

Creates tool-related fixtures:

```typescript
import { createToolResult, ToolResponsePresets } from '@apexcli/core/test-fixtures';

// Basic tool result
const result = createToolResult({
  success: true,
  output: 'File contents...'
});

// Use presets for different tool types
const readResponse = ToolResponsePresets.filesystem.read.success();
```

### Autonomy Factory (`autonomy-factory.ts`)

Creates autonomy configuration fixtures for testing different automation levels:

```typescript
import {
  createAutonomyConfig,
  AutonomyPresets,
  createFullAutoConfig
} from '@apexcli/core/test-fixtures';

// Basic autonomy config
const config = createAutonomyConfig({
  level: 'review-before-commit'
});

// Full automation for testing
const autoConfig = createFullAutoConfig();

// Use presets for common scenarios
const restrictive = AutonomyPresets.resources.restrictive();
const permissive = AutonomyPresets.resources.permissive();
```

## Autonomy Factory Features

The autonomy factory provides comprehensive support for testing different automation scenarios:

### Basic Autonomy Levels

```typescript
// Create configs for all autonomy levels
const configs = createAutonomyLevelCollection();
// Returns: { 'full-auto': AutonomyConfig, 'review-before-commit': AutonomyConfig, ... }

// Specific level configs
const fullAuto = AutonomyPresets.basic.fullAuto();          // No approval gates
const reviewCommit = AutonomyPresets.basic.reviewBeforeCommit(); // 1 approval gate
const reviewAll = AutonomyPresets.basic.reviewAll();        // 3 approval gates
```

### Resource Constraints

```typescript
// Different resource limit scenarios
const testConfig = AutonomyPresets.resources.test();        // Quick limits for tests
const restrictive = AutonomyPresets.resources.restrictive(); // Low limits
const permissive = AutonomyPresets.resources.permissive();   // High limits
```

### Workflow Testing

```typescript
// Test different stages
const planning = AutonomyPresets.stages.planning();       // Planning stage config
const implementation = AutonomyPresets.stages.implementation(); // Implementation stage
const deployment = AutonomyPresets.stages.deployment();   // Deployment stage
```

### Agent-Specific Testing

```typescript
// Test different agent roles
const developer = AutonomyPresets.agents.developer();     // Developer constraints
const tester = AutonomyPresets.agents.tester();          // Tester permissions
const reviewer = AutonomyPresets.agents.reviewer();       // Review requirements
```

### A/B Testing Support

```typescript
// Create variant configs for testing
const variants = createAutonomyVariants();
// Returns: { control: AutonomyConfig, experimental: AutonomyConfig }

const controlTask = createTask({ autonomy: variants.control.level });
const experimentTask = createTask({ autonomy: variants.experimental.level });
```

## Factory Options

Most factories accept options to customize the generated fixtures:

```typescript
// Task factory options
const task = createTask({}, {
  status: 'completed',
  includeUsage: false,
  includeLogs: true
});

// Autonomy factory options
const config = createAutonomyConfig({}, {
  includeGates: true,
  includeLimits: true,
  includeStageOverrides: true,
  includeAgentOverrides: true,
  gateCount: 2
});
```

## Testing Scenarios

### Feature Development Workflow

```typescript
describe('Feature development workflow', () => {
  const featureConfig = createReviewBeforeCommitConfig({
    stageOverrides: {
      'planning': 'full-auto',
      'implementation': 'review-before-commit',
      'deployment': 'review-all'
    }
  });

  it('should handle each stage correctly', () => {
    const planningTask = createTask({
      autonomy: featureConfig.stageOverrides.planning
    });
    // Test planning automation...
  });
});
```

### Resource Limit Testing

```typescript
describe('Resource limits', () => {
  it('should respect cost limits', () => {
    const lowBudgetConfig = createAutonomyConfig({
      limits: { maxCost: 1.00 }
    });

    const task = createTask({ autonomy: lowBudgetConfig.level });
    // Test cost enforcement...
  });
});
```

### Error Scenarios

```typescript
describe('Error handling', () => {
  it('should handle approval timeouts', () => {
    const quickTimeoutConfig = createReviewAllConfig({
      approvalTimeout: 1 // 1 minute
    });

    // Test timeout behavior...
  });
});
```

## Best Practices

1. **Use presets** when possible for consistency
2. **Combine factories** for complex scenarios (task + autonomy configs)
3. **Override specific fields** only when testing those particular aspects
4. **Use meaningful test data** even in fixtures (helps with debugging)
5. **Leverage factory options** to reduce boilerplate in tests

## Examples in Tests

See the test files for comprehensive examples:

- `__tests__/autonomy-factory.test.ts` - Unit tests and API verification
- `__tests__/autonomy-factory-integration.test.ts` - Integration with other factories
- `__tests__/autonomy-factory-examples.test.ts` - Real-world usage patterns