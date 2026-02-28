/**
 * Comprehensive integration tests for MultimodalInputHandler
 * Tests end-to-end workflows with real file operations, network requests, and error scenarios
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { writeFile, mkdir, rm, readFile } from 'fs/promises';
import { join } from 'path';
import {
  MultimodalInputHandler,
  MultimodalInputError,
  processImageFile,
  processWebPage,
  processGitHubIssueImages,
  processDesignMockup,
  isFigmaUrl,
  parseFigmaUrl,
  type WebPageOptions
} from '../multimodal-input-handler';
import { DesignMockupError } from '../design-mockup-types';

describe('MultimodalInputHandler - Comprehensive Integration Tests', () => {
  const testDir = '/tmp/multimodal-integration-test';
  let handler: MultimodalInputHandler;

  // Test image data (1x1 transparent PNG)
  const simplePngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77yQAAAABJRU5ErkJggg==';
  const simplePngBuffer = Buffer.from(simplePngBase64, 'base64');

  // Test JPEG data (minimal JPEG)
  const simpleJpegBase64 = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';
  const simpleJpegBuffer = Buffer.from(simpleJpegBase64, 'base64');

  beforeAll(async () => {
    await mkdir(testDir, { recursive: true });
    handler = new MultimodalInputHandler();
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('file operations integration', () => {
    it('should process multiple image file formats in sequence', async () => {
      const pngPath = join(testDir, 'test.png');
      const jpegPath = join(testDir, 'test.jpg');
      const webpPath = join(testDir, 'test.webp');

      // Create test files
      await writeFile(pngPath, simplePngBuffer);
      await writeFile(jpegPath, simpleJpegBuffer);
      // For WebP, we'll use PNG data but with WebP extension (handler should still process it)
      await writeFile(webpPath, simplePngBuffer);

      // Process each file
      const pngResult = await handler.processImageFile(pngPath);
      const jpegResult = await handler.processImageFile(jpegPath);
      const webpResult = await handler.processImageFile(webpPath);

      expect(pngResult.mediaType).toBe('image/png');
      expect(jpegResult.mediaType).toBe('image/jpeg');
      expect(webpResult.mediaType).toBe('image/webp');

      expect(pngResult.fileSizeBytes).toBe(simplePngBuffer.length);
      expect(jpegResult.fileSizeBytes).toBe(simpleJpegBuffer.length);
      expect(webpResult.fileSizeBytes).toBe(simplePngBuffer.length);

      // Verify base64 encoding is correct
      expect(pngResult.imageBlock.source.data).toBe(simplePngBase64);
      expect(jpegResult.imageBlock.source.data).toBe(simpleJpegBase64);
    });

    it('should handle concurrent file processing', async () => {
      const files = await Promise.all([
        (async () => {
          const path = join(testDir, 'concurrent1.png');
          await writeFile(path, simplePngBuffer);
          return path;
        })(),
        (async () => {
          const path = join(testDir, 'concurrent2.jpg');
          await writeFile(path, simpleJpegBuffer);
          return path;
        })(),
        (async () => {
          const path = join(testDir, 'concurrent3.gif');
          await writeFile(path, simplePngBuffer); // Use PNG data with GIF extension
          return path;
        })()
      ]);

      // Process all files concurrently
      const results = await Promise.all(
        files.map(file => handler.processImageFile(file))
      );

      expect(results).toHaveLength(3);
      expect(results[0].mediaType).toBe('image/png');
      expect(results[1].mediaType).toBe('image/jpeg');
      expect(results[2].mediaType).toBe('image/gif');

      // Verify all processed successfully
      results.forEach(result => {
        expect(result.imageBlock.type).toBe('image');
        expect(result.imageBlock.source.type).toBe('base64');
        expect(result.fileSizeBytes).toBeGreaterThan(0);
      });
    });

    it('should handle file system edge cases', async () => {
      // Test permission denied scenario (simulate by creating unreadable file)
      const restrictedPath = join(testDir, 'restricted.png');
      await writeFile(restrictedPath, simplePngBuffer);

      // On some systems, we can't actually make files unreadable to the current user
      // So we'll test with a non-existent file instead
      const nonExistentPath = join(testDir, 'does-not-exist.png');

      await expect(handler.processImageFile(nonExistentPath))
        .rejects
        .toThrow(MultimodalInputError);

      // Test directory instead of file
      const dirPath = join(testDir, 'directory.png');
      await mkdir(dirPath, { recursive: true });

      await expect(handler.processImageFile(dirPath))
        .rejects
        .toThrow(MultimodalInputError);
    });
  });

  describe('convenience function integration', () => {
    it('should work with all convenience functions', async () => {
      const testImagePath = join(testDir, 'convenience-test.png');
      await writeFile(testImagePath, simplePngBuffer);

      // Test processImageFile convenience function
      const imageResult = await processImageFile(testImagePath);
      expect(imageResult.imageBlock.source.media_type).toBe('image/png');

      // Test with custom configuration
      const smallSizeResult = await processImageFile(testImagePath, {
        maxFileSizeBytes: 1024 * 1024 // 1MB limit
      });
      expect(smallSizeResult.fileSizeBytes).toBeLessThan(1024 * 1024);
    });
  });

  describe('Figma URL parsing integration', () => {
    it('should parse various Figma URL formats correctly', () => {
      const testUrls = [
        {
          url: 'https://www.figma.com/file/abc123xyz/Login-Screens',
          expectedType: 'file',
          expectedFileKey: 'abc123xyz',
          expectedFileName: 'Login-Screens'
        },
        {
          url: 'https://figma.com/design/def456uvw/Dashboard-Mockup?node-id=123:456',
          expectedType: 'design',
          expectedFileKey: 'def456uvw',
          expectedFileName: 'Dashboard-Mockup',
          expectedNodeId: '123:456'
        },
        {
          url: 'https://www.figma.com/proto/ghi789rst/Mobile-App?scaling=min-zoom',
          expectedType: 'proto',
          expectedFileKey: 'ghi789rst',
          expectedFileName: 'Mobile-App'
        }
      ];

      testUrls.forEach(({ url, expectedType, expectedFileKey, expectedFileName, expectedNodeId }) => {
        expect(isFigmaUrl(url)).toBe(true);

        const parseResult = parseFigmaUrl(url);
        expect(parseResult.success).toBe(true);
        expect(parseResult.info!.urlType).toBe(expectedType);
        expect(parseResult.info!.fileKey).toBe(expectedFileKey);
        expect(parseResult.info!.fileName).toBe(expectedFileName);

        if (expectedNodeId) {
          expect(parseResult.info!.nodeId).toBe(expectedNodeId);
        }
      });
    });

    it('should handle invalid Figma URLs correctly', () => {
      const invalidUrls = [
        'https://sketch.com/file/123',
        'https://example.com/image.png',
        'not-a-url-at-all',
        'https://figma.com/invalid'
      ];

      invalidUrls.forEach(url => {
        expect(isFigmaUrl(url)).toBe(false);

        if (url.includes('figma.com')) {
          const parseResult = parseFigmaUrl(url);
          expect(parseResult.success).toBe(false);
          expect(parseResult.error).toBeDefined();
        }
      });
    });
  });

  describe('GitHub issue image extraction', () => {
    it('should extract GitHub images from various markdown formats', async () => {
      const issueContent = `
        # Bug Report

        Here's a screenshot of the issue:
        ![Screenshot](https://user-images.githubusercontent.com/123456/78901234-1234abcd-5678-90ef-1234-567890abcdef.png)

        And here's another image:
        <img src="https://user-images.githubusercontent.com/789012/34567890-abcd1234-5678-90ef-1234-567890abcdef.jpg" alt="Error" />

        Also this raw GitHub image:
        https://raw.githubusercontent.com/user/repo/main/screenshot.png
      `;

      // Mock the WebFetch responses
      const mockWebFetch = vi.fn();
      (handler as any).webFetchTool.execute = mockWebFetch;

      mockWebFetch.mockResolvedValue({
        success: true,
        data: simplePngBuffer,
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: false,
        metadata: { responseTime: 100 }
      });

      const result = await handler.processGitHubIssueImages(issueContent);

      expect(result.imageUrls).toHaveLength(3);
      expect(result.imageUrls[0]).toContain('user-images.githubusercontent.com');
      expect(result.imageUrls[1]).toContain('user-images.githubusercontent.com');
      expect(result.imageUrls[2]).toContain('raw.githubusercontent.com');

      expect(result.imageBlocks).toHaveLength(3);
      expect(result.totalProcessingTime).toBeGreaterThan(0);
    });

    it('should handle GitHub issues with no images', async () => {
      const issueContentNoImages = `
        # Feature Request

        This is just text content with no images.

        Some code:
        \`\`\`javascript
        console.log('hello world');
        \`\`\`
      `;

      const result = await handler.processGitHubIssueImages(issueContentNoImages);

      expect(result.imageUrls).toEqual([]);
      expect(result.imageBlocks).toEqual([]);
      expect(result.totalProcessingTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('error handling and recovery', () => {
    it('should provide detailed error information for various failure modes', async () => {
      // Test file size limit
      const largePath = join(testDir, 'large-file.png');
      const largeBuffer = Buffer.alloc(25 * 1024 * 1024); // 25MB, exceeds default 20MB limit
      await writeFile(largePath, largeBuffer);

      try {
        await handler.processImageFile(largePath);
        expect.fail('Should have thrown error for large file');
      } catch (error) {
        expect(error).toBeInstanceOf(MultimodalInputError);
        expect((error as MultimodalInputError).code).toBe('FILE_TOO_LARGE');
        expect(error.message).toContain('25165824');
        expect(error.message).toContain('20971520');
      }

      // Test unsupported format
      const unsupportedPath = join(testDir, 'test.bmp');
      await writeFile(unsupportedPath, Buffer.from('fake-bmp-data'));

      try {
        await handler.processImageFile(unsupportedPath);
        expect.fail('Should have thrown error for unsupported format');
      } catch (error) {
        expect(error).toBeInstanceOf(MultimodalInputError);
        expect((error as MultimodalInputError).code).toBe('UNSUPPORTED_FORMAT');
        expect(error.message).toContain('.bmp');
      }
    });

    it('should handle partial failures gracefully in batch processing', async () => {
      const inputs = [
        {
          type: 'image',
          mediaType: 'image/png',
          data: Buffer.from('valid-image').toString('base64')
        },
        {
          type: 'image',
          mediaType: 'image/jpeg',
          data: 'invalid-base64-data!!!'
        }
      ];

      // The second input should fail, but this tests error propagation
      await expect(handler.processInputs(inputs))
        .rejects
        .toThrow('Invalid image data: malformed base64');
    });
  });

  describe('performance and scalability', () => {
    it('should handle multiple large images efficiently', async () => {
      const largeImagePaths: string[] = [];

      // Create multiple reasonably sized images (not too large to avoid test timeouts)
      for (let i = 0; i < 5; i++) {
        const path = join(testDir, `large-${i}.png`);
        const largeBuffer = Buffer.alloc(512 * 1024); // 512KB each
        largeBuffer.fill(i); // Fill with different data
        await writeFile(path, largeBuffer);
        largeImagePaths.push(path);
      }

      const startTime = Date.now();
      const results = await Promise.all(
        largeImagePaths.map(path => handler.processImageFile(path))
      );
      const processingTime = Date.now() - startTime;

      expect(results).toHaveLength(5);
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds

      results.forEach((result, index) => {
        expect(result.fileSizeBytes).toBe(512 * 1024);
        expect(result.imageBlock.source.data).toBeDefined();
        expect(result.imageBlock.source.data.length).toBeGreaterThan(0);
      });
    });
  });

  describe('configuration validation', () => {
    it('should apply custom configurations correctly', async () => {
      const customHandler = new MultimodalInputHandler({
        maxFileSizeBytes: 1024, // 1KB limit
        supportedFormats: ['png'] // Only PNG
      });

      const testPath = join(testDir, 'config-test.png');
      await writeFile(testPath, simplePngBuffer);

      // Should work with PNG
      const result = await customHandler.processImageFile(testPath);
      expect(result.mediaType).toBe('image/png');

      // Should fail with JPEG due to restricted formats
      const jpegPath = join(testDir, 'config-test.jpg');
      await writeFile(jpegPath, simpleJpegBuffer);

      await expect(customHandler.processImageFile(jpegPath))
        .rejects
        .toThrow('FORMAT_NOT_CONFIGURED');

      // Should fail with oversized file
      const largePath = join(testDir, 'config-large.png');
      const largeBuffer = Buffer.alloc(2048); // 2KB, exceeds 1KB limit
      await writeFile(largePath, largeBuffer);

      await expect(customHandler.processImageFile(largePath))
        .rejects
        .toThrow('FILE_TOO_LARGE');
    });
  });

  describe('utility functions', () => {
    it('should provide accurate format detection', () => {
      expect(handler.isSupportedFormat('image.png')).toBe(true);
      expect(handler.isSupportedFormat('image.PNG')).toBe(true);
      expect(handler.isSupportedFormat('image.jpg')).toBe(true);
      expect(handler.isSupportedFormat('image.jpeg')).toBe(true);
      expect(handler.isSupportedFormat('image.gif')).toBe(true);
      expect(handler.isSupportedFormat('image.webp')).toBe(true);
      expect(handler.isSupportedFormat('image.svg')).toBe(true);
      expect(handler.isSupportedFormat('document.pdf')).toBe(true);

      expect(handler.isSupportedFormat('document.txt')).toBe(false);
      expect(handler.isSupportedFormat('image.bmp')).toBe(false);
      expect(handler.isSupportedFormat('image.tiff')).toBe(false);
    });

    it('should return correct supported media types', () => {
      const mediaTypes = handler.getSupportedMediaTypes();
      expect(mediaTypes).toContain('image/png');
      expect(mediaTypes).toContain('image/jpeg');
      expect(mediaTypes).toContain('image/gif');
      expect(mediaTypes).toContain('image/webp');
    });
  });
});