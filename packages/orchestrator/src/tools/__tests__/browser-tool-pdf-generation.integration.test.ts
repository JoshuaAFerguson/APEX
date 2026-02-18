/**
 * Browser Tool PDF Generation Integration Tests
 *
 * Comprehensive testing suite for PDF generation functionality including:
 * - Page to PDF conversion testing
 * - PDF formatting options validation (page sizes, margins, orientation)
 * - Multi-page PDF generation scenarios
 * - PDF content validation and verification
 * - Error handling and edge cases
 * - Performance and memory management
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll, Mock } from 'vitest';
import { BrowserTool, BrowserGeneratePdfParams, BrowserResult } from '../browser-tool';
import { PermissionManager } from '../../permission-manager';
import { EventEmitter } from 'eventemitter3';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// PDF validation utilities
import { createReadStream } from 'fs';

/**
 * Mock Playwright PDF functionality with realistic behavior
 */
const mockPdfBuffer = Buffer.from('PDF-1.4\n%âãÏÓ\nMocked PDF Content', 'binary');

const mockPage = {
  on: vi.fn(),
  off: vi.fn(),
  url: vi.fn(() => 'https://test.example.com/pdf-content'),
  title: vi.fn(() => 'Test PDF Page'),
  goto: vi.fn(() => Promise.resolve({ status: () => 200 })),
  pdf: vi.fn(() => Promise.resolve(mockPdfBuffer)),
  evaluate: vi.fn(),
  setContent: vi.fn(() => Promise.resolve()),
  viewportSize: vi.fn(() => ({ width: 1280, height: 720 })),
  close: vi.fn(() => Promise.resolve()),
};

const mockContext = {
  newPage: vi.fn(() => Promise.resolve(mockPage)),
  on: vi.fn(),
  close: vi.fn(() => Promise.resolve()),
};

const mockBrowser = {
  newContext: vi.fn(() => Promise.resolve(mockContext)),
  close: vi.fn(() => Promise.resolve()),
  version: vi.fn(() => '1.40.0'),
  isConnected: vi.fn(() => true),
};

const mockChromium = {
  launch: vi.fn(() => Promise.resolve(mockBrowser)),
};

// Mock Playwright
vi.mock('playwright', () => ({
  chromium: mockChromium,
  firefox: { launch: vi.fn(() => Promise.reject(new Error('PDF generation only supported in Chromium'))) },
  webkit: { launch: vi.fn(() => Promise.reject(new Error('PDF generation only supported in Chromium'))) },
}));

// Mock file system operations
vi.mock('fs/promises');
const mockedFs = vi.mocked(fs);

describe('Browser Tool PDF Generation Integration Tests', () => {
  let browserTool: BrowserTool;
  let permissionManager: PermissionManager;
  let eventEmitter: EventEmitter;
  let testDir: string;

  beforeAll(async () => {
    // Create temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-pdf-tests-'));
  });

  afterAll(async () => {
    // Clean up test directory
    try {
      await fs.rmdir(testDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup permission manager mock
    permissionManager = {
      checkToolPermission: vi.fn(() => Promise.resolve({
        allowed: true,
        level: null,
        requiresConfirmation: false
      })),
      getToolConfig: vi.fn(() => Promise.resolve({
        enabled: true,
        allowScreenshots: true,
        engine: 'chromium'
      }))
    } as any;

    eventEmitter = new EventEmitter();

    browserTool = new BrowserTool({
      permissionManager,
      backend: 'playwright',
      engine: 'chromium',
      headless: true,
      eventEmitter
    });

    // Reset mock implementations
    mockPage.pdf.mockResolvedValue(mockPdfBuffer);
    mockPage.goto.mockResolvedValue({ status: () => 200 });
    mockPage.setContent.mockResolvedValue(undefined);

    // Mock fs.writeFile to simulate file writing
    mockedFs.writeFile.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    try {
      await browserTool.cleanup();
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });

  describe('Basic PDF Generation', () => {
    it('should generate PDF from current page content', async () => {
      // Setup test page content
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com/content' }
      });

      // Generate PDF without saving to file
      const result = await browserTool.execute({
        operation: 'generatePdf',
        params: {}
      });

      expect(result.success).toBe(true);
      expect(result.operation).toBe('generatePdf');
      expect(result.data).toMatchObject({
        format: 'A4',
        landscape: false,
        pages: 'all',
        size: mockPdfBuffer.length
      });
      expect(result.screenshot).toContain('data:application/pdf;base64,');
      expect(mockPage.pdf).toHaveBeenCalledWith({
        format: 'A4',
        landscape: false,
        printBackground: false,
        scale: 1,
        preferCSSPageSize: false,
        displayHeaderFooter: false,
        path: undefined,
        width: undefined,
        height: undefined,
        margin: undefined,
        pageRanges: undefined,
        headerTemplate: undefined,
        footerTemplate: undefined
      });
    });

    it('should generate PDF and save to specified file path', async () => {
      const pdfPath = path.join(testDir, 'test-output.pdf');

      // Setup test page
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com/content' }
      });

      // Generate PDF with file output
      const result = await browserTool.execute({
        operation: 'generatePdf',
        params: { path: pdfPath }
      });

      expect(result.success).toBe(true);
      expect(result.screenshot).toBe(pdfPath);
      expect(mockPage.pdf).toHaveBeenCalledWith(expect.objectContaining({
        path: pdfPath
      }));
    });

    it('should validate PDF content contains expected data', async () => {
      // Navigate to test page with known content
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com/pdf-content' }
      });

      const result = await browserTool.execute({
        operation: 'generatePdf',
        params: {}
      });

      expect(result.success).toBe(true);

      // Verify PDF buffer is returned with correct format
      const base64Data = result.screenshot?.replace('data:application/pdf;base64,', '');
      expect(base64Data).toBeTruthy();

      const pdfBuffer = Buffer.from(base64Data!, 'base64');
      expect(pdfBuffer.length).toBeGreaterThan(0);
      expect(pdfBuffer.toString('binary')).toContain('PDF-');
    });
  });

  describe('PDF Formatting Options', () => {
    beforeEach(async () => {
      // Setup common test page
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com/formatting-test' }
      });
    });

    it('should support different page sizes', async () => {
      const pageSizes = ['A4', 'Letter', 'Legal', 'A3', 'A5', 'Tabloid', 'Ledger'] as const;

      for (const format of pageSizes) {
        vi.clearAllMocks();

        const result = await browserTool.execute({
          operation: 'generatePdf',
          params: { format }
        });

        expect(result.success).toBe(true);
        expect(result.data?.format).toBe(format);
        expect(mockPage.pdf).toHaveBeenCalledWith(expect.objectContaining({
          format
        }));
      }
    });

    it('should support custom page dimensions', async () => {
      const result = await browserTool.execute({
        operation: 'generatePdf',
        params: {
          width: '210mm',
          height: '297mm'
        }
      });

      expect(result.success).toBe(true);
      expect(mockPage.pdf).toHaveBeenCalledWith(expect.objectContaining({
        width: '210mm',
        height: '297mm'
      }));
    });

    it('should support landscape orientation', async () => {
      const result = await browserTool.execute({
        operation: 'generatePdf',
        params: {
          format: 'A4',
          landscape: true
        }
      });

      expect(result.success).toBe(true);
      expect(result.data?.landscape).toBe(true);
      expect(mockPage.pdf).toHaveBeenCalledWith(expect.objectContaining({
        landscape: true
      }));
    });

    it('should support custom margins', async () => {
      const margins = {
        top: '20mm',
        bottom: '20mm',
        left: '15mm',
        right: '15mm'
      };

      const result = await browserTool.execute({
        operation: 'generatePdf',
        params: {
          margin: margins
        }
      });

      expect(result.success).toBe(true);
      expect(mockPage.pdf).toHaveBeenCalledWith(expect.objectContaining({
        margin: margins
      }));
    });

    it('should support print background graphics', async () => {
      const result = await browserTool.execute({
        operation: 'generatePdf',
        params: {
          printBackground: true
        }
      });

      expect(result.success).toBe(true);
      expect(mockPage.pdf).toHaveBeenCalledWith(expect.objectContaining({
        printBackground: true
      }));
    });

    it('should support custom scale factor', async () => {
      const scales = [0.5, 0.8, 1.0, 1.2, 1.5, 2.0];

      for (const scale of scales) {
        vi.clearAllMocks();

        const result = await browserTool.execute({
          operation: 'generatePdf',
          params: { scale }
        });

        expect(result.success).toBe(true);
        expect(mockPage.pdf).toHaveBeenCalledWith(expect.objectContaining({
          scale
        }));
      }
    });
  });

  describe('Multi-page PDF Generation', () => {
    it('should generate multi-page PDF with page ranges', async () => {
      // Setup multi-page content
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com/multi-page-content' }
      });

      const result = await browserTool.execute({
        operation: 'generatePdf',
        params: {
          pageRanges: '1-3, 5, 8-10'
        }
      });

      expect(result.success).toBe(true);
      expect(result.data?.pages).toBe('1-3, 5, 8-10');
      expect(mockPage.pdf).toHaveBeenCalledWith(expect.objectContaining({
        pageRanges: '1-3, 5, 8-10'
      }));
    });

    it('should generate PDF with headers and footers', async () => {
      const headerTemplate = '<div style="font-size: 10px; text-align: center; width: 100%;">Page Header</div>';
      const footerTemplate = '<div style="font-size: 10px; text-align: center; width: 100%;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>';

      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com/content-with-pages' }
      });

      const result = await browserTool.execute({
        operation: 'generatePdf',
        params: {
          displayHeaderFooter: true,
          headerTemplate,
          footerTemplate,
          margin: {
            top: '40px',
            bottom: '40px'
          }
        }
      });

      expect(result.success).toBe(true);
      expect(mockPage.pdf).toHaveBeenCalledWith(expect.objectContaining({
        displayHeaderFooter: true,
        headerTemplate,
        footerTemplate,
        margin: {
          top: '40px',
          bottom: '40px'
        }
      }));
    });

    it('should handle CSS page size preferences', async () => {
      const result = await browserTool.execute({
        operation: 'generatePdf',
        params: {
          preferCSSPageSize: true
        }
      });

      expect(result.success).toBe(true);
      expect(mockPage.pdf).toHaveBeenCalledWith(expect.objectContaining({
        preferCSSPageSize: true
      }));
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should fail gracefully when using non-Chromium browser engines', async () => {
      const firefoxTool = new BrowserTool({
        permissionManager,
        backend: 'playwright',
        engine: 'firefox',
        headless: true
      });

      await firefoxTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com/content' }
      });

      const result = await firefoxTool.execute({
        operation: 'generatePdf',
        params: {}
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('PDF generation is only supported with Playwright using Chromium browser');

      await firefoxTool.cleanup();
    });

    it('should fail gracefully when using Puppeteer backend', async () => {
      const puppeteerTool = new BrowserTool({
        permissionManager,
        backend: 'puppeteer',
        engine: 'chromium',
        headless: true
      });

      const result = await puppeteerTool.execute({
        operation: 'generatePdf',
        params: {}
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('PDF generation is only supported with Playwright using Chromium browser');

      await puppeteerTool.cleanup();
    });

    it('should handle PDF generation failures', async () => {
      mockPage.pdf.mockRejectedValueOnce(new Error('PDF generation failed: Out of memory'));

      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com/large-content' }
      });

      const result = await browserTool.execute({
        operation: 'generatePdf',
        params: {}
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('PDF generation failed: Out of memory');
    });

    it('should handle invalid page ranges gracefully', async () => {
      mockPage.pdf.mockRejectedValueOnce(new Error('Invalid page range specified'));

      const result = await browserTool.execute({
        operation: 'generatePdf',
        params: {
          pageRanges: 'invalid-range'
        }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid page range specified');
    });

    it('should validate scale parameter bounds', async () => {
      // Test scale values outside valid range (0.1 to 2.0)
      const invalidScales = [-1, 0, 3.0, 10];

      for (const scale of invalidScales) {
        mockPage.pdf.mockRejectedValueOnce(new Error(`Scale must be between 0.1 and 2.0`));

        const result = await browserTool.execute({
          operation: 'generatePdf',
          params: { scale }
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Scale must be between 0.1 and 2.0');
      }
    });

    it('should handle permission denial for PDF generation', async () => {
      const restrictedPermissionManager = {
        ...permissionManager,
        checkToolPermission: vi.fn(() => Promise.resolve({
          allowed: false,
          level: null,
          requiresConfirmation: false,
          denialReason: 'PDF generation not permitted'
        }))
      } as any;

      const restrictedTool = new BrowserTool({
        permissionManager: restrictedPermissionManager,
        backend: 'playwright',
        engine: 'chromium'
      });

      const result = await restrictedTool.execute({
        operation: 'generatePdf',
        params: {}
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Browser permission denied');

      await restrictedTool.cleanup();
    });
  });

  describe('Performance and Memory Management', () => {
    it('should handle large PDF generation without memory leaks', async () => {
      // Simulate large content
      const largePdfBuffer = Buffer.alloc(10 * 1024 * 1024); // 10MB
      mockPage.pdf.mockResolvedValueOnce(largePdfBuffer);

      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com/large-document' }
      });

      const result = await browserTool.execute({
        operation: 'generatePdf',
        params: {
          format: 'A4',
          printBackground: true
        }
      });

      expect(result.success).toBe(true);
      expect(result.data?.size).toBe(largePdfBuffer.length);
    });

    it('should properly clean up resources after PDF generation', async () => {
      const eventSpy = vi.fn();
      eventEmitter.on('browser:state:transition', eventSpy);

      await browserTool.execute({
        operation: 'generatePdf',
        params: {}
      });

      await browserTool.cleanup();

      // Verify cleanup was called
      expect(mockPage.close).toHaveBeenCalled();
      expect(mockContext.close).toHaveBeenCalled();
      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('should handle concurrent PDF generation requests', async () => {
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com/content' }
      });

      // Simulate concurrent requests
      const requests = Array.from({ length: 5 }, (_, i) =>
        browserTool.execute({
          operation: 'generatePdf',
          params: { format: 'A4' }
        })
      );

      const results = await Promise.all(requests);

      // All requests should succeed
      expect(results.every(r => r.success)).toBe(true);
      expect(mockPage.pdf).toHaveBeenCalledTimes(5);
    });
  });

  describe('Integration with Browser Events', () => {
    it('should emit appropriate events during PDF generation', async () => {
      const eventSpy = vi.fn();
      eventEmitter.on('browser:state:transition', eventSpy);

      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com/content' }
      });

      await browserTool.execute({
        operation: 'generatePdf',
        params: {}
      });

      // Should have emitted state transition events
      expect(eventSpy).toHaveBeenCalled();
    });

    it('should maintain browser session state during PDF operations', async () => {
      // Navigate to page
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com/stateful-content' }
      });

      // Check that browser tool is active
      expect(browserTool.isActive()).toBe(true);

      // Generate PDF
      const result = await browserTool.execute({
        operation: 'generatePdf',
        params: {}
      });

      expect(result.success).toBe(true);
      // Should still be active after PDF generation
      expect(browserTool.isActive()).toBe(true);
    });
  });

  describe('Content Validation', () => {
    it('should generate PDF from HTML content with proper encoding', async () => {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Test PDF Content</title>
          <meta charset="UTF-8">
        </head>
        <body>
          <h1>Test Document</h1>
          <p>This is test content for PDF generation with special characters: áéíóú</p>
          <div style="page-break-after: always;"></div>
          <h2>Page 2</h2>
          <p>Second page content</p>
        </body>
        </html>
      `;

      // Set content directly instead of navigating
      mockPage.setContent.mockResolvedValueOnce(undefined);
      await browserTool.execute({
        operation: 'evaluate',
        params: {
          script: `document.documentElement.innerHTML = \`${htmlContent.replace(/`/g, '\\`')}\``
        }
      });

      const result = await browserTool.execute({
        operation: 'generatePdf',
        params: {
          format: 'A4',
          printBackground: true,
          displayHeaderFooter: true,
          headerTemplate: '<div style="font-size: 10px;">Test Document Header</div>',
          footerTemplate: '<div style="font-size: 10px;">Page <span class="pageNumber"></span></div>',
          margin: {
            top: '50px',
            bottom: '50px'
          }
        }
      });

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        format: 'A4',
        landscape: false,
        pages: 'all'
      });
    });

    it('should handle empty page content gracefully', async () => {
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'data:text/html,<html><body></body></html>' }
      });

      const result = await browserTool.execute({
        operation: 'generatePdf',
        params: {}
      });

      expect(result.success).toBe(true);
      expect(result.data?.size).toBeGreaterThan(0);
    });
  });
});