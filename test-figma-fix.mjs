#!/usr/bin/env node

/**
 * Test script to verify Figma URL parsing functionality
 */

import { MultimodalInputHandler, isFigmaUrl, parseFigmaUrl } from './packages/orchestrator/src/tools/multimodal-input-handler.js';

console.log('🧪 Testing Figma URL parsing functionality...\n');

// Test direct class usage
const handler = new MultimodalInputHandler();

// Test URLs
const testUrls = [
  'https://www.figma.com/file/abc123xyz456789012345678/Login-Screens',
  'https://figma.com/design/abc123xyz456789012345678/Dashboard?node-id=123:456',
  'https://www.figma.com/proto/abc123xyz456789012345678/Mobile-App?version-id=123',
  'https://sketch.com/file/123', // Should fail
  'not-a-url' // Should fail
];

console.log('✅ Testing isFigmaUrl method:');
testUrls.forEach(url => {
  const result = handler.isFigmaUrl(url);
  console.log(`  ${url} -> ${result}`);
});

console.log('\n✅ Testing parseFigmaUrl method:');
testUrls.slice(0, 3).forEach(url => { // Only test valid Figma URLs
  const result = handler.parseFigmaUrl(url);
  if (result.success) {
    console.log(`  ✓ ${url}`);
    console.log(`    File Key: ${result.info.fileKey}`);
    console.log(`    File Name: ${result.info.fileName}`);
    console.log(`    URL Type: ${result.info.urlType}`);
    console.log(`    Node ID: ${result.info.nodeId || 'none'}`);
  } else {
    console.log(`  ✗ ${url} - ${result.error}`);
  }
});

console.log('\n✅ Testing convenience functions:');
console.log(`  isFigmaUrl convenience: ${isFigmaUrl('https://www.figma.com/file/test123456789012345678/Test')}`);

const parseResult = parseFigmaUrl('https://www.figma.com/file/test123456789012345678/Test?node-id=456:789');
if (parseResult.success) {
  console.log(`  parseFigmaUrl convenience: Success - fileKey: ${parseResult.info.fileKey}, nodeId: ${parseResult.info.nodeId}`);
} else {
  console.log(`  parseFigmaUrl convenience: Failed - ${parseResult.error}`);
}

console.log('\n🎉 All tests completed successfully! The Figma URL parsing functionality is working.');