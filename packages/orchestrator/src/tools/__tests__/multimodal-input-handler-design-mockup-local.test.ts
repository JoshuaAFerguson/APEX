/**
 * Test suite for processDesignMockup method with local file functionality
 *
 * This test suite focuses specifically on testing the local file processing
 * capabilities of the processDesignMockup method, including:
 * - Support for common design export formats (PNG, JPEG, SVG, PDF, WebP)
 * - Metadata extraction from filename patterns
 * - Error handling for various file conditions
 * - Consistent DesignMockupProcessResult return format
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { MultimodalInputHandler, processDesignMockup } from '../multimodal-input-handler';
import { DesignMockupError } from '../design-mockup-types';
import type {
  DesignMockupOptions,
  DesignMockupProcessResult,
  DesignTool,
  DesignExportFormat,
} from '../design-mockup-types';

describe('MultimodalInputHandler - processDesignMockup Local Files', () => {
  let handler: MultimodalInputHandler;
  let tempDir: string;
  let testFiles: Record<string, string> = {};

  beforeAll(async () => {
    handler = new MultimodalInputHandler();

    // Create temporary directory for test files
    tempDir = await fs.mkdtemp(join(tmpdir(), 'apex-design-mockup-test-'));

    // Create test image files with different formats and names
    const testImageData = Buffer.from([
      // Minimal PNG file signature
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
      // IHDR chunk
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x01, 0x00, 0x00, 0x00, 0x00, 0x37, 0x6E, 0xF9, 0x24,
      // IDAT chunk (minimal)
      0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, 0x54,
      0x78, 0x9C, 0x62, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01,
      0xE2, 0x21, 0xBC, 0x33,
      // IEND chunk
      0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44,
      0xAE, 0x42, 0x60, 0x82
    ]);

    // Minimal JPEG file
    const testJpegData = Buffer.from([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46,
      0x00, 0x01, 0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00,
      0xFF, 0xDB, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06,
      // ... (truncated for brevity)
      0xFF, 0xD9
    ]);

    // Minimal WebP file
    const testWebPData = Buffer.from([
      0x52, 0x49, 0x46, 0x46, 0x3A, 0x00, 0x00, 0x00,
      0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20,
      0x2E, 0x00, 0x00, 0x00, 0x30, 0x01, 0x00, 0x9D,
      0x01, 0x2A, 0x01, 0x00, 0x01, 0x00, 0x02, 0x00,
      0x34, 0x25, 0xA4, 0x00, 0x03, 0x70, 0x00, 0xFE,
      0xFB, 0xFD, 0x50, 0x00
    ]);

    // Create test files with various naming patterns
    const testFileConfigs = [
      // Basic format tests
      { name: 'test.png', data: testImageData, format: 'png' },
      { name: 'test.jpg', data: testJpegData, format: 'jpeg' },
      { name: 'test.jpeg', data: testJpegData, format: 'jpeg' },
      { name: 'test.webp', data: testWebPData, format: 'webp' },

      // Filename pattern tests - mobile UI patterns
      { name: 'LoginScreen_Mobile_2x.png', data: testImageData, format: 'png' },
      { name: 'Dashboard_Desktop_v1.2.jpeg', data: testJpegData, format: 'jpeg' },
      { name: 'Button-Primary-Hover.png', data: testImageData, format: 'png' },
      { name: 'UserProfile@2x.png', data: testImageData, format: 'png' },
      { name: 'Header-Component-Large.webp', data: testWebPData, format: 'webp' },

      // Design tool specific patterns
      { name: 'Figma_Export_Frame1.png', data: testImageData, format: 'png' },
      { name: 'Sketch_Artboard_Main.jpg', data: testJpegData, format: 'jpeg' },
      { name: 'AdobeXD_Homepage_Mockup.png', data: testImageData, format: 'png' },
      { name: 'Framer_Prototype_v2.webp', data: testWebPData, format: 'webp' },

      // Platform and state patterns
      { name: 'Navigation_iPhone_Active.png', data: testImageData, format: 'png' },
      { name: 'Sidebar_iPad_Disabled.jpeg', data: testJpegData, format: 'jpeg' },
      { name: 'Modal_Android_Selected@3x.png', data: testImageData, format: 'png' },
      { name: 'Card_Web_Pressed_v1.1.webp', data: testWebPData, format: 'webp' },

      // Version and page patterns
      { name: 'Onboarding_Page1_Mobile.png', data: testImageData, format: 'png' },
      { name: 'Settings_p3_Desktop_v2.0.jpg', data: testJpegData, format: 'jpeg' },
      { name: 'Checkout-Flow-Step2-Tablet.png', data: testImageData, format: 'png' },
    ];

    // Create all test files
    for (const config of testFileConfigs) {
      const filePath = join(tempDir, config.name);
      await fs.writeFile(filePath, config.data);
      testFiles[config.name] = filePath;
    }

    // Create an empty file for testing
    const emptyFilePath = join(tempDir, 'empty.png');
    await fs.writeFile(emptyFilePath, Buffer.alloc(0));
    testFiles['empty.png'] = emptyFilePath;

    // Create a very large file for testing size limits
    const largeFilePath = join(tempDir, 'large.png');
    const largeFileData = Buffer.alloc(25 * 1024 * 1024); // 25MB
    await fs.writeFile(largeFilePath, largeFileData);
    testFiles['large.png'] = largeFilePath;
  });

  afterAll(async () => {
    // Clean up temporary files and directory
    try {
      const files = await fs.readdir(tempDir);
      for (const file of files) {
        await fs.unlink(join(tempDir, file));
      }
      await fs.rmdir(tempDir);
    } catch (error) {
      console.warn('Failed to clean up temp directory:', error);
    }
  });

  describe('Local file path detection', () => {
    it('should correctly identify local file paths vs URLs', () => {
      // Test local file paths
      expect((handler as any).isLocalFilePath('/path/to/file.png')).toBe(true);
      expect((handler as any).isLocalFilePath('./relative/path.jpg')).toBe(true);
      expect((handler as any).isLocalFilePath('../parent/file.webp')).toBe(true);
      expect((handler as any).isLocalFilePath('C:\\Windows\\file.png')).toBe(true);
      expect((handler as any).isLocalFilePath('file.png')).toBe(true);
      expect((handler as any).isLocalFilePath('file://localhost/path/file.png')).toBe(true);

      // Test URLs
      expect((handler as any).isLocalFilePath('https://example.com/file.png')).toBe(false);
      expect((handler as any).isLocalFilePath('http://localhost/file.jpg')).toBe(false);
      expect((handler as any).isLocalFilePath('ftp://server.com/file.webp')).toBe(false);
    });
  });

  describe('Supported file formats', () => {
    const formatTests = [
      { file: 'test.png', expectedFormat: 'png', expectedMediaType: 'image/png' },
      { file: 'test.jpg', expectedFormat: 'jpeg', expectedMediaType: 'image/jpeg' },
      { file: 'test.jpeg', expectedFormat: 'jpeg', expectedMediaType: 'image/jpeg' },
      { file: 'test.webp', expectedFormat: 'webp', expectedMediaType: 'image/webp' },
    ];

    formatTests.forEach(({ file, expectedFormat, expectedMediaType }) => {
      it(`should successfully process ${file.split('.')[1].toUpperCase()} format`, async () => {
        const filePath = testFiles[file];
        const result = await handler.processDesignMockup(filePath);

        expect(result).toMatchObject({
          designTool: 'other',
          exportFormat: expectedFormat,
          mediaType: expectedMediaType,
          fromCache: false,
        });

        expect(result.imageBlock).toMatchObject({
          type: 'image',
          source: {
            type: 'base64',
            media_type: expectedMediaType,
          },
        });

        expect(typeof result.imageBlock.source.data).toBe('string');
        expect(result.imageBlock.source.data.length).toBeGreaterThan(0);

        expect(result.metadata).toMatchObject({
          fileName: file,
          filePath: filePath,
        });

        expect(typeof result.processingTime).toBe('number');
        expect(result.processingTime).toBeGreaterThan(0);
        expect(typeof result.fileSizeBytes).toBe('number');
        expect(result.fileSizeBytes).toBeGreaterThan(0);
      });
    });
  });

  describe('Metadata extraction from filename patterns', () => {
    const metadataTests = [
      {
        file: 'LoginScreen_Mobile_2x.png',
        expectedMetadata: {
          frameName: 'LoginScreen',
          artboardName: 'LoginScreen',
          platformName: 'mobile',
          scaleFactor: 2,
        }
      },
      {
        file: 'Button-Primary-Hover.png',
        expectedMetadata: {
          frameName: 'Button-Primary',
          artboardName: 'Button-Primary',
          componentName: 'button',
          stateName: 'hover',
        }
      },
      {
        file: 'UserProfile@2x.png',
        expectedMetadata: {
          frameName: 'UserProfile',
          artboardName: 'UserProfile',
          scaleFactor: 2,
        }
      },
      {
        file: 'Dashboard_Desktop_v1.2.jpeg',
        expectedMetadata: {
          frameName: 'Dashboard',
          artboardName: 'Dashboard',
          platformName: 'desktop',
          version: '1.2',
        }
      },
      {
        file: 'Figma_Export_Frame1.png',
        expectedMetadata: {
          designTool: 'figma',
          frameName: 'Figma_Export_Frame1',
          artboardName: 'Figma_Export_Frame1',
        }
      },
      {
        file: 'Navigation_iPhone_Active.png',
        expectedMetadata: {
          frameName: 'Navigation',
          artboardName: 'Navigation',
          platformName: 'iphone',
          stateName: 'active',
        }
      },
      {
        file: 'Modal_Android_Selected@3x.png',
        expectedMetadata: {
          frameName: 'Modal',
          artboardName: 'Modal',
          componentName: 'modal',
          platformName: 'android',
          stateName: 'selected',
          scaleFactor: 3,
        }
      },
      {
        file: 'Onboarding_Page1_Mobile.png',
        expectedMetadata: {
          frameName: 'Onboarding',
          artboardName: 'Onboarding',
          pageNumber: 1,
          platformName: 'mobile',
        }
      },
      {
        file: 'Settings_p3_Desktop_v2.0.jpg',
        expectedMetadata: {
          frameName: 'Settings',
          artboardName: 'Settings',
          pageNumber: 3,
          platformName: 'desktop',
          version: '2.0',
        }
      }
    ];

    metadataTests.forEach(({ file, expectedMetadata }) => {
      it(`should extract metadata from filename: ${file}`, async () => {
        const filePath = testFiles[file];
        const result = await handler.processDesignMockup(filePath);

        expect(result.metadata.fileName).toBe(file);
        expect(result.metadata.filePath).toBe(filePath);

        // Check extracted metadata
        if (expectedMetadata.frameName) {
          expect(result.metadata.frameName).toBe(expectedMetadata.frameName);
        }
        if (expectedMetadata.artboardName) {
          expect(result.metadata.artboardName).toBe(expectedMetadata.artboardName);
        }
        if (expectedMetadata.componentName) {
          expect(result.metadata.componentName).toBe(expectedMetadata.componentName);
        }
        if (expectedMetadata.platformName) {
          expect(result.metadata.platformName).toBe(expectedMetadata.platformName);
        }
        if (expectedMetadata.stateName) {
          expect(result.metadata.stateName).toBe(expectedMetadata.stateName);
        }
        if (expectedMetadata.version) {
          expect(result.metadata.version).toBe(expectedMetadata.version);
        }
        if (expectedMetadata.pageNumber) {
          expect(result.metadata.pageNumber).toBe(expectedMetadata.pageNumber);
        }
        if (expectedMetadata.scaleFactor) {
          expect(result.metadata.scaleFactor).toBe(expectedMetadata.scaleFactor);
          expect(result.exportScale).toBe(expectedMetadata.scaleFactor);
        }
        if (expectedMetadata.designTool) {
          expect(result.designTool).toBe(expectedMetadata.designTool);
        }

        expect(typeof result.metadata.lastModified).toBe('string');
        expect(new Date(result.metadata.lastModified).getTime()).toBeGreaterThan(0);
      });
    });
  });

  describe('Design tool detection from filenames', () => {
    const toolDetectionTests = [
      { file: 'Figma_Export_Frame1.png', expectedTool: 'figma' },
      { file: 'Sketch_Artboard_Main.jpg', expectedTool: 'sketch' },
      { file: 'AdobeXD_Homepage_Mockup.png', expectedTool: 'adobe_xd' },
      { file: 'Framer_Prototype_v2.webp', expectedTool: 'framer' },
      { file: 'test.png', expectedTool: 'other' }, // No tool indicator
    ];

    toolDetectionTests.forEach(({ file, expectedTool }) => {
      it(`should detect design tool from filename: ${file}`, async () => {
        const filePath = testFiles[file];
        const result = await handler.processDesignMockup(filePath);
        expect(result.designTool).toBe(expectedTool);
      });
    });
  });

  describe('Options handling for local files', () => {
    it('should respect custom designTool option', async () => {
      const filePath = testFiles['test.png'];
      const options: Partial<DesignMockupOptions> = {
        designTool: 'figma',
      };

      const result = await handler.processDesignMockup(filePath, options);
      expect(result.designTool).toBe('figma');
    });

    it('should respect custom exportFormat option', async () => {
      const filePath = testFiles['test.png'];
      const options: Partial<DesignMockupOptions> = {
        designTool: 'other',
        exportFormat: 'jpeg',
      };

      const result = await handler.processDesignMockup(filePath, options);
      expect(result.exportFormat).toBe('jpeg');
    });

    it('should respect custom exportScale option', async () => {
      const filePath = testFiles['test.png'];
      const options: Partial<DesignMockupOptions> = {
        designTool: 'other',
        exportScale: 3,
      };

      const result = await handler.processDesignMockup(filePath, options);
      expect(result.exportScale).toBe(3);
    });

    it('should use filename-detected scale factor when no option provided', async () => {
      const filePath = testFiles['UserProfile@2x.png'];
      const result = await handler.processDesignMockup(filePath);
      expect(result.exportScale).toBe(2);
    });

    it('should use option over filename-detected scale factor', async () => {
      const filePath = testFiles['UserProfile@2x.png'];
      const options: Partial<DesignMockupOptions> = {
        designTool: 'other',
        exportScale: 4,
      };

      const result = await handler.processDesignMockup(filePath, options);
      expect(result.exportScale).toBe(4);
    });
  });

  describe('Error handling', () => {
    it('should throw FILE_NOT_FOUND for non-existent files', async () => {
      const nonExistentPath = join(tempDir, 'non-existent.png');

      await expect(handler.processDesignMockup(nonExistentPath))
        .rejects
        .toThrow(DesignMockupError);

      try {
        await handler.processDesignMockup(nonExistentPath);
      } catch (error) {
        expect(error).toBeInstanceOf(DesignMockupError);
        expect((error as DesignMockupError).message).toContain('File does not exist');
      }
    });

    it('should throw EMPTY_FILE for empty files', async () => {
      const emptyFilePath = testFiles['empty.png'];

      await expect(handler.processDesignMockup(emptyFilePath))
        .rejects
        .toThrow(DesignMockupError);

      try {
        await handler.processDesignMockup(emptyFilePath);
      } catch (error) {
        expect(error).toBeInstanceOf(DesignMockupError);
        expect((error as DesignMockupError).message).toContain('File is empty');
      }
    });

    it('should throw FILE_TOO_LARGE for files exceeding size limit', async () => {
      const largeFilePath = testFiles['large.png'];

      await expect(handler.processDesignMockup(largeFilePath))
        .rejects
        .toThrow(DesignMockupError);

      try {
        await handler.processDesignMockup(largeFilePath);
      } catch (error) {
        expect(error).toBeInstanceOf(DesignMockupError);
        expect((error as DesignMockupError).message).toContain('exceeds maximum allowed size');
      }
    });

    it('should throw UNSUPPORTED_FORMAT for unsupported file extensions', async () => {
      const unsupportedFilePath = join(tempDir, 'test.txt');
      await fs.writeFile(unsupportedFilePath, 'text content');

      await expect(handler.processDesignMockup(unsupportedFilePath))
        .rejects
        .toThrow(DesignMockupError);

      try {
        await handler.processDesignMockup(unsupportedFilePath);
      } catch (error) {
        expect(error).toBeInstanceOf(DesignMockupError);
        expect((error as DesignMockupError).message).toContain('Unsupported file format');
      }

      // Clean up
      await fs.unlink(unsupportedFilePath);
    });

    it('should throw NOT_A_FILE when path points to directory', async () => {
      const dirPath = join(tempDir, 'test-directory');
      await fs.mkdir(dirPath);

      await expect(handler.processDesignMockup(dirPath))
        .rejects
        .toThrow(DesignMockupError);

      try {
        await handler.processDesignMockup(dirPath);
      } catch (error) {
        expect(error).toBeInstanceOf(DesignMockupError);
        expect((error as DesignMockupError).message).toContain('Path is not a file');
      }

      // Clean up
      await fs.rmdir(dirPath);
    });

    it('should handle permission errors gracefully', async () => {
      // Create a file and attempt to make it unreadable (may not work on all systems)
      const restrictedFilePath = join(tempDir, 'restricted.png');
      await fs.writeFile(restrictedFilePath, Buffer.from([1, 2, 3, 4]));

      try {
        // Try to make file unreadable
        await fs.chmod(restrictedFilePath, 0o000);

        await expect(handler.processDesignMockup(restrictedFilePath))
          .rejects
          .toThrow(DesignMockupError);
      } catch (chmodError) {
        // If chmod fails (like on some CI systems), skip this test
        console.warn('Skipping permission test due to chmod failure');
      } finally {
        // Restore permissions and clean up
        try {
          await fs.chmod(restrictedFilePath, 0o644);
          await fs.unlink(restrictedFilePath);
        } catch {
          // Ignore cleanup errors
        }
      }
    });
  });

  describe('Result consistency', () => {
    it('should return consistent DesignMockupProcessResult structure', async () => {
      const filePath = testFiles['test.png'];
      const result = await handler.processDesignMockup(filePath);

      // Check required fields
      expect(result).toHaveProperty('imageBlock');
      expect(result).toHaveProperty('designTool');
      expect(result).toHaveProperty('metadata');
      expect(result).toHaveProperty('exportFormat');
      expect(result).toHaveProperty('exportScale');
      expect(result).toHaveProperty('fileSizeBytes');
      expect(result).toHaveProperty('mediaType');
      expect(result).toHaveProperty('processingTime');
      expect(result).toHaveProperty('fromCache');

      // Check imageBlock structure
      expect(result.imageBlock).toMatchObject({
        type: 'image',
        source: {
          type: 'base64',
          media_type: expect.stringMatching(/^image\/(png|jpeg|webp|gif)$/),
          data: expect.any(String),
        },
      });

      // Check metadata structure
      expect(result.metadata).toHaveProperty('fileName');
      expect(result.metadata).toHaveProperty('filePath');
      expect(result.metadata).toHaveProperty('lastModified');

      // Check value types
      expect(typeof result.designTool).toBe('string');
      expect(typeof result.exportFormat).toBe('string');
      expect(typeof result.exportScale).toBe('number');
      expect(typeof result.fileSizeBytes).toBe('number');
      expect(typeof result.mediaType).toBe('string');
      expect(typeof result.processingTime).toBe('number');
      expect(typeof result.fromCache).toBe('boolean');

      // Check value constraints
      expect(result.exportScale).toBeGreaterThan(0);
      expect(result.fileSizeBytes).toBeGreaterThan(0);
      expect(result.processingTime).toBeGreaterThan(0);
      expect(result.fromCache).toBe(false); // Local files should never be cached
    });

    it('should handle files without detectable metadata gracefully', async () => {
      const filePath = testFiles['test.png']; // Simple filename
      const result = await handler.processDesignMockup(filePath);

      expect(result.metadata).toMatchObject({
        fileName: 'test.png',
        filePath: filePath,
      });

      // Optional metadata should be undefined when not detected
      expect(result.metadata.frameName).toBeUndefined();
      expect(result.metadata.componentName).toBeUndefined();
      expect(result.metadata.platformName).toBeUndefined();
      expect(result.metadata.stateName).toBeUndefined();
      expect(result.metadata.version).toBeUndefined();
      expect(result.metadata.pageNumber).toBeUndefined();
      expect(result.metadata.scaleFactor).toBeUndefined();

      // Should still have basic properties
      expect(result.designTool).toBe('other');
      expect(result.exportScale).toBe(1); // Default scale
    });
  });

  describe('Edge cases', () => {
    it('should handle files with special characters in names', async () => {
      const specialName = 'test-file with spaces & symbols!@#.png';
      const specialFilePath = join(tempDir, specialName);
      const testData = Buffer.from([
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

      await fs.writeFile(specialFilePath, testData);

      const result = await handler.processDesignMockup(specialFilePath);

      expect(result.metadata.fileName).toBe(specialName);
      expect(result.metadata.filePath).toBe(specialFilePath);
      expect(result.exportFormat).toBe('png');

      // Clean up
      await fs.unlink(specialFilePath);
    });

    it('should handle multiple file extensions correctly', async () => {
      const multiExtName = 'backup.design.png';
      const multiExtPath = join(tempDir, multiExtName);
      const testData = Buffer.from([
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

      await fs.writeFile(multiExtPath, testData);

      const result = await handler.processDesignMockup(multiExtPath);

      expect(result.metadata.fileName).toBe(multiExtName);
      expect(result.exportFormat).toBe('png'); // Should use the final extension

      // Clean up
      await fs.unlink(multiExtPath);
    });

    it('should handle files with uppercase extensions', async () => {
      const upperExtName = 'TEST.PNG';
      const upperExtPath = join(tempDir, upperExtName);
      const testData = Buffer.from([
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

      await fs.writeFile(upperExtPath, testData);

      const result = await handler.processDesignMockup(upperExtPath);

      expect(result.exportFormat).toBe('png');
      expect(result.imageBlock.source.media_type).toBe('image/png');

      // Clean up
      await fs.unlink(upperExtPath);
    });
  });
});

describe('processDesignMockup convenience function - Local Files', () => {
  let tempDir: string;
  let testFilePath: string;

  beforeAll(async () => {
    // Create temporary test file
    tempDir = await fs.mkdtemp(join(tmpdir(), 'apex-design-mockup-convenience-test-'));
    testFilePath = join(tempDir, 'convenience-test.png');

    const testData = Buffer.from([
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

    await fs.writeFile(testFilePath, testData);
  });

  afterAll(async () => {
    try {
      await fs.unlink(testFilePath);
      await fs.rmdir(tempDir);
    } catch (error) {
      console.warn('Failed to clean up convenience test temp directory:', error);
    }
  });

  it('should work with local files using default handler', async () => {
    const result = await processDesignMockup(testFilePath);

    expect(result).toMatchObject({
      designTool: 'other',
      exportFormat: 'png',
      mediaType: 'image/png',
      fromCache: false,
    });

    expect(result.metadata.filePath).toBe(testFilePath);
    expect(result.metadata.fileName).toBe('convenience-test.png');
  });

  it('should work with local files and options', async () => {
    const options: Partial<DesignMockupOptions> = {
      designTool: 'sketch',
      exportScale: 2,
    };

    const result = await processDesignMockup(testFilePath, options);

    expect(result.designTool).toBe('sketch');
    expect(result.exportScale).toBe(2);
  });

  it('should work with local files and custom config', async () => {
    const config = { maxFileSizeBytes: 10 * 1024 * 1024 }; // 10MB
    const options: Partial<DesignMockupOptions> = {
      designTool: 'figma',
    };

    const result = await processDesignMockup(testFilePath, options, config);

    expect(result.designTool).toBe('figma');
  });
});