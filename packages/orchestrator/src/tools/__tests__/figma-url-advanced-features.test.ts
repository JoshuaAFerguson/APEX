import { describe, expect, it, beforeEach } from 'vitest';
import { MultimodalInputHandler, isFigmaUrl, parseFigmaUrl } from '../multimodal-input-handler';
import type { MultimodalInputHandlerConfig } from '../multimodal-input-handler';

describe('Figma URL Advanced Features Tests', () => {
  let handler: MultimodalInputHandler;

  beforeEach(() => {
    handler = new MultimodalInputHandler();
  });

  describe('Image Export URLs', () => {
    describe('isFigmaUrl for image export URLs', () => {
      it('should correctly identify Figma image export URLs', () => {
        const imageExportUrls = [
          'https://www.figma.com/file/abc123xyz456789012345678/image/123:456',
          'https://figma.com/file/abc123xyz456789012345678/image/789:012',
          'https://www.figma.com/file/abcdefghij1234567890abcdef/image/node123',
        ];

        imageExportUrls.forEach(url => {
          expect(handler.isFigmaUrl(url), `Failed for URL: ${url}`).toBe(true);
        });
      });

      it('should reject malformed image export URLs', () => {
        const invalidUrls = [
          'https://www.figma.com/file/short/image/123',
          'https://www.figma.com/file//image/123',
          'https://www.figma.com/image/abc123xyz456789012345678/123',
          'https://sketch.com/file/abc123xyz456789012345678/image/123',
        ];

        invalidUrls.forEach(url => {
          expect(handler.isFigmaUrl(url), `Unexpectedly passed for URL: ${url}`).toBe(false);
        });
      });
    });

    describe('parseFigmaUrl for image export URLs', () => {
      it('should successfully parse basic image export URL', () => {
        const url = 'https://www.figma.com/file/abc123xyz456789012345678/image/123:456';
        const result = handler.parseFigmaUrl(url);

        expect(result.success).toBe(true);
        expect(result.info?.fileKey).toBe('abc123xyz456789012345678');
        expect(result.info?.nodeId).toBe('123:456');
        expect(result.info?.urlType).toBe('image-export');
        expect(result.info?.originalUrl).toBe(url);
      });

      it('should parse image export URL with URL-encoded node ID', () => {
        const url = 'https://www.figma.com/file/abc123xyz456789012345678/image/123%3A456';
        const result = handler.parseFigmaUrl(url);

        expect(result.success).toBe(true);
        expect(result.info?.nodeId).toBe('123:456');
      });

      it('should parse image export URL with complex node ID', () => {
        const url = 'https://www.figma.com/file/abc123xyz456789012345678/image/1234%3A5678-9abc%3Adef0';
        const result = handler.parseFigmaUrl(url);

        expect(result.success).toBe(true);
        expect(result.info?.nodeId).toBe('1234:5678-9abc:def0');
      });

      it('should parse image export URL with export format parameter', () => {
        const url = 'https://www.figma.com/file/abc123xyz456789012345678/image/123:456?format=png';
        const result = handler.parseFigmaUrl(url);

        expect(result.success).toBe(true);
        expect(result.info?.exportFormat).toBe('png');
      });

      it('should parse image export URL with export scale parameter', () => {
        const url = 'https://www.figma.com/file/abc123xyz456789012345678/image/123:456?scale=2';
        const result = handler.parseFigmaUrl(url);

        expect(result.success).toBe(true);
        expect(result.info?.exportScale).toBe(2);
      });

      it('should parse image export URL with both format and scale parameters', () => {
        const url = 'https://www.figma.com/file/abc123xyz456789012345678/image/123:456?format=svg&scale=2.5';
        const result = handler.parseFigmaUrl(url);

        expect(result.success).toBe(true);
        expect(result.info?.exportFormat).toBe('svg');
        expect(result.info?.exportScale).toBe(2.5);
      });

      it('should handle various export formats', () => {
        const formats = ['png', 'jpg', 'jpeg', 'svg', 'pdf'];

        formats.forEach(format => {
          const url = `https://www.figma.com/file/abc123xyz456789012345678/image/123:456?format=${format}`;
          const result = handler.parseFigmaUrl(url);

          expect(result.success, `Failed for format: ${format}`).toBe(true);
          expect(result.info?.exportFormat).toBe(format);
        });
      });
    });
  });

  describe('Mode Parameter (dev/design)', () => {
    it('should parse URLs with mode=dev parameter', () => {
      const url = 'https://www.figma.com/file/abc123xyz456789012345678/Login-Screens?mode=dev';
      const result = handler.parseFigmaUrl(url);

      expect(result.success).toBe(true);
      expect(result.info?.mode).toBe('dev');
    });

    it('should parse URLs with mode=design parameter', () => {
      const url = 'https://www.figma.com/file/abc123xyz456789012345678/Login-Screens?mode=design';
      const result = handler.parseFigmaUrl(url);

      expect(result.success).toBe(true);
      expect(result.info?.mode).toBe('design');
    });

    it('should handle mode parameter with other parameters', () => {
      const url = 'https://www.figma.com/file/abc123xyz456789012345678/Login-Screens?node-id=123:456&mode=dev&branch-name=feature';
      const result = handler.parseFigmaUrl(url);

      expect(result.success).toBe(true);
      expect(result.info?.mode).toBe('dev');
      expect(result.info?.nodeId).toBe('123:456');
      expect(result.info?.branchName).toBe('feature');
    });

    it('should ignore invalid mode values', () => {
      const url = 'https://www.figma.com/file/abc123xyz456789012345678/Login-Screens?mode=invalid';
      const result = handler.parseFigmaUrl(url);

      expect(result.success).toBe(true);
      expect(result.info?.mode).toBeUndefined();
    });

    it('should handle mode parameter in different URL positions', () => {
      const urls = [
        'https://www.figma.com/file/abc123xyz456789012345678/Login-Screens?mode=dev&node-id=123:456',
        'https://www.figma.com/file/abc123xyz456789012345678/Login-Screens?node-id=123:456&mode=design',
        'https://www.figma.com/file/abc123xyz456789012345678/Login-Screens?branch-name=test&mode=dev&version-id=123',
      ];

      const expectedModes = ['dev', 'design', 'dev'];

      urls.forEach((url, index) => {
        const result = handler.parseFigmaUrl(url);
        expect(result.success, `Failed for URL: ${url}`).toBe(true);
        expect(result.info?.mode).toBe(expectedModes[index]);
      });
    });
  });

  describe('Scale Factor Parameter', () => {
    it('should parse URLs with scale-factor parameter', () => {
      const url = 'https://www.figma.com/file/abc123xyz456789012345678/Login-Screens?scale-factor=2';
      const result = handler.parseFigmaUrl(url);

      expect(result.success).toBe(true);
      expect(result.info?.scaleFactor).toBe(2);
    });

    it('should parse decimal scale factors', () => {
      const url = 'https://www.figma.com/file/abc123xyz456789012345678/Login-Screens?scale-factor=1.5';
      const result = handler.parseFigmaUrl(url);

      expect(result.success).toBe(true);
      expect(result.info?.scaleFactor).toBe(1.5);
    });

    it('should handle scale-factor with other parameters', () => {
      const url = 'https://www.figma.com/file/abc123xyz456789012345678/Login-Screens?node-id=123:456&scale-factor=3&mode=dev';
      const result = handler.parseFigmaUrl(url);

      expect(result.success).toBe(true);
      expect(result.info?.scaleFactor).toBe(3);
      expect(result.info?.nodeId).toBe('123:456');
      expect(result.info?.mode).toBe('dev');
    });

    it('should handle various scale factor values', () => {
      const scales = [0.5, 1, 1.25, 2, 2.5, 3, 4];

      scales.forEach(scale => {
        const url = `https://www.figma.com/file/abc123xyz456789012345678/Login-Screens?scale-factor=${scale}`;
        const result = handler.parseFigmaUrl(url);

        expect(result.success, `Failed for scale: ${scale}`).toBe(true);
        expect(result.info?.scaleFactor).toBe(scale);
      });
    });

    it('should ignore invalid scale factor values', () => {
      const url = 'https://www.figma.com/file/abc123xyz456789012345678/Login-Screens?scale-factor=invalid';
      const result = handler.parseFigmaUrl(url);

      expect(result.success).toBe(true);
      expect(result.info?.scaleFactor).toBeUndefined();
    });
  });

  describe('Viewport Parameter', () => {
    it('should parse URLs with viewport parameter', () => {
      const url = 'https://www.figma.com/file/abc123xyz456789012345678/Login-Screens?viewport=100,200,800,600';
      const result = handler.parseFigmaUrl(url);

      expect(result.success).toBe(true);
      expect(result.info?.viewport).toEqual({
        x: 100,
        y: 200,
        width: 800,
        height: 600,
      });
    });

    it('should handle viewport with decimal values', () => {
      const url = 'https://www.figma.com/file/abc123xyz456789012345678/Login-Screens?viewport=100.5,200.25,800.75,600.1';
      const result = handler.parseFigmaUrl(url);

      expect(result.success).toBe(true);
      expect(result.info?.viewport).toEqual({
        x: 100.5,
        y: 200.25,
        width: 800.75,
        height: 600.1,
      });
    });

    it('should handle viewport with negative coordinates', () => {
      const url = 'https://www.figma.com/file/abc123xyz456789012345678/Login-Screens?viewport=-100,-200,800,600';
      const result = handler.parseFigmaUrl(url);

      expect(result.success).toBe(true);
      expect(result.info?.viewport).toEqual({
        x: -100,
        y: -200,
        width: 800,
        height: 600,
      });
    });

    it('should handle viewport with spaces around values', () => {
      const url = 'https://www.figma.com/file/abc123xyz456789012345678/Login-Screens?viewport=100, 200, 800, 600';
      const result = handler.parseFigmaUrl(url);

      expect(result.success).toBe(true);
      expect(result.info?.viewport).toEqual({
        x: 100,
        y: 200,
        width: 800,
        height: 600,
      });
    });

    it('should ignore invalid viewport values', () => {
      const invalidViewports = [
        'viewport=100,200,800', // Too few values
        'viewport=100,200,800,600,extra', // Too many values
        'viewport=100,invalid,800,600', // Non-numeric value
        'viewport=', // Empty
        'viewport=a,b,c,d', // All non-numeric
      ];

      invalidViewports.forEach(param => {
        const url = `https://www.figma.com/file/abc123xyz456789012345678/Login-Screens?${param}`;
        const result = handler.parseFigmaUrl(url);

        expect(result.success, `Should succeed but ignore invalid viewport: ${param}`).toBe(true);
        expect(result.info?.viewport).toBeUndefined();
      });
    });

    it('should handle viewport with other parameters', () => {
      const url = 'https://www.figma.com/file/abc123xyz456789012345678/Login-Screens?node-id=123:456&viewport=100,200,800,600&mode=dev';
      const result = handler.parseFigmaUrl(url);

      expect(result.success).toBe(true);
      expect(result.info?.viewport).toEqual({
        x: 100,
        y: 200,
        width: 800,
        height: 600,
      });
      expect(result.info?.nodeId).toBe('123:456');
      expect(result.info?.mode).toBe('dev');
    });
  });

  describe('Version ID Parameter', () => {
    it('should parse URLs with version-id parameter and set versionId field', () => {
      const url = 'https://www.figma.com/file/abc123xyz456789012345678/Login-Screens?version-id=987654321';
      const result = handler.parseFigmaUrl(url);

      expect(result.success).toBe(true);
      expect(result.info?.versionId).toBe('987654321');
      expect(result.info?.hasVersionParams).toBe(true);
    });

    it('should handle long version IDs', () => {
      const longVersionId = '12345678901234567890';
      const url = `https://www.figma.com/file/abc123xyz456789012345678/Login-Screens?version-id=${longVersionId}`;
      const result = handler.parseFigmaUrl(url);

      expect(result.success).toBe(true);
      expect(result.info?.versionId).toBe(longVersionId);
      expect(result.info?.hasVersionParams).toBe(true);
    });
  });

  describe('Combined Parameters Tests', () => {
    it('should parse URLs with all possible parameters', () => {
      const url = 'https://www.figma.com/file/abc123xyz456789012345678/Login%20Screens' +
        '?node-id=123:456' +
        '&version-id=987654321' +
        '&branch-name=feature-branch' +
        '&mode=dev' +
        '&scale-factor=2.5' +
        '&viewport=100,200,800,600';

      const result = handler.parseFigmaUrl(url);

      expect(result.success).toBe(true);
      expect(result.info?.fileKey).toBe('abc123xyz456789012345678');
      expect(result.info?.fileName).toBe('Login Screens');
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
        height: 600,
      });
      expect(result.info?.urlType).toBe('file');
    });

    it('should handle parameters in different orders', () => {
      const urls = [
        'https://www.figma.com/file/abc123xyz456789012345678/Test?mode=dev&node-id=123:456&scale-factor=2',
        'https://www.figma.com/file/abc123xyz456789012345678/Test?scale-factor=2&mode=dev&node-id=123:456',
        'https://www.figma.com/file/abc123xyz456789012345678/Test?node-id=123:456&scale-factor=2&mode=dev',
      ];

      urls.forEach(url => {
        const result = handler.parseFigmaUrl(url);

        expect(result.success, `Failed for URL: ${url}`).toBe(true);
        expect(result.info?.mode).toBe('dev');
        expect(result.info?.nodeId).toBe('123:456');
        expect(result.info?.scaleFactor).toBe(2);
      });
    });

    it('should preserve originalUrl exactly with all parameters', () => {
      const originalUrl = 'https://www.figma.com/file/abc123xyz456789012345678/Login%20Screens?node-id=123%3A456&utm_source=test&mode=dev&scale-factor=2&custom=param#anchor';
      const result = handler.parseFigmaUrl(originalUrl);

      expect(result.success).toBe(true);
      expect(result.info?.originalUrl).toBe(originalUrl);
    });
  });

  describe('URL Type Validation', () => {
    it('should correctly handle all URL types with new parameters', () => {
      const urlTypes = ['file', 'design', 'proto', 'board', 'embed'];

      urlTypes.forEach(type => {
        const url = `https://www.figma.com/${type}/abc123xyz456789012345678/Test?mode=dev&scale-factor=1.5&viewport=0,0,1000,800`;
        const result = handler.parseFigmaUrl(url);

        expect(result.success, `Failed for URL type: ${type}`).toBe(true);
        expect(result.info?.urlType).toBe(type);
        expect(result.info?.mode).toBe('dev');
        expect(result.info?.scaleFactor).toBe(1.5);
        expect(result.info?.viewport).toEqual({
          x: 0,
          y: 0,
          width: 1000,
          height: 800,
        });
      });
    });
  });

  describe('Edge Cases for New Parameters', () => {
    it('should handle URLs with parameter names but no values', () => {
      const url = 'https://www.figma.com/file/abc123xyz456789012345678/Test?mode=&scale-factor=&viewport=';
      const result = handler.parseFigmaUrl(url);

      expect(result.success).toBe(true);
      expect(result.info?.mode).toBeUndefined();
      expect(result.info?.scaleFactor).toBeUndefined();
      expect(result.info?.viewport).toBeUndefined();
    });

    it('should handle malformed parameter values gracefully', () => {
      const url = 'https://www.figma.com/file/abc123xyz456789012345678/Test?mode=invalidmode&scale-factor=notanumber&viewport=invalid,format';
      const result = handler.parseFigmaUrl(url);

      expect(result.success).toBe(true);
      expect(result.info?.mode).toBeUndefined();
      expect(result.info?.scaleFactor).toBeUndefined();
      expect(result.info?.viewport).toBeUndefined();
    });

    it('should handle very large scale factors', () => {
      const url = 'https://www.figma.com/file/abc123xyz456789012345678/Test?scale-factor=100.5';
      const result = handler.parseFigmaUrl(url);

      expect(result.success).toBe(true);
      expect(result.info?.scaleFactor).toBe(100.5);
    });

    it('should handle very large viewport coordinates', () => {
      const url = 'https://www.figma.com/file/abc123xyz456789012345678/Test?viewport=99999,99999,50000,40000';
      const result = handler.parseFigmaUrl(url);

      expect(result.success).toBe(true);
      expect(result.info?.viewport).toEqual({
        x: 99999,
        y: 99999,
        width: 50000,
        height: 40000,
      });
    });
  });

  describe('Convenience Functions with New Features', () => {
    it('should work with isFigmaUrl convenience function for image exports', () => {
      const url = 'https://www.figma.com/file/abc123xyz456789012345678/image/123:456?format=png&scale=2';
      expect(isFigmaUrl(url)).toBe(true);
    });

    it('should work with parseFigmaUrl convenience function for all new features', () => {
      const url = 'https://www.figma.com/file/abc123xyz456789012345678/Test?mode=dev&scale-factor=2&viewport=0,0,800,600';
      const result = parseFigmaUrl(url);

      expect(result.success).toBe(true);
      expect(result.info?.mode).toBe('dev');
      expect(result.info?.scaleFactor).toBe(2);
      expect(result.info?.viewport).toEqual({
        x: 0,
        y: 0,
        width: 800,
        height: 600,
      });
    });

    it('should work with custom config for new features', () => {
      const customConfig: MultimodalInputHandlerConfig = {
        maxFileSizeBytes: 10 * 1024 * 1024,
      };

      const url = 'https://www.figma.com/file/abc123xyz456789012345678/image/123:456?format=svg&scale=3';
      const result = parseFigmaUrl(url, customConfig);

      expect(result.success).toBe(true);
      expect(result.info?.urlType).toBe('image-export');
      expect(result.info?.exportFormat).toBe('svg');
      expect(result.info?.exportScale).toBe(3);
    });
  });
});