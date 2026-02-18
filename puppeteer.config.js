/**
 * @fileoverview Puppeteer Configuration for APEX Browser Automation
 *
 * This configuration provides global settings for Puppeteer browser automation
 * across all packages in the APEX monorepo. It complements the Playwright
 * configuration by providing an alternative browser automation backend.
 */

const path = require('path');
const os = require('os');

/**
 * Global Puppeteer configuration for APEX monorepo
 */
module.exports = {
  // Browser launch options
  launch: {
    // Browser configuration
    headless: process.env.CI ? 'new' : false, // Use new headless mode in CI
    devtools: !process.env.CI, // Enable DevTools in development
    slowMo: process.env.CI ? 0 : 100, // Slow motion for debugging

    // Browser arguments
    args: [
      '--no-sandbox', // Required for CI environments
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage', // Overcome limited resource problems
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-features=TranslateUI',
      '--disable-ipc-flooding-protection',
      '--window-size=1280,720', // Default viewport size
    ],

    // Performance options
    ignoreHTTPSErrors: true, // Handle self-signed certificates
    ignoreDefaultArgs: false,

    // Timeout configuration
    timeout: 30000, // 30 seconds browser launch timeout
  },

  // Page configuration
  page: {
    // Default viewport
    viewport: {
      width: 1280,
      height: 720,
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
      isLandscape: true,
    },

    // Page options
    defaultTimeout: 30000, // 30 seconds default timeout
    defaultNavigationTimeout: 30000, // 30 seconds navigation timeout
  },

  // Screenshot configuration
  screenshot: {
    path: path.join(process.cwd(), 'test-artifacts', 'puppeteer-screenshots'),
    fullPage: true,
    type: 'png',
    quality: 90, // JPEG quality (if type is 'jpeg')
  },

  // PDF generation configuration
  pdf: {
    path: path.join(process.cwd(), 'test-artifacts', 'puppeteer-pdfs'),
    format: 'A4',
    printBackground: true,
    margin: {
      top: '20px',
      right: '20px',
      bottom: '20px',
      left: '20px',
    },
  },

  // Test configuration
  test: {
    // Test timeout
    timeout: 60000, // 60 seconds per test

    // Retry configuration
    retries: process.env.CI ? 2 : 0,

    // Parallel execution
    parallel: !process.env.CI, // Parallel in development only
    maxWorkers: process.env.CI ? 1 : Math.min(2, os.cpus().length),
  },

  // Artifact configuration
  artifacts: {
    outputDir: path.join(process.cwd(), 'test-artifacts', 'puppeteer-output'),
    saveOnFailure: true, // Save artifacts on test failure
    saveScreenshots: true,
    savePDFs: false, // Only save PDFs if explicitly requested
    saveHAR: false, // HTTP Archive files for network analysis
  },

  // Network configuration
  network: {
    // Request interception
    interceptRequests: false, // Enable if needed for mocking

    // Cache settings
    cacheEnabled: true,

    // Offline mode
    offline: false,
  },

  // Security configuration
  security: {
    // Content Security Policy
    bypassCSP: false,

    // JavaScript execution
    javascriptEnabled: true,

    // Cookies and storage
    clearCookies: true, // Clear cookies between tests
    clearLocalStorage: true, // Clear local storage between tests
  },

  // Performance monitoring
  performance: {
    // Performance metrics collection
    collectMetrics: true,

    // Resource usage monitoring
    monitorMemory: true,
    monitorCPU: true,

    // Network monitoring
    monitorNetwork: true,
  },

  // Environment-specific configurations
  environments: {
    development: {
      headless: false,
      devtools: true,
      slowMo: 250,
    },

    testing: {
      headless: 'new',
      devtools: false,
      slowMo: 0,
    },

    ci: {
      headless: 'new',
      devtools: false,
      slowMo: 0,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process', // Additional CI stability
      ],
    },
  },

  // Browser pool configuration
  pool: {
    // Browser instance management
    maxInstances: process.env.CI ? 1 : 2,
    idleTimeout: 30000, // 30 seconds idle timeout

    // Resource management
    memoryLimit: '2GB', // Memory limit per browser instance

    // Cleanup configuration
    cleanupOnExit: true,
    forceKillOnTimeout: true,
  },
};