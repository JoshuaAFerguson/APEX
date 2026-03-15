/**
 * BrowserManager Implementation
 *
 * Provides high-level browser automation capabilities with lifecycle management.
 * Built on top of Playwright with comprehensive resource cleanup and configuration options.
 *
 * Features:
 * - Browser instance lifecycle management (launch/close)
 * - Browser context management for isolation
 * - Configurable browser options (headless, viewport, user agent)
 * - Automatic resource cleanup and disposal
 * - Event-driven architecture for state changes
 * - Integration with existing BrowserTool for operations
 */

import { Browser, BrowserContext, BrowserType, Page, chromium, firefox, webkit, LaunchOptions, BrowserContextOptions } from 'playwright';
import { EventEmitter } from 'eventemitter3';
import { BrowserTool } from './tools/browser-tool';
import { PermissionManager } from './permission-manager';

/**
 * Supported browser engines
 */
export type BrowserEngine = 'chromium' | 'firefox' | 'webkit';

/**
 * Browser launch configuration
 */
export interface BrowserLaunchConfig {
  /** Browser engine to use */
  engine?: BrowserEngine;
  /** Whether to run browser in headless mode */
  headless?: boolean;
  /** Viewport size for browser contexts */
  viewport?: {
    width: number;
    height: number;
  };
  /** User agent string override */
  userAgent?: string;
  /** Custom download directory */
  downloadsPath?: string;
  /** Whether to ignore HTTPS certificate errors */
  ignoreHTTPSErrors?: boolean;
  /** Custom browser executable path */
  executablePath?: string;
  /** Additional browser launch arguments */
  args?: string[];
  /** Browser launch timeout in milliseconds */
  timeout?: number;
  /** Whether to run in slow motion (for debugging) */
  slowMo?: number;
  /** Developer tools configuration */
  devtools?: boolean;
}

/**
 * Browser context configuration
 */
export interface BrowserContextConfig {
  /** Context-specific viewport size */
  viewport?: {
    width: number;
    height: number;
  };
  /** Context-specific user agent */
  userAgent?: string;
  /** Whether to accept downloads */
  acceptDownloads?: boolean;
  /** Context-specific ignore HTTPS errors */
  ignoreHTTPSErrors?: boolean;
  /** Locale for the context */
  locale?: string;
  /** Timezone for the context */
  timezoneId?: string;
  /** Geolocation for the context */
  geolocation?: {
    latitude: number;
    longitude: number;
  };
  /** Permissions to grant to the context */
  permissions?: string[];
  /** Whether to record video */
  recordVideo?: {
    dir: string;
  };
  /** Whether to record traces */
  recordTrace?: {
    dir: string;
  };
}

/**
 * Browser instance information
 */
export interface BrowserInfo {
  /** Unique browser instance ID */
  id: string;
  /** Browser engine type */
  engine: BrowserEngine;
  /** Browser version */
  version: string;
  /** Whether browser is running */
  isConnected: boolean;
  /** Number of active contexts */
  contextCount: number;
  /** Browser process ID */
  pid?: number;
  /** Browser launch configuration */
  config: BrowserLaunchConfig;
  /** Creation timestamp */
  createdAt: Date;
  /** Last activity timestamp */
  lastActivityAt: Date;
}

/**
 * Browser context information
 */
export interface BrowserContextInfo {
  /** Unique context ID */
  id: string;
  /** Associated browser ID */
  browserId: string;
  /** Number of active pages */
  pageCount: number;
  /** Context configuration */
  config: BrowserContextConfig;
  /** Creation timestamp */
  createdAt: Date;
  /** Last activity timestamp */
  lastActivityAt: Date;
}

/**
 * Browser management events
 */
export interface BrowserManagerEvents {
  'browser:launched': (info: BrowserInfo) => void;
  'browser:closed': (browserId: string) => void;
  'context:created': (info: BrowserContextInfo) => void;
  'context:closed': (contextId: string, browserId: string) => void;
  'page:created': (page: Page, contextId: string, browserId: string) => void;
  'page:closed': (contextId: string, browserId: string) => void;
  'error': (error: Error, operation?: string) => void;
}

/**
 * Options for BrowserManager constructor
 */
export interface BrowserManagerOptions {
  /** Optional permission manager for authorization */
  permissionManager?: PermissionManager;
  /** Optional browser tool for integration */
  browserTool?: BrowserTool;
  /** Default browser launch configuration */
  defaultConfig?: BrowserLaunchConfig;
  /** Maximum number of concurrent browser instances */
  maxBrowsers?: number;
  /** Maximum number of contexts per browser */
  maxContextsPerBrowser?: number;
  /** Automatic cleanup timeout in milliseconds */
  autoCleanupTimeout?: number;
}

/**
 * Browser cleanup options
 */
export interface CleanupOptions {
  /** Whether to force close browsers */
  force?: boolean;
  /** Timeout for graceful shutdown in milliseconds */
  timeout?: number;
  /** Whether to cleanup orphaned contexts */
  cleanupOrphanedContexts?: boolean;
}

/**
 * BrowserManager Class
 *
 * High-level browser automation manager that provides lifecycle management
 * for browser instances and contexts, with proper resource cleanup and
 * configuration management.
 */
export class BrowserManager extends EventEmitter<BrowserManagerEvents> {
  private browsers = new Map<string, Browser>();
  private browserInfos = new Map<string, BrowserInfo>();
  private contexts = new Map<string, BrowserContext>();
  private contextInfos = new Map<string, BrowserContextInfo>();
  private permissionManager?: PermissionManager;
  private browserTool?: BrowserTool;
  private defaultConfig: BrowserLaunchConfig;
  private maxBrowsers: number;
  private maxContextsPerBrowser: number;
  private autoCleanupTimeout: number;
  private cleanupTimer?: NodeJS.Timeout;
  private idCounter = 0;

  constructor(options: BrowserManagerOptions = {}) {
    super();

    this.permissionManager = options.permissionManager;
    this.browserTool = options.browserTool;
    this.defaultConfig = {
      engine: 'chromium',
      headless: true,
      viewport: {
        width: 1280,
        height: 720,
      },
      timeout: 30000,
      ...options.defaultConfig,
    };
    this.maxBrowsers = options.maxBrowsers || 5;
    this.maxContextsPerBrowser = options.maxContextsPerBrowser || 10;
    this.autoCleanupTimeout = options.autoCleanupTimeout || 300000; // 5 minutes

    this.setupCleanupTimer();
  }

  /**
   * Launch a new browser instance with the specified configuration
   */
  async launchBrowser(config: BrowserLaunchConfig = {}): Promise<string> {
    if (this.browsers.size >= this.maxBrowsers) {
      throw new Error(`Maximum browser limit reached (${this.maxBrowsers})`);
    }

    const finalConfig = { ...this.defaultConfig, ...config };
    const browserId = this.generateId('browser');

    try {
      // Select browser engine
      const browserType = this.getBrowserType(finalConfig.engine || 'chromium');

      // Prepare launch options
      const launchOptions: LaunchOptions = {
        headless: finalConfig.headless,
        args: finalConfig.args,
        executablePath: finalConfig.executablePath,
        timeout: finalConfig.timeout,
        slowMo: finalConfig.slowMo,
        downloadsPath: finalConfig.downloadsPath,
      };

      // Launch browser
      const browser = await browserType.launch(launchOptions);

      // Store browser instance and info
      this.browsers.set(browserId, browser);

      const browserInfo: BrowserInfo = {
        id: browserId,
        engine: finalConfig.engine || 'chromium',
        version: browser.version(),
        isConnected: browser.isConnected(),
        contextCount: 0,
        pid: await this.getBrowserPid(browser),
        config: finalConfig,
        createdAt: new Date(),
        lastActivityAt: new Date(),
      };

      this.browserInfos.set(browserId, browserInfo);

      // Set up browser event handlers
      browser.on('disconnected', () => {
        this.handleBrowserDisconnected(browserId);
      });

      this.emit('browser:launched', browserInfo);

      return browserId;
    } catch (error) {
      this.emit('error', error as Error, 'launchBrowser');
      throw new Error(`Failed to launch browser: ${(error as Error).message}`);
    }
  }

  /**
   * Create a new browser context within the specified browser
   */
  async createContext(browserId: string, config: BrowserContextConfig = {}): Promise<string> {
    const browser = this.browsers.get(browserId);
    if (!browser) {
      throw new Error(`Browser with ID ${browserId} not found`);
    }

    const browserInfo = this.browserInfos.get(browserId);
    if (!browserInfo) {
      throw new Error(`Browser info for ${browserId} not found`);
    }

    if (browserInfo.contextCount >= this.maxContextsPerBrowser) {
      throw new Error(`Maximum context limit reached for browser ${browserId} (${this.maxContextsPerBrowser})`);
    }

    const contextId = this.generateId('context');

    try {
      // Prepare context options
      const contextOptions: BrowserContextOptions = {
        viewport: config.viewport,
        userAgent: config.userAgent,
        acceptDownloads: config.acceptDownloads,
        ignoreHTTPSErrors: config.ignoreHTTPSErrors,
        locale: config.locale,
        timezoneId: config.timezoneId,
        geolocation: config.geolocation,
        permissions: config.permissions,
        recordVideo: config.recordVideo,
      };

      // Create context
      const context = await browser.newContext(contextOptions);

      // Store context instance and info
      this.contexts.set(contextId, context);

      const contextInfo: BrowserContextInfo = {
        id: contextId,
        browserId,
        pageCount: 0,
        config,
        createdAt: new Date(),
        lastActivityAt: new Date(),
      };

      this.contextInfos.set(contextId, contextInfo);

      // Update browser context count
      browserInfo.contextCount++;
      browserInfo.lastActivityAt = new Date();

      // Set up context event handlers
      context.on('page', (page) => {
        contextInfo.pageCount++;
        contextInfo.lastActivityAt = new Date();
        this.emit('page:created', page, contextId, browserId);
      });

      context.on('close', () => {
        this.handleContextClosed(contextId, browserId);
      });

      this.emit('context:created', contextInfo);

      return contextId;
    } catch (error) {
      this.emit('error', error as Error, 'createContext');
      throw new Error(`Failed to create context: ${(error as Error).message}`);
    }
  }

  /**
   * Get browser instance by ID
   */
  getBrowser(browserId: string): Browser | null {
    return this.browsers.get(browserId) || null;
  }

  /**
   * Get browser context by ID
   */
  getContext(contextId: string): BrowserContext | null {
    return this.contexts.get(contextId) || null;
  }

  /**
   * Get browser information by ID
   */
  getBrowserInfo(browserId: string): BrowserInfo | null {
    return this.browserInfos.get(browserId) || null;
  }

  /**
   * Get context information by ID
   */
  getContextInfo(contextId: string): BrowserContextInfo | null {
    return this.contextInfos.get(contextId) || null;
  }

  /**
   * List all browser instances
   */
  listBrowsers(): BrowserInfo[] {
    return Array.from(this.browserInfos.values());
  }

  /**
   * List all contexts for a specific browser
   */
  listContexts(browserId?: string): BrowserContextInfo[] {
    const contexts = Array.from(this.contextInfos.values());
    return browserId ? contexts.filter(ctx => ctx.browserId === browserId) : contexts;
  }

  /**
   * Close a specific context
   */
  async closeContext(contextId: string): Promise<void> {
    const context = this.contexts.get(contextId);
    if (!context) {
      throw new Error(`Context with ID ${contextId} not found`);
    }

    try {
      await context.close();
    } catch (error) {
      this.emit('error', error as Error, 'closeContext');
      throw new Error(`Failed to close context: ${(error as Error).message}`);
    }
  }

  /**
   * Close a specific browser instance and all its contexts
   */
  async closeBrowser(browserId: string): Promise<void> {
    const browser = this.browsers.get(browserId);
    if (!browser) {
      throw new Error(`Browser with ID ${browserId} not found`);
    }

    try {
      // Close all contexts first
      const browserContexts = this.listContexts(browserId);
      await Promise.all(browserContexts.map(ctx => this.closeContext(ctx.id)));

      // Close browser
      await browser.close();
    } catch (error) {
      this.emit('error', error as Error, 'closeBrowser');
      throw new Error(`Failed to close browser: ${(error as Error).message}`);
    }
  }

  /**
   * Close all browsers and perform cleanup
   */
  async cleanup(options: CleanupOptions = {}): Promise<void> {
    const { force = false, timeout = 5000 } = options;

    try {
      // Close all browsers
      const browserIds = Array.from(this.browsers.keys());

      if (force) {
        // Force close all browsers immediately
        await Promise.all(browserIds.map(async (browserId) => {
          const browser = this.browsers.get(browserId);
          if (browser) {
            try {
              await browser.close();
            } catch (error) {
              // Ignore errors during force close
              this.emit('error', error as Error, 'cleanup:force');
            }
          }
        }));
      } else {
        // Graceful shutdown with timeout
        const closePromises = browserIds.map(browserId => this.closeBrowser(browserId));

        await Promise.race([
          Promise.all(closePromises),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Cleanup timeout exceeded')), timeout)
          ),
        ]);
      }

      // Clear cleanup timer
      if (this.cleanupTimer) {
        clearTimeout(this.cleanupTimer);
        this.cleanupTimer = undefined;
      }

    } catch (error) {
      this.emit('error', error as Error, 'cleanup');
      throw new Error(`Cleanup failed: ${(error as Error).message}`);
    }
  }

  /**
   * Set permission manager for browser operations
   */
  setPermissionManager(manager: PermissionManager): void {
    this.permissionManager = manager;
    if (this.browserTool) {
      this.browserTool.setPermissionManager(manager);
    }
  }

  /**
   * Set browser tool for integration
   */
  setBrowserTool(tool: BrowserTool): void {
    this.browserTool = tool;
    if (this.permissionManager) {
      tool.setPermissionManager(this.permissionManager);
    }
  }

  /**
   * Check if browser manager has any active browsers
   */
  hasActiveBrowsers(): boolean {
    return this.browsers.size > 0;
  }

  /**
   * Get total number of active contexts across all browsers
   */
  getTotalContextCount(): number {
    return this.contexts.size;
  }

  // Private methods

  private getBrowserType(engine: BrowserEngine): BrowserType {
    switch (engine) {
      case 'chromium':
        return chromium;
      case 'firefox':
        return firefox;
      case 'webkit':
        return webkit;
      default:
        throw new Error(`Unsupported browser engine: ${engine}`);
    }
  }

  private async getBrowserPid(browser: Browser): Promise<number | undefined> {
    try {
      // Get browser process from Playwright
      const process = (browser as any)._connection?._transport?._ws?.process;
      return process?.pid;
    } catch {
      // Return undefined if unable to get PID
      return undefined;
    }
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${++this.idCounter}`;
  }

  private handleBrowserDisconnected(browserId: string): void {
    // Clean up browser and associated contexts
    this.browsers.delete(browserId);
    this.browserInfos.delete(browserId);

    // Clean up associated contexts
    const associatedContexts = this.listContexts(browserId);
    for (const contextInfo of associatedContexts) {
      this.contexts.delete(contextInfo.id);
      this.contextInfos.delete(contextInfo.id);
      this.emit('context:closed', contextInfo.id, browserId);
    }

    this.emit('browser:closed', browserId);
  }

  private handleContextClosed(contextId: string, browserId: string): void {
    // Clean up context
    this.contexts.delete(contextId);
    this.contextInfos.delete(contextId);

    // Update browser context count
    const browserInfo = this.browserInfos.get(browserId);
    if (browserInfo) {
      browserInfo.contextCount = Math.max(0, browserInfo.contextCount - 1);
      browserInfo.lastActivityAt = new Date();
    }

    this.emit('context:closed', contextId, browserId);
  }

  private setupCleanupTimer(): void {
    this.cleanupTimer = setInterval(async () => {
      try {
        await this.performAutomaticCleanup();
      } catch (error) {
        this.emit('error', error as Error, 'automaticCleanup');
      }
    }, this.autoCleanupTimeout);
  }

  private async performAutomaticCleanup(): Promise<void> {
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - this.autoCleanupTimeout);

    // Find inactive contexts and browsers
    const inactiveContexts = Array.from(this.contextInfos.values())
      .filter(ctx => ctx.lastActivityAt < cutoffTime && ctx.pageCount === 0);

    const inactiveBrowsers = Array.from(this.browserInfos.values())
      .filter(browser => browser.lastActivityAt < cutoffTime && browser.contextCount === 0);

    // Clean up inactive contexts
    for (const context of inactiveContexts) {
      try {
        await this.closeContext(context.id);
      } catch (error) {
        this.emit('error', error as Error, 'automaticCleanup:context');
      }
    }

    // Clean up inactive browsers
    for (const browser of inactiveBrowsers) {
      try {
        await this.closeBrowser(browser.id);
      } catch (error) {
        this.emit('error', error as Error, 'automaticCleanup:browser');
      }
    }
  }
}

/**
 * Create and export a default instance of BrowserManager
 */
export const browserManager = new BrowserManager();

/**
 * Convenience function for creating a browser manager with options
 */
export function createBrowserManager(options: BrowserManagerOptions = {}): BrowserManager {
  return new BrowserManager(options);
}