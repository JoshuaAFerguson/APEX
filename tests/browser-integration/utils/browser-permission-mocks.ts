/**
 * @fileoverview Browser Permission Mocks for Integration Testing
 *
 * This file provides comprehensive mock implementations of browser permission systems
 * for testing permission-denied scenarios, edge cases, and graceful degradation patterns.
 *
 * Features:
 * - Realistic permission denial scenarios
 * - Browser API permission mocking
 * - Network request permission controls
 * - JavaScript execution permission controls
 * - File system access permission controls
 * - Geolocation and device permission controls
 * - WebRTC and media permission controls
 */

import { vi, type MockedFunction } from 'vitest';
import { Page, BrowserContext, Browser } from 'playwright';
import { EventEmitter } from 'eventemitter3';

// ============================================================================
// Permission Mock Types
// ============================================================================

/**
 * Browser permission types that can be controlled
 */
export type BrowserPermissionType =
  | 'geolocation'
  | 'camera'
  | 'microphone'
  | 'notifications'
  | 'clipboard-read'
  | 'clipboard-write'
  | 'background-sync'
  | 'push'
  | 'storage-access'
  | 'local-fonts'
  | 'display-capture'
  | 'idle-detection'
  | 'periodic-background-sync'
  | 'screen-wake-lock'
  | 'system-wake-lock';

/**
 * Permission states that can be simulated
 */
export type PermissionState = 'granted' | 'denied' | 'prompt';

/**
 * Comprehensive permission configuration
 */
export interface BrowserPermissionMockConfig {
  // Basic permission states
  permissions: Record<BrowserPermissionType, PermissionState>;

  // Advanced controls
  advancedControls: {
    // Network request controls
    blockNetworkRequests: boolean;
    blockedDomains: string[];
    allowedDomains: string[];
    simulateNetworkFailures: boolean;

    // JavaScript execution controls
    blockJavaScriptExecution: boolean;
    blockedScripts: string[];
    simulateScriptErrors: boolean;

    // File system controls
    blockFileAccess: boolean;
    blockedPaths: string[];

    // Console and logging controls
    blockConsoleAccess: boolean;
    simulateConsoleErrors: boolean;

    // Form and input controls
    blockFormSubmissions: boolean;
    blockInputEvents: boolean;
  };

  // Failure simulation
  failureSimulation: {
    // Random failure rate (0-1)
    randomFailureRate: number;
    // Specific operations to fail
    failOperations: string[];
    // Simulate timeout scenarios
    simulateTimeouts: boolean;
    // Simulate memory errors
    simulateMemoryErrors: boolean;
  };

  // Response behavior
  responseBehavior: {
    // Delay responses to simulate slow systems
    responseDelay: number;
    // Return unclear error messages
    unclearErrors: boolean;
    // Simulate inconsistent behavior
    inconsistentBehavior: boolean;
  };
}

/**
 * Permission mock state tracker
 */
export interface PermissionMockState {
  activeBlocks: Set<string>;
  blockedRequests: Array<{
    url: string;
    method: string;
    timestamp: Date;
    reason: string;
  }>;
  deniedScripts: Array<{
    script: string;
    timestamp: Date;
    reason: string;
  }>;
  permissionRequests: Array<{
    permission: BrowserPermissionType;
    result: PermissionState;
    timestamp: Date;
  }>;
  errorLog: Array<{
    type: string;
    message: string;
    timestamp: Date;
    operation?: string;
  }>;
}

// ============================================================================
// Default Configurations
// ============================================================================

/**
 * Default strict permission configuration (denies most things)
 */
export const STRICT_PERMISSION_CONFIG: BrowserPermissionMockConfig = {
  permissions: {
    geolocation: 'denied',
    camera: 'denied',
    microphone: 'denied',
    notifications: 'denied',
    'clipboard-read': 'denied',
    'clipboard-write': 'denied',
    'background-sync': 'denied',
    push: 'denied',
    'storage-access': 'denied',
    'local-fonts': 'denied',
    'display-capture': 'denied',
    'idle-detection': 'denied',
    'periodic-background-sync': 'denied',
    'screen-wake-lock': 'denied',
    'system-wake-lock': 'denied',
  },
  advancedControls: {
    blockNetworkRequests: true,
    blockedDomains: ['*'],
    allowedDomains: [],
    simulateNetworkFailures: false,
    blockJavaScriptExecution: true,
    blockedScripts: ['*'],
    simulateScriptErrors: false,
    blockFileAccess: true,
    blockedPaths: ['*'],
    blockConsoleAccess: true,
    simulateConsoleErrors: false,
    blockFormSubmissions: true,
    blockInputEvents: true,
  },
  failureSimulation: {
    randomFailureRate: 0,
    failOperations: [],
    simulateTimeouts: false,
    simulateMemoryErrors: false,
  },
  responseBehavior: {
    responseDelay: 0,
    unclearErrors: false,
    inconsistentBehavior: false,
  },
};

/**
 * Permissive configuration (allows most things)
 */
export const PERMISSIVE_PERMISSION_CONFIG: BrowserPermissionMockConfig = {
  permissions: {
    geolocation: 'granted',
    camera: 'granted',
    microphone: 'granted',
    notifications: 'granted',
    'clipboard-read': 'granted',
    'clipboard-write': 'granted',
    'background-sync': 'granted',
    push: 'granted',
    'storage-access': 'granted',
    'local-fonts': 'granted',
    'display-capture': 'granted',
    'idle-detection': 'granted',
    'periodic-background-sync': 'granted',
    'screen-wake-lock': 'granted',
    'system-wake-lock': 'granted',
  },
  advancedControls: {
    blockNetworkRequests: false,
    blockedDomains: [],
    allowedDomains: ['*'],
    simulateNetworkFailures: false,
    blockJavaScriptExecution: false,
    blockedScripts: [],
    simulateScriptErrors: false,
    blockFileAccess: false,
    blockedPaths: [],
    blockConsoleAccess: false,
    simulateConsoleErrors: false,
    blockFormSubmissions: false,
    blockInputEvents: false,
  },
  failureSimulation: {
    randomFailureRate: 0,
    failOperations: [],
    simulateTimeouts: false,
    simulateMemoryErrors: false,
  },
  responseBehavior: {
    responseDelay: 0,
    unclearErrors: false,
    inconsistentBehavior: false,
  },
};

/**
 * Partial denial configuration (mixed permissions)
 */
export const PARTIAL_DENIAL_CONFIG: BrowserPermissionMockConfig = {
  permissions: {
    geolocation: 'denied',
    camera: 'denied',
    microphone: 'prompt',
    notifications: 'granted',
    'clipboard-read': 'denied',
    'clipboard-write': 'granted',
    'background-sync': 'granted',
    push: 'prompt',
    'storage-access': 'granted',
    'local-fonts': 'granted',
    'display-capture': 'denied',
    'idle-detection': 'granted',
    'periodic-background-sync': 'denied',
    'screen-wake-lock': 'granted',
    'system-wake-lock': 'denied',
  },
  advancedControls: {
    blockNetworkRequests: false,
    blockedDomains: ['malicious.com', 'blocked.site'],
    allowedDomains: ['*'],
    simulateNetworkFailures: true,
    blockJavaScriptExecution: false,
    blockedScripts: ['eval(', 'Function(', 'setTimeout('],
    simulateScriptErrors: false,
    blockFileAccess: false,
    blockedPaths: ['/etc/', '/root/', '/home/'],
    blockConsoleAccess: false,
    simulateConsoleErrors: false,
    blockFormSubmissions: false,
    blockInputEvents: false,
  },
  failureSimulation: {
    randomFailureRate: 0.1,
    failOperations: ['screenshot', 'download'],
    simulateTimeouts: true,
    simulateMemoryErrors: false,
  },
  responseBehavior: {
    responseDelay: 500,
    unclearErrors: true,
    inconsistentBehavior: true,
  },
};

// ============================================================================
// Browser Permission Mock Manager
// ============================================================================

/**
 * Comprehensive browser permission mock manager
 */
export class BrowserPermissionMockManager extends EventEmitter {
  private mockState: PermissionMockState;
  private config: BrowserPermissionMockConfig;
  private isActive = false;

  constructor(config: BrowserPermissionMockConfig = PARTIAL_DENIAL_CONFIG) {
    super();
    this.config = { ...config };
    this.mockState = {
      activeBlocks: new Set(),
      blockedRequests: [],
      deniedScripts: [],
      permissionRequests: [],
      errorLog: [],
    };
  }

  /**
   * Apply permission mocks to a browser page
   */
  async applyMocks(page: Page): Promise<void> {
    if (this.isActive) {
      throw new Error('Mocks are already active for this manager');
    }

    this.isActive = true;

    try {
      // Mock the Permissions API
      await this.mockPermissionsAPI(page);

      // Mock network requests
      await this.mockNetworkRequests(page);

      // Mock JavaScript execution
      await this.mockJavaScriptExecution(page);

      // Mock console access
      await this.mockConsoleAccess(page);

      // Mock form submissions
      await this.mockFormSubmissions(page);

      // Setup event listeners for monitoring
      await this.setupEventMonitoring(page);

      this.emit('mocks:applied', { config: this.config });
    } catch (error) {
      this.isActive = false;
      this.emit('mocks:apply-failed', { error });
      throw error;
    }
  }

  /**
   * Mock the browser Permissions API
   */
  private async mockPermissionsAPI(page: Page): Promise<void> {
    await page.evaluateOnNewDocument((permissionsConfig) => {
      // Override the navigator.permissions API
      if (navigator.permissions) {
        const originalQuery = navigator.permissions.query;

        navigator.permissions.query = function(descriptor: any) {
          const permission = descriptor.name;
          const state = permissionsConfig[permission] || 'denied';

          return Promise.resolve({
            state,
            name: permission,
            addEventListener: function() {},
            removeEventListener: function() {},
            dispatchEvent: function() { return true; },
          });
        };
      }

      // Mock geolocation if denied
      if (permissionsConfig.geolocation === 'denied') {
        const originalGetCurrentPosition = navigator.geolocation?.getCurrentPosition;
        if (originalGetCurrentPosition) {
          navigator.geolocation.getCurrentPosition = function(success, error) {
            if (error) {
              error({
                code: 1, // PERMISSION_DENIED
                message: 'User denied the request for Geolocation.',
              });
            }
          };
        }
      }

      // Mock media devices if denied
      if (permissionsConfig.camera === 'denied' || permissionsConfig.microphone === 'denied') {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const originalGetUserMedia = navigator.mediaDevices.getUserMedia;
          navigator.mediaDevices.getUserMedia = function(constraints) {
            return Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
          };
        }
      }

      // Mock clipboard if denied
      if (permissionsConfig['clipboard-read'] === 'denied' || permissionsConfig['clipboard-write'] === 'denied') {
        if (navigator.clipboard) {
          if (permissionsConfig['clipboard-read'] === 'denied') {
            navigator.clipboard.read = function() {
              return Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
            };
            navigator.clipboard.readText = function() {
              return Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
            };
          }

          if (permissionsConfig['clipboard-write'] === 'denied') {
            navigator.clipboard.write = function() {
              return Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
            };
            navigator.clipboard.writeText = function() {
              return Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
            };
          }
        }
      }

      // Mock notifications if denied
      if (permissionsConfig.notifications === 'denied') {
        if (window.Notification) {
          const originalRequestPermission = Notification.requestPermission;
          Notification.requestPermission = function() {
            return Promise.resolve('denied');
          };

          // Override constructor to throw error
          const OriginalNotification = Notification;
          window.Notification = function() {
            throw new DOMException('Permission denied', 'NotAllowedError');
          } as any;
        }
      }
    }, this.config.permissions);
  }

  /**
   * Mock network requests based on configuration
   */
  private async mockNetworkRequests(page: Page): Promise<void> {
    if (!this.config.advancedControls.blockNetworkRequests) {
      return;
    }

    await page.route('**/*', (route) => {
      const url = route.request().url();
      const method = route.request().method();

      // Check if domain is blocked
      const isBlocked = this.isDomainBlocked(url);

      if (isBlocked) {
        this.mockState.blockedRequests.push({
          url,
          method,
          timestamp: new Date(),
          reason: 'Domain blocked by permission policy',
        });

        this.emit('network:blocked', { url, method, reason: 'Domain blocked' });

        route.abort('blockedbyclient');
        return;
      }

      // Simulate random failures if enabled
      if (this.config.failureSimulation.randomFailureRate > 0) {
        if (Math.random() < this.config.failureSimulation.randomFailureRate) {
          this.mockState.blockedRequests.push({
            url,
            method,
            timestamp: new Date(),
            reason: 'Random failure simulation',
          });

          route.abort('failed');
          return;
        }
      }

      // Add response delay if configured
      if (this.config.responseBehavior.responseDelay > 0) {
        setTimeout(() => {
          route.continue();
        }, this.config.responseBehavior.responseDelay);
      } else {
        route.continue();
      }
    });
  }

  /**
   * Mock JavaScript execution restrictions
   */
  private async mockJavaScriptExecution(page: Page): Promise<void> {
    if (!this.config.advancedControls.blockJavaScriptExecution) {
      return;
    }

    await page.evaluateOnNewDocument((blockedScripts) => {
      // Override eval function
      const originalEval = window.eval;
      window.eval = function(script) {
        const scriptStr = script.toString();
        for (const blocked of blockedScripts) {
          if (scriptStr.includes(blocked)) {
            throw new Error(`Script execution blocked: Contains forbidden pattern '${blocked}'`);
          }
        }
        return originalEval.call(this, script);
      };

      // Override Function constructor
      const originalFunction = Function;
      window.Function = function() {
        const code = arguments[arguments.length - 1];
        for (const blocked of blockedScripts) {
          if (code && code.includes(blocked)) {
            throw new Error(`Function creation blocked: Contains forbidden pattern '${blocked}'`);
          }
        }
        return originalFunction.apply(this, arguments);
      } as any;

      // Override setTimeout with restrictions
      const originalSetTimeout = setTimeout;
      window.setTimeout = function(callback, delay) {
        if (typeof callback === 'string') {
          for (const blocked of blockedScripts) {
            if (callback.includes(blocked)) {
              throw new Error(`setTimeout blocked: Contains forbidden pattern '${blocked}'`);
            }
          }
        }
        return originalSetTimeout.apply(this, arguments);
      };
    }, this.config.advancedControls.blockedScripts);
  }

  /**
   * Mock console access restrictions
   */
  private async mockConsoleAccess(page: Page): Promise<void> {
    if (!this.config.advancedControls.blockConsoleAccess) {
      return;
    }

    await page.evaluateOnNewDocument(() => {
      // Override console methods to throw errors
      const consoleMethods = ['log', 'warn', 'error', 'info', 'debug', 'trace'];

      consoleMethods.forEach(method => {
        const original = console[method as keyof Console];
        (console as any)[method] = function() {
          throw new Error(`Console access denied: ${method} method blocked`);
        };
      });
    });
  }

  /**
   * Mock form submission restrictions
   */
  private async mockFormSubmissions(page: Page): Promise<void> {
    if (!this.config.advancedControls.blockFormSubmissions) {
      return;
    }

    await page.evaluateOnNewDocument(() => {
      // Override form submission
      document.addEventListener('submit', function(event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        throw new Error('Form submission blocked by permission policy');
      }, true);

      // Override XMLHttpRequest
      const OriginalXMLHttpRequest = XMLHttpRequest;
      window.XMLHttpRequest = function() {
        const xhr = new OriginalXMLHttpRequest();
        const originalSend = xhr.send;

        xhr.send = function() {
          throw new Error('XMLHttpRequest blocked by permission policy');
        };

        return xhr;
      } as any;

      // Override fetch
      const originalFetch = fetch;
      window.fetch = function() {
        return Promise.reject(new Error('Fetch API blocked by permission policy'));
      };
    });
  }

  /**
   * Setup event monitoring for permission violations
   */
  private async setupEventMonitoring(page: Page): Promise<void> {
    // Monitor JavaScript errors
    page.on('pageerror', (error) => {
      this.mockState.errorLog.push({
        type: 'javascript-error',
        message: error.message,
        timestamp: new Date(),
      });

      this.emit('permission:violation', {
        type: 'javascript-error',
        message: error.message,
      });
    });

    // Monitor console messages for permission denials
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.toLowerCase().includes('permission') && text.toLowerCase().includes('denied')) {
        this.mockState.errorLog.push({
          type: 'permission-denial',
          message: text,
          timestamp: new Date(),
        });

        this.emit('permission:denial', { message: text });
      }
    });
  }

  /**
   * Check if a domain is blocked
   */
  private isDomainBlocked(url: string): boolean {
    const { blockedDomains, allowedDomains } = this.config.advancedControls;

    // If there are specific allowed domains, check those first
    if (allowedDomains.length > 0 && !allowedDomains.includes('*')) {
      const isAllowed = allowedDomains.some(domain => {
        if (domain === '*') return true;
        return url.includes(domain);
      });
      if (!isAllowed) return true;
    }

    // Check blocked domains
    return blockedDomains.some(domain => {
      if (domain === '*') return true;
      return url.includes(domain);
    });
  }

  /**
   * Simulate a permission request
   */
  async requestPermission(permission: BrowserPermissionType): Promise<PermissionState> {
    const result = this.config.permissions[permission] || 'denied';

    this.mockState.permissionRequests.push({
      permission,
      result,
      timestamp: new Date(),
    });

    // Add delay if configured
    if (this.config.responseBehavior.responseDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.config.responseBehavior.responseDelay));
    }

    // Simulate inconsistent behavior
    if (this.config.responseBehavior.inconsistentBehavior && Math.random() < 0.1) {
      const randomResults: PermissionState[] = ['granted', 'denied', 'prompt'];
      const randomResult = randomResults[Math.floor(Math.random() * randomResults.length)];

      this.emit('permission:inconsistent', {
        permission,
        expected: result,
        actual: randomResult
      });

      return randomResult;
    }

    this.emit('permission:requested', { permission, result });
    return result;
  }

  /**
   * Update permission configuration dynamically
   */
  updateConfig(updates: Partial<BrowserPermissionMockConfig>): void {
    this.config = { ...this.config, ...updates };
    this.emit('config:updated', { config: this.config });
  }

  /**
   * Get current mock state
   */
  getMockState(): PermissionMockState {
    return { ...this.mockState };
  }

  /**
   * Reset mock state
   */
  resetState(): void {
    this.mockState = {
      activeBlocks: new Set(),
      blockedRequests: [],
      deniedScripts: [],
      permissionRequests: [],
      errorLog: [],
    };
    this.emit('state:reset');
  }

  /**
   * Deactivate all mocks
   */
  deactivate(): void {
    this.isActive = false;
    this.emit('mocks:deactivated');
  }

  /**
   * Generate a comprehensive report of permission interactions
   */
  generateReport(): any {
    return {
      config: this.config,
      state: this.mockState,
      summary: {
        totalBlockedRequests: this.mockState.blockedRequests.length,
        totalDeniedScripts: this.mockState.deniedScripts.length,
        totalPermissionRequests: this.mockState.permissionRequests.length,
        totalErrors: this.mockState.errorLog.length,
        activeBlocks: Array.from(this.mockState.activeBlocks),
      },
      timeline: [
        ...this.mockState.blockedRequests.map(r => ({ ...r, type: 'blocked-request' })),
        ...this.mockState.deniedScripts.map(s => ({ ...s, type: 'denied-script' })),
        ...this.mockState.permissionRequests.map(p => ({ ...p, type: 'permission-request' })),
        ...this.mockState.errorLog.map(e => ({ ...e, type: 'error' })),
      ].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()),
    };
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Create a permission mock manager with preset configurations
 */
export function createPermissionMockManager(
  preset: 'strict' | 'permissive' | 'partial' = 'partial'
): BrowserPermissionMockManager {
  let config: BrowserPermissionMockConfig;

  switch (preset) {
    case 'strict':
      config = STRICT_PERMISSION_CONFIG;
      break;
    case 'permissive':
      config = PERMISSIVE_PERMISSION_CONFIG;
      break;
    case 'partial':
    default:
      config = PARTIAL_DENIAL_CONFIG;
      break;
  }

  return new BrowserPermissionMockManager(config);
}

/**
 * Apply permission mocks to a page with automatic cleanup
 */
export async function withPermissionMocks<T>(
  page: Page,
  config: BrowserPermissionMockConfig | string,
  testFn: (mockManager: BrowserPermissionMockManager) => Promise<T>
): Promise<T> {
  let mockManager: BrowserPermissionMockManager;

  if (typeof config === 'string') {
    mockManager = createPermissionMockManager(config as any);
  } else {
    mockManager = new BrowserPermissionMockManager(config);
  }

  try {
    await mockManager.applyMocks(page);
    return await testFn(mockManager);
  } finally {
    mockManager.deactivate();
  }
}

// Export all configurations and types
export {
  BrowserPermissionMockConfig,
  BrowserPermissionType,
  PermissionState,
  PermissionMockState,
  STRICT_PERMISSION_CONFIG,
  PERMISSIVE_PERMISSION_CONFIG,
  PARTIAL_DENIAL_CONFIG,
};