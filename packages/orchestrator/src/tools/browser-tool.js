"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.browserTool = exports.BrowserTool = void 0;
exports.browser = browser;
const core_1 = require("@apexcli/core");
const playwright_1 = require("playwright");
const fs = __importStar(require("fs"));
const pixelmatch_1 = __importDefault(require("pixelmatch"));
const pngjs_1 = require("pngjs");
const browser_console_stream_1 = require("../browser-console-stream");
/**
 * Dangerous operation definitions with risk assessment
 */
const DANGEROUS_OPERATIONS = {
    evaluate: 'Executing arbitrary JavaScript code',
    submit: 'Submitting form data',
    navigate: 'Navigating to external domain', // only for non-allowed domains
};
/**
 * BrowserTool Class
 *
 * Provides browser automation capabilities with comprehensive permission integration.
 * This implementation focuses on establishing proper permission hooks and operation
 * interfaces. Actual browser automation will be added in future versions.
 */
class BrowserTool {
    permissionManager;
    browser;
    context;
    page;
    puppeteerBrowser;
    puppeteerPage;
    consoleMessages = [];
    runtimeErrors = [];
    engine;
    headless;
    backend;
    activeBackend;
    consoleStream;
    enhancedConsoleMessages = [];
    enhancedRuntimeErrors = [];
    eventEmitter;
    resourceState;
    sessionId;
    state;
    constructor(options) {
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
    setPermissionManager(manager) {
        this.permissionManager = manager;
    }
    /**
     * Inject event emitter at runtime
     * Allows visual comparison events to be emitted to orchestrator
     */
    setEventEmitter(emitter) {
        this.eventEmitter = emitter;
    }
    /**
     * Permission check hook - returns whether operation is allowed
     * External code can use this to pre-check permissions without executing
     */
    async checkPermission(operation, target) {
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
    async execute(params) {
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
                const permissionError = new core_1.BrowserPermissionDeniedError(`Browser permission denied: ${denialReason}`, {
                    operation,
                    target,
                    denialReason,
                    permissionType: 'domain', // Default type for general permission checks
                    sessionId: this.sessionId
                });
                // Cleanup resources if browser was launched
                if (this.resourceState.browserActive) {
                    try {
                        await this.cleanup();
                    }
                    catch (cleanupError) {
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
                let permissionType = 'unknown';
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
                const permissionError = new core_1.BrowserPermissionDeniedError(`Browser configuration restriction: ${denialReason}`, {
                    operation,
                    target,
                    denialReason,
                    permissionType,
                    sessionId: this.sessionId
                });
                // Cleanup resources if browser was launched
                if (this.resourceState.browserActive) {
                    try {
                        await this.cleanup();
                    }
                    catch (cleanupError) {
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
                let permissionType = 'unknown';
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
                const permissionError = new core_1.BrowserPermissionDeniedError(`Dangerous operation blocked: ${dangerCheck.reason}`, {
                    operation,
                    target,
                    denialReason,
                    permissionType,
                    sessionId: this.sessionId
                });
                // Cleanup resources if browser was launched
                if (this.resourceState.browserActive) {
                    try {
                        await this.cleanup();
                    }
                    catch (cleanupError) {
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
        }
        catch (error) {
            // Handle BrowserPermissionDeniedError specifically without crashing
            if ((0, core_1.isBrowserPermissionDeniedError)(error)) {
                // Cleanup resources if browser was launched
                if (this.resourceState.browserActive) {
                    try {
                        await this.cleanup();
                    }
                    catch (cleanupError) {
                        console.warn('Error during cleanup after BrowserPermissionDeniedError:', cleanupError);
                    }
                }
                // Emit permission:denied event via eventEmitter
                if (this.eventEmitter) {
                    this.eventEmitter.emit('permission:denied', {
                        operation,
                        target: this.extractTarget({ operation, params: params.params }),
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
    async checkPermissionInternal(operation, target) {
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
    buildScope(operation, target) {
        return `${operation}:${target}`;
    }
    /**
     * Extract target identifier from operation parameters
     */
    extractTarget(params) {
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
            case 'goBack':
                return 'history:back';
            case 'goForward':
                return 'history:forward';
            case 'go':
                return `history:${params.params.delta}`;
            default:
                return 'unknown';
        }
    }
    /**
     * Get current page URL (stub implementation)
     */
    getCurrentUrl() {
        if (this.activeBackend === 'puppeteer') {
            return this.puppeteerPage?.url() || 'about:blank';
        }
        return this.page?.url() || 'about:blank';
    }
    /**
     * Helper method to transition state and emit events
     */
    transitionState(newState) {
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
    async ensurePage(config) {
        // State guard: refuse operations if destroyed or cleaning up
        if (this.state === 'destroyed') {
            throw new core_1.ApexError('Cannot launch browser: BrowserTool instance has been destroyed', core_1.ApexErrorCode.BROWSER_SESSION_INVALID, {
                sessionId: this.sessionId,
                operation: 'ensurePage',
                metadata: { state: this.state, resourceState: this.resourceState }
            });
        }
        if (this.state === 'cleaning_up') {
            throw new core_1.ApexError('Cannot launch browser: BrowserTool instance is currently cleaning up', core_1.ApexErrorCode.BROWSER_SESSION_INVALID, {
                sessionId: this.sessionId,
                operation: 'ensurePage',
                metadata: { state: this.state, resourceState: this.resourceState }
            });
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
        let page;
        if (backend === 'puppeteer') {
            page = await this.ensurePuppeteerPage(config);
        }
        else {
            page = await this.ensurePlaywrightPage(config);
        }
        // Transition to active state once page is ready
        this.transitionState('active');
        return { backend, page };
    }
    async ensurePlaywrightPage(config) {
        if (this.page) {
            return this.page;
        }
        const engine = config?.engine || this.engine;
        const headless = config?.headless ?? this.headless ?? true;
        const browserType = engine === 'firefox' ? playwright_1.firefox : engine === 'webkit' ? playwright_1.webkit : playwright_1.chromium;
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
                }
                catch {
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
    async ensurePuppeteerPage(config) {
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
    async loadPuppeteer() {
        try {
            const module = await import('puppeteer');
            return module.default ?? module;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Puppeteer backend requested but puppeteer is not installed: ${message}`);
        }
    }
    mapWaitUntil(waitUntil, backend) {
        if (!waitUntil) {
            return 'load';
        }
        if (backend === 'puppeteer' && waitUntil === 'networkidle') {
            return 'networkidle0';
        }
        return waitUntil;
    }
    getViewportSize(page, backend) {
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
    async captureElementScreenshot(page, backend, selector, options) {
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
    async setupConsoleStreaming(page, config) {
        const consoleConfig = config?.consoleStream;
        // Only set up streaming if explicitly enabled or if no config provided (default enabled)
        if (consoleConfig?.enabled === false) {
            return;
        }
        try {
            this.consoleStream = new browser_console_stream_1.BrowserConsoleStream(consoleConfig?.config);
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
        }
        catch (error) {
            console.warn('Failed to set up console streaming:', error);
            // Fall back to legacy console capture if streaming fails
        }
    }
    /**
     * Track console and runtime errors for visual regression and diagnostics
     * @deprecated Legacy method, enhanced by setupConsoleStreaming
     */
    setupPageListeners(page) {
        page.on('console', (message) => {
            const entry = {
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
    setupPuppeteerPageListeners(page) {
        page.on('console', (message) => {
            const entry = {
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
    /**
     * Check configuration-based restrictions for the operation
     */
    async checkConfigurationRestrictions(operation, params) {
        if (!this.permissionManager) {
            return { allowed: true };
        }
        const config = await this.permissionManager.getToolConfig('Browser');
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
                const { url } = params.params;
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
    async checkDangerousOperation(operation, params) {
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
                const { url } = params.params;
                const domain = this.extractDomain(url);
                // Check if navigating to potentially dangerous domain
                if (!this.permissionManager) {
                    return { isDangerous: false };
                }
                const config = await this.permissionManager.getToolConfig('Browser');
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
    async executeOperation(params) {
        const { operation } = params;
        const config = this.permissionManager
            ? await this.permissionManager.getToolConfig('Browser')
            : null;
        const { backend, page } = await this.ensurePage(config || undefined);
        const isPuppeteer = backend === 'puppeteer';
        const viewport = this.getViewportSize(page, backend);
        switch (operation) {
            case 'navigate': {
                const { url } = params.params;
                const waitUntil = params.params.waitUntil;
                const timeout = params.params.timeout || config?.pageLoadTimeout;
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
                const { selector } = params.params;
                await page.click(selector, {
                    button: params.params.button,
                    clickCount: params.params.clickCount,
                    delay: params.params.delay,
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
                const { selector, text } = params.params;
                const typeParams = params.params;
                if (typeParams.clearFirst) {
                    if (isPuppeteer) {
                        await page.evaluate((sel) => {
                            const doc = globalThis.document;
                            const element = doc?.querySelector?.(sel) ?? null;
                            if (element) {
                                element.value = '';
                            }
                        }, selector);
                    }
                    else {
                        await page.fill(selector, '');
                    }
                }
                if (typeParams.delay) {
                    await page.click(selector);
                    await page.type(selector, text, { delay: typeParams.delay });
                }
                else if (isPuppeteer) {
                    await page.type(selector, text);
                }
                else {
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
                const screenshotParams = params.params;
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
                const compareParams = params.params;
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
                const baseline = pngjs_1.PNG.sync.read(baselineBuffer);
                const current = pngjs_1.PNG.sync.read(currentBuffer);
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
                const diff = new pngjs_1.PNG({ width: baseline.width, height: baseline.height });
                const diffPixels = (0, pixelmatch_1.default)(baseline.data, current.data, diff.data, baseline.width, baseline.height, { threshold: compareParams.threshold ?? 0.1 });
                const totalPixels = baseline.width * baseline.height;
                const diffRatio = totalPixels > 0 ? diffPixels / totalPixels : 0;
                if (compareParams.diffPath) {
                    fs.writeFileSync(compareParams.diffPath, pngjs_1.PNG.sync.write(diff));
                }
                const passed = diffRatio <= (compareParams.threshold ?? 0.1);
                const diffPercentage = diffRatio * 100;
                // Emit visual comparison event if eventEmitter is available
                if (this.eventEmitter) {
                    const eventData = {
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
                const { script } = params.params;
                const { args } = params.params;
                const result = await page.evaluate((payload) => {
                    const { snippet, args: evalArgs } = payload;
                    const fn = new Function('args', `"use strict"; return (async () => { ${snippet} })();`);
                    return fn(evalArgs || []);
                }, { snippet: script, args });
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
                const { selector } = params.params;
                const submitParams = params.params;
                if (isPuppeteer) {
                    await page.$eval(selector, (form, validate) => {
                        const formElement = form;
                        if (validate && formElement.reportValidity) {
                            formElement.reportValidity();
                        }
                        formElement.submit?.();
                    }, submitParams.validate ?? false);
                }
                else {
                    await page.locator(selector).evaluate((form, validate) => {
                        const formElement = form;
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
                const { selector } = params.params;
                const waitParams = params.params;
                if (isPuppeteer) {
                    await page.waitForSelector(selector, {
                        timeout: waitParams.timeout,
                        visible: waitParams.visible || undefined,
                    });
                }
                else {
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
                const { selector, attribute } = params.params;
                const value = isPuppeteer
                    ? await page.$eval(selector, (element, attr) => element.getAttribute(attr), attribute)
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
                const { selector } = params.params;
                const text = isPuppeteer
                    ? await page.$eval(selector, (element) => element.textContent || '')
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
                const { selector } = params.params;
                const html = selector
                    ? (isPuppeteer
                        ? await page.$eval(selector, (element) => element.innerHTML)
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
                const scrollParams = params.params;
                if (scrollParams.selector) {
                    if (isPuppeteer) {
                        await page.$eval(scrollParams.selector, (element) => element.scrollIntoView());
                    }
                    else {
                        await page.locator(scrollParams.selector).scrollIntoViewIfNeeded();
                    }
                }
                else {
                    await page.evaluate((payload) => {
                        const { x, y } = payload;
                        const scrollTo = globalThis.scrollTo;
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
                const { selector } = params.params;
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
                const pdfParams = params.params;
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
                }
                catch (error) {
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
            case 'goBack': {
                const backParams = params.params;
                const timeout = backParams.timeout || config?.pageLoadTimeout;
                const waitUntil = backParams.waitUntil;
                const response = await page.goBack({
                    timeout,
                    waitUntil: this.mapWaitUntil(waitUntil, backend),
                });
                return {
                    success: true,
                    operation,
                    data: {
                        navigated: response !== null,
                        url: response ? this.getCurrentUrl() : null
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
            case 'goForward': {
                const forwardParams = params.params;
                const timeout = forwardParams.timeout || config?.pageLoadTimeout;
                const waitUntil = forwardParams.waitUntil;
                const response = await page.goForward({
                    timeout,
                    waitUntil: this.mapWaitUntil(waitUntil, backend),
                });
                return {
                    success: true,
                    operation,
                    data: {
                        navigated: response !== null,
                        url: response ? this.getCurrentUrl() : null
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
            case 'go': {
                const goParams = params.params;
                const { delta } = goParams;
                const timeout = goParams.timeout || config?.pageLoadTimeout;
                const waitUntil = goParams.waitUntil;
                // Validate delta parameter
                if (!Number.isInteger(delta)) {
                    return {
                        success: false,
                        operation,
                        error: 'Delta parameter must be an integer',
                        metadata: {
                            url: this.getCurrentUrl(),
                            executionTime: 0,
                            permissionGranted: true,
                        },
                    };
                }
                if (delta === 0) {
                    // No navigation needed, just return current URL
                    return {
                        success: true,
                        operation,
                        data: { navigated: false, url: this.getCurrentUrl() },
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
                // Use goBack/goForward methods for multi-step navigation
                const steps = Math.abs(delta);
                const direction = delta < 0 ? 'back' : 'forward';
                let response = null;
                for (let i = 0; i < steps; i++) {
                    if (direction === 'back') {
                        response = await page.goBack({
                            timeout,
                            waitUntil: this.mapWaitUntil(waitUntil, backend),
                        });
                    }
                    else {
                        response = await page.goForward({
                            timeout,
                            waitUntil: this.mapWaitUntil(waitUntil, backend),
                        });
                    }
                    // If any step returns null, we've hit the end of history
                    if (!response) {
                        break;
                    }
                }
                return {
                    success: true,
                    operation,
                    data: {
                        navigated: response !== null,
                        url: response ? this.getCurrentUrl() : null,
                        delta,
                        steps: steps
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
    extractDomain(url) {
        try {
            return new URL(url).hostname;
        }
        catch {
            return url; // Return original if URL parsing fails
        }
    }
    /**
     * Create hash of script for privacy/security in permission scopes
     */
    hashScript(script) {
        // Simple hash for stub implementation - in real implementation,
        // might want to use crypto.createHash for better security
        return `script_${Buffer.from(script).toString('base64').slice(0, 16)}`;
    }
    /**
     * Get enhanced console messages from the stream
     */
    getEnhancedConsoleMessages() {
        return [...this.enhancedConsoleMessages];
    }
    /**
     * Get enhanced runtime errors from the stream
     */
    getEnhancedRuntimeErrors() {
        return [...this.enhancedRuntimeErrors];
    }
    /**
     * Get console stream instance for direct access
     */
    getConsoleStream() {
        return this.consoleStream;
    }
    /**
     * Clear all console and error buffers
     */
    clearConsoleBuffers() {
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
    formatError(error) {
        if (error instanceof Error) {
            return error.message;
        }
        return `Unknown error: ${String(error)}`;
    }
    /**
     * Generate a unique session ID for tracking browser resources
     */
    generateSessionId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        return `browser_${timestamp}_${random}`;
    }
    /**
     * Get current resource state
     */
    getResourceState() {
        return { ...this.resourceState };
    }
    /**
     * Check if the BrowserTool instance is currently active
     */
    isActive() {
        return this.state === 'active';
    }
    /**
     * Get current lifecycle state
     */
    getState() {
        return this.state;
    }
    /**
     * Update resource state when browser is launched
     */
    updateResourceStateOnLaunch() {
        this.resourceState = {
            ...this.resourceState,
            browserActive: true,
            lastAllocation: new Date()
        };
    }
    /**
     * Update resource state when context is created
     */
    updateResourceStateOnContextCreate() {
        this.resourceState = {
            ...this.resourceState,
            contextActive: true,
            lastAllocation: new Date()
        };
    }
    /**
     * Update resource state when page is created
     */
    updateResourceStateOnPageCreate(url) {
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
    incrementActiveOperations() {
        this.resourceState.activeOperations++;
    }
    /**
     * Decrement active operations count
     */
    decrementActiveOperations() {
        this.resourceState.activeOperations = Math.max(0, this.resourceState.activeOperations - 1);
    }
    /**
     * Gracefully cleanup all browser resources
     * Called when permission is denied or on normal shutdown
     */
    async cleanup() {
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
                }
                catch (error) {
                    console.warn('Error stopping console stream during cleanup:', error);
                }
                finally {
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
                }
                catch (error) {
                    // Log but don't throw - we're in cleanup mode
                    console.warn('Error closing page during cleanup:', error);
                }
                finally {
                    this.page = undefined;
                }
            }
            // Close context if it exists
            if (this.context) {
                try {
                    await this.context.close();
                    this.resourceState.contextActive = false;
                }
                catch (error) {
                    console.warn('Error closing context during cleanup:', error);
                }
                finally {
                    this.context = undefined;
                }
            }
            // Close browser if it exists
            if (this.browser) {
                try {
                    await this.browser.close();
                    this.resourceState.browserActive = false;
                }
                catch (error) {
                    console.warn('Error closing browser during cleanup:', error);
                }
                finally {
                    this.browser = undefined;
                }
            }
            // Close puppeteer resources if they exist
            if (this.puppeteerPage) {
                try {
                    await this.puppeteerPage.close();
                }
                catch (error) {
                    console.warn('Error closing puppeteer page during cleanup:', error);
                }
                finally {
                    this.puppeteerPage = undefined;
                }
            }
            if (this.puppeteerBrowser) {
                try {
                    await this.puppeteerBrowser.close();
                }
                catch (error) {
                    console.warn('Error closing puppeteer browser during cleanup:', error);
                }
                finally {
                    this.puppeteerBrowser = undefined;
                }
            }
            // Clear buffers
            this.clearConsoleBuffers();
            // Transition to destroyed state after successful cleanup
            this.transitionState('destroyed');
        }
        catch (error) {
            // If cleanup itself fails, throw a resource leak error
            throw new core_1.ApexError('Failed to cleanup browser resources', core_1.ApexErrorCode.BROWSER_RESOURCE_LEAK, {
                sessionId: this.sessionId,
                operation: 'cleanup',
                metadata: { resourceState: this.resourceState }
            }, error instanceof Error ? error : new Error(String(error)));
        }
    }
    /**
     * Forcefully destroy all browser resources
     * This is a more aggressive cleanup that ensures all resources are released
     * and the tool is in a clean state, even if normal cleanup fails
     */
    async destroy() {
        // Skip if already destroyed
        if (this.state === 'destroyed') {
            return;
        }
        try {
            // Attempt normal cleanup first
            await this.cleanup();
        }
        catch (cleanupError) {
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
    async handlePermissionDeniedError(operation, target, denialReason, permissionType) {
        // Perform cleanup before throwing error
        try {
            await this.cleanup();
        }
        catch (cleanupError) {
            // If cleanup fails, throw a resource leak error instead
            throw new core_1.ApexError(`Permission denied for ${operation} and subsequent resource cleanup failed`, core_1.ApexErrorCode.BROWSER_RESOURCE_LEAK, {
                operation,
                sessionId: this.sessionId,
                metadata: {
                    target,
                    originalDenialReason: denialReason,
                    resourceState: this.resourceState,
                    cleanupError: cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
                }
            });
        }
        // Throw the permission denied error
        throw new core_1.BrowserPermissionDeniedError(`Browser permission denied: ${denialReason}`, {
            operation,
            target,
            permissionType,
            denialReason,
            sessionId: this.sessionId
        });
    }
    /**
     * Validate session state and throw error if invalid
     */
    validateSessionState() {
        // Check for inconsistent state that indicates resource leaks
        const hasPlaywrightResources = this.browser || this.context || this.page;
        const hasPuppeteerResources = this.puppeteerBrowser || this.puppeteerPage;
        const resourceStateIndicatesActive = this.resourceState.browserActive ||
            this.resourceState.contextActive ||
            this.resourceState.pageActive;
        if ((hasPlaywrightResources || hasPuppeteerResources) && !resourceStateIndicatesActive) {
            throw new core_1.ApexError('Browser session state is invalid - resources exist but state indicates inactive', core_1.ApexErrorCode.BROWSER_SESSION_INVALID, {
                sessionId: this.sessionId,
                metadata: {
                    resourceState: this.resourceState,
                    hasPlaywrightResources: !!hasPlaywrightResources,
                    hasPuppeteerResources: !!hasPuppeteerResources
                }
            });
        }
        if (!hasPlaywrightResources && !hasPuppeteerResources && resourceStateIndicatesActive) {
            throw new core_1.ApexError('Browser session state is invalid - state indicates active but no resources exist', core_1.ApexErrorCode.BROWSER_SESSION_INVALID, {
                sessionId: this.sessionId,
                metadata: {
                    resourceState: this.resourceState,
                    hasPlaywrightResources: !!hasPlaywrightResources,
                    hasPuppeteerResources: !!hasPuppeteerResources
                }
            });
        }
    }
}
exports.BrowserTool = BrowserTool;
/**
 * Create and export a default instance of BrowserTool
 */
exports.browserTool = new BrowserTool();
/**
 * Convenience function for executing browser operations
 */
async function browser(params) {
    return exports.browserTool.execute(params);
}
//# sourceMappingURL=browser-tool.js.map