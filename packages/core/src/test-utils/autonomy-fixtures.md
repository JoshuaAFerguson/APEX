# Autonomy Test Fixtures

This module provides comprehensive test fixtures and factory functions for creating autonomy level configurations in APEX tests.

## Overview

The autonomy fixtures module includes:
- Pre-built configurations for common autonomy scenarios
- Factory functions for creating custom configurations
- Utility functions for validation and testing
- Full APEX config creation with autonomy settings

## Quick Start

```typescript
import {
  AutonomyFixtures,
  createAutonomyConfig,
  createApexConfigWithAutonomy,
} from '@apexcli/core/test-utils';

// Use pre-built fixtures
const fullAutoConfig = AutonomyFixtures.fullAuto;
const reviewConfig = AutonomyFixtures.reviewBeforeCommit;

// Create custom configurations
const customConfig = createAutonomyConfig({
  level: 'full-auto',
  limits: { maxTokensPerTask: 1000000 }
});

// Create complete APEX config with autonomy
const apexConfig = createApexConfigWithAutonomy(
  { level: 'review-all' },
  { project: { name: 'my-test-project' } }
);
```

## Available Fixtures

### AutonomyFixtures.fullAuto
- Full automation with no approval gates
- High resource limits (1M tokens, $10 cost)
- Suitable for testing autonomous operations

### AutonomyFixtures.reviewBeforeCommit
- Requires approval before commits
- Moderate resource limits (500K tokens, $5 cost)
- Standard review workflow testing

### AutonomyFixtures.reviewAll
- Requires approval for all actions
- Conservative resource limits (250K tokens, $2.5 cost)
- Strict oversight testing

### AutonomyFixtures.semiAutoWithStageOverrides
- Different autonomy levels per stage
- Planning: full-auto, Implementation: review-before-commit, Testing: review-all
- Tests stage-specific behavior

### AutonomyFixtures.withAgentOverrides
- Agent-specific autonomy overrides
- Developer: full-auto, Tester: review-all with custom timeout, Reviewer: review-before-commit
- Tests agent-specific behavior

### AutonomyFixtures.comprehensiveGates
- Complete set of approval gates
- Planning, code changes, commits, and deployment gates
- Tests comprehensive approval workflows

## Factory Functions

### createAutonomyConfig(overrides?)
Creates an autonomy configuration with sensible defaults and optional overrides.

```typescript
const config = createAutonomyConfig({
  level: 'full-auto',
  rejectionBehavior: 'skip',
  limits: { maxTokensPerTask: 750000 },
  stageOverrides: { testing: 'review-all' }
});
```

### createApprovalGate(overrides?)
Creates an approval gate configuration for testing.

```typescript
const gate = createApprovalGate({
  type: 'deployment',
  description: 'Review before deploy',
  required: true,
  stage: 'deployment'
});
```

### createTaskResourceLimits(overrides?)
Creates task resource limits for testing.

```typescript
const limits = createTaskResourceLimits({
  maxTokensPerTask: 1000000,
  maxCostPerTask: 10.0,
  timeoutMinutes: 60
});
```

### createAgentAutonomyOverride(overrides?)
Creates agent-specific autonomy overrides.

```typescript
const override = createAgentAutonomyOverride({
  level: 'review-all',
  approvalTimeout: 30,
  rejectionBehavior: 'skip'
});
```

### createApexConfigWithAutonomy(autonomyConfig?, configOverrides?)
Creates a complete APEX configuration with autonomy settings.

```typescript
const config = createApexConfigWithAutonomy(
  { level: 'full-auto' },  // autonomy config
  { project: { name: 'test-project' } }  // other config overrides
);
```

## Utility Functions

### getAutonomyConfigVariations()
Returns a set of different autonomy configurations for comprehensive testing.

```typescript
const variations = getAutonomyConfigVariations();
Object.values(variations).forEach(config => {
  // Test each configuration
  expect(isValidAutonomyConfig(config)).toBe(true);
});
```

### isValidAutonomyConfig(config)
Basic validation utility for autonomy configurations.

```typescript
if (isValidAutonomyConfig(someConfig)) {
  // Config has valid structure
}
```

## Common Test Patterns

### Testing Different Autonomy Levels
```typescript
describe('Feature with different autonomy levels', () => {
  const levels = ['full-auto', 'review-before-commit', 'review-all'];

  levels.forEach(level => {
    it(`should work with ${level}`, () => {
      const config = createAutonomyConfig({ level });
      // Test feature with this config
    });
  });
});
```

### Testing with Pre-built Fixtures
```typescript
describe('Feature with common configurations', () => {
  const fixtures = [
    AutonomyFixtures.fullAuto,
    AutonomyFixtures.reviewBeforeCommit,
    AutonomyFixtures.reviewAll
  ];

  fixtures.forEach((fixture, index) => {
    it(`should work with fixture ${index}`, () => {
      // Test feature with fixture
    });
  });
});
```

### Integration Testing
```typescript
describe('Full workflow integration', () => {
  it('should handle complete APEX config', () => {
    const config = createApexConfigWithAutonomy(
      { level: 'review-before-commit' },
      { project: { name: 'integration-test' } }
    );

    // Test complete workflow with this config
    expect(config.autonomy.level).toBe('review-before-commit');
    expect(config.project.name).toBe('integration-test');
  });
});
```

## Schema Validation

All factory functions create objects that pass Zod schema validation:

```typescript
import { AutonomyConfigSchema, ApexConfigSchema } from '@apexcli/core';

// These should all pass validation
expect(() => AutonomyConfigSchema.parse(AutonomyFixtures.fullAuto)).not.toThrow();
expect(() => AutonomyConfigSchema.parse(createAutonomyConfig())).not.toThrow();
expect(() => ApexConfigSchema.parse(createApexConfigWithAutonomy())).not.toThrow();
```

## Best Practices

1. **Use fixtures for common scenarios**: Leverage pre-built fixtures for standard test cases
2. **Use factories for custom scenarios**: Create specific configurations when testing edge cases
3. **Validate with schemas**: Always validate generated configs with Zod schemas in tests
4. **Test all autonomy levels**: Ensure your features work across all autonomy levels
5. **Test overrides**: Verify stage and agent overrides work correctly

## Type Safety

All fixtures and factory functions are fully typed with TypeScript, providing:
- IntelliSense support in IDEs
- Compile-time type checking
- Runtime type safety with Zod validation
- Autocompletion for configuration options