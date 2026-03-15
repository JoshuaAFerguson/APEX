#!/usr/bin/env node

const { MultimodalInputHandler } = require('./packages/orchestrator/dist/tools/multimodal-input-handler');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function testProcessDesignMockup() {
  try {
    console.log('Testing processDesignMockup method for local files...');

    // Create a minimal PNG file for testing
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-test-'));
    const pngData = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x01, 0x00, 0x00, 0x00, 0x00, 0x37, 0x6E, 0xF9, 0x24,
      0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, 0x54,
      0x78, 0x9C, 0x62, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01,
      0xE2, 0x21, 0xBC, 0x33,
      0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44,
      0xAE, 0x42, 0x60, 0x82
    ]);

    const testFile = path.join(tempDir, 'TestScreen_Mobile@2x.png');
    fs.writeFileSync(testFile, pngData);

    const handler = new MultimodalInputHandler();
    const result = await handler.processDesignMockup(testFile);

    console.log('✅ Test passed!');
    console.log('Result keys:', Object.keys(result));
    console.log('Export format:', result.exportFormat);
    console.log('Export scale:', result.exportScale);
    console.log('Media type:', result.mediaType);
    console.log('Platform name:', result.metadata.platformName);
    console.log('Frame name:', result.metadata.frameName);

    // Cleanup
    fs.unlinkSync(testFile);
    fs.rmdirSync(tempDir);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testProcessDesignMockup();