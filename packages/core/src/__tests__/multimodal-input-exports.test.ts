import { describe, it, expect } from 'vitest';

describe('MultimodalInput Type Exports', () => {
  it('should export all MultimodalInput types and schemas', async () => {
    // Dynamic import to test exports
    const types = await import('../types');

    // Test that all the key exports exist
    expect(types.ImageMediaTypeSchema).toBeDefined();
    expect(types.MultimodalInputTypeSchema).toBeDefined();
    expect(types.SourceMetadataSchema).toBeDefined();
    expect(types.BaseMultimodalInputSchema).toBeDefined();
    expect(types.ImageInputSchema).toBeDefined();
    expect(types.WebPageInputSchema).toBeDefined();
    expect(types.DesignToolSchema).toBeDefined();
    expect(types.DesignMockupInputSchema).toBeDefined();
    expect(types.MultimodalInputSchema).toBeDefined();
    expect(types.MultimodalInputCollectionSchema).toBeDefined();
  });

  it('should validate basic multimodal input creation', async () => {
    const { ImageInputSchema, WebPageInputSchema, DesignMockupInputSchema, MultimodalInputSchema } = await import('../types');

    // Test basic image input
    const imageInput = {
      type: 'image' as const,
      mediaType: 'image/png' as const,
      data: 'base64data'
    };
    expect(() => ImageInputSchema.parse(imageInput)).not.toThrow();
    expect(() => MultimodalInputSchema.parse(imageInput)).not.toThrow();

    // Test basic web page input
    const webPageInput = {
      type: 'web_page' as const,
      url: 'https://example.com'
    };
    expect(() => WebPageInputSchema.parse(webPageInput)).not.toThrow();
    expect(() => MultimodalInputSchema.parse(webPageInput)).not.toThrow();

    // Test basic design mockup input
    const designMockupInput = {
      type: 'design_mockup' as const,
      designTool: 'figma' as const
    };
    expect(() => DesignMockupInputSchema.parse(designMockupInput)).not.toThrow();
    expect(() => MultimodalInputSchema.parse(designMockupInput)).not.toThrow();
  });

  it('should integrate with existing type system', async () => {
    const { MultimodalInputCollectionSchema } = await import('../types');

    // Test that multimodal inputs can be used in collections
    const collection = {
      inputs: [
        {
          type: 'image' as const,
          mediaType: 'image/png' as const,
          data: 'base64data'
        }
      ]
    };

    expect(() => MultimodalInputCollectionSchema.parse(collection)).not.toThrow();
  });
});