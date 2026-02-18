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
export declare enum ConsoleLogLevel {
    VERBOSE = 0,
    DEBUG = 1,
    INFO = 2,
    WARN = 3,
    ERROR = 4,
    FATAL = 5
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
        viewport: {
            width: number;
            height: number;
        };
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
export declare class BrowserConsoleStream extends EventEmitter<ConsoleStreamEvents> {
    private page?;
    private config;
    private messageBuffer;
    private errorBuffer;
    private isActive;
    private sessionId;
    constructor(config?: ConsoleStreamConfig);
    /**
     * Start console streaming for the given page
     */
    startStream(page: Page): Promise<void>;
    /**
     * Stop console streaming
     */
    stopStream(): void;
    /**
     * Get buffered console messages
     */
    getMessages(): BrowserConsoleMessage[];
    /**
     * Get buffered runtime errors
     */
    getErrors(): BrowserRuntimeError[];
    /**
     * Clear message and error buffers
     */
    clearBuffers(): void;
    /**
     * Get stream statistics
     */
    getStats(): {
        messagesCount: number;
        errorsCount: number;
        isActive: boolean;
        sessionId: string;
        startTime?: Date;
    };
    /**
     * Set up page event listeners for console capture
     */
    private setupPageListeners;
    /**
     * Process console message and extract enhanced information
     */
    private processConsoleMessage;
    /**
     * Process page error and extract enhanced error information
     */
    private processPageError;
    /**
     * Get page context information
     */
    private getPageContext;
    /**
     * Map console message type to log level
     */
    private mapConsoleTypeToLevel;
    /**
     * Categorize error type
     */
    private categorizeError;
    /**
     * Assess error severity
     */
    private assessErrorSeverity;
    /**
     * Check if message should be captured based on filters and level
     */
    private shouldCaptureMessage;
    /**
     * Add message to buffer with size management
     */
    private addToBuffer;
    /**
     * Add error to buffer with size management
     */
    private addErrorToBuffer;
    /**
     * Generate unique session ID
     */
    private generateSessionId;
}
/**
 * Create console stream with configuration
 */
export declare function createConsoleStream(config?: ConsoleStreamConfig): BrowserConsoleStream;
/**
 * Common console message filters
 */
export declare const ConsoleFilters: {
    /**
     * Filter to exclude messages containing specific text
     */
    excludeText: (text: string) => ConsoleMessageFilter;
    /**
     * Filter to include only messages from specific domains
     */
    includeDomain: (domain: string) => ConsoleMessageFilter;
    /**
     * Filter to exclude third-party script errors
     */
    excludeThirdParty: () => ConsoleMessageFilter;
    /**
     * Filter to include only error level messages
     */
    errorsOnly: () => ConsoleMessageFilter;
};
//# sourceMappingURL=browser-console-stream.d.ts.map