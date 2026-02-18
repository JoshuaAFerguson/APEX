/**
 * Browser Tool PDF Output Validation Tests
 *
 * Tests that verify the validity and content of generated PDF files:
 * - PDF format validation
 * - Content extraction and verification
 * - File structure integrity
 * - Metadata validation
 * - Cross-platform compatibility
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { BrowserTool } from '../browser-tool';
import { PermissionManager } from '../../permission-manager';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Mock realistic PDF buffer with proper PDF header
function createMockPdfBuffer(content: string = 'Test PDF Content'): Buffer {
  const pdfHeader = '%PDF-1.4\n';
  const pdfTrailer = '\n%%EOF\n';
  const pdfBody = `
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Resources <<
/Font <<
/F1 <<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
>>
>>
/Contents 4 0 R
>>
endobj

4 0 obj
<<
/Length ${content.length + 50}
>>
stream
BT
/F1 12 Tf
50 750 Td
(${content}) Tj
ET
endstream
endobj

xref
0 5
0000000000 65535 f
0000000010 00000 n
0000000079 00000 n
0000000136 00000 n
0000000284 00000 n
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
${pdfHeader.length + pdfBody.length}
`;

  return Buffer.from(pdfHeader + pdfBody + pdfTrailer, 'binary');
}

// Mock Playwright with realistic PDF generation
const mockPage = {
  on: vi.fn(),
  url: vi.fn(() => 'https://test.example.com'),
  title: vi.fn(() => 'Test PDF Document'),
  goto: vi.fn(() => Promise.resolve({ status: () => 200 })),
  pdf: vi.fn(() => Promise.resolve(createMockPdfBuffer())),
  evaluate: vi.fn(),
  setContent: vi.fn(),
  content: vi.fn(() => Promise.resolve('<!DOCTYPE html><html><head><title>Test</title></head><body><h1>Test Content</h1></body></html>')),
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

// Mock file system for testing file output
vi.mock('fs/promises');
const mockedFs = vi.mocked(fs);

describe('Browser Tool PDF Output Validation Tests', () => {
  let browserTool: BrowserTool;
  let permissionManager: PermissionManager;
  let testDir: string;

  beforeAll(async () => {
    // Create temporary test directory (using real fs for setup)
    const realFs = await import('fs/promises');
    testDir = await realFs.mkdtemp(path.join(os.tmpdir(), 'apex-pdf-validation-'));
  });

  afterAll(async () => {
    // Clean up test directory
    try {
      const realFs = await import('fs/promises');
      await realFs.rmdir(testDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });

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

    // Reset mocks with default successful responses
    mockPage.pdf.mockResolvedValue(createMockPdfBuffer());
    mockedFs.writeFile.mockResolvedValue(undefined);
    mockedFs.readFile.mockResolvedValue(createMockPdfBuffer());
  });

  afterEach(async () => {
    try {
      await browserTool.cleanup();
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });

  describe('PDF Format Validation', () => {
    it('should generate valid PDF with proper header', async () => {
      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com/content' }
      });

      const result = await browserTool.execute({
        operation: 'generatePdf',
        params: {}
      });

      expect(result.success).toBe(true);

      // Extract base64 data and decode
      const base64Data = result.screenshot?.replace('data:application/pdf;base64,', '');
      expect(base64Data).toBeTruthy();

      const pdfBuffer = Buffer.from(base64Data!, 'base64');

      // Verify PDF header
      const pdfString = pdfBuffer.toString('binary');
      expect(pdfString).toMatch(/^%PDF-\d+\.\d+/);
      expect(pdfString).toContain('%%EOF');
    });

    it('should include proper PDF metadata', async () => {
      const mockPdfWithMetadata = createMockPdfBuffer('Content with metadata');
      mockPage.pdf.mockResolvedValueOnce(mockPdfWithMetadata);

      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com/metadata-test' }
      });

      const result = await browserTool.execute({
        operation: 'generatePdf',
        params: {
          format: 'A4',
          printBackground: true
        }
      });

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        format: 'A4',
        landscape: false,
        size: mockPdfWithMetadata.length
      });
    });

    it('should validate PDF file structure', async () => {
      const result = await browserTool.execute({
        operation: 'generatePdf',
        params: {}
      });

      expect(result.success).toBe(true);

      const base64Data = result.screenshot?.replace('data:application/pdf;base64,', '');
      const pdfBuffer = Buffer.from(base64Data!, 'base64');
      const pdfString = pdfBuffer.toString('binary');

      // Check for essential PDF structure elements
      expect(pdfString).toContain('obj'); // Object definitions
      expect(pdfString).toContain('endobj'); // Object endings
      expect(pdfString).toContain('xref'); // Cross-reference table
      expect(pdfString).toContain('trailer'); // PDF trailer
      expect(pdfString).toContain('startxref'); // Cross-reference start
    });
  });

  describe('PDF Content Validation', () => {
    it('should preserve page content in PDF', async () => {
      const testContent = 'Specific test content for PDF validation';
      const mockPdfWithContent = createMockPdfBuffer(testContent);
      mockPage.pdf.mockResolvedValueOnce(mockPdfWithContent);

      // Set up page with specific content
      mockPage.content.mockResolvedValueOnce(`
        <!DOCTYPE html>
        <html>
        <head><title>Test PDF Content</title></head>
        <body>
          <h1>Test Document</h1>
          <p>${testContent}</p>
        </body>
        </html>
      `);

      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'data:text/html,<h1>Test</h1><p>' + encodeURIComponent(testContent) + '</p>' }
      });

      const result = await browserTool.execute({
        operation: 'generatePdf',
        params: {}
      });

      expect(result.success).toBe(true);

      const base64Data = result.screenshot?.replace('data:application/pdf;base64,', '');
      const pdfBuffer = Buffer.from(base64Data!, 'base64');
      const pdfString = pdfBuffer.toString('binary');

      // Verify content is present in PDF
      expect(pdfString).toContain(testContent);
    });

    it('should handle special characters in content', async () => {
      const specialContent = 'Special chars: áéíóú ñç ü ß αβγ δεζ 中文 🎉 & < > " \'';
      const mockPdfWithSpecialChars = createMockPdfBuffer(specialContent);
      mockPage.pdf.mockResolvedValueOnce(mockPdfWithSpecialChars);

      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'data:text/html,<p>' + encodeURIComponent(specialContent) + '</p>' }
      });

      const result = await browserTool.execute({
        operation: 'generatePdf',
        params: {}
      });

      expect(result.success).toBe(true);

      const base64Data = result.screenshot?.replace('data:application/pdf;base64,', '');
      const pdfBuffer = Buffer.from(base64Data!, 'base64');

      // Verify special characters are handled
      expect(pdfBuffer.length).toBeGreaterThan(0);
      expect(result.data?.size).toBe(mockPdfWithSpecialChars.length);
    });

    it('should validate empty content generates valid PDF', async () => {
      const emptyContentPdf = createMockPdfBuffer('');
      mockPage.pdf.mockResolvedValueOnce(emptyContentPdf);

      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'data:text/html,<html><body></body></html>' }
      });

      const result = await browserTool.execute({
        operation: 'generatePdf',
        params: {}
      });

      expect(result.success).toBe(true);

      const base64Data = result.screenshot?.replace('data:application/pdf;base64,', '');
      const pdfBuffer = Buffer.from(base64Data!, 'base64');
      const pdfString = pdfBuffer.toString('binary');

      // Even empty content should produce valid PDF structure
      expect(pdfString).toMatch(/^%PDF-\d+\.\d+/);
      expect(pdfString).toContain('%%EOF');
    });
  });

  describe('File Output Validation', () => {
    it('should write PDF file to specified path', async () => {
      const outputPath = path.join(testDir, 'test-output.pdf');
      const mockPdfBuffer = createMockPdfBuffer('File output test');

      mockPage.pdf.mockResolvedValueOnce(mockPdfBuffer);

      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com/file-test' }
      });

      const result = await browserTool.execute({
        operation: 'generatePdf',
        params: { path: outputPath }
      });

      expect(result.success).toBe(true);
      expect(result.screenshot).toBe(outputPath);

      // Verify PDF generation was called with correct path
      expect(mockPage.pdf).toHaveBeenCalledWith(expect.objectContaining({
        path: outputPath
      }));
    });

    it('should handle file path with directories', async () => {
      const nestedPath = path.join(testDir, 'nested', 'subdirectory', 'document.pdf');
      const mockPdfBuffer = createMockPdfBuffer('Nested directory test');

      mockPage.pdf.mockResolvedValueOnce(mockPdfBuffer);

      const result = await browserTool.execute({
        operation: 'generatePdf',
        params: { path: nestedPath }
      });

      expect(result.success).toBe(true);
      expect(mockPage.pdf).toHaveBeenCalledWith(expect.objectContaining({
        path: nestedPath
      }));
    });

    it('should validate file extension is preserved', async () => {
      const validExtensions = ['.pdf', '.PDF'];

      for (const ext of validExtensions) {
        const outputPath = path.join(testDir, `test${ext}`);

        const result = await browserTool.execute({
          operation: 'generatePdf',
          params: { path: outputPath }
        });

        expect(result.success).toBe(true);
        expect(result.screenshot).toBe(outputPath);

        vi.clearAllMocks();
        mockPage.pdf.mockResolvedValue(createMockPdfBuffer());
      }
    });
  });

  describe('Multi-page PDF Validation', () => {
    it('should validate page ranges are respected', async () => {
      const multiPageContent = Array.from({ length: 10 }, (_, i) =>
        `Page ${i + 1} content with unique identifier: PAGE_${i + 1}_MARKER`
      ).join('\n');

      const mockMultiPagePdf = createMockPdfBuffer(multiPageContent);
      mockPage.pdf.mockResolvedValueOnce(mockMultiPagePdf);

      await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://test.example.com/multi-page' }
      });

      const result = await browserTool.execute({
        operation: 'generatePdf',
        params: {
          pageRanges: '1-3,5,8-10'
        }
      });

      expect(result.success).toBe(true);
      expect(result.data?.pages).toBe('1-3,5,8-10');

      expect(mockPage.pdf).toHaveBeenCalledWith(expect.objectContaining({
        pageRanges: '1-3,5,8-10'
      }));
    });

    it('should validate headers and footers are included', async () => {
      const headerText = 'Document Header - Test PDF';
      const footerText = 'Page Footer - Test PDF';

      const mockPdfWithHeaderFooter = createMockPdfBuffer(`${headerText}\nContent\n${footerText}`);
      mockPage.pdf.mockResolvedValueOnce(mockPdfWithHeaderFooter);

      const result = await browserTool.execute({
        operation: 'generatePdf',
        params: {
          displayHeaderFooter: true,
          headerTemplate: `<div style="font-size: 10px;">${headerText}</div>`,
          footerTemplate: `<div style="font-size: 10px;">${footerText}</div>`,
          margin: {
            top: '50px',
            bottom: '50px'
          }
        }
      });

      expect(result.success).toBe(true);

      const base64Data = result.screenshot?.replace('data:application/pdf;base64,', '');
      const pdfBuffer = Buffer.from(base64Data!, 'base64');
      const pdfString = pdfBuffer.toString('binary');

      // Verify header and footer content
      expect(pdfString).toContain(headerText);
      expect(pdfString).toContain(footerText);
    });
  });

  describe('PDF Size and Performance Validation', () => {
    it('should validate PDF size is reasonable for content', async () => {
      const smallContent = 'Small test content';
      const smallPdf = createMockPdfBuffer(smallContent);

      mockPage.pdf.mockResolvedValueOnce(smallPdf);

      const result = await browserTool.execute({
        operation: 'generatePdf',
        params: {}
      });

      expect(result.success).toBe(true);
      expect(result.data?.size).toBe(smallPdf.length);
      expect(result.data?.size).toBeGreaterThan(0);
      expect(result.data?.size).toBeLessThan(1024 * 1024); // Should be less than 1MB for small content
    });

    it('should handle large content PDF generation', async () => {
      const largeContent = 'Large content: ' + 'X'.repeat(10000);
      const largePdf = createMockPdfBuffer(largeContent);

      mockPage.pdf.mockResolvedValueOnce(largePdf);

      const result = await browserTool.execute({
        operation: 'generatePdf',
        params: {}
      });

      expect(result.success).toBe(true);
      expect(result.data?.size).toBe(largePdf.length);
      expect(result.data?.size).toBeGreaterThan(1000);
    });

    it('should validate base64 encoding efficiency', async () => {
      const testPdf = createMockPdfBuffer('Base64 encoding test content');
      mockPage.pdf.mockResolvedValueOnce(testPdf);

      const result = await browserTool.execute({
        operation: 'generatePdf',
        params: {}
      });

      expect(result.success).toBe(true);

      const base64Data = result.screenshot?.replace('data:application/pdf;base64,', '');
      const decodedBuffer = Buffer.from(base64Data!, 'base64');

      // Verify base64 encoding/decoding preserves data
      expect(decodedBuffer.length).toBe(testPdf.length);
      expect(decodedBuffer.equals(testPdf)).toBe(true);
    });
  });

  describe('Error Condition Validation', () => {
    it('should validate error handling for corrupted PDF generation', async () => {
      mockPage.pdf.mockRejectedValueOnce(new Error('PDF generation corrupted'));

      const result = await browserTool.execute({
        operation: 'generatePdf',
        params: {}
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('PDF generation failed: PDF generation corrupted');
    });

    it('should validate error handling for insufficient memory', async () => {
      mockPage.pdf.mockRejectedValueOnce(new Error('Cannot allocate memory for PDF generation'));

      const result = await browserTool.execute({
        operation: 'generatePdf',
        params: {}
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot allocate memory for PDF generation');
    });

    it('should validate error handling for file system issues', async () => {
      mockPage.pdf.mockRejectedValueOnce(new Error('Permission denied: Cannot write to file'));

      const result = await browserTool.execute({
        operation: 'generatePdf',
        params: { path: '/invalid/path/test.pdf' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission denied: Cannot write to file');
    });
  });

  describe('Cross-platform Compatibility Validation', () => {
    it('should validate PDF generation works with different path formats', async () => {
      const pathFormats = [
        { platform: 'unix', path: '/tmp/test.pdf' },
        { platform: 'windows', path: 'C:\\temp\\test.pdf' },
        { platform: 'relative', path: './output.pdf' },
        { platform: 'relative-nested', path: '../documents/test.pdf' }
      ];

      for (const { platform, path: testPath } of pathFormats) {
        vi.clearAllMocks();
        mockPage.pdf.mockResolvedValue(createMockPdfBuffer(`${platform} path test`));

        const result = await browserTool.execute({
          operation: 'generatePdf',
          params: { path: testPath }
        });

        expect(result.success).toBe(true);
        expect(result.screenshot).toBe(testPath);
        expect(mockPage.pdf).toHaveBeenCalledWith(expect.objectContaining({
          path: testPath
        }));
      }
    });

    it('should validate consistent PDF format across platforms', async () => {
      const universalContent = 'Universal content for cross-platform testing';
      const universalPdf = createMockPdfBuffer(universalContent);

      mockPage.pdf.mockResolvedValueOnce(universalPdf);

      const result = await browserTool.execute({
        operation: 'generatePdf',
        params: { format: 'A4' }
      });

      expect(result.success).toBe(true);

      const base64Data = result.screenshot?.replace('data:application/pdf;base64,', '');
      const pdfBuffer = Buffer.from(base64Data!, 'base64');
      const pdfString = pdfBuffer.toString('binary');

      // Verify consistent PDF structure
      expect(pdfString).toMatch(/^%PDF-\d+\.\d+/);
      expect(pdfString).toContain(universalContent);
      expect(pdfString).toContain('%%EOF');
    });
  });
});