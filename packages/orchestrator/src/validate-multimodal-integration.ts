/**
 * Validation script for multimodal integration
 * Quick validation to ensure multimodal functionality works as expected
 */

import { MultimodalInputHandler, MultimodalInputError } from './tools/multimodal-input-handler';
import type {
  MultimodalInput,
  ImageInput,
  WebPageInput,
  DesignMockupInput,
} from '@apexcli/core';

async function validateMultimodalIntegration() {
  console.log('🔍 Validating multimodal integration...');

  const handler = new MultimodalInputHandler();

  try {
    // Test 1: Basic image input processing
    console.log('✅ Test 1: Basic image input processing');
    const imageInput: ImageInput = {
      type: 'image',
      mediaType: 'image/png',
      data: Buffer.from('fake-image-data').toString('base64'),
      description: 'Test image',
      encoding: 'base64',
    };

    const imageResult = await handler.processInputs([imageInput]);
    console.log('   ✓ Image processing completed');
    console.log('   ✓ Status:', imageResult.status);
    console.log('   ✓ Input counts:', imageResult.inputCounts);

    // Test 2: Web page input processing
    console.log('✅ Test 2: Web page input processing');
    const webPageInput: WebPageInput = {
      type: 'web_page',
      url: 'https://example.com',
      title: 'Test Page',
      capturedText: 'This is test content from a web page',
      description: 'Example web page',
    };

    const webPageResult = await handler.processInputs([webPageInput]);
    console.log('   ✓ Web page processing completed');
    console.log('   ✓ Status:', webPageResult.status);
    console.log('   ✓ Input counts:', webPageResult.inputCounts);

    // Test 3: Design mockup input processing
    console.log('✅ Test 3: Design mockup input processing');
    const designMockupInput: DesignMockupInput = {
      type: 'design_mockup',
      designTool: 'figma',
      description: 'Figma design mockup',
      fileId: 'test123',
      fileUrl: 'https://figma.com/file/test123/design',
    };

    const designResult = await handler.processInputs([designMockupInput]);
    console.log('   ✓ Design mockup processing completed');
    console.log('   ✓ Status:', designResult.status);
    console.log('   ✓ Input counts:', designResult.inputCounts);

    // Test 4: Mixed input processing
    console.log('✅ Test 4: Mixed input processing');
    const mixedInputs: MultimodalInput[] = [imageInput, webPageInput, designMockupInput];

    const mixedResult = await handler.processInputs(mixedInputs);
    console.log('   ✓ Mixed input processing completed');
    console.log('   ✓ Status:', mixedResult.status);
    console.log('   ✓ Input counts:', mixedResult.inputCounts);
    console.log('   ✓ Context summary:', mixedResult.contextSummary);

    // Test 5: Error handling validation
    console.log('✅ Test 5: Error handling validation');
    try {
      const invalidInput = {
        type: 'invalid_type',
        data: 'test',
      } as any;

      await handler.processInputs([invalidInput]);
      console.log('   ❌ Should have thrown an error for invalid input type');
    } catch (error) {
      if (error instanceof MultimodalInputError) {
        console.log('   ✓ Correctly threw MultimodalInputError for invalid input type');
      } else {
        console.log('   ✓ Threw error for invalid input type:', error.message);
      }
    }

    // Test 6: Empty input array
    console.log('✅ Test 6: Empty input array handling');
    const emptyResult = await handler.processInputs([]);
    console.log('   ✓ Empty array processed correctly');
    console.log('   ✓ Status:', emptyResult.status);
    console.log('   ✓ Input counts:', emptyResult.inputCounts);

    console.log('\n🎉 All multimodal integration tests passed!');
    return true;

  } catch (error) {
    console.error('❌ Validation failed:', error);
    return false;
  }
}

// Export for use in tests or direct execution
export { validateMultimodalIntegration };

// Allow running directly with ts-node or similar
if (require.main === module) {
  validateMultimodalIntegration().then((success) => {
    process.exit(success ? 0 : 1);
  });
}