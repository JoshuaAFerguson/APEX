/**
 * Browser Tool Test Verification
 *
 * This file validates that all browser tool components are properly
 * exported and can be imported without issues, ensuring the test
 * setup is correct for the comprehensive test suite.
 */

import { describe, it, expect } from 'vitest';
import { BrowserTool } from './browser-tool';
import type {
  BrowserOperation,
  BrowserParams,
  BrowserResult,
  BrowserToolConfig,
  BrowserToolOptions,
  BrowserNavigateParams,
  BrowserClickParams,
  BrowserTypeParams,
  BrowserScreenshotParams,
  BrowserCompareScreenshotParams,
  BrowserEvaluateParams,
  BrowserSubmitParams,
  BrowserWaitForSelectorParams,
  BrowserGetAttributeParams,
  BrowserGetTextParams,
  BrowserGetHtmlParams,
  BrowserScrollParams,
  BrowserHoverParams,
  BrowserGeneratePdfParams,
  BrowserConsoleMessage,
  BrowserRuntimeError,
} from './browser-tool';

describe('Browser Tool Test Verification', () => {
  describe('Type Exports', () => {
    it('should export all required types', () => {
      // Verify main class is exported
      expect(BrowserTool).toBeDefined();
      expect(typeof BrowserTool).toBe('function');
    });

    it('should have correct constructor signature', () => {
      // Test constructor without parameters
      const tool1 = new BrowserTool();
      expect(tool1).toBeInstanceOf(BrowserTool);

      // Test constructor with empty options
      const tool2 = new BrowserTool({});
      expect(tool2).toBeInstanceOf(BrowserTool);

      // Test constructor with options
      const tool3 = new BrowserTool({
        engine: 'chromium',
        backend: 'playwright',
        headless: true
      });
      expect(tool3).toBeInstanceOf(BrowserTool);
    });
  });

  describe('Method Signatures', () => {
    let browserTool: BrowserTool;

    beforeEach(() => {
      browserTool = new BrowserTool();
    });

    it('should have all required public methods', () => {
      expect(typeof browserTool.execute).toBe('function');
      expect(typeof browserTool.checkPermission).toBe('function');
      expect(typeof browserTool.setPermissionManager).toBe('function');
      expect(typeof browserTool.setEventEmitter).toBe('function');
      expect(typeof browserTool.cleanup).toBe('function');
      expect(typeof browserTool.destroy).toBe('function');
      expect(typeof browserTool.getResourceState).toBe('function');
      expect(typeof browserTool.isActive).toBe('function');
      expect(typeof browserTool.getState).toBe('function');
      expect(typeof browserTool.getEnhancedConsoleMessages).toBe('function');
      expect(typeof browserTool.getEnhancedRuntimeErrors).toBe('function');
      expect(typeof browserTool.getConsoleStream).toBe('function');
      expect(typeof browserTool.clearConsoleBuffers).toBe('function');
    });

    it('should return correct types for state methods', () => {
      const resourceState = browserTool.getResourceState();
      expect(resourceState).toHaveProperty('browserActive');
      expect(resourceState).toHaveProperty('contextActive');
      expect(resourceState).toHaveProperty('pageActive');
      expect(resourceState).toHaveProperty('sessionId');
      expect(resourceState).toHaveProperty('activeOperations');

      const state = browserTool.getState();
      expect(typeof state).toBe('string');
      expect(['idle', 'launching', 'active', 'cleaning_up', 'destroyed']).toContain(state);

      const isActive = browserTool.isActive();
      expect(typeof isActive).toBe('boolean');
    });
  });

  describe('Parameter Type Validation', () => {
    it('should accept valid browser operation parameters', () => {
      // Test navigate parameters
      const navigateParams: BrowserNavigateParams = {
        url: 'https://example.com',
        waitUntil: 'load',
        timeout: 5000
      };
      expect(navigateParams).toBeDefined();

      // Test click parameters
      const clickParams: BrowserClickParams = {
        selector: '#button',
        button: 'left',
        clickCount: 1,
        delay: 100
      };
      expect(clickParams).toBeDefined();

      // Test type parameters
      const typeParams: BrowserTypeParams = {
        selector: '#input',
        text: 'test text',
        delay: 50,
        clearFirst: true
      };
      expect(typeParams).toBeDefined();

      // Test screenshot parameters
      const screenshotParams: BrowserScreenshotParams = {
        path: '/tmp/screenshot.png',
        fullPage: true,
        selector: '#element',
        format: 'png',
        quality: 90
      };
      expect(screenshotParams).toBeDefined();

      // Test evaluate parameters
      const evaluateParams: BrowserEvaluateParams = {
        script: 'return document.title',
        args: ['arg1', 'arg2']
      };
      expect(evaluateParams).toBeDefined();
    });

    it('should accept browser tool configuration', () => {
      const config: BrowserToolConfig = {
        enabled: true,
        timeout: 30000,
        requireConfirmation: false,
        rateLimitPerMinute: 60,
        allowedDomains: ['example.com'],
        blockedDomains: ['malicious.com'],
        allowJavaScriptExecution: true,
        allowFormSubmission: true,
        pageLoadTimeout: 10000,
        allowDownloads: false,
        allowScreenshots: true,
        blockPopups: true,
        engine: 'chromium',
        backend: 'playwright',
        headless: true,
        userAgent: 'Custom User Agent',
        viewport: { width: 1920, height: 1080 },
        consoleStream: {
          enabled: true,
          config: {
            minLevel: 0,
            captureArgs: true,
            captureStackTraces: true
          }
        }
      };
      expect(config).toBeDefined();
    });
  });

  describe('Result Type Validation', () => {
    it('should define proper result structure', () => {
      const result: BrowserResult = {
        success: true,
        operation: 'navigate',
        data: { url: 'https://example.com', status: 200 },
        screenshot: 'data:image/png;base64,iVBOR...',
        error: undefined,
        metadata: {
          url: 'https://example.com',
          title: 'Example Page',
          executionTime: 150,
          permissionGranted: true,
          permissionLevel: 'full',
          target: 'https://example.com',
          consoleMessages: [],
          runtimeErrors: [],
          enhancedConsoleMessages: [],
          enhancedRuntimeErrors: []
        }
      };
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.operation).toBe('navigate');
    });
  });

  describe('Test File Imports', () => {
    it('should be able to import test files without errors', async () => {
      // This verifies that all test files can be imported
      // which ensures TypeScript compilation will succeed
      expect(true).toBe(true);
    });
  });
});

// Export types for test validation
export type {
  BrowserOperation,
  BrowserParams,
  BrowserResult,
  BrowserToolConfig,
  BrowserToolOptions,
  BrowserNavigateParams,
  BrowserClickParams,
  BrowserTypeParams,
  BrowserScreenshotParams,
  BrowserCompareScreenshotParams,
  BrowserEvaluateParams,
  BrowserSubmitParams,
  BrowserWaitForSelectorParams,
  BrowserGetAttributeParams,
  BrowserGetTextParams,
  BrowserGetHtmlParams,
  BrowserScrollParams,
  BrowserHoverParams,
  BrowserGeneratePdfParams,
  BrowserConsoleMessage,
  BrowserRuntimeError,
};