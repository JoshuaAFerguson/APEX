/**
 * MockToolBuilder - Fluent builder for creating mock tool definitions
 *
 * Provides an intuitive builder pattern for configuring mock tools with
 * various response types, error simulation, delays, and dynamic handlers.
 */

import { z } from 'zod';
import type {
  MockToolDefinition,
  MockToolConfig,
  MockToolResult,
  MockToolHandler,
  MockToolContent,
} from './tool-mock.types';

/**
 * Fluent builder for creating mock tool definitions
 *
 * @example
 * ```typescript
 * const readTool = new MockToolBuilder('Read')
 *   .withDescription('Read file contents')
 *   .withSchema({ file_path: z.string() })
 *   .withResponse({
 *     content: [{ type: 'text', text: 'file content' }],
 *     isError: false,
 *   })
 *   .build();
 * ```
 *
 * @example
 * ```typescript
 * const apiTool = createMockTool('API')
 *   .withTextResponse('success')
 *   .withErrorOn(3, new Error('Rate limit exceeded'))
 *   .withDelay(100)
 *   .build();
 * ```
 */
export class MockToolBuilder {
  private name: string;
  private description: string = '';
  private schema: z.ZodObject<Record<string, z.ZodTypeAny>> = z.object({});
  private config: MockToolConfig = {};

  constructor(name: string) {
    this.name = name;
  }

  /**
   * Set the tool description
   *
   * @param description - Human-readable tool description
   * @returns This builder for chaining
   */
  withDescription(description: string): this {
    this.description = description;
    return this;
  }

  /**
   * Set the tool input schema using Zod schema object
   *
   * @param schema - Zod object schema for input validation
   * @returns This builder for chaining
   */
  withSchema(schema: z.ZodObject<Record<string, z.ZodTypeAny>>): this {
    this.schema = schema;
    return this;
  }

  /**
   * Set the tool input schema using shape definition
   *
   * @param shape - Object shape with Zod type definitions
   * @returns This builder for chaining
   *
   * @example
   * ```typescript
   * builder.withSchemaShape({
   *   file_path: z.string(),
   *   content: z.string().optional(),
   *   mode: z.enum(['create', 'append']).default('create')
   * })
   * ```
   */
  withSchemaShape(shape: Record<string, z.ZodTypeAny>): this {
    this.schema = z.object(shape);
    return this;
  }

  /**
   * Set a static response
   *
   * @param response - Complete mock tool result
   * @returns This builder for chaining
   */
  withResponse(response: MockToolResult): this {
    this.config.response = response;
    return this;
  }

  /**
   * Set a text response (convenience method)
   *
   * @param text - Text content for the response
   * @param isError - Whether this represents an error response
   * @returns This builder for chaining
   */
  withTextResponse(text: string, isError = false): this {
    this.config.response = {
      content: [{ type: 'text', text }],
      isError,
    };
    return this;
  }

  /**
   * Set an image response (convenience method)
   *
   * @param base64Data - Base64 encoded image data
   * @param mediaType - MIME type of the image
   * @param isError - Whether this represents an error response
   * @returns This builder for chaining
   */
  withImageResponse(base64Data: string, mediaType: string, isError = false): this {
    this.config.response = {
      content: [{
        type: 'image',
        source: { type: 'base64', media_type: mediaType, data: base64Data }
      }],
      isError,
    };
    return this;
  }

  /**
   * Set a resource response (convenience method)
   *
   * @param uri - Resource URI
   * @param mimeType - Optional MIME type
   * @param text - Optional text content
   * @param isError - Whether this represents an error response
   * @returns This builder for chaining
   */
  withResourceResponse(uri: string, mimeType?: string, text?: string, isError = false): this {
    this.config.response = {
      content: [{
        type: 'resource',
        resource: { uri, mimeType, text }
      }],
      isError,
    };
    return this;
  }

  /**
   * Set a mixed content response
   *
   * @param content - Array of different content types
   * @param structuredContent - Optional structured data
   * @param isError - Whether this represents an error response
   * @returns This builder for chaining
   */
  withMixedResponse(content: MockToolContent[], structuredContent?: Record<string, unknown>, isError = false): this {
    this.config.response = {
      content,
      structuredContent,
      isError,
    };
    return this;
  }

  /**
   * Set a dynamic handler function
   *
   * @param handler - Function to generate responses dynamically
   * @returns This builder for chaining
   *
   * @example
   * ```typescript
   * builder.withDynamicHandler((args, context) => ({
   *   content: [{ type: 'text', text: `Processed ${args.file_path}` }],
   *   structuredContent: {
   *     processedAt: context.timestamp,
   *     invocationNumber: context.invocationCount
   *   }
   * }))
   * ```
   */
  withDynamicHandler(handler: MockToolHandler): this {
    this.config.handler = handler;
    return this;
  }

  /**
   * Set a sequence of responses to cycle through
   *
   * @param responses - Array of responses to return in order
   * @returns This builder for chaining
   *
   * @example
   * ```typescript
   * builder.withSequence([
   *   { content: [{ type: 'text', text: 'initializing' }] },
   *   { content: [{ type: 'text', text: 'processing' }] },
   *   { content: [{ type: 'text', text: 'complete' }] }
   * ])
   * ```
   */
  withSequence(responses: MockToolResult[]): this {
    this.config.responseSequence = [...responses];
    return this;
  }

  /**
   * Set a sequence of text responses (convenience method)
   *
   * @param texts - Array of text responses
   * @returns This builder for chaining
   */
  withTextSequence(texts: string[]): this {
    this.config.responseSequence = texts.map(text => ({
      content: [{ type: 'text', text }],
      isError: false,
    }));
    return this;
  }

  /**
   * Set response delay in milliseconds
   *
   * @param ms - Delay in milliseconds
   * @returns This builder for chaining
   */
  withDelay(ms: number): this {
    this.config.delay = ms;
    return this;
  }

  /**
   * Schedule an error on a specific invocation number
   *
   * @param callNumber - The invocation number (1-based) to throw error
   * @param error - Error to throw
   * @returns This builder for chaining
   *
   * @example
   * ```typescript
   * builder
   *   .withTextResponse('success')
   *   .withErrorOn(3, new Error('Rate limit exceeded'))
   *   .withErrorOn(5, new Error('Timeout'))
   * ```
   */
  withErrorOn(callNumber: number, error: Error): this {
    if (!this.config.errorOnCall) {
      this.config.errorOnCall = [];
    }
    this.config.errorOnCall.push({ callNumber, error });
    return this;
  }

  /**
   * Schedule multiple errors on different invocations
   *
   * @param errorSchedule - Array of call number and error pairs
   * @returns This builder for chaining
   */
  withErrorSchedule(errorSchedule: Array<{ callNumber: number; error: Error }>): this {
    if (!this.config.errorOnCall) {
      this.config.errorOnCall = [];
    }
    this.config.errorOnCall.push(...errorSchedule);
    return this;
  }

  /**
   * Set maximum number of invocations allowed
   *
   * @param max - Maximum invocation count
   * @returns This builder for chaining
   */
  withMaxInvocations(max: number): this {
    this.config.maxInvocations = max;
    return this;
  }

  /**
   * Configure the tool to always throw an error
   *
   * @param error - Error to always throw
   * @returns This builder for chaining
   */
  alwaysThrow(error: Error): this {
    this.config.handler = () => {
      throw error;
    };
    return this;
  }

  /**
   * Configure the tool to throw an error with a specific message
   *
   * @param message - Error message
   * @returns This builder for chaining
   */
  alwaysThrowWithMessage(message: string): this {
    return this.alwaysThrow(new Error(message));
  }

  /**
   * Configure the tool to simulate network timeouts
   *
   * @param timeoutMs - Timeout duration in milliseconds
   * @returns This builder for chaining
   */
  withTimeout(timeoutMs: number): this {
    this.config.handler = async () => {
      await new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
      );
      // This should never be reached
      return { content: [{ type: 'text', text: 'timeout' }] };
    };
    return this;
  }

  /**
   * Configure the tool to simulate random failures
   *
   * @param failureRate - Failure rate between 0 and 1
   * @param error - Error to throw on failure
   * @returns This builder for chaining
   */
  withRandomFailures(failureRate: number, error: Error = new Error('Random failure')): this {
    if (failureRate < 0 || failureRate > 1) {
      throw new Error('Failure rate must be between 0 and 1');
    }

    const originalHandler = this.config.handler;
    const originalResponse = this.config.response;

    this.config.handler = async (args, context) => {
      if (Math.random() < failureRate) {
        throw error;
      }

      if (originalHandler) {
        return originalHandler(args, context);
      } else if (originalResponse) {
        return originalResponse;
      } else {
        return { content: [{ type: 'text', text: `Mock result for ${context.toolName}` }] };
      }
    };

    return this;
  }

  /**
   * Configure the tool to log all invocations
   *
   * @param logger - Optional custom logger function
   * @returns This builder for chaining
   */
  withLogging(logger?: (toolName: string, args: Record<string, unknown>, result: MockToolResult) => void): this {
    const originalHandler = this.config.handler;
    const originalResponse = this.config.response;
    const defaultLogger = logger || ((name, args, result) => {
      console.log(`[MockTool:${name}]`, { args, result });
    });

    this.config.handler = async (args, context) => {
      let result: MockToolResult;

      if (originalHandler) {
        result = await originalHandler(args, context);
      } else if (originalResponse) {
        result = originalResponse;
      } else {
        result = { content: [{ type: 'text', text: `Mock result for ${context.toolName}` }] };
      }

      defaultLogger(context.toolName, args, result);
      return result;
    };

    return this;
  }

  /**
   * Build the tool definition
   *
   * @returns The complete mock tool definition
   */
  build(): MockToolDefinition {
    return {
      name: this.name,
      description: this.description,
      schema: this.schema,
      config: { ...this.config },
    };
  }

  /**
   * Build and return just the configuration
   *
   * @returns The mock tool configuration
   */
  buildConfig(): MockToolConfig {
    return { ...this.config };
  }

  /**
   * Clone this builder with all current configuration
   *
   * @param newName - Optional new name for the cloned tool
   * @returns A new builder instance with the same configuration
   */
  clone(newName?: string): MockToolBuilder {
    const cloned = new MockToolBuilder(newName || this.name);
    cloned.description = this.description;
    cloned.schema = this.schema;
    cloned.config = {
      ...this.config,
      responseSequence: this.config.responseSequence ? [...this.config.responseSequence] : undefined,
      errorOnCall: this.config.errorOnCall ? [...this.config.errorOnCall] : undefined,
    };
    return cloned;
  }
}

/**
 * Convenience function to create a MockToolBuilder
 *
 * @param name - The tool name
 * @returns A new MockToolBuilder instance
 *
 * @example
 * ```typescript
 * const tool = createMockTool('Read')
 *   .withTextResponse('file content')
 *   .build();
 * ```
 */
export function createMockTool(name: string): MockToolBuilder {
  return new MockToolBuilder(name);
}

/**
 * Convenience function to create a tool with just text response
 *
 * @param name - The tool name
 * @param text - The response text
 * @param isError - Whether this is an error response
 * @returns Complete tool definition
 */
export function createSimpleTextTool(name: string, text: string, isError = false): MockToolDefinition {
  return createMockTool(name)
    .withTextResponse(text, isError)
    .build();
}

/**
 * Convenience function to create a tool that always fails
 *
 * @param name - The tool name
 * @param error - The error to throw
 * @returns Complete tool definition
 */
export function createFailingTool(name: string, error: Error): MockToolDefinition {
  return createMockTool(name)
    .alwaysThrow(error)
    .build();
}

/**
 * Convenience function to create a tool with response sequence
 *
 * @param name - The tool name
 * @param texts - Array of text responses
 * @returns Complete tool definition
 */
export function createSequenceTool(name: string, texts: string[]): MockToolDefinition {
  return createMockTool(name)
    .withTextSequence(texts)
    .build();
}