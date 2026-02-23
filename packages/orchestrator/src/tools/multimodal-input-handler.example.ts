/**
 * Example Usage of MultimodalInputHandler
 *
 * This file demonstrates how to use the MultimodalInputHandler class
 * to process image files for use with Claude SDK.
 */

import { MultimodalInputHandler, processImageFile, type ImageProcessResult } from './multimodal-input-handler';

async function basicUsage() {
  console.log('=== Basic Usage ===');

  try {
    // Simple usage with default configuration
    const result = await processImageFile('/path/to/image.png');

    console.log('File processed successfully:');
    console.log(`- Media Type: ${result.mediaType}`);
    console.log(`- File Size: ${result.fileSizeBytes} bytes`);
    console.log(`- Base64 length: ${result.imageBlock.source.data.length} characters`);

    // The imageBlock can now be used directly with Claude SDK
    console.log('Claude SDK structure:', {
      type: result.imageBlock.type,
      source: {
        type: result.imageBlock.source.type,
        media_type: result.imageBlock.source.media_type,
        data: `${result.imageBlock.source.data.slice(0, 50)}...` // Truncated for display
      }
    });

  } catch (error) {
    console.error('Failed to process image:', error);
  }
}

async function customConfigurationUsage() {
  console.log('\n=== Custom Configuration Usage ===');

  // Create handler with custom settings
  const handler = new MultimodalInputHandler({
    maxFileSizeBytes: 10 * 1024 * 1024, // 10MB limit
    supportedFormats: ['png', 'jpg'] // Only PNG and JPEG
  });

  try {
    const result = await handler.processImageFile('/path/to/large-image.jpg');
    console.log('Custom handler processed file successfully');
    console.log(`Configuration: ${JSON.stringify(handler.getConfig(), null, 2)}`);

  } catch (error) {
    console.error('Custom handler failed:', error);
  }
}

async function batchProcessing() {
  console.log('\n=== Batch Processing ===');

  const imagePaths = [
    '/path/to/image1.png',
    '/path/to/image2.jpg',
    '/path/to/image3.gif',
    '/path/to/image4.webp'
  ];

  const handler = new MultimodalInputHandler();
  const results: ImageProcessResult[] = [];

  for (const imagePath of imagePaths) {
    try {
      if (handler.isSupportedFormat(imagePath)) {
        const result = await handler.processImageFile(imagePath);
        results.push(result);
        console.log(`✓ Processed ${imagePath}: ${result.mediaType}, ${result.fileSizeBytes} bytes`);
      } else {
        console.log(`✗ Skipped ${imagePath}: unsupported format`);
      }
    } catch (error) {
      console.error(`✗ Failed ${imagePath}:`, error);
    }
  }

  console.log(`Successfully processed ${results.length} images`);
  return results;
}

async function claudeSdkIntegration() {
  console.log('\n=== Claude SDK Integration Example ===');

  try {
    const imageResult = await processImageFile('/path/to/screenshot.png');

    // Example of how this would be used with Claude SDK
    const claudeMessage = {
      role: 'user' as const,
      content: [
        {
          type: 'text' as const,
          text: 'Please analyze this image and describe what you see.'
        },
        imageResult.imageBlock // This is Claude SDK compatible
      ]
    };

    console.log('Claude SDK message structure prepared:');
    console.log({
      role: claudeMessage.role,
      content: [
        claudeMessage.content[0],
        {
          type: claudeMessage.content[1].type,
          source: {
            type: claudeMessage.content[1].source.type,
            media_type: claudeMessage.content[1].source.media_type,
            data: `${claudeMessage.content[1].source.data.slice(0, 30)}...`
          }
        }
      ]
    });

    // This message can now be sent to Claude SDK
    // const response = await anthropic.messages.create({
    //   model: "claude-3-sonnet-20240229",
    //   max_tokens: 1024,
    //   messages: [claudeMessage]
    // });

  } catch (error) {
    console.error('Claude SDK integration failed:', error);
  }
}

async function errorHandling() {
  console.log('\n=== Error Handling ===');

  const handler = new MultimodalInputHandler({
    maxFileSizeBytes: 1024, // Very small limit for demonstration
  });

  const testCases = [
    '/nonexistent/file.png',
    '/path/to/empty.png',
    '/path/to/huge-file.png',
    '/path/to/document.pdf'
  ];

  for (const testPath of testCases) {
    try {
      await handler.processImageFile(testPath);
      console.log(`✓ Unexpected success: ${testPath}`);
    } catch (error: any) {
      console.log(`✗ Expected error for ${testPath}:`);
      console.log(`  Code: ${error.code}`);
      console.log(`  Message: ${error.message}`);
    }
  }
}

async function supportedFormatsCheck() {
  console.log('\n=== Supported Formats Check ===');

  const handler = new MultimodalInputHandler();

  console.log('Default supported formats:');
  handler.getConfig().supportedFormats.forEach(format => {
    console.log(`- ${format}`);
  });

  console.log('\nSupported media types:');
  handler.getSupportedMediaTypes().forEach(mediaType => {
    console.log(`- ${mediaType}`);
  });

  const testFiles = [
    'image.png',
    'photo.jpg',
    'animation.gif',
    'modern.webp',
    'document.pdf',
    'data.txt'
  ];

  console.log('\nFormat validation:');
  testFiles.forEach(filename => {
    const supported = handler.isSupportedFormat(filename);
    console.log(`- ${filename}: ${supported ? '✓ supported' : '✗ not supported'}`);
  });
}

// Run examples (commented out to prevent execution during import)
/*
async function runExamples() {
  await basicUsage();
  await customConfigurationUsage();
  await batchProcessing();
  await claudeSdkIntegration();
  await errorHandling();
  await supportedFormatsCheck();
}

// Uncomment to run examples
// runExamples().catch(console.error);
*/

export {
  basicUsage,
  customConfigurationUsage,
  batchProcessing,
  claudeSdkIntegration,
  errorHandling,
  supportedFormatsCheck
};