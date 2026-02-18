"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsoleFilters = exports.BrowserConsoleStream = exports.ConsoleLogLevel = void 0;
exports.createConsoleStream = createConsoleStream;
const eventemitter3_1 = require("eventemitter3");
/**
 * Console log levels with severity ordering
 */
var ConsoleLogLevel;
(function (ConsoleLogLevel) {
    ConsoleLogLevel[ConsoleLogLevel["VERBOSE"] = 0] = "VERBOSE";
    ConsoleLogLevel[ConsoleLogLevel["DEBUG"] = 1] = "DEBUG";
    ConsoleLogLevel[ConsoleLogLevel["INFO"] = 2] = "INFO";
    ConsoleLogLevel[ConsoleLogLevel["WARN"] = 3] = "WARN";
    ConsoleLogLevel[ConsoleLogLevel["ERROR"] = 4] = "ERROR";
    ConsoleLogLevel[ConsoleLogLevel["FATAL"] = 5] = "FATAL";
})(ConsoleLogLevel || (exports.ConsoleLogLevel = ConsoleLogLevel = {}));
/**
 * Browser Console Stream Class
 *
 * Manages real-time capture and streaming of browser console messages,
 * errors, and other runtime events with enhanced context and filtering.
 */
class BrowserConsoleStream extends eventemitter3_1.EventEmitter {
    page;
    config;
    messageBuffer = [];
    errorBuffer = [];
    isActive = false;
    sessionId;
    constructor(config = {}) {
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
    async startStream(page) {
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
    stopStream() {
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
    getMessages() {
        return [...this.messageBuffer];
    }
    /**
     * Get buffered runtime errors
     */
    getErrors() {
        return [...this.errorBuffer];
    }
    /**
     * Clear message and error buffers
     */
    clearBuffers() {
        this.messageBuffer = [];
        this.errorBuffer = [];
    }
    /**
     * Get stream statistics
     */
    getStats() {
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
    setupPageListeners(page) {
        // Console message listener
        page.on('console', async (message) => {
            try {
                const consoleMessage = await this.processConsoleMessage(message, page);
                if (this.shouldCaptureMessage(consoleMessage)) {
                    this.addToBuffer(consoleMessage);
                    this.emit('message', consoleMessage);
                }
            }
            catch (error) {
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
            }
            catch (err) {
                console.error('Error processing page error:', err);
            }
        });
        // Request failure listener for network errors
        page.on('requestfailed', (request) => {
            try {
                const networkError = {
                    url: request.url(),
                    method: request.method(),
                    status: 0,
                    statusText: request.failure()?.errorText || 'Request failed',
                    timestamp: new Date(),
                    sessionId: this.sessionId,
                };
                this.emit('network-error', networkError);
            }
            catch (error) {
                console.error('Error processing network error:', error);
            }
        });
        // Response status error listener
        page.on('response', (response) => {
            try {
                if (response.status() >= 400) {
                    const networkError = {
                        url: response.url(),
                        method: response.request().method(),
                        status: response.status(),
                        statusText: response.statusText(),
                        timestamp: new Date(),
                        sessionId: this.sessionId,
                    };
                    this.emit('network-error', networkError);
                }
            }
            catch (error) {
                console.error('Error processing response error:', error);
            }
        });
    }
    /**
     * Process console message and extract enhanced information
     */
    async processConsoleMessage(message, page) {
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
        let args;
        if (this.config.captureArgs) {
            try {
                args = await Promise.all(message.args().map(async (arg) => {
                    try {
                        return await arg.jsonValue();
                    }
                    catch {
                        return arg.toString();
                    }
                }));
            }
            catch (error) {
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
    async processPageError(error, page) {
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
    async getPageContext(page) {
        try {
            const [url, title, userAgent] = await Promise.all([
                page.url(),
                page.title(),
                page.evaluate(() => navigator.userAgent),
            ]);
            return { url, title, userAgent };
        }
        catch (error) {
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
    mapConsoleTypeToLevel(type) {
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
    categorizeError(error) {
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
    assessErrorSeverity(error) {
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
    shouldCaptureMessage(message) {
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
    addToBuffer(message) {
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
    addErrorToBuffer(error) {
        this.errorBuffer.push(error);
        if (this.errorBuffer.length > this.config.maxBufferSize) {
            this.errorBuffer = this.errorBuffer.slice(-this.config.maxBufferSize);
        }
    }
    /**
     * Generate unique session ID
     */
    generateSessionId() {
        return `console_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.BrowserConsoleStream = BrowserConsoleStream;
/**
 * Create console stream with configuration
 */
function createConsoleStream(config) {
    return new BrowserConsoleStream(config);
}
/**
 * Common console message filters
 */
exports.ConsoleFilters = {
    /**
     * Filter to exclude messages containing specific text
     */
    excludeText: (text) => {
        return (message) => !message.text.includes(text);
    },
    /**
     * Filter to include only messages from specific domains
     */
    includeDomain: (domain) => {
        return (message) => message.location?.url.includes(domain) ?? true;
    },
    /**
     * Filter to exclude third-party script errors
     */
    excludeThirdParty: () => {
        return (message) => {
            const url = message.location?.url;
            if (!url)
                return true;
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
    errorsOnly: () => {
        return (message) => message.level >= ConsoleLogLevel.ERROR;
    },
};
//# sourceMappingURL=browser-console-stream.js.map