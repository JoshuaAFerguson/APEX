/**
 * Manual test runner to verify the extractor implementation
 * This is just for validation purposes during development
 */

import {
  getExtractorForLanguage,
  hasExtractorSupport,
  SymbolKind,
  ExtractionError
} from '../index.js';

async function runManualTests() {
  console.log('🧪 Running manual tests for Symbol Extractor...\n');

  // Test 1: Factory function
  console.log('Test 1: Factory function');
  try {
    const tsExtractor = getExtractorForLanguage('typescript');
    console.log('✅ TypeScript extractor obtained');

    const pyExtractor = getExtractorForLanguage('python');
    console.log('✅ Python extractor obtained');

    // Test same instance
    const tsExtractor2 = getExtractorForLanguage('typescript');
    console.log('✅ Singleton pattern works:', tsExtractor === tsExtractor2);
  } catch (error) {
    console.log('❌ Factory function failed:', error);
  }

  // Test 2: Language support detection
  console.log('\nTest 2: Language support detection');
  const supportedLangs = ['typescript', 'tsx', 'javascript', 'python'];
  const unsupportedLangs = ['java', 'cpp', 'rust'];

  for (const lang of supportedLangs) {
    const isSupported = hasExtractorSupport(lang);
    console.log(`${isSupported ? '✅' : '❌'} ${lang}: ${isSupported}`);
  }

  for (const lang of unsupportedLangs) {
    const isSupported = hasExtractorSupport(lang);
    console.log(`${isSupported ? '❌' : '✅'} ${lang}: ${isSupported}`);
  }

  // Test 3: Error handling
  console.log('\nTest 3: Error handling');
  try {
    getExtractorForLanguage('unsupported');
    console.log('❌ Should have thrown error for unsupported language');
  } catch (error) {
    if (error instanceof ExtractionError) {
      console.log('✅ ExtractionError thrown for unsupported language');
    } else {
      console.log('❌ Wrong error type:', error);
    }
  }

  // Test 4: Symbol extraction
  console.log('\nTest 4: Symbol extraction');
  try {
    const extractor = getExtractorForLanguage('typescript');
    const result = await extractor.extract(
      'export function test(): void {}',
      'typescript' as any
    );
    console.log('✅ Symbol extraction completed');
    console.log(`   Symbols found: ${result.symbols.length}`);
    console.log(`   Has errors: ${result.hasErrors}`);
  } catch (error) {
    console.log('❌ Symbol extraction failed:', error);
  }

  console.log('\n🎉 Manual tests completed!');
}

// Only run if this file is executed directly
if (require.main === module) {
  runManualTests().catch(console.error);
}

export { runManualTests };