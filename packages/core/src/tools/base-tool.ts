/**
 * @fileoverview BaseTool abstract class and ToolInterface
 *
 * This module provides the foundational abstractions for implementing custom tools
 * within the APEX platform. It follows a template method pattern where the abstract
 * class defines the execution lifecycle and concrete implementations provide the
 * specific behavior.
 *
 * ## Architecture Decision Record (ADR-014)
 *
 * ### Context
 * APEX needs a standardized way to define, validate, and execute tools that agents
 * can use during task execution. This requires:
 * - Consistent interface across all tools
 * - Parameter validation before execution
 * - Comprehensive tool metadata for the Claude Agent SDK
 * - Type-safe execution with proper error handling
 *
 * ### Decision
 * Implement an abstract `BaseTool` class that:
 * 1. Defines the contract via `ToolInterface`
 * 2. Uses existing Zod-based types from `types.ts` for consistency
 * 3. Provides template method pattern for execute lifecycle
 * 4. Supports both sync and async validation
 * 5. Integrates with the existing `ToolResult` and `ToolDefinition` types
 *
 * ### Consequences
 * - All tools will have consistent structure and behavior
 * - Validation is enforced before execution
 * - Easy integration with Claude Agent SDK via getDefinition()
 * - Concrete tool implementations focus only on business logic
 *
 * @module @apex/core/tools/base-tool
 */

import type {
  ToolDefinition,
  ToolResult,
  ToolCategory,
  ToolPermission,
  ToolParametersSchema,
  ToolExample,
} from '../types.js';

// ============================================================================
// Tool Interface
// ============================================================================

/**
 * Context passed to tool execution, providing runtime information
 * about the current task, agent, and workspace environment.
 */
export interface ToolExecutionContext {
  /** ID of the task that is invoking the tool */
  taskId?: string;
  /** Name of the agent invoking the tool */
  agentName?: string;
  /** Current workflow stage name */
  stageName?: string;
  /** Working directory for file operations */
  workingDirectory?: string;
  /** Environment variables available to the tool */
  environment?: Record<string, string>;
  /** Abort signal for cancellation support */
  signal?: AbortSignal;
  /** Timeout in milliseconds for this execution */
  timeout?: number;
}

/**
 * Validation result returned by the validate() method
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Error messages if validation failed */
  errors?: string[];
  /** Warning messages (validation passed but with concerns) */
  warnings?: string[];
}

/**
 * Interface defining the contract for all APEX tools.
 *
 * Tools are the primary way agents interact with the system and environment.
 * This interface ensures all tools provide:
 * - A definition for Claude Agent SDK integration
 * - Parameter validation before execution
 * - Consistent execution with proper result handling
 *
 * @template TInput - Type of the input parameters for this tool
 * @template TOutput - Type of the output data returned by this tool
 *
 * @example
 * ```typescript
 * interface ReadFileParams {
 *   path: string;
 *   encoding?: string;
 * }
 *
 * interface ReadFileOutput {
 *   content: string;
 *   size: number;
 * }
 *
 * class ReadFileTool implements ToolInterface<ReadFileParams, ReadFileOutput> {
 *   // ... implementation
 * }
 * ```
 */
export interface ToolInterface<
  TInput extends Record<string, unknown> = Record<string, unknown>,
  TOutput = unknown
> {
  /**
   * Returns the complete tool definition for Claude Agent SDK integration.
   *
   * This method should return a `ToolDefinition` that describes:
   * - Tool name and description
   * - Parameter schema (JSON Schema format)
   * - Permission requirements
   * - Category and tags for organization
   *
   * The definition is used by the Claude Agent SDK to understand what
   * the tool does and how to invoke it.
   *
   * @returns The tool definition conforming to ToolDefinition schema
   */
  getDefinition(): ToolDefinition;

  /**
   * Validates the input parameters before execution.
   *
   * This method should check:
   * - Required parameters are present
   * - Parameter types are correct
   * - Values are within acceptable ranges
   * - Any business logic constraints
   *
   * Validation should be fast and should not perform I/O operations.
   *
   * @param params - The parameters to validate
   * @param context - Optional execution context for context-aware validation
   * @returns Validation result indicating success or failure with errors
   */
  validate(
    params: TInput,
    context?: ToolExecutionContext
  ): Promise<ValidationResult> | ValidationResult;

  /**
   * Executes the tool with the given parameters.
   *
   * This is the main method that performs the tool's function.
   * It should:
   * - Assume parameters have been validated (but may do additional checks)
   * - Handle errors gracefully and return appropriate ToolResult
   * - Respect the abort signal if provided in context
   * - Include timing and metadata in the result
   *
   * @param params - The validated input parameters
   * @param context - Execution context with task/agent information
   * @returns A ToolResult containing the output or error information
   */
  execute(
    params: TInput,
    context?: ToolExecutionContext
  ): Promise<ToolResult<TOutput>>;
}

// ============================================================================
// Extended Tool Result Type
// ============================================================================

/**
 * Extended ToolResult with generic output type for type safety.
 * This extends the base ToolResult from types.ts with a typed output.
 */
export interface ToolResult<TOutput = unknown> {
  /** Whether the tool execution was successful */
  success: boolean;
  /** The output data from the tool */
  output?: TOutput;
  /** Error message if the execution failed */
  error?: string;
  /** Execution duration in milliseconds */
  duration?: number;
  /** Additional metadata about the execution */
  metadata?: Record<string, unknown>;
  /** Tool name that was executed */
  toolName?: string;
  /** Timestamp when the tool was invoked */
  invokedAt?: Date;
  /** Timestamp when the tool completed */
  completedAt?: Date;
}

// ============================================================================
// Base Tool Abstract Class
// ============================================================================

/**
 * Options for configuring a BaseTool instance.
 */
export interface BaseToolOptions {
  /** Tool name (must be unique within the tool registry) */
  name: string;
  /** Human-readable description of what the tool does */
  description: string;
  /** Category for organizing tools */
  category: ToolCategory;
  /** JSON Schema for tool parameters */
  parameters?: ToolParametersSchema;
  /** Whether this tool performs dangerous operations */
  dangerous?: boolean;
  /** Permission requirements */
  permissions?: ToolPermission[];
  /** Usage examples */
  examples?: ToolExample[];
  /** Version string (semver format) */
  version?: string;
  /** Whether the tool is enabled */
  enabled?: boolean;
  /** Tags for additional categorization */
  tags?: string[];
}

/**
 * Abstract base class for all APEX tools.
 *
 * This class implements the template method pattern, providing a consistent
 * execution lifecycle while allowing subclasses to implement the specific
 * tool behavior.
 *
 * ## Lifecycle
 * 1. `validate()` - Check parameters are valid
 * 2. `execute()` - Run the tool (internally calls executeImpl)
 * 3. Result returned with timing and metadata
 *
 * ## Subclassing
 * Subclasses must implement:
 * - `executeImpl()` - The actual tool logic
 * - Optionally override `validate()` for custom validation
 *
 * @template TInput - Type of the input parameters
 * @template TOutput - Type of the output data
 *
 * @example
 * ```typescript
 * class EchoTool extends BaseTool<{ message: string }, string> {
 *   constructor() {
 *     super({
 *       name: 'Echo',
 *       description: 'Echoes the input message back',
 *       category: 'custom',
 *       parameters: {
 *         type: 'object',
 *         properties: {
 *           message: { type: 'string', description: 'Message to echo' }
 *         },
 *         required: ['message']
 *       }
 *     });
 *   }
 *
 *   protected async executeImpl(
 *     params: { message: string }
 *   ): Promise<string> {
 *     return params.message;
 *   }
 * }
 * ```
 */
export abstract class BaseTool<
  TInput extends Record<string, unknown> = Record<string, unknown>,
  TOutput = unknown
> implements ToolInterface<TInput, TOutput> {
  /** Tool configuration options */
  protected readonly options: BaseToolOptions;

  /** Cached tool definition */
  private _definition: ToolDefinition | null = null;

  /**
   * Creates a new BaseTool instance.
   *
   * @param options - Configuration options for the tool
   */
  constructor(options: BaseToolOptions) {
    this.options = {
      dangerous: false,
      permissions: [],
      enabled: true,
      tags: [],
      parameters: {
        type: 'object',
        properties: {},
        required: [],
        additionalProperties: false,
      },
      ...options,
    };
  }

  /**
   * Returns the tool name.
   */
  get name(): string {
    return this.options.name;
  }

  /**
   * Returns whether the tool is enabled.
   */
  get enabled(): boolean {
    return this.options.enabled ?? true;
  }

  /**
   * Returns the tool category.
   */
  get category(): ToolCategory {
    return this.options.category;
  }

  /**
   * Returns the complete tool definition for Claude Agent SDK integration.
   *
   * The definition is cached after first call for performance.
   *
   * @returns The tool definition
   */
  getDefinition(): ToolDefinition {
    if (this._definition === null) {
      this._definition = {
        name: this.options.name,
        description: this.options.description,
        parameters: this.options.parameters ?? {
          type: 'object',
          properties: {},
          required: [],
          additionalProperties: false,
        },
        dangerous: this.options.dangerous ?? false,
        permissions: this.options.permissions ?? [],
        category: this.options.category,
        examples: this.options.examples,
        version: this.options.version,
        enabled: this.options.enabled ?? true,
        tags: this.options.tags,
      };
    }
    return this._definition;
  }

  /**
   * Validates the input parameters before execution.
   *
   * The default implementation performs basic validation:
   * - Checks that params is an object
   * - Verifies required parameters are present
   * - Validates parameter types match the schema
   *
   * Subclasses can override this for custom validation logic.
   *
   * @param params - The parameters to validate
   * @param _context - Optional execution context (unused in base implementation)
   * @returns Validation result
   */
  validate(
    params: TInput,
    _context?: ToolExecutionContext
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const schema = this.options.parameters;

    // Check params is an object
    if (typeof params !== 'object' || params === null) {
      return {
        valid: false,
        errors: ['Parameters must be an object'],
      };
    }

    // Check required parameters
    if (schema?.required) {
      for (const requiredParam of schema.required) {
        if (!(requiredParam in params)) {
          errors.push(`Missing required parameter: ${requiredParam}`);
        }
      }
    }

    // Validate parameter types
    if (schema?.properties) {
      for (const [name, propSchema] of Object.entries(schema.properties)) {
        const value = (params as Record<string, unknown>)[name];

        if (value !== undefined) {
          const typeError = this.validateType(name, value, propSchema);
          if (typeError) {
            errors.push(typeError);
          }
        }
      }
    }

    // Check for unknown parameters if additionalProperties is false
    if (schema?.additionalProperties === false && schema?.properties) {
      const knownProps = Object.keys(schema.properties);
      for (const key of Object.keys(params)) {
        if (!knownProps.includes(key)) {
          warnings.push(`Unknown parameter: ${key}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Validates a single parameter value against its schema.
   *
   * @param name - Parameter name
   * @param value - Parameter value
   * @param schema - Parameter schema
   * @returns Error message if invalid, undefined otherwise
   */
  private validateType(
    name: string,
    value: unknown,
    schema: { type?: string; enum?: unknown[] }
  ): string | undefined {
    if (!schema.type) {
      return undefined;
    }

    // Check enum values first
    if (schema.enum && !schema.enum.includes(value)) {
      return `Parameter '${name}' must be one of: ${schema.enum.join(', ')}`;
    }

    // Type validation
    switch (schema.type) {
      case 'string':
        if (typeof value !== 'string') {
          return `Parameter '${name}' must be a string`;
        }
        break;
      case 'number':
      case 'integer':
        if (typeof value !== 'number') {
          return `Parameter '${name}' must be a number`;
        }
        if (schema.type === 'integer' && !Number.isInteger(value)) {
          return `Parameter '${name}' must be an integer`;
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean') {
          return `Parameter '${name}' must be a boolean`;
        }
        break;
      case 'object':
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          return `Parameter '${name}' must be an object`;
        }
        break;
      case 'array':
        if (!Array.isArray(value)) {
          return `Parameter '${name}' must be an array`;
        }
        break;
      case 'null':
        if (value !== null) {
          return `Parameter '${name}' must be null`;
        }
        break;
    }

    return undefined;
  }

  /**
   * Executes the tool with the given parameters.
   *
   * This method implements the template method pattern:
   * 1. Records start time
   * 2. Validates parameters (fails fast if invalid)
   * 3. Calls the abstract executeImpl method
   * 4. Wraps result in ToolResult with timing metadata
   *
   * @param params - The input parameters
   * @param context - Optional execution context
   * @returns A ToolResult containing the output or error
   */
  async execute(
    params: TInput,
    context?: ToolExecutionContext
  ): Promise<ToolResult<TOutput>> {
    const invokedAt = new Date();
    const startTime = performance.now();

    try {
      // Validate parameters first
      const validation = await Promise.resolve(this.validate(params, context));
      if (!validation.valid) {
        return {
          success: false,
          error: `Validation failed: ${validation.errors?.join('; ')}`,
          toolName: this.name,
          invokedAt,
          completedAt: new Date(),
          duration: performance.now() - startTime,
        };
      }

      // Check abort signal before execution
      if (context?.signal?.aborted) {
        return {
          success: false,
          error: 'Execution aborted',
          toolName: this.name,
          invokedAt,
          completedAt: new Date(),
          duration: performance.now() - startTime,
        };
      }

      // Execute the tool implementation
      const output = await this.executeImpl(params, context);

      const completedAt = new Date();
      return {
        success: true,
        output,
        toolName: this.name,
        invokedAt,
        completedAt,
        duration: performance.now() - startTime,
      };
    } catch (error) {
      const completedAt = new Date();
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        success: false,
        error: errorMessage,
        toolName: this.name,
        invokedAt,
        completedAt,
        duration: performance.now() - startTime,
        metadata: {
          errorType: error instanceof Error ? error.constructor.name : 'Unknown',
          stack: error instanceof Error ? error.stack : undefined,
        },
      };
    }
  }

  /**
   * Abstract method that subclasses must implement.
   *
   * This is where the actual tool logic lives. The method receives
   * validated parameters and should return the output directly.
   * Any errors should be thrown and will be caught by execute().
   *
   * @param params - The validated input parameters
   * @param context - Optional execution context
   * @returns The tool output
   * @throws Error if execution fails
   */
  protected abstract executeImpl(
    params: TInput,
    context?: ToolExecutionContext
  ): Promise<TOutput>;
}

// ============================================================================
// Type Helpers
// ============================================================================

/**
 * Extracts the input type from a BaseTool class
 */
export type ToolInputType<T> = T extends BaseTool<infer TInput, unknown>
  ? TInput
  : never;

/**
 * Extracts the output type from a BaseTool class
 */
export type ToolOutputType<T> = T extends BaseTool<Record<string, unknown>, infer TOutput>
  ? TOutput
  : never;

/**
 * Type guard to check if an object implements ToolInterface
 */
export function isToolInterface(obj: unknown): obj is ToolInterface {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'getDefinition' in obj &&
    typeof (obj as ToolInterface).getDefinition === 'function' &&
    'validate' in obj &&
    typeof (obj as ToolInterface).validate === 'function' &&
    'execute' in obj &&
    typeof (obj as ToolInterface).execute === 'function'
  );
}

/**
 * Type guard to check if an object is a BaseTool instance
 */
export function isBaseTool(obj: unknown): obj is BaseTool {
  return obj instanceof BaseTool;
}
