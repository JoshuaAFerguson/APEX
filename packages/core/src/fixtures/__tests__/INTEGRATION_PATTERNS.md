# Integration Test Patterns Documentation

This document explains the usage patterns demonstrated in the integration tests for future developers working with APEX marketplace fixtures.

## Overview

The APEX fixture system provides three main patterns for testing:

1. **Base Marketplace Fixtures** - Core reusable entities
2. **Marketplace Scenarios** - Real-world testing scenarios
3. **Factory Functions** - Dynamic fixture creation

## Pattern 1: Base Marketplace Fixtures

### What They Are
Base fixtures provide core, stable entities that represent standard MCP (Model Context Protocol) marketplace components.

### When to Use
- For standard test scenarios requiring consistent data
- When testing core functionality that doesn't need scenario-specific variations
- As building blocks for custom test fixtures

### Key Components
```typescript
import {
  baseMarketplaceEntries,    // Pre-built marketplace entries
  baseServerConfigs,         // Server configurations
  baseMarketplaceSources,    // Marketplace source definitions
  baseMarketplaces,          // Complete marketplace objects
} from '@apexcli/core/fixtures';
```

### Usage Examples

#### Basic Usage
```typescript
// Get a standard filesystem server entry
const filesystemEntry = baseMarketplaceEntries.filesystem;
expect(filesystemEntry.verified).toBe(true);
expect(filesystemEntry.capabilities).toContain('tools');
```

#### Customization with Utility Functions
```typescript
// Create a custom variant of a base fixture
const customEntry = createMarketplaceEntry(baseMarketplaceEntries.filesystem, {
  name: 'custom-filesystem',
  verified: false,
  description: 'Custom filesystem server for testing',
});
```

#### Filtering and Querying
```typescript
// Get all verified entries
const verifiedEntries = getVerifiedEntries();

// Get entries by capability
const toolsEntries = getEntriesByCapability('tools');
const resourcesEntries = getEntriesByCapability('resources');
```

### Best Practices
- Use base fixtures for consistent, repeatable tests
- Customize using utility functions rather than direct modification
- Leverage filtering functions for test data selection
- Always validate fixture integrity in your tests

## Pattern 2: Marketplace Scenarios

### What They Are
Scenario fixtures provide complete marketplace states that represent real-world situations your application might encounter.

### When to Use
- For integration testing of complete marketplace workflows
- When testing behavior across different marketplace states
- For validating handling of edge cases (empty, deprecated, unverified)

### Available Scenarios
```typescript
import {
  emptyMarketplace,           // No servers available
  singleServerMarketplace,    // One server only
  multiServerMarketplace,     // Multiple servers with mixed states
  developmentMarketplace,     // Unverified/experimental servers
  enterpriseMarketplace,      // Private enterprise servers
} from '@apexcli/core/fixtures/marketplace-scenarios';
```

### Usage Examples

#### Testing Different Marketplace States
```typescript
// Test empty state handling
expect(emptyMarketplace.servers).toHaveLength(0);

// Test single server scenario
expect(singleServerMarketplace.servers).toHaveLength(1);
expect(singleServerMarketplace.servers[0].verified).toBe(true);

// Test complex multi-server scenario
const verified = multiServerMarketplace.servers.filter(s => s.verified);
const unverified = multiServerMarketplace.servers.filter(s => !s.verified);
expect(verified.length).toBeGreaterThan(0);
expect(unverified.length).toBeGreaterThan(0);
```

#### Cross-Scenario Analysis
```typescript
// Analyze patterns across all scenarios
const allVerified = getAllVerifiedEntries();
const allUnverified = getAllUnverifiedEntries();

// Get servers by configuration type
const httpServers = getEntriesByConfigType('http');
const stdioServers = getEntriesByConfigType('stdio');

// Find servers with environment configuration
const envServers = getEntriesWithEnvironment();
```

#### Custom Scenario Creation
```typescript
// Create a filtered scenario for specific testing needs
const verifiedOnlyScenario = createScenario({
  verified: true,
  name: 'Production Ready Registry',
  description: 'Only verified servers for production testing',
});

// Create scenario with specific configuration requirements
const httpOnlyScenario = createScenario({
  configType: 'http',
  hasEnvironment: true,
  name: 'HTTP Servers with Environment',
});
```

### Best Practices
- Use scenarios to test realistic marketplace states
- Combine scenarios with custom filtering for specific test needs
- Test edge cases using empty and single-server scenarios
- Validate your application's behavior across all scenario types

## Pattern 3: Factory Functions and Presets

### What They Are
Factory functions provide dynamic fixture creation with customization options, ensuring test isolation through unique instances.

### When to Use
- When you need unique test data for each test case
- For testing with specific custom configurations
- When base fixtures or scenarios don't meet your exact needs
- For ensuring proper test isolation

### Available Factories
```typescript
import {
  createMCPServerConfig,      // Create server configurations
  createMCPServer,           // Create server definitions
  createMCPMarketplaceEntry, // Create marketplace entries
  MCPServerPresets,          // Pre-configured factory presets
} from '@apexcli/core/fixtures';
```

### Usage Examples

#### Basic Factory Usage
```typescript
// Create unique server config for test isolation
const customConfig = createMCPServerConfig({
  name: 'test-specific-server',
  autoStart: true,
}, {
  type: 'http',
  includeEnv: true,
});

// Each call creates a unique instance
const config1 = createMCPServerConfig();
const config2 = createMCPServerConfig();
expect(config1.name).not.toBe(config2.name); // Guaranteed uniqueness
```

#### Using Presets for Common Scenarios
```typescript
// Use presets for standard configurations
const filesystemServer = MCPServerPresets.basic.filesystem();
const httpConfig = MCPServerPresets.configs.http();
const verifiedEntry = MCPServerPresets.marketplace.verified();

// Presets provide sensible defaults while maintaining uniqueness
expect(filesystemServer.name).toBe('filesystem-server');
expect(httpConfig.type).toBe('http');
expect(verifiedEntry.verified).toBe(true);
```

#### Advanced Factory Configuration
```typescript
// Create complex marketplace entry with full customization
const complexEntry = createMCPMarketplaceEntry({
  name: 'ai-analysis-server',
  description: 'Advanced AI analysis with GPU acceleration',
  capabilities: ['tools', 'resources', 'prompts'],
}, {
  verified: true,
  includeCapabilities: true,
});

// Factory ensures proper structure and type safety
expect(complexEntry.serverConfig).toBeDefined();
expect(complexEntry.serverConfig.type).toBeDefined();
```

### Best Practices
- Use factories when you need unique instances for test isolation
- Leverage presets for common configurations
- Combine factory options with custom overrides for specific needs
- Always track created fixtures in test state for proper cleanup

## Test Setup and Teardown Patterns

### Setup Pattern
```typescript
beforeEach(() => {
  testState = {
    createdEntries: [],
    createdConfigs: [],
    createdMarketplaces: [],
  };
});
```

### Teardown Pattern
```typescript
afterEach(() => {
  // Clean up any resources created during testing
  testState = {
    createdEntries: [],
    createdConfigs: [],
    createdMarketplaces: [],
  };
});
```

### State Tracking
```typescript
// Track created fixtures for proper cleanup
const factoryEntry = createMCPMarketplaceEntry();
testState.createdEntries.push(factoryEntry);

// Use in assertions
expect(testState.createdEntries.length).toBe(1);
```

## Cross-Pattern Integration

### Combining All Patterns
```typescript
// Start with base fixtures
const baseEntry = baseMarketplaceEntries.filesystem;

// Customize using utilities
const customEntry = createMarketplaceEntry(baseEntry, {
  name: 'enhanced-filesystem',
});

// Create additional entries using factories
const factoryEntry = createMCPMarketplaceEntry({ verified: false });

// Combine with scenario entries
const scenarioEntries = multiServerMarketplace.servers.slice(0, 2);

// Build comprehensive test marketplace
const testMarketplace = createMarketplace(baseMarketplace, {
  name: 'Comprehensive Test Marketplace',
  servers: [customEntry, factoryEntry, ...scenarioEntries],
});
```

### Type Safety Validation
```typescript
// All patterns maintain full TypeScript type safety
const typedEntry: MCPMarketplaceEntry = createMCPMarketplaceEntry();
const typedConfig: MCPServerConfig = createMCPServerConfig();
const typedMarketplace: MCPMarketplace = multiServerMarketplace;

// IntelliSense and compile-time checking work across all patterns
expect(typedEntry.serverConfig.type).toBeDefined();
expect(typedConfig.autoStart).toBeDefined();
expect(typedMarketplace.servers).toBeDefined();
```

## Performance Considerations

### Test Isolation
- Factory functions create unique instances to prevent test pollution
- Base fixtures are immutable references - safe to reuse
- Scenario fixtures are pre-built and cached for performance

### Memory Management
- Track created fixtures for cleanup in long-running test suites
- Use base fixtures when possible to reduce memory allocation
- Factory functions generate minimal overhead per instance

### Test Execution Speed
- Base fixtures: Fastest (pre-built, cached)
- Scenarios: Fast (pre-built, but larger objects)
- Factories: Moderate (runtime generation, but optimized)

## Common Patterns and Anti-Patterns

### ✅ Good Patterns
```typescript
// Use appropriate pattern for your needs
const baseEntry = baseMarketplaceEntries.filesystem;           // For standard cases
const scenario = multiServerMarketplace;                       // For realistic testing
const unique = createMCPMarketplaceEntry();                   // For isolation

// Combine patterns effectively
const testData = {
  baseConfig: baseServerConfigs.memory,
  scenarioServers: developmentMarketplace.servers,
  customEntry: createMCPMarketplaceEntry({ verified: false }),
};
```

### ❌ Anti-Patterns
```typescript
// Don't modify base fixtures directly
baseMarketplaceEntries.filesystem.verified = false; // ❌ Mutates shared state

// Don't use factories when base fixtures suffice
const unnecessary = createMCPMarketplaceEntry({    // ❌ Unnecessary complexity
  name: 'filesystem-server',                       // Base fixture already exists
  verified: true,
});

// Don't ignore test isolation with factories
const shared = createMCPMarketplaceEntry();        // ❌ Creates shared state risk
testState.globalEntry = shared;                    // Use in multiple tests
```

## Migration and Compatibility

### Upgrading from Previous Versions
- All existing base fixtures remain compatible
- New factory functions are additive - no breaking changes
- Scenario fixtures extend rather than replace existing patterns

### Adding New Fixtures
1. Add to appropriate category (base/scenarios/factories)
2. Export through index.ts
3. Add integration tests demonstrating usage
4. Update this documentation

### Deprecation Process
- Mark deprecated fixtures with JSDoc comments
- Provide migration path to new fixtures
- Keep deprecated fixtures for backward compatibility
- Remove only in major version updates

## Troubleshooting

### Common Issues

#### Import Errors
```typescript
// ❌ Incorrect import
import { baseMarketplace } from '@apexcli/core/marketplace';

// ✅ Correct import
import { baseMarketplace } from '@apexcli/core/fixtures';
```

#### Type Errors
```typescript
// ❌ Missing type import
const entry = createMCPMarketplaceEntry(); // Type not available

// ✅ Import types explicitly
import type { MCPMarketplaceEntry } from '@apexcli/core/fixtures';
const entry: MCPMarketplaceEntry = createMCPMarketplaceEntry();
```

#### Test Isolation Issues
```typescript
// ❌ Sharing factory instances
const sharedEntry = createMCPMarketplaceEntry();
// Use in multiple tests - state pollution risk

// ✅ Create new instances per test
beforeEach(() => {
  testEntry = createMCPMarketplaceEntry(); // Fresh instance
});
```

### Getting Help

- Check this documentation for usage patterns
- Review integration tests for examples
- Consult the ADR documentation for design decisions
- Ask team members familiar with the fixture system

## Future Development

### Planned Enhancements
- Additional scenario types for edge cases
- Performance optimizations for large test suites
- Enhanced factory customization options
- Better developer tooling integration

### Contributing New Fixtures
1. Follow existing patterns and conventions
2. Add comprehensive tests demonstrating usage
3. Update documentation with usage examples
4. Ensure backward compatibility

This documentation serves as the definitive guide for using APEX marketplace fixtures effectively. Keep it updated as the fixture system evolves.