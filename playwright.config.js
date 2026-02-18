/**
 * @fileoverview Simple Playwright Configuration for APEX Browser Dependencies
 *
 * This is a minimal configuration file to indicate that Playwright is available
 * for browser automation. The actual testing is handled by Vitest.
 */

module.exports = {
  // Basic browser configuration for Playwright browsers
  browsers: ['chromium', 'firefox', 'webkit'],

  // Headless mode based on environment
  headless: process.env.CI === 'true' || process.env.BROWSER_TEST_HEADLESS === 'true',

  // Standard viewport for consistent testing
  viewport: { width: 1280, height: 720 },

  // Timeout settings
  timeout: 30000,

  // Test artifacts directory
  outputDir: './test-artifacts',
};