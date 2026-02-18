# ADR: Custom Tool Test Fixtures Architecture

**Date**: 2025-01-11
**Status**: Proposed
**Decision Makers**: Architecture Team

## Context

The APEX platform supports custom tool definitions through the `CustomToolConfig` schema. Testing custom tool functionality requires comprehensive test fixtures that cover:
1. Valid tool configurations with various parameter schemas
2. Invalid tool configurations for error handling tests
3. Edge cases and complex schema configurations

Currently, tests inline tool configurations directly in test files (e.g., `custom-tools.integration.test.ts`), which leads to:
- Duplicated fixture code across tests
- Inconsistent test data
- Difficulty maintaining comprehensive test coverage
- No centralized source of truth for example configurations

## Decision

Create a dedicated test fixtures directory structure at `packages/core/src/__tests__/fixtures/custom-tools/` containing:

### Directory Structure

```
packages/core/src/__tests__/fixtures/custom-tools/
├── ADR-custom-tool-fixtures.md          # This document
├── index.ts                              # Main exports and loader utilities
├── valid/                                # Valid tool configurations
│   ├── basic-tools.yaml                  # Simple, minimal tool definitions
│   ├── parameter-types.yaml              # Tools with various JSON Schema types
│   ├── output-parsers.yaml               # Tools with different output parsers
│   ├── environment-config.yaml           # Tools with env vars and working dirs
│   └── advanced-schemas.yaml             # Complex nested schemas, enums, defaults
├── invalid/                              # Invalid tool configurations for error testing
│   ├── missing-required.yaml             # Missing required fields
│   ├── invalid-types.yaml                # Invalid type values
│   ├── schema-violations.yaml            # JSON Schema constraint violations
│   └── malformed.yaml                    # Structurally invalid YAML
└── edge-cases/                           # Edge case configurations
    ├── empty-parameters.yaml             # Tools with no parameters
    ├── boundary-values.yaml              # Min/max values, empty strings
    ├── special-characters.yaml           # Names with special characters
    └── interpolation-patterns.yaml       # Various {{input}} patterns
```

### File Formats

Fixtures will be provided in YAML format (matching production config format) with a TypeScript loader that:
1. Parses YAML files using the existing `yaml` package
2. Validates against Zod schemas where applicable
3. Exports typed fixtures for type-safe test usage

### Loader API

```typescript
// packages/core/src/__tests__/fixtures/custom-tools/index.ts

import type { CustomToolConfig } from '../../../types.js';

// Load all valid fixtures
export function loadValidToolFixtures(): CustomToolConfig[];

// Load fixtures from a specific category
export function loadFixtureFile(category: 'valid' | 'invalid' | 'edge-cases', filename: string): unknown;

// Get raw YAML content (for testing parsers)
export function getRawFixture(category: 'valid' | 'invalid' | 'edge-cases', filename: string): string;

// Pre-parsed, validated fixtures for common use cases
export const validBasicTools: CustomToolConfig[];
export const validParameterTypeTools: CustomToolConfig[];
export const invalidMissingRequired: Record<string, unknown>[];
export const edgeCaseEmptyParams: CustomToolConfig[];
```

## Alternatives Considered

### 1. JSON Fixtures Instead of YAML
**Rejected**: YAML is the production config format. Using YAML ensures fixtures match real-world usage and tests the actual parsing path.

### 2. Inline Fixtures in Test Files
**Current State, to be phased out**: While simple, this leads to duplication and inconsistent test data.

### 3. Factory Functions Only
**Partially adopted**: The existing `createTestTool()` pattern in tests is useful for dynamic fixtures but doesn't cover static configurations or error case testing well.

### 4. Fixtures in orchestrator package
**Rejected**: Custom tools are defined by `CustomToolConfig` in `@apex/core`. Fixtures should live alongside the schema definitions for maintainability.

## Consequences

### Positive
- **Single source of truth**: All test tool configurations in one place
- **Type safety**: TypeScript loader provides typed access to fixtures
- **Comprehensive coverage**: Organized categories ensure all scenarios are tested
- **Documentation**: Fixtures serve as examples for users defining custom tools
- **Reusability**: Fixtures can be used by both core and orchestrator package tests

### Negative
- **Additional setup**: Requires loader implementation and fixture file creation
- **File I/O in tests**: Loading YAML files adds small overhead (mitigated by caching)
- **Maintenance**: New schema fields require fixture updates

### Risks
- **Schema drift**: Fixtures may become outdated as `CustomToolConfig` evolves
  - Mitigation: Include validation tests that parse all fixtures against current schema
- **Over-engineering**: Too many fixtures may slow test discovery
  - Mitigation: Keep fixtures minimal but complete; use factory functions for variations

## Implementation Plan

### Phase 1: Core Infrastructure (This Stage - Architecture)
1. Create directory structure
2. Implement loader utilities with caching
3. Add TypeScript exports

### Phase 2: Fixture Files (Developer Stage)
1. Create valid tool fixtures covering all schema fields
2. Create invalid fixtures for error testing
3. Create edge case fixtures

### Phase 3: Integration (Tester Stage)
1. Update existing tests to use fixtures
2. Add fixture validation tests
3. Document fixture usage patterns

## Schema Reference

### CustomToolConfig (from `packages/core/src/types.ts`)

```typescript
CustomToolConfigSchema = z.object({
  name: z.string().min(1).max(64),
  description: z.string().min(1),
  command: z.string().min(1),
  args: z.array(z.string()).optional().default([]),
  parameters: ToolParametersSchemaSchema.optional().default({
    type: 'object',
    properties: {},
    required: [],
    additionalProperties: false,
  }),
  outputParser: z.enum(['json', 'text', 'lines']).optional().default('text'),
  timeoutMs: z.number().int().min(1).optional().default(60000),
  workingDirectory: z.string().optional(),
  env: z.record(z.string()).optional(),
  enabled: z.boolean().optional().default(true),
});
```

### ToolParametersSchema

```typescript
ToolParametersSchemaSchema = z.object({
  type: z.literal('object').default('object'),
  properties: z.record(z.string(), z.object({
    type: JSONSchemaTypeSchema,  // 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object' | 'null'
    description: z.string().optional(),
    default: z.unknown().optional(),
    enum: z.array(z.unknown()).optional(),
    properties: z.record(z.string(), z.unknown()).optional(),
    items: z.unknown().optional(),
    minimum: z.number().optional(),
    maximum: z.number().optional(),
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    pattern: z.string().optional(),
  })).optional().default({}),
  required: z.array(z.string()).optional().default([]),
  additionalProperties: z.boolean().optional().default(false),
});
```

## References

- `packages/core/src/types.ts` - CustomToolConfig and related schemas
- `packages/orchestrator/src/custom-tools.ts` - Custom tool server implementation
- `tests/integration/custom-tools.integration.test.ts` - Existing integration tests
- `docs/configuration.md` - User-facing configuration documentation
