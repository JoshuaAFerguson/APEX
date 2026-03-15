/**
 * Integration test for local file processing in processDesignMockup method
 *
 * This test suite provides focused integration tests for the key functionality
 * of processing local design mockups, ensuring compatibility with the existing
 * test framework and verifying the core use cases work as expected.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { MultimodalInputHandler } from '../multimodal-input-handler';
import { DesignMockupError } from '../design-mockup-types';

describe('Design Mockup Local Integration', () => {
  let handler: MultimodalInputHandler;
  let tempDir: string;
  let samplePngPath: string;
  let sampleJpegPath: string;

  beforeAll(async () => {
    handler = new MultimodalInputHandler();
    tempDir = await fs.mkdtemp(join(tmpdir(), 'apex-local-integration-'));

    // Create minimal valid PNG
    const pngData = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x01, 0x00, 0x00, 0x00, 0x00, 0x37, 0x6E, 0xF9, 0x24,
      0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, 0x54,
      0x78, 0x9C, 0x62, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01,
      0xE2, 0x21, 0xBC, 0x33,
      0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44,
      0xAE, 0x42, 0x60, 0x82
    ]);

    // Create minimal valid JPEG
    const jpegData = Buffer.from([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46,
      0x00, 0x01, 0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00,
      0xFF, 0xC0, 0x00, 0x11, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01,
      0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
      0xFF, 0xDA, 0x00, 0x0C, 0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00, 0x3F, 0x00,
      0x00, 0xFF, 0xD9
    ]);

    samplePngPath = join(tempDir, 'MockupScreen_Mobile@2x.png');
    sampleJpegPath = join(tempDir, 'Dashboard_v1.2.jpg');

    await fs.writeFile(samplePngPath, pngData);
    await fs.writeFile(sampleJpegPath, jpegData);
  });

  afterAll(async () => {
    try {
      await fs.unlink(samplePngPath);
      await fs.unlink(sampleJpegPath);
      await fs.rmdir(tempDir);
    } catch (error) {
      console.warn('Cleanup failed:', error);
    }
  });

  describe('Core functionality', () => {
    it('should process PNG files with metadata extraction', async () => {
      const result = await handler.processDesignMockup(samplePngPath);

      // Verify result structure matches expected interface
      expect(result).toHaveProperty('imageBlock');
      expect(result).toHaveProperty('designTool');
      expect(result).toHaveProperty('metadata');
      expect(result).toHaveProperty('exportFormat');
      expect(result).toHaveProperty('exportScale');

      // Check specific values
      expect(result.exportFormat).toBe('png');
      expect(result.imageBlock.source.media_type).toBe('image/png');
      expect(result.exportScale).toBe(2); // From @2x in filename

      // Check metadata extraction
      expect(result.metadata.fileName).toBe('MockupScreen_Mobile@2x.png');
      expect(result.metadata.scaleFactor).toBe(2);
      expect(result.metadata.platformName).toBe('mobile');
      expect(result.metadata.frameName).toBe('MockupScreen');
    });

    it('should process JPEG files with version extraction', async () => {
      const result = await handler.processDesignMockup(sampleJpegPath);

      expect(result.exportFormat).toBe('jpeg');
      expect(result.imageBlock.source.media_type).toBe('image/jpeg');

      // Check version extraction
      expect(result.metadata.version).toBe('1.2');
      expect(result.metadata.frameName).toBe('Dashboard');
    });

    it('should handle non-existent files appropriately', async () => {
      const nonExistentPath = join(tempDir, 'does-not-exist.png');

      await expect(handler.processDesignMockup(nonExistentPath))
        .rejects
        .toThrow(DesignMockupError);
    });

    it('should correctly distinguish local paths from URLs', () => {
      // The handler should identify these as local paths
      expect((handler as any).isLocalFilePath(samplePngPath)).toBe(true);
      expect((handler as any).isLocalFilePath('./relative.png')).toBe(true);
      expect((handler as any).isLocalFilePath('file.png')).toBe(true);

      // And these as URLs
      expect((handler as any).isLocalFilePath('https://example.com/image.png')).toBe(false);
      expect((handler as any).isLocalFilePath('http://figma.com/file/123')).toBe(false);
    });
  });

  describe('Options and customization', () => {
    it('should respect custom options for local files', async () => {
      const options = {
        designTool: 'figma' as const,
        exportScale: 3,
      };

      const result = await handler.processDesignMockup(samplePngPath, options);

      expect(result.designTool).toBe('figma');
      expect(result.exportScale).toBe(3); // Should override filename detection
    });
  });

  describe('Error scenarios', () => {
    it('should handle unsupported file formats', async () => {
      const txtFile = join(tempDir, 'test.txt');
      await fs.writeFile(txtFile, 'Not an image');

      await expect(handler.processDesignMockup(txtFile))
        .rejects
        .toThrow(DesignMockupError);

      await fs.unlink(txtFile);
    });

    it('should handle empty files', async () => {
      const emptyFile = join(tempDir, 'empty.png');
      await fs.writeFile(emptyFile, Buffer.alloc(0));

      await expect(handler.processDesignMockup(emptyFile))
        .rejects
        .toThrow(DesignMockupError);

      await fs.unlink(emptyFile);
    });
  });

  describe('Format compatibility', () => {
    it('should handle different case extensions', async () => {
      const upperCasePath = join(tempDir, 'TEST.PNG');
      const pngData = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x01, 0x00, 0x00, 0x00, 0x00, 0x37, 0x6E, 0xF9, 0x24,
        0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, 0x54,
        0x78, 0x9C, 0x62, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01,
        0xE2, 0x21, 0xBC, 0x33,
        0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44,
        0xAE, 0x42, 0x60, 0x82
      ]);

      await fs.writeFile(upperCasePath, pngData);

      const result = await handler.processDesignMockup(upperCasePath);
      expect(result.exportFormat).toBe('png');

      await fs.unlink(upperCasePath);
    });
  });
});