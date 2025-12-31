/**
 * Compilation check for ToolRegistry and related components
 *
 * This file exists purely to verify that all our implementations
 * compile correctly with TypeScript. It imports everything and
 * performs basic type checking.
 */

// Test imports from the main ToolRegistry file
import {
  ToolRegistry,
  DuplicateToolError,
  ToolNotFoundError,
  ToolValidationError,
  getToolRegistry,
  registerTool,
  unregisterTool,
  type ToolRegistryEvents,
  type ToolRegistryEventListener,
  type ToolRegistryOptions,
} from '../tool-registry.js';

// Test imports from the base tool file
import {
  BaseTool,
  type ToolInterface,
  type ToolExecutionContext,
  type ValidationResult,
  type ToolResult,
  type BaseToolOptions,
  isToolInterface,
  isBaseTool,
} from '../base-tool.js';

// Test imports from types
import {
  type ToolDefinition,
  type ToolCategory,
  type ToolRegistryEntry,
  ToolDefinitionSchema,
  ToolRegistryEntrySchema,
} from '../../types.js';

// Test that all classes can be instantiated with correct types
function compilationCheck(): void {
  // Registry singleton check
  const registry1: ToolRegistry = ToolRegistry.getInstance();
  const registry2: ToolRegistry = getToolRegistry();

  // Type guards check
  const isInterface: boolean = isToolInterface({});
  const isBase: boolean = isBaseTool({});

  // Error classes check
  const duplicateError = new DuplicateToolError('test');
  const notFoundError = new ToolNotFoundError('test');
  const validationError = new ToolValidationError('test', ['error']);

  // Options interface check
  const options: ToolRegistryOptions = {
    allowOverwrite: false,
    validateOnRegister: true,
  };

  // Event listener type check
  const listener: ToolRegistryEventListener<'tool:registered'> = (data) => {
    const name: string = data.toolName;
    const definition: ToolDefinition = data.definition;
  };

  // Tool context type check
  const context: ToolExecutionContext = {
    taskId: 'test',
    agentName: 'test',
    workingDirectory: '/test',
  };

  // Validation result check
  const validResult: ValidationResult = {
    valid: true,
  };

  const invalidResult: ValidationResult = {
    valid: false,
    errors: ['test error'],
    warnings: ['test warning'],
  };

  console.log('✅ All types compile correctly');
}

// Example BaseTool implementation for type checking
class CompilationTestTool extends BaseTool<{ input: string }, string> {
  constructor() {
    super({
      name: 'CompilationTest',
      description: 'Test tool for compilation checking',
      category: 'custom',
      parameters: {
        type: 'object',
        properties: {
          input: { type: 'string', description: 'Test input' },
        },
        required: ['input'],
        additionalProperties: false,
      },
    });
  }

  protected async executeImpl(params: { input: string }): Promise<string> {
    return `Test output: ${params.input}`;
  }
}

// Test registry operations with proper typing
function registryOperationsCheck(): void {
  ToolRegistry.resetInstance();
  const registry = ToolRegistry.getInstance();
  const tool = new CompilationTestTool();

  // Type-safe registry operations
  registry.register(tool);
  const has: boolean = registry.has('CompilationTest');
  const entry: ToolRegistryEntry = registry.get('CompilationTest');
  const toolInterface: ToolInterface = registry.getToolInterface('CompilationTest');
  const allEntries: ToolRegistryEntry[] = registry.getAll();
  const categoryEntries: ToolRegistryEntry[] = registry.getByCategory('custom');
  const names: string[] = registry.getNames();
  const available: ToolRegistryEntry[] = registry.getAvailable();
  const definitions: ToolDefinition[] = registry.getDefinitions();
  const size: number = registry.size;

  // Event system type checking
  registry.on('tool:registered', (data) => {
    const toolName: string = data.toolName;
    const definition: ToolDefinition = data.definition;
  });

  registry.on('tool:unregistered', (data) => {
    const toolName: string = data.toolName;
  });

  registry.on('tool:availability-changed', (data) => {
    const toolName: string = data.toolName;
    const available: boolean = data.available;
    const reason: string | undefined = data.reason;
  });

  // Utility operations
  registry.setAvailability('CompilationTest', false, 'Test reason');
  registry.recordInvocation('CompilationTest', true);
  registry.unregister('CompilationTest');

  console.log('✅ All registry operations type-check correctly');
}

// Schema validation type checking
function schemaValidationCheck(): void {
  const definition: ToolDefinition = {
    name: 'TestTool',
    description: 'Test description',
    category: 'custom',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
  };

  const entry: ToolRegistryEntry = {
    definition,
    available: true,
    invocationCount: 0,
    successCount: 0,
    failureCount: 0,
  };

  // Zod schema validation (would throw on invalid data)
  const validatedDefinition = ToolDefinitionSchema.parse(definition);
  const validatedEntry = ToolRegistryEntrySchema.parse(entry);

  console.log('✅ All schema validations compile correctly');
}

// Export for potential external use
export {
  compilationCheck,
  registryOperationsCheck,
  schemaValidationCheck,
  CompilationTestTool,
};