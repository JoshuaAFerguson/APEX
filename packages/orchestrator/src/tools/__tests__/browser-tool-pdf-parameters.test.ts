/**
 * Browser Tool PDF Parameters Unit Tests
 *
 * Focused unit tests for PDF generation parameter validation and edge cases:
 * - Parameter type validation
 * - Boundary value testing
 * - Invalid input handling
 * - Default value behavior
 * - Type safety verification
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BrowserTool,
  BrowserGeneratePdfParams,
  BrowserParams
} from '../browser-tool';
import { PermissionManager } from '../../permission-manager';

// Mock Playwright for parameter testing
const mockPage = {
  on: vi.fn(),
  url: vi.fn(() => 'https://example.com'),
  title: vi.fn(() => 'Test Page'),
  pdf: vi.fn(() => Promise.resolve(Buffer.from('mock-pdf'))),
  viewportSize: vi.fn(() => ({ width: 1280, height: 720 })),
  close: vi.fn(),
};

const mockContext = {
  newPage: vi.fn(() => Promise.resolve(mockPage)),
  close: vi.fn(),
};

const mockBrowser = {
  newContext: vi.fn(() => Promise.resolve(mockContext)),
  close: vi.fn(),
};

vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn(() => Promise.resolve(mockBrowser)),
  },
}));

describe('Browser Tool PDF Parameters Unit Tests', () => {
  let browserTool: BrowserTool;
  let permissionManager: PermissionManager;

  beforeEach(() => {
    vi.clearAllMocks();

    permissionManager = {
      checkToolPermission: vi.fn(() => Promise.resolve({
        allowed: true,
        level: null,
        requiresConfirmation: false
      })),
      getToolConfig: vi.fn(() => Promise.resolve({
        enabled: true,
        engine: 'chromium'
      }))
    } as any;

    browserTool = new BrowserTool({
      permissionManager,
      backend: 'playwright',
      engine: 'chromium',
      headless: true
    });

    mockPage.pdf.mockResolvedValue(Buffer.from('mock-pdf'));
  });

  afterEach(async () => {
    try {
      await browserTool.cleanup();
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });

  describe('PDF Format Parameter Validation', () => {
    it('should accept valid page formats', async () => {
      const validFormats: BrowserGeneratePdfParams['format'][] = [
        'Letter', 'Legal', 'Tabloid', 'Ledger', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6'
      ];

      for (const format of validFormats) {
        const params: BrowserParams = {
          operation: 'generatePdf',
          params: { format }
        };

        const result = await browserTool.execute(params);

        expect(result.success).toBe(true);
        expect(mockPage.pdf).toHaveBeenCalledWith(expect.objectContaining({
          format
        }));

        vi.clearAllMocks();
        mockPage.pdf.mockResolvedValue(Buffer.from('mock-pdf'));
      }
    });

    it('should default to A4 when no format specified', async () => {
      const params: BrowserParams = {
        operation: 'generatePdf',
        params: {}
      };

      const result = await browserTool.execute(params);

      expect(result.success).toBe(true);
      expect(mockPage.pdf).toHaveBeenCalledWith(expect.objectContaining({
        format: 'A4'
      }));
    });
  });

  describe('Custom Dimensions Parameter Validation', () => {
    it('should accept valid width and height values', async () => {
      const validDimensions = [
        { width: '210mm', height: '297mm' }, // A4 in mm
        { width: '8.5in', height: '11in' },   // Letter in inches
        { width: '600px', height: '800px' },   // Pixels
        { width: '21cm', height: '29.7cm' },   // Centimeters
      ];

      for (const { width, height } of validDimensions) {
        const params: BrowserParams = {
          operation: 'generatePdf',
          params: { width, height }
        };

        const result = await browserTool.execute(params);

        expect(result.success).toBe(true);
        expect(mockPage.pdf).toHaveBeenCalledWith(expect.objectContaining({
          width,
          height
        }));

        vi.clearAllMocks();
        mockPage.pdf.mockResolvedValue(Buffer.from('mock-pdf'));
      }
    });

    it('should override format when width and height are provided', async () => {
      const params: BrowserParams = {
        operation: 'generatePdf',
        params: {
          format: 'A4',
          width: '300mm',
          height: '400mm'
        }
      };

      const result = await browserTool.execute(params);

      expect(result.success).toBe(true);
      expect(mockPage.pdf).toHaveBeenCalledWith(expect.objectContaining({
        format: 'A4',
        width: '300mm',
        height: '400mm'
      }));
    });
  });

  describe('Margin Parameter Validation', () => {
    it('should accept valid margin specifications', async () => {
      const validMargins = [
        { top: '20mm' },
        { bottom: '15mm', left: '10mm' },
        { top: '1in', bottom: '1in', left: '0.75in', right: '0.75in' },
        { top: '30px', bottom: '30px' },
      ];

      for (const margin of validMargins) {
        const params: BrowserParams = {
          operation: 'generatePdf',
          params: { margin }
        };

        const result = await browserTool.execute(params);

        expect(result.success).toBe(true);
        expect(mockPage.pdf).toHaveBeenCalledWith(expect.objectContaining({
          margin
        }));

        vi.clearAllMocks();
        mockPage.pdf.mockResolvedValue(Buffer.from('mock-pdf'));
      }
    });

    it('should handle empty margin object', async () => {
      const params: BrowserParams = {
        operation: 'generatePdf',
        params: { margin: {} }
      };

      const result = await browserTool.execute(params);

      expect(result.success).toBe(true);
      expect(mockPage.pdf).toHaveBeenCalledWith(expect.objectContaining({
        margin: {}
      }));
    });
  });

  describe('Boolean Parameter Validation', () => {
    it('should handle landscape orientation parameter', async () => {
      const booleanValues = [true, false];

      for (const landscape of booleanValues) {
        const params: BrowserParams = {
          operation: 'generatePdf',
          params: { landscape }
        };

        const result = await browserTool.execute(params);

        expect(result.success).toBe(true);
        expect(mockPage.pdf).toHaveBeenCalledWith(expect.objectContaining({
          landscape
        }));

        vi.clearAllMocks();
        mockPage.pdf.mockResolvedValue(Buffer.from('mock-pdf'));
      }
    });

    it('should default boolean parameters to false when not specified', async () => {
      const params: BrowserParams = {
        operation: 'generatePdf',
        params: {}
      };

      const result = await browserTool.execute(params);

      expect(result.success).toBe(true);
      expect(mockPage.pdf).toHaveBeenCalledWith(expect.objectContaining({
        landscape: false,
        printBackground: false,
        displayHeaderFooter: false,
        preferCSSPageSize: false
      }));
    });

    it('should handle printBackground parameter', async () => {
      const params: BrowserParams = {
        operation: 'generatePdf',
        params: { printBackground: true }
      };

      const result = await browserTool.execute(params);

      expect(result.success).toBe(true);
      expect(mockPage.pdf).toHaveBeenCalledWith(expect.objectContaining({
        printBackground: true
      }));
    });

    it('should handle displayHeaderFooter parameter', async () => {
      const params: BrowserParams = {
        operation: 'generatePdf',
        params: { displayHeaderFooter: true }
      };

      const result = await browserTool.execute(params);

      expect(result.success).toBe(true);
      expect(mockPage.pdf).toHaveBeenCalledWith(expect.objectContaining({
        displayHeaderFooter: true
      }));
    });

    it('should handle preferCSSPageSize parameter', async () => {
      const params: BrowserParams = {
        operation: 'generatePdf',
        params: { preferCSSPageSize: true }
      };

      const result = await browserTool.execute(params);

      expect(result.success).toBe(true);
      expect(mockPage.pdf).toHaveBeenCalledWith(expect.objectContaining({
        preferCSSPageSize: true
      }));
    });
  });

  describe('Scale Parameter Validation', () => {
    it('should accept valid scale values', async () => {
      const validScales = [0.1, 0.5, 0.8, 1.0, 1.2, 1.5, 2.0];

      for (const scale of validScales) {
        const params: BrowserParams = {
          operation: 'generatePdf',
          params: { scale }
        };

        const result = await browserTool.execute(params);

        expect(result.success).toBe(true);
        expect(mockPage.pdf).toHaveBeenCalledWith(expect.objectContaining({
          scale
        }));

        vi.clearAllMocks();
        mockPage.pdf.mockResolvedValue(Buffer.from('mock-pdf'));
      }
    });

    it('should default scale to 1 when not specified', async () => {
      const params: BrowserParams = {
        operation: 'generatePdf',
        params: {}
      };

      const result = await browserTool.execute(params);

      expect(result.success).toBe(true);
      expect(mockPage.pdf).toHaveBeenCalledWith(expect.objectContaining({
        scale: 1
      }));
    });
  });

  describe('Page Ranges Parameter Validation', () => {
    it('should accept valid page range strings', async () => {
      const validPageRanges = [
        '1',
        '1-3',
        '1,3,5',
        '1-3,5,8-10',
        '1-',
        '-5',
        '2-4,6-8,10-',
      ];

      for (const pageRanges of validPageRanges) {
        const params: BrowserParams = {
          operation: 'generatePdf',
          params: { pageRanges }
        };

        const result = await browserTool.execute(params);

        expect(result.success).toBe(true);
        expect(mockPage.pdf).toHaveBeenCalledWith(expect.objectContaining({
          pageRanges
        }));

        vi.clearAllMocks();
        mockPage.pdf.mockResolvedValue(Buffer.from('mock-pdf'));
      }
    });

    it('should handle undefined page ranges', async () => {
      const params: BrowserParams = {
        operation: 'generatePdf',
        params: {}
      };

      const result = await browserTool.execute(params);

      expect(result.success).toBe(true);
      expect(mockPage.pdf).toHaveBeenCalledWith(expect.objectContaining({
        pageRanges: undefined
      }));
    });
  });

  describe('Header and Footer Template Validation', () => {
    it('should accept valid HTML templates', async () => {
      const headerTemplate = '<div style="font-size: 10px; text-align: center; width: 100%;">Document Header</div>';
      const footerTemplate = '<div style="font-size: 10px; text-align: center; width: 100%;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>';

      const params: BrowserParams = {
        operation: 'generatePdf',
        params: {
          displayHeaderFooter: true,
          headerTemplate,
          footerTemplate
        }
      };

      const result = await browserTool.execute(params);

      expect(result.success).toBe(true);
      expect(mockPage.pdf).toHaveBeenCalledWith(expect.objectContaining({
        displayHeaderFooter: true,
        headerTemplate,
        footerTemplate
      }));
    });

    it('should handle empty template strings', async () => {
      const params: BrowserParams = {
        operation: 'generatePdf',
        params: {
          displayHeaderFooter: true,
          headerTemplate: '',
          footerTemplate: ''
        }
      };

      const result = await browserTool.execute(params);

      expect(result.success).toBe(true);
      expect(mockPage.pdf).toHaveBeenCalledWith(expect.objectContaining({
        displayHeaderFooter: true,
        headerTemplate: '',
        footerTemplate: ''
      }));
    });

    it('should handle undefined templates when displayHeaderFooter is false', async () => {
      const params: BrowserParams = {
        operation: 'generatePdf',
        params: {
          displayHeaderFooter: false
        }
      };

      const result = await browserTool.execute(params);

      expect(result.success).toBe(true);
      expect(mockPage.pdf).toHaveBeenCalledWith(expect.objectContaining({
        displayHeaderFooter: false,
        headerTemplate: undefined,
        footerTemplate: undefined
      }));
    });
  });

  describe('Path Parameter Validation', () => {
    it('should accept valid file paths', async () => {
      const validPaths = [
        '/tmp/test.pdf',
        './output.pdf',
        '../documents/report.pdf',
        'C:\\Documents\\file.pdf',
        '/Users/test/Desktop/document.pdf'
      ];

      for (const path of validPaths) {
        const params: BrowserParams = {
          operation: 'generatePdf',
          params: { path }
        };

        const result = await browserTool.execute(params);

        expect(result.success).toBe(true);
        expect(mockPage.pdf).toHaveBeenCalledWith(expect.objectContaining({
          path
        }));

        vi.clearAllMocks();
        mockPage.pdf.mockResolvedValue(Buffer.from('mock-pdf'));
      }
    });

    it('should handle undefined path (return base64)', async () => {
      const params: BrowserParams = {
        operation: 'generatePdf',
        params: {}
      };

      const result = await browserTool.execute(params);

      expect(result.success).toBe(true);
      expect(mockPage.pdf).toHaveBeenCalledWith(expect.objectContaining({
        path: undefined
      }));
      expect(result.screenshot).toContain('data:application/pdf;base64,');
    });
  });

  describe('Complex Parameter Combinations', () => {
    it('should handle comprehensive PDF configuration', async () => {
      const complexParams: BrowserGeneratePdfParams = {
        format: 'A4',
        landscape: true,
        printBackground: true,
        scale: 0.8,
        displayHeaderFooter: true,
        headerTemplate: '<div style="font-size: 12px; text-align: center;">Complex Document</div>',
        footerTemplate: '<div style="font-size: 10px; text-align: center;">Page <span class="pageNumber"></span></div>',
        margin: {
          top: '50px',
          bottom: '50px',
          left: '20px',
          right: '20px'
        },
        pageRanges: '1-5,7,9-12',
        preferCSSPageSize: false
      };

      const params: BrowserParams = {
        operation: 'generatePdf',
        params: complexParams
      };

      const result = await browserTool.execute(params);

      expect(result.success).toBe(true);
      expect(mockPage.pdf).toHaveBeenCalledWith(expect.objectContaining(complexParams));
    });

    it('should prioritize custom dimensions over format', async () => {
      const params: BrowserParams = {
        operation: 'generatePdf',
        params: {
          format: 'Letter',
          width: '200mm',
          height: '250mm',
          landscape: false
        }
      };

      const result = await browserTool.execute(params);

      expect(result.success).toBe(true);
      expect(mockPage.pdf).toHaveBeenCalledWith(expect.objectContaining({
        format: 'Letter',
        width: '200mm',
        height: '250mm',
        landscape: false
      }));
    });
  });

  describe('Parameter Type Safety', () => {
    it('should maintain type safety for all PDF parameters', async () => {
      // This test ensures TypeScript compilation passes with correct types
      const typeSafeParams: BrowserGeneratePdfParams = {
        path: './test.pdf',
        format: 'A4',
        width: '210mm',
        height: '297mm',
        margin: {
          top: '20mm',
          bottom: '20mm',
          left: '15mm',
          right: '15mm'
        },
        landscape: false,
        printBackground: true,
        scale: 1.0,
        pageRanges: '1-3',
        preferCSSPageSize: false,
        displayHeaderFooter: true,
        headerTemplate: '<div>Header</div>',
        footerTemplate: '<div>Footer</div>'
      };

      const params: BrowserParams = {
        operation: 'generatePdf',
        params: typeSafeParams
      };

      const result = await browserTool.execute(params);

      expect(result.success).toBe(true);
      expect(typeof result.operation === 'string').toBe(true);
      expect(typeof result.success === 'boolean').toBe(true);
    });
  });
});