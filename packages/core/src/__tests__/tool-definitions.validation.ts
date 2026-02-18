/**
 * Validation script for tool definition types
 * This file can be run with TypeScript compiler to ensure type safety
 */

import {
  ToolCategorySchema,
  ToolPermissionSchema,
  JSONSchemaTypeSchema,
  ToolParameterSchema,
  ToolParametersSchemaSchema,
  ToolExampleSchema,
  ToolDefinitionSchema,
  ToolResultSchema,
  ToolInvocationSchema,
  ToolRegistryEntrySchema,
  type ToolCategory,
  type ToolPermission,
  type JSONSchemaType,
  type ToolParameter,
  type ToolParametersSchema,
  type ToolExample,
  type ToolDefinition,
  type ToolResult,
  type ToolInvocation,
  type ToolRegistryEntry,
} from '../types.js';

// Type-level validation - ensures all types can be imported and used
function validateTypes() {
  // Test that all enum values are correctly typed
  const categories: ToolCategory[] = ['filesystem', 'search', 'shell', 'web', 'system', 'custom'];
  const permissions: ToolPermission[] = ['read', 'write', 'execute', 'network', 'admin'];
  const jsonTypes: JSONSchemaType[] = ['string', 'number', 'integer', 'boolean', 'object', 'array', 'null'];

  // Test that schemas can be used for validation
  const sampleToolDefinition: ToolDefinition = {
    name: 'TestTool',
    description: 'A test tool for validation',
    parameters: {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'Input parameter' },
      },
      required: ['input'],
    },
    category: 'custom',
    dangerous: false,
    permissions: ['read'],
    enabled: true,
  };

  // Validate with Zod schema
  try {
    ToolDefinitionSchema.parse(sampleToolDefinition);
    console.log('✅ ToolDefinition validation successful');
  } catch (error) {
    console.error('❌ ToolDefinition validation failed:', error);
  }

  // Test invocation type
  const sampleInvocation: ToolInvocation = {
    toolName: 'TestTool',
    parameters: { input: 'test value' },
    timeout: 5000,
  };

  try {
    ToolInvocationSchema.parse(sampleInvocation);
    console.log('✅ ToolInvocation validation successful');
  } catch (error) {
    console.error('❌ ToolInvocation validation failed:', error);
  }

  // Test result type
  const sampleResult: ToolResult = {
    success: true,
    output: { data: 'result' },
    duration: 100,
  };

  try {
    ToolResultSchema.parse(sampleResult);
    console.log('✅ ToolResult validation successful');
  } catch (error) {
    console.error('❌ ToolResult validation failed:', error);
  }

  // Test registry entry
  const sampleRegistry: ToolRegistryEntry = {
    definition: sampleToolDefinition,
    available: true,
    invocationCount: 5,
    successCount: 4,
    failureCount: 1,
  };

  try {
    ToolRegistryEntrySchema.parse(sampleRegistry);
    console.log('✅ ToolRegistryEntry validation successful');
  } catch (error) {
    console.error('❌ ToolRegistryEntry validation failed:', error);
  }

  return {
    categories,
    permissions,
    jsonTypes,
    sampleToolDefinition,
    sampleInvocation,
    sampleResult,
    sampleRegistry,
  };
}

// Export for testing purposes
export { validateTypes };

// If run directly, execute validation
if (typeof module !== 'undefined' && require.main === module) {
  validateTypes();
}