/**
 * @apexcli/browser - Browser Manager
 *
 * Manages browser instances and their lifecycle for APEX agents
 */

import { EventEmitter } from 'eventemitter3';
import { chromium, firefox, webkit, type Browser, type BrowserContext } from 'playwright';
import { randomUUID } from 'crypto';

import type {
  BrowserManagerConfig,
  BrowserSessionConfig,
  BrowserInstanceInfo,
  BrowserContextInfo,
  BrowserManagerEvents,
  SupportedBrowserType,
  BrowserActionResult,
} from './types.js';

import {
  defaultManagerConfig,
  defaultBrowserConfig,
  BROWSER_LIMITS,
  MONITORING_INTERVALS,
  ERROR_MESSAGES,
} from './constants.js';

/**
 * Browser Manager class for handling browser automation lifecycle
 *
 * Provides centralized management of browser instances with:
 * - Instance pooling and reuse
 * - Resource monitoring and limits
 * - Automatic cleanup of idle instances
 * - Context isolation
 */
export class BrowserManager extends EventEmitter<BrowserManagerEvents> {
  private config: BrowserManagerConfig;
  private instances = new Map<string, BrowserInstanceData>();
  private contexts = new Map<string, BrowserContextData>();
  private cleanupInterval?: NodeJS.Timeout;
  private resourceMonitorInterval?: NodeJS.Timeout;
  private isShutdown = false;

  constructor(config: Partial<BrowserManagerConfig> = {}) {
    super();
    this.config = { ...defaultManagerConfig, ...config };
    this.startMonitoring();
  }

  /**
   * Launch a new browser instance or reuse existing one
   */
  async launchBrowser(
    sessionConfig: Partial<BrowserSessionConfig> = {}
  ): Promise<BrowserActionResult<BrowserInstanceInfo>> {
    const startTime = Date.now();

    if (this.isShutdown) {
      return {
        success: false,
        error: 'Browser manager is shut down',
        duration: Date.now() - startTime,
      };
    }

    try {
      // Merge with defaults to ensure required fields are present
      const config: BrowserSessionConfig = {
        ...defaultBrowserConfig,
        ...this.config.defaultSessionConfig,
        ...sessionConfig,
      };

      // Check if we can reuse an existing instance
      if (this.config.reuseInstances) {
        const reusableInstance = this.findReusableInstance(config.browserType!);
        if (reusableInstance) {
          reusableInstance.lastActiveAt = new Date();
          reusableInstance.inUse = true;

          return {
            success: true,
            data: this.instanceDataToInfo(reusableInstance),
            duration: Date.now() - startTime,
          };
        }
      }

      // Check instance limits
      if (this.instances.size >= (this.config.maxInstances || 5)) {
        return {
          success: false,
          error: ERROR_MESSAGES.MAX_INSTANCES_EXCEEDED,
          duration: Date.now() - startTime,
        };
      }

      // Launch new browser instance
      const browser = await this.createBrowser(config);
      const instanceData = this.createInstanceData(browser, config.browserType!);
      this.instances.set(instanceData.id, instanceData);

      this.emit('browserCreated', this.instanceDataToInfo(instanceData));

      return {
        success: true,
        data: this.instanceDataToInfo(instanceData),
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Create a new browser context for a browser instance
   */
  async createContext(
    instanceId: string,
    sessionConfig: Partial<BrowserSessionConfig> = {}
  ): Promise<BrowserActionResult<BrowserContextInfo>> {
    const startTime = Date.now();

    try {
      const instance = this.instances.get(instanceId);
      if (!instance) {
        return {
          success: false,
          error: `Browser instance not found: ${instanceId}`,
          duration: Date.now() - startTime,
        };
      }

      const config = { ...defaultBrowserConfig, ...sessionConfig };
      const context = await instance.browser.newContext({
        viewport: config.viewport,
        userAgent: config.userAgent,
        ignoreHTTPSErrors: config.ignoreHTTPSErrors,
        ...config.contextOptions,
      });

      if (config.timeout) {
        context.setDefaultTimeout(config.timeout);
      }

      const contextData = this.createContextData(context, instanceId, config);
      this.contexts.set(contextData.id, contextData);

      // Update instance data
      instance.contextCount++;
      instance.lastActiveAt = new Date();

      this.emit('contextCreated', this.contextDataToInfo(contextData));

      return {
        success: true,
        data: this.contextDataToInfo(contextData),
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Get browser context by ID
   */
  getContext(contextId: string): BrowserContext | undefined {
    const contextData = this.contexts.get(contextId);
    return contextData?.context;
  }

  /**
   * Get browser instance by ID
   */
  getInstance(instanceId: string): Browser | undefined {
    const instanceData = this.instances.get(instanceId);
    return instanceData?.browser;
  }

  /**
   * Close a browser context
   */
  async closeContext(contextId: string): Promise<BrowserActionResult<void>> {
    const startTime = Date.now();

    try {
      const contextData = this.contexts.get(contextId);
      if (!contextData) {
        return {
          success: false,
          error: `Context not found: ${contextId}`,
          duration: Date.now() - startTime,
        };
      }

      await contextData.context.close();
      this.contexts.delete(contextId);

      // Update instance data
      const instance = this.instances.get(contextData.browserId);
      if (instance) {
        instance.contextCount--;
        instance.lastActiveAt = new Date();

        // If no contexts remain and reuse is enabled, mark as not in use
        if (instance.contextCount === 0 && this.config.reuseInstances) {
          instance.inUse = false;
        }
      }

      this.emit('contextClosed', contextId);

      return {
        success: true,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Close a browser instance and all its contexts
   */
  async closeBrowser(instanceId: string): Promise<BrowserActionResult<void>> {
    const startTime = Date.now();

    try {
      const instance = this.instances.get(instanceId);
      if (!instance) {
        return {
          success: false,
          error: `Browser instance not found: ${instanceId}`,
          duration: Date.now() - startTime,
        };
      }

      // Close all contexts for this instance
      const contextsToClose = Array.from(this.contexts.entries())
        .filter(([, contextData]) => contextData.browserId === instanceId)
        .map(([contextId]) => contextId);

      for (const contextId of contextsToClose) {
        await this.closeContext(contextId);
      }

      // Close browser instance
      await instance.browser.close();
      this.instances.delete(instanceId);

      this.emit('browserClosed', instanceId);

      return {
        success: true,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Get information about all browser instances
   */
  getInstances(): BrowserInstanceInfo[] {
    return Array.from(this.instances.values()).map(this.instanceDataToInfo);
  }

  /**
   * Get information about all browser contexts
   */
  getContexts(): BrowserContextInfo[] {
    return Array.from(this.contexts.values()).map(this.contextDataToInfo);
  }

  /**
   * Get resource usage statistics
   */
  async getResourceUsage(): Promise<{
    totalInstances: number;
    totalContexts: number;
    memoryUsageMB: number;
    activeBrowsers: number;
  }> {
    const stats = {
      totalInstances: this.instances.size,
      totalContexts: this.contexts.size,
      memoryUsageMB: 0,
      activeBrowsers: 0,
    };

    for (const instance of this.instances.values()) {
      if (instance.inUse || instance.contextCount > 0) {
        stats.activeBrowsers++;
      }

      // Estimate memory usage (simplified)
      stats.memoryUsageMB += instance.contextCount * 50 + 100; // Base + per context
    }

    return stats;
  }

  /**
   * Shutdown the browser manager and close all instances
   */
  async shutdown(): Promise<void> {
    this.isShutdown = true;

    // Stop monitoring
    this.stopMonitoring();

    // Close all contexts and browsers
    const closePromises: Promise<any>[] = [];

    // Close all contexts first
    for (const contextId of this.contexts.keys()) {
      closePromises.push(this.closeContext(contextId));
    }

    await Promise.allSettled(closePromises);

    // Close all browser instances
    const browserClosePromises: Promise<any>[] = [];
    for (const instanceId of this.instances.keys()) {
      browserClosePromises.push(this.closeBrowser(instanceId));
    }

    await Promise.allSettled(browserClosePromises);
  }

  /**
   * Force cleanup of idle instances
   */
  async cleanupIdleInstances(): Promise<number> {
    if (!this.config.instanceIdleTimeout) {
      return 0;
    }

    const now = Date.now();
    const idleThreshold = this.config.instanceIdleTimeout;
    let cleanedCount = 0;

    for (const [instanceId, instance] of this.instances.entries()) {
      const idleTime = now - instance.lastActiveAt.getTime();

      if (!instance.inUse && instance.contextCount === 0 && idleTime > idleThreshold) {
        await this.closeBrowser(instanceId);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  // Private helper methods

  private async createBrowser(config: BrowserSessionConfig): Promise<Browser> {
    const browserType = this.getBrowserType(config.browserType);

    return await browserType.launch({
      headless: config.headless,
      timeout: BROWSER_LIMITS.LAUNCH_TIMEOUT_MS,
      ...config.launchOptions,
    });
  }

  private getBrowserType(type: SupportedBrowserType) {
    switch (type) {
      case 'firefox':
        return firefox;
      case 'webkit':
        return webkit;
      case 'chromium':
      default:
        return chromium;
    }
  }

  private createInstanceData(browser: Browser, type: SupportedBrowserType): BrowserInstanceData {
    return {
      id: randomUUID(),
      browser,
      type,
      createdAt: new Date(),
      lastActiveAt: new Date(),
      contextCount: 0,
      inUse: true,
    };
  }

  private createContextData(
    context: BrowserContext,
    browserId: string,
    config: BrowserSessionConfig
  ): BrowserContextData {
    return {
      id: randomUUID(),
      context,
      browserId,
      createdAt: new Date(),
      lastActiveAt: new Date(),
      pageCount: 0,
      config,
    };
  }

  private findReusableInstance(browserType: SupportedBrowserType): BrowserInstanceData | undefined {
    for (const instance of this.instances.values()) {
      if (
        instance.type === browserType &&
        !instance.inUse &&
        instance.contextCount === 0 &&
        !instance.browser.isConnected() === false
      ) {
        return instance;
      }
    }
    return undefined;
  }

  private instanceDataToInfo(data: BrowserInstanceData): BrowserInstanceInfo {
    return {
      id: data.id,
      type: data.type,
      pid: data.browser.isConnected() ? undefined : undefined, // PID not directly available
      createdAt: data.createdAt,
      lastActiveAt: data.lastActiveAt,
      contextCount: data.contextCount,
      inUse: data.inUse,
    };
  }

  private contextDataToInfo(data: BrowserContextData): BrowserContextInfo {
    return {
      id: data.id,
      browserId: data.browserId,
      createdAt: data.createdAt,
      lastActiveAt: data.lastActiveAt,
      pageCount: data.pageCount,
      config: data.config,
    };
  }

  private startMonitoring(): void {
    // Cleanup idle instances periodically
    this.cleanupInterval = setInterval(async () => {
      if (!this.isShutdown) {
        await this.cleanupIdleInstances();
      }
    }, MONITORING_INTERVALS.CLEANUP_INTERVAL_MS);

    // Monitor resource usage
    this.resourceMonitorInterval = setInterval(async () => {
      if (!this.isShutdown) {
        await this.checkResourceLimits();
      }
    }, MONITORING_INTERVALS.RESOURCE_CHECK_INTERVAL_MS);
  }

  private stopMonitoring(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    if (this.resourceMonitorInterval) {
      clearInterval(this.resourceMonitorInterval);
      this.resourceMonitorInterval = undefined;
    }
  }

  private async checkResourceLimits(): Promise<void> {
    if (!this.config.resourceLimits) {
      return;
    }

    const usage = await this.getResourceUsage();

    if (this.config.resourceLimits.maxMemoryMB && usage.memoryUsageMB > this.config.resourceLimits.maxMemoryMB) {
      this.emit('resourceLimitExceeded', {
        type: 'memory',
        value: usage.memoryUsageMB,
        limit: this.config.resourceLimits.maxMemoryMB,
      });
    }
  }
}

// Internal interfaces for browser manager data

interface BrowserInstanceData {
  id: string;
  browser: Browser;
  type: SupportedBrowserType;
  createdAt: Date;
  lastActiveAt: Date;
  contextCount: number;
  inUse: boolean;
}

interface BrowserContextData {
  id: string;
  context: BrowserContext;
  browserId: string;
  createdAt: Date;
  lastActiveAt: Date;
  pageCount: number;
  config: BrowserSessionConfig;
}