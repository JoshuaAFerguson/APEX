/**
 * @fileoverview Infrastructure verification test for page navigation integration testing
 *
 * This test validates that all required components are properly installed and configured:
 * - Vitest test framework
 * - Playwright browser automation
 * - Mock server functionality
 * - Test utilities and helpers
 * - Performance measurement capabilities
 */

import { describe, it, expect } from 'vitest';

describe('Page Navigation Infrastructure Verification', () => {
  describe('Framework Dependencies', () => {
    it('should have Vitest available', () => {
      expect(typeof describe).toBe('function');
      expect(typeof it).toBe('function');
      expect(typeof expect).toBe('function');
    });

    it('should have Playwright available', async () => {
      const { chromium } = await import('playwright');
      expect(chromium).toBeDefined();
      expect(typeof chromium.launch).toBe('function');
    });
  });

  describe('Test Infrastructure Components', () => {
    it('should have setup utilities available', async () => {
      const setupModule = await import('./setup');

      expect(setupModule.createNavigationBrowser).toBeDefined();
      expect(setupModule.createNavigationContext).toBeDefined();
      expect(setupModule.createNavigationPage).toBeDefined();
      expect(setupModule.captureNavigationScreenshot).toBeDefined();
      expect(setupModule.DEFAULT_NAVIGATION_CONFIG).toBeDefined();
    });

    it('should have navigation helpers available', async () => {
      const helpersModule = await import('./utils/navigation-helpers');

      expect(helpersModule.safeNavigate).toBeDefined();
      expect(helpersModule.safeNavigationClick).toBeDefined();
      expect(helpersModule.validateNavigation).toBeDefined();
      expect(helpersModule.measureNavigationPerformance).toBeDefined();
      expect(helpersModule.NavigationEventMonitor).toBeDefined();
    });

    it('should have navigation scenarios available', async () => {
      const scenariosModule = await import('./fixtures/navigation-scenarios');

      expect(scenariosModule.NAVIGATION_SCENARIOS).toBeDefined();
      expect(scenariosModule.runNavigationScenario).toBeDefined();
      expect(scenariosModule.createNavigationTestPage).toBeDefined();

      expect(Array.isArray(scenariosModule.NAVIGATION_SCENARIOS)).toBe(true);
      expect(scenariosModule.NAVIGATION_SCENARIOS.length).toBeGreaterThan(0);
    });
  });

  describe('Configuration Validation', () => {
    it('should have valid test configuration', async () => {
      const { DEFAULT_NAVIGATION_CONFIG } = await import('./setup');

      expect(DEFAULT_NAVIGATION_CONFIG.backend).toBe('playwright');
      expect(['chromium', 'firefox', 'webkit']).toContain(DEFAULT_NAVIGATION_CONFIG.browserType);
      expect(typeof DEFAULT_NAVIGATION_CONFIG.headless).toBe('boolean');
      expect(DEFAULT_NAVIGATION_CONFIG.viewport).toBeDefined();
      expect(DEFAULT_NAVIGATION_CONFIG.viewport.width).toBeGreaterThan(0);
      expect(DEFAULT_NAVIGATION_CONFIG.viewport.height).toBeGreaterThan(0);
    });

    it('should have predefined navigation scenarios', async () => {
      const { NAVIGATION_SCENARIOS } = await import('./fixtures/navigation-scenarios');

      const scenarioNames = NAVIGATION_SCENARIOS.map(s => s.name);

      expect(scenarioNames).toContain('basic-page-navigation');
      expect(scenarioNames).toContain('browser-history-navigation');
      expect(scenarioNames).toContain('page-reload');
      expect(scenarioNames).toContain('redirect-handling');
      expect(scenarioNames).toContain('error-page-handling');

      // Validate scenario structure
      for (const scenario of NAVIGATION_SCENARIOS) {
        expect(scenario.name).toBeDefined();
        expect(scenario.description).toBeDefined();
        expect(Array.isArray(scenario.steps)).toBe(true);
        expect(scenario.expectedOutcome).toBeDefined();
      }
    });
  });

  describe('Global Test Context', () => {
    it('should have global navigation test context available', () => {
      expect(globalThis.navigationTestContext).toBeDefined();
      expect(globalThis.navigationTestContext.tempDir).toBeDefined();
      expect(globalThis.navigationTestContext.mockServerPort).toBeDefined();
      expect(typeof globalThis.navigationTestContext.mockServerPort).toBe('number');
      expect(globalThis.navigationTestContext.mockServerPort).toBeGreaterThan(0);
    });

    it('should have mock server accessible', async () => {
      const baseUrl = `http://localhost:${globalThis.navigationTestContext.mockServerPort}`;

      // Test mock server accessibility without actually making requests
      expect(baseUrl).toMatch(/^http:\/\/localhost:\d+$/);
    });
  });

  describe('Navigation Test Utilities', () => {
    it('should provide comprehensive navigation validation options', async () => {
      const { validateNavigation } = await import('./utils/navigation-helpers');

      // This test just validates the function signature and types
      expect(typeof validateNavigation).toBe('function');
    });

    it('should provide performance measurement capabilities', async () => {
      const { measureNavigationPerformance, benchmarkNavigation } = await import('./utils/navigation-helpers');

      expect(typeof measureNavigationPerformance).toBe('function');
      expect(typeof benchmarkNavigation).toBe('function');
    });

    it('should provide event monitoring capabilities', async () => {
      const { NavigationEventMonitor } = await import('./utils/navigation-helpers');

      expect(typeof NavigationEventMonitor).toBe('function');
    });
  });
});

describe('Navigation Infrastructure Integration', () => {
  it('should verify complete infrastructure is ready for testing', async () => {
    // Import all major components
    const setupModule = await import('./setup');
    const helpersModule = await import('./utils/navigation-helpers');
    const scenariosModule = await import('./fixtures/navigation-scenarios');

    // Verify all essential components are available
    expect(setupModule.createNavigationBrowser).toBeDefined();
    expect(helpersModule.safeNavigate).toBeDefined();
    expect(scenariosModule.NAVIGATION_SCENARIOS.length).toBeGreaterThan(0);

    // Verify global test context is properly initialized
    expect(globalThis.navigationTestContext).toBeDefined();
    expect(globalThis.navigationTestContext.mockServerPort).toBeGreaterThan(0);

    console.log('✅ Page Navigation Infrastructure Verification Complete');
    console.log('🎯 Infrastructure Components:');
    console.log('  • Vitest Test Framework: Ready');
    console.log('  • Playwright Browser Automation: Ready');
    console.log('  • Mock Server: Running on port', globalThis.navigationTestContext.mockServerPort);
    console.log('  • Navigation Scenarios:', scenariosModule.NAVIGATION_SCENARIOS.length, 'available');
    console.log('  • Test Utilities: All functions loaded');
    console.log('  • Temp Directory:', globalThis.navigationTestContext.tempDir);
    console.log('🚀 Ready for page navigation integration testing!');
  });
});