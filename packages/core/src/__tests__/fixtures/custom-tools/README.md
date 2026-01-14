# Custom Tool Test Fixtures

This directory provides comprehensive test fixtures for custom tool definitions in APEX. The fixtures are organized into categories to support different testing scenarios.

## Directory Structure

```
custom-tools/
├── README.md                           # This documentation
├── index.ts                           # Loader utilities and API
├── ADR-custom-tool-fixtures.md       # Architecture Decision Record
├── valid/                             # Valid tool configurations
│   ├── basic-tools.yaml               # Simple, minimal tool definitions
│   ├── parameter-types.yaml           # Tools with various JSON Schema types
│   ├── output-parsers.yaml            # Tools with different output parsers
│   ├── environment-config.yaml        # Tools with env vars and working dirs
│   └── advanced-schemas.yaml          # Complex nested schemas, enums, defaults
├── invalid/                           # Invalid tool configurations for error testing
│   ├── missing-required.yaml          # Missing required fields
│   ├── invalid-types.yaml             # Invalid type values
│   ├── schema-violations.yaml         # JSON Schema constraint violations
│   └── malformed.yaml                 # Structurally invalid YAML
└── edge-cases/                        # Edge case configurations
    ├── empty-parameters.yaml          # Tools with no parameters
    ├── boundary-values.yaml           # Min/max values, empty strings
    ├── special-characters.yaml        # Names with special characters
    └── interpolation-patterns.yaml    # Various {{input}} patterns
```

## Usage

### Loading All Valid Tools

```typescript
import { loadValidToolFixtures } from './fixtures/custom-tools/index.js';

const validTools = await loadValidToolFixtures();
// Returns CustomToolConfig[] - all valid, validated tool configurations
```

### Loading Specific Fixture Files

```typescript
import { loadFixtureFile } from './fixtures/custom-tools/index.js';

// Load basic tools
const basicTools = await loadFixtureFile('valid', 'basic-tools.yaml');

// Load invalid configurations for error testing
const invalidTools = await loadFixtureFile('invalid', 'missing-required.yaml');
```

### Creating Test Tools Programmatically

```typescript
import { createTestToolConfig } from './fixtures/custom-tools/index.js';

// Create a basic test tool with defaults
const testTool = createTestToolConfig();

// Create a custom test tool with overrides
const customTool = createTestToolConfig({
  name: 'MyCustomTool',
  command: 'ls',
  args: ['-la'],
});
```

### Validating Tool Configurations

```typescript
import { validateToolConfig } from './fixtures/custom-tools/index.js';

const result = validateToolConfig(someToolConfig);
if (result.success) {
  console.log('Valid tool:', result.data);
} else {
  console.error('Validation error:', result.error);
}
```

### Working with Raw YAML

```typescript
import { getRawFixture } from './fixtures/custom-tools/index.js';

// Get raw YAML content for testing parsers
const rawYaml = await getRawFixture('valid', 'basic-tools.yaml');
```

## Test Examples

### Testing with Valid Fixtures

```typescript
import { loadValidToolFixtures } from './fixtures/custom-tools/index.js';

test('custom tool server handles valid configurations', async () => {
  const validTools = await loadValidToolFixtures();

  const server = buildCustomToolsServer(validTools, '/tmp');
  expect(server).not.toBeNull();
});
```

### Testing Error Handling with Invalid Fixtures

```typescript
import { loadInvalidToolFixtures, validateToolConfig } from './fixtures/custom-tools/index.js';

test('validation correctly rejects invalid configurations', async () => {
  const invalidTools = await loadInvalidToolFixtures();

  for (const tool of invalidTools) {
    const result = validateToolConfig(tool);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  }
});
```

### Testing Edge Cases

```typescript
import { loadEdgeCaseFixtures } from './fixtures/custom-tools/index.js';

test('handles edge case configurations correctly', async () => {
  const edgeTools = await loadEdgeCaseFixtures();

  // Test boundary values, special characters, etc.
  expect(edgeTools.some(tool => tool.timeoutMs === 1)).toBe(true);
  expect(edgeTools.some(tool => tool.name.includes('_'))).toBe(true);
});
```

## Fixture Coverage

The fixtures provide comprehensive coverage of:

### Parameter Types
- String (with constraints: minLength, maxLength, pattern)
- Integer (with min/max bounds)
- Number (with min/max bounds)
- Boolean (with defaults)
- Array (with item types)
- Object (with nested properties)

### Output Parsers
- `text` - Raw text output
- `json` - Parsed JSON output
- `lines` - Line-by-line output

### Configuration Options
- Environment variables
- Working directory
- Custom timeouts
- Enabled/disabled state

### Edge Cases
- Empty parameters
- Boundary values (min/max lengths, timeouts)
- Special characters in names and descriptions
- Interpolation patterns (`{{input.field}}`)
- Unicode content
- Long descriptions

### Error Scenarios
- Missing required fields
- Invalid field types
- Schema constraint violations
- Malformed configurations

## Maintenance

When updating the `CustomToolConfig` schema in `packages/core/src/types.ts`:

1. Update fixture files to include examples of new fields
2. Add validation tests for new constraints
3. Update the loader utilities if needed
4. Run `npm test` to ensure all fixtures remain valid

## See Also

- `packages/core/src/types.ts` - Schema definitions
- `packages/orchestrator/src/custom-tools.ts` - Custom tool implementation
- `ADR-custom-tool-fixtures.md` - Architecture decisions and rationale