# Marketplace Scenario Fixtures

This directory contains comprehensive marketplace fixtures covering all scenarios defined in the acceptance criteria for fixture files with sample marketplace data.

## Overview

The marketplace scenario fixtures provide static data structures for testing marketplace functionality across common scenarios. These fixtures complement the existing factory functions in `marketplace.ts` by providing pre-built scenarios ready for use in tests.

## Scenarios Covered

### 1. Empty Marketplace
- `emptyMarketplace`: A marketplace with no available servers
- Use case: Testing empty states, initial marketplace setup

### 2. Single Server Marketplace
- `singleServerMarketplace`: A marketplace with exactly one filesystem server
- Use case: Testing basic functionality with minimal data

### 3. Multiple Servers Marketplace
- `multiServerMarketplace`: A comprehensive marketplace with servers in various states
- Use case: Testing complex scenarios with mixed server types and states

### 4. Package States
- **Deprecated**: `deprecatedFilesystemEntry` - Legacy server marked as deprecated
- **Alpha/Beta**: `alphaBrowserEntry` - Pre-release browser automation server
- **Draft**: `draftDatabaseEntry` - Development server with breaking changes

### 5. Configuration Options
- **HTTP**: `httpServerEntry` - Server using HTTP transport
- **SSE**: `sseServerEntry` - Server using Server-Sent Events transport
- **Complex**: `complexConfigEntry` - Server with multiple environment variables

### 6. Development vs Enterprise
- `developmentMarketplace`: Testing registry with unverified servers
- `enterpriseMarketplace`: Private registry with enterprise authentication

## Usage Examples

### Basic Usage

```typescript
import {
  emptyMarketplace,
  singleServerMarketplace,
  multiServerMarketplace
} from '@apex/core/fixtures';

// Test empty state
expect(emptyMarketplace.servers).toHaveLength(0);

// Test single server
expect(singleServerMarketplace.servers).toHaveLength(1);
expect(singleServerMarketplace.servers[0].verified).toBe(true);

// Test multiple servers with mixed states
const verified = multiServerMarketplace.servers.filter(s => s.verified);
const unverified = multiServerMarketplace.servers.filter(s => !s.verified);
expect(verified.length).toBeGreaterThan(0);
expect(unverified.length).toBeGreaterThan(0);
```

### Package State Testing

```typescript
import { packageStates } from '@apex/core/fixtures';

// Test deprecated package
expect(packageStates.deprecated.description).toContain('[DEPRECATED]');

// Test alpha version
expect(packageStates.alpha.version).toContain('alpha');
expect(packageStates.alpha.verified).toBe(false);

// Test draft package
expect(packageStates.draft.version).toContain('dev');
```

### Configuration Testing

```typescript
import { configurationVariations } from '@apex/core/fixtures';

// Test HTTP configuration
expect(configurationVariations.http.serverConfig.type).toBe('http');
expect(configurationVariations.http.serverConfig.url).toBeDefined();

// Test SSE configuration
expect(configurationVariations.sse.serverConfig.type).toBe('sse');
expect(configurationVariations.sse.serverConfig.autoStart).toBe(true);

// Test complex configuration with environment variables
expect(configurationVariations.complex.serverConfig.env).toBeDefined();
expect(Object.keys(configurationVariations.complex.serverConfig.env)).toContain('LOG_LEVEL');
```

## Utility Functions

### Filtering and Discovery

```typescript
import {
  getAllVerifiedEntries,
  getAllUnverifiedEntries,
  getEntriesByConfigType,
  getEntriesWithEnvironment,
  getAutoStartEntries
} from '@apex/core/fixtures';

// Get all verified servers across scenarios
const verified = getAllVerifiedEntries();

// Get servers by configuration type
const httpServers = getEntriesByConfigType('http');
const stdioServers = getEntriesByConfigType('stdio');

// Get servers with environment variables
const serversWithEnv = getEntriesWithEnvironment();

// Get auto-starting servers
const autoStartServers = getAutoStartEntries();
```

### Custom Scenario Creation

```typescript
import { createScenario } from '@apex/core/fixtures';

// Create a scenario with only verified HTTP servers
const verifiedHttpScenario = createScenario({
  verified: true,
  configType: 'http',
  name: 'Verified HTTP Servers',
  description: 'Testing verified HTTP-based MCP servers'
});

// Create a scenario with servers that have environment variables
const envScenario = createScenario({
  hasEnvironment: true,
  name: 'Servers with Environment Variables'
});

// Combine multiple filters
const specificScenario = createScenario({
  verified: false,
  configType: 'stdio',
  autoStart: true
});
```

## Integration with Existing Fixtures

These scenario fixtures work alongside the existing factory functions in `marketplace.ts`:

```typescript
import {
  scenarioMarketplaces,
  createMCPMarketplaceEntry,
  createMarketplace
} from '@apex/core/fixtures';

// Use predefined scenario as base
const testMarketplace = createMarketplace(scenarioMarketplaces.multi, {
  name: 'Test Marketplace',
  version: '1.0.0'
});

// Add custom entries to existing scenarios
const customEntry = createMCPMarketplaceEntry({
  name: 'custom-test-server',
  verified: true
});

testMarketplace.servers.push(customEntry);
```

## File Structure

```
packages/core/src/fixtures/
├── marketplace.ts              # Factory functions and base fixtures
├── marketplace-scenarios.ts    # Scenario-specific fixtures (this file)
├── index.ts                   # Main export file
└── __tests__/
    ├── marketplace.test.ts             # Factory function tests
    └── marketplace-scenarios.test.ts   # Scenario fixture tests
```

## Best Practices

1. **Use appropriate scenarios**: Choose the scenario that best matches your test case
2. **Combine with utilities**: Use the provided utility functions for filtering and discovery
3. **Extend when needed**: Use `createScenario()` for custom test requirements
4. **Validate assumptions**: Always verify the fixture data meets your test expectations
5. **Keep tests focused**: Use the simplest scenario that covers your test case

## Acceptance Criteria Mapping

- ✅ **Empty marketplace**: `emptyMarketplace`
- ✅ **Single server**: `singleServerMarketplace`
- ✅ **Multiple servers**: `multiServerMarketplace`
- ✅ **Published state**: All verified entries represent published packages
- ✅ **Draft state**: `draftDatabaseEntry` with dev version
- ✅ **Deprecated state**: `deprecatedFilesystemEntry` with deprecation notice
- ✅ **Different configurations**: HTTP, SSE, stdio, and complex environment setups

These fixtures provide comprehensive coverage for testing marketplace functionality across all common scenarios and edge cases.