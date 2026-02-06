/**
 * BrowserTool Implementation
 *
 * Provides browser automation capabilities with comprehensive permission integration.
 * This implementation uses Playwright for real browser automation while retaining
 * strict permission checks and safety controls.
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
import {
  PermissionLevel,
  ToolPermissionResult,
  VisualComparisonEventData,
  BrowserPermissionDeniedError,
  BrowserPermissionDeniedContext,
  isBrowserPermissionDeniedError,
  BrowserResourceState,
  ApexError,
  ApexErrorCode
} from '@apexcli/core';
import { chromium, firefox, webkit, type Browser, type BrowserContext, type Page } from 'playwright';
import { EventEmitter } from 'eventemitter3';
import * as fs from 'fs';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import {
  BrowserConsoleStream,
  ConsoleStreamConfig,
  ConsoleLogLevel,
  BrowserConsoleMessage as EnhancedConsoleMessage,
  BrowserRuntimeError as EnhancedRuntimeError
} from '../browser-console-stream';

/**
 * BrowserTool lifecycle states
 */
export type BrowserToolLifecycleState = 'idle' | 'launching' | 'active' | 'cleaning_up' | 'destroyed';

/**
 * Supported browser operations
 */
export type BrowserOperation =
  | 'navigate'
  | 'click'
  | 'type'
  | 'screenshot'
  | 'compareScreenshot'
  | 'evaluate'
  | 'submit'
  | 'waitForSelector'
  | 'getAttribute'
  | 'getText'
  | 'getHtml'
  | 'scroll'
  | 'hover'
  | 'generatePdf';

/**
 * Options for BrowserTool constructor
 */
export interface BrowserToolOptions {
  /** Optional permission manager for dependency injection */
  permissionManager?: PermissionManager;
  /** Optional backend selection */
  backend?: 'playwright' | 'puppeteer';
  /** Optional browser engine override */
  engine?: 'chromium' | 'firefox' | 'webkit';
  /** Override whether to run headless */
  headless?: boolean;
  /** Optional event emitter for broadcasting events */
  eventEmitter?: EventEmitter;
  /** Optional task ID for event correlation */
  taskId?: string;
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
 * Parameters for visual regression comparison
 */
export interface BrowserCompareScreenshotParams {
  /** Baseline screenshot file path */
  baselinePath: string;
  /** Optional diff output path */
  diffPath?: string;
  /** Threshold for acceptable difference ratio (0-1) */
  threshold?: number;
  /** Whether to capture full page or just viewport */
  fullPage?: boolean;
  /** Optional element selector to capture specific element */
  selector?: string;
  /** Image format */
  format?: 'png' | 'jpeg';
  /** JPEG quality (0-100) */
  quality?: number;
  /** Unique test identifier for event correlation */
  testId?: string;
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
 * Parameters for PDF generation
 */
export interface BrowserGeneratePdfParams {
  /** Optional file path to save PDF */
  path?: string;
  /** PDF format/page size */
  format?: 'Letter' | 'Legal' | 'Tabloid' | 'Ledger' | 'A0' | 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6';
  /** Page width (overrides format) */
  width?: string;
  /** Page height (overrides format) */
  height?: string;
  /** Page margins */
  margin?: {
    top?: string;
    bottom?: string;
    left?: string;
    right?: string;
  };
  /** Print in landscape orientation */
  landscape?: boolean;
  /** Print background graphics */
  printBackground?: boolean;
  /** Scale factor for rendering (0.1 to 2.0) */
  scale?: number;
  /** Page ranges to print (e.g., '1-5, 8, 11-13') */
  pageRanges?: string;
  /** Prefer CSS page size if defined */
  preferCSSPageSize?: boolean;
  /** Display header and footer */
  displayHeaderFooter?: boolean;
  /** HTML template for header */
  headerTemplate?: string;
  /** HTML template for footer */
  footerTemplate?: string;
}

/**
 * Unified parameters type for all browser operations
 */
export type BrowserParams =
  | { operation: 'navigate'; params: BrowserNavigateParams }
  | { operation: 'click'; params: BrowserClickParams }
  | { operation: 'type'; params: BrowserTypeParams }
  | { operation: 'screenshot'; params: BrowserScreenshotParams }
  | { operation: 'compareScreenshot'; params: BrowserCompareScreenshotParams }
  | { operation: 'evaluate'; params: BrowserEvaluateParams }
  | { operation: 'submit'; params: BrowserSubmitParams }
  | { operation: 'waitForSelector'; params: BrowserWaitForSelectorParams }
  | { operation: 'getAttribute'; params: BrowserGetAttributeParams }
  | { operation: 'getText'; params: BrowserGetTextParams }
  | { operation: 'getHtml'; params: BrowserGetHtmlParams }
  | { operation: 'scroll'; params: BrowserScrollParams }
  | { operation: 'hover'; params: BrowserHoverParams }
  | { operation: 'generatePdf'; params: BrowserGeneratePdfParams };

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
    /** Captured console messages during the operation */
    consoleMessages?: BrowserConsoleMessage[];
    /** Captured runtime errors during the operation */
    runtimeErrors?: BrowserRuntimeError[];
    /** Enhanced console messages with full context */
    enhancedConsoleMessages?: EnhancedConsoleMessage[];
    /** Enhanced runtime errors with detailed context */
    enhancedRuntimeErrors?: EnhancedRuntimeError[];
  };
}

/**
 * Console message captured from the browser runtime
 * @deprecated Use BrowserConsoleMessage from browser-console-stream.ts for enhanced features
 */
export interface BrowserConsoleMessage {
  type: string;
  text: string;
  timestamp: Date;
}

/**
 * Runtime error captured from the browser page
 * @deprecated Use BrowserRuntimeError from browser-console-stream.ts for enhanced features
 */
export interface BrowserRuntimeError {
  message: string;
  stack?: string;
  timestamp: Date;
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
  /** Browser engine to use */
  engine?: 'chromium' | 'firefox' | 'webkit';
  /** Browser automation backend */
  backend?: 'playwright' | 'puppeteer';
  /** Whether to run headless */
  headless?: boolean;
  /** User agent override */
  userAgent?: string;
  /** Viewport configuration */
  viewport?: {
    width: number;
    height: number;
  };
  /** Console streaming configuration */
  consoleStream?: {
    /** Enable console streaming */
    enabled?: boolean;
    /** Console stream configuration */
    config?: ConsoleStreamConfig;
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
  private browser?: Browser;
  private context?: BrowserContext;
  private page?: Page;
  private puppeteerBrowser?: any;
  private puppeteerPage?: any;
  private consoleMessages: BrowserConsoleMessage[] = [];
  private runtimeErrors: BrowserRuntimeError[] = [];
  private engine: 'chromium' | 'firefox' | 'webkit';
  private headless?: boolean;
  private backend: 'playwright' | 'puppeteer';
  private activeBackend: 'playwright' | 'puppeteer';
  private consoleStream?: BrowserConsoleStream;
  private enhancedConsoleMessages: EnhancedConsoleMessage[] = [];
  private enhancedRuntimeErrors: EnhancedRuntimeError[] = [];
  private eventEmitter?: EventEmitter;
  private resourceState: BrowserResourceState;
  private sessionId: string;
  private state: BrowserToolLifecycleState;

  constructor(options?: BrowserToolOptions) {
    this.permissionManager = options?.permissionManager;
    this.engine = options?.engine || 'chromium';
    this.headless = options?.headless;
    this.backend = options?.backend || 'playwright';
    this.activeBackend = this.backend;
    this.sessionId = this.generateSessionId();
    this.state = 'idle';
    this.resourceState = {
      browserActive: false,
      contextActive: false,
      pageActive: false,
      sessionId: this.sessionId,
      activeOperations: 0
    };
    // Set event emitter if provided
    this.eventEmitter = options?.eventEmitter;
  }

  /**
   * Inject permission manager at runtime
   * Allows lazy binding after orchestrator initialization
   */
  setPermissionManager(manager: PermissionManager): void {
    this.permissionManager = manager;
  }

  /**
   * Inject event emitter at runtime
   * Allows visual comparison events to be emitted to orchestrator
   */
  setEventEmitter(emitter: EventEmitter): void {
    this.eventEmitter = emitter;
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
    this.consoleMessages = [];
    this.runtimeErrors = [];

    try {
      // State guard: refuse operations on destroyed instances
      if (this.state === 'destroyed') {
        return {
          success: false,
          operation,
          error: 'Cannot execute operation: BrowserTool instance has been destroyed',
          metadata: {
            url: 'about:blank',
            executionTime: Date.now() - startTime,
            permissionGranted: false,
            target: this.extractTarget(params),
          },
        };
      }

      // State guard: refuse operations during cleanup
      if (this.state === 'cleaning_up') {
        return {
          success: false,
          operation,
          error: 'Cannot execute operation: BrowserTool instance is currently cleaning up',
          metadata: {
            url: 'about:blank',
            executionTime: Date.now() - startTime,
            permissionGranted: false,
            target: this.extractTarget(params),
          },
        };
      }
      // Build permission scope and target for this operation
      const target = this.extractTarget(params);
      const scope = this.buildScope(operation, target);

      // Check tool-level permission
      const permissionResult = await this.checkPermissionInternal(operation, target);

      if (!permissionResult.allowed) {
        const denialReason = permissionResult.denialReason || 'Operation denied by permission policy';

        // Create BrowserPermissionDeniedError with context
        const permissionError = new BrowserPermissionDeniedError(
          `Browser permission denied: ${denialReason}`,
          {
            operation,
            target,
            denialReason,
            permissionType: 'domain', // Default type for general permission checks
            sessionId: this.sessionId
          }
        );

        // Cleanup resources if browser was launched
        if (this.resourceState.browserActive) {
          try {
            await this.cleanup();
          } catch (cleanupError) {
            console.warn('Error during cleanup after permission denial:', cleanupError);
          }
        }

        // Emit permission:denied event via eventEmitter
        if (this.eventEmitter) {
          this.eventEmitter.emit('permission:denied', {
            operation,
            target,
            denialReason,
            sessionId: this.sessionId,
            timestamp: new Date(),
            error: permissionError
          });
        }

        return {
          success: false,
          operation,
          error: permissionError.message,
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
        const denialReason = configCheck.reason || 'Operation restricted by configuration';

        // Determine permission type based on operation
        let permissionType: BrowserPermissionDeniedContext['permissionType'] = 'unknown';
        switch (operation) {
          case 'navigate':
            permissionType = 'domain';
            break;
          case 'evaluate':
            permissionType = 'javascript';
            break;
          case 'submit':
            permissionType = 'form';
            break;
          case 'screenshot':
            permissionType = 'unknown'; // Screenshots don't have a specific browser permission
            break;
          default:
            permissionType = 'unknown';
        }

        // Create BrowserPermissionDeniedError with context
        const permissionError = new BrowserPermissionDeniedError(
          `Browser configuration restriction: ${denialReason}`,
          {
            operation,
            target,
            denialReason,
            permissionType,
            sessionId: this.sessionId
          }
        );

        // Cleanup resources if browser was launched
        if (this.resourceState.browserActive) {
          try {
            await this.cleanup();
          } catch (cleanupError) {
            console.warn('Error during cleanup after configuration restriction:', cleanupError);
          }
        }

        // Emit permission:denied event via eventEmitter
        if (this.eventEmitter) {
          this.eventEmitter.emit('permission:denied', {
            operation,
            target,
            denialReason,
            sessionId: this.sessionId,
            timestamp: new Date(),
            error: permissionError,
            restrictionType: 'configuration'
          });
        }

        return {
          success: false,
          operation,
          error: permissionError.message,
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
        const denialReason = `Dangerous operation requires explicit permission: ${dangerCheck.reason}`;

        // Determine permission type based on operation
        let permissionType: BrowserPermissionDeniedContext['permissionType'] = 'unknown';
        switch (operation) {
          case 'evaluate':
            permissionType = 'javascript';
            break;
          case 'submit':
            permissionType = 'form';
            break;
          case 'navigate':
            permissionType = 'domain';
            break;
          default:
            permissionType = 'unknown';
        }

        // Create BrowserPermissionDeniedError with context
        const permissionError = new BrowserPermissionDeniedError(
          `Dangerous operation blocked: ${dangerCheck.reason}`,
          {
            operation,
            target,
            denialReason,
            permissionType,
            sessionId: this.sessionId
          }
        );

        // Cleanup resources if browser was launched
        if (this.resourceState.browserActive) {
          try {
            await this.cleanup();
          } catch (cleanupError) {
            console.warn('Error during cleanup after dangerous operation block:', cleanupError);
          }
        }

        // Emit permission:denied event via eventEmitter
        if (this.eventEmitter) {
          this.eventEmitter.emit('permission:denied', {
            operation,
            target,
            denialReason,
            sessionId: this.sessionId,
            timestamp: new Date(),
            error: permissionError,
            restrictionType: 'dangerous_operation'
          });
        }

        return {
          success: false,
          operation,
          error: permissionError.message,
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
      // Handle BrowserPermissionDeniedError specifically without crashing
      if (isBrowserPermissionDeniedError(error)) {
        // Cleanup resources if browser was launched
        if (this.resourceState.browserActive) {
          try {
            await this.cleanup();
          } catch (cleanupError) {
            console.warn('Error during cleanup after BrowserPermissionDeniedError:', cleanupError);
          }
        }

        // Emit permission:denied event via eventEmitter
        if (this.eventEmitter) {
          this.eventEmitter.emit('permission:denied', {
            operation,
            target: this.extractTarget({ operation, params: params.params } as any),
            denialReason: error.browserContext.denialReason || error.message,
            sessionId: this.sessionId,
            timestamp: new Date(),
            error: error,
            restrictionType: 'exception'
          });
        }

        return {
          success: false,
          operation,
          error: error.message,
          metadata: {
            url: this.getCurrentUrl(),
            executionTime: Date.now() - startTime,
            permissionGranted: false,
            target: error.browserContext.target,
          },
        };
      }

      // Handle all other errors normally
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
      case 'generatePdf':
        return params.params.path || 'pdf';
      default:
        return 'unknown';
    }
  }

  /**
   * Get current page URL (stub implementation)
   */
  private getCurrentUrl(): string {
    if (this.activeBackend === 'puppeteer') {
      return this.puppeteerPage?.url() || 'about:blank';
    }
    return this.page?.url() || 'about:blank';
  }

  /**
   * Helper method to transition state and emit events
   */
  private transitionState(newState: BrowserToolLifecycleState): void {
    const previousState = this.state;
    this.state = newState;

    // Emit state transition event if eventEmitter is available
    if (this.eventEmitter) {
      this.eventEmitter.emit('browser:state:transition', {
        sessionId: this.sessionId,
        previousState,
        newState,
        timestamp: new Date()
      });
    }
  }

  /**
   * Ensure a browser page is available for operations
   */
  private async ensurePage(config?: BrowserToolConfig): Promise<{ backend: 'playwright' | 'puppeteer'; page: any }> {
    // State guard: refuse operations if destroyed or cleaning up
    if (this.state === 'destroyed') {
      throw new ApexError(
        'Cannot launch browser: BrowserTool instance has been destroyed',
        ApexErrorCode.BROWSER_SESSION_INVALID,
        {
          sessionId: this.sessionId,
          operation: 'ensurePage',
          state: this.state,
          metadata: { resourceState: this.resourceState }
        }
      );
    }

    if (this.state === 'cleaning_up') {
      throw new ApexError(
        'Cannot launch browser: BrowserTool instance is currently cleaning up',
        ApexErrorCode.BROWSER_SESSION_INVALID,
        {
          sessionId: this.sessionId,
          operation: 'ensurePage',
          state: this.state,
          metadata: { resourceState: this.resourceState }
        }
      );
    }

    // If already active, return existing page
    if (this.state === 'active' && (this.page || this.puppeteerPage)) {
      const backend = config?.backend || this.backend;
      this.activeBackend = backend;

      if (backend === 'puppeteer' && this.puppeteerPage) {
        return { backend, page: this.puppeteerPage };
      }
      if (backend === 'playwright' && this.page) {
        return { backend, page: this.page };
      }
    }

    // Transition to launching state
    if (this.state === 'idle') {
      this.transitionState('launching');
    }

    const backend = config?.backend || this.backend;
    this.activeBackend = backend;

    let page: any;
    if (backend === 'puppeteer') {
      page = await this.ensurePuppeteerPage(config);
    } else {
      page = await this.ensurePlaywrightPage(config);
    }

    // Transition to active state once page is ready
    this.transitionState('active');

    return { backend, page };
  }

  private async ensurePlaywrightPage(config?: BrowserToolConfig): Promise<Page> {
    if (this.page) {
      return this.page;
    }

    const engine = config?.engine || this.engine;
    const headless = config?.headless ?? this.headless ?? true;

    const browserType = engine === 'firefox' ? firefox : engine === 'webkit' ? webkit : chromium;
    this.browser = await browserType.launch({ headless });
    this.updateResourceStateOnLaunch();

    this.context = await this.browser.newContext({
      userAgent: config?.userAgent,
      viewport: config?.viewport,
      acceptDownloads: config?.allowDownloads ?? true,
    });
    this.updateResourceStateOnContextCreate();

    if (config?.blockPopups) {
      this.context.on('page', async (popup) => {
        try {
          await popup.close();
        } catch {
          // Ignore popup close errors
        }
      });
    }

    this.page = await this.context.newPage();
    this.updateResourceStateOnPageCreate();
    this.setupPageListeners(this.page);
    await this.setupConsoleStreaming(this.page, config);
    return this.page;
  }

  private async ensurePuppeteerPage(config?: BrowserToolConfig): Promise<any> {
    if (this.puppeteerPage) {
      return this.puppeteerPage;
    }

    const headless = config?.headless ?? this.headless ?? true;
    const puppeteerModule = await this.loadPuppeteer();
    this.puppeteerBrowser = await puppeteerModule.launch({ headless });
    this.puppeteerPage = await this.puppeteerBrowser.newPage();

    if (config?.viewport) {
      await this.puppeteerPage.setViewport({
        width: config.viewport.width,
        height: config.viewport.height,
      });
    }

    if (config?.userAgent) {
      await this.puppeteerPage.setUserAgent(config.userAgent);
    }

    this.setupPuppeteerPageListeners(this.puppeteerPage);
    // Note: Enhanced console streaming with Puppeteer requires additional setup
    // For now, keep the legacy listener approach for Puppeteer compatibility
    return this.puppeteerPage;
  }

  private async loadPuppeteer(): Promise<any> {
    try {
      const module = await import('puppeteer');
      return module.default ?? module;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Puppeteer backend requested but puppeteer is not installed: ${message}`);
    }
  }

  private mapWaitUntil(
    waitUntil: BrowserNavigateParams['waitUntil'] | undefined,
    backend: 'playwright' | 'puppeteer'
  ): string {
    if (!waitUntil) {
      return 'load';
    }
    if (backend === 'puppeteer' && waitUntil === 'networkidle') {
      return 'networkidle0';
    }
    return waitUntil;
  }

  private getViewportSize(page: any, backend: 'playwright' | 'puppeteer'): { width: number; height: number } {
    if (backend === 'puppeteer') {
      const viewport = page.viewport?.();
      return {
        width: viewport?.width ?? 0,
        height: viewport?.height ?? 0,
      };
    }

    const viewport = page.viewportSize?.();
    return {
      width: viewport?.width ?? 0,
      height: viewport?.height ?? 0,
    };
  }

  private async captureElementScreenshot(
    page: any,
    backend: 'playwright' | 'puppeteer',
    selector: string,
    options: { path?: string; type?: 'png' | 'jpeg'; quality?: number }
  ): Promise<Buffer> {
    if (backend === 'puppeteer') {
      const element = await page.$(selector);
      if (!element) {
        throw new Error(`Element not found for selector: ${selector}`);
      }
      return element.screenshot(options);
    }

    return page.locator(selector).screenshot(options);
  }

  /**
   * Set up enhanced console streaming for the page
   */
  private async setupConsoleStreaming(page: Page, config?: BrowserToolConfig): Promise<void> {
    const consoleConfig = config?.consoleStream;

    // Only set up streaming if explicitly enabled or if no config provided (default enabled)
    if (consoleConfig?.enabled === false) {
      return;
    }

    try {
      this.consoleStream = new BrowserConsoleStream(consoleConfig?.config);

      // Set up event listeners for enhanced console data
      this.consoleStream.on('message', (message) => {
        this.enhancedConsoleMessages.push(message);
        // Limit buffer size to prevent memory issues
        if (this.enhancedConsoleMessages.length > 1000) {
          this.enhancedConsoleMessages = this.enhancedConsoleMessages.slice(-1000);
        }
      });

      this.consoleStream.on('error', (error) => {
        this.enhancedRuntimeErrors.push(error);
        // Limit buffer size to prevent memory issues
        if (this.enhancedRuntimeErrors.length > 1000) {
          this.enhancedRuntimeErrors = this.enhancedRuntimeErrors.slice(-1000);
        }
      });

      // Start streaming
      await this.consoleStream.startStream(page);
    } catch (error) {
      console.warn('Failed to set up console streaming:', error);
      // Fall back to legacy console capture if streaming fails
    }
  }

  /**
   * Track console and runtime errors for visual regression and diagnostics
   * @deprecated Legacy method, enhanced by setupConsoleStreaming
   */
  private setupPageListeners(page: Page): void {
    page.on('console', (message) => {
      const entry: BrowserConsoleMessage = {
        type: message.type(),
        text: message.text(),
        timestamp: new Date(),
      };
      this.consoleMessages.push(entry);

      if (message.type() === 'error') {
        this.runtimeErrors.push({
          message: message.text(),
          timestamp: new Date(),
        });
      }
    });

    page.on('pageerror', (error) => {
      this.runtimeErrors.push({
        message: error.message,
        stack: error.stack,
        timestamp: new Date(),
      });
    });
  }

  private setupPuppeteerPageListeners(page: any): void {
    page.on('console', (message: any) => {
      const entry: BrowserConsoleMessage = {
        type: message.type(),
        text: message.text(),
        timestamp: new Date(),
      };
      this.consoleMessages.push(entry);

      if (message.type() === 'error') {
        this.runtimeErrors.push({
          message: message.text(),
          timestamp: new Date(),
        });
      }
    });

    page.on('pageerror', (error: Error) => {
      this.runtimeErrors.push({
        message: error.message,
        stack: error.stack,
        timestamp: new Date(),
      });
    });
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
    const config = this.permissionManager
      ? (await this.permissionManager.getToolConfig('Browser') as BrowserToolConfig | null)
      : null;
    const { backend, page } = await this.ensurePage(config || undefined);
    const isPuppeteer = backend === 'puppeteer';
    const viewport = this.getViewportSize(page, backend);

    switch (operation) {
      case 'navigate': {
        const { url } = (params as { params: BrowserNavigateParams }).params;
        const waitUntil = (params as { params: BrowserNavigateParams }).params.waitUntil;
        const timeout = (params as { params: BrowserNavigateParams }).params.timeout || config?.pageLoadTimeout;
        const response = await page.goto(url, {
          waitUntil: this.mapWaitUntil(waitUntil, backend),
          timeout,
        });
        const status = typeof response?.status === 'function' ? response.status() : response?.status;
        return {
          success: true,
          operation,
          data: { url, status },
          metadata: {
            url,
            title: await page.title(),
            executionTime: 0,
            permissionGranted: true,
            consoleMessages: this.consoleMessages,
            runtimeErrors: this.runtimeErrors,
            enhancedConsoleMessages: this.enhancedConsoleMessages,
            enhancedRuntimeErrors: this.enhancedRuntimeErrors,
          },
        };
      }

      case 'click': {
        const { selector } = (params as { params: BrowserClickParams }).params;
        await page.click(selector, {
          button: (params as { params: BrowserClickParams }).params.button,
          clickCount: (params as { params: BrowserClickParams }).params.clickCount,
          delay: (params as { params: BrowserClickParams }).params.delay,
        });
        return {
          success: true,
          operation,
          data: { clicked: selector },
          metadata: {
            url: this.getCurrentUrl(),
            title: await page.title(),
            executionTime: 0,
            permissionGranted: true,
            consoleMessages: this.consoleMessages,
            runtimeErrors: this.runtimeErrors,
            enhancedConsoleMessages: this.enhancedConsoleMessages,
            enhancedRuntimeErrors: this.enhancedRuntimeErrors,
          },
        };
      }

      case 'type': {
        const { selector, text } = (params as { params: BrowserTypeParams }).params;
        const typeParams = (params as { params: BrowserTypeParams }).params;
        if (typeParams.clearFirst) {
          if (isPuppeteer) {
            await page.evaluate((sel: string) => {
              const doc = (globalThis as { document?: { querySelector?: (value: string) => { value?: string } | null } }).document;
              const element = doc?.querySelector?.(sel) ?? null;
              if (element) {
                element.value = '';
              }
            }, selector);
          } else {
            await page.fill(selector, '');
          }
        }
        if (typeParams.delay) {
          await page.click(selector);
          await page.type(selector, text, { delay: typeParams.delay });
        } else if (isPuppeteer) {
          await page.type(selector, text);
        } else {
          await page.fill(selector, text);
        }
        return {
          success: true,
          operation,
          data: { typed: text, into: selector },
          metadata: {
            url: this.getCurrentUrl(),
            title: await page.title(),
            executionTime: 0,
            permissionGranted: true,
            consoleMessages: this.consoleMessages,
            runtimeErrors: this.runtimeErrors,
            enhancedConsoleMessages: this.enhancedConsoleMessages,
            enhancedRuntimeErrors: this.enhancedRuntimeErrors,
          },
        };
      }

      case 'screenshot': {
        const screenshotParams = (params as { params: BrowserScreenshotParams }).params;
        const screenshotBuffer = screenshotParams.selector
          ? await this.captureElementScreenshot(page, backend, screenshotParams.selector, {
            path: screenshotParams.path,
            type: screenshotParams.format,
            quality: screenshotParams.quality,
          })
          : await page.screenshot({
            path: screenshotParams.path,
            fullPage: screenshotParams.fullPage,
            type: screenshotParams.format,
            quality: screenshotParams.quality,
          });
        return {
          success: true,
          operation,
          data: {
            width: viewport.width,
            height: viewport.height,
            format: screenshotParams.format || 'png',
          },
          screenshot: screenshotParams.path
            ? screenshotParams.path
            : `data:image/${screenshotParams.format || 'png'};base64,${Buffer.from(screenshotBuffer).toString('base64')}`,
          metadata: {
            url: this.getCurrentUrl(),
            title: await page.title(),
            executionTime: 0,
            permissionGranted: true,
            consoleMessages: this.consoleMessages,
            runtimeErrors: this.runtimeErrors,
            enhancedConsoleMessages: this.enhancedConsoleMessages,
            enhancedRuntimeErrors: this.enhancedRuntimeErrors,
          },
        };
      }

      case 'compareScreenshot': {
        const compareParams = (params as { params: BrowserCompareScreenshotParams }).params;
        const currentBuffer = compareParams.selector
          ? await this.captureElementScreenshot(page, backend, compareParams.selector, {
            type: compareParams.format || 'png',
            quality: compareParams.quality,
          })
          : await page.screenshot({
            fullPage: compareParams.fullPage,
            type: compareParams.format || 'png',
            quality: compareParams.quality,
          });

        if (!fs.existsSync(compareParams.baselinePath)) {
          return {
            success: false,
            operation,
            error: `Baseline screenshot not found: ${compareParams.baselinePath}`,
            metadata: {
              url: this.getCurrentUrl(),
              title: await page.title(),
              executionTime: 0,
              permissionGranted: true,
              consoleMessages: this.consoleMessages,
              runtimeErrors: this.runtimeErrors,
            },
          };
        }

        const baselineBuffer = fs.readFileSync(compareParams.baselinePath);
        const baseline = PNG.sync.read(baselineBuffer);
        const current = PNG.sync.read(currentBuffer);

        if (baseline.width !== current.width || baseline.height !== current.height) {
          return {
            success: false,
            operation,
            error: `Screenshot size mismatch: baseline ${baseline.width}x${baseline.height} vs current ${current.width}x${current.height}`,
            metadata: {
              url: this.getCurrentUrl(),
              title: await page.title(),
              executionTime: 0,
              permissionGranted: true,
              consoleMessages: this.consoleMessages,
              runtimeErrors: this.runtimeErrors,
            },
          };
        }

        const diff = new PNG({ width: baseline.width, height: baseline.height });
        const diffPixels = pixelmatch(
          baseline.data,
          current.data,
          diff.data,
          baseline.width,
          baseline.height,
          { threshold: compareParams.threshold ?? 0.1 }
        );
        const totalPixels = baseline.width * baseline.height;
        const diffRatio = totalPixels > 0 ? diffPixels / totalPixels : 0;

        if (compareParams.diffPath) {
          fs.writeFileSync(compareParams.diffPath, PNG.sync.write(diff));
        }

        const passed = diffRatio <= (compareParams.threshold ?? 0.1);
        const diffPercentage = diffRatio * 100;

        // Emit visual comparison event if eventEmitter is available
        if (this.eventEmitter) {
          const eventData: VisualComparisonEventData = {
            testId: compareParams.testId || `screenshot-${Date.now()}`,
            baseline: compareParams.baselinePath,
            actual: compareParams.selector ? `element-screenshot-${compareParams.selector}` : 'full-page-screenshot',
            diffImage: compareParams.diffPath,
            diffPercentage,
            threshold: (compareParams.threshold ?? 0.1) * 100,
            passed,
            pageUrl: this.getCurrentUrl(),
            selector: compareParams.selector,
            taskId: 'unknown', // This will be set by the orchestrator
            timestamp: new Date(),
          };

          const eventType = passed ? 'visual:comparison:passed' : 'visual:comparison:failed';
          this.eventEmitter.emit(eventType, eventData);
        }

        return {
          success: true,
          operation,
          data: {
            differentPixels: diffPixels,
            totalPixels,
            similarity: 1 - diffRatio,
            diffRatio,
            threshold: compareParams.threshold ?? 0.1,
            isMatch: passed,
            match: passed, // Keep legacy field for compatibility
            diffPath: compareParams.diffPath,
            dimensions: {
              width: baseline.width,
              height: baseline.height,
            },
          },
          metadata: {
            url: this.getCurrentUrl(),
            title: await page.title(),
            executionTime: 0,
            permissionGranted: true,
            consoleMessages: this.consoleMessages,
            runtimeErrors: this.runtimeErrors,
            enhancedConsoleMessages: this.enhancedConsoleMessages,
            enhancedRuntimeErrors: this.enhancedRuntimeErrors,
          },
        };
      }

      case 'evaluate': {
        const { script } = (params as { params: BrowserEvaluateParams }).params;
        const { args } = (params as { params: BrowserEvaluateParams }).params;
        const result = await page.evaluate(
          (payload: { snippet: string; args?: unknown[] }) => {
            const { snippet, args: evalArgs } = payload;
            const fn = new Function('args', `"use strict"; return (async () => { ${snippet} })();`);
            return fn(evalArgs || []);
          },
          { snippet: script, args }
        );
        return {
          success: true,
          operation,
          data: { result },
          metadata: {
            url: this.getCurrentUrl(),
            title: await page.title(),
            executionTime: 0,
            permissionGranted: true,
            consoleMessages: this.consoleMessages,
            runtimeErrors: this.runtimeErrors,
            enhancedConsoleMessages: this.enhancedConsoleMessages,
            enhancedRuntimeErrors: this.enhancedRuntimeErrors,
          },
        };
      }

      case 'submit': {
        const { selector } = (params as { params: BrowserSubmitParams }).params;
        const submitParams = (params as { params: BrowserSubmitParams }).params;
        if (isPuppeteer) {
          await page.$eval(selector, (form: any, validate: boolean) => {
            const formElement = form as { reportValidity?: () => void; submit?: () => void };
            if (validate && formElement.reportValidity) {
              formElement.reportValidity();
            }
            formElement.submit?.();
          }, submitParams.validate ?? false);
        } else {
          await page.locator(selector).evaluate((form: any, validate: boolean) => {
            const formElement = form as { reportValidity?: () => void; submit?: () => void };
            if (validate && formElement.reportValidity) {
              formElement.reportValidity();
            }
            formElement.submit?.();
          }, submitParams.validate ?? false);
        }
        return {
          success: true,
          operation,
          data: { submitted: selector },
          metadata: {
            url: this.getCurrentUrl(),
            title: await page.title(),
            executionTime: 0,
            permissionGranted: true,
            consoleMessages: this.consoleMessages,
            runtimeErrors: this.runtimeErrors,
            enhancedConsoleMessages: this.enhancedConsoleMessages,
            enhancedRuntimeErrors: this.enhancedRuntimeErrors,
          },
        };
      }

      case 'waitForSelector': {
        const { selector } = (params as { params: BrowserWaitForSelectorParams }).params;
        const waitParams = (params as { params: BrowserWaitForSelectorParams }).params;
        if (isPuppeteer) {
          await page.waitForSelector(selector, {
            timeout: waitParams.timeout,
            visible: waitParams.visible || undefined,
          });
        } else {
          await page.waitForSelector(selector, {
            timeout: waitParams.timeout,
            state: waitParams.visible ? 'visible' : 'attached',
          });
        }
        return {
          success: true,
          operation,
          data: { found: selector },
          metadata: {
            url: this.getCurrentUrl(),
            title: await page.title(),
            executionTime: 0,
            permissionGranted: true,
            consoleMessages: this.consoleMessages,
            runtimeErrors: this.runtimeErrors,
            enhancedConsoleMessages: this.enhancedConsoleMessages,
            enhancedRuntimeErrors: this.enhancedRuntimeErrors,
          },
        };
      }

      case 'getAttribute': {
        const { selector, attribute } = (params as { params: BrowserGetAttributeParams }).params;
        const value = isPuppeteer
          ? await page.$eval(selector, (element: any, attr: string) => element.getAttribute(attr), attribute)
          : await page.getAttribute(selector, attribute);
        return {
          success: true,
          operation,
          data: { attribute, value },
          metadata: {
            url: this.getCurrentUrl(),
            title: await page.title(),
            executionTime: 0,
            permissionGranted: true,
            consoleMessages: this.consoleMessages,
            runtimeErrors: this.runtimeErrors,
            enhancedConsoleMessages: this.enhancedConsoleMessages,
            enhancedRuntimeErrors: this.enhancedRuntimeErrors,
          },
        };
      }

      case 'getText': {
        const { selector } = (params as { params: BrowserGetTextParams }).params;
        const text = isPuppeteer
          ? await page.$eval(selector, (element: any) => element.textContent || '')
          : await page.textContent(selector);
        return {
          success: true,
          operation,
          data: { text },
          metadata: {
            url: this.getCurrentUrl(),
            title: await page.title(),
            executionTime: 0,
            permissionGranted: true,
            consoleMessages: this.consoleMessages,
            runtimeErrors: this.runtimeErrors,
            enhancedConsoleMessages: this.enhancedConsoleMessages,
            enhancedRuntimeErrors: this.enhancedRuntimeErrors,
          },
        };
      }

      case 'getHtml': {
        const { selector } = (params as { params: BrowserGetHtmlParams }).params;
        const html = selector
          ? (isPuppeteer
            ? await page.$eval(selector, (element: any) => element.innerHTML)
            : await page.innerHTML(selector))
          : await page.content();
        return {
          success: true,
          operation,
          data: {
            html,
          },
          metadata: {
            url: this.getCurrentUrl(),
            title: await page.title(),
            executionTime: 0,
            permissionGranted: true,
            consoleMessages: this.consoleMessages,
            runtimeErrors: this.runtimeErrors,
            enhancedConsoleMessages: this.enhancedConsoleMessages,
            enhancedRuntimeErrors: this.enhancedRuntimeErrors,
          },
        };
      }

      case 'scroll': {
        const scrollParams = (params as { params: BrowserScrollParams }).params;
        if (scrollParams.selector) {
          if (isPuppeteer) {
            await page.$eval(scrollParams.selector, (element: any) => element.scrollIntoView());
          } else {
            await page.locator(scrollParams.selector).scrollIntoViewIfNeeded();
          }
        } else {
          await page.evaluate((payload: { x?: number; y?: number }) => {
            const { x, y } = payload;
            const scrollTo = (globalThis as { scrollTo?: (scrollX: number, scrollY: number) => void }).scrollTo;
            scrollTo?.(x ?? 0, y ?? 0);
          }, {
            x: scrollParams.x,
            y: scrollParams.y,
          });
        }
        return {
          success: true,
          operation,
          data: {
            scrolled: scrollParams.selector || `${scrollParams.x || 0},${scrollParams.y || 0}`
          },
          metadata: {
            url: this.getCurrentUrl(),
            title: await page.title(),
            executionTime: 0,
            permissionGranted: true,
            consoleMessages: this.consoleMessages,
            runtimeErrors: this.runtimeErrors,
            enhancedConsoleMessages: this.enhancedConsoleMessages,
            enhancedRuntimeErrors: this.enhancedRuntimeErrors,
          },
        };
      }

      case 'hover': {
        const { selector } = (params as { params: BrowserHoverParams }).params;
        await page.hover(selector);
        return {
          success: true,
          operation,
          data: { hovered: selector },
          metadata: {
            url: this.getCurrentUrl(),
            title: await page.title(),
            executionTime: 0,
            permissionGranted: true,
            consoleMessages: this.consoleMessages,
            runtimeErrors: this.runtimeErrors,
            enhancedConsoleMessages: this.enhancedConsoleMessages,
            enhancedRuntimeErrors: this.enhancedRuntimeErrors,
          },
        };
      }

      case 'generatePdf': {
        const pdfParams = (params as { params: BrowserGeneratePdfParams }).params;

        // PDF generation is only supported in Chromium browsers with Playwright
        if (isPuppeteer || this.engine !== 'chromium') {
          return {
            success: false,
            operation,
            error: 'PDF generation is only supported with Playwright using Chromium browser',
            metadata: {
              url: this.getCurrentUrl(),
              title: await page.title(),
              executionTime: 0,
              permissionGranted: true,
              consoleMessages: this.consoleMessages,
              runtimeErrors: this.runtimeErrors,
            },
          };
        }

        try {
          const pdfBuffer = await page.pdf({
            path: pdfParams.path,
            format: pdfParams.format || 'A4',
            width: pdfParams.width,
            height: pdfParams.height,
            margin: pdfParams.margin,
            landscape: pdfParams.landscape || false,
            printBackground: pdfParams.printBackground || false,
            scale: pdfParams.scale || 1,
            pageRanges: pdfParams.pageRanges,
            preferCSSPageSize: pdfParams.preferCSSPageSize || false,
            displayHeaderFooter: pdfParams.displayHeaderFooter || false,
            headerTemplate: pdfParams.headerTemplate,
            footerTemplate: pdfParams.footerTemplate,
          });

          return {
            success: true,
            operation,
            data: {
              format: pdfParams.format || 'A4',
              landscape: pdfParams.landscape || false,
              pages: pdfParams.pageRanges || 'all',
              size: pdfBuffer.length,
            },
            screenshot: pdfParams.path
              ? pdfParams.path
              : `data:application/pdf;base64,${pdfBuffer.toString('base64')}`,
            metadata: {
              url: this.getCurrentUrl(),
              title: await page.title(),
              executionTime: 0,
              permissionGranted: true,
              consoleMessages: this.consoleMessages,
              runtimeErrors: this.runtimeErrors,
              enhancedConsoleMessages: this.enhancedConsoleMessages,
              enhancedRuntimeErrors: this.enhancedRuntimeErrors,
            },
          };
        } catch (error) {
          return {
            success: false,
            operation,
            error: `PDF generation failed: ${this.formatError(error)}`,
            metadata: {
              url: this.getCurrentUrl(),
              title: await page.title(),
              executionTime: 0,
              permissionGranted: true,
              consoleMessages: this.consoleMessages,
              runtimeErrors: this.runtimeErrors,
            },
          };
        }
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
   * Get enhanced console messages from the stream
   */
  getEnhancedConsoleMessages(): EnhancedConsoleMessage[] {
    return [...this.enhancedConsoleMessages];
  }

  /**
   * Get enhanced runtime errors from the stream
   */
  getEnhancedRuntimeErrors(): EnhancedRuntimeError[] {
    return [...this.enhancedRuntimeErrors];
  }

  /**
   * Get console stream instance for direct access
   */
  getConsoleStream(): BrowserConsoleStream | undefined {
    return this.consoleStream;
  }

  /**
   * Clear all console and error buffers
   */
  clearConsoleBuffers(): void {
    this.consoleMessages = [];
    this.runtimeErrors = [];
    this.enhancedConsoleMessages = [];
    this.enhancedRuntimeErrors = [];
    if (this.consoleStream) {
      this.consoleStream.clearBuffers();
    }
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

  /**
   * Generate a unique session ID for tracking browser resources
   */
  private generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `browser_${timestamp}_${random}`;
  }

  /**
   * Get current resource state
   */
  public getResourceState(): BrowserResourceState {
    return { ...this.resourceState };
  }

  /**
   * Check if the BrowserTool instance is currently active
   */
  public isActive(): boolean {
    return this.state === 'active';
  }

  /**
   * Get current lifecycle state
   */
  public getState(): BrowserToolLifecycleState {
    return this.state;
  }

  /**
   * Update resource state when browser is launched
   */
  private updateResourceStateOnLaunch(): void {
    this.resourceState = {
      ...this.resourceState,
      browserActive: true,
      lastAllocation: new Date()
    };
  }

  /**
   * Update resource state when context is created
   */
  private updateResourceStateOnContextCreate(): void {
    this.resourceState = {
      ...this.resourceState,
      contextActive: true,
      lastAllocation: new Date()
    };
  }

  /**
   * Update resource state when page is created
   */
  private updateResourceStateOnPageCreate(url?: string): void {
    this.resourceState = {
      ...this.resourceState,
      pageActive: true,
      currentUrl: url,
      lastAllocation: new Date()
    };
  }

  /**
   * Increment active operations count
   */
  private incrementActiveOperations(): void {
    this.resourceState.activeOperations++;
  }

  /**
   * Decrement active operations count
   */
  private decrementActiveOperations(): void {
    this.resourceState.activeOperations = Math.max(0, this.resourceState.activeOperations - 1);
  }

  /**
   * Gracefully cleanup all browser resources
   * Called when permission is denied or on normal shutdown
   */
  public async cleanup(): Promise<void> {
    // Skip if already destroyed or currently cleaning up
    if (this.state === 'destroyed' || this.state === 'cleaning_up') {
      return;
    }

    // Transition to cleaning_up state
    this.transitionState('cleaning_up');

    try {
      // Close console stream first and properly stop streaming
      if (this.consoleStream) {
        try {
          this.consoleStream.stopStream();
          this.consoleStream.clearBuffers();
        } catch (error) {
          console.warn('Error stopping console stream during cleanup:', error);
        } finally {
          this.consoleStream = undefined;
        }
      }

      // Clear any pending operations
      this.resourceState.activeOperations = 0;

      // Close page if it exists
      if (this.page) {
        try {
          await this.page.close();
          this.resourceState.pageActive = false;
          this.resourceState.currentUrl = undefined;
        } catch (error) {
          // Log but don't throw - we're in cleanup mode
          console.warn('Error closing page during cleanup:', error);
        } finally {
          this.page = undefined;
        }
      }

      // Close context if it exists
      if (this.context) {
        try {
          await this.context.close();
          this.resourceState.contextActive = false;
        } catch (error) {
          console.warn('Error closing context during cleanup:', error);
        } finally {
          this.context = undefined;
        }
      }

      // Close browser if it exists
      if (this.browser) {
        try {
          await this.browser.close();
          this.resourceState.browserActive = false;
        } catch (error) {
          console.warn('Error closing browser during cleanup:', error);
        } finally {
          this.browser = undefined;
        }
      }

      // Close puppeteer resources if they exist
      if (this.puppeteerPage) {
        try {
          await this.puppeteerPage.close();
        } catch (error) {
          console.warn('Error closing puppeteer page during cleanup:', error);
        } finally {
          this.puppeteerPage = undefined;
        }
      }

      if (this.puppeteerBrowser) {
        try {
          await this.puppeteerBrowser.close();
        } catch (error) {
          console.warn('Error closing puppeteer browser during cleanup:', error);
        } finally {
          this.puppeteerBrowser = undefined;
        }
      }

      // Clear buffers
      this.clearConsoleBuffers();

      // Transition to destroyed state after successful cleanup
      this.transitionState('destroyed');

    } catch (error) {
      // If cleanup itself fails, throw a resource leak error
      throw new ApexError(
        'Failed to cleanup browser resources',
        ApexErrorCode.BROWSER_RESOURCE_LEAK,
        {
          sessionId: this.sessionId,
          operation: 'cleanup',
          metadata: { resourceState: this.resourceState }
        },
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Forcefully destroy all browser resources
   * This is a more aggressive cleanup that ensures all resources are released
   * and the tool is in a clean state, even if normal cleanup fails
   */
  public async destroy(): Promise<void> {
    // Skip if already destroyed
    if (this.state === 'destroyed') {
      return;
    }

    try {
      // Attempt normal cleanup first
      await this.cleanup();
    } catch (cleanupError) {
      // If cleanup fails, force reset all resources
      console.warn('Normal cleanup failed, forcing resource reset:', cleanupError);

      // Transition to cleaning_up state if not already there
      if (this.state !== 'cleaning_up') {
        this.transitionState('cleaning_up');
      }

      // Force nullify all references
      this.page = undefined;
      this.context = undefined;
      this.browser = undefined;
      this.puppeteerPage = undefined;
      this.puppeteerBrowser = undefined;
      this.consoleStream = undefined;

      // Reset resource state to inactive
      this.resourceState = {
        browserActive: false,
        contextActive: false,
        pageActive: false,
        sessionId: this.sessionId,
        activeOperations: 0,
        currentUrl: undefined,
        lastAllocation: undefined
      };

      // Clear all buffers
      this.consoleMessages = [];
      this.runtimeErrors = [];
      this.enhancedConsoleMessages = [];
      this.enhancedRuntimeErrors = [];

      // Generate new session ID to ensure fresh state
      this.sessionId = this.generateSessionId();
      this.resourceState.sessionId = this.sessionId;

      // Transition to destroyed state
      this.transitionState('destroyed');
    }
  }

  /**
   * Handle permission denied errors with proper cleanup
   */
  private async handlePermissionDeniedError(
    operation: BrowserOperation,
    target: string,
    denialReason: string,
    permissionType?: BrowserPermissionDeniedError['browserContext']['permissionType']
  ): Promise<never> {
    // Perform cleanup before throwing error
    try {
      await this.cleanup();
    } catch (cleanupError) {
      // If cleanup fails, throw a resource leak error instead
      throw new ApexError(
        `Permission denied for ${operation} and subsequent resource cleanup failed`,
        ApexErrorCode.BROWSER_RESOURCE_LEAK,
        {
          operation,
          target,
          sessionId: this.sessionId,
          metadata: {
            originalDenialReason: denialReason,
            resourceState: this.resourceState,
            cleanupError: cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
          }
        }
      );
    }

    // Throw the permission denied error
    throw new BrowserPermissionDeniedError(
      `Browser permission denied: ${denialReason}`,
      {
        operation,
        target,
        permissionType,
        denialReason,
        sessionId: this.sessionId
      }
    );
  }

  /**
   * Validate session state and throw error if invalid
   */
  private validateSessionState(): void {
    // Check for inconsistent state that indicates resource leaks
    const hasPlaywrightResources = this.browser || this.context || this.page;
    const hasPuppeteerResources = this.puppeteerBrowser || this.puppeteerPage;
    const resourceStateIndicatesActive = this.resourceState.browserActive ||
      this.resourceState.contextActive ||
      this.resourceState.pageActive;

    if ((hasPlaywrightResources || hasPuppeteerResources) && !resourceStateIndicatesActive) {
      throw new ApexError(
        'Browser session state is invalid - resources exist but state indicates inactive',
        ApexErrorCode.BROWSER_SESSION_INVALID,
        {
          sessionId: this.sessionId,
          metadata: {
            resourceState: this.resourceState,
            hasPlaywrightResources: !!hasPlaywrightResources,
            hasPuppeteerResources: !!hasPuppeteerResources
          }
        }
      );
    }

    if (!hasPlaywrightResources && !hasPuppeteerResources && resourceStateIndicatesActive) {
      throw new ApexError(
        'Browser session state is invalid - state indicates active but no resources exist',
        ApexErrorCode.BROWSER_SESSION_INVALID,
        {
          sessionId: this.sessionId,
          metadata: {
            resourceState: this.resourceState,
            hasPlaywrightResources: !!hasPlaywrightResources,
            hasPuppeteerResources: !!hasPuppeteerResources
          }
        }
      );
    }
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
