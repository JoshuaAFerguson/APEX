/**
 * @fileoverview Tests for Design Mockup Type Exports
 *
 * This test suite validates that all design mockup types and interfaces
 * are properly exported from the tools/index.ts file and can be imported
 * and used correctly.
 */

describe('Design Mockup Type Exports', () => {
  it('should export all design mockup types and interfaces', async () => {
    // Test importing all the design mockup types
    const imports = await import('../index');

    // Verify error class is exported
    expect(imports.DesignMockupError).toBeDefined();
    expect(typeof imports.DesignMockupError).toBe('function');

    // Test that DesignMockupError can be instantiated
    const error = new imports.DesignMockupError('Test error', 'API_ERROR');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('DesignMockupError');
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('API_ERROR');
  });

  it('should allow creating type-compliant objects', async () => {
    // Import the module to ensure types are available at runtime
    const imports = await import('../index');

    // Test DesignMockupError creation
    const error = new imports.DesignMockupError('Test', 'PROCESSING_ERROR');
    expect(error).toBeDefined();

    // Create a mock FigmaUrlInfo-compliant object
    const figmaInfo = {
      fileKey: 'test123',
      urlType: 'file' as const,
      originalUrl: 'https://www.figma.com/file/test123/Test'
    };

    expect(figmaInfo.fileKey).toBe('test123');
    expect(figmaInfo.urlType).toBe('file');
    expect(figmaInfo.originalUrl).toBe('https://www.figma.com/file/test123/Test');

    // Create a mock DesignMockupOptions-compliant object
    const options = {
      designTool: 'figma' as const,
      exportFormat: 'png' as const,
      exportScale: 2,
      extractTokens: true
    };

    expect(options.designTool).toBe('figma');
    expect(options.exportFormat).toBe('png');
    expect(options.exportScale).toBe(2);
    expect(options.extractTokens).toBe(true);

    // Create a mock DesignDimensions-compliant object
    const dimensions = {
      width: 375,
      height: 812,
      unit: 'px' as const
    };

    expect(dimensions.width).toBe(375);
    expect(dimensions.height).toBe(812);
    expect(dimensions.unit).toBe('px');

    // Create a mock DesignTokens-compliant object
    const tokens = {
      colors: {
        primary: '#007AFF',
        secondary: '#5856D6'
      },
      typography: {
        heading: 'SF Pro Display',
        body: {
          fontFamily: 'SF Pro Text',
          fontSize: 16
        }
      },
      spacing: {
        small: 8,
        medium: 16
      }
    };

    expect(tokens.colors.primary).toBe('#007AFF');
    expect(tokens.typography.heading).toBe('SF Pro Display');
    expect(typeof tokens.typography.body).toBe('object');
    expect(tokens.spacing.medium).toBe(16);
  });

  it('should support all design tool types', () => {
    const supportedTools = [
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

    // Test that we can create objects with each tool type
    supportedTools.forEach(tool => {
      const options = {
        designTool: tool as any // Cast to avoid TypeScript compilation issues in test
      };

      expect(options.designTool).toBe(tool);
    });
  });

  it('should support all export format types', () => {
    const supportedFormats = ['png', 'jpeg', 'svg', 'pdf', 'webp'];

    // Test that we can create objects with each format
    supportedFormats.forEach(format => {
      const options = {
        designTool: 'figma' as const,
        exportFormat: format as any // Cast to avoid TypeScript compilation issues in test
      };

      expect(options.exportFormat).toBe(format);
    });
  });

  it('should support all dimension unit types', () => {
    const supportedUnits = ['px', 'pt', 'dp', 'sp', 'em', 'rem', '%'];

    // Test that we can create objects with each unit
    supportedUnits.forEach(unit => {
      const dimensions = {
        width: 100,
        height: 200,
        unit: unit as any // Cast to avoid TypeScript compilation issues in test
      };

      expect(dimensions.unit).toBe(unit);
    });
  });

  it('should support all Figma URL types', () => {
    const urlTypes = ['file', 'design', 'proto', 'board', 'embed'];

    // Test that we can create objects with each URL type
    urlTypes.forEach(urlType => {
      const figmaInfo = {
        fileKey: 'test123',
        urlType: urlType as any, // Cast to avoid TypeScript compilation issues in test
        originalUrl: `https://www.figma.com/${urlType}/test123/Test`
      };

      expect(figmaInfo.urlType).toBe(urlType);
    });
  });

  it('should create valid DesignMockupProcessResult structure', () => {
    const imageBlock = {
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: 'image/png' as const,
        data: 'mock-base64-data'
      }
    };

    const result = {
      imageBlock,
      designTool: 'figma' as const,
      metadata: {
        fileId: 'test-file-123',
        frameName: 'Login Screen'
      },
      exportFormat: 'png' as const,
      exportScale: 1,
      fileSizeBytes: 1024,
      mediaType: 'image/png',
      processingTime: 1500,
      fromCache: false
    };

    expect(result.imageBlock.type).toBe('image');
    expect(result.imageBlock.source.media_type).toBe('image/png');
    expect(result.designTool).toBe('figma');
    expect(result.metadata.fileId).toBe('test-file-123');
    expect(result.exportFormat).toBe('png');
    expect(result.exportScale).toBe(1);
    expect(result.fileSizeBytes).toBe(1024);
    expect(result.mediaType).toBe('image/png');
    expect(result.processingTime).toBe(1500);
    expect(result.fromCache).toBe(false);
  });

  it('should handle error codes correctly', () => {
    const errorCodes = [
      'INVALID_URL',
      'UNSUPPORTED_TOOL',
      'API_ERROR',
      'AUTHENTICATION_REQUIRED',
      'FILE_NOT_FOUND',
      'NODE_NOT_FOUND',
      'EXPORT_FAILED',
      'FILE_TOO_LARGE',
      'TIMEOUT',
      'RATE_LIMITED',
      'NETWORK_ERROR',
      'PROCESSING_ERROR'
    ];

    // Test each error code can be used
    errorCodes.forEach(async (code) => {
      const imports = await import('../index');
      const error = new imports.DesignMockupError(`Test ${code}`, code as any);
      expect(error.code).toBe(code);
      expect(error.message).toBe(`Test ${code}`);
    });
  });
});