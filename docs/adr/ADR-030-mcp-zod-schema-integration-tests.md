# ADR-030: MCP Zod Schema Validation Integration Tests

## Status
Accepted

## Context

The APEX project has extensive MCP (Model Context Protocol) Zod schemas defined across two primary locations:
- `packages/core/src/types.ts` - Configuration, tool, server, and invocation schemas
- `packages/core/src/mcp/protocol-types.ts` - JSON-RPC 2.0 and MCP protocol message schemas

While there are existing integration tests (`mcp-integration.test.ts`, `mcp-protocol-types.integration.test.ts`), they primarily test:
- Happy-path parsing (valid data parses successfully)
- Workflow simulations (init handshake, tool discovery)
- Export validation

**Gap identified**: There is insufficient coverage for:
1. **Invalid data rejection** - Verifying ZodError messages contain meaningful paths and messages
2. **Edge cases** - Optional fields, discriminated unions (`MCPToolResultContentItemSchema`), nested object validation
3. **Error path specificity** - Ensuring Zod error paths point to exact failing fields
4. **Boundary conditions** - Numeric constraints (`min`, `max`), string constraints (`min(1)`), enum validation

## Decision

Create a focused integration test file that systematically validates the Zod schema validation behavior for all MCP-related schemas, organized into three categories matching the acceptance criteria:

### Test File Structure

**File**: `packages/core/src/__tests__/mcp-zod-schema-validation.integration.test.ts`

### Test Organization

```
mcp-zod-schema-validation.integration.test.ts
├── 1. Valid Data Parsing (Happy Path)
│   ├── MCPServerConfigSchema - all type variants (stdio, http, sse, sdk)
│   ├── MCPConnectionConfigSchema - full config with all fields
│   ├── MCPToolSchemaSchema - complex property definitions
│   ├── MCPToolSchema - complete tool with capabilities
│   ├── MCPToolInvocationRequestSchema / ResponseSchema
│   ├── MCPConfigSchema - record and array server formats
│   ├── JsonRpcRequestSchema / ResponseSchema / NotificationSchema
│   ├── MCPInitializeParamsSchema / ResultSchema
│   └── MCPToolsCallResultSchema with all content types
│
├── 2. Invalid Data Rejection (ZodError verification)
│   ├── MCPServerConfigSchema - empty name, invalid type enum, wrong field types
│   ├── MCPConnectionConfigSchema - negative numbers, non-integer, out-of-range poolSize
│   ├── MCPToolSchema - missing required fields, empty name/serverId
│   ├── MCPToolSchemaSchema - invalid JSONSchemaType values
│   ├── MCPConfigSchema - wrong enabled type, nested invalid server
│   ├── JsonRpcRequestSchema - missing jsonrpc literal, missing id, wrong jsonrpc value
│   ├── MCPToolResultContentItemSchema - invalid discriminator value
│   ├── MCPInstallationStatusSchema - invalid enum value
│   └── MCPToolInvocationRequestSchema - empty toolName, invalid timeoutMs
│
└── 3. Edge Cases
    ├── Optional fields behavior (defaults applied correctly)
    ├── Discriminated union variants (MCPToolResultContentItemSchema: text/image/resource)
    ├── Discriminated union with missing required sub-fields
    ├── Nested object validation (MCPServerConfig.connection, InstalledMCPServer.server)
    ├── Union types (MCPConfigSchema.servers as record vs array)
    ├── z.literal validation (jsonrpc: '2.0', MCPToolSchemaSchema.type: 'object')
    ├── safeParse vs parse behavior consistency
    ├── Multiple simultaneous errors in single parse
    ├── Boundary values for numeric constraints
    └── String trimming and min-length interactions
```

### Key Design Decisions

#### 1. Single Focused Test File
Rather than scattering tests across multiple files, a single `mcp-zod-schema-validation.integration.test.ts` file provides:
- Clear scope for the specific acceptance criteria
- Easy to navigate and maintain
- Follows the pattern of existing integration test files

#### 2. Use `safeParse` for Error Inspection
For invalid data tests, use `schema.safeParse()` instead of `try/catch` with `schema.parse()`. This provides cleaner error inspection:
```typescript
const result = schema.safeParse(invalidData);
expect(result.success).toBe(false);
if (!result.success) {
  expect(result.error.issues).toContainEqual(
    expect.objectContaining({ path: ['name'], code: 'too_small' })
  );
}
```

#### 3. Error Path Assertions
Each invalid-data test should verify the specific error path and code:
- `path`: The exact field path (e.g., `['servers', 'my-server', 'type']`)
- `code`: The Zod error code (`invalid_type`, `invalid_enum_value`, `too_small`, `invalid_literal`, `invalid_union_discriminator`)
- `message`: Human-readable error message

#### 4. Testing Discriminated Unions
The `MCPToolResultContentItemSchema` uses `z.discriminatedUnion('type', [...])`. Tests should cover:
- Valid discriminator values with correct required fields per variant
- Invalid discriminator value → `invalid_union_discriminator` error
- Valid discriminator but missing variant-specific required fields
- Each variant's specific field requirements

#### 5. Default Value Verification
For schemas with `.default()` values, tests should verify:
- Missing optional fields get correct defaults after parsing
- Explicitly provided values override defaults
- The parsed output shape matches the expected TypeScript type

### Schemas to Cover (Priority Order)

| Schema | Valid | Invalid | Edge Cases |
|--------|-------|---------|------------|
| `MCPServerConfigSchema` | stdio, http, sse, sdk variants | empty name, invalid type | defaults, optional connection |
| `MCPConnectionConfigSchema` | full config | negative values, fractional ints, poolSize > 100 | all defaults, boundary values |
| `MCPToolSchemaSchema` | complex properties | invalid JSONSchemaType | empty properties default |
| `MCPToolSchema` | full tool definition | missing name/serverId | optional capabilities |
| `MCPToolCapabilitiesSchema` | all flags | wrong types | all defaults |
| `MCPConfigSchema` | record + array servers | invalid nested | union behavior |
| `JsonRpcRequestSchema` | string/number id | wrong jsonrpc literal | optional params |
| `JsonRpcResponseSchema` | success + error | neither result nor error | union resolution |
| `JsonRpcNotificationSchema` | basic notification | invalid jsonrpc | no id field |
| `MCPToolResultContentItemSchema` | text, image, resource | invalid discriminator | per-variant fields |
| `MCPToolInvocationRequestSchema` | full request | empty strings, negative timeout | defaults |
| `MCPToolInvocationResponseSchema` | success + error | invalid content type | nested metrics |
| `MCPInstallationStatusSchema` | all enum values | invalid value | - |
| `MCPEnvironmentVarSchema` | full var, minimal var | empty name, invalid source | defaults |
| `MCPServerSchema` | full definition | missing required fields | default arrays |
| `MCPInstallationSchema` | valid installation | invalid date, empty paths | - |
| `InstalledMCPServerSchema` | nested valid | invalid nested server | optional installation |
| `MCPToolsConfigSchema` | full config | invocationTimeoutMs < 1000 | defaults |
| `MCPInitializeParamsSchema` | valid handshake | invalid version format | - |
| `MCPToolResultContentTypeSchema` | all values | invalid value | - |

### Import Strategy

```typescript
import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';

// From types.ts (main package exports)
import {
  MCPServerConfigSchema,
  MCPConnectionConfigSchema,
  MCPToolSchemaSchema,
  MCPToolSchema,
  MCPToolCapabilitiesSchema,
  MCPConfigSchema,
  MCPEnvironmentVarSchema,
  MCPServerSchema,
  MCPInstallationSchema,
  MCPInstallationStatusSchema,
  MCPToolsConfigSchema,
  MCPToolInvocationRequestSchema,
  MCPToolInvocationResponseSchema,
  MCPToolResultContentTypeSchema,
  MCPToolResultContentSchema,
  InstalledMCPServerSchema,
} from '../types.js';

// From protocol-types.ts (MCP sub-package exports)
import {
  JsonRpcRequestSchema,
  JsonRpcResponseSchema,
  JsonRpcNotificationSchema,
  JsonRpcSuccessResponseSchema,
  JsonRpcErrorResponseSchema,
  MCPInitializeParamsSchema,
  MCPInitializeResultSchema,
  MCPToolResultContentItemSchema,
  MCPToolsCallResultSchema,
} from '../mcp/protocol-types.js';
```

### Test Vitest Configuration

The test file uses the `.integration.test.ts` suffix and will be picked up by:
- The root `vitest.config.ts` (includes `*.integration.test.ts`)
- The unit test runner also picks it up unless excluded

No additional vitest configuration changes needed.

## Consequences

### Positive
- Comprehensive Zod error path coverage ensures schema changes don't silently break validation
- Edge case tests prevent regressions around discriminated unions and nested objects
- Clear acceptance criteria mapping makes verification straightforward
- Single focused file is easy to locate, maintain, and review

### Negative
- Additional ~400-500 line test file increases test count
- Some overlap with existing tests (valid parsing) - but this is acceptable for complete coverage

### Risks
- Schema changes will require test updates (mitigated by clear test organization)
- Large test file could become unwieldy (mitigated by consistent section structure)

## Implementation Notes for Developer Stage

1. Import all schemas from the correct module paths (`.js` extensions for NodeNext)
2. Use `safeParse` for all invalid-data assertions to avoid try/catch boilerplate
3. For discriminated union tests, verify the `invalid_union_discriminator` code specifically
4. Verify ZodError `.issues` array contains expected `path`, `code`, and `message` fields
5. Use `expect.objectContaining()` for partial error matching (Zod may add extra fields)
6. Test both minimal valid objects and fully-specified valid objects
7. Ensure all tests are deterministic (no Date.now(), use fixed dates)
8. Run `npm run build` and `npm run test` before marking complete
