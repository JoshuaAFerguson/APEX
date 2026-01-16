# ADR-040: MCP Schema to Claude Agent SDK Tool Format Translator

## Status
Accepted

## Date
2024-01-16

## Context

APEX integrates with MCP (Model Context Protocol) servers to discover and use external tools. MCP tools are defined using JSON Schema (Draft 7) format, while the Claude Agent SDK's `tool()` function requires Zod schemas for parameter validation.

Currently, the `mcp-tool-manager.ts` passes MCP tool schemas directly without proper conversion, and `custom-tools.ts` has a partial implementation (`buildZodSchemaFromParameter`) that handles basic type conversion but is tightly coupled to custom tool configurations.

We need a dedicated, reusable `SchemaTranslator` module that:
1. Converts MCP JSON Schema definitions to Zod schemas for Claude Agent SDK
2. Handles all JSON Schema types (string, number, integer, boolean, array, object, null)
3. Supports constraints (min/max, pattern, enum, etc.)
4. Handles nested objects and arrays correctly
5. Preserves required/optional field semantics
6. Provides descriptive tool metadata translation

## Decision

### Architecture

Create a new `SchemaTranslator` class in `@apex/orchestrator` at `packages/orchestrator/src/schema-translator.ts` with the following design:

```
packages/orchestrator/src/
├── schema-translator.ts          # Main SchemaTranslator class
└── __tests__/
    └── schema-translator.test.ts # Comprehensive test suite
```

### Interface Design

```typescript
import { z } from 'zod';
import type { MCPToolSchema, MCPTool } from '@apexcli/core';

/**
 * Result of translating an MCP tool to Claude Agent SDK format
 */
export interface ClaudeSDKTool {
  /** Tool name */
  name: string;
  /** Tool description */
  description: string;
  /** Zod schema for parameter validation */
  parameters: z.ZodObject<z.ZodRawShape>;
  /** Original MCP tool metadata for reference */
  metadata: {
    serverId: string;
    serverName?: string;
    version?: string;
    capabilities?: Record<string, unknown>;
  };
}

/**
 * Options for schema translation
 */
export interface SchemaTranslatorOptions {
  /** Whether to make all properties optional by default (default: false) */
  allOptional?: boolean;
  /** Whether to allow additional properties not in schema (default: false) */
  allowAdditionalProperties?: boolean;
  /** Custom type handlers for extended JSON Schema types */
  customTypeHandlers?: Map<string, (schema: JSONSchemaProperty) => z.ZodTypeAny>;
  /** Whether to preserve default values (default: true) */
  preserveDefaults?: boolean;
}

/**
 * SchemaTranslator - Converts MCP JSON Schema to Claude Agent SDK Zod schemas
 */
export class SchemaTranslator {
  constructor(options?: SchemaTranslatorOptions);

  /**
   * Translate a complete MCP tool to Claude Agent SDK format
   */
  translateTool(mcpTool: MCPTool): ClaudeSDKTool;

  /**
   * Translate just the input schema to a Zod object schema
   */
  translateInputSchema(schema: MCPToolSchema): z.ZodObject<z.ZodRawShape>;

  /**
   * Translate a single JSON Schema property to Zod
   */
  translateProperty(property: JSONSchemaProperty, isRequired: boolean): z.ZodTypeAny;
}
```

### Type Mapping Strategy

| JSON Schema Type | Zod Type | Constraints Supported |
|-----------------|----------|----------------------|
| `string` | `z.string()` | minLength, maxLength, pattern, enum, format, const |
| `number` | `z.number()` | minimum, maximum, exclusiveMinimum, exclusiveMaximum, multipleOf |
| `integer` | `z.number().int()` | minimum, maximum, exclusiveMinimum, exclusiveMaximum, multipleOf |
| `boolean` | `z.boolean()` | const |
| `null` | `z.null()` | - |
| `array` | `z.array()` | items, minItems, maxItems, uniqueItems |
| `object` | `z.object()` | properties, required, additionalProperties, minProperties, maxProperties |

### Special Handling

1. **Enum Types**: When `enum` is present, use `z.enum()` for strings or `z.union()` for mixed types
2. **Union Types** (`oneOf`/`anyOf`): Translate to `z.union()`
3. **Intersection Types** (`allOf`): Translate to `z.intersection()`
4. **Nullable Types**: Handle `type: ['string', 'null']` as `z.string().nullable()`
5. **Default Values**: Apply defaults using `.default()` when `default` is specified
6. **Required Fields**: Only mark as required if property name is in `required` array
7. **Nested Objects**: Recursively translate nested object schemas
8. **Array Items**: Translate `items` schema for array element validation

### Implementation Approach

```typescript
class SchemaTranslator {
  private options: Required<SchemaTranslatorOptions>;

  constructor(options: SchemaTranslatorOptions = {}) {
    this.options = {
      allOptional: false,
      allowAdditionalProperties: false,
      preserveDefaults: true,
      customTypeHandlers: new Map(),
      ...options,
    };
  }

  translateTool(mcpTool: MCPTool): ClaudeSDKTool {
    return {
      name: mcpTool.name,
      description: mcpTool.description || `MCP tool from ${mcpTool.serverId}`,
      parameters: this.translateInputSchema(mcpTool.inputSchema),
      metadata: {
        serverId: mcpTool.serverId,
        serverName: mcpTool.serverName,
        version: mcpTool.version,
        capabilities: mcpTool.capabilities,
      },
    };
  }

  translateInputSchema(schema: MCPToolSchema): z.ZodObject<z.ZodRawShape> {
    const shape: z.ZodRawShape = {};
    const required = new Set(schema.required || []);
    const properties = schema.properties || {};

    for (const [key, prop] of Object.entries(properties)) {
      const isRequired = required.has(key) && !this.options.allOptional;
      const zodType = this.translateProperty(prop, isRequired);
      shape[key] = isRequired ? zodType : zodType.optional();
    }

    let objectSchema = z.object(shape);

    if (this.options.allowAdditionalProperties || schema.additionalProperties) {
      objectSchema = objectSchema.passthrough();
    } else {
      objectSchema = objectSchema.strict();
    }

    return objectSchema;
  }

  translateProperty(property: JSONSchemaProperty, isRequired: boolean): z.ZodTypeAny {
    // Check for custom handler first
    if (this.options.customTypeHandlers.has(property.type)) {
      return this.options.customTypeHandlers.get(property.type)!(property);
    }

    let schema = this.translateBaseType(property);

    // Apply default if present and option enabled
    if (this.options.preserveDefaults && property.default !== undefined) {
      schema = schema.default(property.default);
    }

    return schema;
  }

  private translateBaseType(property: JSONSchemaProperty): z.ZodTypeAny {
    // Handle enum first (overrides type-based handling)
    if (property.enum) {
      return this.translateEnum(property);
    }

    // Handle oneOf/anyOf/allOf
    if (property.oneOf || property.anyOf) {
      return this.translateUnion(property.oneOf || property.anyOf);
    }
    if (property.allOf) {
      return this.translateIntersection(property.allOf);
    }

    // Handle nullable types
    if (Array.isArray(property.type)) {
      return this.translateNullableType(property);
    }

    switch (property.type) {
      case 'string':
        return this.translateString(property);
      case 'number':
        return this.translateNumber(property);
      case 'integer':
        return this.translateInteger(property);
      case 'boolean':
        return z.boolean();
      case 'null':
        return z.null();
      case 'array':
        return this.translateArray(property);
      case 'object':
        return this.translateNestedObject(property);
      default:
        return z.unknown();
    }
  }

  // ... additional private methods for each type
}
```

### Integration with Claude Agent SDK

The translated schemas can be used with the Claude Agent SDK's `tool()` function:

```typescript
import { tool } from '@anthropic-ai/claude-agent-sdk';

const translator = new SchemaTranslator();
const sdkTool = translator.translateTool(mcpTool);

const toolDef = tool(
  sdkTool.name,
  sdkTool.description,
  sdkTool.parameters.shape,
  async (args) => {
    // Execute MCP tool with validated args
    return await mcpClient.callTool(sdkTool.name, args);
  }
);
```

### Integration Points

1. **MCPToolManager** (`mcp-tool-manager.ts`): Use SchemaTranslator in `convertMcpToolToApexTool()` method
2. **Custom Tools** (`custom-tools.ts`): Refactor to use SchemaTranslator instead of `buildZodSchemaFromParameter()`
3. **Future MCP Integrations**: Provide reusable schema translation for any MCP-to-APEX integration

## Consequences

### Positive
- **Single Source of Truth**: One module handles all JSON Schema to Zod conversions
- **Comprehensive Type Support**: Full JSON Schema Draft 7 compliance
- **Extensible**: Custom type handlers allow for future schema extensions
- **Type-Safe**: Full TypeScript type safety with proper generics
- **Testable**: Isolated module with clear inputs/outputs for unit testing
- **Reusable**: Can be used by any component needing schema translation

### Negative
- **Additional Dependency**: Adds complexity to the codebase
- **Maintenance Burden**: Need to maintain parity with JSON Schema spec updates
- **Performance**: Runtime schema translation has some overhead (mitigated by caching)

### Neutral
- **Migration Required**: Existing `buildZodSchemaFromParameter` in `custom-tools.ts` should be refactored to use this

## Test Strategy

1. **Unit Tests**: Test each type translation independently
2. **Constraint Tests**: Verify all JSON Schema constraints are properly applied
3. **Nested Schema Tests**: Test deeply nested object/array structures
4. **Edge Cases**: Empty schemas, missing fields, invalid types
5. **Integration Tests**: Verify translated tools work with Claude Agent SDK
6. **Round-Trip Tests**: Ensure schema semantics are preserved after translation

## Files to Create/Modify

### New Files
- `packages/orchestrator/src/schema-translator.ts` - Main implementation
- `packages/orchestrator/src/__tests__/schema-translator.test.ts` - Test suite

### Modified Files
- `packages/orchestrator/src/tools/mcp-tool-manager.ts` - Use SchemaTranslator
- `packages/orchestrator/src/custom-tools.ts` - Refactor to use SchemaTranslator
- `packages/orchestrator/src/index.ts` - Export SchemaTranslator

## Related ADRs
- ADR-035: Claude Agent SDK Mock Utilities
- ADR-038: Tool Execution Hooks

## References
- [JSON Schema Draft 7 Specification](https://json-schema.org/draft-07/json-schema-release-notes.html)
- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- [Zod Documentation](https://zod.dev/)
- [Claude Agent SDK Documentation](https://docs.anthropic.com/claude-agent-sdk)
