/**
 * @apexcli/browser/mocks
 *
 * Browser automation mocks for testing and simulation.
 * Provides mock implementations of browser automation classes that simulate
 * browser operations without actually launching browsers.
 */

// Export mock classes
export { MockBrowserSession } from './mock-browser-session.js';
export { MockBrowserManager } from './mock-browser-manager.js';

// Import and re-export scenario builder utilities
import { createMockScenario, commonScenarios } from './scenario-builder.js';
export { createMockScenario, commonScenarios };

// Export all mock types
export type {
  // Core mock types
  MockBehaviorConfig,
  MockScenarioConfig,
  MockNavigationResult,
  MockElement,
  MockScreenshot,
  MockPageState,
  MockBrowserSessionConfig,
  MockOperation,
  MockBrowserEvents,
  MockBrowserManagerState,
  MockResponse,
  MockResponseFactory,

  // Scenario builder types
  MockScenarioBuilder,
  MockUrlBehavior,
  MockElementBehavior,
  MockOperationBehavior,
} from './types.js';

// Import core classes for convenience functions
import { MockBrowserManager } from './mock-browser-manager.js';
import { MockBrowserSession } from './mock-browser-session.js';
import type {
  MockBehaviorConfig,
  MockScenarioConfig,
  MockBrowserSessionConfig,
} from './types.js';
import type { BrowserActionResult } from '../types.js';

/**
 * Default mock behavior configuration
 */
export const defaultMockConfig: MockBehaviorConfig = {
  defaultSuccess: true,
  defaultDelay: 100,
  failureRate: 0,
  useRealisticDelays: false,
};

/**
 * Creates a new mock browser manager instance
 *
 * @param config - Optional manager configuration
 * @returns A new MockBrowserManager instance
 *
 * @example
 * ```typescript
 * const mockManager = createMockBrowserManager({
 *   maxInstances: 3,
 *   reuseInstances: false
 * });
 * ```
 */
export function createMockBrowserManager(
  config?: Parameters<typeof MockBrowserManager.prototype.constructor>[0]
) {
  return new MockBrowserManager(config);
}

/**
 * Creates a new mock browser session instance
 *
 * @param config - Optional session configuration with mock settings
 * @param scenarioConfig - Optional scenario configuration
 * @returns A new MockBrowserSession instance
 *
 * @example
 * ```typescript
 * const mockSession = createMockBrowserSession({
 *   browserType: 'firefox',
 *   headless: true,
 *   mockConfig: {
 *     defaultSuccess: true,
 *     defaultDelay: 200,
 *     useRealisticDelays: true
 *   }
 * });
 * ```
 */
export function createMockBrowserSession(
  config?: Partial<MockBrowserSessionConfig>,
  scenarioConfig?: MockScenarioConfig
) {
  return new MockBrowserSession(config, scenarioConfig);
}

/**
 * Launches a mock browser session with the given configuration
 *
 * This is a convenience function that creates a mock browser manager and session,
 * launches the mock browser, and returns the ready-to-use session.
 *
 * @param config - Optional session configuration
 * @param scenarioConfig - Optional scenario configuration
 * @returns Promise that resolves to a BrowserActionResult containing the launched mock session
 *
 * @example
 * ```typescript
 * const result = await launchMockBrowser({
 *   browserType: 'chromium',
 *   mockConfig: {
 *     defaultSuccess: true,
 *     defaultDelay: 50,
 *     useRealisticDelays: false
 *   }
 * });
 *
 * if (result.success) {
 *   const session = result.data;
 *   await session.navigate('https://example.com');
 * }
 * ```
 */
export async function launchMockBrowser(
  config?: Partial<MockBrowserSessionConfig>,
  scenarioConfig?: MockScenarioConfig
): Promise<BrowserActionResult<MockBrowserSession>> {
  const startTime = Date.now();

  try {
    const manager = createMockBrowserManager();
    const sessionResult = await manager.createSession(config, scenarioConfig);

    if (!sessionResult.success) {
      return {
        success: false,
        error: sessionResult.error,
        duration: Date.now() - startTime,
      };
    }

    const session = sessionResult.data!;
    const launchResult = await session.launch();

    if (!launchResult.success) {
      return {
        success: false,
        error: launchResult.error,
        duration: Date.now() - startTime,
      };
    }

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
 * Creates a mock browser session configured for testing scenarios
 *
 * @param testName - Name of the test for operation tracking
 * @param config - Optional test-specific configuration
 * @returns A configured mock browser session for testing
 *
 * @example
 * ```typescript
 * const testSession = createMockSessionForTesting('login-test', {
 *   mockConfig: {
 *     defaultSuccess: true,
 *     defaultDelay: 10, // Fast for testing
 *     useRealisticDelays: false
 *   }
 * });
 * ```
 */
export function createMockSessionForTesting(
  testName: string,
  config?: Partial<MockBrowserSessionConfig>
) {
  return createMockBrowserSession({
    browserType: 'chromium',
    headless: true,
    viewport: { width: 1280, height: 720 },
    mockConfig: {
      defaultSuccess: true,
      defaultDelay: 10, // Fast for testing
      failureRate: 0,
      useRealisticDelays: false,
    },
    trackOperations: true,
    ...config,
  });
}

/**
 * Creates a mock browser session that simulates failure scenarios
 *
 * @param failureRate - Rate of failures (0-1)
 * @param config - Optional additional configuration
 * @returns A mock browser session configured to simulate failures
 *
 * @example
 * ```typescript
 * // 30% failure rate
 * const unreliableSession = createUnreliableMockSession(0.3, {
 *   mockConfig: {
 *     defaultDelay: 200,
 *     useRealisticDelays: true
 *   }
 * });
 * ```
 */
export function createUnreliableMockSession(
  failureRate: number,
  config?: Partial<MockBrowserSessionConfig>
) {
  return createMockBrowserSession({
    browserType: 'chromium',
    headless: true,
    mockConfig: {
      defaultSuccess: true,
      defaultDelay: 200,
      failureRate: Math.max(0, Math.min(1, failureRate)),
      useRealisticDelays: true,
    },
    trackOperations: true,
    ...config,
  });
}

/**
 * Default export containing all mock utilities
 *
 * @example
 * ```typescript
 * import mocks from '@apexcli/browser/mocks';
 *
 * const session = mocks.createMockBrowserSession();
 * const manager = mocks.createMockBrowserManager();
 * ```
 */
export default {
  MockBrowserSession,
  MockBrowserManager,
  createMockBrowserManager,
  createMockBrowserSession,
  launchMockBrowser,
  createMockSessionForTesting,
  createUnreliableMockSession,
  createMockScenario,
  commonScenarios,
  defaultMockConfig,
};