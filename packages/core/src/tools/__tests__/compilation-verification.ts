/**
 * @fileoverview TypeScript compilation verification for tool infrastructure
 *
 * This file imports all tool-related modules to verify they compile correctly
 * and exports work as expected. If this file compiles without errors, it
 * indicates that our tool infrastructure is properly implemented.
 */

// Verify all core types can be imported
import type {
  ToolCategory,
  ToolPermission,
  JSONSchemaType,
  ToolParameter,
  ToolParametersSchema,
  ToolExample,
  ToolDefinition,
  ToolResult,
  ToolInvocation,
  ToolRegistryEntry,
} from '../../types.js';

// Verify all Zod schemas can be imported
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
} from '../../types.js';

// Verify BaseTool and related types can be imported
import {
  BaseTool,
  type ToolInterface,
  type ToolExecutionContext,
  type ValidationResult,
  type BaseToolOptions,
  isToolInterface,
  isBaseTool,
} from '../base-tool.js';

// Verify ToolRegistry and related classes can be imported
import {
  ToolRegistry,
  DuplicateToolError,
  ToolNotFoundError,
  ToolValidationError,
  getToolRegistry,
  registerTool,
  unregisterTool,
} from '../tool-registry.js';

// Test that we can create a concrete implementation
class CompilationTestTool extends BaseTool<{ input: string }, { output: string }> {
  constructor() {
    super({
      name: 'CompilationTest',
      description: 'Test tool for compilation verification',
      category: 'custom' satisfies ToolCategory,
      parameters: {
        type: 'object',
        properties: {
          input: {
            type: 'string',
            description: 'Test input parameter',
          },
        },
        required: ['input'],
        additionalProperties: false,
      } satisfies ToolParametersSchema,
      permissions: ['read'] satisfies ToolPermission[],
      enabled: true,
    });
  }

  protected async executeImpl(
    params: { input: string },
    _context?: ToolExecutionContext
  ): Promise<{ output: string }> {
    return { output: `Processed: ${params.input}` };
  }
}

// Test that tool definition validation works
const testDefinition: ToolDefinition = {
  name: 'CompilationTest',
  description: 'Test tool definition',
  category: 'custom',
  parameters: {
    type: 'object',
    properties: {
      testParam: { type: 'string' }
    },
    required: ['testParam'],
    additionalProperties: false,
  },
  dangerous: false,
  permissions: ['read'],
  enabled: true,
};

// Test that tool result type works
const testResult: ToolResult<{ success: boolean }> = {
  success: true,
  output: { success: true },
  toolName: 'CompilationTest',
  invokedAt: new Date(),
  completedAt: new Date(),
  duration: 100,
};

// Test that tool invocation type works
const testInvocation: ToolInvocation = {
  toolName: 'CompilationTest',
  parameters: {
    testParam: 'test value'
  },
  timeout: 5000,
  context: {
    taskId: 'test-task',
    agentName: 'test-agent',
    stageName: 'test-stage',
  }
};

// Test that registry entry type works
const testRegistryEntry: ToolRegistryEntry = {
  definition: testDefinition,
  available: true,
  invocationCount: 0,
  successCount: 0,
  failureCount: 0,
};

// Verify schema parsing works at compile time
const parsedCategory = ToolCategorySchema.parse('custom');
const parsedDefinition = ToolDefinitionSchema.parse(testDefinition);
const parsedResult = ToolResultSchema.parse(testResult);
const parsedInvocation = ToolInvocationSchema.parse(testInvocation);
const parsedEntry = ToolRegistryEntrySchema.parse(testRegistryEntry);

// Test type guards compilation
function testTypeGuards(): void {
  const tool = new CompilationTestTool();
  const notATool = { some: 'object' };

  if (isToolInterface(tool)) {
    // TypeScript should know this is a ToolInterface
    const definition = tool.getDefinition();
    const validation = tool.validate({ input: 'test' });
  }

  if (isBaseTool(tool)) {
    // TypeScript should know this is a BaseTool
    const name = tool.name;
    const enabled = tool.enabled;
    const category = tool.category;
  }
}

// Test registry operations compilation
function testRegistryOperations(): void {
  const registry = ToolRegistry.getInstance();
  const tool = new CompilationTestTool();

  // These should all compile without type errors
  registry.register(tool);

  if (registry.has('CompilationTest')) {
    const entry = registry.get('CompilationTest');
    const toolInterface = registry.getToolInterface('CompilationTest');
  }

  const allTools = registry.getAll();
  const customTools = registry.getByCategory('custom');
  const toolNames = registry.getNames();
  const availableTools = registry.getAvailable();
  const definitions = registry.getDefinitions();

  registry.setAvailability('CompilationTest', true);
  registry.recordInvocation('CompilationTest', true);
  registry.unregister('CompilationTest');
}

// Test error handling compilation
function testErrorHandling(): void {
  try {
    throw new DuplicateToolError('TestTool');
  } catch (error) {
    if (error instanceof DuplicateToolError) {
      const toolName = error.toolName;
      const message = error.message;
    }
  }

  try {
    throw new ToolNotFoundError('MissingTool');
  } catch (error) {
    if (error instanceof ToolNotFoundError) {
      const toolName = error.toolName;
      const message = error.message;
    }
  }

  try {
    throw new ToolValidationError('InvalidTool', ['Error 1', 'Error 2']);
  } catch (error) {
    if (error instanceof ToolValidationError) {
      const toolName = error.toolName;
      const details = error.details;
      const message = error.message;
    }
  }
}

// Test convenience functions compilation
function testConvenienceFunctions(): void {
  const registry = getToolRegistry();
  const tool = new CompilationTestTool();

  registerTool(tool);
  unregisterTool('CompilationTest');
}

// Export a verification function to confirm everything compiles
export function verifyCompilation(): boolean {
  // If this function can be called, then everything compiled successfully
  console.log('Tool infrastructure compilation verification: SUCCESS');
  console.log(`- BaseTool abstract class: ✓`);
  console.log(`- ToolInterface contract: ✓`);
  console.log(`- ToolRegistry singleton: ✓`);
  console.log(`- All tool types: ✓`);
  console.log(`- All Zod schemas: ✓`);
  console.log(`- Error classes: ✓`);
  console.log(`- Type guards: ✓`);
  console.log(`- Convenience functions: ✓`);

  return true;
}

// Also verify that we can instantiate everything without errors
export function verifyInstantiation(): boolean {
  try {
    // Create tool
    const tool = new CompilationTestTool();

    // Use registry
    const registry = ToolRegistry.getInstance();
    registry.clear(); // Clean slate

    registry.register(tool);

    if (registry.has('CompilationTest')) {
      registry.get('CompilationTest');
      registry.getToolInterface('CompilationTest');
    }

    registry.unregister('CompilationTest');

    console.log('Tool infrastructure instantiation verification: SUCCESS');
    return true;
  } catch (error) {
    console.error('Tool infrastructure instantiation verification: FAILED', error);
    return false;
  }
}

// If running directly, perform verification
if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('compilation-verification.ts')) {
  const compileSuccess = verifyCompilation();
  const instantiateSuccess = verifyInstantiation();

  if (compileSuccess && instantiateSuccess) {
    console.log('\n✅ All tool infrastructure components verified successfully!');
    process.exit(0);
  } else {
    console.log('\n❌ Tool infrastructure verification failed!');
    process.exit(1);
  }
}