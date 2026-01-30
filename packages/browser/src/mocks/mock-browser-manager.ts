/**
 * @apexcli/browser/mocks - Mock Browser Manager
 *
 * Mock implementation of browser manager for testing and simulation
 */

import { EventEmitter } from 'eventemitter3';
import type {
  BrowserManagerConfig,
  BrowserActionResult,
  BrowserInstanceInfo,
  BrowserContextInfo,
  SupportedBrowserType,
  BrowserManagerEvents,
} from '../types.js';
import type {
  MockBrowserSessionConfig,
  MockBrowserManagerState,
  MockScenarioConfig,
} from './types.js';
import { MockBrowserSession } from './mock-browser-session.js';

/**
 * Default mock browser manager configuration
 */
const DEFAULT_MOCK_MANAGER_CONFIG: BrowserManagerConfig = {
  maxInstances: 5,
  instanceIdleTimeout: 300000, // 5 minutes
  reuseInstances: true,
  resourceLimits: {
    maxMemoryMB: 1024,
    maxCpuPercent: 80,
  },
};

/**
 * Mock implementation of BrowserManager for testing and simulation
 */
export class MockBrowserManager extends EventEmitter<BrowserManagerEvents> {
  private config: BrowserManagerConfig;
  private state: MockBrowserManagerState;
  private instances: Map<string, BrowserInstanceInfo> = new Map();
  private contexts: Map<string, BrowserContextInfo> = new Map();
  private sessions: Map<string, MockBrowserSession> = new Map();
  private initialized = false;

  constructor(config: Partial<BrowserManagerConfig> = {}) {
    super();

    this.config = {
      ...DEFAULT_MOCK_MANAGER_CONFIG,
      ...config,
    };

    this.state = {
      activeSessions: 0,
      sessions: new Map(),
      initialized: false,
    };
  }

  /**
   * Initialize the mock browser manager
   */
  async initialize(): Promise<BrowserActionResult<void>> {
    const startTime = Date.now();

    try {
      if (this.initialized) {
        return {
          success: true,
          duration: Date.now() - startTime,
        };
      }

      // Simulate initialization delay
      await this.delay(200);

      this.initialized = true;
      this.state.initialized = true;

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
   * Create a new mock browser session
   */
  async createSession(
    sessionConfig?: Partial<MockBrowserSessionConfig>,
    scenarioConfig?: MockScenarioConfig
  ): Promise<BrowserActionResult<MockBrowserSession>> {
    const startTime = Date.now();

    try {
      if (!this.initialized) {
        const initResult = await this.initialize();
        if (!initResult.success) {
          return {
            success: false,
            error: `Failed to initialize browser manager: ${initResult.error}`,
            duration: Date.now() - startTime,
          };
        }
      }

      // Check instance limits
      if (this.state.activeSessions >= this.config.maxInstances!) {
        return {
          success: false,
          error: `Maximum number of browser instances (${this.config.maxInstances}) exceeded`,
          duration: Date.now() - startTime,
        };
      }

      // Create mock browser instance
      const instanceId = this.generateInstanceId();
      const instanceInfo: BrowserInstanceInfo = {
        id: instanceId,
        type: sessionConfig?.browserType || 'chromium',
        createdAt: new Date(),
        lastActiveAt: new Date(),
        contextCount: 0,
        inUse: false,
        resourceUsage: {
          memoryMB: Math.floor(Math.random() * 200) + 100,
          cpuPercent: Math.floor(Math.random() * 20) + 10,
        },
      };

      this.instances.set(instanceId, instanceInfo);
      this.emit('browserCreated', instanceInfo);

      // Create mock browser context
      const contextId = this.generateContextId();
      const contextInfo: BrowserContextInfo = {
        id: contextId,
        browserId: instanceId,
        createdAt: new Date(),
        lastActiveAt: new Date(),
        pageCount: 0,
        config: {
          browserType: sessionConfig?.browserType || 'chromium',
          headless: sessionConfig?.headless ?? true,
          viewport: sessionConfig?.viewport || { width: 1280, height: 720 },
          timeout: sessionConfig?.timeout || 30000,
          mockConfig: sessionConfig?.mockConfig || {
            defaultSuccess: true,
            defaultDelay: 100,
            useRealisticDelays: false,
          },
          trackOperations: sessionConfig?.trackOperations ?? true,
        },
      };

      this.contexts.set(contextId, contextInfo);
      this.emit('contextCreated', contextInfo);

      // Create mock browser session
      const session = new MockBrowserSession(
        {
          ...sessionConfig,
          scenarioConfig,
        },
        scenarioConfig
      );

      const sessionId = this.generateSessionId();
      this.sessions.set(sessionId, session);

      // Update state
      this.state.activeSessions++;
      this.state.sessions.set(sessionId, contextInfo.config);
      instanceInfo.contextCount++;

      return {
        success: true,
        data: session,
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
  getBrowserInstances(): BrowserInstanceInfo[] {
    return Array.from(this.instances.values());
  }

  /**
   * Get information about all browser contexts
   */
  getBrowserContexts(): BrowserContextInfo[] {
    return Array.from(this.contexts.values());
  }

  /**
   * Get active session count
   */
  getActiveSessionCount(): number {
    return this.state.activeSessions;
  }

  /**
   * Check if manager is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get manager configuration
   */
  getConfig(): BrowserManagerConfig {
    return { ...this.config };
  }

  /**
   * Get current manager state
   */
  getState(): MockBrowserManagerState {
    return { ...this.state };
  }

  /**
   * Close a specific browser session
   */
  async closeSession(session: MockBrowserSession): Promise<BrowserActionResult<void>> {
    const startTime = Date.now();

    try {
      const sessionId = this.findSessionId(session);
      if (!sessionId) {
        return {
          success: false,
          error: 'Session not found',
          duration: Date.now() - startTime,
        };
      }

      // Close the session
      const closeResult = await session.close();
      if (!closeResult.success) {
        return closeResult;
      }

      // Remove from tracking
      this.sessions.delete(sessionId);
      this.state.sessions.delete(sessionId);
      this.state.activeSessions--;

      // Update context and instance info
      const contextId = Array.from(this.contexts.keys())[0]; // Simplified for mock
      if (contextId) {
        this.contexts.delete(contextId);
        this.emit('contextClosed', contextId);
      }

      const instanceId = Array.from(this.instances.keys())[0]; // Simplified for mock
      if (instanceId) {
        const instance = this.instances.get(instanceId);
        if (instance) {
          instance.contextCount--;
          if (instance.contextCount <= 0) {
            this.instances.delete(instanceId);
            this.emit('browserClosed', instanceId);
          }
        }
      }

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
   * Close all browser sessions and clean up resources
   */
  async cleanup(): Promise<BrowserActionResult<void>> {
    const startTime = Date.now();

    try {
      // Close all active sessions
      const closeTasks = Array.from(this.sessions.values()).map(session => session.close());
      await Promise.all(closeTasks);

      // Clear all tracking
      this.sessions.clear();
      this.contexts.clear();
      this.instances.clear();
      this.state.sessions.clear();
      this.state.activeSessions = 0;
      this.initialized = false;
      this.state.initialized = false;

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
   * Monitor resource usage (mock implementation)
   */
  async checkResourceUsage(): Promise<BrowserActionResult<{ memory: number; cpu: number }>> {
    const startTime = Date.now();

    try {
      let totalMemory = 0;
      let totalCpu = 0;

      for (const instance of this.instances.values()) {
        if (instance.resourceUsage) {
          totalMemory += instance.resourceUsage.memoryMB;
          totalCpu += instance.resourceUsage.cpuPercent;
        }
      }

      const averageCpu = this.instances.size > 0 ? totalCpu / this.instances.size : 0;

      // Check limits
      if (this.config.resourceLimits?.maxMemoryMB && totalMemory > this.config.resourceLimits.maxMemoryMB) {
        this.emit('resourceLimitExceeded', {
          type: 'memory',
          value: totalMemory,
          limit: this.config.resourceLimits.maxMemoryMB,
        });
      }

      if (this.config.resourceLimits?.maxCpuPercent && averageCpu > this.config.resourceLimits.maxCpuPercent) {
        this.emit('resourceLimitExceeded', {
          type: 'cpu',
          value: averageCpu,
          limit: this.config.resourceLimits.maxCpuPercent,
        });
      }

      return {
        success: true,
        data: { memory: totalMemory, cpu: averageCpu },
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

  // Private helper methods

  private generateInstanceId(): string {
    return `mock-instance-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateContextId(): string {
    return `mock-context-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateSessionId(): string {
    return `mock-session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private findSessionId(session: MockBrowserSession): string | undefined {
    for (const [id, storedSession] of this.sessions.entries()) {
      if (storedSession === session) {
        return id;
      }
    }
    return undefined;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}