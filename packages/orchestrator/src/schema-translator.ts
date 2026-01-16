/**
 * MCP Schema to Claude Agent SDK Tool Format Translator
 *
 * Converts MCP JSON Schema tool definitions to Claude Agent SDK Zod schemas
 * for parameter validation and tool execution.
 *
 * @module orchestrator/schema-translator
 */

import { z } from 'zod';
import type { MCPTool, MCPToolSchema, JSONSchemaType, ToolParameter } from '@apexcli/core';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Extended JSON Schema property definition for MCP tools
 * Based on the existing ToolParameter type with additional JSON Schema Draft 7 features
 */
export interface JSONSchemaProperty extends ToolParameter {
  type?: JSONSchemaType | JSONSchemaType[];
  const?: unknown;
  properties?: Record<string, JSONSchemaProperty>;
  items?: JSONSchemaProperty;
  required?: string[];
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;
  format?: string;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  minProperties?: number;
  maxProperties?: number;
  additionalProperties?: boolean | JSONSchemaProperty;
  oneOf?: JSONSchemaProperty[];
  anyOf?: JSONSchemaProperty[];
  allOf?: JSONSchemaProperty[];
}

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

// ============================================================================
// SchemaTranslator Class
// ============================================================================

/**
 * SchemaTranslator - Converts MCP JSON Schema to Claude Agent SDK Zod schemas
 */
export class SchemaTranslator {
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

  /**
   * Translate a complete MCP tool to Claude Agent SDK format
   */
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

  /**
   * Translate just the input schema to a Zod object schema
   */
  translateInputSchema(schema: MCPToolSchema): z.ZodObject<z.ZodRawShape> {
    const shape: z.ZodRawShape = {};
    const required = new Set(schema.required || []);
    const properties = schema.properties || {};

    for (const [key, prop] of Object.entries(properties)) {
      const isRequired = required.has(key) && !this.options.allOptional;
      const zodType = this.translateProperty(prop as JSONSchemaProperty, isRequired);
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

  /**
   * Translate a single JSON Schema property to Zod
   */
  translateProperty(property: JSONSchemaProperty, isRequired: boolean): z.ZodTypeAny {
    // Check for custom handler first
    if (property.type && typeof property.type === 'string' && this.options.customTypeHandlers.has(property.type)) {
      return this.options.customTypeHandlers.get(property.type)!(property);
    }

    let schema = this.translateBaseType(property);

    // Apply default if present and option enabled
    if (this.options.preserveDefaults && property.default !== undefined) {
      schema = schema.default(property.default);
    }

    return schema;
  }

  // ==========================================================================
  // Private Type Translation Methods
  // ==========================================================================

  private translateBaseType(property: JSONSchemaProperty): z.ZodTypeAny {
    // Handle const first (overrides type and enum)
    if (property.const !== undefined) {
      return z.literal(property.const);
    }

    // Handle enum first (overrides type-based handling)
    if (property.enum) {
      return this.translateEnum(property);
    }

    // Handle oneOf/anyOf/allOf
    if (property.oneOf || property.anyOf) {
      return this.translateUnion(property.oneOf || property.anyOf || []);
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

  private translateEnum(property: JSONSchemaProperty): z.ZodTypeAny {
    const enumValues = property.enum!;

    if (enumValues.length === 0) {
      return z.never();
    }

    // Check if all enum values are the same type
    const firstType = typeof enumValues[0];
    const allSameType = enumValues.every(val => typeof val === firstType);

    if (allSameType && firstType === 'string') {
      const stringValues = enumValues as string[];
      return z.enum(stringValues as [string, ...string[]]);
    }

    // Mixed types, use union of literals
    return z.union(enumValues.map(val => z.literal(val)) as [z.ZodLiteral<any>, ...z.ZodLiteral<any>[]]);
  }

  private translateUnion(schemas: JSONSchemaProperty[]): z.ZodTypeAny {
    if (schemas.length === 0) {
      return z.never();
    }

    if (schemas.length === 1) {
      return this.translateBaseType(schemas[0]);
    }

    const zodSchemas = schemas.map(schema => this.translateBaseType(schema));
    return z.union(zodSchemas as [z.ZodTypeAny, ...z.ZodTypeAny[]]);
  }

  private translateIntersection(schemas: JSONSchemaProperty[]): z.ZodTypeAny {
    if (schemas.length === 0) {
      return z.unknown();
    }

    if (schemas.length === 1) {
      return this.translateBaseType(schemas[0]);
    }

    // Start with the first schema and intersect with the rest
    let result = this.translateBaseType(schemas[0]);
    for (let i = 1; i < schemas.length; i++) {
      const nextSchema = this.translateBaseType(schemas[i]);
      result = z.intersection(result, nextSchema);
    }

    return result;
  }

  private translateNullableType(property: JSONSchemaProperty): z.ZodTypeAny {
    const types = Array.isArray(property.type) ? property.type : [property.type];

    // Extract null from the type array
    const nonNullTypes = types.filter(t => t !== 'null');
    const isNullable = types.includes('null');

    if (nonNullTypes.length === 0) {
      return z.null();
    }

    if (nonNullTypes.length === 1) {
      const schema = this.translateBaseType({ ...property, type: nonNullTypes[0] });
      return isNullable ? schema.nullable() : schema;
    }

    // Multiple non-null types, create union
    const schemas = nonNullTypes.map(type =>
      this.translateBaseType({ ...property, type })
    );

    const unionSchema = z.union(schemas as [z.ZodTypeAny, ...z.ZodTypeAny[]]);
    return isNullable ? unionSchema.nullable() : unionSchema;
  }

  private translateString(property: JSONSchemaProperty): z.ZodTypeAny {
    let schema = z.string();

    if (property.minLength !== undefined) {
      schema = schema.min(property.minLength);
    }

    if (property.maxLength !== undefined) {
      schema = schema.max(property.maxLength);
    }

    if (property.pattern) {
      try {
        schema = schema.regex(new RegExp(property.pattern));
      } catch (error) {
        console.warn(`Invalid regex pattern "${property.pattern}":`, error);
      }
    }

    // Handle format constraints
    if (property.format) {
      switch (property.format) {
        case 'email':
          schema = schema.email();
          break;
        case 'url':
        case 'uri':
          schema = schema.url();
          break;
        case 'uuid':
          schema = schema.uuid();
          break;
        case 'date-time':
          schema = schema.datetime();
          break;
        // Add more format validations as needed
        default:
          // Unknown format, no additional validation
          break;
      }
    }

    return schema;
  }

  private translateNumber(property: JSONSchemaProperty): z.ZodTypeAny {
    let schema = z.number();

    if (property.minimum !== undefined) {
      schema = schema.min(property.minimum);
    }

    if (property.maximum !== undefined) {
      schema = schema.max(property.maximum);
    }

    if (property.exclusiveMinimum !== undefined) {
      schema = schema.gt(property.exclusiveMinimum);
    }

    if (property.exclusiveMaximum !== undefined) {
      schema = schema.lt(property.exclusiveMaximum);
    }

    if (property.multipleOf !== undefined) {
      schema = schema.multipleOf(property.multipleOf);
    }

    return schema;
  }

  private translateInteger(property: JSONSchemaProperty): z.ZodTypeAny {
    let schema = z.number().int();

    if (property.minimum !== undefined) {
      schema = schema.min(property.minimum);
    }

    if (property.maximum !== undefined) {
      schema = schema.max(property.maximum);
    }

    if (property.exclusiveMinimum !== undefined) {
      schema = schema.gt(property.exclusiveMinimum);
    }

    if (property.exclusiveMaximum !== undefined) {
      schema = schema.lt(property.exclusiveMaximum);
    }

    if (property.multipleOf !== undefined) {
      schema = schema.multipleOf(property.multipleOf);
    }

    return schema;
  }

  private translateArray(property: JSONSchemaProperty): z.ZodTypeAny {
    // Handle items schema
    const itemSchema = property.items
      ? this.translateBaseType(property.items)
      : z.unknown();

    let schema = z.array(itemSchema);

    if (property.minItems !== undefined) {
      schema = schema.min(property.minItems);
    }

    if (property.maxItems !== undefined) {
      schema = schema.max(property.maxItems);
    }

    // Note: Zod doesn't have built-in uniqueItems validation
    // This would require a custom refinement if needed

    return schema;
  }

  private translateNestedObject(property: JSONSchemaProperty): z.ZodTypeAny {
    if (!property.properties || Object.keys(property.properties).length === 0) {
      // No properties defined, use record type
      return z.record(z.unknown());
    }

    const shape: z.ZodRawShape = {};
    const required = new Set(property.required || []);

    for (const [key, prop] of Object.entries(property.properties)) {
      const isRequired = required.has(key) && !this.options.allOptional;
      const zodType = this.translateProperty(prop, isRequired);
      shape[key] = isRequired ? zodType : zodType.optional();
    }

    let objectSchema = z.object(shape);

    // Handle additional properties
    if (this.options.allowAdditionalProperties || property.additionalProperties === true) {
      objectSchema = objectSchema.passthrough();
    } else {
      objectSchema = objectSchema.strict();
    }

    return objectSchema;
  }
}