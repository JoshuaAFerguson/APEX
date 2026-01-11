/**
 * Browser Console Stream Implementation
 *
 * Provides real-time console log capture and streaming capabilities for browser automation.
 * This module extends the basic console message capture in BrowserTool with enhanced
 * streaming, filtering, and error context capabilities.
 *
 * Features:
 * - Real-time console message streaming via EventEmitter
 * - Enhanced error detection with stack trace parsing
 * - Console message filtering and categorization
 * - Performance monitoring and metrics
 * - Context-aware error reporting
 */

import { EventEmitter } from 'eventemitter3';
import { Page } from 'playwright';

/**
 * Console log levels with severity ordering
 */
export enum ConsoleLogLevel {
  VERBOSE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  FATAL = 5,
}

/**
 * Enhanced console message with additional context
 */
export interface BrowserConsoleMessage {
  /** Message type (log, error, warn, info, debug, etc.) */
  type: string;
  /** Console message text */
  text: string;
  /** Message timestamp */
  timestamp: Date;
  /** Log level for filtering */
  level: ConsoleLogLevel;
  /** Arguments passed to console method */
  args?: unknown[];
  /** Location information if available */
  location?: {
    url: string;
    lineNumber?: number;
    columnNumber?: number;
  };
  /** Stack trace for errors */
  stack?: string;
  /** Session ID for tracking */
  sessionId?: string;
  /** Page context information */
  pageContext?: {
    url: string;
    title: string;
    userAgent: string;
  };
}

/**
 * Enhanced runtime error with detailed context
 */
export interface BrowserRuntimeError {
  /** Error message */
  message: string;
  /** Error name/type */
  name?: string;
  /** Full stack trace */
  stack?: string;
  /** Error timestamp */
  timestamp: Date;
  /** Source location */
  source?: {
    url: string;
    line: number;
    column: number;
  };
  /** Error category */
  category: 'javascript' | 'network' | 'security' | 'permission' | 'resource' | 'unknown';
  /** Error severity */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Additional context data */
  context?: {
    userAgent: string;
    pageUrl: string;
    pageTitle: string;
    viewport: { width: number; height: number };
    timestamp: Date;
  };
  /** Session ID for tracking */
  sessionId?: string;
}

/**
 * Console stream configuration
 */
export interface ConsoleStreamConfig {
  /** Minimum log level to capture */
  minLevel?: ConsoleLogLevel;
  /** Maximum number of messages to buffer */
  maxBufferSize?: number;
  /** Whether to capture console arguments */
  captureArgs?: boolean;
  /** Whether to capture stack traces */
  captureStackTraces?: boolean;
  /** Session ID for message tracking */
  sessionId?: string;
  /** Custom message filters */
  filters?: ConsoleMessageFilter[];
}

/**
 * Console message filter function
 */
export type ConsoleMessageFilter = (message: BrowserConsoleMessage) => boolean;

/**
 * Console stream events
 */
export interface ConsoleStreamEvents {
  'message': (message: BrowserConsoleMessage) => void;
  'error': (error: BrowserRuntimeError) => void;
  'network-error': (error: NetworkError) => void;
  'performance-warning': (warning: PerformanceWarning) => void;
  'security-violation': (violation: SecurityViolation) => void;
  'buffer-full': (droppedCount: number) => void;
  'stream-started': (config: ConsoleStreamConfig) => void;
  'stream-stopped': () => void;
}

/**
 * Network error information
 */
export interface NetworkError {
  url: string;
  method: string;
  status: number;
  statusText: string;
  timestamp: Date;
  sessionId?: string;
}

/**
 * Performance warning information
 */
export interface PerformanceWarning {
  type: 'slow-script' | 'memory-high' | 'layout-thrashing' | 'long-task';
  message: string;
  duration?: number;
  timestamp: Date;
  sessionId?: string;
}

/**
 * Security violation information
 */
export interface SecurityViolation {
  type: 'csp' | 'cors' | 'mixed-content' | 'unsafe-eval';
  message: string;
  blockedURI?: string;
  timestamp: Date;
  sessionId?: string;
}

/**
 * Browser Console Stream Class
 *
 * Manages real-time capture and streaming of browser console messages,
 * errors, and other runtime events with enhanced context and filtering.
 */
export class BrowserConsoleStream extends EventEmitter<ConsoleStreamEvents> {
  private page?: Page;
  private config: Required<ConsoleStreamConfig>;
  private messageBuffer: BrowserConsoleMessage[] = [];
  private errorBuffer: BrowserRuntimeError[] = [];
  private isActive = false;
  private sessionId: string;

  constructor(config: ConsoleStreamConfig = {}) {
    super();

    this.config = {
      minLevel: config.minLevel ?? ConsoleLogLevel.DEBUG,
      maxBufferSize: config.maxBufferSize ?? 1000,
      captureArgs: config.captureArgs ?? true,
      captureStackTraces: config.captureStackTraces ?? true,
      sessionId: config.sessionId ?? this.generateSessionId(),
      filters: config.filters ?? [],
    };

    this.sessionId = this.config.sessionId;
  }

  /**
   * Start console streaming for the given page
   */
  async startStream(page: Page): Promise<void> {
    if (this.isActive) {
      throw new Error('Console stream is already active');
    }

    this.page = page;
    this.isActive = true;
    this.setupPageListeners(page);

    this.emit('stream-started', this.config);
  }

  /**
   * Stop console streaming
   */
  stopStream(): void {
    if (!this.isActive) {
      return;
    }

    this.isActive = false;
    this.page = undefined;
    this.emit('stream-stopped');
  }

  /**
   * Get buffered console messages
   */
  getMessages(): BrowserConsoleMessage[] {
    return [...this.messageBuffer];
  }

  /**
   * Get buffered runtime errors
   */
  getErrors(): BrowserRuntimeError[] {
    return [...this.errorBuffer];
  }

  /**
   * Clear message and error buffers
   */
  clearBuffers(): void {
    this.messageBuffer = [];
    this.errorBuffer = [];
  }

  /**
   * Get stream statistics
   */
  getStats(): {
    messagesCount: number;
    errorsCount: number;
    isActive: boolean;
    sessionId: string;
    startTime?: Date;
  } {
    return {
      messagesCount: this.messageBuffer.length,
      errorsCount: this.errorBuffer.length,
      isActive: this.isActive,
      sessionId: this.sessionId,
    };
  }

  /**
   * Set up page event listeners for console capture
   */
  private setupPageListeners(page: Page): void {
    // Console message listener
    page.on('console', async (message) => {
      try {
        const consoleMessage = await this.processConsoleMessage(message, page);
        if (this.shouldCaptureMessage(consoleMessage)) {
          this.addToBuffer(consoleMessage);
          this.emit('message', consoleMessage);
        }
      } catch (error) {
        // Don't throw from event handlers, but emit error
        console.error('Error processing console message:', error);
      }
    });

    // Page error listener
    page.on('pageerror', async (error) => {
      try {
        const runtimeError = await this.processPageError(error, page);
        this.addErrorToBuffer(runtimeError);
        this.emit('error', runtimeError);
      } catch (err) {
        console.error('Error processing page error:', err);
      }
    });

    // Request failure listener for network errors
    page.on('requestfailed', (request) => {
      try {
        const networkError: NetworkError = {
          url: request.url(),
          method: request.method(),
          status: 0,
          statusText: request.failure()?.errorText || 'Request failed',
          timestamp: new Date(),
          sessionId: this.sessionId,
        };
        this.emit('network-error', networkError);
      } catch (error) {
        console.error('Error processing network error:', error);
      }
    });

    // Response status error listener
    page.on('response', (response) => {
      try {
        if (response.status() >= 400) {
          const networkError: NetworkError = {
            url: response.url(),
            method: response.request().method(),
            status: response.status(),
            statusText: response.statusText(),
            timestamp: new Date(),
            sessionId: this.sessionId,
          };
          this.emit('network-error', networkError);
        }
      } catch (error) {
        console.error('Error processing response error:', error);
      }
    });
  }

  /**
   * Process console message and extract enhanced information
   */
  private async processConsoleMessage(message: any, page: Page): Promise<BrowserConsoleMessage> {
    const type = message.type();
    const text = message.text();
    const level = this.mapConsoleTypeToLevel(type);

    // Get page context
    const pageContext = await this.getPageContext(page);

    // Extract location information if available
    const location = message.location?.() ? {
      url: message.location().url,
      lineNumber: message.location().lineNumber,
      columnNumber: message.location().columnNumber,
    } : undefined;

    // Extract arguments if configured
    let args: unknown[] | undefined;
    if (this.config.captureArgs) {
      try {
        args = await Promise.all(
          message.args().map(async (arg: any) => {
            try {
              return await arg.jsonValue();
            } catch {
              return arg.toString();
            }
          })
        );
      } catch (error) {
        // If args extraction fails, continue without args
        args = undefined;
      }
    }

    return {
      type,
      text,
      timestamp: new Date(),
      level,
      args,
      location,
      sessionId: this.sessionId,
      pageContext,
    };
  }

  /**
   * Process page error and extract enhanced error information
   */
  private async processPageError(error: Error, page: Page): Promise<BrowserRuntimeError> {
    const pageContext = await this.getPageContext(page);
    const viewport = page.viewportSize() || { width: 0, height: 0 };

    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
      timestamp: new Date(),
      category: this.categorizeError(error),
      severity: this.assessErrorSeverity(error),
      context: {
        userAgent: await page.evaluate(() => navigator.userAgent),
        pageUrl: pageContext.url,
        pageTitle: pageContext.title,
        viewport,
        timestamp: new Date(),
      },
      sessionId: this.sessionId,
    };
  }

  /**
   * Get page context information
   */
  private async getPageContext(page: Page): Promise<{
    url: string;
    title: string;
    userAgent: string;
  }> {
    try {
      const [url, title, userAgent] = await Promise.all([
        page.url(),
        page.title(),
        page.evaluate(() => navigator.userAgent),
      ]);

      return { url, title, userAgent };
    } catch (error) {
      return {
        url: 'unknown',
        title: 'unknown',
        userAgent: 'unknown',
      };
    }
  }

  /**
   * Map console message type to log level
   */
  private mapConsoleTypeToLevel(type: string): ConsoleLogLevel {
    switch (type) {
      case 'error': return ConsoleLogLevel.ERROR;
      case 'warning': return ConsoleLogLevel.WARN;
      case 'info': return ConsoleLogLevel.INFO;
      case 'debug': return ConsoleLogLevel.DEBUG;
      case 'verbose': return ConsoleLogLevel.VERBOSE;
      default: return ConsoleLogLevel.INFO;
    }
  }

  /**
   * Categorize error type
   */
  private categorizeError(error: Error): BrowserRuntimeError['category'] {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';

    if (message.includes('network') || message.includes('fetch') || message.includes('xhr')) {
      return 'network';
    }
    if (message.includes('security') || message.includes('csp') || message.includes('cors')) {
      return 'security';
    }
    if (message.includes('permission') || message.includes('denied')) {
      return 'permission';
    }
    if (message.includes('resource') || message.includes('404') || message.includes('load')) {
      return 'resource';
    }

    return 'javascript';
  }

  /**
   * Assess error severity
   */
  private assessErrorSeverity(error: Error): BrowserRuntimeError['severity'] {
    const message = error.message.toLowerCase();

    if (message.includes('fatal') || message.includes('crash') || message.includes('abort')) {
      return 'critical';
    }
    if (message.includes('error') || message.includes('fail') || message.includes('exception')) {
      return 'high';
    }
    if (message.includes('warn') || message.includes('deprecated')) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Check if message should be captured based on filters and level
   */
  private shouldCaptureMessage(message: BrowserConsoleMessage): boolean {
    // Check minimum level
    if (message.level < this.config.minLevel) {
      return false;
    }

    // Apply custom filters
    for (const filter of this.config.filters) {
      if (!filter(message)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Add message to buffer with size management
   */
  private addToBuffer(message: BrowserConsoleMessage): void {
    this.messageBuffer.push(message);

    if (this.messageBuffer.length > this.config.maxBufferSize) {
      const droppedCount = this.messageBuffer.length - this.config.maxBufferSize;
      this.messageBuffer = this.messageBuffer.slice(-this.config.maxBufferSize);
      this.emit('buffer-full', droppedCount);
    }
  }

  /**
   * Add error to buffer with size management
   */
  private addErrorToBuffer(error: BrowserRuntimeError): void {
    this.errorBuffer.push(error);

    if (this.errorBuffer.length > this.config.maxBufferSize) {
      this.errorBuffer = this.errorBuffer.slice(-this.config.maxBufferSize);
    }
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `console_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Create console stream with configuration
 */
export function createConsoleStream(config?: ConsoleStreamConfig): BrowserConsoleStream {
  return new BrowserConsoleStream(config);
}

/**
 * Common console message filters
 */
export const ConsoleFilters = {
  /**
   * Filter to exclude messages containing specific text
   */
  excludeText: (text: string): ConsoleMessageFilter => {
    return (message) => !message.text.includes(text);
  },

  /**
   * Filter to include only messages from specific domains
   */
  includeDomain: (domain: string): ConsoleMessageFilter => {
    return (message) => message.location?.url.includes(domain) ?? true;
  },

  /**
   * Filter to exclude third-party script errors
   */
  excludeThirdParty: (): ConsoleMessageFilter => {
    return (message) => {
      const url = message.location?.url;
      if (!url) return true;

      // Common third-party domains to exclude
      const thirdPartyDomains = [
        'google-analytics.com',
        'googletagmanager.com',
        'facebook.com',
        'doubleclick.net',
        'googlesyndication.com',
      ];

      return !thirdPartyDomains.some(domain => url.includes(domain));
    };
  },

  /**
   * Filter to include only error level messages
   */
  errorsOnly: (): ConsoleMessageFilter => {
    return (message) => message.level >= ConsoleLogLevel.ERROR;
  },
};