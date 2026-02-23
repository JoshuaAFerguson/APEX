import { describe, expect, it, beforeEach } from 'vitest';
import { MultimodalInputHandler, isFigmaUrl, parseFigmaUrl } from '../multimodal-input-handler';
import type { FigmaUrlInfo, FigmaUrlParseResult } from '../design-mockup-types';

describe('Figma URL Parsing - Additional Edge Cases and Private Method Testing', () => {
  let handler: MultimodalInputHandler;

  beforeEach(() => {
    handler = new MultimodalInputHandler();
  });

  describe('Private Helper Methods Testing (via public API)', () => {
    describe('Mode extraction edge cases', () => {
      it('should handle mode parameter with different casing', () => {
        const urls = [
          'https://www.figma.com/file/abc123xyz456789012345678/Test?MODE=dev',
          'https://www.figma.com/file/abc123xyz456789012345678/Test?Mode=design',
        ];

        // These should fail because the regex is case-sensitive for parameter values
        urls.forEach(url => {
          const result = handler.parseFigmaUrl(url);
          expect(result.success).toBe(true);
          expect(result.info?.mode).toBeUndefined(); // Case-sensitive matching
        });
      });

      it('should handle mode parameter with mixed case values', () => {
        const urls = [
          'https://www.figma.com/file/abc123xyz456789012345678/Test?mode=DEV',
          'https://www.figma.com/file/abc123xyz456789012345678/Test?mode=Design',
          'https://www.figma.com/file/abc123xyz456789012345678/Test?mode=dEv',
        ];

        // These should fail because the regex expects exact lowercase values
        urls.forEach(url => {
          const result = handler.parseFigmaUrl(url);
          expect(result.success).toBe(true);
          expect(result.info?.mode).toBeUndefined();
        });
      });

      it('should handle mode parameter with extra whitespace', () => {
        const urls = [
          'https://www.figma.com/file/abc123xyz456789012345678/Test?mode= dev',
          'https://www.figma.com/file/abc123xyz456789012345678/Test?mode=design ',
          'https://www.figma.com/file/abc123xyz456789012345678/Test?mode= dev ',
        ];

        urls.forEach(url => {
          const result = handler.parseFigmaUrl(url);
          expect(result.success).toBe(true);
          expect(result.info?.mode).toBeUndefined(); // Whitespace should make it invalid
        });
      });
    });

    describe('Scale factor extraction edge cases', () => {
      it('should handle zero scale factor', () => {
        const url = 'https://www.figma.com/file/abc123xyz456789012345678/Test?scale-factor=0';
        const result = handler.parseFigmaUrl(url);

        expect(result.success).toBe(true);
        expect(result.info?.scaleFactor).toBe(0);
      });

      it('should handle negative scale factor', () => {
        const url = 'https://www.figma.com/file/abc123xyz456789012345678/Test?scale-factor=-2';
        const result = handler.parseFigmaUrl(url);

        expect(result.success).toBe(true);
        expect(result.info?.scaleFactor).toBe(-2);
      });

      it('should handle scientific notation in scale factor', () => {
        const url = 'https://www.figma.com/file/abc123xyz456789012345678/Test?scale-factor=1e2';
        const result = handler.parseFigmaUrl(url);

        expect(result.success).toBe(true);
        expect(result.info?.scaleFactor).toBe(100);
      });

      it('should handle very small decimal scale factors', () => {
        const url = 'https://www.figma.com/file/abc123xyz456789012345678/Test?scale-factor=0.001';
        const result = handler.parseFigmaUrl(url);

        expect(result.success).toBe(true);
        expect(result.info?.scaleFactor).toBe(0.001);
      });

      it('should handle scale factor with leading zeros', () => {
        const url = 'https://www.figma.com/file/abc123xyz456789012345678/Test?scale-factor=002.5';
        const result = handler.parseFigmaUrl(url);

        expect(result.success).toBe(true);
        expect(result.info?.scaleFactor).toBe(2.5);
      });
    });

    describe('Viewport extraction edge cases', () => {
      it('should handle viewport with exactly 4 comma-separated values', () => {
        const url = 'https://www.figma.com/file/abc123xyz456789012345678/Test?viewport=0,0,0,0';
        const result = handler.parseFigmaUrl(url);

        expect(result.success).toBe(true);
        expect(result.info?.viewport).toEqual({ x: 0, y: 0, width: 0, height: 0 });
      });

      it('should handle viewport with negative zero values', () => {
        const url = 'https://www.figma.com/file/abc123xyz456789012345678/Test?viewport=-0,-0,800,600';
        const result = handler.parseFigmaUrl(url);

        expect(result.success).toBe(true);
        expect(result.info?.viewport).toEqual({ x: -0, y: -0, width: 800, height: 600 });
      });

      it('should handle viewport with scientific notation', () => {
        const url = 'https://www.figma.com/file/abc123xyz456789012345678/Test?viewport=1e2,2e2,8e2,6e2';
        const result = handler.parseFigmaUrl(url);

        expect(result.success).toBe(true);
        expect(result.info?.viewport).toEqual({ x: 100, y: 200, width: 800, height: 600 });
      });

      it('should reject viewport with NaN values', () => {
        const url = 'https://www.figma.com/file/abc123xyz456789012345678/Test?viewport=NaN,200,800,600';
        const result = handler.parseFigmaUrl(url);

        expect(result.success).toBe(true);
        expect(result.info?.viewport).toBeUndefined();
      });

      it('should reject viewport with Infinity values', () => {
        const url = 'https://www.figma.com/file/abc123xyz456789012345678/Test?viewport=Infinity,200,800,600';
        const result = handler.parseFigmaUrl(url);

        expect(result.success).toBe(true);
        expect(result.info?.viewport).toBeUndefined();
      });
    });

    describe('Export format extraction edge cases', () => {
      it('should handle export format with different casing', () => {
        const formats = ['PNG', 'JPG', 'JPEG', 'SVG', 'PDF'];

        formats.forEach(format => {
          const url = `https://www.figma.com/file/abc123xyz456789012345678/image/123:456?format=${format}`;
          const result = handler.parseFigmaUrl(url);

          expect(result.success).toBe(true);
          expect(result.info?.exportFormat).toBeUndefined(); // Case-sensitive
        });
      });

      it('should handle export format with extra characters', () => {
        const invalidFormats = ['png!', '.png', 'png ', ' png', 'png/jpeg'];

        invalidFormats.forEach(format => {
          const url = `https://www.figma.com/file/abc123xyz456789012345678/image/123:456?format=${format}`;
          const result = handler.parseFigmaUrl(url);

          expect(result.success).toBe(true);
          expect(result.info?.exportFormat).toBeUndefined();
        });
      });
    });

    describe('Export scale extraction edge cases', () => {
      it('should handle export scale with zero value', () => {
        const url = 'https://www.figma.com/file/abc123xyz456789012345678/image/123:456?scale=0';
        const result = handler.parseFigmaUrl(url);

        expect(result.success).toBe(true);
        expect(result.info?.exportScale).toBe(0);
      });

      it('should handle export scale with negative value', () => {
        const url = 'https://www.figma.com/file/abc123xyz456789012345678/image/123:456?scale=-1.5';
        const result = handler.parseFigmaUrl(url);

        expect(result.success).toBe(true);
        expect(result.info?.exportScale).toBe(-1.5);
      });
    });
  });

  describe('URL Structure Edge Cases', () => {
    describe('Domain variations', () => {
      it('should handle www subdomain variations', () => {
        const domains = [
          'https://figma.com/file/abc123xyz456789012345678/Test',
          'https://www.figma.com/file/abc123xyz456789012345678/Test',
          'http://figma.com/file/abc123xyz456789012345678/Test',
          'http://www.figma.com/file/abc123xyz456789012345678/Test',
        ];

        domains.forEach(url => {
          const result = handler.parseFigmaUrl(url);
          expect(result.success, `Failed for: ${url}`).toBe(true);
          expect(result.info?.fileKey).toBe('abc123xyz456789012345678');
        });
      });

      it('should reject non-figma domains', () => {
        const invalidDomains = [
          'https://www.sketch.com/file/abc123xyz456789012345678/Test',
          'https://figma.example.com/file/abc123xyz456789012345678/Test',
          'https://fake-figma.com/file/abc123xyz456789012345678/Test',
          'https://www.figmaa.com/file/abc123xyz456789012345678/Test',
        ];

        invalidDomains.forEach(url => {
          const result = handler.parseFigmaUrl(url);
          expect(result.success, `Unexpectedly passed for: ${url}`).toBe(false);
        });
      });
    });

    describe('File key edge cases', () => {
      it('should handle file keys with mixed alphanumeric characters', () => {
        const fileKeys = [
          'abcdefghij1234567890ab',     // 22 chars - minimum
          'ABCDEFGHIJ1234567890AB',     // 22 chars - uppercase
          'AbCdEf123XyZ456789012345',   // 25 chars - mixed case
          '1234567890abcdefghij12',     // 22 chars - numbers first
        ];

        fileKeys.forEach(fileKey => {
          const url = `https://www.figma.com/file/${fileKey}/Test`;
          const result = handler.parseFigmaUrl(url);
          expect(result.success, `Failed for fileKey: ${fileKey}`).toBe(true);
          expect(result.info?.fileKey).toBe(fileKey);
        });
      });

      it('should reject file keys that are too short', () => {
        const shortFileKeys = [
          'a',                          // 1 char
          'abc123',                     // 6 chars
          'abcdefghij123456789',        // 19 chars
          'abcdefghij12345678901',      // 21 chars - one short
        ];

        shortFileKeys.forEach(fileKey => {
          const url = `https://www.figma.com/file/${fileKey}/Test`;
          const result = handler.parseFigmaUrl(url);
          expect(result.success, `Unexpectedly passed for short fileKey: ${fileKey}`).toBe(false);
        });
      });

      it('should handle file keys with special characters (should fail)', () => {
        const invalidFileKeys = [
          'abcdefghij1234567890a!',     // 22 chars with special char
          'abcdefghij1234567890a-',     // 22 chars with hyphen
          'abcdefghij1234567890a_',     // 22 chars with underscore
          'abcdefghij1234567890a.',     // 22 chars with period
        ];

        invalidFileKeys.forEach(fileKey => {
          const url = `https://www.figma.com/file/${fileKey}/Test`;
          const result = handler.parseFigmaUrl(url);
          expect(result.success, `Unexpectedly passed for invalid fileKey: ${fileKey}`).toBe(false);
        });
      });
    });

    describe('Node ID edge cases', () => {
      it('should handle complex node IDs with multiple separators', () => {
        const nodeIds = [
          '123:456',
          '123:456:789',
          '1:2:3:4:5',
          '123:456-789:012',
          'abc:123-def:456',
        ];

        nodeIds.forEach(nodeId => {
          const encodedNodeId = encodeURIComponent(nodeId);
          const url = `https://www.figma.com/file/abc123xyz456789012345678/Test?node-id=${encodedNodeId}`;
          const result = handler.parseFigmaUrl(url);
          expect(result.success, `Failed for nodeId: ${nodeId}`).toBe(true);
          expect(result.info?.nodeId).toBe(nodeId);
        });
      });

      it('should handle node IDs with special characters', () => {
        const specialNodeIds = [
          '123:456_variant',
          '123:456-copy',
          '123:456/instance',
          'frame_1:element_2',
        ];

        specialNodeIds.forEach(nodeId => {
          const encodedNodeId = encodeURIComponent(nodeId);
          const url = `https://www.figma.com/file/abc123xyz456789012345678/Test?node-id=${encodedNodeId}`;
          const result = handler.parseFigmaUrl(url);
          expect(result.success, `Failed for special nodeId: ${nodeId}`).toBe(true);
          expect(result.info?.nodeId).toBe(nodeId);
        });
      });
    });
  });

  describe('Parameter Parsing Edge Cases', () => {
    describe('Query parameter edge cases', () => {
      it('should handle parameters with empty values', () => {
        const url = 'https://www.figma.com/file/abc123xyz456789012345678/Test?node-id=&branch-name=&version-id=';
        const result = handler.parseFigmaUrl(url);

        expect(result.success).toBe(true);
        expect(result.info?.nodeId).toBe('');
        expect(result.info?.branchName).toBe('');
        expect(result.info?.versionId).toBe('');
        expect(result.info?.hasVersionParams).toBe(true); // Should still be true for version-id presence
      });

      it('should handle parameters with only whitespace values', () => {
        const url = 'https://www.figma.com/file/abc123xyz456789012345678/Test?node-id=%20&branch-name=%20%20';
        const result = handler.parseFigmaUrl(url);

        expect(result.success).toBe(true);
        expect(result.info?.nodeId).toBe(' ');
        expect(result.info?.branchName).toBe('  ');
      });

      it('should handle duplicate parameters (last one wins)', () => {
        const url = 'https://www.figma.com/file/abc123xyz456789012345678/Test?node-id=123:456&node-id=789:012&mode=dev&mode=design';
        const result = handler.parseFigmaUrl(url);

        expect(result.success).toBe(true);
        // JavaScript URL parsing typically uses the last value for duplicate parameters
        expect(result.info?.nodeId).toBe('789:012');
        expect(result.info?.mode).toBe('design');
      });

      it('should handle parameters without values (key only)', () => {
        const url = 'https://www.figma.com/file/abc123xyz456789012345678/Test?node-id&mode&scale-factor';
        const result = handler.parseFigmaUrl(url);

        expect(result.success).toBe(true);
        // Parameters without values should be treated as empty strings
        expect(result.info?.nodeId).toBe('');
        expect(result.info?.mode).toBeUndefined(); // Empty string won't match 'dev' or 'design'
        expect(result.info?.scaleFactor).toBeUndefined(); // Empty string won't parse as number
      });
    });

    describe('URL encoding edge cases', () => {
      it('should handle double-encoded parameters', () => {
        const nodeId = '123:456';
        const singleEncoded = encodeURIComponent(nodeId); // '123%3A456'
        const doubleEncoded = encodeURIComponent(singleEncoded); // '123%253A456'

        const url = `https://www.figma.com/file/abc123xyz456789012345678/Test?node-id=${doubleEncoded}`;
        const result = handler.parseFigmaUrl(url);

        expect(result.success).toBe(true);
        // Should decode to the single-encoded version, not the original
        expect(result.info?.nodeId).toBe(singleEncoded);
      });

      it('should handle partially encoded special characters', () => {
        const mixedBranchName = 'feature%20branch-test'; // Space encoded, hyphen not
        const url = `https://www.figma.com/file/abc123xyz456789012345678/Test?branch-name=${mixedBranchName}`;
        const result = handler.parseFigmaUrl(url);

        expect(result.success).toBe(true);
        expect(result.info?.branchName).toBe('feature branch-test');
      });

      it('should handle malformed percent encoding', () => {
        const malformedUrl = 'https://www.figma.com/file/abc123xyz456789012345678/Test?node-id=123%GG456';
        const result = handler.parseFigmaUrl(url);

        expect(result.success).toBe(true);
        // Invalid percent encoding should be left as-is
        expect(result.info?.nodeId).toBe('123%GG456');
      });
    });
  });

  describe('Error Handling and Robustness', () => {
    describe('Malformed URLs', () => {
      it('should handle URLs with malformed query strings', () => {
        const malformedUrls = [
          'https://www.figma.com/file/abc123xyz456789012345678/Test?',
          'https://www.figma.com/file/abc123xyz456789012345678/Test?&',
          'https://www.figma.com/file/abc123xyz456789012345678/Test?&node-id=123:456',
          'https://www.figma.com/file/abc123xyz456789012345678/Test?node-id=123:456&',
        ];

        malformedUrls.forEach(url => {
          const result = handler.parseFigmaUrl(url);
          expect(result.success, `Failed for malformed URL: ${url}`).toBe(true);
        });
      });

      it('should handle URLs with fragments', () => {
        const url = 'https://www.figma.com/file/abc123xyz456789012345678/Test?node-id=123:456#section1';
        const result = handler.parseFigmaUrl(url);

        expect(result.success).toBe(true);
        expect(result.info?.nodeId).toBe('123:456');
        expect(result.info?.originalUrl).toBe(url);
      });

      it('should handle URLs with ports', () => {
        const url = 'https://www.figma.com:443/file/abc123xyz456789012345678/Test?node-id=123:456';
        const result = handler.parseFigmaUrl(url);

        expect(result.success).toBe(true);
        expect(result.info?.fileKey).toBe('abc123xyz456789012345678');
        expect(result.info?.nodeId).toBe('123:456');
      });
    });

    describe('Type coercion and validation', () => {
      it('should handle non-string inputs gracefully', () => {
        const invalidInputs = [
          null,
          undefined,
          123,
          {},
          [],
          true,
          false,
        ];

        invalidInputs.forEach(input => {
          const result = handler.parseFigmaUrl(input as any);
          expect(result.success, `Unexpectedly passed for input: ${input}`).toBe(false);
          expect(result.error).toBe('Invalid URL format');
        });
      });
    });
  });

  describe('Integration with isFigmaUrl', () => {
    it('should have consistent behavior between isFigmaUrl and parseFigmaUrl', () => {
      const testUrls = [
        // Valid URLs
        'https://www.figma.com/file/abc123xyz456789012345678/Test',
        'https://figma.com/design/abc123xyz456789012345678/Test',
        'https://www.figma.com/proto/abc123xyz456789012345678/Test?node-id=123:456',
        'https://figma.com/board/abc123xyz456789012345678/Test',
        'https://www.figma.com/embed/abc123xyz456789012345678/Test',
        'https://www.figma.com/file/abc123xyz456789012345678/image/123:456',

        // Invalid URLs
        'https://sketch.com/file/abc123xyz456789012345678/Test',
        'https://www.figma.com/file/short/Test',
        'not-a-url',
        '',
      ];

      testUrls.forEach(url => {
        const isFigmaResult = handler.isFigmaUrl(url);
        const parseResult = handler.parseFigmaUrl(url);

        expect(isFigmaResult, `Inconsistent results for URL: ${url}`).toBe(parseResult.success);
      });
    });
  });

  describe('Performance and Resource Usage', () => {
    it('should handle processing many URLs efficiently', () => {
      const urls = Array.from({ length: 100 }, (_, i) =>
        `https://www.figma.com/file/abc123xyz456789012345${String(i).padStart(3, '0')}/Test-${i}?node-id=${i}:${i + 100}`
      );

      const startTime = Date.now();

      urls.forEach(url => {
        const result = handler.parseFigmaUrl(url);
        expect(result.success).toBe(true);
      });

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Should process 100 URLs in reasonable time (adjust threshold as needed)
      expect(processingTime).toBeLessThan(1000); // 1 second
    });

    it('should handle very long URLs without issues', () => {
      const longFileName = 'Very'.repeat(100) + 'LongFileName';
      const longBranchName = 'feature-' + 'branch-'.repeat(50) + 'name';
      const encodedFileName = encodeURIComponent(longFileName);
      const encodedBranchName = encodeURIComponent(longBranchName);

      const url = `https://www.figma.com/file/abc123xyz456789012345678/${encodedFileName}?node-id=123:456&branch-name=${encodedBranchName}&mode=dev`;

      const result = handler.parseFigmaUrl(url);

      expect(result.success).toBe(true);
      expect(result.info?.fileName).toBe(longFileName);
      expect(result.info?.branchName).toBe(longBranchName);
    });
  });
});