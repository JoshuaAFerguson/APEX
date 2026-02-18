/**
 * @fileoverview Integration tests for BaseTool and ToolInterface
 *
 * These tests verify that the BaseTool and ToolInterface work correctly
 * within the broader APEX ecosystem, including:
 * - Integration with existing type system
 * - Compatibility with tool registration patterns
 * - Real-world usage scenarios
 * - Performance characteristics in typical workflows
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BaseTool,
  type ToolInterface,
  type ToolExecutionContext,
  type ValidationResult,
  type BaseToolOptions,
} from '../base-tool.js';
import type {
  ToolCategory,
  ToolPermission,
  ToolDefinition,
  ToolResult as BaseToolResult,
} from '../../types.js';

// ============================================================================
// Real-world Tool Examples
// ============================================================================

/**
 * File reading tool - represents a typical filesystem operation
 */
class ReadFileTool extends BaseTool<
  { path: string; encoding?: string },
  { content: string; size: number; lastModified: Date }
> {
  constructor() {
    super({
      name: 'ReadFile',
      description: 'Read contents of a file from the filesystem',
      category: 'filesystem' as ToolCategory,
      permissions: ['read' as ToolPermission],
      dangerous: false,
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Absolute or relative path to the file',
          },
          encoding: {
            type: 'string',
            enum: ['utf8', 'ascii', 'base64'],
            description: 'File encoding (defaults to utf8)',
          },
        },
        required: ['path'],
        additionalProperties: false,
      },
      examples: [
        {
          description: 'Read a configuration file',
          input: { path: './config.json' },
          output: { content: '{"key": "value"}', size: 16 },
        },
      ],
      version: '1.0.0',
      tags: ['filesystem', 'io'],
    });
  }

  validate(
    params: { path: string; encoding?: string },
    context?: ToolExecutionContext
  ): ValidationResult {
    const baseResult = super.validate(params, context);
    if (!baseResult.valid) {
      return baseResult;
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Path validation
    if (!params.path.trim()) {
      errors.push('Path cannot be empty');
    }

    if (params.path.includes('..')) {
      warnings.push('Path contains ".." - ensure this is intentional');
    }

    // Security checks
    const dangerousPaths = ['/etc/passwd', '/etc/shadow', '/root'];
    if (dangerousPaths.some(dp => params.path.startsWith(dp))) {
      errors.push('Access to system files is not allowed');
    }

    // Context-aware validation
    if (context?.workingDirectory) {
      const fullPath = params.path.startsWith('/')
        ? params.path
        : `${context.workingDirectory}/${params.path}`;

      if (!fullPath.startsWith(context.workingDirectory)) {
        warnings.push('Path escapes working directory');
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? [...(baseResult.warnings || []), ...warnings] : baseResult.warnings,
    };
  }

  protected async executeImpl(
    params: { path: string; encoding?: string },
    context?: ToolExecutionContext
  ): Promise<{ content: string; size: number; lastModified: Date }> {
    // Simulate file reading
    await new Promise(resolve => setTimeout(resolve, 10));

    // Check for cancellation
    if (context?.signal?.aborted) {
      throw new Error('File read operation was cancelled');
    }

    // Mock file system interaction
    const mockContent = `Mock file content for: ${params.path}\nEncoding: ${params.encoding || 'utf8'}`;

    return {
      content: mockContent,
      size: mockContent.length,
      lastModified: new Date(),
    };
  }
}

/**
 * Code search tool - represents a search operation
 */
class CodeSearchTool extends BaseTool<
  { pattern: string; files?: string[]; caseSensitive?: boolean },
  { matches: Array<{ file: string; line: number; text: string }> }
> {
  constructor() {
    super({
      name: 'CodeSearch',
      description: 'Search for patterns in code files',
      category: 'search' as ToolCategory,
      permissions: ['read' as ToolPermission],
      parameters: {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            description: 'Regular expression or string pattern to search',
          },
          files: {
            type: 'array',
            description: 'Optional list of files to search (defaults to all)',
          },
          caseSensitive: {
            type: 'boolean',
            description: 'Whether search should be case sensitive',
          },
        },
        required: ['pattern'],
        additionalProperties: false,
      },
      tags: ['search', 'regex', 'development'],
    });
  }

  validate(params: { pattern: string; files?: string[]; caseSensitive?: boolean }): ValidationResult {
    const baseResult = super.validate(params);
    if (!baseResult.valid) {
      return baseResult;
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate regex pattern
    try {
      new RegExp(params.pattern);
    } catch (error) {
      errors.push(`Invalid regular expression: ${params.pattern}`);
    }

    // Warn about potentially slow patterns
    if (params.pattern.includes('.*.*') || params.pattern.includes('*.*')) {
      warnings.push('Complex patterns may be slow on large codebases');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  protected async executeImpl(
    params: { pattern: string; files?: string[]; caseSensitive?: boolean }
  ): Promise<{ matches: Array<{ file: string; line: number; text: string }> }> {
    // Simulate code search
    await new Promise(resolve => setTimeout(resolve, 50));

    const mockMatches = [
      {
        file: 'src/index.ts',
        line: 15,
        text: `function example() { /* ${params.pattern} */ }`,
      },
      {
        file: 'tests/test.ts',
        line: 8,
        text: `expect(result).toMatch(/${params.pattern}/);`,
      },
    ];

    return { matches: mockMatches };
  }
}

/**
 * Network request tool - represents an external operation
 */
class HttpRequestTool extends BaseTool<
  { url: string; method?: string; headers?: Record<string, string>; timeout?: number },
  { status: number; headers: Record<string, string>; body: string }
> {
  constructor() {
    super({
      name: 'HttpRequest',
      description: 'Make HTTP requests to external services',
      category: 'network' as ToolCategory,
      permissions: ['execute' as ToolPermission],
      dangerous: true, // Network requests can be dangerous
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'URL to request',
          },
          method: {
            type: 'string',
            enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
            description: 'HTTP method',
          },
          headers: {
            type: 'object',
            description: 'HTTP headers to include',
          },
          timeout: {
            type: 'number',
            description: 'Request timeout in milliseconds',
          },
        },
        required: ['url'],
        additionalProperties: false,
      },
      version: '1.0.0',
      tags: ['network', 'http', 'api'],
    });
  }

  validate(
    params: { url: string; method?: string; headers?: Record<string, string>; timeout?: number },
    context?: ToolExecutionContext
  ): ValidationResult {
    const baseResult = super.validate(params, context);
    if (!baseResult.valid) {
      return baseResult;
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // URL validation
    try {
      new URL(params.url);
    } catch {
      errors.push('Invalid URL format');
    }

    // Security checks
    if (params.url.includes('localhost') || params.url.includes('127.0.0.1')) {
      warnings.push('Request to localhost detected - ensure this is safe');
    }

    // Timeout validation
    if (params.timeout !== undefined) {
      if (params.timeout < 0) {
        errors.push('Timeout cannot be negative');
      }
      if (params.timeout > 60000) {
        warnings.push('Long timeout may block execution');
      }
    }

    // Context timeout override
    if (context?.timeout && params.timeout && params.timeout > context.timeout) {
      errors.push(`Tool timeout (${params.timeout}ms) exceeds context timeout (${context.timeout}ms)`);
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  protected async executeImpl(
    params: { url: string; method?: string; headers?: Record<string, string>; timeout?: number },
    context?: ToolExecutionContext
  ): Promise<{ status: number; headers: Record<string, string>; body: string }> {
    const timeout = params.timeout || 5000;

    // Simulate HTTP request with proper timeout handling
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Request timeout after ${timeout}ms`));
      }, timeout);

      const simulatedDelay = Math.min(timeout / 2, 100);
      const requestTimer = setTimeout(() => {
        clearTimeout(timer);
        resolve({
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ url: params.url, method: params.method || 'GET' }),
        });
      }, simulatedDelay);

      // Handle abort signal
      if (context?.signal) {
        context.signal.addEventListener('abort', () => {
          clearTimeout(timer);
          clearTimeout(requestTimer);
          reject(new Error('Request aborted'));
        });
      }
    });
  }
}

// ============================================================================
// Tool Registry Mock
// ============================================================================

/**
 * Simplified tool registry for integration testing
 */
class MockToolRegistry {
  private tools = new Map<string, ToolInterface>();

  register(tool: ToolInterface): void {
    const definition = tool.getDefinition();
    this.tools.set(definition.name, tool);
  }

  get(name: string): ToolInterface | undefined {
    return this.tools.get(name);
  }

  list(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(tool => tool.getDefinition());
  }

  async execute<T = unknown>(
    toolName: string,
    params: Record<string, unknown>,
    context?: ToolExecutionContext
  ): Promise<BaseToolResult<T>> {
    const tool = this.get(toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    return await tool.execute(params, context) as BaseToolResult<T>;
  }
}

// ============================================================================
// Integration Tests
// ============================================================================

describe('BaseTool Integration Tests', () => {
  let registry: MockToolRegistry;
  let readFileTool: ReadFileTool;
  let codeSearchTool: CodeSearchTool;
  let httpRequestTool: HttpRequestTool;

  beforeEach(() => {
    registry = new MockToolRegistry();
    readFileTool = new ReadFileTool();
    codeSearchTool = new CodeSearchTool();
    httpRequestTool = new HttpRequestTool();

    registry.register(readFileTool);
    registry.register(codeSearchTool);
    registry.register(httpRequestTool);
  });

  describe('Tool Registry Integration', () => {
    it('registers tools correctly', () => {
      const tools = registry.list();

      expect(tools).toHaveLength(3);
      expect(tools.map(t => t.name)).toEqual(['ReadFile', 'CodeSearch', 'HttpRequest']);
    });

    it('retrieves tools by name', () => {
      const tool = registry.get('ReadFile');
      expect(tool).toBe(readFileTool);

      const nonExistent = registry.get('NonExistent');
      expect(nonExistent).toBeUndefined();
    });

    it('executes tools through registry', async () => {
      const result = await registry.execute('ReadFile', {
        path: '/tmp/test.txt',
        encoding: 'utf8',
      });

      expect(result.success).toBe(true);
      expect(result.output).toHaveProperty('content');
      expect(result.output).toHaveProperty('size');
    });

    it('handles tool not found errors', async () => {
      await expect(registry.execute('NonExistent', {})).rejects.toThrow('Tool not found: NonExistent');
    });
  });

  describe('Real-world Usage Scenarios', () => {
    it('supports file operations with security validation', async () => {
      // Valid file read
      const validResult = await readFileTool.execute({
        path: '/tmp/safe-file.txt',
        encoding: 'utf8',
      });

      expect(validResult.success).toBe(true);
      expect(validResult.output?.content).toContain('Mock file content');

      // Blocked dangerous file read
      const dangerousResult = await readFileTool.execute({
        path: '/etc/passwd',
      });

      expect(dangerousResult.success).toBe(false);
      expect(dangerousResult.error).toContain('Access to system files is not allowed');
    });

    it('supports search operations with pattern validation', async () => {
      // Valid search
      const validResult = await codeSearchTool.execute({
        pattern: 'function.*test',
        caseSensitive: false,
      });

      expect(validResult.success).toBe(true);
      expect(validResult.output?.matches).toHaveLength(2);

      // Invalid regex
      const invalidResult = await codeSearchTool.execute({
        pattern: '[invalid',
      });

      expect(invalidResult.success).toBe(false);
      expect(invalidResult.error).toContain('Invalid regular expression');
    });

    it('supports network operations with timeout handling', async () => {
      // Valid request
      const validResult = await httpRequestTool.execute({
        url: 'https://api.example.com/data',
        method: 'GET',
        timeout: 5000,
      });

      expect(validResult.success).toBe(true);
      expect(validResult.output?.status).toBe(200);

      // Invalid URL
      const invalidResult = await httpRequestTool.execute({
        url: 'not-a-url',
      });

      expect(invalidResult.success).toBe(false);
      expect(invalidResult.error).toContain('Invalid URL format');
    });

    it('handles context-aware validation', async () => {
      const context: ToolExecutionContext = {
        workingDirectory: '/project',
        timeout: 3000,
        agentName: 'test-agent',
        taskId: 'task-123',
      };

      // Path escaping working directory should warn
      const result = await readFileTool.execute(
        { path: '../../../etc/passwd' },
        context
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Access to system files is not allowed');

      // Timeout validation
      const timeoutResult = await httpRequestTool.execute(
        {
          url: 'https://example.com',
          timeout: 5000, // Exceeds context timeout
        },
        context
      );

      expect(timeoutResult.success).toBe(false);
      expect(timeoutResult.error).toContain('exceeds context timeout');
    });
  });

  describe('Performance Integration', () => {
    it('handles concurrent tool executions', async () => {
      const executions = Array(10).fill(null).map((_, i) =>
        readFileTool.execute({
          path: `/tmp/file-${i}.txt`,
        })
      );

      const results = await Promise.all(executions);

      results.forEach((result, i) => {
        expect(result.success).toBe(true);
        expect(result.output?.content).toContain(`file-${i}.txt`);
      });
    });

    it('handles tool execution timeouts', async () => {
      const controller = new AbortController();

      const executionPromise = httpRequestTool.execute(
        {
          url: 'https://slow-api.example.com',
          timeout: 1000,
        },
        { signal: controller.signal }
      );

      // Abort after 50ms
      setTimeout(() => controller.abort(), 50);

      const result = await executionPromise;

      expect(result.success).toBe(false);
      expect(result.error).toBe('Request aborted');
    });

    it('maintains performance under load', async () => {
      const start = performance.now();

      // Execute many validation and definition operations
      const operations = Array(100).fill(null).map(() => Promise.all([
        readFileTool.validate({ path: '/tmp/test.txt' }),
        codeSearchTool.validate({ pattern: 'test' }),
        httpRequestTool.getDefinition(),
      ]));

      await Promise.all(operations);

      const duration = performance.now() - start;

      // Should complete 100 * 3 = 300 operations in reasonable time
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Type System Integration', () => {
    it('maintains type safety with TypeScript generics', async () => {
      // The TypeScript compiler should enforce these types
      const readResult = await readFileTool.execute({ path: '/tmp/test.txt' });

      if (readResult.success && readResult.output) {
        // These should be type-safe
        expect(typeof readResult.output.content).toBe('string');
        expect(typeof readResult.output.size).toBe('number');
        expect(readResult.output.lastModified).toBeInstanceOf(Date);
      }

      const searchResult = await codeSearchTool.execute({ pattern: 'test' });

      if (searchResult.success && searchResult.output) {
        expect(Array.isArray(searchResult.output.matches)).toBe(true);
        if (searchResult.output.matches.length > 0) {
          const match = searchResult.output.matches[0];
          expect(typeof match.file).toBe('string');
          expect(typeof match.line).toBe('number');
          expect(typeof match.text).toBe('string');
        }
      }
    });

    it('integrates with existing APEX type schemas', () => {
      const definitions = registry.list();

      definitions.forEach(def => {
        // Should conform to ToolDefinition schema
        expect(def).toHaveProperty('name');
        expect(def).toHaveProperty('description');
        expect(def).toHaveProperty('category');
        expect(def).toHaveProperty('parameters');
        expect(def).toHaveProperty('dangerous');
        expect(def).toHaveProperty('permissions');

        // Categories should be valid
        const validCategories: ToolCategory[] = [
          'filesystem', 'search', 'execution', 'network', 'custom'
        ];
        expect(validCategories).toContain(def.category);

        // Permissions should be valid
        const validPermissions: ToolPermission[] = [
          'read', 'write', 'execute', 'admin'
        ];
        def.permissions.forEach(perm => {
          expect(validPermissions).toContain(perm);
        });
      });
    });
  });

  describe('Error Handling Integration', () => {
    it('provides detailed error context for debugging', async () => {
      const result = await httpRequestTool.execute({
        url: 'invalid-url',
        method: 'POST',
        timeout: -100,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.toolName).toBe('HttpRequest');
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.invokedAt).toBeInstanceOf(Date);
      expect(result.completedAt).toBeInstanceOf(Date);
    });

    it('handles cascading validation errors', async () => {
      const result = await httpRequestTool.execute({
        url: 'not-a-url',
        timeout: -100,
        method: 'INVALID' as any,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation failed');

      // Should contain multiple validation errors
      const errorMessage = result.error!;
      expect(errorMessage).toContain('Invalid URL format');
      expect(errorMessage).toContain('Timeout cannot be negative');
    });
  });

  describe('Workflow Integration', () => {
    it('supports agent workflow scenarios', async () => {
      const context: ToolExecutionContext = {
        taskId: 'workflow-task-001',
        agentName: 'developer',
        stageName: 'implementation',
        workingDirectory: '/project/src',
        environment: {
          NODE_ENV: 'development',
          PROJECT_ROOT: '/project',
        },
      };

      // Simulate a typical workflow: read config → search code → make API call
      const configResult = await readFileTool.execute(
        { path: 'config.json' },
        context
      );

      expect(configResult.success).toBe(true);

      const searchResult = await codeSearchTool.execute(
        { pattern: 'API_ENDPOINT', caseSensitive: true },
        { ...context, agentName: 'searcher' }
      );

      expect(searchResult.success).toBe(true);

      const apiResult = await httpRequestTool.execute(
        {
          url: 'https://api.example.com/validate',
          method: 'POST',
          timeout: 2000,
        },
        { ...context, agentName: 'integrator' }
      );

      expect(apiResult.success).toBe(true);

      // All operations should have context information
      [configResult, searchResult, apiResult].forEach(result => {
        expect(result.toolName).toBeDefined();
        expect(result.duration).toBeGreaterThanOrEqual(0);
      });
    });

    it('handles resource cleanup on abort', async () => {
      const controller = new AbortController();
      const context: ToolExecutionContext = {
        signal: controller.signal,
        timeout: 5000,
      };

      // Start multiple operations
      const operations = [
        readFileTool.execute({ path: '/tmp/large-file.txt' }, context),
        codeSearchTool.execute({ pattern: 'complex.*pattern.*search' }, context),
        httpRequestTool.execute({ url: 'https://slow-api.example.com' }, context),
      ];

      // Abort all operations after 10ms
      setTimeout(() => controller.abort(), 10);

      const results = await Promise.all(operations);

      // All should either complete quickly or fail with abort
      results.forEach(result => {
        if (!result.success) {
          expect(
            result.error?.includes('abort') ||
            result.error?.includes('cancel') ||
            result.error?.includes('Execution aborted')
          ).toBe(true);
        }
      });
    });
  });
});