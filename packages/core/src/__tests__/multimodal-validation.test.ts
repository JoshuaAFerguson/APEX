import { describe, it, expect } from 'vitest';
import {
  ImageInput,
  WebPageInput,
  DesignMockupInput,
  MultimodalInput,
  ImageInputSchema,
  WebPageInputSchema,
  DesignMockupInputSchema,
  MultimodalInputSchema,
} from '../types';

describe('Multimodal Input Validation', () => {
  describe('ImageInput Validation', () => {
    it('should validate image with URL source', () => {
      const imageWithUrl: ImageInput = {
        type: 'image',
        mediaType: 'image/jpeg',
        url: 'https://example.com/image.jpg',
        altText: 'Example image',
        name: 'example.jpg',
        description: 'An example image for testing',
      };

      expect(() => ImageInputSchema.parse(imageWithUrl)).not.toThrow();
    });

    it('should validate image with base64 data', () => {
      const imageWithData: ImageInput = {
        type: 'image',
        mediaType: 'image/png',
        data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        encoding: 'base64',
        name: 'pixel.png',
        description: '1x1 transparent pixel',
      };

      expect(() => ImageInputSchema.parse(imageWithData)).not.toThrow();
    });

    it('should validate supported media types', () => {
      const supportedTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/bmp',
        'image/webp',
        'image/svg+xml',
        'image/tiff',
      ];

      supportedTypes.forEach(mediaType => {
        const image: ImageInput = {
          type: 'image',
          mediaType,
          url: 'https://example.com/test.jpg',
        };

        expect(() => ImageInputSchema.parse(image)).not.toThrow();
      });
    });

    it('should reject unsupported media types', () => {
      const unsupportedTypes = [
        'text/plain',
        'application/pdf',
        'video/mp4',
        'audio/mpeg',
        'application/json',
      ];

      unsupportedTypes.forEach(mediaType => {
        const image = {
          type: 'image',
          mediaType,
          url: 'https://example.com/test.jpg',
        };

        expect(() => ImageInputSchema.parse(image)).toThrow();
      });
    });

    it('should validate encoding types', () => {
      const supportedEncodings = ['base64', 'binary', 'url'];

      supportedEncodings.forEach(encoding => {
        const image: ImageInput = {
          type: 'image',
          mediaType: 'image/png',
          data: 'test-data',
          encoding,
        };

        expect(() => ImageInputSchema.parse(image)).not.toThrow();
      });
    });

    it('should reject invalid encoding types', () => {
      const image = {
        type: 'image',
        mediaType: 'image/png',
        data: 'test-data',
        encoding: 'invalid-encoding',
      };

      expect(() => ImageInputSchema.parse(image)).toThrow();
    });

    it('should handle very long descriptions', () => {
      const longDescription = 'A'.repeat(5000);
      const image: ImageInput = {
        type: 'image',
        mediaType: 'image/png',
        url: 'https://example.com/test.png',
        description: longDescription,
      };

      expect(() => ImageInputSchema.parse(image)).not.toThrow();
    });

    it('should handle special characters in names and descriptions', () => {
      const image: ImageInput = {
        type: 'image',
        mediaType: 'image/png',
        url: 'https://example.com/test.png',
        name: 'émage with spéçial chars & symbols!@#$%^&*()_+-={}[]|\\:";\'<>?,./`~',
        description: 'Description with\nnewlines\tand\ttabs and unicode: 🎨✨🚀',
      };

      expect(() => ImageInputSchema.parse(image)).not.toThrow();
    });

    it('should validate complex metadata structures', () => {
      const image: ImageInput = {
        type: 'image',
        mediaType: 'image/jpeg',
        url: 'https://example.com/photo.jpg',
        metadata: {
          camera: {
            make: 'Canon',
            model: 'EOS 5D Mark IV',
            settings: {
              iso: 800,
              aperture: 'f/2.8',
              shutter: '1/250',
            },
          },
          location: {
            latitude: 40.7128,
            longitude: -74.0060,
            city: 'New York',
          },
          tags: ['portrait', 'professional', 'studio'],
          processing: {
            edited: true,
            filters: ['brightness', 'contrast'],
          },
        },
      };

      expect(() => ImageInputSchema.parse(image)).not.toThrow();
    });
  });

  describe('WebPageInput Validation', () => {
    it('should validate basic web page input', () => {
      const webPage: WebPageInput = {
        type: 'web_page',
        url: 'https://example.com',
        title: 'Example Website',
      };

      expect(() => WebPageInputSchema.parse(webPage)).not.toThrow();
    });

    it('should validate various URL formats', () => {
      const urls = [
        'http://example.com',
        'https://example.com',
        'https://www.example.com',
        'https://subdomain.example.com',
        'https://example.com/path',
        'https://example.com/path/to/page',
        'https://example.com:8080',
        'https://example.com:8080/path',
        'https://example.com/path?query=value',
        'https://example.com/path?query=value&other=data',
        'https://example.com/path?query=value#fragment',
        'https://user:pass@example.com',
        'https://user:pass@example.com:8080/path?query=value#fragment',
        'http://localhost',
        'http://localhost:3000',
        'https://127.0.0.1:8080',
        'https://[::1]:8080',
      ];

      urls.forEach(url => {
        const webPage: WebPageInput = {
          type: 'web_page',
          url,
        };

        expect(() => WebPageInputSchema.parse(webPage)).not.toThrow();
      });
    });

    it('should handle very long URLs', () => {
      const longUrl = 'https://example.com/' + 'x'.repeat(2000) + '.html';
      const webPage: WebPageInput = {
        type: 'web_page',
        url: longUrl,
      };

      expect(() => WebPageInputSchema.parse(webPage)).not.toThrow();
    });

    it('should handle empty captured text', () => {
      const webPage: WebPageInput = {
        type: 'web_page',
        url: 'https://example.com',
        capturedText: '',
      };

      expect(() => WebPageInputSchema.parse(webPage)).not.toThrow();
    });

    it('should handle very long captured text', () => {
      const longText = 'Lorem ipsum '.repeat(10000); // ~100KB text
      const webPage: WebPageInput = {
        type: 'web_page',
        url: 'https://example.com',
        capturedText: longText,
      };

      expect(() => WebPageInputSchema.parse(webPage)).not.toThrow();
    });

    it('should handle HTML entities and special characters in captured text', () => {
      const htmlContent = `
        <h1>Welcome to Our Site</h1>
        <p>This page contains &amp; entities &lt;&gt; and special chars: ©™®</p>
        <code>function test() { return "hello"; }</code>
        Unicode: 🌟✨🎯 and emojis!
      `;

      const webPage: WebPageInput = {
        type: 'web_page',
        url: 'https://example.com',
        capturedText: htmlContent,
      };

      expect(() => WebPageInputSchema.parse(webPage)).not.toThrow();
    });

    it('should validate capture timestamp', () => {
      const webPage: WebPageInput = {
        type: 'web_page',
        url: 'https://example.com',
        capturedAt: new Date(),
      };

      expect(() => WebPageInputSchema.parse(webPage)).not.toThrow();
    });

    it('should handle structured metadata', () => {
      const webPage: WebPageInput = {
        type: 'web_page',
        url: 'https://ecommerce.example.com/product/123',
        title: 'Amazing Product - Shop Now',
        capturedText: 'Product details, price $99.99, buy now button',
        metadata: {
          pageType: 'product',
          product: {
            id: '123',
            price: 99.99,
            inStock: true,
            category: 'electronics',
          },
          seo: {
            metaDescription: 'Buy amazing product at great price',
            keywords: ['product', 'electronics', 'sale'],
          },
          analytics: {
            sessionId: 'sess_abc123',
            userId: 'user_456',
            referrer: 'google.com',
          },
        },
      };

      expect(() => WebPageInputSchema.parse(webPage)).not.toThrow();
    });
  });

  describe('DesignMockupInput Validation', () => {
    it('should validate all supported design tools', () => {
      const tools = ['figma', 'sketch', 'adobe_xd', 'invision', 'penpot', 'canva', 'other'];

      tools.forEach(designTool => {
        const mockup: DesignMockupInput = {
          type: 'design_mockup',
          designTool,
        };

        expect(() => DesignMockupInputSchema.parse(mockup)).not.toThrow();
      });
    });

    it('should reject invalid design tools', () => {
      const invalidTools = ['photoshop', 'illustrator', 'gimp', 'paint'];

      invalidTools.forEach(designTool => {
        const mockup = {
          type: 'design_mockup',
          designTool,
        };

        expect(() => DesignMockupInputSchema.parse(mockup)).toThrow();
      });
    });

    it('should validate Figma-specific fields', () => {
      const figmaMockup: DesignMockupInput = {
        type: 'design_mockup',
        designTool: 'figma',
        fileId: 'abc123def456ghi789',
        nodeId: 'frame-login-screen',
        fileUrl: 'https://www.figma.com/file/abc123def456ghi789/Login-Screen-Design',
        name: 'Login Screen V2',
        description: 'Updated login screen with dark mode support',
      };

      expect(() => DesignMockupInputSchema.parse(figmaMockup)).not.toThrow();
    });

    it('should validate Sketch-specific fields', () => {
      const sketchMockup: DesignMockupInput = {
        type: 'design_mockup',
        designTool: 'sketch',
        fileUrl: 'https://sketch.cloud/s/abc123/mobile-app-design',
        name: 'Mobile App Screens',
        version: '2.1',
      };

      expect(() => DesignMockupInputSchema.parse(sketchMockup)).not.toThrow();
    });

    it('should validate Adobe XD-specific fields', () => {
      const xdMockup: DesignMockupInput = {
        type: 'design_mockup',
        designTool: 'adobe_xd',
        fileUrl: 'https://xd.adobe.com/view/abc123def456/',
        name: 'Website Redesign',
        artboardId: 'artboard-homepage',
      };

      expect(() => DesignMockupInputSchema.parse(xdMockup)).not.toThrow();
    });

    it('should handle design with version information', () => {
      const versionedMockup: DesignMockupInput = {
        type: 'design_mockup',
        designTool: 'figma',
        fileId: 'design123',
        version: 'v3.2.1',
        name: 'Dashboard Design',
        description: 'Latest version with new navigation',
      };

      expect(() => DesignMockupInputSchema.parse(versionedMockup)).not.toThrow();
    });

    it('should handle collaborative design metadata', () => {
      const collaborativeMockup: DesignMockupInput = {
        type: 'design_mockup',
        designTool: 'figma',
        fileId: 'collab456',
        name: 'Team Design System',
        metadata: {
          collaboration: {
            editors: ['designer1@example.com', 'designer2@example.com'],
            lastModified: new Date().toISOString(),
            comments: 15,
            status: 'review',
          },
          designSystem: {
            components: ['buttons', 'forms', 'navigation'],
            colorPalette: ['#007bff', '#6c757d', '#28a745'],
            typography: ['Roboto', 'Inter'],
          },
          export: {
            format: 'png',
            scale: '2x',
            includeAssets: true,
          },
        },
      };

      expect(() => DesignMockupInputSchema.parse(collaborativeMockup)).not.toThrow();
    });

    it('should handle missing optional fields', () => {
      const minimalMockup: DesignMockupInput = {
        type: 'design_mockup',
        designTool: 'other',
        // Only required fields
      };

      expect(() => DesignMockupInputSchema.parse(minimalMockup)).not.toThrow();
    });

    it('should handle very long file URLs', () => {
      const longUrl = 'https://example.com/' + 'x'.repeat(1500) + '/design';
      const mockup: DesignMockupInput = {
        type: 'design_mockup',
        designTool: 'other',
        fileUrl: longUrl,
      };

      expect(() => DesignMockupInputSchema.parse(mockup)).not.toThrow();
    });
  });

  describe('Discriminated Union Behavior', () => {
    it('should correctly parse different input types', () => {
      const inputs: MultimodalInput[] = [
        {
          type: 'image',
          mediaType: 'image/png',
          url: 'https://example.com/image.png',
        },
        {
          type: 'web_page',
          url: 'https://example.com/page',
        },
        {
          type: 'design_mockup',
          designTool: 'figma',
          fileId: 'abc123',
        },
      ];

      inputs.forEach(input => {
        expect(() => MultimodalInputSchema.parse(input)).not.toThrow();
      });

      // TypeScript type narrowing verification
      inputs.forEach(input => {
        if (input.type === 'image') {
          expect(input.mediaType).toBeDefined();
        } else if (input.type === 'web_page') {
          expect(input.url).toBeDefined();
        } else if (input.type === 'design_mockup') {
          expect(input.designTool).toBeDefined();
        }
      });
    });

    it('should reject mixed type properties', () => {
      // This should fail because image type can't have designTool property
      const invalidMixed = {
        type: 'image',
        mediaType: 'image/png',
        designTool: 'figma', // Invalid for image type
      };

      expect(() => MultimodalInputSchema.parse(invalidMixed)).toThrow();
    });

    it('should validate type-specific required fields', () => {
      // Image without mediaType should fail
      const imageWithoutMediaType = {
        type: 'image',
        url: 'https://example.com/image.jpg',
        // Missing mediaType
      };

      expect(() => MultimodalInputSchema.parse(imageWithoutMediaType)).toThrow();

      // Web page without URL should fail
      const webPageWithoutUrl = {
        type: 'web_page',
        title: 'Some Page',
        // Missing url
      };

      expect(() => MultimodalInputSchema.parse(webPageWithoutUrl)).toThrow();

      // Design mockup without designTool should fail
      const mockupWithoutTool = {
        type: 'design_mockup',
        name: 'Some Design',
        // Missing designTool
      };

      expect(() => MultimodalInputSchema.parse(mockupWithoutTool)).toThrow();
    });
  });

  describe('Boundary Value Testing', () => {
    it('should handle empty string values', () => {
      const inputsWithEmptyStrings = [
        {
          type: 'image' as const,
          mediaType: 'image/png',
          url: 'https://example.com/image.png',
          name: '', // Empty string
          description: '', // Empty string
          altText: '', // Empty string
        },
        {
          type: 'web_page' as const,
          url: 'https://example.com',
          title: '', // Empty string
          capturedText: '', // Empty string
        },
        {
          type: 'design_mockup' as const,
          designTool: 'figma',
          name: '', // Empty string
          description: '', // Empty string
        },
      ];

      inputsWithEmptyStrings.forEach(input => {
        expect(() => MultimodalInputSchema.parse(input)).not.toThrow();
      });
    });

    it('should handle null and undefined metadata', () => {
      const inputs = [
        {
          type: 'image' as const,
          mediaType: 'image/png',
          url: 'https://example.com/image.png',
          metadata: undefined, // Should be allowed
        },
        {
          type: 'web_page' as const,
          url: 'https://example.com',
          metadata: {}, // Empty object should be allowed
        },
      ];

      inputs.forEach(input => {
        expect(() => MultimodalInputSchema.parse(input)).not.toThrow();
      });
    });

    it('should handle various timestamp formats', () => {
      const webPageWithDifferentTimestamps = [
        {
          type: 'web_page' as const,
          url: 'https://example.com',
          capturedAt: new Date(), // Current date
        },
        {
          type: 'web_page' as const,
          url: 'https://example.com',
          capturedAt: new Date('2024-01-01T00:00:00Z'), // Specific date
        },
        {
          type: 'web_page' as const,
          url: 'https://example.com',
          capturedAt: new Date(0), // Epoch
        },
      ];

      webPageWithDifferentTimestamps.forEach(input => {
        expect(() => WebPageInputSchema.parse(input)).not.toThrow();
      });
    });
  });
});