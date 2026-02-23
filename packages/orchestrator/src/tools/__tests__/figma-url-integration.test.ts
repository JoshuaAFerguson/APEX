import { describe, expect, it, beforeEach } from 'vitest';
import { MultimodalInputHandler } from '../multimodal-input-handler';
import type { MultimodalInputHandlerConfig } from '../multimodal-input-handler';
import type {
  FigmaUrlInfo,
  FigmaUrlParseResult
} from '../design-mockup-types';

describe('Figma URL Integration Tests', () => {
  let handler: MultimodalInputHandler;

  beforeEach(() => {
    handler = new MultimodalInputHandler();
  });

  describe('Type System Integration', () => {
    it('should maintain strict type compliance for FigmaUrlInfo', () => {
      const url = 'https://www.figma.com/file/abc123xyz456789012345678/Login-Screens?node-id=123:456&mode=dev';
      const result = handler.parseFigmaUrl(url);

      expect(result.success).toBe(true);

      if (result.success) {
        const info: FigmaUrlInfo = result.info!;

        // Verify required fields
        expect(typeof info.fileKey).toBe('string');
        expect(typeof info.urlType).toBe('string');
        expect(typeof info.originalUrl).toBe('string');

        // Verify urlType is one of the valid enum values
        const validUrlTypes = ['file', 'design', 'proto', 'board', 'embed', 'image-export'];
        expect(validUrlTypes).toContain(info.urlType);

        // Verify optional fields have correct types when present
        if (info.fileName !== undefined) {
          expect(typeof info.fileName).toBe('string');
        }
        if (info.nodeId !== undefined) {
          expect(typeof info.nodeId).toBe('string');
        }
        if (info.hasVersionParams !== undefined) {
          expect(typeof info.hasVersionParams).toBe('boolean');
        }
        if (info.branchName !== undefined) {
          expect(typeof info.branchName).toBe('string');
        }
        if (info.mode !== undefined) {
          expect(['dev', 'design']).toContain(info.mode);
        }
        if (info.scaleFactor !== undefined) {
          expect(typeof info.scaleFactor).toBe('number');
        }
        if (info.viewport !== undefined) {
          expect(typeof info.viewport).toBe('object');
          expect(typeof info.viewport.x).toBe('number');
          expect(typeof info.viewport.y).toBe('number');
          expect(typeof info.viewport.width).toBe('number');
          expect(typeof info.viewport.height).toBe('number');
        }
        if (info.versionId !== undefined) {
          expect(typeof info.versionId).toBe('string');
        }
        if (info.exportFormat !== undefined) {
          const validFormats = ['png', 'jpg', 'jpeg', 'svg', 'pdf'];
          expect(validFormats).toContain(info.exportFormat);
        }
        if (info.exportScale !== undefined) {
          expect(typeof info.exportScale).toBe('number');
        }
      }
    });

    it('should maintain strict type compliance for FigmaUrlParseResult', () => {
      const validUrl = 'https://www.figma.com/file/abc123xyz456789012345678/Test';
      const invalidUrl = 'not-a-url';

      // Test successful result
      const successResult: FigmaUrlParseResult = handler.parseFigmaUrl(validUrl);
      expect(typeof successResult.success).toBe('boolean');
      expect(successResult.success).toBe(true);
      expect(successResult).toHaveProperty('info');
      expect(successResult).not.toHaveProperty('error');

      // Test failed result
      const failResult: FigmaUrlParseResult = handler.parseFigmaUrl(invalidUrl);
      expect(typeof failResult.success).toBe('boolean');
      expect(failResult.success).toBe(false);
      expect(failResult).toHaveProperty('error');
      expect(failResult).not.toHaveProperty('info');
      expect(typeof failResult.error).toBe('string');
    });
  });

  describe('Configuration Integration', () => {
    it('should work with custom MultimodalInputHandlerConfig', () => {
      const customConfig: MultimodalInputHandlerConfig = {
        maxFileSizeBytes: 5 * 1024 * 1024,
      };

      const customHandler = new MultimodalInputHandler(customConfig);
      const url = 'https://www.figma.com/file/abc123xyz456789012345678/Test?mode=dev&scale-factor=2';
      const result = customHandler.parseFigmaUrl(url);

      expect(result.success).toBe(true);
      expect(result.info?.mode).toBe('dev');
      expect(result.info?.scaleFactor).toBe(2);
    });

    it('should maintain consistent behavior across different handler instances', () => {
      const handler1 = new MultimodalInputHandler();
      const handler2 = new MultimodalInputHandler({ maxFileSizeBytes: 10 * 1024 * 1024 });

      const url = 'https://www.figma.com/file/abc123xyz456789012345678/Test?viewport=100,200,800,600';

      const result1 = handler1.parseFigmaUrl(url);
      const result2 = handler2.parseFigmaUrl(url);

      expect(result1.success).toBe(result2.success);
      expect(result1.info?.viewport).toEqual(result2.info?.viewport);
      expect(result1.info?.fileKey).toBe(result2.info?.fileKey);
    });
  });

  describe('Error Handling Integration', () => {
    it('should gracefully handle and recover from various error conditions', () => {
      const errorCases = [
        { url: null as any, expectedError: 'Invalid URL format' },
        { url: undefined as any, expectedError: 'Invalid URL format' },
        { url: '', expectedError: 'Invalid URL format' },
        { url: 'not-a-url', expectedError: 'Invalid URL format' },
        { url: 'https://sketch.com/file/123', expectedError: 'URL is not a valid Figma URL' },
        { url: 'https://www.figma.com/invalid/abc123xyz456789012345678/Test', expectedError: 'URL is not a valid Figma URL' },
        { url: 'https://www.figma.com/file/short/Test', expectedError: 'URL is not a valid Figma URL' },
      ];

      errorCases.forEach(({ url, expectedError }) => {
        const result = handler.parseFigmaUrl(url);

        expect(result.success, `Should fail for: ${url}`).toBe(false);
        expect(result.error).toBe(expectedError);
        expect(result.info).toBeUndefined();
      });
    });

    it('should handle partially malformed URLs without crashing', () => {
      const partiallyMalformedUrls = [
        'https://www.figma.com/file/abc123xyz456789012345678/Test?mode=invalid&scale-factor=notanumber',
        'https://www.figma.com/file/abc123xyz456789012345678/Test?viewport=invalid,format,here',
        'https://www.figma.com/file/abc123xyz456789012345678/Test?node-id=&branch-name=&version-id=',
        'https://www.figma.com/file/abc123xyz456789012345678/Test?mode=dev&scale-factor=&viewport=',
      ];

      partiallyMalformedUrls.forEach(url => {
        const result = handler.parseFigmaUrl(url);

        // Should not crash and should succeed in parsing the basic structure
        expect(result.success, `Should not crash for: ${url}`).toBe(true);
        expect(result.info?.fileKey).toBe('abc123xyz456789012345678');
        expect(typeof result.info?.originalUrl).toBe('string');
      });
    });
  });

  describe('Performance and Memory Integration', () => {
    it('should handle large numbers of URL parsing operations efficiently', () => {
      const baseUrl = 'https://www.figma.com/file/abc123xyz456789012345678/Test-';
      const urlCount = 1000;

      const startTime = Date.now();

      for (let i = 0; i < urlCount; i++) {
        const url = `${baseUrl}${i}?node-id=${i}:${i + 1}&mode=${i % 2 === 0 ? 'dev' : 'design'}`;
        const result = handler.parseFigmaUrl(url);

        expect(result.success).toBe(true);
        expect(result.info?.fileKey).toBe('abc123xyz456789012345678');
        expect(result.info?.mode).toBe(i % 2 === 0 ? 'dev' : 'design');
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete 1000 operations in reasonable time (less than 1 second)
      expect(duration).toBeLessThan(1000);
    });

    it('should handle URLs with very long parameters without memory issues', () => {
      const longBranchName = 'a'.repeat(1000);
      const longFileName = 'b'.repeat(500);
      const longNodeId = 'c'.repeat(100) + ':' + 'd'.repeat(100);

      const url = `https://www.figma.com/file/abc123xyz456789012345678/${encodeURIComponent(longFileName)}?node-id=${encodeURIComponent(longNodeId)}&branch-name=${encodeURIComponent(longBranchName)}&mode=dev`;

      const result = handler.parseFigmaUrl(url);

      expect(result.success).toBe(true);
      expect(result.info?.fileName).toBe(longFileName);
      expect(result.info?.nodeId).toBe(longNodeId);
      expect(result.info?.branchName).toBe(longBranchName);
      expect(result.info?.mode).toBe('dev');
    });
  });

  describe('Real-world URL Scenarios', () => {
    it('should handle URLs copied from actual Figma usage patterns', () => {
      const realWorldUrls = [
        // Standard file sharing
        'https://www.figma.com/file/abc123xyz456789012345678/Mobile-App-Design-System',

        // Design handoff with dev mode
        'https://www.figma.com/file/abc123xyz456789012345678/Mobile-App-Design-System?node-id=1%3A2&mode=dev',

        // Prototype sharing
        'https://www.figma.com/proto/abc123xyz456789012345678/Mobile-App-Prototype?node-id=1%3A2&viewport=375%2C812%2C0.5%2C0',

        // Branch collaboration
        'https://www.figma.com/file/abc123xyz456789012345678/Project-Name?branch-name=feature%2Fredesign&node-id=123%3A456',

        // Version specific links
        'https://www.figma.com/file/abc123xyz456789012345678/Project-Name?version-id=987654321&node-id=1%3A2',

        // Image export URLs
        'https://www.figma.com/file/abc123xyz456789012345678/image/123%3A456?format=png&scale=2',

        // Complex URLs with multiple parameters
        'https://www.figma.com/file/abc123xyz456789012345678/Design%20System?node-id=1%3A2&branch-name=main&version-id=123456&mode=dev&scale-factor=2&viewport=0%2C0%2C1920%2C1080',
      ];

      realWorldUrls.forEach(url => {
        const result = handler.parseFigmaUrl(url);

        expect(result.success, `Failed to parse real-world URL: ${url}`).toBe(true);
        expect(result.info?.fileKey).toBe('abc123xyz456789012345678');
        expect(result.info?.originalUrl).toBe(url);

        // Verify that the parsed info makes sense
        if (result.info?.nodeId) {
          expect(typeof result.info.nodeId).toBe('string');
        }
        if (result.info?.branchName) {
          expect(typeof result.info.branchName).toBe('string');
        }
        if (result.info?.mode) {
          expect(['dev', 'design']).toContain(result.info.mode);
        }
      });
    });

    it('should handle URLs with tracking parameters and fragments', () => {
      const urlsWithExtras = [
        'https://www.figma.com/file/abc123xyz456789012345678/Test?node-id=1:2&utm_source=slack&utm_medium=link#comments',
        'https://www.figma.com/file/abc123xyz456789012345678/Test?mode=dev&utm_campaign=sharing&fbclid=abc123#section1',
        'https://www.figma.com/file/abc123xyz456789012345678/Test?scale-factor=2&ref=toolbar&source=share#anchor',
      ];

      urlsWithExtras.forEach(url => {
        const result = handler.parseFigmaUrl(url);

        expect(result.success, `Failed for URL with extras: ${url}`).toBe(true);
        expect(result.info?.originalUrl).toBe(url);
        expect(result.info?.fileKey).toBe('abc123xyz456789012345678');
      });
    });
  });

  describe('Cross-Platform URL Handling', () => {
    it('should handle URLs from different platforms and contexts', () => {
      const platformVariations = [
        // Desktop app URLs
        'https://www.figma.com/file/abc123xyz456789012345678/Desktop-App?mode=dev',

        // Mobile web URLs
        'https://figma.com/file/abc123xyz456789012345678/Mobile-Web?scale-factor=0.5',

        // Embedded URLs (in iframe contexts)
        'https://www.figma.com/embed/abc123xyz456789012345678/Embedded-View?viewport=100,100,800,600',

        // API generated URLs
        'https://figma.com/file/abc123xyz456789012345678/API-Generated?format=png&scale=2',
      ];

      platformVariations.forEach(url => {
        const result = handler.parseFigmaUrl(url);

        expect(result.success, `Failed for platform variation: ${url}`).toBe(true);
        expect(result.info?.fileKey).toBe('abc123xyz456789012345678');
      });
    });
  });

  describe('Backwards Compatibility', () => {
    it('should maintain compatibility with older URL formats', () => {
      const olderUrlFormats = [
        'http://www.figma.com/file/abc123xyz456789012345678/Legacy-File',
        'https://www.figma.com/file/abc123xyz456789012345678/File-Without-Params',
        'https://figma.com/file/abc123xyz456789012345678/',
        'https://www.figma.com/file/abc123xyz456789012345678',
      ];

      olderUrlFormats.forEach(url => {
        const result = handler.parseFigmaUrl(url);

        expect(result.success, `Failed for legacy format: ${url}`).toBe(true);
        expect(result.info?.fileKey).toBe('abc123xyz456789012345678');
        expect(result.info?.urlType).toBe('file');
      });
    });

    it('should handle transition between old and new parameter formats', () => {
      // Test scenarios where old and new parameters might coexist
      const transitionUrls = [
        'https://www.figma.com/file/abc123xyz456789012345678/Test?node-id=1:2&new-param=value&scale-factor=1.5',
        'https://www.figma.com/file/abc123xyz456789012345678/Test?legacy=param&mode=dev&viewport=0,0,800,600',
      ];

      transitionUrls.forEach(url => {
        const result = handler.parseFigmaUrl(url);

        expect(result.success, `Failed for transition URL: ${url}`).toBe(true);
        // Should extract the parameters we understand and ignore unknown ones
        expect(result.info?.fileKey).toBe('abc123xyz456789012345678');
      });
    });
  });
});