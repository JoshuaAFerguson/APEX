import { describe, it, expect } from 'vitest';
import {
  // Base schemas and types
  ImageMediaTypeSchema,
  ImageMediaType,
  MultimodalInputTypeSchema,
  MultimodalInputType,
  SourceMetadataSchema,
  SourceMetadata,
  BaseMultimodalInputSchema,
  BaseMultimodalInput,

  // Image Input
  ImageInputSchema,
  ImageInput,

  // Web Page Input
  WebPageInputSchema,
  WebPageInput,

  // Design Tool and Mockup
  DesignToolSchema,
  DesignTool,
  DesignMockupInputSchema,
  DesignMockupInput,

  // Union and Collection
  MultimodalInputSchema,
  MultimodalInput,
  MultimodalInputCollectionSchema,
  MultimodalInputCollection,
} from '../types';

describe('MultimodalInput Types and Schemas', () => {
  describe('ImageMediaType', () => {
    it('should validate supported image media types', () => {
      const supportedTypes: ImageMediaType[] = [
        'image/png',
        'image/jpeg',
        'image/gif',
        'image/webp',
        'image/svg+xml',
        'image/bmp',
        'image/tiff'
      ];

      for (const mediaType of supportedTypes) {
        expect(ImageMediaTypeSchema.parse(mediaType)).toBe(mediaType);
      }
    });

    it('should reject unsupported media types', () => {
      const unsupportedTypes = [
        'image/ico',
        'image/x-icon',
        'text/plain',
        'application/json',
        'invalid-type'
      ];

      for (const mediaType of unsupportedTypes) {
        expect(() => ImageMediaTypeSchema.parse(mediaType)).toThrow();
      }
    });
  });

  describe('MultimodalInputType', () => {
    it('should validate supported multimodal input types', () => {
      const supportedTypes: MultimodalInputType[] = [
        'image',
        'web_page',
        'design_mockup'
      ];

      for (const type of supportedTypes) {
        expect(MultimodalInputTypeSchema.parse(type)).toBe(type);
      }
    });

    it('should reject unsupported multimodal input types', () => {
      const unsupportedTypes = [
        'video',
        'audio',
        'document',
        'unknown'
      ];

      for (const type of unsupportedTypes) {
        expect(() => MultimodalInputTypeSchema.parse(type)).toThrow();
      }
    });
  });

  describe('SourceMetadata', () => {
    it('should validate complete source metadata', () => {
      const sourceMetadata: SourceMetadata = {
        provider: 'figma',
        originalUrl: 'https://figma.com/file/abc123',
        capturedAt: new Date(),
        capturedBy: 'design-agent',
        version: '2.1.0',
        additionalInfo: {
          nodeId: '123:456',
          frameId: 'frame-abc'
        }
      };

      const result = SourceMetadataSchema.parse(sourceMetadata);
      expect(result).toEqual(sourceMetadata);
    });

    it('should validate minimal source metadata', () => {
      const minimalMetadata: SourceMetadata = {};
      const result = SourceMetadataSchema.parse(minimalMetadata);
      expect(result).toEqual(minimalMetadata);
    });

    it('should reject invalid URL in originalUrl', () => {
      const invalidMetadata = {
        originalUrl: 'not-a-valid-url'
      };

      expect(() => SourceMetadataSchema.parse(invalidMetadata)).toThrow();
    });

    it('should reject empty string provider', () => {
      const invalidMetadata = {
        provider: ''
      };

      expect(() => SourceMetadataSchema.parse(invalidMetadata)).toThrow();
    });
  });

  describe('BaseMultimodalInput', () => {
    it('should validate complete base input', () => {
      const baseInput: BaseMultimodalInput = {
        id: 'input-123',
        name: 'Test Input',
        description: 'A test multimodal input',
        source: {
          provider: 'test-provider',
          capturedBy: 'test-agent'
        },
        tags: ['test', 'example'],
        createdAt: new Date(),
        metadata: {
          customField: 'customValue',
          priority: 'high'
        }
      };

      const result = BaseMultimodalInputSchema.parse(baseInput);
      expect(result).toEqual(baseInput);
    });

    it('should validate empty base input with defaults', () => {
      const emptyInput = {};
      const result = BaseMultimodalInputSchema.parse(emptyInput);

      expect(result.tags).toEqual([]);
      expect(result.id).toBeUndefined();
      expect(result.name).toBeUndefined();
    });

    it('should apply default empty array for tags', () => {
      const inputWithoutTags = {
        name: 'Test'
      };

      const result = BaseMultimodalInputSchema.parse(inputWithoutTags);
      expect(result.tags).toEqual([]);
    });
  });

  describe('ImageInput', () => {
    it('should validate image input with base64 data', () => {
      const base64Image: ImageInput = {
        type: 'image',
        name: 'screenshot.png',
        mediaType: 'image/png',
        data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        encoding: 'base64',
        width: 1920,
        height: 1080,
        fileSize: 1024,
        altText: 'A test screenshot'
      };

      const result = ImageInputSchema.parse(base64Image);
      expect(result).toEqual(base64Image);
    });

    it('should validate image input with URL', () => {
      const urlImage: ImageInput = {
        type: 'image',
        name: 'product-photo.jpg',
        mediaType: 'image/jpeg',
        url: 'https://example.com/images/product.jpg',
        width: 800,
        height: 600,
        altText: 'Product photo'
      };

      const result = ImageInputSchema.parse(urlImage);
      expect(result).toEqual(urlImage);
    });

    it('should validate minimal image input', () => {
      const minimalImage: ImageInput = {
        type: 'image',
        mediaType: 'image/png',
        data: 'base64data'
      };

      const result = ImageInputSchema.parse(minimalImage);
      expect(result.type).toBe('image');
      expect(result.mediaType).toBe('image/png');
      expect(result.data).toBe('base64data');
    });

    it('should reject image without data or url', () => {
      const invalidImage = {
        type: 'image',
        mediaType: 'image/png'
        // Missing both data and url
      };

      expect(() => ImageInputSchema.parse(invalidImage)).toThrow(
        /Either data \(base64\) or url must be provided/
      );
    });

    it('should reject image with both data and url', () => {
      const invalidImage = {
        type: 'image',
        mediaType: 'image/png',
        data: 'base64data',
        url: 'https://example.com/image.png'
      };

      expect(() => ImageInputSchema.parse(invalidImage)).toThrow(
        /Provide either data or url, not both/
      );
    });

    it('should reject invalid media type', () => {
      const invalidImage = {
        type: 'image',
        mediaType: 'text/plain',
        data: 'base64data'
      };

      expect(() => ImageInputSchema.parse(invalidImage)).toThrow();
    });

    it('should reject negative dimensions', () => {
      const invalidImage = {
        type: 'image',
        mediaType: 'image/png',
        data: 'base64data',
        width: -100,
        height: 200
      };

      expect(() => ImageInputSchema.parse(invalidImage)).toThrow();
    });

    it('should reject zero dimensions', () => {
      const invalidImage = {
        type: 'image',
        mediaType: 'image/png',
        data: 'base64data',
        width: 0,
        height: 200
      };

      expect(() => ImageInputSchema.parse(invalidImage)).toThrow();
    });

    it('should reject invalid URL format', () => {
      const invalidImage = {
        type: 'image',
        mediaType: 'image/png',
        url: 'not-a-valid-url'
      };

      expect(() => ImageInputSchema.parse(invalidImage)).toThrow();
    });
  });

  describe('WebPageInput', () => {
    it('should validate complete web page input', () => {
      const webPage: WebPageInput = {
        type: 'web_page',
        name: 'Product Landing Page',
        url: 'https://example.com/products/widget',
        title: 'Amazing Widget - Example Corp',
        capturedHtml: '<html><body><h1>Amazing Widget</h1></body></html>',
        capturedText: 'Amazing Widget\nThe best widget for your needs.',
        capturedMarkdown: '# Amazing Widget\n\nThe best widget for your needs.',
        screenshot: {
          type: 'image',
          mediaType: 'image/png',
          data: 'base64screenshotdata',
          width: 1920,
          height: 1080
        },
        viewport: { width: 1920, height: 1080 },
        statusCode: 200,
        headers: {
          'content-type': 'text/html',
          'server': 'nginx'
        },
        capturedAt: new Date(),
        jsExecuted: true,
        links: [
          {
            href: 'https://example.com/about',
            text: 'About Us',
            rel: 'internal'
          }
        ],
        loadMetrics: {
          ttfb: 150,
          domContentLoaded: 800,
          loadComplete: 1200
        }
      };

      const result = WebPageInputSchema.parse(webPage);
      expect(result).toEqual(webPage);
    });

    it('should validate minimal web page input', () => {
      const minimalWebPage: WebPageInput = {
        type: 'web_page',
        url: 'https://example.com'
      };

      const result = WebPageInputSchema.parse(minimalWebPage);
      expect(result.type).toBe('web_page');
      expect(result.url).toBe('https://example.com');
      expect(result.jsExecuted).toBe(false); // Default value
    });

    it('should reject invalid URL', () => {
      const invalidWebPage = {
        type: 'web_page',
        url: 'not-a-valid-url'
      };

      expect(() => WebPageInputSchema.parse(invalidWebPage)).toThrow();
    });

    it('should reject negative viewport dimensions', () => {
      const invalidWebPage = {
        type: 'web_page',
        url: 'https://example.com',
        viewport: { width: -1920, height: 1080 }
      };

      expect(() => WebPageInputSchema.parse(invalidWebPage)).toThrow();
    });

    it('should reject zero viewport dimensions', () => {
      const invalidWebPage = {
        type: 'web_page',
        url: 'https://example.com',
        viewport: { width: 0, height: 1080 }
      };

      expect(() => WebPageInputSchema.parse(invalidWebPage)).toThrow();
    });

    it('should reject negative load metrics', () => {
      const invalidWebPage = {
        type: 'web_page',
        url: 'https://example.com',
        loadMetrics: {
          ttfb: -150,
          domContentLoaded: 800
        }
      };

      expect(() => WebPageInputSchema.parse(invalidWebPage)).toThrow();
    });

    it('should validate screenshot without nested refinements', () => {
      const webPageWithScreenshot: WebPageInput = {
        type: 'web_page',
        url: 'https://example.com',
        screenshot: {
          type: 'image',
          mediaType: 'image/png',
          data: 'base64data'
        }
      };

      const result = WebPageInputSchema.parse(webPageWithScreenshot);
      expect(result.screenshot?.type).toBe('image');
      expect(result.screenshot?.mediaType).toBe('image/png');
    });
  });

  describe('DesignTool', () => {
    it('should validate supported design tools', () => {
      const supportedTools: DesignTool[] = [
        'figma',
        'sketch',
        'adobe_xd',
        'invision',
        'zeplin',
        'framer',
        'canva',
        'photoshop',
        'illustrator',
        'other'
      ];

      for (const tool of supportedTools) {
        expect(DesignToolSchema.parse(tool)).toBe(tool);
      }
    });

    it('should reject unsupported design tools', () => {
      const unsupportedTools = [
        'blender',
        'maya',
        'unity',
        'unreal'
      ];

      for (const tool of unsupportedTools) {
        expect(() => DesignToolSchema.parse(tool)).toThrow();
      }
    });
  });

  describe('DesignMockupInput', () => {
    it('should validate complete design mockup input', () => {
      const mockup: DesignMockupInput = {
        type: 'design_mockup',
        name: 'Login Screen - Mobile',
        designTool: 'figma',
        fileId: 'abc123xyz',
        nodeId: '123:456',
        fileUrl: 'https://figma.com/file/abc123xyz/Login-Screens',
        exportedImage: {
          type: 'image',
          mediaType: 'image/png',
          data: 'base64exportedimage',
          width: 375,
          height: 812
        },
        exportFormat: 'png',
        exportScale: 2,
        frameName: 'Login - iPhone 14',
        pageName: 'Mobile Screens',
        designDimensions: {
          width: 375,
          height: 812,
          unit: 'px'
        },
        designTokens: {
          colors: {
            primary: '#007AFF',
            secondary: '#5856D6'
          },
          typography: {
            heading: 'SF Pro Display',
            body: 'SF Pro Text'
          },
          spacing: {
            small: 8,
            medium: 16,
            large: 24
          },
          borderRadius: {
            button: 8,
            card: 12
          },
          shadows: {
            card: '0 2px 8px rgba(0,0,0,0.1)'
          }
        },
        components: [
          {
            name: 'Button',
            id: 'btn-123',
            type: 'interactive',
            bounds: { x: 50, y: 100, width: 275, height: 44 }
          }
        ],
        fileVersion: 'v1.2.3',
        lastModified: new Date(),
        collaborators: ['designer@example.com', 'dev@example.com'],
        annotations: [
          {
            id: 'note-1',
            text: 'Make sure this button is accessible',
            author: 'designer@example.com',
            position: { x: 100, y: 150 },
            createdAt: new Date()
          }
        ]
      };

      const result = DesignMockupInputSchema.parse(mockup);
      expect(result).toEqual(mockup);
    });

    it('should validate minimal design mockup input', () => {
      const minimalMockup: DesignMockupInput = {
        type: 'design_mockup',
        designTool: 'figma'
      };

      const result = DesignMockupInputSchema.parse(minimalMockup);
      expect(result.type).toBe('design_mockup');
      expect(result.designTool).toBe('figma');
    });

    it('should validate complex typography design tokens', () => {
      const mockupWithComplexTokens: DesignMockupInput = {
        type: 'design_mockup',
        designTool: 'figma',
        designTokens: {
          typography: {
            heading: {
              fontFamily: 'Inter',
              fontSize: 24,
              fontWeight: 600,
              lineHeight: 1.2,
              letterSpacing: -0.5
            },
            body: 'Roboto'
          }
        }
      };

      const result = DesignMockupInputSchema.parse(mockupWithComplexTokens);
      expect(result.designTokens?.typography?.heading).toEqual({
        fontFamily: 'Inter',
        fontSize: 24,
        fontWeight: 600,
        lineHeight: 1.2,
        letterSpacing: -0.5
      });
      expect(result.designTokens?.typography?.body).toBe('Roboto');
    });

    it('should reject invalid export scale', () => {
      const invalidMockup = {
        type: 'design_mockup',
        designTool: 'figma',
        exportScale: 15 // Above max of 10
      };

      expect(() => DesignMockupInputSchema.parse(invalidMockup)).toThrow();
    });

    it('should reject negative design dimensions', () => {
      const invalidMockup = {
        type: 'design_mockup',
        designTool: 'figma',
        designDimensions: {
          width: -375,
          height: 812
        }
      };

      expect(() => DesignMockupInputSchema.parse(invalidMockup)).toThrow();
    });

    it('should reject invalid file URL', () => {
      const invalidMockup = {
        type: 'design_mockup',
        designTool: 'figma',
        fileUrl: 'not-a-valid-url'
      };

      expect(() => DesignMockupInputSchema.parse(invalidMockup)).toThrow();
    });

    it('should validate all supported export formats', () => {
      const formats = ['png', 'jpeg', 'svg', 'pdf', 'webp'];

      for (const format of formats) {
        const mockup = {
          type: 'design_mockup' as const,
          designTool: 'figma' as const,
          exportFormat: format as any
        };

        expect(() => DesignMockupInputSchema.parse(mockup)).not.toThrow();
      }
    });

    it('should validate all supported design dimension units', () => {
      const units = ['px', 'pt', 'dp', 'sp', 'em', 'rem', '%'];

      for (const unit of units) {
        const mockup = {
          type: 'design_mockup' as const,
          designTool: 'figma' as const,
          designDimensions: {
            width: 100,
            height: 100,
            unit: unit as any
          }
        };

        expect(() => DesignMockupInputSchema.parse(mockup)).not.toThrow();
      }
    });
  });

  describe('MultimodalInput Discriminated Union', () => {
    it('should correctly discriminate image inputs', () => {
      const imageInput: MultimodalInput = {
        type: 'image',
        mediaType: 'image/png',
        data: 'base64data'
      };

      const result = MultimodalInputSchema.parse(imageInput);
      expect(result.type).toBe('image');

      // Type narrowing should work
      if (result.type === 'image') {
        expect(result.mediaType).toBe('image/png');
        expect(result.data).toBe('base64data');
      }
    });

    it('should correctly discriminate web page inputs', () => {
      const webPageInput: MultimodalInput = {
        type: 'web_page',
        url: 'https://example.com'
      };

      const result = MultimodalInputSchema.parse(webPageInput);
      expect(result.type).toBe('web_page');

      // Type narrowing should work
      if (result.type === 'web_page') {
        expect(result.url).toBe('https://example.com');
        expect(result.jsExecuted).toBe(false);
      }
    });

    it('should correctly discriminate design mockup inputs', () => {
      const mockupInput: MultimodalInput = {
        type: 'design_mockup',
        designTool: 'figma'
      };

      const result = MultimodalInputSchema.parse(mockupInput);
      expect(result.type).toBe('design_mockup');

      // Type narrowing should work
      if (result.type === 'design_mockup') {
        expect(result.designTool).toBe('figma');
      }
    });

    it('should reject invalid discriminator type', () => {
      const invalidInput = {
        type: 'video', // Not supported
        url: 'https://example.com/video.mp4'
      };

      expect(() => MultimodalInputSchema.parse(invalidInput)).toThrow();
    });

    it('should reject input with mismatched type and properties', () => {
      const mismatchedInput = {
        type: 'image',
        url: 'https://example.com', // Web page property
        // Missing required image properties
      };

      expect(() => MultimodalInputSchema.parse(mismatchedInput)).toThrow();
    });
  });

  describe('MultimodalInputCollection', () => {
    it('should validate complete input collection', () => {
      const collection: MultimodalInputCollection = {
        inputs: [
          {
            type: 'design_mockup',
            designTool: 'figma',
            name: 'Login Screen'
          },
          {
            type: 'web_page',
            url: 'https://example.com',
            name: 'Reference Site'
          },
          {
            type: 'image',
            mediaType: 'image/png',
            data: 'base64data',
            name: 'User Flow Diagram'
          }
        ],
        context: 'Implement the login screen based on the Figma mockup and reference site',
        primaryInputIndex: 0,
        processingOrder: 'sequential',
        createdAt: new Date(),
        metadata: {
          taskId: 'task-123',
          priority: 'high'
        }
      };

      const result = MultimodalInputCollectionSchema.parse(collection);
      expect(result).toEqual(collection);
    });

    it('should validate minimal input collection', () => {
      const minimalCollection: MultimodalInputCollection = {
        inputs: [
          {
            type: 'image',
            mediaType: 'image/png',
            data: 'base64data'
          }
        ]
      };

      const result = MultimodalInputCollectionSchema.parse(minimalCollection);
      expect(result.inputs).toHaveLength(1);
      expect(result.processingOrder).toBe('sequential'); // Default value
    });

    it('should reject empty inputs array', () => {
      const invalidCollection = {
        inputs: []
      };

      expect(() => MultimodalInputCollectionSchema.parse(invalidCollection)).toThrow(
        /At least one input is required/
      );
    });

    it('should reject invalid processing order', () => {
      const invalidCollection = {
        inputs: [
          {
            type: 'image',
            mediaType: 'image/png',
            data: 'base64data'
          }
        ],
        processingOrder: 'invalid-order'
      };

      expect(() => MultimodalInputCollectionSchema.parse(invalidCollection)).toThrow();
    });

    it('should reject negative primary input index', () => {
      const invalidCollection = {
        inputs: [
          {
            type: 'image',
            mediaType: 'image/png',
            data: 'base64data'
          }
        ],
        primaryInputIndex: -1
      };

      expect(() => MultimodalInputCollectionSchema.parse(invalidCollection)).toThrow();
    });

    it('should validate all supported processing orders', () => {
      const orders = ['sequential', 'parallel', 'priority'];

      for (const order of orders) {
        const collection = {
          inputs: [
            {
              type: 'image' as const,
              mediaType: 'image/png' as const,
              data: 'base64data'
            }
          ],
          processingOrder: order as any
        };

        expect(() => MultimodalInputCollectionSchema.parse(collection)).not.toThrow();
      }
    });
  });

  describe('Edge Cases and Integration', () => {
    it('should handle complex nested structures', () => {
      const complexInput: MultimodalInput = {
        type: 'web_page',
        id: 'complex-page-123',
        name: 'Complex Landing Page',
        description: 'A comprehensive analysis target',
        url: 'https://example.com/complex',
        title: 'Complex Page Title',
        source: {
          provider: 'browser-automation',
          originalUrl: 'https://example.com/complex',
          capturedAt: new Date(),
          capturedBy: 'web-scraper-agent',
          version: '1.0.0',
          additionalInfo: {
            userAgent: 'Mozilla/5.0...',
            sessionId: 'session-123'
          }
        },
        tags: ['analysis', 'reference', 'complex'],
        createdAt: new Date(),
        metadata: {
          analysisType: 'comprehensive',
          priority: 'high',
          estimatedTokens: 5000
        },
        screenshot: {
          type: 'image',
          mediaType: 'image/png',
          data: 'very-long-base64-screenshot-data',
          width: 1920,
          height: 1080,
          fileSize: 150000,
          altText: 'Screenshot of complex landing page'
        },
        viewport: { width: 1920, height: 1080 },
        statusCode: 200,
        jsExecuted: true,
        links: [
          { href: 'https://example.com/about', text: 'About' },
          { href: 'https://example.com/contact', text: 'Contact' }
        ],
        loadMetrics: {
          ttfb: 200,
          domContentLoaded: 1500,
          loadComplete: 3000
        }
      };

      expect(() => MultimodalInputSchema.parse(complexInput)).not.toThrow();
    });

    it('should validate input collection with mixed types', () => {
      const mixedCollection: MultimodalInputCollection = {
        inputs: [
          {
            type: 'image',
            mediaType: 'image/jpeg',
            url: 'https://example.com/hero.jpg',
            name: 'Hero Image'
          },
          {
            type: 'web_page',
            url: 'https://competitor.com',
            name: 'Competitor Analysis'
          },
          {
            type: 'design_mockup',
            designTool: 'sketch',
            fileId: 'sketch-file-123',
            name: 'Initial Concept'
          }
        ],
        context: 'Multi-modal competitive analysis',
        processingOrder: 'parallel'
      };

      const result = MultimodalInputCollectionSchema.parse(mixedCollection);
      expect(result.inputs).toHaveLength(3);
      expect(result.inputs[0].type).toBe('image');
      expect(result.inputs[1].type).toBe('web_page');
      expect(result.inputs[2].type).toBe('design_mockup');
    });

    it('should preserve type safety across transformations', () => {
      const originalInput: ImageInput = {
        type: 'image',
        mediaType: 'image/png',
        data: 'base64data',
        width: 1920,
        height: 1080
      };

      // Parse as specific type
      const specificResult = ImageInputSchema.parse(originalInput);
      expect(specificResult.type).toBe('image');
      expect(specificResult.width).toBe(1920);

      // Parse as union type
      const unionResult = MultimodalInputSchema.parse(originalInput);
      expect(unionResult.type).toBe('image');

      // Type narrowing should work correctly
      if (unionResult.type === 'image') {
        expect(unionResult.width).toBe(1920);
        expect(unionResult.mediaType).toBe('image/png');
      }
    });
  });
});