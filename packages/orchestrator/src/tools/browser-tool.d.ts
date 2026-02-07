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
import { PermissionLevel, ToolPermissionResult, BrowserResourceState } from '@apexcli/core';
import { EventEmitter } from 'eventemitter3';
import { BrowserConsoleStream, ConsoleStreamConfig, BrowserConsoleMessage as EnhancedConsoleMessage, BrowserRuntimeError as EnhancedRuntimeError } from '../browser-console-stream';
/**
 * BrowserTool lifecycle states
 */
export type BrowserToolLifecycleState = 'idle' | 'launching' | 'active' | 'cleaning_up' | 'destroyed';
/**
 * Supported browser operations
 */
export type BrowserOperation = 'navigate' | 'click' | 'type' | 'screenshot' | 'compareScreenshot' | 'evaluate' | 'submit' | 'waitForSelector' | 'getAttribute' | 'getText' | 'getHtml' | 'scroll' | 'hover' | 'generatePdf';
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
export type BrowserParams = {
    operation: 'navigate';
    params: BrowserNavigateParams;
} | {
    operation: 'click';
    params: BrowserClickParams;
} | {
    operation: 'type';
    params: BrowserTypeParams;
} | {
    operation: 'screenshot';
    params: BrowserScreenshotParams;
} | {
    operation: 'compareScreenshot';
    params: BrowserCompareScreenshotParams;
} | {
    operation: 'evaluate';
    params: BrowserEvaluateParams;
} | {
    operation: 'submit';
    params: BrowserSubmitParams;
} | {
    operation: 'waitForSelector';
    params: BrowserWaitForSelectorParams;
} | {
    operation: 'getAttribute';
    params: BrowserGetAttributeParams;
} | {
    operation: 'getText';
    params: BrowserGetTextParams;
} | {
    operation: 'getHtml';
    params: BrowserGetHtmlParams;
} | {
    operation: 'scroll';
    params: BrowserScrollParams;
} | {
    operation: 'hover';
    params: BrowserHoverParams;
} | {
    operation: 'generatePdf';
    params: BrowserGeneratePdfParams;
};
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
 * BrowserTool Class
 *
 * Provides browser automation capabilities with comprehensive permission integration.
 * This implementation focuses on establishing proper permission hooks and operation
 * interfaces. Actual browser automation will be added in future versions.
 */
export declare class BrowserTool {
    private permissionManager?;
    private browser?;
    private context?;
    private page?;
    private puppeteerBrowser?;
    private puppeteerPage?;
    private consoleMessages;
    private runtimeErrors;
    private engine;
    private headless?;
    private backend;
    private activeBackend;
    private consoleStream?;
    private enhancedConsoleMessages;
    private enhancedRuntimeErrors;
    private eventEmitter?;
    private resourceState;
    private sessionId;
    private state;
    constructor(options?: BrowserToolOptions);
    /**
     * Inject permission manager at runtime
     * Allows lazy binding after orchestrator initialization
     */
    setPermissionManager(manager: PermissionManager): void;
    /**
     * Inject event emitter at runtime
     * Allows visual comparison events to be emitted to orchestrator
     */
    setEventEmitter(emitter: EventEmitter): void;
    /**
     * Permission check hook - returns whether operation is allowed
     * External code can use this to pre-check permissions without executing
     */
    checkPermission(operation: BrowserOperation, target: string): Promise<ToolPermissionResult>;
    /**
     * Execute a browser operation with comprehensive permission checking
     */
    execute(params: BrowserParams): Promise<BrowserResult>;
    /**
     * Internal permission check that consumes allow-once permissions
     */
    private checkPermissionInternal;
    /**
     * Build permission scope string for operation
     */
    private buildScope;
    /**
     * Extract target identifier from operation parameters
     */
    private extractTarget;
    /**
     * Get current page URL (stub implementation)
     */
    private getCurrentUrl;
    /**
     * Helper method to transition state and emit events
     */
    private transitionState;
    /**
     * Ensure a browser page is available for operations
     */
    private ensurePage;
    private ensurePlaywrightPage;
    private ensurePuppeteerPage;
    private loadPuppeteer;
    private mapWaitUntil;
    private getViewportSize;
    private captureElementScreenshot;
    /**
     * Set up enhanced console streaming for the page
     */
    private setupConsoleStreaming;
    /**
     * Track console and runtime errors for visual regression and diagnostics
     * @deprecated Legacy method, enhanced by setupConsoleStreaming
     */
    private setupPageListeners;
    private setupPuppeteerPageListeners;
    /**
     * Check configuration-based restrictions for the operation
     */
    private checkConfigurationRestrictions;
    /**
     * Check if operation is considered dangerous and requires special handling
     */
    private checkDangerousOperation;
    /**
     * Execute the actual browser operation (stub implementation)
     */
    private executeOperation;
    /**
     * Extract domain from URL
     */
    private extractDomain;
    /**
     * Create hash of script for privacy/security in permission scopes
     */
    private hashScript;
    /**
     * Get enhanced console messages from the stream
     */
    getEnhancedConsoleMessages(): EnhancedConsoleMessage[];
    /**
     * Get enhanced runtime errors from the stream
     */
    getEnhancedRuntimeErrors(): EnhancedRuntimeError[];
    /**
     * Get console stream instance for direct access
     */
    getConsoleStream(): BrowserConsoleStream | undefined;
    /**
     * Clear all console and error buffers
     */
    clearConsoleBuffers(): void;
    /**
     * Format error messages for consistent error reporting
     */
    private formatError;
    /**
     * Generate a unique session ID for tracking browser resources
     */
    private generateSessionId;
    /**
     * Get current resource state
     */
    getResourceState(): BrowserResourceState;
    /**
     * Check if the BrowserTool instance is currently active
     */
    isActive(): boolean;
    /**
     * Get current lifecycle state
     */
    getState(): BrowserToolLifecycleState;
    /**
     * Update resource state when browser is launched
     */
    private updateResourceStateOnLaunch;
    /**
     * Update resource state when context is created
     */
    private updateResourceStateOnContextCreate;
    /**
     * Update resource state when page is created
     */
    private updateResourceStateOnPageCreate;
    /**
     * Increment active operations count
     */
    private incrementActiveOperations;
    /**
     * Decrement active operations count
     */
    private decrementActiveOperations;
    /**
     * Gracefully cleanup all browser resources
     * Called when permission is denied or on normal shutdown
     */
    cleanup(): Promise<void>;
    /**
     * Forcefully destroy all browser resources
     * This is a more aggressive cleanup that ensures all resources are released
     * and the tool is in a clean state, even if normal cleanup fails
     */
    destroy(): Promise<void>;
    /**
     * Handle permission denied errors with proper cleanup
     */
    private handlePermissionDeniedError;
    /**
     * Validate session state and throw error if invalid
     */
    private validateSessionState;
}
/**
 * Create and export a default instance of BrowserTool
 */
export declare const browserTool: BrowserTool;
/**
 * Convenience function for executing browser operations
 */
export declare function browser(params: BrowserParams): Promise<BrowserResult>;
//# sourceMappingURL=browser-tool.d.ts.map