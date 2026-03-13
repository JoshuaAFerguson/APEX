/**
 * @fileoverview Browser Automation Test Configuration
 *
 * Centralized configuration for browser automation integration testing including:
 * - Test environment configurations for different scenarios
 * - Browser automation testing presets
 * - Permission testing configurations
 * - Test data and fixture configurations
 * - CI/CD specific configurations
 *
 * @module tests/test-utils/browser-automation-config
 */

import type { BrowserAutomationTestConfig } from './browser-automation-test-setup.js';
import type { BrowserPermissionSimulatorConfig } from './browser-permission-simulator.js';
import type { BrowserMockConfig } from './browser-automation-mocks.js';

// ============================================================================
// Environment-specific Configurations
// ============================================================================

/**
 * Development environment configuration
 */
export const DEVELOPMENT_CONFIG: BrowserAutomationTestConfig = {
  useRealBrowser: false, // Use mocks for faster development
  browserType: 'chromium',
  headless: false,
  timeout: 30000,
  captureFailureScreenshots: true,
  artifactDir: './test-artifacts/dev',
  permissionTesting: {
    enabled: true,
    defaultDenials: ['file-system-access'],
    simulateFailures: false,
  },
  mockBrowser: {
    url: 'http://localhost:3000',
    title: 'Development Test Page',
    simulateSlowNetwork: false,
    simulatePermissionDenials: false,
    viewport: { width: 1280, height: 720 },
    networkDelay: 50,
  },
};

/**
 * CI/CD environment configuration
 */
export const CI_CONFIG: BrowserAutomationTestConfig = {
  useRealBrowser: true, // Use real browsers for thorough testing
  browserType: 'chromium',
  headless: true,
  timeout: 60000, // Longer timeout for CI
  captureFailureScreenshots: true,
  artifactDir: './test-artifacts/ci',
  permissionTesting: {
    enabled: true,
    defaultDenials: ['file-system-access', 'dangerous-operation'],
    simulateFailures: true, // Test failure scenarios in CI
  },
  mockBrowser: {
    url: 'http://localhost:3000',
    title: 'CI Test Page',
    simulateSlowNetwork: true, // Simulate network conditions
    simulatePermissionDenials: true,
    viewport: { width: 1280, height: 720 },
    networkDelay: 200,
  },
};

/**
 * Performance testing configuration
 */
export const PERFORMANCE_CONFIG: BrowserAutomationTestConfig = {
  useRealBrowser: true,
  browserType: 'chromium',
  headless: true,
  timeout: 120000, // Extra time for performance tests
  captureFailureScreenshots: false, // Skip screenshots for performance
  artifactDir: './test-artifacts/performance',
  permissionTesting: {
    enabled: false, // Disable for performance focus
    defaultDenials: [],
    simulateFailures: false,
  },
  mockBrowser: {
    url: 'http://localhost:3000',
    title: 'Performance Test Page',
    simulateSlowNetwork: false,
    simulatePermissionDenials: false,
    viewport: { width: 1920, height: 1080 }, // Larger viewport for performance testing
    networkDelay: 0,
  },
};

/**
 * Permission testing focused configuration
 */
export const PERMISSION_TESTING_CONFIG: BrowserAutomationTestConfig = {
  useRealBrowser: false, // Use mocks for precise control
  browserType: 'chromium',
  headless: true,
  timeout: 30000,
  captureFailureScreenshots: false,
  artifactDir: './test-artifacts/permissions',
  permissionTesting: {
    enabled: true,
    defaultDenials: [
      'file-system-access',
      'dangerous-operation',
      'network-access',
      'system-commands',
    ],
    simulateFailures: true,
  },
  mockBrowser: {
    url: 'http://localhost:3000',
    title: 'Permission Test Page',
    simulateSlowNetwork: false,
    simulatePermissionDenials: true, // Focus on permission scenarios
    viewport: { width: 1280, height: 720 },
    networkDelay: 10,
  },
};

// ============================================================================
// Browser-specific Configurations
// ============================================================================

/**
 * Cross-browser testing configurations
 */
export const CROSS_BROWSER_CONFIGS = {
  chromium: {
    ...CI_CONFIG,
    browserType: 'chromium' as const,
  },
  firefox: {
    ...CI_CONFIG,
    browserType: 'firefox' as const,
    timeout: 45000, // Firefox may need slightly more time
  },
  webkit: {
    ...CI_CONFIG,
    browserType: 'webkit' as const,
    timeout: 45000, // WebKit may need slightly more time
  },
} as const;

// ============================================================================
// Permission Testing Presets
// ============================================================================

/**
 * Common permission testing scenarios
 */
export const PERMISSION_TEST_PRESETS = {
  /**
   * Strict security - deny most operations
   */
  strict: {
    defaultPermissionLevel: 'none' as const,
    denyOperations: [
      'navigate',
      'screenshot',
      'evaluate',
      'file-system-access',
      'network-access',
      'system-commands',
      'dangerous-operation',
    ],
    restrictedDomains: ['localhost', 'example.com'],
    simulateNetworkFailures: true,
    simulateTimeouts: true,
    responseDelay: 100,
  } as BrowserPermissionSimulatorConfig,

  /**
   * Moderate security - allow read operations, deny writes
   */
  moderate: {
    defaultPermissionLevel: 'read' as const,
    denyOperations: [
      'file-system-access',
      'system-commands',
      'dangerous-operation',
    ],
    restrictedDomains: ['blocked.com'],
    simulateNetworkFailures: false,
    simulateTimeouts: false,
    responseDelay: 50,
  } as BrowserPermissionSimulatorConfig,

  /**
   * Permissive - allow most operations for testing normal flows
   */
  permissive: {
    defaultPermissionLevel: 'full' as const,
    denyOperations: ['dangerous-operation'],
    restrictedDomains: [],
    simulateNetworkFailures: false,
    simulateTimeouts: false,
    responseDelay: 10,
  } as BrowserPermissionSimulatorConfig,

  /**
   * Testing focused - simulate various failure conditions
   */
  testing: {
    defaultPermissionLevel: 'read' as const,
    denyOperations: ['dangerous-operation', 'restricted-action'],
    restrictedDomains: ['test-blocked.com'],
    simulateNetworkFailures: true,
    simulateTimeouts: true,
    responseDelay: 25,
  } as BrowserPermissionSimulatorConfig,
} as const;

// ============================================================================
// Mock Browser Configurations
// ============================================================================

/**
 * Browser mock presets for different testing scenarios
 */
export const BROWSER_MOCK_PRESETS = {
  /**
   * Fast testing - minimal delays and simulation
   */
  fast: {
    url: 'http://localhost:3000',
    title: 'Fast Test Page',
    simulateSlowNetwork: false,
    simulatePermissionDenials: false,
    viewport: { width: 1280, height: 720 },
    consoleMessages: [],
    networkDelay: 0,
  } as BrowserMockConfig,

  /**
   * Realistic - simulate real-world conditions
   */
  realistic: {
    url: 'http://localhost:3000',
    title: 'Realistic Test Page',
    simulateSlowNetwork: true,
    simulatePermissionDenials: false,
    viewport: { width: 1280, height: 720 },
    consoleMessages: [
      { type: 'log', text: 'Application loaded' },
      { type: 'warn', text: 'Deprecated API usage detected' },
    ],
    networkDelay: 100,
  } as BrowserMockConfig,

  /**
   * Error-prone - simulate various error conditions
   */
  errorProne: {
    url: 'http://localhost:3000',
    title: 'Error Test Page',
    simulateSlowNetwork: true,
    simulatePermissionDenials: true,
    simulateCrashes: true,
    viewport: { width: 1280, height: 720 },
    consoleMessages: [
      { type: 'error', text: 'Simulated JavaScript error' },
      { type: 'warn', text: 'Network request failed' },
    ],
    networkDelay: 300,
  } as BrowserMockConfig,

  /**
   * Mobile - mobile device simulation
   */
  mobile: {
    url: 'http://localhost:3000',
    title: 'Mobile Test Page',
    simulateSlowNetwork: true,
    simulatePermissionDenials: false,
    viewport: { width: 375, height: 667 }, // iPhone-like dimensions
    consoleMessages: [
      { type: 'log', text: 'Mobile layout activated' },
    ],
    networkDelay: 150,
  } as BrowserMockConfig,
} as const;

// ============================================================================
// Configuration Selection Utilities
// ============================================================================

/**
 * Get configuration based on environment
 */
export function getConfigForEnvironment(): BrowserAutomationTestConfig {
  const env = process.env.NODE_ENV;
  const ci = process.env.CI === 'true';

  if (ci) {
    return CI_CONFIG;
  }

  switch (env) {
    case 'development':
      return DEVELOPMENT_CONFIG;
    case 'test':
      return process.env.BROWSER_AUTOMATION_PERFORMANCE === 'true'
        ? PERFORMANCE_CONFIG
        : CI_CONFIG;
    default:
      return DEVELOPMENT_CONFIG;
  }
}

/**
 * Get permission configuration based on test type
 */
export function getPermissionConfigForTest(testType: string): BrowserPermissionSimulatorConfig {
  switch (testType) {
    case 'security':
    case 'permission-denial':
      return PERMISSION_TEST_PRESETS.strict;
    case 'integration':
      return PERMISSION_TEST_PRESETS.moderate;
    case 'unit':
    case 'smoke':
      return PERMISSION_TEST_PRESETS.permissive;
    case 'e2e':
    case 'acceptance':
      return PERMISSION_TEST_PRESETS.testing;
    default:
      return PERMISSION_TEST_PRESETS.moderate;
  }
}

/**
 * Get browser mock configuration based on test scenario
 */
export function getBrowserMockConfig(scenario: string): BrowserMockConfig {
  switch (scenario) {
    case 'performance':
    case 'speed':
      return BROWSER_MOCK_PRESETS.fast;
    case 'integration':
    case 'e2e':
      return BROWSER_MOCK_PRESETS.realistic;
    case 'error':
    case 'failure':
    case 'chaos':
      return BROWSER_MOCK_PRESETS.errorProne;
    case 'mobile':
    case 'responsive':
      return BROWSER_MOCK_PRESETS.mobile;
    default:
      return BROWSER_MOCK_PRESETS.fast;
  }
}

/**
 * Create custom configuration by merging presets
 */
export function createCustomConfig(
  baseConfig: BrowserAutomationTestConfig,
  overrides: Partial<BrowserAutomationTestConfig>
): BrowserAutomationTestConfig {
  return {
    ...baseConfig,
    ...overrides,
    permissionTesting: {
      ...baseConfig.permissionTesting,
      ...(overrides.permissionTesting || {}),
    },
    mockBrowser: {
      ...baseConfig.mockBrowser,
      ...(overrides.mockBrowser || {}),
    },
  };
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validate browser automation test configuration
 */
export function validateTestConfig(config: BrowserAutomationTestConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (config.timeout < 1000) {
    errors.push('Timeout must be at least 1000ms');
  }

  if (!config.artifactDir || config.artifactDir.trim() === '') {
    errors.push('Artifact directory must be specified');
  }

  if (config.mockBrowser.viewport.width < 100 || config.mockBrowser.viewport.height < 100) {
    errors.push('Viewport dimensions must be at least 100x100');
  }

  if (config.mockBrowser.networkDelay && config.mockBrowser.networkDelay < 0) {
    errors.push('Network delay cannot be negative');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// Re-export types for convenience
// ============================================================================

export type {
  BrowserAutomationTestConfig,
  BrowserPermissionSimulatorConfig,
  BrowserMockConfig,
};