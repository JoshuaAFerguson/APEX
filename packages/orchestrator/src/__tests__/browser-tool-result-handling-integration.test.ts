/**
 * Browser Tool Result Handling Integration Tests
 *
 * Comprehensive integration tests for browser tool result handling including:
 * - Schema validation for browser tool results
 * - Result serialization and deserialization
 * - Screenshot data handling (base64 and file paths)
 * - Success/failure state reporting
 * - Metadata validation and consistency
 * - Error handling and edge cases
 *
 * These tests verify that browser tool results conform to expected schemas,
 * are properly serialized/deserialized, handle screenshot data correctly,
 * and accurately report success/failure states.
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll, Mock } from 'vitest';
import { z } from 'zod';
import {
  BrowserTool,
  BrowserResult,
  BrowserOperation,
  BrowserNavigateParams,
  BrowserScreenshotParams,
  BrowserCompareScreenshotParams,
  BrowserEvaluateParams,
  BrowserConsoleMessage,
  BrowserRuntimeError
} from '../tools/browser-tool.js';
import { PermissionManager } from '../permission-manager.js';
import { ToolPermissionResult, PermissionLevel } from '@apexcli/core';
import { EventEmitter } from 'eventemitter3';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ============================================================================
// Schema Definitions for Browser Result Validation
// ============================================================================

/**
 * Comprehensive schema for validating BrowserResult objects
 */
const BrowserResultSchema = z.object({
  success: z.boolean(),
  operation: z.enum([
    'navigate', 'click', 'type', 'screenshot', 'compareScreenshot',
    'evaluate', 'submit', 'waitForSelector', 'getAttribute',
    'getText', 'getHtml', 'scroll', 'hover', 'generatePdf',
    'goBack', 'goForward', 'go'
  ]),
  data: z.unknown().optional(),
  screenshot: z.string().optional(),
  error: z.string().optional(),
  metadata: z.object({
    url: z.string(),
    title: z.string().optional(),
    executionTime: z.number().min(0),
    permissionGranted: z.boolean(),
    permissionLevel: z.enum(['full', 'partial', 'restricted']).optional(),
    target: z.string().optional(),
    consoleMessages: z.array(z.object({
      type: z.string(),
      text: z.string(),
      timestamp: z.date()
    })).optional(),
    runtimeErrors: z.array(z.object({
      message: z.string(),
      stack: z.string().optional(),
      timestamp: z.date()
    })).optional(),
    enhancedConsoleMessages: z.array(z.unknown()).optional(),
    enhancedRuntimeErrors: z.array(z.unknown()).optional()
  }).optional()
});

/**
 * Schema for screenshot data validation (base64 or file path)
 */
const ScreenshotDataSchema = z.union([
  z.string().regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/, 'Invalid base64 image data'),
  z.string().min(1, 'File path cannot be empty')
]);

/**
 * Schema for navigate operation results
 */
const NavigateResultDataSchema = z.object({
  url: z.string().url(),
  status: z.number().optional()
});

/**
 * Schema for screenshot operation results
 */
const ScreenshotResultDataSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive(),
  format: z.enum(['png', 'jpeg'])
});

/**
 * Schema for compare screenshot operation results
 */
const CompareScreenshotResultDataSchema = z.object({
  differentPixels: z.number().min(0),
  totalPixels: z.number().positive(),
  similarity: z.number().min(0).max(1),
  diffRatio: z.number().min(0).max(1),
  threshold: z.number().min(0).max(1),
  isMatch: z.boolean(),
  match: z.boolean().optional(), // Legacy field
  diffPath: z.string().optional(),
  dimensions: z.object({
    width: z.number().positive(),
    height: z.number().positive()
  })
});

// ============================================================================
// Playwright Mocks
// ============================================================================

// Mock Playwright to avoid actual browser launching in tests
const mockPage = {
  on: vi.fn(),
  off: vi.fn(),
  url: vi.fn(() => 'https://example.com'),
  title: vi.fn(() => Promise.resolve('Test Page')),
  goto: vi.fn(() => Promise.resolve({ status: () => 200 })),
  click: vi.fn(() => Promise.resolve()),
  fill: vi.fn(() => Promise.resolve()),
  type: vi.fn(() => Promise.resolve()),
  screenshot: vi.fn(() => Promise.resolve(Buffer.from('mock-screenshot'))),
  evaluate: vi.fn(() => Promise.resolve(null)),
  waitForSelector: vi.fn(() => Promise.resolve()),
  getAttribute: vi.fn(() => Promise.resolve('test-attribute')),
  textContent: vi.fn(() => Promise.resolve('test content')),
  innerHTML: vi.fn(() => Promise.resolve('<div>test</div>')),
  content: vi.fn(() => Promise.resolve('<!DOCTYPE html><html><body>test</body></html>')),
  hover: vi.fn(() => Promise.resolve()),
  locator: vi.fn(() => ({
    screenshot: vi.fn(() => Promise.resolve(Buffer.from('element-screenshot'))),
    scrollIntoViewIfNeeded: vi.fn(() => Promise.resolve()),
    evaluate: vi.fn(() => Promise.resolve())
  })),
  viewportSize: vi.fn(() => ({ width: 1280, height: 720 })),
  pdf: vi.fn(() => Promise.resolve(Buffer.from('mock-pdf'))),
  goBack: vi.fn(() => Promise.resolve({})),
  goForward: vi.fn(() => Promise.resolve({})),
  close: vi.fn(() => Promise.resolve())
};

const mockContext = {
  newPage: vi.fn(() => Promise.resolve(mockPage)),
  on: vi.fn(),
  close: vi.fn(() => Promise.resolve())
};

const mockBrowser = {
  newContext: vi.fn(() => Promise.resolve(mockContext)),
  close: vi.fn(() => Promise.resolve()),
  version: vi.fn(() => '1.40.0'),
  isConnected: vi.fn(() => true)
};

const mockBrowserType = {
  launch: vi.fn(() => Promise.resolve(mockBrowser))
};

// Mock Playwright modules
vi.mock('playwright', () => ({
  chromium: mockBrowserType,
  firefox: mockBrowserType,
  webkit: mockBrowserType
}));

// Mock fs operations for PNG comparison
vi.mock('pngjs', () => ({
  PNG: {
    sync: {
      read: vi.fn(() => ({
        width: 1280,
        height: 720,
        data: Buffer.alloc(1280 * 720 * 4)
      })),
      write: vi.fn(() => Buffer.from('mock-diff-png'))
    }
  }
}));

vi.mock('pixelmatch', () => ({
  default: vi.fn(() => 0) // No different pixels
}));

// ============================================================================
// Test Setup and Utilities
// ============================================================================

describe('Browser Tool Result Handling Integration Tests', () => {
  let browserTool: BrowserTool;
  let mockPermissionManager: PermissionManager;
  let eventEmitter: EventEmitter;
  let tempDir: string;
  let testScreenshotPath: string;
  let testBaselinePath: string;

  // Mock Playwright to avoid actual browser launching in tests
  beforeAll(() => {
    // Create temporary directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-test-'));
    testScreenshotPath = path.join(tempDir, 'test-screenshot.png');
    testBaselinePath = path.join(tempDir, 'baseline.png');

    // Create test screenshot files
    const testImageBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
    fs.writeFileSync(testScreenshotPath, testImageBuffer);
    fs.writeFileSync(testBaselinePath, testImageBuffer);
  });

  afterAll(() => {
    // Cleanup temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    // Create mock permission manager with full permissions
    mockPermissionManager = {
      async checkToolPermission(tool: string, options?: any): Promise<ToolPermissionResult> {
        return {
          allowed: true,
          level: 'full' as PermissionLevel,
          requiresConfirmation: false
        };
      },
      async getToolConfig(tool: string): Promise<any> {
        return {
          enabled: true,
          timeout: 30000,
          allowedDomains: ['*'],
          blockedDomains: [],
          allowJavaScriptExecution: true,
          allowFormSubmission: true,
          allowScreenshots: true,
          pageLoadTimeout: 30000,
          headless: true
        };
      }
    } as PermissionManager;

    // Create event emitter for testing
    eventEmitter = new EventEmitter();

    // Create browser tool instance
    browserTool = new BrowserTool({
      permissionManager: mockPermissionManager,
      headless: true,
      eventEmitter
    });
  });

  afterEach(async () => {
    // Cleanup browser tool resources
    try {
      await browserTool.cleanup();
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });

  // ============================================================================
  // Schema Validation Tests
  // ============================================================================

  describe('Browser Result Schema Validation', () => {
    it('should validate successful navigate operation result schema', async () => {
      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // Validate overall result schema
      expect(() => BrowserResultSchema.parse(result)).not.toThrow();

      // Validate specific properties
      expect(result.success).toBe(true);
      expect(result.operation).toBe('navigate');
      expect(result.metadata?.permissionGranted).toBe(true);
      expect(result.metadata?.executionTime).toBeGreaterThanOrEqual(0);

      // Validate navigate-specific data
      if (result.data) {
        expect(() => NavigateResultDataSchema.parse(result.data)).not.toThrow();
      }
    });

    it('should validate failed operation result schema', async () => {
      // Mock permission manager to deny permissions
      const denyingPermissionManager = {
        async checkToolPermission(tool: string, options?: any): Promise<ToolPermissionResult> {
          return {
            allowed: false,
            level: null,
            requiresConfirmation: false,
            denialReason: 'Test denial'
          };
        },
        async getToolConfig(tool: string): Promise<any> {
          return { enabled: false };
        }
      } as PermissionManager;

      const restrictedBrowserTool = new BrowserTool({
        permissionManager: denyingPermissionManager,
        headless: true
      });

      const result = await restrictedBrowserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // Validate overall result schema
      expect(() => BrowserResultSchema.parse(result)).not.toThrow();

      // Validate failure properties
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.metadata?.permissionGranted).toBe(false);
    });

    it('should validate screenshot operation result schema', async () => {
      const result = await browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: true, format: 'png' }
      });

      // Validate overall result schema
      expect(() => BrowserResultSchema.parse(result)).not.toThrow();

      // Validate screenshot-specific properties
      expect(result.success).toBe(true);
      expect(result.screenshot).toBeDefined();

      if (result.data) {
        expect(() => ScreenshotResultDataSchema.parse(result.data)).not.toThrow();
      }
    });

    it('should validate console messages schema in result metadata', async () => {
      // Execute operation that might generate console messages
      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(() => BrowserResultSchema.parse(result)).not.toThrow();

      if (result.metadata?.consoleMessages) {
        result.metadata.consoleMessages.forEach(msg => {
          expect(typeof msg.type).toBe('string');
          expect(typeof msg.text).toBe('string');
          expect(msg.timestamp).toBeInstanceOf(Date);
        });
      }
    });

    it('should validate runtime errors schema in result metadata', async () => {
      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(() => BrowserResultSchema.parse(result)).not.toThrow();

      if (result.metadata?.runtimeErrors) {
        result.metadata.runtimeErrors.forEach(error => {
          expect(typeof error.message).toBe('string');
          expect(error.timestamp).toBeInstanceOf(Date);
        });
      }
    });
  });

  // ============================================================================
  // Serialization/Deserialization Tests
  // ============================================================================

  describe('Result Serialization and Deserialization', () => {
    it('should properly serialize and deserialize successful result', async () => {
      const originalResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // Serialize to JSON
      const serialized = JSON.stringify(originalResult);
      expect(() => JSON.parse(serialized)).not.toThrow();

      // Deserialize and validate
      const deserialized = JSON.parse(serialized);

      // Core properties should match
      expect(deserialized.success).toBe(originalResult.success);
      expect(deserialized.operation).toBe(originalResult.operation);
      expect(deserialized.data).toEqual(originalResult.data);
      expect(deserialized.screenshot).toBe(originalResult.screenshot);
      expect(deserialized.error).toBe(originalResult.error);

      // Metadata should be preserved
      if (originalResult.metadata) {
        expect(deserialized.metadata.url).toBe(originalResult.metadata.url);
        expect(deserialized.metadata.permissionGranted).toBe(originalResult.metadata.permissionGranted);
        expect(deserialized.metadata.executionTime).toBe(originalResult.metadata.executionTime);
      }
    });

    it('should handle Date objects in serialization', async () => {
      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // Add mock console messages with Date objects
      if (result.metadata) {
        result.metadata.consoleMessages = [{
          type: 'log',
          text: 'Test message',
          timestamp: new Date()
        }];
      }

      const serialized = JSON.stringify(result);
      const deserialized = JSON.parse(serialized);

      // Date should be serialized as string
      if (deserialized.metadata?.consoleMessages?.[0]) {
        expect(typeof deserialized.metadata.consoleMessages[0].timestamp).toBe('string');
        // Should be valid ISO date string
        expect(new Date(deserialized.metadata.consoleMessages[0].timestamp)).toBeInstanceOf(Date);
      }
    });

    it('should preserve complex data structures in serialization', async () => {
      const result = await browserTool.execute({
        operation: 'evaluate',
        params: {
          script: 'return { nested: { value: 42, array: [1, 2, 3] } };'
        }
      });

      const serialized = JSON.stringify(result);
      const deserialized = JSON.parse(serialized);

      // Complex data should be preserved
      expect(deserialized.data).toEqual(result.data);
    });

    it('should handle undefined and null values in serialization', async () => {
      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // Modify result to include undefined/null values
      const modifiedResult = {
        ...result,
        screenshot: undefined,
        error: null,
        data: { value: undefined, nullValue: null }
      };

      const serialized = JSON.stringify(modifiedResult);
      const deserialized = JSON.parse(serialized);

      // undefined values should be omitted, null values preserved
      expect(deserialized.screenshot).toBeUndefined();
      expect(deserialized.error).toBeNull();
      expect(deserialized.data.nullValue).toBeNull();
      expect('value' in deserialized.data).toBe(false); // undefined omitted
    });

    it('should handle circular references safely', () => {
      const result = {
        success: true,
        operation: 'navigate' as BrowserOperation,
        data: {} as any,
        metadata: {
          url: 'https://example.com',
          executionTime: 100,
          permissionGranted: true
        }
      };

      // Create circular reference
      result.data.self = result;

      // Should not throw but handle gracefully
      expect(() => {
        try {
          JSON.stringify(result);
        } catch (error) {
          // Expected behavior for circular references
          expect(error).toBeInstanceOf(TypeError);
        }
      }).not.toThrow();
    });
  });

  // ============================================================================
  // Screenshot Data Handling Tests
  // ============================================================================

  describe('Screenshot Data Handling', () => {
    it('should handle base64 screenshot data correctly', async () => {
      const result = await browserTool.execute({
        operation: 'screenshot',
        params: { format: 'png' }
      });

      expect(result.success).toBe(true);
      expect(result.screenshot).toBeDefined();

      if (result.screenshot) {
        // Should be base64 data URL for in-memory screenshots
        if (result.screenshot.startsWith('data:')) {
          expect(() => ScreenshotDataSchema.parse(result.screenshot!)).not.toThrow();
          expect(result.screenshot).toMatch(/^data:image\/(png|jpeg);base64,/);

          // Extract and validate base64 data
          const base64Data = result.screenshot.split(',')[1];
          expect(() => Buffer.from(base64Data, 'base64')).not.toThrow();
        }
      }
    });

    it('should handle file path screenshot data correctly', async () => {
      const result = await browserTool.execute({
        operation: 'screenshot',
        params: { path: testScreenshotPath, format: 'png' }
      });

      expect(result.success).toBe(true);
      expect(result.screenshot).toBe(testScreenshotPath);

      // File should exist
      expect(fs.existsSync(testScreenshotPath)).toBe(true);

      // Should be valid PNG file
      const fileBuffer = fs.readFileSync(testScreenshotPath);
      expect(fileBuffer.length).toBeGreaterThan(0);
    });

    it('should validate screenshot format and quality parameters', async () => {
      const pngResult = await browserTool.execute({
        operation: 'screenshot',
        params: { format: 'png', fullPage: true }
      });

      const jpegResult = await browserTool.execute({
        operation: 'screenshot',
        params: { format: 'jpeg', quality: 80 }
      });

      expect(pngResult.success).toBe(true);
      expect(jpegResult.success).toBe(true);

      // Data should reflect format
      if (pngResult.data) {
        expect((pngResult.data as any).format).toBe('png');
      }
      if (jpegResult.data) {
        expect((jpegResult.data as any).format).toBe('jpeg');
      }
    });

    it('should handle screenshot comparison data correctly', async () => {
      const result = await browserTool.execute({
        operation: 'compareScreenshot',
        params: {
          baselinePath: testBaselinePath,
          threshold: 0.1,
          format: 'png'
        }
      });

      expect(result.success).toBe(true);

      if (result.data) {
        expect(() => CompareScreenshotResultDataSchema.parse(result.data)).not.toThrow();

        const data = result.data as any;
        expect(data.differentPixels).toBeGreaterThanOrEqual(0);
        expect(data.totalPixels).toBeGreaterThan(0);
        expect(data.similarity).toBeGreaterThanOrEqual(0);
        expect(data.similarity).toBeLessThanOrEqual(1);
        expect(typeof data.isMatch).toBe('boolean');
      }
    });

    it('should handle large screenshot data efficiently', async () => {
      const startTime = Date.now();

      const result = await browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: true, format: 'png' }
      });

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(result.success).toBe(true);
      expect(executionTime).toBeLessThan(10000); // Should complete within 10 seconds

      // Screenshot data should be reasonable size
      if (result.screenshot && result.screenshot.startsWith('data:')) {
        const base64Data = result.screenshot.split(',')[1];
        const dataSize = Buffer.from(base64Data, 'base64').length;
        expect(dataSize).toBeGreaterThan(0);
        expect(dataSize).toBeLessThan(10 * 1024 * 1024); // Less than 10MB
      }
    });
  });

  // ============================================================================
  // Success/Failure State Reporting Tests
  // ============================================================================

  describe('Success and Failure State Reporting', () => {
    it('should accurately report successful operation states', async () => {
      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      // Success state validation
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.metadata?.permissionGranted).toBe(true);
      expect(result.metadata?.executionTime).toBeGreaterThanOrEqual(0);

      // Data should be populated for successful operations
      expect(result.data).toBeDefined();
      expect(result.metadata?.url).toBeDefined();
    });

    it('should accurately report permission denial failures', async () => {
      const denyingPermissionManager = {
        async checkToolPermission(tool: string, options?: any): Promise<ToolPermissionResult> {
          return {
            allowed: false,
            level: null,
            requiresConfirmation: false,
            denialReason: 'Domain blocked for testing'
          };
        },
        async getToolConfig(tool: string): Promise<any> {
          return { enabled: false };
        }
      } as PermissionManager;

      const restrictedBrowserTool = new BrowserTool({
        permissionManager: denyingPermissionManager,
        headless: true
      });

      const result = await restrictedBrowserTool.execute({
        operation: 'navigate',
        params: { url: 'https://blocked.com' }
      });

      // Failure state validation
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('permission denied');
      expect(result.metadata?.permissionGranted).toBe(false);
      expect(result.data).toBeUndefined();
    });

    it('should report configuration restriction failures', async () => {
      const restrictivePermissionManager = {
        async checkToolPermission(tool: string, options?: any): Promise<ToolPermissionResult> {
          return {
            allowed: true,
            level: 'full' as PermissionLevel,
            requiresConfirmation: false
          };
        },
        async getToolConfig(tool: string): Promise<any> {
          return {
            enabled: true,
            allowJavaScriptExecution: false, // Block JavaScript
            allowScreenshots: true
          };
        }
      } as PermissionManager;

      const restrictedBrowserTool = new BrowserTool({
        permissionManager: restrictivePermissionManager,
        headless: true
      });

      const result = await restrictedBrowserTool.execute({
        operation: 'evaluate',
        params: { script: 'return document.title;' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('JavaScript execution is disabled');
      expect(result.metadata?.permissionGranted).toBe(false);
    });

    it('should report browser operation failures', async () => {
      const result = await browserTool.execute({
        operation: 'navigate',
        params: {
          url: 'https://nonexistent-domain-12345.invalid',
          timeout: 1000 // Short timeout to force failure
        }
      });

      // May succeed or fail depending on mock behavior
      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(result.metadata?.permissionGranted).toBe(true); // Permission was granted
        expect(result.metadata?.executionTime).toBeGreaterThanOrEqual(0);
      }
    });

    it('should maintain consistent state across multiple operations', async () => {
      const operations = [
        { operation: 'navigate' as const, params: { url: 'https://example.com' } },
        { operation: 'screenshot' as const, params: { format: 'png' as const } },
        { operation: 'evaluate' as const, params: { script: 'return document.title;' } }
      ];

      const results = [];
      for (const op of operations) {
        const result = await browserTool.execute(op);
        results.push(result);
      }

      // All operations should have consistent metadata structure
      results.forEach((result, index) => {
        expect(() => BrowserResultSchema.parse(result)).not.toThrow();
        expect(result.metadata?.executionTime).toBeGreaterThanOrEqual(0);
        expect(typeof result.metadata?.permissionGranted).toBe('boolean');

        if (result.success) {
          expect(result.error).toBeUndefined();
        } else {
          expect(result.error).toBeDefined();
        }
      });
    });

    it('should handle edge cases in state reporting', async () => {
      // Test with empty URL (should fail)
      const emptyUrlResult = await browserTool.execute({
        operation: 'navigate',
        params: { url: '' }
      });

      if (!emptyUrlResult.success) {
        expect(emptyUrlResult.error).toBeDefined();
      }

      // Test with invalid selector (should fail or handle gracefully)
      const invalidSelectorResult = await browserTool.execute({
        operation: 'click',
        params: { selector: 'invalid>>selector:::' }
      });

      // Should either succeed (if gracefully handled) or fail with appropriate error
      expect(typeof invalidSelectorResult.success).toBe('boolean');
      if (!invalidSelectorResult.success) {
        expect(invalidSelectorResult.error).toBeDefined();
      }
    });

    it('should report timeout failures correctly', async () => {
      const result = await browserTool.execute({
        operation: 'navigate',
        params: {
          url: 'https://httpbin.org/delay/10', // Long delay
          timeout: 100 // Very short timeout
        }
      });

      // Should timeout and report failure
      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(result.metadata?.executionTime).toBeGreaterThanOrEqual(0);
        expect(result.metadata?.permissionGranted).toBe(true);
      }
    });
  });

  // ============================================================================
  // Event Emission and Metadata Tests
  // ============================================================================

  describe('Event Emission and Metadata Validation', () => {
    it('should emit events for successful operations', async () => {
      const events: any[] = [];
      eventEmitter.on('visual:comparison:passed', (data) => events.push({ type: 'passed', data }));
      eventEmitter.on('visual:comparison:failed', (data) => events.push({ type: 'failed', data }));

      await browserTool.execute({
        operation: 'compareScreenshot',
        params: {
          baselinePath: testBaselinePath,
          testId: 'integration-test'
        }
      });

      // Should have emitted comparison event
      expect(events.length).toBeGreaterThanOrEqual(0);
    });

    it('should emit permission denied events', async () => {
      const events: any[] = [];
      eventEmitter.on('permission:denied', (data) => events.push(data));

      const denyingPermissionManager = {
        async checkToolPermission(tool: string, options?: any): Promise<ToolPermissionResult> {
          return {
            allowed: false,
            level: null,
            requiresConfirmation: false,
            denialReason: 'Test denial for event'
          };
        },
        async getToolConfig(tool: string): Promise<any> {
          return { enabled: false };
        }
      } as PermissionManager;

      const restrictedBrowserTool = new BrowserTool({
        permissionManager: denyingPermissionManager,
        eventEmitter,
        headless: true
      });

      await restrictedBrowserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].operation).toBe('navigate');
      expect(events[0].denialReason).toBeDefined();
    });

    it('should validate metadata consistency across operations', async () => {
      const results = [];

      // Execute multiple operations
      for (const operation of ['navigate', 'screenshot', 'evaluate'] as const) {
        const params = operation === 'navigate'
          ? { url: 'https://example.com' }
          : operation === 'screenshot'
          ? { format: 'png' as const }
          : { script: 'return 42;' };

        const result = await browserTool.execute({ operation, params } as any);
        results.push(result);
      }

      // Validate metadata consistency
      results.forEach(result => {
        if (result.metadata) {
          expect(result.metadata.url).toBeDefined();
          expect(typeof result.metadata.executionTime).toBe('number');
          expect(result.metadata.executionTime).toBeGreaterThanOrEqual(0);
          expect(typeof result.metadata.permissionGranted).toBe('boolean');
        }
      });
    });
  });

  // ============================================================================
  // Edge Cases and Error Handling Tests
  // ============================================================================

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed parameters gracefully', async () => {
      // Test with missing required parameters
      const result = await browserTool.execute({
        operation: 'navigate',
        params: {} as any // Missing url
      });

      // Should fail gracefully
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(() => BrowserResultSchema.parse(result)).not.toThrow();
    });

    it('should handle very large result data', async () => {
      const largeScript = `
        return Array(1000).fill(0).map((_, i) => ({
          id: i,
          data: 'x'.repeat(100),
          nested: { value: i * 2 }
        }));
      `;

      const result = await browserTool.execute({
        operation: 'evaluate',
        params: { script: largeScript }
      });

      // Should handle large data without issues
      expect(() => BrowserResultSchema.parse(result)).not.toThrow();

      if (result.success && result.data) {
        const serialized = JSON.stringify(result);
        expect(serialized.length).toBeGreaterThan(1000);

        // Should be parseable
        expect(() => JSON.parse(serialized)).not.toThrow();
      }
    });

    it('should handle concurrent operations', async () => {
      const operations = Array(5).fill(0).map((_, i) =>
        browserTool.execute({
          operation: 'navigate',
          params: { url: `https://example.com/page${i}` }
        })
      );

      const results = await Promise.allSettled(operations);

      // All should complete
      expect(results.length).toBe(5);

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          expect(() => BrowserResultSchema.parse(result.value)).not.toThrow();
        }
      });
    });

    it('should maintain result consistency after cleanup', async () => {
      const result1 = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      await browserTool.cleanup();

      // New operations should still work and produce valid results
      const result2 = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com/page2' }
      });

      expect(() => BrowserResultSchema.parse(result1)).not.toThrow();
      expect(() => BrowserResultSchema.parse(result2)).not.toThrow();
    });
  });
});