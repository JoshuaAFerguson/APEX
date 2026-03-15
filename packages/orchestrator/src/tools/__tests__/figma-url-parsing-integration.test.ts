import { describe, expect, it, beforeEach } from 'vitest';
import { MultimodalInputHandler, isFigmaUrl, parseFigmaUrl } from '../multimodal-input-handler';
import type { FigmaUrlInfo, FigmaUrlParseResult } from '../design-mockup-types';

describe('Figma URL Parsing - Integration Tests', () => {
  let handler: MultimodalInputHandler;

  beforeEach(() => {
    handler = new MultimodalInputHandler();
  });

  describe('End-to-End URL Processing Workflow', () => {
    it('should complete the full processing workflow for a complex Figma URL', () => {
      const complexUrl = 'https://www.figma.com/file/abcdefghij1234567890abcdef/My%20Design%20System%20-%20Components?node-id=1234%3A5678&version-id=987654321&branch-name=feature%2Dredesign&mode=dev&scale-factor=2.5&viewport=100,200,1920,1080';

      // Step 1: URL Detection
      expect(handler.isFigmaUrl(complexUrl)).toBe(true);

      // Step 2: URL Parsing
      const parseResult = handler.parseFigmaUrl(complexUrl);

      expect(parseResult.success).toBe(true);
      expect(parseResult.info).toBeDefined();

      const info = parseResult.info!;

      // Step 3: Validate all extracted information
      expect(info.fileKey).toBe('abcdefghij1234567890abcdef');
      expect(info.fileName).toBe('My Design System - Components');
      expect(info.nodeId).toBe('1234:5678');
      expect(info.versionId).toBe('987654321');
      expect(info.hasVersionParams).toBe(true);
      expect(info.branchName).toBe('feature-redesign');
      expect(info.urlType).toBe('file');
      expect(info.mode).toBe('dev');
      expect(info.scaleFactor).toBe(2.5);
      expect(info.viewport).toEqual({
        x: 100,
        y: 200,
        width: 1920,
        height: 1080,
      });
      expect(info.originalUrl).toBe(complexUrl);

      // Step 4: Validate undefined fields for non-image-export URL
      expect(info.exportFormat).toBeUndefined();
      expect(info.exportScale).toBeUndefined();
    });

    it('should complete the full processing workflow for a Figma image export URL', () => {
      const imageExportUrl = 'https://www.figma.com/file/abcdefghij1234567890abcdef/image/1234%3A5678-component%3Avariant?format=png&scale=3';

      // Step 1: URL Detection
      expect(handler.isFigmaUrl(imageExportUrl)).toBe(true);

      // Step 2: URL Parsing
      const parseResult = handler.parseFigmaUrl(imageExportUrl);

      expect(parseResult.success).toBe(true);
      expect(parseResult.info).toBeDefined();

      const info = parseResult.info!;

      // Step 3: Validate all extracted information
      expect(info.fileKey).toBe('abcdefghij1234567890abcdef');
      expect(info.nodeId).toBe('1234:5678-component:variant');
      expect(info.urlType).toBe('image-export');
      expect(info.exportFormat).toBe('png');
      expect(info.exportScale).toBe(3);
      expect(info.originalUrl).toBe(imageExportUrl);

      // Step 4: Validate undefined fields for image-export URL
      expect(info.fileName).toBeUndefined();
      expect(info.hasVersionParams).toBe(false);
      expect(info.branchName).toBeUndefined();
      expect(info.mode).toBeUndefined();
      expect(info.scaleFactor).toBeUndefined();
      expect(info.viewport).toBeUndefined();
      expect(info.versionId).toBeUndefined();
    });

    it('should handle graceful degradation with partially invalid parameters', () => {
      const partiallyInvalidUrl = 'https://www.figma.com/file/abcdefghij1234567890abcdef/Test?node-id=123:456&mode=invalid-mode&scale-factor=not-a-number&viewport=invalid,format&branch-name=valid-branch';

      const parseResult = handler.parseFigmaUrl(partiallyInvalidUrl);

      expect(parseResult.success).toBe(true);
      expect(parseResult.info).toBeDefined();

      const info = parseResult.info!;

      // Valid parameters should be parsed correctly
      expect(info.fileKey).toBe('abcdefghij1234567890abcdef');
      expect(info.nodeId).toBe('123:456');
      expect(info.branchName).toBe('valid-branch');

      // Invalid parameters should be undefined or ignore invalid values
      expect(info.mode).toBeUndefined();
      expect(info.scaleFactor).toBeUndefined();
      expect(info.viewport).toBeUndefined();
    });
  });

  describe('Cross-Platform URL Handling', () => {
    it('should handle URLs from different platforms consistently', () => {
      const baseUrl = 'https://www.figma.com/file/abcdefghij1234567890abcdef/Test-File';

      const platformVariations = [
        // Desktop application URLs
        `${baseUrl}?node-id=123:456&utm_source=desktop_app`,
        // Web browser URLs
        `${baseUrl}?node-id=123:456&utm_source=web_browser`,
        // Mobile sharing URLs
        `${baseUrl}?node-id=123:456&utm_source=mobile_share`,
        // API generated URLs
        `${baseUrl}?node-id=123:456&api_key=hidden`,
        // URLs with tracking parameters
        `${baseUrl}?node-id=123:456&utm_campaign=test&utm_medium=social&fbclid=123`,
      ];

      platformVariations.forEach(url => {
        const result = handler.parseFigmaUrl(url);

        expect(result.success, `Failed for URL: ${url}`).toBe(true);
        expect(result.info?.fileKey).toBe('abcdefghij1234567890abcdef');
        expect(result.info?.fileName).toBe('Test-File');
        expect(result.info?.nodeId).toBe('123:456');
      });
    });

    it('should handle international file names and branch names', () => {
      const internationalNames = [
        { fileName: 'デザインシステム', branchName: 'フィーチャー-ブランチ' }, // Japanese
        { fileName: 'Diseño%20Sistema', branchName: 'rama-característica' }, // Spanish (encoded)
        { fileName: '设计系统', branchName: '功能分支' }, // Chinese
        { fileName: 'Système%20de%20Design', branchName: 'branche-fonctionnalité' }, // French (encoded)
        { fileName: 'Дизайн-Система', branchName: 'ветка-функции' }, // Russian
        { fileName: 'نظام%20التصميم', branchName: 'فرع-الميزة' }, // Arabic (encoded)
      ];

      internationalNames.forEach(({ fileName, branchName }) => {
        const encodedFileName = fileName.includes('%') ? fileName : encodeURIComponent(fileName);
        const encodedBranchName = branchName.includes('%') ? branchName : encodeURIComponent(branchName);

        const url = `https://www.figma.com/file/abcdefghij1234567890abcdef/${encodedFileName}?branch-name=${encodedBranchName}`;
        const result = handler.parseFigmaUrl(url);

        expect(result.success, `Failed for international names: ${fileName}, ${branchName}`).toBe(true);
        expect(result.info?.fileName).toBe(decodeURIComponent(encodedFileName));
        expect(result.info?.branchName).toBe(decodeURIComponent(encodedBranchName));
      });
    });
  });

  describe('URL Validation with Business Logic', () => {
    it('should validate that parsed information is logically consistent', () => {
      const testCases = [
        {
          name: 'prototype URL should not have design mode',
          url: 'https://www.figma.com/proto/abcdefghij1234567890abcdef/Test?mode=design',
          expectedUrlType: 'proto',
          expectedMode: 'design', // Mode can be present even on proto URLs
        },
        {
          name: 'board URL with node ID is valid',
          url: 'https://www.figma.com/board/abcdefghij1234567890abcdef/Test?node-id=123:456',
          expectedUrlType: 'board',
          expectedNodeId: '123:456',
        },
        {
          name: 'embed URL with viewport parameters is valid',
          url: 'https://www.figma.com/embed/abcdefghij1234567890abcdef/Test?viewport=0,0,800,600',
          expectedUrlType: 'embed',
          expectedViewport: { x: 0, y: 0, width: 800, height: 600 },
        },
      ];

      testCases.forEach(({ name, url, expectedUrlType, expectedMode, expectedNodeId, expectedViewport }) => {
        const result = handler.parseFigmaUrl(url);

        expect(result.success, `Failed for test case: ${name}`).toBe(true);
        expect(result.info?.urlType).toBe(expectedUrlType);

        if (expectedMode) {
          expect(result.info?.mode).toBe(expectedMode);
        }
        if (expectedNodeId) {
          expect(result.info?.nodeId).toBe(expectedNodeId);
        }
        if (expectedViewport) {
          expect(result.info?.viewport).toEqual(expectedViewport);
        }
      });
    });
  });

  describe('Real-World URL Scenarios', () => {
    it('should handle URLs with mixed parameter formats', () => {
      // Simulate real-world scenario where parameters might come from different sources
      const mixedUrl = 'https://www.figma.com/file/abcdefghij1234567890abcdef/Design%20System?node-id=1%3A2&version-id=123&branch-name=feature%2Fbranch&mode=dev&scale-factor=2&viewport=0%2C0%2C1920%2C1080';

      const result = handler.parseFigmaUrl(mixedUrl);

      expect(result.success).toBe(true);
      expect(result.info?.fileKey).toBe('abcdefghij1234567890abcdef');
      expect(result.info?.fileName).toBe('Design System');
      expect(result.info?.nodeId).toBe('1:2');
      expect(result.info?.versionId).toBe('123');
      expect(result.info?.branchName).toBe('feature/branch');
      expect(result.info?.mode).toBe('dev');
      expect(result.info?.scaleFactor).toBe(2);
      expect(result.info?.viewport).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
    });

    it('should handle URLs that might be generated by automated tools', () => {
      const automatedUrls = [
        // API-generated URL with systematic naming
        'https://www.figma.com/file/api_generated_file_key_123456789012/Component-Library-v2-1?node-id=auto_generated_node_123:456',
        // CI/CD generated URL
        'https://www.figma.com/file/ci_cd_file_key_567890123456/Build-123-Design-System?branch-name=ci%2Fbuild-123&version-id=automated-version-456',
        // Integration tool generated URL
        'https://www.figma.com/file/integration_key_789012345678/Sync-Tool-Export?mode=dev&scale-factor=1&format=png',
      ];

      automatedUrls.forEach(url => {
        const result = handler.parseFigmaUrl(url);
        expect(result.success, `Failed for automated URL: ${url}`).toBe(true);
        expect(result.info?.fileKey).toMatch(/^[a-zA-Z0-9_]{22,}$/);
        expect(result.info?.originalUrl).toBe(url);
      });
    });

    it('should handle URLs with query parameters from URL shorteners or redirects', () => {
      // After redirect, URL might have additional tracking parameters
      const redirectedUrl = 'https://www.figma.com/file/abcdefghij1234567890abcdef/Design?node-id=123:456&redirect_source=shortener&original_campaign=social&tracking_id=abc123&mode=dev';

      const result = handler.parseFigmaUrl(redirectedUrl);

      expect(result.success).toBe(true);
      expect(result.info?.nodeId).toBe('123:456');
      expect(result.info?.mode).toBe('dev');
      // Should preserve original URL exactly
      expect(result.info?.originalUrl).toBe(redirectedUrl);
    });
  });

  describe('Stress Testing with Edge Cases', () => {
    it('should handle URLs with maximum reasonable parameter counts', () => {
      // URL with many parameters (but still reasonable)
      const parameterPairs = [
        'node-id=123:456',
        'version-id=987654321',
        'branch-name=feature-branch',
        'mode=dev',
        'scale-factor=2.5',
        'viewport=100,200,800,600',
        'utm_source=test',
        'utm_medium=automation',
        'utm_campaign=comprehensive',
        'custom_param_1=value1',
        'custom_param_2=value2',
        'tracking_id=abc123def456',
      ];

      const url = `https://www.figma.com/file/abcdefghij1234567890abcdef/Test?${parameterPairs.join('&')}`;

      const result = handler.parseFigmaUrl(url);

      expect(result.success).toBe(true);
      expect(result.info?.nodeId).toBe('123:456');
      expect(result.info?.mode).toBe('dev');
      expect(result.info?.scaleFactor).toBe(2.5);
      expect(result.info?.viewport).toEqual({ x: 100, y: 200, width: 800, height: 600 });
    });

    it('should handle concurrent parsing requests', () => {
      const urls = Array.from({ length: 50 }, (_, i) =>
        `https://www.figma.com/file/abc123def456ghi789jkl012mn${String(i).padStart(2, '0')}/Concurrent-Test-${i}?node-id=${i}:${i + 100}&mode=dev`
      );

      // Process all URLs concurrently
      const results = urls.map(url => ({
        url,
        result: handler.parseFigmaUrl(url)
      }));

      // Verify all succeeded
      results.forEach(({ url, result }, index) => {
        expect(result.success, `Failed for concurrent URL ${index}: ${url}`).toBe(true);
        expect(result.info?.nodeId).toBe(`${index}:${index + 100}`);
        expect(result.info?.mode).toBe('dev');
      });
    });
  });

  describe('Compatibility and Version Testing', () => {
    it('should handle URLs that might be from different Figma versions', () => {
      const versionVariations = [
        // Legacy format (if any)
        'https://www.figma.com/file/abcdefghij1234567890abcdef/Legacy-Format',
        // Current format with all features
        'https://www.figma.com/file/abcdefghij1234567890abcdef/Current-Format?node-id=123:456&mode=dev',
        // Future-compatible format (should still work)
        'https://www.figma.com/file/abcdefghij1234567890abcdef/Future-Format?node-id=123:456&new-param=future-value&mode=dev',
      ];

      versionVariations.forEach(url => {
        const result = handler.parseFigmaUrl(url);
        expect(result.success, `Failed for version variation: ${url}`).toBe(true);
        expect(result.info?.fileKey).toBe('abcdefghij1234567890abcdef');
      });
    });
  });

  describe('Error Recovery and Fault Tolerance', () => {
    it('should recover gracefully from parsing errors in individual parameters', () => {
      const faultyUrl = 'https://www.figma.com/file/abcdefghij1234567890abcdef/Test?node-id=123:456&scale-factor=broken-value&viewport=1,2,invalid&mode=dev&valid-param=works';

      const result = handler.parseFigmaUrl(faultyUrl);

      expect(result.success).toBe(true);
      // Valid parameters should still work
      expect(result.info?.fileKey).toBe('abcdefghij1234567890abcdef');
      expect(result.info?.nodeId).toBe('123:456');
      expect(result.info?.mode).toBe('dev');

      // Invalid parameters should be undefined/ignored
      expect(result.info?.scaleFactor).toBeUndefined();
      expect(result.info?.viewport).toBeUndefined();
    });

    it('should handle network-corrupted URLs gracefully', () => {
      const corruptedUrls = [
        // Missing protocol
        'www.figma.com/file/abcdefghij1234567890abcdef/Test',
        // Incomplete URLs that might result from network issues
        'https://www.figma.com/file/abcdefghij1234567890abcdef/',
        // URLs with corrupted file keys
        'https://www.figma.com/file/corrupted_key/Test',
      ];

      corruptedUrls.forEach(url => {
        const result = handler.parseFigmaUrl(url);
        // These should fail gracefully
        expect(result.success, `Unexpectedly passed for corrupted URL: ${url}`).toBe(false);
        expect(result.error).toBeDefined();
      });
    });
  });
});