/**
 * GitHub Issue Image Extraction Example
 *
 * This example demonstrates how to use the MultimodalInputHandler
 * to extract and process images from GitHub issue content.
 */

import { processGitHubIssueImages, MultimodalInputHandler } from './multimodal-input-handler';

// Example GitHub issue content with various image formats
const exampleIssueContent = `
# Bug Report: UI Layout Issue

## Description
The navigation bar is overlapping with the main content on mobile devices.

## Screenshots

Here's what it looks like on mobile:
![Mobile screenshot](https://user-images.githubusercontent.com/12345/mobile-bug.png)

And here's the expected layout from our design:
<img src="https://user-images.githubusercontent.com/12345/expected-layout.jpg" alt="Expected layout" />

## Steps to Reproduce
1. Open the app on a mobile device
2. Navigate to the main page
3. Observe the overlapping elements

## Additional Context
This seems related to the CSS changes in PR #123. Here's the problematic code:
https://raw.githubusercontent.com/myorg/myrepo/main/styles/navigation.css

The issue affects both iOS and Android devices as shown in these images:
- iOS: https://user-images.githubusercontent.com/12345/ios-issue.png
- Android: https://user-images.githubusercontent.com/12345/android-issue.webp

## Comparison
![Before fix](https://user-images.githubusercontent.com/12345/before.gif)
![After fix](https://user-images.githubusercontent.com/12345/after.png)
`;

/**
 * Example: Extract and process GitHub issue images
 */
async function exampleGitHubImageExtraction() {
  try {
    console.log('Processing GitHub issue content...\n');

    // Process the issue content to extract and download images
    const result = await processGitHubIssueImages(exampleIssueContent);

    console.log('--- GitHub Issue Image Extraction Results ---');
    console.log(`Total processing time: ${result.totalProcessingTime}ms`);
    console.log(`Found ${result.imageUrls.length} image URLs`);
    console.log(`Successfully processed ${result.imageBlocks.length} images`);

    if (result.errors && result.errors.length > 0) {
      console.log(`Encountered ${result.errors.length} errors`);
    }

    console.log('\n--- Extracted Image URLs ---');
    result.imageUrls.forEach((url, index) => {
      console.log(`${index + 1}. ${url}`);
    });

    console.log('\n--- Image Processing Details ---');
    result.imageMetadata.forEach((metadata, index) => {
      console.log(`Image ${index + 1}:`);
      console.log(`  URL: ${metadata.url}`);
      console.log(`  Size: ${metadata.fileSizeBytes} bytes`);
      console.log(`  Media Type: ${metadata.mediaType}`);
      console.log(`  Download Time: ${metadata.downloadTime}ms`);
      console.log('');
    });

    if (result.errors) {
      console.log('--- Errors ---');
      result.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }

    console.log('\n--- Claude SDK Compatible Image Blocks ---');
    console.log(`Generated ${result.imageBlocks.length} image blocks ready for vision processing`);

    // Example: Using the image blocks with Claude SDK (pseudo-code)
    console.log('\n--- Example Claude SDK Usage ---');
    console.log('const messageContent = [');
    console.log('  { type: "text", text: "Please analyze these GitHub issue images:" },');
    result.imageBlocks.forEach((imageBlock, index) => {
      console.log(`  // Image ${index + 1}: ${result.imageMetadata[index].url}`);
      console.log('  {');
      console.log(`    type: "${imageBlock.type}",`);
      console.log('    source: {');
      console.log(`      type: "${imageBlock.source.type}",`);
      console.log(`      media_type: "${imageBlock.source.media_type}",`);
      console.log(`      data: "${imageBlock.source.data.substring(0, 50)}..."  // Base64 data truncated`);
      console.log('    }');
      console.log('  },');
    });
    console.log('];');

    return result;
  } catch (error) {
    console.error('Error processing GitHub issue images:', error);
    throw error;
  }
}

/**
 * Example: Using custom configuration
 */
async function exampleWithCustomConfig() {
  console.log('\n--- Custom Configuration Example ---');

  const handler = new MultimodalInputHandler({
    maxFileSizeBytes: 5 * 1024 * 1024, // 5MB limit
    supportedFormats: ['png', 'jpg', 'jpeg'], // Only these formats
  });

  try {
    const simpleContent = '![Test](https://user-images.githubusercontent.com/12345/test.png)';
    const result = await handler.processGitHubIssueImages(simpleContent);

    console.log('Custom config processing completed successfully');
    console.log(`Processed ${result.imageBlocks.length} images with custom limits`);

    return result;
  } catch (error) {
    console.error('Custom config processing failed:', error);
    throw error;
  }
}

/**
 * Example: Handling edge cases
 */
async function exampleEdgeCases() {
  console.log('\n--- Edge Cases Example ---');

  // Content with no images
  const noImagesContent = 'This issue has no images, just text.';
  const noImagesResult = await processGitHubIssueImages(noImagesContent);
  console.log(`No images content: found ${noImagesResult.imageUrls.length} images`);

  // Content with duplicate URLs
  const duplicateContent = `
  ![Image 1](https://user-images.githubusercontent.com/12345/same.png)
  ![Image 2](https://user-images.githubusercontent.com/12345/same.png)
  https://user-images.githubusercontent.com/12345/same.png
  `;
  const duplicateResult = await processGitHubIssueImages(duplicateContent);
  console.log(`Duplicate URLs: extracted ${duplicateResult.imageUrls.length} unique URLs`);

  // Content with non-image URLs (should be filtered out)
  const mixedContent = `
  ![Image](https://user-images.githubusercontent.com/12345/image.png)
  [Document](https://user-images.githubusercontent.com/12345/doc.txt)
  https://user-images.githubusercontent.com/12345/readme.md
  `;
  const mixedResult = await processGitHubIssueImages(mixedContent);
  console.log(`Mixed content: found ${mixedResult.imageUrls.length} valid image URLs`);
}

// Export for use in other examples or tests
export {
  exampleGitHubImageExtraction,
  exampleWithCustomConfig,
  exampleEdgeCases,
  exampleIssueContent,
};

// Run examples if this file is executed directly
if (require.main === module) {
  (async () => {
    try {
      await exampleGitHubImageExtraction();
      await exampleWithCustomConfig();
      await exampleEdgeCases();
    } catch (error) {
      console.error('Example execution failed:', error);
      process.exit(1);
    }
  })();
}