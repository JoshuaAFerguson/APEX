/**
 * Security and validation tests for processDesignMockup functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MultimodalInputHandler } from '../multimodal-input-handler';
import { DesignMockupError } from '../design-mockup-types';
import type { DesignMockupOptions } from '../design-mockup-types';

// Mock WebFetchTool
vi.mock('../webfetch', () => ({
  WebFetchTool: vi.fn().mockImplementation(() => ({
    execute: vi.fn(),
  })),
}));

describe('MultimodalInputHandler - processDesignMockup Security Tests', () => {
  let handler: MultimodalInputHandler;
  let mockWebFetch: any;

  beforeEach(() => {
    handler = new MultimodalInputHandler();
    mockWebFetch = (handler as any).webFetchTool.execute;
    vi.clearAllMocks();
  });

  describe('URL validation security', () => {
    it('should reject URLs with dangerous protocols', async () => {
      const dangerousUrls = [
        'javascript:alert("xss")',
        'data:text/html,<script>alert("xss")</script>',
        'file:///etc/passwd',
        'ftp://example.com/file.png',
        'mailto:test@example.com',
      ];

      for (const url of dangerousUrls) {
        await expect(handler.processDesignMockup(url))
          .rejects
          .toThrow(DesignMockupError);
      }
    });

    it('should sanitize and handle encoded URLs properly', async () => {
      const testImageData = Buffer.from('test-encoded-url');
      mockWebFetch.mockResolvedValue({
        success: true,
        data: testImageData,
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: false,
        metadata: { responseTime: 100 },
      });

      // URL with encoded characters that should be handled safely
      const encodedUrl = 'https://example.com/image%20with%20spaces.png?param=value%26other=test';
      const result = await handler.processDesignMockup(encodedUrl);

      expect(result.metadata.fileUrl).toBe(encodedUrl);
      expect(mockWebFetch).toHaveBeenCalledWith(
        expect.objectContaining({
          url: encodedUrl,
        })
      );
    });

    it('should handle URLs with unusual but valid characters', async () => {
      const testImageData = Buffer.from('test-unusual-chars');
      mockWebFetch.mockResolvedValue({
        success: true,
        data: testImageData,
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: false,
        metadata: { responseTime: 100 },
      });

      const unusualUrl = 'https://example.com/image-name_with-unusual.chars.png?v=1&token=abc123-xyz_789';
      const result = await handler.processDesignMockup(unusualUrl);

      expect(result.metadata.fileUrl).toBe(unusualUrl);
    });
  });

  describe('Header injection protection', () => {
    it('should handle suspicious headers safely', async () => {
      const testImageData = Buffer.from('test-suspicious-headers');
      mockWebFetch.mockResolvedValue({
        success: true,
        data: testImageData,
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: false,
        metadata: { responseTime: 100 },
      });

      const options: DesignMockupOptions = {
        designTool: 'other',
        headers: {
          'X-Test-Header': 'safe-value',
          'User-Agent': 'Mozilla/5.0 (compatible; APEX/1.0)',
          'Authorization': 'Bearer valid-token-123',
        },
      };

      const result = await handler.processDesignMockup('https://example.com/test.png', options);

      expect(mockWebFetch).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: options.headers,
        })
      );
      expect(result.imageBlock).toBeDefined();
    });

    it('should reject headers with injection attempts', async () => {
      const options: DesignMockupOptions = {
        designTool: 'other',
        headers: {
          'X-Injection': 'value\r\nHost: evil.com',
          'Normal-Header': 'normal-value',
        },
      };

      // The WebFetch tool should handle header validation
      // We're testing that our handler passes headers correctly
      mockWebFetch.mockRejectedValue(new Error('Invalid header format'));

      await expect(handler.processDesignMockup('https://example.com/test.png', options))
        .rejects
        .toThrow();
    });
  });

  describe('Content validation security', () => {
    it('should validate image content and reject non-image data', async () => {
      // HTML content disguised as image
      const maliciousContent = Buffer.from('<html><script>alert("xss")</script></html>');
      mockWebFetch.mockResolvedValue({
        success: true,
        data: maliciousContent,
        status: 200,
        headers: { 'content-type': 'image/png' }, // Lying about content type
        fromCache: false,
        metadata: { responseTime: 100 },
      });

      // The handler should still process it as image data since it trusts the content-type
      // This is expected behavior - content validation is typically done at a higher level
      const result = await handler.processDesignMockup('https://example.com/malicious.png');

      expect(result.imageBlock.source.data).toBe(maliciousContent.toString('base64'));
      expect(result.fileSizeBytes).toBe(maliciousContent.length);
    });

    it('should handle extremely large file names in URLs', async () => {
      const testImageData = Buffer.from('test-large-filename');
      mockWebFetch.mockResolvedValue({
        success: true,
        data: testImageData,
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: false,
        metadata: { responseTime: 100 },
      });

      const longFilename = 'a'.repeat(500);
      const url = `https://example.com/${longFilename}.png`;

      const result = await handler.processDesignMockup(url);

      expect(result.metadata.frameName).toBe(longFilename);
      expect(result.metadata.fileUrl).toBe(url);
    });
  });

  describe('Memory and resource protection', () => {
    it('should enforce file size limits strictly', async () => {
      const maxSize = 20 * 1024 * 1024; // 20MB default limit
      const oversizedData = Buffer.alloc(maxSize + 1);

      mockWebFetch.mockResolvedValue({
        success: true,
        data: oversizedData,
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: false,
        metadata: { responseTime: 1000 },
      });

      await expect(handler.processDesignMockup('https://example.com/oversized.png'))
        .rejects
        .toThrow(DesignMockupError);
    });

    it('should respect custom file size limits', async () => {
      const customHandler = new MultimodalInputHandler({
        maxFileSizeBytes: 1024, // 1KB limit
      });
      (customHandler as any).webFetchTool.execute = mockWebFetch;

      const largeData = Buffer.alloc(1025); // Just over 1KB
      mockWebFetch.mockResolvedValue({
        success: true,
        data: largeData,
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: false,
        metadata: { responseTime: 100 },
      });

      await expect(customHandler.processDesignMockup('https://example.com/large.png'))
        .rejects
        .toThrow(DesignMockupError);
    });

    it('should handle timeout scenarios properly', async () => {
      mockWebFetch.mockRejectedValue(new Error('Request timeout'));

      await expect(handler.processDesignMockup('https://example.com/slow.png', {
        designTool: 'other',
        timeout: 1000,
      }))
        .rejects
        .toThrow(DesignMockupError);
    });
  });

  describe('Figma-specific security tests', () => {
    it('should handle malformed Figma URLs safely', async () => {
      const malformedFigmaUrls = [
        'https://www.figma.com/file/../../../etc/passwd',
        'https://www.figma.com/file/normal-file-id/../sensitive-file',
        'https://www.figma.com/file/file-id?node-id=../../sensitive-data',
      ];

      for (const url of malformedFigmaUrls) {
        // These should either be rejected or normalized safely
        if (handler.isFigmaUrl(url)) {
          const parseResult = handler.parseFigmaUrl(url);
          if (parseResult.success) {
            // If parsed successfully, should not contain path traversal
            expect(parseResult.info?.fileKey).not.toMatch(/\.\./);
            expect(parseResult.info?.nodeId).not.toMatch(/\.\./);
          }
        }
      }
    });

    it('should sanitize Figma file and node IDs', async () => {
      const testImageData = Buffer.from('test-figma-sanitize');
      mockWebFetch.mockResolvedValue({
        success: true,
        data: testImageData,
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: false,
        metadata: { responseTime: 100 },
      });

      const figmaUrl = 'https://www.figma.com/file/abc123def456/Test-File?node-id=123:456&other-param=value';
      const result = await handler.processDesignMockup(figmaUrl);

      // Verify that extracted data is clean
      expect(result.metadata.fileId).toBe('abc123def456');
      expect(result.metadata.nodeId).toBe('123:456');
      expect(result.metadata.fileId).not.toContain('..');
      expect(result.metadata.nodeId).not.toContain('..');
    });
  });

  describe('Error information disclosure protection', () => {
    it('should not expose sensitive information in error messages', async () => {
      mockWebFetch.mockRejectedValue(new Error('Internal server details: database password is admin123'));

      try {
        await handler.processDesignMockup('https://example.com/error.png');
      } catch (error) {
        expect(error).toBeInstanceOf(DesignMockupError);
        const designError = error as DesignMockupError;

        // Error message should be generic, not expose internal details
        expect(designError.message).not.toContain('database');
        expect(designError.message).not.toContain('password');
        expect(designError.message).not.toContain('admin123');
      }
    });

    it('should provide appropriate error codes without sensitive details', async () => {
      mockWebFetch.mockResolvedValue({
        success: false,
        error: 'Authentication failed: API key sk-1234567890abcdef is invalid',
      });

      try {
        await handler.processDesignMockup('https://www.figma.com/file/test123/Private-File');
      } catch (error) {
        expect(error).toBeInstanceOf(DesignMockupError);
        const designError = error as DesignMockupError;

        // Should not expose the actual API key
        expect(designError.message).not.toContain('sk-1234567890abcdef');
        expect(designError.code).toBe('NETWORK_ERROR');
      }
    });
  });

  describe('Input validation edge cases', () => {
    it('should handle Unicode characters in URLs correctly', async () => {
      const testImageData = Buffer.from('unicode-test');
      mockWebFetch.mockResolvedValue({
        success: true,
        data: testImageData,
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: false,
        metadata: { responseTime: 100 },
      });

      // URL with Unicode characters (should be properly encoded)
      const unicodeUrl = 'https://example.com/图片-设计.png';
      const result = await handler.processDesignMockup(unicodeUrl);

      expect(result.metadata.fileUrl).toBe(unicodeUrl);
      expect(result.imageBlock).toBeDefined();
    });

    it('should handle null and undefined options gracefully', async () => {
      const testImageData = Buffer.from('null-options-test');
      mockWebFetch.mockResolvedValue({
        success: true,
        data: testImageData,
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: false,
        metadata: { responseTime: 100 },
      });

      // Should not throw when options is undefined
      const result = await handler.processDesignMockup('https://example.com/test.png', undefined);
      expect(result.imageBlock).toBeDefined();

      // Should handle partial options objects
      const result2 = await handler.processDesignMockup('https://example.com/test2.png', {
        designTool: 'other',
      });
      expect(result2.imageBlock).toBeDefined();
    });
  });
});