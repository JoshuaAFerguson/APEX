# APEX Core Marketplace Fixtures

This directory contains base marketplace fixtures for testing across the APEX system. These fixtures provide consistent, well-typed test data for MCP (Model Context Protocol) marketplace functionality.

## Structure

```
fixtures/
├── index.ts              # Main export file
├── marketplace.ts        # Marketplace entity fixtures
├── __tests__/            # Fixture tests
│   ├── marketplace.test.ts    # Unit tests for fixtures
│   └── integration.test.ts    # Integration tests
└── README.md             # This file
```

## Usage

### Basic Import

```typescript
import {
  baseMarketplaceEntries,
  baseMarketplace,
  createMarketplaceEntry
} from '@apexcli/core/test-fixtures';
```

### Available Fixtures

#### Base Marketplace Entries
- `baseFilesystemMarketplaceEntry` - Filesystem operations server
- `baseMemoryMarketplaceEntry` - Memory/knowledge server
- `baseGitMarketplaceEntry` - Git repository operations
- `baseFetchMarketplaceEntry` - HTTP/web content fetching
- `basePostgresMarketplaceEntry` - PostgreSQL database operations

#### Server Configurations
- `baseServerConfigs` - Collection of all base server configurations
- Individual configs: `baseFilesystemServerConfig`, `baseMemoryServerConfig`, etc.

#### Marketplace Sources
- `baseMarketplaceSource` - Default production marketplace source
- `baseDevelopmentMarketplaceSource` - Development marketplace (allows unverified)
- `baseLocalMarketplaceSource` - Local testing marketplace

#### Complete Marketplaces
- `baseMarketplace` - Production marketplace with verified servers
- `baseDevelopmentMarketplace` - Development marketplace with mixed content

### Utility Functions

#### Creating Custom Fixtures

```typescript
import { createMarketplaceEntry, baseFilesystemMarketplaceEntry } from '@apexcli/core/test-fixtures';

// Create a custom entry based on filesystem entry
const customEntry = createMarketplaceEntry(baseFilesystemMarketplaceEntry, {
  name: 'my-custom-server',
  verified: false,
  description: 'My custom MCP server'
});
```

#### Filtering Fixtures

```typescript
import { getVerifiedEntries, getEntriesByCapability } from '@apexcli/core/test-fixtures';

// Get all verified marketplace entries
const verifiedServers = getVerifiedEntries();

// Get all servers that support 'tools' capability
const toolServers = getEntriesByCapability('tools');
```

### Collections

All fixtures are also available as organized collections:

```typescript
import {
  baseServerConfigs,
  baseMarketplaceEntries,
  baseMarketplaceSources,
  baseMarketplaces
} from '@apexcli/core/test-fixtures';

// Access specific fixtures
const filesystemConfig = baseServerConfigs.filesystem;
const memoryEntry = baseMarketplaceEntries.memory;
const devSource = baseMarketplaceSources.development;
```

## Example Test Usage

```typescript
import { describe, expect, it } from 'vitest';
import {
  baseMarketplace,
  baseFilesystemMarketplaceEntry,
  createMarketplaceEntry
} from '@apexcli/core/test-fixtures';

describe('My Marketplace Tests', () => {
  it('should work with base marketplace', () => {
    expect(baseMarketplace.servers).toContain(baseFilesystemMarketplaceEntry);
    expect(baseMarketplace.name).toBe('MCP Registry');
  });

  it('should create custom entries', () => {
    const customEntry = createMarketplaceEntry(baseFilesystemMarketplaceEntry, {
      name: 'test-server',
      verified: false
    });

    expect(customEntry.name).toBe('test-server');
    expect(customEntry.verified).toBe(false);
  });
});
```

## Type Safety

All fixtures are fully typed using the core APEX types:

- `MCPMarketplaceEntry`
- `MCPServerConfig`
- `MCPMarketplace`
- `MCPMarketplaceSource`
- `MCPServer`

This ensures type safety and IntelliSense support when using the fixtures.

## Integration with Test-Fixtures

These marketplace fixtures are integrated into the main APEX test-fixtures system and can be imported through:

```typescript
import { baseMarketplace } from '@apexcli/core/test-fixtures';
```

## Contributing

When adding new marketplace fixtures:

1. Follow the naming convention: `base[EntityName]MarketplaceEntry`
2. Ensure all fixtures are properly typed
3. Add corresponding tests in `__tests__/`
4. Export through `index.ts`
5. Update this README with usage examples

## Related Files

- `packages/core/src/types.ts` - Core type definitions
- `packages/core/src/test-fixtures/index.ts` - Main test fixtures export
- `tests/e2e/fixtures/marketplace-data.ts` - E2E test fixtures