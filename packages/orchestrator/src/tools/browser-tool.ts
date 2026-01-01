/**
 * BrowserTool Implementation
 *
 * Provides browser automation capabilities with comprehensive permission integration.
 * This is a stub implementation that establishes the permission framework and
 * operation interfaces. Actual browser automation will be added in future versions.
 *
 * Features:
 * - Complete permission integration with PermissionManager
 * - Per-operation permission checking with scoped requests
 * - Domain-based access control with allowlist/blocklist
 * - Configurable security policies for dangerous operations
 * - Comprehensive operation support (navigate, click, screenshot, evaluate, etc.)
 * - TypeScript types for all operations and results
 */

import { PermissionManager } from '../permission-manager';
import { PermissionLevel, ToolPermissionResult } from '@apexcli/core';

/**
 * Supported browser operations
 */
export type BrowserOperation =
  | 'navigate'
  | 'click'
  | 'type'
  | 'screenshot'
  | 'evaluate'
  | 'submit'
  | 'waitForSelector'
  | 'getAttribute'
  | 'getText'
  | 'getHtml'
  | 'scroll'
  | 'hover';

/**
 * Options for BrowserTool constructor
 */
export interface BrowserToolOptions {
  /** Optional permission manager for dependency injection */
  permissionManager?: PermissionManager;
}

/**
 * Parameters for navigate operation
 */
export interface BrowserNavigateParams {
  /** The URL to navigate to */
  url: string;
  /** Wait condition before considering navigation complete */
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  /** Maximum time to wait for navigation in milliseconds */
  timeout?: number;
}

/**
 * Parameters for click operation
 */
export interface BrowserClickParams {
  /** CSS selector of element to click */
  selector: string;
  /** Mouse button to click with */
  button?: 'left' | 'right' | 'middle';
  /** Number of clicks to perform */
  clickCount?: number;
  /** Delay between clicks in milliseconds */
  delay?: number;
}

/**
 * Parameters for type operation
 */
export interface BrowserTypeParams {
  /** CSS selector of input element to type into */
  selector: string;
  /** Text to type */
  text: string;
  /** Delay between keystrokes in milliseconds */
  delay?: number;
  /** Whether to clear the input before typing */
  clearFirst?: boolean;
}

/**
 * Parameters for screenshot operation
 */
export interface BrowserScreenshotParams {
  /** Optional file path to save screenshot */
  path?: string;
  /** Whether to capture full page or just viewport */
  fullPage?: boolean;
  /** Optional element selector to screenshot specific element */
  selector?: string;
  /** Image format */
  format?: 'png' | 'jpeg';
  /** JPEG quality (0-100) */
  quality?: number;
}

/**
 * Parameters for evaluate operation
 */
export interface BrowserEvaluateParams {
  /** JavaScript code to execute */
  script: string;
  /** Optional arguments to pass to the script */
  args?: unknown[];
}

/**
 * Parameters for submit operation
 */
export interface BrowserSubmitParams {
  /** CSS selector of form to submit */
  selector: string;
  /** Whether to trigger validation before submit */
  validate?: boolean;
}

/**
 * Parameters for waitForSelector operation
 */
export interface BrowserWaitForSelectorParams {
  /** CSS selector to wait for */
  selector: string;
  /** Maximum time to wait in milliseconds */
  timeout?: number;
  /** Whether element should be visible */
  visible?: boolean;
}

/**
 * Parameters for getAttribute operation
 */
export interface BrowserGetAttributeParams {
  /** CSS selector of element */
  selector: string;
  /** Attribute name to get */
  attribute: string;
}

/**
 * Parameters for getText operation
 */
export interface BrowserGetTextParams {
  /** CSS selector of element */
  selector: string;
}

/**
 * Parameters for getHtml operation
 */
export interface BrowserGetHtmlParams {
  /** Optional CSS selector of element (omit for full page HTML) */
  selector?: string;
}

/**
 * Parameters for scroll operation
 */
export interface BrowserScrollParams {
  /** X coordinate to scroll to */
  x?: number;
  /** Y coordinate to scroll to */
  y?: number;
  /** Optional element selector to scroll into view */
  selector?: string;
}

/**
 * Parameters for hover operation
 */
export interface BrowserHoverParams {
  /** CSS selector of element to hover */
  selector: string;
}

/**
 * Unified parameters type for all browser operations
 */
export type BrowserParams =
  | { operation: 'navigate'; params: BrowserNavigateParams }
  | { operation: 'click'; params: BrowserClickParams }
  | { operation: 'type'; params: BrowserTypeParams }
  | { operation: 'screenshot'; params: BrowserScreenshotParams }
  | { operation: 'evaluate'; params: BrowserEvaluateParams }
  | { operation: 'submit'; params: BrowserSubmitParams }
  | { operation: 'waitForSelector'; params: BrowserWaitForSelectorParams }
  | { operation: 'getAttribute'; params: BrowserGetAttributeParams }
  | { operation: 'getText'; params: BrowserGetTextParams }
  | { operation: 'getHtml'; params: BrowserGetHtmlParams }
  | { operation: 'scroll'; params: BrowserScrollParams }
  | { operation: 'hover'; params: BrowserHoverParams };

/**
 * Result of browser operation
 */
export interface BrowserResult {
  /** Whether the operation was successful */
  success: boolean;
  /** The operation that was performed */
  operation: BrowserOperation;
  /** Operation-specific result data */
  data?: unknown;
  /** Optional screenshot data (base64 or file path) */
  screenshot?: string;
  /** Error message if operation failed */
  error?: string;
  /** Operation metadata */
  metadata?: {
    /** Current page URL */
    url: string;
    /** Page title */
    title?: string;
    /** Operation execution time in milliseconds */
    executionTime: number;
    /** Whether permission was granted for this operation */
    permissionGranted: boolean;
    /** Permission level that was used */
    permissionLevel?: PermissionLevel;
    /** Target selector or URL for the operation */
    target?: string;
  };
}

/**
 * Configuration for browser tool operations
 */
export interface BrowserToolConfig {
  /** Whether the tool is enabled */
  enabled?: boolean;
  /** Maximum execution time in milliseconds (0 = no limit) */
  timeout?: number;
  /** Whether to require confirmation before execution */
  requireConfirmation?: boolean;
  /** Rate limiting: maximum calls per minute (0 = no limit) */
  rateLimitPerMinute?: number;
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
  /** Whether to allow file downloads */
  allowDownloads?: boolean;
  /** Whether to capture screenshots */
  allowScreenshots?: boolean;
  /** Whether to block popups/new windows */
  blockPopups?: boolean;
  /** User agent override */
  userAgent?: string;
  /** Viewport configuration */
  viewport?: {
    width: number;
    height: number;
  };
}

/**
 * Dangerous operation definitions with risk assessment
 */
const DANGEROUS_OPERATIONS = {
  evaluate: 'Executing arbitrary JavaScript code',
  submit: 'Submitting form data',
  navigate: 'Navigating to external domain', // only for non-allowed domains
} as const;

/**
 * BrowserTool Class
 *
 * Provides browser automation capabilities with comprehensive permission integration.
 * This implementation focuses on establishing proper permission hooks and operation
 * interfaces. Actual browser automation will be added in future versions.
 */
export class BrowserTool {
  private permissionManager?: PermissionManager;

  constructor(options?: BrowserToolOptions) {
    this.permissionManager = options?.permissionManager;
  }

  /**
   * Inject permission manager at runtime
   * Allows lazy binding after orchestrator initialization
   */
  setPermissionManager(manager: PermissionManager): void {
    this.permissionManager = manager;
  }

  /**
   * Permission check hook - returns whether operation is allowed
   * External code can use this to pre-check permissions without executing
   */
  async checkPermission(
    operation: BrowserOperation,
    target: string
  ): Promise<ToolPermissionResult> {
    if (!this.permissionManager) {
      // If no permission manager, allow by default (useful for testing)
      return {
        allowed: true,
        level: null,
        requiresConfirmation: false
      };
    }

    const scope = this.buildScope(operation, target);
    return this.permissionManager.checkToolPermission('Browser', { scope, consumeAllowOnce: false });
  }

  /**
   * Execute a browser operation with comprehensive permission checking
   */
  async execute(params: BrowserParams): Promise<BrowserResult> {
    const startTime = Date.now();
    const { operation } = params;

    try {
      // Build permission scope and target for this operation
      const target = this.extractTarget(params);
      const scope = this.buildScope(operation, target);

      // Check tool-level permission
      const permissionResult = await this.checkPermissionInternal(operation, target);

      if (!permissionResult.allowed) {
        return {
          success: false,
          operation,
          error: permissionResult.denialReason || 'Operation denied by permission policy',
          metadata: {
            url: this.getCurrentUrl(),
            executionTime: Date.now() - startTime,
            permissionGranted: false,
            target,
          },
        };
      }

      // Check operation-specific restrictions from configuration
      const configCheck = await this.checkConfigurationRestrictions(operation, params);
      if (!configCheck.allowed) {
        return {
          success: false,
          operation,
          error: configCheck.reason,
          metadata: {
            url: this.getCurrentUrl(),
            executionTime: Date.now() - startTime,
            permissionGranted: false,
            target,
          },
        };
      }

      // Check for dangerous operations
      const dangerCheck = await this.checkDangerousOperation(operation, params);
      if (dangerCheck.isDangerous && !permissionResult.level) {
        return {
          success: false,
          operation,
          error: `Dangerous operation requires explicit permission: ${dangerCheck.reason}`,
          metadata: {
            url: this.getCurrentUrl(),
            executionTime: Date.now() - startTime,
            permissionGranted: false,
            target,
          },
        };
      }

      // Execute the actual operation (stub implementation)
      const result = await this.executeOperation(params);

      return {
        ...result,
        metadata: {
          ...result.metadata,
          url: result.metadata?.url || this.getCurrentUrl() || '',
          executionTime: Date.now() - startTime,
          permissionGranted: true,
          permissionLevel: permissionResult.level || undefined,
          target,
        },
      };

    } catch (error) {
      return {
        success: false,
        operation,
        error: this.formatError(error),
        metadata: {
          url: this.getCurrentUrl(),
          executionTime: Date.now() - startTime,
          permissionGranted: false,
        },
      };
    }
  }

  /**
   * Internal permission check that consumes allow-once permissions
   */
  private async checkPermissionInternal(
    operation: BrowserOperation,
    target: string
  ): Promise<ToolPermissionResult> {
    if (!this.permissionManager) {
      return {
        allowed: true,
        level: null,
        requiresConfirmation: false
      };
    }

    const scope = this.buildScope(operation, target);
    return this.permissionManager.checkToolPermission('Browser', {
      scope,
      consumeAllowOnce: true
    });
  }

  /**
   * Build permission scope string for operation
   */
  private buildScope(operation: BrowserOperation, target: string): string {
    return `${operation}:${target}`;
  }

  /**
   * Extract target identifier from operation parameters
   */
  private extractTarget(params: BrowserParams): string {
    switch (params.operation) {
      case 'navigate':
        return params.params.url;
      case 'click':
      case 'type':
      case 'getAttribute':
      case 'getText':
      case 'hover':
      case 'waitForSelector':
        return params.params.selector;
      case 'screenshot':
        return params.params.selector || 'viewport';
      case 'evaluate':
        // Use hash of script for privacy/security
        return this.hashScript(params.params.script);
      case 'submit':
        return params.params.selector;
      case 'getHtml':
        return params.params.selector || 'page';
      case 'scroll':
        return params.params.selector || `${params.params.x || 0},${params.params.y || 0}`;
      default:
        return 'unknown';
    }
  }

  /**
   * Get current page URL (stub implementation)
   */
  private getCurrentUrl(): string {
    // In real implementation, this would get the current browser page URL
    return 'about:blank';
  }

  /**
   * Check configuration-based restrictions for the operation
   */
  private async checkConfigurationRestrictions(
    operation: BrowserOperation,
    params: BrowserParams
  ): Promise<{ allowed: boolean; reason?: string }> {
    if (!this.permissionManager) {
      return { allowed: true };
    }

    const config = await this.permissionManager.getToolConfig('Browser') as BrowserToolConfig | null;

    if (!config) {
      return { allowed: true };
    }

    // Check if tool is enabled
    if (config.enabled === false) {
      return { allowed: false, reason: 'Browser tool is disabled' };
    }

    // Check operation-specific restrictions
    switch (operation) {
      case 'navigate': {
        const { url } = (params as { params: BrowserNavigateParams }).params;
        const domain = this.extractDomain(url);

        if (config.blockedDomains?.includes(domain)) {
          return { allowed: false, reason: `Domain ${domain} is blocked` };
        }

        if (config.allowedDomains?.length && !config.allowedDomains.includes(domain)) {
          return { allowed: false, reason: `Domain ${domain} is not in allowlist` };
        }

        break;
      }

      case 'evaluate':
        if (config.allowJavaScriptExecution === false) {
          return { allowed: false, reason: 'JavaScript execution is disabled' };
        }
        break;

      case 'submit':
        if (config.allowFormSubmission === false) {
          return { allowed: false, reason: 'Form submission is disabled' };
        }
        break;

      case 'screenshot':
        if (config.allowScreenshots === false) {
          return { allowed: false, reason: 'Screenshots are disabled' };
        }
        break;
    }

    return { allowed: true };
  }

  /**
   * Check if operation is considered dangerous and requires special handling
   */
  private async checkDangerousOperation(
    operation: BrowserOperation,
    params: BrowserParams
  ): Promise<{ isDangerous: boolean; reason?: string }> {
    switch (operation) {
      case 'evaluate':
        return {
          isDangerous: true,
          reason: DANGEROUS_OPERATIONS.evaluate
        };

      case 'submit':
        return {
          isDangerous: true,
          reason: DANGEROUS_OPERATIONS.submit
        };

      case 'navigate': {
        const { url } = (params as { params: BrowserNavigateParams }).params;
        const domain = this.extractDomain(url);

        // Check if navigating to potentially dangerous domain
        if (!this.permissionManager) {
          return { isDangerous: false };
        }

        const config = await this.permissionManager.getToolConfig('Browser') as BrowserToolConfig | null;

        if (config?.blockedDomains?.includes(domain)) {
          return {
            isDangerous: true,
            reason: `Domain ${domain} is blocked`
          };
        }

        if (config?.allowedDomains?.length && !config.allowedDomains.includes(domain)) {
          return {
            isDangerous: true,
            reason: DANGEROUS_OPERATIONS.navigate
          };
        }

        break;
      }
    }

    return { isDangerous: false };
  }

  /**
   * Execute the actual browser operation (stub implementation)
   */
  private async executeOperation(params: BrowserParams): Promise<BrowserResult> {
    const { operation } = params;

    // This is a stub implementation - in real implementation, this would
    // interface with Playwright, Puppeteer, or Chrome DevTools Protocol

    switch (operation) {
      case 'navigate': {
        const { url } = (params as { params: BrowserNavigateParams }).params;
        return {
          success: true,
          operation,
          data: { url },
          metadata: {
            url,
            title: 'Stub Page Title',
            executionTime: 0,
            permissionGranted: true,
          },
        };
      }

      case 'click': {
        const { selector } = (params as { params: BrowserClickParams }).params;
        return {
          success: true,
          operation,
          data: { clicked: selector },
          metadata: {
            url: this.getCurrentUrl(),
            title: 'Stub Page Title',
            executionTime: 0,
            permissionGranted: true,
          },
        };
      }

      case 'type': {
        const { selector, text } = (params as { params: BrowserTypeParams }).params;
        return {
          success: true,
          operation,
          data: { typed: text, into: selector },
          metadata: {
            url: this.getCurrentUrl(),
            title: 'Stub Page Title',
            executionTime: 0,
            permissionGranted: true,
          },
        };
      }

      case 'screenshot': {
        const screenshotParams = (params as { params: BrowserScreenshotParams }).params;
        return {
          success: true,
          operation,
          data: {
            width: 1280,
            height: 720,
            format: screenshotParams.format || 'png'
          },
          screenshot: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', // Minimal 1x1 PNG
          metadata: {
            url: this.getCurrentUrl(),
            title: 'Stub Page Title',
            executionTime: 0,
            permissionGranted: true,
          },
        };
      }

      case 'evaluate': {
        const { script } = (params as { params: BrowserEvaluateParams }).params;
        return {
          success: true,
          operation,
          data: { result: `[STUB] Executed: ${script.slice(0, 50)}...` },
          metadata: {
            url: this.getCurrentUrl(),
            title: 'Stub Page Title',
            executionTime: 0,
            permissionGranted: true,
          },
        };
      }

      case 'submit': {
        const { selector } = (params as { params: BrowserSubmitParams }).params;
        return {
          success: true,
          operation,
          data: { submitted: selector },
          metadata: {
            url: this.getCurrentUrl(),
            title: 'Stub Page Title',
            executionTime: 0,
            permissionGranted: true,
          },
        };
      }

      case 'waitForSelector': {
        const { selector } = (params as { params: BrowserWaitForSelectorParams }).params;
        return {
          success: true,
          operation,
          data: { found: selector },
          metadata: {
            url: this.getCurrentUrl(),
            title: 'Stub Page Title',
            executionTime: 0,
            permissionGranted: true,
          },
        };
      }

      case 'getAttribute': {
        const { selector, attribute } = (params as { params: BrowserGetAttributeParams }).params;
        return {
          success: true,
          operation,
          data: { attribute, value: `[STUB] ${attribute} value` },
          metadata: {
            url: this.getCurrentUrl(),
            title: 'Stub Page Title',
            executionTime: 0,
            permissionGranted: true,
          },
        };
      }

      case 'getText': {
        const { selector } = (params as { params: BrowserGetTextParams }).params;
        return {
          success: true,
          operation,
          data: { text: `[STUB] Text content from ${selector}` },
          metadata: {
            url: this.getCurrentUrl(),
            title: 'Stub Page Title',
            executionTime: 0,
            permissionGranted: true,
          },
        };
      }

      case 'getHtml': {
        const { selector } = (params as { params: BrowserGetHtmlParams }).params;
        return {
          success: true,
          operation,
          data: {
            html: selector
              ? `<div data-selector="${selector}">[STUB] HTML content</div>`
              : '<!DOCTYPE html><html><head><title>Stub</title></head><body>[STUB] Page HTML</body></html>'
          },
          metadata: {
            url: this.getCurrentUrl(),
            title: 'Stub Page Title',
            executionTime: 0,
            permissionGranted: true,
          },
        };
      }

      case 'scroll': {
        const scrollParams = (params as { params: BrowserScrollParams }).params;
        return {
          success: true,
          operation,
          data: {
            scrolled: scrollParams.selector || `${scrollParams.x || 0},${scrollParams.y || 0}`
          },
          metadata: {
            url: this.getCurrentUrl(),
            title: 'Stub Page Title',
            executionTime: 0,
            permissionGranted: true,
          },
        };
      }

      case 'hover': {
        const { selector } = (params as { params: BrowserHoverParams }).params;
        return {
          success: true,
          operation,
          data: { hovered: selector },
          metadata: {
            url: this.getCurrentUrl(),
            title: 'Stub Page Title',
            executionTime: 0,
            permissionGranted: true,
          },
        };
      }

      default:
        return {
          success: false,
          operation,
          error: `Unsupported operation: ${operation}`,
          metadata: {
            url: this.getCurrentUrl(),
            executionTime: 0,
            permissionGranted: true,
          },
        };
    }
  }

  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return url; // Return original if URL parsing fails
    }
  }

  /**
   * Create hash of script for privacy/security in permission scopes
   */
  private hashScript(script: string): string {
    // Simple hash for stub implementation - in real implementation,
    // might want to use crypto.createHash for better security
    return `script_${Buffer.from(script).toString('base64').slice(0, 16)}`;
  }

  /**
   * Format error messages for consistent error reporting
   */
  private formatError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return `Unknown error: ${String(error)}`;
  }
}

/**
 * Create and export a default instance of BrowserTool
 */
export const browserTool = new BrowserTool();

/**
 * Convenience function for executing browser operations
 */
export async function browser(params: BrowserParams): Promise<BrowserResult> {
  return browserTool.execute(params);
}