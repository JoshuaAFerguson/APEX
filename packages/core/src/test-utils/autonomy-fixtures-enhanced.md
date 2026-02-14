# Enhanced Autonomy Test Fixtures

This module provides enhanced test fixtures and mock factories for autonomy level configurations with intuitive naming and comprehensive test scenarios.

## Overview

The enhanced autonomy fixtures extend the existing autonomy testing infrastructure to provide:

- **Intuitive naming** that matches acceptance criteria terminology (e.g., `semi-auto`, `manual`)
- **Comprehensive factory functions** for different testing scenarios
- **Full compatibility** with existing autonomy fixtures
- **Type-safe** configuration generation with proper validation

## Quick Start

```typescript
import {
  AutonomyFixturesEnhanced,
  createSemiAutoConfig,
  createManualConfig,
  getAllAutonomyConfigVariations
} from '@apex/core/test-utils';

// Use pre-built fixtures
const semiAutoConfig = AutonomyFixturesEnhanced.semiAuto();
const manualConfig = AutonomyFixturesEnhanced.manual();

// Use factory functions with customization
const customSemiAuto = createSemiAutoConfig({
  approvalTimeout: 60,
  limits: { maxCostPerTask: 2.0 }
});

// Get all variations for comprehensive testing
const allVariations = getAllAutonomyConfigVariations();
```

## Available Fixture Types

### Basic Autonomy Levels

#### `AutonomyFixturesEnhanced.fullAuto()`
- **Autonomy Level**: `full-auto`
- **Gates**: None
- **Use Case**: Complete automation without human intervention
- **Resource Limits**: High (suitable for autonomous operation)

```typescript
const config = AutonomyFixturesEnhanced.fullAuto();
// Creates: level: 'full-auto', gates: [], high limits
```

#### `AutonomyFixturesEnhanced.semiAuto()`
- **Autonomy Level**: `review-before-commit`
- **Gates**: Commit review gate
- **Use Case**: Autonomous operation with review checkpoints
- **Resource Limits**: Moderate

```typescript
const config = AutonomyFixturesEnhanced.semiAuto();
// Creates: level: 'review-before-commit', commit gate, moderate limits
```

#### `AutonomyFixturesEnhanced.manual()`
- **Autonomy Level**: `review-all`
- **Gates**: All major decision points (planning, code changes, commits, deployment)
- **Use Case**: Maximum human oversight
- **Resource Limits**: Conservative

```typescript
const config = AutonomyFixturesEnhanced.manual();
// Creates: level: 'review-all', all gates, conservative limits
```

### Advanced Configurations

#### `AutonomyFixturesEnhanced.supervised()`
- **Use Case**: Mixed autonomy with stage-specific controls
- **Features**: Different autonomy levels per workflow stage
- **Stage Overrides**: Planning (auto), Implementation (semi), Testing (auto), Deployment (manual)

```typescript
const config = AutonomyFixturesEnhanced.supervised();
// Creates mixed autonomy with intelligent stage-specific controls
```

#### `AutonomyFixturesEnhanced.restrictive()`
- **Use Case**: High security or sensitive environments
- **Features**: Maximum oversight with tight resource constraints
- **All Gates**: Required with strict enforcement

#### `AutonomyFixturesEnhanced.permissive()`
- **Use Case**: Trusted environments with minimal oversight
- **Features**: High autonomy with generous resource limits
- **Minimal Gates**: Only deployment requires review

### Testing-Specific Configurations

#### `createTestingAutonomyConfig(scenario)`

Create autonomy configs optimized for different testing scenarios:

```typescript
// Fast test execution
const fastConfig = createTestingAutonomyConfig('fast', {
  // Low resource limits, full automation
});

// Comprehensive testing
const comprehensiveConfig = createTestingAutonomyConfig('comprehensive', {
  // All gates enabled, moderate limits
});

// Minimal testing
const minimalConfig = createTestingAutonomyConfig('minimal', {
  // Absolute minimum settings
});

// Isolated testing
const isolatedConfig = createTestingAutonomyConfig('isolated', {
  // Safe for parallel test execution
});
```

## Factory Functions

### Basic Factories

All factory functions accept an optional overrides parameter for customization:

```typescript
// Create with defaults
const semiAuto = createSemiAutoConfig();

// Create with customization
const customSemiAuto = createSemiAutoConfig({
  rejectionBehavior: 'skip',
  limits: { maxCostPerTask: 3.0 },
  stageOverrides: { testing: 'full-auto' }
});
```

### Available Factory Functions

| Function | Base Level | Gates | Use Case |
|----------|------------|-------|----------|
| `createFullAutoConfig()` | `full-auto` | None | Complete automation |
| `createSemiAutoConfig()` | `review-before-commit` | Commit | Supervised automation |
| `createManualConfig()` | `review-all` | All | Maximum oversight |
| `createSupervisedConfig()` | `review-before-commit` | Mixed | Stage-specific control |
| `createRestrictiveConfig()` | `review-all` | All + Strict | High security |
| `createPermissiveConfig()` | `full-auto` | Minimal | Trusted environment |

### Complete APEX Configuration

Create full APEX configurations with autonomy settings:

```typescript
const apexConfig = createApexConfigWithEnhancedAutonomy('semi-auto', {
  project: { name: 'my-project' },
  api: { port: 4000 }
});
```

## Testing Utilities

### Get All Variations

For comprehensive testing across all autonomy levels:

```typescript
const allVariations = getAllAutonomyConfigVariations();

// Test with all variations
Object.entries(allVariations).forEach(([name, config]) => {
  it(`should work with ${name} autonomy`, () => {
    // Test your functionality with this config
    const result = myFunction(config);
    expect(result).toBeDefined();
  });
});
```

### A/B Testing Configurations

Create configurations for testing different autonomy approaches:

```typescript
const { controlGroup, testGroupA, testGroupB } = createAutonomyABTestConfigs();

// Use in A/B tests to compare autonomy levels
```

### Validation

Validate autonomy configurations in tests:

```typescript
import { validateEnhancedAutonomyConfig } from '@apex/core/test-utils';

it('should create valid autonomy config', () => {
  const config = createSemiAutoConfig();
  expect(validateEnhancedAutonomyConfig(config)).toBe(true);
});
```

## Advanced Usage Patterns

### Test Suites with Multiple Autonomy Levels

```typescript
describe('Feature X', () => {
  const autonomyLevels = ['fullAuto', 'semiAuto', 'manual'] as const;

  autonomyLevels.forEach(level => {
    describe(`with ${level} autonomy`, () => {
      let config: AutonomyConfig;

      beforeEach(() => {
        config = AutonomyFixturesEnhanced[level]();
      });

      it('should handle the feature correctly', () => {
        // Test with this specific autonomy level
        const result = processWithAutonomy(config);
        expect(result.status).toBe('success');
      });
    });
  });
});
```

### Custom Autonomy Scenarios

```typescript
// Create scenario-specific configurations
const scenarios = {
  productionDeployment: createManualConfig({
    stageOverrides: { deployment: 'review-all' },
    limits: { maxCostPerTask: 50.0 }
  }),

  featureDevelopment: createSemiAutoConfig({
    stageOverrides: {
      planning: 'full-auto',
      implementation: 'review-before-commit',
      testing: 'full-auto'
    }
  }),

  emergencyHotfix: createSupervisedConfig({
    limits: { timeoutMinutes: 15 },
    rejectionBehavior: 'abort'
  })
};
```

### Integration with Existing Fixtures

The enhanced fixtures work alongside existing autonomy fixtures:

```typescript
import { AutonomyFixtures } from '@apex/core/test-utils';
import { AutonomyFixturesEnhanced } from '@apex/core/test-utils';

// Mix and match as needed
const existingConfig = AutonomyFixtures.reviewBeforeCommit;
const enhancedConfig = AutonomyFixturesEnhanced.semiAuto();

// Both are compatible and interchangeable
```

## Best Practices

### 1. Use Descriptive Names
```typescript
// Good: Clear intent
const deploymentConfig = createManualConfig();
const developmentConfig = createSemiAutoConfig();

// Avoid: Generic names
const config1 = createManualConfig();
const config2 = createSemiAutoConfig();
```

### 2. Test Multiple Autonomy Levels
```typescript
// Test critical functionality across autonomy levels
describe('critical feature', () => {
  const configs = getAllAutonomyConfigVariations();

  Object.entries(configs).forEach(([name, config]) => {
    it(`should work with ${name}`, () => {
      expect(() => criticalFeature(config)).not.toThrow();
    });
  });
});
```

### 3. Use Appropriate Test Configs
```typescript
// For unit tests: fast, minimal configs
const config = createTestingAutonomyConfig('fast');

// For integration tests: comprehensive configs
const config = createTestingAutonomyConfig('comprehensive');

// For load tests: isolated configs
const config = createTestingAutonomyConfig('isolated');
```

### 4. Validate Configurations
```typescript
// Always validate generated configs in tests
it('should create valid config', () => {
  const config = createCustomConfig();
  expect(validateEnhancedAutonomyConfig(config)).toBe(true);
});
```

## Migration from Existing Fixtures

If you're using existing autonomy fixtures, you can gradually migrate:

```typescript
// Before
import { AutonomyFixtures } from '@apex/core/test-utils';
const config = AutonomyFixtures.reviewBeforeCommit;

// After (enhanced naming)
import { AutonomyFixturesEnhanced } from '@apex/core/test-utils';
const config = AutonomyFixturesEnhanced.semiAuto();

// Both produce equivalent configurations
```

## Type Safety

All enhanced fixtures maintain full type safety:

```typescript
// TypeScript will enforce valid autonomy levels
const config: AutonomyConfig = createSemiAutoConfig({
  level: 'invalid-level' // ❌ TypeScript error
});

// And valid rejection behaviors
const config2 = createManualConfig({
  rejectionBehavior: 'invalid' // ❌ TypeScript error
});
```

## Integration Examples

### With Jest/Vitest

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createSemiAutoConfig } from '@apex/core/test-utils';

describe('autonomy integration', () => {
  let autonomyConfig: AutonomyConfig;

  beforeEach(() => {
    autonomyConfig = createSemiAutoConfig();
  });

  it('should integrate with workflow', () => {
    const workflow = new Workflow(autonomyConfig);
    expect(workflow.autonomyLevel).toBe('review-before-commit');
  });
});
```

### With Test Runners

```typescript
// Create parameterized tests
const testCases = getAllAutonomyConfigVariations();

Object.entries(testCases).forEach(([name, config]) => {
  test(`workflow handles ${name} autonomy`, () => {
    const result = executeWorkflow(config);
    expect(result.success).toBe(true);
  });
});
```