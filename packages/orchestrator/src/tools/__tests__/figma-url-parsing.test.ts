/**
 * Comprehensive tests for Figma URL parsing functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MultimodalInputHandler } from '../multimodal-input-handler';

describe('MultimodalInputHandler - Figma URL Parsing', () => {
  let handler: MultimodalInputHandler;

  beforeEach(() => {
    handler = new MultimodalInputHandler();
  });

  describe('isFigmaUrl validation', () => {
    const validFigmaUrls = [
      'https://www.figma.com/file/abc123def456/My-Design',
      'https://figma.com/design/abc123def456/Dashboard',
      'https://www.figma.com/proto/abc123def456/Prototype',
      'https://www.figma.com/board/abc123def456/Board',
      'https://www.figma.com/embed?embed_host=share',
      'https://www.figma.com/file/abc123def456/image/nodeId123',
      'https://figma.com/file/1234567890123456789012/Test-File',
      'https://www.figma.com/file/abcdefghijklmnopqrstuvwxyz/Complex-Name-With-Hyphens',
    ];

    const invalidUrls = [
      'https://sketch.cloud/s/abc123',
      'https://example.com/image.png',
      'https://www.figma-fake.com/file/abc123/Design',
      'https://www.adobe.com/products/xd',
      'not-a-url-at-all',
      'ftp://figma.com/file/abc123/Design',
      'https://figma.co/file/abc123/Design', // Wrong domain
    ];

    validFigmaUrls.forEach(url => {
      it(`should identify valid Figma URL: ${url}`, () => {
        expect(handler.isFigmaUrl(url)).toBe(true);
      });
    });

    invalidUrls.forEach(url => {
      it(`should reject invalid URL: ${url}`, () => {
        expect(handler.isFigmaUrl(url)).toBe(false);
      });
    });
  });

  describe('parseFigmaUrl detailed parsing', () => {
    it('should parse basic file URL with all components', () => {
      const url = 'https://www.figma.com/file/abc123def456/My-Design-File';
      const result = handler.parseFigmaUrl(url);

      expect(result.success).toBe(true);
      expect(result.info).toMatchObject({
        fileKey: 'abc123def456',
        fileName: 'My-Design-File',
        urlType: 'file',
        originalUrl: url,
      });
    });

    it('should parse URL with node ID parameter', () => {
      const url = 'https://www.figma.com/file/abc123/Design?node-id=123:456';
      const result = handler.parseFigmaUrl(url);

      expect(result.success).toBe(true);
      expect(result.info?.nodeId).toBe('123:456');
    });

    it('should parse URL with encoded node ID', () => {
      const url = 'https://www.figma.com/file/abc123/Design?node-id=123%3A456';
      const result = handler.parseFigmaUrl(url);

      expect(result.success).toBe(true);
      expect(result.info?.nodeId).toBe('123:456');
    });

    it('should parse URL with version parameters', () => {
      const url = 'https://www.figma.com/file/abc123/Design?version-id=987654321';
      const result = handler.parseFigmaUrl(url);

      expect(result.success).toBe(true);
      expect(result.info?.hasVersionParams).toBe(true);
      expect(result.info?.versionId).toBe('987654321');
    });

    it('should parse URL with branch name', () => {
      const url = 'https://www.figma.com/file/abc123/Design?branch-name=feature-branch';
      const result = handler.parseFigmaUrl(url);

      expect(result.success).toBe(true);
      expect(result.info?.branchName).toBe('feature-branch');
    });

    it('should parse URL with encoded branch name', () => {
      const url = 'https://www.figma.com/file/abc123/Design?branch-name=feature%2Fbranch';
      const result = handler.parseFigmaUrl(url);

      expect(result.success).toBe(true);
      expect(result.info?.branchName).toBe('feature/branch');
    });

    it('should parse URL with viewport parameters', () => {
      const url = 'https://www.figma.com/file/abc123/Design?viewport=100,200,800,600';
      const result = handler.parseFigmaUrl(url);

      expect(result.success).toBe(true);
      expect(result.info?.viewport).toEqual({
        x: 100,
        y: 200,
        width: 800,
        height: 600,
      });
    });

    it('should parse URL with invalid viewport parameters', () => {
      const url = 'https://www.figma.com/file/abc123/Design?viewport=100,200,invalid';
      const result = handler.parseFigmaUrl(url);

      expect(result.success).toBe(true);
      expect(result.info?.viewport).toBeUndefined();
    });

    it('should parse URL with mode parameter', () => {
      const url = 'https://www.figma.com/file/abc123/Design?mode=dev';
      const result = handler.parseFigmaUrl(url);

      expect(result.success).toBe(true);
      expect(result.info?.mode).toBe('dev');
    });

    it('should parse URL with scale factor', () => {
      const url = 'https://www.figma.com/file/abc123/Design?scale-factor=2.5';
      const result = handler.parseFigmaUrl(url);

      expect(result.success).toBe(true);
      expect(result.info?.scaleFactor).toBe(2.5);
    });

    it('should parse complex URL with multiple parameters', () => {
      const url = 'https://www.figma.com/file/abc123def456/My-Complex-Design?node-id=123:456&version-id=987654321&mode=design&scale-factor=1.5&viewport=0,0,1920,1080&branch-name=main';
      const result = handler.parseFigmaUrl(url);

      expect(result.success).toBe(true);
      expect(result.info).toMatchObject({
        fileKey: 'abc123def456',
        fileName: 'My-Complex-Design',
        nodeId: '123:456',
        versionId: '987654321',
        mode: 'design',
        scaleFactor: 1.5,
        branchName: 'main',
        viewport: {
          x: 0,
          y: 0,
          width: 1920,
          height: 1080,
        },
      });
    });

    it('should parse image export URL', () => {
      const url = 'https://www.figma.com/file/abc123def456/image/node789?format=png&scale=2';
      const result = handler.parseFigmaUrl(url);

      expect(result.success).toBe(true);
      expect(result.info).toMatchObject({
        fileKey: 'abc123def456',
        nodeId: 'node789',
        urlType: 'image-export',
        exportFormat: 'png',
        exportScale: 2,
      });
    });

    it('should handle URL-encoded file names', () => {
      const url = 'https://www.figma.com/file/abc123/My%20Design%20With%20Spaces';
      const result = handler.parseFigmaUrl(url);

      expect(result.success).toBe(true);
      expect(result.info?.fileName).toBe('My Design With Spaces');
    });

    it('should handle URLs without file names', () => {
      const url = 'https://www.figma.com/file/abc123def456';
      const result = handler.parseFigmaUrl(url);

      expect(result.success).toBe(true);
      expect(result.info?.fileKey).toBe('abc123def456');
      expect(result.info?.fileName).toBeUndefined();
    });

    it('should handle different URL types', () => {
      const urlTypes = [
        { url: 'https://www.figma.com/design/abc123/Test', type: 'design' },
        { url: 'https://www.figma.com/proto/abc123/Test', type: 'proto' },
        { url: 'https://www.figma.com/board/abc123/Test', type: 'board' },
        { url: 'https://www.figma.com/embed/abc123/Test', type: 'embed' },
      ];

      urlTypes.forEach(({ url, type }) => {
        const result = handler.parseFigmaUrl(url);
        expect(result.success).toBe(true);
        expect(result.info?.urlType).toBe(type);
      });
    });
  });

  describe('Error handling in URL parsing', () => {
    it('should return error for malformed URLs', () => {
      const result = handler.parseFigmaUrl('not-a-valid-url');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid URL format');
    });

    it('should return error for non-Figma URLs', () => {
      const result = handler.parseFigmaUrl('https://example.com/image.png');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not a valid Figma URL');
    });

    it('should return error for Figma URLs with invalid structure', () => {
      const result = handler.parseFigmaUrl('https://www.figma.com/invalid/structure');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to parse Figma URL structure');
    });

    it('should handle URLs with missing file keys gracefully', () => {
      const result = handler.parseFigmaUrl('https://www.figma.com/file/');
      expect(result.success).toBe(false);
    });
  });

  describe('Edge cases in URL parsing', () => {
    it('should handle very long file keys', () => {
      const longFileKey = 'a'.repeat(50);
      const url = `https://www.figma.com/file/${longFileKey}/Test`;
      const result = handler.parseFigmaUrl(url);

      expect(result.success).toBe(true);
      expect(result.info?.fileKey).toBe(longFileKey);
    });

    it('should handle special characters in file names', () => {
      const encodedName = encodeURIComponent('Design & Prototype v2.0 (Final)');
      const url = `https://www.figma.com/file/abc123/${encodedName}`;
      const result = handler.parseFigmaUrl(url);

      expect(result.success).toBe(true);
      expect(result.info?.fileName).toBe('Design & Prototype v2.0 (Final)');
    });

    it('should handle complex node IDs', () => {
      const complexNodeId = '1234:5678-9012:3456';
      const url = `https://www.figma.com/file/abc123/Test?node-id=${encodeURIComponent(complexNodeId)}`;
      const result = handler.parseFigmaUrl(url);

      expect(result.success).toBe(true);
      expect(result.info?.nodeId).toBe(complexNodeId);
    });

    it('should handle decimal scale factors', () => {
      const url = 'https://www.figma.com/file/abc123/Test?scale-factor=1.75';
      const result = handler.parseFigmaUrl(url);

      expect(result.success).toBe(true);
      expect(result.info?.scaleFactor).toBe(1.75);
    });

    it('should handle invalid scale factors gracefully', () => {
      const url = 'https://www.figma.com/file/abc123/Test?scale-factor=invalid';
      const result = handler.parseFigmaUrl(url);

      expect(result.success).toBe(true);
      expect(result.info?.scaleFactor).toBeUndefined();
    });
  });
});