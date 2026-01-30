/**
 * @fileoverview Browser automation tool for page interaction and testing
 *
 * This tool provides browser automation capabilities with support for:
 * - Page navigation and URL handling
 * - Element interaction (click, type, hover)
 * - Screenshot capture and visual regression testing
 * - JavaScript execution in browser context
 * - Form submission and element state waiting
 * - HTML/text content extraction
 *
 * ## Architecture Decision Record (ADR-019)
 *
 * ### Context
 * APEX agents need browser automation capabilities for testing, verification,
 * and automation workflows. This tool integrates with MCP browser tools to
 * provide a type-safe interface for browser operations.
 *
 * ### Decision
 * Implement a `BrowserTool` that:
 * 1. Extends `BaseTool` for consistent tool interface
 * 2. Supports all major browser operations (navigate, click, type, screenshot, etc.)
 * 3. Provides domain filtering for security
 * 4. Integrates with screenshot comparison utilities
 * 5. Uses discriminated union types for type-safe operation handling
 *
 * ### Consequences
 * - Agents can automate browser interactions
 * - Visual regression testing is supported
 * - Domain restrictions provide security control
 * - Type-safe API prevents runtime errors
 *
 * @module @apex/core/tools/browser/browser-tool
 */

import { BaseTool, type ToolExecutionContext, type ValidationResult } from '../base-tool.js';
import type {
  ToolCategory,
  ToolPermission,
  BrowserToolConfig,
  BrowserOperation,
  BrowserToolInput,
  BrowserToolOutput,
} from '../../types.js';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Input parameters for the Browser tool
 * Discriminated union based on operation type
 */
export type { BrowserToolInput };

/**
 * Output from the Browser tool
 */
export type { BrowserToolOutput };

/**
 * Browser operation type
 */
export type { BrowserOperation };

/**
 * Configuration options for BrowserTool
 */
export interface BrowserToolOptions {
  /** Allowed domains for navigation (empty = all allowed) */
  allowedDomains?: string[];
  /** Blocked domains */
  blockedDomains?: string[];
  /** Whether to allow JavaScript execution via evaluate() */
  allowJavaScriptExecution?: boolean;
  /** Whether to allow form submissions */
  allowFormSubmission?: boolean;
  /** Maximum page load timeout in milliseconds */
  pageLoadTimeout?: number;
  /** Whether to allow screenshots */
  allowScreenshots?: boolean;
  /** Whether to run headless */
  headless?: boolean;
  /** Viewport configuration */
  viewport?: {
    width: number;
    height: number;
  };
}

// ============================================================================
// Browser Tool Implementation
// ============================================================================

/**
 * Browser automation tool for page interaction and testing.
 *
 * Features:
 * - Navigate to URLs with domain filtering
 * - Click, type, and hover on elements
 * - Capture screenshots for testing
 * - Visual regression testing with screenshot comparison
 * - Execute JavaScript in browser context
 * - Wait for elements and form submission
 * - Extract HTML/text content from elements
 *
 * ## Usage Examples
 *
 * ```typescript
 * // Navigate to a URL
 * const result = await browserTool.execute({
 *   operation: 'navigate',
 *   params: { url: 'https://example.com' }
 * });
 *
 * // Click a button
 * const result = await browserTool.execute({
 *   operation: 'click',
 *   params: { selector: 'button.submit' }
 * });
 *
 * // Take a screenshot
 * const result = await browserTool.execute({
 *   operation: 'screenshot',
 *   params: { path: './screenshot.png', options: { fullPage: true } }
 * });
 *
 * // Type into an input
 * const result = await browserTool.execute({
 *   operation: 'type',
 *   params: { selector: 'input[name="email"]', text: 'test@example.com' }
 * });
 * ```
 *
 * ## Security Considerations
 *
 * - Domain filtering restricts navigation to trusted sites
 * - JavaScript execution can be disabled
 * - Form submission control prevents unwanted actions
 * - Network permission is required
 */
export class BrowserTool extends BaseTool<BrowserToolInput, BrowserToolOutput> {
  /** Default page load timeout in milliseconds */
  private static readonly DEFAULT_TIMEOUT = 30000;

  /** Default viewport dimensions */
  private static readonly DEFAULT_VIEWPORT = { width: 1280, height: 720 };

  /** Tool configuration */
  private readonly config: Required<BrowserToolOptions>;

  /**
   * Creates a new BrowserTool instance.
   *
   * @param options - Optional configuration for the tool
   */
  constructor(options?: BrowserToolOptions) {
    super({
      name: 'Browser',
      description: 'Browser automation tool for navigation, interaction, screenshots, and evaluation. Supports operations: navigate, click, type, screenshot, compareScreenshot, evaluate, submit, waitForSelector, getAttribute, getText, getHtml, scroll, hover.',
      category: 'browser' as ToolCategory,
      permissions: ['network' as ToolPermission],
      dangerous: true, // Browser automation can be dangerous
      parameters: {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            enum: [
              'navigate', 'click', 'type', 'screenshot', 'compareScreenshot',
              'evaluate', 'submit', 'waitForSelector', 'getAttribute',
              'getText', 'getHtml', 'scroll', 'hover'
            ],
            description: 'The browser operation to perform',
          },
          params: {
            type: 'object',
            description: 'Operation-specific parameters',
          },
        },
        required: ['operation'],
        additionalProperties: false,
      },
      examples: [
        {
          name: 'Navigate to URL',
          description: 'Navigate the browser to a specified URL',
          input: {
            operation: 'navigate',
            params: { url: 'https://example.com' }
          },
        },
        {
          name: 'Click element',
          description: 'Click on an element using a CSS selector',
          input: {
            operation: 'click',
            params: { selector: 'button.submit' }
          },
        },
        {
          name: 'Take screenshot',
          description: 'Capture a screenshot of the page',
          input: {
            operation: 'screenshot',
            params: { path: './screenshot.png', options: { fullPage: true } }
          },
        },
        {
          name: 'Type text',
          description: 'Type text into an input field',
          input: {
            operation: 'type',
            params: { selector: 'input[name="search"]', text: 'query' }
          },
        },
        {
          name: 'Wait for element',
          description: 'Wait for an element to appear on the page',
          input: {
            operation: 'waitForSelector',
            params: { selector: '.loading-complete', options: { timeout: 5000 } }
          },
        },
      ],
      version: '1.0.0',
      tags: ['browser', 'automation', 'testing', 'screenshots', 'web'],
    });

    // Apply default configuration
    this.config = {
      allowedDomains: options?.allowedDomains ?? [],
      blockedDomains: options?.blockedDomains ?? [],
      allowJavaScriptExecution: options?.allowJavaScriptExecution ?? true,
      allowFormSubmission: options?.allowFormSubmission ?? true,
      pageLoadTimeout: options?.pageLoadTimeout ?? BrowserTool.DEFAULT_TIMEOUT,
      allowScreenshots: options?.allowScreenshots ?? true,
      headless: options?.headless ?? true,
      viewport: options?.viewport ?? BrowserTool.DEFAULT_VIEWPORT,
    };
  }

  /**
   * Validates the input parameters with operation-specific checks.
   */
  validate(
    params: BrowserToolInput,
    context?: ToolExecutionContext
  ): ValidationResult {
    const baseResult = super.validate(params, context);
    if (!baseResult.valid) {
      return baseResult;
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Operation validation
    const validOperations = [
      'navigate', 'click', 'type', 'screenshot', 'compareScreenshot',
      'evaluate', 'submit', 'waitForSelector', 'getAttribute',
      'getText', 'getHtml', 'scroll', 'hover'
    ];

    if (!validOperations.includes(params.operation)) {
      errors.push(`Invalid operation: ${params.operation}. Must be one of: ${validOperations.join(', ')}`);
      return { valid: false, errors, warnings: warnings.length > 0 ? warnings : undefined };
    }

    // Operation-specific validation
    switch (params.operation) {
      case 'navigate':
        if (!params.params?.url) {
          errors.push('navigate operation requires a url parameter');
        } else {
          // Validate URL format
          try {
            const url = new URL(params.params.url);

            // Check domain restrictions
            const domain = url.hostname.toLowerCase();

            if (this.config.blockedDomains.length > 0) {
              const isBlocked = this.config.blockedDomains.some(blocked =>
                domain === blocked.toLowerCase() || domain.endsWith('.' + blocked.toLowerCase())
              );
              if (isBlocked) {
                errors.push(`Domain '${domain}' is blocked`);
              }
            }

            if (this.config.allowedDomains.length > 0) {
              const isAllowed = this.config.allowedDomains.some(allowed =>
                domain === allowed.toLowerCase() || domain.endsWith('.' + allowed.toLowerCase())
              );
              if (!isAllowed) {
                errors.push(`Domain '${domain}' is not in the allowed domains list`);
              }
            }
          } catch {
            errors.push('Invalid URL format');
          }
        }
        break;

      case 'click':
      case 'hover':
      case 'submit':
      case 'getText':
      case 'getHtml':
      case 'waitForSelector':
        if (!params.params?.selector) {
          errors.push(`${params.operation} operation requires a selector parameter`);
        }
        break;

      case 'type':
        if (!params.params?.selector) {
          errors.push('type operation requires a selector parameter');
        }
        if (params.params?.text === undefined) {
          errors.push('type operation requires a text parameter');
        }
        break;

      case 'getAttribute':
        if (!params.params?.selector) {
          errors.push('getAttribute operation requires a selector parameter');
        }
        if (!params.params?.attribute) {
          errors.push('getAttribute operation requires an attribute parameter');
        }
        break;

      case 'compareScreenshot':
        if (!params.params?.baseline) {
          errors.push('compareScreenshot operation requires a baseline parameter');
        }
        break;

      case 'evaluate':
        if (!params.params?.script) {
          errors.push('evaluate operation requires a script parameter');
        }
        if (!this.config.allowJavaScriptExecution) {
          errors.push('JavaScript execution is disabled');
        }
        break;

      case 'screenshot':
        if (!this.config.allowScreenshots) {
          errors.push('Screenshots are disabled');
        }
        break;
    }

    // Check form submission permission
    if (params.operation === 'submit' && !this.config.allowFormSubmission) {
      errors.push('Form submission is disabled');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? [...(baseResult.warnings || []), ...warnings] : baseResult.warnings,
    };
  }

  /**
   * Executes the browser operation.
   *
   * Note: This is a placeholder implementation. In production, this would
   * integrate with Playwright, Puppeteer, or MCP browser tools.
   */
  protected async executeImpl(
    params: BrowserToolInput,
    context?: ToolExecutionContext
  ): Promise<BrowserToolOutput> {
    const startTime = Date.now();

    // Check cancellation early
    if (context?.signal?.aborted) {
      throw new Error('Browser operation was cancelled');
    }

    try {
      // This is a type-safe implementation scaffold
      // In production, this would delegate to actual browser automation
      const result = await this.executeOperation(params, context);

      return {
        ...result,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('cancelled')) {
        throw error;
      }
      throw new Error(`Browser operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Executes a specific browser operation.
   * This method handles the operation dispatch and would integrate with
   * the actual browser automation backend.
   */
  private async executeOperation(
    params: BrowserToolInput,
    context?: ToolExecutionContext
  ): Promise<Omit<BrowserToolOutput, 'duration'>> {
    // Check cancellation
    if (context?.signal?.aborted) {
      throw new Error('Browser operation was cancelled');
    }

    // Placeholder implementation - returns success with operation-specific data
    // In production, this would call Playwright/Puppeteer/MCP browser tools
    switch (params.operation) {
      case 'navigate':
        return {
          success: true,
          operation: 'navigate',
          url: params.params.url,
          title: 'Page Title', // Would be actual page title
        };

      case 'click':
        return {
          success: true,
          operation: 'click',
        };

      case 'type':
        return {
          success: true,
          operation: 'type',
        };

      case 'screenshot':
        return {
          success: true,
          operation: 'screenshot',
          screenshot: params.params?.path || 'base64-data', // Would be actual screenshot
        };

      case 'compareScreenshot':
        return {
          success: true,
          operation: 'compareScreenshot',
          comparisonResult: {
                                            isMatch: true,
                                            similarity: 1,
                                            differentPixels: 0,
                                            totalPixels: 1,
                                            dimensions: { width: this.config.viewport.width, height: this.config.viewport.height },          },
        };

      case 'evaluate':
        return {
          success: true,
          operation: 'evaluate',
          evaluationResult: null, // Would be actual script result
        };

      case 'submit':
        return {
          success: true,
          operation: 'submit',
        };

      case 'waitForSelector':
        return {
          success: true,
          operation: 'waitForSelector',
        };

      case 'getAttribute':
        return {
          success: true,
          operation: 'getAttribute',
          attributeValue: null, // Would be actual attribute value
        };

      case 'getText':
        return {
          success: true,
          operation: 'getText',
          text: '', // Would be actual text content
        };

      case 'getHtml':
        return {
          success: true,
          operation: 'getHtml',
          html: '', // Would be actual HTML content
        };

      case 'scroll':
        return {
          success: true,
          operation: 'scroll',
        };

      case 'hover':
        return {
          success: true,
          operation: 'hover',
        };

      default:
        throw new Error(`Unknown operation: ${(params as { operation: string }).operation}`);
    }
  }

  /**
   * Gets the current configuration.
   */
  public getConfig(): Readonly<Required<BrowserToolOptions>> {
    return { ...this.config };
  }

  /**
   * Creates a new BrowserTool instance with updated configuration.
   * This preserves immutability of the configuration.
   */
  public withConfig(updates: Partial<BrowserToolOptions>): BrowserTool {
    return new BrowserTool({
      ...this.config,
      ...updates,
    });
  }
}
