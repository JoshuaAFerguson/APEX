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
import { BrowserPermissionDeniedError, type BrowserLifecycleState, type BrowserLifecycleAware } from './browser-permission-denied-error.js';

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
export class BrowserTool extends BaseTool<BrowserToolInput, BrowserToolOutput> implements BrowserLifecycleAware {
  /** Default page load timeout in milliseconds */
  private static readonly DEFAULT_TIMEOUT = 30000;

  /** Default viewport dimensions */
  private static readonly DEFAULT_VIEWPORT = { width: 1280, height: 720 };

  /** Tool configuration */
  private readonly config: Required<BrowserToolOptions>;

  /** Current lifecycle state of the browser tool */
  public state: BrowserLifecycleState = 'idle';

  /** Active browser sessions for resource tracking */
  private readonly activeSessions = new Map<string, {
    session: any; // Browser session object
    operations: string[]; // Track operations performed
    createdAt: Date;
    cleanup: () => Promise<void>;
  }>();

  /** Permission cache to avoid repeated permission checks */
  private readonly permissionCache = new Map<string, {
    granted: boolean;
    level?: string;
    expiresAt: Date;
  }>();

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
   * Executes the browser operation with proper permission checks and resource management.
   */
  protected async executeImpl(
    params: BrowserToolInput,
    context?: ToolExecutionContext
  ): Promise<BrowserToolOutput> {
    const startTime = Date.now();
    const sessionId = this.generateSessionId();

    // Check if tool is in a state that prevents execution
    if (this.state === 'destroyed' || this.state === 'cleaning_up' || this.state === 'launching') {
      throw new Error('Browser tool has been destroyed and cannot execute operations');
    }

    // Transition to active state on first execution
    if (this.state === 'idle') {
      this.state = 'active';
      console.debug(`BrowserTool: State transitioned from idle to active`);
    }

    // Check cancellation early
    if (context?.signal?.aborted) {
      throw new Error('Browser operation was cancelled');
    }

    try {
      // Check permission before executing operation
      await this.checkPermission(params.operation, context);

      // Execute the operation with session tracking
      const result = await this.executeOperation(params, context, sessionId);

      return {
        ...result,
        duration: Date.now() - startTime,
        sessionId,
      };
    } catch (error) {
      // Handle different error types gracefully
      if (error instanceof BrowserPermissionDeniedError) {
        // Execute cleanup for permission denied errors
        await this.cleanupAllSessions();

        // Return structured error response instead of throwing
        return {
          success: false,
          operation: params.operation,
          error: error.getUserFriendlyMessage(),
          permissionDenied: true,
          duration: Date.now() - startTime,
          sessionId,
          metadata: {
            operation: params.operation,
            permissionDenied: true,
            deniedBy: 'system',
            timestamp: new Date().toISOString(),
            suggestions: error.getResolutionSuggestions(),
          },
        };
      }

      if (error instanceof Error && error.message.includes('cancelled')) {
        // Clean up on cancellation
        await this.cleanupSession(sessionId);
        throw error;
      }

      // Clean up on general errors
      await this.cleanupSession(sessionId);

      // Return structured error response for other errors
      return {
        success: false,
        operation: params.operation,
        error: `Browser operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Date.now() - startTime,
        sessionId,
      };
    }
  }

  /**
   * Generates a unique session ID for tracking
   */
  private generateSessionId(): string {
    return `browser-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Executes a specific browser operation with session tracking.
   * This method handles the operation dispatch and would integrate with
   * the actual browser automation backend.
   */
  private async executeOperation(
    params: BrowserToolInput,
    context?: ToolExecutionContext,
    sessionId?: string
  ): Promise<Omit<BrowserToolOutput, 'duration'>> {
    // Check cancellation
    if (context?.signal?.aborted) {
      throw new Error('Browser operation was cancelled');
    }

    // Register session for resource tracking (mock browser session)
    if (sessionId) {
      const mockBrowserSession = { url: null, title: null, closed: false };
      const cleanup = async () => {
        mockBrowserSession.closed = true;
        console.debug(`Cleaned up browser session: ${sessionId}`);
      };

      this.registerSession(sessionId, mockBrowserSession, cleanup);
      this.recordOperation(sessionId, params.operation);
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

  /**
   * Registers a browser session for resource tracking
   */
  private registerSession(sessionId: string, session: any, cleanup: () => Promise<void>): void {
    this.activeSessions.set(sessionId, {
      session,
      operations: [],
      createdAt: new Date(),
      cleanup,
    });
  }

  /**
   * Records an operation for a session
   */
  private recordOperation(sessionId: string, operation: string): void {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.operations.push(operation);
    }
  }

  /**
   * Cleans up a specific browser session
   */
  private async cleanupSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      try {
        await session.cleanup();
      } catch (error) {
        console.warn(`Failed to cleanup browser session ${sessionId}:`, error);
      } finally {
        this.activeSessions.delete(sessionId);
      }
    }
  }

  /**
   * Cleans up all active browser sessions
   * Called when tool is disposed or on permission denial
   */
  public async cleanupAllSessions(): Promise<void> {
    // Transition to cleaning_up state
    if (this.state !== 'destroyed') {
      this.state = 'cleaning_up';
      console.debug(`BrowserTool: State transitioned to cleaning_up`);
    }

    const sessionIds = Array.from(this.activeSessions.keys());
    await Promise.allSettled(
      sessionIds.map(sessionId => this.cleanupSession(sessionId))
    );
    this.activeSessions.clear();

    // Transition to destroyed state after cleanup
    this.state = 'destroyed';
    console.debug(`BrowserTool: State transitioned to destroyed`);
  }

  /**
   * Checks permission for a browser operation
   * Returns permission info or throws BrowserPermissionDeniedError
   */
  private async checkPermission(
    operation: string,
    context?: ToolExecutionContext
  ): Promise<{ granted: boolean; level?: string }> {
    // Generate cache key
    const cacheKey = `${operation}-${context?.agentName || 'default'}`;

    // Check cache first (with 5-minute expiry)
    const cached = this.permissionCache.get(cacheKey);
    if (cached && cached.expiresAt > new Date()) {
      if (!cached.granted) {
        throw new BrowserPermissionDeniedError(
          `Permission denied for browser operation '${operation}' (cached)`,
          {
            operation,
            denialReason: 'Cached permission denial',
          }
        );
      }
      return { granted: cached.granted, level: cached.level };
    }

    // Simulate permission check - in production this would integrate with PermissionManager
    const isPermitted = await this.simulatePermissionCheck(operation, context);

    // Cache the result
    this.permissionCache.set(cacheKey, {
      granted: isPermitted.granted,
      level: isPermitted.level,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    });

    if (!isPermitted.granted) {
      throw new BrowserPermissionDeniedError(
        isPermitted.reason || `Permission denied for browser operation '${operation}'`,
        {
          operation,
          denialReason: isPermitted.reason,
        }
      );
    }

    return isPermitted;
  }

  /**
   * Simulates permission checking - in production this would integrate with the actual permission system
   */
  private async simulatePermissionCheck(
    operation: string,
    context?: ToolExecutionContext
  ): Promise<{ granted: boolean; level?: string; deniedBy?: string; reason?: string }> {
    // For testing purposes, we'll allow most operations but deny 'evaluate' and 'submit'
    // This simulates a security policy that restricts dangerous operations

    const dangerousOperations = ['evaluate', 'submit'];

    if (dangerousOperations.includes(operation)) {
      return {
        granted: false,
        deniedBy: 'security-policy',
        reason: `Operation '${operation}' requires elevated permissions`,
      };
    }

    return {
      granted: true,
      level: 'basic',
    };
  }

  /**
   * Clears permission cache - useful for testing or when permissions change
   */
  public clearPermissionCache(): void {
    this.permissionCache.clear();
  }

  /**
   * Check whether the browser tool is currently active and available for operations.
   * Returns true when state is 'idle' or 'active', false otherwise.
   *
   * @returns true if the browser tool is available for operations
   */
  public isActive(): boolean {
    return this.state === 'idle' || this.state === 'active';
  }
}
