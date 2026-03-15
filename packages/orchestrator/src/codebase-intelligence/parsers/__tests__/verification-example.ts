/**
 * Verification Example for TreeSitterWrapper
 *
 * This demonstrates the key functionality of the TreeSitterWrapper
 * and serves as a quick integration test.
 */

import {
  TreeSitterWrapper,
  SupportedLanguage,
  getTreeSitterWrapper,
  type ParseResult
} from '../index.js';

/**
 * Example usage of TreeSitterWrapper
 */
export async function verifyTreeSitterWrapper(): Promise<void> {
  console.log('🌳 TreeSitterWrapper Verification');
  console.log('==================================\n');

  const wrapper = getTreeSitterWrapper();

  // Example 1: Parse TypeScript code
  const tsCode = `
interface User {
  id: number;
  name: string;
}

function greet(user: User): string {
  return \`Hello, \${user.name}!\`;
}
  `.trim();

  console.log('📄 Parsing TypeScript code...');
  const tsResult = await wrapper.parse(tsCode, SupportedLanguage.TypeScript);
  console.log(`✅ AST Root Type: ${tsResult.rootNode.type}`);
  console.log(`✅ Has Errors: ${tsResult.hasErrors}`);
  console.log(`✅ Child Count: ${tsResult.rootNode.childCount}\n`);

  // Example 2: Language detection
  console.log('🔍 Language Detection Tests...');
  const testFiles = [
    'app.ts', 'component.tsx', 'script.js', 'main.py',
    'main.go', 'App.java', 'lib.rs', 'unknown.txt'
  ];

  testFiles.forEach(fileName => {
    const detected = wrapper.detectLanguage(fileName);
    console.log(`   ${fileName} → ${detected || 'unsupported'}`);
  });

  // Example 3: Supported languages
  console.log('\n📋 Supported Languages:');
  wrapper.getSupportedLanguages().forEach(lang => {
    console.log(`   - ${lang}`);
  });

  // Example 4: Cache statistics
  console.log('\n📊 Cache Statistics:');
  const cacheStats = wrapper.getCacheStats();
  console.log(`   Loaded languages: ${cacheStats.loadedLanguages.join(', ')}`);
  console.log(`   Cache size: ${cacheStats.size}`);

  console.log('\n✨ TreeSitterWrapper verification complete!');
}

// Self-test when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  verifyTreeSitterWrapper().catch(console.error);
}