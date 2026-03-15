import { describe, expect, it } from 'vitest';
import { MultimodalInputHandler } from '../multimodal-input-handler';

describe('Figma URL Test Coverage Validation', () => {
  describe('Function Coverage', () => {
    it('should test all public methods related to Figma URLs', () => {
      const handler = new MultimodalInputHandler();

      // Test that all public Figma-related methods are accessible
      expect(typeof handler.isFigmaUrl).toBe('function');
      expect(typeof handler.parseFigmaUrl).toBe('function');

      // Test basic functionality of each method
      expect(handler.isFigmaUrl('https://www.figma.com/file/abc123xyz456789012345678/Test')).toBe(true);

      const parseResult = handler.parseFigmaUrl('https://www.figma.com/file/abc123xyz456789012345678/Test');
      expect(parseResult.success).toBe(true);
    });
  });

  describe('URL Pattern Coverage', () => {
    it('should cover all supported URL types', () => {
      const handler = new MultimodalInputHandler();
      const urlTypes = ['file', 'design', 'proto', 'board', 'embed'];

      urlTypes.forEach(type => {
        const url = `https://www.figma.com/${type}/abc123xyz456789012345678/Test`;
        expect(handler.isFigmaUrl(url), `Failed for URL type: ${type}`).toBe(true);

        const result = handler.parseFigmaUrl(url);
        expect(result.success).toBe(true);
        expect(result.info?.urlType).toBe(type);
      });
    });

    it('should cover image export URL pattern', () => {
      const handler = new MultimodalInputHandler();
      const imageUrl = 'https://www.figma.com/file/abc123xyz456789012345678/image/123:456';

      expect(handler.isFigmaUrl(imageUrl)).toBe(true);

      const result = handler.parseFigmaUrl(imageUrl);
      expect(result.success).toBe(true);
      expect(result.info?.urlType).toBe('image-export');
    });
  });

  describe('Parameter Coverage', () => {
    it('should cover all parameter extraction patterns', () => {
      const handler = new MultimodalInputHandler();
      const urlWithAllParams = 'https://www.figma.com/file/abc123xyz456789012345678/Test' +
        '?node-id=123:456' +
        '&version-id=987654321' +
        '&branch-name=feature-branch' +
        '&mode=dev' +
        '&scale-factor=2.5' +
        '&viewport=100,200,800,600';

      const result = handler.parseFigmaUrl(urlWithAllParams);

      expect(result.success).toBe(true);
      expect(result.info?.nodeId).toBe('123:456');
      expect(result.info?.versionId).toBe('987654321');
      expect(result.info?.hasVersionParams).toBe(true);
      expect(result.info?.branchName).toBe('feature-branch');
      expect(result.info?.mode).toBe('dev');
      expect(result.info?.scaleFactor).toBe(2.5);
      expect(result.info?.viewport).toEqual({
        x: 100,
        y: 200,
        width: 800,
        height: 600
      });
    });

    it('should cover export-specific parameters', () => {
      const handler = new MultimodalInputHandler();
      const exportUrl = 'https://www.figma.com/file/abc123xyz456789012345678/image/123:456?format=svg&scale=3';

      const result = handler.parseFigmaUrl(exportUrl);

      expect(result.success).toBe(true);
      expect(result.info?.exportFormat).toBe('svg');
      expect(result.info?.exportScale).toBe(3);
    });
  });

  describe('Error Condition Coverage', () => {
    it('should cover all error scenarios', () => {
      const handler = new MultimodalInputHandler();
      const errorCases = [
        // Invalid URL format errors
        { input: null, expectError: true },
        { input: undefined, expectError: true },
        { input: '', expectError: true },
        { input: 'not-a-url', expectError: true },

        // Non-Figma URL errors
        { input: 'https://sketch.com/file/123', expectError: true },
        { input: 'https://example.com/test', expectError: true },

        // Invalid Figma URL structure errors
        { input: 'https://www.figma.com/invalid/abc123xyz456789012345678/Test', expectError: true },
        { input: 'https://www.figma.com/file/short/Test', expectError: true },

        // Valid URLs (should not error)
        { input: 'https://www.figma.com/file/abc123xyz456789012345678/Test', expectError: false },
      ];

      errorCases.forEach(({ input, expectError }) => {
        const result = handler.parseFigmaUrl(input as any);

        if (expectError) {
          expect(result.success, `Should have failed for: ${input}`).toBe(false);
          expect(result.error).toBeDefined();
          expect(result.info).toBeUndefined();
        } else {
          expect(result.success, `Should have succeeded for: ${input}`).toBe(true);
          expect(result.info).toBeDefined();
          expect(result.error).toBeUndefined();
        }
      });
    });
  });

  describe('Edge Case Coverage', () => {
    it('should cover URL encoding edge cases', () => {
      const handler = new MultimodalInputHandler();
      const encodingCases = [
        {
          url: 'https://www.figma.com/file/abc123xyz456789012345678/Test%20File%20%26%20More',
          expectedFileName: 'Test File & More'
        },
        {
          url: 'https://www.figma.com/file/abc123xyz456789012345678/Test?node-id=123%3A456',
          expectedNodeId: '123:456'
        },
        {
          url: 'https://www.figma.com/file/abc123xyz456789012345678/Test?branch-name=feature%2Dbranch',
          expectedBranchName: 'feature-branch'
        },
      ];

      encodingCases.forEach(({ url, expectedFileName, expectedNodeId, expectedBranchName }) => {
        const result = handler.parseFigmaUrl(url);

        expect(result.success, `Failed for URL: ${url}`).toBe(true);

        if (expectedFileName) {
          expect(result.info?.fileName).toBe(expectedFileName);
        }
        if (expectedNodeId) {
          expect(result.info?.nodeId).toBe(expectedNodeId);
        }
        if (expectedBranchName) {
          expect(result.info?.branchName).toBe(expectedBranchName);
        }
      });
    });

    it('should cover file key length validation edge cases', () => {
      const handler = new MultimodalInputHandler();

      // Test minimum length (22 characters)
      const minLengthUrl = 'https://www.figma.com/file/abcdefghij1234567890ab/Test';
      expect(handler.parseFigmaUrl(minLengthUrl).success).toBe(true);

      // Test too short (less than 22 characters)
      const tooShortUrl = 'https://www.figma.com/file/short/Test';
      expect(handler.parseFigmaUrl(tooShortUrl).success).toBe(false);

      // Test longer than minimum (should work)
      const longerUrl = 'https://www.figma.com/file/abcdefghij1234567890abcdefghijk/Test';
      expect(handler.parseFigmaUrl(longerUrl).success).toBe(true);
    });

    it('should cover domain variation edge cases', () => {
      const handler = new MultimodalInputHandler();
      const domainVariations = [
        'https://www.figma.com/file/abc123xyz456789012345678/Test',
        'https://figma.com/file/abc123xyz456789012345678/Test',
        'http://www.figma.com/file/abc123xyz456789012345678/Test',
        'http://figma.com/file/abc123xyz456789012345678/Test',
      ];

      domainVariations.forEach(url => {
        const result = handler.parseFigmaUrl(url);
        expect(result.success, `Failed for domain variation: ${url}`).toBe(true);
        expect(result.info?.fileKey).toBe('abc123xyz456789012345678');
      });
    });
  });

  describe('Type Safety Coverage', () => {
    it('should maintain type safety for all return values', () => {
      const handler = new MultimodalInputHandler();

      // Test successful parse return types
      const successResult = handler.parseFigmaUrl('https://www.figma.com/file/abc123xyz456789012345678/Test?mode=dev');
      expect(typeof successResult.success).toBe('boolean');

      if (successResult.success) {
        expect(typeof successResult.info).toBe('object');
        expect(typeof successResult.info.fileKey).toBe('string');
        expect(typeof successResult.info.urlType).toBe('string');
        expect(typeof successResult.info.originalUrl).toBe('string');

        if (successResult.info.mode) {
          expect(['dev', 'design']).toContain(successResult.info.mode);
        }
      }

      // Test failed parse return types
      const failResult = handler.parseFigmaUrl('invalid');
      expect(typeof failResult.success).toBe('boolean');
      expect(failResult.success).toBe(false);
      expect(typeof failResult.error).toBe('string');
      expect(failResult.info).toBeUndefined();
    });
  });

  describe('API Coverage', () => {
    it('should test both convenience functions and class methods', () => {
      // Import convenience functions
      const { isFigmaUrl, parseFigmaUrl } = require('../multimodal-input-handler');

      const testUrl = 'https://www.figma.com/file/abc123xyz456789012345678/Test?mode=dev';

      // Test convenience functions
      expect(isFigmaUrl(testUrl)).toBe(true);
      const convenienceResult = parseFigmaUrl(testUrl);
      expect(convenienceResult.success).toBe(true);

      // Test class methods
      const handler = new MultimodalInputHandler();
      expect(handler.isFigmaUrl(testUrl)).toBe(true);
      const classResult = handler.parseFigmaUrl(testUrl);
      expect(classResult.success).toBe(true);

      // Results should be equivalent
      expect(convenienceResult.info?.mode).toBe(classResult.info?.mode);
      expect(convenienceResult.info?.fileKey).toBe(classResult.info?.fileKey);
    });
  });

  describe('Performance Coverage', () => {
    it('should validate performance characteristics', () => {
      const handler = new MultimodalInputHandler();
      const testUrl = 'https://www.figma.com/file/abc123xyz456789012345678/Test?node-id=123:456&mode=dev';

      // Test that URL parsing is fast
      const startTime = Date.now();
      for (let i = 0; i < 100; i++) {
        handler.parseFigmaUrl(testUrl);
      }
      const endTime = Date.now();

      // Should complete 100 parsing operations quickly
      expect(endTime - startTime).toBeLessThan(100);
    });
  });

  describe('Regression Testing Coverage', () => {
    it('should prevent regressions in core functionality', () => {
      const handler = new MultimodalInputHandler();

      // Test cases that represent common usage patterns that should never break
      const regressionTestCases = [
        {
          url: 'https://www.figma.com/file/abc123xyz456789012345678/Login-Screens',
          expected: {
            success: true,
            fileKey: 'abc123xyz456789012345678',
            fileName: 'Login-Screens',
            urlType: 'file'
          }
        },
        {
          url: 'https://www.figma.com/file/abc123xyz456789012345678/Login-Screens?node-id=123:456',
          expected: {
            success: true,
            fileKey: 'abc123xyz456789012345678',
            nodeId: '123:456'
          }
        },
        {
          url: 'https://www.figma.com/proto/abc123xyz456789012345678/Mobile-App',
          expected: {
            success: true,
            urlType: 'proto'
          }
        },
        {
          url: 'https://sketch.com/file/123',
          expected: {
            success: false,
            error: 'URL is not a valid Figma URL'
          }
        }
      ];

      regressionTestCases.forEach(({ url, expected }) => {
        const result = handler.parseFigmaUrl(url);

        expect(result.success, `Regression in success for: ${url}`).toBe(expected.success);

        if (expected.success) {
          if (expected.fileKey) {
            expect(result.info?.fileKey).toBe(expected.fileKey);
          }
          if (expected.fileName) {
            expect(result.info?.fileName).toBe(expected.fileName);
          }
          if (expected.urlType) {
            expect(result.info?.urlType).toBe(expected.urlType);
          }
          if (expected.nodeId) {
            expect(result.info?.nodeId).toBe(expected.nodeId);
          }
        } else {
          if (expected.error) {
            expect(result.error).toBe(expected.error);
          }
        }
      });
    });
  });
});